// ==============================================================================
// RUTA DEL FICHERO: src/3d/loader.js
// CARGADOR DE DATOS TOPOGRÁFICOS BINARIOS (con cabecera: rows, cols, mpc)
// ==============================================================================

/**
 * Reads the binary DEM: a 12-byte header (rows, cols, mpc as int32 LE) followed
 * by rows * cols little-endian float32 heights in metres.
 *
 * The 64 MB payload is streamed so the interface can show how much has arrived;
 * `onProgress` receives the bytes read so far and the declared total, which may
 * be 0 when the server omits Content-Length.
 *
 * @param {string} url
 * @param {(loaded: number, total: number) => void} [onProgress]
 * @returns {Promise<{data: Float32Array, rows: number, cols: number, mpc: number}>}
 */
export async function loadBinaryDEM(url, onProgress) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`DEM request failed: ${response.status} ${response.statusText}`);

    const total = Number(response.headers.get('content-length')) || 0;
    let buffer;

    if (response.body && typeof response.body.getReader === 'function' && onProgress) {
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.byteLength;
            onProgress(received, total);
        }
        const bytes = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        }
        buffer = bytes.buffer;
    } else {
        buffer = await response.arrayBuffer();
    }

    const view = new DataView(buffer);

    // Cabecera: 3 int32 little-endian = 12 bytes
    const rows = view.getInt32(0, true);
    const cols = view.getInt32(4, true);
    const mpc = view.getInt32(8, true);

    if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows <= 0 || cols <= 0) {
        throw new Error(`DEM header is not a valid grid: ${rows} x ${cols}`);
    }

    const dataOffset = 12;
    const dataLength = buffer.byteLength - dataOffset;
    const expected = rows * cols * 4;
    if (dataLength !== expected) {
        throw new Error(`DEM size mismatch: header says ${rows}x${cols} (${expected} bytes), got ${dataLength} bytes`);
    }

    const data = new Float32Array(buffer, dataOffset, rows * cols);
    return { data, rows, cols, mpc };
}
