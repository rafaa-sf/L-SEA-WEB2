// ==============================================================================
// RUTA DEL FICHERO: src/core/power.js
// MODELO EPS Y VISIBILIDAD DE LA LUNA DESDE LA RED DEL ESPACIO PROFUNDO (DSN)
// ==============================================================================
import { CONSTANTE_SOLAR, lunaDesdeEstacion } from './astro.js';

const DEG2RAD = Math.PI / 180.0;

// Estaciones DSN (complejos). Coordenadas aproximadas, suficientes para este cálculo.
export const DSN_ESTACIONES = {
    Madrid:    { nombre: 'Madrid (MDSCC)',    lat: 40.4272,  lon: -4.2481 },
    Goldstone: { nombre: 'Goldstone (GDSCC)', lat: 35.4267,  lon: -116.8900 },
    Canberra:  { nombre: 'Canberra (CDSCC)',  lat: -35.4014, lon: 148.9819 }
};

// SUPUESTO configurable: elevación mínima de la Luna para enlazar con una antena.
export const DSN_MIN_ELEVACION = 10.0;

/**
 * Potencia eléctrica (EPS).
 * orientacion 'vertical': panel vertical girado hacia el Sol -> factor cos(elevación).
 * orientacion 'horizontal': panel plano sobre el suelo     -> factor sin(elevación).
 * Con el Sol a ~1,4° el panel horizontal produce ~40 veces menos. SUPUESTO declarado.
 */
export function calcular_potencia_electrica(sol_visible, sol_el, area_m2 = 2.0, eficiencia = 0.29, carga_base_w = 100.0, orientacion = 'vertical') {
    if (!sol_visible || sol_el <= 0) {
        return { bruta: 0.0, neta: -carga_base_w, radiacion: 0.0, orientacion };
    }
    const factor = orientacion === 'horizontal' ? Math.sin(sol_el * DEG2RAD) : Math.cos(sol_el * DEG2RAD);
    const potencia_bruta = CONSTANTE_SOLAR * area_m2 * eficiencia * factor;
    return {
        bruta: Math.round(potencia_bruta),
        neta: Math.round(potencia_bruta - carga_base_w),
        radiacion: CONSTANTE_SOLAR,
        orientacion
    };
}

/** Elevación REAL (topocéntrica) de la Luna sobre cada estación DSN. */
export function telemetria_dsn(fechaObj) {
    const res = {};
    for (const [clave, e] of Object.entries(DSN_ESTACIONES)) {
        const m = lunaDesdeEstacion(fechaObj, e.lat, e.lon);
        res[clave] = { nombre: e.nombre, el: Math.round(m.el * 10) / 10, az: Math.round(m.az), enlace: m.el >= DSN_MIN_ELEVACION };
    }
    return res;
}

/** Estación con la Luna más alta (y sobre el mínimo), o null si ninguna. */
export function estacionActivaDSN(telemetria) {
    let mejor = null;
    for (const [clave, t] of Object.entries(telemetria)) {
        if (t.enlace && (mejor === null || t.el > telemetria[mejor].el)) mejor = clave;
    }
    return mejor;
}
