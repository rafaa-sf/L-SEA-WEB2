// ==============================================================================
// PATH: src/core/autopilot.worker.js
// HILO DE CÁLCULO: auditoría de seguridad (pendiente + huella) y mapa de iluminación
// ==============================================================================
import { iluminacionMensual } from './illumination.js';
import { evaluateGlideslopeCorridor } from './nasa_suite.js';

const RAD2DEG = 180.0 / Math.PI;
const POOL = 15;          // candidatos que se devuelven para refinar en el hilo principal

self.onmessage = function (e) {
    try {
        const m = e.data;
        if (m.task === 'ILLUMINATION') runIllumination(m);
        else runAudit(m);
    } catch (err) {
        self.postMessage({ type: 'ERROR', error: err.message });
    }
};

function runIllumination({ demData, rows, cols, mpc, fechaISO, dias, paso, hora }) {
    self.postMessage({ type: 'PROGRESS', progress: 5, status: 'Computing 30-day Sun fraction (coarse grid)...' });
    const res = iluminacionMensual(demData, rows, cols, mpc, new Date(fechaISO + 'T00:00:00Z'), dias, paso, hora,
        (f) => self.postMessage({ type: 'PROGRESS', progress: 5 + Math.round(f * 90), status: 'Computing 30-day Sun fraction (coarse grid)...' }));
    self.postMessage({ type: 'ILLUM_COMPLETE', illum: res.data, nr: res.nr, nc: res.nc, paso: res.paso, dias: res.dias });
}

function runAudit({ demData, rows, cols, mpc, maxSlope, footprintMeters, illum, illumNr, illumNc, illumPaso }) {
    // 1. Pendiente
    self.postMessage({ type: 'PROGRESS', progress: 15, status: 'Computing terrain slope...' });
    const slopes = new Float32Array(rows * cols);
    for (let r = 0; r < rows; r++) {
        const rp = r > 0 ? r - 1 : 0, rn = r < rows - 1 ? r + 1 : rows - 1;
        for (let c = 0; c < cols; c++) {
            const cp = c > 0 ? c - 1 : 0, cn = c < cols - 1 ? c + 1 : cols - 1;
            const dzdy = (demData[rn * cols + c] - demData[rp * cols + c]) / ((rn - rp) * mpc);
            const dzdx = (demData[r * cols + cn] - demData[r * cols + cp]) / ((cn - cp) * mpc);
            slopes[r * cols + c] = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * RAD2DEG;
        }
    }

    // 2. Huella de seguridad (antiacantilado) + idoneidad = 60 % seguridad + 40 % luz del mes
    self.postMessage({ type: 'PROGRESS', progress: 40, status: 'Auditing safety footprint...' });
    const idon = new Float32Array(rows * cols);
    const worst = new Float32Array(rows * cols);
    const safetyMap = new Float32Array(rows * cols);
    const radiusPx = Math.max(1, Math.round(footprintMeters / mpc));
    const rSq = radiusPx * radiusPx;
    const margenF = Math.floor(rows * 0.08), margenC = Math.floor(cols * 0.08);   // zona muerta del 8 %

    for (let r = Math.max(radiusPx, margenF); r < rows - Math.max(radiusPx, margenF); r++) {
        for (let c = Math.max(radiusPx, margenC); c < cols - Math.max(radiusPx, margenC); c++) {
            const idx = r * cols + c;
            if (slopes[idx] > maxSlope) continue;

            let worstSlope = slopes[idx], hazard = false;
            for (let dr = -radiusPx; dr <= radiusPx && !hazard; dr++) {
                for (let dc = -radiusPx; dc <= radiusPx; dc++) {
                    if (dr * dr + dc * dc <= rSq) {
                        const s = slopes[(r + dr) * cols + (c + dc)];
                        if (s > worstSlope) worstSlope = s;
                        if (s > maxSlope) { hazard = true; break; }
                    }
                }
            }
            if (hazard) continue;

            worst[idx] = worstSlope;
            const S = Math.pow(Math.max(0, 1 - worstSlope / maxSlope), 2);
            let L = 0.0;
            if (illum) {
                const ii = Math.min(illumNr - 1, Math.floor(r / illumPaso));
                const jj = Math.min(illumNc - 1, Math.floor(c / illumPaso));
                L = illum[ii * illumNc + jj];
            }
            safetyMap[idx] = S;
            idon[idx] = 100 * (0.6 * S + 0.4 * L);
        }
    }

    // 3. Top-N por supresión de no máximos
    self.postMessage({ type: 'PROGRESS', progress: 75, status: 'Non-maximum suppression...' });
    const copia = new Float32Array(idon);
    const excl = 40, exclSq = excl * excl;
    const candidatos = [];
    for (let rank = 1; rank <= POOL; rank++) {
        let best = 0, rb = -1, cb = -1;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const v = copia[r * cols + c];
                if (v > best) { best = v; rb = r; cb = c; }
            }
        }
        if (rb < 0) break;
        candidatos.push({ fila: rb, col: cb, scoreAprox: best, safety: safetyMap[rb * cols + cb],
                          altura: Math.round(demData[rb * cols + cb]), peorPendiente: worst[rb * cols + cb] });
        for (let r = Math.max(0, rb - excl); r < Math.min(rows, rb + excl); r++) {
            for (let c = Math.max(0, cb - excl); c < Math.min(cols, cb + excl); c++) {
                if ((r - rb) * (r - rb) + (c - cb) * (c - cb) <= exclSq) copia[r * cols + c] = 0;
            }
        }
    }

    // 4. Corredor de descenso (solo terreno)
    self.postMessage({ type: 'PROGRESS', progress: 90, status: 'Glideslope corridor audit...' });
    for (const s of candidatos) s.gnc = evaluateGlideslopeCorridor(demData, rows, cols, mpc, s.fila, s.col);

    self.postMessage({ type: 'COMPLETE', candidates: candidatos });
}
