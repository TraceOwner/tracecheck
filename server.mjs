import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('./dist/',import.meta.url));
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2','.ps1':'text/plain; charset=utf-8','.cmd':'text/plain; charset=utf-8'};
http.createServer(async (req,res) => {
 try { const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname); const file = path.resolve(root,'.' + (pathname === '/' ? '/index.html' : pathname)); if (!file.startsWith(root)) {res.writeHead(403).end();return;} const body = await readFile(file); res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream','X-Content-Type-Options':'nosniff'}); res.end(body); } catch { try { const page = await readFile(path.join(root, '404.html')); res.writeHead(404, {'Content-Type': mime['.html'], 'X-Content-Type-Options': 'nosniff'}).end(page); } catch { res.writeHead(404).end('Not found'); } }
}).listen(4173,'127.0.0.1',() => console.log('TRACE preview: http://127.0.0.1:4173'));
