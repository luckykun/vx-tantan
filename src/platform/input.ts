/**
 * 触摸输入适配层（对应 spec §9.1 / §9.2）。
 *
 * 忠实移植 design/js/prototype-main.js 中的 onDown/onMove/onUp/handleHomeTap + 三个辅助。
 * 与原型差异：
 *   - 事件源：wx.onTouchStart/Move/End，触点通过 toLogical(clientX,clientY) 换算到 375×667 逻辑坐标；
 *   - 无 DOM，evt.preventDefault / getBoundingClientRect / UI.syncLevels / UI.toggleSound 全部剥离；
 *   - toggleSound 直接调 G.Sfx.toggle()（render 层暂停弹窗每帧读 isEnabled 刷新图标）。
 */
import { G } from '../runtime'
import { toLogical } from './canvas'

declare const wx: any

// 与原型 main.js 同名同语义的模块内状态
let dragging = false
let dragMode: 'aim' | 'paddle' | 'homeScroll' | null = null
let grabDX = 0
let homeScrollStartY = 0
let homePointerStartY = 0
let homePointerMoved = false
let homeVelSample = 0        // v10.24：拖动速度采样（px/s，上滑为正）
let homeLastY = 0
let homeLastT = 0

function hitRect(p: { x: number; y: number }, r: any): boolean {
  return !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
}

/** v10：当前声音开关状态 */
function global_SfxEnabled(): boolean {
  try { return !!(G.Sfx && G.Sfx.isEnabled()) } catch (e) { return true }
}

/** v10：昵称编辑——小游戏无 DOM 键盘，用 wx.showModal(editable) 原生输入框 */
function editNickname(): void {
  const cur = (() => {
    try { return (G.Settings && G.Settings.read().nickname) || '玩家' } catch (e) { return '玩家' }
  })()
  try {
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '输入昵称（最多8字）',
      content: cur,
      success: function (res: any) {
        if (res && res.confirm && typeof res.content === 'string') {
          G.Game.setNickname(res.content.trim())
        }
      }
    })
  } catch (e) { /* 不支持 editable 的环境忽略 */ }
}

export function bindInput(): void {
  const Game = G.Game
  const CFG = G.TT.CFG
  const LEVELS = G.TT.LEVELS
  const S = Game.S

  /** v5：命中底部道具按钮，返回其 key（未命中返回 null）；布局由 render 写入 S._propBtns */
  function hitProp(p: { x: number; y: number }): string | null {
    const rects = S._propBtns
    if (!rects) return null
    for (let i = 0; i < rects.length; i++) if (hitRect(p, rects[i])) return rects[i].key
    return null
  }

  function onPaddle(p: { x: number; y: number }): boolean {
    return p.y >= CFG.PADDLE_Y - 26 && p.y <= CFG.PADDLE_Y + CFG.PADDLE_H + 30 &&
      p.x >= S.paddle.x - 18 && p.x <= S.paddle.x + S.paddle.w + 18
  }

  /** v10.16b：瞄准区 = 大方框顶 → 挡板上方26px；挡板下方为纯接管区，永不瞄准/发射 */
  function inAimZone(p: { x: number; y: number }): boolean {
    return p.y >= CFG.ARENA_TOP && p.y <= CFG.PADDLE_Y - 26
  }

  /** v8：主页关卡格子 / 主页底部道具按钮 点击命中 */
  function handleHomeTap(p: { x: number; y: number }): void {
    const propRects = S._homePropRects
    if (propRects) {
      for (let pi = 0; pi < propRects.length; pi++) {
        const pr = propRects[pi]
        if (pr && hitRect(p, pr)) { Game.openBuy(pr.key); return }
      }
    }
    const rects = S._homeRects
    if (!rects) return
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i]
      if (!r || r.locked) continue
      if (hitRect(p, r)) {
        Game.loadLevel(r.index)
        // v10.5：不再自动 beginAim——保持 READY 态展示手指引导，首次触摸才进入瞄准
        return
      }
    }
  }

  function onDown(p: { x: number; y: number }): void {
    // v10.25：首次手势预热 WebAudioContext（iOS 需用户手势后才能出声）
    try { G.Sfx && G.Sfx.unlock() } catch (e) { }
    dragging = true

    // v10：设置弹窗 —— 声音 toggle / 主题分段 / 昵称 / 关闭 / 保存
    if (S.overlay === 'settings') {
      if (hitRect(p, S._setToggle)) {
        const on = !(global_SfxEnabled())
        Game.setSound(on)
      } else if (hitRect(p, S._setSegLight)) {
        Game.setThemeMode('light')
      } else if (hitRect(p, S._setSegDark)) {
        Game.setThemeMode('dark')
      } else if (hitRect(p, S._setNick)) {
        editNickname()
      } else if (hitRect(p, S._setClose) || hitRect(p, S._setSave)) {
        Game.closeSettings()
      }
      dragging = false; dragMode = null
      return
    }

    // v10：主页设置按钮
    if (S.phase === Game.PHASE.HOME && !S.overlay) {
      if (hitRect(p, S._btnSettings)) {
        Game.openSettings()
        dragging = false; dragMode = null
        return
      }
    }

    // v8：主页 —— 滚动关卡列表 + 点选关卡 + 点购买道具（覆盖层优先）
    if (S.phase === Game.PHASE.HOME && !S.overlay) {
      dragMode = 'homeScroll'
      homeScrollStartY = p.y; homePointerStartY = p.y; homePointerMoved = false
      homeVelSample = 0; homeLastY = p.y; homeLastT = S.time
      S.homeScrollVel = 0; S._homeDragging = true
      return
    }

    // v5 需求③：暂停弹窗 —— 继续 / 回到主页 / 开关声音（v10：持久化）
    if (S.overlay === 'pause') {
      if (hitRect(p, S._btnResume)) Game.resume()
      else if (hitRect(p, S._btnHome)) Game.toHome()
      else if (hitRect(p, S._btnSound)) { Game.setSound(!global_SfxEnabled()) }
      dragging = false; dragMode = null
      return
    }

    // v10.25：返回主页确认弹窗
    if (S.overlay === 'homeConfirm') {
      if (hitRect(p, S._btnHomeOk)) Game.toHome()
      else if (hitRect(p, S._btnHomeCancel)) Game.closeHomeConfirm()
      dragging = false; dragMode = null
      return
    }

    // v5 需求②：购买弹窗 —— 确认扣钻 / 取消
    if (S.overlay && S.overlay.buy) {
      const bkey = S.overlay.buy
      if (hitRect(p, S._btnBuyConfirm)) {
        if (!Game.buyProp(bkey)) Game.setBuyHint('钻石不足，通关可获取钻石')
        else Game.closeBuy()
      } else if (hitRect(p, S._btnBuyCancel)) {
        Game.closeBuy()
      }
      dragging = false; dragMode = null
      return
    }

    // v5 需求②③：对局中，暂停按钮与道具按钮优先于瞄准/挡板
    if (S.phase === Game.PHASE.PLAY || S.phase === Game.PHASE.READY) {
      if (hitRect(p, S._btnHomeQuick)) {   // v10.25：home 快捷钮 → 返回确认弹窗
        Game.openHomeConfirm()
        dragging = false; dragMode = null
        return
      }
      if (hitRect(p, S._btnPause)) {
        Game.openPause()
        dragging = false; dragMode = null
        return
      }
      if (hitRect(p, S._btnSoundHud)) {   // v10.31：HUD 音效开关（仅图标）
        Game.setSound(!global_SfxEnabled())
        dragging = false; dragMode = null
        return
      }
      const pk = hitProp(p)
      if (pk) {
        if (Game.getPropCount(pk) > 0) Game.useProp(pk)
        else Game.openBuy(pk)
        dragging = false; dragMode = null
        return
      }
    }

    if (S.phase === Game.PHASE.WIN || S.phase === Game.PHASE.LOSE) {
      if (hitRect(p, S._btnNext)) {
        const next = S.phase === Game.PHASE.WIN
          ? (S.levelIndex + 1) % LEVELS.length
          : S.levelIndex
        Game.loadLevel(next)
      } else if (hitRect(p, S._btnRetry)) {
        // v10.31：败局左钮="回到主页"；胜局左钮仍为重玩本关
        if (S.phase === Game.PHASE.LOSE) Game.toHome()
        else Game.restart()
      }
      dragging = false; dragMode = null
      return
    }

    // v10.16：READY 态仅"大方框→挡板"区域内触摸才开场进入瞄准；HUD/挡板下方触摸不启动游戏
    // v10.30：READY 态命中挡板 → 允许预先拖动挡板调整发射位置（不开始游戏）
    if (S.phase === Game.PHASE.READY) {
      if (onPaddle(p)) {
        dragMode = 'paddle'
        grabDX = p.x - (S.paddle.x + S.paddle.w / 2)
        Game.movePaddleTo(p.x - grabDX)
        return
      }
      if (!inAimZone(p)) { dragging = false; dragMode = null; return }
      Game.beginAim()
    }

    if (S.phase === Game.PHASE.PLAY) {
      if (onPaddle(p)) {
        dragMode = 'paddle'
        grabDX = p.x - (S.paddle.x + S.paddle.w / 2)
        Game.clearAim()
        Game.movePaddleTo(p.x - grabDX)
      } else if (S.shotsLeft > 0 && inAimZone(p)) {
        dragMode = 'aim'
        Game.updateAim(p.x, p.y)
      } else if (S.shotsLeft <= 0 || p.y > CFG.PADDLE_Y - 26) {
        // 弹药用完任意空白接管挡板；v10.16b：挡板下方永远拖挡板，有弹药也绝不瞄准发射
        dragMode = 'paddle'
        grabDX = 0
        Game.movePaddleTo(p.x)
      } else {
        dragMode = null
      }
    } else {
      dragMode = null
    }
  }

  function onMove(p: { x: number; y: number }): void {
    if (!dragging || !dragMode) return
    if (dragMode === 'homeScroll') {
      const dy = homeScrollStartY - p.y
      homeScrollStartY = p.y
      S.homeScroll += dy
      if (Math.abs(p.y - homePointerStartY) > 8) homePointerMoved = true
      // v10.24：速度采样（指数平滑，抑制单帧抖动）
      const dt = Math.max(0.008, S.time - homeLastT)
      const inst = (homeLastY - p.y) / dt
      homeVelSample = homeVelSample * 0.6 + inst * 0.4
      homeLastY = p.y; homeLastT = S.time
      return
    }
    if (dragMode === 'aim' && S.phase === Game.PHASE.PLAY) Game.updateAim(p.x, p.y)
    else if (dragMode === 'paddle') {
      Game.movePaddleTo(p.x - grabDX)
      // 摆位过程中若存在瞄准，同步刷新弹道预测
      if (S.aim.active) Game.updateAim(S.aim.x, S.aim.y)
    }
  }

  function onUp(p: { x: number; y: number } | null): void {
    if (!dragging) return
    dragging = false
    if (dragMode === 'homeScroll') {
      S._homeDragging = false
      if (!homePointerMoved && p) handleHomeTap(p)
      else S.homeScrollVel = Math.max(-2600, Math.min(2600, homeVelSample))   // v10.24：抬手进入惯性滑动
      dragMode = null; return
    }
    if (dragMode === 'aim' && S.phase === Game.PHASE.PLAY && S.aim.active) Game.shoot()
    dragMode = null
  }

  // ---- wx 触摸事件适配 ----
  // 小游戏 touch 事件 e.touches 是当前触点集，e.changedTouches 是本次变化的触点集；
  // touchend 时 touches 通常为空，需要从 changedTouches 取。
  function pickTouch(e: any): any | null {
    if (e.touches && e.touches.length) return e.touches[0]
    if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0]
    return null
  }

  wx.onTouchStart(function (e: any) {
    const t = pickTouch(e); if (!t) return
    onDown(toLogical(t.clientX, t.clientY))
  })
  wx.onTouchMove(function (e: any) {
    const t = pickTouch(e); if (!t) return
    onMove(toLogical(t.clientX, t.clientY))
  })
  wx.onTouchEnd(function (e: any) {
    const t = pickTouch(e)
    onUp(t ? toLogical(t.clientX, t.clientY) : null)
  })
  wx.onTouchCancel(function (e: any) {
    const t = pickTouch(e)
    onUp(t ? toLogical(t.clientX, t.clientY) : null)
  })
}
