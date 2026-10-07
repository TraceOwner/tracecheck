// TRACE hero scene: the word extruded in dark chrome, a magnifying glass in front of it, and an x-ray of the
// letters' edges that shows only inside the lens. Runs in a Worker on an OffscreenCanvas (worker.js) or on the main
// thread where workers cannot render. The page sends sizes, pointer and scroll; the scene sends back what the
// overlay needs (letter boxes, handle points, lens centre) and its own frame cost.
import {
  ACESFilmicToneMapping, BufferGeometry, Color, CylinderGeometry, DirectionalLight, EdgesGeometry, ExtrudeGeometry,
  Float32BufferAttribute, Group, LatheGeometry, LineSegments, MathUtils, Mesh, MeshPhysicalMaterial, PerspectiveCamera,
  PMREMGenerator, Scene, BoxGeometry, PlaneGeometry, MeshBasicMaterial, BackSide, DoubleSide, ShaderMaterial, ShapePath, SRGBColorSpace, TorusGeometry, Vector2, Vector3, WebGLRenderer,
  WebGLRenderTarget, HalfFloatType
} from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {FXAAPass} from 'three/examples/jsm/postprocessing/FXAAPass.js';
import glyphs from './glyphs.json';

const UNIT = 1 / 1000;           // font units to world units
const DEPTH = .3;                // extrusion depth, world units
// The studio swings between -.32 and .06 rad: towards the positive side the left letters turn away from the softboxes
// and go black (measured: 12% of the word bright at +.3 against 30% at -.3).
const ENV_CENTER = -.13, ENV_SWING = .19;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
// Frame-rate independent damping: the same feel at 60, 120 and 144 Hz.
const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));

/* ───── Studio: a black room lit by a few long softboxes. Their reflections are what makes chrome read as chrome. ───── */
function studio() {
  const room = new Scene();
  room.add(new Mesh(new BoxGeometry(24, 24, 24), new MeshBasicMaterial({color: 0x030304, side: BackSide})));
  const panel = (w, h, x, y, z, power) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({color: new Color(power, power, power), side: DoubleSide}));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); room.add(m);
  };
  panel(14, 1.1, 0, 7, 4, 7);      // long strip overhead, slightly in front
  panel(1.2, 10, -9, 1.5, 3, 5);    // tall softbox left
  panel(1.2, 10, 9, 0, -1, 3.2);    // tall softbox right, further back
  panel(9, .6, 2, -1.2, 9, 3.6);    // low strip in front: it slides across the front faces
  panel(3, 3, -3, 4, -9, 1.6);      // soft back light for the rims
  panel(7, .5, -7, -.6, 8, 2.6);    // second low strip, for the left half of the word
  return room;
}

/* ───── Glyph outlines → shapes ───── */
function shapesFor(letter) {
  const path = new ShapePath(), tokens = letter.d.match(/[MLQCZ]|-?\d+/g);
  let i = 0;
  const n = () => +tokens[i++] * UNIT;
  while (i < tokens.length) {
    const c = tokens[i++];
    if (c === 'M') path.moveTo(n(), n());
    else if (c === 'L') path.lineTo(n(), n());
    else if (c === 'Q') path.quadraticCurveTo(n(), n(), n(), n());
    else if (c === 'C') path.bezierCurveTo(n(), n(), n(), n(), n(), n());
  }
  // TrueType outlines run clockwise; with y flipped they read counter-clockwise for three.
  return path.toShapes(false);
}

/* ───── Ridge points: the centre lines of each letter's strokes, for the overlay handles ───── */
function ridgeFor(letter, scale = .06) {
  const pad = 4, w = Math.ceil((letter.x1 - letter.x0) * scale) + pad * 2, h = Math.ceil((letter.y1 - letter.y0) * scale) + pad * 2;
  const canvas = new OffscreenCanvas(w, h), ctx = canvas.getContext('2d', {willReadFrequently: true});
  if (!ctx) return [];
  ctx.translate(pad - letter.x0 * scale, pad + letter.y1 * scale); ctx.scale(scale, -scale);
  const tokens = letter.d.match(/[MLQCZ]|-?\d+/g); let i = 0; const n = () => +tokens[i++];
  ctx.beginPath();
  while (i < tokens.length) {
    const c = tokens[i++];
    if (c === 'M') ctx.moveTo(n(), n()); else if (c === 'L') ctx.lineTo(n(), n());
    else if (c === 'Q') ctx.quadraticCurveTo(n(), n(), n(), n()); else if (c === 'C') ctx.bezierCurveTo(n(), n(), n(), n(), n(), n());
    else ctx.closePath();
  }
  ctx.fillStyle = '#fff'; ctx.fill('nonzero');
  const px = ctx.getImageData(0, 0, w, h).data, dist = new Float32Array(w * h);
  for (let k = 0; k < dist.length; k++) dist[k] = px[k * 4] > 200 ? 1e6 : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : dist[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = y * w + x; if (dist[k]) dist[k] = Math.min(dist[k], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414); }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const k = y * w + x; if (dist[k]) dist[k] = Math.min(dist[k], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414); }
  const across = (d, a, b) => d >= a && d >= b && (d > a || d > b);
  let peak = 0; const found = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const k = y * w + x, d = dist[k];
    if (d < 1.5) continue;
    if (!(across(d, dist[k - 1], dist[k + 1]) || across(d, dist[k - w], dist[k + w]) || across(d, dist[k - w - 1], dist[k + w + 1]) || across(d, dist[k - w + 1], dist[k + w - 1]))) continue;
    found.push((x + .5 - pad) / scale + letter.x0, letter.y1 - (y + .5 - pad) / scale, d); peak = Math.max(peak, d);
  }
  const out = [];
  for (let k = 0; k < found.length; k += 3) if (found[k + 2] >= peak * .45) out.push(found[k] * UNIT, found[k + 1] * UNIT);
  return out;
}

/* ───── The lens: a biconvex disc, so the glass really magnifies what is behind it ───── */
function lensGeometry(radius, thickness) {
  const pts = [], steps = 28;
  for (let i = 0; i <= steps; i++) {
    const r = radius * i / steps, sag = thickness / 2 * (1 - (r / radius) ** 2);
    pts.push(new Vector2(r, sag));
  }
  for (let i = steps; i >= 0; i--) {
    const r = radius * i / steps, sag = thickness / 2 * (1 - (r / radius) ** 2);
    pts.push(new Vector2(r, -sag));
  }
  const g = new LatheGeometry(pts, 96);
  g.rotateX(Math.PI / 2);
  return g;
}

// The x-ray shows the outline of the front and back faces only: the edges that run through the depth made the letters
// read as a wireframe.
function outlines(edges) {
  const p = edges.getAttribute('position').array, keep = [];
  for (let i = 0; i < p.length; i += 6) if (Math.abs(p[i + 2] - p[i + 5]) < 1e-4) keep.push(...p.subarray(i, i + 6));
  edges.dispose();
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(keep, 3));
  return g;
}

export function createHero(canvas, {width, height, dpr = 1, quality = 2, debug = {}, onInfo = () => {}, onStats = () => {}}) {
  // No multisampling anywhere: the frame is drawn through the composer, and FXAA smooths the edges at the end.
  const renderer = new WebGLRenderer({canvas, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', stencil: false});
  renderer.setClearColor(0x000000, 0);
  // No synchronous shader status queries (they stall the GPU pipeline) and no driver warnings in the page console;
  // a program that fails to link shows up as a lost scene, and the page keeps the poster.
  renderer.debug.checkShaderErrors = false;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  // The lens refracts a half-resolution copy of the scene: under glass the difference does not show.
  renderer.transmissionResolutionScale = debug.transmission ?? .5;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const room = studio();
  scene.environment = pmrem.fromScene(room, .02).texture;
  room.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); });
  scene.environmentIntensity = 1;

  const camera = new PerspectiveCamera(26, width / height, .1, 60);

  /* Word */
  const word = new Group(); scene.add(word);
  const face = new MeshPhysicalMaterial({color: 0x3a3e44, metalness: 1, roughness: .13, clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: 1.35});
  const side = new MeshPhysicalMaterial({color: 0x9aa0a8, metalness: 1, roughness: .28, envMapIntensity: 1.15});
  const letterMeshes = [], edges = [];
  const totalW = glyphs.width * UNIT, capH = (glyphs.letters[0].y1 - glyphs.letters[0].y0) * UNIT;
  const xray = new ShaderMaterial({
    uniforms: {uCenter: {value: new Vector2()}, uRadius: {value: 0}, uAlpha: {value: 1}},
    vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `uniform vec2 uCenter; uniform float uRadius; uniform float uAlpha;
      void main(){ float d = distance(gl_FragCoord.xy, uCenter); if (d > uRadius) discard;
        float edge = smoothstep(uRadius, uRadius * .82, d);
        float dash = step(.35, fract((gl_FragCoord.x + gl_FragCoord.y) * .09));
        gl_FragColor = vec4(vec3(1.0), uAlpha * edge * (.55 + .45 * dash)); }`,
    transparent: true, depthTest: false, depthWrite: false
  });
  glyphs.letters.forEach((letter, index) => {
    const geometry = new ExtrudeGeometry(shapesFor(letter), {depth: DEPTH, bevelEnabled: true, bevelThickness: .028, bevelSize: .016, bevelSegments: quality >= 2 ? 4 : 2, curveSegments: quality >= 2 ? 10 : 6});
    geometry.translate(-totalW / 2, 0, -DEPTH);
    const mesh = new Mesh(geometry, [face, side]);
    const cx = ((letter.x0 + letter.x1) / 2) * UNIT - totalW / 2;
    // Each letter pivots around its own centre so scroll can pull the word apart.
    geometry.translate(-cx, 0, DEPTH / 2);
    mesh.position.set(cx, 0, -DEPTH / 2);
    mesh.userData = {cx, index, ridge: ridgeFor(letter).map((v, k) => k % 2 ? v : v - totalW / 2 - cx)};
    word.add(mesh); letterMeshes.push(mesh);
  });

  /* Magnifying glass */
  const glass = new Group(); scene.add(glass);
  const R = capH * .62;
  // A plain magnifier: a thin flat glass, a hairline steel ring and a slim straight handle; no collar, no gloss coat,
  // so it reads as a line drawing in metal rather than a prop.
  const lens = new Mesh(lensGeometry(R * .97, R * .12), new MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: .02, transmission: 1, thickness: R * .2, ior: 1.45, specularIntensity: .3,
    envMapIntensity: .25, attenuationColor: new Color(0x9aa1aa), attenuationDistance: .6, transparent: false
  }));
  const steel = new MeshPhysicalMaterial({color: 0xc9ccd1, metalness: 1, roughness: .32, envMapIntensity: .9});
  const rim = new Mesh(new TorusGeometry(R, R * .026, 16, 160), steel);
  const handle = new Mesh(new CylinderGeometry(R * .034, R * .034, R * 1.15, 24), steel);
  handle.position.set(0, -R - R * .575, 0);
  const holder = new Group(); holder.add(lens, rim, handle);
  holder.rotation.z = MathUtils.degToRad(-32);
  // Owner, 2026-10-08: no magnifier in the scene. The glass group still exists (the overlay reads its position), but
  // nothing is drawn in it, so there is no refraction pass and no x-ray either.
  void holder;

  /* Lights: the environment does most of the work; a white rim from behind-top outlines the letters. */
  const rimLight = new DirectionalLight(0xffffff, 1.4); rimLight.position.set(-2, 3, -4); scene.add(rimLight);
  const key = new DirectionalLight(0xffffff, .6); key.position.set(3, 2, 5); scene.add(key);

  /* Post: bloom on the brightest highlights only */
  // No multisampling on the render target: on an integrated GPU it was the cost that turned scroll frames into 60-140 ms
  // hitches. FXAA after tone mapping smooths the edges for a fraction of it.
  const target = new WebGLRenderTarget(2, 2, {type: HalfFloatType, samples: debug.msaa ?? 0});
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(2, 2), .2, .42, .9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const fxaa = new FXAAPass();
  fxaa.enabled = debug.fxaa !== 0;
  composer.addPass(fxaa);
  let useBloom = quality >= 1 && debug.bloom !== 0;
  bloom.enabled = useBloom;

  /* State */
  const S = {w: width, h: height, dpr, wordRect: null, ptr: {x: .5, y: .5, inside: false, hot: false}, scroll: 0,
    yaw: 0, pitch: 0, lx: totalW * .17, ly: capH * .5, lz: .55, ls: 1, sep: 0, time: 0, xrayA: 0, env: 0};
  const v3 = new Vector3();

  function frame() {
    // Fit: the front face of the word covers the DOM word box (wordRect), so the poster and the canvas line up.
    const rect = S.wordRect || {left: S.w * .06, width: S.w * .88, baseline: S.h * .9};
    const fov = MathUtils.degToRad(camera.fov), worldPerPx = totalW / rect.width;
    const dist = (S.h * worldPerPx / 2) / Math.tan(fov / 2);
    const cxPx = rect.left + rect.width / 2, baselinePx = rect.baseline;
    camera.position.set(-(cxPx - S.w / 2) * worldPerPx, (baselinePx - S.h / 2) * worldPerPx, dist);
    camera.lookAt(camera.position.x, camera.position.y, 0);
    return {worldPerPx, dist};
  }

  function resize(w, h, ratio, wordRect) {
    S.w = w; S.h = h; S.dpr = ratio; if (wordRect) S.wordRect = wordRect;
    renderer.setPixelRatio(ratio); renderer.setSize(w, h, false);
    composer.setPixelRatio(ratio); composer.setSize(w, h);
    bloom.resolution.set(w * ratio / 2, h * ratio / 2);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    frame();
  }

  function toScreen(x, y, z, object) {
    v3.set(x, y, z); if (object) v3.applyMatrix4(object.matrixWorld);
    v3.project(camera);
    return [(v3.x + 1) / 2 * S.w, (1 - v3.y) / 2 * S.h, v3.z];
  }

  let last = 0, statT = 0, frames = 0, costSum = 0;
  function step(now) {
    const dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60; last = now;
    S.time += dt;
    const {worldPerPx} = frame();
    const hot = S.ptr.hot, px = S.ptr.inside ? S.ptr.x : .5, py = S.ptr.inside ? S.ptr.y : .62;
    // Layers move at different depths: the word tilts a little, the lens a lot, reflections drift on their own.
    const idle = S.ptr.inside ? 0 : 1;
    S.yaw = damp(S.yaw, (px - .5) * .14 + Math.sin(S.time * .21) * .03 * idle, 3, dt);
    S.pitch = damp(S.pitch, (py - .55) * .06 + Math.sin(S.time * .17) * .015 * idle, 3, dt);
    word.rotation.set(S.pitch, S.yaw, 0);
    S.sep = damp(S.sep, S.scroll, 8, dt);
    letterMeshes.forEach((mesh, i) => {
      const k = i - (letterMeshes.length - 1) / 2;
      mesh.position.x = mesh.userData.cx + k * S.sep * .28;
      mesh.position.z = -DEPTH / 2 - Math.abs(k) * S.sep * .5;
      mesh.rotation.y = k * S.sep * .32;
      mesh.position.y = S.sep * (k % 2 ? .06 : -.04) * Math.abs(k);
    });
    // Lens: held at the pointer while scanning the word, otherwise it floats on a slow figure-eight.
    const ptrWorldX = camera.position.x + (px * S.w - S.w / 2) * worldPerPx, ptrWorldY = camera.position.y - (py * S.h - S.h / 2) * worldPerPx;
    const floatX = totalW * .17 + Math.sin(S.time * .31) * totalW * .05, floatY = capH * .5 + Math.sin(S.time * .62) * capH * .05;
    const tx = hot ? ptrWorldX : S.ptr.inside ? MathUtils.lerp(floatX, ptrWorldX, .35) : floatX;
    const ty = hot ? ptrWorldY : S.ptr.inside ? MathUtils.lerp(floatY, ptrWorldY, .35) : floatY;
    S.lx = damp(S.lx, tx, hot ? 14 : 4, dt); S.ly = damp(S.ly, ty, hot ? 14 : 4, dt);
    S.lz = damp(S.lz, .55 + S.sep * .9, 5, dt);
    S.ls = damp(S.ls, 1 + S.sep * .5, 5, dt);
    glass.position.set(S.lx, S.ly, S.lz);
    glass.scale.setScalar(S.ls);
    glass.rotation.set(S.pitch * 2 + Math.sin(S.time * .4) * .06, -S.yaw * 2.5 + S.sep * .8, Math.sin(S.time * .27) * .05);
    // Reflections drift by swinging the studio a little either way, not round in full: in most of a full turn the faces
    // look away from the softboxes and the word goes black.
    scene.environmentRotation.y = ENV_CENTER + Math.sin(S.time * .11) * ENV_SWING + S.yaw * 1.5;
    // X-ray inside the lens: edges of the letters drawn where the glass is.
    S.xrayA = damp(S.xrayA, hot ? 1 : .55, 6, dt);
    scene.updateMatrixWorld();
    const c = toScreen(0, 0, 0, lens), e = toScreen(R * .94, 0, 0, lens);
    const rpx = Math.hypot(e[0] - c[0], e[1] - c[1]);
    xray.uniforms.uCenter.value.set(c[0] * S.dpr, (S.h - c[1]) * S.dpr);
    xray.uniforms.uRadius.value = rpx * S.dpr * .98;
    xray.uniforms.uAlpha.value = S.xrayA;

    const t0 = performance.now();
    composer.render();
    const cost = performance.now() - t0;
    frames++; costSum += cost; statT += dt;
    if (statT > .5) { onStats({ms: costSum / frames, frames}); statT = 0; frames = 0; costSum = 0; }

    // What the overlay needs, in CSS px of the canvas.
    if (!S.wantInfo) return;
    const letters = letterMeshes.map(mesh => {
      const g = mesh.geometry; g.boundingBox || g.computeBoundingBox();
      const b = g.boundingBox; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [x, y] of [[b.min.x, b.min.y], [b.max.x, b.min.y], [b.min.x, b.max.y], [b.max.x, b.max.y]]) {
        const p = toScreen(x, y, b.max.z, mesh); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      }
      return [x0, y0, x1, y1];
    });
    // Three neighbouring letters around the one nearest the pointer; each handle is that letter's ridge point nearest the pointer.
    const pxx = S.ptr.x * S.w, pyy = S.ptr.y * S.h;
    let near = 0, nd = Infinity;
    letters.forEach((r, i) => { const d = Math.hypot((r[0] + r[2]) / 2 - pxx, (r[1] + r[3]) / 2 - pyy); if (d < nd) { nd = d; near = i; } });
    const first = Math.min(Math.max(near - 1, 0), Math.max(0, letters.length - 3));
    const handles = [0, 1, 2].map(k => { const i = Math.min(letters.length - 1, first + k), p = ridgeOnScreen(i, pxx, pyy); return p ? [i, p[0], p[1]] : [i, pxx, pyy]; });
    onInfo({
      lens: [c[0], c[1], rpx], near, handles, letters
    });
  }
  function ridgeOnScreen(index, x, y) {
    // Nearest ridge point of a letter to a screen point, in screen px.
    const mesh = letterMeshes[index], r = mesh.userData.ridge, zf = DEPTH / 2;
    let best = null, bd = Infinity;
    for (let k = 0; k < r.length; k += 6) { // every third point is plenty for a nearest search
      const p = toScreen(r[k], r[k + 1], zf, mesh), d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  return {
    resize, step, ridgeOnScreen,
    pointer(x, y, inside, hot) { S.ptr.x = x; S.ptr.y = y; S.ptr.inside = inside; S.ptr.hot = hot; },
    scroll(p) { S.scroll = clamp(p); },
    wantInfo(on) { S.wantInfo = on; },
    setQuality(q) { useBloom = q >= 1; bloom.enabled = useBloom; },
    letters: letterMeshes.length,
    dispose() {
      composer.passes.forEach(pass => pass.dispose?.());
      composer.dispose?.(); target.dispose(); pmrem.dispose(); scene.environment?.dispose();
      scene.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => m.dispose()); });
      renderer.dispose(); renderer.forceContextLoss();
    }
  };
}
