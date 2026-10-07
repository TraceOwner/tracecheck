// TRACE hero scene: the word extruded in dark chrome, lit by a studio environment that swings slowly; the letter
// under the pointer comes forward and a small light follows the pointer. Runs in a Worker on an OffscreenCanvas
// (worker.js). The page sends sizes, pointer and scroll; the scene reports its frame cost.
import {
  ACESFilmicToneMapping, BufferGeometry, PointLight, Color, CylinderGeometry, DirectionalLight, EdgesGeometry, ExtrudeGeometry,
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
const TORCH = .045;                // pointer light at full strength: a soft sheen, not a flare
const TORCH_Z = .6;               // its height above the front faces
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
  panel(9, .6, 2, -.3, 9, 3.6);     // strip in front, at eye level: it slides across the front faces
  panel(3, 3, -3, 4, -9, 1.6);      // soft back light for the rims
  panel(7, .5, -7, .25, 8, 2.6);    // second front strip, for the left half of the word
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
  const letterMeshes = [];
  const totalW = glyphs.width * UNIT, capH = (glyphs.letters[0].y1 - glyphs.letters[0].y0) * UNIT;
  glyphs.letters.forEach((letter, index) => {
    const geometry = new ExtrudeGeometry(shapesFor(letter), {depth: DEPTH, bevelEnabled: true, bevelThickness: .028, bevelSize: .016, bevelSegments: quality >= 2 ? 4 : 2, curveSegments: quality >= 2 ? 10 : 6});
    geometry.translate(-totalW / 2, 0, -DEPTH);
    const mesh = new Mesh(geometry, [face, side]);
    const cx = ((letter.x0 + letter.x1) / 2) * UNIT - totalW / 2;
    // Each letter pivots around its own centre so scroll can pull the word apart.
    geometry.translate(-cx, 0, DEPTH / 2);
    mesh.position.set(cx, 0, -DEPTH / 2);
    mesh.userData = {cx, index};
    word.add(mesh); letterMeshes.push(mesh);
  });

  /* Lights: the environment does most of the work; a white rim from behind-top outlines the letters. */
  const rimLight = new DirectionalLight(0xffffff, 1.4); rimLight.position.set(-2, 3, -4); scene.add(rimLight);
  const key = new DirectionalLight(0xffffff, .6); key.position.set(3, 2, 5); scene.add(key);
  // A small light that follows the pointer over the word: a highlight that slides across the metal.
  const torch = new PointLight(0xffffff, 0, TORCH_Z * 1.6, 2); torch.position.set(0, capH * .5, TORCH_Z); scene.add(torch);

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
    yaw: 0, pitch: 0, sep: 0, time: 0, env: 0};
  const v3 = new Vector3(), faceN = new Vector3(), faceQ = new Vector3(), rayD = new Vector3(), hit = new Vector3();

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

  let last = 0, statT = 0, frames = 0, costSum = 0;
  function step(now) {
    const dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60; last = now;
    S.time += dt;
    const {worldPerPx, dist} = frame();
    const hot = S.ptr.hot, px = S.ptr.inside ? S.ptr.x : .5, py = S.ptr.inside ? S.ptr.y : .62;
    // The word tilts a little with the pointer; reflections drift on their own.
    const idle = S.ptr.inside ? 0 : 1;
    S.yaw = damp(S.yaw, (px - .5) * .14 + Math.sin(S.time * .21) * .03 * idle, 3, dt);
    S.pitch = damp(S.pitch, (py - .55) * .06 + Math.sin(S.time * .17) * .015 * idle, 3, dt);
    word.rotation.set(S.pitch, S.yaw, 0);
    S.sep = damp(S.sep, S.scroll, 8, dt);
    // Hover: the letter under the pointer comes forward and turns a little towards it; its neighbours follow less.
    const ptrWorldX = camera.position.x + (px * S.w - S.w / 2) * worldPerPx, ptrWorldY = camera.position.y - (py * S.h - S.h / 2) * worldPerPx;
    const reach = capH * .8;
    letterMeshes.forEach((mesh, i) => {
      const k = i - (letterMeshes.length - 1) / 2, u = mesh.userData;
      const dx = ptrWorldX - u.cx, dy = ptrWorldY - capH / 2;
      u.lift = damp(u.lift || 0, hot ? Math.exp(-((dx / reach) ** 2)) : 0, hot ? 9 : 5, dt);
      mesh.position.x = u.cx + k * S.sep * .28;
      mesh.position.z = -DEPTH / 2 - Math.abs(k) * S.sep * .5 + u.lift * DEPTH * .9;
      mesh.rotation.y = k * S.sep * .32 + clamp(dx / reach, -1, 1) * .2 * u.lift;
      mesh.rotation.x = -clamp(dy / capH, -1, 1) * .14 * u.lift;
      mesh.position.y = S.sep * (k % 2 ? .06 : -.04) * Math.abs(k) + u.lift * capH * .03;
    });
    S.torch = damp(S.torch || 0, hot ? 1 : 0, hot ? 8 : 4, dt);
    torch.intensity = S.torch * TORCH;
    // A chrome face shows a point light where the view ray from the camera, mirrored on the face, meets the light. So
    // the light goes along that mirrored ray from the point under the pointer: the sheen sits under the pointer even
    // when the letter has come forward and turned (normal and front plane of the nearest letter, in world space).
    word.updateMatrixWorld();
    let nearest = letterMeshes[0];
    letterMeshes.forEach(m => { if (Math.abs(ptrWorldX - m.userData.cx) < Math.abs(ptrWorldX - nearest.userData.cx)) nearest = m; });
    faceN.set(0, 0, 1).transformDirection(nearest.matrixWorld);
    faceQ.set(0, 0, DEPTH / 2 + .028).applyMatrix4(nearest.matrixWorld);
    rayD.set(ptrWorldX, ptrWorldY, 0).sub(camera.position).normalize();
    const along = faceN.dot(v3.copy(faceQ).sub(camera.position)) / Math.min(-1e-4, faceN.dot(rayD));
    hit.copy(camera.position).addScaledVector(rayD, Math.abs(along));
    rayD.addScaledVector(faceN, -2 * rayD.dot(faceN));
    const lx = hit.x + rayD.x * TORCH_Z / Math.max(.2, rayD.z) , ly = hit.y + rayD.y * TORCH_Z / Math.max(.2, rayD.z);
    torch.position.z = hit.z + TORCH_Z;
    torch.position.x = damp(torch.position.x, lx, 30, dt);
    torch.position.y = damp(torch.position.y, ly, 30, dt);
    // Reflections drift by swinging the studio a little either way, not round in full: in most of a full turn the faces
    // look away from the softboxes and the word goes black.
    scene.environmentRotation.y = ENV_CENTER + Math.sin(S.time * .11) * ENV_SWING + S.yaw * 1.5;

    const t0 = performance.now();
    composer.render();
    const cost = performance.now() - t0;
    frames++; costSum += cost; statT += dt;
    if (statT > .5) { onStats({ms: costSum / frames, frames}); statT = 0; frames = 0; costSum = 0; }

  }

  return {
    resize, step,
    pointer(x, y, inside, hot) { S.ptr.x = x; S.ptr.y = y; S.ptr.inside = inside; S.ptr.hot = hot; },
    scroll(p) { S.scroll = clamp(p); },
    wantInfo() {},
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
