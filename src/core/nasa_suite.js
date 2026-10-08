// ==============================================================================
// PATH: src/core/nasa_suite.js
// NASA FLIGHT SYSTEMS & PLANETARY SCIENCE SUITE
// ==============================================================================

const DEG2RAD = Math.PI / 180.0;

/**
 * 1. NASA DIVINER RADIOMETER THERMAL EQUILIBRIUM MODEL
 */
export function calculateDivinerTemperature(solarElevation, slope = 0.0, relativeOrientation = 0.0) {
    const STEFAN_BOLTZMANN = 5.67037e-8;
    const SOLAR_FLUX = 1361.0;
    const ALBEDO = 0.12;
    const EMISSIVITY = 0.95;

    const effectiveAngle = Math.max(0.0, solarElevation + (relativeOrientation * slope * 0.35));

    if (effectiveAngle <= 0) {
        return { kelvin: 40.0, celsius: -233.15, status: "CRYOGENIC (PSR)" };
    }

    const sinEl = Math.sin(effectiveAngle * DEG2RAD);
    const T4 = ((1.0 - ALBEDO) * SOLAR_FLUX * sinEl) / (EMISSIVITY * STEFAN_BOLTZMANN);
    const kelvin = Math.max(40.0, Math.pow(T4, 0.25));
    const celsius = kelvin - 273.15;

    let status = "NOMINAL";
    if (kelvin < 110) status = "EXTREME COLD";
    else if (kelvin > 360) status = "HIGH THERMAL STRESS";

    return {
        kelvin: Math.round(kelvin),
        celsius: Math.round(celsius),
        status
    };
}

/**
 * 2. GNC TERMINAL GLIDESLOPE APPROACH CORRIDOR AUDIT (1.5 km to 20 km)
 */
export function evaluateGlideslopeCorridor(dem, rows, cols, mpc, row, col, approachAzimuth = 270.0, glideslopeAngle = 12.0) {
    const zTouchdown = dem[row * cols + col];
    const distMinM = 1500.0;
    const distMaxM = 20000.0;
    const steps = 35;
    const stepM = (distMaxM - distMinM) / steps;

    const dirRad = (approachAzimuth + 180.0) * DEG2RAD;
    const dy = Math.cos(dirRad);
    const dx = Math.sin(dirRad);
    const tanGlideslope = Math.tan(glideslopeAngle * DEG2RAD);

    let worstMarginM = 9999.0;
    let collisionDetected = false;

    for (let i = 0; i <= steps; i++) {
        const distActualM = distMinM + (i * stepM);
        const distPx = distActualM / mpc;

        const r = Math.round(row + dy * distPx);
        const c = Math.round(col + dx * distPx);

        if (r < 0 || r >= rows || c < 0 || c >= cols) break;

        const terrainElevation = dem[r * cols + c];
        const flightAltitude = zTouchdown + (distActualM * tanGlideslope);
        const margin = flightAltitude - terrainElevation;

        if (margin < worstMarginM) worstMarginM = margin;

        if (margin <= 100.0) {
            collisionDetected = true;
            break;
        }
    }

    return {
        clear: !collisionDetected && worstMarginM > 150.0,
        minMarginM: Math.round(worstMarginM),
        glideslopeAngle
    };
}

/**
 * 3. TERRAIN RELATIVE NAVIGATION (TRN) OPTICAL CONTRAST
 */
export function evaluateTrnFeasibility(solarElevation) {
    if (solarElevation <= 0.8) {
        return { score: 10, status: "NO-GO (BLIND)", detail: "Full shadows prevent crater feature tracking" };
    } else if (solarElevation > 0.8 && solarElevation <= 8.5) {
        return { score: 98, status: "OPTIMAL", detail: "Sharp crater rim shadows for cross-correlation" };
    } else if (solarElevation > 8.5 && solarElevation <= 15.0) {
        return { score: 75, status: "MARGINAL", detail: "Relief shadows fading progressively" };
    } else {
        return { score: 45, status: "DEGRADED", detail: "Overhead light flattens optical reference points" };
    }
}

/**
 * 4. LUNAR LIBRATION DIRECT-TO-EARTH (DTE) OSCILLATION RISK
 */
export function evaluateLibrationRisk(earthElevation) {
    if (earthElevation <= 0) {
        return { status: "TOTAL BLACKOUT", marginDeg: earthElevation.toFixed(1), risk: "CRITICAL" };
    } else if (earthElevation < 2.5) {
        return { status: "LIBRATION LOSS RISK", marginDeg: earthElevation.toFixed(1), risk: "MEDIUM" };
    } else {
        return { status: "ROBUST LINK", marginDeg: earthElevation.toFixed(1), risk: "LOW" };
    }
}

/**
 * 5. VIPER ROVER TRAVERSE SLIP HAZARD
 */
export function evaluateRoverTraverse(slope, psrDistance) {
    if (slope > 10.0) {
        return { passable: false, factor: "HIGH SLIP RISK" };
    } else if (slope > 6.0) {
        return { passable: true, factor: "CAUTION" };
    } else {
        return { passable: true, factor: "NOMINAL" };
    }
}