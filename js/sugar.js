// "Sockerkalkylatorn": a glass jar that fills with sugar cubes for the sugar
// a year of regular juice/soda contains — and empties when you switch.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const MAX_CUBES = 800;
const CUBE = 0.19;
const JAR_R = 1.05;
const JAR_H = 2.5;
const FLOOR = -1.15;

function sugarTextures() {
  // crystalline sugar: bright base, dense sparkly grain, a few darker pits
  const s = 256, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d'), img = g.createImageData(s, s);
  for (let i = 0; i < s * s; i++) {
    const r = Math.random();
    const v = r > 0.985 ? 255 : r < 0.04 ? 190 : 225 + Math.random() * 25;
    img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v - 3; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(cv);
  return { map, bump };
}

// slots stacked inside the jar, bottom up, so the pile grows like a real one
function makeSlots() {
  const slots = [];
  const step = CUBE * 1.02;
  let layer = 0;
  while (slots.length < MAX_CUBES) {
    const y = FLOOR + CUBE / 2 + layer * CUBE * 0.93;
    const off = (layer % 2) * step * 0.5;
    const ring = [];
    for (let x = -JAR_R; x <= JAR_R; x += step) {
      for (let z = -JAR_R; z <= JAR_R; z += step) {
        const px = x + off + (Math.random() - 0.5) * 0.03, pz = z + off + (Math.random() - 0.5) * 0.03;
        if (Math.hypot(px, pz) < JAR_R - CUBE * 0.75) ring.push(new THREE.Vector3(px, y, pz));
      }
    }
    // fill each layer from the centre outwards: a mound, not a flat floor
    ring.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z) + (Math.random() - 0.5) * 0.25);
    ring.forEach((p, i) => { p.y += Math.max(0, 0.06 - (i / ring.length) * 0.06); });
    slots.push(...ring);
    layer++;
  }
  return slots.slice(0, MAX_CUBES);
}

export function createSugarJar(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 1.4, 8.4);

  const key = new THREE.DirectionalLight('#fff6ea', 2.4);
  key.position.set(-3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 });
  key.shadow.radius = 5;
  scene.add(key, new THREE.HemisphereLight('#ffffff', '#335548', 0.5));
  const rim = new THREE.DirectionalLight('#ffffff', 1.4);
  rim.position.set(3, 2, -4);
  scene.add(rim);

  const world = new THREE.Group();
  scene.add(world);

  // glass jar: open cylinder with real transmission and a thick base
  // Transmission can't see the page behind a transparent canvas, so the glass is
  // drawn as thin, reflective, mostly transparent shells (back faces first).
  const glassProps = {
    color: '#f4fbf7', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.1,
    clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.2, specularIntensity: 1, depthWrite: false
  };
  const glassBack = new THREE.MeshPhysicalMaterial({ ...glassProps, side: THREE.BackSide, opacity: 0.1 });
  const glass = new THREE.MeshPhysicalMaterial({ ...glassProps, side: THREE.FrontSide });
  const wallProfile = [
    [JAR_R * 0.9, FLOOR - 0.12], [JAR_R + 0.04, FLOOR - 0.08], [JAR_R + 0.06, FLOOR + 0.2],
    [JAR_R + 0.06, FLOOR + JAR_H - 0.1], [JAR_R + 0.1, FLOOR + JAR_H], [JAR_R + 0.03, FLOOR + JAR_H + 0.02],
    [JAR_R, FLOOR + JAR_H - 0.12], [JAR_R, FLOOR]
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const jarGeo = new THREE.LatheGeometry(wallProfile, 96);
  const jarBack = new THREE.Mesh(jarGeo, glassBack);
  jarBack.renderOrder = 1;
  const jar = new THREE.Mesh(jarGeo, glass);
  jar.renderOrder = 3;
  world.add(jarBack, jar);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(JAR_R * 0.98, JAR_R * 0.9, 0.12, 96), glass);
  base.position.y = FLOOR - 0.06;
  base.renderOrder = 3;
  world.add(base);

  // soft contact shadow under the jar
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.ShadowMaterial({ opacity: 0.35, color: '#001a12' }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR - 0.125;
  floor.receiveShadow = true;
  world.add(floor);

  // sugar cubes
  const { map, bump } = sugarTextures();
  const cubeGeo = new RoundedBoxGeometry(CUBE, CUBE, CUBE, 2, 0.018);
  const cubeMat = new THREE.MeshPhysicalMaterial({
    map, bumpMap: bump, bumpScale: 2.2, roughness: 0.62, sheen: 0.6, sheenColor: new THREE.Color('#ffffff'),
    specularIntensity: 0.9, clearcoat: 0.25, clearcoatRoughness: 0.5
  });
  const cubes = new THREE.InstancedMesh(cubeGeo, cubeMat, MAX_CUBES);
  cubes.castShadow = true;
  cubes.receiveShadow = true;
  cubes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cubes.renderOrder = 2;
  // the bounding sphere would be computed while every cube still hangs above the
  // jar (out of view) and never refreshed, culling the whole pile
  cubes.frustumCulled = false;
  world.add(cubes);

  const slots = makeSlots();
  const state = slots.map((slot, i) => ({
    slot,
    rot: new THREE.Euler((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5),
    pos: new THREE.Vector3(slot.x, 4 + Math.random() * 2, slot.z),
    vel: 0, scale: 0, on: false, delay: 0, idx: i
  }));

  let target = 0;
  function setCount(n) {
    const next = Math.max(0, Math.min(MAX_CUBES, Math.round(n)));
    const now = performance.now() / 1000;
    for (let i = 0; i < MAX_CUBES; i++) {
      const s = state[i];
      if (i < next && !s.on) {
        // drop in, staggered so it rains rather than teleports
        s.on = true;
        s.pos.set(s.slot.x + (Math.random() - 0.5) * 0.4, 3.2 + Math.random() * 1.5, s.slot.z + (Math.random() - 0.5) * 0.4);
        s.vel = 0;
        s.delay = now + (i - target) * 0.004 * Math.random() + Math.random() * 0.25;
        s.scale = 1;
        s.spin = new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      } else if (i >= next && s.on) {
        s.on = false; // dissolves
      }
    }
    target = next;
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), e = new THREE.Euler();
  let pointerX = 0, pointerY = 0, rotY = 0;
  canvas.addEventListener('pointermove', (ev) => {
    const r = canvas.getBoundingClientRect();
    pointerX = ((ev.clientX - r.left) / r.width) * 2 - 1;
    pointerY = ((ev.clientY - r.top) / r.height) * 2 - 1;
  });
  canvas.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });

  function resize() {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  let running = false, last = performance.now();
  function frame(nowMs) {
    if (!running) return;
    const dt = Math.min(0.05, (nowMs - last) / 1000);
    last = nowMs;
    const now = nowMs / 1000;
    rotY += (pointerX * 0.5 - rotY) * (1 - Math.pow(0.05, dt));
    world.rotation.y = rotY + Math.sin(now * 0.3) * 0.08;
    camera.position.y = 1.4 - pointerY * 0.4;
    camera.lookAt(0, 0.05, 0);

    for (const s of state) {
      if (s.on) {
        if (now < s.delay) { s.pos.y = 4.5; e.copy(s.rot); }
        else if (s.pos.y > s.slot.y) {
          s.vel -= 22 * dt;
          s.pos.y += s.vel * dt;
          s.pos.x += (s.slot.x - s.pos.x) * Math.min(1, dt * 6);
          s.pos.z += (s.slot.z - s.pos.z) * Math.min(1, dt * 6);
          if (s.pos.y <= s.slot.y) {
            s.pos.y = s.slot.y;
            // little bounce
            if (Math.abs(s.vel) > 2.5) { s.vel = -s.vel * 0.18; s.pos.y += 0.001; } else s.vel = 0;
          }
          e.set(s.rot.x + s.pos.y * s.spin.x * 0.1, s.rot.y + s.pos.y * s.spin.y * 0.1, s.rot.z);
        } else e.copy(s.rot);
        s.scale += (1 - s.scale) * Math.min(1, dt * 10);
      } else {
        // dissolve: shrink with a slight fizz upwards
        s.scale += (0 - s.scale) * Math.min(1, dt * (4 + (s.idx % 7)));
        if (s.scale > 0.01) s.pos.y += dt * 0.25;
        e.copy(s.rot);
      }
      q.setFromEuler(e);
      sc.setScalar(Math.max(0.0001, s.scale));
      m4.compose(s.pos, q, sc);
      cubes.setMatrixAt(s.idx, m4);
    }
    cubes.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  function setRunning(v) {
    if (v === running) return;
    running = v;
    if (v) { last = performance.now(); requestAnimationFrame(frame); }
  }
  return { setCount, setRunning, MAX_CUBES };
}
