/**
 * 弹弹消消乐 · 关卡平衡性回归测试
 * -------------------------------------------------------------
 * 直接加载生产逻辑（prototype-data.js + prototype-core.js，二者不依赖任何渲染 API），
 * 在 Node 里跑「会玩的玩家」对局仿真，输出通关率 / 星级 / 时长 / 峰值球数，
 * 并对偏离目标区间的关卡给出非零退出码。
 *
 *   node design/balance-sim.js                  # 默认每关每档 40 局 + 200 局压测
 *   node design/balance-sim.js 200 200          # 每档 200 局（结果更稳）
 *   node design/balance-sim.js 200 200 20261020          # 指定随机种子复现某次结果
 *   node design/balance-sim.js 250 0 11 tmp.json         # 额外导出结构化 JSON（供多 seed 聚合 / CI）
 *
 * 新增或改动任何关卡地图后，必须重跑本脚本再提交。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const N = Number(process.argv[2]) || 40;
const PRESS = process.argv[3] !== undefined ? Number(process.argv[3]) : 200;   // 传 0 可跳过压测

/* ---------------- 0. 固定随机种子 ----------------
 * 关卡平衡性断言属于「回归门禁」，必须可复现：同一份关卡数据每次跑出完全相同的
 * 通关率。若不固定种子，±3~5% 的抽样抖动会让同一条配置时而通过时而失败。 */
const SEED = Number(process.argv[4]) || 20261020;
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Math.random = mulberry32(SEED);   // 同时作用于玩家模型与游戏内部随机（分裂抖动等）

/* ---------------- 1. 在沙箱里加载纯逻辑层 ---------------- */
const sandbox = {
  console, Math, JSON, Date,
  performance: { now: () => Date.now() },
  localStorage: { getItem: () => null, setItem: () => {} },
  navigator: {}, setTimeout, clearTimeout,
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);

const dir = path.join(__dirname, 'js');
['prototype-data.js', 'prototype-core.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sandbox, { filename: f });
});
// 剥离副作用：音效与存档在仿真里无需存在
sandbox.Sfx = { play() {} };
sandbox.Storage = { save() {} };
vm.runInContext('window.Sfx=Sfx; window.Storage=Storage;', sandbox);

const Game = sandbox.Game, S = Game.S, CFG = Game.CFG, TT = sandbox.TT;
const P = Game.PHASE;

/* ---------------- 2. 几何辅助 ---------------- */
/** v4 需求⑦：把 gapCols 拆成若干连续缺口段（支持多缺口 / 非对称缺口） */
function gapInfo() {
  const dist = (CFG.PADDLE_Y - CFG.BALL_R - 1) - CFG.ARENA_BOTTOM;
  const segs = [];
  if (!S.gapCols.length) return { segs, n: 0, cx: CFG.W / 2, half: 4, tol: 0.03 };
  let start = S.gapCols[0], prev = S.gapCols[0];
  for (let i = 1; i <= S.gapCols.length; i++) {
    const cur = S.gapCols[i];
    if (cur !== prev + 1) {                       // 连续段结束
      const n = prev - start + 1;
      const cx = CFG.ARENA_LEFT + (start + n / 2) * CFG.CELL;
      const half = Math.max(4, n * CFG.CELL / 2 - CFG.BALL_R - 1);
      segs.push({ start, end: prev, n, cx, half, tol: Math.atan2(half, dist) });
      start = cur;
    }
    prev = cur;
  }
  const widest = segs.reduce((a, b) => (b.n > a.n ? b : a), segs[0]);
  return { segs, n: S.gapCols.length, cx: widest.cx, half: widest.half, tol: widest.tol };
}

function countDestructible(lv) {
  let n = 0;
  lv.map.forEach(r => {
    for (const ch of r)
      if (ch === 'B' || ch === 'S' || ch === 'T' || ch === 'L' || ch === 'X' || ch === 'P' || ch === 'F' || ch === 'G') n++;
  });
  return n;
}

/* ---------------- 3. 玩家模型（v4） ----------------
 * skill ∈ (0,1]：1 = 完全精确。每关 3 颗球 = 3 次发射机会，瞄准/发射/回弹/接球全在 PLAY 态内并行。
 *   发射（v4 需求⑦多缺口）：场上无球时逐个缺口段轮流试移到位，在入射容差角内搜一条「预测命中可消方块」的
 *     弹道才开火；本段打不到就换下一个缺口段（不硬发撞墙）。有球时若已在某缺口上方允许隔帧补发。
 *   接球回弹：对最早落向接球区的球做落点预判（含侧壁展开反射），叠加反应粒度 REACT + 落点误差 ERR。
 *   道具悬浮块（v4 需求④）：价值高且必落原列，只要不比最近的球晚太多就优先移动接住，接住才在原坐标生效。
 */
function runLevel(idx, skill) {
  Game.loadLevel(idx);
  Game.beginAim();
  const g = gapInfo();
  const REACT = Math.round(60 * (0.12 + 0.15 * (1 - skill)));   // 熟练 8 帧 / 新手 16 帧才改一次预判
  const ERR = CFG.CELL * 1.6 * (1 - skill);                      // 熟练 ±2px / 新手 ±19px
  let frames = 0, reactLeft = 0, target = null, segIdx = 0;
  let peakBalls = 0, openedEv = 0, prevOpened = false;
  const maxFrames = 60 * 60 * 5;                                 // 5 分钟硬上限，超出即判卡死
  const nSeg = Math.max(1, g.segs.length);

  function tryFire(seg) {
    const o = Game.paddleCenter();
    let fired = false;
    for (let k = 0; k <= 8 && !fired; k++) {
      const a = -seg.tol + (2 * seg.tol) * (k / 8) + (Math.random() * 2 - 1) * 0.04;
      Game.updateAim(o.x + Math.sin(a) * 160, o.y - Math.cos(a) * 160);
      if (S.aim.path && S.aim.path.hit) { Game.shoot(); fired = true; }
    }
    if (!fired) Game.clearAim();
    return fired;
  }

  while (S.phase !== P.WIN && S.phase !== P.LOSE && frames < maxFrames) {
    // 接球预判：球进入接球区（越过方块底）后才立案，逐帧按 REACT 粒度刷新
    if (reactLeft <= 0) {
      reactLeft = REACT;
      let cand = null, candT = 1e9;
      S.balls.forEach(b => {
        if (b.vy <= 0) return;
        if (b.y < CFG.ARENA_BOTTOM + CFG.CELL) return;           // 仍在穿方块区，落点不可预测
        const t = (CFG.PADDLE_Y - b.y) / b.vy;
        if (t < candT) { candT = t; cand = b; }
      });
      if (cand) {
        const lo = CFG.ARENA_LEFT + CFG.BALL_R, hi = CFG.ARENA_RIGHT - CFG.BALL_R, width = hi - lo;
        let u = cand.x - lo + cand.vx * candT;                    // 侧壁展开反射求落点
        u = ((u % (2 * width)) + 2 * width) % (2 * width);
        const land = u <= width ? lo + u : lo + 2 * width - u;
        target = land + (Math.random() * 2 - 1) * ERR;
      } else if (S.balls.length === 0) target = null;
    }
    // 发射决策（v4 多缺口）
    if (S.shotsLeft > 0 && !S.aim.active) {
      const pc = S.paddle.x + S.paddle.w / 2;
      if (S.balls.length === 0) {
        const seg = g.segs[segIdx] || g;
        // 到位判据用缺口半宽（而非固定 1.2px）：120px 宽挡板靠墙缺口会被夹到边缘，中心无法贴合窄口中心
        if (Math.abs(pc - seg.cx) > Math.max(1.5, seg.half)) {
          if (target === null) Game.movePaddleTo(seg.cx);        // 无接球任务时才为发射移动
        } else if (!tryFire(seg)) {
          segIdx = (segIdx + 1) % nSeg;                          // 本段无解 → 换下一缺口
        }
      } else {
        const seg = g.segs.find(s => Math.abs(pc - s.cx) < s.half) || null;
        if (seg && frames % 30 === 0) tryFire(seg);
      }
    }
    if (target !== null && (S.balls.length > 0 || S.shotsLeft === 0)) Game.movePaddleTo(target);

    Game.update(1 / 60);
    frames++;
    if (reactLeft > 0) reactLeft--;
    if (S.bottomOpened && !prevOpened) openedEv++;
    prevOpened = S.bottomOpened;
    peakBalls = Math.max(peakBalls, S.balls.length);

    // 每帧健全性检查：NaN / 越界 / 超球数上限
    for (const b of S.balls) {
      if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.vx) || !isFinite(b.vy)) bad('NaN/Inf 速度或坐标');
      if (b.x < -50 || b.x > CFG.W + 50 || b.y < -50 || b.y > CFG.H + 50) bad('球越出屏幕');
      if (S.balls.length > CFG.MAX_BALLS) bad('同屏球数超上限');
    }
  }

  const r = S.lastResult || {};
  return {
    phase: S.phase, stuck: frames >= maxFrames,
    sec: +S.elapsed.toFixed(1), stars: r.stars || 0,
    destroyed: S.destroyed, total: S.totalBricks,
    launched: S.launched, chain: S.maxChain,
    caught: S.caughtTot, lost: S.lostTot, peakBalls, opened: openedEv
  };
}

/* ---------------- 4. 每关目标区间（v2） ----------------
 * v1 用「新手下限 + 熟练上限」两条单边界。v2 改为每关仅 3 次发射机会后，
 * 难度上限天然被「弹药不够」锁住：同一张图新手会卡、高手也不会无聊到 100%，
 * 若再卡一个熟练上限（如 ≤95%），高技能档常常 100% 会频繁触上界造出假失败。
 * 因此 v2 只保留一条地板：
 *   · 新手 floor —— 该关必须能被熟练度一般的玩家打通（依赖 3 球回弹链）
 *   · 熟练档只看全局兜底 HARD.min，防止某一档彻底失控。
 * 难度不再靠压通过率、而是靠耗时星线（starTimes）与地图几何体现。
 */
const BANDS = {
  default: { floor: 0.50, ceil: 0.99 },
  1: { floor: 0.60, ceil: 0.99 },   // 第 1 关·纯教学关：新手不该大面积卡关
  2: { floor: 0.50, ceil: 0.99 },   // 第 2 关·缺口偏置（新手村）
  3: { floor: 0.45, ceil: 0.99 },   // 第 3 关·满屏窄口（最难，仍需可清）
  4: { floor: 0.50, ceil: 0.99 },   // v3 样板关 4~10：默认地板 0.50，熟练档只防彻底失控
  5: { floor: 0.48, ceil: 0.99 },
  6: { floor: 0.46, ceil: 0.99 },
  7: { floor: 0.45, ceil: 0.99 },
  8: { floor: 0.44, ceil: 0.99 },
  9: { floor: 0.43, ceil: 0.99 },
  10: { floor: 0.42, ceil: 0.99 }
};
const HARD = { min: 0.40, max: 1.0 };               // 低于 min 即视为关卡设计失败；v2 无“无聊上限”，满通关合法
const bandFor = lv => BANDS[lv] || BANDS.default;
/** 取本档对应的边界：新手档看 floor；熟练档只防彻底失控（不卡上限）；中间档取交集 */
function bounds(band, skill) {
  if (skill <= 0.6) return { lo: band.floor, hi: HARD.max };
  if (skill >= 0.85) return { lo: HARD.min, hi: HARD.max };
  return { lo: band.floor, hi: band.ceil };
}

/* ---------------- 5. 聚合与报告 ---------------- */
let anomalies = 0, printed = 0;
function bad(msg) { anomalies++; if (printed++ < 10) console.log('  ✗ 异常：' + msg); }

/** 对某关 × 某熟练度跑 n 局，汇总成可读指标 */
function simulate(lvIdx, skill, n) {
  let w = 0, s = 0, dsum = 0, chainSum = 0, secsum = 0, winsec = 0, pb = 0;
  let opened = 0, cat = 0, lst = 0, stuck = 0;
  for (let i = 0; i < n; i++) {
    const r = runLevel(lvIdx, skill);
    if (r.phase === P.WIN) { w++; s += r.stars; winsec += r.sec; }
    else if (r.stuck) stuck++;
    dsum += r.destroyed; chainSum += r.chain; secsum += r.sec; pb += r.peakBalls;
    opened += r.opened; cat += r.caught; lst += r.lost;
  }
  const rate = w / n;
  return {
    lv: lvIdx + 1, name: TT.LEVELS[lvIdx].name, balls: TT.LEVELS[lvIdx].balls,
    bricks: countDestructible(TT.LEVELS[lvIdx]), skill, n,
    winRate: rate, stars: +(s / Math.max(1, w)).toFixed(2),
    destroyed: +(dsum / n).toFixed(1), chain: +(chainSum / n).toFixed(1),
    sec: +(secsum / n).toFixed(1), winSec: +(winsec / Math.max(1, w)).toFixed(1),
    peakBalls: +(pb / n).toFixed(1),
    avgOpened: +(opened / n).toFixed(2),
    missRate: +(lst / Math.max(1, lst + cat)).toFixed(4),
    caughtTot: cat, lostTot: lst, opened, stuck
  };
}

/** 物理健壮性压测：高速 + 极限角度，逐帧查 NaN / 越界 / 超球数上限 */
function stress(n) {
  let bad0 = 0, peak = 0;
  const origSpeed = CFG.BALL_SPEED;
  for (let t = 0; t < n; t++) {
    Game.loadLevel(t % TT.LEVELS.length);
    Game.beginAim();
    const o = Game.paddleCenter();
    const a = (Math.random() * 2 - 1) * CFG.MAX_AIM_ANGLE;
    Game.updateAim(o.x + Math.sin(a) * 200, o.y - Math.cos(a) * 200);
    CFG.BALL_SPEED = 900;                                   // 正常速度的 2.1 倍
    Game.shoot();
    for (let i = 0; i < 60 * 25; i++) {
      Game.update(1 / 60);
      peak = Math.max(peak, S.balls.length);
      for (const b of S.balls) {
        if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.vx) || !isFinite(b.vy)) bad0++;
        else if (b.x < -50 || b.x > CFG.W + 50 || b.y < -50 || b.y > CFG.H + 50) bad0++;
        else if (S.balls.length > CFG.MAX_BALLS) bad0++;
      }
    }
  }
  CFG.BALL_SPEED = origSpeed;
  return { anomalies: bad0, peakBalls: peak };
}

function main() {
  const report = [];
  console.log('=== 布局参数 ===');
  Game.loadLevel(0);
  const g0 = gapInfo();
  console.log(`CELL=${CFG.CELL} COLS=${CFG.COLS} ROWS=${CFG.ROWS} 竞技区=[${CFG.ARENA_TOP},${CFG.ARENA_BOTTOM}]`);
  console.log(`PADDLE_Y=${CFG.PADDLE_Y} DEATH_Y=${CFG.DEATH_Y} L1缺口=${g0.n}格/${g0.segs.length}段 入射容差=±${(g0.tol * 180 / Math.PI).toFixed(1)}°（v4 支持多缺口）`);
  console.log(`每关每档 ${N} 局 | 随机种子 ${SEED}`);

  for (const skill of [0.55, 0.9]) {
    console.log(`\n=== 玩家熟练度 ${skill}（每关 ${N} 局）===`);
    let totWin = 0;
    for (let lv = 0; lv < TT.LEVELS.length; lv++) {
      const r = simulate(lv, skill, N);
      totWin += r.winRate * N;
      const band = bandFor(lv + 1), bd = bounds(band, skill);
      console.log(`关卡${r.lv}「${r.name}」${r.balls}球/${r.bricks}方块 | ` +
        `通关率 ${(r.winRate * 100).toFixed(0)}%（要求 ≥${(bd.lo * 100).toFixed(0)}%）| ` +
        `星级 ${r.stars} | 均消 ${r.destroyed} | 最长回弹链 ${r.chain} | ` +
        `时长 ${r.sec}s（胜局 ${r.winSec}s）| 峰值同屏 ${r.peakBalls}球`);
      console.log(`   └ 场均开底 ${r.avgOpened} 次 | 漏接率 ${(r.missRate * 100).toFixed(1)}%（${r.caughtTot}接/${r.lostTot}漏）`);
      if (r.winRate < bd.lo || r.winRate > bd.hi) {
        bad(`关卡${r.lv}（熟练度${skill}）通关率 ${(r.winRate * 100).toFixed(0)}% 越界，要求 ${(bd.lo * 100).toFixed(0)}~${(bd.hi * 100).toFixed(0)}%`);
      }
      if (r.stuck) bad(`关卡${r.lv}（熟练度${skill}）存在 ${r.stuck} 局卡死（超 5 分钟未结束）`);
      report.push(r);
    }
    console.log(`-- 总通关率 ${(totWin / (N * TT.LEVELS.length) * 100).toFixed(0)}%`);
  }

  const st = stress(PRESS);
  console.log(`\n=== 物理健壮性压测（${PRESS} 局 × 900px/s × 极限角度）===`);
  console.log(`压测异常 ${st.anomalies} 项 | 同屏峰值球数 ${st.peakBalls}（上限 ${CFG.MAX_BALLS}）`);
  if (st.anomalies) bad(`压测出现 ${st.anomalies} 项物理异常（详计数见上行）`);

  console.log('\n' + '='.repeat(52));
  if (process.argv[5]) {
    fs.writeFileSync(process.argv[5],
      JSON.stringify({ seed: SEED, N, PRESS, peakBallsPress: st.peakBalls, anomalies, report }, null, 2), 'utf8');
  }
  if (anomalies === 0) {
    console.log('✅ 通过：所有关卡通关率落在目标区间，无卡死、无穿透。');
  } else {
    console.log(`❌ 未通过：共 ${anomalies} 项异常，请调整 prototype-data.js 中的关卡数值后重跑。`);
    process.exit(1);
  }
}

/* 被 require 时只导出工具 API（供 tools/sweep.js 等复用），不跑报告 */
module.exports = { runLevel, simulate, stress, gapInfo, countDestructible, bandFor, bounds, BANDS, HARD, main,
  Game, S, CFG, TT, P, setSeed: a => { Math.random = mulberry32(a); } };

if (require.main === module) main();
