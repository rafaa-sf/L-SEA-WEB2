# Platform Features

This document describes what the platform computes, which function performs each calculation, and which part of the interface exposes it. Function names are the stable identifier: this document names functions rather than line numbers, so it survives edits to the sources.

## Ephemerides and Earth geometry

`calcularEfemeridesMeeus` in `src/core/astro.js` returns Sun and Earth vectors for a UTC instant in the international celestial reference frame. `direccionesLunar` in `src/core/astro.js` converts those vectors into the lunar frame using `matriz_icrf_a_luna` in `src/core/astro.js`; `azElLocal` then projects them onto the local horizontal plane of a point with a given latitude, longitude and heading. `lunaDesdeEstacion` in `src/core/astro.js` performs the reverse problem for the DSN stations: topocentric Moon elevation and azimuth with WGS84 parallax and no refraction.

The Sun is treated as a disc with radius `RADIO_SOL = 0.267°`; `CONSTANTE_SOLAR = 1361.0` W/m² is the flux at exactly 1 AU and `flujoSolar` in `src/core/astro.js` scales it by the inverse square of the computed Sun-Moon distance, so the value that reaches the thermal and power models moves between 1311.8 and 1400.8 W/m² over the year. The clock correction is `DELTA_T_S = 69.2` s. Each map point uses its own latitude, longitude and heading, so two candidates a few kilometres apart get different Sun vectors. `calcularEfemeridesMeeus` also returns `sol_km` and `tierra_km`, and `telemetria_dsn` in `src/core/power.js` turns the station range into a one-way light time at 299 792.458 km/s.

## Terrain horizon and line of sight

`calculateHorizonProfile` in `src/core/engine.js` ray-marches the DEM from a lander mast (2 m by default, per vehicle) through 360 azimuths, subtracting `caidaCurvatura` (`src/core/geo.js`) from the terrain elevation. `isTargetVisible` in `src/core/engine.js` applies one visibility rule everywhere:

```
visible = elevation + radius > horizon[azimuth]
```

with `radius` equal to `RADIO_SOL` for the Sun and zero for the Earth. `calculateProjectedShadows` in `src/core/engine.js` renders the same geometry as shadow bands on the map; it is used by the illumination layer and tested, but not exposed as a separate control.

The Horizon profile panel reads that same profile four ways. The polar plot puts bearing on the angle (north up, east right) and elevation on the radius, outer ring 0° and centre 30°, so the drawn polygon is the physical skyline seen from the mast and the Sun and Earth dots fall outside it exactly when they clear it. Below the plot, Skyline peak gives the highest obstruction and its bearing, Mean skyline averages the 360 samples, Bearings above 1 deg counts how much of the circle is closed off, and Sun clearance subtracts the profile at the Sun bearing from the Sun elevation, which is the margin the visibility rule uses. All four numbers are recomputed whenever the active site, the mast height or the clock moves.

## Slope, footprint and cell ranking

`calculateSlopeDegrees` in `src/core/engine.js` computes the slope from central differences at real scale; `gradienteLocal` in `src/core/engine.js` returns the same gradient for one cell, which is what the click-to-probe readout and the dispersion sampler use. `clasificarPendiente` in `src/core/engine.js` maps a slope to `NOMINAL`, `CAUTION` or `HAZARD` against the vehicle limit.

The worker (`src/core/autopilot.worker.js`) runs the audit:

- skips an 8 % border of the DEM so the footprint stays inside the grid;
- for every remaining cell, takes the worst slope inside the footprint radius and rejects the cell when that slope exceeds the vehicle limit;
- computes `S = (1 − worstSlope/maxSlope)²`, samples the 30-day illumination map at `floor(row / step)`, and scores `cell = 100 · (0.6 · S + 0.4 · L)`;
- keeps `POOL = 15` candidates with non-maximum suppression at a 40-cell radius, and evaluates the glideslope corridor for each.

`refineCandidates` in `src/App.vue` then re-scores those 15 in the main thread with the exact horizon (`visibilidadDiaria`, `calcularEfemeridesMeeus`, `gradienteLocal`), the thermal model, `isTargetVisible`, and the glideslope corridor, sorts them by score and keeps the Top 5. The audit button that starts the chain lives in the left rail of the planner.

## Landing dispersion and robust ranking

`src/core/dispersion.js` defines the dispersion ellipse as `LANDING_ELLIPSE` (semi-major 240 m, semi-minor 120 m, azimuth 270°) and `sampleEllipse`, which returns 37 contact points: the centre, then three rings at 0.55, 0.8 and 1.0 of the semi-axes with 12 azimuths each.

`scoreDispersion` walks those contacts and evaluates, for each one,

```
q = 60 · (1 − worstSlope/maxSlope)² + 40 · sunFraction
```

Slope values are read through a caller-supplied `slopeAt` function and cached in a `Map`, so the sampler never recomputes a cell twice. A contact steeper than the limit contributes zero and counts as outside the safe footprint; the survival score is the mean of the 37 contacts, and the coverage is the fraction of contacts inside the limit. A cell whose slope is missing (outside the DEM) is treated as a hazard, not as a pass.

The result feeds `rankedCandidates` in `src/App.vue`: with robust ranking enabled the Top 5 is ordered by survival score, the matrix shows survival, coverage and worst ellipse slope, and the thumbnail strip redraws the ellipse (`ellipseOutline`) instead of a circle. With the switch off, ordering falls back to the cell score.

## Monthly illumination

`iluminacionMensual` in `src/core/illumination.js` samples one instant per day at a fixed UTC hour. Each coarse cell stores its centre elevation plus 2 m, a block maximum used as the obstacle height, its local basis and its longitude. For each day it projects the Sun direction onto that basis, skips the day when the Sun is below the local horizon with the disc radius included, and ray-marches the coarse grid with the curvature drop. The result is a fraction in `[0, 1]` per cell.

The worker receives `ILLUM_PASO = 8` from `src/App.vue`, so the coarse grid is 1.28 km and a 30-day run takes about 3 s on the shipped 4000 × 4000 DEM. `visibilidadDiaria` in `src/core/windows.js` solves the same problem for one site at full DEM resolution and returns the per-day Sun and direct-to-Earth visibility used by the timeline. `buscar_ventanas_anuales` in `src/core/windows.js` scans a 365-day window for stays that keep a minimum Sun and DTE percentage; it is tested but not yet exposed in the interface.

## Engineering models

| Model | Function | Notes |
|-------|----------|-------|
| Radiative temperature | `calculateRadiativeEquilibrium` (`src/core/nasa_suite.js`) | Instantaneous equilibrium on a facet facing the Sun; albedo 0.12, emissivity 0.95, floor `T_MIN = 40 K` |
| Glideslope corridor | `evaluateGlideslopeCorridor` (`src/core/nasa_suite.js`) | Straight 12° line from 1.5 to 20 km at azimuth 270°, curvature included; clear requires a worst margin above 150 m, collision below 100 m |
| TRN feasibility | `evaluateTrnFeasibility` (`src/core/nasa_suite.js`) | Relief measured on the DEM over a 17 × 17-cell window, multiplied by an assumed shadow-contrast curve of the Sun elevation; `TRN_SUN_BLIND = 0.8°`, `TRN_SUN_OPTIMAL = 3.0°` |
| Libration and link margin | `evaluateLibrationRisk` (`src/core/nasa_suite.js`) | Earth elevation over the terrain horizon at its azimuth, with a 2.5° risk band |

## Power and DSN

`calcular_potencia_electrica` in `src/core/power.js` models a 2 m² panel at 29 % efficiency with a 100 W base load; the illumination term is `cos(elevation)` for a vertical, Sun-facing panel and `sin(elevation)` for a horizontal one. `telemetria_dsn` in `src/core/power.js` returns the Moon's topocentric elevation and azimuth from Madrid, Goldstone and Canberra; `estacionActivaDSN` in `src/core/power.js` picks the highest station above `DSN_MIN_ELEVACION = 10.0°`. The link state (`up`, `marginal`, `down`) is derived from that elevation.

## Interface panels

The application is one screen with two tabs, `Planning` and `3D view`. The top bar carries the site selector (25 sites, one frozen catalogue in `src/core/pois.js`), the mission brief export and the compute state.

The planner has three regions:

- **Left rail** — surface conditions (landing date, evaluation hour, stay length), lander model with footprint radius, and landing dispersion with the robust ranking switch and the ellipse axes.
- **Centre** — the candidate matrix, which is the primary ranking surface, followed by the surface timeline with the MET simulator, the speed control and the next-link jump.
- **Right rail** — selected site hero value and dense label/value rows (geometry, dispersion coverage, Sun and Earth percentages, temperature, TRN, approach margin), power and link telemetry, and the horizon radar.

The matrix lists the top five of the evaluated pool: rank, site identifier, latitude, longitude, elevation, worst slope, survival, Sun, Earth and score. The column that drives the ordering is marked with an accent underline, so the effect of the robust ranking switch is visible without reading the numbers. Ticking the checkbox on two to five sites opens the comparator: one column per site, ten metrics per row, the winning value highlighted, and a verdict line naming the candidate the active ranking prefers. Ticking a sixth site drops the oldest column.

The 3D view is a full-bleed canvas with four overlays: display layers and lighting, the point probe, the catalogue legend and the selected site summary.

The Surface timeline panel carries the mission clock. It advances continuously inside the selected hour: `simSecond` accumulates `dt × speed` every animation frame, rolls into the hour and the date, and triggers a full ephemeris recomputation only when an hour boundary is crossed, so a 3600x run does not stack one recomputation per frame. At 1x the clock moves one second per second, at 60x one minute per second, at 3600x one hour per second. The reactive write is throttled to 10 Hz, and a manual change of the date or hour resets the second hand instead of inheriting the old offset. The play button therefore animates the clock on the Planning tab with no renderer involved, and Next link jumps the date to the next Earth-visibility window and zeroes the second hand.


## Export

`exportBrief` in `src/App.vue` writes `LSEA_MissionBrief_<date>.json` with the active point, the vehicle preset, the ellipse, the telemetry currently on screen, the ranked candidates and the assumptions list from `features.md`. The MET clock starts at 2026-10-08 12:00 UTC.

## Data provenance

Every number on screen traces to one of four sources. The first two are measured data, the third is physics applied to that data, the fourth is an assumption and is labelled as such in the interface.

| Quantity | Source | Where |
| --- | --- | --- |
| Surface elevation, 4000 x 4000 cells, 160 m per cell, 640 km square | LOLA south pole reduction (LDEM), not synthetic. 64 MB binary read straight into the browser | `public/data/lola_shackleton.bin`, `src/3d/loader.js`, `descargar_lola.py` |
| Slope, aspect, horizon profile, projected shadows, footprint audits, monthly illumination | Computed from the DEM cells by central differences and ray marching, cell by cell | `src/core/engine.js`, `src/core/illumination.js` |
| Sun and Earth direction, elevation, azimuth, Earth-Sun distance, Earth-Moon distance, station range and one-way light time | Meeus / IAU 2000A series evaluated at the selected UTC instant and the site coordinates | `src/core/astro.js`, `src/core/power.js` |
| Solar irradiance at the Moon | Inverse-square law on the computed Sun-Moon distance: 1400.8 W per m2 at perihelion, 1311.8 W per m2 at aphelion, 1361 W per m2 at 1 AU | `flujoSolar` in `src/core/astro.js` |
| Radiative equilibrium temperature, array output, DSN elevation mask, glideslope corridor, TRN feasibility | Closed-form physics on the measured terrain gradient and the computed ephemeris | `src/core/nasa_suite.js`, `src/core/power.js` |
| 25 site coordinates | Catalogue of real selenographic positions around the south pole | `src/core/pois.js` |
| Lander presets: dry mass, solar area, base load, slope limit | Illustrative. Editable, not a specific flight unit | `LANDERS` in `src/App.vue` |
| Landing ellipse 240 m x 120 m at 270° | Illustrative dispersion for the ranking demonstration | `LANDING_ELLIPSE` in `src/core/dispersion.js` |
| Albedo 0.12, emissivity 0.95, T_MIN 40 K, panel efficiency 0.29, 60/40 ranking weights | Model constants, documented and constant | `src/core/nasa_suite.js`, `src/core/dispersion.js` |

Nothing is fetched at runtime: the DEM ships with the build and the ephemerides are computed locally, so the tool works offline. There is no live spacecraft telemetry, no measured surface reflectivity or thermal inertia map, and no atmospheric model, because none of those are available for the site.

## Declared limits

The platform does not model regolith conduction, atmospheric refraction, a guidance-grade dispersion, or the real thermal inertia of a lander. The illumination map samples once per day at a coarse 1.28 km grid, the 3D Sun is a single directional light evaluated at the active point, and the map scale is constant (the stereographic scale error stays under 1 % down to 84.7° S). Vehicle presets, the DSN mask, the TRN Sun curve and the libration bands are illustrative. Rover traverse planning and distance to permanently shadowed regions are not implemented; `buscar_ventanas_anuales` and `calculateProjectedShadows` exist and are tested but are not wired to a control.
