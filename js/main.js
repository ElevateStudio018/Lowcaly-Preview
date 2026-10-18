import { FLAVORS, BREAKFAST } from './data.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = matchMedia('(max-width: 760px)').matches;
const isTouch = matchMedia('(pointer: coarse)').matches;

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
const STEPS = FLAVORS.length;
$('#story').style.setProperty('--steps', STEPS);

FLAVORS.forEach((f, i) => {
  const step = i;
  // the pack sits right on even steps, so its copy goes left (and vice versa)
  const right = !isMobile && step % 2 === 1;
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
FLAVORS.map((f) => f.name).forEach((name, i) => {
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
const BG = FLAVORS.map((f) => f.bg);
const INK = FLAVORS.map((f) => f.text);
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
let story = null;
const sp = {};

let lastF = -1;
function updateOverlay(f) {
  // the 3D loop calls this every frame; only touch the DOM when the scroll moved
  const moved = Math.abs(f - lastF) > 0.0005;
  if (!moved) { if (!isTouch) blobPath.setAttribute('d', blob(performance.now() / 1000, clamp(Math.round(f), 0, FLAVORS.length - 1) * 3.1)); return; }
  lastF = f;
  storyBg.style.background = at(BG, f);
  const ink = at(INK, f);
  stage.style.setProperty('--dot', ink);
  stage.style.color = ink;

  // blob follows the active pack
  const active = clamp(Math.round(f), 0, FLAVORS.length - 1);
  if (story) {
    story.screenOf(active, sp);
    const d = f - active;
    const s = clamp(1 - Math.abs(d) * 1.8, 0, 1);
    blobEl.style.transform = `translate(${sp.x}px, ${sp.y}px) translate(-50%,-50%) scale(${0.4 + s * 0.6}) rotate(${d * 90}deg)`;
    blobEl.style.opacity = s;
    blobPath.style.fill = FLAVORS[active].color;
  } else {
    blobEl.style.opacity = 0;
  }
  blobPath.setAttribute('d', blob(performance.now() / 1000, active * 3.1));

  stepEls.titles.forEach((el) => {
    const d = f - +el.dataset.step;
    const o = clamp(1 - Math.abs(d) * 1.6, 0, 1);
    el.style.opacity = o;
    const y = d * -38;
    el.style.transform = `translateY(calc(-50% + ${y}vh)) scale(${1 + Math.abs(d) * 0.15})`;
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

}

// ---------------------------------------------------------------- scroll
const storySection = $('#story');
let lenis = null;
// one step = one 100svh of scroll; measured from the section so the moving
// mobile URL bar (which changes innerHeight) can't make the story jump
let stepPx = innerHeight;
const measureStep = () => { stepPx = storySection.offsetHeight / (STEPS + 0.6); };
measureStep();
addEventListener('resize', measureStep);
function storyProgress() {
  const r = storySection.getBoundingClientRect();
  return clamp(-r.top / stepPx, 0, STEPS - 1);
}
function onScroll() {
  if (story) story.setProgress(storyProgress());
  // hero photo drifts slower than the page
  const h = $('.hero__media');
  const hr = $('.hero').getBoundingClientRect();
  if (hr.bottom > 0) h.style.transform = `translateY(${scrollY * 0.3}px)`;
  // about image parallax
  const m = $('.about__media img');
  const r = m.parentElement.getBoundingClientRect();
  if (r.bottom > 0 && r.top < innerHeight) m.style.transform = `translateY(${(r.top / innerHeight) * -12}%)`;
}

// gentle snap to the nearest flavor once scrolling settles
let snapTimer;
function scheduleSnap() {
  if (isTouch) return; // fighting momentum scrolling on phones feels like lag
  clearTimeout(snapTimer);
  snapTimer = setTimeout(() => {
    const f = storyProgress();
    const target = Math.round(f);
    if (f <= 0 || f >= STEPS - 1 || Math.abs(f - target) < 0.02 || Math.abs(f - target) > 0.38) return;
    const top = storySection.offsetTop + target * stepPx;
    if (lenis) lenis.scrollTo(top, { duration: 0.9 });
    else scrollTo({ top, behavior: 'smooth' });
  }, 160);
}

function gotoStep(step) {
  const top = storySection.offsetTop + step * stepPx;
  if (lenis) lenis.scrollTo(top, { duration: 1.6 }); else scrollTo({ top, behavior: 'smooth' });
}
stepEls.dots.forEach((b) => b.addEventListener('click', () => gotoStep(+b.dataset.step)));
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const el = a.getAttribute('href').length > 1 && $(a.getAttribute('href'));
  if (!el || !lenis) return;
  e.preventDefault();
  lenis.scrollTo(el, { duration: 1.6, offset: el.id === 'story' ? 0 : -70 });
}));

// ---------------------------------------------------------------- magnetic buttons
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion) {
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

// ---------------------------------------------------------------- sugar calculator
const sugarSection = $('#socker');
const sugarUI = {
  per100: 8.8, kcal100: 45, glasses: 2, mode: 'regular',
  cubes: $('#sCubes'), kg: $('#sKg'), kcal: $('#sKcal'), save: $('#sSave')
};
const LOWCALY = { sugar: 0.5, kcal: 3 };
const CUBE_G = 4, PER_BIT = 25, GLASS_ML = 250;
let jar = null;
const nf = new Intl.NumberFormat('sv-SE');
const nf1 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const shown = { cubes: 0, kg: 0, kcal: 0 };

function yearly(sugarPer100, kcalPer100) {
  const ml = sugarUI.glasses * GLASS_ML * 365;
  const grams = (ml / 100) * sugarPer100;
  return { grams, cubes: grams / CUBE_G, kcal: (ml / 100) * kcalPer100 };
}
function tweenNumbers(to) {
  const from = { ...shown }, t0 = performance.now(), dur = 900;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    for (const key in to) shown[key] = from[key] + (to[key] - from[key]) * e;
    // Lowcaly is labelled "< 0,5 g sugar", so its figures are upper bounds
    const lt = sugarUI.mode === 'lowcaly' ? '< ' : '';
    sugarUI.cubes.textContent = lt + nf.format(Math.round(shown.cubes));
    sugarUI.kg.textContent = lt + nf1.format(shown.kg);
    sugarUI.kcal.textContent = nf.format(Math.round(shown.kcal / 100) * 100);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function updateSugar() {
  const reg = yearly(sugarUI.per100, sugarUI.kcal100);
  const low = yearly(LOWCALY.sugar, LOWCALY.kcal);
  const cur = sugarUI.mode === 'lowcaly' ? low : reg;
  tweenNumbers({ cubes: cur.cubes, kg: cur.grams / 1000, kcal: cur.kcal });
  const savedKg = (reg.grams - low.grams) / 1000;
  sugarUI.save.innerHTML = sugarUI.mode === 'lowcaly'
    ? `Du slipper <b>${nf1.format(savedKg)} kg socker</b> och <b>${nf.format(Math.round((reg.kcal - low.kcal) / 100) * 100)} kcal</b> om året.`
    : `Det motsvarar <b>${nf.format(Math.round(reg.cubes / 365))} sockerbitar</b> varje dag.`;
  // Lowcaly rounds to zero sugar on the label, so the jar empties completely
  jar?.setCount(sugarUI.mode === 'lowcaly' ? 0 : cur.cubes / PER_BIT);
}
$$('.seg button').forEach((b) => b.addEventListener('click', () => {
  $$('.seg button').forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-checked', x === b); });
  sugarUI.per100 = +b.dataset.sugar;
  sugarUI.kcal100 = +b.dataset.kcal;
  updateSugar();
}));
const glassesIn = $('#glasses');
glassesIn.addEventListener('input', () => {
  sugarUI.glasses = +glassesIn.value;
  $('#glassesOut').textContent = glassesIn.value;
  glassesIn.style.setProperty('--fill', `${((glassesIn.value - 1) / 7) * 100}%`);
  updateSugar();
});
$$('.switch button').forEach((b) => b.addEventListener('click', () => {
  sugarUI.mode = b.dataset.mode;
  $$('.switch button').forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-selected', x === b); });
  const low = sugarUI.mode === 'lowcaly';
  $('.switch').classList.toggle('is-lowcaly', low);
  sugarSection.classList.toggle('is-lowcaly', low);
  updateSugar();
}));
// build the 3D jar only when the section comes near, then fill it as it enters
let sugarStarted = false;
new IntersectionObserver(([e]) => {
  if (e.isIntersecting && !sugarStarted) {
    sugarStarted = true;
    import('./sugar.js').then(({ createSugarJar }) => {
      jar = createSugarJar($('#sugarCanvas'));
      jar.setRunning(true);
      setTimeout(updateSugar, 300);
    }).catch((err) => { console.warn('Sugar jar unavailable', err); updateSugar(); });
  }
  jar?.setRunning(e.isIntersecting);
}, { rootMargin: '200px 0px' }).observe(sugarSection);

// ---------------------------------------------------------------- hero video
// The poster image paints first; the right-sized loop fades in once it can play.
const heroVideo = $('#heroVideo');
if (heroVideo && !reducedMotion && !navigator.connection?.saveData) {
  const mobile = matchMedia('(max-width: 760px)').matches;
  heroVideo.poster = mobile ? 'assets/img/hero-mobile.webp' : 'assets/img/hero.webp';
  if (mobile) $('.hero__media img').src = 'assets/img/hero-mobile.webp';
  // 4K only where the screen can actually show it (large or high-DPI displays)
  const physicalWidth = innerWidth * Math.min(devicePixelRatio, 2);
  let src = mobile ? heroVideo.dataset.mobile : physicalWidth >= 2400 ? heroVideo.dataset['4k'] : heroVideo.dataset.hd;
  // raw.githack (the preview host) refuses video files, so pull them from jsDelivr there.
  // Pinned to the commit that added the videos; the files themselves never change.
  if (location.hostname.endsWith('githack.com')) {
    src = 'https://cdn.jsdelivr.net/gh/ElevateStudio018/Lowcaly-Preview@3fc92c1f85b533b062151b88ced7eb6354a2cda6/' + src;
  }
  heroVideo.src = src;
  heroVideo.preload = 'auto';
  heroVideo.addEventListener('playing', () => heroVideo.classList.add('is-playing'), { once: true });
  heroVideo.play().catch(() => {});
  // pause off-screen to save battery
  new IntersectionObserver(([e]) => (e.isIntersecting ? heroVideo.play().catch(() => {}) : heroVideo.pause())).observe(heroVideo);
} else if (matchMedia('(max-width: 760px)').matches) {
  $('.hero__media img').src = 'assets/img/hero-mobile.webp';
}

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
    // smooth wheel scrolling on desktop only; phones keep their native scroll
    if (!reducedMotion && !isTouch) {
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
