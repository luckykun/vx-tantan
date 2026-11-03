/**
 * 弹弹消消乐 · 图标层（lucide / shadcn 图标）
 *
 * 微信小游戏没有 DOM，无法直接用 shadcn 的 React 图标组件；但 shadcn/ui 的图标本体就是
 * lucide 的 24×24 描边 SVG。这里内置所需图标的 path 数据，用一个轻量 SVG path 解析器
 * 把它们以 Canvas 2D 矢量方式绘制（符合“矢量绘图无损缩放规范”，缩放到任意尺寸都清晰）。
 *
 * 对外暴露 global.Icons：
 *   drawIcon(ctx, name, x, y, size, opt)  x/y 为图标框左上角，size 为边长（正方形）
 *   richText(ctx, parts, x, y)            文本 + 内联图标混排（替代 “💎 数字” 这类 emoji 文案）
 *   has(name)
 *
 * opt: { stroke, fill, color, lineWidth }
 *   - 仅描边（默认）：{ stroke:'#fff' } 或 { color:'#fff' }
 *   - 实心：{ fill:c, stroke:c }（fill 与 stroke 同色）
 *   - 只填充不描边：{ fill:c, stroke:false }
 */
import { G } from '../runtime';

(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 图标 path 数据（lucide，viewBox 0 0 24 24，stroke-width 2）
   *   t:'p' 路径 / t:'c' 圆 / t:'r' 圆角矩形
   * ------------------------------------------------------------------ */
  var ICONS: any = {
    user: [
      { t: 'p', d: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' },
      { t: 'c', cx: 12, cy: 7, r: 4 }
    ],
    gem: [
      { t: 'p', d: 'M10.5 3 8 9l4 13 4-13-2.5-6' },
      { t: 'p', d: 'M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z' },
      { t: 'p', d: 'M2 9h20' }
    ],
    scissors: [
      { t: 'c', cx: 6, cy: 6, r: 3 },
      { t: 'p', d: 'M8.12 8.12 12 12' },
      { t: 'p', d: 'M20 4 8.12 15.88' },
      { t: 'c', cx: 6, cy: 18, r: 3 },
      { t: 'p', d: 'M14.8 14.8 20 20' }
    ],
    ghost: [
      { t: 'p', d: 'M15 10v1' },
      { t: 'p', d: 'M7.528 20.472a1.6 1.6 0 012.277 0l1.057 1.056a1.6 1.6 0 002.276 0l1.057-1.056a1.6 1.6 0 012.277 0l1.114 1.114a1.4 1.4 0 002.414-1V10a8 8 0 00-16 0v10.586a1.4 1.4 0 002.414 1z' },
      { t: 'p', d: 'M9 10v1' }
    ],
    ruler: [
      { t: 'p', d: 'M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z' },
      { t: 'p', d: 'm14.5 12.5 2-2' },
      { t: 'p', d: 'm11.5 9.5 2-2' },
      { t: 'p', d: 'm8.5 6.5 2-2' },
      { t: 'p', d: 'm17.5 15.5 2-2' }
    ],
    lock: [
      { t: 'r', x: 3, y: 11, w: 18, h: 11, rx: 2 },
      { t: 'p', d: 'M7 11V7a5 5 0 0 1 10 0v4' }
    ],
    play: [
      { t: 'p', d: 'M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z' }
    ],
    pause: [
      { t: 'r', x: 14, y: 3, w: 5, h: 18, rx: 1 },
      { t: 'r', x: 5, y: 3, w: 5, h: 18, rx: 1 }
    ],
    star: [
      { t: 'p', d: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z' }
    ],
    volume2: [
      { t: 'p', d: 'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z' },
      { t: 'p', d: 'M16 9a5 5 0 0 1 0 6' },
      { t: 'p', d: 'M19.364 18.364a9 9 0 0 0 0-12.728' }
    ],
    volumeX: [
      { t: 'p', d: 'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z' },
      { t: 'p', d: 'm16.5 14.5 5-5' },
      { t: 'p', d: 'm16.5 9.5 5 5' }
    ],
    x: [
      { t: 'p', d: 'M18 6 6 18' },
      { t: 'p', d: 'm6 6 12 12' }
    ],
    // v10 双主题重构新增（对应 tantan-design/assets/icons/*.svg）
    settings: [
      { t: 'p', d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' },
      { t: 'c', cx: 12, cy: 12, r: 3 }
    ],
    home: [
      { t: 'p', d: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8' },
      { t: 'p', d: 'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }
    ],
    replay: [
      { t: 'p', d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' },
      { t: 'p', d: 'M3 3v5h5' }
    ]
  };

  function has(name) { return Object.prototype.hasOwnProperty.call(ICONS, name); }

  /* ------------------------------------------------------------------ *
   * 几何工具：圆角矩形路径 / 椭圆弧（endpoint → center → 三次贝塞尔）
   * ------------------------------------------------------------------ */
  function rrectPath(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function angBetween(ux, uy, vx, vy) {
    var dot = ux * vx + uy * vy;
    var len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
    var c = len === 0 ? 1 : Math.max(-1, Math.min(1, dot / len));
    var a = Math.acos(c);
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  }

  function arcSeg(ctx, cx, cy, rx, ry, phi, t1, t2) {
    var delta = t2 - t1;
    var alpha = 4 / 3 * Math.tan(delta / 4);
    var cp = Math.cos(phi), sp = Math.sin(phi);
    function P(t) {
      var x = rx * Math.cos(t), y = ry * Math.sin(t);
      return [cp * x - sp * y + cx, sp * x + cp * y + cy];
    }
    function D(t) {
      var x = -rx * Math.sin(t), y = ry * Math.cos(t);
      return [cp * x - sp * y, sp * x + cp * y];
    }
    var p1 = P(t1), p2 = P(t2), d1 = D(t1), d2 = D(t2);
    ctx.bezierCurveTo(
      p1[0] + alpha * d1[0], p1[1] + alpha * d1[1],
      p2[0] - alpha * d2[0], p2[1] - alpha * d2[1],
      p2[0], p2[1]
    );
  }

  function arcTo(ctx, x1, y1, rx, ry, phiDeg, fa, fs, x2, y2) {
    if (rx === 0 || ry === 0) { ctx.lineTo(x2, y2); return; }
    rx = Math.abs(rx); ry = Math.abs(ry);
    var phi = phiDeg * Math.PI / 180, cp = Math.cos(phi), sp = Math.sin(phi);
    var dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    var x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
    var lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lam > 1) { var sq = Math.sqrt(lam); rx *= sq; ry *= sq; }
    var sign = (fa === fs) ? -1 : 1;
    var numr = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    var denr = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    var co = denr === 0 ? 0 : sign * Math.sqrt(Math.max(0, numr / denr));
    var cxp = co * (rx * y1p) / ry, cyp = co * (-ry * x1p) / rx;
    var cx = cp * cxp - sp * cyp + (x1 + x2) / 2;
    var cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
    var th1 = angBetween(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    var dth = angBetween((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!fs && dth > 0) dth -= 2 * Math.PI;
    if (fs && dth < 0) dth += 2 * Math.PI;
    var segs = Math.max(1, Math.ceil(Math.abs(dth) / (Math.PI / 2)));
    var step = dth / segs, th = th1;
    for (var k = 0; k < segs; k++) { arcSeg(ctx, cx, cy, rx, ry, phi, th, th + step); th += step; }
  }

  /* ------------------------------------------------------------------ *
   * 轻量 SVG path 解析器（支持 M L H V C S Q T A Z 及相对指令 / 隐式重复）
   * 直接以 immediate-mode 向 ctx 发出绘制指令（坐标为 24×24 局部空间）。
   * ------------------------------------------------------------------ */
  function tracePath(ctx, d) {
    var i = 0, n = d.length, cx = 0, cy = 0, sx = 0, sy = 0, px = 0, py = 0;
    function ws() {
      while (i < n) {
        var c = d.charCodeAt(i);
        if (c === 32 || c === 9 || c === 10 || c === 13 || c === 44) i++; else break;
      }
    }
    function isCmd(c) { return 'MmLlHhVvCcSsQqTtAaZz'.indexOf(c) >= 0; }
    function num() {
      ws();
      var s = i, dot = false;
      if (d[i] === '+' || d[i] === '-') i++;
      while (i < n) {
        var c = d[i];
        if (c >= '0' && c <= '9') i++;
        else if (c === '.') { if (dot) break; dot = true; i++; }
        else break;
      }
      if (d[i] === 'e' || d[i] === 'E') {
        var j = i + 1;
        if (d[j] === '+' || d[j] === '-') j++;
        if (j < n && d[j] >= '0' && d[j] <= '9') { i = j; while (i < n && d[i] >= '0' && d[i] <= '9') i++; }
      }
      return parseFloat(d.slice(s, i));
    }
    function flag() { ws(); var f = d[i] === '1' ? 1 : 0; i++; return f; }
    function hasNum() {
      ws();
      if (i >= n) return false;
      var c = d[i];
      if (isCmd(c)) return false;
      return (c >= '0' && c <= '9') || c === '.' || c === '-' || c === '+';
    }

    while (i < n) {
      ws();
      if (i >= n) break;
      var ch = d[i];
      if (!isCmd(ch)) break;
      i++;
      var rel = (ch === ch.toLowerCase()), C = ch.toUpperCase();
      if (C === 'Z') { ctx.closePath(); cx = sx; cy = sy; continue; }
      while (hasNum()) {
        var x, y, x1, y1, x2, y2;
        if (C === 'M' || C === 'L' || C === 'T') {
          x = num(); y = num(); if (rel) { x += cx; y += cy; }
          if (C === 'M') { ctx.moveTo(x, y); sx = x; sy = y; C = 'L'; }
          else if (C === 'L') { ctx.lineTo(x, y); }
          else { var tx = 2 * cx - px, ty = 2 * cy - py; ctx.quadraticCurveTo(tx, ty, x, y); }
          cx = x; cy = y;
        } else if (C === 'H') {
          x = num(); if (rel) x += cx; ctx.lineTo(x, cy); cx = x;
        } else if (C === 'V') {
          y = num(); if (rel) y += cy; ctx.lineTo(cx, y); cy = y;
        } else if (C === 'C') {
          x1 = num(); y1 = num(); x2 = num(); y2 = num(); x = num(); y = num();
          if (rel) { x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy; }
          ctx.bezierCurveTo(x1, y1, x2, y2, x, y); px = x2; py = y2; cx = x; cy = y;
        } else if (C === 'S') {
          x2 = num(); y2 = num(); x = num(); y = num();
          if (rel) { x2 += cx; y2 += cy; x += cx; y += cy; }
          var rx1 = 2 * cx - px, ry1 = 2 * cy - py;
          ctx.bezierCurveTo(rx1, ry1, x2, y2, x, y); px = x2; py = y2; cx = x; cy = y;
        } else if (C === 'Q') {
          x1 = num(); y1 = num(); x = num(); y = num();
          if (rel) { x1 += cx; y1 += cy; x += cx; y += cy; }
          ctx.quadraticCurveTo(x1, y1, x, y); px = x1; py = y1; cx = x; cy = y;
        } else if (C === 'A') {
          var rrx = num(), rry = num(), rot = num(), fa = flag(), fs = flag();
          x = num(); y = num(); if (rel) { x += cx; y += cy; }
          arcTo(ctx, cx, cy, rrx, rry, rot, fa, fs, x, y); cx = x; cy = y;
        } else {
          break;
        }
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * drawIcon：把 24×24 图标缩放到 size 并绘制。x/y 为图标框左上角。
   * ------------------------------------------------------------------ */
  function drawIcon(ctx, name, x, y, size, opt) {
    var shapes = ICONS[name];
    if (!shapes) return;
    opt = opt || {};
    var s = size / 24;
    var strokeColor = opt.stroke || opt.color || '#FFFFFF';
    var fillColor = opt.fill || opt.color || strokeColor;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineWidth = (opt.lineWidth != null ? opt.lineWidth : 2);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = fillColor;
    for (var i = 0; i < shapes.length; i++) {
      var sh = shapes[i];
      ctx.beginPath();
      if (sh.t === 'p') tracePath(ctx, sh.d);
      else if (sh.t === 'c') ctx.arc(sh.cx, sh.cy, sh.r, 0, Math.PI * 2);
      else if (sh.t === 'r') rrectPath(ctx, sh.x, sh.y, sh.w, sh.h, sh.rx || 0);
      if (opt.fill) ctx.fill();
      if (opt.stroke !== false) ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * richText：文本 + 内联图标混排。
   *   parts: (string | { icon, size, color, stroke, fill, lineWidth, gapL, gapR })[]
   *   x/y: 锚点；水平按当前 ctx.textAlign（left/center/right）对齐；
   *        垂直沿用当前 ctx.textBaseline（图标中心自动对齐到文字视觉中心）。
   *   调用前需自行设置 ctx.font / ctx.fillStyle（文本用）。
   * ------------------------------------------------------------------ */
  function fontPx(ctx) {
    var m = /(\d+(?:\.\d+)?)px/.exec(ctx.font || '');
    return m ? parseFloat(m[1]) : 12;
  }

  function richText(ctx, parts, x, y) {
    var align = ctx.textAlign || 'left';
    var bl = ctx.textBaseline || 'alphabetic';
    var fs = fontPx(ctx);
    var iconCY = (bl === 'middle' || bl === 'center') ? y
      : (bl === 'alphabetic') ? y - fs * 0.34
      : y;
    var widths = [], total = 0, i;
    for (i = 0; i < parts.length; i++) {
      var p = parts[i], w;
      if (typeof p === 'string') w = ctx.measureText(p).width;
      else w = (p.size || 14) + (p.gapL || 0) + (p.gapR || 0);
      widths.push(w); total += w;
    }
    var cx = align === 'center' ? x - total / 2 : (align === 'right' ? x - total : x);
    var savedAlign = ctx.textAlign;
    ctx.textAlign = 'left';
    for (i = 0; i < parts.length; i++) {
      var q = parts[i];
      if (typeof q === 'string') {
        ctx.fillText(q, cx, y);
        cx += widths[i];
      } else {
        var isz = q.size || 14;
        drawIcon(ctx, q.icon, cx + (q.gapL || 0), iconCY - isz / 2, isz, {
          stroke: q.stroke, fill: q.fill, color: q.color, lineWidth: q.lineWidth
        });
        cx += widths[i];
      }
    }
    ctx.textAlign = savedAlign;
  }

  global.Icons = { drawIcon: drawIcon, richText: richText, has: has };
})(G);
