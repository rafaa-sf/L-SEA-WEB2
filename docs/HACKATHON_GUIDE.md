# L-SEA · Hackathon Build Guide

How to rebuild this application on top of the bare framework (`L-SEA_FRAMEWORK`, engine only, blue canvas).
The guide is written for an AI coding agent but is equally a specification a human can follow.

Two ways to use it:

- **Fast path** — paste `docs/HACKATHON_PROMPT.md` once, then let the agent run the phases in Part 2 in order.
- **Guided path** — paste one phase prompt at a time (Part 2), check the acceptance gate, continue.

Part 3 is the reference: design tokens, layout, engine contracts, the algorithms that live *above* the engine, and the traps that cost the most time in the first build. Part 4 is the demo script and the definition of done.

Working directory, branch and tooling are the reader's choice; every path below is relative to the repository root.

---

## Part 1 — What we are building

A browser application that ranks lunar south-pole landing sites and explains the choice to an engineer.

| Element | Value |
| --- | --- |
| Stack | Vue 3 (`<script setup>`), Vite, three.js, hand-written CSS (Tailwind v4 is installed but the shell does not use utility classes) |
| Engine | `src/core/*.js` — already written, physics only, no DOM |
| Renderer | `src/3d/*.js` — three.js scene, DEM mesh, layer textures |
| Data | `public/data/lola_shackleton.bin` — LOLA south pole reduction, 4000 x 4000 cells, 160 m per cell, 640 km square. 64 MB, so it may not be in the repository; `descargar_lola.py` downloads the 145 MB source product and crops it |
| Language | English everywhere, including code comments in new files |
| Emoji | None, anywhere, including documentation |
| Site catalogue | 25 sites, one single count across the whole project |

The application has two tabs. **Planning** is the analysis surface: inputs on the left, the ranked candidate matrix in the centre, site detail on the right, the surface timeline underneath. **3D view** is the terrain surface with the same catalogue and the same selection.

---

## Part 2 — Phased prompts

Each phase is a self-contained instruction. Run `npm run check` before declaring a phase done; the gate is the same for every phase and is listed in Part 3.7.

Suggested budget for a one-day hackathon: P0 15 min, P1 45, P2 60, P3 45, P4 60, P5 45, P6 30, P7 90, P8 60, P9 45.

### P0 — Recon and guardrails

> Read every module in `src/core/` and `src/3d/` and write `docs/CONTRACTS.md`: one row per exported symbol with its arguments, its return shape and its units. Do not change engine code. Then add the quality gates the project needs, as zero-dependency Node scripts under `tests/`:
> - `sfc-check.mjs` — compile `src/App.vue` (template, script, styles) with `@vue/compiler-sfc`, so a syntax error is caught without starting Vite;
> - `icon-check.mjs` — every icon name used in the template exists in `src/components/icons.js`;
> - `class-check.mjs` — every static class in the template has a rule in `src/style.css`;
> - `lang-check.mjs` — no pictographic emoji in the repository, no Spanish words in visible UI text, one single site count (25) in the documentation.
> Add `"check": "node tests/verify.mjs && node tests/sfc-check.mjs src/App.vue && node tests/icon-check.mjs && node tests/class-check.mjs && node tests/lang-check.mjs && node tests/doc-check.mjs"` to `package.json`.

Acceptance: `docs/CONTRACTS.md` lists every engine export; `npm run check` passes on the untouched repository.

### P1 — Shell, design system, icon set

> Replace the placeholder canvas with the application shell: top bar, two tabs, main workspace, status bar. Write `src/style.css` with the tokens in Part 3.1 and the component classes in Part 3.2. Create `src/components/icons.js` (a single 16 px, stroke 1.5 icon family, paths only) and `src/components/Icon.vue` (`<Icon name="..." :size="16" />`). No emoji, no icon fonts, no external icon package. The status bar shows DEM state, data source, ephemeris source and a right-aligned page title.

Acceptance: shell renders with empty panels, `icon-check` and `class-check` pass, and the page contains no text in Spanish.

### P2 — Planning inputs and the audit run

> Build the left rail: surface conditions (date, evaluation hour, surface stay), lander model (vehicle preset, slope limit, mast height, solar area, base load, footprint radius), landing dispersion (robust ranking switch, semi-major, semi-minor, approach azimuth), and the run button. Wire the Web Worker: `AUDIT` for the slope/footprint/illumination/NMS pass, `ILLUMINATION` for the 30-day map. Show progress as a percentage with a status line, and make the button state reflect the run.

Acceptance: run completes on the real DEM in a few seconds, progress advances, no UI freeze.

### P3 — Ranking pipeline and candidate matrix

> Implement the ranking pipeline in Part 3.4.1 and render the matrix: rank, site, latitude, longitude, elevation, worst slope, survival, Sun, Earth, score. Mark the column that drives the ordering with an accent underline. Colour the numbers semantically (green nominal, amber caution, red hazard) and keep the text readable without colour. Selection is a row click and drives the right-hand panels.

Acceptance: 5 candidates, deterministic for identical inputs, ranking changes visibly when the robust switch flips.

### P4 — Site detail panels

> Build the right column: suitability, power and link, horizon profile, terrain and navigation, approach corridor. The horizon panel is a polar plot of the 360-sample profile with the Sun and Earth overlaid, plus the four summary numbers in Part 3.4.3.

Acceptance: every number traces to an engine call; the polar plot matches the visibility rule.

### P5 — Timeline and clock

> Build the surface timeline: one cell per day for the surface stay, Sun and direct-to-Earth bands, a play/pause control and 1x, 60x, 3600x. Put the clock arithmetic in `src/core/clock.js` as pure functions and add a section to `tests/verify.mjs` that proves 1x = 1 s per second, 60x = 1 minute per second, 3600x = 1 hour per second, plus the hour and day rollover. The animation loop must start on mount, not on tab change.

Acceptance: the clock advances at every speed while the Planning tab is visible; the tests fail if the loop is gated on the 3D tab.

### P6 — Comparator and export

> Add the site comparator: tick two to five rows in the matrix, open a table with one column per site and the metrics in Part 3.4.4, highlight the winner per row, and end with a verdict naming the site the active ranking prefers. Export a mission brief as JSON with the active point, vehicle, ellipse, telemetry on screen, ranked candidates and the assumptions list.

Acceptance: three or more columns render, the winner highlight is correct, the JSON is deterministic.

### P7 — 3D view

> Full-bleed canvas with overlays: display layers, point probe, catalogue legend, selected site summary. Camera framed on the whole sheet (roughly 780 km distance, 0.5 rad pitch), orbit with damping, wheel zoom in metres, click to probe a cell. One site marker, one dispersion footprint, one approach path, labels only for the visible neighbourhood. The framework's `src/3d/layers.js` may only produce elevation, slope and illumination textures; add `generateReliefTexture` (a two-pass, percentile-stretched hillshade at about 315 deg azimuth and 30 deg elevation) and use it as the default surface, because a flat colour ramp reads as a mockup. Clamp the Sun lamp as described in Part 3.6.

Acceptance: the terrain reads as relief at first paint in under two seconds after the DEM is in memory, and the probe agrees with the marker positions within a cell.

### P8 — Software fallback

> Probe for a WebGL2 context on a throwaway canvas. If it is missing, boot a CPU renderer instead of failing: a column raycaster over the same DEM and the same layer textures, with orbit, zoom, markers, ellipse, approach path and probe. The choice is automatic and must never throw, never show a black canvas.

Acceptance: with WebGL2 disabled the 3D tab still renders the terrain; the status bar says which renderer is active.

### P9 — Documentation and QA

> Bring the documentation to the same standard: architecture and file map, platform features with the real-versus-modelled table, renderer notes including the software fallback, README with run instructions. No emoji, English, one site count. Then run the full gate and the demo script.

Acceptance: `npm run check` green, `npm run build` green, demo script runs without touching the code.

---

## Part 3 — Reference

### 3.1 Design tokens

Dark technical console. Neutral greys carry the structure; colour carries meaning only.

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#101215` | page background |
| `--bg-sunken` | `#0b0d0f` | wells, canvas backdrop |
| `--panel` | `#171a1e` | panel surface |
| `--panel-head` | `#1b1f24` | panel header strip |
| `--line` | `#262b31` | hairline between rows |
| `--line-strong` | `#333a42` | section divider, input border |
| `--text` | `#d6dbe1` | primary text |
| `--text-dim` | `#8b949e` | labels, secondary |
| `--text-faint` | `#5f6871` | units, hints |
| `--accent` | `#4a90d9` | selection, active tab, links |
| `--ok` | `#4f9d69` | nominal |
| `--warn` | `#c9a227` | caution |
| `--bad` | `#c0524a` | hazard |
| `--sun` | `#d9a441` | Sun marks, lit days |
| `--earth` | `#4a90d9` | Earth marks, DTE days |

Type: system UI stack for prose, `ui-monospace, "SF Mono", "Cascadia Mono", monospace` for every number, identifier, coordinate and time. Base 12.5 px, labels 10.5 px uppercase with 0.08 em tracking, panel titles 13 px, one hero readout per panel at 26–30 px, tabular numerals everywhere (`font-variant-numeric: tabular-nums`).

Spacing: 4 px grid; panel padding 12 px; row height 26 px; hairline `1px solid var(--line)` between dense rows, never a card per row.

Layout rule: each panel has exactly one large readout, then dense label/value rows. Titles in sentence case; uppercase only for very short field labels. No glyphs inside text; meaning is carried by colour plus a small icon from the same 16 px set.

### 3.2 Shell and component inventory

```
+----------------------------------------------------------------------------------+
| L-SEA  Lunar Site Evaluation | Planning | 3D view |        Select site  Export  |
+---------------+------------------------------------------+-----------------------+
| INPUTS        | CANDIDATE MATRIX                         | DETAIL                |
| surface       | rank site lat lon elev slope surv sun    | suitability           |
| lander        | ...                                      | power and link        |
| dispersion    | [run]                                    | horizon profile       |
|               +------------------------------------------+ terrain and navigation|
|               | SURFACE TIMELINE  (7-14 day grid)        | approach corridor     |
+---------------+------------------------------------------+-----------------------+
| DEM ready | LOLA 80S | Ephemerides: Meeus vs DE421 |            clock | meta    |
+----------------------------------------------------------------------------------+
```

Components, all in `src/App.vue` except the icon:

| Component | Content |
| --- | --- |
| Top bar | brand, two tabs, action buttons (select site, export brief), readiness dot |
| Panel | header strip with icon, title, optional aside control; body; optional foot |
| Field | label above a control; inputs are monospace, selects full width |
| Matrix | sticky header, 10 columns, row selection, checkbox column for the comparator, accent underline on the ordering column |
| Score cell | number plus class; semantic colour and text label, never colour alone |
| Timeline | one cell per day, two bands (Sun, DTE), legend, clock and speed controls |
| Polar radar | 360 degree plot, cardinal marks, skyline polygon, Sun and Earth dots, four summary numbers |
| Comparator | modal or docked table, 2 to 5 columns, winner per row, verdict line |
| Viewer overlays | display list, probe readout, catalogue legend, selected site summary |
| Status bar | DEM state, data source, ephemeris source, renderer state, clock, build line |

### 3.3 Engine contracts

The engine is already in the repository; read the module headers for the exact return shapes and record them in `docs/CONTRACTS.md`. The symbols below exist and are what the interface needs.

| Need | Symbol | Module |
| --- | --- | --- |
| Cell to latitude/longitude | `pixelToGeo` | `src/core/geo.js` |
| Latitude/longitude to cell | `geoToPixel` | `src/core/geo.js` |
| Curvature drop over a distance | `caidaCurvatura` | `src/core/geo.js` |
| Bearing to row/column step | `pasoAzimut` | `src/core/geo.js` |
| Sun, Earth, Moon positions | `calcularEfemeridesMeeus`, `lunaDesdeEstacion` | `src/core/astro.js` |
| Slope grid, local gradient | `calculateSlopeDegrees`, `gradienteLocal` | `src/core/engine.js` |
| 360 sample horizon | `calculateHorizonProfile` | `src/core/engine.js` |
| Visibility rule | `isTargetVisible` | `src/core/engine.js` |
| Slope classification | `clasificarPendiente` | `src/core/engine.js` |
| 30 day illumination map | `iluminacionMensual` | `src/core/illumination.js` |
| Daily Sun and DTE visibility | `visibilidadDiaria` | `src/core/windows.js` |
| Array output, DSN stations | `calcular_potencia_electrica`, `telemetria_dsn`, `estacionActivaDSN` | `src/core/power.js` |
| Temperature, corridor, TRN, libration | `calculateRadiativeEquilibrium`, `evaluateGlideslopeCorridor`, `evaluateTrnFeasibility`, `evaluateLibrationRisk` | `src/core/nasa_suite.js` |
| Slope, footprint, illumination, NMS | worker task `AUDIT` | `src/core/autopilot.worker.js` |

Conventions that must not drift: distances in metres inside the engine and kilometres only at the display layer, angles in degrees at the boundary, times as UTC ISO strings, the DEM row direction fixed by `ROW_DIR`, and the mast offset (+2 m, or the lander mast) applied by whoever calls the horizon function.

### 3.4 Algorithms that live above the engine

These are the parts the framework does not ship. They belong in the application layer, in three small pure modules plus `src/App.vue`: `src/core/pois.js` (the 25-site catalogue and its type list), `src/core/dispersion.js` (ellipse, contact sampling, survival score, contour), and `src/core/clock.js` (the mission clock arithmetic). Each needs a section in `tests/verify.mjs`.

**3.4.1 Ranking pipeline**

1. Worker `AUDIT` walks the DEM on an 8% border margin, rejects any cell whose footprint contains a slope above the limit, and scores the rest: `S = ((limit − worst) / limit)^2`, `L` = illumination fraction at the coarse cell, `score = 100 × (0.6·S + 0.4·L)`.
2. Non-maximum suppression with a 40-cell radius keeps 15 candidates.
3. The main thread re-scores those 15 with exact gradients, the 30-day visibility window, thermal equilibrium, TRN, libration margin, the glideslope corridor and the dispersion ellipse. `pointScore = 100 × (0.6·S + 0.4·sunFraction)`.
4. Rank by `pointScore`, tie-break on site identifier so the order is stable. Keep the top 5.
5. If robust ranking is on, re-order by `survivalScore` and mark the survival column as the one driving the order.

**3.4.2 Landing dispersion**

The vehicle does not land on a point, it lands somewhere inside an ellipse: default 240 m x 120 m, major axis along the approach azimuth (270°). Sample the ellipse at 37 points (centre, six-point contour at 50%, a ring at 75%, a ring at 100% — any deterministic pattern of 30 to 40 points works, but the count must be fixed and reported).

For each contact: `safety_i = ((limit − worstSlope_i) / limit)^2` clamped at zero, `sun_i` the Sun fraction at that cell, `score_i = 100 × (0.6·safety_i + 0.4·sun_i)`. Then `survival = mean(score_i)`, `coverage` = share of contacts whose worn slope is under the limit, and the ring drawn on the map is the 100% contour.

The point that matters: a narrow summit can score 90 at the centre and 16 for the vehicle. The matrix must make that visible.

**3.4.3 Horizon summary**

From the 360-sample profile: skyline peak and its bearing, mean skyline, bearings above 1° (how much of the circle is closed), and Sun clearance = Sun elevation minus the profile at the Sun bearing. The plot maps bearing to angle (north up, east right) and elevation to radius, 0° at the rim and 30° at the centre, so a Sun dot outside the polygon is visible.

**3.4.4 Comparator metrics**

Point score, survival, ellipse coverage, footprint worst slope, approach margin, Sun 30 days, Earth line of sight 30 days, equilibrium temperature, TRN score, elevation. Each row declares whether higher or lower wins, and the verdict line names the site the active ranking prefers.

**3.4.5 Clock**

`advanceClock(hour, second, elapsed, speed)` returns `{ hour, second, dayShift }`. Seconds accumulate as `second + elapsed × speed`, roll into hours, hours roll into days. Recompute the ephemeris once per hour boundary, never per frame, and push the reactive value at 10 Hz at most.

### 3.5 Numbers and copy

- One unit per column, in the header; no unit repeated in every cell.
- Fixed decimals: coordinates 2, slope and temperature 1, percentages 0, distances 0 below 10 km, margins 0.
- Tabular numerals; align right.
- Sentences in the interface are instructions or facts, never marketing. "Set the surface conditions and the lander model, then run the evaluation to rank the landing sites."
- Empty states say what to do next, and name the missing input.
- Assumptions are labelled as assumptions in the interface, not buried in the README.

### 3.6 Traps

Each of these cost real time in the first build. Read them before P7.

| Symptom | Cause | Fix |
| --- | --- | --- |
| Terrain looks like a white sheet | Sun elevation near the horizon (1–3°) blows out a Lambert surface | Clamp the lamp to about 14°, add a small fill light, and bake the hillshade into the texture |
| Frame time collapses after boot | Shadow map re-rendered every frame from a moving light | `shadowMap.autoUpdate = false` after the first render, 2048 map, tight ortho box |
| Surface reads as flat grey | Material colour with a uniform texture, no spatial detail | Bake shaded relief (two-pass, percentile stretched) into the base map |
| Labels shrink or balloon with zoom | Sprites with `sizeAttenuation` and world sizes | Fixed pixel size, `sizeAttenuation: false`, scale by screen height |
| Overlay panels cover the canvas | Renderer sized from `window` instead of its container | Size from the container, re-render on resize and on tab activation |
| Camera clipped into the mesh or grazing the plane | Minimum distance far below the sheet size | Frame at roughly the sheet diameter, pitch 0.5 rad, minimum distance a few km |
| Black canvas with no error | `getContext('webgl2')` returns null (shielded browsers) | Probe on a throwaway canvas, fall back to the CPU renderer, say so in the status bar |
| Build fails inside a sandbox with `spawn EPERM` | Bundler and native bindings need child processes | Run the build outside the sandbox, or gate on the compile check |
| Clock never moves on Planning | Animation loop started by the 3D boot, hour-only updates | Start the loop on mount, keep a live second counter, throttle the DOM write |
| Comparator refuses a third site | Hard-coded limit of two | One limit constant, one metric table, support 2 to 5 |
| Ranking order changes between runs | Unstable sort on equal scores | Explicit tie-break on identifier |
| Ellipse orientation disagrees between map and score | Degrees clockwise from north in one place, from east in another | One convention in the dispersion module, documented |
| Coarse cell index out of range at the map edge | `floor(cell / paso)` unclamped | Clamp to `nc - 1`, `nr - 1` |

### 3.7 Acceptance gate

```bash
npm run check          # verify + sfc + icons + classes + language + docs
npm run build          # production bundle
node tests/perf.mjs    # heavy passes against the recorded baseline
```

`npm run check` prints `TODO OK` per script and exits non-zero on any failure. The bundle should stay under about 750 kB raw / 200 kB gzip; three.js is most of it.

### 3.8 Base CSS skeleton

A starting point for `src/style.css`, enough that the shell already feels like the target. The agent extends it; it does not need to reference Tailwind.

```css
:root {
  --bg: #101215; --bg-sunken: #0b0d0f; --panel: #171a1e; --panel-head: #1b1f24;
  --line: #262b31; --line-strong: #333a42;
  --text: #d6dbe1; --text-dim: #8b949e; --text-faint: #5f6871;
  --accent: #4a90d9; --ok: #4f9d69; --warn: #c9a227; --bad: #c0524a;
  --sun: #d9a441; --earth: #4a90d9;
  --mono: ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", monospace;
  --ui: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 12.5px/1.45 var(--ui); -webkit-font-smoothing: antialiased;
}

.app { display: grid; grid-template-rows: 40px 1fr 24px; height: 100vh; }

.topbar {
  display: flex; align-items: center; gap: 16px;
  border-bottom: 1px solid var(--line-strong); background: var(--panel-head);
  padding: 0 12px;
}
.brand { display: flex; align-items: baseline; gap: 8px; }
.brand-name { font-weight: 600; letter-spacing: 0.04em; }
.brand-sub { color: var(--text-faint); font-size: 11px; }

.tab {
  display: inline-flex; align-items: center; gap: 6px;
  height: 40px; padding: 0 12px; border: 0; border-bottom: 2px solid transparent;
  background: none; color: var(--text-dim); font: inherit; cursor: pointer;
}
.tab.is-on { color: var(--text); border-bottom-color: var(--accent); }

.panel { background: var(--panel); border: 1px solid var(--line); display: flex; flex-direction: column; }
.panel__head {
  display: flex; align-items: center; gap: 8px; height: 28px; padding: 0 10px;
  border-bottom: 1px solid var(--line); background: var(--panel-head);
}
.panel__title { font-size: 12px; letter-spacing: 0.01em; }
.panel__aside { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.panel__body { padding: 10px; display: grid; gap: 8px; overflow: auto; }

.field { display: grid; gap: 4px; }
.field label { color: var(--text-dim); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; }
.field input, .field select {
  height: 26px; padding: 0 6px; border: 1px solid var(--line-strong);
  background: var(--bg-sunken); color: var(--text); font: 12px var(--mono);
}

.kv { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; border-bottom: 1px solid var(--line); }
.kv:last-child { border-bottom: 0; }
.kv__k { color: var(--text-dim); }
.kv__v { font: 12px var(--mono); font-variant-numeric: tabular-nums; }

table.matrix { width: 100%; border-collapse: collapse; font: 12px var(--mono); font-variant-numeric: tabular-nums; }
table.matrix th {
  position: sticky; top: 0; z-index: 1; text-align: right; font: 10.5px var(--ui);
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-dim);
  background: var(--panel-head); border-bottom: 1px solid var(--line-strong); padding: 6px;
}
table.matrix td { text-align: right; padding: 5px 6px; border-bottom: 1px solid var(--line); }
table.matrix tr.is-active td { background: color-mix(in srgb, var(--accent) 14%, transparent); }
table.matrix th.is-key { box-shadow: inset 0 -2px 0 var(--accent); }

.val-ok { color: var(--ok); } .val-warn { color: var(--warn); } .val-bad { color: var(--bad); }

.statusbar {
  display: flex; align-items: center; gap: 18px; padding: 0 12px;
  border-top: 1px solid var(--line-strong); background: var(--panel-head);
  color: var(--text-faint); font-size: 11px;
}
```

### 3.9 Constants used by this build

Keep them in one place; a rebuild that drifts from these produces numbers that no longer match the documentation.

| Constant | Value | Where |
| --- | --- | --- |
| DEM grid | 4000 x 4000 cells, 160 m per cell | `public/data/lola_shackleton.bin` |
| Audit border margin | 8 % of the grid | worker |
| Non-maximum suppression radius | 40 cells | worker |
| Candidate pool | 15, refined to top 5 | worker, application |
| Footprint safety | `((limit - worst) / limit)^2` | worker and refine |
| Ranking weights | 0.6 safety, 0.4 Sun | ranking pipeline |
| Observer mast | +2 m, or the lander mast | horizon, illumination |
| Solar angular radius | 0.267 deg | `src/core/astro.js` |
| Solar constant | 1361 W/m2 at 1 AU | `src/core/astro.js` |
| Approach azimuth | 270 deg | `src/core/nasa_suite.js` |
| Glideslope | 12 deg | `src/core/nasa_suite.js` |
| Landing ellipse | 240 m x 120 m, major axis on the approach azimuth | dispersion module |
| Dispersion samples | 37 contacts | dispersion module |
| Libration threshold | 2.5 deg | `src/core/nasa_suite.js` |
| Site catalogue | 25 sites | `src/core/pois.js` |
| Clock speeds | 1x, 60x, 3600x | `src/core/clock.js` |

---

## Part 4 — Demo script and definition of done

Two minutes, no code edits:

1. Open on Planning. Point at the status bar: real LOLA surface, real ephemerides checked against JPL, 25 sites.
2. Run the evaluation. The matrix fills; say the score is 60% footprint safety and 40% measured Sun.
3. Select the top site; the horizon plot shows why it is lit and whether Earth is in view; the power panel shows watts and the station in contact.
4. Toggle robust ranking. The order changes; explain the ellipse: same point, different survival.
5. Tick three sites, open the comparator, read the verdict.
6. Play the clock at 3600x; the timeline advances an hour per second.
7. Switch to 3D. Orbit, probe a cell, point at the ellipse and the approach corridor.
8. Export the brief; open the JSON.

Definition of done: the gate in 3.7 passes, the demo runs without edits, no emoji anywhere, no Spanish in the interface, one single site count, and every number on screen traces to the engine or to a labelled assumption.
