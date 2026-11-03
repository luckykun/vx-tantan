/**
 * 弹弹消消乐 · 素材加载与回退层
 *
 * 设计前提：**素材文件可以整体不存在，此时页面必须照常可玩、控制台不得刷屏**。
 * 当前仓库就是这个状态（美术素材待投放），所以本模块的默认行为是「安静地全部回退」。
 *
 * 两块能力：
 *   TTAssets —— 位图预加载，get(key) 取不到就返回 null，由渲染层走程序绘制
 *   TTAudio  —— 音效播放，素材缺失时回调注入的程序合成器（prototype-main.js 的 Sfx）
 *
 * 落实 §6.2 的两条硬约束：
 *   ① 启动时预创建实例并静音播一次（unlock），规避微信 iOS 首次播放 100~300ms 延迟；
 *   ② 高频音效用实例池轮转（pool 字段），不每次 new。
 */
(function (global) {
  'use strict';

  var M = global.TT_ASSETS;
  if (!M) {
    console.warn('[TTAssets] 缺少 assets-manifest.js，素材层整体禁用');
  }

  /* ================================================================== *
   * 位图
   * ================================================================== */
  var cache = {};        // key -> HTMLImageElement（仅加载成功的）
  var missing = {};      // key -> true
  var status = 'idle';   // 'idle' | 'probing' | 'loading' | 'ready' | 'absent'
  var rootPrefix = '../';

  function urlOf(file) { return rootPrefix + M.basePath + '/' + file; }

  function loadImage(entry, onOk, onErr) {
    var img = new Image();
    img.onload = function () { onOk(entry, img); };
    img.onerror = function () { onErr(entry); };
    img.src = urlOf(entry.file);
  }

  /**
   * 预加载全部位图。
   *
   * 先拿清单第一条当哨兵：它加载失败即认定「素材整体尚未投放」，
   * 直接跳过其余请求 —— 否则会一次性制造几十条 404，把控制台埋掉。
   *
   * @param {function} done  回调，参数为状态字符串
   * @param {object}   opts  { root: 相对页面路径前缀，默认 '../' }
   */
  function preload(opts, done) {
    opts = opts || {};
    done = done || function () {};
    if (!M) { status = 'absent'; return done(status); }
    if (typeof opts.root === 'string') rootPrefix = opts.root;
    if (status !== 'idle') { done(status); return; }

    var first = M.images[0];
    if (!first) { status = 'ready'; return done(status); }

    status = 'probing';
    loadImage(first, function (e, img) {
      cache[e.key] = img;
      status = 'loading';
      var rest = M.images.slice(1);
      var pending = rest.length;
      if (!pending) { status = 'ready'; return done(status); }
      rest.forEach(function (e) {
        loadImage(e,
          function (ee, ii) { cache[ee.key] = ii; if (--pending === 0) { status = 'ready'; done(status); } },
          function (ee) { missing[ee.key] = true; if (--pending === 0) { status = 'ready'; done(status); } }
        );
      });
    }, function (e) {
      // 哨兵失败：认定素材目录为空，其余一律不发请求
      missing[first.key] = true;
      status = 'absent';
      console.info('[TTAssets] 素材未投放（' + urlOf(first.file) + ' 不可达），全部回退程序绘制');
      done(status);
    });
  }

  /** 取已加载的位图；未投放或加载失败返回 null，调用方须回退程序绘制。 */
  function get(key) { return cache[key] || null; }

  function has(key) { return !!cache[key]; }

  function stats() {
    if (!M) return { total: 0, ok: 0, missing: 0, status: status };
    var ok = Object.keys(cache).length;
    return { total: M.images.length, ok: ok, missing: M.images.length - ok, status: status };
  }

  /** 把缺失清单打到控制台，方便对着 src/assets/README.md 逐条补货。 */
  function report() {
    var s = stats();
    var miss = (M ? M.images : []).filter(function (e) { return !cache[e.key]; });
    console.info('[TTAssets] 位图 ' + s.ok + '/' + s.total + ' 已加载，状态 ' + s.status);
    miss.forEach(function (e) { console.info('   · 缺 ' + e.file + '  (' + e.w + '×' + e.h + ') ' + e.note); });
    return miss;
  }

  global.TTAssets = {
    preload: preload, get: get, has: has, stats: stats, report: report,
    urlOf: urlOf,
    status: function () { return status; }
  };

  /* ================================================================== *
   * 音频
   *
   * 与位图同理：素材缺失时不自证报错，而是把播放请求转发给外部注入的
   * 程序合成器。合成器由 prototype-main.js 用 Sfx 提供。
   * ================================================================== */
  var pools = {};        // key -> { list:[Audio], next:0, entry }
  var audioAvailable = {};  // key -> true（文件确实加载成功）
  var enabled = true;
  var volume = 0.7;
  var synthFn = null;    // 回退用的程序合成器
  var audioRoot = '../';
  var audioStatus = 'idle';

  function audioUrl(entry) { return audioRoot + M.basePath + '/' + entry.file; }

  /** 为某条音效建实例池；pool 个共享一个 src，轮转使用。 */
  function buildPool(entry) {
    var n = entry.pool || 1, list = [];
    for (var i = 0; i < n; i++) {
      var a = new Audio();
      a.preload = 'auto';
      a.src = audioUrl(entry);
      a.volume = volume;
      if (entry.loop) a.loop = true;
      list.push(a);
    }
    pools[entry.key] = { list: list, next: 0, entry: entry };
    list[0].addEventListener('canplaythrough', function () { audioAvailable[entry.key] = true; }, { once: true });
    list[0].addEventListener('error', function () {
      if (audioStatus !== 'absent') {
        audioStatus = 'absent';
        console.info('[TTAudio] 音效素材未投放，全部回退程序合成');
      }
    }, { once: true });
  }

  /**
   * 初始化音频层。
   * @param {object} opts { root, volume, synth(key) }
   */
  function initAudio(opts) {
    opts = opts || {};
    if (!M) return;
    if (typeof opts.root === 'string') audioRoot = opts.root;
    if (typeof opts.volume === 'number') volume = opts.volume;
    if (typeof opts.synth === 'function') synthFn = opts.synth;
    if (audioStatus !== 'idle') return;
    audioStatus = 'ready';
    M.audio.forEach(function (e) { if (!e.loop) buildPool(e); });
  }

  /**
   * 播放。素材可用走素材，否则走程序合成 —— 调用方无需关心差异。
   * 高频音效（brick / wall）在此处做轮转，避免同一实例被重复触发导致截音。
   */
  function play(key) {
    if (!enabled) return;
    var p = pools[key];
    if (p && audioAvailable[key]) {
      var a = p.list[p.next];
      p.next = (p.next + 1) % p.list.length;
      try { a.currentTime = 0; var pr = a.play(); if (pr && pr.catch) pr.catch(function () {}); }
      catch (err) { if (synthFn) synthFn(key); }
      return;
    }
    if (synthFn) synthFn(key);
  }

  /** 首次用户手势里调用，解锁移动端自动播放限制（对应 §6.2 约束①）。 */
  function unlock() {
    Object.keys(pools).forEach(function (k) {
      var a = pools[k].list[0];
      var v = a.volume;
      a.volume = 0.0001;
      try { var pr = a.play(); if (pr && pr.then) pr.then(function () { a.pause(); a.currentTime = 0; a.volume = v; }); }
      catch (err) { a.volume = v; }
    });
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    Object.keys(pools).forEach(function (k) {
      pools[k].list.forEach(function (a) { a.volume = volume; });
    });
  }

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) stopAll();
    return enabled;
  }

  function stopAll() {
    Object.keys(pools).forEach(function (k) {
      pools[k].list.forEach(function (a) { try { a.pause(); a.currentTime = 0; } catch (e) {} });
    });
  }

  function startBgm() {
    if (!M) return;
    var e = M.audio.filter(function (x) { return x.loop; })[0];
    if (!e || pools[e.key]) { if (pools[e.key]) play(e.key); return; }
    buildPool(e);
    play(e.key);
  }

  global.TTAudio = {
    init: initAudio, play: play, unlock: unlock, stopAll: stopAll,
    setVolume: setVolume, getVolume: function () { return volume; },
    setEnabled: setEnabled, isEnabled: function () { return enabled; },
    startBgm: startBgm,
    stats: function () {
      if (!M) return { total: 0, ok: 0, status: audioStatus };
      var ok = Object.keys(audioAvailable).length;
      return { total: M.audio.length, ok: ok, status: audioStatus };
    }
  };
})(typeof window !== 'undefined' ? window : global);
