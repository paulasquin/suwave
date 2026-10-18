// Language handling. The inline script in index.html <head> picks the language
// before first paint (?lang=, then the visitor's saved choice, then the browser
// languages) and sets <html lang>. The default language lives in the HTML;
// the other one replaces it at boot from the strings registered by the project.

export const LANGS = ['fr', 'en'];
export const DEFAULT_LANG = 'fr'; // language written in index.html
export const LANG = LANGS.includes(document.documentElement.lang) ? document.documentElement.lang : 'en';
export const LOCALE = LANG === 'fr' ? 'fr-FR' : 'en-US';
export const nf = (v, d = 0) => Number(v).toLocaleString(LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d });

/** Strings used by the kit's own components. Projects add theirs with registerStrings(). */
const UI = {
  fr: {
    'journal.result': 'Résultat',
    'slide.alt': 'Diapositive {n} : {title}',
    'slide.thumb': 'Diapositive {n}',
    'viewer.modes': "Mode d'affichage",
    'viewer.solid': 'Plein', 'viewer.xray': 'Rayons X', 'viewer.cut': 'Coupe',
    'viewer.hint': 'glisser pour tourner',
  },
  en: {
    'journal.result': 'Result',
    'slide.alt': 'Slide {n}: {title}',
    'slide.thumb': 'Slide {n}',
    'viewer.modes': 'Display mode',
    'viewer.solid': 'Solid', 'viewer.xray': 'X-ray', 'viewer.cut': 'Section',
    'viewer.hint': 'drag to rotate',
  },
};
let STATIC = {}; // translations of the static HTML for the non-default language, keyed by data-i18n

/**
 * Register project strings:
 *   ui:      { fr: {key: text}, en: {key: text} } — strings used by scripts, via t()
 *   static:  { key: text } — the non-default language for elements tagged data-i18n,
 *            data-i18n-aria or data-i18n-alt, plus 'meta.title' / 'meta.description'.
 */
export function registerStrings({ ui = {}, static: st = {} } = {}) {
  for (const l of LANGS) Object.assign(UI[l], ui[l] || {});
  Object.assign(STATIC, st);
}

/** Translate a script string, with {placeholders}. */
export function t(key, vars) {
  let s = UI[LANG][key] ?? UI[DEFAULT_LANG][key] ?? key;
  if (vars && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  return s;
}

/** Apply the registered translation to the static page and wire the FR/EN switch. */
export function applyStatic({ onApplied } = {}) {
  document.querySelectorAll('.lang-switch button').forEach((b) => {
    b.classList.toggle('on', b.dataset.lang === LANG);
    b.setAttribute('aria-pressed', b.dataset.lang === LANG);
    b.addEventListener('click', () => {
      if (b.dataset.lang === LANG) return;
      try {
        localStorage.setItem('lang', b.dataset.lang);
        sessionStorage.setItem('scrollY', String(scrollY));
      } catch (e) { /* private mode */ }
      const url = new URL(location.href);
      url.searchParams.set('lang', b.dataset.lang);
      location.replace(url);
    });
  });
  if (LANG === DEFAULT_LANG) return;
  if (STATIC['meta.title']) document.title = STATIC['meta.title'];
  if (STATIC['meta.description']) document.querySelector('meta[name="description"]')?.setAttribute('content', STATIC['meta.description']);
  const apply = (attr, set) => document.querySelectorAll(`[${attr}]`).forEach((el) => {
    const key = el.getAttribute(attr);
    if (STATIC[key] !== undefined) set(el, STATIC[key]);
  });
  apply('data-i18n', (el, v) => { el.innerHTML = v; });
  apply('data-i18n-aria', (el, v) => el.setAttribute('aria-label', v));
  apply('data-i18n-alt', (el, v) => el.setAttribute('alt', v));
  onApplied?.();
}
