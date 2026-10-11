// ==============================================================================
// PATH: src/core/engine.js
// MOTOR TOPOGRÁFICO: pendiente, horizonte y sombras por trazado de rayos
// ==============================================================================
// Convención: azimut 0° = ARRIBA del mapa (filas decrecientes), 90° = derecha.
// Ver geo.js. Todos los trazados descuentan la CURVATURA LUNAR (d²/2R), que en un
// mapa de 320 km llega a >7 km en el borde y no es despreciable.
// ==============================================================================
import { ROW_DIR, caidaCurvatura } from './geo.js';

const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;

/** Pendiente del terreno en grados (diferencias centrales, escala real). */
export function calculateSlopeDegrees(dem, rows, cols, mpc) {
    const slopes = new Float32Array(rows * cols);
    for (let r = 0; r < rows; r++) {
        const rPrev = r > 0 ? r - 1 : 0;
        const rNext = r < rows - 1 ? r + 1 : rows - 1;
        for (let c = 0; c < cols; c++) {
            const cPrev = c > 0 ? c - 1 : 0;
            const cNext = c < cols - 1 ? c + 1 : cols - 1;
            const dzdy = (dem[rNext * cols + c] - dem[rPrev * cols + c]) / ((rNext - rPrev) * mpc);
            const dzdx = (dem[r * cols + cNext] - dem[r * cols + cPrev]) / ((cNext - cPrev) * mpc);
            slopes[r * cols + c] = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * RAD2DEG;
        }
    }
    return slopes;
}

/** Gradiente local en una celda: dz/dx (por columna) y dz/dfila (por fila), en m/m. */
export function gradienteLocal(dem, rows, cols, mpc, r, c) {
    const rPrev = Math.max(0, r - 1), rNext = Math.min(rows - 1, r + 1);
    const cPrev = Math.max(0, c - 1), cNext = Math.min(cols - 1, c + 1);
    const dzdrow = (dem[rNext * cols + c] - dem[rPrev * cols + c]) / ((rNext - rPrev) * mpc);
    const dzdx = (dem[r * cols + cNext] - dem[r * cols + cPrev]) / ((cNext - cPrev) * mpc);
    const slope = Math.atan(Math.hypot(dzdx, dzdrow)) * RAD2DEG;
    return { dzdx, dzdrow, slope };
}

/**
 * Horizonte radial de 360° desde (row, col) con un mástil de mastHeight metros.
 * horizon[az] = máxima elevación (°) con la que el relieve tapa el cielo; suelo llano = 0°.
 */
export function calculateHorizonProfile(dem, rows, cols, mpc, row, col, mastHeight = 2.0, curvatura = true) {
    const horizon = new Float32Array(360);
    const z0 = dem[row * cols + col] + mastHeight;
    const maxDist = Math.floor(Math.sqrt(rows * rows + cols * cols));

    for (let az = 0; az < 360; az++) {
        const azRad = az * DEG2RAD;
        const dr = ROW_DIR * Math.cos(azRad);
        const dc = Math.sin(azRad);
        let maxAngle = 0.0;

        for (let dist = 1; dist < maxDist; dist++) {
            const r = Math.round(row + dr * dist);
            const c = Math.round(col + dc * dist);
            if (r < 0 || r >= rows || c < 0 || c >= cols) break;

            const distM = dist * mpc;
            const zRel = dem[r * cols + c] - (curvatura ? caidaCurvatura(distM) : 0.0);
            const angle = Math.atan2(zRel - z0, distM) * RAD2DEG;
            if (angle > maxAngle) maxAngle = angle;
        }
        horizon[az] = maxAngle;
    }
    return horizon;
}

/** Sombras proyectadas para un Sol en (azimuth, elevation) del mapa. 1 = sombra. */
export function calculateProjectedShadows(dem, rows, cols, mpc, azimuth, elevation, stride = 2, curvatura = true) {
    const blocked = new Uint8Array(rows * cols);
    if (elevation <= 0) {
        blocked.fill(1);
        return blocked;
    }
    const dr = ROW_DIR * Math.cos(azimuth * DEG2RAD);
    const dc = Math.sin(azimuth * DEG2RAD);
    const tanEl = Math.tan(elevation * DEG2RAD);
    const maxDist = Math.max(rows, cols);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            const z0 = dem[idx];
            for (let k = 1; k < maxDist; k += stride) {
                const f = Math.round(r + dr * k);
                const cc = Math.round(c + dc * k);
                if (f < 0 || f >= rows || cc < 0 || cc >= cols) break;
                const distM = k * mpc;
                const zT = dem[f * cols + cc] - (curvatura ? caidaCurvatura(distM) : 0.0);
                if ((zT - z0) > tanEl * distM) { blocked[idx] = 1; break; }
            }
        }
    }
    return blocked;
}

/**
 * ¿Asoma el astro sobre el horizonte del terreno?
 * Criterio ÚNICO para toda la app (igual que lunar.py): elevación + radio > horizonte(azimut).
 * Sol: radius = 0,267° (su borde superior). Tierra: radius = 0 (su centro).
 */
export function isTargetVisible(elevation, azimuth, horizon, radius = 0.0) {
    const idx = ((Math.round(azimuth) % 360) + 360) % 360;
    return (elevation + radius) > horizon[idx];
}

/** Clasificación de pendiente ÚNICA para toda la app, relativa al límite del vehículo. */
export function clasificarPendiente(pendiente, maxPendiente) {
    if (pendiente > maxPendiente) return { nivel: 'HAZARD', texto: 'ROLLOVER HAZARD', clase: 'text-red-400' };
    if (pendiente > 0.5 * maxPendiente) return { nivel: 'CAUTION', texto: 'CAUTION (STEEP)', clase: 'text-yellow-400' };
    return { nivel: 'NOMINAL', texto: 'NOMINAL (SAFE)', clase: 'text-green-400' };
}
