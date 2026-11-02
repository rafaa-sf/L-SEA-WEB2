// ==============================================================================
// PATH: src/core/dispersion.js
// LANDING DISPERSION: scores the survival of the contact ellipse, not the centre
// cell. A narrow 95 peak can be a worse bet than a wide 80 plateau, because the
// vehicle risks the whole ellipse and not the point.
// ==============================================================================

// Nominal contact ellipse (3 sigma, illustrative). The semi-major axis runs along
// the approach direction (azimuth 270 deg, due west); the semi-minor is cross-range.
export const LANDING_ELLIPSE = Object.freeze({
    semiMajorM: 240,
    semiMinorM: 120,
    azimuthDeg: 270
});

// Sampling: centre plus three rings. Twelve azimuths per ring give 37 contact
// points, which at 160 m per cell cover the ellipse without gaps wider than a cell.
const RING_SCALES = [0.55, 0.8, 1.0];
const RING_AZIMUTHS = 12;
const DEG2RAD = Math.PI / 180;

// Contact points of the ellipse in fractional cell coordinates.
// azimuth 0 = north (decreasing rows), 90 = east (increasing columns).
export function sampleEllipse(fila, col, mpc, ellipse = LANDING_ELLIPSE) {
    const az = ellipse.azimuthDeg * DEG2RAD;
    const drMajor = -Math.cos(az), dcMajor = Math.sin(az);  // semi-major axis
    const drMinor = Math.sin(az), dcMinor = Math.cos(az);   // semi-minor axis
    const samples = [{ fila, col }];
    for (const scale of RING_SCALES) {
        for (let k = 0; k < RING_AZIMUTHS; k++) {
            const t = (k / RING_AZIMUTHS) * 2 * Math.PI;
            const a = ellipse.semiMajorM * scale * Math.cos(t);
            const b = ellipse.semiMinorM * scale * Math.sin(t);
            samples.push({
                fila: fila + (a * drMajor + b * drMinor) / mpc,
                col: col + (a * dcMajor + b * dcMinor) / mpc
            });
        }
    }
    return samples;
}

// Continuous ellipse outline for the 3D view. Same parameterisation as the
// sampling, with enough angular resolution that the ring does not look polygonal
// when the camera moves in.
export function ellipseOutline(fila, col, mpc, ellipse = LANDING_ELLIPSE, count = 48) {
    const az = ellipse.azimuthDeg * DEG2RAD;
    const drMajor = -Math.cos(az), dcMajor = Math.sin(az);
    const drMinor = Math.sin(az), dcMinor = Math.cos(az);
    const outline = [];
    for (let k = 0; k < count; k++) {
        const t = (k / count) * 2 * Math.PI;
        const a = ellipse.semiMajorM * Math.cos(t);
        const b = ellipse.semiMinorM * Math.sin(t);
        outline.push({
            fila: fila + (a * drMajor + b * drMinor) / mpc,
            col: col + (a * dcMajor + b * dcMinor) / mpc
        });
    }
    return outline;
}

// Survival of the ellipse: the mean of the same 60/40 criterion the Autopilot
// applies to a single cell, evaluated at every contact point.
//   slopeAt(fila, col) -> local slope in degrees
//   illumAt(fila, col) -> solar fraction 0..1 (optional; missing counts as 0)
export function scoreDispersion({ fila, col, mpc, maxSlope, ellipse = LANDING_ELLIPSE, slopeAt, illumAt }) {
    if (!(maxSlope > 0) || !Number.isFinite(fila) || !Number.isFinite(col)) return null;

    const samples = sampleEllipse(fila, col, mpc, ellipse);
    const cache = new Map();
    let total = 0, viable = 0, worst = 0;

    for (const sample of samples) {
        const r = Math.round(sample.fila), c = Math.round(sample.col);
        const key = r * 100000 + c;
        let s = cache.get(key);
        if (s === undefined) {
            s = slopeAt(r, c);
            if (!Number.isFinite(s)) s = maxSlope * 10;   // outside the DEM: not safe ground
            cache.set(key, s);
        }
        if (s > worst) worst = s;
        if (s <= maxSlope) viable++;
        const safe = s <= maxSlope ? Math.pow(1 - s / maxSlope, 2) : 0;
        const light = illumAt ? Math.max(0, Math.min(1, illumAt(r, c))) : 0;
        // A contact on inadmissible ground does not survive: it contributes zero,
        // not 40 points of sunlight.
        total += s <= maxSlope ? 0.6 * safe + 0.4 * light : 0;
    }

    const survival = total / samples.length;
    return {
        score: Math.round(survival * 1000) / 10,          // 0..100, one decimal
        survival,
        coverage: viable / samples.length,                // fraction of contacts under the limit
        worstSlope: Math.round(worst * 10) / 10,
        samples: samples.length,
        ellipse: { semiMajorM: ellipse.semiMajorM, semiMinorM: ellipse.semiMinorM, azimuthDeg: ellipse.azimuthDeg }
    };
}
