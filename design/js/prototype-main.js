/**
 * 弹弹消消乐 · 交互原型 —— 主入口（输入 / 主循环 / 音效 / 调试面板）
 * 音效使用 WebAudio 实时合成，无需外部资源，双击 HTML 即可运行。
 */
(function (global) {
  'use strict';

  var CFG = global.TT.CFG;
  var Game = global.Game;
  var Render = global.Render;
  var S = Game.S;

  /* ================================================================== *
   * 音效（WebAudio 合成）
   * ================================================================== */
  var Sfx = (function () {
    var ctx = null, enabled = true;
    function ac() {
      if (!ctx) {
        var AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(freq, dur, type, vol, slideTo) {
      if (!enabled) return;
      var c = ac(); if (!c) return;
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(vol || 0.12, c.currentTime + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur + 0.02);
    }
    var lastWall = 0;
    var map = {
      shoot: function () { tone(520, 0.10, 'triangle', 0.10, 880); },
      brick: function () { tone(300 + Math.random() * 260, 0.07, 'square', 0.055); },
      wall: function () {
        var t = performance.now();
        if (t - lastWall < 45) return;   // 节流，避免连续反弹爆音
        lastWall = t;
        tone(150, 0.05, 'sine', 0.05, 90);
      },
      split: function () { tone(660, 0.20, 'sawtooth', 0.09, 1320); },
      'catch': function () { tone(880, 0.09, 'sine', 0.10, 1180); },
      lose: function () { tone(220, 0.16, 'square', 0.07, 90); },
      open: function () { tone(400, 0.28, 'triangle', 0.08, 200); },
      win: function () {
        tone(523, 0.14, 'triangle', 0.11);
        setTimeout(function () { tone(659, 0.14, 'triangle', 0.11); }, 110);
        setTimeout(function () { tone(784, 0.26, 'triangle', 0.12); }, 220);
      },
      fail: function () {
        tone(330, 0.20, 'sawtooth', 0.09, 220);
        setTimeout(function () { tone(220, 0.34, 'sawtooth', 0.09, 110); }, 170);
      }
    };
    /* 素材优先。TTAudio 内部自行判定「有 mp3 用 mp3，没素材就回调下面的合成器」，
       所以这里无条件转发即可；若 assets-loader 未加载（如 balance-sim 剥离副作用），
       TA 为空，自然退回纯合成路径。 */
    var TA = global.TTAudio;
    if (TA) TA.init({
      root: '../',
      volume: 0.7,
      synth: function (name) { if (enabled && map[name]) map[name](); }
    });

    return {
      play: function (name) {
        if (TA) TA.play(name);
        else if (enabled && map[name]) map[name]();
      },
      toggle: function () {
        enabled = !enabled;
        if (TA) TA.setEnabled(enabled);
        return enabled;
      },
      isEnabled: function () { return enabled; },
      setVolume: function (v) { if (TA) TA.setVolume(v); },
      getVolume: function () { return TA ? TA.getVolume() : 0.7; },
      /* 移动端首次手势解锁，对应 §6.2 硬约束① */
      unlock: function () { if (TA) TA.unlock(); }
    };
  })();

  /* ================================================================== *
   * 本地存档（对应小程序 wx.setStorageSync）
   * ================================================================== */
  var Storage = {
    KEY: 'tantan_progress_v1',
    read: function () {
      try { return JSON.parse(global.localStorage.getItem(this.KEY)) || {}; }
      catch (e) { return {}; }
    },
    save: function (levelIndex, stars, score) {
      var d = this.read();
      var k = 'lv' + levelIndex;
      var prev = d[k] || { stars: 0, best: 0 };
      d[k] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, score) };
      try { global.localStorage.setItem(this.KEY, JSON.stringify(d)); } catch (e) {}
    }
  };

  global.Sfx = Sfx;
  global.Storage = Storage;

  /* ================================================================== *
   * v5 需求①②：钱包（钻石）+ 主动道具背包，跨局持久化
   * ================================================================== */
  var Wallet = {
    KEY: 'tantan_wallet_v1',
    read: function () {
      try { return JSON.parse(global.localStorage.getItem(this.KEY)) || null; }
      catch (e) { return null; }
    },
    save: function (w) {
      try { global.localStorage.setItem(this.KEY, JSON.stringify(w)); } catch (e) {}
    }
  };
  global.Wallet = Wallet;
  // core 在结算/使用/购买后回调，统一落盘（sandbox/无 localStorage 时自然失败但不报错）
  Game.onWalletChange = function (w) { Wallet.save(w); };

  /* ================================================================== *
   * Canvas 初始化与自适应
   * ================================================================== */
  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var scale = 1;

  function resize() {
    var wrap = document.getElementById('phone');
    var availH = wrap.parentElement.clientHeight || 720;
    var cssW = Math.min(wrap.parentElement.clientWidth - 40, 400);
    var cssH = cssW * (CFG.H / CFG.W);
    var maxH = Math.max(420, availH - 20);
    if (cssH > maxH) { cssH = maxH; cssW = cssH * (CFG.W / CFG.H); }
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    var dpr = Math.min(global.devicePixelRatio || 1, 3);
    canvas.width = Math.round(CFG.W * dpr);
    canvas.height = Math.round(CFG.H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = cssW / CFG.W;
  }

  function toLogical(evt) {
    var rect = canvas.getBoundingClientRect();
    var src = evt.touches && evt.touches[0] ? evt.touches[0] : evt;
    return {
      x: (src.clientX - rect.left) / scale,
      y: (src.clientY - rect.top) / scale
    };
  }

  /* ================================================================== *
   * 输入（v2：关卡内唯一 PHASE.PLAY，瞄准/发射/回弹/接球并行）
   *   按住「横条本身」拖动 = 移动挡板（摆位 + 接球回弹，回弹方向跟随拖动方向）；
   *   按住「其它区域」拖动 = 瞄准（只显真实弹道预测点列，需求已拍板去掉虚线），
   *     松手发射，消耗 1 次发射机会（每关共 3 次，可连发也可等落地再发）。
   * ================================================================== */
  var dragging = false;
  var dragMode = null;   // 'aim' | 'paddle' | 'homeScroll'
  var grabDX = 0;
  var lastPointer = { x: 0, y: 0 };
  var homeScrollStartY = 0, homePointerStartY = 0, homePointerMoved = false;
  var nudgeTimer = null;

  function hitRect(p, r) {
    return r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  /** v5：命中底部道具按钮，返回其 key（未命中返回 null）；布局由 render 写入 S._propBtns */
  function hitProp(p) {
    var rects = S._propBtns;
    if (!rects) return null;
    for (var i = 0; i < rects.length; i++) if (hitRect(p, rects[i])) return rects[i].key;
    return null;
  }

  function onPaddle(p) {
    return p.y >= CFG.PADDLE_Y - 26 && p.y <= CFG.PADDLE_Y + CFG.PADDLE_H + 30 &&
      p.x >= S.paddle.x - 18 && p.x <= S.paddle.x + S.paddle.w + 18;
  }

  function onDown(evt) {
    evt.preventDefault();
    var p = toLogical(evt);
    dragging = true;

    // v8：主页 —— 滚动关卡列表 + 点选关卡 + 点购买道具（覆盖层优先）
    if (S.phase === Game.PHASE.HOME && !S.overlay) {
      dragMode = 'homeScroll';
      homeScrollStartY = p.y; homePointerStartY = p.y; homePointerMoved = false;
      return;
    }

    // v5 需求③：暂停弹窗 —— 继续 / 回到主页 / 开关声音
    if (S.overlay === 'pause') {
      if (hitRect(p, S._btnResume)) Game.resume();
      else if (hitRect(p, S._btnHome)) Game.toHome();
      else if (hitRect(p, S._btnSound)) { UI.toggleSound(); }
      dragging = false; dragMode = null;
      return;
    }

    // v5 需求②：购买弹窗 —— 确认扣钻 / 取消
    if (S.overlay && S.overlay.buy) {
      var bkey = S.overlay.buy;
      if (hitRect(p, S._btnBuyConfirm)) {
        if (!Game.buyProp(bkey)) Game.setBuyHint('钻石不足，通关可获取钻石');
        else Game.closeBuy();
      } else if (hitRect(p, S._btnBuyCancel)) {
        Game.closeBuy();
      }
      dragging = false; dragMode = null;
      return;
    }

    // v5 需求②③：对局中，暂停按钮与道具按钮优先于瞄准/挡板
    if (S.phase === Game.PHASE.PLAY || S.phase === Game.PHASE.READY) {
      if (hitRect(p, S._btnPause)) {
        Game.openPause();
        dragging = false; dragMode = null;
        return;
      }
      var pk = hitProp(p);
      if (pk) {
        if (Game.getPropCount(pk) > 0) Game.useProp(pk);   // 有数量→使用一次
        else Game.openBuy(pk);                              // 为 0→弹窗引导购买
        dragging = false; dragMode = null;
        return;
      }
    }

    if (S.phase === Game.PHASE.WIN || S.phase === Game.PHASE.LOSE) {
      if (hitRect(p, S._btnNext)) {
        var next = S.phase === Game.PHASE.WIN
          ? (S.levelIndex + 1) % global.TT.LEVELS.length
          : S.levelIndex;
        Game.loadLevel(next);
        UI.syncLevels();
        setTimeout(Game.beginAim, 40);
      } else if (hitRect(p, S._btnRetry)) {
        Game.restart();
        setTimeout(Game.beginAim, 40);
      }
      dragging = false; dragMode = null;
      return;
    }

    if (S.phase === Game.PHASE.READY) Game.beginAim();   // 首次触摸即开场计时

    if (S.phase === Game.PHASE.PLAY) {
      if (onPaddle(p)) {
        // 抓住横条：接管挡板（摆位/接球），同时取消未完成的瞄准
        dragMode = 'paddle';
        grabDX = p.x - (S.paddle.x + S.paddle.w / 2);
        Game.clearAim();
        Game.movePaddleTo(p.x - grabDX);
      } else if (S.shotsLeft > 0) {
        dragMode = 'aim';
        Game.updateAim(p.x, p.y);
      } else {
        // 弹药已用完：空白拖动也兼作接管挡板，保证接球手感不断档
        dragMode = 'paddle';
        grabDX = 0;
        Game.movePaddleTo(p.x);
      }
    } else {
      dragMode = null;
    }
  }

  function onMove(evt) {
    if (!dragging || !dragMode) return;
    evt.preventDefault();
    var p = toLogical(evt);
    lastPointer = p;
    if (dragMode === 'homeScroll') {
      var dy = homeScrollStartY - p.y;
      homeScrollStartY = p.y;
      S.homeScroll += dy;
      if (Math.abs(p.y - homePointerStartY) > 8) homePointerMoved = true;
      return;
    }
    if (dragMode === 'aim' && S.phase === Game.PHASE.PLAY) Game.updateAim(p.x, p.y);
    else if (dragMode === 'paddle') {
      Game.movePaddleTo(p.x - grabDX);
      // 摆位过程中若存在瞄准，同步刷新弹道预测
      if (S.aim.active) Game.updateAim(S.aim.x, S.aim.y);
    }
  }

  function onUp(evt) {
    if (!dragging) return;
    dragging = false;
    if (dragMode === 'homeScroll') {
      if (!homePointerMoved) {
        var p = toLogical(evt);
        handleHomeTap(p);
      }
      dragMode = null; return;
    }
    if (dragMode === 'aim' && S.phase === Game.PHASE.PLAY && S.aim.active) Game.shoot();
    dragMode = null;
  }

  /** v8：主页关卡列表点选 + 道具购买 */
  function handleHomeTap(p) {
    // 道具按钮点击 → 打开购买弹窗
    var propRects = S._homePropRects;
    if (propRects) {
      for (var pi = 0; pi < propRects.length; pi++) {
        var pr = propRects[pi];
        if (pr && hitRect(p, pr)) {
          Game.openBuy(pr.key);
          return;
        }
      }
    }
    // 关卡格子点击
    var rects = S._homeRects;
    if (!rects) return;
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (!r || r.locked) continue;
      if (hitRect(p, r)) {
        Game.loadLevel(r.index);
        UI.syncLevels();
        setTimeout(Game.beginAim, 40);
        return;
      }
    }
  }

  canvas.addEventListener('mousedown', onDown);
  global.addEventListener('mousemove', onMove);
  global.addEventListener('mouseup', onUp);
  canvas.addEventListener('touchstart', onDown, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onUp);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* 首次手势解锁音频（§6.2 硬约束①：微信 iOS InnerAudioContext 首次播放延迟 100~300ms）。
     只触发一次即自解绑；无 mp3 素材时 unlock 为空操作，不会报错。 */
  function unlockAudio() {
    Sfx.unlock();
    canvas.removeEventListener('touchstart', unlockAudio);
    canvas.removeEventListener('mousedown', unlockAudio);
  }
  canvas.addEventListener('touchstart', unlockAudio, { passive: true });
  canvas.addEventListener('mousedown', unlockAudio);

  /* ================================================================== *
   * 主循环
   * ================================================================== */
  var last = 0;
  function loop(ts) {
    if (!last) last = ts;
    var dt = Math.min(0.033, (ts - last) / 1000);
    last = ts;
    Game.update(dt);
    Render.render(ctx);
    UI.syncStats();
    global.requestAnimationFrame(loop);
  }

  /* ================================================================== *
   * 调试 / 控制面板
   * ================================================================== */
  var UI = (function () {
    var el = {};
    function $(id) { return document.getElementById(id); }

    function bind() {
      // 依据 TT.LEVELS 动态生成关卡按钮（关卡增删无需再改 HTML）
      var row = $('levelRow');
      if (row) {
        row.innerHTML = '';
        global.TT.LEVELS.forEach(function (lv, i) {
          var btn = document.createElement('button');
          btn.className = 'lv';
          btn.setAttribute('data-level', i);
          btn.appendChild(document.createTextNode('第 ' + (i + 1) + ' 关 · ' + lv.name));
          var star = document.createElement('span');
          star.className = 'lv-star';
          btn.appendChild(star);
          row.appendChild(btn);
        });
      }
      el.levelBtns = Array.prototype.slice.call(document.querySelectorAll('[data-level]'));
      el.stats = {
        phase: $('stPhase'), shots: $('stShots'), elapsed: $('stHeld'),
        balls: $('stBalls'), destroyed: $('stDestroyed'), score: $('stScore'),
        combo: $('stCombo'), round: $('stRound'), gap: $('stGap'), paddleX: $('stPaddleX')
      };
      el.speed = $('pSpeed'); el.speedV = $('pSpeedV');
      el.stall = $('pStall'); el.stallV = $('pStallV');
      el.maxBalls = $('pMaxBalls'); el.maxBallsV = $('pMaxBallsV');
      el.paddleW = $('pPaddleW'); el.paddleWV = $('pPaddleWV');
      el.angle = $('pAngle'); el.angleV = $('pAngleV');
      el.btnSound = $('btnSound');

      el.levelBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          Game.loadLevel(parseInt(btn.getAttribute('data-level'), 10));
          syncLevels();
          setTimeout(Game.beginAim, 40);
        });
      });

      $('btnRestart').addEventListener('click', function () {
        Game.restart(); setTimeout(Game.beginAim, 40);
      });
      $('btnShoot').addEventListener('click', function () {
        if (S.phase === Game.PHASE.READY) Game.beginAim();
        if (S.phase !== Game.PHASE.PLAY || S.shotsLeft <= 0) return;
        // 桌面调试：随机角度自动发射
        var a = (Math.random() * 2 - 1) * CFG.MAX_AIM_ANGLE * 0.8;
        S.aim.dx = Math.sin(a); S.aim.dy = -Math.cos(a);
        S.aim.active = true;
        Game.shoot();
      });
      $('btnSound').addEventListener('click', toggleSound);
      $('btnLeft').addEventListener('mousedown', function () { startNudge(-1); });
      $('btnRight').addEventListener('mousedown', function () { startNudge(1); });
      global.addEventListener('mouseup', stopNudge);
      $('btnLeft').addEventListener('click', function () { Game.nudgePaddle(-8); });
      $('btnRight').addEventListener('click', function () { Game.nudgePaddle(8); });

      bindSlider(el.speed, el.speedV, function (v) { CFG.BALL_SPEED = v; }, ' px/s');
      bindSlider(el.stall, el.stallV, function (v) { CFG.LEVEL_TIMEOUT = v; }, ' s');
      bindSlider(el.maxBalls, el.maxBallsV, function (v) { CFG.MAX_BALLS = v; }, ' 颗');
      bindSlider(el.paddleW, el.paddleWV, function (v) {
        CFG.PADDLE_W = v; S.paddle.w = v;
        S.paddle.x = Game.clamp(S.paddle.x, CFG.PAD, CFG.W - CFG.PAD - v);
        S.paddle.targetX = S.paddle.x;
      }, ' px');
      bindSlider(el.angle, el.angleV, function (v) { CFG.MAX_AIM_ANGLE = v * Math.PI / 180; }, '°');
    }

    function bindSlider(input, label, apply, unit) {
      if (!input) return;
      var run = function () {
        var v = parseFloat(input.value);
        label.textContent = v + unit;
        apply(v);
      };
      input.addEventListener('input', run);
      run();
    }

    function startNudge(dir) {
      stopNudge();
      nudgeTimer = setInterval(function () { Game.nudgePaddle(dir * 4); }, 40);
    }
    function stopNudge() {
      if (nudgeTimer) { clearInterval(nudgeTimer); nudgeTimer = null; }
    }

    /** v5 需求③：切换声音（面板按钮与暂停弹窗共用），同步面板按钮文案 */
    function toggleSound() {
      var on = Sfx.toggle();
      if (el.btnSound) {
        el.btnSound.textContent = on ? '🔊 音效开' : '🔇 音效关';
        el.btnSound.classList.toggle('off', !on);
      }
      return on;
    }

    function syncLevels() {
      el.levelBtns.forEach(function (btn) {
        var i = parseInt(btn.getAttribute('data-level'), 10);
        btn.classList.toggle('active', i === S.levelIndex);
        var d = Storage.read()['lv' + i];
        var star = btn.querySelector('.lv-star');
        if (star) star.textContent = d && d.stars ? '★'.repeat(d.stars) : '';
      });
    }

    var PHASE_NAME = {
      ready: '开场提示', play: '进行中（瞄准/回弹/接球）', win: '通关', lose: '失败'
    };

    function syncStats() {
      var e = el.stats;
      if (!e.phase) return;
      e.phase.textContent = PHASE_NAME[S.phase] || S.phase;
      e.phase.className = 'v phase-' + S.phase;
      e.shots.textContent = S.shotsLeft + ' / ' + (S.level ? S.level.balls : '-');
      e.elapsed.textContent = S.elapsed.toFixed(1) + 's';
      e.balls.textContent = S.balls.length;
      e.destroyed.textContent = S.destroyed + ' / ' + S.totalBricks;
      e.score.textContent = S.score;
      e.combo.textContent = 'x' + S.combo;
      e.round.textContent = S.phase === Game.PHASE.PLAY
        ? Math.max(0, CFG.LEVEL_TIMEOUT - S.elapsed).toFixed(1) + 's' : '—';
      e.round.style.color = (S.phase === Game.PHASE.PLAY && !S.bottomOpened &&
        (CFG.LEVEL_TIMEOUT - S.elapsed) < CFG.OPEN_WARN)
        ? '#FF8A7A' : '';
      var gapTxt = S.gapCols.length
        ? S.gapCols.join(',') + ' 列（' + Math.round(S.gapCols.length * CFG.CELL) + 'px）' : '-';
      e.gap.textContent = gapTxt;
      e.paddleX.textContent = Math.round(S.paddle.x + S.paddle.w / 2) + 'px';
    }

    return { bind: bind, syncLevels: syncLevels, syncStats: syncStats, toggleSound: toggleSound };
  })();

  /* ================================================================== *
   * 启动
   * ================================================================== */
  function boot() {
    UI.bind();
    resize();
    global.addEventListener('resize', resize);
    // v5：读钱包存档注入 core，并先进入主页（需求③），点“开始游戏”再进关卡
    Game.setWallet(Wallet.read());
    Game.loadLevel(0);
    UI.syncLevels();
    Game.toHome();
    global.requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
