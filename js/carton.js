// 3D Tetra-style 1 L carton built from the real Lowcaly pack artwork.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const CARTON = { w: 1, h: 2.54, d: 0.86 };

const HEAD = '"HeronSansCond","Heron Sans Cond","Barlow Condensed",sans-serif';
const BODY = '"KeplerStd","Kepler Std","Crimson Pro",serif';
const GREEN = '#005745';
const CREAM = '#fff3e3';

const loader = new THREE.TextureLoader();
function load(url, renderer) {
  return new Promise((res, rej) => loader.load(url, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    res(t);
  }, undefined, rej));
}

function canvasTex(cv, renderer) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function wrap(g, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = test;
  }
  if (line) g.fillText(line, x, y);
  return y + lh;
}

// Back panel: nutrition table + ingredients, like the real pack.
function backCanvas(f, edgeImg) {
  const W = 768, H = 1952, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = f.color;
  g.fillRect(0, 0, W, H);
  // illustrated border made from the pack's own artwork
  g.save();
  g.globalAlpha = 0.95;
  g.drawImage(edgeImg, 0, 0, edgeImg.width, edgeImg.height, 0, 0, 150, H);
  g.translate(W, 0); g.scale(-1, 1);
  g.drawImage(edgeImg, 0, 0, edgeImg.width, edgeImg.height, 0, 0, 150, H);
  g.restore();

  const px = 110, pw = W - 220;
  g.fillStyle = CREAM;
  roundRect(g, px, 70, pw, H - 140, 46);
  g.fill();

  g.fillStyle = GREEN;
  g.textAlign = 'center';
  g.font = `600 118px ${HEAD}`;
  g.fillText('LOWCALY', W / 2, 220);
  g.font = `500 40px ${HEAD}`;
  g.fillText('ZERO SUGAR – HERO TASTE', W / 2, 280);

  g.font = `600 64px ${HEAD}`;
  g.fillText(f.name.toUpperCase(), W / 2, 400);

  g.textAlign = 'left';
  g.font = `600 34px ${HEAD}`;
  g.fillText('NÄRINGSVÄRDE PER 100 ML', px + 40, 500);
  const rows = [
    ['Energi', `${f.kj} kJ / ${f.kcal} kcal`], ['Fett', '0 g'], ['  varav mättat fett', '0 g'],
    ['Kolhydrater', '< 0,5 g'], ['  varav sockerarter', '< 0,5 g'], ['Protein', '0 g'], ['Salt', '0 g']
  ];
  let y = 560;
  g.lineWidth = 2;
  g.strokeStyle = GREEN;
  g.font = `400 30px ${BODY}`;
  for (const [k, v] of rows) {
    g.beginPath(); g.moveTo(px + 40, y - 34); g.lineTo(px + pw - 40, y - 34); g.stroke();
    g.textAlign = 'left'; g.fillText(k, px + 40, y);
    g.textAlign = 'right'; g.fillText(v, px + pw - 40, y);
    y += 50;
  }
  g.beginPath(); g.moveTo(px + 40, y - 34); g.lineTo(px + pw - 40, y - 34); g.stroke();

  g.textAlign = 'left';
  g.font = `600 34px ${HEAD}`;
  g.fillText('INGREDIENSER', px + 40, y + 40);
  g.font = `400 27px ${BODY}`;
  y = wrap(g, f.ingredients, px + 40, y + 90, pw - 80, 36);
  g.font = `italic 400 26px ${BODY}`;
  y = wrap(g, 'Innehåller en källa till fenylalanin. Serveras bäst kyld. Förvaras i rumstemperatur, kylförvaras efter öppning.', px + 40, y + 20, pw - 80, 34);

  // barcode
  const bx = W / 2 - 150, by = H - 330;
  g.fillStyle = '#fff';
  g.fillRect(bx - 20, by - 20, 340, 200);
  g.fillStyle = '#111';
  let x = bx;
  let seed = f.id.length * 97;
  while (x < bx + 300) {
    seed = (seed * 9301 + 49297) % 233280;
    const w = 2 + (seed % 5);
    if (seed % 3) g.fillRect(x, by, w, 130);
    x += w + 2;
  }
  g.font = `400 26px monospace`;
  g.textAlign = 'center';
  g.fillText('7 350090 ' + String(1000 + f.id.length * 137).slice(0, 4) + ' 2', W / 2, by + 165);
  g.fillStyle = GREEN;
  g.font = `600 64px ${HEAD}`;
  g.fillText('1L', W / 2, H - 100);
  return cv;
}

// Side panel: brand color, art strip and vertical claims.
function sideCanvas(f, edgeImg, variant) {
  const W = 660, H = 1952, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = f.color;
  g.fillRect(0, 0, W, H);
  g.save();
  if (variant) { g.translate(W, 0); g.scale(-1, 1); }
  g.drawImage(edgeImg, 0, 0, edgeImg.width, edgeImg.height, 0, 0, 190, H);
  g.restore();
  g.fillStyle = CREAM;
  roundRect(g, 150, 260, W - 300, H - 520, 40);
  g.fill();
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(-Math.PI / 2);
  g.fillStyle = GREEN;
  g.textAlign = 'center';
  if (!variant) {
    g.font = `600 150px ${HEAD}`;
    g.fillText('ZERO SUGAR', 0, -20);
    g.font = `500 80px ${HEAD}`;
    g.fillText(`${f.vitamins} ADDED VITAMINS* · ${f.kcal} KCAL`, 0, 90);
  } else {
    g.font = `600 140px ${HEAD}`;
    g.fillText('HERO TASTE', 0, -20);
    g.font = `400 62px ${BODY}`;
    g.fillText('Fruit drink · Fruktdryck · 1L', 0, 80);
  }
  g.restore();
  g.fillStyle = GREEN;
  g.textAlign = 'center';
  g.font = `600 60px ${HEAD}`;
  g.fillText(variant ? 'LOWCALY' : '♻', W / 2, H - 150);
  return cv;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

let paperBump;
function paper() {
  if (paperBump) return paperBump;
  const s = 512, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d'), img = g.createImageData(s, s);
  for (let i = 0; i < s * s; i++) {
    const v = 128 + (Math.random() - 0.5) * 26;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  paperBump = new THREE.CanvasTexture(cv);
  paperBump.wrapS = paperBump.wrapT = THREE.RepeatWrapping;
  paperBump.repeat.set(4, 8);
  return paperBump;
}

let capGeo;
function cap() {
  if (!capGeo) {
    const pts = [
      [0.0001, 0.2], [0.17, 0.2], [0.195, 0.193], [0.205, 0.178], [0.207, 0.05], [0.212, 0.035],
      [0.212, 0.02], [0.25, 0.02], [0.27, 0.01], [0.27, -0.004], [0.0001, -0.004]
    ].map(([x, y]) => new THREE.Vector2(x, y));
    capGeo = new THREE.LatheGeometry(pts, 160);
    // knurled grip on the side wall
    const p = capGeo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const r = Math.hypot(v.x, v.z);
      if (v.y > 0.055 && v.y < 0.18 && r > 0.2) {
        const a = Math.atan2(v.z, v.x);
        const k = 1 + Math.pow(Math.abs(Math.cos(a * 40)), 3) * 0.022;
        p.setXYZ(i, v.x * k, v.y, v.z * k);
      }
    }
    capGeo.computeVertexNormals();
  }
  const mat = new THREE.MeshPhysicalMaterial({ color: '#fbfaf6', roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.2 });
  const m = new THREE.Mesh(capGeo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const imgCache = {};
function loadImage(src) {
  return imgCache[src] || (imgCache[src] = new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  }));
}

let bodyGeo;
export async function buildCarton(f, renderer) {
  const base = `assets/tex/${f.id}`;
  const [front, top, edgeImg] = await Promise.all([
    load(`${base}-front.jpg`, renderer),
    load(`${base}-top.jpg`, renderer),
    loadImage(`${base}-edge.jpg`)
  ]);
  const back = canvasTex(backCanvas(f, edgeImg), renderer);
  const right = canvasTex(sideCanvas(f, edgeImg, false), renderer);
  const left = canvasTex(sideCanvas(f, edgeImg, true), renderer);

  const common = {
    roughness: 0.36, clearcoat: 0.55, clearcoatRoughness: 0.22,
    bumpMap: paper(), bumpScale: 0.35, specularIntensity: 0.6
  };
  const mk = (map) => new THREE.MeshPhysicalMaterial({ ...common, map });
  const bottom = new THREE.MeshPhysicalMaterial({ ...common, color: f.color });
  // BoxGeometry group order: +x, -x, +y, -y, +z, -z
  const mats = [mk(right), mk(left), mk(top), bottom, mk(front), mk(back)];

  bodyGeo ||= new RoundedBoxGeometry(CARTON.w, CARTON.h, CARTON.d, 6, 0.035);
  const body = new THREE.Mesh(bodyGeo, mats);
  body.castShadow = true;
  body.receiveShadow = true;

  const group = new THREE.Group();
  group.add(body);
  const c = cap();
  c.position.set(0, CARTON.h / 2, 0.06);
  group.add(c);
  group.userData.materials = mats;
  return group;
}
