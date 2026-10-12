// ==============================================================================
// src/3d/terrain.js (MALLA CON SOMBRAS + LOD opcional)
// ==============================================================================
import * as THREE from 'three';

/** Crea malla de terreno. Si decimate > 1, usa una malla reducida para render
 *  (p.ej. decimate=4 => 500x500 vértices desde 2000x2000).
 *  El DEM original (demData) se mantiene intacto para cálculos físicos. */
export function createTerrainMesh(demData, rows, cols, mpc, zScale = 1.0, decimate = 1) {
    const stride = Math.max(1, Math.floor(decimate));
    const renderRows = Math.max(2, Math.ceil(rows / stride));
    const renderCols = Math.max(2, Math.ceil(cols / stride));
    // El plano debe medir (vertices-1)*paso, no rows*mpc: con N vertices y N-1 segmentos
    // THREE reparte el ancho en width/gridX, y ese paso extra desalinea cada vertice de
    // su celda del DEM. El raycast y los marcadores usan x = (col - cols/2)*mpc, asi que
    // luego hay que desplazarlo: la rejilla del DEM va de -cols/2 a +cols/2-1, y
    // PlaneGeometry deja el plano centrado en el origen.
    const paso = stride * mpc;
    const width = (renderCols - 1) * paso;
    const height = (renderRows - 1) * paso;
    const geometry = new THREE.PlaneGeometry(width, height, renderCols - 1, renderRows - 1);

    geometry.rotateX(-Math.PI / 2);
    geometry.translate((width - cols * mpc) / 2, 0, (height - rows * mpc) / 2);

    const vertices = geometry.attributes.position.array;
    
    for (let i = 0, r = 0; r < renderRows; r++) {
        const srcRow = Math.min(rows - 1, Math.round(r * stride));
        for (let c = 0; c < renderCols; c++, i += 3) {
            const srcCol = Math.min(cols - 1, Math.round(c * stride));
            vertices[i + 1] = (demData[srcRow * cols + srcCol] || 0) * zScale;
        }
    }

    geometry.computeVertexNormals(); 

    const material = new THREE.MeshStandardMaterial({
        color: 0x666666,
        roughness: 0.9,
        metalness: 0.0,
        flatShading: false 
    });

    const terrain = new THREE.Mesh(geometry, material);
    
    terrain.castShadow = true;
    terrain.receiveShadow = true;
    
    terrain.position.set(0, 0, 0);
    
    return terrain;
}