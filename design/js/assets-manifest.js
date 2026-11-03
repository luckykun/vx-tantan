/**
 * 弹弹消消乐 · 素材清单（唯一事实源）
 *
 * 本文件同时被三处消费，因此必须是纯数据、无 DOM 依赖：
 *   ① 浏览器运行时  —— design/js/prototype-main.js 经 assets-loader.js 预加载与回退判定
 *   ② Node 校验脚本 —— design/js/assets-check.js 逐条比对磁盘文件，输出退出码门禁
 *   ③ 文档          —— design/assets/README.md 的投放清单与本表一一对应
 *
 * 清单来源：design/ui-mockups.html §6.1「需美术出图」与 §6.2「音频」。
 * 该章的原则是「能用程序画的一律不出图」，所以方块、小球、横条、弹道线、粒子
 * 全部走 Canvas 程序绘制，本清单里**不含**它们的位图；只有图标与背景需要出图。
 *
 * 字段说明
 *   key      运行时句柄，渲染层用 TTAssets.get(key) 取，取不到即回退程序绘制
 *   file     相对 basePath 的路径（斜杠分隔，Node 与浏览器一致）
 *   w / h    期望像素尺寸；check 脚本据此判定「尺寸不符」
 *   tier     'M0' 原型必须 / 'M1' 正式版需要 / 'P1' 可延后
 *   note     用途备注（供美术与后续维护对照）
 */
(function (global) {
  'use strict';

  var TT_ASSETS = {

    /* 素材根，相对仓库根目录。静态服务器需以仓库根为 ROOT 才能命中。 */
    basePath: 'design/assets',

    /* ---------------------------------------------------------------- *
     * 位图
     * ---------------------------------------------------------------- */
    images: [
      /* --- App 图标 --- */
      { key: 'appicon.main',   file: 'images/appicon/icon-1024.png', w: 1024, h: 1024, tier: 'M1', note: 'App 图标，提交审核用' },

      /* --- 背景 --- */
      { key: 'bg.dark',        file: 'images/bg/bg-dark.png',        w: 1125, h: 2001, tier: 'M1', note: '主背景（暗主题，深夜台球厅路线）' },
      { key: 'bg.light',       file: 'images/bg/bg-light.png',       w: 1125, h: 2001, tier: 'P1', note: '备选亮背景' },

      /* --- UI 底板（.9 图，四角与四边保留、中间拉伸） --- */
      { key: 'panel.hud',      file: 'images/panel/hud.9.png',       w: 120,  h: 120,  tier: 'M1', note: 'HUD 三段式底板' },
      { key: 'panel.dialog',   file: 'images/panel/dialog.9.png',    w: 180,  h: 180,  tier: 'M1', note: '结算 / 确认浮层底板' },
      { key: 'panel.sheet',    file: 'images/panel/sheet.9.png',     w: 160,  h: 160,  tier: 'M1', note: '底部抽屉面板底板' },

      /* --- 功能图标 64² --- */
      { key: 'icon.pause',     file: 'images/icon/pause.png',        w: 64,   h: 64,   tier: 'M0', note: '暂停' },
      { key: 'icon.resume',    file: 'images/icon/resume.png',       w: 64,   h: 64,   tier: 'M1', note: '继续' },
      { key: 'icon.settings',  file: 'images/icon/settings.png',     w: 64,   h: 64,   tier: 'M1', note: '设置' },
      { key: 'icon.soundOn',   file: 'images/icon/sound-on.png',     w: 64,   h: 64,   tier: 'M0', note: '音效开' },
      { key: 'icon.soundOff',  file: 'images/icon/sound-off.png',    w: 64,   h: 64,   tier: 'M0', note: '音效关' },
      { key: 'icon.vibrateOn', file: 'images/icon/vibrate-on.png',   w: 64,   h: 64,   tier: 'M1', note: '震动开' },
      { key: 'icon.vibrateOff',file: 'images/icon/vibrate-off.png',  w: 64,   h: 64,   tier: 'M1', note: '震动关' },
      { key: 'icon.share',     file: 'images/icon/share.png',        w: 64,   h: 64,   tier: 'M1', note: '分享' },
      { key: 'icon.rank',      file: 'images/icon/rank.png',         w: 64,   h: 64,   tier: 'M1', note: '排行榜' },
      { key: 'icon.back',      file: 'images/icon/back.png',         w: 64,   h: 64,   tier: 'M1', note: '返回' },
      { key: 'icon.home',      file: 'images/icon/home.png',         w: 64,   h: 64,   tier: 'M1', note: '主页' },
      { key: 'icon.help',      file: 'images/icon/help.png',         w: 64,   h: 64,   tier: 'M1', note: '帮助 / 引导' },
      { key: 'icon.ad',        file: 'images/icon/ad.png',           w: 64,   h: 64,   tier: 'M1', note: '激励视频入口' },
      { key: 'icon.restart',   file: 'images/icon/restart.png',      w: 64,   h: 64,   tier: 'M1', note: '重开本关' },

      /* --- 星星 --- */
      { key: 'star.big',       file: 'images/star/star-big.png',     w: 96,   h: 96,   tier: 'M1', note: '结算大星（逐颗弹入）' },
      { key: 'star.small',     file: 'images/star/star-small.png',   w: 32,   h: 32,   tier: 'M1', note: '关卡选择小星（点亮态）' },
      { key: 'star.gray',      file: 'images/star/star-gray.png',    w: 32,   h: 32,   tier: 'M1', note: '关卡选择小星（未点亮态）' },

      /* --- 锁 --- */
      { key: 'lock.locked',    file: 'images/lock/locked.png',       w: 48,   h: 48,   tier: 'M1', note: '未解锁关卡标记' },
      { key: 'lock.unlocked',  file: 'images/lock/unlocked.png',     w: 48,   h: 48,   tier: 'M1', note: '已解锁标记' },

      /* --- 分享卡片底图 --- */
      { key: 'share.default',  file: 'images/share/card-default.png', w: 500, h: 400,  tier: 'M1', note: '通用分享卡片底图' },
      { key: 'share.win',      file: 'images/share/card-win.png',     w: 500, h: 400,  tier: 'M1', note: '通关炫耀分享底图' },

      /* --- 皮肤（P1，正式版后置） --- */
      { key: 'skin.classic',   file: 'images/skin/skin-classic.png',  w: 120,  h: 120,  tier: 'P1', note: '皮肤图标 · 经典' },
      { key: 'skin.neon',      file: 'images/skin/skin-neon.png',     w: 120,  h: 120,  tier: 'P1', note: '皮肤图标 · 霓虹' },
      { key: 'skin.candy',     file: 'images/skin/skin-candy.png',    w: 120,  h: 120,  tier: 'P1', note: '皮肤图标 · 糖果' },
      { key: 'skin.wood',      file: 'images/skin/skin-wood.png',     w: 120,  h: 120,  tier: 'P1', note: '皮肤图标 · 木纹' },
      { key: 'skin.gold',      file: 'images/skin/skin-gold.png',     w: 120,  h: 120,  tier: 'P1', note: '皮肤图标 · 鎏金' },
      { key: 'skin.cosmos',    file: 'images/skin/skin-cosmos.png',   w: 120,  h: 120,  tier: 'P1', note: '皮肤图标 · 宇宙' }
    ],

    /* ---------------------------------------------------------------- *
     * 音频
     *
     * 每条都带 synth: true —— 表示「素材缺失时可用程序合成音兜底」，
     * 兜底波形见 design/js/prototype-main.js 的 Sfx.map，与 §12 的频率时长一致。
     * 因此音效缺失不影响原型可玩，只是听感朴素。
     *
     * §6.2 的两条硬约束在 loader 里落实，勿在业务代码中绕过：
     *   ① 微信 iOS InnerAudioContext 首次播放延迟 100~300ms，需启动时预创建并静音播一次；
     *   ② 高频音效（brick / wall）必须用实例池轮转，每次 new 会内存泄漏并爆音。
     * ---------------------------------------------------------------- */
    audio: [
      { key: 'shoot',  file: 'audio/shoot.mp3',  ms: 100, pool: 1, synth: true, tier: 'M0', note: '发射' },
      { key: 'brick',  file: 'audio/brick.mp3',  ms: 70,  pool: 6, synth: true, tier: 'M0', note: '消除方块（高频，需实例池）' },
      { key: 'wall',   file: 'audio/wall.mp3',   ms: 50,  pool: 6, synth: true, tier: 'M0', note: '撞墙（高频，需实例池 + 45ms 节流）' },
      { key: 'split',  file: 'audio/split.mp3',  ms: 200, pool: 2, synth: true, tier: 'M0', note: '分裂（招牌时刻，最强反馈）' },
      { key: 'catch',  file: 'audio/catch.mp3',  ms: 90,  pool: 3, synth: true, tier: 'M0', note: '接住球' },
      { key: 'lose',   file: 'audio/lose.mp3',   ms: 160, pool: 2, synth: true, tier: 'M0', note: '漏接' },
      { key: 'open',   file: 'audio/open.mp3',   ms: 280, pool: 1, synth: true, tier: 'M0', note: '超时开底' },
      { key: 'win',    file: 'audio/win.mp3',    ms: 480, pool: 1, synth: true, tier: 'M0', note: '通关' },
      { key: 'fail',   file: 'audio/fail.mp3',   ms: 540, pool: 1, synth: true, tier: 'M0', note: '失败' },
      { key: 'ui',     file: 'audio/ui.mp3',     ms: 60,  pool: 2, synth: true, tier: 'M1', note: '按钮点击' },
      { key: 'bgm',    file: 'audio/bgm.mp3',    ms: 0,   pool: 1, synth: false, tier: 'P1', loop: true, note: '背景音乐 60~90s，需无缝接缝' }
    ],

    /* 格式约束，check 脚本据此判定（单位：字节） */
    limits: {
      imageMaxBytes: 150 * 1024,   // 单张位图上限，超出视为未压缩
      audioMaxBytes: 220 * 1024,   // 单个音效上限（§6.2：64kbps 单声道）
      audioTotalMaxBytes: 300 * 1024,  // 10 个音效合计目标 ≈ 2.6s
      bgmMaxBytes: 1024 * 1024
    }
  };

  global.TT_ASSETS = TT_ASSETS;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TT_ASSETS;
  }
})(typeof window !== 'undefined' ? window : global);
