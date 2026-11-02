// ==============================================================================
// PATH: src/3d/layers.js
// NASA PLANETARY GIS TEXTURE GENERATOR
// ==============================================================================
import * as THREE from 'three';

export function generateElevationTexture(dem, rows, cols) {
    const size = 1024;
    const data = new Uint8Array(size * size * 4);

    for (let r = 0; r < size; r++) {
        const demR = Math.floor(((size - 1 - r) / size) * rows);   // DataTexture: fila 0 = abajo
        for (let c = 0; c < size; c++) {
            const demC = Math.floor((c / size) * cols);
            const alt = dem[demR * cols + demC] || 0;
            const t = Math.max(0.0, Math.min(1.0, (alt + 4000.0) / 8000.0));
            const idx = (r * size + c) * 4;

            let red, green, blue;
            if (t < 0.25) {
                const f = t / 0.25;
                red = 10; green = Math.floor(50 + 150 * f); blue = Math.floor(180 + 75 * f);
            } else if (t < 0.5) {
                const f = (t - 0.25) / 0.25;
                red = Math.floor(20 + 60 * f); green = Math.floor(200 + 40 * f); blue = Math.floor(255 * (1 - f));
            } else if (t < 0.75) {
                const f = (t - 0.5) / 0.25;
                red = Math.floor(80 + 175 * f); green = Math.floor(240 * (1 - 0.3 * f)); blue = 10;
            } else {
                const f = (t - 0.75) / 0.25;
                red = 255; green = Math.floor(120 * (1 - f) + 255 * f * 0.8); blue = Math.floor(255 * f * 0.8);
            }

            data[idx] = red;
            data[idx + 1] = green;
            data[idx + 2] = blue;
            data[idx + 3] = 255;
        }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
}

export function generateSlopeTexture(slopes, rows, cols, maxSlope = 8.0) {
    const size = 1024;
    const data = new Uint8Array(size * size * 4);

    for (let r = 0; r < size; r++) {
        const demR = Math.floor(((size - 1 - r) / size) * rows);   // DataTexture: fila 0 = abajo
        for (let c = 0; c < size; c++) {
            const demC = Math.floor((c / size) * cols);
            const slope = slopes[demR * cols + demC] || 0;
            const idx = (r * size + c) * 4;

            let red, green, blue;
            if (slope <= 5.0) {
                const f = slope / 5.0;
                red = Math.floor(20 + 80 * f); green = 220; blue = 40;
            } else if (slope <= maxSlope) {
                const f = (slope - 5.0) / (maxSlope - 5.0);
                red = 240; green = Math.floor(220 * (1 - 0.3 * f)); blue = 20;
            } else {
                const f = Math.min(1.0, (slope - maxSlope) / 10.0);
                red = Math.floor(220 + 35 * f); green = Math.floor(40 * (1 - f)); blue = 30;
            }

            data[idx] = red;
            data[idx + 1] = green;
            data[idx + 2] = blue;
            data[idx + 3] = 255;
        }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
}

/**
 * Shaded relief albedo. The Sun at the lunar south pole never rises more than
 * ~2 deg, so a physically faithful directional light rakes the terrain into a
 * flat black plate with no readable shape. This bakes a hillshade from the DEM
 * with a fixed illustrative sun (NW, 30 deg) and keeps the real illumination
 * physics where it belongs: the illumination layer and the Sun fraction column.
 */
export function generateReliefTexture(dem, rows, cols, mpc, sunAzDeg = 315, sunElDeg = 30) {
    const size = 1024;
    const data = new Uint8Array(size * size * 4);
    const stepR = rows / size;
    const stepC = cols / size;
    const dx = mpc;
    const dz = mpc;
    const exaggeration = 3.5;

    const az = (sunAzDeg * Math.PI) / 180;
    const el = (sunElDeg * Math.PI) / 180;
    const lx = Math.sin(az) * Math.cos(el);
    const ly = Math.sin(el);
    const lz = -Math.cos(az) * Math.cos(el);

    const at = (r, c) => dem[Math.min(rows - 1, r) * cols + Math.min(cols - 1, c)] || 0;

    // pass 1: raw lambert term per pixel, collected so the range can be stretched
    const shade = new Float32Array(size * size);
    const altitude = new Float32Array(size * size);
    let lo = Infinity;
    let hi = -Infinity;

    for (let r = 0; r < size; r++) {
        const demR = Math.min(rows - 2, Math.floor(((size - 1 - r) / size) * rows));
        for (let c = 0; c < size; c++) {
            const demC = Math.min(cols - 2, Math.floor((c / size) * cols));
            const dhdx = ((at(demR, demC + 1) - at(demR, demC)) / dx) * exaggeration;
            const dhdz = ((at(demR + 1, demC) - at(demR, demC)) / dz) * exaggeration;
            const n = Math.sqrt(dhdx * dhdx + dhdz * dhdz + 1);
            const v = (-dhdx * lx + ly - dhdz * lz) / n;
            const i = r * size + c;
            shade[i] = v;
            altitude[i] = at(demR, demC);
            if (v < lo) lo = v;
            if (v > hi) hi = v;
        }
    }

    // pass 2: stretch the lambert term to the full range, then colour it
    const span = Math.max(1e-4, hi - lo);
    for (let i = 0; i < size * size; i++) {
        const t = Math.min(1, Math.max(0, (shade[i] - lo) / span));
        const lit = t * t * (3 - 2 * t);
        const altT = Math.max(0, Math.min(1, (altitude[i] + 3000) / 7000));
        // slope sign gives each face a faint cool/warm bias, so relief reads in
        // greyscale without the flat "plastic" look of a pure lambert term.
        const base = 26 + 186 * lit;
        const idx = i * 4;
        data[idx] = Math.round(base * (0.95 + 0.05 * altT));
        data[idx + 1] = Math.round(base * (0.97 + 0.03 * altT));
        data[idx + 2] = Math.round(base * (1.03 - 0.05 * altT));
        data[idx + 3] = 255;
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

/**
 * Textura de fracción de iluminación del mes (0 = sombra en todo el periodo, 1 = Sol continuo).
 * `frac` es la rejilla gruesa calculada en el worker (illumination.js), NO la altura del terreno.
 */
export function generateIlluminationTexture(frac, nr, nc) {
    const size = 1024;
    const data = new Uint8Array(size * size * 4);

    for (let r = 0; r < size; r++) {
        const i = Math.min(nr - 1, Math.floor(((size - 1 - r) / size) * nr));
        for (let c = 0; c < size; c++) {
            const j = Math.min(nc - 1, Math.floor((c / size) * nc));
            const sunPct = Math.max(0.0, Math.min(1.0, frac[i * nc + j]));
            const idx = (r * size + c) * 4;

            let red, green, blue;
            if (sunPct < 0.05) {
                red = 15; green = 25; blue = 120;
            } else if (sunPct < 0.5) {
                const f = (sunPct - 0.05) / 0.45;
                red = Math.floor(80 + 120 * f); green = 20; blue = Math.floor(140 + 60 * f);
            } else if (sunPct < 0.85) {
                const f = (sunPct - 0.5) / 0.35;
                red = 245; green = Math.floor(80 + 120 * f); blue = 20;
            } else {
                const f = (sunPct - 0.85) / 0.15;
                red = 255; green = Math.floor(220 + 35 * f); blue = Math.floor(120 + 135 * f);
            }
            data[idx] = red; data[idx + 1] = green; data[idx + 2] = blue; data[idx + 3] = 255;
        }
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
}
