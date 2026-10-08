// ==============================================================================
// src/3d/scene.js (CON LUZ AMBIENTAL CONTROLABLE)
// ==============================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function initScene(canvasElement) {
    const scene = new THREE.Scene();
    
    const backgroundColor = 0x050508; 
    scene.background = new THREE.Color(backgroundColor);
    scene.fog = new THREE.Fog(backgroundColor, 300000, 700000); 

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 100, 1000000);
    camera.position.set(0, 90000, 160000);

    const renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3; 

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; 

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; 
    controls.minDistance = 1000;  
    controls.maxDistance = 350000; 

    // LUZ AMBIENTAL (EARTHSHINE) CONTROLABLE
    const ambientLight = new THREE.AmbientLight(0x7085a5, 0.25); 
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 3.5); 
    scene.add(sunLight.target);
    
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096; 
    sunLight.shadow.mapSize.height = 4096;
    
    sunLight.shadow.camera.left = -170000;
    sunLight.shadow.camera.right = 170000;
    sunLight.shadow.camera.top = 170000;
    sunLight.shadow.camera.bottom = -170000;
    sunLight.shadow.camera.near = 1000;
    sunLight.shadow.camera.far = 500000;
    
    sunLight.shadow.bias = -0.0001; 
    sunLight.shadow.normalBias = 0.08; 
    
    scene.add(sunLight);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { scene, camera, renderer, controls, sunLight, ambientLight };
}