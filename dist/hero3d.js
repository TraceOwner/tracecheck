'use strict';
/* TRACE hero in 3D. The word is extruded in dark chrome; reflections drift across it. Pointing at the word lifts
   the letter under the pointer towards you and a light follows the pointer over the metal. Scrolling pulls the
   letters apart.

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
  // The scene waits for the poster's entrance (trace.css) to finish before it takes over.
  let introDone = !poster || !poster.getAnimations?.().length;
  const endIntro = () => { if (!introDone) { introDone = true; reveal(); } };
  if (poster) {
    poster.addEventListener('animationend', endIntro);
    setTimeout(endIntro, 2600);
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
  // The stage stays put and carries the fade mask at the bottom of the hero; the layer inside moves with the word's
  // parallax, so the mask never travels down with it and cuts the letters.
  const layer = document.createElement('div'); layer.className = 'hero3d-layer';
  layer.append(canvas); stage.append(layer);
  hero.prepend(stage);

  let worker = null, ready = false, revealed = false, stopped = false, running = false, started = false;
  let paused = ui?.motionStopped() ?? false, visible = true, modal = false;
  const dpr = () => Math.min(2, window.devicePixelRatio || 1);
  const post = (message, transfer) => worker?.postMessage(message, transfer || []);

  function onMessage(data) {
    if (data.type === 'ready') { ready = true; reveal(); }
    else if (data.type === 'give-up' || data.type === 'lost') giveUp();
  }
  // The scene fades in under the poster, then the poster fades out (trace.css), so the word never dims in between.
  // Once the page has scrolled, the poster and the scene no longer match (the letters have moved apart): the swap
  // waits until the page is back at the top or the hero is out of view.
  function reveal() {
    if (!ready || !introDone || revealed || stopped || narrow || (visible && scrollY > 8)) return;
    revealed = true;
    stage.classList.add('is-live'); word.classList.add('is-3d');
    // Once the poster has faded out, the letters wake: a ripple and a sweep of light (scene.js), drawn at full rate.
    if (!woken) setTimeout(() => { woken = true; wakeUntil = performance.now() + 2200; post({type: 'wake'}); calmCheck(); }, 950);
  }
  function giveUp() {
    if (stopped) return;
    stopped = true; running = false;
    post({type: 'run', on: false});
    // The poster comes back over the last frame first; the canvas goes once it is covered.
    word.classList.remove('is-3d');
    stopMonitor(); hudOn = false;
    setTimeout(() => {
      stage.remove();
      if (worker) { worker.postMessage({type: 'dispose'}); const w = worker; setTimeout(() => w.terminate(), 200); worker = null; }
    }, revealed ? 950 : 0);
  }
  [reduceQuery, forcedQuery].forEach(query => query.addEventListener?.('change', () => { if (!allowed()) giveUp(); }));
  narrowQuery.addEventListener?.('change', () => {
    narrow = narrowQuery.matches;
    if (narrow && revealed) { revealed = false; stage.classList.remove('is-live'); word.classList.remove('is-3d'); hudOn = false; }
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
  let sizeFrame = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(sizeFrame);
    sizeFrame = requestAnimationFrame(() => {
      if (stopped) return;
      const g = measure();
      // A hero with no size (a window being resized to nothing, a hidden tab in some browsers) would hand the GPU
      // empty buffers.
      if (g.w < 2 || g.h < 2 || g.word.width < 2) return;
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
  let pointerAt = 0, calm = null, calmTimer = 0, wakeUntil = 0, woken = false;
  function calmCheck() {
    const now = performance.now();
    const active = (now - pointerAt < 1500 && now - scrolling > 250) || now < wakeUntil;
    if (calm !== !active) { calm = !active; post({type: 'calm', on: calm}); }
    clearTimeout(calmTimer);
    if (active || now - scrolling < 250 || now < wakeUntil) calmTimer = setTimeout(calmCheck, 260);
  }

  /* ───── Pointer: anywhere in the hero tilts the scene; over the word the letters answer it (scene.js) ───── */
  let hudOn = false;
  function onPointer(event) {
    if (event.pointerType === 'touch' || stopped) return;
    // Canvas coordinates: the stage moves with the parallax, the same as the word.
    const h = layer.getBoundingClientRect(), r = span.getBoundingClientRect();
    const x = event.clientX - h.left, y = event.clientY - h.top, pad = r.height * (hudOn ? .3 : .12);
    const overUi = !!event.target.closest?.('a,button');
    const hot = revealed && !overUi && event.clientX > r.left - pad && event.clientX < r.right + pad && event.clientY > r.top - pad && event.clientY < r.bottom + pad;
    pointerAt = performance.now(); calmCheck();
    post({type: 'pointer', x: x / h.width, y: y / h.height, inside: true, hot});
    hudOn = hot;
  }
  hero.addEventListener('pointermove', onPointer, {passive: true});
  hero.addEventListener('pointerleave', () => {
    post({type: 'pointer', x: .5, y: .5, inside: false, hot: false});
    pointerAt = 0; calmCheck();
    hudOn = false;
  });

  /* ───── Start after first paint, when the main thread is idle: measure the page's refresh, then the scene ───── */
  const idle = window.requestIdleCallback || (cb => setTimeout(cb, 200));
  (document.readyState === 'complete' ? Promise.resolve() : new Promise(r => addEventListener('load', r, {once: true})))
    .then(() => document.fonts?.ready).catch(() => {})
    .then(() => new Promise(r => idle(r, {timeout: 1500})))
    .then(measurePeriod)
    .then(period => { basePeriod = period; started = true; if (!stopped && !narrow) { startWorker(); calmCheck(); } });
})();
