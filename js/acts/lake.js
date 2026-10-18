// Act I — golden hour on Lac Montjoie: the SUWAVE wing flies in, flares, lands on the water,
// turns into the wind and floats while its cells catch the low sun.
import * as THREE from 'three';
import { smooth, clamp01, lerp, easeInOut, QUALITY } from '../kit/fx.js';
import { t as tr } from '../kit/i18n.js';
import { createSky, createWater, createLand, toScene } from '../world/lakeworld.js';
import { buildWing } from '../world/wing.js';

// Sun low in the west-north-west (azimuth 285°, elevation 4.5°).
const AZ = THREE.MathUtils.degToRad(285), EL = THREE.MathUtils.degToRad(4.5);
export const GOLDEN_SUN = new THREE.Vector3(Math.sin(AZ) * Math.cos(EL), Math.sin(EL), -Math.cos(AZ) * Math.cos(EL)).normalize();

export class LakeAct {
  constructor({ lake, labels }) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40000);
    this.look = { bloom: 0.4, bloomRadius: 0.45, threshold: 1.3, exposure: 0.95, fade: 1, fadeColor: '#000000', vignette: 1 };
    this.progress = 0;
    this.labels = labels;
    const s = this.scene;
    s.fog = new THREE.FogExp2('#7d6560', 0.00014);

    this.sky = createSky(GOLDEN_SUN);
    s.add(this.sky);
    this.water = createWater(GOLDEN_SUN, { mirror: true });
    s.add(this.water);
    const land = createLand(lake, { trees: QUALITY.tier >= 1.5 ? 18000 : 7000, mirror: true, band: 340 });
    this.land = land;
    s.add(land.group, land.mirrorGroup);

    s.add(new THREE.HemisphereLight('#ffc7a0', '#2a3530', 0.55));
    const sunL = new THREE.DirectionalLight('#ffb27a', 3.2);
    sunL.position.copy(GOLDEN_SUN).multiplyScalar(500);
    s.add(sunL);
    const fill = new THREE.DirectionalLight('#8fb0ff', 0.35);
    fill.position.set(200, 300, 400);
    s.add(fill);

    // The landing point: open water in the east of the lake, looking west into the sun.
    this.L = toScene(250, 330, 0);
    const w = buildWing({ motor: true });
    this.wing = w;
    this.drone = w.group;
    s.add(this.drone);
    const wm = buildWing({ motor: true });
    this.droneM = wm.group;
    this.mirror = new THREE.Group();
    this.mirror.scale.y = -1;
    this.mirror.add(this.droneM);
    s.add(this.mirror);
    // The cells glint: a touch of emissive warmth when they face the sun.
    w.parts.cellMat.emissive = new THREE.Color('#ff9a50');
    w.parts.cellMat.emissiveIntensity = 0;

    const L = this.L;
    const P = (x, y, z) => new THREE.Vector3(L.x + x, y, L.z + z);
    // Approach: from the circling pattern ahead, a pass towards the camera, a turn and the flare.
    this.path = new THREE.CatmullRomCurve3([P(-35, 10, 12), P(-12, 8, 22), P(16, 5.5, 17), P(24, 3.6, 2), P(13, 1.8, -3.5), P(4, 0.7, -1), P(0, 0.12, 0)], false, 'centripetal', 0.5);
    // Camera keyframes over the act's progress: [p, position, target] (target null = follow the wing).
    this.keys = [
      [0.0, P(46, 2.0, 12), null],
      [0.18, P(34, 2.6, 24), null],
      [0.34, P(14, 1.5, 9), null],
      [0.45, P(3.6, 0.95, 2.4), P(0, 0.12, 0)],
      [0.62, P(1.9, 1.3, -1.9), P(0, 0.08, 0)],
      [0.8, P(-5, 5, -9), P(-24, 0, 4)],
      [1.0, P(-30, 110, -160), P(-420, 0, 160)],
    ];
    this.v = new THREE.Vector3(); this.v2 = new THREE.Vector3(); this.v3 = new THREE.Vector3();
    this.q = new THREE.Quaternion(); this.m = new THREE.Matrix4();
    this.landT = null;
    this.lab = {
      wing: labels.add(tr('lake.label.wing'), new THREE.Vector3(-0.42, 0.06, -0.2), { object: this.drone, side: 'left' }),
      cells: labels.add(tr('lake.label.cells'), new THREE.Vector3(0.32, 0.03, -0.02), { object: this.drone, warm: true }),
    };
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 58 : 38;
    this.camera.updateProjectionMatrix();
    this.portrait = w < h;
  }

  setProgress(p) { this.progress = p; }
  leave() { this.labels.hideAll(); }

  /** Drone pose for flight parameter s (0 → touchdown at 1) and time t. */
  flight(s, t) {
    const d = this.drone;
    // Before the approach: a slow circle high above the lake.
    const c = this.L.clone().add(new THREE.Vector3(-35, 10, -4));
    const ang = t * 0.35;
    const loop = new THREE.Vector3(c.x + Math.cos(ang) * 16, c.y + Math.sin(t * 0.5) * 1.0, c.z + Math.sin(ang) * 16);
    const loopT = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang));
    const k = smooth(0, 0.12, s);
    const u = clamp01(s);
    this.path.getPointAt(u, this.v);
    this.path.getTangentAt(Math.min(0.999, u), this.v2);
    d.position.copy(loop).lerp(this.v, k);
    const dir = loopT.lerp(this.v2, k).normalize();
    // Orientation: nose (+z) along the path, banked into the turns, flare before touchdown.
    const yaw = Math.atan2(dir.x, dir.z);
    const pitch = -Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) + smooth(0.86, 0.97, s) * -0.45 * (1 - smooth(0.985, 1, s));
    this.path.getTangentAt(Math.min(0.999, u + 0.02), this.v3);
    const turn = Math.atan2(this.v3.x, this.v3.z) - yaw;
    const bank = THREE.MathUtils.clamp(Math.atan2(Math.sin(turn), Math.cos(turn)) * 4, -0.7, 0.7) * k * (1 - smooth(0.85, 0.95, s)) + (1 - k) * 0.35;
    d.rotation.set(pitch, yaw, -bank, 'YXZ');
  }

  update(dt, t) {
    this.t0 ??= performance.now();
    const it = Math.min(1, (performance.now() - this.t0) / 3500);
    const p = this.progress;
    this.look.fade = Math.max(1 - smooth(0, 0.6, it), smooth(0.93, 1, p));
    this.look.fadeColor = '#000000';
    const U = this.water.userData.uniforms;
    U.uTime.value = t;
    this.sky.material.uniforms.uTime.value = t;

    const s = smooth(0.02, 0.42, p);
    const floatK = smooth(0.4, 0.44, p);
    if (s < 1) {
      this.flight(s, t);
      if (this.landT !== null && s < 0.98) this.landT = null;
    } else {
      // On the water: bobbing, turning into the wind (the winglets weathervane it), slow drift.
      if (this.landT === null) { this.landT = t; U.uRipple.value.set(this.L.x, this.L.z, t, 1); }
      const since = t - this.landT;
      const drift = smooth(0.62, 1, p) * 6;
      const d = this.drone;
      d.position.set(this.L.x - drift, 0.03 + Math.sin(t * 1.3) * 0.012, this.L.z + drift * 0.25);
      const yaw0 = -0.45, yawWind = Math.PI / 2 * 1.0; // nose to the east: into a westward wind
      const yaw = lerp(yaw0, yawWind, smooth(0.45, 0.62, p));
      d.rotation.set(Math.sin(t * 1.1) * 0.02 - 0.02 * Math.exp(-since * 2), yaw, Math.sin(t * 0.9 + 1) * 0.025, 'YXZ');
      if (since < 0.05) U.uRipple.value.z = t;
    }
    this.droneM.position.copy(this.drone.position);
    this.droneM.rotation.copy(this.drone.rotation);
    if (this.wing.parts.prop) {
      const spin = s < 0.96 ? t * 90 : 0;
      this.wing.parts.prop.rotation.z = spin;
    }
    // Cells catch the sun once the wing sits on the water.
    this.wing.parts.cellMat.emissiveIntensity = 0.25 * floatK * (0.7 + 0.3 * Math.sin(t * 2.2));

    // Camera: keyframes, eased per segment; early on the target follows the wing.
    const K = this.keys;
    let i = 0;
    while (i < K.length - 2 && p > K[i + 1][0]) i++;
    const f = easeInOut(clamp01((p - K[i][0]) / (K[i + 1][0] - K[i][0])));
    this.v.copy(K[i][1]).lerp(K[i + 1][1], f);
    const tg = (k) => (k[2] ? k[2] : this.drone.position);
    this.v2.copy(tg(K[i])).lerp(tg(K[i + 1]), f);
    if (this.portrait) this.v.lerp(this.drone.position, 0.25 * smooth(0.4, 0.5, p) * (1 - smooth(0.7, 0.85, p)));
    this.camera.position.copy(this.v);
    this.camera.lookAt(this.v2);
    // Portrait: cards sit at the bottom, so lift the floating wing into the upper part of the frame.
    if (this.portrait) {
      const k = smooth(0.36, 0.46, p) * (1 - smooth(0.74, 0.86, p));
      this.camera.setViewOffset(innerWidth, innerHeight, 0, 0.18 * innerHeight * k, innerWidth, innerHeight);
    } else this.camera.clearViewOffset();

    const near = p > 0.47 && p < 0.72;
    this.labels.show(this.lab.wing, near);
    this.labels.show(this.lab.cells, near && p > 0.52);
    this.labels.update(this.camera, innerWidth, innerHeight);
  }
}
