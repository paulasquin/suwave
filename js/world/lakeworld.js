// A Québec lake from its real outline: sky dome, water, wooded hills and spruce trees.
// Shared by the hero (golden hour, mirror reflections) and the drift map (seen from above).
//
// Lake frame (data): metres, x east, y north. Scene: X = x, Y = up, Z = -y.
import * as THREE from 'three';
import { QUALITY } from '../kit/fx.js';
import { onWater } from '../sim/anticipation.js';

const SKY_GLSL = /* glsl */`
  uniform vec3 uSun; uniform float uTime; uniform float uDay;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }
  // Golden-hour sky (uDay = 0) blending to a clear day sky (uDay = 1).
  vec3 skyColor(vec3 d, bool clouds) {
    float y = max(d.y, 0.0);
    float sd = max(dot(d, uSun), 0.0);
    vec3 zenith = mix(vec3(0.10, 0.20, 0.42), vec3(0.18, 0.38, 0.78), uDay);
    vec3 horizon = mix(vec3(1.0, 0.62, 0.36), vec3(0.72, 0.84, 0.98), uDay);
    vec3 away = mix(vec3(0.62, 0.52, 0.62), vec3(0.62, 0.76, 0.95), uDay);
    vec3 hor = mix(away, horizon, pow(clamp(dot(normalize(d.xz + 1e-4), normalize(uSun.xz + 1e-4)) * 0.5 + 0.5, 0.0, 1.0), 2.0));
    vec3 col = mix(hor, zenith, pow(clamp(y, 0.0, 1.0), 0.45)) * mix(0.42, 0.75, uDay);
    col += vec3(1.0, 0.5, 0.22) * pow(sd, 8.0) * 0.32 * (1.0 - uDay * 0.6);
    col += vec3(1.0, 0.75, 0.5) * pow(sd, 90.0) * 0.7;
    col += vec3(1.0, 0.9, 0.72) * smoothstep(0.99994, 0.99998, sd) * 6.0;
    if (clouds && d.y > 0.0) {
      vec2 uv = d.xz / (d.y + 0.12) * 1.6 + vec2(uTime * 0.004, 0.0);
      float c = smoothstep(0.52, 0.85, fbm(uv * 1.3 + fbm(uv * 0.7) * 0.6)) * smoothstep(0.0, 0.25, d.y);
      vec3 lit = mix(vec3(1.0, 0.6, 0.42), vec3(1.0), uDay) * (0.32 + 0.55 * pow(sd, 3.0)) * mix(1.0, 1.4, uDay);
      col = mix(col, lit * mix(0.95, 1.05, c), c * 0.6);
    }
    return col;
  }
`;

export function createSky(sunDir) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: sunDir.clone() }, uTime: { value: 0 }, uDay: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: SKY_GLSL + /* glsl */`
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        // Below the horizon: the mirror image (seen through the water as its reflection).
        vec3 m = vec3(d.x, abs(d.y), d.z);
        vec3 col = skyColor(m, true);
        if (d.y < 0.0) col *= 0.9;
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  mesh.scale.setScalar(15000);
  mesh.renderOrder = -100;
  mesh.frustumCulled = false;
  mesh.onBeforeRender = (r, s, cam) => mesh.position.copy(cam.position);
  return mesh;
}

/**
 * Water: wave normals from a sum of travelling waves, sun glints, ripple rings.
 * mirror = true: semi-transparent over a mirrored scene (the reflection);
 * mirror = false: opaque with an analytic sky reflection (top view).
 */
export function createWater(sunDir, { mirror = true, size = 30000 } = {}) {
  const uniforms = {
    uSun: { value: sunDir.clone() }, uTime: { value: 0 }, uDay: { value: 0 },
    uRipple: { value: new THREE.Vector4(0, 0, -100, 0) }, uWind: { value: new THREE.Vector2(1, 0) },
    uDeep: { value: new THREE.Color('#06171c') }, uGlint: { value: 1 }, uCalm: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: SKY_GLSL + /* glsl */`
      uniform vec4 uRipple; uniform vec2 uWind; uniform vec3 uDeep; uniform float uGlint, uCalm;
      varying vec3 vW;
      // Analytic slope of a few travelling waves (short wavelengths fade with distance).
      vec2 slope(vec2 p, float fade) {
        vec2 g = vec2(0.0);
        float t = uTime;
        for (int i = 0; i < 7; i++) {
          float fi = float(i);
          float ang = fi * 2.399 + 0.3;
          vec2 dir = normalize(mix(vec2(cos(ang), sin(ang)), uWind, 0.55));
          float k = 0.6 * pow(1.55, fi);            // wavenumber (rad/m)
          float a = 0.035 / pow(1.6, fi) * uCalm;   // amplitude (m)
          float w = sqrt(9.81 * k);
          float ph = dot(dir, p) * k - w * t * 0.35 + fi * 1.7;
          float att = (i > 3) ? fade : 1.0;
          g += dir * (a * k * cos(ph)) * att;
        }
        float n = n2(p * 0.9 + t * 0.15) - n2(p * 0.9 + 0.5 - t * 0.12);
        g += vec2(n, -n) * 0.02 * fade * uCalm;
        return g;
      }
      void main() {
        vec3 v = cameraPosition - vW;
        float dist = length(v);
        v /= dist;
        float fade = clamp(1.0 - dist / 160.0, 0.0, 1.0);
        // Waves fade with distance (no aliasing shimmer on the far water).
        vec2 g = slope(vW.xz, fade) * (0.12 + 0.88 * exp(-dist / 120.0));
        // Ripple rings after the landing.
        float age = uTime - uRipple.z;
        if (age > 0.0 && age < 12.0) {
          vec2 dp = vW.xz - uRipple.xy;
          float r = length(dp);
          float front = age * 1.1;
          float ring = sin((r - front) * 9.0) * exp(-abs(r - front) * 1.4) * exp(-age * 0.35) * uRipple.w;
          g += (dp / max(r, 0.01)) * ring * 0.35;
        }
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        float nv = max(dot(n, v), 0.0);
        float F = 0.02 + 0.98 * pow(clamp(1.0 - nv, 0.0, 1.0), 5.0);
        vec3 r = reflect(-v, n);
        r.y = abs(r.y);
        float rs = max(dot(r, uSun), 0.0);
        vec3 sunCol = mix(vec3(1.0, 0.72, 0.45), vec3(1.0, 0.95, 0.85), uDay);
        vec3 glint = sunCol * (pow(rs, 1200.0) * 6.0 + pow(rs, 120.0) * 0.45) * uGlint * smoothstep(-0.02, 0.06, uSun.y);
        vec3 deep = uDeep * (0.6 + 0.4 * smoothstep(0.0, 1.0, uSun.y * 3.0 + uDay));
        ${mirror ? `
        // Over the mirrored scene: transparent where the reflection dominates.
        float a = clamp(1.0 - F * 0.93, 0.08, 1.0);
        // Ripples shade the surface (no holes in it): lighter facing the sky, darker away.
        vec3 tint = deep * (1.0 + clamp((g.x - g.y) * 2.5, -0.6, 0.8)) + skyColor(r, false) * 0.05 * (1.0 - F);
        gl_FragColor = vec4(tint * a + glint, a);` : `
        vec3 sky = skyColor(r, false);
        vec3 col = mix(deep, sky, F) + glint;
        gl_FragColor = vec4(col, 1.0);`}
      }`,
    transparent: mirror, depthWrite: !mirror,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  mesh.userData.uniforms = uniforms;
  return mesh;
}

/** Distance to the shoreline on a coarse grid (signed: negative on water), bilinear lookup. */
function shoreField(lake, extent, cell) {
  const n = Math.ceil((extent * 2) / cell) + 1;
  const segs = [];
  lake.rings.forEach((r) => [r.outer, ...r.holes].forEach((ring) => ring.forEach((p, i) => segs.push([p, ring[(i + 1) % ring.length]]))));
  const f = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -extent + i * cell, y = -extent + j * cell;
    let d = 1e9;
    for (const [a, b] of segs) {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      const ex = a[0] + dx * t - x, ey = a[1] + dy * t - y;
      d = Math.min(d, ex * ex + ey * ey);
    }
    d = Math.sqrt(d);
    f[j * n + i] = onWater(x, y, lake) ? -d : d;
  }
  return (x, y) => {
    const fx = (x + extent) / cell, fy = (y + extent) / cell;
    const i = Math.max(0, Math.min(n - 2, Math.floor(fx))), j = Math.max(0, Math.min(n - 2, Math.floor(fy)));
    const u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fy - j));
    return (f[j * n + i] * (1 - u) + f[j * n + i + 1] * u) * (1 - v) + (f[(j + 1) * n + i] * (1 - u) + f[(j + 1) * n + i + 1] * u) * v;
  };
}

const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j;
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}
const fbm = (x, y) => { let s = 0, a = 0.5; for (let k = 0; k < 5; k++) { s += a * vnoise(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return s; };

function spruceGeometry() {
  // Trunk + three stacked cones, unit height, vertex colours darker at the base of each tier.
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.02, 0.03, 0.25, 5);
  trunk.translate(0, 0.125, 0);
  parts.push([trunk, new THREE.Color('#3b2a1e')]);
  [[0.15, 0.55, 0.30], [0.38, 0.42, 0.24], [0.58, 0.42, 0.17]].forEach(([y, h, r]) => {
    const c = new THREE.ConeGeometry(r, h, 7, 1);
    c.translate(0, y + h / 2, 0);
    parts.push([c, new THREE.Color('#1f3a24')]);
  });
  const geos = parts.map(([g, col]) => {
    g = g.toNonIndexed();
    const n = g.attributes.position.count, cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const y = g.attributes.position.getY(i);
      const k = 0.55 + 0.6 * Math.min(1, y);
      cols.set([col.r * k, col.g * k, col.b * k], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return g;
  });
  const merged = mergeGeometries(geos);
  merged.computeVertexNormals();
  return merged;
}
function mergeGeometries(geos) {
  let n = 0; geos.forEach((g) => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  geos.forEach((g) => { pos.set(g.attributes.position.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; });
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return m;
}

/**
 * Terrain and forest around the lake. opts: { extent (m), trees (count), mirror (bool), band (m) }.
 * Returns { group, mirrorGroup, heightAt(x, y), treeMat, groundMat }.
 */
export function createLand(lake, { extent = 4200, trees = 8000, mirror = true, band = 520, cell = 30 } = {}) {
  const dist = shoreField(lake, extent, 40);
  const heightAt = (x, y) => {
    const d = dist(x, y);
    // Continuous through the shoreline, so the water line follows the real outline between grid nodes.
    if (d < 0) return Math.max(-4, d * 0.08);
    const hills = fbm(x / 900 + 3.1, y / 900 - 1.7) * 140 + fbm(x / 260, y / 260) * 18;
    const rise = Math.min(1, d / 420);
    return d * 0.06 * (1 - rise) + hills * Math.pow(rise, 1.15);
  };
  // Ground mesh: a grid with the water cells dropped.
  const n = Math.round((extent * 2) / cell);
  const pos = [], col = [], idx = [];
  const cA = new THREE.Color('#1c3020'), cB = new THREE.Color('#2e4a2a'), cDeep = new THREE.Color('#0f1c12'), cLight = new THREE.Color('#4d6a34'), cRock = new THREE.Color('#6b6656'), cSand = new THREE.Color('#8f7f5e');
  const tmp = new THREE.Color();
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const x = -extent + i * cell, y = -extent + j * cell;
    const h = heightAt(x, y);
    pos.push(x, h, -y);
    const d = dist(x, y);
    tmp.copy(cA).lerp(cB, fbm(x / 120, y / 120)).lerp(cDeep, Math.max(0, fbm(x / 45 + 7, y / 45) - 0.45) * 1.4).lerp(cLight, Math.max(0, fbm(x / 300 - 3, y / 300) - 0.55) * 1.2);
    if (d < 16) tmp.lerp(cSand, 0.7 * (1 - Math.max(0, d) / 16));
    else if (h > 90) tmp.lerp(cRock, Math.min(0.35, (h - 90) / 200));
    col.push(tmp.r, tmp.g, tmp.b);
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
    const x = -extent + (i + 0.5) * cell, y = -extent + (j + 0.5) * cell;
    if (dist(x, y) < -cell * 0.9) continue; // fully in the lake
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const ground = new THREE.Mesh(g, groundMat);
  ground.receiveShadow = true;
  const group = new THREE.Group();
  group.add(ground);

  // Spruces: dense along the shore, thinning into the hills; also on the islands.
  const geo = spruceGeometry();
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const count = Math.round(trees * Math.max(0.35, QUALITY.particles));
  const forest = new THREE.InstancedMesh(geo, treeMat, count);
  forest.castShadow = true;
  forest.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const xs = lake.rings.flatMap((r) => r.outer.map((v) => v[0])), ys = lake.rings.flatMap((r) => r.outer.map((v) => v[1]));
  const bx0 = Math.min(...xs) - band, bx1 = Math.max(...xs) + band, by0 = Math.min(...ys) - band, by1 = Math.max(...ys) + band;
  let k = 0, guard = 0;
  const cTree = new THREE.Color();
  while (k < count && guard++ < count * 40) {
    const x = bx0 + Math.random() * (bx1 - bx0), y = by0 + Math.random() * (by1 - by0);
    const d = dist(x, y);
    if (d < 6 || d > band) continue;
    if (Math.random() > Math.pow(1 - d / band, 0.7)) continue;
    const h = 13 + Math.random() * 15 + (d < 40 ? 4 : 0);
    p.set(x, heightAt(x, y) - 0.5, -y);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28);
    s.set(h * (0.8 + Math.random() * 0.4), h, h * (0.8 + Math.random() * 0.4));
    m.compose(p, q, s);
    forest.setMatrixAt(k, m);
    cTree.setHSL(0.30 + Math.random() * 0.06, 0.35 + Math.random() * 0.2, 0.5 + Math.random() * 0.5);
    if (Math.random() < 0.12) cTree.setHSL(0.18 + Math.random() * 0.05, 0.4, 0.75); // a few birches catching the light
    forest.setColorAt(k, cTree);
    k++;
  }
  forest.count = k;
  forest.instanceMatrix.needsUpdate = true;
  group.add(forest);

  let mirrorGroup = null;
  if (mirror) {
    // The reflection: the same land and trees flipped under the water plane.
    mirrorGroup = new THREE.Group();
    mirrorGroup.scale.y = -1;
    // Underwater ground must not flip above the surface: clamp the mirrored copy at the water line.
    const gm = g.clone();
    const pa = gm.attributes.position;
    for (let i = 0; i < pa.count; i++) if (pa.getY(i) < 0.02) pa.setY(i, 0.02);
    const mg = new THREE.Mesh(gm, groundMat);
    const mf = new THREE.InstancedMesh(geo, treeMat, k);
    mf.instanceMatrix = forest.instanceMatrix;
    mf.instanceColor = forest.instanceColor;
    mf.count = k;
    mirrorGroup.add(mg, mf);
  }
  return { group, mirrorGroup, heightAt, dist, treeMat, groundMat, forest };
}

/** Lake frame (x east, y north) to scene coordinates. */
export const toScene = (x, y, h = 0) => new THREE.Vector3(x, h, -y);
