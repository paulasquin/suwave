// Small SVG line charts with a progressive "pen" reveal and a hover read-out.
import { LOCALE } from './i18n.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
};
const fmt = (v, d = 2) => v.toLocaleString(LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d });

export const PALETTE = {
  ion: '#6fd6ff', ion2: '#8f86ff', cl: '#74f2c4', na: '#ffb45e', thrust: '#ff6b3d', dim: '#5d6b88',
};

/**
 * Line chart from a config:
 *   { x: { label, min, max, ticks, unit, d }, y: { … },
 *     series: [{ name, color, data: [[x, y], …], dots, dash }],
 *     notes: [{ x, y, text }] }
 * Returns { setReveal(0-1), play(seconds) } — the pen reveal can be driven by a 3D act.
 */
export function createChart(container, cfg) {
  const key = (cfg.id || 'chart').replace(/\W/g, '');
  const box = container.getBoundingClientRect();
  const W = 640, H = Math.round(W * (box.height && box.width ? box.height / box.width : 9 / 16));
  const m = { l: 52, r: 18, t: 18, b: 44 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const sx = (x) => m.l + ((x - cfg.x.min) / (cfg.x.max - cfg.x.min)) * iw;
  const sy = (y) => m.t + (1 - (y - cfg.y.min) / (cfg.y.max - cfg.y.min)) * ih;

  container.innerHTML = '';
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': cfg.series.map((s) => s.name).join(', ') }, container);
  const grid = el('g', { class: 'grid' }, svg);
  const axis = el('g', { class: 'axis' }, svg);
  cfg.y.ticks.forEach((v) => {
    el('line', { x1: m.l, x2: W - m.r, y1: sy(v), y2: sy(v) }, grid);
    el('text', { x: m.l - 8, y: sy(v) + 3, 'text-anchor': 'end' }, axis).textContent = fmt(v, v % 1 ? (String(v).split('.')[1].length) : 0);
  });
  cfg.x.ticks.forEach((v) => {
    el('line', { x1: sx(v), x2: sx(v), y1: m.t, y2: H - m.b }, grid);
    el('text', { x: sx(v), y: H - m.b + 16, 'text-anchor': 'middle' }, axis).textContent = v.toLocaleString(LOCALE);
  });
  el('text', { class: 'axis-label', x: m.l + iw, y: H - 6, 'text-anchor': 'end' }, svg).textContent = cfg.x.label;
  el('text', { class: 'axis-label', x: 12, y: m.t + ih / 2, transform: `rotate(-90 12 ${m.t + ih / 2})`, 'text-anchor': 'middle' }, svg).textContent = cfg.y.label;

  const clipId = `clip-${key}-${Math.random().toString(36).slice(2, 7)}`;
  const clip = el('clipPath', { id: clipId }, el('defs', {}, svg));
  const clipRect = el('rect', { x: m.l - 6, y: 0, width: 0, height: H }, clip);
  const plot = el('g', { 'clip-path': `url(#${clipId})` }, svg);

  cfg.series.forEach((s) => {
    const d = s.data.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join('');
    // Soft halo without an SVG/CSS blur filter: blur forces a costly repaint on every reveal step.
    el('path', { d, class: 'series', stroke: s.color, 'stroke-width': 7, opacity: 0.08 }, plot);
    el('path', { d, class: 'series', stroke: s.color, ...(s.dash ? { 'stroke-dasharray': s.dash } : {}) }, plot);
    if (s.dots) {
      const g = el('g', { class: 'dots' }, plot);
      s.data.forEach(([x, y]) => el('circle', { cx: sx(x), cy: sy(y), r: 2.6, fill: s.color }, g));
    }
  });
  (cfg.notes || []).forEach((n) => {
    el('text', { x: sx(n.x), y: sy(n.y), fill: '#b4bfd3', 'font-size': 11, 'font-family': 'JetBrains Mono, monospace', 'text-anchor': 'middle' }, plot).textContent = n.text;
  });

  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = cfg.series.map((s) => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('');
  container.appendChild(legend);

  // Hover read-out.
  const tip = document.createElement('div');
  tip.className = 'tip';
  container.appendChild(tip);
  const cursor = el('line', { class: 'cursor', y1: m.t, y2: H - m.b, x1: -10, x2: -10 }, svg);
  const marker = el('circle', { r: 5, fill: 'none', stroke: '#fff', 'stroke-width': 1.5, cx: -10, cy: -10, opacity: 0 }, svg);
  let reveal = 0;
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const py = ((e.clientY - r.top) / r.height) * H;
    let best = null;
    cfg.series.forEach((s) => s.data.forEach(([x, y]) => {
      const dx = sx(x) - px, dy = sy(y) - py, d = dx * dx + dy * dy * 0.6;
      if (sx(x) <= m.l + iw * reveal + 1 && (!best || d < best.d)) best = { d, x, y, s };
    }));
    if (!best || best.d > 2500) { tip.style.opacity = 0; marker.setAttribute('opacity', 0); cursor.setAttribute('x1', -10); cursor.setAttribute('x2', -10); return; }
    marker.setAttribute('opacity', 1);
    cursor.setAttribute('x1', sx(best.x)); cursor.setAttribute('x2', sx(best.x));
    marker.setAttribute('cx', sx(best.x)); marker.setAttribute('cy', sy(best.y));
    marker.setAttribute('stroke', best.s.color);
    tip.innerHTML = `${best.s.name}<br><b>${fmt(best.y, cfg.y.d)} ${cfg.y.unit}</b> · ${fmt(best.x, cfg.x.d)} ${cfg.x.unit}`;
    tip.style.left = `${(sx(best.x) / W) * 100}%`;
    tip.style.top = `${(sy(best.y) / H) * 100}%`;
    tip.style.opacity = 1;
  });
  svg.addEventListener('pointerleave', () => { tip.style.opacity = 0; marker.setAttribute('opacity', 0); });

  const api = {
    setReveal(f) {
      const next = Math.max(0, Math.min(1, f));
      if (Math.abs(next - reveal) < 0.004 && next !== 0 && next !== 1) return;
      reveal = next;
      clipRect.setAttribute('width', (iw + 12) * reveal + 6);
    },
    play(duration = 2.2) {
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / (duration * 1000));
        api.setReveal(1 - Math.pow(1 - k, 3));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
  };
  api.setReveal(0);
  return api;
}
