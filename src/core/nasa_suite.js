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

/** TRN: contraste óptico según la elevación solar. Umbrales ILUSTRATIVOS, no oficiales. */
export function evaluateTrnFeasibility(solarElevation) {
    if (solarElevation <= 0.8) {
        return { score: 10, status: 'NO-GO (BLIND)', detail: 'Full shadows prevent crater feature tracking' };
    } else if (solarElevation <= 8.5) {
        return { score: 98, status: 'OPTIMAL', detail: 'Long shadows give strong relief contrast' };
    } else if (solarElevation <= 15.0) {
        return { score: 75, status: 'MARGINAL', detail: 'Relief shadows fading progressively' };
    }
    return { score: 45, status: 'DEGRADED', detail: 'High Sun flattens optical reference points' };
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
