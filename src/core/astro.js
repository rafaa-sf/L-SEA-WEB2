// ==============================================================================
// RUTA DEL FICHERO: src/core/astro.js
// NÚCLEO FÍSICO Y ASTRODINÁMICO L-SEA (Basado en Meeus)
// ==============================================================================

export const RADIO_SOL = 0.267; 
export const CONSTANTE_SOLAR = 1361.0; 
const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;

// =========================================================== ÁLGEBRA LINEAL
export function multiplyMatrixVector(m, v) {
    return [
        m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
        m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
        m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]
    ];
}

export function multiplyMatrices(a, b) {
    let result = [[0,0,0], [0,0,0], [0,0,0]];
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

// =========================================================== TIEMPO JULIANO
export function dateToJulianEphemeris(dateObj) {
    const timeMs = dateObj.getTime();
    return (timeMs / 86400000.0) + 2440587.5;
}

// =========================================================== ASTRODINÁMICA LUNAR Y MEEUS
export function matriz_icrf_a_luna(d) {
    const T = d / 36525.0; 
    
    // Serie E 
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

    const m1 = R3(W);
    const m2 = R1(Math.PI / 2 - dec);
    const m3 = R3(ra + Math.PI / 2);
    
    return multiplyMatrices(multiplyMatrices(m1, m2), m3);
}

export function base_local(lat, lon) {
    const la = lat * DEG2RAD;
    const lo = lon * DEG2RAD;
    
    const este = [-Math.sin(lo), Math.cos(lo), 0.0]; 
    const norte = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)]; 
    const arriba = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]; 
    
    return { este, norte, arriba };
}

// =========================================================== VECTORES PLANETARIOS (Meeus ELP-2000/82 truncado)
function getEclipticToEquatorial(T) {
    // Oblicuidad media de la eclíptica (IAU)
    const eps = (23.43929111 - 0.013004167 * T - 0.00000016389 * T*T + 0.0000005036 * T*T*T) * DEG2RAD;
    return R1(-eps); 
}

function vectorTierraLunaMeeus(T) {
    // Meeus (Astronomical Algorithms, Ch 47). Precisión de arco-segundos.
    const Lprime = (218.3164477 + 481267.88123421 * T) * DEG2RAD; // Longitud media
    const D = (297.8501921 + 445267.1114034 * T) * DEG2RAD; // Elongación media
    const M = (357.5291092 + 35999.0502909 * T) * DEG2RAD; // Anomalía media Sol
    const Mprime = (134.9633964 + 477198.8675055 * T) * DEG2RAD; // Anomalía media Luna
    const F = (93.2720950 + 483202.0175233 * T) * DEG2RAD; // Argumento latitud

    // Términos principales de longitud (sigma L)
    const sl = 6288774 * Math.sin(Mprime) +
               1274027 * Math.sin(2 * D - Mprime) +
               658314 * Math.sin(2 * D) +
               213618 * Math.sin(2 * Mprime) -
               185116 * Math.sin(M) -
               114332 * Math.sin(2 * F);
               
    // Términos principales de latitud (sigma B)
    const sb = 5128122 * Math.sin(F) +
               280602 * Math.sin(Mprime + F) +
               277693 * Math.sin(Mprime - F) +
               173237 * Math.sin(2 * D - F) +
               55413 * Math.sin(2 * D - Mprime + F);

    // Distancia a la Luna (sigma R) en km
    const sr = -20905355 * Math.cos(Mprime) -
               3699111 * Math.cos(2 * D - Mprime) -
               2955968 * Math.cos(2 * D) -
               569925 * Math.cos(2 * Mprime);
               
    const l = Lprime + (sl / 1000000.0) * DEG2RAD; // Longitud geocéntrica eclíptica
    const b = (sb / 1000000.0) * DEG2RAD; // Latitud geocéntrica eclíptica
    const r = 385000.56 + (sr / 1000.0); // Distancia en km

    // Convertir de esféricas a cartesianas (eclípticas)
    const x_ecl = r * Math.cos(b) * Math.cos(l);
    const y_ecl = r * Math.cos(b) * Math.sin(l);
    const z_ecl = r * Math.sin(b);

    // Rotar al ecuador J2000 (ICRF aproximado)
    const rotEclToEq = getEclipticToEquatorial(T);
    return multiplyMatrixVector(rotEclToEq, [x_ecl, y_ecl, z_ecl]);
}

function vectorTierraSolMeeus(T) {
    // Meeus (Astronomical Algorithms, Ch 25).
    const L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T*T) * DEG2RAD;
    const M = (357.52911 + 35999.05029 * T - 0.0001537 * T*T) * DEG2RAD;
    const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T*T;

    // Ecuación del centro
    const C = (1.914602 - 0.004817 * T - 0.000014 * T*T) * Math.sin(M) +
              (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
              0.000289 * Math.sin(3 * M);
              
    const trueLon = L0 + C * DEG2RAD;
    
    // Distancia al Sol (UA)
    const v = M + C * DEG2RAD;
    const R_ua = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(v));
    const R_km = R_ua * 149597870.7; // UA a km

    // Cartesianas Eclípticas (Latitud solar geocéntrica ≈ 0)
    const x_ecl = R_km * Math.cos(trueLon);
    const y_ecl = R_km * Math.sin(trueLon);
    const z_ecl = 0;

    const rotEclToEq = getEclipticToEquatorial(T);
    return multiplyMatrixVector(rotEclToEq, [x_ecl, y_ecl, z_ecl]);
}

export function calcularEfemeridesMeeus(fechaObj, lat, lon, rumbo = 0.0) {
    const jd = dateToJulianEphemeris(fechaObj);
    const d = jd - 2451545.0; // Días desde J2000
    const T = d / 36525.0; // Siglos Julianos

    const R = matriz_icrf_a_luna(d);
    const { este, norte, arriba } = base_local(lat, lon);

    const vTierraLuna_ICRF = vectorTierraLunaMeeus(T);
    const vTierraSol_ICRF = vectorTierraSolMeeus(T);

    // Vector Luna -> Tierra (inverso)
    const vLunaTierra_ICRF = vTierraLuna_ICRF.map(x => -x);
    
    // Vector Luna -> Sol (Tierra->Sol - Tierra->Luna)
    const vLunaSol_ICRF = [
        vTierraSol_ICRF[0] - vTierraLuna_ICRF[0],
        vTierraSol_ICRF[1] - vTierraLuna_ICRF[1],
        vTierraSol_ICRF[2] - vTierraLuna_ICRF[2]
    ];

    function calcularAzEl(v_icrf) {
        const v_lunar = multiplyMatrixVector(R, v_icrf);
        
        const v_este = v_lunar[0]*este[0] + v_lunar[1]*este[1] + v_lunar[2]*este[2];
        const v_norte = v_lunar[0]*norte[0] + v_lunar[1]*norte[1] + v_lunar[2]*norte[2];
        const v_arriba = v_lunar[0]*arriba[0] + v_lunar[1]*arriba[1] + v_lunar[2]*arriba[2];

        const norm = Math.sqrt(v_este*v_este + v_norte*v_norte + v_arriba*v_arriba);
        
        let el = Math.asin(v_arriba / norm) * RAD2DEG;
        let az = Math.atan2(v_este, v_norte) * RAD2DEG;
        
        az = (az - rumbo) % 360;
        if (az < 0) az += 360;

        return { az, el };
    }

    const sol = calcularAzEl(vLunaSol_ICRF);
    const tierra = calcularAzEl(vLunaTierra_ICRF);

    return {
        sol_az: sol.az,
        sol_el: sol.el,
        tierra_az: tierra.az,
        tierra_el: tierra.el
    };
}