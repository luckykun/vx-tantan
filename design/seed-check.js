/* 跨种子复核：确认 balance-sim 的通关率不是「挑种子挑出来的」。
 *
 * 为什么需要它：单一种子、每档 250 局时，通关率仍带 ±3~9pp 的抽样噪声。
 * 只跑一个种子无法区分「关卡难度真的达标」和「这颗种子刚好走运」。
 * 本脚本对多个种子各跑一遍，报告均值与极差，并对每个种子独立做越界判定。
 *
 * 设计稿 §11.3 的全部数字由本脚本产出。
 *
 *   node design/seed-check.js                    → 默认 5 个种子 × 每档 150 局
 *   node design/seed-check.js 250                → 每档 250 局（极差会显著收窄）
 *   node design/seed-check.js 150 20261020,7     → 只跑指定种子
 *
 * 退出码：0 = 所有种子、所有关卡、两个档位全部落在目标区间内；非 0 = 有越界。
 */
const sim = require('./balance-sim.js');

const N = Number(process.argv[2] || 150);
const SEEDS = (process.argv[3] || '20261020,991,424242,7,123456').split(',').map(Number);
const SKILLS = [
  { v: 0.55, name: '新手' },
  { v: 0.90, name: '熟练' }
];
// 极差超过此值说明样本量不足以支撑结论，只警告不失败
const SPAN_WARN = 15;

const out = [];
const say = s => out.push(s);
const violations = [];
const warnings = [];

say(`跨种子复核：${SEEDS.length} 个种子 [${SEEDS.join(', ')}] × 每档 ${N} 局`);
say(`区间口径：新手档只看 floor、熟练档只看 ceil，另有全局兜底 ${sim.HARD.min * 100}%~${sim.HARD.max * 100}%（见 §9.4）`);

for (const skill of SKILLS) {
  say(`\n=== 熟练度 ${skill.v}（${skill.name}） ===`);

  for (let lv = 0; lv < sim.TT.LEVELS.length; lv++) {
    const lvId = lv + 1;
    const bd = sim.bounds(sim.bandFor(lvId), skill.v);
    const rs = [];

    for (const sd of SEEDS) {
      sim.setSeed(sd);
      const r = sim.simulate(lv, skill.v, N);
      rs.push(r);
      const pct = r.winRate * 100;
      // 逐种子独立判定：任一种子越界即为真失败，不允许用均值掩盖
      if (pct < bd.lo * 100 || pct > bd.hi * 100) {
        violations.push(`关卡${lvId}·${skill.name}·种子${sd} 通关率 ${pct.toFixed(1)}% 越界（要求 ${bd.lo * 100}~${bd.hi * 100}%）`);
      }
    }

    const mean = k => rs.reduce((a, b) => a + b[k], 0) / rs.length;
    // 极差分两种口径，切勿混用：
    //   span()   —— 原始差值，用于秒数 / 星级 / 球数等计数型字段
    //   ppSpan() —— 差值×100，用于 winRate / openRate 等比率型字段，单位是百分点(pp)
    const span = k => Math.max(...rs.map(r => r[k])) - Math.min(...rs.map(r => r[k]));
    const ppSpan = k => span(k) * 100;
    const winSpan = ppSpan('winRate');
    if (winSpan > SPAN_WARN) {
      warnings.push(`关卡${lvId}·${skill.name} 通关率极差 ${winSpan.toFixed(0)}pp > ${SPAN_WARN}pp，建议提高每档局数（当前 ${N}）`);
    }

    say(`关卡${lvId}「${rs[0].name}」${rs[0].balls}球/${rs[0].bricks}方块 ` +
      `通关率 ${rs.map(r => (r.winRate * 100).toFixed(0)).join('/')} → ` +
      `均值 ${(mean('winRate') * 100).toFixed(1)}% 极差 ${winSpan.toFixed(0)}pp` +
      `（要求 ≥${(bd.lo * 100).toFixed(0)}%）`);
    say(`   星级 ${mean('stars').toFixed(2)} | 胜局均耗时 ${mean('winSec').toFixed(1)}s 极差${span('winSec').toFixed(1)}s | ` +
      `最长回弹链 ${mean('chain').toFixed(0)} | 峰值同屏 ${mean('peakBalls').toFixed(1)} | ` +
      `场均开底 ${mean('avgOpened').toFixed(2)} | 漏接率 ${(mean('missRate') * 100).toFixed(1)}%`);
  }
}

say('\n' + '='.repeat(52));
for (const w of warnings) say('⚠ ' + w);
if (violations.length) {
  for (const v of violations) say('✗ ' + v);
  say(`\n❌ 未通过：${violations.length} 项越界。说明该关卡的达标依赖特定种子，需调整 shots 或关卡定位（改 BANDS）。`);
} else {
  say(`\n✅ 通过：${SEEDS.length} 个种子 × ${sim.TT.LEVELS.length} 关 × ${SKILLS.length} 档 ` +
    `= ${SEEDS.length * sim.TT.LEVELS.length * SKILLS.length} 组全部落在目标区间，通关率不依赖种子选择。`);
}

console.log(out.join('\n'));
process.exit(violations.length ? 1 : 0);
