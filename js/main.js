// SUWAVE page wiring: strings, plain sections, the four acts, the drift lab, boot.
import { registerStrings, applyStatic, LANG } from './kit/i18n.js';
import { STRINGS } from './strings.js';
import {
  $, capture, debug, setupAnchors, webglOK, setupStage, bindActs, setupPanels, setupReveals,
  setupNav, setupLightbox, setupVideo, loaderProgress, finishBoot,
} from './kit/page.js';
import { renderTimeline, renderJournal, renderStats, renderBars, renderTiles } from './kit/render.js';
import { createChart } from './kit/charts.js';
import { TIMELINE, ENTRIES, STATS, BARS, TILES, TEAM, SOURCES, CHARTS, THANKS } from './content.js';
import { THANKS_EN } from './content.en.js';
import { VIZ } from './viz.js';

registerStrings(STRINGS);

function renderTeam() {
  $('#team').innerHTML = TEAM.map((p) => `
    <article class="person reveal ${p.me ? 'me' : ''}">
      <div class="person-name">${p.name}</div>
      <div class="person-role">${p.role}</div>
      ${p.text ? `<p>${p.text}</p>` : ''}
    </article>`).join('') + `<p class="thanks reveal">${LANG === 'en' ? THANKS_EN : THANKS}</p>`;
  $('#sources').innerHTML = SOURCES.map((s) => `<li>${s.url ? `<a href="${s.url}" target="_blank" rel="noopener">${s.title}</a>` : `<b>${s.title}</b>`}${s.note ? ` — <span>${s.note}</span>` : ''}</li>`).join('');
}

async function boot() {
  applyStatic();
  setupAnchors();
  renderTimeline($('#timeline'), TIMELINE);
  renderJournal($('#journal-list'), ENTRIES, { charts: CHARTS, viz: VIZ });
  renderStats($('#stats'), STATS);
  renderBars($('#bars'), BARS, { unit: 'm' });
  renderTiles($('#tiles'), TILES);
  renderTeam();
  const coef = createChart($('#coef-chart'), CHARTS.coef());
  new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { coef.play(2.4); o.disconnect(); } }).observe($('#coef-chart'));
  setupLightbox();
  setupVideo();
  setupNav();

  const onProgress = loaderProgress({ from: 0, to: 100 });
  let bundle = null;
  if (webglOK()) {
    try {
      bundle = await setupStage(async ({ labelsFor, manager }) => {
        const { LAKES } = await import('./data/lakes.js');
        const { LakeAct } = await import('./acts/lake.js');
        const { WingAct } = await import('./acts/wing.js');
        const { DriftAct } = await import('./acts/drift.js');
        const { AnchorAct } = await import('./acts/anchor.js');
        const { loadModel } = await import('./kit/models.js');
        const parts = Object.fromEntries(await Promise.all(['sabot', 'axe-moteur', 'axe-extreme', 'bras', 'moignon'].map(async (n) => [n, await loadModel(n, manager)])));
        const acts = {
          lake: new LakeAct({ lake: LAKES.montjoie, labels: labelsFor() }),
          wing: new WingAct({ labels: labelsFor() }),
          drift: new DriftAct({ lakes: LAKES, labels: labelsFor() }),
          anchor: new AnchorAct({ parts, labels: labelsFor() }),
        };
        acts.wing.onCut = (v) => { $('#cut').textContent = v; };
        acts.anchor.onTime = (cmd, s) => { $('#anchor-cmd').textContent = cmd; $('#anchor-time').textContent = s; };
        const { setupLab } = await import('./lab.js');
        setupLab(acts.drift, LAKES);
        return acts;
      }, onProgress);
    } catch (e) { console.error('3D stage disabled:', e); }
  }
  if (!bundle) document.body.classList.add('no-webgl');
  onProgress(1);
  setupPanels();
  setupReveals();
  if (bundle) bindActs(bundle);
  if (debug || capture) window.__kit = bundle;
  await finishBoot();
}

boot();
