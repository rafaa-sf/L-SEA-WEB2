// ==============================================================================
// src/core/geo.js
// GEOMETRÍA DEL MAPA: píxel <-> latitud/longitud lunar, orientación y curvatura
// ==============================================================================
//
// El DEM (LDEM_80S, proyección estereográfica polar sur, 0° de longitud "hacia
// arriba" de la imagen y 90°E hacia la derecha) se lee tal cual del fichero:
// la fila 0 es el borde SUPERIOR de la imagen.
//
// CONVENCIÓN DE AZIMUT DEL MAPA: 0° = arriba de la imagen, 90° = derecha.
// "Arriba" corresponde a filas DECRECIENTES. ROW_DIR = -1 lo deja explícito.
// ==============================================================================

export const R_LUNA = 1737400.0;     // m, radio de referencia de LOLA
export const ROW_DIR = -1;           // dirección en filas de "azimut 0 / arriba"
export const DEG2RAD = Math.PI / 180.0;
export const RAD2DEG = 180.0 / Math.PI;

/** Píxel (fila, col) -> lat/lon lunar y rumbo (giro del mapa respecto al norte local). */
export function pixelToGeo(fila, col, rows, cols, mpc) {
    const x = (col - cols / 2) * mpc;                  // derecha (Este en lon 90°)
    const y = ROW_DIR * (fila - rows / 2) * mpc;       // arriba
    const rho = Math.hypot(x, y);
    const lat = -90.0 + 2.0 * Math.atan(rho / (2.0 * R_LUNA)) * RAD2DEG;
    let lon = rho < 1.0 ? 0.0 : Math.atan2(x, y) * RAD2DEG;
    lon = ((lon % 360) + 360) % 360;
    // azimut_mapa = azimut_local - rumbo ; en el polo sur rumbo = -lon
    return { lat, lon, rumbo: -lon, rho };
}

/** lat/lon lunar -> píxel (fila, col) fraccionario. */
export function geoToPixel(lat, lon, rows, cols, mpc) {
    const rho = 2.0 * R_LUNA * Math.tan((lat + 90.0) * DEG2RAD / 2.0);
    const x = rho * Math.sin(lon * DEG2RAD);
    const y = rho * Math.cos(lon * DEG2RAD);
    return { fila: rows / 2 + ROW_DIR * y / mpc, col: cols / 2 + x / mpc };
}

/** Caída de la superficie por curvatura lunar a una distancia d (m): d²/(2R). */
export function caidaCurvatura(distM) {
    return (distM * distM) / (2.0 * R_LUNA);
}

/** Paso en (fila, col) por celda para un azimut de mapa (grados). */
export function pasoAzimut(azGrados) {
    const a = azGrados * DEG2RAD;
    return { dr: ROW_DIR * Math.cos(a), dc: Math.sin(a) };
}
