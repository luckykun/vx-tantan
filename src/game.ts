/**
 * 微信小游戏入口（对应 spec §7 / §12 M-C）。
 *
 * 加载顺序：
 *   1) runtime：初始化全局宿主 G；
 *   2) core/config：装载 TT 命名空间（CFG/PALETTE/TYPE/LEGEND/SCORE/PROPS/LEVELS）；
 *   3) core/engine：装载 Game（依赖 config）；
 *   4) core/icons：装载 Icons（lucide/shadcn 矢量图标，替代 emoji）；
 *   5) core/render：装载 Render（依赖 config + engine + icons）；
 *   6) platform/{storage,sfx}：注入 G.Storage / G.Wallet / G.Sfx（engine 惰性读取，无需时序前置）；
 *   7) platform/canvas：首次 wx.createCanvas() 拿到上屏 canvas；
 *   8) bindInput + boot + rAF 循环。
 */
import { G } from './runtime'
import './core/config'
import './core/engine'
import './core/icons'
import './core/render'
import { attachStorage } from './platform/storage'
import { attachSfx } from './platform/sfx'
import { setupCanvas, applyTransform, canvas, ctx, fit } from './platform/canvas'
import { bindInput } from './platform/input'

declare const wx: any
// 小游戏环境下 requestAnimationFrame 是全局函数（挂在 GameGlobal）；
// 而非 canvas 方法（原型 main.js 的 global.requestAnimationFrame 等价于这里的同名全局）。
declare function requestAnimationFrame(cb: (ts: number) => void): number

let last = 0

/**
 * v10.10：顶部安全区 insets。
 * 微信原生胶囊按钮（右上角收起区域）的位置即灵动岛/刘海下的可用起点；
 * 首页顶栏与游戏标题/HUD 都从胶囊底边之下开始排布，避免被遮挡。
 */
function computeInsets(): void {
  const CFG = G.TT.CFG
  let capBottom = 0
  let capCY = 0
  let capLeft = 0
  try {
    const mb = wx.getMenuButtonBoundingClientRect()
    if (mb && mb.bottom) {
      capBottom = mb.bottom
      capCY = mb.top + mb.height / 2
      capLeft = mb.left
    }
  } catch (e) { /* 忽略 */ }
  let safeTop = 0
  let winW = CFG.W
  try {
    const sys = wx.getSystemInfoSync()
    safeTop = (sys.safeArea && sys.safeArea.top) || 0
    winW = sys.windowWidth || CFG.W
  } catch (e) { /* 忽略 */ }
  if (!capBottom) capBottom = safeTop + 36
  if (!capCY) capCY = safeTop + 18
  if (!capLeft) capLeft = winW - 95
  CFG.CAP_BOTTOM = capBottom / fit.scale
  CFG.CAP_CY = capCY / fit.scale
  CFG.CAP_LEFT = capLeft / fit.scale
  CFG.H = fit.H
  // v10.14：游戏页标题行与微信胶囊同一行（中心=CAP_CY，参考首页顶栏基准）；
  // HUD 卡紧随胶囊下方(+14, 高56)；v10.17：大方框与 HUD 间距 32→20
  CFG.HUD_TOP = Math.round(CFG.CAP_BOTTOM + 14)
  CFG.ARENA_TOP = Math.round(CFG.CAP_BOTTOM + 90)
  G.TT.relayout(winW)
}

function loop(ts: number): void {
  if (!last) last = ts
  const dt = Math.min(0.033, (ts - last) / 1000)
  last = ts
  // v9：全屏渐变铺底——与游戏区内部渐变（逻辑 y:0→H）在设备像素上对齐，
  // 上/下露边自动 clamp 到 bgTop / bgBottom，与主页面无缝融合（避免单色露边断层）。
  const PAL = G.TT.PALETTE
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const y0 = fit.offY * fit.dpr
  const y1 = (fit.offY + fit.H * fit.scale) * fit.dpr
  const bg = ctx.createLinearGradient(0, y0, 0, y1)
  bg.addColorStop(0, PAL.bgTop)
  bg.addColorStop(1, PAL.bgBottom)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  // 切回游戏区变换（逻辑 375×667 → 设备像素 fit+居中）
  applyTransform()
  G.Game.update(dt)
  G.Render.render(ctx)
  requestAnimationFrame(loop)
}

function boot(): void {
  attachStorage()
  attachSfx()

  // v10：读取持久化设置并应用（主题 / 声音）
  try {
    const st = G.Settings.read()
    G.TT.setTheme(st.theme === 'dark' ? 'dark' : 'light')
    G.Sfx.setEnabled(st.sound !== false)
  } catch (e) { /* 设置读取失败用默认浅色 */ }

  const CFG = G.TT.CFG
  setupCanvas(CFG.W)
  // v10.10：读取微信胶囊按钮/安全区，计算顶部 insets（灵动岛机型整体下移）
  computeInsets()

  // v5：读钱包存档注入 core，并先进入主页（需求③），点“开始游戏”再进关卡
  G.Game.setWallet(G.Wallet.read())
  // ⚠️ TEST-ONLY：测试便利——三种主动道具各发 100 个（覆盖存档）。上线前删除此块！
  G.Game.debugGrantProps({ splitAll: 100, wallHide: 100, paddleBig: 100 })
  G.Game.loadLevel(0)
  G.Game.toHome()

  bindInput()

  // 生命周期：切后台自动暂停、屏幕旋转重新适配（v10.4：重算逻辑高与底部锚定）
  wx.onWindowResize && wx.onWindowResize(function () {
    setupCanvas(CFG.W)
    computeInsets()
  })
  wx.onHide && wx.onHide(function () {
    // TODO(M-D): 对局中切后台自动 openPause，防止玩家回来发现已经失败
  })
  wx.onShow && wx.onShow(function () {
    last = 0   // 重置 dt 起点，避免切回时 dt 巨大触发穿墙
  })

  requestAnimationFrame(loop)
}

boot()
