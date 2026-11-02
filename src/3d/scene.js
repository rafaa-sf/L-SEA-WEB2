// ==============================================================================
// src/3d/scene.js (CON LUZ AMBIENTAL CONTROLABLE)
// ==============================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function initScene(canvasElement) {
    const scene = new THREE.Scene();
    
    const backgroundColor = 0x050508; 
    scene.background = new THREE.Color(backgroundColor);
    scene.fog = new THREE.Fog(backgroundColor, 1400000, 2600000); 

    const host = canvasElement.parentElement;
    const hostWidth = () => Math.max(1, (host && host.clientWidth) || window.innerWidth);
    const hostHeight = () => Math.max(1, (host && host.clientHeight) || window.innerHeight);

    const camera = new THREE.PerspectiveCamera(45, hostWidth() / hostHeight(), 100, 4000000);
    // opening framing: the whole 640 km south polar sheet, seen from the south-east
    camera.position.set(456000, 396000, 720000);

    const renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true, alpha: false });
    renderer.setSize(hostWidth(), hostHeight());
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3; 

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // The shadow map is re-rendered only when the sun moves, not every frame:
    // 2M terrain triangles into a 2048 map each frame is what froze the view.
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; 
    controls.minDistance = 1500;  
    controls.maxDistance = 1300000; 
    controls.target.set(0, 0, 0);
    controls.update();

    // EARTHSHINE: a cool bounce so shadowed slopes keep their shape instead of
    // going to pure black, plus a warm hemisphere so relief reads at any sun angle.
    const ambientLight = new THREE.AmbientLight(0x7085a5, 0.25); 
    scene.add(ambientLight);

    const skyLight = new THREE.HemisphereLight(0x9fb4cc, 0x15181c, 0.55);
    scene.add(skyLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 3.1); 
    scene.add(sunLight.target);
    scene.add(sunLight);
    
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048; 
    sunLight.shadow.mapSize.height = 2048;
    
    sunLight.shadow.camera.left = -340000;
    sunLight.shadow.camera.right = 340000;
    sunLight.shadow.camera.top = 340000;
    sunLight.shadow.camera.bottom = -340000;
    sunLight.shadow.camera.near = 1000;
    sunLight.shadow.camera.far = 2000000;
    
    sunLight.shadow.bias = -0.0004; 
    sunLight.shadow.normalBias = 60; 

    function resize() {
        const w = hostWidth();
        const h = hostHeight();
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }

    window.addEventListener('resize', resize);
    if (host && typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(resize).observe(host);
    }

    return { scene, camera, renderer, controls, sunLight, ambientLight, resize };
}