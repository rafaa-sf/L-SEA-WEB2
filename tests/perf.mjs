// tests/perf.mjs  —  Paso 1/2: baseline performance numbers
// Ejecutar: node tests/perf.mjs
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { calculateHorizonProfile, calculateSlopeDegrees } from '../src/core/engine.js';
import { iluminacionMensual } from '../src/core/illumination.js';
import { pixelToGeo } from '../src/core/geo.js';
import { direccionesLunar, base_local, calcularEfemeridesMeeus } from '../src/core/astro.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEM_PATH = join(__dirname, '..', 'public', 'data', 'lola_shackleton.bin');

function mb(bytes) { return (bytes / 1024 / 1024).toFixed(1); }

function loadDEM(path) {
  const buffer = fs.readFileSync(path);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  // Try to read header (3 int32 = 12 bytes)
  if (buffer.byteLength >= 12) {
    const rows = view.getInt32(0, true);
    const cols = view.getInt32(4, true);
    const mpc = view.getInt32(8, true);
    const expected = rows * cols * 4;
    if (buffer.byteLength - 12 === expected) {
      const data = new Float32Array(buffer.buffer, buffer.byteOffset + 12, rows * cols);
      return { data, rows, cols, mpc };
    }
  }
  // Fallback: old format (raw Float32Array)
  const dem = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  return { data: dem, rows: 2000, cols: 2000, mpc: 160 };
}

async function main() {
  const t0 = performance.now();
  const { data: dem, rows: ROWS, cols: COLS, mpc: MPC } = loadDEM(DEM_PATH);
  const t1 = performance.now();
  console.log(`DEM load: ${(t1 - t0).toFixed(0)} ms, ${mb(dem.byteLength)} MB, ${ROWS}x${COLS} @ ${MPC}m`);

  // 1) slope (used by audit)
  const t2 = performance.now();
  const slopes = calculateSlopeDegrees(dem, ROWS, COLS, MPC);
  const t3 = performance.now();
  console.log(`Slope (2000x2000): ${(t3 - t2).toFixed(0)} ms`);

  // 2) single horizon (what audit does per candidate)
  const fila = 1000, col = 1000;
  const t4 = performance.now();
  const horiz = calculateHorizonProfile(dem, ROWS, COLS, MPC, fila, col, 2.0, true);
  const t5 = performance.now();
  console.log(`Horizon (360 az, curvature): ${(t5 - t4).toFixed(0)} ms`);

  // 3) 30-day illumination (coarse grid, paso=8 = 1.28 km)
  const t6 = performance.now();
  const illum = await iluminacionMensual(dem, ROWS, COLS, MPC, new Date('2026-10-08T00:00:00Z'), 30, 8, 12);
  const t7 = performance.now();
  console.log(`30-day illumination (250x250 grid): ${(t7 - t6).toFixed(0)} ms, grid ${illum.nr}x${illum.nc}`);

  // 4) full audit pipeline equivalent (slope + footprint + NMS + 15 candidates + refinement)
  const t8 = performance.now();
  // slope already done
  const maxSlope = 8, footprintM = 480;
  const radiusPx = Math.max(1, Math.round(footprintM / MPC));
  const rSq = radiusPx * radiusPx;
  const margenF = Math.floor(ROWS * 0.08), margenC = Math.floor(COLS * 0.08);
  const worst = new Float32Array(ROWS * COLS);
  const safetyMap = new Float32Array(ROWS * COLS);
  const idon = new Float32Array(ROWS * COLS);

  for (let r = Math.max(radiusPx, margenF); r < ROWS - Math.max(radiusPx, margenF); r++) {
    for (let c = Math.max(radiusPx, margenC); c < COLS - Math.max(radiusPx, margenC); c++) {
      const idx = r * COLS + c;
      if (slopes[idx] > maxSlope) continue;
      let worstSlope = slopes[idx], hazard = false;
      for (let dr = -radiusPx; dr <= radiusPx && !hazard; dr++) {
        for (let dc = -radiusPx; dc <= radiusPx; dc++) {
          if (dr * dr + dc * dc <= rSq) {
            const s = slopes[(r + dr) * COLS + (c + dc)];
            if (s > worstSlope) worstSlope = s;
            if (s > maxSlope) { hazard = true; break; }
          }
        }
      }
      if (hazard) continue;
      worst[idx] = worstSlope;
      const S = Math.pow(Math.max(0, 1 - worstSlope / maxSlope), 2);
      let L = 0;
      if (illum) {
        const ii = Math.min(illum.nr - 1, Math.floor(r / illum.paso));
        const jj = Math.min(illum.nc - 1, Math.floor(c / illum.paso));
        L = illum.data[ii * illum.nc + jj];
      }
      safetyMap[idx] = S;
      idon[idx] = 100 * (0.6 * S + 0.4 * L);
    }
  }
  // NMS top 15
  const POOL = 15, excl = 40, exclSq = excl * excl;
  const copia = new Float32Array(idon);
  const candidatos = [];
  for (let rank = 1; rank <= POOL; rank++) {
    let best = 0, rb = -1, cb = -1;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = copia[r * COLS + c];
        if (v > best) { best = v; rb = r; cb = c; }
      }
    }
    if (rb < 0) break;
    candidatos.push({ fila: rb, col: cb, scoreAprox: best, safety: safetyMap[rb * COLS + cb], peorPendiente: worst[rb * COLS + cb] });
    for (let r = Math.max(0, rb - excl); r < Math.min(ROWS, rb + excl); r++) {
      for (let c = Math.max(0, cb - excl); c < Math.min(COLS, cb + excl); c++) {
        if ((r - rb) * (r - rb) + (c - cb) * (c - cb) <= exclSq) copia[r * COLS + c] = 0;
      }
    }
  }
  // refinement per candidate (horizon + 30-day vis + ephemeris)
  const fecha0 = new Date('2026-10-08T00:00:00Z');
  const simHora = 12;
  for (const s of candidatos) {
    const vis = visibilidadDiaria(dem, ROWS, COLS, MPC, s.fila, s.col, fecha0, 30, simHora, 2.0);
    const g = pixelToGeo(s.fila, s.col, ROWS, COLS, MPC);
    const ef = calcularEfemeridesMeeus(new Date(fecha0.getTime()), g.lat, g.lon, g.rumbo);
    // (simplified — just timing the horizon+ephem part)
  }
  const t9 = performance.now();
  console.log(`Full audit pipeline (slope + footprint + NMS + 15 refinements): ${(t9 - t8).toFixed(0)} ms`);

  // Memory
  if (global.gc) global.gc();
  const mem = process.memoryUsage();
  console.log(`Heap: used ${mb(mem.heapUsed)}, total ${mb(mem.heapTotal)}, external ${mb(mem.external)}`);
}

// Need visibilidadDiaria import
import { visibilidadDiaria } from '../src/core/windows.js';
main().catch(e => { console.error(e); process.exit(1); });