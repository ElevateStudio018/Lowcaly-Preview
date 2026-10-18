// Procedural, physically based fruit models. Everything is generated at
// runtime so the page ships no heavy GLB files.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------------------------------------------------------------- utilities

function hash(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function smooth(t) { return t * t * (3 - 2 * t); }
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  let v = 0;
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
    const w = (dx ? xf : 1 - xf) * (dy ? yf : 1 - yf) * (dz ? zf : 1 - zf);
    v += w * hash(xi + dx, yi + dy, zi + dz);
  }
  return v;
}
function fbm(x, y, z) {
  return noise3(x, y, z) * 0.55 + noise3(x * 2.1, y * 2.1, z * 2.1) * 0.3 + noise3(x * 4.3, y * 4.3, z * 4.3) * 0.15;
}
const rand = (a, b) => a + Math.random() * (b - a);

// Geometry detail: 1 on desktop; phones call setDetail(<1) before building fruit.
let DETAIL = 1;
export function setDetail(d) { DETAIL = d; }
const seg = (n) => Math.max(6, Math.round(n * DETAIL));

function deform(geo, fn) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    fn(v, i);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function paint(geo, fn) {
  const p = geo.attributes.position, n = p.count;
  const col = new Float32Array(n * 3), v = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(p, i);
    fn(v, c);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

const C = (hex) => new THREE.Color(hex);

// A tileable grain texture used as bump / roughness detail.
let grainTex;
function grain() {
  if (grainTex) return grainTex;
  const s = 256, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d'), img = g.createImageData(s, s);
  for (let i = 0; i < s * s; i++) {
    const x = i % s, y = (i / s) | 0;
    const v = 128 + (fbm(x / 9, y / 9, 0.5) - 0.5) * 120 + (Math.random() - 0.5) * 40;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainTex = new THREE.CanvasTexture(cv);
  grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping;
  grainTex.repeat.set(3, 3);
  return grainTex;
}

// Pores / lenticels: sparse dots.
let dotsTex;
function dots() {
  if (dotsTex) return dotsTex;
  const s = 512, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(40,40,40,${rand(0.3, 0.8)})`;
    g.beginPath();
    g.arc(Math.random() * s, Math.random() * s, rand(0.6, 2), 0, Math.PI * 2);
    g.fill();
  }
  dotsTex = new THREE.CanvasTexture(cv);
  dotsTex.wrapS = dotsTex.wrapT = THREE.RepeatWrapping;
  dotsTex.repeat.set(2, 2);
  return dotsTex;
}

function stemMesh(points, radius = 0.012, color = '#6f6a2a') {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, 32, radius, 8, false);
  // taper towards the end
  const pos = geo.attributes.position, n = new THREE.Vector3(), c = new THREE.Vector3();
  const rings = 33, radial = 9;
  for (let r = 0; r < rings; r++) {
    const t = r / (rings - 1);
    curve.getPointAt(t, c);
    const k = 1 - t * 0.35;
    for (let s = 0; s < radial; s++) {
      const i = r * radial + s;
      n.fromBufferAttribute(pos, i).sub(c).multiplyScalar(k).add(c);
      pos.setXYZ(i, n.x, n.y, n.z);
    }
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.6, clearcoat: 0.2 });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

function shadowed(obj) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return obj;
}

// ---------------------------------------------------------------- textures for leaves / petals

function leafTexture(kind = 'serrated', hue = '#4f7d2a') {
  const w = 256, h = 512, cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const path = new Path2D();
  const teeth = kind === 'serrated' ? 26 : 0;
  path.moveTo(w / 2, h - 8);
  const side = (dir) => {
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      let r = Math.sin(Math.PI * Math.pow(t, 0.8)) * (w * 0.46) * (1 - t * 0.15);
      if (teeth) r -= (Math.abs(Math.sin(t * teeth * Math.PI)) * 5) * (1 - t * 0.3);
      pts.push([w / 2 + dir * r, h - 8 - t * (h - 20)]);
    }
    return pts;
  };
  side(1).forEach(([x, y]) => path.lineTo(x, y));
  side(-1).reverse().forEach(([x, y]) => path.lineTo(x, y));
  path.closePath();

  const grad = g.createLinearGradient(0, 0, w, h);
  const base = new THREE.Color(hue);
  const light = base.clone().offsetHSL(0.02, 0.05, 0.12).getStyle();
  const dark = base.clone().offsetHSL(-0.01, 0, -0.08).getStyle();
  grad.addColorStop(0, light);
  grad.addColorStop(1, dark);
  g.fillStyle = grad;
  g.fill(path);
  g.save();
  g.clip(path);
  // mottling
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,200' : '0,40,0'},0.04)`;
    g.beginPath();
    g.arc(Math.random() * w, Math.random() * h, rand(6, 22), 0, Math.PI * 2);
    g.fill();
  }
  // veins
  g.strokeStyle = 'rgba(230,240,190,0.55)';
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(w / 2, h); g.quadraticCurveTo(w / 2 + 6, h / 2, w / 2, 12); g.stroke();
  g.lineWidth = 1.6;
  for (let i = 1; i < 11; i++) {
    const y = h - 20 - i * (h / 12);
    for (const d of [1, -1]) {
      g.beginPath();
      g.moveTo(w / 2, y);
      g.quadraticCurveTo(w / 2 + d * w * 0.2, y - 18, w / 2 + d * w * 0.42, y - 52);
      g.stroke();
    }
  }
  g.restore();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function petalTexture() {
  const w = 128, h = 128, cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(w / 2, h, 4, w / 2, h / 2, h * 0.7);
  grad.addColorStop(0, '#d9547d');
  grad.addColorStop(0.35, '#f7b8cb');
  grad.addColorStop(1, '#fff1f4');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(w / 2, h);
  g.bezierCurveTo(-10, h * 0.6, 10, 8, w / 2 - 8, 6);
  g.lineTo(w / 2, 16);
  g.lineTo(w / 2 + 8, 6);
  g.bezierCurveTo(w - 10, 8, w + 10, h * 0.6, w / 2, h);
  g.fill();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const texCache = {};
function cached(key, fn) { return texCache[key] || (texCache[key] = fn()); }

// ---------------------------------------------------------------- fruits

function cherrySingle() {
  const geo = deform(new THREE.SphereGeometry(1, seg(72), seg(54)), (v) => {
    const top = Math.exp(-(1 - v.y) / 0.07);
    v.y -= top * 0.32;
    v.y -= Math.exp(-(1 + v.y) / 0.12) * 0.05;
    const groove = Math.exp(-Math.pow(v.x / 0.07, 2)) * (v.z > 0 ? 1 : 0) * 0.025;
    v.multiplyScalar(1 - groove + (fbm(v.x * 3, v.y * 3, v.z * 3) - 0.5) * 0.02);
    v.x *= 1.05; v.y *= 0.93;
  });
  paint(geo, (v, c) => {
    const n = fbm(v.x * 2.5 + 3, v.y * 2.5, v.z * 2.5);
    c.copy(C('#7c0716')).lerp(C('#b0162a'), smooth(Math.max(0, (v.x + v.z) * 0.35 + 0.35)) * 0.7);
    c.lerp(C('#3d0209'), Math.max(0, v.y - 0.4) * 0.9 + (n - 0.5) * 0.4);
  });
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06,
    bumpMap: grain(), bumpScale: 0.6, specularIntensity: 0.9
  });
  return new THREE.Mesh(geo, mat);
}

export function cherry() {
  const g = new THREE.Group();
  const s = 0.17;
  const a = cherrySingle(); a.scale.setScalar(s); a.position.set(-0.13, 0, 0);
  const b = cherrySingle(); b.scale.setScalar(s * 0.94); b.position.set(0.15, -0.06, 0.05); b.rotation.y = 1.4;
  g.add(a, b);
  g.add(stemMesh([[-0.13, 0.12, 0], [-0.1, 0.35, 0.02], [0.0, 0.58, 0.0], [0.05, 0.66, -0.02]], 0.011));
  g.add(stemMesh([[0.15, 0.06, 0.05], [0.12, 0.32, 0.03], [0.06, 0.55, 0.0], [0.05, 0.66, -0.02]], 0.011));
  const leaf = leafMesh('serrated', '#5a8a2c', 0.42);
  leaf.position.set(0.05, 0.66, -0.02);
  leaf.rotation.set(0.3, 0.6, -0.9);
  g.add(leaf);
  return shadowed(g);
}

// Strawberry profile radius at height parameter t (0 = tip, 1 = shoulder).
function strawR(t) {
  return Math.pow(Math.sin(Math.PI * 0.5 * Math.min(1, t * 1.22)), 0.85) * (1 - Math.pow(t, 7) * 0.92) * 0.8;
}

export function strawberry({ half = false } = {}) {
  const ROWS = 18, COLS = 20, PTS = seg(96), SEG = seg(144);
  const prof = [];
  for (let i = 0; i <= PTS; i++) {
    const t = i / PTS;
    prof.push(new THREE.Vector2(Math.max(0.0001, strawR(t)), -1 + t * 1.75));
  }
  const phiLen = half ? Math.PI : Math.PI * 2;
  const geo = new THREE.LatheGeometry(prof, SEG, 0, phiLen);
  // Seeds sit on a staggered lattice; the flesh around each one is pressed
  // into a small pit, which is what makes a strawberry read as real.
  const uv = geo.attributes.uv, pos = geo.attributes.position, pit = new Float32Array(pos.count);
  const v3 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i) * (half ? 0.5 : 1), t = uv.getY(i);
    v3.fromBufferAttribute(pos, i);
    const row = t * ROWS, ri = Math.round(row);
    const col = u * COLS + (ri % 2) * 0.5, ci = Math.round(col);
    const du = (col - ci) * 1.0, dv = (row - ri) * 1.0;
    const d2 = du * du + dv * dv;
    const inBand = t > 0.06 && t < 0.88 ? 1 : 0;
    const dent = Math.exp(-d2 / 0.028) * 0.017 * inBand;
    pit[i] = dent / 0.017;
    const r = Math.hypot(v3.x, v3.z);
    const k = r > 0.001 ? (r - dent) / r : 1;
    pos.setXYZ(i, v3.x * k, v3.y, v3.z * k);
  }
  geo.computeVertexNormals();
  paint(geo, (v, c) => {
    const t = (v.y + 1) / 1.75;
    const n = fbm(v.x * 4, v.y * 4, v.z * 4);
    c.copy(C('#b30d1c')).lerp(C('#e0262b'), n * 0.7);
    c.lerp(C('#f5d6a8'), smooth(Math.max(0, Math.min(1, (t - 0.8) / 0.18))) * 0.6);
  });
  // darken the pits slightly
  const col = geo.attributes.color;
  for (let i = 0; i < col.count; i++) {
    const k = 1 - pit[i] * 0.28;
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k * 0.9, col.getZ(i) * k * 0.9);
  }
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08,
    sheen: 0.25, sheenColor: C('#ff9a8a'), emissive: C('#3a0006'), emissiveIntensity: 0.25,
    bumpMap: grain(), bumpScale: 0.5, side: THREE.DoubleSide
  });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));

  // achenes, slightly tilted towards the tip like on a real berry
  const seedGeo = new THREE.SphereGeometry(0.017, 10, 8).scale(0.7, 1.45, 0.55);
  const seedMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.3, clearcoat: 0.7 });
  const seeds = new THREE.InstancedMesh(seedGeo, seedMat, ROWS * COLS);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qt = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), cc = new THREE.Color();
  let k = 0;
  for (let ri = 1; ri < ROWS; ri++) {
    const t = ri / ROWS;
    if (t < 0.06 || t > 0.88) continue;
    for (let ci = 0; ci < COLS; ci++) {
      const u = (ci - (ri % 2) * 0.5) / COLS;
      if (half && (u < 0 || u > 0.5)) continue;
      const a = u * Math.PI * 2;
      const r = strawR(t) - 0.013;
      const y = -1 + t * 1.75;
      const n = new THREE.Vector3(Math.sin(a), 0.25, Math.cos(a)).normalize();
      q.setFromUnitVectors(up, n);
      qt.setFromAxisAngle(new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)), -0.5);
      q.premultiply(qt);
      m4.compose(new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r), q, new THREE.Vector3(1, 1, 1));
      seeds.setMatrixAt(k, m4);
      seeds.setColorAt(k, cc.set('#e2b84a').lerp(C('#c9832c'), Math.random() * 0.6).lerp(C('#f4dc7a'), t > 0.7 ? 0.4 : 0));
      k++;
    }
  }
  seeds.count = k;
  g.add(seeds);

  if (half) {
    const shape = new THREE.Shape();
    shape.moveTo(0, prof[0].y);
    prof.forEach((p) => shape.lineTo(p.x, p.y));
    for (let i = prof.length - 1; i >= 0; i--) shape.lineTo(-prof[i].x, prof[i].y);
    const fg = new THREE.ShapeGeometry(shape, 48);
    // subdivide the flat face so the vertex-colour gradient has resolution
    const face = new THREE.PlaneGeometry(1.7, 1.8, seg(90), seg(96)).translate(0, -0.1, 0);
    const fp = face.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i), y = fp.getY(i), t = (y + 1) / 1.75;
      const R = t >= 0 && t <= 1 ? strawR(t) : 0;
      fp.setX(i, Math.max(-R, Math.min(R, x)));
    }
    paint(face, (v, c) => {
      const t = (v.y + 1) / 1.75, R = Math.max(0.0001, strawR(Math.min(1, Math.max(0, t))));
      const rr = Math.abs(v.x) / R;
      const core = Math.exp(-Math.pow(v.x / 0.12, 2)) * smooth(Math.min(1, t * 1.4));
      c.copy(C('#d0142c')).lerp(C('#f26a6e'), smooth(Math.max(0, 0.9 - rr)) * 0.8);
      c.lerp(C('#ffe4dc'), core * 0.85);
      // radial vascular streaks
      c.lerp(C('#f2a0a0'), Math.max(0, Math.sin(Math.atan2(v.y + 0.2, v.x) * 22) * 0.5) * 0.25 * rr);
    });
    fg.dispose();
    const flesh = new THREE.Mesh(face, new THREE.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05,
      bumpMap: grain(), bumpScale: 1.2, side: THREE.DoubleSide
    }));
    flesh.rotation.y = Math.PI / 2;
    g.add(flesh);
  }

  // calyx: pointy, slightly curled sepals with a hairy stem
  const calyx = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const l = leafMesh('smooth', i % 2 ? '#3f7a22' : '#4d8a2a', rand(0.26, 0.34), 0.34);
    l.rotation.order = 'YXZ';
    l.rotation.y = (i / 10) * Math.PI * 2 + rand(-0.1, 0.1);
    l.rotation.x = 1.3 + rand(-0.2, 0.25);
    calyx.add(l);
  }
  calyx.position.y = 0.73;
  g.add(calyx);
  g.add(stemMesh([[0, 0.7, 0], [0.02, 0.86, 0.01], [0.06, 1.0, 0]], 0.022, '#4d7a24'));
  g.scale.setScalar(0.3);
  return shadowed(g);
}

export function raspberry() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 18).scale(1, 1.15, 1), new THREE.MeshStandardMaterial({ color: '#3d0410', roughness: 0.6 }));
  g.add(core);
  // each drupelet is a little juice bead: slightly tear-shaped, glossy, with a
  // reddish emissive term faking light scattering through the flesh
  const dGeo = deform(new THREE.SphereGeometry(0.2, seg(24), seg(18)), (v) => {
    v.z *= 0.9 + (v.y < 0 ? 0 : 0);
    v.multiplyScalar(1 + (fbm(v.x * 20, v.y * 20, v.z * 20) - 0.5) * 0.05);
  });
  const dMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.12,
    sheen: 1, sheenColor: C('#ff6f92'), sheenRoughness: 0.35,
    emissive: C('#6d0420'), emissiveIntensity: 0.35, specularIntensity: 1
  });
  const N = 200;
  const inst = new THREE.InstancedMesh(dGeo, dMat, N);
  const styles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.004, 0.0025, 0.09, 4), new THREE.MeshStandardMaterial({ color: '#e9c9b0', roughness: 0.9 }), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  let k = 0;
  for (let i = 0; i < 210 && k < N; i++) {
    const y = 1 - (i / 209) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;
    if (y > 0.86) continue; // hollow stem end
    const taper = 0.78 - (1 - y) * 0.06;
    const n = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r).normalize();
    const p = new THREE.Vector3(Math.cos(th) * r * taper, y * 0.98, Math.sin(th) * r * taper);
    q.setFromUnitVectors(up, n);
    const s = rand(0.86, 1.12);
    m4.compose(p, q, new THREE.Vector3(s, s, s));
    inst.setMatrixAt(k, m4);
    inst.setColorAt(k, col.set('#9e0f36').lerp(C('#d42a5c'), Math.random() * 0.5).lerp(C('#5e0418'), Math.random() * 0.3));
    // the dried style ("hair") sticking out of each bead
    if (Math.random() < 0.55) {
      m4.compose(p.clone().addScaledVector(n, 0.2 * s), q, new THREE.Vector3(1, rand(0.6, 1.3), 1));
      styles.setMatrixAt(k, m4);
    } else {
      m4.makeScale(0, 0, 0);
      styles.setMatrixAt(k, m4);
    }
    k++;
  }
  inst.count = k;
  styles.count = k;
  g.add(inst, styles);
  g.scale.setScalar(0.2);
  return shadowed(g);
}

// Patchy, dusty wax bloom drawn once and shared by all blueberries.
function bloomTexture() {
  const s = 512, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d'), img = g.createImageData(s, s);
  const dark = C('#1f2547'), dusty = C('#7f8fb8'), mid = C('#3a4a7c');
  const c = new THREE.Color();
  for (let i = 0; i < s * s; i++) {
    const x = i % s, y = (i / s) | 0;
    // tileable in x for the sphere seam
    const a = (x / s) * Math.PI * 2;
    const n = fbm(Math.cos(a) * 2 + 5, Math.sin(a) * 2, y / 70);
    const fine = noise3(x / 3, y / 3, 1);
    const bloom = smooth(Math.min(1, Math.max(0, (n - 0.38) * 2.6)));
    c.copy(dark).lerp(mid, fine * 0.35).lerp(dusty, bloom * 0.85);
    img.data[i * 4] = c.r * 255; img.data[i * 4 + 1] = c.g * 255; img.data[i * 4 + 2] = c.b * 255; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function blueberry(dark = false) {
  // crown: a sunken star with five dried sepal tips around the rim
  const geo = deform(new THREE.SphereGeometry(1, seg(96), seg(72)), (v) => {
    v.y *= 0.82;
    const rTop = Math.hypot(v.x, v.z);
    if (v.y > 0) {
      const a = Math.atan2(v.z, v.x);
      const star = 0.22 + 0.06 * Math.cos(a * 5);
      const inside = smooth(Math.max(0, Math.min(1, (star - rTop) / 0.12)));
      const rim = Math.exp(-Math.pow((rTop - star) / 0.05, 2));
      v.y -= inside * 0.2 * (dark ? 0.5 : 1);
      v.y += rim * 0.035;
    }
    v.multiplyScalar(1 + (fbm(v.x * 2.2, v.y * 2.2, v.z * 2.2) - 0.5) * 0.05);
  });
  const mat = dark
    ? new THREE.MeshPhysicalMaterial({ color: '#160d1e', roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.4, sheenColor: C('#5a2a6a'), bumpMap: grain(), bumpScale: 0.3 })
    : new THREE.MeshPhysicalMaterial({
      map: cached('bloom', bloomTexture), roughness: 0.68, sheen: 1, sheenColor: C('#b8c6e6'), sheenRoughness: 0.55,
      clearcoat: 0.15, clearcoatRoughness: 0.6, bumpMap: grain(), bumpScale: 0.35
    });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  const crown = new THREE.Group();
  const sepalMat = new THREE.MeshStandardMaterial({ color: dark ? '#4a3524' : '#3b2f3a', roughness: 0.9 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5).translate(0, 0.1, 0), sepalMat);
    tip.position.set(Math.cos(a) * 0.24, dark ? 0.8 : 0.79, Math.sin(a) * 0.24);
    tip.lookAt(Math.cos(a) * 2, 1.4, Math.sin(a) * 2);
    tip.rotateX(Math.PI / 2);
    crown.add(tip);
  }
  const pit = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), new THREE.MeshStandardMaterial({ color: '#141220', roughness: 1 }));
  pit.rotation.x = -Math.PI / 2;
  pit.position.y = dark ? 0.72 : 0.62;
  crown.add(pit);
  if (dark) crown.rotation.x = Math.PI; // blackcurrants carry the dried flower at the bottom
  g.add(crown);
  if (dark) g.add(stemMesh([[0, 0.8, 0], [0.05, 1.1, 0.02], [0.15, 1.4, 0]], 0.03, '#556b2f'));
  g.scale.setScalar(dark ? 0.1 : 0.13);
  return shadowed(g);
}

function pearProfile() {
  const ctrl = [[0, -1], [0.45, -0.96], [0.72, -0.78], [0.8, -0.48], [0.72, -0.1], [0.52, 0.25], [0.38, 0.55], [0.3, 0.8], [0.17, 0.96], [0.0001, 1.0]];
  const curve = new THREE.SplineCurve(ctrl.map(([x, y]) => new THREE.Vector2(x, y)));
  return curve.getPoints(48);
}

export function pear({ half = false } = {}) {
  const prof = pearProfile();
  const geo = new THREE.LatheGeometry(prof, seg(72), 0, half ? Math.PI : Math.PI * 2);
  deform(geo, (v) => {
    v.x += 0.08 * Math.pow(Math.max(0, v.y), 2);
    const k = 1 + (fbm(v.x * 2, v.y * 2, v.z * 2) - 0.5) * 0.06;
    v.x *= k; v.z *= k;
  });
  paint(geo, (v, c) => {
    const n = fbm(v.x * 2 + 9, v.y * 2, v.z * 2);
    c.copy(C('#a9bf3c')).lerp(C('#d8cf55'), n);
    const blush = smooth(Math.max(0, Math.min(1, (v.z * 0.8 + v.x * 0.4 + n * 0.6 - 0.3))));
    c.lerp(C('#c4632f'), blush * 0.55);
  });
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35,
    bumpMap: dots(), bumpScale: 0.8, side: THREE.DoubleSide
  });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  if (half) {
    const shape = new THREE.Shape();
    shape.moveTo(0, -1);
    prof.forEach((p) => shape.lineTo(p.x, p.y));
    for (let i = prof.length - 1; i >= 0; i--) shape.lineTo(-prof[i].x, prof[i].y);
    const fg = new THREE.ShapeGeometry(shape, 24);
    paint(fg, (v, c) => {
      const core = Math.exp(-(v.x * v.x * 18 + Math.pow((v.y + 0.45) * 2.4, 2)));
      c.copy(C('#f6f0d6')).lerp(C('#e4d9a6'), core);
    });
    const face = new THREE.Mesh(fg, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.2, side: THREE.DoubleSide }));
    face.rotation.y = Math.PI / 2;
    g.add(face);
    for (const sx of [-0.07, 0.07]) {
      const seed = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8).scale(0.6, 1, 0.3), new THREE.MeshPhysicalMaterial({ color: '#3a1f10', roughness: 0.3, clearcoat: 1 }));
      seed.position.set(0, -0.45, sx);
      seed.rotation.x = sx * 4;
      g.add(seed);
    }
  }
  g.add(stemMesh([[0.08, 0.98, 0], [0.1, 1.15, 0.02], [0.2, 1.3, 0]], 0.03, '#5b3d1e'));
  if (!half) {
    const l = leafMesh('smooth', '#5a8c2f', 0.7);
    l.position.set(0.16, 1.18, 0);
    l.rotation.set(0.4, 0.2, -1.1);
    g.add(l);
  }
  g.scale.setScalar(0.42);
  return shadowed(g);
}

export function peach({ half = false, white = true } = {}) {
  const geo = deform(new THREE.SphereGeometry(1, seg(80), seg(60), 0, half ? Math.PI : Math.PI * 2), (v) => {
    const crease = Math.exp(-Math.pow(v.x / 0.1, 2)) * smooth(Math.max(0, Math.min(1, v.z + 0.4))) * 0.07;
    v.multiplyScalar(1 - crease);
    v.y -= Math.exp(-(1 - v.y) / 0.06) * 0.14;
    v.y -= Math.exp(-(1 + v.y) / 0.08) * -0.04;
    v.multiplyScalar(1 + (fbm(v.x * 2, v.y * 2, v.z * 2) - 0.5) * 0.04);
    v.y *= 0.96;
  });
  const base = white ? '#f3cf8e' : '#f2b25c';
  const blush = white ? '#d9405a' : '#cf3b33';
  paint(geo, (v, c) => {
    const n = fbm(v.x * 2.2 + 4, v.y * 2.2, v.z * 2.2);
    c.copy(C(base)).lerp(C('#f6e6c4'), Math.max(0, -v.y) * 0.4);
    const b = smooth(Math.max(0, Math.min(1, v.x * 0.5 + v.y * 0.4 + v.z * 0.3 + (n - 0.5) * 1.4 + 0.2)));
    c.lerp(C(blush), b * 0.85);
    c.lerp(C('#8d1d2a'), Math.max(0, b - 0.7) * (n > 0.6 ? 0.8 : 0.2));
  });
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.62, sheen: 0.55, sheenColor: C('#ffd9cc'), sheenRoughness: 0.6,
    side: THREE.DoubleSide
  });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  if (half) {
    const fg = new THREE.CircleGeometry(0.985, 64);
    paint(fg, (v, c) => {
      const r = Math.hypot(v.x, v.y);
      c.copy(white ? C('#fbefd6') : C('#f8c76a')).lerp(C('#c43f4c'), smooth(Math.max(0, 1 - r / 0.45)) * 0.8);
      c.lerp(C('#f0c67a'), smooth(Math.max(0, (r - 0.8) / 0.2)) * 0.5);
    });
    // SphereGeometry's half (phi 0..PI) is cut along z = 0, which is CircleGeometry's own plane
    const face = new THREE.Mesh(fg, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12, side: THREE.DoubleSide }));
    g.add(face);
    const pitGeo = deform(new THREE.SphereGeometry(0.32, seg(40), seg(30)), (v) => {
      v.y *= 1.35; v.z *= 0.6;
      v.multiplyScalar(1 + (noise3(v.x * 18, v.y * 18, v.z * 18) - 0.5) * 0.18);
    });
    const pit = new THREE.Mesh(pitGeo, new THREE.MeshPhysicalMaterial({ color: '#7a3a22', roughness: 0.55, clearcoat: 0.6 }));
    g.add(pit);
  } else {
    const l = leafMesh('smooth', '#4f8a2a', 0.85, 0.38);
    l.position.set(0, 0.86, 0);
    l.rotation.set(0.5, 0.4, -1.2);
    g.add(l);
  }
  g.scale.setScalar(0.4);
  return shadowed(g);
}

export function mango() {
  const geo = deform(new THREE.SphereGeometry(1, seg(80), seg(60)), (v) => {
    const y = v.y;
    v.y *= 1.32;
    v.z *= 0.78;
    v.x += 0.2 * (1 - y * y) - 0.12 * y;
    v.x *= 0.92 + 0.08 * y;
    v.multiplyScalar(1 + (fbm(v.x * 1.5, v.y * 1.5, v.z * 1.5) - 0.5) * 0.04);
  });
  paint(geo, (v, c) => {
    const t = (v.y + 1.3) / 2.6;
    const n = fbm(v.x * 2 + 1, v.y * 2, v.z * 2);
    c.copy(C('#6e9a2c')).lerp(C('#e9b62c'), smooth(Math.min(1, Math.max(0, t * 1.4 - 0.2 + (n - 0.5)))));
    c.lerp(C('#d9452b'), smooth(Math.max(0, Math.min(1, t * 1.6 - 0.7 + v.x * 0.4 + (n - 0.5)))) * 0.85);
  });
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.33, clearcoat: 0.6, clearcoatRoughness: 0.25,
    bumpMap: dots(), bumpScale: 0.5
  });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  g.add(stemMesh([[0.05, 1.3, 0], [0.06, 1.42, 0]], 0.05, '#4a3a1c'));
  g.scale.setScalar(0.38);
  return shadowed(g);
}

export function mangoCube() {
  const geo = new RoundedBoxGeometry(1, 1, 1, 4, 0.18);
  deform(geo, (v) => { v.multiplyScalar(1 + (fbm(v.x * 3, v.y * 3, v.z * 3) - 0.5) * 0.12); });
  paint(geo, (v, c) => { c.copy(C('#f7a21b')).lerp(C('#ffc94a'), fbm(v.x * 4, v.y * 4, v.z * 4)); });
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05,
    sheen: 0.5, sheenColor: C('#ffd27a'), bumpMap: grain(), bumpScale: 1.2
  });
  const m = new THREE.Mesh(geo, mat);
  const g = new THREE.Group();
  g.add(m);
  g.scale.setScalar(0.16);
  return shadowed(g);
}

export function leafMesh(kind = 'serrated', hue = '#4f7d2a', length = 0.6, widthRatio = 0.5) {
  const tex = cached(`leaf-${kind}-${hue}`, () => leafTexture(kind, hue));
  const geo = new THREE.PlaneGeometry(widthRatio, 1, 12, 24);
  geo.translate(0, 0.5, 0);
  deform(geo, (v) => {
    const t = v.y; // 0 at base -> 1 at tip
    v.z = -Math.pow(v.x / (widthRatio * 0.5), 2) * 0.06 + Math.sin(t * Math.PI) * 0.08 - t * t * 0.18;
  });
  const mat = new THREE.MeshPhysicalMaterial({
    map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5,
    clearcoat: 0.4, clearcoatRoughness: 0.4, bumpMap: tex, bumpScale: 0.6,
    sheen: 0.3, sheenColor: C('#d8f0a0')
  });
  const m = new THREE.Mesh(geo, mat);
  m.scale.setScalar(length);
  m.castShadow = true;
  return m;
}

export function leaf() {
  const g = new THREE.Group();
  const l = leafMesh('serrated', ['#4f7d2a', '#5d8f30', '#3f6e22'][(Math.random() * 3) | 0], rand(0.5, 0.7));
  l.position.y = -0.3;
  g.add(l);
  return shadowed(g);
}

export function blossom() {
  const g = new THREE.Group();
  const tex = cached('petal', petalTexture);
  const mat = new THREE.MeshPhysicalMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.6, sheen: 0.6, sheenColor: C('#ffffff') });
  for (let i = 0; i < 5; i++) {
    const geo = new THREE.PlaneGeometry(0.16, 0.16, 6, 6);
    geo.translate(0, 0.08, 0);
    deform(geo, (v) => { v.z = Math.pow(v.y / 0.16, 2) * 0.05 - Math.pow(v.x / 0.08, 2) * 0.01; });
    const p = new THREE.Mesh(geo, mat);
    p.rotation.z = (i / 5) * Math.PI * 2;
    p.rotation.x = 0.25;
    g.add(p);
  }
  const stamenMat = new THREE.MeshStandardMaterial({ color: '#f3c13a', roughness: 0.5 });
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), stamenMat);
    const a = Math.random() * Math.PI * 2, r = rand(0.01, 0.035);
    s.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.03 + Math.random() * 0.02);
    g.add(s);
  }
  g.scale.setScalar(1.4);
  return shadowed(g);
}

export const FRUIT_FACTORY = {
  cherry,
  strawberry: () => strawberry(),
  strawberryHalf: () => strawberry({ half: true }),
  raspberry,
  blueberry: () => blueberry(false),
  blackcurrant: () => blueberry(true),
  pear: () => pear(),
  pearHalf: () => pear({ half: true }),
  peach: () => peach(),
  peachHalf: () => peach({ half: true }),
  mango,
  mangoCube,
  leaf,
  blossom
};
