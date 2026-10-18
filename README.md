# SUWAVE — anticipating the drift of a solar flying wing

Showcase site for Paul Asquin's summer 2017 internship with Oneka Technologies at the 3IT (Université de Sherbrooke, Québec): measuring the drift of the SUWAVE solar flying wing resting on lakes, and computing the landing point that keeps it on the water for its whole charge. Live at **https://suwave.paulasquin.com** (French and English, language picked automatically).

Built from the template [`paulasquin/showcase-kit`](https://github.com/paulasquin/showcase-kit) (private): read its README for the recipe, the act contract, the testing routine and the pitfalls. Static site, no build step (three.js 0.186 via an import map, GSAP, Lenis).

```bash
python3 -m http.server 8790 --bind 127.0.0.1   # http://127.0.0.1:8790/  (?debug exposes window.__kit, ?lang=en forces English)
```

## The four acts

| Act | File | What it shows |
| --- | --- | --- |
| `lake` | `js/acts/lake.js` | Golden hour on the real outline of Lac Montjoie: the wing circles, flares, lands, turns into the wind (mirror reflections, wave normals, sun glints, ripple rings). |
| `wing` | `js/acts/wing.js` | The wing cut chord by chord with a hot wire from a foam blank, solar cells, exploded electronics, then the take-off pivot. |
| `drift` | `js/acts/drift.js` + `js/lab.js` | Map of Lac Montjoie: the real GPS tracks of 16 Aug 2017, then the 2017 algorithm step by step (forecast → drift path → zone U → zone D → landing point → charge), then a live lab (wind dial, lake, forecast, charge time). |
| `anchor` | `js/acts/anchor.js` | The scissor anchor deployment mechanism from the original parts: printed and laser-cut on the plate, assembled, deployed. |

Shared: `js/world/lakeworld.js` (sky, water, terrain and forest from a lake outline), `js/world/wing.js` (procedural wing), `js/sim/anticipation.js` (the 2017 algorithm, ported from `Anticipation.py`).

## Data and assets

Sources live outside the repo, in `~/scratch/suwave-src/` (Drive folder `Education/EI1/Stage/Drone`, repos `paulasquin/anticipation-derive` and `paulasquin/analyse-derive-suwave`, both private).

- `js/data/lakes.js` — `tools/build_lakes.py`: lake outlines (OpenStreetMap, ODbL), the GEGI water grid, the 290/20 safe zones and the Sept. 2017 wind forecasts of the program's SQLite database, and the real drift tracks (`tools/extract_tracks.py` reads the PX4 `.ulg` logs).
- `js/data/measures.js` — `tools/build_measures.py`: the 2017 "Coefficients de déplacement" table and the 16 Aug drift speeds (50 s averages).
- `assets/models/` — anchor mechanism: `sabot`, `axe-moteur`, `axe-extreme` from the original STL (`tools/build_models.py`), `bras`, `moignon` extruded from the laser-cut DXF (`tools/build_dxf_parts.py`, 3 mm sheet assumed). Then `npx @gltf-transform/cli meshopt`.
- The wing itself only exists as SolidWorks parts (lab-owned `00-ASSYconcept16.4`): it is modelled procedurally from the team's drawing (span 1000 mm, chords 320/160 mm, winglets 120 mm, ~700 g) and photos.
- `assets/photos/` — `tools/build_images.py tools/images.json` (figures of the report, the logbook and the trial reports).

## Testing

```bash
CHROME=$(ls -d ~/.cache/ms-playwright/chromium_headless_shell-1243/*/)chrome-headless-shell \
  uv run --with playwright python tools/shot3d.py /tmp/sw/drift drift 0.1 0.5 0.9 --url=http://127.0.0.1:8790/ --eval="a.look.bloom = 0"
MODAL_PROFILE=photomate modal run modal/gpu_probe.py --url "https://suwave.paulasquin.com/?debug" --flag-set angle-vulkan --shots
MODAL_PROFILE=photomate modal run modal/mobile_probe.py --url "https://suwave.paulasquin.com/?debug" --shots
```

Pitfalls met here: the sun disc and glints must stay moderate in HDR (bloom washes the whole frame white otherwise); terrain winding must face +Y (the mirrored copy hid the bug in the hero); ribbons and overlays are double-sided with `depthTest: false`.

## Video

`video/` — the 60 s vertical film (FR and EN, embedded in the History section) and its tools, see `video/README.md`.
