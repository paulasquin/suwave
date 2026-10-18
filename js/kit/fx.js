// Shared visual building blocks: quality tiers, starfield, glowing plume,
// glow sprites, procedural environment maps, layer-by-layer reveal, HTML labels
// anchored to 3D points and side framing opposite the text cards.
import * as THREE from 'three';

export const QUALITY = (() => {
  // ?capture: offline video capture, always full quality.
  if (location.search.includes('capture')) return { tier: 2, mobile: false, particles: 1, capture: true };
  const mobile = matchMedia('(max-width: 860px)').matches || /Mobi|Android/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  let tier = mobile ? 1 : cores <= 4 ? 1.5 : 2;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    if (/SwiftShader|llvmpipe|Software/i.test(r)) tier = 0.5;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch (e) { /* ignore */ }
  return { tier, mobile, particles: tier >= 2 ? 1 : tier >= 1.5 ? 0.7 : tier >= 1 ? 0.5 : 0.3 };
})();

export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Slide the camera frame sideways so the 3D subject sits opposite the text card
 * of the current panel. sides[i] = -1 when panel i has its card on the left.
 */
export function frameOpposite(camera, p, sides, w, h, amount = 0.17) {
  // Portrait: cards sit at the bottom of the screen, so lift the subject into the upper part.
  if (w < h) { camera.setViewOffset(w, h, 0, 0.17 * h, w, h); return; }
  const n = sides.length;
  const x = p * n - 0.5;
  const i = Math.max(0, Math.min(n - 1, Math.floor(x)));
  const j = Math.min(n - 1, i + 1);
  const f = smooth(0.3, 0.7, x - i);
  const side = x < 0 ? sides[0] : sides[i] + (sides[j] - sides[i]) * f;
  camera.setViewOffset(w, h, side * amount * w, 0, w, h);
}

/** Radial gradient texture used by sprites and particles. */
export function glowTexture(stops = [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']], size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Starfield with per-star twinkle and colour temperature. */
export function createStars(count = 4000, radius = 400) {
  count = Math.round(count * Math.max(0.5, QUALITY.particles));
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const seed = new Float32Array(count);
  const palette = [new THREE.Color('#9fc4ff'), new THREE.Color('#ffffff'), new THREE.Color('#fff1d6'), new THREE.Color('#ffd2a1'), new THREE.Color('#c9d8ff')];
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
    // Concentrate a share of the stars in a galactic band.
    let y = u;
    if (i % 3 === 0) y = (Math.random() - 0.5) * 0.25;
    const r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(th) * r * radius, y * radius, Math.sin(th) * r * radius], i * 3);
    const c = palette[(Math.random() * palette.length) | 0];
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = Math.pow(Math.random(), 6) * 3.2 + 0.6;
    seed[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPR: { value: Math.min(devicePixelRatio, 2) }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aSize; attribute float aSeed;
      uniform float uTime; uniform float uPR;
      varying vec3 vColor; varying float vTw;
      void main() {
        vColor = color;
        vTw = 0.65 + 0.35 * sin(uTime * (0.6 + fract(aSeed) * 2.4) + aSeed);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPR * (0.85 + 0.3 * vTw);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity;
      varying vec3 vColor; varying float vTw;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.0, length(d));
        gl_FragColor = vec4(vColor * vTw * 1.4, a * uOpacity);
      }`,
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = -10;
  pts.userData.update = (t) => { mat.uniforms.uTime.value = t; };
  return pts;
}

/**
 * Ion plume pointing along local +Z: a glowing volumetric cone plus GPU-animated
 * ion particles. Everything is computed in shaders, so it costs no CPU per frame.
 */
export function createPlume({
  length = 1, radius = 0.05, spread = 0.22, color = '#6fd6ff', core = '#e6fbff',
  count = 700, speed = 0.9, size = 9, intensity = 1, glow = 1,
} = {}) {
  const group = new THREE.Group();
  const uniforms = {
    uTime: { value: 0 }, uIntensity: { value: intensity }, uColor: { value: new THREE.Color(color) },
    uCore: { value: new THREE.Color(core) }, uLength: { value: length }, uRadius: { value: radius },
    uSpread: { value: spread }, uSpeed: { value: speed }, uSize: { value: size }, uPR: { value: Math.min(devicePixelRatio, 2) },
  };

  // Volumetric cone (two nested shells for a brighter core).
  const shells = [[1, 0.28], [0.45, 0.55]];
  shells.forEach(([w, gain], k) => {
    const geo = new THREE.CylinderGeometry(radius * w * 1.1, (radius + length * spread) * w, length, 48, 24, true);
    geo.translate(0, length / 2, 0);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uGain: { value: gain }, uK: { value: k } },
      vertexShader: /* glsl */`
        uniform float uLength;
        varying float vAlong; varying vec3 vN; varying vec3 vV;
        void main() {
          vAlong = position.z / uLength;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform vec3 uCore; uniform float uTime; uniform float uIntensity; uniform float uGain; uniform float uK;
        varying float vAlong; varying vec3 vN; varying vec3 vV;
        float hash(float n) { return fract(sin(n) * 43758.5453); }
        void main() {
          float facing = abs(dot(normalize(vN), normalize(vV)));
          float body = pow(facing, 2.4 + uK * 1.5);
          float fall = pow(clamp(1.0 - vAlong, 0.0, 1.0), 2.6) * smoothstep(0.0, 0.12, vAlong);
          float flick = 0.88 + 0.12 * sin(uTime * 37.0 + vAlong * 18.0) * sin(uTime * 23.0 + uK * 3.0);
          float stria = 0.8 + 0.2 * sin(vAlong * 60.0 - uTime * 30.0);
          vec3 col = mix(uCore, uColor, smoothstep(0.0, 0.45, vAlong));
          float a = body * fall * flick * stria * uIntensity * uGain;
          gl_FragColor = vec4(col * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 5;
    group.add(mesh);
  });

  // Ion particles.
  const n = Math.max(80, Math.round(count * QUALITY.particles));
  const seeds = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i++) seeds[i] = Math.random();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const pmat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      attribute vec4 aSeed;
      uniform float uTime, uLength, uRadius, uSpread, uSpeed, uSize, uPR;
      varying float vLife; varying float vSeed;
      void main() {
        float life = fract(aSeed.x + uTime * uSpeed * (0.55 + 0.45 * aSeed.y));
        float z = life * uLength;
        float ang = aSeed.z * 6.28318;
        float r = (uRadius * 0.8 + z * uSpread * 0.85) * sqrt(aSeed.w);
        vec3 p = vec3(cos(ang) * r, sin(ang) * r, z);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // Clamp the sprite size: big additive sprites near the camera are a fill-rate trap on phones.
        gl_PointSize = min(uSize * uPR * (1.1 - life * 0.7) / max(0.2, -mv.z), 40.0 * uPR);
        vLife = life; vSeed = aSeed.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform vec3 uCore; uniform float uIntensity;
      varying float vLife; varying float vSeed;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        a *= (1.0 - vLife) * smoothstep(0.0, 0.06, vLife) * uIntensity;
        vec3 col = mix(uCore, uColor, smoothstep(0.0, 0.5, vLife + vSeed * 0.2));
        gl_FragColor = vec4(col * a * 1.6, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, pmat);
  pts.frustumCulled = false;
  pts.renderOrder = 6;
  group.add(pts);

  // Exit glow at the grid.
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(160,230,255,.55)'], [1, 'rgba(80,160,255,0)']]),
    color: new THREE.Color(color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  sprite.scale.setScalar(radius * 6 * glow);
  sprite.renderOrder = 7;
  group.add(sprite);

  group.userData = {
    uniforms,
    update(t) { uniforms.uTime.value = t; },
    setIntensity(v) {
      uniforms.uIntensity.value = v;
      sprite.material.opacity = Math.min(1, v) * 0.7;
      group.visible = v > 0.002;
    },
  };
  return group;
}

/** A dim, space-like environment map: black sky, a sun disc and a blue planet glow. */
export function spaceEnvironment(renderer, sunDir = new THREE.Vector3(-0.6, 0.3, -0.8), planetDir = new THREE.Vector3(0, -1, 0)) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#010205');
  const sun = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(30, 28, 24) }));
  sun.position.copy(sunDir).normalize().multiplyScalar(40);
  scene.add(sun);
  const planet = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.12, 0.28) }));
  planet.position.copy(planetDir).normalize().multiplyScalar(60);
  scene.add(planet);
  const fill = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.7, 0.9) }));
  fill.position.set(30, 20, 30);
  scene.add(fill);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  return env;
}

/** A studio environment for the 3D-printed parts (soft boxes, dark floor). */
export function studioEnvironment(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05070d');
  const box = (w, h, x, y, z, c) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  box(30, 12, 0, 30, 10, new THREE.Color(6, 6.5, 7));
  box(10, 30, -30, 8, 0, new THREE.Color(0.6, 1.4, 2.2));
  box(10, 30, 30, 4, -10, new THREE.Color(2.2, 1.6, 1.2));
  box(40, 6, 0, -2, -30, new THREE.Color(0.3, 0.45, 0.8));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.04).texture;
  pmrem.dispose();
  return env;
}

/** HTML labels that follow 3D anchors. */
export class Labels {
  constructor(container) {
    this.container = container;
    this.items = [];
    this.v = new THREE.Vector3();
  }
  add(text, anchor, { side = 'right', warm = false, object = null } = {}) {
    const el = document.createElement('div');
    el.className = `s-label ${side === 'left' ? 'left' : ''} ${warm ? 'warm' : ''}`;
    el.innerHTML = `<span class="s-line"></span><span class="s-text">${text}</span>`;
    this.container.appendChild(el);
    const item = { el, anchor: anchor.clone(), object, on: false, side };
    this.items.push(item);
    return item;
  }
  show(item, on) {
    if (item.on === on) return;
    item.on = on;
    item.el.classList.toggle('on', on);
  }
  hideAll() { this.items.forEach((i) => this.show(i, false)); }
  update(camera, w, h) {
    for (const it of this.items) {
      if (!it.on) continue;
      this.v.copy(it.anchor);
      if (it.object) it.object.localToWorld(this.v);
      this.v.project(camera);
      const behind = this.v.z > 1;
      const x = (this.v.x * 0.5 + 0.5) * w;
      const y = (-this.v.y * 0.5 + 0.5) * h;
      const ew = it.el.offsetWidth;
      // Keep labels on screen: flip to the other side when they would overflow.
      let left = it.side === 'left';
      if (!left && x + ew > w - 8) left = true;
      else if (left && x - ew < 8) left = false;
      it.el.classList.toggle('left', left);
      const off = left ? -ew + 5 : -5;
      it.el.style.transform = `translate(${(x + off).toFixed(1)}px, ${(y - 10).toFixed(1)}px)`;
      it.el.style.visibility = behind ? 'hidden' : 'visible';
    }
  }
  setVisible(v) { this.container.style.display = v ? '' : 'none'; }
}

/**
 * Layer-by-layer reveal (3D printing look) for any Mesh*Material: fragments above
 * material.userData.uPrint (in the mesh's local Y units) are discarded, with a hot
 * glowing band at the cut while material.userData.uGlow is 1. Faint layer lines too.
 */
export function layerReveal(material, { layer = 0.5 } = {}) {
  material.userData.uPrint = { value: 1e9 };
  material.userData.uGlow = { value: 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPrint = material.userData.uPrint;
    shader.uniforms.uGlow = material.userData.uGlow;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vLocalY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalY = position.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLocalY;\nuniform float uPrint;\nuniform float uGlow;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vLocalY > uPrint) discard;')
      .replace('#include <color_fragment>', `#include <color_fragment>\ndiffuseColor.rgb *= 0.975 + 0.025 * sin(vLocalY * ${(6.2832 / layer).toFixed(4)});`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float band = smoothstep(1.6, 0.0, uPrint - vLocalY) * uGlow;
        totalEmissiveRadiance += mix(vec3(1.0, 0.45, 0.12), vec3(1.0, 0.85, 0.6), band) * band * 2.2;`);
  };
  return material;
}
