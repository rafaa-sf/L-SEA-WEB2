# L-SEA · Lunar Site Evaluation Algorithm

**🇬🇧 [English](#-english) · 🇪🇸 [Español](#-español)**

NASA Space Apps Challenge 2026 (Málaga) · Challenge: *CLPS Lunar Mission Browser* · Team L-SEA (formerly Lunar Horizon) · [MIT](LICENSE)

> Prototype built for a hackathon. Every model below states its assumptions. It is **not** NASA software and not flight-qualified.

---

# 🇬🇧 English

## What it does

Given a real LRO/LOLA elevation map of the lunar south pole (320 km × 320 km, 160 m/cell), L-SEA tells you, for any point and date: how steep the terrain is, whether the Sun and the Earth are above the **terrain horizon** at that point, how much power a lander could make, and which candidate sites are the safest and best lit. It then ranks the Top 5.

| Feature | How it is computed | Status |
|---|---|---|
| Slope | arctan of the central-difference gradient, real scale | ✅ validated on analytic ramp |
| 360° horizon | Ray tracing from the lander (mast per vehicle) **with lunar curvature** (d²/2R) | ✅ matches a reference implementation (358/360 azimuths within 0.3°) |
| Sun & Earth position | Truncated Meeus series + IAU lunar rotation, **evaluated at the active point** (its own lat/lon/heading) | ✅ vs Skyfield/JPL DE421: Sun ≤ 0.003°, Earth elevation ≤ 0.06°, azimuth ≤ 0.24° |
| Visibility | One rule everywhere: elevation (+0.267° for the Sun's limb) > terrain horizon at that azimuth | ✅ |
| Deep Space Network | Real topocentric Moon elevation over Madrid, Goldstone and Canberra (WGS84, parallax) | ✅ vs Skyfield: ≤ 0.07°. Link mask 10° is an assumption |
| 30-day Sun fraction map | Per-cell Sun position + shadow ray tracing, 1 sample/day, coarse 1.28 km grid | ✅ computed on demand in a Web Worker (~1 s) |
| Autopilot | Slope-footprint safety (anti-cliff) + 30-day Sun fraction → score = 60 % safety + 40 % Sun; non-maximum suppression; Top 5 re-scored per site with exact horizon/ephemerides | ✅ |
| Site comparator | Side-by-side table of two candidates | ✅ |
| Glideslope corridor | Straight 12° line, 1.5–20 km, fixed approach azimuth, with curvature | ⚠️ simplification (assumptions below) |
| Power (EPS) | `cos(elevation)` for a vertical Sun-facing panel (or `sin` for a horizontal one) | ⚠️ assumption: vertical panel |
| Temperature | Instantaneous radiative equilibrium on the local slope facing the Sun | ⚠️ estimate; no regolith conduction; **not** Diviner data |
| TRN, libration risk | Threshold rules | ⚠️ illustrative thresholds |
| Mission brief export | JSON including the assumptions list | ✅ |

## Assumptions and limits (read before quoting a number)

- One evaluation per day at the chosen UTC hour for timelines and the 30-day Sun fraction.
- Earth/Moon positions come from **truncated** Meeus series (about 0.05° in elevation), not JPL ephemerides.
- The 30-day Sun map is coarse (1.28 km cells; block-maximum obstacles, conservative toward shadow). It cannot resolve small shadows.
- In the 3D view the Sun is one parallel light with the elevation computed at the **active point**; far from it, curvature makes the real direction differ.
- Vehicle presets, the 10° DSN mask, TRN and libration thresholds and the approach azimuth are **illustrative assumptions**.
- Slope limits are configurable, not official mission values.
- The Sun is a disc (limb rule) but there is no penumbra, earthshine or terrain bounce.
- Not implemented (earlier drafts claimed it): rover traverse planning and distance to permanently shadowed regions.

## Architecture

```
src/core/geo.js            pixel <-> lat/lon (polar stereographic), map orientation, lunar curvature
src/core/astro.js          Sun, Earth, Moon-from-Earth, IAU lunar rotation
src/core/engine.js         slope, horizon, shadows, visibility rule, slope classification
src/core/illumination.js   30-day Sun fraction on a coarse grid
src/core/windows.js        daily Sun/Earth visibility per site, window search
src/core/power.js          EPS model and DSN Moon elevation
src/core/nasa_suite.js     radiative temperature, glideslope, TRN, line-of-sight margin
src/core/autopilot.worker.js  safety audit + illumination in a Web Worker
src/3d/                    Three.js scene, terrain mesh, GIS textures, DEM loader
tests/verify.mjs           node tests/verify.mjs  (no dependencies)
```

## Run

```bash
npm install
python descargar_lola.py      # builds public/data/lola_shackleton.bin from the NASA PDS LDEM_80S_80M product
npm run dev                   # http://localhost:5173
node tests/verify.mjs         # physics checks vs Skyfield/JPL reference values
```

**Map orientation check (30 s).** Open the Elevation layer: Malapert Mountain (86°S, 0.1°E) must be ABOVE the map centre. If it is below, set `ROW_DIR = +1` in `src/core/geo.js`.

## Credits

Topography: NASA LRO/LOLA (PGDA/PDS). Ephemeris reference for validation: JPL DE421 via Skyfield. Orientation: IAU lunar rotation model (Archinal et al.). Series: Meeus, *Astronomical Algorithms*. Interface: Vue 3, Three.js, Vite.

---

# 🇪🇸 Español

## Qué hace

Con un mapa real de elevación LRO/LOLA del polo sur lunar (320 km × 320 km, 160 m/celda), L-SEA dice para cualquier punto y fecha: cuánta pendiente hay, si el Sol y la Tierra están sobre el **horizonte del terreno**, cuánta potencia daría un módulo y qué sitios candidatos son más seguros y están mejor iluminados. Después clasifica el Top 5.

La tabla de arriba resume cada función y cómo se calcula. Lo importante:

- **Validado:** posición del Sol (≤ 0,003°), de la Tierra (≤ 0,06°) y de la Luna sobre los complejos DSN (≤ 0,07°) contra Skyfield/JPL DE421; horizonte contra una implementación de referencia; casos analíticos (rampa, muro).
- **Con curvatura lunar:** horizonte, sombras y corredor de descenso descuentan d²/2R (2,9 km a 100 km).
- **Efemérides en el punto activo:** cada punto del mapa usa su propia latitud, longitud y rumbo.
- **DSN real:** elevación de la Luna sobre Madrid, Goldstone y Canberra, calculada.
- **Mapa de iluminación a 30 días:** cálculo real con sombras (rejilla gruesa de 1,28 km).

## Supuestos y límites

- Una evaluación al día a la hora UTC elegida.
- Series de Meeus **truncadas** (≈ 0,05° en elevación), no efemérides JPL.
- Mapa de iluminación grueso (1,28 km): no resuelve sombras pequeñas.
- En 3D el Sol es una luz paralela con la elevación del punto activo.
- Presets de vehículo, máscara DSN de 10°, umbrales TRN/libración y azimut de aproximación: **supuestos ilustrativos**.
- Panel solar vertical orientado al Sol (supuesto); la temperatura es un equilibrio radiativo instantáneo, sin conducción, y **no** son datos de Diviner.
- No implementado: ruta del rover y distancia a regiones en sombra permanente.

## Ejecutar

```bash
npm install
python descargar_lola.py
npm run dev
node tests/verify.mjs
```

**Comprobación de orientación (30 s):** en la capa Elevation, Malapert (86°S, 0,1°E) debe estar ARRIBA del centro. Si está abajo, pon `ROW_DIR = +1` en `src/core/geo.js`.

## Licencia

[MIT](LICENSE).
