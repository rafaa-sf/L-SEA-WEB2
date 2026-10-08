// ==============================================================================
// PATH: src/core/engine.js
// TOPOGRAPHIC & SHADOW RAYMARCHING ENGINE (NASA L-SEA CORE)
// ==============================================================================

const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;

/**
 * Computes terrain slope tensor in degrees.
 */
export function calculateSlopeDegrees(dem, rows, cols, mpc) {
    const slopes = new Float32Array(rows * cols);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            
            const rPrev = r > 0 ? r - 1 : 0;
            const rNext = r < rows - 1 ? r + 1 : rows - 1;
            const cPrev = c > 0 ? c - 1 : 0;
            const cNext = c < cols - 1 ? c + 1 : cols - 1;

            const dzdy = (dem[rNext * cols + c] - dem[rPrev * cols + c]) / (2.0 * mpc);
            const dzdx = (dem[r * cols + cNext] - dem[r * cols + cPrev]) / (2.0 * mpc);

            slopes[idx] = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * RAD2DEG;
        }
    }
    return slopes;
}

/**
 * 360° Radial Horizon Raytracing.
 */
export function calculateHorizonProfile(dem, rows, cols, mpc, row, col, mastHeight = 2.0) {
    const horizon = new Float32Array(360);
    const z0 = dem[row * cols + col] + mastHeight;
    const maxDist = Math.floor(Math.sqrt(rows * rows + cols * cols));

    for (let az = 0; az < 360; az++) {
        const azRad = az * DEG2RAD;
        const cosAz = Math.cos(azRad);
        const sinAz = Math.sin(azRad);
        
        let maxAngle = 0.0;

        for (let dist = 1; dist < maxDist; dist++) {
            const r = (row + cosAz * dist + 0.5) | 0; 
            const c = (col + sinAz * dist + 0.5) | 0;

            if (r < 0 || r >= rows || c < 0 || c >= cols) break;

            const zCurrent = dem[r * cols + c];
            const angle = Math.atan2(zCurrent - z0, dist * mpc) * RAD2DEG;
            
            if (angle > maxAngle) maxAngle = angle;
        }
        horizon[az] = maxAngle;
    }
    return horizon;
}

/**
 * Raymarching projected shadow occlusions.
 */
export function calculateProjectedShadows(dem, rows, cols, mpc, azimuth, elevation, stride = 2) {
    const blocked = new Uint8Array(rows * cols);
    
    if (elevation <= 0) {
        blocked.fill(1);
        return blocked;
    }

    const dy = Math.cos(azimuth * DEG2RAD);
    const dx = Math.sin(azimuth * DEG2RAD);
    const tanEl = Math.tan(elevation * DEG2RAD);
    const maxDist = Math.max(rows, cols);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            const z0 = dem[idx];
            let inShadow = false;

            for (let k = 1; k < maxDist; k += stride) {
                const f = (r + dy * k + 0.5) | 0; 
                const colTarget = (c + dx * k + 0.5) | 0;

                if (f < 0 || f >= rows || colTarget < 0 || colTarget >= cols) break;

                const zTarget = dem[f * cols + colTarget];
                if ((zTarget - z0) > tanEl * (k * mpc)) {
                    inShadow = true;
                    break;
                }
            }
            if (inShadow) blocked[idx] = 1;
        }
    }
    return blocked;
}

export function isTargetVisible(elevation, azimuth, horizon, radius = 0.0) {
    if (elevation <= 0) return false;
    let idxAz = (azimuth + 0.5) | 0;
    idxAz = idxAz % 360;
    const validAz = idxAz < 0 ? idxAz + 360 : idxAz;
    return (elevation + radius) > horizon[validAz];
}