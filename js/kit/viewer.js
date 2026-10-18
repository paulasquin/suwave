// Inline 3D viewer for the original parts: solid, X-ray and section modes.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadModel } from './models.js';
import { studioEnvironment } from './fx.js';
import { t } from './i18n.js';

const XRAY = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color('#6fd6ff') } },
  vertexShader: /* glsl */`
    varying vec3 vN; varying vec3 vV;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
    void main() {
      float f = pow(max(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0), 2.2);
      gl_FragColor = vec4(uColor * (0.06 + f * 1.1), 0.08 + f * 0.6);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});

function sectionMaterial(plane) {
  const m = new THREE.MeshPhysicalMaterial({ color: '#ddd4c2', roughness: 0.55, clearcoat: 0.15, side: THREE.DoubleSide, clippingPlanes: [plane] });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = vec3(1.0, 0.42, 0.2);');
  };
  return m;
}

export function createViewer(container, { models, label }) {
  container.classList.add('viewer');
  container.innerHTML = `
    <div class="viewer-modes"><div class="seg" role="radiogroup" aria-label="${t('viewer.modes')}">
      <button class="on" data-mode="solid">${t('viewer.solid')}</button><button data-mode="xray">${t('viewer.xray')}</button><button data-mode="cut">${t('viewer.cut')}</button>
    </div></div>
    <span class="viewer-hint">${t('viewer.hint')}</span>`;
  const canvas = document.createElement('canvas');
  container.prepend(canvas);
  canvas.setAttribute('aria-label', label);

  let renderer, scene, camera, controls, group, plane, mats, running = false, mode = 'solid', cutT = 0;
  const init = async () => {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.localClippingEnabled = true;
    scene = new THREE.Scene();
    scene.environment = studioEnvironment(renderer);
    scene.environmentIntensity = 0.45;
    camera = new THREE.PerspectiveCamera(30, 1, 1, 2000);
    scene.add(new THREE.HemisphereLight('#cfe0ff', '#10131c', 0.8));
    const key = new THREE.DirectionalLight('#ffffff', 1.7);
    key.position.set(1, 2, 1.4);
    scene.add(key);
    plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    mats = {
      solid: new THREE.MeshPhysicalMaterial({ color: '#ddd4c2', roughness: 0.55, clearcoat: 0.15, sheen: 0.3, sheenColor: new THREE.Color('#fff4e0') }),
      xray: XRAY,
      cut: sectionMaterial(plane),
    };
    group = new THREE.Group();
    const meshes = await Promise.all(models.map(({ name }) => loadModel(name)));
    let size = 0;
    meshes.forEach((m, i) => {
      m.position.y = models[i].y || 0;
      m.material = mats.solid;
      group.add(m);
      const bb = m.geometry.boundingBox;
      size = Math.max(size, bb.max.x - bb.min.x, bb.max.y + (models[i].y || 0));
    });
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    group.position.sub(center);
    scene.add(group);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(meshes[0].geometry, 35), new THREE.LineBasicMaterial({ color: '#9fe4ff', transparent: true, opacity: 0.0 }));
    edges.position.copy(meshes[0].position);
    group.add(edges);
    group.userData.edges = edges;
    camera.position.set(size * 2.0, size * 1.5, size * 2.6);
    controls = new OrbitControls(camera, canvas);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.6;
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    plane.constant = 0;
    resize();
    running = true;
    tick();
  };
  const resize = () => {
    if (!renderer) return;
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const setMode = (m) => {
    mode = m;
    container.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
    if (!group) return;
    group.children.forEach((c) => { if (c.isMesh) c.material = mats[m]; });
    group.userData.edges.material.opacity = m === 'xray' ? 0.55 : 0;
    cutT = 0;
  };
  const tick = () => {
    if (!running) return;
    requestAnimationFrame(tick);
    controls.update();
    if (mode === 'cut') {
      cutT += 0.008;
      const r = new THREE.Box3().setFromObject(group);
      plane.constant = THREE.MathUtils.lerp(r.max.x, 0, Math.min(1, cutT * 1.5)) + Math.sin(cutT * 1.2) * 0.0;
    }
    renderer.render(scene, camera);
  };
  container.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  addEventListener('resize', resize);

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        if (!renderer) init();
        else if (!running) { running = true; tick(); }
      } else running = false;
    });
  }, { rootMargin: '100px' });
  io.observe(container);
}
