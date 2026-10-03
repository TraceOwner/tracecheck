// Bakes the hero artwork's blur and desaturation into src/hero-trace.jpg so the browser
// does not have to filter a full-width animated layer on every frame.
// Usage: node scripts/bake-hero.mjs [source image] (defaults to src/hero-trace.png); needs Chrome (set CHROME to override the path).
import {spawn} from 'node:child_process';
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

const source = new URL(process.argv[2] || '../src/hero-trace.png', import.meta.url);
const target = new URL('../src/hero-trace.jpg', import.meta.url);
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9411, profile = mkdtempSync(path.join(tmpdir(), 'bake-'));
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--no-first-run', 'about:blank'], {stdio: 'ignore'});
try {
  let page;
  for (let i = 0; i < 60 && !page; i++) {
    try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch { await new Promise(r => setTimeout(r, 250)); }
  }
  if (!page) throw new Error('Chrome did not start');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve));
  const pending = new Map();
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); pending.get(message.id)?.(message); });
  let next = 0;
  const send = (method, params = {}) => new Promise(resolve => { const id = ++next; pending.set(id, resolve); socket.send(JSON.stringify({id, method, params})); });
  const mime = /\.png$/i.test(source.pathname) ? 'image/png' : 'image/jpeg';
  const data = readFileSync(source).toString('base64');
  const result = await send('Runtime.evaluate', {awaitPromise: true, returnByValue: true, expression: `(async () => {
    const image = new Image(); image.src = 'data:${mime};base64,${data}'; await image.decode();
    const w = 1672, h = Math.round(1672 * image.height / image.width);
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.filter = 'blur(2.3px) saturate(0.5)';
    ctx.drawImage(image, -6, -6, w + 12, h + 12);   // overscan so the blur has no dark fringe at the edges
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
  })()`});
  if (result.result?.exceptionDetails) throw new Error(JSON.stringify(result.result.exceptionDetails));
  writeFileSync(target, Buffer.from(result.result.result.value, 'base64'));
  console.log('Wrote src/hero-trace.jpg');
  socket.close();
} finally { proc.kill(); }
