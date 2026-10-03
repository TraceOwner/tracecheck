'use strict';
/* TRACE motion core. Springs are parameterised like SwiftUI (perceptual
   duration + bounce) and keep their velocity when a gesture is interrupted,
   so a menu that is closed halfway through opening turns back without a jolt.
   The CSS tokens in trace.css are sampled from the same model. */
(() => {
  const root = document.documentElement;
  const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => reduceQuery.matches || root.classList.contains('motion-paused');
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  const mix = (a, b, p) => a + (b - a) * p;
  const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };

  /* One frame loop for the whole page. Subscribers get (now, dt) with dt in seconds, capped so a hidden tab
     resumes instead of teleporting. The loop sleeps when nobody is subscribed. */
  const ticker = (() => {
    const jobs = new Set();
    let frame = 0, last = 0;
    const tick = now => {
      const dt = last ? Math.min(.25, Math.max(1 / 480, (now - last) / 1000)) : 1 / 60;
      last = now; frame = 0;
      for (const job of [...jobs]) { if (job(now, dt) === false) jobs.delete(job); }
      if (jobs.size) frame = requestAnimationFrame(tick); else last = 0;
    };
    return {
      add(job) { jobs.add(job); if (!frame) frame = requestAnimationFrame(tick); return () => jobs.delete(job); },
      delete(job) { jobs.delete(job); },
      has(job) { return jobs.has(job); }
    };
  })();

  class Spring {
    constructor({duration = .5, bounce = 0, value = 0, precision = .001} = {}) {
      this.configure(duration, bounce);
      this.x = value; this.v = 0; this.target = value; this.precision = precision;
    }
    configure(duration, bounce = 0) {
      const w0 = 2 * Math.PI / duration;
      this.k = w0 * w0; this.c = 4 * Math.PI * (1 - bounce) / duration;
      return this;
    }
    step(dt) {
      const steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps;
      for (let i = 0; i < steps; i++) {
        this.v += ((this.target - this.x) * this.k - this.v * this.c) * h;
        this.x += this.v * h;
      }
      if (this.settled) this.snap();
    }
    get settled() { return Math.abs(this.target - this.x) < this.precision && Math.abs(this.v) < this.precision * 12; }
    snap() { this.x = this.target; this.v = 0; }
  }

  // Drives a set of named springs from one animation frame loop.
  class Motion {
    constructor(springs, render, {onRest} = {}) {
      this.springs = springs; this.render = render; this.onRest = onRest;
      this.tick = this.tick.bind(this);
    }
    get values() { return Object.fromEntries(Object.entries(this.springs).map(([k, s]) => [k, s.x])); }
    to(targets, {immediate = reduced(), config} = {}) {
      for (const [key, value] of Object.entries(targets)) {
        const spring = this.springs[key];
        if (!spring) continue;
        if (config?.[key]) spring.configure(...config[key]);
        spring.target = value;
      }
      if (immediate) this.finish(); else this.wake();
      return this;
    }
    finish() {
      ticker.delete(this.tick);
      Object.values(this.springs).forEach(s => s.snap());
      this.render(this.values, this);
      this.onRest?.(this);
    }
    wake() { if (!ticker.has(this.tick)) ticker.add(this.tick); }
    tick(now, dt) {
      // Real elapsed time (from the shared ticker) keeps the pace identical at 60, 120 and 144 Hz.
      const springs = Object.values(this.springs);
      springs.forEach(s => s.step(dt));
      this.render(this.values, this);
      if (springs.every(s => s.settled)) { this.onRest?.(this); return false; }
    }
    stop() { ticker.delete(this.tick); }
  }

  // A glass lens that glides between items of a segmented control or list.
  class Lens {
    constructor(container, element, {duration = .46, bounce = .16, stretch = true, radius} = {}) {
      this.container = container; this.element = element; this.stretch = stretch; this.item = null; this.radius = radius;
      const spring = () => new Spring({duration, bounce, precision: .05});
      this.motion = new Motion({x: spring(), y: spring(), w: spring(), h: spring(), o: new Spring({duration: .3, precision: .002})}, v => this.paint(v));
      new ResizeObserver(() => this.item && this.moveTo(this.item, {immediate: true})).observe(container);
    }
    measure(item) {
      const box = this.container.getBoundingClientRect(), rect = item.getBoundingClientRect();
      const c = this.container;
      return {x: rect.left - box.left - c.clientLeft + c.scrollLeft, y: rect.top - box.top - c.clientTop + c.scrollTop, w: rect.width, h: rect.height};
    }
    moveTo(item, {immediate = false} = {}) {
      if (!item) return this.hide({immediate});
      const springs = this.motion.springs, target = this.measure(item);
      const hidden = !this.item && springs.o.x < .05, instant = immediate || reduced();
      this.item = item;
      if (hidden || instant) {
        // An appearing lens grows in place instead of sliding in from 0,0.
        for (const key of ['x', 'y', 'w', 'h']) { springs[key].target = target[key]; springs[key].snap(); }
        this.motion.to({o: 1}, {immediate: instant});
        return;
      }
      this.motion.to({...target, o: 1});
    }
    hide({immediate = false} = {}) { this.item = null; this.motion.to({o: 0}, {immediate: immediate || reduced()}); }
    paint({x, y, w, h, o}) {
      // The lens layer covers the whole container and is clipped to the item: clip-path repaints, it never lays out.
      const s = this.motion.springs, speed = Math.hypot(s.x.v, s.y.v);
      const squash = this.stretch ? Math.min(.1, speed / 9000) : 0, grow = .86 + .14 * o;
      const [sx, sy] = Math.abs(s.x.v) > Math.abs(s.y.v) ? [1 + squash, 1 - squash * .6] : [1 - squash * .6, 1 + squash];
      const cw = this.container.scrollWidth, ch = this.container.scrollHeight;
      const W = w * grow * sx, H = h * grow * sy, L = x + (w - W) / 2, T = y + (h - H) / 2;
      const r = Math.min(this.radius ?? (H / 2), W / 2, H / 2), st = this.element.style;
      // trace.css turns these into two clips: the lens and, 1px inside it, its fill (so the rim survives clipping).
      st.setProperty('--lt', `${T.toFixed(2)}px`); st.setProperty('--lr', `${(cw - L - W).toFixed(2)}px`);
      st.setProperty('--lb', `${(ch - T - H).toFixed(2)}px`); st.setProperty('--ll', `${L.toFixed(2)}px`);
      st.setProperty('--lrad', `${r.toFixed(2)}px`);
      st.opacity = o.toFixed(3);
    }
  }

  const tokens = {};
  const token = name => tokens[name] ??= getComputedStyle(root).getPropertyValue(name).trim();
  const linearSupported = CSS.supports?.('transition-timing-function', 'linear(0, 1)');
  const easing = name => (linearSupported && token(`--spring-${name}`)) || 'cubic-bezier(.22,1,.36,1)';
  // The curve vocabulary for JS animations, the same as the CSS tokens: out for arrivals, in for exits.
  const curves = {out: 'cubic-bezier(.22,1,.36,1)', in: 'cubic-bezier(.55,.05,.8,.3)', inout: 'cubic-bezier(.65,0,.35,1)'};
  const duration = name => parseFloat(token(`--dur-${name}`)) || 600;

  // Web Animations helper that respects reduced motion and returns a promise.
  function animate(element, keyframes, {spring = 'smooth', delay = 0, duration: ms, fill = 'both', easing: curve} = {}) {
    if (!element) return Promise.resolve();
    // Reduced motion keeps the change of opacity, short, and drops the movement.
    if (reduced()) {
      const fades = Array.isArray(keyframes) && keyframes.length > 1 && keyframes[0].opacity !== undefined && keyframes.at(-1).opacity !== undefined;
      if (!fades) return Promise.resolve();
      const animation = element.animate([{opacity: keyframes[0].opacity}, {opacity: keyframes.at(-1).opacity}], {duration: 200, delay: Math.min(delay, 120), easing: easing('smooth'), fill});
      return animation.finished.then(() => animation, () => animation);
    }
    const animation = element.animate(keyframes, {duration: ms ?? duration(spring), delay, easing: curve ?? easing(spring), fill});
    return animation.finished.then(() => animation, () => animation);
  }

  // Resolves new content like a camera pulling focus: blur, lift and opacity.
  function materialize(nodes, {stagger = 40, delay = 0, y = 8, blur = 6} = {}) {
    [...nodes].filter(Boolean).forEach((node, i) => {
      animate(node, [{opacity: 0, filter: `blur(${blur}px)`, transform: `translateY(${y}px)`}, {opacity: 1, filter: 'blur(0)', transform: 'none'}], {spring: 'smooth', delay: delay + i * stagger, fill: 'none'});
    });
  }

  // A change of height caused by `mutate`, animated without animating height (FLIP): the layout jumps once, then the
  // element's clip opens or closes from its old height and every element after it in the flow slides from its old
  // place with transform. Only clip-path and transform move.
  // Everything laid out after an element, up to the body. Fixed and sticky boxes (the copy notice, the cursor tag,
  // dialogs) and hidden ones do not move when the element grows, so they are left out.
  function followers(element) {
    const list = [];
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      for (let next = node.nextElementSibling; next; next = next.nextElementSibling) {
        if (next.matches('dialog, script, template')) continue;
        const style = getComputedStyle(next);
        if (style.display === 'none' || style.position === 'fixed' || style.position === 'sticky') continue;
        list.push(next);
      }
    }
    return list;
  }
  function morphHeight(element, mutate) {
    if (!element || reduced()) { mutate(); return; }
    element.getAnimations().filter(a => a.id === 'trace-flip').forEach(a => a.finish());
    const after = followers(element).filter(node => node.getBoundingClientRect().top < innerHeight * 1.5);
    after.forEach(node => node.getAnimations().filter(a => a.id === 'trace-flip').forEach(a => a.finish()));
    const from = element.getBoundingClientRect().height;
    mutate();
    const to = element.getBoundingClientRect().height, delta = from - to;
    if (Math.abs(delta) < 2) return;
    const options = {duration: duration('smooth'), easing: easing('smooth')};
    const grow = to > from;
    const clip = grow ? [{clipPath: `inset(0 0 ${(to - from).toFixed(1)}px 0)`}, {clipPath: 'inset(0 0 0 0)'}] : [{clipPath: 'inset(0 0 0 0)'}, {clipPath: 'inset(0 0 0 0)'}];
    element.animate(clip, options).id = 'trace-flip';
    after.forEach(node => { node.animate([{transform: `translateY(${delta.toFixed(1)}px)`}, {transform: 'none'}], options).id = 'trace-flip'; });
  }

  // Forensic "decode": characters resolve left to right out of signal noise.
  // Only plain-text nodes are touched, so nested markup is never destroyed.
  const scrambles = new WeakMap();
  const noise = '#%&*+=<>/\\|_0123456789ABCDEFGHKLMNPRSTXZ';
  function scramble(element, text, {duration: ms = 560, force = false} = {}) {
    if (!element || (!force && element.textContent === text && !scrambles.has(element))) return;
    ticker.delete(scrambles.get(element));
    if (reduced() || element.children.length) { element.textContent = text; return; }
    const target = [...text], start = performance.now();
    let lastSwap = 0, noiseChars = target.map(() => noise[Math.random() * noise.length | 0]);
    const tick = now => {
      const p = clamp((now - start) / ms);
      if (now - lastSwap > 45) { noiseChars = target.map(() => noise[Math.random() * noise.length | 0]); lastSwap = now; }
      let out = '';
      target.forEach((char, i) => {
        const settle = .25 + .75 * (i / Math.max(1, target.length - 1));
        out += p >= settle || char === ' ' ? char : p >= settle - .45 ? noiseChars[i] : '';
      });
      element.textContent = out;
      if (p >= 1) { element.textContent = text; scrambles.delete(element); return false; }
    };
    scrambles.set(element, tick);
    ticker.add(tick);
  }

  /* A control's glass grows into its panel and back, as iOS menus do. Each
     edge is a spring; edges that travel further answer a touch later, so the
     glass pours open instead of scaling. The corner radius follows the area
     from the control's shape to the panel's. Content never scales: it is held
     still in the world while the glass opens around it. */
  class Morph {
    constructor({body, content, onFrame = () => {}, onRest = () => {}}) {
      Object.assign(this, {body, content, onFrame, onRest});

      this.from = null; this.target = null; this.open = false;
      const edge = () => new Spring({duration: .5, bounce: .2, precision: .05});
      this.motion = new Motion({l: edge(), t: edge(), r: edge(), b: edge(), c: new Spring({duration: .35, precision: .002})},
        (values, motion) => this.paint(values, motion), {onRest: () => this.onRest(this.open)});
    }
    layout(from, target) {
      this.from = from; this.target = target;
      // The body is laid out once at the open size, with a margin the spring may overshoot into; frames only clip it.
      const M = this.margin = 28, s = this.body.style;
      s.left = `${target.x - M}px`; s.top = `${target.y - M}px`; s.width = `${target.w + M * 2}px`; s.height = `${target.h + M * 2}px`;
      s.borderRadius = '0'; this.content.style.transform = `translate3d(${M}px,${M}px,0)`;
    }
    edges(rect) { return {l: rect.x, t: rect.y, r: rect.x + rect.w, b: rect.y + rect.h}; }
    snap(open) { this.open = open; this.motion.to({...this.edges(open ? this.target : this.from), c: +open}, {immediate: true}); }
    set(open) {
      this.open = open;
      const goal = this.edges(open ? this.target : this.from), config = {};
      for (const key of ['l', 't', 'r', 'b']) {
        const travel = Math.abs(goal[key] - this.motion.springs[key].x);
        config[key] = open ? [.44 + Math.min(.16, travel / 1600), .22] : [.32 + Math.min(.06, travel / 4000), .05];
      }
      config.c = open ? [.42] : [.14];
      this.motion.to({...goal, c: +open}, {config});
    }
    paint({l, t, r, b, c}) {
      const from = this.from, target = this.target;
      if (!from) return;
      const w = Math.max(0, r - l), h = Math.max(0, b - t);
      const p = clamp((w * h - from.w * from.h) / ((target.w * target.h - from.w * from.h) || 1));
      const radius = Math.min(from.r + (target.r - from.r) * p, w / 2, h / 2);
      const M = this.margin, ox = target.x - M, oy = target.y - M, W = target.w + M * 2, H = target.h + M * 2;
      // One rounded clip per frame, on the body only (no inherited custom properties, so the rows inside are not
      // restyled): the body never changes size. A second clip for a rim cost two dropped frames per opening.
      this.body.style.clipPath = `inset(${(t - oy).toFixed(2)}px ${(ox + W - r).toFixed(2)}px ${(oy + H - b).toFixed(2)}px ${(l - ox).toFixed(2)}px round ${radius.toFixed(2)}px)`;
      this.onFrame({l, t, r, b, w, h, c, p});
    }
  }

  window.TraceMotion = {Spring, Motion, Lens, Morph, animate, materialize, morphHeight, scramble, reduced, clamp, mix, smooth, easing, duration, ticker, curves, followers};
})();
