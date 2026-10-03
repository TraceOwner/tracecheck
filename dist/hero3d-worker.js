// Renders the hero scene off the main thread. The page posts sizes, pointer, scroll and how its own frames are doing;
// the worker keeps its own frame loop, lowers its quality when the page or the scene runs late, and gives up (the page
// shows the poster) if even the lowest quality cannot keep up.
import {createHero} from './hero3d-scene.js';

let hero = null, running = false, frame = 0, dpr = 1, size = null, firstFrame = false, debugScale = 1;
const raf = self.requestAnimationFrame ? cb => self.requestAnimationFrame(cb) : cb => setTimeout(() => cb(performance.now()), 1000 / 60);
const caf = self.cancelAnimationFrame ? id => self.cancelAnimationFrame(id) : id => clearTimeout(id);

/* Quality ladder: a budget of rendered pixels (the canvas covers the whole first screen, so its cost grows with the
   window and the pixel ratio), then bloom. Steps that would not change anything on this screen are skipped. */
const LADDER = [{px: 2.4e6, bloom: 1}, {px: 1.6e6, bloom: 1}, {px: 1.1e6, bloom: 1}, {px: .75e6, bloom: 1}, {px: .75e6, bloom: 0}];
let level = 0, floor = 0, steppedUpAt = -1e9, goodSince = 0;
const ratioAt = l => Math.min(dpr, Math.sqrt(LADDER[l].px / Math.max(1, size.w * size.h))) * (debugScale || 1);
function apply() {
  hero.setQuality(LADDER[level].bloom);
  if (size) hero.resize(size.w, size.h, ratioAt(level), size.word);
}
function stepDown() {
  // Coming straight back down after a step up means that level is too much here: stay below it from now on.
  if (performance.now() - steppedUpAt < 10000) floor = level + 1;
  goodSince = 0;
  for (let next = level + 1; next < LADDER.length; next++) {
    if (Math.abs(ratioAt(next) - ratioAt(level)) > .02 || LADDER[next].bloom !== LADDER[level].bloom) {
      level = next; apply(); slow = 0; postMessage({type: 'quality', level, ratio: +ratioAt(level).toFixed(2)});
      return true;
    }
  }
  running = false; caf(frame); frame = 0; postMessage({type: 'give-up'});
  return false;
}
// A lowered quality is not for good: after 20 s without slow frames the scene climbs one step back, never above a
// level it already had to leave twice.
function stepUp(now) {
  for (let next = level - 1; next >= floor; next--) {
    if (Math.abs(ratioAt(next) - ratioAt(level)) > .02 || LADDER[next].bloom !== LADDER[level].bloom) {
      level = next; apply(); slow = 0; steppedUpAt = now; postMessage({type: 'quality', level, ratio: +ratioAt(level).toFixed(2)});
      return;
    }
  }
}

/* Cadence. The display's refresh period is the median gap between animation frames. The scene draws on every Nth of
   them, N chosen so it runs at about 60 per second (60 Hz: every frame, 75-90 Hz: every frame, 120 Hz: every second,
   144 Hz: every second, 240 Hz: every fourth). "calm" halves that while nobody is pointing at the word: the idle
   drift is slow enough that 30 frames a second look the same, and the GPU is left to the page. */
const gaps = new Float32Array(32);
let gapCount = 0, lastTick = 0, ticks = 0, lastDraw = 0, calm = false, slow = 0, fixedFps = 0, lastEvery = 1;
function period() {
  const n = Math.min(gapCount, gaps.length);
  if (n < 6) return 1000 / 60;
  const sorted = Array.from(gaps.subarray(0, n)).sort((a, b) => a - b);
  return Math.min(34, Math.max(4, sorted[n >> 1]));
}
function loop(now) {
  frame = 0;
  if (!running || !hero) return;
  if (lastTick) { gaps[gapCount++ % gaps.length] = now - lastTick; }
  lastTick = now;
  const p = period();
  let every = fixedFps ? Math.max(1, Math.round(1000 / fixedFps / p)) : Math.max(1, Math.floor(1000 / p / 60 + .2));
  if (calm) every *= 2;
  lastEvery = every;
  if (ticks++ % every) { frame = raf(loop); return; }
  const interval = lastDraw ? now - lastDraw : 0;
  lastDraw = now;
  hero.step(now);
  if (!firstFrame) { firstFrame = true; postMessage({type: 'ready'}); }
  // A drawn frame that came a whole refresh late or more is a slow one; the gaps created by skipping are not.
  if (interval && interval < 250) {
    slow = interval > p * every * 1.6 ? slow + interval : Math.max(0, slow - interval * .5);
    if (slow > 1500) stepDown();
    if (slow) goodSince = 0;
    else if (!goodSince) goodSince = now;
    else if (level > floor && now - goodSince > 20000) { goodSince = now; stepUp(now); }
  }
  if (running) frame = raf(loop);
}

onmessage = ({data}) => {
  if (data.type === 'init') {
    try {
      dpr = Math.min(2, data.dpr); size = {w: data.w, h: data.h, word: data.word};
      if (data.debug?.fps) fixedFps = data.debug.fps;
      if (data.debug?.scale) debugScale = data.debug.scale;
      hero = createHero(data.canvas, {width: data.w, height: data.h, dpr: ratioAt(0), quality: 2, debug: data.debug || {},
        onInfo: info => postMessage({type: 'info', info}), onStats: stats => postMessage({type: 'stats', stats: {...stats, every: lastEvery, period: +period().toFixed(1), level, calm}})});
      apply();
      hero.scroll(data.scroll || 0);
    } catch (error) {
      postMessage({type: 'lost', reason: String(error?.message || error)});
    }
    return;
  }
  if (!hero) return;
  if (data.type === 'resize') { dpr = Math.min(2, data.dpr); size = {w: data.w, h: data.h, word: data.word}; apply(); if (!running) hero.step(performance.now()); }
  else if (data.type === 'pointer') hero.pointer(data.x, data.y, data.inside, data.hot);
  else if (data.type === 'scroll') hero.scroll(data.p);
  else if (data.type === 'info') hero.wantInfo(data.on);
  else if (data.type === 'calm') calm = data.on;
  // The page drops frames while the scene runs: one step down, whatever the scene's own timing says.
  else if (data.type === 'page-slow') { if (running) stepDown(); }
  else if (data.type === 'run') {
    running = data.on;
    if (running && !frame) { lastTick = 0; lastDraw = 0; frame = raf(loop); }
    if (!running && frame) { caf(frame); frame = 0; }
  } else if (data.type === 'still') hero.step(performance.now());
  else if (data.type === 'dispose') { running = false; caf(frame); hero.dispose(); hero = null; }
};
