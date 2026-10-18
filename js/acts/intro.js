// Example act — hero: starfield, the demo nozzle ignites, the camera follows a
// scroll-driven path and dives into the plume (white flash into the next act).
//
// The act contract (see README): { scene, camera, look, init(renderer)?, resize(w, h),
// setProgress(p 0-1), update(dt, t), enter()?, leave()? }.
import * as THREE from 'three';
import { createStars, createPlume, spaceEnvironment, smooth, clamp01, easeInOut } from '../kit/fx.js';
import { t as tr } from '../kit/i18n.js';

export class IntroAct {
  constructor({ model, labels }) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.05, 2000);
    // Post-processing knobs read by the stage each frame.
    this.look = { bloom: 0.8, bloomRadius: 0.45, threshold: 0.82, exposure: 1, fade: 1, fadeColor: '#000000', vignette: 1 };
    this.progress = 0;
    this.labels = labels;

    const s = this.scene;
    s.background = new THREE.Color('#000000');
    this.stars = createStars(5000, 600);
    s.add(this.stars);
    s.add(new THREE.HemisphereLight('#8fb4ff', '#0a0f1c', 0.4));
    const key = new THREE.DirectionalLight('#fff3e2', 2.4);
    key.position.set(-4, 3, 5);
    s.add(key);
    const rim = new THREE.DirectionalLight('#6fd6ff', 1.6);
    rim.position.set(5, 1, -4);
    s.add(rim);

    // The nozzle (millimetres -> scene units), exit pointing along -X.
    this.engine = new THREE.Group();
    model.material = new THREE.MeshStandardMaterial({ color: '#b9bec8', metalness: 1, roughness: 0.3 });
    model.scale.setScalar(0.02);
    model.rotation.z = Math.PI / 2;
    this.engine.add(model);
    this.engine.position.set(1.1, 0.2, 0);
    s.add(this.engine);
    this.plume = createPlume({ length: 9, radius: 0.6, spread: 0.16, count: 2400, speed: 0.5, size: 14, intensity: 0, glow: 0.3 });
    this.plume.position.set(-1.6, 0, 0);
    this.plume.rotation.y = -Math.PI / 2; // emit along -X
    this.engine.add(this.plume);

    this.camPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.6, 0.9, 7.5), new THREE.Vector3(-2.6, 0.6, 4.6), new THREE.Vector3(-3.6, 0.2, 1.4), new THREE.Vector3(-1.2, 0.05, 0.2),
    ]);
    this.lookPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0.2, 0.1, 0), new THREE.Vector3(0.6, 0.15, 0), new THREE.Vector3(0.8, 0.2, 0),
    ]);
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
    this.lab = { exit: labels.add(tr('demo.label.exit'), new THREE.Vector3(-1.6, 0.6, 0), { object: this.engine }) };
  }

  init(renderer) {
    this.scene.environment = spaceEnvironment(renderer);
    this.scene.environmentIntensity = 0.8;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 50 : 36;
    this.camera.updateProjectionMatrix();
  }

  setProgress(p) { this.progress = p; }
  leave() { this.labels.hideAll(); }

  update(dt, t) {
    // Wall-clock intro (not accumulated dt), so slow devices do not stretch it.
    this.t0 ??= performance.now();
    const it = Math.min(1, (performance.now() - this.t0) / 5000);
    const p = this.progress;
    const fadeIn = 1 - smooth(0, 0.3, it);
    const fadeOut = smooth(0.92, 1, p);
    this.look.fade = Math.max(fadeIn, fadeOut);
    this.look.fadeColor = fadeOut > fadeIn ? '#cfefff' : '#000000';

    const ign = smooth(0.35, 0.6, it);
    const flicker = ign < 1 ? (Math.sin(t * 60) > 0.2 ? 1 : 0.35) : 1;
    this.plume.userData.setIntensity(ign * flicker * (1.6 + 0.1 * Math.sin(t * 13)));
    this.plume.userData.update(t);
    this.engine.rotation.x = Math.sin(t * 0.3) * 0.06;
    this.engine.rotation.y = Math.sin(t * 0.21) * 0.08;
    this.stars.userData.update(t);

    const cp = easeInOut(clamp01(p));
    this.camPath.getPoint(cp, this.tmp);
    this.tmp.z += (1 - easeInOut(smooth(0, 0.5, it))) * 3;
    this.camera.position.copy(this.tmp);
    this.lookPath.getPoint(cp, this.tmp2);
    this.camera.lookAt(this.tmp2);

    this.labels.show(this.lab.exit, p > 0.3 && p < 0.7);
    this.labels.update(this.camera, innerWidth, innerHeight);
  }
}
