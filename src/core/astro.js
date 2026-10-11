// ==============================================================================
// RUTA DEL FICHERO: src/core/astro.js
// NÚCLEO ASTRODINÁMICO L-SEA (series truncadas de Meeus + rotación lunar IAU)
// ==============================================================================
//
// PRECISIÓN MEDIDA (octubre 2026, contra Skyfield + JPL DE421): ver
// tests/verify.mjs. Series truncadas de Meeus: errores del orden de 0,05° en
// elevación y ~0,1-0,3° en azimut. NO es "sub-arcsecond".
// ==============================================================================

export const RADIO_SOL = 0.267;          // radio angular del Sol (°)
export const CONSTANTE_SOLAR = 1361.0;   // W/m²
export const DELTA_T_S = 69.2;           // TT - UT1 (s), valor aproximado de 2026
const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;
const OBLICUIDAD_J2000 = 23.4392794 * DEG2RAD;

// =========================================================== ÁLGEBRA LINEAL
export function multiplyMatrixVector(m, v) {
    return [
        m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
        m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
        m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]
    ];
}

export function multiplyMatrices(a, b) {
    const result = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            result[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
        }
    }
    return result;
}

export function R1(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [[1, 0, 0], [0, c, s], [0, -s, c]];
}

export function R3(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [[c, s, 0], [-s, c, 0], [0, 0, 1]];
}

// =========================================================== TIEMPO
/** Fecha juliana en UTC (≈ UT1). */
export function dateToJulianEphemeris(dateObj) {
    return (dateObj.getTime() / 86400000.0) + 2440587.5;
}

// =========================================================== ROTACIÓN DE LA LUNA (IAU)
export function matriz_icrf_a_luna(d) {
    const T = d / 36525.0;

    const E = [
        125.045 - 0.0529921 * d, 250.089 - 0.1059842 * d, 260.008 + 13.0120009 * d,
        176.625 + 13.3407154 * d, 357.529 + 0.9856003 * d, 311.589 + 26.4057084 * d,
        134.963 + 13.0649930 * d, 276.617 + 0.3287146 * d, 34.226 + 1.7484877 * d,
        15.134 - 0.1589763 * d, 119.743 + 0.0036096 * d, 239.961 + 0.1643573 * d,
        25.053 + 12.9590088 * d
    ].map(val => val * DEG2RAD);

    const s = E.map(Math.sin);
    const c = E.map(Math.cos);

    let ra = 269.9949 + 0.0031 * T - 3.8787 * s[0] - 0.1204 * s[1] + 0.0700 * s[2]
           - 0.0172 * s[3] + 0.0072 * s[5] - 0.0052 * s[9] + 0.0043 * s[12];

    let dec = 66.5392 + 0.0130 * T + 1.5419 * c[0] + 0.0239 * c[1] - 0.0278 * c[2]
            + 0.0068 * c[3] - 0.0029 * c[5] + 0.0009 * c[6] + 0.0008 * c[9] - 0.0009 * c[12];

    let W = 38.3213 + 13.17635815 * d - 1.4e-12 * Math.pow(d, 2) + 3.5610 * s[0] + 0.1208 * s[1]
          - 0.0642 * s[2] + 0.0158 * s[3] + 0.0252 * s[4] - 0.0066 * s[5] - 0.0047 * s[6]
          - 0.0046 * s[7] + 0.0028 * s[8] + 0.0052 * s[9] + 0.0040 * s[10]
          + 0.019 * s[11] - 0.0044 * s[12];

    ra *= DEG2RAD;
    dec *= DEG2RAD;
    W *= DEG2RAD;

    return multiplyMatrices(multiplyMatrices(R3(W), R1(Math.PI / 2 - dec)), R3(ra + Math.PI / 2));
}

export function base_local(lat, lon) {
    const la = lat * DEG2RAD;
    const lo = lon * DEG2RAD;
    const este = [-Math.sin(lo), Math.cos(lo), 0.0];
    const norte = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
    const arriba = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
    return { este, norte, arriba };
}

// =========================================================== SOL Y LUNA (Meeus, truncado)
/** Precesión general en longitud (grados), IAU 2006, desde J2000. */
function precesionLongitud(T) {
    return (5028.796195 * T + 1.1054348 * T * T) / 3600.0;
}

/** Luna geocéntrica en la ECLÍPTICA DE LA FECHA: longitud, latitud (rad) y distancia (km). */
function lunaEclipticaFecha(T) {
    const Lprime = (218.3164477 + 481267.88123421 * T) * DEG2RAD;
    const D = (297.8501921 + 445267.1114034 * T) * DEG2RAD;
    const M = (357.5291092 + 35999.0502909 * T) * DEG2RAD;
    const Mprime = (134.9633964 + 477198.8675055 * T) * DEG2RAD;
    const F = (93.2720950 + 483202.0175233 * T) * DEG2RAD;

    // Solo los términos principales (serie TRUNCADA)
    const sl = 6288774 * Math.sin(Mprime) + 1274027 * Math.sin(2 * D - Mprime) +
               658314 * Math.sin(2 * D) + 213618 * Math.sin(2 * Mprime) -
               185116 * Math.sin(M) - 114332 * Math.sin(2 * F);
    const sb = 5128122 * Math.sin(F) + 280602 * Math.sin(Mprime + F) +
               277693 * Math.sin(Mprime - F) + 173237 * Math.sin(2 * D - F) +
               55413 * Math.sin(2 * D - Mprime + F);
    const sr = -20905355 * Math.cos(Mprime) - 3699111 * Math.cos(2 * D - Mprime) -
               2955968 * Math.cos(2 * D) - 569925 * Math.cos(2 * Mprime);

    return {
        l: Lprime + (sl / 1e6) * DEG2RAD,
        b: (sb / 1e6) * DEG2RAD,
        r: 385000.56 + sr / 1000.0
    };
}

/** Sol geocéntrico en la ECLÍPTICA DE LA FECHA: longitud verdadera (rad) y distancia (km). */
function solEclipticaFecha(T) {
    const L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) * DEG2RAD;
    const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * DEG2RAD;
    const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) +
              (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
              0.000289 * Math.sin(3 * M);
    const v = M + C * DEG2RAD;
    const R_ua = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(v));
    return { lon: L0 + C * DEG2RAD, r: R_ua * 149597870.7 };
}

function esfericasACartesianas(lon, lat, r) {
    return [r * Math.cos(lat) * Math.cos(lon), r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat)];
}

/** Vector Tierra->Luna en el ecuador MEDIO DE LA FECHA (km). Sirve para tiempo sidéreo. */
export function vectorTierraLunaEcuadorFecha(T) {
    const m = lunaEclipticaFecha(T);
    const eps = (23.43929111 - 0.013004167 * T - 0.00000016389 * T * T + 0.0000005036 * T * T * T) * DEG2RAD;
    return multiplyMatrixVector(R1(-eps), esfericasACartesianas(m.l, m.b, m.r));
}

/** Vector Tierra->Luna en el ICRF/J2000 (km): quita la precesión de la longitud. */
function vectorTierraLunaICRF(T) {
    const m = lunaEclipticaFecha(T);
    const l2000 = m.l - precesionLongitud(T) * DEG2RAD;
    return multiplyMatrixVector(R1(-OBLICUIDAD_J2000), esfericasACartesianas(l2000, m.b, m.r));
}

/** Vector Tierra->Sol en el ICRF/J2000 (km). */
function vectorTierraSolICRF(T) {
    const s = solEclipticaFecha(T);
    const l2000 = s.lon - precesionLongitud(T) * DEG2RAD;
    return multiplyMatrixVector(R1(-OBLICUIDAD_J2000), esfericasACartesianas(l2000, 0.0, s.r));
}

// =========================================================== DIRECCIONES Y AZ/EL LOCALES
/**
 * Direcciones del Sol y de la Tierra en el sistema fijo a la Luna (vectores en km).
 * Se calcula UNA vez por fecha; luego cada punto del mapa solo proyecta (barato).
 */
export function direccionesLunar(fechaObj) {
    const jd = dateToJulianEphemeris(fechaObj);
    const dTT = (jd - 2451545.0) + DELTA_T_S / 86400.0;
    const T = dTT / 36525.0;

    const R = matriz_icrf_a_luna(dTT);
    const tierraLuna = vectorTierraLunaICRF(T);
    const tierraSol = vectorTierraSolICRF(T);

    const lunaTierra = tierraLuna.map(x => -x);
    const lunaSol = [tierraSol[0] - tierraLuna[0], tierraSol[1] - tierraLuna[1], tierraSol[2] - tierraLuna[2]];

    return { sol: multiplyMatrixVector(R, lunaSol), tierra: multiplyMatrixVector(R, lunaTierra) };
}

/** Azimut/elevación (°) de un vector lunar visto desde un punto con base local dada. */
export function azElLocal(vLunar, base, rumbo = 0.0) {
    const { este, norte, arriba } = base;
    const vE = vLunar[0] * este[0] + vLunar[1] * este[1] + vLunar[2] * este[2];
    const vN = vLunar[0] * norte[0] + vLunar[1] * norte[1] + vLunar[2] * norte[2];
    const vU = vLunar[0] * arriba[0] + vLunar[1] * arriba[1] + vLunar[2] * arriba[2];
    const norm = Math.sqrt(vE * vE + vN * vN + vU * vU);

    const el = Math.asin(vU / norm) * RAD2DEG;
    let az = (Math.atan2(vE, vN) * RAD2DEG - rumbo) % 360;
    if (az < 0) az += 360;
    return { az, el };
}

export function calcularEfemeridesMeeus(fechaObj, lat, lon, rumbo = 0.0) {
    const dir = direccionesLunar(fechaObj);
    const base = base_local(lat, lon);
    const sol = azElLocal(dir.sol, base, rumbo);
    const tierra = azElLocal(dir.tierra, base, rumbo);
    return { sol_az: sol.az, sol_el: sol.el, tierra_az: tierra.az, tierra_el: tierra.el };
}

// =========================================================== LUNA DESDE UNA ESTACIÓN DE LA TIERRA
const WGS84_A = 6378.137;                 // km
const WGS84_E2 = 0.00669437999014;

/** Tiempo sidéreo medio de Greenwich (grados), Meeus cap. 12. */
export function gmstGrados(jdUT) {
    const T = (jdUT - 2451545.0) / 36525.0;
    const th = 280.46061837 + 360.98564736629 * (jdUT - 2451545.0) +
               0.000387933 * T * T - (T * T * T) / 38710000.0;
    return ((th % 360) + 360) % 360;
}

/**
 * Elevación y azimut TOPOCÉNTRICOS de la Luna desde (lat, lon) en la Tierra (°).
 * Incluye paralaje (~1° en la Luna) y elipsoide WGS84. Sin refracción.
 */
export function lunaDesdeEstacion(fechaObj, latDeg, lonEsteDeg) {
    const jd = dateToJulianEphemeris(fechaObj);
    const T = ((jd - 2451545.0) + DELTA_T_S / 86400.0) / 36525.0;
    const vLuna = vectorTierraLunaEcuadorFecha(T);

    const phi = latDeg * DEG2RAD;
    const theta = (gmstGrados(jd) + lonEsteDeg) * DEG2RAD;
    const sphi = Math.sin(phi), cphi = Math.cos(phi);
    const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sphi * sphi);

    const rEst = [N * cphi * Math.cos(theta), N * cphi * Math.sin(theta), N * (1 - WGS84_E2) * sphi];
    const topo = [vLuna[0] - rEst[0], vLuna[1] - rEst[1], vLuna[2] - rEst[2]];

    const arriba = [cphi * Math.cos(theta), cphi * Math.sin(theta), sphi];
    const este = [-Math.sin(theta), Math.cos(theta), 0.0];
    const norte = [-sphi * Math.cos(theta), -sphi * Math.sin(theta), cphi];

    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const norm = Math.sqrt(dot(topo, topo));
    const el = Math.asin(dot(topo, arriba) / norm) * RAD2DEG;
    let az = Math.atan2(dot(topo, este), dot(topo, norte)) * RAD2DEG;
    if (az < 0) az += 360;
    return { el, az };
}
