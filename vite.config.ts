import { defineConfig, type Plugin } from 'vite'
import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 构建后把小游戏配置与静态资源拷进 dist/，使 dist/ 成为微信开发者工具可直接打开的小游戏根目录。
 * 取代 vite-plugin-static-copy：零额外依赖、无 Vite 大版本 peer 冲突。
 *   dist/
 *     game.js              ← Vite 打包的单文件 IIFE（入口）
 *     game.json            ← 拷贝
 *     project.config.json  ← 拷贝
 *     assets/…             ← 拷贝 src/assets（图标 PNG / 音频 mp3，运行时相对路径加载）
 */
function copyMiniGameFiles(): Plugin {
  const root = process.cwd()
  return {
    name: 'tantan:copy-minigame-files',
    apply: 'build',
    closeBundle() {
      const out = resolve(root, 'dist')
      for (const f of ['game.json', 'project.config.json']) {
        const src = resolve(root, f)
        if (existsSync(src)) cpSync(src, resolve(out, f))
      }
      const asrc = resolve(root, 'src/assets')
      if (existsSync(asrc)) cpSync(asrc, resolve(out, 'assets'), { recursive: true })
    }
  }
}

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2015',
    minify: 'esbuild',
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(process.cwd(), 'src/game.ts'),
      output: {
        format: 'iife',
        entryFileNames: 'game.js',
        inlineDynamicImports: true
      }
    }
  },
  plugins: [copyMiniGameFiles()]
})
