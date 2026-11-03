/**
 * 弹弹消消乐 · 交互原型 —— 核心逻辑（状态机 / 网格 / 物理 / 回弹流程）【v3】
 *
 * 双区物理模型：
 *   ① 竞技区（容器内）：无重力，小球匀速直线 + 镜面反弹，弹道完全可预测；
 *   ② 接球区（缺口以下）：无重力，小球匀速直线下落；
 *      接住→沿横条拖动方向回弹打回去；没接住→越过死亡线该球永久消失。
 *
 * v3 规则（specs/）：每关 3 颗球 = 3 次发射机会，可立即连发；方块全消即胜；
 * 弹药耗尽且同屏球全部漏完即败；星级按通关耗时评定（首次发射后才开始计时）；
 * 移除旧「停滞开底」，仅保留关卡硬超时开底排空；道具方块新增生命 / 爆炸 / 挡板。
 */
(function (global) {
  'use strict';

  var CFG = global.TT.CFG;
  var TYPE = global.TT.TYPE;
  var LEGEND = global.TT.LEGEND;
  var SCORE = global.TT.SCORE;

  /* ------------------------------------------------------------------ *
   * 状态机
   * ------------------------------------------------------------------ */
  var PHASE = {
    HOME: 'home',     // v5 需求③：主页（暂停弹窗「回到主页」进入）
    READY: 'ready',   // 关卡开场提示
    PLAY: 'play',     // 进行中：瞄准/发射/回弹/接球全部在此态内并行
    WIN: 'win',
    LOSE: 'lose'
  };

  /* ------------------------------------------------------------------ *
   * 游戏状态对象
   * ------------------------------------------------------------------ */
  function createState() {
    return {
      phase: PHASE.READY,
      levelIndex: 0,
      level: null,
      grid: [],           // grid[row][col] = { type, alive, opened, colorIdx }
      gapCols: [],        // 底部墙壁行的缺口列
      balls: [],
      particles: [],
      popups: [],
      msgs: [],           // v4：方块区居中的浮动提示栈（需求⑤）
      wallGhost: 0,       // v4：墙壁隐形剩余秒数（>0 时方块区墙壁可穿透，底部墙行除外）
      paddle: { x: 0, w: CFG.PADDLE_W, targetX: 0, vx: 0 },
      aim: { active: false, x: CFG.W / 2, y: CFG.ARENA_TOP + 100, dx: 0, dy: -1, path: [] },
      shotsLeft: 0,        // 剩余发射机会（每关 3 颗）
      launched: 0,         // 已发射次数（统计）
      score: 0,
      combo: 0,
      maxCombo: 0,
      destroyed: 0,
      totalBricks: 0,
      caughtTot: 0,        // 全局接住回弹次数（v2：不再按回合清零）
      lostTot: 0,          // 全局漏接次数
      chain: 0,            // 本次发射的回弹链长度（漏光即断）
      maxChain: 0,
      elapsed: 0,          // 关卡耗时（首次发射后开始累加，结算停止）——星级依据
      stallTime: 0,        // （v3 已停用）旧停滞计时，保留字段不再参与逻辑
      paddleBoost: 0,      // 挡板强化剩余秒数（>0 时挡板满宽）
      bottomOpened: false,
      shake: 0,
      time: 0,
      lastResult: null,
      // —— v5 需求①②：钱包 / 主动道具背包 / 弹窗态（main 会从 localStorage 注入钱包，故此处仅初始化默认值）——
      homeScroll: 0,       // v8：主页关卡列表滚动偏移
      diamonds: CFG.DIAMOND_START,           // 钻石钱包（结算按星数 +N，购买主动道具消耗）
      props: { splitAll: 1, wallHide: 1, paddleBig: 1 },  // 三类主动道具持有数量
      overlay: null                          // null | 'pause' | { buy: 'splitAll', hint: '' }
    };
  }

  var S = createState();

  /* ------------------------------------------------------------------ *
   * 工具函数
   * ------------------------------------------------------------------ */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function cellRect(r, c) {
    return {
      x: CFG.ARENA_LEFT + c * CFG.CELL,
      y: CFG.ARENA_TOP + r * CFG.CELL,
      w: CFG.CELL,
      h: CFG.CELL
    };
  }

  function isSolid(r, c) {
    if (r < 0 || r >= CFG.ROWS || c < 0 || c >= CFG.COLS) return false;
    var cell = S.grid[r][c];
    if (!cell || !cell.alive) return false;
    if (cell.opened) return false;           // 超时后底部墙壁被打开
    // v4 需求⑨：墙壁隐形期间，方块区(最底墙壁行除外)的墙可穿透
    if (cell.type === TYPE.WALL && S.wallGhost > 0 && r < CFG.ROWS - 1) return false;
    return isDestructible(cell.type) || cell.type === TYPE.WALL;
  }

  function isDestructible(t) {
    return t === TYPE.BRICK || t === TYPE.SPLIT || t === TYPE.LIFE ||
           t === TYPE.BOMB || t === TYPE.PADDLE || t === TYPE.SPLIT3 ||
           t === TYPE.SPEED || t === TYPE.GHOST;
  }

  /* ------------------------------------------------------------------ *
   * 关卡装载
   * ------------------------------------------------------------------ */
  function loadLevel(index) {
    var lv = global.TT.LEVELS[clamp(index, 0, global.TT.LEVELS.length - 1)];
    S.levelIndex = clamp(index, 0, global.TT.LEVELS.length - 1);
    S.level = lv;
    S.grid = [];
    S.gapCols = [];
    S.totalBricks = 0;

    var mapRows = recenterMap(lv.map);   // v6 需求②：形状垂直居中（底部墙壁行不动）
    for (var r = 0; r < CFG.ROWS; r++) {
      var rowStr = mapRows[r] || '';
      var row = [];
      for (var c = 0; c < CFG.COLS; c++) {
        var ch = rowStr.charAt(c) || '.';
        var type = LEGEND[ch] !== undefined ? LEGEND[ch] : TYPE.EMPTY;
        var cell = {
          type: type,
          alive: type !== TYPE.EMPTY,
          opened: false,
          colorIdx: (r * 7 + c * 3) % global.TT.PALETTE.bricks.length,
          hitAnim: 0,
          spawnAnim: Math.max(0, 1 - (r * 0.05 + c * 0.012))
        };
        row.push(cell);
        if (type !== TYPE.EMPTY && isDestructible(type)) S.totalBricks++;
        // 解析底部墙壁行缺口
        if (r === CFG.ROWS - 1 && type === TYPE.EMPTY) S.gapCols.push(c);
      }
      S.grid.push(row);
    }

    shrinkGaps();    // v5 需求⑤：按 GAP_MAX_CELLS 居中收窄底部缺口
    injectProps();   // v4 需求⑥：本关随机把 5%~10% 可消除方块换成道具块

    S.shotsLeft = lv.balls;
    S.launched = 0;
    S.score = 0;
    S.combo = 0;
    S.maxCombo = 0;
    S.destroyed = 0;
    S.balls.length = 0;
    S.particles.length = 0;
    S.popups.length = 0;
    S.msgs.length = 0;
    S.elapsed = 0;
    S.stallTime = 0;
    S.paddleBoost = 0;
    S.wallGhost = 0;
    S.paddle.w = CFG.PADDLE_W;
    S.bottomOpened = false;
    S.caughtTot = 0;
    S.lostTot = 0;
    S.chain = 0;
    S.maxChain = 0;
    S.lastResult = null;
    S.overlay = null;   // v5：切关重置任何弹窗态（钱包/道具为跨关持久，不在此重置）
    clearAim();   // 重置瞄准态，避免上一关残留 aim.active 卡住下一关

    // 需求约定：游戏开始时横条水平居中
    S.paddle.x = (CFG.W - CFG.PADDLE_W) / 2;
    S.paddle.targetX = S.paddle.x;

    S.phase = PHASE.READY;
  }

  function restart() { loadLevel(S.levelIndex); }

  /* v6 需求②：关卡形状在方块容器内垂直居中（原设计偏上）—— 底部墙壁行(ROWS-1)固定不动 */
  function recenterMap(map) {
    var rows = [], r, c, has;
    for (r = 0; r < CFG.ROWS; r++) rows.push(map[r] || '');
    var top = -1, bot = -1;
    for (r = 0; r < CFG.ROWS - 1; r++) {          // 不含底部墙壁行
      has = false;
      for (c = 0; c < CFG.COLS; c++) {
        var ch = rows[r].charAt(c);
        if (ch !== '.' && ch !== '') { has = true; break; }
      }
      if (has) { if (top < 0) top = r; bot = r; }
    }
    if (top < 0) return rows;
    var h = bot - top + 1;
    var band = CFG.ROWS - 1;                       // 可摆放内容的行数（0..band-1）
    var shift = Math.round((band - h) / 2) - top;
    if (shift === 0) return rows;
    var out = [];
    for (r = 0; r < CFG.ROWS; r++) {
      if (r === CFG.ROWS - 1) { out.push(rows[r]); continue; }  // 底部墙壁行固定
      var src = r - shift;
      out.push((src >= top && src <= bot) ? rows[src] : '');
    }
    return out;
  }

  function beginAim() {
    if (S.phase !== PHASE.READY) return;
    S.phase = PHASE.PLAY;      // v3：耗时从「首次发射」起才累加（见 update），此处仅切态
  }

  /**
   * v5 需求⑤：收窄底部缺口。把底部墙壁行的连续 EMPTY 段按 GAP_MAX_CELLS 裁剪，
   * 超出部分从两侧对称回填为墙壁（同时更新 gapCols）；≤ 上限的缺口保持原样。
   */
  function shrinkGaps() {
    var cols = S.gapCols;
    if (!cols.length) return;
    var max = CFG.GAP_MAX_CELLS;
    var runs = [], s = cols[0], p = cols[0];
    for (var i = 1; i <= cols.length; i++) {
      if (cols[i] === p + 1) { p = cols[i]; continue; }
      runs.push([s, p]);
      s = cols[i]; p = cols[i];
    }
    var keep = [];
    var bottom = S.grid[CFG.ROWS - 1];
    for (var k = 0; k < runs.length; k++) {
      var a = runs[k][0], b = runs[k][1], w = b - a + 1;
      if (w <= max) { for (var c0 = a; c0 <= b; c0++) keep.push(c0); continue; }
      var left = Math.floor((w - max) / 2), right = (w - max) - left;
      for (var c = a; c <= b; c++) {
        if (c >= a + left && c <= b - right) {
          keep.push(c);
        } else {
          bottom[c].type = TYPE.WALL; bottom[c].alive = true; bottom[c].opened = false;
        }
      }
    }
    S.gapCols = keep;
  }

  /**
   * v7 需求④：把本关固定 6% 的可消除方块随机换成道具块。
   * v7 需求①：若方块区（除底部墙壁行）没有任何墙壁，则不投放“隐形”道具（无墙可隐）。
   * 先把地图里手写的道具块归一为普通方块（保证比例可控、不叠加），
   * 再随机洗牌取前 target 个赋道具类型。使用 Math.random（仿真已种子化，可复现）。
   */
  function injectProps() {
    var cells = [];
    var hasWall = false;                            // v7 需求①：竞技区内（不含底墙行）是否有墙壁
    for (var r = 0; r < CFG.ROWS - 1; r++) {          // 不含最底墙壁行
      for (var c = 0; c < CFG.COLS; c++) {
        var cell = S.grid[r][c];
        if (!cell.alive) continue;
        if (cell.type === TYPE.WALL) { hasWall = true; continue; }
        if (cell.type !== TYPE.BRICK) cell.type = TYPE.BRICK;   // 道具→普通，归一
        cells.push(cell);
      }
    }
    var n = cells.length;
    if (!n) return;
    var target = Math.min(n, Math.round(n * CFG.PROP_RATE));   // v7 需求④：固定 6%
    for (var i = 0; i < target; i++) {
      var j = i + Math.floor(Math.random() * (n - i));
      var tmp = cells[i]; cells[i] = cells[j]; cells[j] = tmp;
      cells[i].type = pickPropType(hasWall);
    }
  }

  /**
   * v7 需求④：道具加权抽取（占道具总量）：
   *   分裂2=1成、分裂3=3成、爆炸=1成、生命=1成、横条加强=3成、隐形=1成（快速球不再随机投放）
   * v7 需求①：无墙壁时排除隐形，其余按 9 成归一化（各自权重 /0.9）
   */
  function pickPropType(hasWall) {
    var roll = Math.random();
    if (hasWall) {
      if (roll < 0.1) return TYPE.SPLIT;
      if (roll < 0.4) return TYPE.SPLIT3;
      if (roll < 0.5) return TYPE.BOMB;
      if (roll < 0.6) return TYPE.LIFE;
      if (roll < 0.9) return TYPE.PADDLE;
      return TYPE.GHOST;
    }
    var r2 = roll * 0.9;                             // 去掉隐形后在 0~0.9 区间按同比例重分
    if (r2 < 0.1) return TYPE.SPLIT;
    if (r2 < 0.4) return TYPE.SPLIT3;
    if (r2 < 0.5) return TYPE.BOMB;
    if (r2 < 0.6) return TYPE.LIFE;
    return TYPE.PADDLE;
  }

  /* ------------------------------------------------------------------ *
   * 瞄准
   * ------------------------------------------------------------------ */
  function paddleCenter() {
    return { x: S.paddle.x + S.paddle.w / 2, y: CFG.PADDLE_Y + CFG.PADDLE_H / 2 };
  }

  /**
   * 发射方向 = 挡板中心指向手指；限制与竖直向上夹角 <= MAX_AIM_ANGLE。
   * v2：瞄准不依赖回合阶段，PLAY 态内任何时候（包括球飞行中）都可以拉下一条，
   * 这就是需求拍板的「可以马上发射第二颗」。具体手势分离见 prototype-main.js。
   */
  function updateAim(fx, fy) {
    if (S.phase !== PHASE.PLAY || S.shotsLeft <= 0) { clearAim(); return; }
    var o = paddleCenter();
    var dx = fx - o.x;
    var dy = fy - o.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) { dx = 0; dy = -1; len = 1; }
    dx /= len; dy /= len;

    // 强制向上
    if (dy > -0.05) {
      dy = -0.05;
      var nl = Math.sqrt(dx * dx + dy * dy);
      dx /= nl; dy /= nl;
    }
    // 角度限制：与 (0,-1) 的夹角
    var ang = Math.atan2(dx, -dy); // 向右为正
    var lim = CFG.MAX_AIM_ANGLE;
    if (ang > lim) ang = lim;
    if (ang < -lim) ang = -lim;
    dx = Math.sin(ang);
    dy = -Math.cos(ang);

    S.aim.active = true;
    S.aim.x = fx; S.aim.y = fy;
    S.aim.dx = dx; S.aim.dy = dy;
    S.aim.path = predictPath(o.x, o.y - CFG.PADDLE_H / 2 - CFG.BALL_R - 1, dx, dy);
  }

  function clearAim() {
    S.aim.active = false;
    S.aim.path = [];
  }

  /**
   * 弹道预测：与真实物理同规则地步进模拟（含接球区侧墙、底部墙壁行、竞技区四壁）。
   * 返回：{ pts:[x,y,...], hit:{r,c,x,y}|null, entered:bool, wallPt:{x,y}|null }
   *   entered = true  -> 本次发射能穿过缺口进入竞技区（画青色弹道）
   *   wallPt          -> 第一次撞到底部墙壁行的位置（画红色弹道 + ✕ 提示）
   */
  function predictPath(x, y, dx, dy) {
    var r = CFG.BALL_R;
    var step = 2;
    var maxSteps = 1800;
    var maxBounces = 7;
    var pts = [x, y];
    var hit = null, wallPt = null, entered = false;
    var px = x, py = y, bounces = 0;
    var zone = 'catch';
    var rowTop9 = CFG.ARENA_BOTTOM - CFG.CELL;

    for (var i = 0; i < maxSteps; i++) {
      px += dx * step;
      py += dy * step;

      // 区域切换
      if (zone === 'catch' && py + r < rowTop9 &&
          px > CFG.ARENA_LEFT - r && px < CFG.ARENA_RIGHT + r) {
        zone = 'arena'; entered = true;
      } else if (zone === 'arena' && py - r > CFG.ARENA_BOTTOM) {
        zone = 'catch';
      }

      // 侧壁（两区都有）+ 竞技区顶壁
      var bounced = false;
      if (px - r < CFG.ARENA_LEFT) { px = CFG.ARENA_LEFT + r; dx = Math.abs(dx); bounced = true; }
      else if (px + r > CFG.ARENA_RIGHT) { px = CFG.ARENA_RIGHT - r; dx = -Math.abs(dx); bounced = true; }
      if (zone === 'arena' && py - r < CFG.ARENA_TOP) { py = CFG.ARENA_TOP + r; dy = Math.abs(dy); bounced = true; }

      // 网格碰撞
      var res = gridHit(px, py, r);
      if (res) {
        var cell = S.grid[res.r][res.c];
        if (isDestructible(cell.type)) {
          hit = { r: res.r, c: res.c, type: cell.type, x: px, y: py };
          pts.push(px, py);
          break;
        }
        if (res.r === CFG.ROWS - 1 && !wallPt) wallPt = { x: px, y: py };
        var vn = dx * res.nx + dy * res.ny;
        if (vn < 0) { dx -= 2 * vn * res.nx; dy -= 2 * vn * res.ny; }
        if (res.inside) { px += res.nx * (res.depth + r + 0.2); py += res.ny * (res.depth + r + 0.2); }
        else { px += res.nx * (r - res.d + 0.2); py += res.ny * (r - res.d + 0.2); }
        bounced = true;
      }

      if (py > CFG.DEATH_Y) { pts.push(px, py); break; }
      if (bounced) {
        bounces++;
        pts.push(px, py);
        if (bounces >= maxBounces) break;
      }
    }
    if (!hit) pts.push(px, py);
    return { pts: pts, hit: hit, entered: entered, wallPt: wallPt };
  }

  /**
   * 圆 vs 网格：返回穿透最深的碰撞 { r, c, d, nx, ny }，nx/ny 为从方块表面指向球心的法线
   */
  function gridHit(x, y, r) {
    var c0 = clamp(Math.floor((x - r - CFG.ARENA_LEFT) / CFG.CELL), 0, CFG.COLS - 1);
    var c1 = clamp(Math.floor((x + r - CFG.ARENA_LEFT) / CFG.CELL), 0, CFG.COLS - 1);
    var r0 = clamp(Math.floor((y - r - CFG.ARENA_TOP) / CFG.CELL), 0, CFG.ROWS - 1);
    var r1 = clamp(Math.floor((y + r - CFG.ARENA_TOP) / CFG.CELL), 0, CFG.ROWS - 1);
    var best = null;

    for (var rr = r0; rr <= r1; rr++) {
      for (var cc = c0; cc <= c1; cc++) {
        if (!isSolid(rr, cc)) continue;
        var rx = CFG.ARENA_LEFT + cc * CFG.CELL;
        var ry = CFG.ARENA_TOP + rr * CFG.CELL;
        var nxp = clamp(x, rx, rx + CFG.CELL);
        var nyp = clamp(y, ry, ry + CFG.CELL);
        var dx = x - nxp, dy = y - nyp;
        var d2 = dx * dx + dy * dy;
        if (d2 > r * r) continue;
        var d = Math.sqrt(d2);
        if (d < 1e-4) {
          // 球心已陷入方块内部：取最小穿透轴作为法线
          var left = x - rx, right = rx + CFG.CELL - x;
          var top = y - ry, bottom = ry + CFG.CELL - y;
          var m = Math.min(left, right, top, bottom);
          var ux = 0, uy = 0, dd = m;
          if (m === left) ux = -1; else if (m === right) ux = 1;
          else if (m === top) uy = -1; else uy = 1;
          if (!best || -dd > -best.depth) best = { r: rr, c: cc, d: -dd, depth: dd, nx: ux, ny: uy, inside: true };
          continue;
        }
        if (!best || d < best.depth) {
          best = { r: rr, c: cc, d: d, depth: d, nx: dx / d, ny: dy / d, inside: false };
        }
      }
    }
    return best;
  }

  /* ------------------------------------------------------------------ *
   * 发射
   * ------------------------------------------------------------------ */
  function shoot() {
    if (S.phase !== PHASE.PLAY) return;
    if (S.shotsLeft <= 0) return;

    S.shotsLeft--;
    S.launched++;
    S.chain = 0;
    S.combo = 0;

    spawnBall(S.aim.dx, S.aim.dy);
    clearAim();
    addShake(3);
    Sfx.play('shoot');
  }

  function spawnBall(dx, dy) {
    if (S.balls.length >= CFG.MAX_BALLS) return null;
    var o = paddleCenter();
    var b = {
      x: o.x,
      y: CFG.PADDLE_Y - CFG.BALL_R - 1,
      vx: dx * CFG.BALL_SPEED,
      vy: dy * CFG.BALL_SPEED,
      zone: 'catch',       // 先在接球区向上飞，穿过缺口后进入 arena
      r: CFG.BALL_R,
      trail: [],
      splitAt: -1,
      alive: true,
      born: S.time,
      speedMul: 1
    };
    S.balls.push(b);
    return b;
  }

  /* ------------------------------------------------------------------ *
   * 小球更新
   * ------------------------------------------------------------------ */
  function updateBalls(dt) {
    for (var i = S.balls.length - 1; i >= 0; i--) {
      var b = S.balls[i];
      stepBall(b, dt);
      // 轨迹
      b.trail.push(b.x, b.y);
      if (b.trail.length > 16) b.trail.splice(0, 2);
      if (!b.alive) S.balls.splice(i, 1);
    }

    // 胜利即时判定（需求：方块全部消除即结束，不等球落完）
    if (S.destroyed >= S.totalBricks && S.totalBricks > 0) finish(true);
  }

  function stepBall(b, dt) {
    drainAssist(b);
    var n = CFG.SUBSTEPS;
    var h = dt / n;
    for (var i = 0; i < n; i++) {
      b.x += b.vx * h;
      b.y += b.vy * h;
      collideWorld(b);
      if (!b.alive) return;
    }
  }

  /* 回落吸附：底部闸门开启后，把球的方向逐渐压向“正下”，保证回合必然收敛。
   * 为什么必需：无重力的封闭容器里，一个墙壁块 + 顶壁就能构成永久垂直乒乓
   * （球砸在墙块顶面→反弹到顶壁→再落回同一墙块）。此时“开底”也救不了它，
   * 因为球根本下不到底部。仿真在 900 局里撞到过 1 次，故加此兜底。
   * 保留 ≥28% 的横向分量，使球能贴着墙块顶面滑开而不是贴在上面反复砸。*/
  function drainAssist(b) {
    if (!S.bottomOpened) return;
    var sp = (b.zone === 'arena' ? CFG.BALL_SPEED : CFG.BALL_SPEED * CFG.CATCH_SPEED_K) * (b.speedMul || 1);
    var vx = b.vx * 0.75;                              // 逐帧衰减横向分量
    var minVx = sp * 0.28;
    if (Math.abs(vx) < minVx) vx = (vx < 0 ? -1 : 1) * minVx;
    b.vx = vx;
    b.vy = Math.sqrt(Math.max(sp * sp - vx * vx, sp * sp * 0.2));
  }

  function normalizeSpeed(b) {
    var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (sp < 1) return;
    var mul = b.speedMul || 1;
    var target = (b.zone === 'arena' ? CFG.BALL_SPEED : CFG.BALL_SPEED * CFG.CATCH_SPEED_K) * mul;
    b.vx = b.vx / sp * target;
    b.vy = b.vy / sp * target;
    // 反退化：避免完全水平 / 完全垂直导致无限循环
    var minC = target * 0.09;
    if (Math.abs(b.vx) < minC) { b.vx = (b.vx < 0 ? -1 : 1) * minC; }
    if (Math.abs(b.vy) < minC) { b.vy = (b.vy < 0 ? -1 : 1) * minC; }
    sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    b.vx = b.vx / sp * target;
    b.vy = b.vy / sp * target;
  }

  function collideWorld(b) {
    var r = b.r;

    // —— 区域切换 ——
    if (b.zone === 'catch' && b.y + r < CFG.ARENA_BOTTOM - CFG.CELL &&
        b.x > CFG.ARENA_LEFT - r && b.x < CFG.ARENA_RIGHT + r) {
      b.zone = 'arena';           // 穿过缺口进入竞技区
      normalizeSpeed(b);
    } else if (b.zone === 'arena' && b.y - r > CFG.ARENA_BOTTOM) {
      b.zone = 'catch';           // 从缺口逸出，进入接球区
      normalizeSpeed(b);
      spawnRing(b.x, CFG.ARENA_BOTTOM + 4, 'rgba(120,220,255,0.8)');
    }

    // —— 容器四壁 ——
    // 竞技区：左右 + 顶部；接球区：仅左右（容器外壁向下延伸），
    // 让斜射的球可以“打库边”反弹，提高穿缺口的可能性，也避免球白白飞出屏幕。
    if (b.x - r < CFG.ARENA_LEFT) { b.x = CFG.ARENA_LEFT + r; b.vx = Math.abs(b.vx); onWallHit(b); }
    else if (b.x + r > CFG.ARENA_RIGHT) { b.x = CFG.ARENA_RIGHT - r; b.vx = -Math.abs(b.vx); onWallHit(b); }
    if (b.zone === 'arena' && b.y - r < CFG.ARENA_TOP) {
      b.y = CFG.ARENA_TOP + r; b.vy = Math.abs(b.vy); onWallHit(b);
    }

    // —— 网格方块（两个区域都生效：接球区需要与底部墙壁行碰撞）——
    var res = gridHit(b.x, b.y, r);
    if (res) {
      var cell = S.grid[res.r][res.c];
      if (isDestructible(cell.type)) {
        destroyCell(res.r, res.c, b);
        var vn0 = b.vx * res.nx + b.vy * res.ny;
        if (vn0 < 0) { b.vx -= 2 * vn0 * res.nx; b.vy -= 2 * vn0 * res.ny; }
        if (!res.inside) {
          b.x += res.nx * (r - res.d + 0.2);
          b.y += res.ny * (r - res.d + 0.2);
        }
        normalizeSpeed(b);
      } else {
        var vn = b.vx * res.nx + b.vy * res.ny;
        if (vn < 0) { b.vx -= 2 * vn * res.nx; b.vy -= 2 * vn * res.ny; }
        if (res.inside) {
          b.x += res.nx * (res.depth + r + 0.2);
          b.y += res.ny * (res.depth + r + 0.2);
        } else {
          b.x += res.nx * (r - res.d + 0.2);
          b.y += res.ny * (r - res.d + 0.2);
        }
        normalizeSpeed(b);
        onWallHit(b);
      }
    }

    // —— 接球区：挡板 / 漏接判定 ——
    if (b.zone === 'catch') collideCatch(b);
  }

  function onWallHit(b) {
    normalizeSpeed(b);
    addShake(1.2);
    spawnSpark(b.x, b.y, 'rgba(255,255,255,0.75)', 3);
    Sfx.play('wall');
  }

  function collideCatch(b) {
    var r = b.r;
    // —— 挡板：v2 核心变更，接住不再回收，而是沿横条拖动方向回弹 ——
    var px0 = S.paddle.x, px1 = S.paddle.x + S.paddle.w;
    var py0 = CFG.PADDLE_Y, py1 = CFG.PADDLE_Y + CFG.PADDLE_H;
    var cx = clamp(b.x, px0, px1);
    var cy = clamp(b.y, py0, py1);
    var dx = b.x - cx, dy = b.y - cy;
    if (dx * dx + dy * dy <= r * r) {
      if (S.bottomOpened) return;     // 开底排空期间不回弹：停滞磨洋工的惩罚，也保证收敛
      if (b.vy <= 0) return;          // 已在向上（刚弹过），避免重叠区重复触发
      b.y = py0 - r - 0.1;
      b.vy = -Math.abs(b.vy);
      b.vx += S.paddle.vx * CFG.BOUNCE_KICK;   // 拖动方向注入（需求拍板：往哪拖往哪弹）
      var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || CFG.BALL_SPEED * CFG.CATCH_SPEED_K;
      var ang = Math.atan2(b.vx, -b.vy);
      var lim = CFG.MAX_AIM_ANGLE;
      if (ang > lim) ang = lim;
      if (ang < -lim) ang = -lim;
      b.vx = Math.sin(ang) * sp;
      b.vy = -Math.cos(ang) * sp;
      normalizeSpeed(b);
      S.caughtTot++;
      S.chain++;
      if (S.chain > S.maxChain) S.maxChain = S.chain;
      S.score += SCORE.catchBall;
      spawnSpark(b.x, py0, 'rgba(255,224,122,0.95)', 8);
      spawnPopup(b.x, py0 - 12, '回弹 +' + SCORE.catchBall, '#FFE07A');
      addShake(1.2);
      Sfx.play('catch');
      return;
    }
    // v4 需求③：球落到轨道平面（横条之外）即判漏接，取消旧漏接线
    if (b.vy > 0 && b.y + r >= CFG.PADDLE_Y) {
      b.alive = false;
      S.lostTot++;
      S.chain = 0;
      S.combo = 0;
      spawnSpark(clamp(b.x, 4, CFG.W - 4), CFG.PADDLE_Y, 'rgba(255,90,90,0.9)', 12);
      addShake(4);
      Sfx.play('lose');
      if (global.navigator && global.navigator.vibrate) { try { global.navigator.vibrate(18); } catch (e) {} }
    }
  }

  /* ------------------------------------------------------------------ *
   * 方块消除 & 道具效果
   * ------------------------------------------------------------------ */
  function cellScore(t) {
    if (t === TYPE.SPLIT) return SCORE.split;
    if (t === TYPE.SPLIT3) return SCORE.split3;
    if (t === TYPE.LIFE) return SCORE.life;
    if (t === TYPE.BOMB) return SCORE.bomb;
    if (t === TYPE.PADDLE) return SCORE.paddle;
    if (t === TYPE.SPEED) return SCORE.speed;
    if (t === TYPE.GHOST) return SCORE.ghost;
    return SCORE.brick;
  }

  function isProp(t) {
    return t === TYPE.SPLIT || t === TYPE.SPLIT3 || t === TYPE.LIFE || t === TYPE.BOMB ||
           t === TYPE.PADDLE || t === TYPE.SPEED || t === TYPE.GHOST;
  }

  function propColor(t) {
    var P = global.TT.PALETTE;
    if (t === TYPE.SPLIT) return P.split.bottom;
    if (t === TYPE.SPLIT3) return P.split3.bottom;
    if (t === TYPE.LIFE) return P.life.bottom;
    if (t === TYPE.BOMB) return P.bomb.bottom;
    if (t === TYPE.PADDLE) return P.paddlePow.bottom;
    if (t === TYPE.SPEED) return P.speed.bottom;
    if (t === TYPE.GHOST) return P.ghost.bottom;
    return null;
  }

  /** 纯移除：置死 + 计数 + 连击 + 得分 + 粒子（不触发道具特效）。返回中心坐标与类型 */
  function removeCell(r, c) {
    var cell = S.grid[r][c];
    if (!cell || !cell.alive || !isDestructible(cell.type)) return null;
    var t = cell.type;
    cell.alive = false;
    S.destroyed++;
    S.combo++;
    if (S.combo > S.maxCombo) S.maxCombo = S.combo;
    var bonus = Math.min(S.combo, SCORE.comboCap) * SCORE.comboStep;
    var gain = cellScore(t) + bonus;
    S.score += gain;
    var rect = cellRect(r, c);
    var cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    var pc = propColor(t);
    var col = pc || global.TT.PALETTE.bricks[cell.colorIdx].bottom;
    spawnBurst(cx, cy, col, t === TYPE.BRICK ? 10 : 14);
    spawnPopup(cx, cy, '+' + gain, pc || '#FFFFFF');
    addShake(t === TYPE.BRICK ? 1.8 : 3.2);
    Sfx.play(t === TYPE.BRICK ? 'brick' : 'split');
    return { cx: cx, cy: cy, type: t };
  }

  /** 直接命中的消除入口：普通方块直接移除；道具方块移除后【立即在原坐标生效】（v5：已取消悬浮块） */
  function destroyCell(r, c, ball) {
    var res = removeCell(r, c);
    if (!res) return;
    if (isProp(res.type)) applyProp(res.type, r, c);
  }

  /** 爆炸球：清除以自身为中心的 3×3 九宫格内可消除块（墙壁不受影响；不级联其他道具特效） */
  function bombExplode(r0, c0) {
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        var r = r0 + dr, c = c0 + dc;
        if (r < 0 || r >= CFG.ROWS || c < 0 || c >= CFG.COLS) continue;
        var cell = S.grid[r][c];
        if (cell && cell.alive && isDestructible(cell.type)) removeCell(r, c);
      }
    }
    var rect = cellRect(r0, c0);
    spawnRing(rect.x + rect.w / 2, rect.y + rect.h / 2, global.TT.PALETTE.bomb.glow);
    addShake(6);
  }

  /* ------------------------------------------------------------------ *
   * v5：道具方块「消除即生效」—— 取消悬浮块，道具在其原坐标直接触发
   * ------------------------------------------------------------------ */
  /** 道具效果直接在原方块坐标 (r,c) 生效（v7 需求②：提示信息也回到原方块位置弹出） */
  function applyProp(t, r, c) {
    var rect = cellRect(r, c);
    var ox = rect.x + rect.w / 2, oy = rect.y + rect.h / 2;   // 原方块中心（道具在此生效）
    var my = oy - 16;                                          // 提示位：原方块上方（避开 +分数 飘字）
    if (t === TYPE.BOMB) {
      bombExplode(r, c);
      spawnPopup(ox, my, '爆炸!', global.TT.PALETTE.bomb.bottom);
    } else if (t === TYPE.SPLIT) {
      spawnBallsAtOrigin(ox, oy, 2, 1);
      spawnPopup(ox, my, '分裂 ×2', global.TT.PALETTE.split.bottom);
    } else if (t === TYPE.SPLIT3) {
      spawnBallsAtOrigin(ox, oy, 3, 1);
      spawnPopup(ox, my, '分裂 ×3', global.TT.PALETTE.split3.bottom);
    } else if (t === TYPE.SPEED) {
      spawnBallsAtOrigin(ox, oy, 1, 2);
      spawnPopup(ox, my, '快速球!', global.TT.PALETTE.speed.bottom);
    } else if (t === TYPE.LIFE) {
      S.shotsLeft++;
      spawnPopup(ox, my, '生命 +1', global.TT.PALETTE.life.bottom);
    } else if (t === TYPE.PADDLE) {
      S.paddleBoost = CFG.PADDLE_BOOST_TIME;
      addShake(4);
      spawnPopup(ox, my, '挡板强化 ' + CFG.PADDLE_BOOST_TIME + 's', global.TT.PALETTE.paddlePow.bottom);
    } else if (t === TYPE.GHOST) {
      S.wallGhost = CFG.WALLGHOST_TIME;
      spawnPopup(ox, my, '墙壁隐形 ' + CFG.WALLGHOST_TIME + 's', global.TT.PALETTE.ghost.bottom);
    }
  }

  /** 在原坐标生成 n 颗新球（以正下为基准散开），speedMul 默认 1（快速球传 2） */
  function spawnBallsAtOrigin(cx, cy, n, speedMul) {
    speedMul = speedMul || 1;
    var made = 0;
    for (var i = 0; i < n; i++) {
      if (S.balls.length >= CFG.MAX_BALLS) {
        pushMsg('已达上限', 'rgba(255,255,255,0.7)');
        break;
      }
      var spread = (n === 1) ? 0 : (i / (n - 1) - 0.5) * 2 * CFG.SPLIT_ANGLE;
      var sp = CFG.BALL_SPEED * speedMul;
      S.balls.push({
        x: cx, y: cy, vx: Math.sin(spread) * sp, vy: Math.cos(spread) * sp,
        zone: 'arena', r: CFG.BALL_R, trail: [], splitAt: -1,
        alive: true, born: S.time, speedMul: speedMul
      });
      made++;
    }
    if (made) { spawnRing(cx, cy, global.TT.PALETTE.split.glow); addShake(4); }
  }

  /** v4 需求⑤：方块区居中的浮动提示（多条上下堆叠，先显示先消失，最多 4 条） */
  function pushMsg(text, color) {
    S.msgs.push({ text: text, color: color || '#fff', t: 0, life: 1.5 });
    if (S.msgs.length > 4) S.msgs.shift();   // 最旧的一条先消失（FIFO）
  }

  /* ------------------------------------------------------------------ *
   * 胜负判定（v2：无回合结算，胜=方块全消；败=弹药耗尽且同屏球全部漏完）
   * ------------------------------------------------------------------ */
  /** 耗时分档（相对本关 starTimes）：≤三星线→100，≤二星线→80，
   *  ≤二星线+(二星-三星)→60，否则 30（随关卡规模缩放，不用绝对秒）*/
  function timeScore(t) {
    var tiers = SCORE.timeTiers;
    var span = Math.max(t[1] - t[0], 1);
    if (S.elapsed <= t[0]) return tiers[0];
    if (S.elapsed <= t[1]) return tiers[1];
    if (S.elapsed <= t[1] + span) return tiers[2];
    return tiers[3];
  }

  function finish(win) {
    closeBottomWall();                                 // 恢复底部墙壁行，避免结算画面上残留“开洞”
    S.paddleBoost = 0;
    S.wallGhost = 0;
    S.paddle.w = CFG.PADDLE_W;
    S.paddle.x = (CFG.W - CFG.PADDLE_W) / 2;
    var stars = 0, breakdown = null;
    if (win) {
      // 需求拍板：耗时评星（≤三星线 3 星，≤二星线 2 星，否则 1 星）
      var t = S.level.starTimes || [1e9, 1e9];
      stars = S.elapsed <= t[0] ? 3 : (S.elapsed <= t[1] ? 2 : 1);
      // v3 通关结算明细：总分 = 对局内分 + 剩余球×perShot + 最大连击×perCombo + 耗时分档
      var inPlay = S.score;
      var remaining = S.shotsLeft + S.balls.length;    // 剩余球数（场上球 + 剩余发射）
      var shotBonus = remaining * SCORE.perShot;
      var comboBonus = S.maxCombo * SCORE.perCombo;
      var timeBonus = timeScore(t);
      S.score = inPlay + shotBonus + comboBonus + timeBonus;
      breakdown = {
        inPlay: inPlay, remaining: remaining, shotBonus: shotBonus,
        maxCombo: S.maxCombo, comboBonus: comboBonus,
        timeBonus: timeBonus, elapsed: S.elapsed
      };
    }
    S.lastResult = {
      win: win,
      stars: stars,
      score: S.score,
      maxCombo: S.maxCombo,
      destroyed: S.destroyed,
      total: S.totalBricks,
      elapsed: S.elapsed,
      shotsLeft: S.shotsLeft,
      launched: S.launched,
      caught: S.caughtTot,
      lost: S.lostTot,
      maxChain: S.maxChain,
      breakdown: breakdown
    };
    // v5 需求①：每次结束游戏，按获得星数补发钻石到钱包（1 星 = 1 钻；败局 0 星即 +0）
    S.lastResult.diamondsGained = stars;
    S.diamonds += stars;
    S.lastResult.diamonds = S.diamonds;
    S.phase = win ? PHASE.WIN : PHASE.LOSE;
    Sfx.play(win ? 'win' : 'fail');
    addShake(win ? 6 : 8);
    Storage.save(S.levelIndex, stars, S.score);
    emitWallet();
  }

  /* ------------------------------------------------------------------ *
   * 底部墙壁开启（v3：仅关卡硬超时触发，已移除旧「停滞开底」）
   * ------------------------------------------------------------------ */
  function openBottomWall() {
    if (S.bottomOpened) return;
    S.bottomOpened = true;
    var row = S.grid[CFG.ROWS - 1];
    for (var c = 0; c < CFG.COLS; c++) {
      if (row[c].alive && row[c].type === TYPE.WALL) row[c].opened = true;
    }
    spawnPopup(CFG.W / 2, CFG.ARENA_BOTTOM - 20, '关卡超时 · 开底排空', '#FFE07A');
    Sfx.play('open');
  }

  function closeBottomWall() {
    if (!S.bottomOpened) return;
    S.bottomOpened = false;
    var row = S.grid[CFG.ROWS - 1];
    for (var c = 0; c < CFG.COLS; c++) row[c].opened = false;
  }

  /* ------------------------------------------------------------------ *
   * 特效
   * ------------------------------------------------------------------ */
  function addShake(v) { S.shake = Math.min(12, S.shake + v); }

  function spawnSpark(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 40 + Math.random() * 120;
      S.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.28 + Math.random() * 0.2, t: 0, size: 1.5 + Math.random() * 2,
        color: color, kind: 'dot'
      });
    }
  }

  function spawnBurst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 60 + Math.random() * 220;
      S.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        life: 0.35 + Math.random() * 0.35, t: 0, size: 3 + Math.random() * 5,
        color: color, kind: 'rect', rot: Math.random() * Math.PI
      });
    }
  }

  function spawnRing(x, y, color) {
    S.particles.push({ x: x, y: y, life: 0.4, t: 0, color: color, kind: 'ring', size: 6 });
  }

  function spawnPopup(x, y, text, color) {
    S.popups.push({ x: x, y: y, text: text, color: color || '#fff', t: 0, life: 0.85 });
  }

  function updateParticles(dt) {
    for (var i = S.particles.length - 1; i >= 0; i--) {
      var p = S.particles[i];
      p.t += dt;
      if (p.t >= p.life) { S.particles.splice(i, 1); continue; }
      if (p.kind === 'ring') { p.size += dt * 130; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;
      p.vx *= 0.985;
      if (p.kind === 'rect') p.rot += dt * 6;
    }
    for (var j = S.popups.length - 1; j >= 0; j--) {
      var q = S.popups[j];
      q.t += dt;
      q.y -= dt * 26;
      if (q.t >= q.life) S.popups.splice(j, 1);
    }
    // v4：道具提示栈计时（先显示先消失）
    for (var k = S.msgs.length - 1; k >= 0; k--) {
      var m = S.msgs[k];
      m.t += dt;
      if (m.t >= m.life) S.msgs.splice(k, 1);
    }
    S.shake *= Math.pow(0.0025, dt);
    if (S.shake < 0.05) S.shake = 0;
  }

  /* ------------------------------------------------------------------ *
   * 主更新
   * ------------------------------------------------------------------ */
  function update(dt) {
    // v5 需求②③：主页 / 暂停弹窗 / 购买弹窗期间，冻结玩法与计时（仅 UI 动画继续）
    if (S.phase === PHASE.HOME || S.overlay) { S.time += dt; return; }
    S.time += dt;
    if (S.wallGhost > 0) S.wallGhost = Math.max(0, S.wallGhost - dt);   // v4 墙壁隐形倒计时
    updateParticles(dt);

    // 方块入场动画
    for (var r = 0; r < CFG.ROWS; r++) {
      for (var c = 0; c < CFG.COLS; c++) {
        var cell = S.grid[r][c];
        if (cell.spawnAnim < 1) cell.spawnAnim = Math.min(1, cell.spawnAnim + dt * 2.6);
      }
    }

    // 挡板平滑跟随 + 拖动速度采样（接住回弹方向要用）
    var prevPX = S.paddle.x;
    // 挡板强化：>0 时锁为满宽覆盖竞技区；结束后回正常宽并居中
    if (S.paddleBoost > 0) {
      S.paddleBoost = Math.max(0, S.paddleBoost - dt);
      S.paddle.w = CFG.ARENA_W;
      S.paddle.x = CFG.PAD;
      S.paddle.targetX = CFG.PAD;
      S.paddle.vx = 0;
      if (S.paddleBoost === 0) {
        S.paddle.w = CFG.PADDLE_W;
        S.paddle.x = S.paddle.targetX = (CFG.W - CFG.PADDLE_W) / 2;
      }
    } else {
      S.paddle.x += (S.paddle.targetX - S.paddle.x) * Math.min(1, dt * 22);
    }
    var instVx = dt > 0 ? (S.paddle.x - prevPX) / dt : 0;
    S.paddle.vx = S.paddle.vx * 0.65 + instVx * 0.35;

    if (S.phase === PHASE.PLAY) {
      // v3：首次发射后才开始计时（需求：“等到发射后才开始计时”）
      if (S.launched > 0) S.elapsed += dt;
      // 关卡硬超时兜底（v3 唯一开底机制，已移除旧停滞开底）：
      // 无重力封闭容器里球可能永远收敛不了，超时强制开底排空。
      if (S.elapsed >= CFG.LEVEL_TIMEOUT) openBottomWall();
      updateBalls(dt);
      if (S.phase !== PHASE.PLAY) return;    // updateBalls 内部已判胜
      if (S.balls.length === 0) {
        if (S.bottomOpened) closeBottomWall();  // 开底排空完成，恢复容器
        if (S.shotsLeft <= 0) finish(false);    // 发射机会用完且球全部漏完 → 败
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * v5 需求②：底部主动道具栏（全部分裂 / 墙体隐藏 / 挡板放大）
   *   背包有数量(>0)且对局中点击 → 消耗 1 个立即生效；为 0 → 由 main 开购买弹窗。
   *   与网格内掉落道具块不同：这些是“购买/持有”的主动技能，直接生效，不经过悬浮块。
   * ------------------------------------------------------------------ */
  function emitWallet() {
    if (typeof Game.onWalletChange === 'function') {
      Game.onWalletChange({ diamonds: S.diamonds, props: S.props });
    }
  }

  /** 立即施加一个主动道具效果（已扣除背包数量后调用） */
  function applyActiveProp(key) {
    var P = global.TT.PALETTE;
    if (key === 'splitAll') {
      var cur = S.balls.slice(), added = 0;
      for (var i = 0; i < cur.length; i++) {
        if (S.balls.length >= CFG.MAX_BALLS) break;
        var b = cur[i];
        S.balls.push({
          x: b.x, y: b.y, vx: -b.vx, vy: b.vy, zone: b.zone, r: CFG.BALL_R,
          trail: [], splitAt: -1, alive: true, born: S.time, speedMul: b.speedMul || 1
        });
        added++;
      }
      pushMsg('全部分裂!', P.split.bottom);
      spawnRing(b0x(), b0y(), P.split.glow);
      addShake(4); Sfx.play('split');
    } else if (key === 'wallHide') {
      S.wallGhost = CFG.WALLGHOST_TIME;
      pushMsg('墙壁隐形 ' + CFG.WALLGHOST_TIME + 's', P.ghost.bottom);
      Sfx.play('open');
    } else if (key === 'paddleBig') {
      S.paddleBoost = CFG.PADDLE_BOOST_TIME;
      addShake(4);
      pushMsg('挡板放大 ' + CFG.PADDLE_BOOST_TIME + 's', P.paddlePow.bottom);
      Sfx.play('open');
    }
  }
  // 分裂时环特效锥点（取第一颗现有球位置，无球则屏幕中心）
  function b0x() { return S.balls.length ? S.balls[0].x : CFG.W / 2; }
  function b0y() { return S.balls.length ? S.balls[0].y : CFG.ARENA_TOP + CFG.ARENA_H / 2; }

  /* ------------------------------------------------------------------ *
   * 对外接口
   * ------------------------------------------------------------------ */
  global.Game = {
    PHASE: PHASE,
    S: S,
    CFG: CFG,
    clamp: clamp,
    cellRect: cellRect,
    isSolid: isSolid,
    isDestructible: isDestructible,
    paddleCenter: paddleCenter,
    loadLevel: loadLevel,
    restart: restart,
    beginAim: beginAim,
    updateAim: updateAim,
    clearAim: clearAim,
    shoot: shoot,
    update: update,
    movePaddleTo: function (x) {
      S.paddle.targetX = clamp(x - S.paddle.w / 2, CFG.PAD, CFG.W - CFG.PAD - S.paddle.w);
    },
    /** 瞄准阶段微调挡板（辅助按钮使用） */
    nudgePaddle: function (dx) {
      S.paddle.targetX = clamp(S.paddle.targetX + dx, CFG.PAD, CFG.W - CFG.PAD - S.paddle.w);
      S.paddle.x = S.paddle.targetX;
      if (S.aim.active) updateAim(S.aim.x, S.aim.y);
    },

    /* —— v5 需求①②③：钱包 / 主动道具 / 暂停与主页 —— */
    /** main 从 localStorage 读到的钱包注入内存态 */
    setWallet: function (w) {
      if (!w) return;
      if (typeof w.diamonds === 'number') S.diamonds = w.diamonds;
      if (w.props) {
        S.props.splitAll = w.props.splitAll | 0;
        S.props.wallHide = w.props.wallHide | 0;
        S.props.paddleBig = w.props.paddleBig | 0;
      }
    },
    getPropCount: function (k) { return S.props[k] | 0; },
    /** 使用一个主动道具（有数量且处于对局中才消耗并生效），返回是否成功 */
    useProp: function (k) {
      if (S.phase !== PHASE.PLAY && S.phase !== PHASE.READY) return false;
      if (!(S.props[k] > 0)) return false;
      if (k === 'splitAll' && S.balls.length === 0) {
        pushMsg('场上暂无小球可分裂', 'rgba(255,255,255,0.75)');
        return false;   // 不消耗
      }
      S.props[k]--;
      applyActiveProp(k);
      emitWallet();
      return true;
    },
    /** 花钻石购买 1 个主动道具（钻石不足返回 false，不扣费） */
    buyProp: function (k) {
      var cost = global.TT.PROPS[k].cost;
      if (S.diamonds < cost) return false;
      S.diamonds -= cost;
      S.props[k]++;
      emitWallet();
      return true;
    },
    openPause: function () { if (S.phase === PHASE.PLAY || S.phase === PHASE.READY) S.overlay = 'pause'; },
    resume: function () { S.overlay = null; },
    openBuy: function (k) { S.overlay = { buy: k, hint: '' }; },
    closeBuy: function () { S.overlay = null; },
    setBuyHint: function (t) { if (S.overlay && S.overlay.buy) S.overlay.hint = t; },
    toHome: function () {
      S.phase = PHASE.HOME; S.overlay = null;
      S.balls.length = 0; S.msgs.length = 0;
      S.particles.length = 0; S.popups.length = 0;
      S.homeScroll = 0; S._homeAutoScroll = true;
      clearAim();
    }
  };
})(window);
