"""Build js/data/lakes.js: lake outlines, the GEGI water grid, the safe zones and the
wind forecasts stored by the 2017 anticipation program, plus the real drift tracks.

    uv run --with shapely --with numpy python -I tools/build_lakes.py ~/scratch/suwave-src > js/data/lakes.js

Inputs (kept outside the repo):
  anticipation-derive/environnement.db  SQLite database of the 2017 program (lakes, GEGI points,
                                        zones = largest north-aligned rectangles, wind vectors)
  osm/<lake>.json                       Overpass export of the lake (natural=water), © OpenStreetMap
  tracks/raw.json                       1 Hz GPS fixes extracted from the PX4 .ulg logs (tools/extract_tracks.py)
Local frame: metres, x towards the east, y towards the north, origin at the lake centre.
"""
import json, math, sqlite3, sys, pathlib
from shapely.geometry import Polygon, LineString, MultiPolygon, Point
from shapely.ops import linemerge, polygonize, unary_union

src = pathlib.Path(sys.argv[1]).expanduser()
db = sqlite3.connect(src / "anticipation-derive/environnement.db")

LAKES = [
    # id_lac in the database, key, OSM file, OSM name, display names
    (1, "montjoie", "montjoie", "Lac Montjoie", "Lac Montjoie", "Saint-Denis-de-Brompton"),
    (0, "truite", "truite", "Lac à la Truite", "Lac à la Truite", "Orford"),
]
TRACKS = {
    "montjoie": [("deriveDrone_2_Standard_2017-08-16-pm", "#2"), ("deriveDrone_3_Standard_2017-08-16-pm", "#3"), ("deriveDrone_4_Standard_2017-08-16-pm", "#4")],
    "truite": [("deriveDrone_2_Standard_2017-08-02-pm", "#2"), ("deriveDrone_4_Standard_2017-08-02-pm", "#4")],
}
raw = json.load(open(src / "tracks/raw.json"))

def osm_polygon(path, name):
    d = json.load(open(path))
    for e in d["elements"]:
        if e.get("tags", {}).get("name") != name: continue
        if e["type"] == "way":
            return Polygon([(p["lon"], p["lat"]) for p in e["geometry"]])
        outer, inner = [], []
        for m in e["members"]:
            if m["type"] != "way" or not m.get("geometry"): continue
            ls = LineString([(p["lon"], p["lat"]) for p in m["geometry"]])
            (inner if m["role"] == "inner" else outer).append(ls)
        outers = list(polygonize(linemerge(outer)))
        inners = list(polygonize(linemerge(inner))) if inner else []
        poly = unary_union(outers)
        for h in inners: poly = poly.difference(h)
        return poly
    raise SystemExit(f"{name} not found in {path}")

def track_sessions(pts, to_xy, lake_poly):
    """Keep the drift itself: fixes on the water, before the first fast (boat) segment."""
    out, run = [], []
    for i in range(1, len(pts)):
        t0, la0, lo0, _ = pts[i - 1]; t1, la1, lo1, _ = pts[i]
        x0, y0 = to_xy(la0, lo0); x1, y1 = to_xy(la1, lo1)
        v = math.hypot(x1 - x0, y1 - y0) / max(0.5, t1 - t0)
        run.append((t1, x1, y1, v))
    # 30 s moving average of the speed; the drift ends when it exceeds 0.8 m/s for good.
    sm = []
    for i in range(len(run)):
        w = run[max(0, i - 15): i + 15]
        sm.append(sum(r[3] for r in w) / len(w))
    sessions, cur = [], []
    for r, s in zip(run, sm):
        if s < 0.8 and lake_poly.buffer(25).contains(Point(r[1], r[2])):
            cur.append(r)
        else:
            if len(cur) > 600: sessions.append(cur)
            cur = []
    if len(cur) > 600: sessions.append(cur)
    return sessions

lakes = {}
for id_lac, key, osm, osm_name, name, place in LAKES:
    poly_ll = osm_polygon(src / f"osm/{osm}.json", osm_name)
    c = poly_ll.centroid
    lat0, lon0 = c.y, c.x
    kx, ky = 111320 * math.cos(math.radians(lat0)), 110574
    to_xy = lambda la, lo: ((lo - lon0) * kx, (la - lat0) * ky)
    from shapely import affinity
    poly = affinity.affine_transform(poly_ll, [kx, 0, 0, ky, -lon0 * kx, -lat0 * ky]).simplify(6)
    polys = list(poly.geoms) if isinstance(poly, MultiPolygon) else [poly]
    polys.sort(key=lambda p: -p.area)
    rings = [{"outer": [[round(x), round(y)] for x, y in p.exterior.coords[:-1]],
              "holes": [[[round(x), round(y)] for x, y in h.coords[:-1]] for h in p.interiors if Polygon(h).area > 400]} for p in polys if p.area > 2000]
    la1, lo1, la2, lo2 = [float(str(v).strip(" ,")) for v in db.execute("select latNE, lonNE, latSO, lonSO from Lac where id_lac=?", (id_lac,)).fetchone()]
    pts = db.execute("select lat, lon from Point where lat between ? and ? and lon between ? and ?", (la2 - .01, la1 + .01, lo2 - .01, lo1 + .01)).fetchall()
    grid = [[round(x), round(y)] for x, y in (to_xy(a, b) for a, b in pts) if poly.buffer(400).contains(Point(x, y))]
    zones = []
    for zid, la, lo, w, h in db.execute("select id_zone, latNO, lonNO, largeur, hauteur from Zone where id_lac=? order by id_zone", (id_lac,)):
        x, y = to_xy(la, lo)
        zones.append([round(x), round(y), int(w), int(h)])  # north-west corner, width (east), height (south)
    station = db.execute("select s.id_station, s.nom_windfinder from Lac l join Station s on s.id_station=l.id_station where l.id_lac=?", (id_lac,)).fetchone()
    forecast = [[d[5:16], round(vx, 3), round(vy, 3)] for d, vx, vy in db.execute(
        "select date_vecteur, vecteurX, vecteurY from Vecteur where id_station=? and type_vecteur='air' order by date_vecteur", (station[0],))]
    tracks = []
    for folder, label in TRACKS.get(key, []):
        for s in track_sessions(raw.get(folder, []), to_xy, poly):
            t0 = s[0][0]
            samp = s[::10]
            dist = math.hypot(s[-1][1] - s[0][1], s[-1][2] - s[0][2])
            path_len = sum(math.hypot(s[i][1] - s[i - 1][1], s[i][2] - s[i - 1][2]) for i in range(1, len(s)))
            tracks.append({"wing": label, "date": folder[-13:-3], "start": round(t0), "duration": round(s[-1][0] - t0),
                           "mean": round(path_len / (s[-1][0] - t0), 3), "net": round(dist),
                           "pts": [[round(p[0] - t0), round(p[1], 1), round(p[2], 1)] for p in samp]})
    lakes[key] = {"name": name, "place": place, "lat": round(lat0, 6), "lon": round(lon0, 6), "rings": rings,
                  "grid": grid, "spacing": [round(0.001855 * kx), round(0.001308 * ky)], "zones": zones,
                  "station": station[1], "forecast": forecast, "tracks": tracks}
    print(f"// {key}: {len(rings)} rings, {len(grid)} GEGI points, {len(zones)} zones, {len(forecast)} forecast vectors, "
          f"{len(tracks)} drift sessions {[(t['wing'], t['duration'], t['mean']) for t in tracks]}", file=sys.stderr)

print("// Generated by tools/build_lakes.py — lake outlines © OpenStreetMap contributors (ODbL);")
print("// GEGI grid, zones and wind forecasts from the 2017 anticipation-derive database; drift tracks from the PX4 logs.")
print("export const LAKES = " + json.dumps(lakes, ensure_ascii=False, separators=(",", ":")) + ";")
