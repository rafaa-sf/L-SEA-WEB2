You are building the interface of L-SEA, a lunar south-pole landing site evaluator, on top of a finished physics framework. Read `docs/HACKATHON_GUIDE.md` in this repository before you start: it is the specification for everything below (design tokens, component inventory, engine contracts, algorithms, traps). Follow it literally where it is concrete, and ask before deviating where it is not.

## What exists already

`src/core/` is a complete, dependency-free engine: geometry, ephemerides (Meeus, validated against JPL DE421), slope and 360 degree horizon, shadows, monthly illumination, daily Sun/Earth visibility, array power and DSN geometry, thermal equilibrium, approach corridor, TRN feasibility, libration margin, and a Web Worker that audits the DEM. `src/3d/` boots a three.js scene, loads the binary DEM (4000 x 4000 cells, 160 m per cell, 640 km square) and builds the terrain mesh and layer textures. `src/App.vue` is a placeholder with a blue canvas and no interface.

Your job is the presentation layer: shell, panels, ranking pipeline, 3D view, documentation. Do not rewrite engine code; if an engine function is wrong, say so and propose a patch instead of editing it silently.

## Non-negotiables

- Vue 3 `<script setup>`, Vite, three.js. No new dependencies, no component library, no icon package, no CSS framework utilities: the shell is hand-written CSS in `src/style.css`.
- English everywhere, including comments in new files. No Spanish in visible text.
- No emoji anywhere: code, interface, markdown. Status is carried by colour plus a small icon and a text label.
- 25 landing sites, one single count across the whole project.
- Every number displayed must come from the engine or from a labelled assumption. Never invent data, never hard-code a plausible-looking value.
- Deterministic: same inputs produce the same ranking and the same exported JSON.
- The application must work without WebGL2, automatically, with no manual switch in the interface.

## Visual direction

A professional orbital-analysis console, in the family of AGI/STK and Ansys, not a dashboard template. Concretely:

- Dark neutral greys for structure, colour only where it means something: green nominal, amber caution, red hazard, amber Sun marks, steel blue Earth marks and selection.
- One large readout per panel, then dense label/value rows separated by hairlines. No cards inside cards, no rounded pills for ordinary data, no gradients, no drop shadows.
- Titles and messages in sentence case. Uppercase only for very short field labels, with letter spacing.
- Monospace with tabular numerals for every number, identifier, coordinate and time. Everything right-aligned in tables, one unit per column in the header.
- Icons come from one 16 px, stroke 1.5 family defined as plain SVG paths in `src/components/icons.js`, rendered by `src/components/Icon.vue`. Never an icon inside a sentence as decoration; only where it labels a control or a state.
- Two tabs: Planning (inputs, candidate matrix, site detail, surface timeline) and 3D view (full-bleed terrain with overlays). A status bar running the width of the window carries data provenance and the clock.

## Growth path

Work in phases, in this order. After each phase run `npm run check`, summarise the files you touched and what is still missing, and stop for review:

0. Recon: write `docs/CONTRACTS.md` (every engine export with arguments, return shape and units) and the quality gates `tests/sfc-check.mjs`, `tests/icon-check.mjs`, `tests/class-check.mjs`, `tests/lang-check.mjs`, plus the `check` script in `package.json`.
1. Shell and design system: tokens, base CSS, icon set, top bar, tabs, status bar.
2. Planning inputs and the worker audit, with real progress.
3. Ranking pipeline and the candidate matrix.
4. Site detail panels, including the horizon polar plot with its four summary numbers.
5. Surface timeline and the mission clock as a pure, tested module.
6. Comparator for two to five sites, and the mission brief export.
7. 3D view: framing, orbit, probe, layers, marker, dispersion ellipse, approach path, labels.
8. Software fallback renderer for browsers without WebGL2.
9. Documentation and QA: architecture, platform features with a real-versus-modelled table, renderer notes, README.

## Quality gate

```bash
npm run check      # numerical suite, SFC compile, icon names, class coverage, language, doc references
npm run build      # production bundle
```

Both must pass. The compile check exists because the bundler may be unavailable in the working environment; use it after every edit of a Vue file.

## Definition of done

The gate passes, the 3D tab renders terrain in any browser, the demo script at the end of the guide runs without touching code, and nothing on screen is a number the engine did not produce.

Start with phase 0 and stop when it passes.
