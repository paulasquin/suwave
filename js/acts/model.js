// Example act — a real part: layer-by-layer 3D-printing reveal, slow turntable,
// labels on the model, camera framed opposite the text cards (one card per panel).
import * as THREE from 'three';
import { studioEnvironment, layerReveal, frameOpposite, smooth, clamp01, lerp, easeInOut, QUALITY } from '../kit/fx.js';
import { t as tr } from '../kit/i18n.js';

const MM = 0.1; // scene unit = 1 cm
const PANELS = 3; // must match the number of .panel in <section data-act="model">

export class ModelAct {
  constructor({ model, labels }) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
    this.look = { bloom: 0.5, bloomRadius: 0.4, threshold: 0.95, exposure: 0.9, fade: 0, vignette: 1 };
    this.progress = 0;
    this.labels = labels;
    this.onLayer = null; // callback(layer) for a DOM read-out

    const s = this.scene;
    s.background = new THREE.Color('#04060c');
    const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: '#0b1220', roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    s.add(new THREE.HemisphereLight('#bcd4ff', '#0b0f19', 0.3));
    const key = new THREE.DirectionalLight('#fff5ea', 1.7);
    key.position.set(18, 30, 22);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 5, far: 80 });
    s.add(key);
    const rim = new THREE.DirectionalLight('#7fc8ff', 1.1);
    rim.position.set(-20, 12, -18);
    s.add(rim);

    // The part, printed in ivory PLA.
    this.mat = layerReveal(new THREE.MeshPhysicalMaterial({ color: '#d8cfbc', roughness: 0.55, clearcoat: 0.15, side: THREE.DoubleSide }), { layer: 0.6 });
    model.material = this.mat;
    model.scale.setScalar(MM);
    model.castShadow = true;
    this.part = new THREE.Group();
    this.part.add(model);
    s.add(this.part);
    this.height = model.geometry.boundingBox.max.y; // millimetres

    this.lab = {
      flange: labels.add(tr('demo.label.flange'), new THREE.Vector3(30, 3, 0), { object: model }),
      throat: labels.add(tr('demo.label.throat'), new THREE.Vector3(11, 34, 0), { object: model }),
      bell: labels.add(tr('demo.label.bell'), new THREE.Vector3(-30, 74, 0), { object: model, side: 'left' }),
    };
    this.tmp = new THREE.Vector3();
  }

  init(renderer) {
    renderer.shadowMap.enabled = QUALITY.tier >= 1.5; // no real-time shadows on phones
    this.scene.environment = studioEnvironment(renderer);
    this.scene.environmentIntensity = 0.35;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 48 : 32;
    this.camera.updateProjectionMatrix();
    this.w = w; this.h = h;
  }

  setProgress(p) { this.progress = p; }
  leave() { this.labels.hideAll(); }

  update(dt, t) {
    const p = this.progress;
    const ph = (i) => clamp01(p * PANELS - i);
    // Panel 1: printing.
    const printT = smooth(0.05, 0.85, ph(0));
    this.mat.userData.uPrint.value = p < 1 / PANELS ? printT * this.height + 0.001 : 1e9;
    this.mat.userData.uGlow.value = p < 1 / PANELS && printT < 1 ? 1 : 0;
    this.onLayer?.(Math.round((printT * this.height) / 0.2));
    // Panels 2-3: turntable, faster in the last one.
    this.part.rotation.y -= dt * (0.25 + 0.6 * smooth(0, 1, ph(2)));

    const dist = lerp(34, 28, easeInOut(clamp01(p)));
    const az = 0.7 + p * 0.8;
    this.camera.position.set(Math.cos(az) * dist, 12 - p * 3, Math.sin(az) * dist);
    this.camera.lookAt(0, 4, 0);
    frameOpposite(this.camera, p, [-1, 1, -1], this.w, this.h, 0.16);

    const on = p > 0.4 && p < 0.95;
    Object.values(this.lab).forEach((l) => this.labels.show(l, on));
    this.labels.update(this.camera, innerWidth, innerHeight);
  }
}
