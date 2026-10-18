// The drift anticipation of 2017 (repo anticipation-derive, Anticipation.py), ported to JavaScript.
// Units: metres and seconds, x towards the east, y towards the north (the lake's local frame).
//
//   1. drift = sum over the wind forecast of  COEF x wind x time spent under each vector
//   2. "zone U": the north-aligned rectangle covered by the drift path
//   3. "zone D": among the safe zones of the lake (largest rectangles of the GEGI water grid),
//      those larger than zone U; the best ratio (wD/wU)·(hD/hU) wins. If none is large enough,
//      the best capped ratio is taken and the flight controller is warned (tropPetit).
//   4. the path is centred in zone D: its start is the optimal landing point.

export const COEF = 0.05; // drift speed / wind speed, measured on the lakes in August 2017
export const SLOT = 3 * 3600; // Windfinder forecasts: one vector every 3 hours

/**
 * Drift path from a list of wind vectors, each held for `dt` seconds: [{ vx, vy, dt }].
 * Returns cumulative points [{ x, y, t }] starting at the origin.
 */
export function driftPath(winds) {
  const pts = [{ x: 0, y: 0, t: 0 }];
  for (const w of winds) {
    const p = pts[pts.length - 1];
    pts.push({ x: p.x + w.vx * COEF * w.dt, y: p.y + w.vy * COEF * w.dt, t: p.t + w.dt });
  }
  return pts;
}

/** Wind vectors under a forecast ([['MM-DD HH:MM', vx, vy], …], one every 3 h), from `start` (index, fractional) for `seconds`. */
export function forecastWinds(forecast, start, seconds) {
  const out = [];
  let t = start * SLOT, end = t + seconds;
  while (t < end - 1e-6) {
    const k = Math.min(forecast.length - 1, Math.floor(t / SLOT + 1e-9));
    const slotEnd = (k + 1) * SLOT;
    const dt = Math.min(end, k === forecast.length - 1 ? end : slotEnd) - t;
    out.push({ vx: forecast[k][1], vy: forecast[k][2], dt });
    t += dt;
  }
  return out;
}

/** Steps 2-4. zones: [[xNW, yNW, width, height], …] in metres. */
export function anticipate(path, zones) {
  const xs = path.map((p) => p.x), ys = path.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const zx = Math.max(1, Math.trunc(maxX - minX)), zy = Math.max(1, Math.trunc(maxY - minY));
  // Start inside zone U, from its north-west corner (x to the east, y to the south).
  const sx = -minX, sy = maxY;
  let cands = zones.map((z, i) => i).filter((i) => zones[i][2] > zx && zones[i][3] > zy);
  let tooSmall = false;
  const fits = cands.length;
  if (!cands.length) { cands = zones.map((z, i) => i); tooSmall = true; }
  let best = cands[0], bestCoef = 0;
  for (const i of cands) {
    let cx = zones[i][2] / zx, cy = zones[i][3] / zy;
    if (tooSmall) { cx = Math.min(1, cx); cy = Math.min(1, cy); }
    const c = cx * cy;
    if (c > bestCoef) { bestCoef = c; best = i; }
  }
  const [zxNW, zyNW, w, h] = zones[best];
  // Centre zone U in zone D, then keep the start inside zone D.
  let dx = w / 2 - zx / 2 + sx, dy = h / 2 - zy / 2 + sy;
  if (dx < 0) dx = sx;
  if (dy < 0) dy = sy;
  if (dx > w) dx = w - (zx - sx);
  if (dy > h) dy = h - (zy - sy);
  const land = { x: zxNW + dx, y: zyNW - dy };
  return {
    zoneU: { w: zx, h: zy, x: land.x - sx, y: land.y + sy },
    zoneD: { index: best, x: zxNW, y: zyNW, w, h },
    land, tooSmall, fits, candidates: cands,
    path: path.map((p) => ({ x: land.x + p.x, y: land.y + p.y, t: p.t })),
  };
}

/** Point in polygon (rings: outer + holes), even-odd rule. */
export function inside(x, y, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export function onWater(x, y, lake) {
  return lake.rings.some((r) => inside(x, y, r.outer) && !r.holes.some((h) => inside(x, y, h)));
}

/** First time (s) the path leaves the water, or null. Sampled every 10 m. */
export function strandingTime(path, lake) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10));
    for (let k = 0; k <= n; k++) {
      const f = k / n, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
      if (!onWater(x, y, lake)) return a.t + (b.t - a.t) * f;
    }
  }
  return null;
}

/** Position along the path at time t (s). */
export function at(path, t) {
  if (t <= 0) return { x: path[0].x, y: path[0].y };
  for (let i = 1; i < path.length; i++) {
    if (t <= path[i].t) {
      const a = path[i - 1], b = path[i], f = (t - a.t) / Math.max(1e-6, b.t - a.t);
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
  }
  const p = path[path.length - 1];
  return { x: p.x, y: p.y };
}

/** Metres in the lake frame to latitude / longitude. */
export function toLatLon(lake, x, y) {
  const ky = 110574, kx = 111320 * Math.cos((lake.lat * Math.PI) / 180);
  return { lat: lake.lat + y / ky, lon: lake.lon + x / kx };
}

/** Sun direction for Sherbrooke (45.4° N, 71.9° W): elevation and azimuth (rad) at a UTC date. */
export function sun(date, lat = 45.4, lon = -71.9) {
  const rad = Math.PI / 180;
  const d = date / 86400000 - 10957.5; // days since J2000
  const g = (357.529 + 0.98560028 * d) * rad;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const ha = (gmst * 15 + lon) * rad - ra;
  const la = lat * rad;
  const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(ha)); // from north, clockwise
  return { el, az };
}
