# Renderer and Interface

The planner renders the terrain with Three.js and everything else with DOM and a single 2D canvas. This document covers the rendering path, the markers, the camera and the visual system.

## Scene

`initScene` (`src/3d/scene.js`) creates a `WebGLRenderer` with ACES tone mapping, a `PerspectiveCamera` of `fov 45`, `near 100`, `far 4e6`, and `OrbitControls` with damping 0.05, a minimum distance of 1500 m, a maximum of 1300 km and `maxPolarAngle π/2 − 0.05`. The camera opens at 456 km east, 396 km up and 720 km south of the pole, which frames the whole 640 km sheet. A `Fog` from 1400 km to 2600 km only touches the horizon.

Three lights drive the scene: an `AmbientLight(0x7085a5, 0.25)`, a `HemisphereLight(0x9fb4cc, 0x15181c, 0.55)` that keeps shadowed slopes readable, and a `DirectionalLight(0xfff5e6, 3.1)` with a 2048² shadow map, PCF soft shadows and an orthographic frustum of ±340 km. `shadowMap.autoUpdate` is off and the map is re-rendered only when the Sun moves, because pushing two million terrain triangles through a shadow pass every frame is what froze the view. Exposure is adjusted between 0.5 and 3.5 by the illumination slider.

The renderer sizes itself from its host element and follows a `ResizeObserver`, not `window.innerWidth`: the canvas lives inside a panel and has zero size while the Planning tab is up. `resize` is returned so `src/App.vue` can force a measurement after the view is shown, and the animation loop only renders while the 3D tab is active.

The Sun light sits at `SUN_ORBIT_RADIUS = 250000` along the active point's Sun vector. The real Sun never clears about 2° at the south pole, and lighting the relief from that angle erases every landform, so the lamp elevation is clamped to 14° for display only; the Sun and Earth columns and the illumination layer keep reporting the physical angle.

## Software fallback

Browsers that expose no WebGL2 context — Brave with strict shields blocks it even with hardware acceleration on — still get a 3D view. `bootScene` (`src/App.vue`) probes for a context, and on failure it builds a `createSoftwareView` (`src/3d/software.js`) over the same canvas and the same scientific layers. The Display panel reports which path is live with a `GPU` or `CPU` tag.

The fallback is a column raycaster. For every screen column it marches the camera ray from far to near in 900 geometric steps, projects each sample to a screen row and fills the vertical strip between consecutive samples, which is what produces the silhouette and the occlusion. Texture reads are bilinear because at grazing angles one column spans several texels and nearest-neighbour turns that into vertical streaks. Thematic layers borrow the relief channel as a hillshade. Distance is faded into the fog colour and the sheet is drawn as a floating plate with no invented data beyond its edge.

Interaction matches the GPU view where it matters: drag orbits, shift-drag or right-drag pans, the wheel zooms between 6 km and 1500 km, `Reset camera` returns to the opening framing, and clicking runs `pick`, which marches the same ray until a sample projects at or above the pointer and returns the DEM cell. Site marker, landing ellipse, approach path and catalogue dots are projected with the same camera matrix and drawn as 2D vectors on top of the frame. A 1280 × 720 frame costs 25 to 35 ms on a desktop CPU, so the view redraws on interaction rather than every animation frame.

## Terrain mesh

`createTerrainMesh` (`src/3d/terrain.js`) builds a plane from the DEM with `TERRAIN_LOD_DECIMATE = 4`, so a 4000 × 4000 grid becomes roughly 1000 × 1000 vertices and about two million triangles instead of thirty-two million. Vertices are placed in the polar projection of the map, with `ROW_DIR` deciding the north direction, and the mesh is centred on the terrain centre reported by the loader.

`loadBinaryDEM` (`src/3d/loader.js`) reads the 12-byte header, validates that the payload is exactly `rows × cols` float32 values, and raises an explicit error otherwise:

```
DEM size mismatch: header says ${rows}x${cols} (${expected} bytes), got ${dataLength} bytes
```

## Scientific layers

`setLayer` (`src/App.vue`) switches the surface texture built in `src/3d/layers.js` as 1024² `DataTexture` images:

| Layer | Builder | Reads |
|-------|---------|-------|
| Surface | `generateReliefTexture` | Baked hillshade of the DEM (lambert term stretched to full range, sun from 315°/30°, 3.5× vertical exaggeration), so the relief reads without relying on the grazing real Sun |
| Elevation | `generateElevationTexture` | Hypsometric ramp on the DEM |
| Slope | `generateSlopeTexture` | Gradient magnitude against the lander limit |
| Illumination | `generateIlluminationTexture` | 30-day Sun fraction from the illumination solve |

`setSurfaceTexture` swaps the map on the terrain material and resets the tint to white, so the texture is not darkened by the base colour. Layers are chosen in the **Display** overlay of the 3D view.

## Markers

| Marker | Built by | Description |
|--------|----------|-------------|
| Active site | `updateSiteMarker` (`src/App.vue`) | Beacon, ground disc and ring at the selected cell |
| Dispersion ellipse | `drawFootprintRing` (`src/App.vue`) | The landing ellipse sampled from `ellipseOutline` and laid on the DEM, rotated to the approach azimuth |
| Approach corridor | `buildApproachPath` (`src/App.vue`) | Dashed line at the 12° glideslope with rings at 5, 10, 15 and 20 km from the site |
| Probe | `createProbeBeacon` (`src/App.vue`) | Cone 25 × 1000 m, sphere of radius 90 m and a 120–200 m ring in the accent colour |
| Site labels | `createSiteLabel` (`src/App.vue`) | Canvas sprite with `sizeAttenuation` off, so the label keeps a fixed on-screen size at any zoom |

All labels come from the single catalogue in `src/core/pois.js` (25 sites), filtered by `filteredPois` in `src/App.vue`; there is one count in the interface and one count in the documentation.

## Camera

`navigateToPoi` and the matrix call the same framing path: the camera moves 5000 m above and 10000 m south of the site and `OrbitControls` damping carries the motion. `resetCamera` returns to the opening south-polar view.

## Picking

A pointer press and release on the canvas within 5 px counts as a click; anything longer is an orbit drag. The click is raycast against the terrain mesh, converted back to a cell with `(x + centre.x) / mpc + cols / 2`, and written into the probe readout. Because the rendered mesh is decimated, the reported slope can differ from the exact grid value by roughly one cell; the probe therefore also reports the DEM cell it snapped to.

## Horizon radar

`drawHorizonRadar` (`src/App.vue`) plots the 360° horizon profile as a closed curve with radius `r = rMax · (1 − min(30, elevation) / 30)`, then overlays the Sun (amber) and Earth (steel blue) at their azimuths. The canvas is drawn at device pixel ratio and redrawn when the active point or the Sun geometry changes.

## Visual system

`src/style.css` holds the whole visual language:

- **Tokens** — graphite surfaces (`#101215` app, `#171a1e` panel, `#1d2126` panel head, `#0b0d0f` sunken), hairlines `#2a2f37` and `#22262c`, text ramp `#ccd3dc` → `#8a94a1` → `#5f6875`, accent `#4f9ad1`, semantic `#56a97a` nominal, `#c9a04a` caution, `#c4645e` hazard.
- **Type** — `Segoe UI Variable Text` for labels and prose, `Cascadia Mono` for numbers, coordinates and units; 12 px base, sentence case everywhere except short field labels at 10.5 px with 0.06 em tracking.
- **Geometry** — radius 2 px, 1 px borders, a 236 / fluid / 306 three-column planner: controls on the left, candidate matrix and surface timeline in the centre, selected-site readout on the right. Rows are dense and separated by a hairline instead of being boxed.
- **Icons** — `src/components/icons.js` is the only icon set: 24 × 24 grid, stroke 1.6, round caps, no fills, no emoji anywhere in the interface or the documentation.

The layout is deliberately closer to an engineering console than to a dashboard: one large primary element, everything else in rows, and colour reserved for state rather than decoration.
