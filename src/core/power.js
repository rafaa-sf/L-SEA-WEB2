// ==============================================================================
// RUTA DEL FICHERO: src/core/power.js
// MODELO EPS Y RED DEL ESPACIO PROFUNDO (DSN)
// ==============================================================================

import { CONSTANTE_SOLAR } from './astro.js';

const DSN_ESTACIONES = {
    "Madrid (CDSCC)": { lat: 40.427, lon: -4.249 }, //
    "Goldstone (GDSCC)": { lat: 35.426, lon: -116.890 }, //[cite: 4]
    "Canberra (CDSCC)": { lat: -35.401, lon: 148.981 } //[cite: 4]
};

const DEG2RAD = Math.PI / 180.0;

/**
 * Modelo de Potencia Eléctrica (EPS)[cite: 4]
 */
export function calcular_potencia_electrica(sol_visible, sol_el, area_m2 = 2.0, eficiencia = 0.29, carga_base_w = 100.0) {
    if (!sol_visible || sol_el <= 0) {
        return { bruta: 0.0, neta: -carga_base_w, radiacion: 0.0 };
    }
    
    const angulo_incidencia = Math.cos(sol_el * DEG2RAD);
    const potencia_bruta = CONSTANTE_SOLAR * area_m2 * eficiencia * angulo_incidencia;
    const potencia_neta = potencia_bruta - carga_base_w;
    
    return {
        bruta: Math.round(potencia_bruta),
        neta: Math.round(potencia_neta),
        radiacion: CONSTANTE_SOLAR
    };
}

/**
 * Calcula la elevación aproximada de la Luna sobre cada estación DSN
 * (Versión ligera para JavaScript sin cargar kernels SPICE pesados)
 */
export function telemetria_dsn(fechaObj, declinacionLuna, GHA_Luna) {
    const resultado = {};
    const dec = declinacionLuna * DEG2RAD;

    for (const [nombre, coords] of Object.entries(DSN_ESTACIONES)) {
        const lat = coords.lat * DEG2RAD;
        // Ángulo horario local (LHA)
        const lha = (GHA_Luna + coords.lon) * DEG2RAD;
        
        // Ecuación de elevación topocéntrica simplificada
        const sin_alt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(lha);
        const alt = Math.asin(sin_alt) * (180.0 / Math.PI);
        
        resultado[nombre] = Math.round(alt * 10) / 10;
    }
    return resultado;
}