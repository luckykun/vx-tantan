import { G } from '../runtime'

const KEY_PROGRESS = 'tantan_progress_v1'
const KEY_WALLET = 'tantan_wallet_v1'
const KEY_SETTINGS = 'tantan_settings_v1'

/** 设置默认值：浅色主题 / 声音开 / 昵称"玩家" */
const DEFAULT_SETTINGS = { theme: 'light', sound: true, nickname: '玩家' }

/**
 * 存档 / 钱包适配层（替代原型的 global.localStorage）。
 * 语义与 design/js/prototype-main.js 的 Storage / Wallet 完全一致：
 *   进度 { lv<i>: { stars, best } }，钱包 { diamonds, props }。
 */
export function attachStorage(): void {
  G.Storage = {
    read: function (): any {
      try { return wx.getStorageSync(KEY_PROGRESS) || {} } catch (e) { return {} }
    },
    save: function (levelIndex: number, stars: number, score: number): void {
      try {
        const d = this.read()
        const k = 'lv' + levelIndex
        const prev = d[k] || { stars: 0, best: 0 }
        d[k] = { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, score) }
        wx.setStorageSync(KEY_PROGRESS, d)
      } catch (e) { /* 存档失败不能崩游戏 */ }
    }
  }

  G.Wallet = {
    read: function (): any {
      try { return wx.getStorageSync(KEY_WALLET) || null } catch (e) { return null }
    },
    save: function (w: any): void {
      try { wx.setStorageSync(KEY_WALLET, w) } catch (e) { /* noop */ }
    }
  }

  // v10：设置（主题 / 声音 / 昵称）持久化
  G.Settings = {
    read: function (): any {
      try {
        const d = wx.getStorageSync(KEY_SETTINGS)
        return Object.assign({}, DEFAULT_SETTINGS, d || {})
      } catch (e) { return Object.assign({}, DEFAULT_SETTINGS) }
    },
    save: function (patch: any): any {
      const cur = this.read()
      const next = Object.assign({}, cur, patch || {})
      try { wx.setStorageSync(KEY_SETTINGS, next) } catch (e) { /* noop */ }
      return next
    }
  }
}

export function readWallet(): any { return G.Wallet.read() }
