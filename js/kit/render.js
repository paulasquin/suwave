// Renderers for the plain (non-3D) sections: timeline, journal with lazy
// visualisations, stat grid, horizontal bar comparison, tiles and slides.
import { $, $$ } from './page.js';
import { nf, t } from './i18n.js';
import { createChart } from './charts.js';

/** items: [{ date, title, text }] into an <ol class="timeline">. */
export function renderTimeline(el, items) {
  el.innerHTML = items.map((x) => `
    <li class="reveal"><div class="tl-date">${x.date}</div><div class="tl-title">${x.title}</div><p class="tl-text">${x.text}</p></li>`).join('');
}

/**
 * entries: [{ id, num, date, year, title, question, body: [p], result, limit,
 *             viz: { type, … }, media: [{ src, caption, contain }], variant }]
 * viz types handled here: 'chart' ({ chart: key } looked up in opts.charts),
 * 'viewer' ({ models: [{ name, y }], label }). Others go to opts.viz[type](el, viz).
 * Photos named assets/photos/x.webp get their thumbnail from assets/photos/x-s.webp.
 */
export function renderJournal(el, entries, opts = {}) {
  el.innerHTML = entries.map((e) => {
    const media = (e.media || []).map((m, i) => `
      <figure data-lightbox="${e.id}" data-i="${i}">
        <div class="thumb ${m.contain ? 'contain' : ''}"><img src="${m.src.replace(/(assets\/photos\/[^.]+)\.webp$/, '$1-s.webp')}" data-full="${m.src}" alt="${m.caption}" loading="lazy"></div>
        <figcaption>${m.caption}</figcaption>
      </figure>`).join('');
    return `
    <article class="entry ${e.variant || ''}" id="entry-${e.id}">
      <div class="entry-mark">
        <div class="entry-num">${e.num}</div>
        <div class="entry-date">${e.date || ''}</div>
        ${e.year ? `<div class="entry-year">${e.year}</div>` : ''}
      </div>
      <div class="entry-body reveal">
        <h3>${e.title}</h3>
        ${e.question ? `<p class="entry-q">${e.question}</p>` : ''}
        <div class="entry-grid">
          <div class="entry-text">
            ${(e.body || []).map((p) => `<p>${p}</p>`).join('')}
            ${e.result ? `<div class="entry-result"><b>${t('journal.result')}</b>${e.result}</div>` : ''}
            ${e.limit ? `<p class="entry-limit">${e.limit}</p>` : ''}
          </div>
          ${e.viz ? `<div class="entry-viz" data-viz='${JSON.stringify(e.viz)}'></div>` : ''}
        </div>
        ${media ? `<div class="entry-media">${media}</div>` : ''}
      </div>
    </article>`;
  }).join('');

  // Visualisations are built when they approach the viewport.
  const io = new IntersectionObserver((list) => list.forEach(async (en) => {
    if (!en.isIntersecting) return;
    io.unobserve(en.target);
    const box = en.target;
    const viz = JSON.parse(box.dataset.viz);
    if (viz.type === 'chart') {
      const c = document.createElement('div');
      c.className = 'chart';
      box.appendChild(c);
      createChart(c, opts.charts[viz.chart]()).play(2.4);
    } else if (viz.type === 'viewer') {
      const { createViewer } = await import('./viewer.js');
      const c = document.createElement('div');
      box.appendChild(c);
      createViewer(c, { models: viz.models, label: viz.label || '' });
    } else {
      opts.viz?.[viz.type]?.(box, viz);
    }
  }), { rootMargin: '200px' });
  $$('.entry-viz', el).forEach((v) => io.observe(v));
}

/** items: [{ value, decimals, unit, label, note, accent }] — numbers count up when visible. */
export function renderStats(el, items) {
  el.innerHTML = items.map((r) => `
    <div class="result ${r.accent ? 'accent' : ''} reveal">
      <div class="result-value"><span data-count="${r.value}" data-decimals="${r.decimals || 0}">0</span><small>${r.unit}</small></div>
      <p class="result-label">${r.label}</p>
      ${r.note ? `<p class="result-note">${r.note}</p>` : ''}
    </div>`).join('');
}

/**
 * Horizontal bars, linear or logarithmic: items [{ name, detail, value, kind }]
 * (kind = CSS modifier: 'ion', 'chem', 'me'…). opts: { unit, log: [min, max], scale: [labels] }.
 */
export function renderBars(el, items, { unit = '', log = null, scale = null } = {}) {
  const max = Math.max(...items.map((i) => i.value));
  const w = (v) => (log ? (Math.log10(v) - Math.log10(log[0])) / (Math.log10(log[1]) - Math.log10(log[0])) : v / max);
  el.classList.add('bars');
  el.setAttribute('data-in', '');
  el.innerHTML = items.map((r) => `
    <div class="bars-row ${r.kind || ''}">
      <div class="bars-head"><span><b>${r.name}</b><small>${r.detail || ''}</small></span><span class="bars-val">${nf(r.value)} ${unit}</span></div>
      <div class="bars-bar"><i style="--w:${(Math.max(0.02, w(r.value)) * 100).toFixed(1)}%"></i></div>
    </div>`).join('') + (scale ? `<div class="bars-scale">${scale.map((x) => `<span>${x}</span>`).join('')}</div>` : '');
}

/** items: [{ year, name, tag, text, highlight }] as small cards. */
export function renderTiles(el, items) {
  el.innerHTML = items.map((m) => `
    <article class="tile reveal ${m.highlight ? 'highlight' : ''}">
      <div class="tile-year">${m.year}</div>
      <div class="tile-name">${m.name}</div>
      ${m.tag ? `<div class="tile-tag">${m.tag}</div>` : ''}
      <p>${m.text}</p>
    </article>`).join('');
}

/** slides: [{ n, title, text }], src(n) gives the image URL. Uses the #slides markup of index.html. */
export function setupSlides(slides, src) {
  const root = $('#slides');
  if (!root) return;
  let n = 0;
  const thumbs = $('.slides-thumbs', root);
  thumbs.innerHTML = slides.map((s, i) => `<button aria-label="${t('slide.thumb', { n: s.n })}" data-i="${i}"><img src="${src(s.n)}" alt="" loading="lazy"></button>`).join('');
  const img = $('.slides-main img', root);
  const show = (i) => {
    n = (i + slides.length) % slides.length;
    const s = slides[n];
    gsap.to(img, { opacity: 0, duration: 0.18, onComplete: () => {
      img.src = src(s.n);
      img.alt = t('slide.alt', { n: s.n, title: s.title });
      img.onload = () => gsap.to(img, { opacity: 1, duration: 0.3 });
    } });
    $('.slides-n', root).textContent = String(s.n).padStart(2, '0');
    $('.slides-title', root).textContent = s.title;
    $('.slides-text', root).textContent = s.text;
    $$('button', thumbs).forEach((b, k) => b.classList.toggle('on', k === n));
  };
  thumbs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(+b.dataset.i); });
  $('.slides-nav.prev', root).addEventListener('click', () => show(n - 1));
  $('.slides-nav.next', root).addEventListener('click', () => show(n + 1));
  addEventListener('keydown', (e) => {
    const r = root.getBoundingClientRect();
    if (r.top > innerHeight || r.bottom < 0 || !$('#lightbox')?.hidden) return;
    if (e.key === 'ArrowRight') show(n + 1);
    if (e.key === 'ArrowLeft') show(n - 1);
  });
  show(0);
}
