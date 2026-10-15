# L-SEA Event Log — NASA Space Apps 2026

Running log of the work done during the 48 h event. One row per verified unit of work.
Owned by the Captain (Rafael uses it for the README section "Credits and Prior Code").
Only rows marked **event** count as hackathon work; the seed row is prior code (MIT, upstream repo).

| Timestamp (local) | Type | Feature / change | File(s) | Commit | Notes |
|-------------------|------|------------------|---------|--------|-------|
| 2026-10-13 20:52 | prior | Repository seeded from `github.com/rafaa-sf/L-SEA_FRAMEWORK` (MIT) as the hackathon base | — | `dd7a3fb` | Baseline, not scored as event work |
| 2026-10-15 20:17 | event | Feature inventory audited against the source: corrected the ephemeris precision claims, replaced the two-line test list with the real 10 sections of `tests/verify.mjs`, and rewrote "Key Assumptions / Limits" as an evidence-cited table at the end of the file (12 declared limits + what is not implemented) | `features.md` | `9043bdf` | Docs only; no runtime behaviour changed. Verified with `node tests/verify.mjs` → TODO OK |
| 2026-10-15 20:29 | event | TRN score is no longer a fixed lookup on Sun elevation: relief is now measured on the DEM (mean central-difference slope of a 17×17-cell window, 8° reference) and multiplied by the declared Sun-shadow curve, so the score separates sites and not only hours; fractional click positions are rounded and an invalid DEM/position returns NO DATA | `src/core/nasa_suite.js`, `src/App.vue`, `tests/verify.mjs`, `features.md`, `README.md`, `docs/ARQUITECTURA.md` | `3f181ca` | `node tests/verify.mjs` → TODO OK (§11: flat 14% vs rough 94%). Real LOLA DEM at the same hour: Shackleton Crater 56% vs Connecting Ridge 46% vs Malapert NO-GO. Vite build blocked in this sandbox by the Tailwind oxide native binary (`spawn EPERM`); `src/App.vue` validated with `vue/compiler-sfc`. ESLint is not installed in the repo (no config, no dependency) |
