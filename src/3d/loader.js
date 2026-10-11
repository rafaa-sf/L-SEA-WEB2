// ==============================================================================
// RUTA DEL FICHERO: src/3d/loader.js
// CARGADOR DE DATOS TOPOGRÁFICOS BINARIOS (con cabecera: rows, cols, mpc)
// ==============================================================================

/** @returns {{data: Float32Array, rows: number, cols: number, mpc: number}} */
export async function loadBinaryDEM(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error al cargar DEM: ${response.statusText}`);
    
    const buffer = await response.arrayBuffer();
    const view = new DataView(buffer);
    
    // Cabecera: 3 int32 little-endian = 12 bytes
    const rows = view.getInt32(0, true);
    const cols = view.getInt32(4, true);
    const mpc = view.getInt32(8, true);
    
    const dataOffset = 12;
    const dataLength = buffer.byteLength - dataOffset;
    const expected = rows * cols * 4;
    if (dataLength !== expected) {
        throw new Error(`DEM size mismatch: header says ${rows}x${cols} (${expected} bytes), got ${dataLength} bytes`);
    }
    
    const data = new Float32Array(buffer, dataOffset, rows * cols);
    return { data, rows, cols, mpc };
}