/**
 * 弹弹消消乐 · 交互原型 —— 配置 / 调色板 / 关卡数据（v4）
 * 逻辑分辨率 375×667 仅是【设计基准】（等同小程序 750rpx 稿的一半），
 * 真机按 windowWidth / windowHeight 等比缩放：30 列是规格，px 只是推导结果。
 *
 * v3 变更（见 TODO.md 需求 ①~⑤）：
 *   ① 关卡扩至前 10 关样板（后续按形状分批补齐 100 关）；
 *   ② 道具方块四种：分裂球 S（已有）、生命球 L（剩余发射 +1）、
 *      爆炸球 X（清空 3×3 九宫格）、挡板球 P（挡板满宽 10s，末 3s 闪烁）；
 *   ③ 首次发射后才开始计时（elapsed 仅在 launched>0 时累加）；
 *   ④ 顶部 HUD 四栏：关卡 · 耗时 · 剩余发射 · 消除进度（进度条样式）；
 *   ⑤ 移除停滞倒计时，仅保留关卡硬超时（LEVEL_TIMEOUT=180s）开底；
 *      通关结算按耗时评星并展示总分明细（剩余球×5 + 最大连击×10 + 耗时档）。
 */
import { G } from '../runtime';
import { LEVELS_300 } from './levels';

(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. 全局常量（布局与规则参数）
   * ------------------------------------------------------------------ */
  // CFG 保持原型“先写字面量、后动态补推导字段（CELL/ARENA_*）”的模式；
  // TS 严格推断会把初始字面量当封闭结构，后续写入新属性触发 TS2339，因此标为 any。
  var CFG: any = {
    W: 375,               // 逻辑宽（设计基准，运行时整体缩放）
    H: 667,               // 逻辑高

    PAD: 12,              // 竞技区左右留白
    COLS: 24,             // 网格列数（v10.3：30→24，方块更大更醒目）
    ROWS: 20,             // 网格行数（v10.23：22→20，最底一行 = 底部墙壁行 + 缺口）

    HUD_H: 78,            // 顶部信息栏高度（v10.1：进度条独占卡片底行）
    HUD_TOP: 96,          // v10.10：HUD 卡片顶边（= 胶囊底+28，启动时按 insets 重算）
    CAP_BOTTOM: 60,       // v10.10：微信胶囊底边（逻辑坐标）
    CAP_CY: 40,           // v10.10：胶囊垂直中心
    CAP_LEFT: 280,        // v10.10：胶囊左边缘
    ARENA_TOP: 114,       // 竞技区顶部 y（v10.17：启动时按 insets 重算=胶囊底+90，与 HUD 间距 20）

    BALL_R: 5.5,          // 小球半径（v10.3 之后被 CELL/2 覆盖：球径=方块格宽）
    BALL_SPEED: 500,      // 小球速度 px/s（竞技区/方块区内匀速；v5 需求④：方块区内 500）
    CATCH_SPEED_K: 0.84,  // 方块区下方(接球区)速度系数：500×0.84=420（v6 需求④：区下方降到 420，留反应时间）
    MAX_BALLS: 16,        // 同屏最大球数（性能与体验上限）

    PADDLE_W: 120,        // 挡板宽（v4 需求②：默认继续加宽到 120，让小球更容易接到）
    PADDLE_H: 12,         // 挡板高
    PADDLE_Y: 487,        // 挡板/轨道顶部 y（v4 需求③：横条与轨道整体上移，距方块区约 150px）
    DEATH_Y: 487,         // 轨道漏接平面 y（v4：球落到轨道平面且不在横条上即判漏接，取消旧漏接线）

    STALL_TIME: 22,       // （v3 已停用）旧停滞开底阈值，保留字段兼容，不再参与逻辑
    LEVEL_TIMEOUT: 300,   // 关卡硬超时（秒）：v3 默认 180；v9 根据需求拉到 300（5 分钟）——到点直接判负，不再开底排空
    OPEN_WARN: 3,         // 开底前多少秒开始闪烁警告
    BOUNCE_KICK: 0.55,    // 接住回弹时横条拖动速度的横向注入系数

    PADDLE_BOOST_TIME: 30, // 挡板球：消除道具块后挡板满宽持续秒数（v5 需求②：改 30s，中心显示倒计时）
    PADDLE_BOOST_WARN: 3,  // 挡板球：最后多少秒开始闪烁倒计时
    GAP_MAX_CELLS: 5,      // v5 需求⑤：底部缺口连续 EMPTY 段的最大格数，超出居中裁剪回墙壁
    WALLGHOST_TIME: 10,    // 墙壁隐形道具：消除后方块区墙壁可穿透持续秒数（最底部墙壁行不受影响）
    PROP_RATE: 0.06,        // v7 需求④：每关道具方块占可消除方块的固定比例 6%（取代旧 5%~10% 随机）

    MAX_AIM_ANGLE: 78 * Math.PI / 180, // 发射/回弹方向与竖直向上方向的最大夹角
    SUBSTEPS: 8,          // 物理子步进次数（防穿透）
    SPLIT_ANGLE: 20 * Math.PI / 180,   // 分裂时新球的偏转角
    SPLIT_COOLDOWN: 0.12, // 同一颗球两次分裂的最小间隔 s

    // —— v5 需求②：横条下方道具栏（主动道具：全部分裂 / 墙体隐藏 / 挡板放大）——
    PROP_BAR_Y: 552,      // 道具按钮顶部 y（横条下方，横条底约 499）
    PROP_BAR_W: 84,       // 单个道具按钮宽
    PROP_BAR_H: 64,       // 单个道具按钮高
    PROP_BAR_GAP: 12,     // 按钮间距
    DIAMOND_START: 0      // 钱包初始钻石（存档缺失时；实际数量持久化于 localStorage）
  };

  CFG.CELL = (CFG.W - CFG.PAD * 2) / CFG.COLS;   // v10.3：24 列 → 14.625
  CFG.BALL_R = CFG.CELL / 2 - 0.75;              // v10.5：球径 = 方块视觉尺寸（满格-1.5 留缝）
  CFG.ARENA_W = CFG.CELL * CFG.COLS;             // 351
  CFG.ARENA_H = CFG.CELL * CFG.ROWS;             // 257.4
  CFG.ARENA_LEFT = CFG.PAD;                      // 12
  CFG.ARENA_RIGHT = CFG.PAD + CFG.ARENA_W;       // 363
  CFG.ARENA_BOTTOM = CFG.ARENA_TOP + CFG.ARENA_H;// 337.4
  CFG.PADDLE_W = Math.round(CFG.ARENA_W * 0.45); // v10.16：挡板默认宽 = 大方框宽度的 45%

  /* ------------------------------------------------------------------ *
   * 2. 视觉调色板（v10 双主题重构：浅色=糖果贴纸 / 深色=果冻夜航）
   *    字段 schema 与旧版保持兼容（bricks[].top/bottom、wall.bottom、
   *    split.bottom/glow 等，engine 的 propColor 直接读取），
   *    新增 ui.* 子对象承载界面组件取色；PALETTE.mode 标记当前主题。
   *    设计令牌来源：tantan-design/assets/tokens/*.tokens.json
   * ------------------------------------------------------------------ */
  function makePalette(mode: string): any {
    if (mode === 'light') {
      return {
        mode: 'light',
        bgTop: '#FFF3E0', bgBottom: '#F2DCB8',   // v10.27：渐变深化（上更暖、下更深）
        panel: '#ffffff', panelLine: '#4a3f35',
        textMain: '#4a3f35', textSub: '#8a6d4f',

        // 普通方块（v10.5：恢复四色循环）
        bricks: [
          { top: '#7ED8F7', bottom: '#7ED8F7', edge: '#bdeffc' },
          { top: '#FF8FB2', bottom: '#FF8FB2', edge: '#ffd0de' },
          { top: '#FFD166', bottom: '#FFD166', edge: '#ffe9b3' },
          { top: '#8FD98A', bottom: '#8FD98A', edge: '#c9efc5' }
        ],
        brickBorder: '#4a3f35',

        // 墙体（v10.5：还原设计稿初版米色砖纹墙；rivet=砖缝色）
        wall: { top: '#e8dcc6', bottom: '#e8dcc6', edge: '#4a3f35', rivet: '#c9b892' },

        // 道具方块（v10.21：分裂2/3=紫、挡板加强=绿、生命=粉；爆炸球/加速球已下线）
        split:     { top: '#D7BCFF', bottom: '#C9A6FF', edge: '#ecdfff', glow: 'rgba(201,166,255,0.55)' },
        split3:    { top: '#D7BCFF', bottom: '#C9A6FF', edge: '#ecdfff', glow: 'rgba(201,166,255,0.55)' },
        life:      { top: '#FFB3C9', bottom: '#FF8FB2', edge: '#ffd6e2', glow: 'rgba(255,143,178,0.5)' },
        paddlePow: { top: '#A8E6A1', bottom: '#8FD98A', edge: '#d2f2cd', glow: 'rgba(143,217,138,0.5)' },
        ghost:     { top: '#CBD4EE', bottom: '#B9C4E8', edge: '#e6ebf8', glow: 'rgba(185,196,232,0.55)' },

        // v10.1：小球=灰底+绿边框绿阴影；挡板=浅绿
        ball: { core: '#AEB4BF', glow: 'rgba(78,216,168,0.7)', trail: 'rgba(174,180,191,0.35)' },
        paddle: { top: '#B8EBB0', bottom: '#8FD98A', edge: '#4a3f35' },
        aim: 'rgba(255,107,157,0.95)',
        aimOk: '#2F9E5B',      // v10.3：可命中=绿
        aimNo: '#FF6B9D',      // v10.3：不可命中=粉
        death: 'rgba(224,85,85,0.55)',

        // 界面组件令牌（贴纸风：描边 + 偏移硬阴影）
        ui: {
          ink: '#4a3f35', inkSoft: '#8a6d4f', inkMute: '#b08a5a',
          card: '#ffffff', cardBorder: '#4a3f35',
          track: '#efe6d6', grid: '#f4ecdd',
          accent: '#FFD166', accentInk: '#4a3f35',
          gemBg: '#7ED8F7', gemInk: '#123a4a',
          star: '#F5A623', good: '#3d9950',
          tintPink: '#FFE3EC', tintBlue: '#DFF3FF', tintGreen: '#E4F7E0',
          modalBg: '#FFF6E9', modalBorder: '#4a3f35',
          dim: 'rgba(74,63,53,0.16)',
          hard: true,                       // 硬阴影开关
          shadow: 'rgba(74,63,53,0.9)',
          shadowSoft: 'rgba(74,63,53,0.28)',
          textOnCard: '#4a3f35', textOnCardSub: '#8a6d4f',
          btnGhost: '#ffffff', btnGhost2: '#DFF3FF',
          popupShadow: 'rgba(74,63,53,0.35)'
        }
      };
    }
    // dark：果冻夜航
    return {
      mode: 'dark',
      bgTop: '#3B2A6B', bgBottom: '#221847',
      panel: 'rgba(255,255,255,0.06)', panelLine: 'rgba(255,255,255,0.22)',
      textMain: '#FFF7EF', textSub: '#B9AED6',

      bricks: [
        { top: 'rgba(201,182,255,0.95)', bottom: 'rgba(140,110,230,0.85)', edge: '#C9B6FF' },
        { top: 'rgba(255,175,205,0.95)', bottom: 'rgba(240,110,160,0.85)', edge: '#FFB199' },
        { top: 'rgba(255,235,170,0.95)', bottom: 'rgba(240,185,74,0.85)', edge: '#FFE08A' },
        { top: 'rgba(170,255,220,0.95)', bottom: 'rgba(78,216,168,0.85)', edge: '#7CF5C8' }
      ],
      brickBorder: 'rgba(255,255,255,0.25)',

      // 墙体（v10.5：深色果冻半透明白，砖缝同色系）
      wall: { top: 'rgba(255,255,255,0.30)', bottom: 'rgba(255,255,255,0.10)', edge: 'rgba(255,255,255,0.35)', rivet: 'rgba(255,255,255,0.28)' },

      split:     { top: 'rgba(220,190,255,0.95)', bottom: 'rgba(160,120,240,0.85)', edge: '#DCBEFF', glow: 'rgba(160,120,240,0.55)' },
      split3:    { top: 'rgba(220,190,255,0.95)', bottom: 'rgba(160,120,240,0.85)', edge: '#DCBEFF', glow: 'rgba(160,120,240,0.55)' },
      life:      { top: 'rgba(255,190,210,0.95)', bottom: 'rgba(250,130,170,0.85)', edge: '#FFBED2', glow: 'rgba(250,130,170,0.5)' },
      paddlePow: { top: 'rgba(190,255,215,0.95)', bottom: 'rgba(124,235,170,0.85)', edge: '#BEFFD7', glow: 'rgba(124,235,170,0.5)' },
      ghost:     { top: 'rgba(230,236,255,0.95)', bottom: 'rgba(154,166,204,0.85)', edge: '#E6ECFF', glow: 'rgba(200,212,255,0.55)' },

      // v10.1：小球=灰底+绿边框绿阴影；挡板=浅绿果冻
      ball: { core: '#AEB4BF', glow: 'rgba(78,216,168,0.7)', trail: 'rgba(174,180,191,0.35)' },
      paddle: { top: 'rgba(190,255,215,0.95)', bottom: 'rgba(124,235,170,0.85)', edge: '#FFE08A' },
      aim: 'rgba(124,245,200,0.95)',
      aimOk: '#7CF5C8',
      aimNo: '#FF8FB8',
      death: 'rgba(255,90,90,0.55)',

      ui: {
        ink: '#FFF7EF', inkSoft: '#B9AED6', inkMute: '#9d92c0',
        card: 'rgba(255,255,255,0.10)', cardBorder: 'rgba(255,255,255,0.25)',
        track: 'rgba(255,255,255,0.10)', grid: 'rgba(255,255,255,0.06)',
        accent: '#FFE08A', accentInk: '#4A2E10',
        gemBg: 'rgba(124,245,200,0.25)', gemInk: '#DFFFF3',
        star: '#FFE08A', good: '#7CF5C8',
        tintPink: 'rgba(255,143,184,0.35)', tintBlue: 'rgba(201,182,255,0.35)', tintGreen: 'rgba(124,245,200,0.3)',
        modalBg: 'rgba(70,52,124,0.96)', modalBorder: 'rgba(255,255,255,0.3)',
        dim: 'rgba(15,8,35,0.55)',
        hard: false,
        shadow: 'rgba(10,5,30,0.45)',
        shadowSoft: 'rgba(5,2,20,0.6)',
        textOnCard: '#FFF7EF', textOnCardSub: '#B9AED6',
        btnGhost: 'rgba(255,255,255,0.12)', btnGhost2: 'rgba(124,245,200,0.2)',
        popupShadow: 'rgba(0,0,0,0.45)'
      }
    };
  }

  var PALETTE = makePalette('light');   // v10：默认浅色主题

  /** 切换主题：原地 mutate PALETTE（render/engine 持有同一引用） */
  function setTheme(mode: string) {
    var np = makePalette(mode === 'dark' ? 'dark' : 'light');
    for (var k in np) PALETTE[k] = np[k];
  }

  /* ------------------------------------------------------------------ *
   * 3. 方块类型（v10.7：删除 2 球分裂与快速球；分裂球统一分裂 3 球）
   *    .  空
   *    B  普通可消除方块（1 次命中即消除）
   *    W  不可消除墙壁（反弹）
   *    T  分裂道具方块（消除后原坐标生 3 颗球）
   *    L  生命道具方块（发射 +1）
   *    P  挡板道具方块（满宽 30s） G  墙壁隐形道具方块（墙壁可穿透 10s）
   * ------------------------------------------------------------------ */
  var TYPE = { EMPTY: 0, BRICK: 1, WALL: 2, LIFE: 4, PADDLE: 6, SPLIT3: 7, GHOST: 9 };

  var LEGEND = {
    '.': TYPE.EMPTY,
    'B': TYPE.BRICK,
    'W': TYPE.WALL,
    'L': TYPE.LIFE,
    'P': TYPE.PADDLE,
    'T': TYPE.SPLIT3,
    'G': TYPE.GHOST
  };

  /* ------------------------------------------------------------------ *
   * 4. 关卡数据（v10.23：300 关，由 tools/gen_levels.py 自动生成 → src/core/levels.ts）
   *    网格 20 行 × 24 列；每行 24 字符；最后一行 = 底部墙壁行 + 缺口
   *    balls：本关发射机会（统一 3 颗）
   *    starScores：[一星线, 二星线, 三星线] 总分阈值；通关总分 ≥ 对应线评 1/2/3 星。
   *      游戏内 HUD 三星与结算弹窗共用同一阈值（HUD 按"预计总分"实时点亮）。
   *    难度曲线：前 5 关简单（宽缝隙、无墙、形状清晰），其后随序号渐增
   *      （缝隙变窄变少、对称墙体/空心孔洞植入、道具密度上升）。
   *    约束：分裂球 T 不放在底部缝隙正上方；缝隙宽 2~5（GAP_MAX_CELLS=5）。
   * ------------------------------------------------------------------ */
  // v10.23：关卡表切换为 300 关自动生成数据（tools/gen_levels.py → src/core/levels.ts）
  var LEVELS = LEVELS_300;

  /* ------------------------------------------------------------------ *
   * 5. 计分与星级（v10.23 重构）
   *    对局内：普通块 +10、道具块 +30（无连击叠加、接球不加分）。
   *    通关结算：总分 = 对局内分 + 剩余球×10 + 最大连击×5 + 耗时档
   *             （<30s=500 / 30~60s=300 / 60~120s=100 / >120s=50）。
   *    星级：按总分对照每关 starScores=[一星线, 二星线, 三星线]。
   * ------------------------------------------------------------------ */
  var SCORE = {
    brick: 10,          // 消除普通方块
    prop: 30,           // 消除道具方块（分裂/生命/挡板/墙隐统一）
    // —— 通关结算 ——
    perShot: 10,        // 剩余球数（场上球 + 剩余发射）每颗 +10
    perCombo: 5         // 最大连击每级 +5
  };

  /* ------------------------------------------------------------------ *
   * 5.2 v5 需求②：主动道具（底部道具栏，背包有数量则点击使用，为 0 则弹窗引导购买）
   *     name 名称 / cost 购买所需钻石 / pal 图标取色键 / effect 说明
   *     全部分裂 2 钻、墙体隐藏 1 钻、挡板放大 1 钻。
   * ------------------------------------------------------------------ */
  var PROPS = {
    order: ['splitAll', 'wallHide', 'paddleBig'],
    splitAll:  { name: '全部分裂', homeName: '小球分裂', cost: 2, pal: 'split3',     desc: '场上所有小球一分为三' },
    wallHide:  { name: '墙体隐藏', homeName: '墙体隐形', cost: 1, pal: 'ghost',      desc: '方块区墙壁隐形可穿透 ' + CFG.WALLGHOST_TIME + 's' },
    paddleBig: { name: '挡板放大', homeName: '挡板加强', cost: 1, pal: 'paddlePow',  desc: '挡板满宽 ' + CFG.PADDLE_BOOST_TIME + 's' }
  };

  /**
   * v10.4 布局重算：宽度锚定后逻辑高随设备变化，底部操作区改为底部锚定；
   * 极窄屏（<340pt）收缩左右留白让方块更大。启动与屏幕旋转时调用。
   */
  function relayout(winW: number) {
    CFG.PAD = winW < 340 ? 6 : 12;
    CFG.CELL = (CFG.W - CFG.PAD * 2) / CFG.COLS;
    CFG.BALL_R = CFG.CELL / 2 - 0.75;          // v10.5：球径 = 方块视觉尺寸（满格-1.5 留缝）
    CFG.ARENA_W = CFG.CELL * CFG.COLS;
    CFG.ARENA_H = CFG.CELL * CFG.ROWS;
    CFG.ARENA_LEFT = CFG.PAD;
    CFG.ARENA_RIGHT = CFG.PAD + CFG.ARENA_W;
    CFG.ARENA_BOTTOM = CFG.ARENA_TOP + CFG.ARENA_H;
    CFG.PADDLE_W = Math.round(CFG.ARENA_W * 0.45); // v10.16：挡板默认宽 = 大方框宽度的 45%
    // 底部锚定：挡板/道具栏贴逻辑底边，中间接球区为弹性区
    CFG.PADDLE_Y = CFG.H - 180;
    CFG.DEATH_Y = CFG.PADDLE_Y;
    CFG.PROP_BAR_Y = CFG.H - 115;
  }

  global.TT = {
    CFG: CFG,
    PALETTE: PALETTE,
    setTheme: setTheme,
    relayout: relayout,
    TYPE: TYPE,
    LEGEND: LEGEND,
    LEVELS: LEVELS,
    SCORE: SCORE,
    PROPS: PROPS
  };
})(G);
