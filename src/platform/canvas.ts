/**
 * 上屏 Canvas 与屏幕适配（对应设计稿 §13.4 / spec §8）。
 *
 * 小游戏首个 wx.createCanvas() 返回【上屏 canvas】（自动铺满屏幕），后续调用才是离屏。
 * 逻辑基准仍是原型的 375×667；按“等比 fit、短边优先、居中留边”映射到物理屏：
 *   deviceX = (logicalX·scale + offX)·dpr
 * 触摸物理坐标（screen 系）反算 logical = (screen - off) / scale。
 */
declare const wx: any

export interface Fit {
  scale: number
  offX: number
  offY: number
  dpr: number
  W: number
  H: number
}

export const canvas: any = wx.createCanvas()
// miniprogram-api-typings 不提供 DOM 的 CanvasRenderingContext2D 类型，小游戏 ctx 走 any。
export const ctx: any = canvas.getContext('2d')
export const fit: Fit = { scale: 1, offX: 0, offY: 0, dpr: 2, W: 375, H: 667 }

export function setupCanvas(logicalW: number): void {
  const info = wx.getSystemInfoSync()
  const winW: number = info.windowWidth
  const winH: number = info.windowHeight
  const dpr: number = Math.min(info.pixelRatio || 2, 2)   // 3 倍屏收益低，钉 2（§13.4）
  // v10.4 宽度锚定：scale 只由屏宽决定 → 方块物理尺寸 = 屏宽/列数，全机型手指观感一致；
  // 逻辑高度动态 = winH/scale（长屏多出的高度由接球区弹性吸收）。
  // 极矮屏兜底：逻辑高不足 640 时退回高度锚定，保证底部操作区不被压没。
  let scale = winW / logicalW
  const MIN_H = 640
  if (winH / scale < MIN_H) scale = winH / MIN_H
  const logicalH = winH / scale
  const offX = (winW - logicalW * scale) / 2
  const offY = 0
  canvas.width = Math.round(winW * dpr)
  canvas.height = Math.round(winH * dpr)
  fit.scale = scale; fit.offX = offX; fit.offY = offY; fit.dpr = dpr; fit.W = logicalW; fit.H = logicalH
  applyTransform()
}

/** 把“逻辑 375×667 → 设备像素”的基础变换应用到 ctx（每帧重置一次即可）。 */
export function applyTransform(): void {
  const k = fit.scale * fit.dpr
  ctx.setTransform(k, 0, 0, k, fit.offX * fit.dpr, fit.offY * fit.dpr)
}

/** 屏幕物理坐标 → 逻辑坐标（canvas 全屏铺满，原点在屏幕左上，无需 getBoundingClientRect）。 */
export function toLogical(clientX: number, clientY: number): { x: number; y: number } {
  return { x: (clientX - fit.offX) / fit.scale, y: (clientY - fit.offY) / fit.scale }
}
