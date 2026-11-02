// Renders the shaded-relief texture to a PNG so the terrain shading can be
// inspected without a browser. Node-only, no dependencies beyond zlib.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { generateReliefTexture } from '../src/3d/layers.js';

const buf = readFileSync(new URL('../public/data/lola_shackleton.bin', import.meta.url));
const rows = buf.readInt32LE(0);
const cols = buf.readInt32LE(4);
const mpc = buf.readInt32LE(8);
const dem = new Float32Array(buf.buffer, buf.byteOffset + 12, rows * cols);

const t0 = Date.now();
const texture = generateReliefTexture(dem, rows, cols, mpc);
const px = texture.image.data;
const size = texture.image.width;
console.log(`relief ${size}x${size} in ${Date.now() - t0} ms`);

let min = 255;
let max = 0;
let sum = 0;
for (let i = 0; i < px.length; i += 4) {
    const v = px[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
}
const mean = sum / (px.length / 4);
let varSum = 0;
for (let i = 0; i < px.length; i += 4) varSum += (px[i] - mean) ** 2;
console.log(`channel  min ${min} max ${max} mean ${mean.toFixed(1)} sd ${Math.sqrt(varSum / (px.length / 4)).toFixed(1)}`);

// raw RGB rows, flipped so the PNG reads like the map (DataTexture row 0 = bottom)
const raw = Buffer.alloc(size * (size * 3 + 1));
for (let y = 0; y < size; y++) {
    const src = (size - 1 - y) * size;
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
        const s = (src + x) * 4;
        const d = y * (size * 3 + 1) + 1 + x * 3;
        raw[d] = px[s];
        raw[d + 1] = px[s + 1];
        raw[d + 2] = px[s + 2];
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
const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
ihdr[9] = 2;
const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0))
]);

mkdirSync(new URL('../tmp/', import.meta.url), { recursive: true });
writeFileSync(new URL('../tmp/relief.png', import.meta.url), png);
console.log('tmp/relief.png', png.length, 'bytes');
