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

## 🚀 Comprehensive Feature Set

### 📊 Module 1: Mission Planner & Analytics Dashboard
* **Autonomous Site Selection (Autopilot):** Scans 4,000,000 topographic data points using Non-Maximum Suppression (NMS) to extract the Top 5 safest landing plateaus.
* **Vehicle Presets:** Pre-loaded flight profiles for **Nova-C (Intuitive Machines)**, **Griffin/VIPER (Astrobotic)**, **HAKUTO-R (ispace)**, and **Starship HLS (SpaceX)**, automatically adjusting slope tolerances, mast heights, and EPS power loads.
* **Surface Survival Gantt Chart:** Interactive timeline displaying day-by-day solar illumination cycles and Direct-to-Earth (DTE) communication windows.
* **"Seek Active DTE" Auto-Forward:** Automatically fast-forwards the mission calendar to the next available Earth line-of-sight window based on lunar libration cycles.
* **Side-by-Side Trade Study Comparator:** Select any two candidate sites to generate a comparative matrix (GNC clearance, thermal stability, ice proximity) with an autonomous algorithmic recommendation.
* **JSON Dossier Export:** Generates and downloads a formal NASA-style Mission Briefing file containing all calculated telemetry, ephemerides, and candidate coordinates.

### 🌐 Module 2: 3D Surface Inspection & GIS
* **320 km Regional 3D Rendering:** High-performance WebGL rendering of the South Polar Basin (Shackleton, Malapert, Faustini, Shoemaker, Haworth) at 60 FPS.
* **Click-to-Probe Interactive Tool:** Click anywhere on the 3D terrain to deploy a virtual surveyor probe. Instantly retrieves local elevation, exact slope, touchdown safety classification, and Diviner surface temperature for that specific pixel.
* **MET (Mission Elapsed Time) Simulator:** Play/Pause playback controls with adjustable time rates (**1x, 60x, 3600x**) to watch dynamic shadows, solar rotation, and Earthshine evolve in real-time.
* **NASA GIS Scientific Overlays:** Switch seamlessly between 4 procedural textures:
  1. **Natural Regolith (PBR):** Photorealistic shading with ACES Filmic tone mapping.
  2. **Elevation Heatmap:** Hypsometric tinting from -4,000m (Navy) to +4,000m (Crimson/White).
  3. **Slope Hazard Map:** Touchdown safety gradient (Green = Safe, Yellow = Caution, Red = Rollover Hazard).
  4. **Cumulative Illumination:** Highlights Permanently Shadowed Regions (PSRs / Ice Traps) and Peaks of Eternal Light (PELs).
* **Optical Controls:** Live sliders for Global Exposure (Gamma) and Earthshine (Shadow Fill Light) to inspect deep craters.

### 🛡️ Module 3: Autonomous GNC & Safety Algorithms
* **Anti-Cliff Safety Footprint:** Evaluates a 320m - 640m circular buffer around every pixel to ensure the entire landing ellipse is free of steep drop-offs or solitary pixel anomalies.
* **GNC Terminal Glideslope Audit:** Projects a 12° descent corridor backwards for 20 km, verifying that no mountain ridges intersect the vehicle's trajectory during the hypersonic braking phase.
* **3D Approach Vector Rendering:** Visually plots the golden glideslope trajectory and approach gates directly onto the 3D terrain.
* **VIPER Rover Traverse Pathing:** Calculates and renders a 3D cyan navigation route from the landing site down into the nearest Permanently Shadowed Region (PSR) for volatile ice sampling.

### 🪐 Module 4: Astrodynamics & Space Environment
* **Meeus ELP-2000/82 Ephemeris Engine:** Calculates sub-arcsecond Sun and Earth topocentric vectors.
* **360° Polar Horizon Skyline Radar:** A live circular HUD that raymarches the surrounding topography to draw the mountain silhouette, plotting the Sun and Earth to predict physical occlusions.
* **Diviner Thermal Radiative Model:** Solves the Stefan-Boltzmann equation to predict regolith temperatures ranging from 40 K (Cryogenic) to 380 K (Thermal Stress) based on local slope orientation.
* **Deep Space Network (DSN) 24h Handover:** Tracks Earth's rotation to display which NASA DSN station (Madrid, Goldstone, or Canberra) currently holds the active X-Band radio link.
* **TRN Optical Feasibility:** Evaluates solar elevation to determine if Terrain Relative Navigation cameras will have enough shadow contrast to guide the lander.

---

## ⚡ Architecture & Performance
* **Zero-Latency Multithreading:** Heavy tensor calculations (slope derivation, footprint auditing, NMS) are offloaded to a dedicated **Native Web Worker**, keeping the UI and 3D viewport completely fluid.
* **In-Memory Blob Worker:** The background thread is compiled inline, ensuring 100% compatibility with strict bundlers (Vite) and preventing module resolution crashes.
* **Cross-Platform Ready:** Designed to be deployed as a static web app (Vercel/GitHub Pages) or compiled into a lightweight (~15 MB) native desktop executable via **Tauri (Rust)** for offline clean-room environments.

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
│   │   ├── engine.js                # Horizon raytracing & slope tensor math
│   │   ├── nasa_suite.js            # Diviner thermal, GNC corridor & TRN models
│   │   ├── power.js                 # EPS solar generation & DSN telemetry
│   │   └── windows.js               # Autopilot NMS site extraction algorithms
│   ├── App.vue                      # MOC Flight Dashboard & Surface Inspector (All-in-One)
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