// ==============================================================================
// RUTA DEL FICHERO: src/3d/loader.js
// CARGADOR DE DATOS TOPOGRÁFICOS BINARIOS
// ==============================================================================

export async function loadBinaryDEM(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error al cargar DEM: ${response.statusText}`);
    
    const buffer = await response.arrayBuffer();
    
    // Si tus datos están exportados como Float32 (4 bytes por celda):
    return new Float32Array(buffer);
    
    // NOTA: Si los guardaste como enteros para ahorrar espacio (Int16), usa esto y multiplícalo por la escala de altura:
    // const intData = new Int16Array(buffer);
    // return Float32Array.from(intData); 
}