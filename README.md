# L-SEA — Lunar Site Evaluation

Landing site evaluation for the lunar south pole. L-SEA loads a 640 km × 640 km LOLA elevation model, computes slope, horizon, Sun and Earth geometry, illumination statistics and a set of engineering models for every candidate cell, and ranks the sites an autopilot would shortlist. The planner is a single Vue 3 application; the heavy passes run in a web worker and can also be exercised head-first from Node.

The interface targets mission engineers, not a general audience: dense rows, one primary element (the terrain map), semantic colour, and the vocabulary of STK and ANSYS rather than of a consumer dashboard.

## Quick start

```bash
npm install
python descargar_lola.py     # downloads LOLA GDR and writes public/data/lola_shackleton.bin (~64 MB)
npm run dev                  # http://localhost:5173
node tests/verify.mjs        # 12 self-checking sections, no dependencies
node tests/perf.mjs          # timings against tests/perf-baseline.json
```

`descargar_lola.py` crops 4000 × 4000 cells at 160 m/cell around the south pole, so the full extent is 640 km on a side. The 64 MB array is committed by the script, not by the repository: run it once before the first `npm run dev`.

The 3D view needs no particular browser. It uses WebGL2 when the context is available and falls back by itself to a CPU column raycaster (`src/3d/software.js`) when it is not — Brave with strict shields and some remote desktops block WebGL2 outright. The Display panel shows which path is live: `GPU` or `CPU`. Both draw the same layers, markers and picking against the same DEM.

## What the tool answers

- Where can a vehicle land inside a slope limit, given a footprint of 320, 480 or 640 m radius?
- How long is the Sun above the local horizon in the next 30 days, and when does the Earth set behind the terrain?
- What does the descent corridor look like at a fixed 12° glideslope and 270° approach azimuth?
- How much power does a 2 m² vertical panel deliver at the current instant, and which DSN complex sees the Moon above its mask?
- How much of a landing dispersion ellipse survives, rather than how good the centre cell looks?

## Scoring model

Two scores exist, and the interface can rank by either.

**Cell score.** The autopilot audit walks the DEM, rejects any cell whose footprint contains a slope above the vehicle limit, and scores the rest as

```
cell = 100 · (0.6 · S + 0.4 · L)
S    = (1 − worstSlope / maxSlope)²      (0 when the footprint is invalid)
L    = fraction of the last 30 days with the Sun above the horizon
```

The worker keeps the 15 best candidates with 40-cell non-maximum suppression; the main thread re-scores those 15 with the exact horizon, per-site ephemerides, thermal equilibrium, glideslope corridor, TRN feasibility and libration margin, and keeps the Top 5.

**Survival score (robust ranking).** A landing is not a point. With *Robust ranking* enabled, each candidate is scored over a 240 m × 120 m ellipse oriented along the approach, sampled at 37 contact points (centre plus three rings at 0.55, 0.8 and 1.0 of the axes). Every contact contributes

```
q = 60 · (1 − worstSlope/maxSlope)² + 40 · sunFraction
```

and a contact steeper than the vehicle limit contributes **zero**, not the 40 points of its sunlight. The survival score is the mean of the 37 contacts. The consequence is the point of the feature: a narrow 95-point peak whose ellipse runs off a cliff scores 16.6, while a wide 80-point plateau keeps 66.7. Turning the switch off restores the cell ranking, turning it on re-orders the Top 5 and shows survival, coverage and the worst slope inside the ellipse.

## Interface

The application is one screen with two tabs, `Planning` and `3D view`.

- **Top bar** — product name, tab switch, site selector over the 25-site catalogue, mission brief export and compute state.
- **Planning** — left rail with surface conditions, the lander model and landing dispersion; centre column with the candidate matrix and the surface timeline (MET clock, speed control, next Earth link); right rail with the selected site, power and link, and the horizon radar.
- **3D view** — full-bleed terrain canvas with four overlays: display layers and lighting, the point probe, the catalogue legend and the selected site summary.
- **Status bar** — DEM state, reduction name, ephemeris provenance and clock state.

Colour is semantic and constant across the application: amber for the Sun, steel blue for the Earth, green for a nominal state, amber for caution, red for a hazard. Text never carries a glyph for meaning; a stroke-1.6 icon from a single set (`src/components/icons.js`) sits next to the label.

## Repository map

| Path | Role |
|------|------|
| `src/App.vue` | Planner shell: state, worker protocol, ranking, 3D markers, panels |
| `src/style.css` | Design tokens and the whole visual system of the planner |
| `src/components/Icon.vue`, `src/components/icons.js` | The single icon set used by the interface |
| `src/core/geo.js` | Polar stereographic pixel to latitude/longitude, lunar radius, curvature drop |
| `src/core/astro.js` | Sun, Earth and Moon positions (truncated Meeus + IAU lunar rotation) |
| `src/core/engine.js` | Slope, local gradient, 360° horizon, projected shadows, visibility rule |
| `src/core/illumination.js` | 30-day illumination map on a coarse (1.28 km) grid |
| `src/core/windows.js` | Per-site daily Sun/DTE visibility and annual window search |
| `src/core/power.js` | Panel power model and DSN station geometry |
| `src/core/nasa_suite.js` | Radiative temperature, glideslope corridor, TRN, libration margin |
| `src/core/dispersion.js` | Landing ellipse sampling and survival score |
| `src/core/pois.js` | The 25-site catalogue (single source of truth) |
| `src/core/autopilot.worker.js` | Slope, footprint, illumination and glideslope audit off the main thread |
| `src/3d/` | Three.js scene, DEM loader, terrain mesh, scientific texture layers |
| `src-tauri/` | Desktop shell (Tauri 2) |
| `tests/verify.mjs` | Numerical self-checks, 14 sections |
| `tests/perf.mjs` | Timings against `tests/perf-baseline.json` |
| `tests/sfc-check.mjs` | Compiles the SFC template and script without starting Vite |
| `docs/` | Architecture, platform features, renderer notes |

## Validation

`node tests/verify.mjs` exits non-zero on the first failed check and prints `TODO OK` otherwise. Its reference values are Skyfield + JPL DE421 baked into `tests/fixtures.json`:

| Quantity | Fixture-measured error |
|----------|------------------------|
| Sun elevation / azimuth | 0.003° / 0.003° |
| Earth elevation / azimuth | 0.062° / 0.236° |
| Moon from Madrid, Goldstone, Canberra | 0.067° / 0.153° |

The truncation bound the series themselves claim is looser (about 0.05° elevation and 0.1–0.3° azimuth). Section 12 checks the dispersion scoring: the same centre cell on a plateau and on a summit must separate by a factor of four once the ellipse is considered.

## Data provenance

The tool runs on measured data, not on a scripted demo. The surface is the real LOLA south pole reduction at 160 m per cell, and every topographic number (slope, horizon, shadow, footprint audit, monthly illumination) is a ray march over those cells. Sun and Earth positions come from Meeus / IAU 2000A series evaluated at the selected UTC instant, together with the Sun-Moon distance, the Earth-Moon distance and the DSN range, which is what makes the irradiance 1400.8 W per m2 at perihelion and 1311.8 W per m2 at aphelion instead of a fixed constant. Everything visible is either that data, a closed-form law applied to it, or a declared assumption; `docs/FEATURES_PLATFORM.md` has the full table, including the lander presets and the dispersion ellipse, which are illustrative and editable.

## Assumptions and limits

Every model that is illustrative rather than measured is declared in `features.md` with its constant and source: instantaneous radiative equilibrium instead of a thermal model, a single directional Sun light in the 3D view, a constant map scale (the stereographic factor stays under 1 % down to 84.7° S), block-maximum obstacles in the illumination map, illustrative vehicle presets, and the imperative that the dispersion ellipse is a 3U-class figure rather than a guidance solution.

Not implemented: rover traverse planning, distance to permanently shadowed regions, atmospheric refraction at the DSN stations, and annual window search wired to the interface.

## Orientation check

The map is stored with the polar stereographic projection of the LOLA product. Malapert (86° S, 0.1° E) must appear above the map centre in the 3D view; if it appears below, set `ROW_DIR = +1` in `src/core/geo.js`.

## Rebuilding on the bare framework

`docs/HACKATHON_GUIDE.md` is the build specification for this interface: design tokens, component inventory, engine contracts, the ranking and dispersion algorithms that live above the engine, and the traps found during the first build. `docs/HACKATHON_PROMPT.md` is the same material as a single instruction to paste into a coding agent at the start of a hackathon, when the repository is only the `src/core` engine.

## License

MIT — see `LICENSE`.
