// ==============================================================================
// PATH: src/core/nasa_suite.js
// ESTIMACIONES DE INGENIERÍA (térmica, corredor de descenso, TRN, libración)
// ==============================================================================
// IMPORTANTE: son MODELOS SIMPLES con supuestos declarados. No son productos
// oficiales de la NASA ni reproducen el instrumento Diviner.
// ==============================================================================
import { ROW_DIR, caidaCurvatura, pasoAzimut } from './geo.js';

const DEG2RAD = Math.PI / 180.0;

export const AZIMUT_APROXIMACION = 270.0;   // SUPUESTO: rumbo de vuelo del módulo (el mismo para todos los sitios)
export const ANGULO_DESCENSO = 12.0;        // SUPUESTO: pendiente de la trayectoria recta de descenso
export const RADIO_SOL = 0.267;

/**
 * Temperatura de equilibrio radiativo INSTANTÁNEO de una superficie inclinada:
 *   T = [ (1-A)·S·cos(i) / (ε·σ) ]^(1/4),   cos(i) = n·s   (n: normal, s: dirección del Sol)
 * Ignora la conducción en el regolito y la inercia térmica (el suelo real tarda en calentarse
 * y enfriarse). Suelo mínimo de 40 K: SUPUESTO ilustrativo para zonas en sombra.
 */
export function calculateRadiativeEquilibrium({ solEl, solAz, dzdx = 0, dzdrow = 0, sunVisible = true }) {
    const STEFAN_BOLTZMANN = 5.67037e-8;
    const SOLAR_FLUX = 1361.0;
    const ALBEDO = 0.12;
    const EMISSIVITY = 0.95;
    const T_MIN = 40.0;

    let cosI = 0.0;
    if (sunVisible && solEl + RADIO_SOL > 0) {
        const az = solAz * DEG2RAD, el = Math.max(solEl, 0.0) * DEG2RAD;
        // ejes: x = Este (derecha), y = "arriba del mapa" (norte del mapa), z = cenit
        const sx = Math.sin(az) * Math.cos(el), sy = Math.cos(az) * Math.cos(el), sz = Math.sin(el);
        const nx = -dzdx, ny = -ROW_DIR * dzdrow, nz = 1.0;
        const nn = Math.sqrt(nx * nx + ny * ny + nz * nz);
        cosI = Math.max(0.0, (nx * sx + ny * sy + nz * sz) / nn);
    }

    if (cosI <= 0) {
        return { kelvin: T_MIN, celsius: Math.round(T_MIN - 273.15), status: 'COLD FLOOR (shadow)' };
    }
    const T4 = ((1.0 - ALBEDO) * SOLAR_FLUX * cosI) / (EMISSIVITY * STEFAN_BOLTZMANN);
    const kelvin = Math.max(T_MIN, Math.pow(T4, 0.25));

    let status = 'NOMINAL';
    if (kelvin < 110) status = 'VERY COLD';
    else if (kelvin > 360) status = 'HIGH THERMAL STRESS';
    return { kelvin: Math.round(kelvin), celsius: Math.round(kelvin - 273.15), status };
}

/**
 * Corredor de descenso: recta de ANGULO_DESCENSO° visto desde el punto de aterrizaje,
 * desde 1,5 hasta 20 km, con rumbo fijo. Margen = altura de la trayectoria - relieve
 * (con curvatura). Es una SIMPLIFICACIÓN; un descenso propulsado real no es una recta.
 */
export function evaluateGlideslopeCorridor(dem, rows, cols, mpc, row, col,
                                           approachAzimuth = AZIMUT_APROXIMACION, glideslopeAngle = ANGULO_DESCENSO) {
    const zTouchdown = dem[row * cols + col];
    const distMinM = 1500.0, distMaxM = 20000.0, steps = 35;
    const stepM = (distMaxM - distMinM) / steps;

    // el módulo llega volando con rumbo approachAzimuth: viene del lado opuesto
    const { dr, dc } = pasoAzimut(approachAzimuth + 180.0);
    const tanG = Math.tan(glideslopeAngle * DEG2RAD);

    let worstMarginM = 9999.0;
    let collision = false;

    for (let i = 0; i <= steps; i++) {
        const distM = distMinM + i * stepM;
        const r = Math.round(row + dr * distM / mpc);
        const c = Math.round(col + dc * distM / mpc);
        if (r < 0 || r >= rows || c < 0 || c >= cols) break;

        const terreno = dem[r * cols + c] - caidaCurvatura(distM);
        const margen = (zTouchdown + distM * tanG) - terreno;
        if (margen < worstMarginM) worstMarginM = margen;
        if (margen <= 100.0) { collision = true; break; }
    }
    return {
        clear: !collision && worstMarginM > 150.0,
        minMarginM: Math.round(worstMarginM),
        glideslopeAngle,
        approachAzimuth
    };
}

// ---- TRN (navegación relativa al terreno) ------------------------------------
// El score mezcla dos cosas: relieve MEDIDO en el DEM (¿hay rasgos que seguir?)
// y contraste por sombras, que es una curva SUPUESTA sobre la elevación solar.
export const TRN_WINDOW_CELLS = 8;          // ventana 17x17 celdas alrededor del punto activo (cota fija)
export const TRN_SLOPE_FULL_DEG = 8.0;      // SUPUESTO: pendiente media a la que el relieve ya es "rico" para TRN
export const TRN_RELIEF_MIN = 0.15;         // suelo: sin rasgos que seguir no hay nada que correlacionar
export const TRN_SUN_BLIND = 0.8;           // SUPUESTO: por debajo, el suelo está todo en sombra
export const TRN_SUN_OPTIMAL = 3.0;         // SUPUESTO: elevación de máximo contraste (sombras largas del terminador polar)
export const TRN_SUN_FLAT = 15.0;           // SUPUESTO: a partir de aquí el Sol aplana el relieve

/** Contraste por sombras (curva supuesta, interpolada linealmente entre los cortes). */
function trnShadowFactor(solarElevation) {
    if (solarElevation <= TRN_SUN_BLIND) return 0.10;
    if (solarElevation <= TRN_SUN_OPTIMAL) {
        return 0.40 + 0.60 * (solarElevation - TRN_SUN_BLIND) / (TRN_SUN_OPTIMAL - TRN_SUN_BLIND);
    }
    if (solarElevation <= TRN_SUN_FLAT) {
        return 1.0 - 0.25 * (solarElevation - TRN_SUN_OPTIMAL) / (TRN_SUN_FLAT - TRN_SUN_OPTIMAL);
    }
    return Math.max(0.45, 0.75 - 0.30 * (solarElevation - TRN_SUN_FLAT) / 30.0);
}

/**
 * TRN: ¿puede el descenso guiarse comparando el terreno que ve con el mapa?
 * score = relieve_medido × contraste_solar, ambos en 0..1:
 *   - relieve: pendiente media (gradiente central) de una ventana de 17x17 celdas,
 *     normalizada por TRN_SLOPE_FULL_DEG: mide si hay relieve que correlacionar;
 *   - contraste: curva supuesta de la elevación solar (sombras largas ayudan, Sol alto aplana).
 * A igualdad de Sol el score cambia con el terreno: un llano no da referencias.
 * Devuelve NO DATA (explícito) si el DEM o la posición no son válidos.
 */
export function evaluateTrnFeasibility(dem, rows, cols, mpc, row, col, solarElevation) {
    if (!dem || !Number.isFinite(solarElevation) || rows < 3 || cols < 3 || mpc <= 0 ||
        !Number.isFinite(row) || !Number.isFinite(col) || row < 0 || row >= rows || col < 0 || col >= cols) {
        return { score: 0, status: 'NO DATA', detail: 'DEM or active point out of range', relief: 0, sunFactor: 0, meanSlopeDeg: 0 };
    }

    // la posición puede llegar fraccionaria (click en la malla 3D): se indexa con enteros
    const rp = Math.min(rows - 2, Math.max(1, Math.round(row)));
    const cp = Math.min(cols - 2, Math.max(1, Math.round(col)));
    const r0 = Math.max(1, rp - TRN_WINDOW_CELLS), r1 = Math.min(rows - 2, rp + TRN_WINDOW_CELLS);
    const c0 = Math.max(1, cp - TRN_WINDOW_CELLS), c1 = Math.min(cols - 2, cp + TRN_WINDOW_CELLS);
    let celdas = 0, sumaPendiente = 0;

    for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
            const dzdx = (dem[r * cols + c + 1] - dem[r * cols + c - 1]) / (2 * mpc);
            const dzdrow = (dem[(r + 1) * cols + c] - dem[(r - 1) * cols + c]) / (2 * mpc);
            celdas++;
            sumaPendiente += Math.atan(Math.hypot(dzdx, dzdrow)) * (180.0 / Math.PI);
        }
    }

    const pendienteMedia = celdas > 0 ? sumaPendiente / celdas : 0;
    const relief = Math.min(1.0, Math.max(TRN_RELIEF_MIN, pendienteMedia / TRN_SLOPE_FULL_DEG));
    const sunFactor = trnShadowFactor(solarElevation);
    const score = Math.round(100 * relief * sunFactor);
    const ventanaKm = ((2 * TRN_WINDOW_CELLS + 1) * mpc / 1000).toFixed(1);
    const pendienteTxt = pendienteMedia.toFixed(1);

    let status, detail;
    if (solarElevation <= TRN_SUN_BLIND) {
        status = 'NO-GO (BLIND)';
        detail = 'Full shadows prevent crater feature tracking';
    } else if (score >= 70) {
        status = 'OPTIMAL';
        detail = `Solid relief (${pendienteTxt}° mean slope over the ${ventanaKm} km window) + long shadows`;
    } else if (score >= 50) {
        status = 'MARGINAL';
        detail = `Relief ${pendienteTxt}° over the ${ventanaKm} km window, contrast fading`;
    } else if (relief > TRN_RELIEF_MIN) {
        status = 'DEGRADED';
        detail = `Relief is there (${pendienteTxt}°), but this Sun angle flattens it`;
    } else {
        status = 'DEGRADED';
        detail = `Little relief (${pendienteTxt}° mean slope over the ${ventanaKm} km window): few features to match`;
    }
    return {
        score, status, detail,
        relief: Math.round(relief * 100) / 100,
        sunFactor: Math.round(sunFactor * 100) / 100,
        meanSlopeDeg: Math.round(pendienteMedia * 10) / 10
    };
}

/**
 * Margen de enlace directo con la Tierra: elevación de la Tierra sobre el horizonte del terreno
 * en su azimut. Umbral de 2,5° ILUSTRATIVO.
 */
export function evaluateLibrationRisk(margenDeg, visible) {
    if (!visible || margenDeg <= 0) {
        return { status: 'NO LINE OF SIGHT', marginDeg: margenDeg.toFixed(1), risk: 'CRITICAL' };
    } else if (margenDeg < 2.5) {
        return { status: 'MARGINAL (LIBRATION RISK)', marginDeg: margenDeg.toFixed(1), risk: 'MEDIUM' };
    }
    return { status: 'LINE OF SIGHT', marginDeg: margenDeg.toFixed(1), risk: 'LOW' };
}
