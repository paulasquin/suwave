// The SUWAVE flying wing, modelled procedurally from the team's drawings (span 1000 mm,
// root chord 320 mm, tip chord 160 mm, flat-plate winglets 120 mm, ~700 g) and photos:
// foam wing, solar cells on the upper surface, clear electronics pod, motor on a pivot
// with a folding 11×6 propeller. The drift prototypes had no motor and carried a Pitot tube.
//
// Frame: metres, x to the right wing tip, y up, z forward (nose at z = 0.16).
import * as THREE from 'three';

export const SPAN = 1.0, ROOT = 0.32, TIP = 0.16, SWEEP = 0.32, NOSE = 0.16;

// NACA 4-digit style section with a little camber (the wing uses a NACA M3, ~12 % thick).
function section(n = 22) {
  const m = 0.02, p = 0.3, t = 0.12;
  const up = [], lo = [];
  for (let i = 0; i <= n; i++) {
    const b = (1 - Math.cos((i / n) * Math.PI)) / 2; // cosine spacing
    const yt = 5 * t * (0.2969 * Math.sqrt(b) - 0.126 * b - 0.3516 * b * b + 0.2843 * b ** 3 - 0.1036 * b ** 4);
    const yc = b < p ? (m / (p * p)) * (2 * p * b - b * b) : (m / ((1 - p) ** 2)) * (1 - 2 * p + 2 * p * b - b * b);
    up.push([b, yc + yt]);
    lo.push([b, yc - yt]);
  }
  return { up, lo };
}
const SEC = section();

/** Chord, leading-edge z and thickness scale at a span position s in [0, 1] (0 = root). */
export function planform(s) {
  // Rounded centre section (the pod fairing), then straight swept edges.
  const chord = ROOT + (TIP - ROOT) * s;
  const le = NOSE - SWEEP * s - 0.04 * Math.exp(-s * 18);
  return { chord, le };
}

/** Point on the upper surface: s span fraction, b chord fraction (0 = leading edge). */
export function upper(s, b, side = 1) {
  const { chord, le } = planform(s);
  // Interpolate the section's upper curve.
  const U = SEC.up;
  let k = 1;
  while (k < U.length - 1 && U[k][0] < b) k++;
  const f = (b - U[k - 1][0]) / Math.max(1e-6, U[k][0] - U[k - 1][0]);
  const yy = U[k - 1][1] + (U[k][1] - U[k - 1][1]) * f;
  return new THREE.Vector3(side * s * SPAN / 2, yy * chord + dihedral(s), le - b * chord);
}
const dihedral = (s) => s * 0.012;

function wingHalf(side) {
  const ns = 26, nc = SEC.up.length;
  const pos = [], idx = [], chordF = [];
  // Ring per span station: upper surface from TE to LE, then lower from LE to TE.
  for (let i = 0; i <= ns; i++) {
    const s = i / ns;
    const { chord, le } = planform(s);
    const ring = [...SEC.up.slice().reverse(), ...SEC.lo.slice(1)];
    for (const [b, y] of ring) { pos.push(side * s * SPAN / 2, y * chord + dihedral(s), le - b * chord); chordF.push(b); }
  }
  const rl = nc * 2 - 1;
  for (let i = 0; i < ns; i++) for (let j = 0; j < rl - 1; j++) {
    const a = i * rl + j, b = a + rl;
    if (side > 0) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  // Close the tip.
  const base = ns * rl;
  for (let j = 1; j < nc - 1; j++) {
    const u = base + j, l = base + rl - 1 - j, u2 = base + j + 1, l2 = base + rl - 2 - j;
    if (side > 0) idx.push(u, l, u2, u2, l, l2); else idx.push(u, u2, l, u2, l2, l);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aChord', new THREE.Float32BufferAttribute(chordF, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The foam blank around a wing half: its planform extruded, with the same chord coordinate. */
export function foamBlank(side) {
  const pos = [], ch = [], idx = [];
  const ns = 8, y0 = -0.03, y1 = 0.05;
  for (let i = 0; i <= ns; i++) {
    const s = i / ns, { chord, le } = planform(s);
    const x = side * s * SPAN / 2;
    const ext = 0.03;
    for (const [b, y] of [[-ext / chord, y1], [1 + ext / chord, y1], [1 + ext / chord, y0], [-ext / chord, y0]]) { pos.push(x, y, le - b * chord); ch.push(b); }
  }
  for (let i = 0; i < ns; i++) for (let j = 0; j < 4; j++) {
    const a = i * 4 + j, b = i * 4 + ((j + 1) % 4), c = a + 4, d = b + 4;
    if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  [0, ns * 4].forEach((o, k) => { const f = (k === 0) === (side > 0); if (f) idx.push(o, o + 1, o + 2, o, o + 2, o + 3); else idx.push(o, o + 2, o + 1, o, o + 3, o + 2); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aChord', new THREE.Float32BufferAttribute(ch, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function cellTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#d9dde4';
  g.fillRect(0, 0, 256, 256);
  const grad = g.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#1b2350'); grad.addColorStop(0.5, '#2a3576'); grad.addColorStop(1, '#161c40');
  g.fillStyle = grad;
  g.fillRect(8, 8, 240, 240);
  g.strokeStyle = 'rgba(200,210,230,.55)'; g.lineWidth = 1;
  for (let i = 1; i < 18; i++) { g.beginPath(); g.moveTo(10, 8 + i * 13.3); g.lineTo(246, 8 + i * 13.3); g.stroke(); }
  g.lineWidth = 3; g.strokeStyle = 'rgba(225,230,240,.85)';
  [88, 168].forEach((x) => { g.beginPath(); g.moveTo(x, 10); g.lineTo(x, 246); g.stroke(); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Solar cells laid on the upper surface, as one geometry per wing half. */
function cells(side) {
  const pos = [], uv = [], idx = [];
  const size = 0.052, gap = 0.006;
  let n = 0;
  // Rows follow the leading edge, two to four rows deep, as on the 2017 prototype.
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 9; c++) {
      const s0 = 0.17 + c * 0.085, s1 = s0 + 0.075;
      if (s1 > 0.96) continue;
      const b0 = 0.13 + r * 0.19, b1 = b0 + 0.17;
      if (r === 3 && c > 5) continue;
      if (b1 > 0.86) continue;
      const corners = [[s0, b0], [s1, b0], [s1, b1], [s0, b1]];
      // 3×3 subdivision so the cell follows the surface curvature.
      const base = pos.length / 3;
      for (let i = 0; i <= 2; i++) for (let j = 0; j <= 2; j++) {
        const s = s0 + ((s1 - s0) * i) / 2, b = b0 + ((b1 - b0) * j) / 2;
        const p = upper(s, b, side);
        p.y += 0.0012;
        pos.push(p.x, p.y, p.z);
        uv.push(i / 2, j / 2);
      }
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const a = base + i * 3 + j, b = a + 3;
        if (side > 0) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
      n++;
      void corners; void size; void gap;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData.count = n;
  return g;
}

function winglet(side) {
  // Flat plate: 160 mm at the root (the tip chord), 60 mm at the top, 120 mm high, swept.
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.lineTo(-TIP, 0); sh.lineTo(-TIP - 0.0, 0.12); sh.lineTo(-TIP + 0.06, 0.12); sh.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  // Shape x (chord) now runs along -z… place the root at the tip leading edge.
  const { le } = planform(1);
  g.translate(side * SPAN / 2 - 0.002, dihedral(1) + 0.004, le);
  // Sweep: leading edge leaning back.
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) - dihedral(1) - 0.004;
    p.setZ(i, p.getZ(i) - y * 0.5);
  }
  g.computeVertexNormals();
  return g;
}

function prop(blade = 0.14) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#15171c', roughness: 0.45, metalness: 0.1 });
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.008); sh.quadraticCurveTo(blade * 0.45, -0.016, blade, -0.004); sh.lineTo(blade, 0.004); sh.quadraticCurveTo(blade * 0.4, 0.012, 0, 0.008);
  const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: false });
  bg.translate(0.012, 0, -0.0015);
  for (const a of [0, Math.PI]) {
    const b = new THREE.Mesh(bg, mat);
    b.rotation.z = a;
    b.rotation.x = 0.25 * (a ? -1 : 1);
    g.add(b);
  }
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.04, 20), new THREE.MeshStandardMaterial({ color: '#d6d8dc', metalness: 1, roughness: 0.25 }));
  spinner.rotation.x = Math.PI / 2;
  spinner.position.z = 0.02;
  g.add(spinner);
  return g;
}

/**
 * Build the wing. opts: { motor, pitot, cellsOn, foam } → { group, parts, anchors }.
 * parts are named so acts can explode or animate them.
 */
export function buildWing({ motor = true, pitot = false, cellsOn = true, foam = '#eef2f4' } = {}) {
  const group = new THREE.Group();
  const parts = {};
  const foamMat = new THREE.MeshPhysicalMaterial({ color: foam, roughness: 0.78, sheen: 0.4, sheenColor: new THREE.Color('#cfe6ff'), side: THREE.DoubleSide });
  parts.foamMat = foamMat;
  for (const side of [1, -1]) {
    const key = side > 0 ? 'R' : 'L';
    const half = new THREE.Group();
    const m = new THREE.Mesh(wingHalf(side), foamMat);
    m.castShadow = m.receiveShadow = true;
    half.add(m);
    parts[`foam${key}`] = m;
    parts[`half${key}`] = half;
    group.add(half);
    if (cellsOn) {
      parts.cellMat ??= new THREE.MeshPhysicalMaterial({ map: cellTexture(), roughness: 0.18, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, emissive: '#000000', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const c = new THREE.Mesh(cells(side), parts.cellMat);
      parts[`cells${key}`] = c;
      half.add(c);
    }
    const wl = new THREE.Mesh(winglet(side), new THREE.MeshStandardMaterial({ color: '#5d6670', roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide }));
    wl.castShadow = true;
    parts[`winglet${key}`] = wl;
    half.add(wl);
    // Elevon hinge line (a dark groove near the trailing edge).
    const pts = [];
    for (let i = 0; i <= 10; i++) { const s = 0.12 + i * 0.085; pts.push(upper(s, 0.8, side).add(new THREE.Vector3(0, 0.0012, 0))); }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#8a96a3' }));
    half.add(line);
  }
  // Electronics pod: clear lid over the stack (as in the photos and the 3D model).
  const pod = new THREE.Group();
  const lid = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.12, 6, 14), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.08, transmission: 0.0, transparent: true, opacity: 0.28, metalness: 0, clearcoat: 1, depthWrite: false }));
  lid.rotation.x = Math.PI / 2;
  lid.scale.set(1, 1, 0.55);
  lid.position.set(0, 0.026, 0.02);
  pod.add(lid);
  parts.lid = lid;
  const box = (w, h, d, color, metal = 0.2) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: metal }));
  parts.pixhawk = box(0.044, 0.014, 0.08, '#2b2f36'); parts.pixhawk.position.set(0, 0.024, 0.03);
  parts.battery = box(0.034, 0.02, 0.07, '#d8a531'); parts.battery.position.set(0, 0.012, -0.05);
  parts.gps = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.008, 24), new THREE.MeshStandardMaterial({ color: '#1d2129', roughness: 0.4 })); parts.gps.position.set(0, 0.03, -0.1);
  parts.radio = box(0.026, 0.01, 0.04, '#3a6ea5'); parts.radio.position.set(0.05, 0.016, -0.02);
  parts.arming = box(0.014, 0.012, 0.014, '#c43b2e'); parts.arming.position.set(-0.05, 0.018, 0.0);
  for (const k of ['pixhawk', 'battery', 'gps', 'radio', 'arming']) pod.add(parts[k]);
  group.add(pod);
  parts.pod = pod;
  // Motor on its pivot at the nose (the vertical take-off mechanism tilts it upwards).
  if (motor) {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.02, NOSE - 0.03);
    const mount = box(0.03, 0.02, 0.05, '#2d3138'); mount.position.z = 0.02; pivot.add(mount);
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.028, 24), new THREE.MeshStandardMaterial({ color: '#b5462f', metalness: 0.8, roughness: 0.3 }));
    can.rotation.x = Math.PI / 2; can.position.z = 0.055; pivot.add(can);
    const p = prop();
    p.position.z = 0.072;
    pivot.add(p);
    parts.prop = p;
    parts.pivot = pivot;
    group.add(pivot);
  }
  if (pitot) {
    // Pitot tube on a small mast, pointing forward (the wing weathervanes into the wind).
    const tube = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 1, roughness: 0.25 });
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.09, 8), new THREE.MeshStandardMaterial({ color: '#d9c7a0', roughness: 0.6 }));
    mast.position.set(0, 0.045, 0); tube.add(mast);
    const pt = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.14, 10), steel);
    pt.rotation.x = Math.PI / 2; pt.position.set(0, 0.09, 0.05); tube.add(pt);
    tube.position.set(0.11, 0.01, 0.0);
    parts.pitot = tube;
    group.add(tube);
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const anchors = {
    cells: new THREE.Vector3(0.3, 0.03, 0.0),
    winglet: new THREE.Vector3(0.5, 0.1, -0.24),
    pod: new THREE.Vector3(0, 0.05, -0.02),
    motor: new THREE.Vector3(0, 0.03, NOSE + 0.05),
    foam: new THREE.Vector3(-0.32, 0.02, -0.12),
  };
  return { group, parts, anchors };
}
