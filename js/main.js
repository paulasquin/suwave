// Demo wiring: register strings, render the plain sections, build the stage and
// its acts, bind them to the scroll, then reveal the page.
import { registerStrings, applyStatic, LANG } from './kit/i18n.js';
import { STRINGS } from './strings.js';
import {
  $, capture, debug, setupAnchors, webglOK, setupStage, bindActs, setupPanels, setupReveals,
  setupNav, setupLightbox, setupVideo, loaderProgress, finishBoot,
} from './kit/page.js';
import { renderTimeline, renderJournal, renderStats, renderBars, renderTiles } from './kit/render.js';
import { TIMELINE, ENTRIES, STATS, BARS, TILES, CHARTS } from './content.js';

registerStrings(STRINGS);

async function boot() {
  applyStatic(); // pass { onApplied } to adjust the DOM after translation (e.g. move .ht-glow to another word)
  setupAnchors();
  renderTimeline($('#timeline'), TIMELINE);
  renderJournal($('#journal-list'), ENTRIES, { charts: CHARTS });
  renderStats($('#stats'), STATS);
  renderBars($('#bars'), BARS, { unit: LANG === 'fr' ? 'img/s' : 'fps' });
  renderTiles($('#tiles'), TILES);
  setupLightbox();
  setupVideo();
  setupNav();

  const onProgress = loaderProgress({ from: 100, to: 0 });
  let bundle = null;
  if (webglOK()) {
    try {
      bundle = await setupStage(async ({ labelsFor, manager }) => {
        const { loadModel } = await import('./kit/models.js');
        const { IntroAct } = await import('./acts/intro.js');
        const { ModelAct } = await import('./acts/model.js');
        const [a, b] = await Promise.all([loadModel('demo', manager), loadModel('demo', manager)]);
        const acts = { intro: new IntroAct({ model: a, labels: labelsFor() }), model: new ModelAct({ model: b, labels: labelsFor() }) };
        acts.model.onLayer = (n) => { $('#layer').textContent = n; };
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
