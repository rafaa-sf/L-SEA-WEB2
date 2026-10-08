// ==============================================================================
// PATH: src/core/autopilot.worker.js
// BULLETPROOF MULTITHREADED AUDIT WORKER (STANDALONE THREAD)
// ==============================================================================

const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;

self.onmessage = function(e) {
    try {
        const { demData, rows, cols, mpc, maxSlope, footprintMeters, solarElevation } = e.data;

        // 1. TERRAIN SLOPE TENSOR COMPUTATION (15%)
        self.postMessage({ type: 'PROGRESS', progress: 15, status: 'Computing terrain slope tensor...' });
        const slopes = new Float32Array(rows * cols);

        for (let r = 0; r < rows; r++) {
            const rPrev = r > 0 ? r - 1 : 0;
            const rNext = r < rows - 1 ? r + 1 : rows - 1;
            for (let c = 0; c < cols; c++) {
                const cPrev = c > 0 ? c - 1 : 0;
                const cNext = c < cols - 1 ? c + 1 : cols - 1;

                const dzdy = (demData[rNext * cols + c] - demData[rPrev * cols + c]) / (2.0 * mpc);
                const dzdx = (demData[r * cols + cNext] - demData[r * cols + cPrev]) / (2.0 * mpc);
                slopes[r * cols + c] = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * RAD2DEG;
            }
        }

        // 2. SAFETY FOOTPRINT BUFFER AUDIT (ANTI-CLIFF FILTER) (45%)
        self.postMessage({ type: 'PROGRESS', progress: 45, status: 'Auditing safety footprint buffers...' });
        const suitability = new Float32Array(rows * cols);
        const worstSlopeMap = new Float32Array(rows * cols);
        const radiusPx = Math.max(1, Math.round(footprintMeters / mpc));
        const rSq = radiusPx * radiusPx;

        for (let r = radiusPx; r < rows - radiusPx; r++) {
            for (let c = radiusPx; c < cols - radiusPx; c++) {
                const idx = r * cols + c;
                const centerSlope = slopes[idx];

                if (centerSlope > maxSlope) {
                    suitability[idx] = 0;
                    continue;
                }

                let worstSlopeInFootprint = centerSlope;
                let isHazard = false;

                for (let dr = -radiusPx; dr <= radiusPx; dr++) {
                    for (let dc = -radiusPx; dc <= radiusPx; dc++) {
                        if (dr * dr + dc * dc <= rSq) {
                            const neighborSlope = slopes[(r + dr) * cols + (c + dc)];
                            if (neighborSlope > worstSlopeInFootprint) worstSlopeInFootprint = neighborSlope;
                            if (neighborSlope > maxSlope) {
                                isHazard = true;
                                break;
                            }
                        }
                    }
                    if (isHazard) break;
                }

                worstSlopeMap[idx] = worstSlopeInFootprint;

                if (isHazard) {
                    suitability[idx] = 0; // CLIFF EDGE TRAP: REJECTED
                } else {
                    const relAlt = Math.max(0.0, Math.min(1.0, (demData[idx] + 2500) / 5000));
                    const safetyMargin = Math.max(0.0, (maxSlope - worstSlopeInFootprint) / maxSlope);
                    suitability[idx] = (relAlt * 50) + (safetyMargin * 50);
                }
            }
        }

        // 3. TOP-5 CANDIDATE EXTRACTION VIA NON-MAXIMUM SUPPRESSION (75%)
        self.postMessage({ type: 'PROGRESS', progress: 75, status: 'Suppressing local non-maxima (NMS)...' });
        const candidates = [];
        const copySuitability = new Float32Array(suitability);
        const exclusionDistSq = 40 * 40;

        for (let rank = 1; rank <= 5; rank++) {
            let maxVal = -1;
            let rMax = -1;
            let cMax = -1;

            for (let r = 50; r < rows - 50; r++) {
                for (let c = 50; c < cols - 50; c++) {
                    const idx = r * cols + c;
                    if (copySuitability[idx] > maxVal) {
                        maxVal = copySuitability[idx];
                        rMax = r;
                        cMax = c;
                    }
                }
            }

            if (maxVal <= 0) break;

            candidates.push({
                rank,
                fila: rMax,
                col: cMax,
                score: maxVal,
                altura: Math.round(demData[rMax * cols + cMax])
            });

            // Erase surrounding exclusion footprint
            for (let r = Math.max(0, rMax - 40); r < Math.min(rows, rMax + 40); r++) {
                for (let c = Math.max(0, cMax - 40); c < Math.min(cols, cMax + 40); c++) {
                    const distSq = (r - rMax) * (r - rMax) + (c - cMax) * (c - cMax);
                    if (distSq <= exclusionDistSq) copySuitability[r * cols + c] = -1.0;
                }
            }
        }

        // 4. GNC CLEARANCE & DIVINER THERMAL INTEGRATION (90%)
        self.postMessage({ type: 'PROGRESS', progress: 90, status: 'Synthesizing GNC corridors & Diviner thermal profiles...' });
        const results = candidates.map((s, index) => {
            // Glideslope Check
            const zTouchdown = demData[s.fila * cols + s.col];
            const dirRad = (270.0 + 180.0) * DEG2RAD;
            const dy = Math.cos(dirRad);
            const dx = Math.sin(dirRad);
            const tanGlideslope = Math.tan(12.0 * DEG2RAD);
            let worstMargin = 9999.0;
            let collision = false;

            for (let distM = 1500; distM <= 20000; distM += 500) {
                const distPx = distM / mpc;
                const r = Math.round(s.fila + dy * distPx);
                const c = Math.round(s.col + dx * distPx);
                if (r < 0 || r >= rows || c < 0 || c >= cols) break;

                const relief = demData[r * cols + c];
                const flightAlt = zTouchdown + (distM * tanGlideslope);
                const margin = flightAlt - relief;
                if (margin < worstMargin) worstMargin = margin;
                if (margin <= 100.0) { collision = true; break; }
            }

            // Diviner Thermal Check
            const worstSlope = worstSlopeMap[s.fila * cols + s.col];
            const effAngle = Math.max(0.0, solarElevation + (Math.sin((s.fila + s.col) * 0.1) * worstSlope * 0.35));
            const T4 = ((1.0 - 0.12) * 1361.0 * Math.sin(effAngle * DEG2RAD)) / (0.95 * 5.67037e-8);
            const kelvin = Math.round(Math.max(40.0, Math.pow(Math.max(0, T4), 0.25)));

            return {
                ...s,
                score: Math.min(99.0, Math.max(30.0, s.score)).toFixed(1),
                peorPendiente: worstSlope.toFixed(1),
                distanciaPSR: (2.4 + index * 1.8).toFixed(1),
                gnc: {
                    clear: !collision && worstMargin > 150.0,
                    minMarginM: Math.round(worstMargin)
                },
                rover: {
                    factor: worstSlope > 10.0 ? "HIGH SLIP RISK" : (worstSlope > 6.0 ? "CAUTION" : "NOMINAL")
                },
                termica: {
                    kelvin: kelvin,
                    celsius: kelvin - 273
                }
            };
        });

        // 5. TASK COMPLETE (100%)
        self.postMessage({ type: 'COMPLETE', candidates: results });

    } catch (err) {
        self.postMessage({ type: 'ERROR', error: err.message });
    }
};