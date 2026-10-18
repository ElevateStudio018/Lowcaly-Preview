// Scroll-driven 3D product story: cartons spin in one by one as you scroll,
// surrounded by floating fruit you can poke and drag.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCarton, CARTON } from './carton.js';
import { FRUIT_FACTORY } from './fruits.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
// ?still disables easing so automated screenshots land exactly on a step
const NO_SMOOTH = new URLSearchParams(location.search).has('still');
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export async function createStory({ canvas, flavors, onProgress, reducedMotion }) {
  const isMobile = matchMedia('(max-width: 760px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  // Lights: warm key with soft shadows, cool fill, rim from behind.
  const key = new THREE.DirectionalLight('#fff4e6', 2.6);
  key.position.set(-3.5, 5, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 5, bottom: -5, near: 1, far: 20 });
  key.shadow.radius = 6;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#e6f0ff', 0.8);
  fill.position.set(5, 1, 4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#ffffff', 1.6);
  rim.position.set(2, 3, -6);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight('#fff8ee', '#d9c7b0', 0.35));

  // ------------------------------------------------------------- cartons
  const cartons = await Promise.all(flavors.map((f) => buildCarton(f, renderer)));
  const items = cartons.map((mesh, j) => {
    const holder = new THREE.Group(); // position/rotation from scroll
    const tilt = new THREE.Group();   // pointer interaction on top
    tilt.add(mesh);
    holder.add(tilt);
    scene.add(holder);
    return { mesh, holder, tilt, step: j + 1, rot: new THREE.Vector2(), rotVel: new THREE.Vector2(), rotTarget: new THREE.Vector2() };
  });

  // ------------------------------------------------------------- fruits
  const fruits = [];
  const pickables = [];
  items.forEach((it, j) => {
    const group = new THREE.Group();
    scene.add(group);
    it.fruitGroup = group;
    const list = flavors[j].fruits.slice(0, isMobile ? 6 : undefined);
    list.forEach((type, k) => {
      const obj = FRUIT_FACTORY[type]();
      const n = list.length;
      // distribute on an ellipse around the carton, alternating front/back
      const a = (k / n) * Math.PI * 2 + j * 0.7 + 0.4;
      const rx = (isMobile ? 1.15 : 1.55) + (k % 3) * 0.22;
      const ry = 1.35 + (k % 2) * 0.25;
      const rest = new THREE.Vector3(Math.cos(a) * rx, Math.sin(a) * ry + 0.1, (k % 2 ? 1 : -1) * (0.55 + (k % 3) * 0.35));
      // keep the pack's front panel readable: push fruit off its centre
      if (Math.abs(rest.x) < 0.9 && Math.abs(rest.y) < 1.2) rest.x = Math.sign(rest.x || 1) * (0.9 + Math.random() * 0.25);
      const pivot = new THREE.Group();
      pivot.add(obj);
      pivot.position.copy(rest);
      obj.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      group.add(pivot);
      const fr = {
        obj, pivot, rest, group,
        off: new THREE.Vector3(), vel: new THREE.Vector3(), target: new THREE.Vector3(),
        spin: new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3),
        wobble: new THREE.Vector3(), wobbleVel: new THREE.Vector3(),
        phase: Math.random() * Math.PI * 2, speed: 0.6 + Math.random() * 0.5,
        scale: 0, owner: j, index: k
      };
      obj.traverse((o) => { o.userData.fruit = fr; });
      fruits.push(fr);
      pickables.push(obj);
    });
  });

  // ------------------------------------------------------------- layout
  let vw = 1, vh = 1, visH = 1, visW = 1;
  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    vw = r.width; vh = r.height;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
    visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    visW = visH * camera.aspect;
  }
  resize();
  addEventListener('resize', resize);

  const sideOf = (step) => (isMobile ? 0 : (step % 2 ? 1 : -1));
  const restX = (step) => sideOf(step) * Math.min(visW * 0.2, 2.1);

  function heroPose(j, out) {
    const n = flavors.length, c = j - (n - 1) / 2;
    const spread = Math.min(isMobile ? 0.62 : 1.08, (visW * 0.86) / n);
    out.x = c * spread;
    out.y = isMobile ? -0.35 : 0.04;
    out.z = -Math.abs(c) * 0.45;
    out.ry = -c * 0.2 - 0.12;
    out.rz = c * 0.025;
    out.rx = 0.06;
    out.s = isMobile ? 0.62 : 0.74;
    return out;
  }

  function flowPose(step, d, out) {
    const dc = clamp(d, -1.25, 1.25);
    const e = Math.sign(dc) * easeInOut(Math.min(1, Math.abs(dc)));
    out.x = restX(step) + e * -sideOf(step) * 0.8;
    out.y = dc * visH * 1.02 + (isMobile ? -0.15 : 0);
    out.z = -Math.abs(e) * 1.2;
    const spin = reducedMotion ? 0.3 : Math.PI * 1.6;
    out.ry = -0.38 * sideOf(step || 1) * (isMobile ? 0 : 1) - 0.18 + e * spin;
    out.rz = -sideOf(step) * 0.07 - e * 0.45;
    out.rx = e * 0.25;
    out.s = isMobile ? 0.82 : 1;
    return out;
  }

  // ------------------------------------------------------------- pointer
  const pointer = new THREE.Vector2(0, 0);
  const pointerSmooth = new THREE.Vector2(0, 0);
  const ray = new THREE.Raycaster();
  let hoverFruit = null, dragFruit = null, dragCarton = null, pointerInside = false;
  const dragStart = new THREE.Vector2();
  const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();

  function updatePointer(e) {
    const r = canvas.getBoundingClientRect();
    pointerInside = e.clientY >= r.top && e.clientY <= r.bottom;
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  function worldAtDepth(z, out) {
    // pointer projected onto plane at given world z
    ray.setFromCamera(pointer, camera);
    const t = (z - ray.ray.origin.z) / ray.ray.direction.z;
    return out.copy(ray.ray.direction).multiplyScalar(t).add(ray.ray.origin);
  }
  function pick() {
    ray.setFromCamera(pointer, camera);
    const hits = ray.intersectObjects(pickables.filter((p) => p.userData.fruit.scale > 0.4), true);
    if (hits.length) return { fruit: hits[0].object.userData.fruit };
    const cartonHits = ray.intersectObjects(items.filter((i) => i.holder.visible).map((i) => i.mesh), true);
    if (cartonHits.length) {
      const it = items.find((i) => cartonHits[0].object.parent === i.mesh || cartonHits[0].object === i.mesh || i.mesh.children.includes(cartonHits[0].object));
      return { carton: it };
    }
    return null;
  }

  addEventListener('pointermove', (e) => {
    updatePointer(e);
    if (dragFruit || dragCarton) return;
    if (!pointerInside || e.pointerType === 'touch') return;
    const hit = pick();
    hoverFruit = hit?.fruit || null;
    document.body.classList.toggle('is-grabbable', !!hit);
  }, { passive: true });

  addEventListener('pointerdown', (e) => {
    updatePointer(e);
    if (!pointerInside) return;
    if (e.target.closest('a,button,input,label')) return;
    const hit = pick();
    if (!hit) return;
    if (e.pointerType === 'touch') {
      // tap = gentle poke
      if (hit.fruit) {
        hit.fruit.vel.add(new THREE.Vector3((Math.random() - 0.5) * 3, 2.5, 1.5));
        hit.fruit.wobbleVel.add(new THREE.Vector3(6, 4, 0));
      } else if (hit.carton) hit.carton.rotVel.x += 5;
      return;
    }
    e.preventDefault();
    dragStart.copy(pointer);
    if (hit.fruit) dragFruit = hit.fruit;
    else dragCarton = hit.carton;
    document.body.classList.add('is-grabbing');
  });

  addEventListener('pointerup', () => {
    if (dragFruit) dragFruit.wobbleVel.add(new THREE.Vector3(4, 6, 2));
    dragFruit = null;
    dragCarton = null;
    document.body.classList.remove('is-grabbing');
  });

  // ------------------------------------------------------------- loop
  let progress = 0, progressSmooth = 0, running = true, last = performance.now();
  const pose = {}, poseB = {};

  function setProgress(p) { progress = p; }
  function setRunning(v) { running = v; if (v) { last = performance.now(); requestAnimationFrame(frame); } }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    progressSmooth = NO_SMOOTH ? progress : lerp(progressSmooth, progress, 1 - Math.pow(0.0008, dt));
    if (Math.abs(progressSmooth - progress) < 0.0005) progressSmooth = progress;
    const f = progressSmooth;
    const heroBlend = smoothstep(0, 1, f);
    onProgress?.(f);

    pointerSmooth.lerp(pointer, 1 - Math.pow(0.02, dt));
    camera.position.x = pointerSmooth.x * 0.18;
    camera.position.y = pointerSmooth.y * 0.12;
    camera.lookAt(0, 0, 0);

    items.forEach((it, j) => {
      const d = f - it.step;
      heroPose(j, pose);
      flowPose(it.step, d, poseB);
      const b = it.step === 1 ? heroBlend : smoothstep(0, 0.7, f);
      const P = {};
      for (const k in pose) P[k] = lerp(pose[k], poseB[k], b);
      // hero idle float
      const idle = reducedMotion ? 0 : 1;
      P.y += Math.sin(t * 0.9 + j) * 0.04 * idle;
      P.ry += Math.sin(t * 0.5 + j * 1.3) * 0.05 * idle;

      it.holder.position.set(P.x, P.y, P.z);
      it.holder.rotation.set(P.rx, P.ry, P.rz);
      it.holder.scale.setScalar(P.s);
      const onScreen = Math.abs(P.y) < visH * 0.5 + CARTON.h;
      it.holder.visible = onScreen;

      // pointer tilt / drag springs
      if (dragCarton === it) {
        it.rotTarget.set(clamp((pointer.x - dragStart.x) * 2.2, -0.7, 0.7), clamp(-(pointer.y - dragStart.y) * 1.4, -0.35, 0.35));
      } else if (Math.abs(d) < 0.5 || f < 0.5) {
        it.rotTarget.set(pointerSmooth.x * 0.22, -pointerSmooth.y * 0.1);
      } else it.rotTarget.set(0, 0);
      const ax = 70 * (it.rotTarget.x - it.rot.x) - 9 * it.rotVel.x;
      const ay = 70 * (it.rotTarget.y - it.rot.y) - 9 * it.rotVel.y;
      it.rotVel.x += ax * dt; it.rotVel.y += ay * dt;
      it.rot.x += it.rotVel.x * dt; it.rot.y += it.rotVel.y * dt;
      it.tilt.rotation.set(it.rot.y, it.rot.x, 0);

      // fruit cluster follows the carton (not its spin)
      const vis = Math.max(1 - smoothstep(0.15, 0.95, Math.abs(d)), (1 - heroBlend) * 0.75);
      it.fruitGroup.position.set(P.x, P.y + (isMobile ? 0 : d * 0.6), P.z * 0.5);
      it.fruitGroup.userData.vis = onScreen ? vis : 0;
      it.fruitGroup.userData.d = d;
      it.fruitGroup.userData.blend = b;
      it.fruitGroup.visible = onScreen && vis > 0.01;
    });

    for (const fr of fruits) {
      const g = fr.group.userData;
      // only a few fruit per pack in the crowded hero line-up
      const targetScale = g.vis * (g.blend < 0.5 && fr.index > 3 ? smoothstep(0.15, 0.5, g.blend) : 1);
      fr.scale = NO_SMOOTH ? targetScale : lerp(fr.scale, targetScale, 1 - Math.pow(0.002, dt));
      const s = fr.scale < 0.002 ? 0.0001 : fr.scale;
      // pop-in with a little overshoot
      fr.pivot.scale.setScalar(s * (1 + Math.sin(s * Math.PI) * 0.12));

      // float
      const bob = reducedMotion ? 0 : Math.sin(t * fr.speed + fr.phase) * 0.08;
      // in the hero all packs stand in a row, so their fruit hugs them tightly
      const rx = lerp(0.62, 1, g.blend), ry = lerp(0.42, 1, g.blend);
      fr.pivot.position.set(fr.rest.x * rx, fr.rest.y * ry + bob, fr.rest.z * rx);
      // scroll scatter: fruits fly outward as the pack spins away
      const sc = clamp(Math.abs(g.d ?? 0) - 0.1, 0, 1) * 1.6 * g.blend;
      fr.pivot.position.x += Math.sign(fr.rest.x || 1) * sc;
      fr.pivot.position.y += (fr.rest.y) * sc * 0.6;

      // interaction target
      fr.target.set(0, 0, 0);
      if (dragFruit === fr) {
        fr.pivot.getWorldPosition(tmpW);
        worldAtDepth(tmpW.z, tmpV);
        tmpV.sub(tmpW);
        const len = tmpV.length();
        const max = 0.55;
        // rubber band: easy at first, stiff near the limit
        if (len > 0) tmpV.multiplyScalar((max * Math.tanh(len / max)) / len);
        fr.target.copy(tmpV);
        fr.target.z = 0.25;
      } else if (hoverFruit === fr || (!dragFruit && pointerInside)) {
        fr.pivot.getWorldPosition(tmpW);
        worldAtDepth(tmpW.z, tmpV);
        const away = tmpW.clone().sub(tmpV);
        away.z = 0;
        const dist = away.length();
        const R = 0.75 * Math.max(0.4, fr.scale);
        if (dist < R && dist > 0.0001) fr.target.copy(away.multiplyScalar(((R - dist) / R) * 0.32 / dist));
      }
      // spring
      const k = dragFruit === fr ? 120 : 55, c = dragFruit === fr ? 14 : 6.5;
      tmpV.copy(fr.target).sub(fr.off).multiplyScalar(k).addScaledVector(fr.vel, -c);
      fr.vel.addScaledVector(tmpV, dt);
      fr.off.addScaledVector(fr.vel, dt);
      fr.pivot.position.add(fr.off);

      // wobble rotation + idle spin
      tmpV.copy(fr.wobble).multiplyScalar(-40).addScaledVector(fr.wobbleVel, -4);
      fr.wobbleVel.addScaledVector(tmpV, dt);
      fr.wobble.addScaledVector(fr.wobbleVel, dt);
      fr.wobble.x += fr.vel.y * dt * 0.8;
      fr.wobble.z -= fr.vel.x * dt * 0.8;
      const idle = reducedMotion ? 0 : 1;
      fr.obj.rotation.x += fr.spin.x * dt * idle;
      fr.obj.rotation.y += fr.spin.y * dt * idle;
      fr.obj.rotation.z += fr.spin.z * dt * idle;
      fr.pivot.rotation.set(fr.wobble.x, fr.wobble.y, fr.wobble.z);
      fr.pivot.visible = fr.scale > 0.003;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // project a carton's center to screen px (used for the CSS blob)
  function screenOf(j, out = {}) {
    items[j].holder.getWorldPosition(tmpV).project(camera);
    out.x = (tmpV.x * 0.5 + 0.5) * vw;
    out.y = (-tmpV.y * 0.5 + 0.5) * vh;
    return out;
  }

  return { setProgress, setRunning, screenOf, resize };
}
