// Ejecutar:  node tests/verify.mjs      (sin dependencias)
// Comprueba el núcleo físico contra valores de referencia de Skyfield + JPL DE421
// (tests/fixtures.json) y contra casos analíticos.
import fs from 'node:fs';
import { calcularEfemeridesMeeus, lunaDesdeEstacion, RADIO_SOL } from '../src/core/astro.js';
import { pixelToGeo, geoToPixel, caidaCurvatura, ROW_DIR } from '../src/core/geo.js';
import { calculateHorizonProfile, calculateProjectedShadows, isTargetVisible, clasificarPendiente, calculateSlopeDegrees } from '../src/core/engine.js';
import { calcular_potencia_electrica, telemetria_dsn, estacionActivaDSN } from '../src/core/power.js';
import { calculateRadiativeEquilibrium, evaluateGlideslopeCorridor } from '../src/core/nasa_suite.js';
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

console.log(fallos === 0 ? '\nTODO OK' : `\n${fallos} FALLO(S)`);
process.exit(fallos === 0 ? 0 : 1);
