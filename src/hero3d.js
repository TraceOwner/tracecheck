'use strict';
/* TRACE hero in 3D. The word is extruded in dark chrome with a magnifying glass in front; through the lens the
   letters show their outlines, like an x-ray. Pointing at the word turns the glass into a scope: it follows the
   pointer and a small cheat-client overlay appears (an ESP box on the nearest letter, three handles that run along
   the strokes of neighbouring letters with live coordinates, a crosshair). Scrolling pulls the letters apart.

   The scene renders in a module Worker on an OffscreenCanvas (hero3d-worker.js → hero3d-scene.js). A still poster
   of the same composition (hero-poster.webp) is in the page from the start; the scene fades in under it and the
   poster fades out. The poster stays for reduced motion, forced colours, save-data, weak devices, narrow windows,
   browsers without WebGL 2 or OffscreenCanvas in workers, and whenever the scene gives up. Without JavaScript the
   plain word stays. */
(() => {
  const hero = document.querySelector('.cinema-hero');
  const word = hero?.querySelector('.cinema-word');
  const span = word?.querySelector('span');
  const motion = window.TraceMotion, ui = window.TraceUI;
  if (!hero || !word || !span || !motion?.ticker) return;
  const {ticker} = motion;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const forcedQuery = matchMedia('(forced-colors: active)');
  const narrowQuery = matchMedia('(max-width: 720px)');
  const saveData = navigator.connection?.saveData === true;
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);

  // The word box is the run of glyphs (a Range), not the block; the baseline comes from the font's descender.
  const DESCENDER = .22;
  // Measured in layout terms, without transforms: the word has an entrance animation and a scroll parallax, and a box
  // read through them would place the camera a few pixels off. Measured on start, resize and font load, then cached.
  let geo = null;
  const measure = () => {
    const range = document.createRange();
    range.selectNodeContents(span);
    const r = range.getBoundingClientRect(), sr = span.getBoundingClientRect();
    const sx = sr.width / Math.max(1, span.offsetWidth), sy = sr.height / Math.max(1, span.offsetHeight);
    let x = 0, y = 0;
    for (let node = span; node && node !== hero; node = node.offsetParent) { x += node.offsetLeft; y += node.offsetTop; }
    const style = getComputedStyle(span), size = parseFloat(style.fontSize), spacing = parseFloat(style.letterSpacing) || 0;
    const left = x + (r.left - sr.left) / sx, bottom = y + (r.bottom - sr.top) / sy;
    return (geo = {w: hero.clientWidth, h: hero.clientHeight, word: {left, width: r.width / sx - spacing, top: bottom - r.height / sy, baseline: bottom - DESCENDER * size}});
  };

  /* ───── Poster: in the HTML from the start (discoverable, high priority, the LCP image) and placed by trace.css in
     units of the word's font size, so it never moves. If it fails to load, the plain word comes back. ───── */
  const poster = word.querySelector('.hero3d-poster');
  if (poster) {
    const lost = () => poster.remove();
    if (poster.complete && !poster.naturalWidth) lost(); else poster.addEventListener('error', lost);
  }

  // WebGL is checked by the API's presence only: creating a probe context on the main thread costs a long task. If the
  // worker cannot get a context it says so and the poster stays. Without OffscreenCanvas in workers the poster stays
  // too: on the main thread the scene would compete with the page for every frame.
  const capable = typeof WebGL2RenderingContext !== 'undefined' && typeof Worker === 'function' && 'transferControlToOffscreen' in HTMLCanvasElement.prototype;
  const allowed = () => !(reduceQuery.matches || forcedQuery.matches || saveData || weak);
  if (!capable || !allowed()) return;
  // A narrow window (a phone, or a desktop window snapped to half a small screen) shows the poster; the scene waits
  // and comes back when the window is wide again.
  let narrow = narrowQuery.matches;

  /* ───── Canvas and overlay ───── */
  const stage = document.createElement('div');
  stage.className = 'hero3d'; stage.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas'); canvas.className = 'hero3d-canvas';
  const hud = document.createElement('canvas'); hud.className = 'hero3d-hud';
  // The stage stays put and carries the fade mask at the bottom of the hero; the layer inside moves with the word's
  // parallax, so the mask never travels down with it and cuts the letters.
  const layer = document.createElement('div'); layer.className = 'hero3d-layer';
  layer.append(canvas, hud); stage.append(layer);
  hero.prepend(stage);
  const ctx = hud.getContext('2d');

  let worker = null, ready = false, revealed = false, stopped = false, running = false, started = false;
  let paused = ui?.motionStopped() ?? false, visible = true, modal = false;
  const dpr = () => Math.min(2, window.devicePixelRatio || 1);
  const post = (message, transfer) => worker?.postMessage(message, transfer || []);

  function onMessage(data) {
    if (data.type === 'ready') { ready = true; reveal(); }
    else if (data.type === 'info') { info = data.info; if (hudOn) drawHud(); }
    else if (data.type === 'give-up' || data.type === 'lost') giveUp();
  }
  // The scene fades in under the poster, then the poster fades out (trace.css), so the word never dims in between.
  // Once the page has scrolled, the poster and the scene no longer match (the letters have moved apart): the swap
  // waits until the page is back at the top or the hero is out of view.
  function reveal() {
    if (!ready || revealed || stopped || narrow || (visible && scrollY > 8)) return;
    revealed = true;
    stage.classList.add('is-live'); word.classList.add('is-3d');
  }
  function giveUp() {
    if (stopped) return;
    stopped = true; running = false;
    post({type: 'run', on: false});
    // The poster comes back over the last frame first; the canvas goes once it is covered.
    word.classList.remove('is-3d');
    stopMonitor(); hudOn = false; clearHud();
    setTimeout(() => {
      stage.remove();
      if (worker) { worker.postMessage({type: 'dispose'}); const w = worker; setTimeout(() => w.terminate(), 200); worker = null; }
    }, revealed ? 950 : 0);
  }
  [reduceQuery, forcedQuery].forEach(query => query.addEventListener?.('change', () => { if (!allowed()) giveUp(); }));
  narrowQuery.addEventListener?.('change', () => {
    narrow = narrowQuery.matches;
    if (narrow && revealed) { revealed = false; stage.classList.remove('is-live'); word.classList.remove('is-3d'); hudOn = false; clearHud(); }
    if (!narrow && !worker && started) { startWorker(); calmCheck(); }
    gate(); reveal();
  });

  function startWorker() {
    // ?hero3d=fps:30,bloom:0,msaa:4,scale:2,fxaa:0,transmission:1 tunes the scene for measurements.
    const debug = Object.fromEntries((new URLSearchParams(location.search).get('hero3d') || '').split(',').filter(Boolean).map(pair => { const [k, v] = pair.split(':'); return [k, +v]; }));
    const g = measure();
    try {
      worker = new Worker('hero3d-worker.js', {type: 'module'});
      const surface = canvas.transferControlToOffscreen();
      worker.onmessage = ({data}) => onMessage(data);
      worker.onerror = () => giveUp();
      post({type: 'init', w: g.w, h: g.h, word: g.word, dpr: dpr(), scroll: progress(), debug, canvas: surface}, [surface]);
      sizeHud();
      gate();
    } catch { giveUp(); }
  }

  /* ───── Loop gate: visible, tab shown, motion allowed, no modal dialog over the page ───── */
  function gate() {
    if (!worker) return;
    const run = !stopped && !paused && visible && !document.hidden && !modal && !narrow;
    if (run !== running) { running = run; post({type: 'run', on: run}); if (run) startMonitor(); else stopMonitor(); }
    // A paused scene draws one frame at the current state; behind a dialog the last frame simply stays.
    if (!run && !modal) post({type: 'still'});
  }
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; gate(); reveal(); }).observe(hero);
  document.addEventListener('visibilitychange', gate);
  ui?.onMotion(value => { paused = value; gate(); });
  // The menu is a modal dialog that dims the page: the scene behind it stands still, like the smoke (motion.js).
  const dialogs = [...document.querySelectorAll('dialog')];
  const watchDialogs = new MutationObserver(() => { const open = dialogs.some(d => d.open); if (open !== modal) { modal = open; gate(); } });
  dialogs.forEach(d => watchDialogs.observe(d, {attributes: true, attributeFilter: ['open']}));

  /* ───── Page frames. The scene runs in its own thread but shares the GPU with the page: if the page starts missing
     frames while the scene is on, the scene steps its quality down. The page's own refresh period is measured before
     the scene starts. ───── */
  let basePeriod = 1000 / 60, monitorJob = null;
  function startMonitor() {
    if (monitorJob || stopped) return;
    let windowStart = 0, frames = 0, late = 0, cooldown = 0;
    monitorJob = ticker.add((now, dt) => {
      const gap = dt * 1000;
      // While the page scrolls, its own late frames (they happen without the scene too) say nothing about the scene.
      if (!windowStart || now - scrolling < 400) { windowStart = now; frames = late = 0; return; }
      frames++; if (gap > basePeriod * 1.5) late++;
      if (now - windowStart < 1000) return;
      // More than a quarter of the page's frames late in a second, with the scene on screen: one step down.
      if (now > cooldown && frames >= 20 && late / frames > .25 && revealed) { post({type: 'page-slow'}); cooldown = now + 2000; }
      windowStart = now; frames = late = 0;
    });
  }
  function stopMonitor() { monitorJob?.(); monitorJob = null; }
  function measurePeriod() {
    return new Promise(resolve => {
      const gaps = [];
      ticker.add((now, dt) => { gaps.push(dt * 1000); if (gaps.length < 40) return; gaps.sort((a, b) => a - b); resolve(gaps[gaps.length >> 2]); return false; });
    });
  }

  /* ───── Size, scroll ───── */
  function sizeHud() { const r = dpr(); hud.width = Math.round(geo.w * r); hud.height = Math.round(geo.h * r); }
  let sizeFrame = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(sizeFrame);
    sizeFrame = requestAnimationFrame(() => {
      if (stopped) return;
      const g = measure();
      // A hero with no size (a window being resized to nothing, a hidden tab in some browsers) would hand the GPU
      // empty buffers.
      if (g.w < 2 || g.h < 2 || g.word.width < 2) return;
      sizeHud();
      post({type: 'resize', w: g.w, h: g.h, dpr: dpr(), word: g.word});
    });
  }).observe(hero);
  document.fonts?.ready.then(() => { if (worker && !stopped) { const g = measure(); post({type: 'resize', w: g.w, h: g.h, dpr: dpr(), word: g.word}); } });
  const progress = () => clamp(scrollY / Math.max(1, hero.offsetHeight));
  // The canvas follows the word's scroll parallax (trace.css moves both with a scroll timeline); where scroll timelines
  // are missing, this does it, the way site.js moves the word.
  const timelines = CSS.supports('animation-timeline', 'scroll()');
  let scrolling = 0;
  ui?.onScroll(y => {
    const p = clamp(y / Math.max(1, hero.offsetHeight));
    post({type: 'scroll', p});
    if (!timelines) layer.style.transform = ui.motionStopped() ? '' : `translate3d(0,${(p * 110).toFixed(1)}px,0)`;
    scrolling = performance.now();
    calmCheck();
    reveal();
  });

  /* ───── Rate: about 60 a second while the pointer is in the hero, half that otherwise and while the page scrolls
     (the drift is slow; the GPU goes to the page). ───── */
  let pointerAt = 0, calm = null, calmTimer = 0;
  function calmCheck() {
    const now = performance.now();
    const active = now - pointerAt < 1500 && now - scrolling > 250;
    if (calm !== !active) { calm = !active; post({type: 'calm', on: calm}); }
    clearTimeout(calmTimer);
    if (active || now - scrolling < 250) calmTimer = setTimeout(calmCheck, 260);
  }

  /* ───── Pointer: anywhere in the hero tilts the scene; over the word the glass becomes a scope ───── */
  let hudOn = false, info = null, ptr = {x: 0, y: 0}, hudFade = 0, fadeJob = null;
  function onPointer(event) {
    if (event.pointerType === 'touch' || stopped) return;
    // Canvas coordinates: the stage moves with the parallax, the same as the word.
    const h = layer.getBoundingClientRect(), r = span.getBoundingClientRect();
    const x = event.clientX - h.left, y = event.clientY - h.top, pad = r.height * (hudOn ? .3 : .12);
    const overUi = !!event.target.closest?.('a,button');
    const hot = revealed && !overUi && event.clientX > r.left - pad && event.clientX < r.right + pad && event.clientY > r.top - pad && event.clientY < r.bottom + pad;
    ptr = {x, y};
    pointerAt = performance.now(); calmCheck();
    post({type: 'pointer', x: x / h.width, y: y / h.height, inside: true, hot});
    if (hot !== hudOn) { hudOn = hot; post({type: 'info', on: hot}); fade(); }
  }
  hero.addEventListener('pointermove', onPointer, {passive: true});
  hero.addEventListener('pointerleave', () => {
    post({type: 'pointer', x: .5, y: .5, inside: false, hot: false});
    pointerAt = 0; calmCheck();
    if (hudOn) { hudOn = false; post({type: 'info', on: false}); fade(); }
  });

  // The overlay fades with a damped value on the page's ticker, then stops.
  function fade() {
    if (fadeJob) return;
    fadeJob = ticker.add((now, dt) => {
      hudFade += ((hudOn ? 1 : 0) - hudFade) * (1 - Math.exp(-(hudOn ? 12 : 9) * dt));
      if (!hudOn && hudFade < .01) { hudFade = 0; fadeJob = null; clearHud(); return false; }
      if (!info || !hudOn) drawHud();
      if (hudOn && hudFade > .995) { fadeJob = null; return false; }
    });
  }

  /* ───── Overlay drawing (CSS px) ───── */
  const MONO = '500 10px "IBM Plex Mono", ui-monospace, Consolas, monospace';
  const rgba = (c, a) => `rgba(${c},${a})`;
  const WHITE = '255,255,255', BONE = '206,210,216', INK = '9,10,13';
  function clearHud() { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, hud.width, hud.height); }
  function text(str, x, y, color) { ctx.font = MONO; ctx.textAlign = 'left'; ctx.fillStyle = color; ctx.fillText(str, x, y); }
  function drawHud() {
    clearHud();
    if (!info || hudFade < .01 || !geo) return;
    const r = hud.width / Math.max(1, geo.w);
    ctx.setTransform(r, 0, 0, r, 0, 0);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.globalAlpha = hudFade;
    const wordBox = geo.word, letters = info.letters, L = letters[info.near];
    // ESP box on the letter nearest to the scope, tagged with the letter, its place in the word and its size on screen.
    if (L) {
      const [x0, y0, x1, y1] = L, pad = 8, len = Math.max(10, Math.min(28, (y1 - y0) * .14));
      ctx.lineWidth = 2; ctx.strokeStyle = rgba(WHITE, .95); ctx.beginPath();
      ctx.moveTo(x0 - pad, y0 - pad + len); ctx.lineTo(x0 - pad, y0 - pad); ctx.lineTo(x0 - pad + len, y0 - pad);
      ctx.moveTo(x1 + pad - len, y0 - pad); ctx.lineTo(x1 + pad, y0 - pad); ctx.lineTo(x1 + pad, y0 - pad + len);
      ctx.moveTo(x1 + pad, y1 + pad - len); ctx.lineTo(x1 + pad, y1 + pad); ctx.lineTo(x1 + pad - len, y1 + pad);
      ctx.moveTo(x0 - pad + len, y1 + pad); ctx.lineTo(x0 - pad, y1 + pad); ctx.lineTo(x0 - pad, y1 + pad - len);
      ctx.stroke();
      text(`${'TRACE'[info.near]}·${String(info.near + 1).padStart(2, '0')}  ${Math.round(x1 - x0)}×${Math.round(y1 - y0)}`, x0 - pad + 1, y0 - pad - 8, rgba(WHITE, 1));
    }
    // Handles: one per neighbouring letter, on its stroke, with coordinates on the word.
    ctx.font = MONO;
    const pts = info.handles || [];
    ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.strokeStyle = rgba(BONE, .55); ctx.beginPath();
    pts.forEach(([, x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); if (pts.length) ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    pts.forEach(([i, x, y]) => {
      ctx.strokeStyle = rgba(WHITE, .8); ctx.strokeRect(x - 7.5, y - 7.5, 15, 15);
      ctx.fillStyle = rgba(WHITE, 1); ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      const label = `${'TRACE'[i]} ${String(Math.round(x - wordBox.left)).padStart(4)},${String(Math.round(y - wordBox.top)).padStart(4)}`;
      const w = ctx.measureText(label).width + 8;
      const sides = [[x + 12, y - 7], [x - 7, y + 12], [x - 12 - w, y - 7], [x - 7, y - 26]];
      const clear = ([sx, sy]) => Math.hypot(Math.max(sx - ptr.x, 0, ptr.x - sx - w), Math.max(sy - ptr.y, 0, ptr.y - sy - 14));
      const [lx, ly] = sides.find(s => clear(s) > 34) || sides.reduce((a, s) => clear(s) > clear(a) ? s : a);
      ctx.fillStyle = rgba(INK, .78); ctx.fillRect(lx, ly, w, 14);
      text(label, lx + 4, ly + 10.5, rgba(WHITE, 1));
    });
    // Crosshair at the pointer.
    const {x: cx, y: cy} = ptr;
    ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(WHITE, .95); ctx.beginPath();
    ctx.moveTo(cx - 14, cy); ctx.lineTo(cx - 5, cy); ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 14, cy);
    ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy - 5); ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 14); ctx.stroke();
    ctx.fillStyle = rgba(WHITE, 1); ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    ctx.globalAlpha = 1;
  }

  /* ───── Start after first paint, when the main thread is idle: measure the page's refresh, then the scene ───── */
  const idle = window.requestIdleCallback || (cb => setTimeout(cb, 200));
  (document.readyState === 'complete' ? Promise.resolve() : new Promise(r => addEventListener('load', r, {once: true})))
    .then(() => document.fonts?.ready).catch(() => {})
    .then(() => new Promise(r => idle(r, {timeout: 1500})))
    .then(measurePeriod)
    .then(period => { basePeriod = period; started = true; if (!stopped && !narrow) { startWorker(); calmCheck(); } });
})();
