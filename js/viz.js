// Custom journal visualisations: { tracks } draws the real drift tracks on the lake outline (SVG).
import { LANG } from './kit/i18n.js';

const COLORS = ['#ffb45e', '#67d8d0', '#ff7a8a', '#9fb4ff'];

export const VIZ = {
  async tracks(box, viz) {
    const { LAKES } = await import('./data/lakes.js');
    const lake = LAKES[viz.lake];
    const xs = lake.rings[0].outer.map((p) => p[0]), ys = lake.rings[0].outer.map((p) => p[1]);
    const pad = 40, x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
    const path = (ring) => ring.map(([x, y], i) => `${i ? 'L' : 'M'}${(x - x0).toFixed(0)},${(y1 - y).toFixed(0)}`).join('') + 'Z';
    const lines = lake.tracks.map((t, i) => `<path class="trk" style="--c:${COLORS[i % 4]}" d="${t.pts.map(([, x, y], k) => `${k ? 'L' : 'M'}${(x - x0).toFixed(1)},${(y1 - y).toFixed(1)}`).join('')}"/>`).join('');
    const label = LANG === 'fr' ? 'Trajectoires GPS réelles · 2 août 2017 (100 m)' : 'Real GPS tracks · 2 August 2017 (100 m)';
    box.innerHTML = `<svg class="mini-lake" viewBox="0 0 ${x1 - x0} ${y1 - y0}" role="img" aria-label="${label}">
      <path class="lake" d="${lake.rings.map((r) => path(r.outer) + r.holes.map(path).join('')).join('')}"/>
      ${lines}
      <g class="scale"><line x1="${x1 - x0 - 140}" y1="${y1 - y0 - 24}" x2="${x1 - x0 - 40}" y2="${y1 - y0 - 24}"/></g>
    </svg><div class="viz-caption"><span>${label}</span><span>N ↑</span></div>`;
    requestAnimationFrame(() => box.querySelectorAll('.trk').forEach((p, i) => {
      const L = p.getTotalLength();
      p.style.strokeDasharray = L;
      p.style.strokeDashoffset = L;
      p.style.transition = `stroke-dashoffset 2.4s ${0.2 + i * 0.25}s cubic-bezier(.3,.6,.2,1)`;
      requestAnimationFrame(() => { p.style.strokeDashoffset = 0; });
    }));
  },
};
