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
