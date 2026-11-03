/**
 * 弹弹消消乐 · 交互原型 —— 渲染层（v3）
 * 全部使用 Canvas 2D 绘制（与微信小游戏 / 小程序 canvas 2d API 一致）
 * v3：新道具绘制(生命/爆炸/挡板)、HUD 消除进度条、结算面板分数拆解、
 *     移除旧停滞进度条，仅保留超时警告。
 */
(function (global) {
  'use strict';

  var CFG = global.TT.CFG;
  var PAL = global.TT.PALETTE;
  var TYPE = global.TT.TYPE;
  var PROPS = global.TT.PROPS;
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

  /* ------------------------------------------------------------------ *
   * 背景
   * ------------------------------------------------------------------ */
  function drawBackground(ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, CFG.H);
    g.addColorStop(0, PAL.bgTop);
    g.addColorStop(1, PAL.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CFG.W, CFG.H);

    // 星点
    ctx.save();
    for (var i = 0; i < 46; i++) {
      var x = (i * 97.3) % CFG.W;
      var y = (i * 53.7) % CFG.H;
      var a = 0.10 + 0.16 * Math.abs(Math.sin(S.time * 0.8 + i));
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
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    roundRect(ctx, 10, 12, CFG.W - 20, 56, 16);
    ctx.fill();

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    // 关卡
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '500 10px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('关卡 ' + S.level.id + ' · ' + S.level.name, 22, 30);

    ctx.fillStyle = '#fff';
    ctx.font = '700 17px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText(String(S.score).padStart ? String(S.score).padStart(5, '0') : String(S.score), 22, 50);

    // 耗时（v2：星级依据，关卡开始即计时）
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '500 10px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('耗时', 116, 30);
    ctx.fillStyle = '#fff';
    ctx.font = '700 15px -apple-system, sans-serif';
    var es = Math.floor(S.elapsed);
    ctx.fillText(Math.floor(es / 60) + ':' + String(es % 60).padStart(2, '0'), 116, 50);

    // 剩余发射机会（v2：每关 3 颗球）
    var cx = 200;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '500 10px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('剩余发射', cx, 30);
    // 次数圆点
    var total = S.level.balls;
    var dotR = 4, gap = 12;
    var w0 = cx - (total - 1) * gap / 2;
    for (var i = 0; i < total; i++) {
      ctx.beginPath();
      ctx.arc(w0 + i * gap, 50, dotR, 0, Math.PI * 2);
      if (i < S.shotsLeft) { ctx.fillStyle = '#FFE07A'; ctx.fill(); }
      else { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.4; ctx.stroke(); }
    }

    // 消除进度（v3：进度条样式；v5 需求③：右侧腾出暂停按钮位）
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '500 10px -apple-system, "PingFang SC", sans-serif';
    var pct = S.totalBricks ? S.destroyed / S.totalBricks : 0;
    var prRight = CFG.W - 50;                      // 进度内容右边界（给暂停按钮让位）
    ctx.fillText('消除进度 ' + Math.floor(pct * 100) + '%', prRight, 28);
    var barW = 80, barH = 9, barX = prRight - barW, barY = 44;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fill();
    if (pct > 0) {
      var gg = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      gg.addColorStop(0, '#7BEFC0');
      gg.addColorStop(1, '#22C58B');
      ctx.fillStyle = gg;
      roundRect(ctx, barX, barY, Math.max(barH, barW * pct), barH, barH / 2);
      ctx.fill();
    }

    // v5 需求③：右上角暂停按钮（⏸），点击开暂停弹窗
    var pbx = CFG.W - 44, pby = 24,pbs = 32;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, pbx, pby, pbs, pbs, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    roundRect(ctx, pbx + 0.5, pby + 0.5, pbs - 1, pbs - 1, 10);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    var pmx = pbx + pbs / 2;
    ctx.fillRect(pmx - 5, pby + 10, 3.5, 12);
    ctx.fillRect(pmx + 1.5, pby + 10, 3.5, 12);
    S._btnPause = { x: pbx, y: pby, w: pbs, h: pbs };

    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * 竞技区容器
   * ------------------------------------------------------------------ */
  function drawArena(ctx) {
    ctx.save();
    ctx.fillStyle = PAL.panel;
    roundRect(ctx, CFG.ARENA_LEFT - 3, CFG.ARENA_TOP - 3, CFG.ARENA_W + 6, CFG.ARENA_H + 6, 12);
    ctx.fill();
    ctx.strokeStyle = PAL.panelLine;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 淡网格
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
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
      // v4 需求⑨：隐形期间的方块区墙壁淡化为可穿透（底部墙行不受影响）
      if (S.wallGhost > 0 && r < CFG.ROWS - 1 && !cell.opened) {
        ctx.globalAlpha = 0.16;
        drawWall(ctx, x, y, w, h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(230,236,255,0.5)';
        ctx.setLineDash([2, 2]); ctx.lineWidth = 0.6;
        roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 2); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        drawWall(ctx, x, y, w, h);
      }
    }
    else if (cell.type === TYPE.SPLIT) drawSplit(ctx, x, y, w, h);
    else if (cell.type === TYPE.SPLIT3) drawSplit3(ctx, x, y, w, h);
    else if (cell.type === TYPE.LIFE) drawLife(ctx, x, y, w, h);
    else if (cell.type === TYPE.BOMB) drawBomb(ctx, x, y, w, h);
    else if (cell.type === TYPE.PADDLE) drawPaddlePow(ctx, x, y, w, h);
    else if (cell.type === TYPE.SPEED) drawSpeed(ctx, x, y, w, h);
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
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, col.top);
    g.addColorStop(1, col.bottom);
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, 2.2);   // v2.2：小圆角更可爱；相邻方块圆角相拼呈纽扣状，仍无缝隙
    ctx.fill();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundRect(ctx, x + 1, y + 1, w - 2, h * 0.30, 1.4);
    ctx.fill();
    // 细分隔线（淡描边保证相邻同色方块仍可辨识）
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.5;
    roundRect(ctx, x + 0.25, y + 0.25, w - 0.5, h - 0.5, 2);
    ctx.stroke();
  }

  function drawWall(ctx, x, y, w, h) {
    // v6 需求⑤：墙壁用纯背景色，去掉铆钉白点
    ctx.fillStyle = PAL.wall.bottom;
    roundRect(ctx, x, y, w, h, 2.2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    roundRect(ctx, x + 0.25, y + 0.25, w - 0.5, h - 0.5, 2);
    ctx.stroke();
  }

  // 分裂球（2个）：统一蓝紫底 + 两个小白点（v6 需求③）
  function drawSplit(ctx, x, y, w, h) {
    propTile(ctx, x, y, w, h);
    var cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * 0.14;
    dot(ctx, cx - w * 0.2, cy, r);
    dot(ctx, cx + w * 0.2, cy, r);
  }

  function drawBlocks(ctx) {
    for (var r = 0; r < CFG.ROWS; r++) {
      for (var c = 0; c < CFG.COLS; c++) drawCell(ctx, r, c);
    }
  }

  /* 道具方块统一底色（v6 需求③：背景与普通方块一致=蓝紫，仅靠图标区分） */
  function propTile(ctx, x, y, w, h) {
    var col = PAL.bricks[0];
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, col.top);
    g.addColorStop(1, col.bottom);
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, 2.2);
    ctx.fill();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundRect(ctx, x + 1, y + 1, w - 2, h * 0.30, 1.4);
    ctx.fill();
    // 描边
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.5;
    roundRect(ctx, x + 0.25, y + 0.25, w - 0.5, h - 0.5, 2);
    ctx.stroke();
  }

  /* 白色小圆点（分裂道具） */
  function dot(ctx, cx, cy, r) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.283);
    ctx.fill();
  }

  // 生命球：白色爱心（粉色光晕）
  function drawLife(ctx, x, y, w, h) {
    propTile(ctx, x, y, w, h);
    var cx = x + w / 2, cy = y + h / 2 + h * 0.03, s = Math.min(w, h) * 0.3;
    ctx.save();
    ctx.shadowColor = PAL.life.glow;
    ctx.shadowBlur = 5;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.9);
    ctx.bezierCurveTo(cx - s * 1.6, cy - s * 0.2, cx - s * 0.6, cy - s * 1.5, cx, cy - s * 0.4);
    ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.5, cx + s * 1.6, cy - s * 0.2, cx, cy + s * 0.9);
    ctx.fill();
    ctx.restore();
  }

  // 爆炸球：橙色炸弹图标
  function drawBomb(ctx, x, y, w, h) {
    propTile(ctx, x, y, w, h);
    var cx = x + w / 2, cy = y + h / 2, s = Math.min(w, h) * 0.3;
    ctx.fillStyle = '#FF7A2F';
    ctx.beginPath();
    ctx.arc(cx - s * 0.12, cy + s * 0.18, s * 0.72, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(cx - s * 0.38, cy - s * 0.02, s * 0.18, 0, 6.283);
    ctx.fill();
    ctx.strokeStyle = '#FFD27A';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.32, cy - s * 0.28);
    ctx.lineTo(cx + s * 0.68, cy - s * 0.66);
    ctx.stroke();
    ctx.fillStyle = '#FFE08A';
    ctx.beginPath();
    ctx.arc(cx + s * 0.76, cy - s * 0.74, s * 0.16, 0, 6.283);
    ctx.fill();
  }

  // 横条加强：绿色实心横条
  function drawPaddlePow(ctx, x, y, w, h) {
    propTile(ctx, x, y, w, h);
    var bw = w * 0.62, bh = h * 0.22;
    var bx = x + (w - bw) / 2, by = y + (h - bh) / 2;
    ctx.fillStyle = '#5FD14A';
    roundRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fill();
  }

  // 三分裂道具方块（v6 需求③：三个小白点）
  function drawSplit3(ctx, x, y, w, h) {
    propTile(ctx, x, y, w, h);
    var cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * 0.13;
    dot(ctx, cx, cy - h * 0.18, r);
    dot(ctx, cx - w * 0.2, cy + h * 0.16, r);
    dot(ctx, cx + w * 0.2, cy + h * 0.16, r);
  }

  // 快速球道具方块（v6：统一蓝紫底 + 白色双箭头）
  function drawSpeed(ctx, x, y, w, h) {
    propTile(ctx, x, y, w, h);
    var cx = x + w / 2, cy = y + h / 2, s = Math.min(w, h) * 0.28;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (var i = 0; i < 2; i++) {
      var ox = cx - s * 0.3 + i * s * 0.6;
      ctx.beginPath();
      ctx.moveTo(ox - s * 0.4, cy - s * 0.6);
      ctx.lineTo(ox + s * 0.3, cy);
      ctx.lineTo(ox - s * 0.4, cy + s * 0.6);
      ctx.stroke();
    }
  }

  // 墙壁隐形道具方块（v6：统一蓝紫底 + 白色虚线幽灵轮廓）
  function drawGhost(ctx, x, y, w, h) {
    propTile(ctx, x, y, w, h);
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
    // 分界提示（方块区与接球区）
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CFG.PAD, CFG.ARENA_BOTTOM + 8);
    ctx.lineTo(CFG.W - CFG.PAD, CFG.ARENA_BOTTOM + 8);
    ctx.stroke();
    ctx.setLineDash([]);

    // v4 需求③：滑动轨道 —— 横条下方 100% 宽的暗色同形横条，球落到轨道(横条外)即漏接
    var tx = CFG.ARENA_LEFT, ty = CFG.PADDLE_Y, tw = CFG.ARENA_W, th = CFG.PADDLE_H;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(ctx, tx, ty, tw, th, th / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    roundRect(ctx, tx + 0.5, ty + 0.5, tw - 1, th - 1, th / 2);
    ctx.stroke();
    // 轨道端点刻度，强化“滑轨”观感
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(tx + 4, ty + th / 2 - 0.5, 2, 1);
    ctx.fillRect(tx + tw - 6, ty + th / 2 - 0.5, 2, 1);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * 挡板（v3：强化时满宽 + 最后 3s 闪烁倒计时）
   * ------------------------------------------------------------------ */
  function drawPaddle(ctx) {
    var x = S.paddle.x, y = CFG.PADDLE_Y, w = S.paddle.w, h = CFG.PADDLE_H;
    var boosted = S.paddleBoost > 0;
    ctx.save();
    if (boosted) {
      // 最后 PADDLE_BOOST_WARN 秒闪烁
      if (S.paddleBoost <= CFG.PADDLE_BOOST_WARN) {
        var blink = Math.sin(S.time * 10) > 0 ? 0.6 : 1;
        ctx.globalAlpha = blink;
      }
      ctx.shadowColor = PAL.paddlePow.glow || 'rgba(63,174,46,0.6)';
      ctx.shadowBlur = 18;
      var g2 = ctx.createLinearGradient(x, y, x, y + h);
      g2.addColorStop(0, PAL.paddlePow.top);
      g2.addColorStop(1, PAL.paddlePow.bottom);
      ctx.fillStyle = g2;
    } else {
      ctx.shadowColor = 'rgba(255,159,67,0.55)';
      ctx.shadowBlur = 14;
      var g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, PAL.paddle.top);
      g.addColorStop(1, PAL.paddle.bottom);
      ctx.fillStyle = g;
    }
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.restore();

    // 挡板中心亮条
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    roundRect(ctx, x + 6, y + 2.5, w - 12, 3.5, 2);
    ctx.fill();

  }

  /* ------------------------------------------------------------------ *
   * v5 需求②：挡板放大时，倒计时显示在【横条中间】上方（v6 需求①：从方块区中心移到横条处）
   * ------------------------------------------------------------------ */
  function drawPaddleBoost(ctx) {
    if (!(S.paddleBoost > 0)) return;
    var secs = Math.ceil(S.paddleBoost);
    var warn = S.paddleBoost <= CFG.PADDLE_BOOST_WARN;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var cx = S.paddle.x + S.paddle.w / 2;        // 跟随横条实际中心（强化时满宽→屏幕中部）
    var cy = CFG.PADDLE_Y - 18;                       // 横条中间略上方（v7：修正旧 S.paddle.y 不存在导致 NaN 不渲染）
    var t = S.time * (warn ? 22 : 10);                       // 轻微抖动
    var jx = Math.sin(t) * (warn ? 1.8 : 1.0);
    var jy = Math.cos(t * 0.9) * (warn ? 1.4 : 0.8);
    ctx.translate(cx + jx, cy + jy);
    ctx.font = '900 30px -apple-system, "PingFang SC", sans-serif';
    ctx.globalAlpha = warn ? (0.6 + 0.4 * Math.abs(Math.sin(S.time * 10))) : 0.95;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(secs + 's', 1.5, 1.5);
    ctx.fillStyle = warn ? '#FF6B6B' : PAL.paddlePow.top;
    ctx.fillText(secs + 's', 0, 0);
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
    var ok = !path || !path.pts || path.hit;
    var main = ok ? 'rgba(124,246,255,0.95)' : 'rgba(255,138,122,0.95)';
    var dotCol = ok ? '124,246,255' : '255,138,122';
    ctx.save();

    // 手指锚点
    ctx.beginPath();
    ctx.arc(S.aim.x, S.aim.y, 5, 0, 6.283);
    ctx.strokeStyle = main;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(S.aim.x, S.aim.y, 12, 0, 6.283);
    ctx.strokeStyle = ok ? 'rgba(124,246,255,0.28)' : 'rgba(255,138,122,0.28)';
    ctx.lineWidth = 1;
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
          ctx.arc(px, py, 2.1, 0, 6.283);
          ctx.fillStyle = 'rgba(' + dotCol + ',' + alpha.toFixed(3) + ')';
          ctx.fill();
        }
      }
      // 首个命中点标记
      if (path.hit) {
        ctx.beginPath();
        ctx.arc(path.hit.x, path.hit.y, 11, 0, 6.283);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(path.hit.x, path.hit.y, 16, 0, 6.283);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // 未能穿缺口：在撞墙点画 ✕
      if (!ok && path.wallPt) {
        var wx = path.wallPt.x, wy = path.wallPt.y;
        ctx.strokeStyle = 'rgba(255,138,122,0.95)';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(wx - 7, wy - 7); ctx.lineTo(wx + 7, wy + 7);
        ctx.moveTo(wx + 7, wy - 7); ctx.lineTo(wx - 7, wy + 7);
        ctx.stroke();
      }
    }

    // 角度读数 + 命中提示
    var ang = Math.atan2(S.aim.dx, -S.aim.dy) * 180 / Math.PI;
    ctx.font = '600 10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = ok ? 'rgba(124,246,255,0.9)' : 'rgba(255,138,122,0.95)';
    ctx.fillText((ang >= 0 ? '+' : '') + ang.toFixed(0) + '°' + (ok ? ' 可命中' : ' 无命中(慎发)'),
      o.x, CFG.PADDLE_Y + 28);

    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * 小球
   * ------------------------------------------------------------------ */
  function drawBalls(ctx) {
    for (var i = 0; i < S.balls.length; i++) {
      var b = S.balls[i];
      // 拖尾
      for (var t = 0; t < b.trail.length; t += 2) {
        var k = t / b.trail.length;
        ctx.beginPath();
        ctx.arc(b.trail[t], b.trail[t + 1], b.r * (0.25 + 0.6 * k), 0, 6.283);
        ctx.fillStyle = 'rgba(140,225,255,' + (0.22 * k).toFixed(3) + ')';
        ctx.fill();
      }
      ctx.save();
      ctx.shadowColor = PAL.ball.glow;
      ctx.shadowBlur = 12;
      var g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.15, b.x, b.y, b.r);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(0.6, '#D8F4FF');
      g.addColorStop(1, '#7FD8FF');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, 6.283);
      ctx.fill();
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
   * 方块区居中浮动提示栏（v4 需求⑤：多条上下堆叠，先显示先消失）
   * ------------------------------------------------------------------ */
  function drawMsgs(ctx) {
    if (!S.msgs.length) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var cx = CFG.W / 2;
    var baseY = CFG.ARENA_TOP + CFG.ARENA_H / 2;
    var lineH = 24;
    for (var i = 0; i < S.msgs.length; i++) {
      var m = S.msgs[i];
      var k = m.t / m.life;                        // 0→1
      // 淡入前 20%，淡出后 30%
      var alpha = k < 0.2 ? k / 0.2 : (k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1);
      var y = baseY + (i - (S.msgs.length - 1) / 2) * lineH - k * 8;
      ctx.font = '800 15px -apple-system, "PingFang SC", sans-serif';
      var tw = ctx.measureText(m.text).width + 24;
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(ctx, cx - tw / 2, y - 13, tw, 26, 13);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#000';
      ctx.fillText(m.text, cx + 1, y + 1);
      ctx.fillStyle = '#FFFFFF';   // v5 需求③：所有提示文字统一白色（忽略各自配色）
      ctx.fillText(m.text, cx, y);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * 连击 & 状态提示
   * ------------------------------------------------------------------ */
  function drawCombo(ctx) {
    if (S.combo < 2 || S.phase !== Game.PHASE.PLAY) return;
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = '800 22px -apple-system, sans-serif';
    var a = 0.55 + 0.45 * Math.abs(Math.sin(S.time * 6));
    ctx.fillStyle = 'rgba(255,224,122,' + a.toFixed(2) + ')';
    ctx.fillText('x' + S.combo, CFG.W - 16, CFG.ARENA_BOTTOM + 34);
    ctx.font = '500 9px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('COMBO', CFG.W - 16, CFG.ARENA_BOTTOM + 47);
    ctx.restore();
  }

  function drawHint(ctx) {
    var txt = null;
    if (S.phase === Game.PHASE.READY) txt = S.level.tip;
    else if (S.phase === Game.PHASE.PLAY) {
      if (S.aim.active) txt = null;
      else if (S.shotsLeft > 0) txt = '拖空白处瞄准 · 松手发射 · 拖横条接球回弹';
      else txt = '弹药已用完 · 争取回弹链不断';
    }
    if (!txt) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '500 11px -apple-system, "PingFang SC", sans-serif';
    var w = ctx.measureText(txt).width + 22;
    var x = (CFG.W - w) / 2, y = CFG.ARENA_BOTTOM + 22;
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    roundRect(ctx, x, y, w, 22, 11);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText(txt, CFG.W / 2, y + 11.5);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * 结算浮层
   * ------------------------------------------------------------------ */
  function drawOverlay(ctx) {
    if (S.phase !== Game.PHASE.WIN && S.phase !== Game.PHASE.LOSE) return;
    var win = S.phase === Game.PHASE.WIN;
    ctx.save();
    ctx.fillStyle = 'rgba(8,8,24,0.78)';
    ctx.fillRect(0, 0, CFG.W, CFG.H);

    var bw = 280, bh = 320, bx = (CFG.W - bw) / 2, by = (CFG.H - bh) / 2 - 10;
    var g = ctx.createLinearGradient(bx, by, bx, by + bh);
    g.addColorStop(0, 'rgba(46,40,96,0.98)');
    g.addColorStop(1, 'rgba(24,22,58,0.98)');
    ctx.fillStyle = g;
    roundRect(ctx, bx, by, bw, bh, 22);
    ctx.fill();
    ctx.strokeStyle = win ? 'rgba(255,224,122,0.55)' : 'rgba(255,138,122,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = win ? '#FFE07A' : '#FF8A7A';
    ctx.font = '800 26px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText(win ? '通关成功' : (S.shotsLeft <= 0 && S.destroyed < S.totalBricks ? '弹药用尽' : '全部漏接'), CFG.W / 2, by + 52);

    // 星星
    var res = S.lastResult || { stars: 0 };
    for (var i = 0; i < 3; i++) {
      var sx = CFG.W / 2 + (i - 1) * 44, sy = by + 96;
      drawStar(ctx, sx, sy, i < res.stars ? '#FFE07A' : 'rgba(255,255,255,0.16)', 17);
    }

    // v5 需求①：结算把星数换算成钻石计入钱包
    ctx.textAlign = 'center';
    ctx.font = '600 11.5px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = win ? '#8FE3FF' : 'rgba(255,255,255,0.62)';
    ctx.fillText('获得 💎 ' + (res.diamondsGained || 0) + '  ·  钱包 ' + (res.diamonds || 0) + ' 钻',
      CFG.W / 2, by + 122);

    ctx.font = '500 11px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    // v3：胜局展示总分明细（消除/剩余球/连击/耗时），败局展示统计
    var bd = res.breakdown;
    if (win && bd) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '500 11px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText('总分', CFG.W / 2, by + 134);
      ctx.fillStyle = '#FFE07A';
      ctx.font = '800 30px -apple-system, sans-serif';
      ctx.fillText(String(res.score || 0), CFG.W / 2, by + 160);
      var rows = [
        ['消除得分', String(bd.inPlay)],
        ['剩余球 ×' + bd.remaining, '+' + bd.shotBonus],
        ['最大连击 ×' + bd.maxCombo, '+' + bd.comboBonus],
        ['耗时 ' + Math.floor(bd.elapsed) + 's（★★★≤' + (S.level.starTimes ? S.level.starTimes[0] : 0) + 's）', '+' + bd.timeBonus]
      ];
      for (var k = 0; k < rows.length; k++) {
        var yy = by + 194 + k * 20;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '500 11px -apple-system, "PingFang SC", sans-serif';
        ctx.fillText(rows[k][0], bx + 32, yy);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.font = '700 12px -apple-system, sans-serif';
        ctx.fillText(rows[k][1], bx + bw - 32, yy);
      }
    } else {
      var secs = res.elapsed || 0;
      var rows2 = [
        ['得分', String(res.score || 0)],
        ['通关耗时', Math.floor(secs / 60) + ':' + String(Math.floor(secs % 60)).padStart(2, '0')],
        ['消除方块', (res.destroyed || 0) + ' / ' + (res.total || 0)],
        ['最长回弹链', 'x' + (res.maxChain || 0)],
        ['剩余发射', String(res.shotsLeft || 0) + '（共 ' + S.level.balls + ' 次）']
      ];
      for (var m = 0; m < rows2.length; m++) {
        var y2 = by + 140 + m * 22;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '500 11px -apple-system, "PingFang SC", sans-serif';
        ctx.fillText(rows2[m][0], bx + 34, y2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.font = '700 13px -apple-system, sans-serif';
        ctx.fillText(rows2[m][1], bx + bw - 34, y2);
      }
    }

    // 按钮
    var btnY = by + bh - 56;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    roundRect(ctx, bx + 26, btnY, 100, 38, 19);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 13px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(win ? '下一关' : '重新挑战', bx + 76, btnY + 20);
    S._btnNext = { x: bx + 26, y: btnY, w: 100, h: 38 };

    ctx.fillStyle = win ? '#FFE07A' : 'rgba(255,255,255,0.22)';
    roundRect(ctx, bx + bw - 126, btnY, 100, 38, 19);
    ctx.fill();
    ctx.fillStyle = win ? '#2A2140' : 'rgba(255,255,255,0.85)';
    ctx.fillText('重玩本关', bx + bw - 76, btnY + 20);
    S._btnRetry = { x: bx + bw - 126, y: btnY, w: 100, h: 38 };

    ctx.restore();
  }

  function drawStar(ctx, cx, cy, color, R) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rr = i % 2 === 0 ? R : R * 0.46;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function easeOutBack(t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  /* ------------------------------------------------------------------ *
   * v5 需求②：底部主动道具栏 + 钻石钱包
   * ------------------------------------------------------------------ */
  function drawDiamondIcon(ctx, cx, cy, s, color) {
    ctx.save();
    ctx.fillStyle = color || '#8FE3FF';
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.82, cy - s * 0.2);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s * 0.82, cy - s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.82, cy - s * 0.2);
    ctx.lineTo(cx + s * 0.82, cy - s * 0.2);
    ctx.stroke();
    ctx.restore();
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
    ctx.save();
    // 钻石余额（道具栏上方居中）
    ctx.textBaseline = 'middle';
    ctx.font = '700 15px -apple-system, sans-serif';
    var dTxt = String(S.diamonds);
    var tw = ctx.measureText(dTxt).width;
    var cx0 = CFG.W / 2 - (tw + 16) / 2;
    drawDiamondIcon(ctx, cx0, CFG.PROP_BAR_Y - 16, 7.5, '#8FE3FF');
    ctx.textAlign = 'left';
    ctx.fillStyle = '#DFF3FF';
    ctx.fillText(dTxt, cx0 + 12, CFG.PROP_BAR_Y - 16);

    for (var i = 0; i < rects.length; i++) {
      var rc = rects[i], meta = PROPS[rc.key], cnt = Game.getPropCount(rc.key);
      var usable = cnt > 0;
      ctx.fillStyle = usable ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.05)';
      roundRect(ctx, rc.x, rc.y, rc.w, rc.h, 12);
      ctx.fill();
      ctx.strokeStyle = usable ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.2;
      roundRect(ctx, rc.x + 0.5, rc.y + 0.5, rc.w - 1, rc.h - 1, 12);
      ctx.stroke();
      // 图标
      ctx.save();
      if (!usable) ctx.globalAlpha = 0.45;
      var isz = 28, ix = rc.x + (rc.w - isz) / 2, iy = rc.y + 9;
      if (rc.key === 'splitAll') drawSplit(ctx, ix, iy, isz, isz);
      else if (rc.key === 'wallHide') drawGhost(ctx, ix, iy, isz, isz);
      else drawPaddlePow(ctx, ix, iy, isz, isz);
      ctx.restore();
      // 名称
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      ctx.fillStyle = usable ? 'rgba(255,255,255,0.86)' : 'rgba(255,255,255,0.5)';
      ctx.font = '600 11px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText(meta.name, rc.x + rc.w / 2, rc.y + rc.h - 9);
      // 数量角标
      var bx = rc.x + rc.w - 13, byy = rc.y + 13;
      ctx.beginPath(); ctx.arc(bx, byy, 10, 0, 6.283);
      ctx.fillStyle = usable ? '#2E7D32' : '#B0342E'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
      ctx.font = '700 11px -apple-system, sans-serif';
      ctx.fillText(String(cnt), bx, byy + 0.5);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * v5 需求③：主页 / 暂停弹窗 / 购买弹窗
   * ------------------------------------------------------------------ */
  function modalPanel(ctx, bw, bh) {
    var bx = (CFG.W - bw) / 2, by = (CFG.H - bh) / 2 - 10;
    ctx.fillStyle = 'rgba(8,8,24,0.62)';
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    var g = ctx.createLinearGradient(bx, by, bx, by + bh);
    g.addColorStop(0, 'rgba(46,40,96,0.98)');
    g.addColorStop(1, 'rgba(24,22,58,0.98)');
    ctx.fillStyle = g;
    roundRect(ctx, bx, by, bw, bh, 22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1, 22);
    ctx.stroke();
    return { bx: bx, by: by };
  }

  function dialogButton(ctx, label, x, y, w, h, fill, txtCol) {
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, w, h, 22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 22);
    ctx.stroke();
    ctx.fillStyle = txtCol;
    ctx.font = '700 15px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
    return { x: x, y: y, w: w, h: h };
  }

  function drawHome(ctx) {
    var W = CFG.W, H = CFG.H;
    var prog = (global.Storage && global.Storage.read()) || {};
    var LEVELS = global.TT.LEVELS;
    var PROPS = global.TT.PROPS;
    // Find first unplayed level (no stars)
    var firstUn = LEVELS.length;
    for (var i = 0; i < LEVELS.length; i++) {
      var p = prog['lv' + i];
      if (!p || !p.stars) { firstUn = i; break; }
    }

    ctx.save();

    // ===== Header: avatar + nickname + diamond =====
    var hy = 34;
    ctx.beginPath(); ctx.arc(28, hy, 15, 0, 6.283);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '12px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText('👤', 28, hy);
    ctx.textAlign = 'left';
    ctx.font = '600 13px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = '#fff'; ctx.fillText('玩家', 48, hy);
    ctx.textAlign = 'right';
    ctx.font = '700 13px -apple-system, sans-serif';
    ctx.fillStyle = '#DFF3FF';
    ctx.fillText('💎 ' + S.diamonds, W - 12, hy);

    // ===== Prop Buttons Row (v8 需求1: 3个道具展示 + 点击购买) =====
    var propBtnW = 80, propBtnH = 46, propGap = 10;
    var propTotalW = 3 * propBtnW + 2 * propGap;
    var propStartX = (W - propTotalW) / 2;
    var propY = 56;
    var icons = ['✂️', '👻', '📏'];
    S._homePropRects = [];
    for (var pi = 0; pi < PROPS.order.length; pi++) {
      var pkey = PROPS.order[pi], pmeta = PROPS[pkey];
      var px = propStartX + pi * (propBtnW + propGap);
      var cnt = Game.getPropCount(pkey);
      ctx.fillStyle = cnt > 0 ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)';
      roundRect(ctx, px, propY, propBtnW, propBtnH, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 0.8;
      roundRect(ctx, px + 0.5, propY + 0.5, propBtnW - 1, propBtnH - 1, 8);
      ctx.stroke();
      // Icon + count (top line)
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '12px sans-serif'; ctx.fillStyle = '#fff';
      ctx.fillText(icons[pi] + ' ×' + cnt, px + propBtnW / 2, propY + 17);
      // Cost hint (bottom line)
      ctx.font = '500 9px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255,224,122,0.7)';
      ctx.fillText('💎' + pmeta.cost + ' 购买', px + propBtnW / 2, propY + 34);
      S._homePropRects.push({ x: px, y: propY, w: propBtnW, h: propBtnH, key: pkey });
    }

    // ===== Title =====
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '800 22px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = '#FFE07A';
    ctx.fillText('疯狂小球弹一弹', W / 2, 122);

    // ===== Scrollable Level Grid (v8 需求2: 3列, 80%宽) =====
    var gridTop = 136, gridBot = H - 20;
    var gridH = gridBot - gridTop;
    var gridW = W * 0.80;          // 80% 宽度
    var marginX = (W - gridW) / 2;
    var cols = 3, gap = 6;
    var cellW = (gridW - (cols - 1) * gap) / cols;  // ~94
    var cellH = 76;
    var totalItems = LEVELS.length;
    var totalRows = Math.ceil(totalItems / cols);
    var totalGridH = totalRows * (cellH + gap) + gap;
    var maxScroll = Math.max(0, totalGridH - gridH);
    S.homeScroll = Math.max(0, Math.min(maxScroll, S.homeScroll || 0));

    // Grid panel bg
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    roundRect(ctx, marginX - 6, gridTop, gridW + 12, gridH, 10);
    ctx.fill();

    // Clip grid area
    ctx.save();
    ctx.beginPath(); ctx.rect(marginX - 6, gridTop, gridW + 12, gridH); ctx.clip();

    var scroll = S.homeScroll || 0;
    S._homeRects = [];
    for (var gi = 0; gi < totalItems; gi++) {
      var lv = LEVELS[gi];
      var row = Math.floor(gi / cols), col = gi % cols;
      var cx0 = marginX + col * (cellW + gap);
      var cy0 = gridTop + gap + row * (cellH + gap) - scroll;
      // Skip if fully out of visible area
      if (cy0 + cellH < gridTop - 10 || cy0 > gridBot + 10) {
        S._homeRects.push(null); continue;
      }
      var pr = prog['lv' + gi];
      var done = pr && pr.stars > 0;
      var isCur = !done && (gi === firstUn);
      var locked = !done && !isCur && (gi > firstUn);

      // Cell bg
      if (isCur) {
        ctx.fillStyle = 'rgba(255,224,122,0.18)';
      } else if (done) {
        ctx.fillStyle = 'rgba(120,220,255,0.07)';
      } else {
        ctx.fillStyle = locked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)';
      }
      roundRect(ctx, cx0, cy0, cellW, cellH, 8);
      ctx.fill();

      // Level number (centered top)
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.font = '800 22px -apple-system, sans-serif';
      ctx.globalAlpha = locked ? 0.22 : 1;
      ctx.fillStyle = isCur ? '#FFE07A' : (done ? '#8FE3FF' : '#fff');
      ctx.fillText(String(lv.id), cx0 + cellW / 2, cy0 + 28);
      ctx.globalAlpha = 1;

      // Stars or lock (bottom)
      if (done) {
        var stStr = '';
        for (var sk = 0; sk < 3; sk++) stStr += sk < pr.stars ? '★' : '☆';
        ctx.font = '600 11px sans-serif'; ctx.fillStyle = '#FFE07A';
        ctx.fillText(stStr, cx0 + cellW / 2, cy0 + 56);
      } else if (locked) {
        ctx.font = '14px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillText('🔒', cx0 + cellW / 2, cy0 + 56);
      } else {
        ctx.font = '600 10px -apple-system, "PingFang SC", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('▶ 开始', cx0 + cellW / 2, cy0 + 56);
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
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
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

  function drawPauseDialog(ctx) {
    ctx.save();
    modalPanel(ctx, 260, 286);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#FFE07A';
    ctx.font = '800 22px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('已暂停', CFG.W / 2, (CFG.H - 286) / 2 - 10 + 46);
    var on = global.Sfx ? global.Sfx.isEnabled() : true;
    var labels = ['继续游戏', '回到主页', on ? '🔊  关闭声音' : '🔇  打开声音'];
    var keys = ['_btnResume', '_btnHome', '_btnSound'];
    var fills = ['#FFE07A', 'rgba(255,255,255,0.12)', 'rgba(120,220,255,0.16)'];
    var cols = ['#2A2140', 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0.92)'];
    var btnW = 200, btnH = 44, gap = 14;
    var by = (CFG.H - 286) / 2 - 10;
    var startY = by + 78;
    for (var i = 0; i < 3; i++) {
      var yy = startY + i * (btnH + gap);
      S[keys[i]] = dialogButton(ctx, labels[i], (CFG.W - btnW) / 2, yy, btnW, btnH, fills[i], cols[i]);
    }
    ctx.restore();
  }

  function drawBuyDialog(ctx, key) {
    var meta = PROPS[key], cnt = Game.getPropCount(key);
    ctx.save();
    var bh = 214;
    var p = modalPanel(ctx, 272, bh);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#FFE07A';
    ctx.font = '800 19px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('获取「' + meta.name + '」', CFG.W / 2, p.by + 42);
    ctx.fillStyle = 'rgba(255,255,255,0.66)';
    ctx.font = '500 11.5px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText(meta.desc, CFG.W / 2, p.by + 64);
    ctx.font = '700 16px -apple-system, sans-serif';
    ctx.fillStyle = '#DFF3FF';
    ctx.fillText('单价  💎 ' + meta.cost, CFG.W / 2, p.by + 96);
    ctx.font = '500 12px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('当前钱包  💎 ' + S.diamonds + '  ·  持有 ' + cnt, CFG.W / 2, p.by + 118);
    if (S.overlay && S.overlay.hint) {
      ctx.fillStyle = '#FF8A7A';
      ctx.font = '600 12px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText(S.overlay.hint, CFG.W / 2, p.by + 138);
    }
    var btnW = 110, btnH = 40, gap = 16;
    var bx2 = (CFG.W - (btnW * 2 + gap)) / 2, byy = p.by + bh - 54;
    S._btnBuyCancel = dialogButton(ctx, '取消', bx2, byy, btnW, btnH, 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.9)');
    S._btnBuyConfirm = dialogButton(ctx, '购买', bx2 + btnW + gap, byy, btnW, btnH, '#FFE07A', '#2A2140');
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * 主渲染
   * ------------------------------------------------------------------ */
  function render(ctx) {
    // v5 需求③：主页态整屏切换到主页，不渲染对局场景
    if (S.phase === Game.PHASE.HOME) {
      ctx.clearRect(0, 0, CFG.W, CFG.H);
      drawBackground(ctx);
      drawHome(ctx);
      // v8: 主页也可购买道具，需绘制覆盖层弹窗
      if (S.overlay && S.overlay.buy) drawBuyDialog(ctx, S.overlay.buy);
      return;
    }
    ctx.save();
    ctx.clearRect(0, 0, CFG.W, CFG.H);
    drawBackground(ctx);
    // v5 需求①：去掉整屏抖动，抖动只作用于「方块区」（竞技区框 + 方块）
    ctx.save();
    if (S.shake > 0.05) {
      ctx.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);
    }
    drawArena(ctx);
    drawBlocks(ctx);
    ctx.restore();
    drawCatchZone(ctx);
    drawAim(ctx);
    drawBalls(ctx);
    drawPaddle(ctx);
    drawParticles(ctx);
    drawPaddleBoost(ctx);
    drawMsgs(ctx);
    drawCombo(ctx);
    drawHUD(ctx);
    drawHint(ctx);
    // v5 需求②：底部主动道具栏（仅对局态显示）
    if (S.phase === Game.PHASE.PLAY || S.phase === Game.PHASE.READY) drawPropBar(ctx);
    ctx.restore();
    drawOverlay(ctx);
    // v5 需求③：暂停 / 购买弹窗（最上层，独立于抖动变换）
    if (S.overlay === 'pause') drawPauseDialog(ctx);
    else if (S.overlay && S.overlay.buy) drawBuyDialog(ctx, S.overlay.buy);
  }

  global.Render = { render: render, roundRect: roundRect };
})(window);
