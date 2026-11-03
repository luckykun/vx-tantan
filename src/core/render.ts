/**
 * 弹弹消消乐 · 交互原型 —— 渲染层（v3）
 * 全部使用 Canvas 2D 绘制（与微信小游戏 / 小程序 canvas 2d API 一致）
 * v3：新道具绘制(生命/爆炸/挡板)、HUD 消除进度条、结算面板分数拆解、
 *     移除旧停滞进度条，仅保留超时警告。
 */
import { G } from '../runtime';
import './config';
import './engine';

(function (global) {
  'use strict';

  var CFG = global.TT.CFG;
  var PAL = global.TT.PALETTE;
  var TYPE = global.TT.TYPE;
  var PROPS = global.TT.PROPS;
  var Icons = global.Icons;
  var Game = global.Game;
  var S = Game.S;

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
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

  /* ---------------- v10 双主题工具 ---------------- */
  function isLight() { return PAL.mode === 'light'; }
  function UI() { return PAL.ui; }

  /** 卡片硬阴影（仅浅色）：在画卡片本体前调用 */
  function hardShadow(ctx, x, y, w, h, r, ox, oy) {
    if (!isLight()) return;
    ctx.save();
    ctx.fillStyle = UI().shadow;
    roundRect(ctx, x + (ox || 3), y + (oy || 4), w, h, r);
    ctx.fill();
    ctx.restore();
  }

  /** 卡片描边：浅色=ink 粗描边；深色=半透明白细描边 */
  function cardStroke(ctx, x, y, w, h, r) {
    ctx.save();
    if (isLight()) { ctx.strokeStyle = UI().cardBorder; ctx.lineWidth = 2; }
    else { ctx.strokeStyle = UI().cardBorder; ctx.lineWidth = 1; }
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.stroke();
    ctx.restore();
  }

  /** 8 向描边字（浅色标题用） */
  function strokeText8(ctx, text, x, y, strokeCol, fillCol, off) {
    off = off || 2;
    ctx.save();
    ctx.fillStyle = strokeCol;
    var d = [[off, 0], [-off, 0], [0, off], [0, -off], [off, off], [-off, off], [off, -off], [-off, -off]];
    for (var i = 0; i < d.length; i++) ctx.fillText(text, x + d[i][0], y + d[i][1]);
    ctx.fillStyle = fillCol;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /** 纵向渐变填充（深色果冻通用） */
  function vGrad(ctx, x, y, h, c0, c1) {
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    return g;
  }

  /* ------------------------------------------------------------------ *
   * 背景
   * ------------------------------------------------------------------ */
  function drawBackground(ctx) {
    // v10.3：底色渐变统一由主循环在设备空间一次性铺满（消除上下分割线），
    // 此处仅绘制主题装饰（浅色首页色斑 / 深色星点光斑）。
    if (isLight()) {
      // v10.27：糖果色斑全屏幕统一绘制（首页/游戏页背景一致）；左上粉色块加大
      var blobs = [
        { x: CFG.W * 0.10, y: CFG.H * 0.06, r: 230, c: 'rgba(255,227,236,0.95)' },
        { x: CFG.W * 0.92, y: CFG.H * 0.12, r: 150, c: 'rgba(223,243,255,0.95)' },
        { x: CFG.W * 0.82, y: CFG.H * 0.90, r: 175, c: 'rgba(255,241,201,0.95)' },
        { x: CFG.W * 0.06, y: CFG.H * 0.78, r: 145, c: 'rgba(228,247,224,0.95)' },
        { x: CFG.W * 0.50, y: CFG.H * 0.45, r: 180, c: 'rgba(255,246,233,0.6)' }
      ];
      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i];
        var rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        rg.addColorStop(0, b.c);
        rg.addColorStop(1, 'rgba(255,246,233,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill();
      }
      // 点缀小圆点/星（设计稿装饰，仅首页）
      if (S.phase === Game.PHASE.HOME) {
        ctx.save();
        ctx.strokeStyle = '#4a3f35'; ctx.lineWidth = 1.5;
        ctx.fillStyle = '#FF8FB2';
        ctx.beginPath(); ctx.arc(CFG.W * 0.62, 44, 5, 0, 6.283); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#7ED8F7';
        ctx.beginPath(); ctx.arc(CFG.W * 0.16, 150, 4, 0, 6.283); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#FFD166';
        ctx.font = '16px -apple-system, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✦', CFG.W * 0.86, 150);
        ctx.fillText('✦', CFG.W * 0.10, 96);
        ctx.restore();
      }
      return;
    }

    // 深色：星点 + 柔和光斑
    ctx.save();
    var glows = [
      { x: CFG.W * 0.1, y: CFG.H * 0.12, r: 120, c: 'rgba(255,143,184,0.16)' },
      { x: CFG.W * 0.9, y: CFG.H * 0.4, r: 130, c: 'rgba(124,245,200,0.12)' },
      { x: CFG.W * 0.15, y: CFG.H * 0.85, r: 130, c: 'rgba(201,182,255,0.14)' }
    ];
    for (var gi2 = 0; gi2 < glows.length; gi2++) {
      var gb = glows[gi2];
      var rg2 = ctx.createRadialGradient(gb.x, gb.y, 0, gb.x, gb.y, gb.r);
      rg2.addColorStop(0, gb.c);
      rg2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg2;
      ctx.beginPath(); ctx.arc(gb.x, gb.y, gb.r, 0, 6.283); ctx.fill();
    }
    for (var i2 = 0; i2 < 46; i2++) {
      var x = (i2 * 97.3) % CFG.W;
      var y = (i2 * 53.7) % CFG.H;
      var a = 0.10 + 0.16 * Math.abs(Math.sin(S.time * 0.8 + i2));
      ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * 顶部 HUD
   * ------------------------------------------------------------------ */
  function drawHUD(ctx) {
    ctx.save();
    var u = UI();
    // v10.14：标题行与微信胶囊同一行垂直居中（参考首页顶栏基准）
    // v10.29：home 快捷钮去圆框，直接展示房子 ICON 并放大
    var hbx = 10, hbs = 22;
    Icons.drawIcon(ctx, 'home', hbx, CFG.CAP_CY - hbs / 2, hbs, { stroke: u.textOnCard, lineWidth: 2.2 });
    S._btnHomeQuick = { x: hbx - 4, y: CFG.CAP_CY - 16, w: hbs + 8, h: 32 };
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = '900 15px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = u.textOnCard;
    ctx.fillText('关卡' + S.level.id + ' · ' + S.level.name, 38, CFG.CAP_CY);

    // HUD 卡片（v10.32）：右侧暂停+音效双钮（加大间距），其余空间自适应四模块：
    // 消除进度(进度条自适应填充) · 耗时 · 剩余 · 星星+分数
    var hx = 10, hy = CFG.HUD_TOP, hw = CFG.W - 20, hh = 50;
    if (isLight()) {
      hardShadow(ctx, hx, hy, hw, hh, 16, 3, 4);
      ctx.fillStyle = u.card;
    } else {
      ctx.fillStyle = u.card;
    }
    roundRect(ctx, hx, hy, hw, hh, 16);
    ctx.fill();
    cardStroke(ctx, hx, hy, hw, hh, 16);

    var rowY = hy + hh / 2;

    // 右侧双钮区（v10.32：间距 6→16）
    var pbs = 30;
    var sbx = hx + hw - 12 - pbs;                  // 音效（最右）
    var pbx = sbx - 16 - pbs;                      // 暂停（音效左，间距加大）
    var pby = hy + (hh - pbs) / 2;

    // 自适应四模块：进度吃掉剩余宽度
    var padL = hx + 12;
    var mGap = 9;
    var total = S.level.balls;
    var wTime = 40, wShots = 8 + total * 11.5, wStar = 50;
    var availW = (pbx - 12) - padL;
    var wProg = Math.max(64, availW - wTime - wShots - wStar - 3 * mGap);
    var cx1 = padL;
    var cx2 = cx1 + wProg + mGap;
    var cx3 = cx2 + wTime + mGap;
    var cx4 = cx3 + wShots + mGap;

    // 1) 消除进度（进度条自适应填充模块宽）
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = u.textOnCardSub;
    ctx.font = '600 10px -apple-system, "PingFang SC", sans-serif';
    var pct = S.totalBricks ? S.destroyed / S.totalBricks : 0;
    ctx.fillText('消除 ' + Math.floor(pct * 100) + '%', cx1, rowY - 11);
    var barX = cx1, barW = wProg - 4, barH = 9, barY = rowY + 2;
    ctx.fillStyle = isLight() ? u.track : 'rgba(255,255,255,0.14)';
    roundRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fill();
    if (isLight()) { ctx.strokeStyle = u.cardBorder; ctx.lineWidth = 1.2; roundRect(ctx, barX, barY, barW, barH, barH / 2); ctx.stroke(); }
    if (pct > 0) {
      var gg = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      if (isLight()) { gg.addColorStop(0, '#8FD98A'); gg.addColorStop(1, '#5cb85c'); }
      else { gg.addColorStop(0, '#7CF5C8'); gg.addColorStop(1, '#22C58B'); }
      ctx.fillStyle = gg;
      roundRect(ctx, barX + 1, barY + 1, Math.max(barH - 2, (barW - 2) * pct), barH - 2, (barH - 2) / 2);
      ctx.fill();
    }

    // 2) 耗时
    ctx.fillStyle = u.textOnCardSub;
    ctx.font = '600 10px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('耗时', cx2, rowY - 11);
    ctx.fillStyle = u.textOnCard;
    ctx.font = '700 15px -apple-system, sans-serif';
    var es = Math.floor(S.elapsed);
    ctx.fillText(Math.floor(es / 60) + ':' + String(es % 60).padStart(2, '0'), cx2, rowY + 7);

    // 3) 剩余发射（圆点）
    ctx.fillStyle = u.textOnCardSub;
    ctx.font = '600 10px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('剩余', cx3, rowY - 11);
    var dotR = 4, gap = 11.5;
    for (var i = 0; i < total; i++) {
      ctx.beginPath();
      ctx.arc(cx3 + 4 + i * gap, rowY + 7, dotR, 0, Math.PI * 2);
      if (i < S.shotsLeft) {
        ctx.fillStyle = isLight() ? '#8FD98A' : '#7CF5C8';
        ctx.fill();
        if (isLight()) { ctx.strokeStyle = u.cardBorder; ctx.lineWidth = 1.2; ctx.stroke(); }
      } else { ctx.strokeStyle = isLight() ? 'rgba(74,63,53,0.25)' : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.4; ctx.stroke(); }
    }

    // 4) 星星等级 + 分数（v10.23：按"预计总分"点亮，与结算同阈值）
    var th = S.level.starScores || [1e9, 1e9, 1e9];
    var proj = S.score + (S.shotsLeft + S.balls.length) * 10 + S.maxCombo * 5 +
      (S.elapsed < 30 ? 500 : (S.elapsed <= 60 ? 300 : (S.elapsed <= 120 ? 100 : 50)));
    for (var s2 = 0; s2 < 3; s2++) {
      var lit = proj >= th[s2];
      Icons.drawIcon(ctx, 'star', cx4 + s2 * 12, rowY - 11 - 5, 11,
        lit ? { fill: u.star, stroke: u.star } : { stroke: isLight() ? 'rgba(74,63,53,0.3)' : 'rgba(255,255,255,0.3)' });
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = u.textOnCard;
    ctx.font = '700 15px -apple-system, sans-serif';
    ctx.fillText(String(S.score), cx4, rowY + 7);

    // 5) 暂停按钮
    if (isLight()) {
      ctx.fillStyle = u.accent;
      roundRect(ctx, pbx, pby, pbs, pbs, 9);
      ctx.fill();
      ctx.strokeStyle = u.cardBorder; ctx.lineWidth = 2;
      roundRect(ctx, pbx, pby, pbs, pbs, 9); ctx.stroke();
    } else {
      ctx.fillStyle = vGrad(ctx, pbx, pby, pbs, '#FFF6DF', '#F0B94A');
      roundRect(ctx, pbx, pby, pbs, pbs, 9);
      ctx.fill();
    }
    Icons.drawIcon(ctx, 'pause', pbx + pbs / 2 - 7, pby + pbs / 2 - 7, 14, { fill: isLight() ? u.accentInk : '#4A2E10', stroke: false });
    S._btnPause = { x: pbx, y: pby, w: pbs, h: pbs };

    // 6) 音效开关按钮（仅 ICON）
    ctx.fillStyle = isLight() ? '#fff' : 'rgba(255,255,255,0.12)';
    roundRect(ctx, sbx, pby, pbs, pbs, 9);
    ctx.fill();
    if (isLight()) { ctx.strokeStyle = u.cardBorder; ctx.lineWidth = 2; roundRect(ctx, sbx, pby, pbs, pbs, 9); ctx.stroke(); }
    else { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; roundRect(ctx, sbx + 0.5, pby + 0.5, pbs - 1, pbs - 1, 9); ctx.stroke(); }
    var sndOn = global.Sfx ? global.Sfx.isEnabled() : true;
    Icons.drawIcon(ctx, sndOn ? 'volume2' : 'volumeX', sbx + 7, pby + 7, 16, { stroke: u.textOnCard, lineWidth: 1.8 });
    S._btnSoundHud = { x: sbx, y: pby, w: pbs, h: pbs };

    ctx.restore();
  }

  /** v10.5：矢量手指 ICON（食指点按造型），s=整体高度 */
  function drawFingerIcon(ctx, cx, cy, s, lineCol, fillCol) {
    ctx.save();
    ctx.translate(cx, cy);
    var k = s / 24;
    ctx.scale(k, k);
    // 手掌+食指轮廓（简化 lucide pointer 造型）
    ctx.beginPath();
    ctx.moveTo(-1.5, -10);                       // 指尖起
    ctx.quadraticCurveTo(-1.5, -12, 0, -12);
    ctx.quadraticCurveTo(1.5, -12, 1.5, -10);
    ctx.lineTo(1.5, -1);
    ctx.quadraticCurveTo(3.5, -1.5, 4.5, 0.5);
    ctx.quadraticCurveTo(6.5, 0, 7, 2);
    ctx.quadraticCurveTo(8.5, 1.5, 8.5, 4);
    ctx.lineTo(8.5, 7);
    ctx.quadraticCurveTo(8.5, 11, 4, 11);
    ctx.lineTo(-1, 11);
    ctx.quadraticCurveTo(-4, 11, -5, 8);
    ctx.lineTo(-7, 2);
    ctx.quadraticCurveTo(-7.6, 0.2, -6, -0.4);
    ctx.quadraticCurveTo(-4.6, -0.9, -3.8, 0.6);
    ctx.lineTo(-1.5, 4);
    ctx.closePath();
    ctx.fillStyle = fillCol;
    ctx.fill();
    ctx.strokeStyle = lineCol;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * v10.17：统一提示组件——大方框居中药丸胶囊（深浅双主题同款造型）
   * ------------------------------------------------------------------ */
  function drawToastPill(ctx, text, cy, alpha) {
    if (alpha <= 0.01) return;
    var u = UI();
    var cx = CFG.W / 2;
    ctx.save();
    ctx.font = '400 11px -apple-system, "PingFang SC", sans-serif';   // v10.19：字号再缩小
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var tw = ctx.measureText(text).width + 26, th = 25;
    ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
    // v10.18：去掉右下硬阴影
    ctx.fillStyle = isLight() ? u.ink : 'rgba(10,5,30,0.55)';
    roundRect(ctx, cx - tw / 2, cy - th / 2, tw, th, th / 2);
    ctx.fill();
    if (!isLight()) {
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
      roundRect(ctx, cx - tw / 2 + 0.5, cy - th / 2 + 0.5, tw - 1, th - 1, (th - 1) / 2); ctx.stroke();
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(text, cx, cy + 0.5);
    ctx.restore();
  }

  /** v10.17：常驻提示文案（READY 引导 / 弹药用完），由统一组件带呼吸闪烁展示 */
  function getPersistentHint() {
    if (S.phase === Game.PHASE.READY) return '手指左右移动瞄准，松手发射开始游戏';
    // v10.22：弹药用完提示仅末次发射后 3s 内显示
    if (S.phase === Game.PHASE.PLAY && !S.aim.active && S.shotsLeft <= 0 &&
        S.time - (S.lastShotAt || 0) < 3) return '弹药已用完 · 争取回弹链不断';
    return null;
  }

  /* ------------------------------------------------------------------ *
   * v10.2：READY 态手指引导（大方框内左右移动；v10.17 文案并入统一组件）
   * ------------------------------------------------------------------ */
  function drawFingerGuide(ctx) {
    if (S.phase !== Game.PHASE.READY) return;
    var u = UI();
    var fx = CFG.W / 2 + Math.sin(S.time * 1.7) * 72;
    var fy = CFG.ARENA_BOTTOM - 46;   // v10.17：手指区域上移
    ctx.save();
    // 点按波纹
    var rp = (S.time % 1.1) / 1.1;
    ctx.globalAlpha = (1 - rp) * 0.5;
    ctx.strokeStyle = u.good;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fx, fy, 8 + rp * 14, 0, 6.283);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // 手指 ICON（v10.5：矢量绘制，替代 emoji 保证双主题一致）
    drawFingerIcon(ctx, fx, fy, 24, isLight() ? u.ink : '#FFF7EF', isLight() ? '#ffffff' : 'rgba(255,255,255,0.9)');
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * 竞技区容器
   * ------------------------------------------------------------------ */
  function drawArena(ctx) {
    ctx.save();
    var u = UI();
    var ax = CFG.ARENA_LEFT - 3, ay = CFG.ARENA_TOP - 3, aw = CFG.ARENA_W + 6, ah = CFG.ARENA_H + 6;
    // v10：浅色无外阴影；容器无下边框（底部由墙体封口）
    ctx.fillStyle = PAL.panel;
    roundRectTop(ctx, ax, ay, aw, ah, 12);
    ctx.fill();
    // 仅描上/左/右三边：底边整条不画（缝隙处不能有线，墙段自带描边）
    ctx.strokeStyle = PAL.panelLine;
    ctx.lineWidth = isLight() ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay + ah);
    ctx.lineTo(ax, ay + 12);
    ctx.quadraticCurveTo(ax, ay, ax + 12, ay);
    ctx.lineTo(ax + aw - 12, ay);
    ctx.quadraticCurveTo(ax + aw, ay, ax + aw, ay + 12);
    ctx.lineTo(ax + aw, ay + ah);
    ctx.stroke();

    // 淡网格（一格一方块）
    ctx.strokeStyle = u.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var c = 1; c < CFG.COLS; c++) {
      var x = CFG.ARENA_LEFT + c * CFG.CELL;
      ctx.moveTo(x, CFG.ARENA_TOP); ctx.lineTo(x, CFG.ARENA_BOTTOM);
    }
    for (var r = 1; r < CFG.ROWS; r++) {
      var y = CFG.ARENA_TOP + r * CFG.CELL;
      ctx.moveTo(CFG.ARENA_LEFT, y); ctx.lineTo(CFG.ARENA_RIGHT, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** 仅上圆角的路径（下边直角，交给墙体封口） */
  function roundRectTop(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ------------------------------------------------------------------ *
   * 方块
   * ------------------------------------------------------------------ */
  function drawCell(ctx, r, c) {
    var cell = S.grid[r][c];
    if (!cell.alive) return;
    var rect = Game.cellRect(r, c);
    var inset = 0;
    var x = rect.x + inset, y = rect.y + inset;
    var w = rect.w - inset * 2, h = rect.h - inset * 2;

    // 入场缩放动画
    var k = cell.spawnAnim;
    if (k < 1) {
      var sc = 0.4 + 0.6 * easeOutBack(k);
      var cxm = x + w / 2, cym = y + h / 2;
      x = cxm - w * sc / 2; y = cym - h * sc / 2; w *= sc; h *= sc;
      ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.4));
    }

    // 底部墙壁被打开时的淡出
    if (cell.opened) {
      ctx.globalAlpha = 0.16 + 0.1 * Math.sin(S.time * 12);
    } else if (isBottomWallWarning(r) && !cell.opened) {
      ctx.globalAlpha = 0.72 + 0.28 * Math.abs(Math.sin(S.time * 7));
    }

    if (cell.type === TYPE.WALL) {
      // v10.1：底部墙壁行改由 drawBottomWallRow 连续绘制（此处跳过）
      if (r === CFG.ROWS - 1) return;
      // v4 需求⑨：隐形期间的方块区墙壁淡化为可穿透（底部墙行不受影响）
      if (S.wallGhost > 0 && r < CFG.ROWS - 1 && !cell.opened) {
        ctx.globalAlpha = 0.16;
        drawWall(ctx, x, y, w, h, r, c);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(230,236,255,0.5)';
        ctx.setLineDash([2, 2]); ctx.lineWidth = 0.6;
        roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 2); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        drawWall(ctx, x, y, w, h, r, c);
      }
    }
    else if (cell.type === TYPE.SPLIT3) drawSplit3(ctx, x, y, w, h);
    else if (cell.type === TYPE.LIFE) drawLife(ctx, x, y, w, h);
    else if (cell.type === TYPE.PADDLE) drawPaddlePow(ctx, x, y, w, h);
    else if (cell.type === TYPE.GHOST) drawGhost(ctx, x, y, w, h);
    else drawBrick(ctx, x, y, w, h, cell.colorIdx);

    ctx.globalAlpha = 1;
  }

  function isBottomWallWarning(r) {
    if (r !== CFG.ROWS - 1 || S.phase !== Game.PHASE.PLAY || S.bottomOpened) return false;
    // v3：仅关卡硬超时触发警告（已移除旧停滞开底）
    var toOpen = Math.max(0, CFG.LEVEL_TIMEOUT - S.elapsed);
    return toOpen <= CFG.OPEN_WARN;
  }

  function drawBrick(ctx, x, y, w, h, idx) {
    var col = PAL.bricks[idx % PAL.bricks.length];
    // v10.5：方块间留 0.75px 缝（四色循环恢复）
    var ix = x + 0.75, iy = y + 0.75, iw = w - 1.5, ih = h - 1.5;
    if (isLight()) {
      ctx.fillStyle = col.top;
      roundRect(ctx, ix, iy, iw, ih, 2.6);
      ctx.fill();
      ctx.strokeStyle = PAL.brickBorder;
      ctx.lineWidth = 1.4;
      roundRect(ctx, ix + 0.7, iy + 0.7, iw - 1.4, ih - 1.4, 2.2);
      ctx.stroke();
      return;
    }
    var g = ctx.createLinearGradient(ix, iy, ix, iy + ih);
    g.addColorStop(0, col.top);
    g.addColorStop(1, col.bottom);
    ctx.fillStyle = g;
    roundRect(ctx, ix, iy, iw, ih, 2.6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    roundRect(ctx, ix + 1.2, iy + 1.2, iw - 2.4, ih * 0.32, 1.6);
    ctx.fill();
  }

  /**
   * 竞技区内部墙块（v10.8 合并为整体）：整格填充砖纹/果冻，
   * 仅在与非墙相邻的边界描边——相邻墙格之间不画线，视觉连成一整块。
   */
  function drawWall(ctx, x, y, w, h, r, c) {
    var inset = 0.4;
    if (isLight()) {
      // v10.9：纯色填充（去掉内部砖缝线），格间白缝由 clip inset 自然形成
      ctx.save();
      roundRect(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, 2);
      ctx.clip();
      ctx.fillStyle = PAL.wall.bottom;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    } else {
      var g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, PAL.wall.top);
      g.addColorStop(1, PAL.wall.bottom);
      ctx.fillStyle = g;
      roundRect(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, 2);
      ctx.fill();
    }
    // 仅外边界描边
    var gr = S.grid;
    function isW(rr, cc) {
      if (rr < 0 || rr >= CFG.ROWS || cc < 0 || cc >= CFG.COLS) return false;
      var cell = gr[rr] && gr[rr][cc];
      return !!cell && cell.alive && cell.type === TYPE.WALL && !cell.opened;
    }
    ctx.strokeStyle = PAL.wall.edge;
    ctx.lineWidth = isLight() ? 1.5 : 1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    var e = 0.75;
    if (!isW(r - 1, c)) { ctx.moveTo(x + e, y + e); ctx.lineTo(x + w - e, y + e); }
    if (!isW(r + 1, c)) { ctx.moveTo(x + e, y + h - e); ctx.lineTo(x + w - e, y + h - e); }
    if (!isW(r, c - 1)) { ctx.moveTo(x + e, y + e); ctx.lineTo(x + e, y + h - e); }
    if (!isW(r, c + 1)) { ctx.moveTo(x + w - e, y + e); ctx.lineTo(x + w - e, y + h - e); }
    ctx.stroke();
  }

  function drawBlocks(ctx) {
    for (var r = 0; r < CFG.ROWS; r++) {
      for (var c = 0; c < CFG.COLS; c++) drawCell(ctx, r, c);
    }
    drawBottomWallRow(ctx);
  }

  /**
   * v10.1：底部墙壁行连续绘制——相邻墙格合并为整段：
   * v10.6：墙段下延 3px 与大方框底边齐平（无间距），整段一圈描边（含底边），
   * 段与段之间的缝隙处无任何线条。
   */
  function drawBottomWallRow(ctx) {
    var r = CFG.ROWS - 1;
    var y = CFG.ARENA_TOP + r * CFG.CELL;
    var h = CFG.CELL + 3;   // 下延到容器底边（含 3px 边框偏移）
    var row = S.grid[r];
    var c = 0;
    ctx.save();
    while (c < CFG.COLS) {
      if (!row[c].alive || row[c].type !== TYPE.WALL) { c++; continue; }
      var c0 = c;
      while (c < CFG.COLS && row[c].alive && row[c].type === TYPE.WALL) c++;
      var opened = !!row[c0].opened;
      var warn = isBottomWallWarning(r) && !opened;
      if (opened) ctx.globalAlpha = 0.16 + 0.1 * Math.sin(S.time * 12);
      else if (warn) ctx.globalAlpha = 0.72 + 0.28 * Math.abs(Math.sin(S.time * 7));
      else ctx.globalAlpha = 1;
      var x = CFG.ARENA_LEFT + c0 * CFG.CELL;
      var w = (c - c0) * CFG.CELL;
      if (isLight()) {
        // v10.9：纯色整段填充（去砖缝），段内格间画白色缝隙线
        ctx.save();
        wallSegPath(ctx, x, y, w, h);
        ctx.clip();
        ctx.fillStyle = PAL.wall.bottom;
        ctx.fillRect(x, y, w, h);
        ctx.restore();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (var gc = c0 + 1; gc < c; gc++) {
          var gx = CFG.ARENA_LEFT + gc * CFG.CELL;
          ctx.moveTo(gx, y + 1);
          ctx.lineTo(gx, y + h - 1);
        }
        ctx.stroke();
        ctx.strokeStyle = PAL.wall.edge;
        ctx.lineWidth = 1.6;
        wallSegPath(ctx, x + 0.8, y + 0.8, w - 1.6, h - 1.6);
        ctx.stroke();
      } else {
        var g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, PAL.wall.top);
        g.addColorStop(1, PAL.wall.bottom);
        ctx.fillStyle = g;
        wallSegPath(ctx, x, y, w, h);
        ctx.fill();
        // 深色：段内格间缝隙线（暗色）
        ctx.strokeStyle = 'rgba(26,18,52,0.5)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (var gc2 = c0 + 1; gc2 < c; gc2++) {
          var gx2 = CFG.ARENA_LEFT + gc2 * CFG.CELL;
          ctx.moveTo(gx2, y + 1);
          ctx.lineTo(gx2, y + h - 1);
        }
        ctx.stroke();
        ctx.strokeStyle = PAL.wall.edge;
        ctx.lineWidth = 1;
        wallSegPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** 墙段路径：上圆角、下直角（与容器底边齐平） */
  function wallSegPath(ctx, x, y, w, h) {
    var r = Math.min(3, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* 道具方块底色（v10.5：满格-1.5 留缝） */
  function propTile(ctx, x, y, w, h, colorKey) {
    var col = PAL[colorKey] || PAL.bricks[0];
    var ix = x + 0.75, iy = y + 0.75, iw = w - 1.5, ih = h - 1.5;
    if (isLight()) {
      ctx.fillStyle = col.bottom;
      roundRect(ctx, ix, iy, iw, ih, 2.6);
      ctx.fill();
      ctx.strokeStyle = PAL.brickBorder;
      ctx.lineWidth = 1.4;
      roundRect(ctx, ix + 0.7, iy + 0.7, iw - 1.4, ih - 1.4, 2.2);
      ctx.stroke();
      return;
    }
    var g = ctx.createLinearGradient(ix, iy, ix, iy + ih);
    g.addColorStop(0, col.top);
    g.addColorStop(1, col.bottom);
    ctx.fillStyle = g;
    roundRect(ctx, ix, iy, iw, ih, 2.6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    roundRect(ctx, ix + 1.2, iy + 1.2, iw - 2.4, ih * 0.32, 1.6);
    ctx.fill();
  }

  /* 白色小圆点（分裂道具） */
  function dot(ctx, cx, cy, r) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.283);
    ctx.fill();
  }

  // 生命球：白色爱心（红粉底）
  function drawLife(ctx, x, y, w, h) {
    propTile(ctx, x, y, w, h, 'life');
    var cx = x + w / 2, cy = y + h / 2 + h * 0.03, s = Math.min(w, h) * 0.3;
    ctx.save();
    if (!isLight()) { ctx.shadowColor = PAL.life.glow; ctx.shadowBlur = 5; }
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.9);
    ctx.bezierCurveTo(cx - s * 1.6, cy - s * 0.2, cx - s * 0.6, cy - s * 1.5, cx, cy - s * 0.4);
    ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.5, cx + s * 1.6, cy - s * 0.2, cx, cy + s * 0.9);
    ctx.fill();
    ctx.restore();
  }

  // 横条加强：绿底 + 白色长方形横条
  function drawPaddlePow(ctx, x, y, w, h) {
    propTile(ctx, x, y, w, h, 'paddlePow');
    var bw = w * 0.62, bh = h * 0.26;
    var bx = x + (w - bw) / 2, by = y + (h - bh) / 2;
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fill();
  }

  // 三分裂道具方块：紫底 + 三个小白点（上1下2 三角排列）
  function drawSplit3(ctx, x, y, w, h) {
    propTile(ctx, x, y, w, h, 'split3');
    var cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * 0.13;
    dot(ctx, cx, cy - h * 0.18, r);
    dot(ctx, cx - w * 0.18, cy + h * 0.16, r);
    dot(ctx, cx + w * 0.18, cy + h * 0.16, r);
  }

  // 墙壁隐形道具方块：灰蓝底 + 白色虚线幽灵轮廓
  function drawGhost(ctx, x, y, w, h) {
    propTile(ctx, x, y, w, h, 'ghost');
    var cx = x + w / 2, cy = y + h / 2, s = Math.min(w, h) * 0.3;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.1, s * 0.8, Math.PI, 0);
    ctx.lineTo(cx + s * 0.8, cy + s * 0.7);
    ctx.lineTo(cx + s * 0.4, cy + s * 0.4);
    ctx.lineTo(cx, cy + s * 0.7);
    ctx.lineTo(cx - s * 0.4, cy + s * 0.4);
    ctx.lineTo(cx - s * 0.8, cy + s * 0.7);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    dot(ctx, cx - s * 0.28, cy - s * 0.1, 1.2);
    dot(ctx, cx + s * 0.28, cy - s * 0.1, 1.2);
  }

  /* ------------------------------------------------------------------ *
   * 接球区
   * ------------------------------------------------------------------ */
  function drawCatchZone(ctx) {
    ctx.save();
    var u = UI();
    // v10：轨道满高（与挡板同高），浅色=track 底+ink 描边，深色=半透明+内阴影感
    var tx = CFG.ARENA_LEFT, ty = CFG.PADDLE_Y, tw = CFG.ARENA_W, th = CFG.PADDLE_H;
    ctx.fillStyle = u.track;
    roundRect(ctx, tx, ty, tw, th, th / 2);
    ctx.fill();
    if (isLight()) {
      ctx.strokeStyle = u.cardBorder; ctx.lineWidth = 1.6;
      roundRect(ctx, tx, ty, tw, th, th / 2); ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1;
      roundRect(ctx, tx + 0.5, ty + 0.5, tw - 1, th - 1, th / 2); ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * 挡板（v3：强化时满宽 + 最后 3s 闪烁倒计时）
   * ------------------------------------------------------------------ */
  function drawPaddle(ctx) {
    var x = S.paddle.x, y = CFG.PADDLE_Y, w = S.paddle.w, h = CFG.PADDLE_H;
    // v10.1：挡板恒为浅绿，强化时颜色不变（倒计时在挡板内部显示）
    ctx.save();
    if (isLight()) {
      ctx.save();
      ctx.fillStyle = UI().shadow;
      roundRect(ctx, x + 2.5, y + 3, w, h, h / 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.shadowColor = 'rgba(124,235,170,0.5)';
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = vGrad(ctx, x, y, h, PAL.paddle.top, PAL.paddle.bottom);
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (isLight()) {
      ctx.strokeStyle = UI().cardBorder; ctx.lineWidth = 2;
      roundRect(ctx, x, y, w, h, h / 2); ctx.stroke();
    }
    ctx.restore();

    // 挡板中心亮条
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    roundRect(ctx, x + 6, y + 2.5, Math.max(8, w - 12), 3.5, 2);
    ctx.fill();
  }

  /* ------------------------------------------------------------------ *
   * v10.1：挡板强化倒计时——小字号显示在挡板内部中心（颜色不变）
   * ------------------------------------------------------------------ */
  function drawPaddleBoost(ctx) {
    // v10.31：挡板加强倒计时移至大方框下方状态栏显示，挡板内部不再绘制
  }

  /* ------------------------------------------------------------------ *
   * v10.31：大方框下方左侧——道具生效状态栏
   * [运动小球数 · N] [挡板加强 · Xs] [墙体隐藏 · Xs]
   * ------------------------------------------------------------------ */
  function drawBuffStatus(ctx) {
    if (S.phase !== Game.PHASE.PLAY) return;   // READY 态避开居中的手指引导文案
    var u = UI();
    var items = [{ label: '运动小球数', val: String(S.balls.length), col: isLight() ? '#59C3F0' : '#7ED8F7' }];
    if (S.paddleBoost > 0) items.push({ label: '挡板加强', val: Math.ceil(S.paddleBoost) + 's', col: isLight() ? '#8FD98A' : '#7CF5C8' });
    if (S.wallGhost > 0) items.push({ label: '墙体隐藏', val: Math.ceil(S.wallGhost) + 's', col: isLight() ? '#B9C4E8' : '#C9B6FF' });
    var x = 14, y = CFG.ARENA_BOTTOM + 16;
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.font = '600 9.5px -apple-system, "PingFang SC", sans-serif';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      ctx.textAlign = 'left';
      ctx.fillStyle = u.textOnCardSub;
      ctx.fillText(it.label, x, y);
      x += ctx.measureText(it.label).width + 3;
      ctx.fillStyle = it.col;
      ctx.beginPath(); ctx.arc(x + 2.5, y, 2.5, 0, 6.283); ctx.fill();
      x += 8;
      ctx.fillStyle = u.textOnCard;
      ctx.font = '800 10px -apple-system, sans-serif';
      ctx.fillText(it.val, x, y);
      x += ctx.measureText(it.val).width + 10;
      ctx.font = '600 9.5px -apple-system, "PingFang SC", sans-serif';
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * 弹道预测（v2：已按需求删掉挡板→手指的瞄准虚线，只保留点列）
   * ------------------------------------------------------------------ */
  function drawAim(ctx) {
    if (!S.aim.active || S.phase !== Game.PHASE.PLAY) return;
    var o = Game.paddleCenter();
    var path = S.aim.path;
    // v2 高密度地图下「能否直穿缺口」几乎恒为否，预测价值在「能否命中可消方块」
    // v10.3：可命中=绿、不可命中=粉；线条更细
    var ok = !path || !path.pts || path.hit;
    var main = ok ? PAL.aimOk : PAL.aimNo;
    var dotCol = ok ? (isLight() ? '47,158,91' : '124,245,200') : (isLight() ? '255,107,157' : '255,143,184');
    ctx.save();

    // 手指锚点
    ctx.beginPath();
    ctx.arc(S.aim.x, S.aim.y, 5, 0, 6.283);
    ctx.strokeStyle = main;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(S.aim.x, S.aim.y, 12, 0, 6.283);
    ctx.strokeStyle = ok ? (isLight() ? 'rgba(47,158,91,0.3)' : 'rgba(124,245,200,0.28)') : (isLight() ? 'rgba(255,107,157,0.3)' : 'rgba(255,143,184,0.28)');
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // ② 预测弹道（渐隐点列）
    if (path && path.pts && path.pts.length >= 4) {
      var pts = path.pts;
      var segs = pts.length / 2 - 1;
      for (var i = 0; i < segs; i++) {
        var x0 = pts[i * 2], y0 = pts[i * 2 + 1];
        var x1 = pts[i * 2 + 2], y1 = pts[i * 2 + 3];
        var len = Math.hypot(x1 - x0, y1 - y0);
        var steps = Math.max(2, Math.floor(len / 9));
        for (var k = 0; k < steps; k++) {
          var t = k / steps;
          var px = x0 + (x1 - x0) * t;
          var py = y0 + (y1 - y0) * t;
          var alpha = (1 - i / segs) * 0.78 + 0.12;
          ctx.beginPath();
          ctx.arc(px, py, 1.4, 0, 6.283);
          ctx.fillStyle = 'rgba(' + dotCol + ',' + alpha.toFixed(3) + ')';
          ctx.fill();
        }
      }
      // 首个命中点标记
      if (path.hit) {
        ctx.beginPath();
        ctx.arc(path.hit.x, path.hit.y, 11, 0, 6.283);
        ctx.strokeStyle = main;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(path.hit.x, path.hit.y, 16, 0, 6.283);
        ctx.strokeStyle = ok ? (isLight() ? 'rgba(47,158,91,0.3)' : 'rgba(124,245,200,0.3)') : (isLight() ? 'rgba(255,107,157,0.3)' : 'rgba(255,143,184,0.3)');
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
      // 未能穿缺口：在撞墙点画 lucide x 图标
      if (!ok && path.wallPt) {
        var wx = path.wallPt.x, wy = path.wallPt.y;
        Icons.drawIcon(ctx, 'x', wx - 8, wy - 8, 16, { stroke: PAL.aimNo, lineWidth: 2.4 });
      }
    }

    // 角度读数 + 命中提示
    var ang = Math.atan2(S.aim.dx, -S.aim.dy) * 180 / Math.PI;
    ctx.font = '600 10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = ok ? PAL.aimOk : PAL.aimNo;
    ctx.fillText((ang >= 0 ? '+' : '') + ang.toFixed(0) + '°' + (ok ? ' 可命中' : ' 无命中(慎发)'),
      o.x, CFG.PADDLE_Y + 28);

    ctx.restore();
  }

  /** v10：待发射小球（挡板中心）；v10.1：首次发射后即消失；灰底+绿边框+绿阴影 */
  function drawRestBall(ctx) {
    if (S.phase !== Game.PHASE.PLAY && S.phase !== Game.PHASE.READY) return;
    if (S.shotsLeft <= 0) return;
    if (S.launched > 0) return;   // 发射之后不再显示待发射球
    var u = UI();
    var o = Game.paddleCenter();
    var r = CFG.BALL_R;   // v10.5：与飞行球同尺寸
    var cy = o.y - CFG.PADDLE_H / 2 - r - 1;
    ctx.save();
    ctx.shadowColor = PAL.ball.glow;
    ctx.shadowBlur = 10;
    var g = ctx.createRadialGradient(o.x - r * 0.3, cy - r * 0.35, r * 0.15, o.x, cy, r);
    g.addColorStop(0, '#F2F4F6');
    g.addColorStop(0.6, '#C6CBD3');
    g.addColorStop(1, '#9AA1AC');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(o.x, cy, r, 0, 6.283);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = u.good;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(o.x, cy, r, 0, 6.283);
    ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * 小球
   * ------------------------------------------------------------------ */
  function drawBalls(ctx) {
    var u = UI();
    for (var i = 0; i < S.balls.length; i++) {
      var b = S.balls[i];
      // 拖尾
      for (var t = 0; t < b.trail.length; t += 2) {
        var k = t / b.trail.length;
        ctx.beginPath();
        ctx.arc(b.trail[t], b.trail[t + 1], b.r * (0.25 + 0.6 * k), 0, 6.283);
        ctx.fillStyle = PAL.ball.trail.replace(/[\d.]+\)$/, (0.22 * k).toFixed(3) + ')');
        ctx.fill();
      }
      // v10.1：灰底小球 + 绿边框 + 绿色阴影
      ctx.save();
      ctx.shadowColor = PAL.ball.glow;
      ctx.shadowBlur = 10;
      var g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.15, b.x, b.y, b.r);
      g.addColorStop(0, '#F2F4F6');
      g.addColorStop(0.6, '#C6CBD3');
      g.addColorStop(1, '#9AA1AC');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, 6.283);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = u.good;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, 6.283);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------------ *
   * 粒子 & 飘字
   * ------------------------------------------------------------------ */
  function drawParticles(ctx) {
    for (var i = 0; i < S.particles.length; i++) {
      var p = S.particles[i];
      var a = 1 - p.t / p.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5 * a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, 6.283);
        ctx.stroke();
      } else if (p.kind === 'rect') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * a);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, 6.283);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 12px -apple-system, "PingFang SC", sans-serif';
    for (var j = 0; j < S.popups.length; j++) {
      var q = S.popups[j];
      var al = 1 - q.t / q.life;
      ctx.globalAlpha = Math.max(0, al);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillText(q.text, q.x + 1, q.y + 1);
      ctx.fillStyle = q.color;
      ctx.fillText(q.text, q.x, q.y);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * v10.17：大方框居中提示栈（统一组件重构）——飘字提示 + 常驻引导文案，
   * 全部使用药丸胶囊样式；常驻文案带呼吸闪烁
   * ------------------------------------------------------------------ */
  function drawMsgs(ctx) {
    var hint = getPersistentHint();
    var breath = 0.5 + 0.5 * Math.sin(S.time * 2.6);
    var list = [];
    if (hint) list.push({ text: hint, alpha: 0.72 + 0.28 * breath });   // v10.19：呼吸更柔和，最暗仍清晰可见
    for (var i = 0; i < S.msgs.length; i++) {
      var m = S.msgs[i];
      var k = m.t / m.life;
      var alpha = k < 0.15 ? k / 0.15 : (k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1);
      list.push({ text: m.text, alpha: alpha });
    }
    if (!list.length) return;
    var baseY = CFG.ARENA_TOP + CFG.ARENA_H / 2;
    var lineH = 40;
    for (var j = 0; j < list.length; j++) {
      var y = baseY + (j - (list.length - 1) / 2) * lineH;
      drawToastPill(ctx, list[j].text, y, list[j].alpha);
    }
  }

  /* ------------------------------------------------------------------ *
   * 连击 & 状态提示
   * ------------------------------------------------------------------ */
  function drawCombo(ctx) {
    if (S.combo < 2 || S.phase !== Game.PHASE.PLAY) return;
    var u = UI();
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = '800 22px -apple-system, sans-serif';
    var a = 0.55 + 0.45 * Math.abs(Math.sin(S.time * 6));
    ctx.fillStyle = isLight()
      ? 'rgba(245,166,35,' + a.toFixed(2) + ')'
      : 'rgba(255,224,122,' + a.toFixed(2) + ')';
    ctx.fillText('x' + S.combo, CFG.W - 16, CFG.ARENA_BOTTOM + 34);
    ctx.font = '500 9px -apple-system, sans-serif';
    ctx.fillStyle = u.textOnCardSub;
    ctx.fillText('COMBO', CFG.W - 16, CFG.ARENA_BOTTOM + 47);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * 结算浮层
   * ------------------------------------------------------------------ */
  function drawOverlay(ctx) {
    if (S.phase !== Game.PHASE.WIN && S.phase !== Game.PHASE.LOSE) return;
    var win = S.phase === Game.PHASE.WIN;
    var u = UI();
    ctx.save();
    ctx.fillStyle = u.dim;
    ctx.fillRect(0, 0, CFG.W, CFG.H);

    var bw = 280, bh = 330, bx = (CFG.W - bw) / 2, by = (CFG.H - bh) / 2 - 10;
    if (isLight()) { hardShadow(ctx, bx, by, bw, bh, 22, 6, 8); ctx.fillStyle = u.modalBg; }
    else ctx.fillStyle = u.modalBg;
    roundRect(ctx, bx, by, bw, bh, 22);
    ctx.fill();
    cardStroke(ctx, bx, by, bw, bh, 22);

    ctx.textAlign = 'center';
    ctx.font = '900 24px -apple-system, "PingFang SC", sans-serif';
    var title = win ? '通关成功' : (S.timeout ? '时间到！挑战失败' : (S.shotsLeft <= 0 && S.destroyed < S.totalBricks ? '弹药用尽' : '全部漏接'));
    if (isLight()) strokeText8(ctx, title, CFG.W / 2, by + 46, u.ink, win ? '#ffffff' : '#ffe3e0', 2);
    else {
      var tg = ctx.createLinearGradient(0, by + 24, 0, by + 50);
      tg.addColorStop(0, '#FFF7EF'); tg.addColorStop(1, win ? u.accent : '#FF8A7A');
      ctx.fillStyle = tg; ctx.fillText(title, CFG.W / 2, by + 46);
    }

    // 星星（v10.23：下方标注每档阈值分数）
    var res = S.lastResult || { stars: 0 };
    var bd0 = res.breakdown;
    var th0 = (bd0 && bd0.starScores) || S.level.starScores || null;
    for (var i = 0; i < 3; i++) {
      var sx = CFG.W / 2 + (i - 1) * 44, sy = by + 80;
      drawStar(ctx, sx, sy, i < res.stars ? u.star : (isLight() ? 'rgba(74,63,53,0.18)' : 'rgba(255,255,255,0.16)'), 17);
      if (th0) {
        ctx.save();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '600 9px -apple-system, sans-serif';
        ctx.fillStyle = i < res.stars ? u.star : u.textOnCardSub;
        ctx.fillText('' + th0[i], sx, sy + 24);   // v10.31：仅显示数字阈值
        ctx.restore();
      }
    }

    // v5 需求①：结算把星数换算成钻石计入钱包
    ctx.textAlign = 'center';
    ctx.font = '600 11.5px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = u.gemInk;
    var gemStroke = isLight() ? '#123a4a' : '#7CF5C8';
    var gemFill = isLight() ? 'rgba(126,216,247,0.5)' : 'rgba(124,245,200,0.22)';
    Icons.richText(ctx, ['获得 ', { icon: 'gem', size: 12, stroke: gemStroke, fill: gemFill, gapR: 2 },
      ' ' + (res.diamondsGained || 0) + '  ·  钱包 ' + (res.diamonds || 0) + ' 钻'], CFG.W / 2, by + 118);

    ctx.font = '500 11px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = u.textOnCardSub;
    // v3：胜局展示总分明细（消除/剩余球/连击/耗时），败局展示统计
    var bd = res.breakdown;
    if (win && bd) {
      ctx.textAlign = 'center';
      ctx.fillStyle = u.textOnCardSub;
      ctx.font = '500 11px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText('总分', CFG.W / 2, by + 134);
      ctx.fillStyle = u.star;
      ctx.font = '900 28px -apple-system, sans-serif';
      ctx.fillText(String(res.score || 0), CFG.W / 2, by + 160);
      var rows = [
        ['消除得分', String(bd.inPlay)],
        ['剩余球 ×' + bd.remaining, '+' + bd.shotBonus],
        ['最大连击 ×' + bd.maxCombo, '+' + bd.comboBonus],
        [['耗时 ' + Math.floor(bd.elapsed) + 's'], '+' + bd.timeBonus]
      ];
      ctx.strokeStyle = isLight() ? 'rgba(74,63,53,0.18)' : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(bx + 26, by + 172); ctx.lineTo(bx + bw - 26, by + 172); ctx.stroke();
      ctx.setLineDash([]);
      for (var k = 0; k < rows.length; k++) {
        var yy = by + 190 + k * 19;
        ctx.textAlign = 'left';
        ctx.fillStyle = u.textOnCardSub;
        ctx.font = '500 11px -apple-system, "PingFang SC", sans-serif';
        if (typeof rows[k][0] === 'string') ctx.fillText(rows[k][0], bx + 32, yy);
        else Icons.richText(ctx, rows[k][0], bx + 32, yy);
        ctx.textAlign = 'right';
        ctx.fillStyle = String(rows[k][1]).charAt(0) === '+' ? u.good : u.textOnCard;
        ctx.font = '700 12px -apple-system, sans-serif';
        ctx.fillText(rows[k][1], bx + bw - 32, yy);
      }
    } else {
      var secs = res.elapsed || 0;
      var rows2 = [
        ['得分', String(res.score || 0)],
        ['通关耗时', Math.floor(secs / 60) + ':' + String(Math.floor(secs % 60)).padStart(2, '0')],
        ['消除方块', (res.destroyed || 0) + ' / ' + (res.total || 0)],
        ['最大回弹', 'x' + (res.maxChain || 0)],
        ['剩余生命', String(res.shotsLeft || 0)]   // v10.31：文案调整
      ];
      for (var m = 0; m < rows2.length; m++) {
        var y2 = by + 140 + m * 22;
        ctx.textAlign = 'left';
        ctx.fillStyle = u.textOnCardSub;
        ctx.font = '500 11px -apple-system, "PingFang SC", sans-serif';
        ctx.fillText(rows2[m][0], bx + 34, y2);
        ctx.textAlign = 'right';
        ctx.fillStyle = u.textOnCard;
        ctx.font = '700 13px -apple-system, sans-serif';
        ctx.fillText(rows2[m][1], bx + bw - 34, y2);
      }
    }

    // 按钮（v10.31：败局左钮改"回到主页"——与"重新挑战"语义重复）
    var btnY = by + bh - 52;
    if (win) {
      S._btnRetry = dialogButton(ctx, '重玩本关', bx + 26, btnY, 106, 38, u.btnGhost, u.textOnCard, { name: 'replay', size: 14, color: u.textOnCard });
    } else {
      S._btnRetry = dialogButton(ctx, '回到主页', bx + 26, btnY, 106, 38, u.btnGhost, u.textOnCard, { name: 'home', size: 14, color: u.textOnCard });
    }
    S._btnNext = dialogButton(ctx, win ? '下一关' : '重新挑战', bx + bw - 132, btnY, 106, 38, u.accent, u.accentInk, { name: 'play', size: 13, color: u.accentInk, fill: u.accentInk });

    ctx.restore();
  }

  function drawStar(ctx, cx, cy, color, R) {
    // 统一改用 lucide star 矢量图标（实心：fill 与 stroke 同色）
    Icons.drawIcon(ctx, 'star', cx - R, cy - R, R * 2, { fill: color, stroke: color });
  }

  function easeOutBack(t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  /* ------------------------------------------------------------------ *
   * v5 需求②：底部主动道具栏 + 钻石钱包
   * ------------------------------------------------------------------ */
  function drawDiamondIcon(ctx, cx, cy, s, color) {
    // 统一改用 lucide gem 矢量图标（钻石钱包）
    Icons.drawIcon(ctx, 'gem', cx - s, cy - s, s * 2, { stroke: color || '#8FE3FF', fill: 'rgba(143,227,255,0.22)' });
  }

  function propBtnLayout() {
    var order = PROPS.order, n = order.length;
    var total = n * CFG.PROP_BAR_W + (n - 1) * CFG.PROP_BAR_GAP;
    var startX = (CFG.W - total) / 2;
    var arr = [];
    for (var i = 0; i < n; i++) {
      arr.push({
        key: order[i],
        x: startX + i * (CFG.PROP_BAR_W + CFG.PROP_BAR_GAP),
        y: CFG.PROP_BAR_Y, w: CFG.PROP_BAR_W, h: CFG.PROP_BAR_H
      });
    }
    return arr;
  }

  function drawPropBar(ctx) {
    var rects = propBtnLayout();
    S._propBtns = rects;                         // main 命中测试复用，单一布局来源
    var u = UI();
    ctx.save();
    // 钻石余额（道具栏上方居中）
    ctx.textBaseline = 'middle';
    ctx.font = '700 15px -apple-system, sans-serif';
    var dTxt = String(S.diamonds);
    var tw = ctx.measureText(dTxt).width;
    var cx0 = CFG.W / 2 - (tw + 16) / 2;
    drawDiamondIcon(ctx, cx0, CFG.PROP_BAR_Y - 16, 7.5, isLight() ? '#123a4a' : '#7CF5C8');
    ctx.textAlign = 'left';
    ctx.fillStyle = u.gemInk;
    ctx.fillText(dTxt, cx0 + 12, CFG.PROP_BAR_Y - 16);

    var tints = [u.tintPink, u.tintBlue, u.tintGreen];
    for (var i = 0; i < rects.length; i++) {
      var rc = rects[i], meta = PROPS[rc.key], cnt = Game.getPropCount(rc.key);
      var usable = cnt > 0;
      if (isLight()) {
        hardShadow(ctx, rc.x, rc.y, rc.w, rc.h, 12, 2.5, 3);
        ctx.fillStyle = usable ? tints[i % 3] : '#F3EBDD';
      } else {
        ctx.fillStyle = usable ? tints[i % 3] : 'rgba(255,255,255,0.05)';
      }
      roundRect(ctx, rc.x, rc.y, rc.w, rc.h, 12);
      ctx.fill();
      cardStroke(ctx, rc.x, rc.y, rc.w, rc.h, 12);
      // 图标
      ctx.save();
      if (!usable) ctx.globalAlpha = 0.45;
      var isz = 28, ix = rc.x + (rc.w - isz) / 2, iy = rc.y + 9;
      if (rc.key === 'splitAll') drawSplit3(ctx, ix, iy, isz, isz);
      else if (rc.key === 'wallHide') drawGhost(ctx, ix, iy, isz, isz);
      else drawPaddlePow(ctx, ix, iy, isz, isz);
      ctx.restore();
      // 名称
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      ctx.fillStyle = usable ? u.textOnCard : u.textOnCardSub;
      ctx.font = '600 11px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText(meta.name, rc.x + rc.w / 2, rc.y + rc.h - 9);
      // 数量角标
      var bx = rc.x + rc.w - 13, byy = rc.y + 13;
      ctx.beginPath(); ctx.arc(bx, byy, 10, 0, 6.283);
      ctx.fillStyle = usable ? u.accent : (isLight() ? '#e0b9b9' : '#B0342E'); ctx.fill();
      if (isLight()) { ctx.strokeStyle = u.cardBorder; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.fillStyle = usable ? u.accentInk : '#fff'; ctx.textBaseline = 'middle';
      ctx.font = '700 11px -apple-system, sans-serif';
      ctx.fillText(String(cnt), bx, byy + 0.5);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * v5 需求③：主页 / 暂停弹窗 / 购买弹窗
   * ------------------------------------------------------------------ */
  function modalPanel(ctx, bw, bh) {
    var u = UI();
    var bx = (CFG.W - bw) / 2, by = (CFG.H - bh) / 2 - 10;
    ctx.fillStyle = u.dim;
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    if (isLight()) {
      hardShadow(ctx, bx, by, bw, bh, 22, 6, 8);
      ctx.fillStyle = u.modalBg;
    } else {
      ctx.fillStyle = u.modalBg;
    }
    roundRect(ctx, bx, by, bw, bh, 22);
    ctx.fill();
    cardStroke(ctx, bx, by, bw, bh, 22);
    return { bx: bx, by: by };
  }

  function dialogButton(ctx, label, x, y, w, h, fill, txtCol, icon?) {
    if (isLight()) {
      hardShadow(ctx, x, y, w, h, 22, 3, 4);
    }
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, w, h, 22);
    ctx.fill();
    if (isLight()) {
      ctx.strokeStyle = UI().cardBorder; ctx.lineWidth = 2;
      roundRect(ctx, x, y, w, h, 22); ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 22);
      ctx.stroke();
    }
    ctx.fillStyle = txtCol;
    ctx.font = '700 15px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (icon) {
      Icons.richText(ctx, [{ icon: icon.name, size: icon.size || 16, stroke: icon.color || txtCol, fill: icon.fill || false, gapR: 7 }, label],
        x + w / 2, y + h / 2 + 0.5);
    } else {
      ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
    }
    return { x: x, y: y, w: w, h: h };
  }

  function drawHome(ctx) {
    var W = CFG.W, H = CFG.H;
    var u = UI();
    var prog = (global.Storage && global.Storage.read()) || {};
    var settings = (global.Settings && global.Settings.read()) || {};
    var nickname = settings.nickname || '玩家';
    var LEVELS = global.TT.LEVELS;
    var PROPS = global.TT.PROPS;
    // Find first unplayed level (no stars)
    var firstUn = LEVELS.length;
    for (var i = 0; i < LEVELS.length; i++) {
      var p = prog['lv' + i];
      if (!p || !p.stars) { firstUn = i; break; }
    }

    ctx.save();

    // ===== 顶栏（v10.10）：与微信胶囊同一行垂直居中；左=玩家信息+设置，右=钻石 =====
    var ucy = CFG.CAP_CY - 18, uch = 36;
    var ucw = 118;
    if (isLight()) { hardShadow(ctx, 12, ucy, ucw, uch, 18, 2.5, 3); ctx.fillStyle = u.card; }
    else ctx.fillStyle = u.card;
    roundRect(ctx, 12, ucy, ucw, uch, 18); ctx.fill();
    cardStroke(ctx, 12, ucy, ucw, uch, 18);
    var avx = 12 + 18, avy = ucy + 18;
    ctx.beginPath(); ctx.arc(avx, avy, 13, 0, 6.283);
    if (isLight()) { ctx.fillStyle = u.accent; ctx.fill(); ctx.strokeStyle = u.cardBorder; ctx.lineWidth = 1.6; ctx.stroke(); }
    else {
      var ag = ctx.createRadialGradient(avx - 4, avy - 4, 2, avx, avy, 13);
      ag.addColorStop(0, '#FFD9C9'); ag.addColorStop(1, '#E97F63');
      ctx.fillStyle = ag; ctx.fill();
    }
    Icons.drawIcon(ctx, 'user', avx - 7, avy - 7, 14, { stroke: isLight() ? u.accentInk : '#FFFFFF', lineWidth: 2 });
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '700 13px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = u.textOnCard;
    ctx.fillText(nickname, avx + 18, ucy + uch / 2);
    // 设置圆钮（紧跟玩家胶囊右侧）
    var sbx = 12 + ucw + 8;
    if (isLight()) { hardShadow(ctx, sbx, ucy, 36, 36, 18, 2.5, 3); }
    ctx.beginPath(); ctx.arc(sbx + 18, ucy + 18, 18, 0, 6.283);
    ctx.fillStyle = u.card; ctx.fill();
    cardStrokeCircle(ctx, sbx + 18, ucy + 18, 18);
    Icons.drawIcon(ctx, 'settings', sbx + 9, ucy + 9, 18, { stroke: u.textOnCard, lineWidth: 2 });
    S._btnSettings = { x: sbx, y: ucy, w: 36, h: 36 };
    // v10.11：顶栏钻石胶囊移除（宝石信息移入商店卡头部）

    // ===== 大标题（v10.13：上边距再加大） =====
    var titleY = CFG.CAP_BOTTOM + 58;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '900 26px -apple-system, "PingFang SC", sans-serif';
    if (isLight()) {
      ctx.save();
      ctx.fillStyle = 'rgba(74,63,53,0.35)';
      ctx.fillText('疯狂小球弹一弹', W / 2, titleY + 5);
      ctx.restore();
      strokeText8(ctx, '疯狂小球弹一弹', W / 2, titleY, u.ink, '#ffffff', 2);
    } else {
      var tg = ctx.createLinearGradient(0, titleY - 24, 0, titleY + 4);
      tg.addColorStop(0, '#FFF3E0'); tg.addColorStop(0.55, '#FFB199'); tg.addColorStop(1, '#FF8FB8');
      ctx.save();
      ctx.shadowColor = 'rgba(255,143,184,0.45)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
      ctx.fillStyle = tg;
      ctx.fillText('疯狂小球弹一弹', W / 2, titleY);
      ctx.restore();
    }

    // ===== 商店卡（v10.15：下移增大标题下边距+加高增大上下内边距） =====
    var shx = 14, shy = CFG.CAP_BOTTOM + 82, shw = W - 28, shh = 110;   // v10.24c：再变矮一点
    if (isLight()) { hardShadow(ctx, shx, shy, shw, shh, 16, 3, 4); ctx.fillStyle = u.card; }
    else ctx.fillStyle = u.card;
    roundRect(ctx, shx, shy, shw, shh, 16); ctx.fill();
    cardStroke(ctx, shx, shy, shw, shh, 16);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    // 【商店】标签：字号加大 + 黄底块 + 右下硬阴影
    var shLabel = '商店';
    ctx.font = '900 13px -apple-system, "PingFang SC", sans-serif';
    var slw = ctx.measureText(shLabel).width + 14;
    if (isLight()) { ctx.save(); ctx.fillStyle = u.shadow; roundRect(ctx, shx + 10 + 2, shy + 13 + 2.5, slw, 20, 6); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = u.accent;
    roundRect(ctx, shx + 10, shy + 13, slw, 20, 6); ctx.fill();
    if (isLight()) { ctx.strokeStyle = u.cardBorder; ctx.lineWidth = 1.3; roundRect(ctx, shx + 10, shy + 13, slw, 20, 6); ctx.stroke(); }
    ctx.textAlign = 'center';
    ctx.fillStyle = u.accentInk;
    ctx.fillText(shLabel, shx + 10 + slw / 2, shy + 23.5);
    ctx.textAlign = 'left';
    ctx.font = '800 13px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = u.textOnCard;
    ctx.fillText('道具补给站', shx + 10 + slw + 7, shy + 23);
    // 头部右侧：宝石 ICON + 数字
    ctx.textAlign = 'right';
    ctx.font = '800 14px -apple-system, sans-serif';
    ctx.fillStyle = u.gemInk;
    Icons.richText(ctx, [{ icon: 'gem', size: 14, stroke: isLight() ? '#123a4a' : '#7CF5C8', fill: isLight() ? 'rgba(126,216,247,0.5)' : 'rgba(124,245,200,0.25)', gapR: 4 }, '' + S.diamonds], shx + shw - 12, shy + 23);
    var tints = [u.tintPink, u.tintBlue, u.tintGreen];
    var buyCols = ['#FF8FB2', '#59C3F0', '#8FD98A'];
    var iconDraw = [drawSplit3, drawGhost, drawPaddlePow];
    var iw = (shw - 24 - 20) / 3, ih = 58, iy0 = shy + 42;   // v10.24c：内容区再收紧
    S._homePropRects = [];
    for (var pi = 0; pi < PROPS.order.length; pi++) {
      var pkey = PROPS.order[pi], pmeta = PROPS[pkey];
      var px = shx + 12 + pi * (iw + 10);
      var cnt = Game.getPropCount(pkey);
      ctx.fillStyle = tints[pi];
      roundRect(ctx, px, iy0, iw, ih, 10); ctx.fill();
      if (isLight()) { ctx.strokeStyle = u.cardBorder; ctx.lineWidth = 1.5; roundRect(ctx, px, iy0, iw, ih, 10); ctx.stroke(); }
      iconDraw[pi](ctx, px + iw / 2 - 11, iy0 + 8, 22, 22);   // v10.26：图标缩小 24→22
      // v10.24：删除道具名文案（点击弹窗已有详情）
      // 醒目购买钮（胶囊实底，v10.12：文字统一白色）
      var bw2 = 56, bh2 = 17, bx2 = px + iw / 2 - bw2 / 2, by2 = iy0 + 33;   // v10.26：购买钮上移
      if (isLight()) { ctx.save(); ctx.fillStyle = u.shadow; roundRect(ctx, bx2 + 1.5, by2 + 2, bw2, bh2, 8); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = buyCols[pi];
      roundRect(ctx, bx2, by2, bw2, bh2, 8); ctx.fill();
      if (isLight()) { ctx.strokeStyle = u.cardBorder; ctx.lineWidth = 1.3; roundRect(ctx, bx2, by2, bw2, bh2, 8); ctx.stroke(); }
      ctx.font = '800 10px -apple-system, "PingFang SC", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      Icons.richText(ctx, [{ icon: 'gem', size: 9, stroke: '#ffffff', fill: 'rgba(255,255,255,0.4)', gapR: 2 }, pmeta.cost + ' 购买'], px + iw / 2, by2 + bh2 / 2 + 0.5);
      // 数量角标（右上偏移胶囊 ×N）
      var cntTxt = '×' + cnt;
      ctx.font = '800 10px -apple-system, sans-serif';
      var cw2 = ctx.measureText(cntTxt).width + 10;
      var ccx = px + iw - 4 - cw2 / 2, ccy = iy0 - 2;
      if (isLight()) { ctx.save(); ctx.fillStyle = u.shadow; roundRect(ctx, ccx - cw2 / 2 + 1.5, ccy - 8 + 2, cw2, 16, 8); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = u.accent;
      roundRect(ctx, ccx - cw2 / 2, ccy - 8, cw2, 16, 8); ctx.fill();
      if (isLight()) { ctx.strokeStyle = u.cardBorder; ctx.lineWidth = 1.4; roundRect(ctx, ccx - cw2 / 2, ccy - 8, cw2, 16, 8); ctx.stroke(); }
      ctx.fillStyle = u.accentInk;
      ctx.textAlign = 'center';
      ctx.fillText(cntTxt, ccx, ccy + 0.5);
      S._homePropRects.push({ x: px, y: iy0, w: iw, h: ih, key: pkey });
    }

    // ===== 关卡区（v10.24b：商店卡变矮，标题行随之上移保持间距） =====
    var gridTop = CFG.CAP_BOTTOM + 224, gridBot = H - 44;
    var gridW = W - 28;
    var marginX = (W - gridW) / 2;
    var doneCount = 0;
    for (var di = 0; di < LEVELS.length; di++) {
      var dp = prog['lv' + di];
      if (dp && dp.stars > 0) doneCount++;
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '800 14px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = u.textOnCard;
    ctx.fillText('关卡列表', marginX, gridTop);
    ctx.font = '800 12px -apple-system, sans-serif';
    ctx.fillStyle = isLight() ? u.inkMute : u.star;
    ctx.textAlign = 'right';
    ctx.fillText('(' + doneCount + '/' + LEVELS.length + ')', marginX + gridW, gridTop);
    gridTop += 10;
    var gridH = gridBot - gridTop;
    var cols = 4, gap = 8;
    var cellW = (gridW - (cols - 1) * gap) / cols;
    var cellH = 72;
    var totalItems = LEVELS.length;
    var totalRows = Math.ceil(totalItems / cols);
    var totalGridH = totalRows * (cellH + gap) + gap;
    var maxScroll = Math.max(0, totalGridH - gridH);
    S.homeScroll = Math.max(0, Math.min(maxScroll, S.homeScroll || 0));

    ctx.save();
    ctx.beginPath(); ctx.rect(marginX - 4, gridTop, gridW + 8, gridH); ctx.clip();
    var scroll = S.homeScroll || 0;
    S._homeRects = [];
    for (var gi = 0; gi < totalItems; gi++) {
      var lv = LEVELS[gi];
      var row = Math.floor(gi / cols), col = gi % cols;
      var cx0 = marginX + col * (cellW + gap);
      var cy0 = gridTop + gap + row * (cellH + gap) - scroll;
      if (cy0 + cellH < gridTop - 10 || cy0 > gridBot + 10) {
        S._homeRects.push(null); continue;
      }
      var pr = prog['lv' + gi];
      var done = pr && pr.stars > 0;
      var isCur = !done && (gi === firstUn);
      var locked = !done && !isCur && (gi > firstUn);

      if (isLight()) {
        // v10.2：所有关卡卡加硬阴影
        hardShadow(ctx, cx0, cy0, cellW, cellH, 12, 2.5, 3);
        if (isCur) ctx.fillStyle = u.accent;
        else if (done) ctx.fillStyle = u.tintGreen;
        else ctx.fillStyle = locked ? '#F3EBDD' : u.card;
      } else {
        if (isCur) ctx.fillStyle = vGrad(ctx, cx0, cy0, cellH, 'rgba(255,224,138,0.88)', 'rgba(255,177,153,0.6)');
        else if (done) ctx.fillStyle = u.tintGreen;
        else ctx.fillStyle = locked ? 'rgba(255,255,255,0.04)' : u.card;
      }
      roundRect(ctx, cx0, cy0, cellW, cellH, 12);
      ctx.fill();
      cardStroke(ctx, cx0, cy0, cellW, cellH, 12);

      ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.font = '900 24px -apple-system, sans-serif';
      ctx.globalAlpha = locked ? 0.45 : 1;
      ctx.fillStyle = isCur ? (isLight() ? u.accentInk : '#4A2E10') : (done ? u.textOnCard : u.textOnCardSub);
      ctx.fillText(String(lv.id), cx0 + cellW / 2, cy0 + 24);
      ctx.globalAlpha = 1;

      if (done) {
        var starSize = 13, starGap = 3;
        var starsW = 3 * starSize + 2 * starGap;
        var sx0 = cx0 + cellW / 2 - starsW / 2;
        for (var sk = 0; sk < 3; sk++) {
          var lit = sk < pr.stars;
          Icons.drawIcon(ctx, 'star', sx0 + sk * (starSize + starGap), cy0 + 50 - starSize / 2, starSize,
            lit ? { fill: u.star, stroke: u.star } : { stroke: isLight() ? 'rgba(74,63,53,0.3)' : 'rgba(255,255,255,0.35)' });
        }
      } else if (locked) {
        // v10.15：去掉圆形边框，仅保留实心锁（锁梁+锁身+钥匙孔）
        var lcx = cx0 + cellW / 2, lcy = cy0 + 50;
        var lk = isLight() ? '#8a7a63' : 'rgba(255,255,255,0.65)';
        ctx.strokeStyle = lk; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(lcx, lcy - 2, 5.2, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = lk;
        roundRect(ctx, lcx - 7.5, lcy - 2, 15, 11, 3); ctx.fill();
        ctx.fillStyle = isLight() ? '#F3EBDD' : 'rgba(34,24,71,0.9)';
        ctx.beginPath(); ctx.arc(lcx, lcy + 3.2, 1.9, 0, 6.283); ctx.fill();
      } else {
        // v10.12：【立即开始】Button：无图标、字号加大、更深背景
        var btnTxt = '立即开始';
        ctx.font = '800 11px -apple-system, "PingFang SC", sans-serif';
        var bw3 = ctx.measureText(btnTxt).width + 18;
        var bh3 = 20;
        var bx3 = cx0 + cellW / 2 - bw3 / 2, by3 = cy0 + 50 - bh3 / 2;
        if (isLight()) { ctx.save(); ctx.fillStyle = u.shadow; roundRect(ctx, bx3 + 1.5, by3 + 2, bw3, bh3, 10); ctx.fill(); ctx.restore(); }
        ctx.fillStyle = isLight() ? '#F5A623' : 'rgba(240,185,74,0.95)';
        roundRect(ctx, bx3, by3, bw3, bh3, 10); ctx.fill();
        if (isLight()) { ctx.strokeStyle = u.cardBorder; ctx.lineWidth = 1.4; roundRect(ctx, bx3, by3, bw3, bh3, 10); ctx.stroke(); }
        ctx.fillStyle = isLight() ? '#ffffff' : '#4A2E10';
        ctx.fillText(btnTxt, cx0 + cellW / 2, by3 + bh3 / 2 + 0.5);
      }

      S._homeRects.push({ x: cx0, y: cy0, w: cellW, h: cellH, index: gi, locked: locked });
    }
    ctx.restore(); // remove clip

    // Scrollbar thumb
    if (totalGridH > gridH) {
      var trackH2 = gridH - 16;
      var thumbH2 = Math.max(18, gridH / totalGridH * trackH2);
      var frac2 = maxScroll > 0 ? scroll / maxScroll : 0;
      var thumbY2 = gridTop + 8 + frac2 * (trackH2 - thumbH2);
      ctx.fillStyle = isLight() ? 'rgba(74,63,53,0.2)' : 'rgba(255,255,255,0.1)';
      roundRect(ctx, W - marginX + 4, thumbY2, 2.5, thumbH2, 1.2);
      ctx.fill();
    }

    ctx.restore();

    // Auto-scroll: position current level row at viewport center
    if (S._homeAutoScroll && firstUn < totalItems) {
      var curRow = Math.floor(firstUn / cols);
      var targetY = curRow * (cellH + gap) - (gridH / 2 - cellH / 2);
      S.homeScroll = Math.max(0, Math.min(maxScroll, targetY));
      S._homeAutoScroll = false;
    }
  }

  function cardStrokeCircle(ctx, cx, cy, r) {
    ctx.save();
    ctx.strokeStyle = UI().cardBorder;
    ctx.lineWidth = isLight() ? 2 : 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.stroke();
    ctx.restore();
  }

  function drawHomeConfirmDialog(ctx) {
    var u = UI();
    ctx.save();
    var bh = 176;
    var p = modalPanel(ctx, 268, bh);
    var bx = (CFG.W - 268) / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = u.star;
    ctx.font = '900 19px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('返回主页', CFG.W / 2, p.by + 46);
    ctx.fillStyle = u.textOnCardSub;
    ctx.font = '500 12.5px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('本关进度将不保存，确定要返回吗？', CFG.W / 2, p.by + 72);
    var btnY = p.by + bh - 56;
    S._btnHomeCancel = dialogButton(ctx, '继续游戏', bx + 24, btnY, 106, 38, u.btnGhost, u.textOnCard);
    S._btnHomeOk = dialogButton(ctx, '返回主页', bx + 268 - 130, btnY, 106, 38, u.accent, u.accentInk, { name: 'home', size: 14, color: u.accentInk });
    ctx.restore();
  }

  function drawPauseDialog(ctx) {
    ctx.save();
    var u = UI();
    var bh = 300;
    var p = modalPanel(ctx, 260, bh);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // 暂停徽章（圆 + 双竖条）
    var bcx = CFG.W / 2, bcy = p.by + 44;
    ctx.beginPath(); ctx.arc(bcx, bcy, 26, 0, 6.283);
    ctx.fillStyle = u.accent; ctx.fill();
    if (isLight()) { ctx.strokeStyle = u.cardBorder; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = u.accentInk;
    roundRect(ctx, bcx - 8, bcy - 10, 5.5, 20, 2.5); ctx.fill();
    roundRect(ctx, bcx + 2.5, bcy - 10, 5.5, 20, 2.5); ctx.fill();
    // 标题
    ctx.font = '900 24px -apple-system, "PingFang SC", sans-serif';
    if (isLight()) strokeText8(ctx, '已暂停', CFG.W / 2, p.by + 100, u.ink, '#ffffff', 2);
    else {
      var tg = ctx.createLinearGradient(0, p.by + 78, 0, p.by + 102);
      tg.addColorStop(0, '#FFF7EF'); tg.addColorStop(1, u.accent);
      ctx.fillStyle = tg; ctx.fillText('已暂停', CFG.W / 2, p.by + 100);
    }
    ctx.font = '600 12px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = u.textOnCardSub;
    ctx.fillText('小球在原地等你回来～', CFG.W / 2, p.by + 122);
    var on = global.Sfx ? global.Sfx.isEnabled() : true;
    var labels = ['继续游戏', '回到主页', on ? '关闭声音' : '打开声音'];
    var keys = ['_btnResume', '_btnHome', '_btnSound'];
    var fills = [u.accent, u.btnGhost, u.btnGhost2];
    var cols = [u.accentInk, u.textOnCard, isLight() ? '#123a4a' : '#DFFFF3'];
    var btnIcons = [
      { name: 'play', size: 15, color: cols[0], fill: cols[0] },
      { name: 'home', size: 15, color: cols[1] },
      { name: on ? 'volume2' : 'volumeX', size: 16, color: cols[2] }
    ];
    var btnW = 200, btnH = 42, gap = 12;
    var startY = p.by + 140;
    for (var i = 0; i < 3; i++) {
      var yy = startY + i * (btnH + gap);
      S[keys[i]] = dialogButton(ctx, labels[i], (CFG.W - btnW) / 2, yy, btnW, btnH, fills[i], cols[i], btnIcons[i]);
    }
    ctx.restore();
  }

  function drawBuyDialog(ctx, key) {
    var u = UI();
    var meta = PROPS[key], cnt = Game.getPropCount(key);
    ctx.save();
    var bh = 214;
    var p = modalPanel(ctx, 272, bh);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = u.star;
    ctx.font = '900 19px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('获取「' + meta.name + '」道具', CFG.W / 2, p.by + 42);   // v10.24：标题追加"道具"
    ctx.fillStyle = u.textOnCardSub;
    ctx.font = '500 11.5px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText(meta.desc, CFG.W / 2, p.by + 64);
    ctx.font = '700 16px -apple-system, sans-serif';
    ctx.fillStyle = u.gemInk;
    Icons.richText(ctx, ['单价  ', { icon: 'gem', size: 15, stroke: isLight() ? '#123a4a' : '#7CF5C8', fill: isLight() ? 'rgba(126,216,247,0.5)' : 'rgba(124,245,200,0.25)', gapR: 3 }, '' + meta.cost], CFG.W / 2, p.by + 96);
    ctx.font = '500 12px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = u.textOnCardSub;
    Icons.richText(ctx, ['当前钱包  ', { icon: 'gem', size: 12, stroke: isLight() ? '#123a4a' : '#7CF5C8', fill: isLight() ? 'rgba(126,216,247,0.5)' : 'rgba(124,245,200,0.25)', gapR: 3 }, '' + S.diamonds + '  ·  持有 ' + cnt], CFG.W / 2, p.by + 118);
    if (S.overlay && S.overlay.hint) {
      ctx.fillStyle = isLight() ? '#c0392b' : '#FF8A7A';
      ctx.font = '600 12px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText(S.overlay.hint, CFG.W / 2, p.by + 138);
    }
    var btnW = 110, btnH = 40, gap = 16;
    var bx2 = (CFG.W - (btnW * 2 + gap)) / 2, byy = p.by + bh - 54;
    S._btnBuyCancel = dialogButton(ctx, '取消', bx2, byy, btnW, btnH, u.btnGhost, u.textOnCard);
    S._btnBuyConfirm = dialogButton(ctx, '购买', bx2 + btnW + gap, byy, btnW, btnH, u.accent, u.accentInk);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * v10：设置弹窗（声音 / 主题 / 昵称）
   *   命中矩形写入 S._setToggle / S._setSegLight / S._setSegDark /
   *   S._setNick / S._setClose / S._setSave，由 input 层消费。
   * ------------------------------------------------------------------ */
  function drawSettingsDialog(ctx) {
    var u = UI();
    var settings = (global.Settings && global.Settings.read()) || {};
    var soundOn = global.Sfx ? global.Sfx.isEnabled() : true;
    var theme = settings.theme === 'dark' ? 'dark' : 'light';
    ctx.save();
    var bh = 268;
    var p = modalPanel(ctx, 280, bh);
    var bx = p.bx, by = p.by;

    // 标题 + 关闭
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '900 20px -apple-system, "PingFang SC", sans-serif';
    if (isLight()) strokeText8(ctx, '设 置', CFG.W / 2, by + 38, u.ink, '#ffffff', 1.6);
    else { ctx.fillStyle = u.textOnCard; ctx.fillText('设 置', CFG.W / 2, by + 38); }
    var clx = bx + 280 - 40, cly = by + 14;
    ctx.beginPath(); ctx.arc(clx + 13, cly + 13, 13, 0, 6.283);
    ctx.fillStyle = u.btnGhost; ctx.fill();
    if (isLight()) { ctx.strokeStyle = u.cardBorder; ctx.lineWidth = 1.6; ctx.stroke(); }
    Icons.drawIcon(ctx, 'x', clx + 6, cly + 6, 14, { stroke: u.textOnCard, lineWidth: 2.2 });
    S._setClose = { x: clx, y: cly, w: 26, h: 26 };

    var rowX = bx + 20, rowW = 280 - 40, rowH = 44, rowGap = 10, ry = by + 58;

    // 行1：声音 toggle
    ctx.fillStyle = u.card;
    roundRect(ctx, rowX, ry, rowW, rowH, 12); ctx.fill();
    cardStroke(ctx, rowX, ry, rowW, rowH, 12);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '700 13px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = u.textOnCard;
    Icons.richText(ctx, [{ icon: soundOn ? 'volume2' : 'volumeX', size: 15, stroke: u.textOnCard, gapR: 6 }, '声音'], rowX + 12, ry + rowH / 2);
    var tgx = rowX + rowW - 56, tgy = ry + (rowH - 24) / 2;
    ctx.fillStyle = soundOn ? (isLight() ? '#8FD98A' : 'rgba(124,245,200,0.6)') : (isLight() ? '#d8cdbb' : 'rgba(255,255,255,0.15)');
    roundRect(ctx, tgx, tgy, 44, 24, 12); ctx.fill();
    if (isLight()) { ctx.strokeStyle = u.cardBorder; ctx.lineWidth = 1.6; roundRect(ctx, tgx, tgy, 44, 24, 12); ctx.stroke(); }
    ctx.beginPath();
    ctx.arc(soundOn ? tgx + 32 : tgx + 12, tgy + 12, 9, 0, 6.283);
    ctx.fillStyle = '#fff'; ctx.fill();
    if (isLight()) { ctx.strokeStyle = u.cardBorder; ctx.lineWidth = 1.4; ctx.stroke(); }
    S._setToggle = { x: tgx, y: tgy, w: 44, h: 24 };
    ry += rowH + rowGap;

    // 行2：主题分段
    ctx.fillStyle = u.card;
    roundRect(ctx, rowX, ry, rowW, rowH, 12); ctx.fill();
    cardStroke(ctx, rowX, ry, rowW, rowH, 12);
    ctx.fillStyle = u.textOnCard;
    Icons.richText(ctx, [{ icon: 'settings', size: 14, stroke: u.textOnCard, gapR: 6 }, '主题'], rowX + 12, ry + rowH / 2);
    var segW = 108, segX = rowX + rowW - segW - 12, segY = ry + (rowH - 26) / 2;
    ctx.fillStyle = isLight() ? '#F3EBDD' : 'rgba(255,255,255,0.1)';
    roundRect(ctx, segX, segY, segW, 26, 13); ctx.fill();
    if (isLight()) { ctx.strokeStyle = u.cardBorder; ctx.lineWidth = 1.6; roundRect(ctx, segX, segY, segW, 26, 13); ctx.stroke(); }
    // 选中块
    var selX = theme === 'light' ? segX : segX + segW / 2;
    ctx.fillStyle = u.accent;
    roundRect(ctx, selX + 1, segY + 1, segW / 2 - 2, 24, 12); ctx.fill();
    ctx.font = '700 11px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = theme === 'light' ? u.accentInk : u.textOnCardSub;
    ctx.fillText('浅色', segX + segW * 0.25, segY + 13.5);
    ctx.fillStyle = theme === 'dark' ? u.accentInk : u.textOnCardSub;
    ctx.fillText('深色', segX + segW * 0.75, segY + 13.5);
    S._setSegLight = { x: segX, y: segY, w: segW / 2, h: 26 };
    S._setSegDark = { x: segX + segW / 2, y: segY, w: segW / 2, h: 26 };
    ry += rowH + rowGap;

    // 行3：昵称
    ctx.fillStyle = u.card;
    roundRect(ctx, rowX, ry, rowW, rowH, 12); ctx.fill();
    cardStroke(ctx, rowX, ry, rowW, rowH, 12);
    ctx.textAlign = 'left';
    ctx.fillStyle = u.textOnCard;
    Icons.richText(ctx, [{ icon: 'user', size: 14, stroke: u.textOnCard, gapR: 6 }, '昵称'], rowX + 12, ry + rowH / 2);
    var nick = settings.nickname || '玩家';
    ctx.font = '700 12px -apple-system, "PingFang SC", sans-serif';
    var nw = ctx.measureText(nick).width + 34;
    var nx = rowX + rowW - nw - 12, ny = ry + (rowH - 26) / 2;
    ctx.fillStyle = u.tintBlue;
    roundRect(ctx, nx, ny, nw, 26, 13); ctx.fill();
    if (isLight()) { ctx.strokeStyle = u.cardBorder; ctx.lineWidth = 1.4; roundRect(ctx, nx, ny, nw, 26, 13); ctx.stroke(); }
    ctx.textAlign = 'center';
    ctx.fillStyle = isLight() ? '#123a4a' : '#DFFFF3';
    ctx.fillText(nick + ' ✎', nx + nw / 2, ny + 13.5);
    S._setNick = { x: nx, y: ny, w: nw, h: 26 };
    ry += rowH + rowGap;

    // 保存按钮
    S._setSave = dialogButton(ctx, '保存设置', bx + 40, ry + 2, 280 - 80, 40, u.accent, u.accentInk);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * 主渲染
   * ------------------------------------------------------------------ */
  function render(ctx) {
    // v10.3：主页态整屏切换到主页，不渲染对局场景
    if (S.phase === Game.PHASE.HOME) {
      drawBackground(ctx);
      drawHome(ctx);
      // v8: 主页也可购买道具，需绘制覆盖层弹窗；v10: 设置弹窗
      if (S.overlay === 'settings') drawSettingsDialog(ctx);
      else if (S.overlay && S.overlay.buy) drawBuyDialog(ctx, S.overlay.buy);
      return;
    }
    ctx.save();
    drawBackground(ctx);
    // v5 需求①：去掉整屏抖动，抖动只作用于「方块区」（竞技区框 + 方块）
    ctx.save();
    if (S.shake > 0.05) {
      // v10.8：抖动幅度减半
      ctx.translate((Math.random() - 0.5) * S.shake * 0.5, (Math.random() - 0.5) * S.shake * 0.5);
    }
    drawArena(ctx);
    drawBlocks(ctx);
    ctx.restore();
    // v10.16：删除大方框上方的道具方块图例行
    drawFingerGuide(ctx);
    drawCatchZone(ctx);
    drawAim(ctx);
    drawRestBall(ctx);
    drawBalls(ctx);
    drawPaddle(ctx);
    drawParticles(ctx);
    drawPaddleBoost(ctx);
    drawBuffStatus(ctx);
    drawCombo(ctx);
    drawHUD(ctx);
    // v10.17：统一提示组件（大方框居中+呼吸闪烁），置于场景最上层
    drawMsgs(ctx);
    // v5 需求②：底部主动道具栏（仅对局态显示）
    if (S.phase === Game.PHASE.PLAY || S.phase === Game.PHASE.READY) drawPropBar(ctx);
    ctx.restore();
    drawOverlay(ctx);
    // v5 需求③：暂停 / 购买弹窗（最上层，独立于抖动变换）；v10 设置弹窗
    if (S.overlay === 'pause') drawPauseDialog(ctx);
    else if (S.overlay === 'homeConfirm') drawHomeConfirmDialog(ctx);
    else if (S.overlay === 'settings') drawSettingsDialog(ctx);
    else if (S.overlay && S.overlay.buy) drawBuyDialog(ctx, S.overlay.buy);
  }

  global.Render = { render: render, roundRect: roundRect };
})(G);
