// Act II — the wing: cut from a foam blank with a hot wire (chord by chord), then the solar
// cells, the electronics stack (exploded, labelled) and the take-off pivot that tilts the motor.
import * as THREE from 'three';
import { studioEnvironment, layerReveal, frameOpposite, smooth, clamp01, lerp, easeInOut, QUALITY } from '../kit/fx.js';
import { t as tr } from '../kit/i18n.js';
import { buildWing, foamBlank, upper } from '../world/wing.js';

const PANELS = 4;

export class WingAct {
  constructor({ labels }) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.02, 200);
    this.look = { bloom: 0.55, bloomRadius: 0.5, threshold: 0.92, exposure: 0.95, fade: 0, vignette: 1 };
    this.progress = 0;
    this.labels = labels;
    this.onCut = null;
    const s = this.scene;
    s.background = new THREE.Color('#0a0e14');
    s.fog = new THREE.Fog('#0a0e14', 4, 12);
    // Workshop floor: a dark cutting mat with a faint grid.
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#16302a'; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(160,220,200,.16)'; g.lineWidth = 1;
    for (let i = 0; i <= 512; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
    g.strokeStyle = 'rgba(160,220,200,.32)';
    for (let i = 0; i <= 512; i += 160) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, 6); tex.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.06;
    floor.receiveShadow = true;
    s.add(floor);
    s.add(new THREE.HemisphereLight('#cfe1ff', '#0b0f19', 0.35));
    const key = new THREE.DirectionalLight('#ffe2c4', 2.2);
    key.position.set(1.4, 2.6, 1.2);
    key.castShadow = QUALITY.tier >= 1.5;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -1, right: 1, top: 1, bottom: -1, near: 0.5, far: 6 });
    key.shadow.bias = -0.0005;
    s.add(key);
    const rim = new THREE.DirectionalLight('#7fd8ff', 1.2);
    rim.position.set(-1.6, 0.8, -1.4);
    s.add(rim);

    const w = buildWing({ motor: true, pitot: true });
    this.w = w;
    this.root = new THREE.Group();
    this.root.add(w.group);
    s.add(this.root);
    // Hot-wire reveal on the foam (chord coordinate), and the blank that is consumed.
    layerReveal(w.parts.foamMat, { attr: 'aChord', band: 0.035, lines: false });
    this.blankMat = layerReveal(new THREE.MeshPhysicalMaterial({ color: '#4f9cc0', roughness: 0.8, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }), { attr: 'aChord', invert: true, band: 0.02, lines: false });
    this.blanks = [1, -1].map((side) => { const m = new THREE.Mesh(foamBlank(side), this.blankMat); m.renderOrder = 3; w.group.add(m); return m; });
    // The hot wire, one per half, running from the root profile to the tip profile.
    this.wires = [1, -1].map(() => {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(6, 2.2, 0.6), toneMapped: false }));
      w.group.add(l);
      return l;
    });
    this.glow = new THREE.PointLight('#ff8a3c', 0, 0.8, 2);
    w.group.add(this.glow);

    // Rest positions for the exploded view.
    this.rest = {};
    for (const k of ['lid', 'pixhawk', 'battery', 'gps', 'radio', 'arming', 'pitot', 'cellsL', 'cellsR', 'wingletL', 'wingletR', 'pivot']) {
      if (w.parts[k]) this.rest[k] = w.parts[k].position.clone();
    }
    const P = w.parts, A = (x, y, z) => new THREE.Vector3(x, y, z);
    this.lab = {
      cells: labels.add(tr('wing.label.cells'), A(0.3, 0.03, -0.02), { object: P.halfR, warm: true }),
      winglet: labels.add(tr('wing.label.winglet'), A(-0.5, 0.11, -0.3), { object: P.halfL, side: 'left' }),
      pixhawk: labels.add(tr('wing.label.pixhawk'), A(0.02, 0.0, 0.0), { object: P.pixhawk }),
      battery: labels.add(tr('wing.label.battery'), A(0.0, 0.0, -0.02), { object: P.battery, side: 'left' }),
      gps: labels.add(tr('wing.label.gps'), A(0.0, 0.0, 0.0), { object: P.gps }),
      radio: labels.add(tr('wing.label.radio'), A(0.01, 0, 0), { object: P.radio }),
      arming: labels.add(tr('wing.label.arming'), A(0, 0, 0), { object: P.arming, side: 'left' }),
      pitot: labels.add(tr('wing.label.pitot'), A(0, 0.09, 0.1), { object: P.pitot }),
      pivot: labels.add(tr('wing.label.pivot'), A(0, 0.0, 0.06), { object: P.pivot, warm: true }),
    };
    this.v = new THREE.Vector3();
  }

  init(renderer) {
    renderer.shadowMap.enabled = QUALITY.tier >= 1.5;
    this.scene.environment = studioEnvironment(renderer);
    this.scene.environmentIntensity = 0.5;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 52 : 30;
    this.camera.updateProjectionMatrix();
    this.w_ = w; this.h_ = h;
  }

  setProgress(p) { this.progress = p; }
  leave() { this.labels.hideAll(); }

  update(dt, t) {
    const p = this.progress, P = this.w.parts;
    const ph = (i) => clamp01(p * PANELS - i);
    // Panel 1: the hot wire travels from the leading edge to the trailing edge.
    const cut = smooth(0.05, 0.9, ph(0));
    const b = -0.12 + cut * 1.24;
    P.foamMat.userData.uPrint.value = b;
    P.foamMat.userData.uGlow.value = cut > 0 && cut < 1 ? 1 : 0;
    this.blankMat.userData.uPrint.value = b;
    this.blankMat.opacity = 0.22 * (1 - smooth(0.92, 1, cut));
    this.blanks.forEach((m) => { m.visible = cut < 1; });
    this.wires.forEach((l, k) => {
      const side = k ? -1 : 1, bb = Math.min(1, Math.max(0, b));
      const a = upper(0.02, bb, side), c = upper(1, bb, side);
      a.x *= 1.15; c.x = side * 0.56;
      a.y += 0.004; c.y += 0.004;
      l.geometry.attributes.position.setXYZ(0, a.x, a.y, a.z);
      l.geometry.attributes.position.setXYZ(1, c.x, c.y, c.z);
      l.geometry.attributes.position.needsUpdate = true;
      l.visible = cut > 0.001 && cut < 0.999;
      if (!k) this.glow.position.copy(a).lerp(c, 0.5);
    });
    this.glow.intensity = cut > 0.001 && cut < 0.999 ? 0.25 : 0;
    this.onCut?.(Math.round(cut * 100));
    // Cells, winglets, pod and motor appear once the foam is cut.
    const dress = smooth(0.85, 1, ph(0)) + smooth(0, 0.3, ph(1));
    const show = clamp01(dress);
    for (const k of ['cellsL', 'cellsR', 'wingletL', 'wingletR', 'pod', 'pivot']) if (P[k]) { P[k].visible = show > 0.02; P[k].scale.setScalar(k.startsWith('cells') ? 1 : lerp(0.6, 1, show)); }
    P.cellMat.opacity = show; P.cellMat.transparent = show < 1;
    P.pitot.visible = p > 0.5 && p < 0.78;
    // Panel 3: exploded view of the electronics.
    const ex = smooth(0.1, 0.6, ph(2)) * (1 - smooth(0.0, 0.4, ph(3)));
    const up = (k, dy, dz = 0, dx = 0) => { if (P[k]) P[k].position.copy(this.rest[k]).add(this.v.set(dx * ex, dy * ex, dz * ex)); };
    up('lid', 0.22); up('pixhawk', 0.15, 0.05); up('battery', 0.09, -0.08); up('gps', 0.19, -0.12); up('radio', 0.1, 0, 0.1); up('arming', 0.08, 0.02, -0.1);
    up('cellsL', 0.035); up('cellsR', 0.035); up('wingletL', 0.0, 0, -0.06); up('wingletR', 0.0, 0, 0.06);
    P.lid.material.opacity = 0.28 * (1 - ex * 0.6);
    // Panel 4: the motor pivots up and the prop pulls the wing to the vertical.
    const piv = smooth(0.05, 0.4, ph(3));
    const lift = smooth(0.35, 0.95, ph(3));
    if (P.pivot) P.pivot.rotation.x = -piv * Math.PI / 2;
    if (P.prop) P.prop.rotation.z = lift > 0 ? t * 70 : 0;
    this.root.rotation.x = -lift * Math.PI / 2 * 0.92;
    this.root.position.y = lift * 0.25 + Math.sin(t * 2) * 0.004 * lift;
    this.root.rotation.y = Math.sin(t * 0.25) * 0.08 * (1 - lift);

    // Camera: low three-quarter view around the wing, closer for the electronics.
    const az = lerp(0.95, -0.55, easeInOut(clamp01(p * 1.25))) + 0.45 * smooth(0.78, 0.95, p) + Math.sin(t * 0.2) * 0.03;
    const dist = lerp(1.9, 1.35, smooth(0.4, 0.62, p)) + 0.45 * smooth(0.78, 0.95, p);
    const hgt = lerp(0.85, 0.65, p) + 0.2 * ex - 0.25 * lift;
    this.camera.position.set(Math.sin(az) * dist, hgt, Math.cos(az) * dist);
    this.camera.lookAt(0, 0.05 + 0.32 * lift, -0.08 + 0.1 * lift);
    frameOpposite(this.camera, p, [-1, 1, -1, 1], this.w_, this.h_, 0.16);

    const L = this.lab;
    this.labels.show(L.cells, p > 0.3 && p < 0.48);
    this.labels.show(L.winglet, p > 0.32 && p < 0.48);
    for (const k of ['pixhawk', 'battery', 'gps', 'radio', 'arming', 'pitot']) this.labels.show(L[k], ex > 0.75);
    this.labels.show(L.pivot, p > 0.78 && piv > 0.3 && lift < 0.6);
    this.labels.update(this.camera, innerWidth, innerHeight);
  }
}
