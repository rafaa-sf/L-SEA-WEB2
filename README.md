# L-SEA: Lunar Site Evaluation Algorithm
### Autonomous Landing Site Assessment & Surface Mission Operations Center (MOC)
**Engineered for NASA CLPS (Commercial Lunar Payload Services) & Artemis Flight Profiles**

[![Vue 3](https://img.shields.io/badge/Vue-3.x-42b883?style=for-the-badge&logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![NASA PDS Data](https://img.shields.io/badge/NASA%20PDS-LRO%20LOLA%20DEM-0B3D91?style=for-the-badge&logo=nasa&logoColor=white)](https://pds-geosciences.wustl.edu/)
[![Tauri](https://img.shields.io/badge/Tauri-Desktop%20Native-24C8DB?style=for-the-badge&logo=tauri&logoColor=white)](https://tauri.app/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

---

## 🛰️ Executive Overview

**L-SEA (Lunar Site Evaluation Algorithm)** is a high-performance, web-first and native desktop flight operations suite developed to analyze, evaluate, and visualize candidate touchdown sites in the extreme environment of the **Lunar South Pole (80°S to 90°S)**.

Engineered with raw satellite altimetry from the **NASA Lunar Reconnaissance Orbiter (LRO)**, L-SEA integrates celestial mechanics, guidance navigation and control (GNC) obstacle clearance, surface thermal modeling, and multi-spectral GIS overlays into a unified, zero-latency 60 FPS dashboard.

---

## 🔬 Core Aerospace Subsystems & Capabilities

### 1. 🪐 Topocentric Astrodynamics (Jean Meeus ELP-2000/82)
* **Ephemeris Engine:** Pure JavaScript implementation of truncated ELP-2000/82 lunar theory and VSOP87 solar coordinates with sub-arcsecond accuracy.
* **IAU Lunar Orientation:** True inertial-to-body frame coordinate transformations (ICRF to Selenographic PA421).
* **Libration & DTE Tracking:** Predicts lunar optical/physical libration oscillations (±6.7°) to forecast **Direct-to-Earth (DTE)** radio line-of-sight and communication blackouts (Loss of Signal - LOS).

### 2. 🚀 GNC Terminal Descent Corridor (Glideslope Audit)
* **Approach Obstacle Clearance:** Verifies trajectory clearance along a **12° terminal glideslope** over the final 20 km of powered descent.
* **Anti-Cliff Safety Footprint Buffer:** Eliminates solitary pixel anomalies by enforcing an adjustable circular landing ellipse (320 m to 640 m) where the maximum allowable slope must remain below vehicle rollover thresholds.

### 3. 🌡️ NASA Diviner Surface Thermal Radiative Model
* **Thermal Equilibrium Forecasting:** Solves the Stefan-Boltzmann radiative balance equation using empirical parameters from the **NASA Diviner Lunar Radiometer Experiment** (Albedo = 0.12, Emissivity = 0.95).
* Predicts surface temperatures ranging from **40 K (-233°C in cryogenic PSRs)** to **380 K (+107°C in illuminated highland plateaus)**.

### 4. 🗺️ NASA Planetary GIS Overlays (320 km Regional Grid)
* **Natural Regolith (PBR):** Real-time physically based shading with dynamic shadows and secondary Earthshine fill illumination.
* **Elevation Heatmap (Hypsometric Tint):** Color gradient ranging from deep crater floors (-4,000 m, Navy) to elevated massifs (+4,000 m, Crimson/White).
* **Slope Hazard Map:** Real-time touchdown classification: Green (<5°, Safe), Yellow (5°-8°, Caution), and Red (>10°, Rollover Hazard).
* **Cumulative Illumination (PSR & PEL Finder):** Highlights **Permanently Shadowed Regions (PSRs)** containing volatile water ice deposits and **Peaks of Eternal Light (PELs)** for solar power architecture.

### 5. 📡 360° Polar Horizon Skyline Radar
* Evaluates real-time mountain topography occlusion using radial raymarching across 360 degrees of azimuth.
* Renders an interactive polar radar display with true Sun and Earth positions relative to the surrounding mountain silhouette.

### 6. ⚡ Multi-Threaded Processing (Web Workers)
* Decouples the 4,000,000-pixel digital elevation model (DEM) tensor calculations from the UI rendering thread.
* Features a real-time telemetry progress bar allowing the Three.js 3D viewport to maintain a steady **60 FPS** during heavy spatial analysis.

---

## 🚀 Supported Flight Vehicle Presets

| Vehicle Preset | Mission Profile | Mast Height | Solar Array | Base Load | Slope Tolerance |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Intuitive Machines Nova-C** | NASA CLPS-1 Commercial Lander | 3.0 m | 2.5 m² | 120 W | ≤ 8° |
| **Astrobotic Griffin / VIPER** | NASA Volatiles Investigating Rover | 2.0 m | 3.8 m² | 210 W | ≤ 12° |
| **ispace HAKUTO-R M1** | Commercial Lunar Exploration | 1.6 m | 1.2 m² | 85 W | ≤ 6° |
| **SpaceX Starship HLS** | NASA Artemis III Human Landing System | 16.0 m | 25.0 m² | 1,800 W | ≤ 10° |

---

## 🛠️ Technology Stack

* **Frontend Framework:** Vue 3 (Composition API)
* **Styling & HUD Design:** Tailwind CSS v4 (Glassmorphism MOC Theme)
* **3D Visualization:** Three.js (WebGL, Custom BufferGeometry, ACES Filmic Tone Mapping)
* **Astrodynamics Core:** Vanilla JavaScript (ELP-2000/82, IAU Libration, Meeus Matrix Algorithms)
* **Multithreading:** Dedicated Native Web Worker (autopilot.worker.js)
* **Native Desktop Shell:** Tauri (Rust-backed ultra-lightweight desktop packager)
* **Deployment Target:** Vercel / Static Jamstack

---

## 💻 Getting Started

### Prerequisites
* Node.js (v18.x or higher)
* Python 3.8+ with numpy installed (for initial LOLA DEM extraction)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/l-sea-mission.git
cd l-sea-mission
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Generate NASA DEM Binary Dataset
Extracts the 320 km regional grid from the NASA PDS LOLA 80m product:
```bash
python descargar_lola.py
```
Outputs `public/data/lola_shackleton.bin` (16 MB Float32Array).

### 4. Run Development Server
```bash
npm run dev
```
Navigate to http://localhost:5173/ in your browser.

### 5. Build for Production
```bash
npm run build
```

---

## 📁 Project Directory Structure

```text
l-sea/
├── public/
│   └── data/
│       └── lola_shackleton.bin      # Processed 320km DEM dataset (16 MB)
├── src/
│   ├── 3d/
│   │   ├── layers.js                # GIS procedural textures (Elevation, Slope, PSR)
│   │   ├── loader.js                # Fast binary ArrayBuffer DEM parser
│   │   ├── scene.js                 # Three.js camera, renderer & shadow frustum setup
│   │   └── terrain.js               # Dynamic 3D topographic mesh builder
│   ├── core/
│   │   ├── astro.js                 # Meeus ELP-2000/82 ephemeris & IAU rotation
│   │   ├── autopilot.worker.js      # Background multithreaded audit worker
│   │   ├── engine.js                # Horizon raytracing & slope tensor math
│   │   ├── nasa_suite.js            # Diviner thermal, GNC corridor & TRN models
│   │   ├── power.js                 # EPS solar generation & DSN telemetry
│   │   └── windows.js               # Autopilot NMS site extraction algorithms
│   ├── App.vue                      # MOC Flight Dashboard & Surface Inspector
│   ├── main.js                      # Vue entrypoint
│   └── style.css                    # Global theme styling
├── descargar_lola.py                # NASA PDS extraction & resampling script
├── package.json
└── vite.config.js
```

---

## 📜 Scientific References & Data Sources

1. **Topography (LOLA):** Smith, D. E., et al. Initial observations from the Lunar Orbiter Laser Altimeter (LOLA) on board the Lunar Reconnaissance Orbiter. NASA Planetary Data System (PDS).
2. **Ephemerides:** Meeus, Jean. Astronomical Algorithms. Willmann-Bell, 2nd Edition.
3. **Thermal Model:** Paige, D. A., et al. Diviner Lunar Radiometer Experiment Investigations of the Lunar South Pole. Space Science Reviews.
4. **Autonomous Landing:** NASA Autonomous Landing Hazard Avoidance Technology (ALHAT) Project Technical Reports.

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.