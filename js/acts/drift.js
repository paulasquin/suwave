// Act III — the drift, seen from above. Real tracks of 16 August 2017 on Lac Montjoie, then the
// 2017 anticipation algorithm step by step (forecast → drift path → zone U → zone D → landing
// point), then an interactive lab (js/lab.js) that recomputes everything live.
import * as THREE from 'three';
import { smooth, clamp01, lerp, easeInOut, QUALITY } from '../kit/fx.js';
import { t as tr, nf, LANG } from '../kit/i18n.js';
import { createSky, createWater, createLand, toScene } from '../world/lakeworld.js';
import { buildWing } from '../world/wing.js';
import { driftPath, forecastWinds, anticipate, strandingTime, at, sun, toLatLon } from '../sim/anticipation.js';

const PANELS = 5;
export const TRACK_COLORS = ['#ffb45e', '#67d8d0', '#ff7a8a'];
const Y = 2; // overlay height above the water (m)

/** A flat ribbon along a polyline (lake frame), with a 0-1 coordinate for a pen reveal. */
function ribbon(pts, width) {
  const pos = [], tt = [], side = [], idx = [];
  let len = 0;
  const L = [0];
  for (let i = 1; i < pts.length; i++) { len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(len); }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
    const nx = -dy * width / 2, ny = dx * width / 2;
    pos.push(pts[i][0] + nx, 0, -(pts[i][1] + ny), pts[i][0] - nx, 0, -(pts[i][1] - ny));
    tt.push(L[i] / (len || 1), L[i] / (len || 1));
    side.push(1, -1);
    if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  return g;
}
function ribbonMat(color, { dash = 0, glow = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uDraw: { value: 1 }, uOpacity: { value: 1 }, uDash: { value: dash }, uGlow: { value: glow } },
    vertexShader: /* glsl */`
      attribute float aT; attribute float aSide; varying float vT; varying float vS;
      void main() { vT = aT; vS = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uDraw, uOpacity, uDash, uGlow; varying float vT; varying float vS;
      void main() {
        if (vT > uDraw) discard;
        if (uDash > 0.0 && fract(vT * uDash) > 0.55) discard;
        float edge = 1.0 - abs(vS);
        float head = smoothstep(uDraw - 0.03, uDraw, vT) * step(uDraw, 0.999);
        vec3 col = uColor * (0.9 + 0.6 * edge) * uGlow + vec3(1.0) * head * 0.8;
        gl_FragColor = vec4(col, uOpacity * (0.55 + 0.45 * edge));
      }`,
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  });
}
function rectLine(x, y, w, h, color, opacity = 1) {
  // North-west corner (x, y), width to the east, height to the south.
  const g = new THREE.BufferGeometry().setFromPoints([[x, y], [x + w, y], [x + w, y - h], [x, y - h], [x, y]].map(([a, b]) => new THREE.Vector3(a, 0, -b)));
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false }));
  l.renderOrder = 20;
  return l;
}
function rectFill(color, opacity) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 18;
  return m;
}
const setRect = (m, x, y, w, h) => { m.position.set(x + w / 2, Y, -(y - h / 2)); m.scale.set(w, h, 1); };

/** A flat arrow on the water, from (x0, y0) to (x1, y1) in the lake frame: shaft + fixed-size head. */
function arrow(color, opacity = 1) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false });
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat);
  const hs = new THREE.Shape();
  hs.moveTo(0, -0.5); hs.lineTo(1, 0); hs.lineTo(0, 0.5); hs.lineTo(0, -0.5);
  const head = new THREE.Mesh(new THREE.ShapeGeometry(hs).rotateX(-Math.PI / 2), mat);
  const g = new THREE.Group();
  g.add(shaft, head);
  g.renderOrder = shaft.renderOrder = head.renderOrder = 27;
  g.userData = { shaft, head, mat };
  return g;
}
function setArrow(g, x0, y0, x1, y1, width, headLen) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  g.visible = len > 1;
  if (!g.visible) return;
  const hl = Math.min(headLen, len * 0.6), sl = len - hl;
  g.position.set(x0, Y + 1.5, -y0);
  g.rotation.set(0, Math.atan2(y1 - y0, x1 - x0), 0);
  const { shaft, head } = g.userData;
  shaft.scale.set(sl, 1, width);
  shaft.position.set(sl / 2, 0, 0);
  head.scale.set(hl, 1, width * 2.6);
  head.position.set(sl, 0, 0);
}

/** Wind field: arrows on the GEGI water grid, thinned to ~300 m apart, turned with the forecast. */
function windField(grid) {
  const pts = [];
  for (const q of grid) if (pts.every((k) => Math.hypot(k[0] - q[0], k[1] - q[1]) > 300)) pts.push(q);
  const sh = new THREE.Shape();
  sh.moveTo(-0.5, -0.05); sh.lineTo(0.18, -0.05); sh.lineTo(0.18, -0.16); sh.lineTo(0.5, 0); sh.lineTo(0.18, 0.16); sh.lineTo(0.18, 0.05); sh.lineTo(-0.5, 0.05); sh.lineTo(-0.5, -0.05);
  const geo = new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2);
  const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0, depthTest: false, depthWrite: false }), pts.length);
  m.userData.pts = pts;
  m.renderOrder = 21;
  m.frustumCulled = false;
  return m;
}

/** Wind streaks: short segments travelling with the wind over the lake. */
function windStreaks(count, box) {
  const n = Math.round(count * Math.max(0.4, QUALITY.particles));
  const pos = new Float32Array(n * 2 * 3), seed = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const s = [Math.random(), Math.random(), Math.random()];
    seed.set([...s], i * 6); seed.set([...s], i * 6 + 3);
    pos[i * 6 + 4] = 1; // second vertex: tail flag in y
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uWind: { value: new THREE.Vector2(1, 0) }, uBox: { value: new THREE.Vector4(...box) }, uOpacity: { value: 0 }, uLen: { value: 60 } },
    vertexShader: /* glsl */`
      attribute vec3 aSeed; uniform float uTime, uLen; uniform vec2 uWind; uniform vec4 uBox; varying float vA;
      void main() {
        float sp = length(uWind);
        vec2 dir = sp > 0.0 ? uWind / sp : vec2(1.0, 0.0);
        float life = fract(aSeed.z + uTime * 0.25);
        vec2 size = uBox.zw - uBox.xy;
        vec2 p = uBox.xy + mod(aSeed.xy * size + dir * (uTime * 22.0 * (0.4 + sp * 0.25)), size);
        p -= dir * position.y * uLen * (0.5 + sp * 0.12);
        vA = sin(life * 3.14159) * (1.0 - position.y * 0.9);
        gl_Position = projectionMatrix * viewMatrix * vec4(p.x, 6.0, -p.y, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity; varying float vA;
      void main() { gl_FragColor = vec4(vec3(0.85, 0.95, 1.0) * 1.2, vA * uOpacity); }`,
    transparent: true, depthTest: false, depthWrite: false,
  });
  const l = new THREE.LineSegments(g, mat);
  l.frustumCulled = false;
  l.renderOrder = 15;
  return l;
}

export class DriftAct {
  constructor({ lakes, labels }) {
    this.lakes = lakes;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 5, 60000);
    this.look = { bloom: 0.4, bloomRadius: 0.45, threshold: 0.95, exposure: 1.2, fade: 0, vignette: 0.85 };
    this.progress = 0;
    this.labels = labels;
    this.onCharge = null;
    const s = this.scene;
    this.sunDir = new THREE.Vector3(0.3, 0.8, 0.4).normalize();
    this.sky = createSky(this.sunDir);
    this.sky.material.uniforms.uDay.value = 1;
    s.add(this.sky);
    this.water = createWater(this.sunDir, { mirror: false });
    const U = this.water.userData.uniforms;
    U.uDay.value = 1; U.uCalm.value = 2.5; U.uGlint.value = 0.35;
    U.uDeep.value.set('#12414d');
    s.add(this.water);
    this.hemi = new THREE.HemisphereLight('#dfeeff', '#30402a', 0.8);
    s.add(this.hemi);
    this.sunL = new THREE.DirectionalLight('#fff4e0', 2.4);
    this.sunL.castShadow = QUALITY.tier >= 1.5;
    this.sunL.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sunL.shadow.camera, { left: -2200, right: 2200, top: 2200, bottom: -2200, near: 100, far: 9000 });
    this.sunL.shadow.bias = -0.0008;
    s.add(this.sunL, this.sunL.target);

    this.overlay = new THREE.Group();
    s.add(this.overlay);
    // The wing, scaled up so it reads from the sky (×22).
    const w = buildWing({ motor: false, cellsOn: true });
    this.drone = w.group;
    this.drone.scale.setScalar(40);
    this.drone.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.drone.visible = false;
    s.add(this.drone);
    this.halo = new THREE.Mesh(new THREE.RingGeometry(26, 34, 48), new THREE.MeshBasicMaterial({ color: '#fff1dc', transparent: true, opacity: 0.8, depthTest: false }));
    this.halo.rotation.x = -Math.PI / 2; this.halo.renderOrder = 33;
    s.add(this.halo);
    this.markers = TRACK_COLORS.map((c) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 30;
      const halo = new THREE.Mesh(new THREE.RingGeometry(12, 16, 32), new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true, opacity: 0.5 }));
      halo.rotation.x = -Math.PI / 2; halo.renderOrder = 30;
      const g = new THREE.Group(); g.add(m, halo); g.visible = false;
      s.add(g);
      return g;
    });
    this.pin = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 220, 12, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.4, 0.6), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.y = 110;
    const ring = new THREE.Mesh(new THREE.RingGeometry(14, 20, 40), new THREE.MeshBasicMaterial({ color: '#ffd28a', transparent: true, depthTest: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = Y; ring.renderOrder = 31;
    this.pin.add(beam, ring);
    this.pinRing = ring;
    this.pin.visible = false;
    s.add(this.pin);
    this.strand = new THREE.Mesh(new THREE.RingGeometry(16, 24, 40), new THREE.MeshBasicMaterial({ color: '#ff5a4a', transparent: true, depthTest: false }));
    this.strand.rotation.x = -Math.PI / 2; this.strand.renderOrder = 32; this.strand.visible = false;
    s.add(this.strand);

    this.lab = {
      land: labels.add(tr('drift.label.land'), new THREE.Vector3(0, 0, 0), { warm: true }),
      zoneD: labels.add(tr('drift.label.zoneD'), new THREE.Vector3(0, 0, 0)),
      zoneU: labels.add(tr('drift.label.zoneU'), new THREE.Vector3(0, 0, 0), { side: 'left' }),
      t: TRACK_COLORS.map((c, i) => labels.add(tr('drift.label.wing', { n: i + 2 }), new THREE.Vector3(), {})),
    };
    this.interactive = false;
    this.playT0 = performance.now();
    this.v = new THREE.Vector3(); this.v2 = new THREE.Vector3();
    this.setLake('montjoie');
    // Scripted scenario: the real forecast of 14 Sept 2017 from 9:30, three hours of charge.
    this.script = this.compute({ lake: 'montjoie', mode: 'forecast', start: 26.5, hours: 3 });
    this.user = null;
    this.showScenario(this.script);
  }

  init(renderer) { renderer.shadowMap.enabled = QUALITY.tier >= 1.5; }

  /** Build (or reuse) the land, trees, tracks, grid and zones of a lake. */
  setLake(key) {
    if (this.lakeKey === key) return;
    this.lakeKey = key;
    this.cache ??= {};
    if (this.world) this.scene.remove(this.world.group, this.world.over);
    if (!this.cache[key]) {
      const lake = this.lakes[key];
      const land = createLand(lake, { trees: QUALITY.tier >= 1.5 ? 14000 : 6000, mirror: false, extent: 3600, band: 380, cell: 26 });
      const over = new THREE.Group();
      // Real drift tracks.
      const tracks = lake.tracks.slice(0, 3).map((tr0, i) => {
        const m = new THREE.Mesh(ribbon(tr0.pts.map((p) => [p[1], p[2]]), 7), ribbonMat(TRACK_COLORS[i % 3]));
        m.position.y = Y; m.renderOrder = 22;
        over.add(m);
        return { mesh: m, data: tr0 };
      });
      // GEGI water grid.
      const dots = new THREE.InstancedMesh(new THREE.CircleGeometry(5, 10), new THREE.MeshBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0, depthTest: false }), lake.grid.length);
      dots.rotation.x = 0;
      const mm = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      lake.grid.forEach(([x, y], i) => { mm.compose(new THREE.Vector3(x, Y, -y), q, new THREE.Vector3(1, 1, 1)); dots.setMatrixAt(i, mm); });
      dots.renderOrder = 19;
      over.add(dots);
      // Every safe zone, faint; the selected ones are drawn on top.
      const zg = new THREE.Group();
      lake.zones.forEach((z) => zg.add(rectLine(z[0], z[1], z[2], z[3], '#bfe6ff', 0.0)));
      zg.position.y = Y;
      over.add(zg);
      const xs = lake.rings[0].outer.map((p) => p[0]), ys = lake.rings[0].outer.map((p) => p[1]);
      const box = [Math.min(...xs) - 300, Math.min(...ys) - 300, Math.max(...xs) + 300, Math.max(...ys) + 300];
      const streaks = windStreaks(520, box);
      over.add(streaks);
      const field = windField(lake.grid);
      over.add(field);
      this.cache[key] = { lake, group: land.group, over, tracks, dots, zones: zg, streaks, field, box, size: Math.max(box[2] - box[0], box[3] - box[1]), center: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2] };
    }
    this.world = this.cache[key];
    this.scene.add(this.world.group, this.world.over);
    // Scenario overlays (rebuilt per scenario).
    if (!this.sc) {
      this.sc = {
        path: null, vecs: new THREE.Group(), zoneU: rectLine(0, 0, 1, 1, '#ffffff', 1), zoneD: rectLine(0, 0, 1, 1, '#67d8d0', 1), fillD: rectFill('#67d8d0', 0.16), fillU: rectFill('#ffffff', 0.08), cands: new THREE.Group(),
      };
      this.sc.zoneU.material.linewidth = 2;
      this.overlay.add(this.sc.vecs, this.sc.zoneU, this.sc.zoneD, this.sc.fillD, this.sc.fillU, this.sc.cands);
    }
  }

  /** Run the algorithm for a scenario: { lake, mode: 'const' | 'forecast', dir (deg, from), speed, start, hours }. */
  compute(o) {
    const lake = this.lakes[o.lake];
    let winds;
    const secs = o.hours * 3600;
    if (o.mode === 'forecast') winds = forecastWinds(lake.forecast, o.start, secs);
    else {
      const to = ((o.dir + 180) * Math.PI) / 180; // the wind blows towards dir + 180°
      winds = [{ vx: Math.sin(to) * o.speed, vy: Math.cos(to) * o.speed, dt: secs }];
    }
    const path = driftPath(winds);
    const res = anticipate(path, lake.zones);
    res.strand = strandingTime(res.path, lake);
    res.winds = winds;
    res.hours = o.hours;
    res.opts = o;
    res.lake = lake;
    res.gps = toLatLon(lake, res.land.x, res.land.y);
    const len = path.reduce((s, p, i) => (i ? s + Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y) : 0), 0);
    res.length = len;
    // Start time (for the sun): forecast slot dates are local time (EDT = UTC-4) in 2017.
    let startDate;
    if (o.mode === 'forecast') {
      const k = Math.floor(o.start), [md, hm] = lake.forecast[k][0].split(' ');
      const [mo, d] = md.split('-').map(Number), [h, mi] = hm.split(':').map(Number);
      startDate = Date.UTC(2017, mo - 1, d, h + 4, mi) + (o.start - k) * 3 * 3600e3;
    } else startDate = Date.UTC(2017, 7, 16, 13 + 0, 30); // 16 Aug 2017, 9:30 EDT
    res.startDate = startDate;
    res.night = [0, 0.5, 1].some((f) => sun(startDate + f * secs * 1000).el < 0);
    return res;
  }

  /** Rebuild the scenario overlays. */
  showScenario(res) {
    if (res.opts.lake !== this.lakeKey) this.setLake(res.opts.lake);
    this.cur = res;
    const sc = this.sc;
    if (sc.path) { this.overlay.remove(sc.path); sc.path.geometry.dispose(); }
    sc.path = new THREE.Mesh(ribbon(res.path.map((p) => [p.x, p.y]), 9), ribbonMat('#ffd28a'));
    sc.path.position.y = Y + 0.5; sc.path.renderOrder = 25;
    this.overlay.add(sc.path);
    // One drift vector per forecast vector (5 % x wind x time under it), chained head to tail.
    sc.vecs.clear();
    res.path.slice(1).forEach(() => sc.vecs.add(arrow('#ffb45e', 0)));
    const Uz = res.zoneU, Dz = res.zoneD;
    sc.zoneU.geometry.setFromPoints([[Uz.x, Uz.y], [Uz.x + Uz.w, Uz.y], [Uz.x + Uz.w, Uz.y - Uz.h], [Uz.x, Uz.y - Uz.h], [Uz.x, Uz.y]].map(([a, b]) => new THREE.Vector3(a, Y + 1, -b)));
    sc.zoneD.geometry.setFromPoints([[Dz.x, Dz.y], [Dz.x + Dz.w, Dz.y], [Dz.x + Dz.w, Dz.y - Dz.h], [Dz.x, Dz.y - Dz.h], [Dz.x, Dz.y]].map(([a, b]) => new THREE.Vector3(a, Y + 1, -b)));
    setRect(sc.fillD, Dz.x, Dz.y, Dz.w, Dz.h);
    setRect(sc.fillU, Uz.x, Uz.y, Math.max(Uz.w, 4), Math.max(Uz.h, 4));
    sc.zoneD.material.color.set(res.tooSmall ? '#ff9a5a' : '#67d8d0');
    sc.fillD.material.color.set(res.tooSmall ? '#ff9a5a' : '#67d8d0');
    // Candidate zones that fit.
    sc.cands.clear();
    if (!res.tooSmall) res.candidates.slice(0, 60).forEach((i) => { const z = res.lake.zones[i]; sc.cands.add(rectLine(z[0], z[1], z[2], z[3], '#9fe8e0', 0.35)); });
    this.pin.position.set(res.land.x, 0, -res.land.y);
    if (res.strand !== null) { const p = at(res.path, res.strand); this.strand.position.set(p.x, Y + 2, -p.y); }
    this.lab.land.anchor.set(res.land.x, Y, -res.land.y);
    this.lab.zoneD.anchor.set(Dz.x + Dz.w, Y, -(Dz.y - Dz.h * 0.15));
    this.lab.zoneU.anchor.set(Uz.x, Y, -(Uz.y - Uz.h));
    const wsum = res.winds.reduce((a, w) => [a[0] + w.vx * w.dt, a[1] + w.vy * w.dt], [0, 0]);
    this.windVec = new THREE.Vector2(wsum[0], wsum[1]).divideScalar(res.hours * 3600);
    this.playT0 = performance.now();
  }

  /** Called by the lab with a new scenario. */
  setUser(o) {
    this.user = this.compute(o);
    if (this.interactive) this.showScenario(this.user);
    return this.user;
  }
  replay() { this.playT0 = performance.now(); }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 48 : 32;
    this.camera.updateProjectionMatrix();
    this.portrait = w < h;
    this.w_ = w; this.h_ = h;
  }

  setProgress(p) { this.progress = p; }
  leave() { this.labels.hideAll(); }

  setSun(date) {
    const { el, az } = sun(date);
    const e = Math.max(el, -0.05);
    this.sunDir.set(Math.sin(az) * Math.cos(e), Math.sin(e), -Math.cos(az) * Math.cos(e)).normalize();
    const day = clamp01(el / 0.25);
    this.sunL.intensity = 0.3 + 2.4 * day;
    this.sunL.color.setHSL(0.09, 0.6 * (1 - day) + 0.15, 0.6 + 0.3 * day);
    this.hemi.intensity = 0.25 + 0.6 * day;
    this.sunL.position.copy(this.sunDir).multiplyScalar(5000).add(this.sunL.target.position);
    this.sky.material.uniforms.uSun.value.copy(this.sunDir);
    this.sky.material.uniforms.uDay.value = day;
    this.water.userData.uniforms.uSun.value.copy(this.sunDir);
    this.water.userData.uniforms.uDay.value = 0.4 + 0.6 * day;
  }

  update(dt, t) {
    const p = this.progress;
    const ph = (i) => clamp01(p * PANELS - i);
    const W = this.world;
    const U = this.water.userData.uniforms;
    U.uTime.value = t;
    W.streaks.material.uniforms.uTime.value = t;
    // Interactive once the last panel is reached.
    const inter = p > 0.8;
    if (inter !== this.interactive) {
      this.interactive = inter;
      if (inter && this.user) this.showScenario(this.user);
      else if (!inter && this.cur !== this.script) { this.setLake('montjoie'); this.showScenario(this.script); }
      document.body.classList.toggle('lab-on', inter);
    }
    const res = this.cur;

    // Panel 1: real tracks of 16 August, replayed with the scroll.
    const trk = smooth(0.05, 0.9, ph(0));
    const trkOn = this.lakeKey === 'montjoie' ? 1 - smooth(0.1, 0.5, ph(1)) : 0;
    W.tracks.forEach((T, i) => {
      T.mesh.material.uniforms.uDraw.value = trk;
      T.mesh.material.uniforms.uOpacity.value = trkOn * (p < 0.2 ? 1 : 0.5);
      T.mesh.visible = trkOn > 0.01;
      const m = this.markers[i];
      m.visible = trkOn > 0.01 && trk > 0.01;
      if (m.visible) {
        const d = T.data, tt = trk * d.duration;
        let k = 1; while (k < d.pts.length - 1 && d.pts[k][0] < tt) k++;
        const a = d.pts[k - 1], b = d.pts[k], f = clamp01((tt - a[0]) / Math.max(1, b[0] - a[0]));
        m.position.set(lerp(a[1], b[1], f), Y + 1, -lerp(a[2], b[2], f));
        m.scale.setScalar(trkOn);
        this.lab.t[i].anchor.copy(m.position);
      }
      this.labels.show(this.lab.t[i], m.visible && p < 0.17 && trk > 0.15);
    });
    // Wind streaks: the 16 August wind first (towards the east-south-east), then the scenario's.
    const realWind = new THREE.Vector2(5.4, -2.3);
    const wv = p < 0.2 ? realWind : this.windVec;
    W.streaks.material.uniforms.uWind.value.copy(wv);
    W.streaks.material.uniforms.uOpacity.value = 0.32 * (smooth(0.0, 0.3, ph(0)) * (1 - smooth(0.6, 1, ph(2))) + (inter ? 1 : 0) * 0.8 + smooth(0, 0.3, ph(3)) * 0.4);

    // Panel 2: the forecast integrated into a drift path from the origin, then zone U.
    const sc = this.sc;
    const pathDraw = inter ? 1 : smooth(0.2, 0.8, ph(1));
    sc.path.material.uniforms.uDraw.value = pathDraw;
    sc.path.material.uniforms.uOpacity.value = inter ? 1 : smooth(0.05, 0.2, ph(1));
    const showU = inter ? 1 : smooth(0.75, 0.95, ph(1));
    sc.zoneU.material.opacity = showU; sc.fillU.material.opacity = 0.08 * showU;
    // The forecast as a wind field that turns at each new vector, and the drift vectors it adds up.
    const tNow = pathDraw * res.hours * 3600;
    let kw = 0;
    while (kw < res.winds.length - 1 && tNow > res.path[kw + 1].t) kw++;
    const wa = res.winds[kw], wb = res.winds[Math.min(res.winds.length - 1, kw + 1)];
    const fw = smooth(-1800, 0, tNow - res.path[kw + 1].t);
    const ang = Math.atan2(lerp(wa.vy, wb.vy, fw), lerp(wa.vx, wb.vx, fw));
    const spd = lerp(Math.hypot(wa.vx, wa.vy), Math.hypot(wb.vx, wb.vy), fw);
    const fieldOn = inter ? 0 : smooth(0.0, 0.15, ph(1)) * (1 - smooth(0.0, 0.25, ph(2)));
    W.streaks.material.uniforms.uOpacity.value *= 1 - 0.85 * fieldOn;
    W.field.visible = fieldOn > 0.01;
    if (W.field.visible) {
      W.field.material.opacity = 0.4 * fieldOn;
      const q = new THREE.Quaternion().setFromAxisAngle(this.v.set(0, 1, 0), ang), sz = 70 + 22 * spd;
      const m = new THREE.Matrix4(), sc3 = this.v2.set(sz, 1, sz);
      W.field.userData.pts.forEach(([x, y], i) => {
        const wob = 0.06 * Math.sin(t * 1.3 + x * 0.01 + y * 0.013);
        m.compose(new THREE.Vector3(x, Y + 0.5, -y), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(this.v.set(0, 1, 0), wob)), sc3);
        W.field.setMatrixAt(i, m);
      });
      W.field.instanceMatrix.needsUpdate = true;
    }
    const vecOn = inter ? 0 : smooth(0.1, 0.2, ph(1)) * (1 - 0.5 * smooth(0.0, 0.3, ph(2)));
    sc.vecs.children.forEach((g, i) => {
      const a = res.path[i], b = res.path[i + 1];
      const g0 = clamp01((tNow - a.t) / Math.max(1, b.t - a.t));
      setArrow(g, a.x, a.y, lerp(a.x, b.x, g0), lerp(a.y, b.y, g0), 22, 95);
      g.userData.mat.opacity = vecOn * (g0 > 0 ? 1 : 0);
    });

    // Panel 3: the GEGI grid, every zone flickering, then the chosen zone D.
    const grid = inter ? 0.35 : smooth(0.0, 0.3, ph(2)) * (1 - smooth(0.3, 0.8, ph(3)));
    W.dots.material.opacity = grid * 0.9;
    const scan = ph(2);
    W.zones.children.forEach((l, i) => {
      const on = !inter && scan > 0.25 && scan < 0.95 ? (Math.sin(i * 12.9898 + t * 6) > 0.6 ? 0.45 : 0.06) * (1 - smooth(0.8, 0.95, scan)) : 0;
      l.material.opacity = on;
    });
    const showD = inter ? 1 : smooth(0.75, 0.95, ph(2));
    sc.zoneD.material.opacity = showD; sc.fillD.material.opacity = 0.16 * showD;
    sc.cands.visible = inter;
    // Panel 4 (and the lab): land at the pin and drift during the charge.
    let charge;
    if (inter) {
      const el = (performance.now() - this.playT0) / 1000;
      charge = clamp01((el - 1.2) / 8);
    } else charge = smooth(0.2, 0.95, ph(3));
    const landing = inter ? clamp01((performance.now() - this.playT0) / 1200) : smooth(0.0, 0.2, ph(3));
    const showPin = inter || ph(3) > 0.0 && p > 0.6;
    this.pin.visible = showPin;
    this.pinRing.scale.setScalar(1 + 0.15 * Math.sin(t * 4));
    const pos = at(res.path, charge * res.hours * 3600);
    let stranded = res.strand !== null && charge * res.hours * 3600 >= res.strand;
    const sp = stranded ? at(res.path, res.strand) : pos;
    this.drone.visible = showPin;
    if (this.drone.visible) {
      const alt = (1 - easeInOut(landing)) * 160;
      this.drone.position.set(sp.x, 0.6 + alt, -sp.y);
      const wdir = Math.atan2(-this.windVec.x, this.windVec.y); // nose into the wind
      this.drone.rotation.set(0, wdir + Math.PI, 0);
      if (landing < 1) this.drone.rotation.x = -0.25 * (1 - landing);
      if (landing >= 1 && !this.splashed) { U.uRipple.value.set(sp.x, -sp.y, t, 6); this.splashed = true; }
      if (landing < 0.5) this.splashed = false;
      this.halo.position.set(sp.x, Y + 1, -sp.y);
      this.halo.scale.setScalar(1 + 0.12 * Math.sin(t * 3));
    }
    this.halo.visible = this.drone.visible && landing > 0.95;
    this.strand.visible = stranded;
    this.setSun(res.startDate + charge * res.hours * 3600e3);
    this.onCharge?.(charge, res, stranded);

    // Camera: above the lake, tilted, framed per panel.
    const lake = W.lake;
    const c = W.center;
    let fx = c[0], fy = c[1], size = W.size * 0.62;
    const tk = lake.tracks[0];
    const focusTracks = this.lakeKey === 'montjoie' && tk ? [350, 420, 1500] : [c[0], c[1], W.size * 0.62];
    const pc = res.path.reduce((a, q) => [a[0] + q.x / res.path.length, a[1] + q.y / res.path.length], [0, 0]);
    const keys = [
      focusTracks,
      [pc[0], pc[1], Math.max(1300, res.zoneU.w * 2.2, res.zoneU.h * 2.2)],
      [c[0], c[1], W.size * 0.62],
      [pc[0], pc[1], Math.max(1500, res.zoneD.w * 1.6, res.zoneD.h * 1.6)],
      [c[0], c[1], W.size * 0.66],
    ];
    const x = Math.min(PANELS - 1, Math.max(0, p * PANELS - 0.5));
    const i0 = Math.floor(x), i1 = Math.min(PANELS - 1, i0 + 1), f = easeInOut(clamp01(x - i0));
    fx = lerp(keys[i0][0], keys[i1][0], f); fy = lerp(keys[i0][1], keys[i1][1], f); size = lerp(keys[i0][2], keys[i1][2], f);
    if (this.portrait) size *= 1.35;
    const tilt = 0.5 + Math.sin(t * 0.05) * 0.02;
    const yaw = 0.18 * Math.sin(p * 2.2);
    const dist = size / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    const target = new THREE.Vector3(fx, 0, -fy);
    this.camera.position.set(target.x + Math.sin(yaw) * Math.sin(tilt) * dist, Math.cos(tilt) * dist, target.z + Math.cos(yaw) * Math.sin(tilt) * dist);
    this.camera.lookAt(target);
    // Cards sit left / right; slide the frame so the map stays clear of them.
    const sides = [-1, 1, -1, 1, -1];
    if (this.portrait) this.camera.setViewOffset(this.w_, this.h_, 0, 0.2 * this.h_, this.w_, this.h_);
    else {
      const k = sides[i0] + (sides[i1] - sides[i0]) * smooth(0.3, 0.7, x - i0);
      this.camera.setViewOffset(this.w_, this.h_, k * 0.17 * this.w_, 0, this.w_, this.h_);
    }
    this.sunL.target.position.copy(target);

    const labOn = p > 0.62;
    this.labels.show(this.lab.land, labOn && landing > 0.9 && charge < 0.15);
    this.labels.show(this.lab.zoneD, p > 0.52 && p < 0.62 || (inter && charge > 0.98));
    this.labels.show(this.lab.zoneU, p > 0.33 && p < 0.42);
    this.labels.update(this.camera, innerWidth, innerHeight);
  }
}
