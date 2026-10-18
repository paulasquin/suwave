// The drift lab: controls of the last drift panel → DriftAct.setUser(), and the read-outs.
import { $, $$ } from './kit/page.js';
import { nf, t, LANG } from './kit/i18n.js';

const CARD = LANG === 'fr' ? ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'] : ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const card = (deg) => CARD[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
const fmtDist = (m) => (m >= 1000 ? `${nf(m / 1000, 2)} km` : `${nf(Math.round(m))} m`);
const fmtH = (h) => (h % 1 ? `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}` : `${h} h`);

export function setupLab(drift, lakes) {
  const st = { lake: 'montjoie', mode: 'const', dir: 250, speed: 2, start: 26.5, hours: 3 };
  const dial = $('#lab-dial');
  const ticks = $('.dial-ticks', dial);
  ticks.innerHTML = Array.from({ length: 16 }, (_, i) => `<line x1="60" y1="9" x2="60" y2="${i % 4 ? 13 : 16}" transform="rotate(${i * 22.5} 60 60)"/>`).join('');
  const arrow = $('.dial-arrow', dial);

  const run = () => {
    // The arrow shows where the wind goes (from st.dir towards st.dir + 180°).
    arrow.setAttribute('transform', `rotate(${st.dir} 60 60)`);
    dial.setAttribute('aria-valuenow', Math.round(st.dir));
    dial.setAttribute('aria-valuetext', card(st.dir));
    $('#lab-dir-out').textContent = `${card(st.dir)} · ${Math.round(st.dir)}°`;
    $('#lab-speed-out').textContent = `${nf(st.speed, st.speed % 1 ? 1 : 0)} m/s`;
    $('#lab-dur-out').textContent = fmtH(st.hours);
    const fc = lakes[st.lake].forecast;
    const k = Math.floor(st.start), [md, hm] = fc[k][0].split(' ');
    const [mo, d] = md.split('-').map(Number);
    const h = Number(hm.split(':')[0]) + (st.start - k) * 3;
    const date = new Date(Date.UTC(2017, mo - 1, d)).toLocaleDateString(LANG === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    $('#lab-start-out').textContent = `${date} · ${LANG === 'fr' ? `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}` : `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`}`;
    const r = drift.setUser(st);
    $('#o-drift').textContent = fmtDist(r.length);
    $('#o-fits').textContent = r.tooSmall ? '0' : nf(r.fits);
    $('#o-gps').textContent = `${r.gps.lat.toFixed(5)}, ${r.gps.lon.toFixed(5)}`;
    let msg, cls;
    if (r.tooSmall) { msg = t('lab.small', { w: nf(r.zoneU.w), h: nf(r.zoneU.h) }); cls = 'warn'; }
    else if (r.strand !== null) { msg = t('lab.strand', { t: fmtH(Math.round((r.strand / 3600) * 4) / 4) }); cls = 'warn'; }
    else { msg = t('lab.ok', { w: nf(r.zoneU.w), h: nf(r.zoneU.h), W: nf(r.zoneD.w), H: nf(r.zoneD.h) }); cls = 'ok'; }
    if (r.night) msg += ' ' + t('lab.night');
    const s = $('#o-status');
    s.textContent = msg;
    s.className = `lab-status ${cls}`;
  };

  // Dial: drag or arrow keys; the angle is where the wind comes from.
  const setFromEvent = (e) => {
    const b = dial.getBoundingClientRect();
    const x = e.clientX - (b.left + b.width / 2), y = e.clientY - (b.top + b.height / 2);
    st.dir = (Math.round(((Math.atan2(x, -y) * 180) / Math.PI + 180) / 5) * 5) % 360;
    run();
  };
  let drag = false;
  dial.addEventListener('pointerdown', (e) => { drag = true; dial.setPointerCapture(e.pointerId); setFromEvent(e); });
  dial.addEventListener('pointermove', (e) => { if (drag) setFromEvent(e); });
  dial.addEventListener('pointerup', () => { drag = false; });
  dial.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { st.dir = (st.dir + 10) % 360; run(); e.preventDefault(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { st.dir = (st.dir + 350) % 360; run(); e.preventDefault(); }
  });
  const seg = (id, key, after) => $$(`#${id} button`).forEach((b) => b.addEventListener('click', () => {
    st[key] = b.dataset.v;
    $$(`#${id} button`).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
    after?.();
    run();
  }));
  seg('lab-lake', 'lake');
  seg('lab-mode', 'mode', () => { $('#lab-const').hidden = st.mode !== 'const'; $('#lab-fc').hidden = st.mode === 'const'; });
  const range = (id, key) => $(`#${id}`).addEventListener('input', (e) => { st[key] = +e.target.value; run(); });
  range('lab-speed', 'speed'); range('lab-start', 'start'); range('lab-dur', 'hours');
  $('#lab-replay').addEventListener('click', () => drift.replay());
  // Read-outs of the scripted panels.
  drift.onCharge = (c, res, stranded) => {
    $('#charge-bar').style.transform = `scaleX(${c})`;
    $('#charge-num').textContent = `${Math.round(c * 100)} %`;
    const d = new Date(res.startDate + c * res.hours * 3600e3 - 4 * 3600e3);
    $('#charge-clock').textContent = LANG === 'fr' ? `${d.getUTCHours()} h ${String(d.getUTCMinutes()).padStart(2, '0')}` : `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    document.body.classList.toggle('stranded', stranded);
  };
  const tr0 = lakes.montjoie.tracks;
  $('#d1-out').innerHTML = tr0.slice(0, 3).map((x, i) => `<span class="chip c${i}"><i></i>${t('drift.label.wing', { n: x.wing.slice(1) })} · <b>${nf([0.283, 0.298, 0.327][i], 3)} m/s</b></span>`).join('');
  run();
}
