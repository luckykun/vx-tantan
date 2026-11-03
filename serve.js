/* 零依赖静态服务器：仅用于在浏览器中打开 design/ 下的原型与文档。
 *
 * 为什么需要它：design/prototype.html 用 <script src> 加载 design/js/ 下的四个文件，
 * 以 file:// 双击打开时部分浏览器会按跨域策略拒绝加载，原型白屏。
 * 走 HTTP 即可正常打开。（index.html / ui-mockups.html 是单文件内联的，不依赖本脚本。）
 *
 * 为何以仓库根为 ROOT：原型在 design/，而素材在 src/assets/，页面用 ../src/assets/... 引用。若 ROOT 停在 design/，
 * 下方防穿越检查会把 .. 请求直接 404 拦掉，素材永远加载不到。
 *
 *   node serve.js            → http://127.0.0.1:8848/
 *   node serve.js 9000       → 换端口
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 8848;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/design/index.html';

  const file = path.join(ROOT, urlPath);
  // 防路径穿越：解析后必须仍在 ROOT 内
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('404 Not Found: ' + urlPath);
  }

  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`design server on http://127.0.0.1:${PORT}/`);
  console.log(`  原型   http://127.0.0.1:${PORT}/design/prototype.html`);
  console.log(`  设计稿 http://127.0.0.1:${PORT}/design/index.html`);
  console.log(`  视觉稿 http://127.0.0.1:${PORT}/design/ui-mockups.html`);
});
