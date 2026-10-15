# L-SEA Feature Inventory (v0.2.0)

*Last updated: 2026-10-15*

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
| **Web Worker Computation** | Off-main-thread (~1 s for 30 days) |

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
| **Scoring** | `60% safety + 40% 30-day Sun fraction` |
| **Non-Maximum Suppression** | Spatial separation of candidates (40-cell radius) |
| **Top 5 Refinement** | Worker returns 15 candidates; main thread re-scores them with the exact horizon and per-site ephemerides, then keeps 5 |

---

## Engineering Models (`src/core/nasa_suite.js`)

| Feature | Description |
|---------|-------------|
| **Radiative Temperature** | Instant equilibrium on sloped surface facing Sun (no regolith conduction) |
| **Glideslope Corridor** | Straight 12° line, 1.5–20 km, fixed approach azimuth, with curvature |
| **TRN Feasibility** | Optical contrast score based on Sun elevation (illustrative thresholds) |
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
| **Terrain Mesh** | 4000×4000 DEM → decimated 500×500 render mesh (LOD) with shadows |
| **Scientific Layers** | PBR regolith / Hypsometric elevation / Slope risk / 30-day illumination |
| **Click-to-Probe** | Raycast against actual terrain mesh → instant telemetry panel |
| **POI Navigation** | 30+ labeled sites (PSR craters, mountains, CLPS/Artemis targets) with search/filter |
| **Camera Fly-To** | Auto-navigate to any POI or candidate site |

---

## Mission Planner UI (`src/App.vue`)

| Feature | Description |
|---------|-------------|
| **Candidate Matrix** | Table of Top 5: slope, GNC margin, Sun/DTE %, temperature, suitability score |
| **Side-by-Side Comparator** | 2-site comparison with highlighted better metric per row |
| **Survival Timeline** | 7-day visual grid: Sun (amber) / DTE (emerald) per day |
| **MET Simulator** | Play/pause, 1×/60×/3600× — advances UTC hour & date, recomputes all telemetry |
| **Polar Radar** | 360° horizon plot with Sun/Earth positions overlaid |
| **Vehicle Presets** | Nova-C, Griffin, HAKUTO-R, Starship HLS (illustrative specs) |
| **Mission Brief Export** | JSON with active point, vehicle, telemetry, candidates, assumptions |

---

## Data Pipeline

| Component | Description |
|-----------|-------------|
| **DEM Loader** | Binary format with header (rows, cols, mpc) — LRO/LOLA 640 km × 640 km @ 160 m |
| **Python Fetcher** | `descargar_lola.py` downloads & builds `lola_shackleton.bin` |

---

## Validation & Testing

`node tests/verify.mjs` — zero dependencies, exits non-zero on any failed check. Ten sections:

| # | Section | What it proves |
|---|---------|----------------|
| 1 | Sun / Earth vs JPL | Elevation & azimuth vs Skyfield + DE421 (30 fixtures) |
| 2 | DSN geometry | Moon topocentric el/az from Madrid, Goldstone, Canberra (36 fixtures, no refraction) |
| 3 | Map geometry | lat/lon ↔ pixel round-trip; curvature drop 2878 m at 100 km |
| 4 | Horizon & shadows | Analytic 250 m wall at 5 km; curvature lowers the horizon; visibility rule |
| 5 | Slope, power, thermal | 7 m/40 m ramp; vertical vs horizontal panel; orientation-dependent temperature; determinism |
| 6 | Glideslope corridor | Flat terrain clear; 1.5 km mountain in the path blocks it |
| 7 | Monthly illumination | Deep synthetic crater floor stays darker than the surrounding plain |
| 8 | Mesh sizes | 500/1000/2000-cell DEMs at 320/80/40 m recover the analytic slope |
| 9 | Polar scale factor | Stereographic scale error < 1 % down to lat −84.72° |
| 10 | Mesh ↔ grid alignment | 0/76924 vertices off-cell; click-to-probe raycast offset < 12 m |

Reference values live in `tests/fixtures.json` (Skyfield + JPL DE421).

---

## Tech Stack

- **Frontend**: Vue 3 + Vite + Tailwind CSS v4
- **3D**: Three.js (ACES tone mapping, PCF shadows, OrbitControls)
- **Worker**: Native ES module Web Worker for heavy computation
- **Data**: Binary Float32Array DEM (4000×4000 = 64 MB)

---

## Assumptions & Limits

Every limit below is declared in the source, with the constant or line that enforces it. Nothing is approximated silently.

| # | Assumption / limit | Value | Source |
|---|--------------------|-------|--------|
| 1 | Ephemerides are truncated Meeus + IAU lunar rotation, not JPL. Fixture-measured error is 0.003°–0.24° (see above), but the truncation bound the code claims is looser: ~0.05° elevation, 0.1–0.3° azimuth | — | `src/core/astro.js:6-8` |
| 2 | Monthly illumination is coarse: 1 sample per day at a fixed UTC hour, block-maximum obstacles (conservative toward shadow), Sun treated as a disc (upper limb) | step 8 cells × 160 m = 1.28 km | `src/core/illumination.js:10-12,20` |
| 3 | Candidate scoring inherits that 1.28 km resolution — the coarse cell is resampled per candidate with `floor(r/paso)` | — | `src/core/autopilot.worker.js:21-25,71-75` |
| 4 | The 3D Sun is one directional light set to the active point's Sun vector; curvature of the light direction away from that point is ignored | 4096² shadow map | `src/3d/scene.js:35-43` |
| 5 | Map scale is a constant metres-per-cell; the polar stereographic scale factor is not applied (error < 1 % to lat −84.72°) | k ≤ 1.0021 | `src/core/geo.js`, `tests/verify.mjs` §9 |
| 6 | Observation mast: +2 m over the sampled cell value for the horizon, and the same +2 m offset for the illumination observer | +2.0 m | `src/core/illumination.js:37`, `src/core/windows.js:13` |
| 7 | Temperature is instantaneous radiative equilibrium on the sloped facet — no regolith conduction, no thermal inertia, and not Diviner. Shadowed ground is clamped to an assumed floor | T_MIN = 40 K | `src/core/nasa_suite.js:19-27` |
| 8 | Vehicle presets, DSN elevation mask, TRN thresholds and libration risk bands are illustrative, not official | DSN mask 10.0° | `src/core/power.js:17`, `src/core/nasa_suite.js:88-93` |
| 9 | Descent corridor is a straight line at a fixed glideslope and the same approach azimuth for every site | 270.0°, 12.0° | `src/core/nasa_suite.js:12-13` |
| 10 | One DEM at a time (hard-coded `/data/lola_shackleton.bin`); no mosaicking. The loader rejects header/size mismatches instead of failing silently | 4000×4000 @ 160 m | `src/App.vue:883`, `src/3d/loader.js:14-24` |
| 11 | Autopilot audit skips an 8 % border of the DEM so the safety footprint stays inside the grid, and returns 15 candidates before the main-thread Top-5 refinement | 8 %, POOL = 15 | `src/core/autopilot.worker.js:9,49` |
| 12 | All timing is UTC; daily visibility and the monthly map sample once per day at 12:00 UTC | — | `src/core/illumination.js:20`, `src/core/windows.js:13` |

**Not implemented (explicitly out of scope for the 48 h):** rover traverse planning, PSR distance metrics, atmospheric refraction in DSN elevations.