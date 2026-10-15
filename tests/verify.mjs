// Ejecutar:  node tests/verify.mjs      (sin dependencias)
// Comprueba el núcleo físico contra valores de referencia de Skyfield + JPL DE421
// (tests/fixtures.json) y contra casos analíticos.
import fs from 'node:fs';
import { calcularEfemeridesMeeus, lunaDesdeEstacion, RADIO_SOL } from '../src/core/astro.js';
import { pixelToGeo, geoToPixel, caidaCurvatura, ROW_DIR } from '../src/core/geo.js';
import { calculateHorizonProfile, calculateProjectedShadows, isTargetVisible, clasificarPendiente, calculateSlopeDegrees } from '../src/core/engine.js';
import { calcular_potencia_electrica, telemetria_dsn, estacionActivaDSN } from '../src/core/power.js';
import { calculateRadiativeEquilibrium, evaluateGlideslopeCorridor, evaluateTrnFeasibility } from '../src/core/nasa_suite.js';
import { iluminacionMensual } from '../src/core/illumination.js';
import { R_LUNA, DEG2RAD, RAD2DEG } from '../src/core/geo.js';

const fx = JSON.parse(fs.readFileSync(new URL('./fixtures.json', import.meta.url)));
let fallos = 0;
const ok = (cond, msg) => { console.log((cond ? '  OK   ' : '  FALLO ') + msg); if (!cond) fallos++; };
const dAz = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

console.log('1) Sol y Tierra vs Skyfield/DE421');
let eSolEl = 0, eTEl = 0, eSolAz = 0, eTAz = 0;
for (const r of fx.ef) {
    const e = calcularEfemeridesMeeus(new Date(r.iso), r.lat, r.lon, r.rumbo);
    eSolEl = Math.max(eSolEl, Math.abs(e.sol_el - r.sol_el)); eTEl = Math.max(eTEl, Math.abs(e.tierra_el - r.tierra_el));
    eSolAz = Math.max(eSolAz, dAz(e.sol_az, r.sol_az));       eTAz = Math.max(eTAz, dAz(e.tierra_az, r.tierra_az));
}
console.log(`     error máx: Sol el ${eSolEl.toFixed(3)}°, Tierra el ${eTEl.toFixed(3)}°, Sol az ${eSolAz.toFixed(3)}°, Tierra az ${eTAz.toFixed(3)}°`);
ok(eSolEl < 0.02 && eTEl < 0.1, 'elevaciones dentro de 0,1°');
ok(eSolAz < 0.05 && eTAz < 0.4, 'azimuts dentro de 0,4°');

console.log('2) Luna vista desde las estaciones DSN vs Skyfield (WGS84, sin refracción)');
let dEl = 0, dAzm = 0;
for (const r of fx.dsn) {
    const m = lunaDesdeEstacion(new Date(r.iso), r.lat, r.lon);
    dEl = Math.max(dEl, Math.abs(m.el - r.el)); dAzm = Math.max(dAzm, dAz(m.az, r.az));
}
console.log(`     error máx: elevación ${dEl.toFixed(3)}°, azimut ${dAzm.toFixed(3)}°`);
ok(dEl < 0.15, 'elevación de la Luna dentro de 0,15°');
const t = telemetria_dsn(new Date('2026-10-11T12:00:00Z'));
ok(['Madrid', 'Goldstone', 'Canberra'].every(k => typeof t[k].el === 'number'), 'telemetría DSN calculada (no escrita a mano)');
ok(estacionActivaDSN({ A: { enlace: false, el: 5 }, B: { enlace: true, el: 30 }, C: { enlace: true, el: 50 } }) === 'C', 'estación activa = la de mayor elevación sobre el mínimo');

console.log('3) Geometría del mapa');
const R = 2000, C = 2000, MPC = 160;
const g = pixelToGeo(R / 2 + ROW_DIR * 758, C / 2, R, C, MPC);
ok(Math.abs(g.lat + 86.0) < 0.05 && Math.abs(g.lon) < 0.5, `758 celdas "arriba" del centro = lat ${g.lat.toFixed(2)}°, lon ${g.lon.toFixed(1)}° (Malapert ≈ -86°, 0°)`);
const p = geoToPixel(-87.3, 77.0, R, C, MPC), g2 = pixelToGeo(p.fila, p.col, R, C, MPC);
ok(Math.abs(g2.lat + 87.3) < 1e-6 && Math.abs(g2.lon - 77.0) < 1e-6, 'ida y vuelta lat/lon <-> píxel');
ok(Math.abs(caidaCurvatura(100000) - 2878) < 5, `curvatura a 100 km = ${caidaCurvatura(100000).toFixed(0)} m`);

console.log('4) Horizonte y sombras (casos analíticos)');
const N = 301, M = 100, dem = new Float32Array(N * N);
const wallCol = 150 + 50;                       // muro 50 celdas (5 km) a la derecha (azimut 90°)
for (let r = 0; r < N; r++) for (let c = wallCol; c < wallCol + 3; c++) dem[r * N + c] = 250;
const h = calculateHorizonProfile(dem, N, N, M, 150, 150, 0.0, false);
const esperado = Math.atan(250 / (50 * M)) * 180 / Math.PI;
ok(Math.abs(h[90] - esperado) < 0.05, `muro de 250 m a 5 km: ${h[90].toFixed(2)}° (analítico ${esperado.toFixed(2)}°)`);
ok(h[270] === 0 && h[0] === 0, 'sin obstáculos en otros azimuts = 0°');
const hCurv = calculateHorizonProfile(dem, N, N, M, 150, 150, 0.0, true);
ok(hCurv[90] < h[90], `con curvatura lunar el muro se ve más bajo (${hCurv[90].toFixed(2)}° < ${h[90].toFixed(2)}°)`);
ok(isTargetVisible(1.0, 90, h, RADIO_SOL) === false && isTargetVisible(3.0, 90, h, RADIO_SOL) === true, 'visibilidad: Sol a 1° tapado, a 3° visible');
const sh = calculateProjectedShadows(dem, N, N, M, 90, 1.0, 1, false);
ok(sh[150 * N + 160] === 1 && sh[150 * N + 260] === 0, 'sombra del muro cae hacia el lado opuesto al Sol');

console.log('5) Pendiente, potencia y térmica');
const rampa = new Float32Array(10 * 10); for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) rampa[r * 10 + c] = c * 7.0;   // 7 m por celda de 40 m
const sl = calculateSlopeDegrees(rampa, 10, 10, 40);
ok(Math.abs(sl[5 * 10 + 5] - 9.92) < 0.05, `pendiente de 7 m / 40 m = ${sl[55].toFixed(2)}° (esperado 9,92°)`);
ok(clasificarPendiente(9.9, 10).nivel === 'CAUTION' && clasificarPendiente(10.5, 10).nivel === 'HAZARD' && clasificarPendiente(4, 10).nivel === 'NOMINAL', 'clasificación única de pendiente');
const pv = calcular_potencia_electrica(true, 1.4, 2.5, 0.29, 120, 'vertical');
const ph = calcular_potencia_electrica(true, 1.4, 2.5, 0.29, 120, 'horizontal');
ok(pv.bruta / ph.bruta > 30, `panel vertical ${pv.bruta} W vs horizontal ${ph.bruta} W a 1,4° (factor ${(pv.bruta / ph.bruta).toFixed(0)}x)`);
ok(calcular_potencia_electrica(false, 3, 2, 0.29, 100).neta === -100, 'sin Sol visible: solo consumo');
const tPlano = calculateRadiativeEquilibrium({ solEl: 1.4, solAz: 90, dzdx: 0, dzdrow: 0, sunVisible: true });
const tSombra = calculateRadiativeEquilibrium({ solEl: 1.4, solAz: 90, sunVisible: false });
// pendiente que mira al Sol (Sol en azimut 90°, el terreno baja hacia el Este: dz/dx < 0) vs que le da la espalda
const tCara = calculateRadiativeEquilibrium({ solEl: 1.4, solAz: 90, dzdx: -0.15, dzdrow: 0, sunVisible: true });
const tEspalda = calculateRadiativeEquilibrium({ solEl: 1.4, solAz: 90, dzdx: 0.15, dzdrow: 0, sunVisible: true });
ok(tCara.kelvin > tPlano.kelvin && tPlano.kelvin > tEspalda.kelvin, `la orientación importa: cara ${tCara.kelvin} K > plano ${tPlano.kelvin} K > espalda ${tEspalda.kelvin} K`);
ok(tSombra.kelvin === 40, 'en sombra: suelo frío de 40 K (supuesto)');
// la temperatura ya no depende de la posición del píxel (antes: sin((fila+col)*0.1))
ok(calculateRadiativeEquilibrium({ solEl: 1.4, solAz: 90 }).kelvin === calculateRadiativeEquilibrium({ solEl: 1.4, solAz: 90 }).kelvin, 'determinista');

console.log('6) Corredor de descenso');
const llano = new Float32Array(N * N);
ok(evaluateGlideslopeCorridor(llano, N, N, M, 150, 150).clear, 'terreno llano: corredor libre');
const montaña = new Float32Array(N * N);
const { dr, dc } = { dr: 0, dc: 1 };                 // el módulo llega con rumbo 270 => viene del Este (azimut 90)
for (let r = 140; r < 160; r++) for (let c = 170; c < 175; c++) montaña[r * N + c] = 1500;
ok(!evaluateGlideslopeCorridor(montaña, N, N, M, 150, 150).clear, 'montaña de 1,5 km en la trayectoria: corredor bloqueado');

console.log('7) Iluminación del mes (prueba reducida)');
const s = 200, flat = new Float32Array(s * s);
const ilum = iluminacionMensual(flat, s, s, 160, new Date('2026-10-10T00:00:00Z'), 6, 10, 12);
ok(ilum.data.length === 20 * 20 && ilum.data.every(v => v >= 0 && v <= 1), 'rejilla gruesa 20x20 con valores 0..1');
const nCrater = 200, crater = new Float32Array(nCrater * nCrater);
for (let r = 0; r < nCrater; r++) for (let c = 0; c < nCrater; c++) { const d = Math.hypot(r - 100, c - 100); crater[r * nCrater + c] = d < 40 ? -2500 * (1 - (d / 40) ** 2) : (d < 55 ? 1200 : 0); }
const ic = iluminacionMensual(crater, nCrater, nCrater, 160, new Date('2026-10-10T00:00:00Z'), 8, 5, 12);
const centro = ic.data[10 * ic.nc + 10], borde = ic.data[0];
ok(centro <= borde, `fondo de un cráter profundo recibe menos Sol que el terreno llano (${centro.toFixed(2)} <= ${borde.toFixed(2)})`);

console.log('8) Tamaños de malla variables (synthetic DEM)');
const MPC_LOCAL = 160;   // m por celda para la malla de render (seccion 10)
const ramp = (rows, cols, mpc, slopeDeg) => {
  const dz = Math.tan(slopeDeg * DEG2RAD) * mpc;
  const dem = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) dem[r * cols + c] = c * dz;
  return { dem, expected: slopeDeg };
};
for (const [rows, cols, mpc, slopeDeg] of [
  [500, 500, 320, 5.0],
  [1000, 1000, 80, 10.0],
  [2000, 2000, 40, 15.0],
]) {
  const { dem, expected } = ramp(rows, cols, mpc, slopeDeg);
  const sl = calculateSlopeDegrees(dem, rows, cols, mpc);
  const mid = sl[Math.floor(rows/2) * cols + Math.floor(cols/2)];
  ok(Math.abs(mid - expected) < 0.05, `${rows}x${cols} @ ${mpc}m: pendiente ${mid.toFixed(2)}° (esperado ${expected}°)`);
}

console.log('9) Factor de escala estereográfico polar (L-SEA usa mpc constante)');
const R_LUNA_LOCAL = R_LUNA;
for (const lat of [-90.0, -88.0, -86.0, -84.72]) {
  const theta = (-lat - 90.0) * DEG2RAD; // colatitud desde polo sur
  const rho = 2 * R_LUNA_LOCAL * Math.tan(theta / 2);
  const k = 1 / Math.cos(theta / 2) ** 2; // factor de escala real
  ok(Math.abs(k - 1.0) < 0.01, `lat ${lat}°: factor escala k = ${k.toFixed(4)} (error <1%)`);
}

console.log('10) La malla de terreno cae sobre la rejilla del DEM (click-to-probe de App.vue)');
// App.vue convierte mundo<->celda con x = (col - cols/2)*mpc, y el raycast del
// click-to-probe usa la malla: si los vertices no caen en su celda, la sonda
// apunta a otra celda. se comprueba ida y vuelta en cada vertice.
import * as THREE from 'three';
import { createTerrainMesh } from '../src/3d/terrain.js';

for (const [rows, cols, dec] of [[4000, 4000, 4], [1999, 1999, 3], [1000, 1000, 7]]) {
  const mpc = 160;
  const stride = Math.max(1, Math.floor(dec));
  const renderCols = Math.max(2, Math.ceil(cols / stride));
  const dem = new Float32Array(rows * cols);
  for (let i = 0; i < dem.length; i++) dem[i] = (i % 97) * 11 - 500;
  const mesh = createTerrainMesh(dem, rows, cols, mpc, 1.0, dec);
  mesh.geometry.computeBoundingBox();
  const centro = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
  mesh.position.sub(centro);            // App.vue centra la malla en el origen
  mesh.updateMatrixWorld(true);

  const pos = mesh.geometry.attributes.position;
  let mal = 0, n = 0;
  for (let i = 0; i < pos.count; i += 13) {
    const r = Math.floor(i / renderCols), c = i % renderCols;
    const fila = Math.min(rows - 1, Math.round(r * stride));
    const col = Math.min(cols - 1, Math.round(c * stride));
    const local = new THREE.Vector3().fromBufferAttribute(pos, i);
    const world = local.clone().applyMatrix4(mesh.matrixWorld);
    n++;
    if (Math.round((world.x + centro.x) / mpc + cols / 2) !== col ||
        Math.round((world.z + centro.z) / mpc + rows / 2) !== fila ||
        Math.abs(dem[fila * cols + col] - local.y) > 1e-3) mal++;
  }
  ok(mal === 0, `${rows}x${cols} decimado ${dec}x: ${mal}/${n} vertices fuera de su celda`);
}

// Un raycast cenital debe caer sobre la superficie y devolver una celda coherente.
const NR = 1000, NC = 1000;
const dem2 = new Float32Array(NR * NC);
for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++)
  dem2[r * NC + c] = 0.03 * ((c - NC / 2) * MPC_LOCAL) + 0.02 * ((r - NR / 2) * MPC_LOCAL);
const mesh2 = createTerrainMesh(dem2, NR, NC, MPC_LOCAL, 1.0, 4);
mesh2.geometry.computeBoundingBox();
const centro2 = mesh2.geometry.boundingBox.getCenter(new THREE.Vector3());
mesh2.position.sub(centro2);
mesh2.updateMatrixWorld(true);
const cam = new THREE.PerspectiveCamera(70);
cam.position.set(0, 40000, 1);
cam.lookAt(new THREE.Vector3(0, -centro2.y, 0));
cam.updateMatrixWorld(true);
const rc = new THREE.Raycaster();
let impactos = 0, peor = 0;
for (let k = 0; k < 48; k++) {
  rc.setFromCamera(new THREE.Vector2((k % 8) / 4 - 0.875, Math.floor(k / 8) / 3 - 0.5), cam);
  const h = rc.intersectObject(mesh2);
  if (!h.length) continue;
  const p = h[0].point;
  const col = Math.round((p.x + centro2.x) / MPC_LOCAL + NC / 2);
  const fila = Math.round((p.z + centro2.z) / MPC_LOCAL + NR / 2);
  if (fila < 1 || fila >= NR - 1 || col < 1 || col >= NC - 1) continue;
  impactos++;
  // la malla decimada interpola entre celdas separadas stride*mpc, asi que el desfase
  // admisible es la pendiente por stride*mpc/2, no por mpc/2
  peor = Math.max(peor, Math.abs(dem2[fila * NC + col] - (p.y + centro2.y)));
}
ok(impactos > 20 && peor < 12,
   `raycast cenital: ${impactos}/48 impactos, peor desfase ${peor.toFixed(2)} m (< 12 m, interpolacion de la malla decimada)`);

console.log('11) TRN: el score depende del relieve medido, no solo del Sol');
const NT = 121, trnLlano = new Float32Array(NT * NT), trnRugoso = new Float32Array(NT * NT);
for (let r = 0; r < NT; r++) for (let c = 0; c < NT; c++) {
  trnRugoso[r * NT + c] = c * 8.0 + ((r % 4 < 2) ? 0 : 60);   // rampa 11,3° + dientes de sierra
}
const trnLlano6 = evaluateTrnFeasibility(trnLlano, NT, NT, 40, 60, 60, 6.0);
const trnRugoso6 = evaluateTrnFeasibility(trnRugoso, NT, NT, 40, 60, 60, 6.0);
ok(trnRugoso6.score > trnLlano6.score + 40, `mismo Sol (6°): relieve ${trnRugoso6.score}% vs llano ${trnLlano6.score}%`);
ok(trnLlano6.status === 'DEGRADED' && trnRugoso6.status === 'OPTIMAL', `estados coherentes: llano ${trnLlano6.status}, rugoso ${trnRugoso6.status}`);
const trnCiego = evaluateTrnFeasibility(trnRugoso, NT, NT, 40, 60, 60, 0.5);
ok(trnCiego.status === 'NO-GO (BLIND)' && trnCiego.score < 50, `Sol 0,5°: ${trnCiego.status} (${trnCiego.score}%)`);
const trnAlto = evaluateTrnFeasibility(trnRugoso, NT, NT, 40, 60, 60, 30.0);
ok(trnAlto.score < trnRugoso6.score, `Sol alto aplana el contraste: 30° ${trnAlto.score}% < 6° ${trnRugoso6.score}%`);
const trnBorde = evaluateTrnFeasibility(trnRugoso, NT, NT, 40, 0, 0, 6.0);
ok(trnBorde.score > 0 && Number.isFinite(trnBorde.score), `en la esquina del DEM la ventana se recorta sin salirse (${trnBorde.score}%)`);
const trnFrac = evaluateTrnFeasibility(trnRugoso, NT, NT, 40, 60.4, 60.6, 6.0);
ok(trnFrac.score === trnRugoso6.score, `posición fraccionaria (click 3D) da el mismo score que la celda redondeada (${trnFrac.score}%)`);
ok(evaluateTrnFeasibility(trnRugoso, NT, NT, 40, NT + 5, 60, 6).status === 'NO DATA', 'posición fuera del DEM: NO DATA, sin recortar en silencio');
ok(evaluateTrnFeasibility(null, NT, NT, 40, 60, 60, 6).status === 'NO DATA', 'sin DEM: NO DATA explícito, no un score inventado');

console.log(fallos === 0 ? '\nTODO OK' : `\n${fallos} FALLO(S)`);
process.exit(fallos === 0 ? 0 : 1);