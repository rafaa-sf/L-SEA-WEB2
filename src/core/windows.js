// ==============================================================================
// RUTA DEL FICHERO: src/core/windows.js
// EVALUADOR DE MISIONES Y BUSCADOR DE VENTANAS (L-SEA Autopilot)
// ==============================================================================

import { calcularEfemeridesMeeus, RADIO_SOL } from './astro.js';
import { perfil_horizonte, es_visible, sombras_proyectadas } from './engine.js';

/**
 * Algoritmo Sliding Window (365 días)[cite: 4]
 */
export function buscar_ventanas_anuales(dem, rows, cols, mpc, fila, col, lat, lon, rumbo, fechaInicioObj, dias_busqueda = 365, duracion_estancia = 7, min_sol_pct = 80.0, min_dte_pct = 50.0, mastil = 2.0) {
    const horiz = perfil_horizonte(dem, rows, cols, mpc, fila, col, mastil);
    
    const vis_sol = new Uint8Array(dias_busqueda);
    const vis_tierra = new Uint8Array(dias_busqueda);
    const fechas = [];

    // Pre-calcular efemérides para todos los días
    for (let i = 0; i < dias_busqueda; i++) {
        const d = new Date(fechaInicioObj.getTime() + i * 86400000);
        fechas.push(d);
        const ef = calcularEfemeridesMeeus(d, lat, lon, rumbo);
        
        vis_sol[i] = es_visible(ef.sol_el, ef.sol_az, horiz, RADIO_SOL) ? 1 : 0;
        vis_tierra[i] = es_visible(ef.tierra_el, ef.tierra_az, horiz, 0) ? 1 : 0;
    }

    const mascara_anual = new Uint8Array(dias_busqueda);
    const oportunidades = [];
    const limite = dias_busqueda - duracion_estancia;

    for (let d = 0; d < limite; d++) {
        let suma_sol = 0, suma_dte = 0;
        
        for (let j = 0; j < duracion_estancia; j++) {
            suma_sol += vis_sol[d + j];
            suma_dte += vis_tierra[d + j];
        }

        const pct_sol = (suma_sol / duracion_estancia) * 100.0;
        const pct_dte = (suma_dte / duracion_estancia) * 100.0;

        // Criterio de Touchdown[cite: 4]
        const condicion_touchdown = (vis_sol[d] === 1) && (vis_tierra[d] === 1);

        if (condicion_touchdown && pct_sol >= min_sol_pct && pct_dte >= min_dte_pct) {
            mascara_anual[d] = 1;
            const score = (0.6 * pct_sol) + (0.4 * pct_dte);
            
            oportunidades.push({
                t0: fechas[d],
                cierre: fechas[d + duracion_estancia],
                sol_pct: Math.round(pct_sol * 10) / 10,
                dte_pct: Math.round(pct_dte * 10) / 10,
                score: Math.round(score * 10) / 10
            });
        }
    }

    return { mascara_anual, oportunidades };
}

/**
 * Autopilot Táctico de Aterrizaje (Detección Top 5)[cite: 4]
 */
export function top_sitios_aterrizaje(idoneidad, pendientes, dem, rows, cols, max_pend = 10.0, n_sitios = 5, radio_exclusion_px = 12, deadzone_pct = 0.08) {
    const sitios = [];
    const copia_score = new Float32Array(idoneidad);
    
    const mar_f = Math.floor(rows * deadzone_pct);
    const mar_c = Math.floor(cols * deadzone_pct);
    const r_sq = radio_exclusion_px * radio_exclusion_px;

    for (let rank = 1; rank <= n_sitios; rank++) {
        let max_val = -1;
        let f_max = -1;
        let c_max = -1;

        // Buscar el máximo respetando los márgenes y pendiente máxima
        for (let r = mar_f; r < rows - mar_f; r++) {
            for (let c = mar_c; c < cols - mar_c; c++) {
                const idx = r * cols + c;
                if (pendientes[idx] <= max_pend && copia_score[idx] > max_val) {
                    max_val = copia_score[idx];
                    f_max = r;
                    c_max = c;
                }
            }
        }

        if (max_val <= 0) break;

        sitios.push({
            rank,
            fila: f_max,
            col: c_max,
            score: Math.round(max_val * 10) / 10,
            pendiente: Math.round(pendientes[f_max * cols + c_max] * 10) / 10,
            altura: Math.round(dem[f_max * cols + c_max])
        });

        // Supresión de no máximos (Borrar vecindad)[cite: 4]
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const dist_sq = (r - f_max) * (r - f_max) + (c - c_max) * (c - c_max);
                if (dist_sq <= r_sq) {
                    copia_score[r * cols + c] = -1.0;
                }
            }
        }
    }
    return sitios;
}