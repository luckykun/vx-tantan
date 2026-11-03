# 素材目录 · 投放规范

本目录存放**需要美术出图的位图**与**音频文件**。当前 **44 项全部待投放**，
运行时一律走程序绘制 / 合成音回退，原型与设计稿均可正常打开试玩，不影响任何功能验证。

> 清单的唯一事实源是 [`../js/assets-manifest.js`](../js/assets-manifest.js)。
> 增删素材**只改那一个文件**，校验脚本与运行时加载器会自动跟上，不必改本文档以外的地方。

---

## 一、三步投放

```powershell
# ① 建目录骨架（首次执行，已存在则跳过）
node src/js/assets-check.js --init

# ② 把文件按下方清单放进 src/assets/ 对应子目录，文件名必须完全一致

# ③ 校验：退出码 0 = 齐备且合规
node src/js/assets-check.js            # 看板模式，列出进度
node src/js/assets-check.js --strict   # 门禁模式，缺任何一项即失败
```

校验脚本查三件事：**文件在不在**、**像素尺寸对不对**（直接解析 PNG 的 IHDR，零依赖）、**体积是否超标**。

---

## 二、位图清单（33 项）

来源：[`design/ui-mockups.html`](../../design/ui-mockups.html) §6.1。
该章的原则是**「能用程序画的一律不出图」**——方块、小球、横条、弹道线、粒子全部 Canvas 绘制，
所以这里**没有**它们的位图，只有图标与背景。

| 路径 | 尺寸 | 数量 | 优先级 | 说明 |
|---|---|---|---|---|
| `images/appicon/icon-1024.png` | 1024×1024 | 1 | M1 | App 图标，提交审核用 |
| `images/bg/bg-dark.png` | 1125×2001 | 1 | M1 | 主背景，暗主题「深夜台球厅」路线 |
| `images/bg/bg-light.png` | 1125×2001 | 1 | P1 | 备选亮背景 |
| `images/panel/hud.9.png` | 120×120 | 1 | M1 | HUD 三段式底板（.9 图） |
| `images/panel/dialog.9.png` | 180×180 | 1 | M1 | 结算 / 确认浮层底板（.9 图） |
| `images/panel/sheet.9.png` | 160×160 | 1 | M1 | 底部抽屉面板底板（.9 图） |
| `images/icon/pause.png` | 64×64 | 1 | **M0** | 暂停 |
| `images/icon/resume.png` | 64×64 | 1 | M1 | 继续 |
| `images/icon/settings.png` | 64×64 | 1 | M1 | 设置 |
| `images/icon/sound-on.png` | 64×64 | 1 | **M0** | 音效开 |
| `images/icon/sound-off.png` | 64×64 | 1 | **M0** | 音效关 |
| `images/icon/vibrate-on.png` | 64×64 | 1 | M1 | 震动开 |
| `images/icon/vibrate-off.png` | 64×64 | 1 | M1 | 震动关 |
| `images/icon/share.png` | 64×64 | 1 | M1 | 分享 |
| `images/icon/rank.png` | 64×64 | 1 | M1 | 排行榜 |
| `images/icon/back.png` | 64×64 | 1 | M1 | 返回 |
| `images/icon/home.png` | 64×64 | 1 | M1 | 主页 |
| `images/icon/help.png` | 64×64 | 1 | M1 | 帮助 / 引导 |
| `images/icon/ad.png` | 64×64 | 1 | M1 | 激励视频入口 |
| `images/icon/restart.png` | 64×64 | 1 | M1 | 重开本关 |
| `images/star/star-big.png` | 96×96 | 1 | M1 | 结算大星（逐颗弹入） |
| `images/star/star-small.png` | 32×32 | 1 | M1 | 关卡选择小星 · 点亮态 |
| `images/star/star-gray.png` | 32×32 | 1 | M1 | 关卡选择小星 · 未点亮态 |
| `images/lock/locked.png` | 48×48 | 1 | M1 | 未解锁关卡标记 |
| `images/lock/unlocked.png` | 48×48 | 1 | M1 | 已解锁标记 |
| `images/share/card-default.png` | 500×400 | 1 | M1 | 通用分享卡片底图 |
| `images/share/card-win.png` | 500×400 | 1 | M1 | 通关炫耀分享底图 |
| `images/skin/skin-*.png` | 120×120 | 6 | P1 | 皮肤图标：classic / neon / candy / wood / gold / cosmos |

优先级：**M0** = 原型阶段就该有 · **M1** = 正式版上线需要 · **P1** = 可延后。

---

## 三、音频清单（11 项）

来源：§6.2。**格式硬约束：mp3 / 44.1kHz / 64kbps / 单声道**，10 个音效合计目标 ≈ 2.6s。

| 路径 | 时长 | 实例池 | 优先级 | 说明 |
|---|---|---|---|---|
| `audio/shoot.mp3` | ≈100ms | 1 | **M0** | 发射 |
| `audio/brick.mp3` | ≈70ms | 6 | **M0** | 消除方块（高频） |
| `audio/wall.mp3` | ≈50ms | 6 | **M0** | 撞墙（高频，运行时另有 45ms 节流） |
| `audio/split.mp3` | ≈200ms | 2 | **M0** | 分裂，产品的招牌时刻，反馈最强 |
| `audio/catch.mp3` | ≈90ms | 3 | **M0** | 接住球 |
| `audio/lose.mp3` | ≈160ms | 2 | **M0** | 漏接 |
| `audio/open.mp3` | ≈280ms | 1 | **M0** | 超时开底 |
| `audio/win.mp3` | ≈480ms | 1 | **M0** | 通关 |
| `audio/fail.mp3` | ≈540ms | 1 | **M0** | 失败 |
| `audio/ui.mp3` | ≈60ms | 2 | M1 | 按钮点击 |
| `audio/bgm.mp3` | 60~90s | 1 | P1 | 背景音乐，需**无缝接缝**，循环播放 |

### 为什么音效缺失也听得见

[`../js/assets-loader.js`](../js/assets-loader.js) 的 `TTAudio.play(key)` 有两条路径：
素材加载成功就播素材，否则转发给 [`design/js/prototype-main.js`](../../design/js/prototype-main.js) 里
基于 WebAudio 振荡器合成的 `Sfx`（频率与时长同 §12）。所以现在的静音不是 bug，
投放 mp3 后**无需改一行代码**即自动升级为真实音效。

### 两条必须保留的运行时约束

已在 loader 中落实，接入微信 `InnerAudioContext` 时同样要守：

1. **启动时预创建实例并静音播一次**（`TTAudio.unlock()`，在首次用户手势里调）——
   微信 iOS 首次播放有 100~300ms 延迟，不做这步会表现为「第一次音效丢失」。
2. **高频音效用实例池轮转，绝不每次 `new`**——
   见清单的「实例池」列。`brick` / `wall` 一秒可触发数次，重复 new 会内存泄漏并爆音。

---

## 四、约定与注意

- **文件名与尺寸必须与清单完全一致**，校验按字节比对 IHDR 宽高，差 1px 判不合规。
- 位图统一 PNG（含 alpha），单张 ≤ 150KB；超出通常是忘记压缩或未去背景。
- `.9.png` 是可拉伸图，四角与四边为保护区、中间拉伸；若引擎侧不用 .9，改成同名普通 PNG 即可，
  但要同步改 `assets-manifest.js` 的 `file` 字段。
- 目录名与文件名只用**小写 ASCII + 连字符**，避免真机大小写敏感与中文路径问题。
- 本目录**不放**任何脚本与文档，只放素材；`assets-manifest.js` 等代码一律在 `src/js/`。
