// Act IV — the anchor deployment mechanism of August 2017, from the original parts: the printed
// sabot (slide) and pins (STL), the laser-cut arms and stumps (DXF). Printed and cut on the
// build plate, assembled, then a worm screw driven by a servo spreads the two top pins and the
// scissor (lazy tongs) extends, as in 30 seconds on the real prototype.
import * as THREE from 'three';
import { studioEnvironment, layerReveal, frameOpposite, smooth, clamp01, lerp, easeInOut, QUALITY } from '../kit/fx.js';
import { t as tr } from '../kit/i18n.js';

const PANELS = 3;
const L = 40;          // half length of an arm, hole to hole (mm): Bras holes at -40, 0, +40
const STAGES = 3;
const ZA = 22, ZB = 25.5; // the two arm planes on each side (mm)

export class AnchorAct {
  constructor({ parts, labels }) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
    this.look = { bloom: 0.45, bloomRadius: 0.5, threshold: 0.95, exposure: 1.25, fade: 0, vignette: 1 };
    this.progress = 0;
    this.labels = labels;
    this.onTime = null;
    const s = this.scene;
    s.background = new THREE.Color('#080b12');
    s.fog = new THREE.Fog('#080b12', 0.8, 3);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.MeshStandardMaterial({ color: '#10151f', roughness: 0.6, metalness: 0.2 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    // The build plate (MarkForged) under the printed parts.
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.004, 0.2), new THREE.MeshStandardMaterial({ color: '#2a2f38', roughness: 0.35, metalness: 0.7 }));
    plate.position.set(0, 0.002, 0);
    plate.receiveShadow = true;
    s.add(plate);
    this.plate = plate;
    s.add(new THREE.HemisphereLight('#cfdcff', '#0a0d14', 0.35));
    const key = new THREE.DirectionalLight('#ffe6cc', 2.4);
    key.position.set(0.6, 1.2, 0.8);
    key.castShadow = QUALITY.tier >= 1.5;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -0.4, right: 0.4, top: 0.4, bottom: -0.4, near: 0.2, far: 3 });
    key.shadow.bias = -0.0004;
    s.add(key);
    const rim = new THREE.DirectionalLight('#67d8d0', 1.3);
    rim.position.set(-0.8, 0.5, -0.6);
    s.add(rim);

    // Materials: Onyx (carbon-filled nylon, dark matte grey) and laser-cut black acrylic.
    this.onyx = layerReveal(new THREE.MeshPhysicalMaterial({ color: '#4a4f57', roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color('#8a93a0'), clearcoat: 0.05 }), { layer: 0.1, band: 1.2 });
    this.cutMat = layerReveal(new THREE.MeshPhysicalMaterial({ color: '#24262b', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 }), { axis: 'x', band: 3, lines: false });
    const steel = new THREE.MeshStandardMaterial({ color: '#c6ccd4', metalness: 1, roughness: 0.28 });

    this.root = new THREE.Group();
    this.root.scale.setScalar(0.001); // millimetres → metres
    s.add(this.root);
    this.items = [];
    const add = (mesh, mat, flat) => {
      const m = new THREE.Mesh(mesh.geometry, mat);
      m.castShadow = m.receiveShadow = true;
      this.root.add(m);
      const it = { m, flat, asm: { p: new THREE.Vector3(), q: new THREE.Quaternion() } };
      this.items.push(it);
      return it;
    };
    const qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const qPinFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    // Sabot: printed upright on the plate, left side.
    this.sabot = add(parts.sabot, this.onyx, { p: new THREE.Vector3(-95, 4, 0), q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2) });
    // Arms (12) and stumps (4): cut flat in two columns on the right.
    this.arms = [];
    for (let i = 0; i < STAGES * 4; i++) this.arms.push(add(parts.bras, this.cutMat, { p: new THREE.Vector3(40 + (i % 2) * 96, 6, -80 + Math.floor(i / 2) * 11), q: qFlat.clone() }));
    this.stumps = [];
    for (let i = 0; i < 4; i++) this.stumps.push(add(parts.moignon, this.cutMat, { p: new THREE.Vector3(30 + (i % 2) * 56, 6, -6 + Math.floor(i / 2) * 11 + 70), q: qFlat.clone() }));
    // Pins: printed lying down in a row.
    this.pins = [];
    const NP = 2 + 2 * (STAGES - 1) + 2 + STAGES + 1;
    for (let i = 0; i < NP; i++) {
      const motor = i < 2;
      this.pins.push(add(motor ? parts['axe-moteur'] : parts['axe-extreme'], this.onyx, { p: new THREE.Vector3(-40 + (i % 6) * 13, 4, -70 + Math.floor(i / 6) * 70 + 40), q: qPinFlat.clone() }));
    }
    // Worm screw and servo (not in the STL files: drawn simply).
    const screw = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 100, 16), steel);
    rod.rotation.z = Math.PI / 2;
    screw.add(rod);
    const servo = new THREE.Mesh(new THREE.BoxGeometry(40, 20, 38), new THREE.MeshStandardMaterial({ color: '#1d4fa0', roughness: 0.5 }));
    servo.position.set(-72, 4, 0);
    screw.add(servo);
    screw.position.set(0, 20, 0);
    this.root.add(screw);
    this.screw = screw;
    this.rod = rod;
    screw.traverse((o) => { if (o.isMesh) o.castShadow = true; });

    this.lab = {
      sabot: labels.add(tr('anchor.label.sabot'), new THREE.Vector3(40, 28, 0), { object: this.sabot.m }),
      servo: labels.add(tr('anchor.label.servo'), new THREE.Vector3(-72, 14, 0), { object: screw, side: 'left', warm: true }),
      screw: labels.add(tr('anchor.label.screw'), new THREE.Vector3(30, 0, 0), { object: screw, warm: true }),
      arms: labels.add(tr('anchor.label.arms'), new THREE.Vector3(0, 0, 0), { object: this.arms[4].m }),
      pin: labels.add(tr('anchor.label.pin'), new THREE.Vector3(0, 0, 0), { object: this.pins[0].m, side: 'left' }),
    };
    this.tq = new THREE.Quaternion(); this.tv = new THREE.Vector3();
  }

  init(renderer) {
    this.scene.environment = studioEnvironment(renderer);
    this.scene.environmentIntensity = 0.9;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 50 : 30;
    this.camera.updateProjectionMatrix();
    this.w_ = w; this.h_ = h;
  }

  setProgress(p) { this.progress = p; }
  leave() { this.labels.hideAll(); }

  /** Assembled pose of every part for the scissor angle th (rad from horizontal). */
  pose(th) {
    const lc = L * Math.cos(th), hs = L * Math.sin(th);
    const top = -12;              // y of the top pins (mm), under the sabot
    const zq = (angle) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
    let a = 0, pi = 0;
    const setArm = (x0, y0, x1, y1, z) => {
      for (const sz of [1, -1]) {
        const it = this.arms[a++];
        it.asm.p.set((x0 + x1) / 2, (y0 + y1) / 2, sz * z);
        it.asm.q.copy(zq(Math.atan2(y1 - y0, x1 - x0)));
      }
    };
    const setPin = (x, y) => { const it = this.pins[pi++]; it.asm.p.set(x, y, 0); it.asm.q.identity(); };
    setPin(lc, top); setPin(-lc, top); // the two top pins: the right one rides on the worm screw's nut
    for (let i = 0; i < STAGES; i++) {
      const y0 = top - i * 2 * hs, y1 = y0 - 2 * hs;
      setArm(-lc, y0, lc, y1, ZA);
      setArm(lc, y0, -lc, y1, ZB);
      setPin(0, y0 - hs); // crossing
      if (i < STAGES - 1) { setPin(lc, y1); setPin(-lc, y1); }
    }
    const yb = top - STAGES * 2 * hs;
    setPin(lc, yb); setPin(-lc, yb);
    // Stumps close the scissor on a single point, where the anchor hangs.
    const drop = Math.sqrt(Math.max(1, L * L - lc * lc)); // stumps are 40 mm hole to hole
    const apex = yb - drop;
    let k = 0;
    for (const [x0] of [[lc], [-lc]]) for (const sz of [1, -1]) {
      const it = this.stumps[k++];
      it.asm.p.set(x0 / 2, (yb + apex) / 2, sz * (ZB + 3.5));
      it.asm.q.copy(zq(Math.atan2(apex - yb, -x0)));
    }
    setPin(0, apex);
    this.sabot.asm.p.set(0, top + 4, 0);
    this.sabot.asm.q.identity();
    this.apexY = apex; this.lc = lc;
  }

  update(dt, t) {
    const p = this.progress;
    const ph = (i) => clamp01(p * PANELS - i);
    // Panel 1: print (pins, sabot) and laser cut (arms) on the plate.
    const pr = smooth(0.05, 0.85, ph(0));
    this.onyx.userData.uPrint.value = p < 1 / PANELS ? lerp(-1, 45, pr) : 1e9;
    this.onyx.userData.uGlow.value = pr > 0 && pr < 1 ? 1 : 0;
    this.cutMat.userData.uPrint.value = p < 1 / PANELS ? lerp(-46, 46, smooth(0.25, 0.95, ph(0))) : 1e9;
    this.cutMat.userData.uGlow.value = p < 1 / PANELS && ph(0) < 0.95 ? 1 : 0;
    // Panel 2: parts fly to the assembled, folded mechanism. Panel 3: deploy.
    const asm = smooth(0.05, 0.85, ph(1));
    const deploy = smooth(0.08, 0.8, ph(2));
    const th = lerp(0.14, 1.05, deploy);
    this.pose(th);
    const lift = 0.13 + 0.17 * smooth(0, 1, ph(2)); // assembled mechanism floats above the plate
    this.items.forEach((it, i) => {
      const k = smooth(0.0, 1.0, clamp01(asm * 1.4 - (i % 7) * 0.05));
      const ap = this.tv.copy(it.asm.p).add(new THREE.Vector3(0, lift * 1000, 0));
      it.m.position.copy(it.flat.p).lerp(ap, easeInOut(k));
      it.m.position.y += Math.sin(k * Math.PI) * 30;
      it.m.quaternion.copy(it.flat.q).slerp(it.asm.q, easeInOut(k));
    });
    // Screw and servo appear with the assembly, sitting on the sabot; the rod spins while deploying.
    this.screw.visible = asm > 0.6;
    this.screw.position.set(0, lift * 1000 + 10, -8);
    this.screw.scale.setScalar(smooth(0.6, 0.9, asm));
    const spinning = deploy > 0.001 && deploy < 0.999;
    this.rod.rotation.x += spinning ? dt * 25 : 0;
    this.plate.visible = asm < 0.98;
    this.onTime?.(tr('anchor.cmd'), `${Math.round(deploy * 30)} s`);

    // Camera.
    const az = lerp(0.6, -0.5, easeInOut(p)) + Math.sin(t * 0.15) * 0.04;
    const dist = lerp(0.62, 0.45, smooth(0.3, 0.6, p)) + 0.28 * deploy;
    const ty = lerp(0.02, 0.24, smooth(0.3, 0.7, p)) - 0.15 * deploy;
    const hy = lerp(0.42, 0.28, smooth(0.25, 0.6, p));
    this.camera.position.set(Math.sin(az) * dist, ty + hy, Math.cos(az) * dist);
    this.camera.lookAt(0, ty, 0);
    frameOpposite(this.camera, p, [-1, 1, -1], this.w_, this.h_, 0.15);

    const on = p > 0.72;
    for (const k of ['sabot', 'servo', 'screw', 'arms', 'pin']) this.labels.show(this.lab[k], on && deploy > 0.25);
    this.labels.update(this.camera, innerWidth, innerHeight);
  }
}
