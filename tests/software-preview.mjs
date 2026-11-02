// Renders one frame of the CPU terrain view to a PNG so the fallback can be
// inspected without a browser. Node-only, no dependencies beyond zlib.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { generateReliefTexture, generateElevationTexture, generateSlopeTexture } from '../src/3d/layers.js';
import { calculateSlopeDegrees } from '../src/core/engine.js';
import { createSoftwareView } from '../src/3d/software.js';

globalThis.window = { devicePixelRatio: 1 };
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

let captured = null;
const ctx = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: (image) => { captured = image; },
    beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, stroke() {}, fill() {}, fillText() {},
    setLineDash() {}, save() {}, restore() {},
    strokeStyle: '', fillStyle: '', lineWidth: 1, font: ''
};
const canvas = {
    width: 0,
    height: 0,
    style: {},
    parentElement: { clientWidth: 1280, clientHeight: 720 },
    getContext: () => ctx,
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 })
};

const buf = readFileSync(new URL('../public/data/lola_shackleton.bin', import.meta.url));
const rows = buf.readInt32LE(0);
const cols = buf.readInt32LE(4);
const mpc = buf.readInt32LE(8);
const dem = new Float32Array(buf.buffer, buf.byteOffset + 12, rows * cols);

const t0 = Date.now();
const relief = generateReliefTexture(dem, rows, cols, mpc);
const elevation = generateElevationTexture(dem, rows, cols);
const slopes = calculateSlopeDegrees(dem, rows, cols, mpc);
const slope = generateSlopeTexture(slopes, rows, cols, 8.0);
console.log(`textures in ${Date.now() - t0} ms`);

const layers = {
    relief: { width: relief.image.width, height: relief.image.height, data: relief.image.data },
    elevation: { width: elevation.image.width, height: elevation.image.height, data: elevation.image.data },
    slope: { width: slope.image.width, height: slope.image.height, data: slope.image.data }
};

const view = createSoftwareView(canvas, {
    dem,
    rows,
    cols,
    mpc,
    center: { x: 0, z: 0 },
    ellipse: { semiMajorM: 240, semiMinorM: 120, azimuthDeg: 270 },
    layers
});

const site = { fila: 2000, col: 2000, siteId: 'C-01' };
view.setSite(site);
view.setCatalogue([{ fila: 1950, col: 2020 }, { fila: 2040, col: 1980 }, { fila: 2010, col: 2035 }]);

if (process.argv[3]) view.camera.distance = Number(process.argv[3]);
if (process.argv[4]) view.camera.pitch = Number(process.argv[4]);

const t1 = Date.now();
view.render();
console.log(`frame ${captured.width}x${captured.height} in ${Date.now() - t1} ms`);

const layer = process.argv[2] || 'pbr';
if (layer !== 'pbr') {
    view.setLayer(layer);
    view.render();
}

const { width, height, data } = captured;
const stride = width * 3 + 1;
const raw = Buffer.alloc(height * stride);
for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < width; x++) {
        const s = (y * width + x) * 4;
        const d = y * stride + 1 + x * 3;
        raw[d] = data[s];
        raw[d + 1] = data[s + 1];
        raw[d + 2] = data[s + 2];
    }
}

const table = new Int32Array(256);
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
}
const crc = (b) => {
    let c = -1;
    for (let i = 0; i < b.length; i++) c = table[(c ^ b[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
};
const chunk = (type, payload) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8;
ihdr[9] = 2;
const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0))
]);

mkdirSync(new URL('../tmp/', import.meta.url), { recursive: true });
const out = new URL(`../tmp/software-${layer}.png`, import.meta.url);
writeFileSync(out, png);
console.log(`tmp/software-${layer}.png`, png.length, 'bytes');
