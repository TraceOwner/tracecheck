'use strict';
/* Trace field: thin filaments drift through a slowly turning flow and leave
   fading trails. The pointer is a vortex that heats threads to white; a click
   sends a pressure wave through the field. Canvas 2D, paused off-screen. */
(() => {
  const host = document.querySelector('.final-cta');
  if (!host) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'trace-field';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);
  const ctx = canvas.getContext('2d', {alpha: true});
  if (!ctx) { canvas.remove(); return; }
  host.dataset.field = 'live';

  const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let stopped = window.TraceUI?.motionStopped() ?? reduceQuery.matches;
  let width = 0, height = 0, ratio = 1, frame = 0, visible = false, last = 0, time = Math.random() * 100;
  const pointer = {x: 0, y: 0, tx: 0, ty: 0, active: false, strength: 0};
  const waves = [];
  let particles = [];

  const TAU = Math.PI * 2;
  // A smooth, slowly rotating field built from layered waves: cheap, seamless.
  const angleAt = (x, y, t) =>
    Math.sin(x * .0021 + t * .11) * 1.7 +
    Math.cos(y * .0026 - t * .083) * 1.9 +
    Math.sin((x + y) * .0012 + t * .047) * 1.3 +
    Math.cos((x - y * .6) * .0034 - t * .061) * .8;

  function spawn(p, anywhere) {
    p.x = Math.random() * width;
    p.y = anywhere ? Math.random() * height : height * (.15 + Math.random() * .7);
    p.vx = 0; p.vy = 0;
    p.life = 0; p.max = 260 + Math.random() * 420;
    p.heat = 0;
    p.speed = .55 + Math.random() * .9;
    return p;
  }
  function resize() {
    const box = host.getBoundingClientRect();
    ratio = Math.min(1.5, devicePixelRatio || 1);
    width = box.width; height = box.height;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.round(Math.min(1500, Math.max(500, width * height / 900)));
    particles = Array.from({length: count}, () => spawn({}, true));
    ctx.clearRect(0, 0, width, height);
    if (stopped) paintStill();
  }

  // Heat buckets let each colour be stroked as one path.
  const buckets = [
    {stroke: 'rgba(160,161,164,.20)', width: .8},
    {stroke: 'rgba(176,177,180,.34)', width: .9},
    {stroke: 'rgba(201,202,205,.55)', width: 1.1},
    {stroke: 'rgba(225,226,229,.8)', width: 1.3}
  ];
  const paths = buckets.map(() => new Path2D());

  function step(dt) {
    time += dt;
    // Pointer follows with inertia; without a pointer a slow wanderer keeps the field alive.
    if (!pointer.active) {
      pointer.tx = width * (.5 + Math.sin(time * .17) * .34);
      pointer.ty = height * (.52 + Math.sin(time * .23 + 1.3) * .26);
    }
    const follow = 1 - Math.exp(-dt * (pointer.active ? 9 : 1.5));
    pointer.x += (pointer.tx - pointer.x) * follow;
    pointer.y += (pointer.ty - pointer.y) * follow;
    pointer.strength += ((pointer.active ? 1 : .35) - pointer.strength) * (1 - Math.exp(-dt * 3));

    // Fade previous trails while keeping the canvas transparent.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${Math.min(.35, dt * 5.2)})`;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < paths.length; i++) paths[i] = new Path2D();
    const radius = Math.max(160, Math.min(width, height) * .42);
    const k = dt * 60;
    for (const p of particles) {
      const a = angleAt(p.x, p.y, time);
      let ax = Math.cos(a) * p.speed, ay = Math.sin(a) * p.speed * .75 - .12;
      // Vortex around the pointer: tangential swirl plus a gentle inward pull.
      const dx = p.x - pointer.x, dy = p.y - pointer.y;
      const d2 = dx * dx + dy * dy, d = Math.sqrt(d2) + .001;
      if (d < radius) {
        const fall = (1 - d / radius) ** 2 * pointer.strength;
        ax += (-dy / d * 3.4 - dx / d * .9) * fall;
        ay += (dx / d * 3.4 - dy / d * .9) * fall;
        p.heat = Math.min(1, p.heat + fall * .09 * k);
      }
      for (const w of waves) {
        const gap = Math.abs(Math.hypot(p.x - w.x, p.y - w.y) - w.r);
        if (gap < 46) {
          const push = (1 - gap / 46) * w.power;
          const wx = p.x - w.x, wy = p.y - w.y, wd = Math.hypot(wx, wy) + .001;
          ax += wx / wd * push * 7; ay += wy / wd * push * 7;
          p.heat = Math.min(1, p.heat + push * .5);
        }
      }
      p.vx += (ax - p.vx) * .12 * k; p.vy += (ay - p.vy) * .12 * k;
      const px = p.x, py = p.y;
      p.x += p.vx * k; p.y += p.vy * k;
      p.heat *= Math.exp(-dt * .9);
      p.life += k;
      if (p.life > p.max || p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) { spawn(p, false); continue; }
      const fadeIn = Math.min(1, p.life / 40), fadeOut = Math.min(1, (p.max - p.life) / 60);
      if (fadeIn * fadeOut < .25) continue;
      const bucket = p.heat > .72 ? 3 : p.heat > .38 ? 2 : p.heat > .12 ? 1 : 0;
      paths[bucket].moveTo(px, py); paths[bucket].lineTo(p.x, p.y);
    }
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      w.r += w.speed * dt; w.power *= Math.exp(-dt * 1.6);
      if (w.power < .03) waves.splice(i, 1);
    }
    buckets.forEach((b, i) => { ctx.strokeStyle = b.stroke; ctx.lineWidth = b.width; ctx.stroke(paths[i]); });
    ctx.globalCompositeOperation = 'source-over';
  }

  // Reduced motion: a single settled composition instead of a live field.
  function paintStill() {
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < 140; i++) step(1 / 30);
  }

  // The field runs on the page's shared frame loop (TraceMotion.ticker) while it is on screen.
  const ticker = window.TraceMotion?.ticker;
  function tick(now, dt) {
    if (stopped || !visible || document.hidden) { frame = 0; return false; }
    step(Math.min(.05, dt));
  }
  function sync() {
    const run = !stopped && visible && !document.hidden;
    if (run && !frame) { frame = 1; ticker.add(tick); }
    else if (!run && frame) { frame = 0; ticker.delete(tick); }
  }

  host.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const box = host.getBoundingClientRect();
    if (!pointer.active) { pointer.x = pointer.tx; pointer.y = pointer.ty; }
    pointer.tx = event.clientX - box.left; pointer.ty = event.clientY - box.top; pointer.active = true;
  }, {passive: true});
  host.addEventListener('pointerleave', () => { pointer.active = false; });
  host.addEventListener('pointerdown', event => {
    if (stopped || event.target.closest('a,button')) return;
    const box = host.getBoundingClientRect();
    waves.push({x: event.clientX - box.left, y: event.clientY - box.top, r: 0, speed: 520, power: 1});
    if (waves.length > 4) waves.shift();
    host.classList.remove('is-pulsed'); void host.offsetWidth; host.classList.add('is-pulsed');
  });

  // The field sits at the end of the page: it is sized and seeded only when it comes within a screen of the window,
  // not during the page load (89 ms of particles and a still frame that nobody sees yet).
  const near = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    near.disconnect();
    new ResizeObserver(resize).observe(host);
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, {threshold: 0}).observe(host);
  }, {rootMargin: '100% 0px'});
  near.observe(host);
  document.addEventListener('visibilitychange', sync);
  window.TraceUI?.onMotion(value => { stopped = value; if (stopped) paintStill(); sync(); });
})();
