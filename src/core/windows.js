// ==============================================================================
// RUTA DEL FICHERO: src/core/windows.js
// VISIBILIDAD DIARIA DE SOL/TIERRA EN UN SITIO Y BUSCADOR DE VENTANAS
// ==============================================================================
import { calcularEfemeridesMeeus, RADIO_SOL } from './astro.js';
import { calculateHorizonProfile, isTargetVisible } from './engine.js';
import { pixelToGeo } from './geo.js';

/**
 * Visibilidad día a día (una evaluación diaria a la hora UTC indicada) en el píxel (fila, col).
 * Usa el horizonte REAL del terreno y las efemérides DEL PROPIO SITIO.
 */
export function visibilidadDiaria(dem, rows, cols, mpc, fila, col, fechaInicio, dias = 30, hora = 12, mastil = 2.0, horizonte = null) {
    const horiz = horizonte || calculateHorizonProfile(dem, rows, cols, mpc, fila, col, mastil);
    const g = pixelToGeo(fila, col, rows, cols, mpc);
    const sol = new Uint8Array(dias), dte = new Uint8Array(dias);
    const sol_el = new Float32Array(dias), tierra_el = new Float32Array(dias);

    for (let i = 0; i < dias; i++) {
        const d = new Date(fechaInicio.getTime() + i * 86400000);
        d.setUTCHours(hora, 0, 0, 0);
        const ef = calcularEfemeridesMeeus(d, g.lat, g.lon, g.rumbo);
        sol[i] = isTargetVisible(ef.sol_el, ef.sol_az, horiz, RADIO_SOL) ? 1 : 0;
        dte[i] = isTargetVisible(ef.tierra_el, ef.tierra_az, horiz, 0) ? 1 : 0;
        sol_el[i] = ef.sol_el; tierra_el[i] = ef.tierra_el;
    }
    const pct = a => (a.reduce((s, v) => s + v, 0) / dias) * 100;
    return { sol, dte, sol_el, tierra_el, sol_pct: pct(sol), dte_pct: pct(dte), horizonte: horiz, geo: g };
}

/** Ventanas de estancia (sliding window) de `duracion` días con Sol y enlace suficientes. */
export function buscar_ventanas_anuales(dem, rows, cols, mpc, fila, col, fechaInicio, dias_busqueda = 365,
                                        duracion = 7, min_sol_pct = 80.0, min_dte_pct = 50.0, mastil = 2.0) {
    const v = visibilidadDiaria(dem, rows, cols, mpc, fila, col, fechaInicio, dias_busqueda, 12, mastil);
    const oportunidades = [];
    for (let d = 0; d + duracion <= dias_busqueda; d++) {
        let s = 0, t = 0;
        for (let j = 0; j < duracion; j++) { s += v.sol[d + j]; t += v.dte[d + j]; }
        const pctS = (s / duracion) * 100, pctT = (t / duracion) * 100;
        if (v.sol[d] === 1 && v.dte[d] === 1 && pctS >= min_sol_pct && pctT >= min_dte_pct) {
            oportunidades.push({
                t0: new Date(fechaInicio.getTime() + d * 86400000),
                cierre: new Date(fechaInicio.getTime() + (d + duracion) * 86400000),
                sol_pct: Math.round(pctS * 10) / 10,
                dte_pct: Math.round(pctT * 10) / 10,
                score: Math.round((0.6 * pctS + 0.4 * pctT) * 10) / 10
            });
        }
    }
    return oportunidades;
}
