// ==============================================================================
// src/3d/terrain.js (MALLA CON SOMBRAS)
// ==============================================================================
import * as THREE from 'three';

export function createTerrainMesh(demData, rows, cols, mpc, zScale = 1.0) {
    const width = cols * mpc;
    const height = rows * mpc;
    const geometry = new THREE.PlaneGeometry(width, height, cols - 1, rows - 1);
    
    geometry.rotateX(-Math.PI / 2);

    const vertices = geometry.attributes.position.array;
    
    for (let i = 0, j = 0; i < vertices.length; i += 3, j++) {
        vertices[i + 1] = (demData[j] || 0) * zScale; 
    }

    geometry.computeVertexNormals(); 

    const material = new THREE.MeshStandardMaterial({
        color: 0x666666, // Un gris ligeramente más claro para contrastar las sombras
        roughness: 0.9,
        metalness: 0.0,
        flatShading: false 
    });

    const terrain = new THREE.Mesh(geometry, material);
    
    // ACTIVAR SOMBRAS EN LA MALLA
    terrain.castShadow = true;
    terrain.receiveShadow = true;
    
    terrain.position.set(0, 0, 0);
    
    return terrain;
}