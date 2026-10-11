// ==============================================================================
// PATH: src/core/illumination.js
// FRACCIÓN DE ILUMINACIÓN DEL MES (mapa grueso, cálculo REAL con sombras)
// ==============================================================================
// Para cada celda gruesa y cada día se calcula la elevación/azimut del Sol EN ESE
// PUNTO (no un valor único para todo el mapa), y se traza un rayo hacia el Sol
// contra el relieve, con curvatura lunar.
//
// Aproximaciones declaradas:
//  - 1 muestra al día (misma hora UTC).  - Resolución gruesa: paso × mpc (p. ej. 1,28 km).
//  - Los obstáculos usan el MÁXIMO de cada bloque (conservador: favorece sombra).
//  - El Sol se trata como disco: asoma el borde superior.
// ==============================================================================
import { pixelToGeo, ROW_DIR, caidaCurvatura } from './geo.js';
import { direccionesLunar, base_local, RADIO_SOL } from './astro.js';

const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;

export function iluminacionMensual(dem, rows, cols, mpc, fechaInicio, dias = 30, paso = 8, hora = 12, onProgress = null) {
    const nr = Math.floor(rows / paso), nc = Math.floor(cols / paso);
    const zObs = new Float32Array(nr * nc);   // altura de la celda (valor central)
    const zMax = new Float32Array(nr * nc);   // máximo del bloque (obstáculo)
    const base = new Array(nr * nc);
    const lonCell = new Float32Array(nr * nc);

    for (let i = 0; i < nr; i++) {
        for (let j = 0; j < nc; j++) {
            let mx = -1e9;
            for (let a = 0; a < paso; a++) {
                const rowBase = (i * paso + a) * cols + j * paso;
                for (let b = 0; b < paso; b++) { const v = dem[rowBase + b]; if (v > mx) mx = v; }
            }
            const fc = i * paso + paso / 2, cc = j * paso + paso / 2;
            const k = i * nc + j;
            zMax[k] = mx;
            zObs[k] = dem[Math.min(rows - 1, Math.round(fc)) * cols + Math.min(cols - 1, Math.round(cc))] + 2.0;
            const g = pixelToGeo(fc, cc, rows, cols, mpc);
            base[k] = base_local(g.lat, g.lon);
            lonCell[k] = g.lon;
        }
    }

    const lit = new Float32Array(nr * nc);
    const pasoM = paso * mpc;

    for (let d = 0; d < dias; d++) {
        const f = new Date(fechaInicio.getTime() + d * 86400000);
        f.setUTCHours(hora, 0, 0, 0);
        const sol = direccionesLunar(f).sol;
        const n = Math.hypot(sol[0], sol[1], sol[2]);

        for (let i = 0; i < nr; i++) {
            for (let j = 0; j < nc; j++) {
                const k = i * nc + j;
                const { este, norte, arriba } = base[k];
                const vE = sol[0] * este[0] + sol[1] * este[1] + sol[2] * este[2];
                const vN = sol[0] * norte[0] + sol[1] * norte[1] + sol[2] * norte[2];
                const vU = sol[0] * arriba[0] + sol[1] * arriba[1] + sol[2] * arriba[2];
                const el = Math.asin(vU / n) * RAD2DEG;
                if (el + RADIO_SOL <= 0) continue;                         // Sol bajo el horizonte local

                const azMapa = (Math.atan2(vE, vN) * RAD2DEG + lonCell[k]) * DEG2RAD;   // az_local - rumbo
                const dr = ROW_DIR * Math.cos(azMapa), dc = Math.sin(azMapa);
                const tanEl = Math.tan((el + RADIO_SOL) * DEG2RAD);
                const z0 = zObs[k];

                let sombra = false;
                for (let s = 1; ; s++) {
                    const ii = Math.round(i + dr * s), jj = Math.round(j + dc * s);
                    if (ii < 0 || ii >= nr || jj < 0 || jj >= nc) break;
                    const dist = s * pasoM;
                    if ((zMax[ii * nc + jj] - caidaCurvatura(dist) - z0) > tanEl * dist) { sombra = true; break; }
                }
                if (!sombra) lit[k] += 1;
            }
        }
        if (onProgress) onProgress((d + 1) / dias);
    }

    for (let k = 0; k < lit.length; k++) lit[k] /= dias;
    return { data: lit, nr, nc, paso, dias };
}
