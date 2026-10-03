// Builds the 3D hero: bundles src/hero3d/scene.js with three.js into dist/hero3d-scene.js, copies the worker, and
// optionally regenerates the glyph outlines (--glyphs), the poster (--poster) and the Open Graph image (--og);
// the last two need `npm run dev` running and Chrome.
// Requires the dev dependencies: `npm install` (three, esbuild, opentype.js). The outputs are committed in dist/,
// so `npm run build` does not need them.
import {build} from 'esbuild';
import {copyFile, readFile, writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const BAKE = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:transparent}canvas{display:block;width:100vw;height:100vh}</style></head><body><canvas></canvas><script type="module">
import {createHero} from './hero3d-scene.js';
// The poster box around the word, in word widths (the same box trace.css gives .hero3d-poster). The word box and the
// pixel ratio come from the query: the layout of the real page at 1440x900, so the poster is that page's first frame.
const P = {left: -.08, right: .08, above: .62, below: .14};
const q = Object.fromEntries(new URLSearchParams(location.search)), dpr = +q.dpr;
const W = innerWidth, H = innerHeight, word = {left: +q.left, width: +q.width, baseline: +q.baseline};
const canvas = document.querySelector('canvas');
const hero = createHero(canvas, {width: W, height: H, dpr, quality: 2, onInfo: () => {}});
hero.resize(W, H, dpr, word);
hero.step(performance.now());
requestAnimationFrame(() => {
  hero.step(performance.now());
  const out = document.createElement('canvas');
  const sx = (word.left + P.left * word.width) * dpr, sy = (word.baseline - P.above * word.width) * dpr;
  const sw = word.width * (1 + P.right - P.left) * dpr, sh = word.width * (P.above + P.below) * dpr;
  out.width = Math.round(sw); out.height = Math.round(sh);
  out.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
  // Rendered for 2x screens (2870 px wide) and scaled down for 1x (1914) and narrow windows (960); srcset in
  // home-page.mjs picks one.
  const scaled = width => {
    const c = document.createElement('canvas');
    c.width = width; c.height = Math.round(out.height * width / out.width);
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(out, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', .8);
  };
  window.__poster = [out.toDataURL('image/webp', .8), scaled(1914), scaled(960)];
});
</script></body></html>`;
const root = new URL('../', import.meta.url);
const at = p => new URL(p, root);
const args = new Set(process.argv.slice(2));

if (args.has('--glyphs')) {
  // Outlines of the hero word in Golos Text 800, with the same tracking as the plain-text word (-0.055em).
  const opentype = await import('opentype.js');
  const css = await (await fetch('https://fonts.googleapis.com/css2?family=Golos+Text:wght@800')).text();
  const ttf = css.match(/https:\/\/[^)]+\.ttf/)?.[0];
  if (!ttf) throw new Error('Golos Text TTF not found');
  const buffer = await (await fetch(ttf)).arrayBuffer();
  const font = opentype.parse(buffer), upm = font.unitsPerEm, text = 'TRACE', tracking = -.055;
  const glyphs = font.stringToGlyphs(text);
  let pen = 0;
  const letters = glyphs.map((g, i) => {
    const p = g.getPath(pen, 0, upm), n = v => Math.round(v);
    const d = p.commands.map(c => c.type === 'M' || c.type === 'L' ? `${c.type}${n(c.x)} ${n(-c.y)}` : c.type === 'Q' ? `Q${n(c.x1)} ${n(-c.y1)} ${n(c.x)} ${n(-c.y)}` : c.type === 'C' ? `C${n(c.x1)} ${n(-c.y1)} ${n(c.x2)} ${n(-c.y2)} ${n(c.x)} ${n(-c.y)}` : 'Z').join('');
    const box = p.getBoundingBox();
    const next = glyphs[i + 1];
    const letter = {ch: text[i], d, x0: n(box.x1), x1: n(box.x2), y0: n(-box.y2), y1: n(-box.y1)};
    pen += g.advanceWidth + (next ? font.getKerningValue(g, next) : 0) + tracking * upm;
    return letter;
  });
  await writeFile(at('src/hero3d/glyphs.json'), JSON.stringify({text, upm, ascender: font.ascender, descender: font.descender, width: Math.round(pen - tracking * upm), letters}));
  console.log('glyphs: src/hero3d/glyphs.json');
}

await build({entryPoints: [fileURLToPath(at('src/hero3d/scene.js'))], bundle: true, format: 'esm', minify: true, legalComments: 'eof', loader: {'.json': 'json'}, outfile: fileURLToPath(at('dist/hero3d-scene.js')), logLevel: 'warning'});
await copyFile(at('src/hero3d/worker.js'), at('dist/hero3d-worker.js'));
console.log('bundle: dist/hero3d-scene.js, dist/hero3d-worker.js');

const P_LEFT = -.08, P_RIGHT = .08, P_ABOVE = .62;
if (args.has('--poster')) {
  // The poster is the scene's first frame for a known word box, transparent, cropped to the poster box of hero3d.js.
  const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const port = 9419, profile = mkdtempSync(path.join(tmpdir(), 'poster-'));
  await writeFile(at('dist/hero3d-bake.html'), BAKE);
  const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--no-first-run', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--window-size=1440,900', 'about:blank'], {stdio: 'ignore'});
  try {
    let page;
    for (let i = 0; i < 60 && !page; i++) { try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch { await new Promise(r => setTimeout(r, 250)); } }
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => socket.addEventListener('open', r));
    let id = 0; const pending = new Map();
    socket.addEventListener('message', e => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); });
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); socket.send(JSON.stringify({id: i, method, params})); });
    await send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});
    // Where the page puts the word (reduced motion: the poster box at rest, no scene): the canvas covers the hero,
    // which is the window less the scrollbar.
    await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
    await send('Page.navigate', {url: 'http://127.0.0.1:4173/'});
    await new Promise(r => setTimeout(r, 2500));
    const box = (await send('Runtime.evaluate', {returnByValue: true, expression: `(() => { const p = document.querySelector('.hero3d-poster').getBoundingClientRect(), h = document.querySelector('.cinema-hero').getBoundingClientRect(); return {x: p.left - h.left, y: p.top - h.top, w: p.width, cw: h.width, ch: h.height}; })()`})).result.result.value;
    const width = box.w / (1 + P_RIGHT - P_LEFT), query = new URLSearchParams({left: box.x - P_LEFT * width, width, baseline: box.y + P_ABOVE * width, dpr: 2870 / box.w});
    await send('Emulation.setEmulatedMedia', {features: []});
    await send('Emulation.setDeviceMetricsOverride', {width: Math.round(box.cw), height: Math.round(box.ch), deviceScaleFactor: 1, mobile: false});
    await send('Emulation.setDefaultBackgroundColorOverride', {color: {r: 0, g: 0, b: 0, a: 0}});
    await send('Page.navigate', {url: `http://127.0.0.1:4173/hero3d-bake.html?${query}`});
    let data = null;
    for (let i = 0; i < 60 && !data; i++) { await new Promise(r => setTimeout(r, 250)); data = (await send('Runtime.evaluate', {expression: 'window.__poster || null', returnByValue: true})).result?.result?.value; }
    if (!data) throw new Error('poster not rendered');
    await writeFile(at('dist/hero-poster-2870.webp'), Buffer.from(data[0].split(',')[1], 'base64'));
    await writeFile(at('dist/hero-poster.webp'), Buffer.from(data[1].split(',')[1], 'base64'));
    await writeFile(at('dist/hero-poster-960.webp'), Buffer.from(data[2].split(',')[1], 'base64'));
    console.log('poster: dist/hero-poster-2870.webp, dist/hero-poster.webp, dist/hero-poster-960.webp');
  } finally { proc.kill(); await import('node:fs/promises').then(fs => fs.rm(at('dist/hero3d-bake.html'), {force: true})); }
}

if (args.has('--og')) {
  // Open Graph image: the live first screen at 1440x900, cropped to the headline and the word, scaled to 1200x630.
  const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const port = 9420, profile = mkdtempSync(path.join(tmpdir(), 'og-'));
  const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--no-first-run', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--window-size=1440,900', 'about:blank'], {stdio: 'ignore'});
  try {
    let page;
    for (let i = 0; i < 60 && !page; i++) { try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch { await new Promise(r => setTimeout(r, 250)); } }
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => socket.addEventListener('open', r));
    let id = 0; const pending = new Map();
    socket.addEventListener('message', e => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); });
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); socket.send(JSON.stringify({id: i, method, params})); });
    await send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});
    await send('Emulation.setScrollbarsHidden', {hidden: true});
    await send('Page.navigate', {url: 'http://127.0.0.1:4173/'});
    await new Promise(r => setTimeout(r, 6500));
    const shot = await send('Page.captureScreenshot', {format: 'jpeg', quality: 86, clip: {x: 0, y: 130, width: 1440, height: 756, scale: 1200 / 1440}});
    await writeFile(at('dist/og-image.jpg'), Buffer.from(shot.result.data, 'base64'));
    console.log('og: dist/og-image.jpg');
  } finally { proc.kill(); }
}
