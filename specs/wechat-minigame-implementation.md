# 弹弹消消乐 · 微信小游戏初版实施规格

日期：2026-10-25
状态：**待评审 → 通过后进入实施**
对应需求：[`TODO.md`](../TODO.md) 第 **8–13** 行（"开始实现微信小程序版本"）
玩法基线：以 `design/` 下 **v7 原型**为唯一事实源

> **路线修正（2026-10-25）**：需求方明确目标是**微信小游戏**，不是小程序。
> 经核实 **Taro 不支持小游戏**（Taro 只做小程序/H5/RN，无小游戏 target），故放弃 Taro+React，
> 改为**原生微信小游戏 + TypeScript + Vite 打包**。原 Taro 版 spec 已作废删除。
> 好消息：原型是纯 Canvas 2D、零 DOM，本就为小游戏形态设计（设计稿 §13.1 结论即"选小游戏"），
> 迁移复用度**高于**小程序方案。

---

## 0. 范围

覆盖 TODO 8–13：

| TODO | 诉求 | 落地 | 本章 |
|---|---|---|---|
| 9 | 建 `src`/`server`/`design`/`specs` 四目录 | 目录归置 | §3 |
| 10 | ~~Taro+React18+Vite~~ → **原生小游戏 + TS + Vite**、`package.json`（lock）、代码放 `src` | 工程化 | §4 §5 |
| 11、12 | 装 lucide，按语义挑 SVG 拷进 `src/assets` 用 | 图标方案 | §10 |
| 13 | 按设计稿实现初版小游戏（不必完全还原） | 架构+里程碑 | §6 §7 §9 §12 |

**本次不做**：`server/` 逻辑（仅空目录）、登录系统（TODO 20–25）、真实素材投放、100 关全量（先跑通现有 10 关）。

---

## 1. 现状盘点

纯静态原型工程，无 `package.json`/`node_modules`/git。可复用资产：

| 资产 | 位置 | 行数 | 复用度 |
|---|---|---|---|
| 数据层（CFG/调色板/关卡/计分/道具） | `design/js/prototype-data.js` | 512 | ★★★ 照搬 |
| 核心逻辑（状态机/网格/物理/回弹/道具/胜负） | `design/js/prototype-core.js` | 1103 | ★★★ 照搬（零渲染依赖） |
| 渲染层（Canvas 2D 全部绘制，含 HOME/结算/暂停场景） | `design/js/prototype-render.js` | 1236 | ★★★ 照搬（小游戏同 API） |
| 主入口（输入/主循环/音效/存档/钱包） | `design/js/prototype-main.js` | 534 | ★☆ 重写为 `game.ts` + 适配层 |
| 配平门禁 | `design/balance-sim.js`、`seed-check.js` | — | 保留在 design |

根 `assets/`（cat/dog/plant 空骨架）与玩法无关，判定残留，列入 §3 清理。

---

## 2. 形态决策：为什么小游戏与原型天然契合

微信小游戏 = **无 DOM、无页面、无路由、无 tabBar，只有一个全屏 Canvas**。这与原型的运行模型**完全一致**：

- 原型用单一 `S.phase`（HOME/READY/PLAY/WIN/LOSE）+ `S.overlay`（pause/buy）**状态机**管理所有"界面"；
- `render.ts` 依据 phase 在同一 Canvas 上绘制不同场景（主页关卡列表、对局、结算浮层、暂停弹窗都已实现）；
- `input` 依据 phase 分发手势。

**这套状态机直接就是小游戏的场景管理**，无需引入任何页面/路由框架。原型 → 小游戏几乎是**一一对应**的平移，这是本路线最大的优势。

---

## 3. 目标目录结构

TODO 第 9 条四目录职责落地：

```
tantan/
├── src/                      # ★ 小游戏 TS 源码（TODO 第10条）
│   ├── game.ts               #   入口（替代 prototype-main.js）：createCanvas + 主循环 + 场景切换
│   ├── core/
│   │   ├── config.ts         #     ← prototype-data.js（CFG/PALETTE/TYPE/SCORE/PROPS）
│   │   ├── levels.ts         #     ← 关卡 map（从 data 拆出）
│   │   ├── engine.ts         #     ← prototype-core.js（Game 状态机/物理）
│   │   └── render.ts         #     ← prototype-render.js
│   ├── platform/             #   ★ wx.* API 适配层（隔离平台，保 core 纯净）
│   │   ├── canvas.ts         #     createCanvas / dpr / requestAnimationFrame
│   │   ├── input.ts          #     onTouch* → 逻辑坐标 + 手势分发
│   │   ├── storage.ts        #     setStorageSync/getStorageSync（存档+钱包）
│   │   ├── audio.ts          #     InnerAudioContext 池 + 节流 + 静音兜底
│   │   ├── system.ts         #     getSystemInfoSync / safeArea
│   │   └── vibrate.ts        #     vibrateShort
│   └── assets/
│       ├── icons/            #     ← lucide 转的 PNG（见 §10）
│       └── audio/            #     ← mp3（可空，走静音兜底）
├── game.json                 # ★ 小游戏全局配置（竖屏 deviceOrientation:portrait）
├── project.config.json       # ★ compileType:"game" + appid
├── vite.config.ts            # ★ 打包成单文件 game.js（iife）
├── tsconfig.json
├── package.json              # ★ lock 模式：附 package-lock.json
├── server/                   # ★ 服务端占位（本次仅 .gitkeep）
├── design/                   # ★ 设计稿 + 原型 + 配平脚本（已就位）
│   ├── js/  assets/          #   原型素材层归置于此（见 §3.1）
├── specs/                    # ★ 需求/计划文档（本文所在）
└── README.md / TODO.md
```

### 3.1 迁移与清理

现有 `src/` 是**原型的素材运行时**，与"src=小游戏码"冲突。素材未投放（全空目录+脚本），迁移成本极低：

1. `src/js/assets-{manifest,loader,check}.js` → `design/js/`；`src/assets/` → `design/assets/`。
2. 同步改引用：`design/prototype.html` 的 `<script src="../src/js/assets-*.js">` → `js/assets-*.js`；`assets-manifest.js` 的 `basePath:'src/assets'` → `'design/assets'`；`assets-loader.js`/`prototype-main.js` 里 `root:'../'` 前缀按新层级校正。
3. 删除根 `assets/`（无关残留）；新建 `server/.gitkeep`。
4. 校验：`node design/js/assets-check.js`、`node serve.js` 打开原型行为不变。

> `balance-sim.js`/`seed-check.js` 复用 `prototype-core` 且 core 不依赖素材层，迁移**不影响**配平门禁。

---

## 4. 技术选型与版本

本机环境：Node **v22.16.0** / npm **10.9.2**。

| 依赖 | 版本 | 说明 |
|---|---|---|
| `typescript` | ^5.x | 源码语言 |
| `vite` | ^5.x（稳定） | ★ TS 编译 + 打包成单文件 `game.js`（iife）；不用最新 8.x，求稳 |
| `miniprogram-api-typings` | 最新 | ★ `wx.*` 全局 API 的 TS 类型定义 |
| `lucide-static` | 1.61.0 | ★ 提供 `icons/*.svg`，供 §10 转换；devDependency |
| `vite-plugin-static-copy` | 最新 | 把 `src/assets` 资源拷进构建产物（图片/音频不打包，运行时相对路径加载） |

**与 TODO 第10条的偏差说明**：TODO 写"Taro+React18"，但那是**小程序**技术栈。小游戏无 DOM，React 的声明式组件模型**用不上**（所有 UI 都在 Canvas 上命令式绘制），故改用 **原生 TS**。用户已确认此路线。对"现代工程化"的诉求（TS + Vite 构建 + lock 模式）全部保留。

---

## 5. 工程初始化与依赖

### 5.1 初始化

```powershell
npm init -y
npm i -D typescript vite miniprogram-api-typings lucide-static vite-plugin-static-copy
npx tsc --init
```

### 5.2 package.json scripts（lock 模式）

"lock 模式"= 提交 `package-lock.json`，团队用 `npm ci` 复现同一依赖树。

```jsonc
{
  "scripts": {
    "dev":         "vite build --watch --mode development",  // 监听编译到 dist/
    "build":       "vite build --mode production",           // 产出 dist/game.js
    "type-check":  "tsc --noEmit",
    "assets:check":"node design/js/assets-check.js"
  }
}
```

### 5.3 vite.config.ts（打包成单个 game.js）

小游戏环境不支持 ESM 动态加载，须把全部 TS **打包成单文件 IIFE**：

```ts
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/game.ts',
      name: 'TTGame',
      formats: ['iife'],       // ★ 单文件自执行，小游戏直接 require
      fileName: () => 'game.js'
    },
    minify: 'terser',
    rollupOptions: { output: { inlineDynamicImports: true } }
  },
  plugins: [
    viteStaticCopy({ targets: [
      { src: 'src/assets/**/*', dest: 'assets' },   // 图片/音频原样拷贝，运行时相对路径引用
      { src: 'game.json', dest: '.' },
      { src: 'project.config.json', dest: '.' }
    ]})
  ]
})
```

**微信开发者工具打开 `dist/`**（含 `game.js`+`game.json`+`project.config.json`+`assets/`）。`dev` 的 `--watch` 配合开发者工具的热重载即可实时调试。

### 5.4 game.json / project.config.json

```jsonc
// game.json —— 必须竖屏（设计稿 §13.4）
{ "deviceOrientation": "portrait", "showStatusBar": false,
  "networkTimeout": { "request": 8000 } }

// project.config.json
{ "compileType": "game", "appid": "wx__你的APPID__",
  "libVersion": "latest", "setting": { "es6": false, "minified": true } }
```

---

## 6. 架构：原型四层 → 小游戏

### 6.1 分层复用

| 原型 | 目标 | 改造量 | 要点 |
|---|---|---|---|
| `prototype-data.js` | `core/config.ts` + `core/levels.ts` | 小 | 去 IIFE/`window.TT`，改 ES `export const`；关卡 map 拆出 |
| `prototype-core.js` | `core/engine.ts` | 小 | 去 `window.Game`，改 `export const Game`；内部 `global.TT.*` 改 import；`localStorage`/`Math.random`/`vibrate` 等副作用**抽到 platform 注入**，保 core 可 Node 直跑 |
| `prototype-render.js` | `core/render.ts` | **极小** | 纯 Canvas 2D 调用**零改动**（小游戏 `getContext('2d')` 同 API） |
| `prototype-main.js` | `game.ts` + `platform/*` | **大（重写）** | 浏览器专属逻辑全替换为 `wx.*`（见 §6.2） |

> **去全局化**：原型靠 `window` 上 `TT`/`Game`/`Render`/`Sfx`/`Storage`/`Wallet` 互相引用。移植统一改 ES import/export，消除 `window`/`global` 依赖，使 `engine.ts` 仍能被 `design/balance-sim.js` 复用（保留配平能力，§13 验收项）。

### 6.2 浏览器 API → 小游戏 wx.* 映射（platform 层核心）

| 原型（浏览器） | 微信小游戏 |
|---|---|
| `document.getElementById('stage')` | `wx.createCanvas()`（首次调用返回**上屏 canvas**） |
| `canvas.getContext('2d')` | 同（API 一致） |
| `global.requestAnimationFrame` | `canvas.requestAnimationFrame` |
| `canvas.getBoundingClientRect()`+`clientX/Y` | `e.touches[0].clientX/Y`（canvas 全屏，直接是屏幕坐标，**无需 rect 换算**） |
| `addEventListener('touch*/mouse*')` | `wx.onTouchStart/onTouchMove/onTouchEnd`（全局注册） |
| `global.localStorage` | `wx.setStorageSync/getStorageSync` |
| `AudioContext` 振荡器合成 | `wx.createInnerAudioContext()` 播 mp3；缺素材**静音兜底** |
| `navigator.vibrate(18)` | `wx.vibrateShort({ type:'light' })` |
| `new Image()` + `img.src` | `wx.createImage()`（或 `canvas.createImage()`） |
| `global.devicePixelRatio` | `wx.getSystemInfoSync().pixelRatio` |
| `performance.now()` | `Date.now()` 或 rAF 回调时间戳 |
| `window.innerWidth/Height` | `wx.getSystemInfoSync().windowWidth/Height` |

### 6.3 需临时调整的细节（TODO 第13条授权）

- 原型右侧"实时状态/数值调参"面板、`prototype.html` 是**开发工具**，不进小游戏，丢弃。
- 滑杆实时改 `CFG.*` → 参数固化为 `config.ts` 常量。
- render 层绘制的 HOME/结算/暂停/购买场景**原样复用**（正是小游戏需要的全 Canvas UI）。

---

## 7. 游戏运行结构

### 7.1 game.ts 入口骨架（对齐设计稿 §13.7）

```ts
import { Game } from './core/engine'
import { Render } from './core/render'
import { createGameCanvas, fitScreen } from './platform/canvas'
import { bindInput } from './platform/input'
import { Storage, Wallet } from './platform/storage'

const canvas = createGameCanvas()          // wx.createCanvas()
const ctx = canvas.getContext('2d')!
const view = fitScreen(canvas, ctx)        // dpr≤2 + 375 基准等比缩放（§8.2）

Game.setWallet(Wallet.read())
Game.loadLevel(0)
Game.toHome()                              // 启动先进主页场景
bindInput(canvas, view)                    // onTouch* → Game 手势接口

let last = 0
function loop(ts: number) {
  const dt = Math.min((ts - last) / 1000, 0.033)  // 钳制防切后台跳帧穿墙
  last = ts
  Game.update(dt)                          // 纯逻辑
  Render.render(ctx)                       // 纯绘制
  canvas.requestAnimationFrame(loop)
}
canvas.requestAnimationFrame(loop)
```

### 7.2 场景 = phase 状态机（零页面/零路由）

原型的 `S.phase` + `S.overlay` 直接充当场景管理，`render` 依 phase 绘制、`input` 依 phase 分发：

```
HOME(主页/关卡列表) ──点关卡──▶ READY ──首次触摸──▶ PLAY
PLAY ──方块全消──▶ WIN(结算浮层) ──下一关──▶ READY
PLAY ──弹药耗尽且球漏完──▶ LOSE ──重试──▶ READY
PLAY ──右上暂停──▶ overlay:'pause'(继续/回主页/声音)
道具=0 点击 ──▶ overlay:{buy}(购买弹窗)
```

**这套流转原型已全部实现**，迁移时仅需把触发源从 DOM 事件换成 `wx.onTouch*`。

---

## 8. Canvas 集成与适配细则

### 8.1 上屏 Canvas

小游戏 `wx.createCanvas()`：**首次调用返回上屏 canvas**（自动铺满屏幕），后续调用返回离屏 canvas（可用于 §13 的预渲染优化）。全局只应有一个上屏 canvas。

### 8.2 尺寸与 DPR（对齐设计稿 §13.4）

```ts
const info = wx.getSystemInfoSync()
const dpr  = Math.min(info.pixelRatio, 2)          // 3 倍屏收益低，钉 2
canvas.width  = info.windowWidth  * dpr
canvas.height = info.windowHeight * dpr
ctx.scale(dpr, dpr)
// 逻辑基准 375×667：scale = windowWidth/375；高度弹性 667~740，多出的补给接球区
```

保留原型"以 375 宽等比缩放"的坐标体系，`render.ts` 内所有 `CFG.W/H` 逻辑坐标**无需改**。触摸坐标 = `clientX / scale`。

### 8.3 安全区

`info.safeArea` 顶/底内边距用于 HUD 下移、漏接线/道具栏上提，避开刘海与 Home Indicator（设计稿 §13.4 长屏机要点）。

### 8.4 生命周期

```ts
wx.onHide(() => { /* 暂停 rAF、停音效 */ })
wx.onShow(() => { last = 0 /* 重置时间戳防跳帧 */ })
```

---

## 9. UI 方案

小游戏**没有组件/页面**，所有 UI 都在 Canvas 上绘制——这正是原型 `render.ts` 已有的能力：

| 界面 | 来源 | 初版策略 |
|---|---|---|
| 主页（开始/关卡列表/头像/钻石） | render `drawHome` | ★ 直接复用（记忆"首页UI布局""关卡选择器动态渲染"已落在此） |
| 对局 HUD（关卡/耗时/发射/进度） | render `drawHUD` | 直接复用 |
| 结算浮层（星级+总分明细） | render `drawResult` | 直接复用 |
| 暂停弹窗 / 购买弹窗 | render `drawPauseDialog`/`drawBuyDialog` | 直接复用 |
| 底部主动道具栏 | render `drawPropBar` | 直接复用 |

> 结论：小游戏 UI **无需新造轮子**，原型 render 层即完整 UI 层。图标类元素用 §10 的 lucide PNG 或沿用程序绘制。

---

## 10. lucide 图标方案（TODO 11、12）

小游戏无 DOM，SVG 不能作 `<img>` 直接用。务实方案：**构建期把 lucide SVG 转成 PNG**，运行时 `wx.createImage()` + `drawImage`。

### 10.1 流程

1. `npm i -D lucide-static@1.61.0`。
2. 按语义从 `node_modules/lucide-static/icons/<name>.svg` 挑选。
3. 写一个 Node 脚本（`scripts/svg2png.mjs`，用 `sharp` 或 `resvg-js`）批量转 PNG（如 3x 尺寸 192²）输出到 `src/assets/icons/`。
4. `render.ts` 里 `drawImage` 引用；或提取 SVG path 数据用 Canvas `Path2D` 绘制（矢量无损，对齐记忆"矢量绘图无损缩放规范"）。

### 10.2 初版图标清单（语义映射）

| 用途 | lucide 名 | | 用途 | lucide 名 |
|---|---|---|---|---|
| 主页/返回主页 | `home` | | 钻石钱包 | `gem` |
| 关卡列表 | `layout-grid` | | 星级 | `star` |
| 暂停 | `pause` | | 分享 | `share-2` |
| 继续 | `play` | | 全部分裂道具 | `git-fork` |
| 音效开/关 | `volume-2`/`volume-x` | | 墙体隐藏道具 | `eye-off` |
| 设置 | `settings` | | 挡板放大道具 | `move-horizontal` |
| 重开 | `rotate-ccw` | | 生命/爆炸球 | `heart`/`bomb` |

> 注：道具图标原型已用 Canvas 程序绘制（分裂白点/炸弹/爱心等，见 v7 规则），lucide PNG 主要补主页/按钮类 UI 图标；两者择优，不强求全替换。

---

## 11. 平台能力适配（初版）

| 能力 | 初版策略 |
|---|---|
| **存档** | `wx.setStorageSync('tantan_progress_v1',…)`/`tantan_wallet_v1`，键名与原型一致，`Storage`/`Wallet` 逻辑照搬 |
| **音频** | `platform/audio.ts` 用 `InnerAudioContext` 播 `assets/audio/*.mp3`；**素材缺失静音兜底**（不报错/不刷屏）；首帧在首次 `onTouchStart` 里 `unlock`（对齐 iOS 首播 100~300ms 延迟）；高频音效（brick/wall）**实例池 + 45ms 节流**防爆音 |
| **震动** | 漏接/爆炸 `wx.vibrateShort`，替换 `navigator.vibrate` |
| **系统信息** | `wx.getSystemInfoSync()` 统一取宽高/dpr/safeArea |

---

## 12. 实施步骤（里程碑）

| 阶段 | 任务 | 验收 |
|---|---|---|
| **M-A 工程脚手架** | §3 目录归置（素材层入 design、删根 assets、建 server）；`npm init`+装依赖；配 `vite.config.ts`(iife)、`tsconfig`、`game.json`、`project.config.json`、lock | `npm run build` 出 `dist/game.js`；开发者工具打开 `dist/` 显示黑屏 Canvas 无报错；`node serve.js` 原型仍正常 |
| **M-B 逻辑移植** | `data/core/render` → `core/config.ts`/`levels.ts`/`engine.ts`/`render.ts`，去 `window` 全局化，副作用抽 platform | `engine.ts` 能被 Node import 且无 DOM 依赖 |
| **M-C 跑通对局** | `game.ts` 入口 + `platform/*`（canvas/input/storage/vibrate/system）；接主循环与触摸 | 真机/工具可完整玩通第 1 关：发射→回弹→消除→结算评星→存档 |
| **M-D 场景与 UI** | 复用 render 的 HOME/结算/暂停/购买/道具栏场景；串起 phase 流转；音频封装 | 主页→选关→对局→结算→下一关 全链路通；暂停/购买弹窗可交互；音效有素材则响、无则静音不报错 |
| **M-E 图标与打磨** | §10 lucide→PNG 接入；异形屏/safeArea 适配；性能观察（§13） | 图标显示正常；主流机型稳定帧率 |

建议按 A→E 顺序提交，每阶段独立可验收。

---

## 13. 验收标准

- [ ] `npm ci` 可在干净环境复现依赖（`package-lock.json` 已提交）。
- [ ] `npm run build` 产出单文件 `dist/game.js`（iife）+ `game.json`+`project.config.json`+`assets/`，微信开发者工具（`compileType:game`）可加载运行。
- [ ] 技术栈符合 §4：原生小游戏 + TS + Vite（iife 单文件）+ `miniprogram-api-typings`。
- [ ] 四目录职责符合 §3：`src`=小游戏码、`server`=空占位、`design`=设计稿+原型、`specs`=文档。
- [ ] `src/assets/icons/` 含 §10 由 lucide 转出的 PNG，且被实际绘制。
- [ ] 初版可玩通至少第 1 关：发射/回弹/道具/结算评星/本地存档全链路成立（对齐 v7 玩法）。
- [ ] 迁移后 `node design/balance-sim.js`、`node design/seed-check.js` 仍退出码 0（engine 未被移植破坏）。
- [ ] `node serve.js` 打开 `design/prototype.html` 行为不变（素材层迁移无回归）。

---

## 14. 风险与注意事项

1. **上屏 canvas 唯一性**：`wx.createCanvas()` 首次=上屏、后续=离屏，务必只调一次拿上屏 canvas，离屏 canvas 另存变量（预渲染优化用）。
2. **单文件打包**：小游戏不支持 ESM 动态 import，Vite 必须 `formats:['iife']`+`inlineDynamicImports`，否则运行时 `require` 失败白屏。
3. **触摸坐标**：canvas 全屏，`e.touches[0].clientX/Y` 即屏幕坐标，除以 `scale` 得逻辑坐标；**别再套 `getBoundingClientRect`**（小游戏无此 API）。
4. **去全局化连带**：`engine` 里 `Sfx`/`Storage`/`Wallet`/`vibrate` 是副作用点，移植须抽到 `platform` 注入，保 `engine` 纯净可 Node 直跑，否则配平门禁失效。
5. **素材路径迁移**：§3.1 改 `basePath`/`root`/`script src` 须同步三处（manifest、loader、prototype.html），漏改致原型 404 或校验误判。
6. **音频**：小游戏无 WebAudio 合成，改 mp3 播放；素材未投放时**必须静音兜底**，不可抛错。首次播放需用户手势内 unlock。
7. **性能**（设计稿 §13.5）：正式版把每帧 `createLinearGradient` 改**离屏 canvas 预渲染**（`wx.createCanvas()` 第二次调用即离屏）；粒子上限 200 + 对象池。初版可暂沿用原型实现，但需中端机验证帧率，列 M-E 观察项。
8. **React 缺失**：已确认小游戏不用 React；若需求方后续要"页面型"UI（如复杂设置页），那是小程序能力，小游戏内只能 Canvas 绘制或走原生弹窗。

---

## 15. 明确不在本次范围

- 服务端 / 云开发 / 成绩同步（`server/` 仅空目录）。
- 登录系统、openid、session 续签（TODO 20–25）。
- 好友排行榜（开放数据域 `openDataContext` + SharedCanvas）、激励视频、分享裂变、游戏圈。
- 100 关全量、皮肤系统、真实美术/音频素材投放。
- 上述待初版跑通后另立 spec 排期。
