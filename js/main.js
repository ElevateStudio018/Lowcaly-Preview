import { FLAVORS, BREAKFAST } from './data.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = matchMedia('(max-width: 760px)').matches;

// ---------------------------------------------------------------- header menu
const header = $('#header');
$('#burger').addEventListener('click', () => {
  const open = header.classList.toggle('is-open');
  $('#burger').setAttribute('aria-expanded', open);
});
$$('#menu a').forEach((a) => a.addEventListener('click', () => {
  header.classList.remove('is-open');
  if (a.dataset.tab) setTab(a.dataset.tab);
  if (a.dataset.filter) setFilter(a.dataset.filter);
}));

// ---------------------------------------------------------------- story markup
const titles = $('.story__titles');
const panels = $('#storyPanels');
const dots = $('#storyDots');
const STEPS = FLAVORS.length + 1;
$('#story').style.setProperty('--steps', STEPS);

FLAVORS.forEach((f, i) => {
  const step = i + 1;
  // the pack sits right on odd steps, so its copy goes left (and vice versa)
  const right = !isMobile && step % 2 === 0;
  titles.insertAdjacentHTML('beforeend',
    `<div class="flavor-title" data-step="${step}" style="--c:${f.deep}">${f.name}<small>${f.category} · Zero sugar</small></div>`);
  panels.insertAdjacentHTML('beforeend', `
    <div class="panel ${right ? 'panel--right' : ''}" data-step="${step}" style="--c:${f.text};--bg:${f.bg}">
      <div class="panel__info">
        ${f.tag ? `<span class="tag">${f.tag}</span>` : ''}
        <h2>Lowcaly ${f.name}</h2>
        <p>${f.desc}</p>
        <a class="btn" href="${f.url}">Läs mer</a>
      </div>
      <ul class="panel__specs">
        <li>1 L</li>
        <li>Sockerfri</li>
        <li>${f.vitamins} vitaminer</li>
        <li>${f.kcal} kcal / 100 ml</li>
      </ul>
    </div>`);
});
['Start', ...FLAVORS.map((f) => f.name)].forEach((name, i) => {
  dots.insertAdjacentHTML('beforeend', `<li><button data-step="${i}" aria-label="${name}"><span>${name}</span></button></li>`);
});

const stepEls = {
  titles: $$('[data-step]', titles),
  panels: $$('[data-step]', panels),
  dots: $$('button', dots)
};

// ---------------------------------------------------------------- color helpers
const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
const mix = (a, b, t) => {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
};
const BG = ['#004a3b', ...FLAVORS.map((f) => f.bg)];
const BLOB = ['#fff3e3', ...FLAVORS.map((f) => f.color)];
const INK = ['#fff3e3', ...FLAVORS.map((f) => f.text)];
const at = (arr, f) => {
  const i = clamp(Math.floor(f), 0, arr.length - 1), j = clamp(i + 1, 0, arr.length - 1);
  const t = f - Math.floor(f);
  const e = t < 0.5 ? 0 : (t - 0.5) * 2; // hold color, then blend during the second half
  return mix(arr[i], arr[j], e * e * (3 - 2 * e));
};

// ---------------------------------------------------------------- organic blob
const blobPath = $('#blobPath');
function blob(t, seed) {
  const n = 8, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 150 + Math.sin(t * 0.7 + i * 1.7 + seed) * 18 + Math.sin(t * 1.1 + i * 2.9 + seed * 2) * 12 + (i % 2 ? 10 : -6);
    pts.push([200 + Math.cos(a) * r, 200 + Math.sin(a) * r]);
  }
  let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    if (i === 0) d += `M${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

// ---------------------------------------------------------------- story overlay update (driven by the 3D loop)
const stage = $('.story__stage');
const storyBg = $('#storyBg');
const blobEl = $('#storyBlob');
const tip = $('#storyTip');
let story = null;
let tipShown = false;
const sp = {};

const heroBg = $('#heroBg');
function updateOverlay(f) {
  storyBg.style.background = at(BG, f);
  heroBg.style.opacity = 1 - clamp(f / 0.85, 0, 1);
  const ink = at(INK, f);
  stage.style.setProperty('--dot', ink);
  stage.style.color = ink;

  // blob follows the active pack
  const active = clamp(Math.round(f), 1, FLAVORS.length) - 1;
  if (story && f > 0.35) {
    story.screenOf(active, sp);
    const d = f - (active + 1);
    const s = clamp(1 - Math.abs(d) * 1.8, 0, 1);
    blobEl.style.transform = `translate(${sp.x}px, ${sp.y}px) translate(-50%,-50%) scale(${0.4 + s * 0.6}) rotate(${d * 90}deg)`;
    blobEl.style.opacity = s;
    blobEl.style.setProperty('--blob', FLAVORS[active].color);
  } else {
    blobEl.style.opacity = 0;
  }
  blobPath.setAttribute('d', blob(performance.now() / 1000, active * 3.1));

  stepEls.titles.forEach((el) => {
    const d = f - +el.dataset.step;
    const o = clamp(1 - Math.abs(d) * 1.6, 0, 1);
    el.style.opacity = o;
    const y = d * -38;
    el.style.transform = el.classList.contains('hero-type')
      ? `translateY(calc(${isMobile ? 0 : -58}% + ${y * 0.8}vh)) scale(${1 + Math.max(0, d) * 0.12})`
      : `translateY(calc(-50% + ${y}vh)) scale(${1 + Math.abs(d) * 0.15})`;
    el.style.visibility = o > 0.001 ? 'visible' : 'hidden';
  });
  stepEls.panels.forEach((el) => {
    const d = f - +el.dataset.step;
    const o = clamp(1 - Math.abs(d) * 2.6, 0, 1);
    el.style.opacity = o;
    el.style.transform = `translateY(${d * -12}vh)`;
    el.classList.toggle('is-live', o > 0.6);
    el.style.visibility = o > 0.001 ? 'visible' : 'hidden';
  });
  const cur = Math.round(f);
  stepEls.dots.forEach((b, i) => b.classList.toggle('is-active', i === cur));

  if (!tipShown && f > 0.8) { tipShown = true; tip.classList.add('is-on'); setTimeout(() => tip.classList.remove('is-on'), 5000); }
}

// ---------------------------------------------------------------- scroll
const storySection = $('#story');
let lenis = null;
function storyProgress() {
  const r = storySection.getBoundingClientRect();
  const vh = innerHeight;
  return clamp(-r.top / vh, 0, STEPS - 1);
}
function onScroll() {
  if (story) story.setProgress(storyProgress());
  // about image parallax
  const m = $('.about__media img');
  const r = m.parentElement.getBoundingClientRect();
  if (r.bottom > 0 && r.top < innerHeight) m.style.transform = `translateY(${(r.top / innerHeight) * -12}%)`;
}

// gentle snap to the nearest flavor once scrolling settles
let snapTimer;
function scheduleSnap() {
  clearTimeout(snapTimer);
  snapTimer = setTimeout(() => {
    const f = storyProgress();
    const target = Math.round(f);
    if (f <= 0 || f >= STEPS - 1 || Math.abs(f - target) < 0.02 || Math.abs(f - target) > 0.38) return;
    const top = storySection.offsetTop + target * innerHeight;
    if (lenis) lenis.scrollTo(top, { duration: 0.9 });
    else scrollTo({ top, behavior: 'smooth' });
  }, 160);
}

function gotoStep(step) {
  const top = storySection.offsetTop + step * innerHeight;
  if (lenis) lenis.scrollTo(top, { duration: 1.6 }); else scrollTo({ top, behavior: 'smooth' });
}
stepEls.dots.forEach((b) => b.addEventListener('click', () => gotoStep(+b.dataset.step)));
$$('[data-goto]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); gotoStep(+a.dataset.goto); }));

// ---------------------------------------------------------------- hero: name of the pack facing us
const heroIdx = $('#heroIdx'), heroName = $('#heroName');
let heroFront = 0, swapTimer;
function onHeroFront(j) {
  if (j === heroFront) return;
  heroFront = j;
  heroName.classList.add('is-swap');
  clearTimeout(swapTimer);
  swapTimer = setTimeout(() => {
    heroName.textContent = FLAVORS[j].name;
    heroIdx.textContent = String(j + 1).padStart(2, '0');
    heroName.classList.remove('is-swap');
  }, 220);
}

// ---------------------------------------------------------------- custom cursor + magnetic buttons
const cursor = $('#cursor'), cursorLabel = $('#cursorLabel');
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion) {
  document.body.classList.add('has-cursor');
  const dot = cursor.firstElementChild, ring = cursor.lastElementChild;
  let mx = -100, my = -100, rx = -100, ry = -100;
  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
  const loop = () => {
    rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
    const el = document.elementFromPoint(mx, my);
    const onDark = el?.closest('.footer, .split__body, .marquee, .ig__text, .loader') || (el?.closest('.story') && storyProgress() < 0.5);
    const b = document.body.classList;
    const label = b.contains('is-grabbing') ? 'Släpp' : b.contains('is-grabbable') ? 'Dra' : b.contains('is-spinnable') ? 'Snurra' : '';
    cursor.classList.toggle('is-label', !!label);
    cursor.classList.toggle('is-link', !label && !!el?.closest('a, button'));
    if (label) cursorLabel.textContent = label;
    cursor.style.setProperty('--cursor', onDark ? '#fff3e3' : (el?.closest('.story') ? stage.style.getPropertyValue('--dot') || '#005745' : '#005745'));
    cursor.style.setProperty('--cursor-ink', onDark ? '#005745' : '#fff3e3');
    requestAnimationFrame(loop);
  };
  loop();
  $$('.btn, .chip').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });
}

// ---------------------------------------------------------------- product shelf
const shelf = $('#shelf');
const shelfItems = [
  ...BREAKFAST.map((b) => ({ ...b, type: 'frukostdryck' })),
  ...FLAVORS.map((f) => ({ ...f, type: 'fruktdryck' }))
];
shelf.innerHTML = shelfItems.map((p) => `
  <a class="shelf__item reveal" data-type="${p.type}" href="${p.url}">
    <img src="assets/img/${p.id}.webp" alt="Lowcaly ${p.name}" loading="lazy">
    <span>${p.name}</span>
  </a>`).join('');
function setTab(tab) {
  $$('.products .pill').forEach((p) => p.classList.toggle('is-active', p.dataset.tab === tab));
  $$('.shelf__item').forEach((el) => el.classList.toggle('is-hidden', tab !== 'alla' && el.dataset.type !== tab));
}
$$('.products .pill').forEach((p) => p.addEventListener('click', () => setTab(p.dataset.tab)));

// ---------------------------------------------------------------- inspiration filter
function setFilter(type) {
  $$('.inspiration .pill').forEach((p) => p.classList.toggle('is-active', p.dataset.filter === type));
  $$('.card').forEach((c) => c.classList.toggle('is-hidden', type !== 'alla' && c.dataset.type !== type));
}
$$('.inspiration .pill').forEach((p) => p.addEventListener('click', () => setFilter(p.dataset.filter)));

// ---------------------------------------------------------------- reveal on scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const sibs = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
    el.style.transitionDelay = `${Math.max(0, sibs.indexOf(el)) * 70}ms`;
    el.classList.add('in');
    io.unobserve(el);
  });
}, { rootMargin: '0px 0px -8% 0px' });
$$('.reveal, .split').forEach((el) => io.observe(el));

// ---------------------------------------------------------------- boot
const loader = $('#loader'), barEl = $('#loaderBar'), pct = $('#loaderPct');
// the bar and the counter animate towards whatever stage loading has reached
let loadTarget = 0, loadShown = 0;
const bar = { style: { set width(v) { loadTarget = parseFloat(v); } } };
(function tick() {
  loadShown += (loadTarget - loadShown) * 0.12;
  barEl.style.width = loadShown + '%';
  pct.textContent = String(Math.round(loadShown)).padStart(3, '0');
  if (loadShown < 99.5) requestAnimationFrame(tick);
  else { barEl.style.width = '100%'; pct.textContent = '100'; }
})();
bar.style.width = '20%';

async function boot() {
  try {
    const { default: Lenis } = await import('lenis');
    if (!reducedMotion) {
      lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
      lenis.on('scroll', () => { onScroll(); scheduleSnap(); });
    }
  } catch (e) { console.warn('Smooth scroll disabled', e); }
  if (!lenis) addEventListener('scroll', () => { onScroll(); scheduleSnap(); }, { passive: true });

  await Promise.race([
    Promise.all([
      document.fonts.load('600 40px "Barlow Condensed"'),
      document.fonts.load('500 40px "Barlow Condensed"'),
      document.fonts.load('400 20px "Crimson Pro"')
    ]),
    new Promise((r) => setTimeout(r, 2500))
  ]);
  bar.style.width = '45%';

  try {
    const { createStory } = await import('./scene.js');
    bar.style.width = '70%';
    story = await createStory({
      canvas: $('#storyCanvas'),
      flavors: FLAVORS,
      reducedMotion,
      onHeroFront,
      onProgress: updateOverlay
    });
    new IntersectionObserver(([e]) => story.setRunning(e.isIntersecting)).observe(storySection);
  } catch (e) {
    console.error('3D scene failed', e);
    document.body.classList.add('no-webgl');
    const fallback = () => { updateOverlay(storyProgress()); requestAnimationFrame(fallback); };
    fallback();
  }
  bar.style.width = '100%';
  onScroll();
  setTimeout(() => {
    loader.classList.add('is-done');
    document.body.classList.add('is-ready');
  }, 600);
}
boot();
