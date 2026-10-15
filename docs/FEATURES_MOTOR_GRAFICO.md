# Motor gráfico y visualización 3D (L-SEA)

Es la capa que dibuja el polo sur lunar en pantalla: convierte el mapa de elevación LRO/LOLA (640 km × 640 km, 160 m por celda, 4000×4000 celdas) en una superficie 3D navegable.
Todo el relieve que se ve sale del DEM real cargado en `public/data/lola_shackleton.bin`; el visor no inventa terreno.
Las funciones físicas (efemérides, horizonte, TRN, potencia) están en `docs/FEATURES_PLATAFORMA.md`.

## Malla de terreno 3D con LOD por decimación

- Qué hace: construye la superficie navegable del cráter con sombras activadas, partiendo del DEM completo.
- Cómo se calcula: `createTerrainMesh(demData, rows, cols, mpc, zScale = 1.0, decimate = 1)` en `src/3d/terrain.js:9` genera un `THREE.PlaneGeometry` con paso `stride * mpc` y un vértice por celda muestreada; con `TERRAIN_LOD_DECIMATE = 4` (`src/App.vue:864`) sobre el DEM de 4000×4000 la malla de render queda en 1000×1000 vértices (≈2,0 M triángulos frente a los ≈32 M de la malla completa).
- Por qué importa: mueve una escena densa en un portátil de hackathon con un único parámetro, y el DEM original se conserva intacto para la física (`src/3d/terrain.js:6-8`). El render además limita el `pixelRatio` a 2 (`src/3d/scene.js:19`).

## Proyección polar y alineación con la rejilla del DEM

- Qué hace: garantiza que cada vértice dibujado caiga en su celda real, no "cerca".
- Cómo se calcula: `src/3d/terrain.js:18-24` dimensiona el plano con `(vértices − 1) * paso` y lo desplaza con `geometry.translate((width − cols * mpc) / 2, 0, (height − rows * mpc) / 2)`; la conversión píxel ↔ lat/lon es estereográfica polar (`pixelToGeo` / `geoToPixel` en `src/core/geo.js:20,32`, con `R_LUNA = 1737400.0` y metros por celda constantes).
- Por qué importa: sin esa alineación el sondeo de superficie apuntaría a otra celda. `tests/verify.mjs` §10 lo comprueba (0 de 76 924 vértices fuera de su celda) y §9 acota el error de escala estereográfica por debajo del 1 % hasta lat −84,72°.

## Navegación de cámara y vuelo al sitio

- Qué hace: el usuario gira, acerca y recorre el cráter con el ratón, o salta directo a un punto concreto.
- Cómo se calcula: `initScene(canvasElement)` en `src/3d/scene.js:7` monta una `PerspectiveCamera` (fov 45, near 100, far 1 000 000) y `OrbitControls` con amortiguación (`dampingFactor = 0.05`, `maxPolarAngle = π/2 − 0.05`, distancia entre 1 000 y 350 000 m); `navegarAPOI` (`src/App.vue:1398`) e `inspeccionarSitio` (`src/App.vue:1350`) recolocan `controls.target` y la cámara, y este último dibuja la trayectoria de descenso como línea discontinua con anillos de distancia.
- Por qué importa: es la forma en que un evaluador pasa de una tabla de números a "ver" el sitio en segundos.

## Click-to-probe por raycast sobre la malla real

- Qué hace: un clic en la superficie abre una ficha con elevación, pendiente, clasificación de seguridad y temperatura estimada de esa celda.
- Cómo se calcula: `onCanvasClick` (`src/App.vue:1093`) descarta arrastres (más de 5 px desde `pointerDown`) y lanza `raycaster.setFromCamera(...)` + `intersectObject(terrenoMeshRef)` **contra la malla con relieve**, no contra un plano `y = 0` (comentario en `src/App.vue:1105-1106`); el impacto se traduce a celda con `col = ((p.x + terrainCenter.x) / MPC) + COLS / 2`, se lee la altura del DEM, se calcula la pendiente con `gradienteLocal` y se clasifica con `clasificarPendiente`.
- Por qué importa: convierte la malla en herramienta de inspección, porque el punto elegido pasa a ser el punto activo de toda la telemetría. `tests/verify.mjs` §10 valida el raycast cenital (desfase < 12 m por interpolación de la malla decimada).

## Capas científicas GIS como texturas de terreno

- Qué hace: cuatro vistas conmutables del mismo relieve, cada una con su escala de color.
- Cómo se calcula: `cambiarCapaGIS` (`src/App.vue:1144`) intercambia `material.map` entre PBR (regolito gris, sin textura), elevación hipsométrica (−4000 m a +4000 m) con `generateElevationTexture`, riesgo de pendiente con `generateSlopeTexture(slopes, rows, cols, maxSlope)` (verde ≤ 5°, ámbar hasta el límite del vehículo, rojo por encima) y fracción solar del mes con `generateIlluminationTexture(frac, nr, nc)`; las tres están en `src/3d/layers.js:7,46,85` y se construyen como `THREE.DataTexture` de 1024×1024.
- Por qué importa: es la lectura "de mapa científico" del mismo dato que el 3D (pendiente, altura y luz en un vistazo), sin salir del visor.

## Puntos de interés con etiquetas 3D, buscador y filtro

- Qué hace: sitios etiquetados sobre el terreno — cráteres PSR, montes, objetivos CLPS/Artemis y referencias — con búsqueda por texto y filtro por categoría.
- Cómo se calcula: el catálogo del menú está en `poisLegend` (`src/App.vue:755`, 21 sitios) y se filtra en `poisFiltrados` (`src/App.vue:790`); `crearEtiquetaPOI` (`src/App.vue:1464`) dibuja cada etiqueta como sprite de canvas sobre un mástil y `crearPuntosDeInteresRegionales` (`src/App.vue:1503`, 25 etiquetas) las coloca usando `geoToPixel`; al hacer clic, `navegarAPOI` lleva la cámara al sitio.
- Por qué importa: el jurado reconoce el terreno con nombres reales (Shackleton, Malapert, Connecting Ridge) en lugar de un mapa anónimo.

## Iluminación solar, sombras y tone mapping ACES

- Qué hace: coloca el Sol en 3D con la efeméride real del punto activo y proyecta sombras sobre el relieve, con exposición ajustable en vivo.
- Cómo se calcula: `src/3d/scene.js:37-55` añade una `AmbientLight(0x7085a5, 0.25)` (luz secundaria tipo earthshine, control "Luz Secundaria (Tierra)") y una `DirectionalLight(0xfff5e6, 3.5)` con `castShadow`, mapa de sombras 4096×4096, cámara ortográfica de ±170 000 m y `PCFShadowMap`; `actualizarLuzSolar3D` (`src/App.vue:1282`) sitúa esa luz a `RADIO_ORBITA_SOL = 250000` m según azimut y elevación, y `actualizarIluminacion` (`src/App.vue:1238`) aplica el control de exposición (0,5×–3,5×) a `renderer.toneMappingExposure` con `ACESFilmicToneMapping`.
- Por qué importa: en el polo sur el Sol casi roza el horizonte, así que ver sombras largas y suelo en penumbra es lo que hace creíble el cráter.

## Radar polar de horizonte 360°

- Qué hace: un disco 2D que muestra el horizonte del terreno en todas las direcciones y dónde están el Sol y la Tierra.
- Cómo se calcula: `dibujarRadarHorizonte` (`src/App.vue:1294`) pinta sobre `radarCanvas` (180×180) el perfil `horizonteActivo` con `r = rMax * (1 − min(30, elev) / 30)`, más un punto ámbar para el Sol y otro azul para la Tierra.
- Por qué importa: es la lectura instantánea de "¿qué me tapa el cielo?" y de la probabilidad de enlace, en un formato que se entiende sin explicación.

## Supuestos y límites

- **El Sol 3D es una única luz paralela** situada con la elevación y el azimut del **punto activo**; lejos de él la curvatura lunar hace que la dirección real difiera, y la malla no recalcula la luz por celda (`src/3d/scene.js:35-43`).
- **La decimación no cambia la física**: pendientes, horizonte y térmica se calculan sobre el DEM completo y solo el render usa la malla reducida; además, solo se muestra una capa GIS a la vez (cada textura se genera la primera vez que se pide y sustituye al material base, `src/App.vue:1144`).
- **Tamaño de malla**: con `decimate = 4` sobre el DEM de 4000×4000 salen 1000×1000 vértices (≈2,0 M triángulos). Las cifras "500×500 / 250k tris" que circulaban en versiones anteriores de `features.md` y del comentario de `src/App.vue:864` correspondían a un DEM de 2000×2000 y ya están corregidas; `src/3d/terrain.js:7` solo usa ese par como ejemplo del parámetro `decimate`.
- **No existe métrica de FPS ni de tiempo de fotograma en el repositorio**: lo verificable es el número de triángulos tras decimar, el `pixelRatio` limitado a 2 y el mapa de sombras de 4096². `tests/perf.mjs` mide el núcleo de cálculo, no el render.

Afirmaciones basadas en: `src/3d/terrain.js`, `src/3d/scene.js`, `src/3d/layers.js`, `src/3d/loader.js`, `src/App.vue`, `src/core/geo.js`, `tests/verify.mjs`, `public/data/lola_shackleton.bin` (cabecera leída: rows 4000, cols 4000, mpc 160), `README.md`, `features.md`, `docs/ARQUITECTURA.md`.
