/**
 * 素材完整性校验（零依赖，退出码即门禁结论）
 *
 *   node src/js/assets-check.js            看板模式：列出已投放 / 待投放，仅不合规才失败
 *   node src/js/assets-check.js --strict   门禁模式：任何缺失都失败（素材补齐后用这个）
 *   node src/js/assets-check.js --init     按清单创建空目录骨架，供美术直接投放
 *
 * 与 balance-sim.js / seed-check.js 一样遵守「退出码 0 = 通过」的约定，
 * 可直接挂进 CI 或提交前检查。
 *
 * 校验三件事：① 文件在不在 ② 像素尺寸对不对（PNG 解 IHDR，不引第三方库）③ 体积是否超标。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const M = require('./assets-manifest.js');
const ROOT = path.join(__dirname, '..', '..');
const ASSET_ROOT = path.join(ROOT, M.basePath.replace(/\//g, path.sep));

const strict = process.argv.includes('--strict');

/* --init：按清单推导目录骨架并创建。素材投放前跑一次，省去手工建 12 个空目录。 */
if (process.argv.includes('--init')) {
  const dirs = new Set();
  M.images.concat(M.audio).forEach((e) => {
    dirs.add(path.dirname(e.file.split('/').join(path.sep)));
  });
  const created = [];
  dirs.forEach((d) => {
    const abs = path.join(ASSET_ROOT, d);
    const existed = fs.existsSync(abs);
    fs.mkdirSync(abs, { recursive: true });
    if (!existed) created.push(d);
  });
  console.log('素材根目录：' + ASSET_ROOT);
  console.log(created.length
    ? `新建 ${created.length} 个目录（共 ${dirs.size} 个，已存在的跳过）：`
    : `目录骨架已齐备（共 ${dirs.size} 个），无需新建。`);
  [...dirs].sort().forEach((d) => console.log('   ' + d + path.sep));
  console.log('\n投放完成后校验：node src/js/assets-check.js --strict');
  process.exit(0);
}

/* ---------------------------------------------------------------- *
 * PNG 尺寸解析
 *   签名 8 字节 + IHDR：长度(4) "IHDR"(4) width(4) height(4) ...
 *   即 width 在偏移 16，height 在偏移 20，均为大端。
 * ---------------------------------------------------------------- */
function pngSize(buf) {
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 24) return null;
  for (let i = 0; i < 8; i++) if (buf[i] !== SIG[i]) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** 只读头部，避免把 1MB 背景整张读进来 */
function headBytes(file, n) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(n);
    const got = fs.readSync(fd, buf, 0, n, 0);
    return buf.slice(0, got);
  } finally {
    fs.closeSync(fd);
  }
}

const kb = (b) => (b / 1024).toFixed(1) + 'KB';

/* ---------------------------------------------------------------- *
 * 位图校验
 * ---------------------------------------------------------------- */
const rows = [];
let missImg = 0, badImg = 0, okImg = 0, totalImgBytes = 0;

for (const e of M.images) {
  const abs = path.join(ASSET_ROOT, e.file.replace(/\//g, path.sep));
  if (!fs.existsSync(abs)) {
    missImg++;
    rows.push({ st: '待投放', file: e.file, detail: `${e.w}×${e.h}`, tier: e.tier });
    continue;
  }
  const st = fs.statSync(abs);
  if (st.size === 0) {
    badImg++;
    rows.push({ st: '空文件', file: e.file, detail: '0KB', tier: e.tier });
    continue;
  }
  totalImgBytes += st.size;

  const head = headBytes(abs, 34);
  const sz = pngSize(head);
  if (!sz) {
    badImg++;
    rows.push({ st: '非PNG', file: e.file, detail: '签名或 IHDR 不符', tier: e.tier });
    continue;
  }
  if (sz.w !== e.w || sz.h !== e.h) {
    badImg++;
    rows.push({ st: '尺寸不符', file: e.file, detail: `实测 ${sz.w}×${sz.h}，要求 ${e.w}×${e.h}`, tier: e.tier });
    continue;
  }
  if (st.size > M.limits.imageMaxBytes) {
    badImg++;
    rows.push({ st: '体积超标', file: e.file, detail: `${kb(st.size)} > ${kb(M.limits.imageMaxBytes)}`, tier: e.tier });
    continue;
  }
  okImg++;
  rows.push({ st: 'OK', file: e.file, detail: `${sz.w}×${sz.h} ${kb(st.size)}`, tier: e.tier });
}

/* ---------------------------------------------------------------- *
 * 音频校验（时长无法零依赖精确解析，只验存在性与体积）
 * ---------------------------------------------------------------- */
let missAud = 0, badAud = 0, okAud = 0, totalAudBytes = 0;

for (const e of M.audio) {
  const abs = path.join(ASSET_ROOT, e.file.replace(/\//g, path.sep));
  const limit = e.loop ? M.limits.bgmMaxBytes : M.limits.audioMaxBytes;
  if (!fs.existsSync(abs)) {
    missAud++;
    rows.push({ st: '待投放', file: e.file, detail: e.note, tier: e.tier });
    continue;
  }
  const st = fs.statSync(abs);
  if (st.size === 0) { badAud++; rows.push({ st: '空文件', file: e.file, detail: '0KB', tier: e.tier }); continue; }
  if (st.size > limit) {
    badAud++;
    rows.push({ st: '体积超标', file: e.file, detail: `${kb(st.size)} > ${kb(limit)}`, tier: e.tier });
    continue;
  }
  if (!e.loop) totalAudBytes += st.size;
  okAud++;
  rows.push({ st: 'OK', file: e.file, detail: kb(st.size), tier: e.tier });
}

/* ---------------------------------------------------------------- *
 * 输出
 * ---------------------------------------------------------------- */
console.log('素材完整性校验  ' + M.basePath + (strict ? '  [--strict 门禁模式]' : '  [看板模式]'));
console.log('─'.repeat(78));

const width = Math.max(...rows.map((r) => r.file.length));
for (const r of rows) {
  const mark = r.st === 'OK' ? '✓' : r.st === '待投放' ? '·' : '✕';
  console.log(`${mark} ${r.st.padEnd(5, ' ')} ${r.file.padEnd(width)}  ${r.detail}`);
}

console.log('─'.repeat(78));
console.log(`位图  ${okImg} 合格 / ${missImg} 待投放 / ${badImg} 不合规   合计 ${kb(totalImgBytes)}`);
console.log(`音频  ${okAud} 合格 / ${missAud} 待投放 / ${badAud} 不合规   音效合计 ${kb(totalAudBytes)}`);

if (!strict && totalAudBytes > M.limits.audioTotalMaxBytes) {
  console.log(`⚠ 音效合计 ${kb(totalAudBytes)} 超出 §6.2 目标（≈2.6s / 64kbps 单声道）`);
}

const bad = badImg + badAud;
const missing = missImg + missAud;

if (bad > 0) {
  console.log(`\n结论：${bad} 项不合规（尺寸 / 体积 / 格式），须修正后重跑。`);
  process.exit(1);
}
if (strict && missing > 0) {
  console.log(`\n结论：--strict 下 ${missing} 项待投放即视为未通过。`);
  process.exit(1);
}
if (missing > 0) {
  console.log(`\n结论：现有 ${missing} 项素材尚未投放，运行时全部走程序绘制 / 合成音回退，原型可正常试玩。`);
  console.log('       投放清单见 src/assets/README.md；补全后请跑 node src/js/assets-check.js --strict');
} else {
  console.log('\n结论：素材齐备且全部合规。');
}
process.exit(0);
