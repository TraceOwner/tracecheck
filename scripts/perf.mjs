// Frame-pacing check in a real (headless) Chrome with the machine's GPU.
// Start the site first (`npm run dev`), then: node scripts/perf.mjs [origin]
// It reports load timing and the worst gaps between animation frames while the menu,
// the game list and the guide open. Gaps are measured in ms against the display's
// own frame time, so a smooth run shows nothing above ~1.5x that. Set CHROME to override the browser path.
import {spawn} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

const origin = process.argv[2] || 'http://127.0.0.1:4173';
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9422, profile = mkdtempSync(path.join(tmpdir(), 'trace-perf-'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--window-size=1440,900', '--no-first-run', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--use-angle=d3d11', 'about:blank'], {stdio: 'ignore'});

async function connect() {
  let page;
  for (let i = 0; i < 60 && !page; i++) {
    try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(target => target.type === 'page'); } catch { await sleep(250); }
  }
  if (!page) throw new Error('Chrome did not start; set CHROME to its path');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve));
  const pending = new Map();
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); pending.get(message.id)?.(message); });
  let next = 0;
  const send = (method, params = {}) => new Promise(resolve => { const id = ++next; pending.set(id, resolve); socket.send(JSON.stringify({id, method, params})); });
  const evaluate = async expression => {
    const {result} = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'evaluation failed');
    return result.result.value;
  };
  return {send, evaluate, close: () => { socket.close(); proc.kill(); }};
}

const browser = await connect();
const {send, evaluate} = browser;
const visit = async (route, wait = 5500) => { await send('Page.navigate', {url: `${origin}/${route}`}); await sleep(wait); };
// Scrolling into place happens before sampling starts, so only the opening itself is measured.
const click = async (selector, measure = false) => {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
  await sleep(500);
  if (measure) await startSampling();
  const [x, y] = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', {type, x, y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0});
};
const startSampling = () => evaluate(`window.__gaps = []; window.__sampling = true; (() => { let last = performance.now(); const tick = now => { if (window.__sampling) window.__gaps.push(now - last); last = now; requestAnimationFrame(tick); }; requestAnimationFrame(tick); })()`);
const report = async (label, settle = 1300) => {
  await sleep(settle);
  const gaps = await evaluate('window.__gaps.slice(1)');
  await evaluate('window.__sampling = false');
  const sorted = [...gaps].sort((a, b) => a - b), median = sorted[sorted.length >> 1];
  const slow = gaps.filter(gap => gap > median * 2.4);
  console.log(`${label.padEnd(22)} frame ${median.toFixed(1)} ms | worst gap ${Math.max(...gaps).toFixed(0)} ms | frames over 2.4x: ${slow.length}`);
};

try {
  await send('Page.enable'); await send('Runtime.enable');
  await visit('');
  console.log(await evaluate(`(() => { const n = performance.getEntriesByType('navigation')[0]; return 'home load: DOMContentLoaded ' + Math.round(n.domContentLoadedEventEnd) + ' ms, first paint ' + Math.round(performance.getEntriesByType('paint')[0]?.startTime ?? 0) + ' ms'; })()`));
  await startSampling(); await report('home idle', 2500);
  await click('.menu-trigger', true); await report('menu opens');
  await evaluate(`document.querySelector('#site-menu [data-close-dialog]').click()`); await sleep(1800);
  await visit('check.html');
  await click('#game-trigger', true); await report('game list opens');
  await click('#game-trigger'); await sleep(1200);
  await click('#instructions', true); await report('guide opens');
} finally { browser.close(); }
