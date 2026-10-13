# L-SEA Feature Inventory (v0.2.0)

*Last updated: 2026-10-13*

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
| **Sun Position** | Truncated Meeus series + IAU lunar rotation (validated ≤ 0.003° vs JPL DE421) |
| **Earth Position** | Same pipeline (validated ≤ 0.06° elevation, ≤ 0.24° azimuth) |
| **Moon-from-Earth** | Topocentric elevation/azimuth for DSN sites (WGS84, parallax) — validated ≤ 0.07° |
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
| **Top 5 Refinement** | Main thread re-scores with exact horizon + per-site ephemerides |

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

| Item | Description |
|------|-------------|
| **Node Verify Suite** | `tests/verify.mjs` — physics checks vs Skyfield/JPL DE421 reference values |
| **Analytic Benchmarks** | Ramp/wall cases for slope & horizon |

---

## Key Assumptions / Limits

- ⚠️ Truncated Meeus series (≈0.05° error in elevation), not JPL ephemerides
- ⚠️ 30-day map is coarse (1.28 km), conservative toward shadow
- ⚠️ 3D Sun is parallel light at active point elevation (curvature ignored far away)
- ⚠️ Vehicle specs, DSN 10° mask, TRN/libration thresholds, approach azimuth = illustrative
- ⚠️ Temperature = instantaneous radiative equilibrium (no regolith conduction, not Diviner)
- ❌ Not implemented: rover traverse planning, PSR distance metrics

---

## Tech Stack

- **Frontend**: Vue 3 + Vite + Tailwind CSS v4
- **3D**: Three.js (ACES tone mapping, PCF shadows, OrbitControls)
- **Worker**: Native ES module Web Worker for heavy computation
- **Data**: Binary Float32Array DEM (4000×4000 = 64 MB)