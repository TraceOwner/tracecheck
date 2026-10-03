'use strict';
/* TRACE smoke: one fragment shader drawn into a canvas. The same file runs in
   a Worker on an OffscreenCanvas, so context creation, shader compilation and
   every frame stay off the page's main thread, and on the main thread where
   workers are not available. Pacing follows the display: it measures the
   refresh interval and renders on an even cadence instead of skipping frames
   unevenly, and it lowers resolution before it ever lowers the frame rate. */
(scope => {
  const vertex = 'attribute vec2 a_position; void main(){gl_Position=vec4(a_position,0.0,1.0);}';
  const fragment = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform vec2 u_pointer;
    uniform float u_time;
    uniform float u_strength;
    uniform float u_scroll;
    uniform float u_scene;
    uniform float u_mode;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float value = 0.0, amplitude = 0.51;
      mat2 turn = mat2(0.80, 0.60, -0.60, 0.80);
      for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p = turn * p * 2.08 + 9.7;
        amplitude *= 0.49;
      }
      return value;
    }
    float oval(vec2 p, vec2 centre, vec2 radius) {
      vec2 d = (p - centre) / radius;
      return exp(-dot(d, d) * 1.35);
    }
    float ridge(float value, float width) {
      return exp(-value * value / (width * width));
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;
      float t = u_time;
      float aspect = u_resolution.x / u_resolution.y;
      vec2 p = (uv - 0.5) * vec2(3.5, 2.35);
      vec2 natural = (uv - 0.5) * vec2(max(3.6, aspect * 1.34), 2.35);
      vec2 pointer = (u_pointer - 0.5) * vec2(0.32, 0.20);
      p += pointer * 0.39;
      p.y += u_scroll * 0.09;
      float seed = u_scene * 7.13;

      // Three eddies have different velocities and scales. The domain warp
      // bends their edges, making foreground and distant smoke separate.
      float low = fbm(natural * 1.20 + vec2(seed + t * 0.108, -seed * 0.3 - t * 0.067));
      float cross = fbm(natural * 1.77 + vec2(-seed * 0.36 - t * 0.146, seed + t * 0.083));
      vec2 bent = p + vec2(low - 0.48, cross - 0.48) * 0.40
                + vec2(sin(t * 0.35 + seed + natural.y * 1.4), cos(t * 0.29 + seed + natural.x * 1.2)) * 0.10;
      float middle = fbm(natural * 2.40 + vec2(low, cross) * 2.0 + vec2(t * 0.23, -t * 0.155));
      float detail = fbm(natural * 4.20 - vec2(cross, low) * 1.9 + vec2(-t * 0.39, t * 0.26));
      float grains = noise(natural * 13.0 + vec2(t * 0.8, -t * 0.27));
      float cavities = smoothstep(0.28, 0.69, low * 0.38 + middle * 0.42 + detail * 0.20);
      float billows = smoothstep(0.35, 0.72, middle * 0.61 + detail * 0.39 + (low - 0.48) * 0.31);
      float shape = 0.0;
      float filaments = 0.0;
      float sparks = 0.0;
      vec3 cool = vec3(0.098, 0.102, 0.114);
      vec3 warm = vec3(0.212, 0.216, 0.227);
      vec3 accent = vec3(0.600, 0.604, 0.616);

      if (u_scene < 0.5) {
        // Home: rising bronze turbulence is drawn toward a dark central eye.
        shape = oval(bent, vec2(-1.15, -0.48), vec2(1.32, 0.90))
              + oval(bent, vec2(0.97, -0.30), vec2(1.33, 1.05))
              + oval(bent, vec2(0.06, -0.69), vec2(1.02, 0.75)) * 0.62;
        shape *= 1.0 - oval(p, vec2(0.08, 0.14), vec2(0.46, 0.38)) * 0.68;
        filaments = ridge(fbm(natural * 2.35 + vec2(t * 0.09, -t * 0.05)) - 0.56, 0.027)
                  * smoothstep(0.35, 0.73, low) * 0.18;
        sparks = ridge(length((p - vec2(1.06 + sin(t * 0.29) * 0.16, -0.36)) * vec2(1.0, 1.4)), 0.16)
               * 0.19
               + oval(p, vec2(-1.02, -0.34), vec2(0.31, 0.26))
                 * pow(max(sin(t * 0.55 + 1.7), 0.0), 20.0) * 0.32;
        cool = vec3(0.071, 0.075, 0.086);
        warm = vec3(0.263, 0.267, 0.278);
        accent = vec3(0.702, 0.706, 0.718);
      } else if (u_scene < 1.5) {
        // Check: separate dark plumes, never a full-width horizontal strip.
        float ps = 1.0 - smoothstep(0.0, 0.9, u_mode);
        float cmd = 1.0 - abs(u_mode - 1.0);
        float manual = smoothstep(1.05, 1.95, u_mode);
        // The three modes do not merely recolour a shared image. The prompt
        // stirs two offset vortices, CMD cuts through a vertical volume, and
        // manual inspection settles around a quiet lens.
        float psVolume = oval(bent, vec2(-1.38, -0.25), vec2(0.98, 0.71)) * 0.87
                       + oval(bent, vec2(1.26, 0.12), vec2(1.01, 0.89)) * 0.82
                       + oval(bent, vec2(0.18, -0.68), vec2(0.93, 0.66)) * 0.52;
        float cmdVolume = oval(bent, vec2(-0.58, -0.48), vec2(0.72, 1.03)) * 0.79
                        + oval(bent, vec2(0.54, 0.16), vec2(0.58, 1.16)) * 0.91
                        + oval(bent, vec2(1.42, -0.42), vec2(0.63, 0.70)) * 0.61;
        float manualVolume = oval(bent, vec2(0.24, -0.21), vec2(1.10, 0.92)) * 0.73
                           + oval(bent, vec2(-1.34, -0.51), vec2(0.73, 0.66)) * 0.56
                           + oval(bent, vec2(1.37, 0.26), vec2(0.70, 0.72)) * 0.41;
        shape = psVolume * ps + cmdVolume * cmd + manualVolume * manual;
        cool = vec3(0.094, 0.098, 0.110) * ps
             + vec3(0.106, 0.110, 0.122) * cmd
             + vec3(0.090, 0.094, 0.106) * manual;
        warm = vec3(0.208, 0.212, 0.224) * ps
             + vec3(0.212, 0.216, 0.227) * cmd
             + vec3(0.212, 0.216, 0.227) * manual;
        accent = vec3(0.663, 0.667, 0.678) * ps
               + vec3(0.659, 0.663, 0.675) * cmd
               + vec3(0.573, 0.576, 0.588) * manual;
        float pocketA = oval(p, vec2(1.15, -0.29), vec2(0.38, 0.34));
        float pocketB = oval(p, vec2(-1.31, 0.12), vec2(0.28, 0.27));
        float commandSlits = ridge(p.x + p.y * 0.24 - 0.10 + (middle - 0.5) * 0.18, 0.020)
                           + ridge(p.x + p.y * 0.19 - 0.52 + (cross - 0.5) * 0.14, 0.014);
        float inspectionRing = ridge(length((p - vec2(0.24, -0.21)) * vec2(0.83, 1.11)) - 0.69, 0.028);
        filaments = ps * (ridge(middle - 0.56, 0.023) * psVolume * 0.085
                       + ridge(middle - 0.62, 0.025) * (pocketA + pocketB * 0.66) * 0.24)
                  + cmd * commandSlits * smoothstep(0.42, 0.69, detail) * 0.20
                  + manual * inspectionRing * smoothstep(0.35, 0.68, low) * 0.13;
        sparks = pocketA * ridge(detail - 0.70, 0.058) * 0.16
               + pocketB * ridge(low - 0.69, 0.054) * 0.10
               + oval(p, vec2(1.13, -0.70), vec2(0.24, 0.18))
                 * pow(max(sin(t * 0.57), 0.0), 7.0) * 0.47;
      } else if (u_scene < 2.5) {
        // Method: cold contour folds suggest evidence being read in layers.
        shape = oval(bent, vec2(-0.96, -0.21), vec2(1.36, 0.98)) * 0.84
              + oval(bent, vec2(1.32, 0.51), vec2(1.14, 0.77)) * 0.77;
        filaments = ridge(fbm(natural * 2.0 + vec2(t * 0.08, -t * 0.05)) - 0.55, 0.014) * 0.16;
        cool = vec3(0.102, 0.106, 0.118);
        warm = vec3(0.180, 0.184, 0.196);
        accent = vec3(0.663, 0.667, 0.678);
      } else if (u_scene < 3.5) {
        // Projects: dispersed amber islands, like signals in a network.
        shape = oval(bent, vec2(-1.33, -0.38), vec2(0.84, 0.82))
              + oval(bent, vec2(0.13, 0.40), vec2(0.68, 0.82)) * 0.72
              + oval(bent, vec2(1.46, -0.12), vec2(0.83, 0.88));
        float orbitA = length((p - vec2(-0.53, -0.52)) * vec2(0.79, 1.35));
        float orbitB = length((p - vec2(1.04, 0.32)) * vec2(0.92, 1.42));
        filaments = (ridge(orbitA - 0.72, 0.012) + ridge(orbitB - 0.54, 0.010))
                  * (0.25 + 0.75 * smoothstep(0.36, 0.70, middle)) * 0.14;
        sparks = oval(p, vec2(1.14, -0.27), vec2(0.11, 0.16)) * 0.20;
        cool = vec3(0.082, 0.086, 0.098);
        warm = vec3(0.212, 0.216, 0.227);
        accent = vec3(0.706, 0.710, 0.722);
      } else if (u_scene < 4.5) {
        // Tools: oblique apertures, refracted by drifting smoke.
        shape = oval(bent, vec2(-0.22, -0.41), vec2(1.47, 0.97))
              + oval(bent, vec2(1.56, 0.24), vec2(0.85, 0.75)) * 0.62;
        float slitA = ridge(uv.x + uv.y * 0.22 - 0.37 - (low - 0.5) * 0.045, 0.006);
        float slitB = ridge(uv.x + uv.y * 0.28 - 0.71 - (cross - 0.5) * 0.042, 0.004);
        filaments = (slitA + slitB) * smoothstep(0.42, 0.74, middle) * 0.20;
        cool = vec3(0.098, 0.102, 0.114);
        warm = vec3(0.188, 0.192, 0.204);
        accent = vec3(0.725, 0.729, 0.741);
      } else if (u_scene < 5.5) {
        // The statement is nearly black: only a distant ember survives.
        shape = oval(bent, vec2(-1.30, -0.20), vec2(1.12, 0.91)) * 0.69
              + oval(bent, vec2(1.39, -0.38), vec2(0.85, 0.68)) * 0.62;
        sparks = oval(p, vec2(1.31, 0.14), vec2(0.12, 0.20)) * 0.11;
        cool = vec3(0.075, 0.078, 0.090);
        warm = vec3(0.129, 0.133, 0.145);
        accent = vec3(0.529, 0.533, 0.545);
      } else {
        // Legal: restrained ink-blue fog sits far behind the documents.
        shape = oval(bent, vec2(1.34, 0.30), vec2(1.05, 0.83)) * 0.65
              + oval(bent, vec2(-1.4, -0.38), vec2(0.85, 0.63)) * 0.38;
        filaments = ridge(middle - 0.57, 0.018) * 0.035;
        cool = vec3(0.086, 0.090, 0.102);
        warm = vec3(0.141, 0.145, 0.157);
        accent = vec3(0.514, 0.518, 0.529);
      }

      shape *= 0.95 + sin(t * 0.28 + low * 4.0) * 0.08;
      float depth = clamp(shape * (cavities * 0.36 + billows * 0.52 + detail * 0.16), 0.0, 1.0);
      float distant = clamp(shape * smoothstep(0.37, 0.69, low) * 0.38, 0.0, 0.6);
      float near = clamp(shape * smoothstep(0.43, 0.70, detail) * 0.33, 0.0, 0.65);
      float lit = filaments * (0.45 + grains * 0.55) + sparks;
      vec3 pigment = vec3(0.027, 0.035, 0.047)
                   + cool * distant * 2.0
                   + warm * depth * 0.86
                   + vec3(0.137, 0.141, 0.153) * near * 0.70
                   + accent * lit * 1.8;
      float alpha = clamp(distant * 0.62 + depth * 0.83 + near * 0.42 + lit * 0.36,
                          0.0, 0.88) * u_strength;
      gl_FragColor = vec4(pigment, alpha);
    }
  `;

  const raf = scope.requestAnimationFrame ? cb => scope.requestAnimationFrame(cb) : cb => setTimeout(() => cb(performance.now()), 1000 / 60);
  const caf = scope.cancelAnimationFrame ? id => scope.cancelAnimationFrame(id) : id => clearTimeout(id);
  const median = list => [...list].sort((a, b) => a - b)[list.length >> 1];
  const names = ['resolution', 'pointer', 'time', 'strength', 'scroll', 'scene', 'mode'];

  function create(canvas, {scene = 0, strength = 1, live = () => {}, lost = () => {}} = {}) {
    const gl = canvas.getContext('webgl', {alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'low-power'});
    if (!gl) return null;
    const ext = gl.getExtension('KHR_parallel_shader_compile');
    const program = gl.createProgram(), shaders = [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]].map(([type, source]) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source); gl.compileShader(shader); gl.attachShader(program, shader);
      return shader;
    });
    gl.linkProgram(program);

    const state = {x: .5, y: .5, tx: .5, ty: .5, scroll: 0, mode: 0, tmode: 0, time: 4};
    let location = null, ready = false, dead = false, running = false, frame = 0, building = 0;
    let w = 0, h = 0, level = 0, last = 0, raw = 0, refresh = 0, divider = 1, tick = 0, late = 0, announced = false;
    const deltas = [], scales = [1, .8, .64];

    function fail(reason) {
      if (dead) return;
      dead = true; caf(frame); caf(building); frame = building = 0;
      lost(reason);
    }
    function link() {
      // Status is only read once the driver reports completion, so the wait never blocks a thread.
      if (dead) return;
      if (ext && !gl.getProgramParameter(program, ext.COMPLETION_STATUS_KHR)) { building = raf(link); return; }
      building = 0;
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { fail('link'); return; }
      shaders.forEach(shader => { gl.detachShader(program, shader); gl.deleteShader(shader); });
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      location = Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, 'u_' + name)]));
      ready = true;
      draw();
      if (running) schedule();
    }
    function draw() {
      if (!ready || dead || !canvas.width) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(location.resolution, canvas.width, canvas.height);
      gl.uniform2f(location.pointer, state.x, state.y);
      gl.uniform1f(location.time, state.time); gl.uniform1f(location.scroll, state.scroll);
      gl.uniform1f(location.strength, strength);
      gl.uniform1f(location.scene, scene); gl.uniform1f(location.mode, state.mode);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!announced) { announced = true; live(); }
    }
    function size() {
      if (!w) return;
      const scale = scales[level];
      canvas.width = Math.max(2, Math.round(w * scale)); canvas.height = Math.max(2, Math.round(h * scale));
    }
    function schedule() { if (!frame && ready && running && !dead) frame = raf(loop); }
    function loop(stamp) {
      frame = 0;
      if (!running || dead) { last = raw = 0; return; }
      if (raw) {
        const gap = stamp - raw;
        if (!refresh) {
          if (gap > 2 && gap < 60) deltas.push(gap);
          if (deltas.length >= 24) {
            refresh = median(deltas);
            // Even cadence: every n-th display frame, aiming for at most ~72 fps.
            divider = Math.max(1, Math.round(1000 / refresh / 72));
          }
        } else {
          // Sustained late frames mean the device cannot keep up: drop resolution first, then rate.
          late = gap > refresh * 1.75 ? late + 1 : Math.max(0, late - .5);
          if (late > 36) {
            late = 0;
            if (level < scales.length - 1) { level++; size(); draw(); }
            else if (divider < 4 && refresh * divider < 30) divider++;
          }
        }
      }
      raw = stamp;
      // While the page scrolls the smoke draws every third frame: the page's own frames come first.
      if (++tick % (divider * (state.calm ? 3 : 1)) === 0) {
        const dt = last ? Math.min((stamp - last) / 1000, .1) : 1 / 60;
        last = stamp;
        state.time += dt;
        const follow = 1 - Math.exp(-dt * 2.6);
        state.x += (state.tx - state.x) * follow; state.y += (state.ty - state.y) * follow;
        state.mode += (state.tmode - state.mode) * (1 - Math.exp(-dt * 3.2));
        draw();
      }
      schedule();
    }

    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fail('context'); });
    if (ext) building = raf(link); else link();
    return {
      resize(width, height) { w = width; h = height; level = Math.min(level, scales.length - 1); size(); draw(); },
      input(patch) {
        if ('x' in patch) state.tx = patch.x;
        if ('y' in patch) state.ty = patch.y;
        if ('scroll' in patch) state.scroll = patch.scroll;
        if ('calm' in patch) state.calm = patch.calm;
        if ('mode' in patch) state.tmode = patch.mode;
      },
      // A settled frame for paused or reduced-motion pages: targets are reached at once.
      still() { state.x = state.tx; state.y = state.ty; state.mode = state.tmode; draw(); },
      run(on) {
        if (on === running) return;
        running = on;
        if (on) { last = raw = 0; schedule(); } else { caf(frame); frame = 0; }
      },
      destroy() { running = false; dead = true; caf(frame); caf(building); gl.getExtension('WEBGL_lose_context')?.loseContext(); }
    };
  }
  scope.TraceSmoke = {create};
})(typeof self !== 'undefined' ? self : window);
