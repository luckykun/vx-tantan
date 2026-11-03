/**
 * 运行时全局宿主。
 *
 * 微信小游戏没有 window / DOM。原型的四层是 IIFE，靠把对象挂在 window 上互相引用
 * （TT / Game / Render / Storage / Sfx / navigator …）。移植策略：保持每个 IIFE 结构不变，
 * 仅把它的执行上下文从 `window` 换成下面这个共享对象 `G`，从而把"全局"收敛成一个显式注入点。
 *
 * 各层文件末尾的 `})(window);` 统一改为 `})(G);`；平台适配层在 game.ts 启动时把
 * Storage / Sfx / navigator 等挂到 G 上，逻辑层再按 `global.X` 读取（global 即形参名 = G）。
 */
declare const GameGlobal: any;

export const G: any = {};

// 保险：把宿主挂到真实全局上，兼容个别以裸 `window.*` 访问的代码路径（小游戏里 window 不存在会抛错）。
try {
  const root: any =
    typeof globalThis !== 'undefined' ? globalThis
    : typeof GameGlobal !== 'undefined' ? (GameGlobal as any)
    : {};
  if (!root.window) root.window = G;
} catch (e) { /* 忽略：非小游戏环境 */ }
