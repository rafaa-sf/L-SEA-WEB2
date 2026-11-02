# L-SEA Feature Inventory

*Last updated: 2026-11-01*

---

## Core Topographic Engine (`src/core/engine.js`)

| Feature | Description |
|---------|-------------|
| **Slope Calculation** | Central-difference gradient at real scale (m/m → degrees) |
| **360° Terrain Horizon** | Ray-tracing from lander mast with lunar curvature (d²/2R) |
| **Shadow Casting** | Projected shadows for Sun at any azimuth/elevation, with curvature |
| **Visibility Rule** | Single unified rule: `elevation + radius > terrainHorizon[azimuth]` (Sun: +0.267° limb) |
| **Slope Classification** | NOMINAL / CAUTION / HAZARD relative to vehicle slope limit |

---

## Astronomy / Ephemerides (`src/core/astro.js`)

| Feature | Description |
|---------|-------------|
| **Sun Position** | Truncated Meeus series + IAU lunar rotation. Max error vs Skyfield/JPL DE421 over the 30 bundled fixtures: 0.003° elevation, 0.003° azimuth |
| **Earth Position** | Same pipeline. Max error over the same fixtures: 0.062° elevation, 0.236° azimuth |
| **Moon-from-Earth** | Topocentric elevation/azimuth for DSN sites (WGS84, parallax, geometric — no refraction). Max error over 36 fixtures: 0.067° elevation, 0.153° azimuth |
| **Declared Precision** | The fixtures are a bounded sample; the series' own truncation bound is looser (~0.05° elevation, 0.1–0.3° azimuth). Not sub-arcsecond — see `src/core/astro.js:6-8` and the limit table below |
| **Per-Point Ephemerides** | Each map point uses its own lat/lon/heading for Sun/Earth vectors |

---

## 30-Day Illumination Map (`src/core/illumination.js`)

| Feature | Description |
|---------|-------------|
| **Coarse Grid (1.28 km)** | 1 sample/day, block-maximum obstacles (conservative) |
| **Real Shadow Ray-Tracing** | Per-cell Sun position + horizon test with lunar curvature |
| **Web Worker Computation** | Off-main-thread, ~3 s for 30 days at the shipped 1.28 km grid (`paso = 8`, real 4000×4000 DEM, measured 2026-10-15) |

---

## Daily Visibility Windows (`src/core/windows.js`)

| Feature | Description |
|---------|-------------|
| **Per-Site Daily Sun/DTE** | 30-day timeline using real terrain horizon + site ephemerides |
| **Annual Window Search** | Sliding-window finder for mission-duration stays with min Sun/DTE % |

---

## Autopilot / Site Ranking (`src/core/autopilot.worker.js`)

| Feature | Description |
|---------|-------------|
| **Safety Footprint Audit** | Anti-cliff check: max slope within configurable radius (320/480/640 m) |
| **Cell Scoring** | `60% safety + 40% 30-day Sun fraction` evaluated on the cell centre |
| **Non-Maximum Suppression** | Spatial separation of candidates (40-cell radius) |
| **Top 5 Refinement** | Worker returns 15 candidates; main thread re-scores them with the exact horizon and per-site ephemerides, then keeps 5 |

---

## Landing Dispersion / Robust Ranking (`src/core/dispersion.js`)

No module lands on a single cell: the touchdown point is spread over an ellipse. Enabling *Robust ranking* scores the ellipse instead of the centre cell, so a narrow 95-point peak can rank below a wide 80-point plateau.

| Feature | Description |
|---------|-------------|
| **Dispersion Ellipse** | Semi-major 240 m, semi-minor 120 m, oriented along the 270° approach (illustrative values, editable in the planner) |
| **Contact Sampling** | 37 contact points: centre plus three rings (0.55, 0.8, 1.0 of the axes) at 12 azimuths each |
| **Per-Contact Score** | `q = 60% · (1 − worstSlope/maxSlope)² + 40% · Sun fraction` at that contact |
| **Unsafe Contact Rule** | A contact steeper than the vehicle limit contributes **zero**, not a partial Sun bonus: a cliff next to a sunlit cell must not raise the survival score |
| **Survival Score** | Mean of the 37 contact scores, 0–100 with one decimal, plus the fraction of contacts inside the slope limit |
| **Ranking Toggle** | With robust ranking on, the Top 5 is re-ordered by survival score and the matrix shows survival, coverage and worst ellipse slope; with it off, the ranking is the cell score |
| **Ellipse Footprint** | The 3D marker draws the rotated dispersion ellipse so the spread is visible at the candidate |

---

## Engineering Models (`src/core/nasa_suite.js`)

| Feature | Description |
|---------|-------------|
| **Radiative Temperature** | Instant equilibrium on sloped surface facing Sun (no regolith conduction) |
| **Glideslope Corridor** | Straight 12° line, 1.5–20 km, fixed approach azimuth, with curvature |
| **TRN Feasibility** | Score = measured terrain relief (mean slope over a 17×17-cell window) × assumed shadow-contrast curve vs Sun elevation |
| **Libration/Link Margin** | Earth elevation over terrain horizon at its azimuth |

---

## Power & DSN (`src/core/power.js`)

| Feature | Description |
|---------|-------------|
| **EPS Model** | `cos(elevation)` for vertical Sun-tracking panel (or `sin` for horizontal) |
| **DSN Telemetry** | Real Moon elevation over Madrid, Goldstone, Canberra (WGS84) |
| **Active Complex Selector** | Highest eligible station above 10° mask |

---

## GIS / 3D Viewer (`src/3d/`)

| Feature | Description |
|---------|-------------|
| **Terrain Mesh** | 4000×4000 DEM → decimated 1000×1000 render mesh (LOD, stride 4) with shadows |
| **Scientific Layers** | PBR regolith / Hypsometric elevation / Slope risk / 30-day illumination |
| **Click-to-Probe** | Raycast against actual terrain mesh → instant telemetry panel |
| **Automatic Renderer** | WebGL2 when available; otherwise the CPU column raycaster (`src/3d/software.js`) takes over with the same layers, markers and picking. The Display panel tags the live path `GPU` or `CPU` |
| **POI Navigation** | 25 labeled sites from a single catalogue (`src/core/pois.js`): PSR craters, massifs, CLPS/Artemis targets and reference points, with search and type filter |
| **Camera Fly-To** | Auto-navigate to any POI or candidate site |

---

## Site Catalogue (`src/core/pois.js`)

| Feature | Description |
|---------|-------------|
| **Single Source of Truth** | 25 sites with code, name, coordinates, type and one-line description; the 3D labels, the search dropdown and the documentation all read the same array |
| **Types** | PSR craters, massifs, CLPS/Artemis targets, reference points |
| **English Copy** | Site names keep their official designations; descriptions are English prose |

---

## Mission Planner UI (`src/App.vue`)

Engineer-facing layout in the style of STK and ANSYS: one primary element (the 3D map), everything else in dense rows split by hairlines, semantic colour plus one stroke-1.5 icon set, sentence case text and uppercase reserved for short field labels.

| Feature | Description |
|---------|-------------|
| **Candidate Matrix** | Top 5 ranked sites: survival or cell score, worst slope, GNC margin, Sun/DTE %, temperature, TRN status |
| **Robust Ranking Switch** | Re-scores and re-orders the Top 5 on the dispersion ellipse; the ellipse axes and orientation are inputs of the planner |
| **Side-by-Side Comparator** | Up to five checked sites in one table, eight metrics per row, best value highlighted, a verdict line naming the site the active ranking prefers |
| **Survival Timeline** | 7-day grid: Sun (amber) and direct-to-Earth (steel blue) per day |
| **MET Simulator** | Play/pause, 1×/60×/3600×; the second hand advances on every animation frame (`advanceClock`), rolls into the hour and the date, and recomputes telemetry once per hour boundary |
| **Polar Radar** | 360° horizon plot with cardinal marks, the Sun and Earth positions overlaid, and four summary numbers: skyline peak with its bearing, mean skyline, bearings above 1°, Sun clearance |
| **Vehicle Presets** | Nova-C, Griffin, HAKUTO-R, Starship HLS (illustrative specs) |
| **Mission Brief Export** | JSON with active point, vehicle, telemetry, candidates and assumptions |

---

## Data Pipeline

| Component | Description |
|-----------|-------------|
| **DEM Loader** | Binary format with header (rows, cols, mpc) — LRO/LOLA 640 km × 640 km @ 160 m |
| **Python Fetcher** | `descargar_lola.py` downloads & builds `lola_shackleton.bin` |

---

## Validation & Testing

`node tests/verify.mjs` — zero dependencies, exits non-zero on any failed check. Fourteen sections:

| # | Section | What it proves |
|---|---------|----------------|
| 1 | Sun / Earth vs JPL | Elevation & azimuth vs Skyfield + DE421 (30 fixtures) |
| 2 | DSN geometry | Moon topocentric el/az from Madrid, Goldstone, Canberra (36 fixtures, no refraction) |
| 3 | Map geometry | lat/lon to pixel round-trip; curvature drop 2878 m at 100 km |
| 4 | Horizon & shadows | Analytic 250 m wall at 5 km; curvature lowers the horizon; visibility rule |
| 5 | Slope, power, thermal | 7 m/40 m ramp; vertical vs horizontal panel; orientation-dependent temperature; determinism |
| 6 | Glideslope corridor | Flat terrain clear; 1.5 km mountain in the path blocks it |
| 7 | Monthly illumination | Deep synthetic crater floor stays darker than the surrounding plain |
| 8 | Mesh sizes | 500/1000/2000-cell DEMs at 320/80/40 m recover the analytic slope |
| 9 | Polar scale factor | Stereographic scale error < 1 % down to lat −84.72° |
| 10 | Mesh to grid alignment | 0/76924 vertices off-cell; click-to-probe raycast offset < 12 m |
| 11 | TRN relief | Same Sun, the rough window scores > 40 points above the flat one; 30° Sun flattens the contrast; invalid DEM/position returns NO DATA |
| 12 | Landing dispersion | Same centre cell, two terrains: a 4° plateau scores 66.7 with full coverage, a 240×120 m ellipse on a summit drops to 16.6 with 24% coverage although the centre cell passes the 4° audit; the unsafe-contact rule, the 37-sample pattern, the 270° orientation and determinism are checked |
| 13 | Real distances and light time | Sun–Moon distance from the ephemeris stays inside the perihelion/aphelion envelope, the solar flux follows the inverse-square law from 1361 W/m² at 1 AU, the Earth–Moon range stays inside 356 400–406 700 km, the DSN one-way light time matches range / c, and array output scales with the flux actually received |
| 14 | Planner clock | 1x advances one simulated second per real second, 60x one minute, 3600x one hour; the hour and the day roll over; a zero delta leaves the clock untouched |

Reference values live in `tests/fixtures.json` (Skyfield + JPL DE421).

---

## Tech Stack

- **Frontend**: Vue 3 + Vite + Tailwind CSS v4
- **3D**: Three.js (ACES tone mapping, PCF shadows, OrbitControls)
- **Worker**: Native ES module Web Worker for heavy computation
- **Data**: Binary Float32Array DEM (4000×4000 = 64 MB)

---

## Data Provenance

Nothing on screen is a canned value. The table below separates what is measured, what is physics applied to that measurement, and what is a declared assumption. `docs/FEATURES_PLATFORM.md` carries the same table with the exact source of each row.

| Layer | Origin |
|-------|--------|
| Surface relief, 4000×4000 cells at 160 m | Real LOLA south pole reduction, `public/data/lola_shackleton.bin` |
| Slope, aspect, horizon, shadows, footprint audits, monthly illumination | Ray marched over those DEM cells in `src/core/engine.js` and `src/core/illumination.js` |
| Sun and Earth vectors, Earth–Sun and Earth–Moon distance, DSN range, one-way light time | Meeus / IAU 2000A series evaluated at the selected UTC instant in `src/core/astro.js`, checked against Skyfield + DE421 |
| Solar irradiance at the Moon | `flujoSolar` from the computed distance: 1400.8 W/m² at perihelion, 1311.8 W/m² at aphelion |
| Temperature, array power, DSN mask, glideslope corridor, TRN feasibility | Closed-form physics on the measured gradient and the computed ephemeris |
| 25 site coordinates | Real selenographic positions in `src/core/pois.js` |
| Lander presets, landing ellipse, albedo, emissivity, T_MIN, panel efficiency, 60/40 weights | Declared model constants, editable, listed as assumptions below |

## Assumptions & Limits

Every limit below is declared in the source, with the constant or line that enforces it. Nothing is approximated silently.

| # | Assumption / limit | Value | Source |
|---|--------------------|-------|--------|
| 1 | Ephemerides are truncated Meeus + IAU lunar rotation, not JPL. Fixture-measured error is 0.003°–0.24° (see above), but the truncation bound the code claims is looser: ~0.05° elevation, 0.1–0.3° azimuth | — | `src/core/astro.js:6-8` |
| 2 | Monthly illumination is coarse: 1 sample per day at a fixed UTC hour, block-maximum obstacles (conservative toward shadow), Sun treated as a disc (upper limb) | step 8 cells × 160 m = 1.28 km | `src/core/illumination.js:10-12,20` |
| 3 | Candidate scoring inherits that 1.28 km resolution — the coarse cell is resampled per candidate with `floor(r/paso)` | — | `src/core/autopilot.worker.js:21-25,71-75` |
| 4 | The 3D Sun is one directional light set to the active point's Sun vector; curvature of the light direction away from that point is ignored | 2048² shadow map | `src/3d/scene.js` |
| 5 | Map scale is a constant metres-per-cell; the polar stereographic scale factor is not applied (error < 1 % to lat −84.72°) | k ≤ 1.0021 | `src/core/geo.js`, `tests/verify.mjs` §9 |
| 6 | Observation mast: +2 m over the sampled cell value for the horizon, and the same +2 m offset for the illumination observer | +2.0 m | `src/core/illumination.js:37`, `src/core/windows.js:13` |
| 7 | Temperature is instantaneous radiative equilibrium on the sloped facet — no regolith conduction, no thermal inertia, and not Diviner. Shadowed ground is clamped to an assumed floor | T_MIN = 40 K | `src/core/nasa_suite.js:19-27` |
| 8 | Vehicle presets, DSN elevation mask, the TRN Sun-contrast curve and the libration risk bands are illustrative, not official. The TRN relief term is measured from the DEM, only its Sun curve is assumed | DSN mask 10.0° | `src/core/power.js:17`, `src/core/nasa_suite.js:91-96,118` |
| 9 | Descent corridor is a straight line at a fixed glideslope and the same approach azimuth for every site | 270.0°, 12.0° | `src/core/nasa_suite.js:12-13` |
| 10 | One DEM at a time (hard-coded `/data/lola_shackleton.bin`); no mosaicking. The loader rejects header/size mismatches instead of failing silently | 4000×4000 @ 160 m | `DEM_URL` in `src/App.vue`, `src/3d/loader.js:14-24` |
| 11 | Autopilot audit skips an 8 % border of the DEM so the safety footprint stays inside the grid, and returns 15 candidates before the main-thread Top-5 refinement | 8 %, POOL = 15 | `src/core/autopilot.worker.js:9,49` |
| 12 | All timing is UTC; daily visibility and the monthly map sample once per day at 12:00 UTC | — | `src/core/illumination.js:20`, `src/core/windows.js:13` |
| 13 | The dispersion ellipse is an illustrative 3U-class figure (240×120 m at the fixed 270° approach azimuth), not a guidance dispersion from a real vehicle model; the survival score is a mean over 37 contacts and an unsafe contact scores zero by design | 240 m × 120 m, 37 samples | `src/core/dispersion.js` |

