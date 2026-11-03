import { G } from '../runtime'

declare const wx: any

/**
 * v10.25：音效层——WebAudio 实时合成（无外部音频文件依赖）。
 * 移植自 design/js/prototype-main.js 的合成器：振荡器 + 增益包络。
 * 小游戏端用 wx.createWebAudioContext()（基础库 ≥2.19.0）；不可用时安全静默。
 * 重点音效：wall 墙体碰撞（低频闷响+节流）/ brick 方块消除（随机音高短促方波）/
 * catch 挡板反弹（上行正弦啁啾）；其余 shoot/split/win/fail 等同步提供。
 */
let enabled = true
let ctx: any = null

function ac(): any {
  if (!ctx) {
    try {
      if (typeof wx !== 'undefined' && wx.createWebAudioContext) ctx = wx.createWebAudioContext()
    } catch (e) { /* 不支持则静默 */ }
  }
  if (ctx && ctx.state === 'suspended') { try { ctx.resume() } catch (e) { } }
  return ctx
}

function tone(freq: number, dur: number, type: string, vol: number, slideTo?: number): void {
  if (!enabled) return
  const c = ac()
  if (!c) return
  try {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type || 'sine'
    o.frequency.setValueAtTime(freq, c.currentTime)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur)
    g.gain.setValueAtTime(0.0001, c.currentTime)
    g.gain.exponentialRampToValueAtTime(vol || 0.12, c.currentTime + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
    o.connect(g)
    g.connect(c.destination)
    o.start()
    o.stop(c.currentTime + dur + 0.02)
  } catch (e) { /* 单次失败忽略 */ }
}

let lastWall = 0
let lastBrick = 0

const map: Record<string, () => void> = {
  // 墙体碰撞：低频正弦下滑"咚"，45ms 节流防连续反弹爆音
  wall: () => {
    const t = Date.now()
    if (t - lastWall < 45) return
    lastWall = t
    tone(150, 0.05, 'sine', 0.05, 90)
  },
  // 方块消除：随机音高短促方波"哒"，30ms 节流（多块同帧消除时不过载）
  brick: () => {
    const t = Date.now()
    if (t - lastBrick < 30) return
    lastBrick = t
    tone(300 + Math.random() * 260, 0.07, 'square', 0.055)
  },
  // 挡板反弹：上行正弦啁啾"叮~"
  catch: () => tone(880, 0.09, 'sine', 0.10, 1180),
  shoot: () => tone(520, 0.10, 'triangle', 0.10, 880),
  split: () => tone(660, 0.20, 'sawtooth', 0.09, 1320),
  lose: () => tone(220, 0.16, 'square', 0.07, 90),
  open: () => tone(400, 0.28, 'triangle', 0.08, 200),
  win: () => {
    tone(523, 0.14, 'triangle', 0.11)
    setTimeout(() => tone(659, 0.14, 'triangle', 0.11), 110)
    setTimeout(() => tone(784, 0.26, 'triangle', 0.12), 220)
  },
  fail: () => {
    tone(330, 0.20, 'sawtooth', 0.09, 220)
    setTimeout(() => tone(220, 0.34, 'sawtooth', 0.09, 110), 170)
  }
}

export function attachSfx(): void {
  G.Sfx = {
    play: function (name: string): void {
      if (!enabled) return
      const fn = map[name]
      if (fn) fn()
    },
    toggle: function (): boolean { enabled = !enabled; return enabled },
    setEnabled: function (b: boolean): void { enabled = !!b },
    isEnabled: function (): boolean { return enabled },
    setVolume: function (_v: number): void { /* 合成音用固定包络，预留 */ },
    getVolume: function (): number { return 0.7 },
    unlock: function (): void { ac() }   // 首次手势预热 AudioContext
  }
}
