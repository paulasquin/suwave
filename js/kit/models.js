// Loads and caches the GLB models converted from the original STL files.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();

/** Dequantize (KHR_mesh_quantization) and bake the node transform into plain floats. */
function bake(geo, matrix) {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) {
    const a = geo.getAttribute(name);
    if (!a) continue;
    const f = new Float32Array(a.count * 3);
    for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); }
    out.setAttribute(name, new THREE.BufferAttribute(f, 3));
  }
  out.setIndex(geo.index);
  out.applyMatrix4(matrix);
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/** Resolves with the first mesh of assets/models/<name>.glb (geometry shared). */
export function loadModel(name, manager) {
  if (!cache.has(name)) {
    const l = manager ? new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder) : loader;
    cache.set(name, new Promise((resolve, reject) => {
      l.load(`assets/models/${name}.glb`, (gltf) => {
        let mesh = null;
        gltf.scene.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
        gltf.scene.updateMatrixWorld(true);
        resolve(new THREE.Mesh(bake(mesh.geometry, mesh.matrixWorld), mesh.material));
      }, undefined, reject);
    }));
  }
  return cache.get(name).then((m) => new THREE.Mesh(m.geometry, m.material));
}
