// Generic page orchestration: smooth scroll, the scroll-driven 3D stage and its
// acts, card reveals, counters, navigation, lightbox, video embeds, hero intro
// and the boot sequence. Projects call these from their main.js.
import * as THREE from 'three';
import { nf, LANG } from './i18n.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const capture = location.search.includes('capture');
export const debug = location.search.includes('debug');
if (capture) document.documentElement.classList.add('capture');
const reduced = capture || matchMedia('(prefers-reduced-motion: reduce)').matches;

gsap.registerPlugin(ScrollTrigger, SplitText);
ScrollTrigger.config({ ignoreMobileResize: true });

/* ---------------- smooth scroll ---------------- */
export const lenis = reduced ? null : new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
if (lenis) {
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
export const scrollToTarget = (target) => (lenis ? lenis.scrollTo(target, { duration: 1.6 }) : $(target)?.scrollIntoView({ behavior: 'smooth' }));

export function setupAnchors() {
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2 || !$(id)) return;
    e.preventDefault();
    $('.topnav')?.classList.remove('open');
    scrollToTarget(id);
  }));
}

/* ---------------- 3D stage ---------------- */
export function webglOK() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; }
}

/**
 * Create the stage and the acts. `makeActs({ stage, labelsFor, manager })` returns
 * { name: act } (names match <section class="act" data-act="name">) and may await
 * assets through `manager` (a THREE.LoadingManager wired to the loader gauge).
 */
export async function setupStage(makeActs, onProgress) {
  const { Stage } = await import('./stage.js');
  const { Labels } = await import('./fx.js');
  const stage = new Stage($('#stage'));
  const labelsFor = () => {
    const d = document.createElement('div');
    $('#stage-labels').appendChild(d);
    return new Labels(d);
  };
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_, loaded, total) => onProgress?.(loaded / total);
  const acts = await makeActs({ stage, labelsFor, manager });
  for (const [name, act] of Object.entries(acts)) {
    act.init?.(stage.renderer);
    stage.add(name, act);
  }
  // Compile shaders up front to avoid hitches when an act first appears.
  for (const act of Object.values(acts)) stage.renderer.compile(act.scene, act.camera);
  return { stage, acts };
}

/** The act whose section covers the middle of the viewport owns the stage; progress = scroll through its section. */
export function bindActs({ stage, acts }) {
  $$('section.act').forEach((sec) => {
    const name = sec.dataset.act;
    ScrollTrigger.create({
      trigger: sec, start: 'top center', end: 'bottom center',
      onToggle: (s) => {
        if (s.isActive) stage.setActive(name);
        else if (stage.active === acts[name]) stage.setActive(null);
      },
    });
    ScrollTrigger.create({
      trigger: sec, start: 'top top', end: 'bottom bottom',
      onUpdate: (s) => stage.setProgress(name, s.progress),
      onRefresh: (s) => stage.setProgress(name, s.progress),
    });
  });
}

/* ---------------- act panels & reveals ---------------- */
/** Cards of the act panels fade in, hold and fade out with the scroll. Panels with .panel-sticky hold longer. */
export function setupPanels() {
  $$('.act .panel').forEach((panel) => {
    const card = $('.card, .hero-content', panel);
    if (!card) return;
    const hero = panel.classList.contains('panel-hero');
    const sticky = panel.classList.contains('panel-sticky');
    const tl = gsap.timeline({ scrollTrigger: { trigger: panel, start: 'top bottom', end: 'bottom top', scrub: true } });
    if (hero) {
      tl.to(card, { opacity: 1, duration: 0.5 }).to(card, { opacity: 0, y: -80, duration: 0.5, ease: 'power1.in' });
      tl.to('.scroll-cue, .hud', { opacity: 0, duration: 0.2 }, 0.45);
    } else {
      tl.fromTo(card, { opacity: 0, y: 70 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' })
        .to(card, { opacity: 1, duration: sticky ? 0.6 : 0.44 })
        .to(card, { opacity: 0, y: -60, duration: sticky ? 0.12 : 0.28, ease: 'power2.in' });
    }
  });
}

/** .reveal elements rise in; [data-count] numbers count up; [data-in] gets the class "in" once visible. */
export function setupReveals() {
  $$('.reveal').forEach((el) => {
    gsap.to(el, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });
  $$('[data-count]').forEach((el) => {
    const v = parseFloat(el.dataset.count), d = +(el.dataset.decimals || 0);
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 92%', once: true,
      onEnter: () => gsap.to(o, { v, duration: 2, ease: 'power2.out', onUpdate: () => { el.textContent = nf(o.v, d); } }),
    });
  });
  $$('[data-in]').forEach((el) => ScrollTrigger.create({
    trigger: el, start: 'top 85%', onEnter: () => el.classList.add('in'), onLeaveBack: () => el.classList.remove('in'),
  }));
  $$('.timeline').forEach((tl) => gsap.to(tl, { '--tl': 1, ease: 'none', scrollTrigger: { trigger: tl, start: 'top 85%', end: 'bottom 50%', scrub: true } }));
  $$('.photo-strip').forEach((strip) => $$('.ph', strip).forEach((ph, i) => gsap.fromTo(ph, { y: 60 + i * 30 }, {
    y: -20 - i * 20, ease: 'none', scrollTrigger: { trigger: strip, start: 'top bottom', end: 'bottom top', scrub: true },
  })));
}

/* ---------------- nav, lightbox, video ---------------- */
export function setupNav() {
  const nav = $('.topnav');
  const bar = $('.scroll-progress span');
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => { if (bar) bar.style.transform = `scaleX(${s.progress})`; nav.classList.toggle('scrolled', s.scroll() > 40); } });
  $('.nav-toggle')?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    $('.nav-toggle').setAttribute('aria-expanded', open);
  });
  const links = $$('.nav-links a');
  links.forEach((a) => {
    const sec = $(a.getAttribute('href'));
    if (!sec) return;
    ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: (s) => { if (s.isActive) links.forEach((l) => l.classList.toggle('active', l === a)); } });
  });
}

/** Any element with data-lightbox="group" (containing an <img data-full>) opens the lightbox. */
export function setupLightbox() {
  const lb = $('#lightbox');
  if (!lb) return;
  const img = $('img', lb), cap = $('figcaption', lb);
  let group = [], idx = 0;
  const open = (g, i) => {
    group = g; idx = i;
    const im = $('img', group[idx]);
    img.src = im.dataset.full || im.src;
    img.alt = im.alt;
    cap.textContent = $('figcaption', group[idx])?.textContent || im.alt;
    lb.hidden = false;
    lenis?.stop();
  };
  const close = () => { lb.hidden = true; lenis?.start(); };
  document.addEventListener('click', (e) => {
    const f = e.target.closest('[data-lightbox]');
    if (!f) return;
    const g = $$(`[data-lightbox="${f.dataset.lightbox}"]`);
    open(g, g.indexOf(f));
  });
  $('.lb-close', lb).addEventListener('click', close);
  $('.lb-prev', lb).addEventListener('click', () => open(group, (idx - 1 + group.length) % group.length));
  $('.lb-next', lb).addEventListener('click', () => open(group, (idx + 1) % group.length));
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') open(group, (idx + 1) % group.length);
    if (e.key === 'ArrowLeft') open(group, (idx - 1 + group.length) % group.length);
  });
}

/** <div class="video" data-yt="ID" data-title="…"> with a .video-play button: privacy-friendly YouTube embed on click. */
export function setupVideo() {
  $$('.video[data-yt]').forEach((v) => {
    // A film per language: data-yt-en / data-title-en replace the defaults on the English page.
    if (LANG === 'en' && v.dataset.ytEn) { v.dataset.yt = v.dataset.ytEn; v.dataset.title = v.dataset.titleEn || v.dataset.title; }
    $('.video-play', v)?.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${v.dataset.yt}?autoplay=1&rel=0`;
      f.title = v.dataset.title || '';
      f.allow = 'autoplay; encrypted-media; picture-in-picture';
      f.allowFullscreen = true;
      v.appendChild(f);
      v.classList.add('playing');
    });
  });
}

/* ---------------- hero intro & loader ---------------- */
/**
 * Title characters rise in, the glowing word follows, then the rest. fromTo with explicit
 * end values, props cleared at the end, and a safety net if a tween is ever cut short
 * (seen on Android Chrome: a frozen intro leaves the hero invisible).
 */
export function heroIntro() {
  const words = $$('.ht-word:not(.ht-glow)');
  const split = new SplitText(words, { type: 'chars' });
  const glow = $('.ht-glow');
  const rest = $$('.eyebrow, .hero-sub, .hero-kpis, .hero-cta, .scroll-cue, .hud');
  const all = [glow, ...rest].filter(Boolean);
  const done = () => { split.revert(); gsap.set(all, { clearProps: 'opacity,transform,translate' }); };
  gsap.fromTo(split.chars, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: 0.035, delay: 0.3 });
  if (glow) gsap.fromTo(glow, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.6, ease: 'expo.out', delay: 0.75 });
  gsap.fromTo(rest, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.09, delay: 0.9, onComplete: done });
  setTimeout(() => {
    if (all.some((e) => getComputedStyle(e).opacity < 0.99)) { gsap.killTweensOf([...all, ...split.chars]); done(); }
  }, 4500);
}

/** Loader gauge: an arc plus a number that counts down (e.g. a vacuum pump going from 1013 to 1 mbar). */
export function loaderProgress({ from = 1013, to = 1 } = {}) {
  const arc = $('#loader-arc'), num = $('#loader-num');
  return (f) => {
    if (arc) arc.style.strokeDashoffset = 326.7 * (1 - f);
    if (num) num.textContent = nf(Math.max(to, Math.round(to + (from - to) * Math.pow(1 - f, 2.4))));
  };
}

/** Hide the loader, start scrolling, restore the scroll position after a language switch, play the hero intro. */
export async function finishBoot() {
  ScrollTrigger.refresh();
  await new Promise((r) => setTimeout(r, 350));
  $('#loader')?.classList.add('done');
  document.body.classList.remove('is-loading');
  lenis?.start();
  let back = null;
  try { back = sessionStorage.getItem('scrollY'); sessionStorage.removeItem('scrollY'); } catch (e) { /* private mode */ }
  if (back) {
    if (lenis) lenis.scrollTo(+back, { immediate: true, force: true });
    else window.scrollTo(0, +back);
  }
  heroIntro();
}
