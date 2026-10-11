<!-- src/App.vue -->
<!-- L-SEA: Lunar Site Evaluation Algorithm & Mission Operations Suite -->
<template>
  <div class="w-screen h-screen bg-[#07090e] text-slate-200 font-sans flex flex-col overflow-hidden">
    
    <!-- TOP NAVIGATION BAR -->
    <header class="h-14 border-b border-white/10 bg-[#0c1017] px-6 flex justify-between items-center z-20">
      <div class="flex items-center gap-3">
        <div class="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500 animate-pulse"></div>
        <h1 class="text-sm font-bold tracking-widest text-white uppercase font-mono">L-SEA <span class="text-blue-400">MISSION OPERATIONS CENTER</span></h1>
        <span class="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-widest font-mono">NASA Space Apps 2026</span>
      </div>

      <div class="flex items-center gap-3">
        <button 
          @click="exportMissionBrief" 
          class="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer">
          📄 Export Mission Brief
        </button>

        <nav class="flex gap-2">
          <button 
            @click="activeTab = 'planner'"
            :class="activeTab === 'planner' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'"
            class="px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer">
            📊 Mission Planner
          </button>
          <button 
            @click="activeTab = 'viewer3d'"
            :class="activeTab === 'viewer3d' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'"
            class="px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer">
            🌐 3D Surface Inspection
          </button>
        </nav>
      </div>
    </header>

    <!-- POI LEGEND BAR (top, clickable navigation) -->
    <div v-if="leyendaVisible" class="bg-[#0c1017] border-b border-white/10 px-4 py-2 z-30 pointer-events-auto">
      <div class="flex items-center gap-3 overflow-x-auto scrollbar-hide" @click.stop @pointerdown.stop>
        <button @click.stop="leyendaVisible = false" class="flex-shrink-0 text-gray-400 hover:text-white text-xs px-2 py-1" title="Ocultar leyenda">✕</button>
        <span class="flex-shrink-0 text-[10px] text-gray-500 uppercase font-bold tracking-wider">POI NAVIGATION</span>
        <div class="flex flex-wrap gap-1.5">
          <template v-for="poi in leyendaFiltrada" :key="poi.nombre">
            <button
              @click.stop="navegarAPOI(poi)"
              :class="[
                'px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer whitespace-nowrap border pointer-events-auto',
                poi.tipo === 'psr' ? 'bg-blue-900/30 border-blue-500/30 text-cyan-300 hover:bg-blue-900/50' :
                poi.tipo === 'mount' ? 'bg-amber-900/30 border-amber-500/30 text-amber-300 hover:bg-amber-900/50' :
                poi.tipo === 'clps' ? 'bg-green-900/30 border-green-500/30 text-green-300 hover:bg-green-900/50' :
                'bg-purple-900/30 border-purple-500/30 text-purple-300 hover:bg-purple-900/50'
              ]"
              :title="poi.desc"
            >
              {{ poi.nombre }}
            </button>
          </template>
        </div>
        <button @click.stop="leyendaVisible = !leyendaVisible" class="flex-shrink-0 ml-auto text-gray-400 hover:text-white text-xs px-2 py-1" title="Mostrar/Ocultar">☰</button>
      </div>
    </div>

    <!-- MAIN WORKSPACE -->
    <div class="relative flex-1 overflow-hidden">

      <!-- ============================================================== -->
      <!-- VIEW 1: MISSION PLANNER                                        -->
      <!-- ============================================================== -->
      <div v-show="activeTab === 'planner'" class="absolute inset-0 p-6 overflow-y-auto bg-[#07090e] z-10 flex flex-col gap-5">
        
        <!-- TELEMETRY ROW -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-[#0f141f] border border-white/10 rounded-xl p-4 shadow-xl flex flex-col justify-between">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Radiative Equilibrium Temp (est.)</span>
              <span :class="thermalTelemetria.kelvin < 100 ? 'text-cyan-400' : 'text-amber-400'" class="text-[10px] font-mono">● {{ thermalTelemetria.status }}</span>
            </div>
            <div class="flex items-baseline gap-2 mt-1">
              <p class="text-2xl font-mono font-bold text-white">{{ thermalTelemetria.kelvin }} K</p>
              <span class="text-xs font-mono text-gray-400">({{ thermalTelemetria.celsius }} °C)</span>
            </div>
            <p class="text-[10px] text-gray-500 mt-2">Instantaneous estimate at the active point · no regolith conduction</p>
          </div>

          <div class="bg-[#0f141f] border border-white/10 rounded-xl p-4 shadow-xl flex flex-col justify-between">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Optical Vision (TRN)</span>
              <span class="text-[10px] text-green-400 font-mono">{{ trnTelemetria.score }}% Reliability</span>
            </div>
            <p class="text-base font-bold text-white mt-1 uppercase">{{ trnTelemetria.status }}</p>
            <p class="text-[10px] text-gray-500 mt-2">{{ trnTelemetria.detail }} · illustrative thresholds</p>
          </div>

          <div class="bg-[#0f141f] border border-white/10 rounded-xl p-4 shadow-xl flex flex-col justify-between">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[10px] text-gray-400 uppercase font-bold tracking-wider">GNC Corridor (12° glideslope, assumed)</span>
              <span :class="gncCorredor.clear ? 'text-green-400' : 'text-red-400'" class="text-[10px] font-mono font-bold">
                {{ gncCorredor.clear ? 'CLEAR' : 'OBSTACLE DETECTED' }}
              </span>
            </div>
            <div class="flex items-baseline gap-2 mt-1">
              <p class="text-2xl font-mono font-bold" :class="gncCorredor.clear ? 'text-white' : 'text-red-400'">
                +{{ gncCorredor.minMarginM }} m
              </p>
              <span class="text-xs text-gray-400">Terrain Clearance</span>
            </div>
            <p class="text-[10px] text-gray-500 mt-2">1.5–20 km straight-line corridor · fixed approach azimuth (assumption)</p>
          </div>

          <div class="bg-[#0f141f] border border-white/10 rounded-xl p-4 shadow-xl flex flex-col justify-between">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Libration & DSN Link</span>
              <span :class="tierraVisible ? 'text-blue-400' : 'text-amber-400'" class="text-[10px] font-mono">
                {{ tierraVisible ? '● EARTH IN LINE OF SIGHT' : '● NO LINE OF SIGHT' }}
              </span>
            </div>
            <p class="text-base font-bold text-white mt-1">{{ libracionTelemetria.status }}</p>
            <p class="text-[10px] text-gray-500 mt-2">Earth Elev: {{ efemerides.tierra_el.toFixed(1) }}° | Margin over terrain: {{ libracionTelemetria.marginDeg }}° | {{ libracionTelemetria.risk }}</p>
          </div>
        </div>

        <!-- CONTROL PANELS -->
        <div class="grid grid-cols-1 xl:grid-cols-4 gap-5">
          <div class="bg-[#0f141f] border border-white/10 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
            <div class="flex justify-between items-center border-b border-white/10 pb-2">
              <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Lander Flight Configuration</h2>
              <span class="text-[10px] text-blue-400 font-mono">CLPS Specs</span>
            </div>

            <div>
              <label class="block text-[11px] text-gray-400 mb-1">Vehicle Preset</label>
              <select v-model="vehiculoSeleccionado" @change="aplicarPresetVehiculo" class="w-full bg-black/50 border border-white/10 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500">
                <option value="nova-c">Intuitive Machines Nova-C (CLPS-1)</option>
                <option value="griffin">Astrobotic Griffin</option>
                <option value="hakuto">ispace HAKUTO-R M1</option>
                <option value="hls">SpaceX Starship HLS (Artemis III)</option>
              </select>
              <p class="text-[9px] text-amber-400/80 mt-1">Illustrative values, not official vehicle specs.</p>
            </div>

            <div class="grid grid-cols-2 gap-3 text-xs bg-black/30 p-3 rounded-lg border border-white/5">
              <div>
                <span class="text-[10px] text-gray-500 block">Mast Height</span>
                <span class="font-mono text-white font-bold">{{ vehiculo.alturaMastil }} m</span>
              </div>
              <div>
                <span class="text-[10px] text-gray-500 block">Slope Limit</span>
                <span class="font-mono text-yellow-400 font-bold">≤ {{ vehiculo.maxPendiente }}°</span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] text-gray-400 mb-1">Landing Date (T0)</label>
                <input type="date" v-model="selectedDate" @change="recalcularEfemérides" class="w-full bg-black/40 border border-white/10 rounded p-1.5 text-xs text-white">
              </div>
              <div>
                <label class="block text-[11px] text-gray-400 mb-1">Safety Footprint</label>
                <select v-model.number="radioHuellaMetros" @change="limpiarResultadosAuditoria" class="w-full bg-black/50 border border-white/10 rounded p-1.5 text-xs text-amber-400 font-bold">
                  <option :value="320">320 m</option>
                  <option :value="480">480 m</option>
                  <option :value="640">640 m</option>
                </select>
              </div>
            </div>

            <!-- MULTITHREADED AUDIT BUTTON -->
            <button 
              @click="ejecutarAutopilotMultithread" 
              :disabled="calculando"
              class="w-full mt-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all cursor-pointer disabled:opacity-50">
              {{ calculando ? 'Auditing Background Worker...' : '🚀 Execute Background Worker Audit' }}
            </button>
          </div>

          <div class="bg-[#0f141f] border border-white/10 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
            <div class="flex justify-between items-center border-b border-white/10 pb-2">
              <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Surface Survival Timeline</h2>
              <button @click="saltarAProximaVentanaDTE" class="bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 text-blue-300 hover:text-white px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer">
                🛰️ Seek Active DTE
              </button>
            </div>

            <div class="bg-black/40 border border-white/10 p-2.5 rounded-lg flex items-center justify-between">
              <div class="flex items-center gap-2">
                <button @click="toggleSimulationPlay" class="w-7 h-7 rounded bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer">
                  {{ isPlaying ? '⏸' : '▶' }}
                </button>
                <div>
                  <span class="text-[9px] text-gray-400 block font-mono">TIME RATE</span>
                  <span class="text-xs font-mono font-bold text-white">{{ simSpeed }}x</span>
                </div>
              </div>
              
              <div class="flex gap-1">
                <button @click="simSpeed = 1" :class="simSpeed === 1 ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'" class="px-2 py-1 rounded text-[10px] font-mono cursor-pointer">1x</button>
                <button @click="simSpeed = 60" :class="simSpeed === 60 ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'" class="px-2 py-1 rounded text-[10px] font-mono cursor-pointer">60x</button>
                <button @click="simSpeed = 3600" :class="simSpeed === 3600 ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'" class="px-2 py-1 rounded text-[10px] font-mono cursor-pointer">3600x</button>
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <span class="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Sunlight Cycle</span>
              <div class="grid grid-cols-7 gap-1">
                <div v-for="(dia, idx) in timelineDias" :key="'sol-' + idx" :class="dia.sol ? 'bg-amber-500 text-black font-bold' : 'bg-neutral-800 text-gray-500'" class="h-8 rounded flex flex-col items-center justify-center text-[10px]">
                  <span>D{{ idx + 1 }}</span>
                  <span class="text-[7px]">{{ dia.sol ? 'SUN' : 'SHADE' }}</span>
                </div>
              </div>

              <span class="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-1">Direct-To-Earth (DTE) Link</span>
              <div class="grid grid-cols-7 gap-1">
                <div v-for="(dia, idx) in timelineDias" :key="'dte-' + idx" :class="dia.dte ? 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-500/50' : 'bg-neutral-800 text-gray-500'" class="h-8 rounded flex flex-col items-center justify-center text-[10px]">
                  <span>D{{ idx + 1 }}</span>
                  <span class="text-[7px]">{{ dia.dte ? 'LINK' : 'LOS' }}</span>
                </div>
              </div>
            </div>

            <div class="mt-auto bg-black/40 border border-white/5 rounded-lg p-2.5 flex justify-between items-center">
              <span class="text-[11px] text-gray-400 font-semibold">EPS Net Power <span class="text-[9px] text-gray-500 font-normal">(vertical panel facing the Sun, assumed)</span></span>
              <p :class="potencia.neta > 0 ? 'text-green-400' : 'text-red-400'" class="text-lg font-mono font-bold">
                {{ potencia.neta > 0 ? '+' + potencia.neta : potencia.neta }} W
              </p>
            </div>
          </div>

          <div class="bg-[#0f141f] border border-white/10 rounded-xl p-5 flex flex-col items-center justify-between shadow-xl">
            <div class="w-full flex justify-between items-center border-b border-white/10 pb-2">
              <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest">360° Polar Horizon Radar</h2>
              <span class="text-[10px] text-cyan-400 font-mono">Skyline · Az 0° = map-up</span>
            </div>

            <div class="relative w-44 h-44 flex items-center justify-center my-1">
              <canvas ref="radarCanvas" width="180" height="180" class="rounded-full bg-black/60 border border-white/10"></canvas>
            </div>

            <div class="w-full flex justify-between text-[10px] text-gray-400 border-t border-white/5 pt-2">
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-400"></span> Sun</span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-400"></span> Earth</span>
            </div>
          </div>

          <div class="bg-[#0f141f] border border-white/10 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
            <div class="flex justify-between items-center border-b border-white/10 pb-2">
              <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Deep Space Network</h2>
              <span class="text-[10px] text-amber-400 font-mono">● Moon elevation per complex</span>
            </div>

            <div class="flex flex-col gap-2.5">
              <div v-for="clave in ['Madrid', 'Goldstone', 'Canberra']" :key="clave"
                   :class="estacionActiva === clave ? 'border-green-500/50 bg-green-950/20' : 'border-white/5 bg-black/20'"
                   class="p-2.5 rounded-lg border flex justify-between items-center">
                <div>
                  <span class="text-xs text-white font-semibold">{{ dsnTelemetria[clave] ? dsnTelemetria[clave].nombre : clave }}</span>
                  <span class="text-[9px] text-gray-400 block">Moon az {{ dsnTelemetria[clave] ? dsnTelemetria[clave].az : '-' }}°</span>
                </div>
                <span :class="dsnTelemetria[clave] && dsnTelemetria[clave].enlace ? 'text-green-400' : 'text-red-400'" class="text-xs font-mono font-bold">
                  {{ dsnTelemetria[clave] ? (dsnTelemetria[clave].el > 0 ? '+' : '') + dsnTelemetria[clave].el : '-' }}° El
                </span>
              </div>
            </div>

            <p class="text-[9px] text-gray-500">Topocentric Moon elevation (computed). A link needs the Moon above a {{ dsnMinEl }}° mask (assumed) and Earth in the lander's line of sight.</p>

            <div class="mt-auto text-[10px] text-gray-400 bg-black/30 p-2 rounded border border-white/5 flex justify-between">
              <span>Active complex:</span>
              <span class="text-green-400 font-mono font-bold">{{ estacionActiva || 'none' }}</span>
            </div>
          </div>
        </div>

        <!-- PROGRESS BAR OVERLAY WHEN MULTITHREADING -->
        <div v-if="calculando" class="bg-[#121622] border border-blue-500/40 p-4 rounded-xl shadow-2xl flex flex-col gap-2 animate-in fade-in">
          <div class="flex justify-between items-center text-xs">
            <span class="font-bold text-blue-400 uppercase tracking-wide flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
              {{ workerStatus }}
            </span>
            <span class="font-mono text-white font-bold">{{ workerProgress }}%</span>
          </div>
          <div class="w-full bg-black/50 rounded-full h-2 overflow-hidden border border-white/10">
            <div class="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all duration-150" :style="{ width: workerProgress + '%' }"></div>
          </div>
        </div>

        <!-- CANDIDATE SITES MATRIX -->
        <div class="bg-[#0f141f] border border-white/10 rounded-xl p-5 shadow-xl flex-1 flex flex-col">
          <div class="flex justify-between items-center border-b border-white/10 pb-3 mb-3">
            <div>
              <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Candidate Landing Site Decision Matrix
              </h2>
              <p class="text-[11px] text-gray-500">Slope-footprint safety, 30-day Sun / Earth visibility (terrain horizon), glideslope check and radiative-equilibrium temperature estimate</p>
            </div>

            <button 
              v-if="sitiosSeleccionadosComparar.length === 2"
              @click="mostrarModalComparador = true"
              class="bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow cursor-pointer">
              ⚖️ Compare 2 Selected Sites
            </button>
          </div>
          
          <div v-if="sitiosCandidatos.length === 0" class="flex-1 flex flex-col items-center justify-center text-gray-500 py-12">
            <p class="text-sm">No regional simulation data currently available.</p>
            <p class="text-xs mt-1 text-gray-600">Click "Execute Background Worker Audit" to start background processing.</p>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-left text-xs text-gray-300">
              <thead class="bg-black/40 text-gray-400 uppercase text-[10px] tracking-wider border-b border-white/10">
                <tr>
                  <th class="p-3">Compare</th>
                  <th class="p-3">Designation</th>
                  <th class="p-3">Grid Coords</th>
                  <th class="p-3">Footprint Slope</th>
                  <th class="p-3">GNC Clearance (20km)</th>
                  <th class="p-3">Sun / DTE (30 d)</th>
                  <th class="p-3">Temp (est.)</th>
                  <th class="p-3">Suitability</th>
                  <th class="p-3">3D Inspection</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="sitio in sitiosCandidatos" :key="sitio.rank" class="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td class="p-3">
                    <input type="checkbox" :value="sitio" v-model="sitiosSeleccionadosComparar" :disabled="sitiosSeleccionadosComparar.length >= 2 && !sitiosSeleccionadosComparar.includes(sitio)" class="accent-amber-500 cursor-pointer">
                  </td>
                  <td class="p-3 font-bold text-blue-400">#{{ sitio.rank }} - Candidate {{ String.fromCharCode(64 + sitio.rank) }}</td>
                  <td class="p-3 font-mono text-gray-400">R: {{ sitio.fila }} | C: {{ sitio.col }}</td>
                  <td class="p-3 font-mono text-green-400 font-bold">≤ {{ sitio.peorPendiente }}°</td>
                  <td class="p-3 font-mono" :class="sitio.gnc.clear ? 'text-green-400' : 'text-red-400'">
                    {{ sitio.gnc.clear ? '✓ +' + sitio.gnc.minMarginM + ' m' : '✗ Blocked (' + sitio.gnc.minMarginM + 'm)' }}
                  </td>
                  <td class="p-3 font-mono text-cyan-400">
                    ☀️ {{ sitio.sol_pct }}% · 📡 {{ sitio.dte_pct }}%
                  </td>
                  <td class="p-3 font-mono text-white">{{ sitio.termica.kelvin }} K</td>
                  <td class="p-3 font-bold text-green-400">{{ sitio.score }} / 100</td>
                  <td class="p-3">
                    <button @click="inspeccionarSitio(sitio)" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow">
                      <span>🚀</span> GNC Vector 3D
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- VIEW 2: 3D SURFACE INSPECTION WITH CLICK-TO-PROBE TOOL         -->
      <!-- ============================================================== -->
      <div v-show="activeTab === 'viewer3d'" class="absolute inset-0 z-0">
        <canvas 
          ref="canvas3d" 
          @pointerdown="onPointerDown" 
          @click="onCanvasClick" 
          class="w-full h-full cursor-crosshair">
        </canvas>

        <!-- TOP-LEFT: GIS SCIENTIFIC LAYER SELECTOR -->
        <div class="absolute top-6 left-6 backdrop-blur-md bg-black/80 border border-white/10 p-4 rounded-xl text-xs pointer-events-auto shadow-2xl flex flex-col gap-3">
          <h3 class="font-bold text-white uppercase text-[11px] tracking-wider border-b border-white/10 pb-1 flex items-center gap-1.5">
            <span>🗺️</span> GIS Overlays
          </h3>
          
          <div class="flex flex-col gap-1.5">
            <button 
              @click="cambiarCapaGIS('pbr')" 
              :class="capaGISActiva === 'pbr' ? 'bg-blue-600 text-white font-bold shadow' : 'bg-white/5 text-gray-300 hover:bg-white/10'" 
              class="px-3 py-1.5 rounded text-[11px] text-left transition-all cursor-pointer flex items-center justify-between">
              <span>📷 Natural Regolith (PBR)</span>
              <span v-if="capaGISActiva === 'pbr'" class="text-[9px]">ACTIVE</span>
            </button>

            <button 
              @click="cambiarCapaGIS('elevation')" 
              :class="capaGISActiva === 'elevation' ? 'bg-blue-600 text-white font-bold shadow' : 'bg-white/5 text-gray-300 hover:bg-white/10'" 
              class="px-3 py-1.5 rounded text-[11px] text-left transition-all cursor-pointer flex items-center justify-between">
              <span>🏔️ Elevation Heatmap (Hypsometric)</span>
              <span v-if="capaGISActiva === 'elevation'" class="text-[9px]">ACTIVE</span>
            </button>

            <button 
              @click="cambiarCapaGIS('slope')" 
              :class="capaGISActiva === 'slope' ? 'bg-blue-600 text-white font-bold shadow' : 'bg-white/5 text-gray-300 hover:bg-white/10'" 
              class="px-3 py-1.5 rounded text-[11px] text-left transition-all cursor-pointer flex items-center justify-between">
              <span>📐 Slope Hazard (Touchdown Safety)</span>
              <span v-if="capaGISActiva === 'slope'" class="text-[9px]">ACTIVE</span>
            </button>

            <button 
              @click="cambiarCapaGIS('illumination')" 
              :class="capaGISActiva === 'illumination' ? 'bg-blue-600 text-white font-bold shadow' : 'bg-white/5 text-gray-300 hover:bg-white/10'" 
              class="px-3 py-1.5 rounded text-[11px] text-left transition-all cursor-pointer flex items-center justify-between">
              <span>☀️ 30-day Sun Fraction (coarse)</span>
              <span v-if="capaGISActiva === 'illumination'" class="text-[9px]">ACTIVE</span>
            </button>
          </div>

          <!-- DYNAMIC GIS COLOR LEGEND -->
          <div class="mt-2 pt-2 border-t border-white/10 text-[10px]">
            <span class="text-gray-400 block mb-1.5 font-semibold uppercase tracking-wider">Layer Color Scale</span>
            
            <div v-if="capaGISActiva === 'elevation'" class="flex flex-col gap-1">
              <div class="h-2 w-full rounded bg-gradient-to-r from-blue-700 via-emerald-500 to-red-600"></div>
              <div class="flex justify-between text-[9px] text-gray-400 font-mono">
                <span>-4,000 m (Floors)</span>
                <span>+4,000 m (Peaks)</span>
              </div>
            </div>

            <div v-else-if="capaGISActiva === 'slope'" class="flex flex-col gap-1">
              <div class="h-2 w-full rounded bg-gradient-to-r from-emerald-500 via-amber-400 to-red-600"></div>
              <div class="flex justify-between text-[9px] text-gray-400 font-mono">
                <span>0° (Safe Flat)</span>
                <span>{{ vehiculo.maxPendiente }}° Limit</span>
                <span>>15° (Hazard)</span>
              </div>
            </div>

            <div v-else-if="capaGISActiva === 'illumination'" class="flex flex-col gap-1">
              <div class="h-2 w-full rounded bg-gradient-to-r from-indigo-900 via-fuchsia-600 to-amber-300"></div>
              <div class="flex justify-between text-[9px] text-gray-400 font-mono">
                <span>0% (no Sun in 30 d)</span>
                <span>≥85% (near-continuous)</span>
              </div>
            </div>

            <div v-else class="text-[9px] text-gray-400">
              Photorealistic PBR Regolith with live ACES Tone Mapping.
            </div>
          </div>
        </div>

        <!-- TOP-RIGHT: VISUAL & EPHEMERIS HUD -->
        <div class="absolute top-6 right-6 backdrop-blur-md bg-black/75 border border-white/10 p-4 rounded-xl text-xs pointer-events-auto shadow-2xl w-72">
          <h3 class="font-bold text-white uppercase text-[11px] tracking-wider mb-2 border-b border-white/10 pb-1">Visual & Ephemeris Controls</h3>
          
          <div class="mb-3">
            <label class="flex justify-between text-[11px] text-gray-400 mb-1">
              <span>Solar Hour</span>
              <span class="text-blue-400 font-mono">{{ simHora }}:00 h</span>
            </label>
            <input type="range" min="0" max="23" v-model.number="simHora" @input="recalcularEfemérides" class="w-full accent-blue-500 cursor-pointer">
          </div>

          <div class="mb-3">
            <label class="flex justify-between text-[11px] text-gray-400 mb-1">
              <span>Shadow Light (Earthshine)</span>
              <span class="text-cyan-400 font-mono font-bold">{{ (luzSombras * 100).toFixed(0) }}%</span>
            </label>
            <input type="range" min="0.05" max="1.5" step="0.05" v-model.number="luzSombras" @input="actualizarIluminacion" class="w-full accent-cyan-500 cursor-pointer">
          </div>

          <div class="mb-3">
            <label class="flex justify-between text-[11px] text-gray-400 mb-1">
              <span>Exposure / Gamma</span>
              <span class="text-amber-400 font-mono font-bold">{{ exposicion.toFixed(1) }}x</span>
            </label>
            <input type="range" min="0.5" max="3.5" step="0.1" v-model.number="exposicion" @input="actualizarIluminacion" class="w-full accent-amber-500 cursor-pointer">
          </div>

          <div>
            <label class="block text-[11px] text-gray-400 mb-1">Simulation Date</label>
            <input type="date" v-model="selectedDate" @change="recalcularEfemérides" class="w-full bg-black/50 border border-white/10 rounded p-1.5 text-xs text-white">
          </div>
        </div>

        <!-- BOTTOM-RIGHT: CLICK-TO-PROBE CARD -->
        <div v-if="sondeoPunto" class="absolute bottom-6 right-6 backdrop-blur-md bg-black/85 border border-cyan-500/40 p-5 rounded-xl text-xs pointer-events-auto shadow-2xl w-80 animate-in fade-in">
          <div class="flex justify-between items-center mb-2.5 border-b border-white/10 pb-2">
            <div class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
              <span class="font-bold text-white uppercase text-[11px] tracking-wider">Point Surface Probe</span>
            </div>
            <button @click="cerrarSondeo" class="text-gray-400 hover:text-white text-xs cursor-pointer">✕</button>
          </div>

          <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-gray-300">
            <div>
              <span class="text-[9px] text-gray-400 uppercase block">Elevation (MSL)</span>
              <span class="text-white font-mono font-bold text-sm">{{ sondeoPunto.altura }} m</span>
            </div>
            <div>
              <span class="text-[9px] text-gray-400 uppercase block">Local Slope</span>
              <span :class="sondeoPunto.pendiente <= vehiculo.maxPendiente ? 'text-green-400' : 'text-red-400'" class="font-mono font-bold text-sm">
                {{ sondeoPunto.pendiente }}°
              </span>
            </div>
            <div>
              <span class="text-[9px] text-gray-400 uppercase block">Touchdown Safety</span>
              <span :class="sondeoPunto.seguridadClase" class="font-bold text-[10px] block">
                {{ sondeoPunto.seguridad }}
              </span>
            </div>
            <div>
              <span class="text-[9px] text-gray-400 uppercase block">Surface Temp (est.)</span>
              <span class="text-white font-mono font-bold text-sm">{{ sondeoPunto.temperatura }} K</span>
            </div>
            <div class="col-span-2 pt-1 border-t border-white/5 text-[10px] text-gray-400">
              Grid Cell: <span class="text-cyan-400 font-mono">[R: {{ sondeoPunto.fila }}, C: {{ sondeoPunto.col }}]</span>
            </div>
          </div>
        </div>

        <!-- BOTTOM-LEFT HUD -->
        <div class="absolute bottom-6 left-6 backdrop-blur-md bg-black/75 border border-white/10 p-5 rounded-xl text-xs pointer-events-auto shadow-2xl">
          <div v-if="sitioActivo" class="flex items-center gap-2 mb-3">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
            <span class="font-bold text-white uppercase tracking-wider text-xs">GNC Approach: Candidate #{{ sitioActivo.rank }}</span>
          </div>
          <div v-else class="flex items-center gap-2 mb-3">
            <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span class="font-bold text-white uppercase tracking-wider text-xs">South Polar Basin (320 km)</span>
          </div>

          <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-300">
            <p>Sun Elevation: <span class="text-yellow-400 font-mono font-bold">{{ efemerides.sol_el.toFixed(2) }}°</span></p>
            <p>Temp (est.): <span class="text-white font-mono font-bold">{{ thermalTelemetria.kelvin }} K</span></p>
            <p v-if="sitioActivo">GNC Clearance: <span class="text-green-400 font-mono font-bold">+{{ sitioActivo.gnc.minMarginM }} m</span></p>
            <p v-if="sitioActivo">Sun (30 d): <span class="text-amber-400 font-mono font-bold">{{ sitioActivo.sol_pct }}%</span></p>
          </div>
        </div>
      </div>

    </div>

    <!-- SITE COMPARATOR -->
    <div v-if="mostrarModalComparador && sitiosSeleccionadosComparar.length === 2" class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" @click.self="mostrarModalComparador = false">
      <div class="bg-[#0f141f] border border-white/10 rounded-xl p-6 w-full max-w-3xl shadow-2xl">
        <div class="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
          <h3 class="text-sm font-bold text-white uppercase tracking-wider">Side-by-side site comparison</h3>
          <button @click="mostrarModalComparador = false" class="text-gray-400 hover:text-white cursor-pointer">✕</button>
        </div>
        <table class="w-full text-xs text-gray-300">
          <thead class="text-gray-400 uppercase text-[10px]">
            <tr><th class="text-left p-2">Metric</th><th class="text-left p-2">Candidate #{{ sitiosSeleccionadosComparar[0].rank }}</th><th class="text-left p-2">Candidate #{{ sitiosSeleccionadosComparar[1].rank }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="fila in filasComparador" :key="fila.etiqueta" class="border-t border-white/5">
              <td class="p-2 text-gray-400">{{ fila.etiqueta }}</td>
              <td class="p-2 font-mono" :class="fila.mejor === 0 ? 'text-green-400 font-bold' : 'text-white'">{{ fila.a }}</td>
              <td class="p-2 font-mono" :class="fila.mejor === 1 ? 'text-green-400 font-bold' : 'text-white'">{{ fila.b }}</td>
            </tr>
          </tbody>
        </table>
        <p class="mt-4 text-xs text-amber-300">{{ recomendacionComparador }}</p>
        <p class="mt-1 text-[10px] text-gray-500">Recommendation = higher suitability score (60 % slope safety, 40 % 30-day Sun fraction). A decision aid, not a flight rule.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import * as THREE from 'three';
import { initScene } from './3d/scene.js';
import { loadBinaryDEM } from './3d/loader.js';
import { createTerrainMesh } from './3d/terrain.js';

import { calcularEfemeridesMeeus, RADIO_SOL } from './core/astro.js';
import { calcular_potencia_electrica, telemetria_dsn, estacionActivaDSN, DSN_MIN_ELEVACION } from './core/power.js';
import { calculateSlopeDegrees, calculateHorizonProfile, isTargetVisible, gradienteLocal, clasificarPendiente } from './core/engine.js';
import { pixelToGeo, geoToPixel, pasoAzimut, ROW_DIR } from './core/geo.js';
import { visibilidadDiaria } from './core/windows.js';

import {
  calculateRadiativeEquilibrium,
  evaluateTrnFeasibility,
  evaluateLibrationRisk,
  AZIMUT_APROXIMACION,
  ANGULO_DESCENSO
} from './core/nasa_suite.js';

import { 
  generateElevationTexture, 
  generateSlopeTexture, 
  generateIlluminationTexture 
} from './3d/layers.js';

// VALORES ILUSTRATIVOS (no son especificaciones oficiales de ningún vehículo).
const PRESETS_VEHICULOS = {
  'nova-c': { nombre: 'Nova-C (Intuitive Machines)', alturaMastil: 3.0, areaSolar: 2.5, cargaBase: 120, maxPendiente: 8 },
  'griffin': { nombre: 'Griffin (Astrobotic)', alturaMastil: 2.0, areaSolar: 3.8, cargaBase: 210, maxPendiente: 12 },
  'hakuto': { nombre: 'HAKUTO-R M1 (ispace)', alturaMastil: 1.6, areaSolar: 1.2, cargaBase: 85, maxPendiente: 6 },
  'hls': { nombre: 'Starship HLS (SpaceX)', alturaMastil: 16.0, areaSolar: 25.0, cargaBase: 1800, maxPendiente: 10 }
};

const activeTab = ref('planner');
const selectedDate = ref('2026-10-08');
const simHora = ref(12);
const duracionEstancia = ref(7);
const vehiculoSeleccionado = ref('nova-c');
const vehiculo = ref({ ...PRESETS_VEHICULOS['nova-c'] });
const radioHuellaMetros = ref(480);

// GIS Overlays
const capaGISActiva = ref('pbr');
let texturaElevation = null;
let texturaSlope = null;
let texturaIllumination = null;

// POI Legend Bar (top of screen)
const poisLegend = ref([
  // Cráteres PSR
  { nombre: 'Shackleton Crater', lat: -89.9, lon: 129.8, tipo: 'psr', desc: 'Polo sur, piso PSR, cresta iluminada' },
  { nombre: 'Amundsen Crater', lat: -84.5, lon: 82.8, tipo: 'psr', desc: 'Gran cráter, piso permanentemente en sombra' },
  { nombre: 'Faustini Crater', lat: -87.3, lon: 77.0, tipo: 'psr', desc: 'Candidato PSR, cerca del polo' },
  { nombre: 'Shoemaker Crater', lat: -88.1, lon: 44.9, tipo: 'psr', desc: 'Piso PSR, homenaje a Gene Shoemaker' },
  { nombre: 'Haworth Crater', lat: -87.5, lon: -5.0, tipo: 'psr', desc: 'Candidato PSR, borde oeste' },
  { nombre: 'Nobile Crater', lat: -84.2, lon: -28.5, tipo: 'psr', desc: 'Región objetivo VIPER/CLPS' },
  { nombre: 'Cabeus Crater', lat: -84.9, lon: -35.5, tipo: 'psr', desc: 'Impacto LCROSS, confirma hielo' },
  { nombre: 'Sverdrup Crater', lat: -88.5, lon: -110.0, tipo: 'psr', desc: 'Cercano al polo, piso PSR' },
  { nombre: 'de Gerlache Crater', lat: -88.3, lon: -85.0, tipo: 'psr', desc: 'Borde conecta con Shackleton' },

  // Montes
  { nombre: 'Malapert Mountain', lat: -86.0, lon: 0.1, tipo: 'mount', desc: 'Pico cuasi-permanentemente iluminado' },
  { nombre: 'Leibnitz Beta', lat: -83.5, lon: 30.0, tipo: 'mount', desc: 'Macizo Leibniz, terreno alto' },
  { nombre: 'Leibnitz Gamma', lat: -82.0, lon: 15.0, tipo: 'mount', desc: 'Macizo Leibniz, acceso a polo' },

  // Sitios CLPS / Artemis
  { nombre: 'Connecting Ridge', lat: -89.8, lon: 45.0, tipo: 'clps', desc: 'Cresta Shackleton–de Gerlache, objetivo Artemis' },
  { nombre: 'Shackleton Rim A', lat: -89.7, lon: 0.0, tipo: 'clps', desc: 'Punto en borde Shackleton (0°)' },
  { nombre: 'Shackleton Rim B', lat: -89.7, lon: 90.0, tipo: 'clps', desc: 'Punto en borde Shackleton (90°)' },
  { nombre: 'Shackleton Rim C', lat: -89.7, lon: 180.0, tipo: 'clps', desc: 'Punto en borde Shackleton (180°)' },
  { nombre: 'Shackleton Rim D', lat: -89.7, lon: 270.0, tipo: 'clps', desc: 'Punto en borde Shackleton (270°)' },
  { nombre: 'Nobile Rim', lat: -84.0, lon: -30.0, tipo: 'clps', desc: 'Candidato VIPER/CLPS, acceso PSR' },
  { nombre: 'Cabeus Rim', lat: -84.5, lon: -35.0, tipo: 'clps', desc: 'Borde Cabeus, cerca de confirmación hielo' },

  // Referencia
  { nombre: 'South Pole (90°S)', lat: -90.0, lon: 0.0, tipo: 'ref', desc: 'Polo geográfico exacto' },
  { nombre: 'Amundsen Rim', lat: -84.0, lon: 85.0, tipo: 'ref', desc: 'Borde norte Amundsen' },
]);

const leyendaVisible = ref(true);
const leyendaFiltrada = computed(() => poisLegend.value);

// Click-to-Probe State
const sondeoPunto = ref(null);
let probeMarker = null;
let pointerDownPos = { x: 0, y: 0 };

// Multithreaded Web Worker Status
const calculando = ref(false);
const workerProgress = ref(0);
const workerStatus = ref('');
let auditWorker = null;

// MET Simulator Clock
const isPlaying = ref(false);
const simSpeed = ref(1);

const estacionActiva = ref(null);
const dsnTelemetria = ref({});
const dsnMinEl = DSN_MIN_ELEVACION;
const solVisible = ref(false);
const tierraVisible = ref(false);
const puntoActivo = ref({ fila: 1000, col: 1000 });
let horizonteActivo = null;
let horizonteKey = '';
let illumData = null;
let illumKey = '';
let auditPendiente = false;
const exposicion = ref(1.4);
const luzSombras = ref(0.40);
const sitiosCandidatos = ref([]);
const sitioActivo = ref(null);
const sitiosSeleccionadosComparar = ref([]);
const mostrarModalComparador = ref(false);

const timelineDias = ref([]);
const efemerides = ref({ sol_el: 0, sol_az: 0, tierra_el: 0, tierra_az: 0 });
const potencia = ref({ bruta: 0, neta: 0, radiacion: 0 });

const thermalTelemetria = ref({ kelvin: 0, celsius: 0, status: 'NOMINAL' });
const trnTelemetria = ref({ score: 0, status: '', detail: '' });
const libracionTelemetria = ref({ status: '', marginDeg: '0', risk: 'LOW' });
const gncCorredor = ref({ clear: true, minMarginM: 500 });

const canvas3d = ref(null);
const radarCanvas = ref(null);
let sceneManager = null;
let demDataCache = null;
let terrenoMeshRef = null;
let landingMarker = null;
let glideslopeLine = null;
let terrainCenter = new THREE.Vector3();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const RADIO_ORBITA_SOL = 250000;
let ROWS = 2000, COLS = 2000, MPC = 160; // fallback defaults, overwritten by DEM header
const ILLUM_PASO = 8;   // rejilla gruesa del mapa de iluminación: 8 celdas = 1,28 km
const TERRAIN_LOD_DECIMATE = 4; // 4 = 500x500 render mesh from 2000x2000 DEM (250k tris vs 8M)

onMounted(async () => {
  sceneManager = initScene(canvas3d.value);

  // Initialize Native Web Worker with explicit exception handling
  try {
    auditWorker = new Worker(new URL('./core/autopilot.worker.js', import.meta.url), { type: 'module' });
    auditWorker.onmessage = handleWorkerMessage;
    auditWorker.onerror = (err) => {
      console.error("Worker Execution Failure:", err);
      calculando.value = false;
      alert("Worker error: check browser console logs.");
    };
  } catch (err) {
    console.error("Worker Instantiation Failure:", err);
  }

  try {
    const demResult = await loadBinaryDEM('/data/lola_shackleton.bin');
    demDataCache = demResult.data;
    ROWS = demResult.rows;
    COLS = demResult.cols;
    MPC = demResult.mpc;
    terrenoMeshRef = createTerrainMesh(demDataCache, ROWS, COLS, MPC, 1.0, TERRAIN_LOD_DECIMATE);
    
    terrenoMeshRef.geometry.computeBoundingBox();
    terrenoMeshRef.geometry.boundingBox.getCenter(terrainCenter);
    terrenoMeshRef.position.sub(terrainCenter);
    sceneManager.scene.add(terrenoMeshRef);

    landingMarker = crearIndicadorAlunizaje();
    landingMarker.visible = false;
    sceneManager.scene.add(landingMarker);

    probeMarker = crearBalizaSondeo();
    probeMarker.visible = false;
    sceneManager.scene.add(probeMarker);

    // sitio activo inicial: centro del cráter Shackleton (89,9°S, 129,8°E)
    const p0 = geoToPixel(-89.9, 129.8, ROWS, COLS, MPC);
    puntoActivo.value = { fila: Math.round(p0.fila), col: Math.round(p0.col) };

    crearPuntosDeInteresRegionales();
    actualizarIluminacion();
    recalcularEfemérides();
    dibujarRadarHorizonte();
    animate();
  } catch (err) {
    console.error("Error loading DEM binary:", err);
  }
});

// WEB WORKER EVENT DISPATCHER
function handleWorkerMessage(e) {
  const data = e.data;
  if (data.type === 'PROGRESS') {
    workerProgress.value = data.progress;
    workerStatus.value = data.status;
  } else if (data.type === 'ILLUM_COMPLETE') {
    illumData = { data: data.illum, nr: data.nr, nc: data.nc, paso: data.paso };
    texturaIllumination = generateIlluminationTexture(data.illum, data.nr, data.nc);
    if (capaGISActiva.value === 'illumination' && terrenoMeshRef) {
      terrenoMeshRef.material.map = texturaIllumination;
      terrenoMeshRef.material.color.setHex(0xffffff);
      terrenoMeshRef.material.needsUpdate = true;
    }
    if (auditPendiente) {
      auditPendiente = false;
      lanzarAuditoria();
    } else {
      workerProgress.value = 100;
      setTimeout(() => { calculando.value = false; }, 300);
    }
  } else if (data.type === 'COMPLETE') {
    workerStatus.value = 'Refining candidates with terrain horizon and site ephemeris...';
    sitiosCandidatos.value = refinarCandidatos(data.candidates);
    if (sitiosCandidatos.value.length > 0) {
      gncCorredor.value = sitiosCandidatos.value[0].gnc;
    }
    workerProgress.value = 100;
    setTimeout(() => { calculando.value = false; }, 300);
  } else if (data.type === 'ERROR') {
    console.error("Worker computation failed:", data.error);
    calculando.value = false;
    auditPendiente = false;
    alert("Computation error: " + data.error);
  }
}

function claveIluminacion() {
  return selectedDate.value + '|' + simHora.value;
}

// Mapa de fracción de iluminación de 30 días (cálculo real, rejilla gruesa)
function solicitarIluminacion() {
  if (!demDataCache || !auditWorker) return;
  calculando.value = true;
  workerProgress.value = 5;
  workerStatus.value = 'Spawning background thread...';
  illumKey = claveIluminacion();
  auditWorker.postMessage({
    task: 'ILLUMINATION', demData: demDataCache, rows: ROWS, cols: COLS, mpc: MPC,
    fechaISO: selectedDate.value, dias: 30, paso: ILLUM_PASO, hora: simHora.value
  });
}

// TRIGGER MULTITHREADED AUDIT PIPELINE
function ejecutarAutopilotMultithread() {
  if (!demDataCache || !auditWorker) return;
  if (!illumData || illumKey !== claveIluminacion()) {
    auditPendiente = true;        // primero la iluminación real; después la auditoría
    solicitarIluminacion();
    return;
  }
  lanzarAuditoria();
}

function lanzarAuditoria() {
  calculando.value = true;
  workerProgress.value = 5;
  workerStatus.value = 'Spawning background thread...';
  auditWorker.postMessage({
    task: 'AUDIT',
    demData: demDataCache,
    rows: ROWS,
    cols: COLS,
    mpc: MPC,
    maxSlope: vehiculo.value.maxPendiente,
    footprintMeters: radioHuellaMetros.value,
    illum: illumData.data,
    illumNr: illumData.nr,
    illumNc: illumData.nc,
    illumPaso: illumData.paso
  });
}

// Re-puntúa el pool del worker con visibilidad REAL (horizonte del terreno + efemérides del propio sitio)
function refinarCandidatos(pool) {
  const fecha0 = new Date(selectedDate.value + 'T00:00:00Z');
  const ahora = new Date(selectedDate.value + 'T00:00:00Z');
  ahora.setUTCHours(simHora.value);
  const maxP = vehiculo.value.maxPendiente;

  const lista = pool.map((s) => {
    const vis = visibilidadDiaria(demDataCache, ROWS, COLS, MPC, s.fila, s.col, fecha0, 30, simHora.value, vehiculo.value.alturaMastil);
    const g = vis.geo;
    const ef = calcularEfemeridesMeeus(ahora, g.lat, g.lon, g.rumbo);
    const loc = gradienteLocal(demDataCache, ROWS, COLS, MPC, s.fila, s.col);
    const solVis = isTargetVisible(ef.sol_el, ef.sol_az, vis.horizonte, RADIO_SOL);
    const term = calculateRadiativeEquilibrium({ solEl: ef.sol_el, solAz: ef.sol_az, dzdx: loc.dzdx, dzdrow: loc.dzdrow, sunVisible: solVis });
    const score = 100 * (0.6 * s.safety + 0.4 * (vis.sol_pct / 100));
    return {
      ...s,
      lat: g.lat, lon: g.lon,
      peorPendiente: s.peorPendiente.toFixed(1),
      sol_pct: Math.round(vis.sol_pct),
      dte_pct: Math.round(vis.dte_pct),
      termica: term,
      seguridad: clasificarPendiente(s.peorPendiente, maxP),
      score: Math.round(score * 10) / 10
    };
  });
  lista.sort((a, b) => b.score - a.score);
  return lista.slice(0, 5).map((s, i) => ({ ...s, rank: i + 1 }));
}

// Filas de la comparación lado a lado
const filasComparador = computed(() => {
  if (sitiosSeleccionadosComparar.value.length !== 2) return [];
  const [a, b] = sitiosSeleccionadosComparar.value;
  const f = (etiqueta, va, vb, mayorEsMejor, fmt = (x) => x) => {
    let mejor = -1;
    if (va !== vb) mejor = (va > vb) === mayorEsMejor ? 0 : 1;
    return { etiqueta, a: fmt(va), b: fmt(vb), mejor };
  };
  return [
    f('Suitability (0–100)', a.score, b.score, true),
    f('Footprint worst slope (°)', parseFloat(a.peorPendiente), parseFloat(b.peorPendiente), false, (x) => x.toFixed(1)),
    f('GNC margin (m)', a.gnc.minMarginM, b.gnc.minMarginM, true),
    f('Sun, 30 days (%)', a.sol_pct, b.sol_pct, true),
    f('Earth line of sight, 30 days (%)', a.dte_pct, b.dte_pct, true),
    f('Temp estimate (K)', a.termica.kelvin, b.termica.kelvin, true),
    { etiqueta: 'Elevation (m)', a: a.altura, b: b.altura, mejor: -1 },
    { etiqueta: 'Latitude / longitude', a: a.lat.toFixed(2) + '° / ' + a.lon.toFixed(1) + '°', b: b.lat.toFixed(2) + '° / ' + b.lon.toFixed(1) + '°', mejor: -1 }
  ];
});

const recomendacionComparador = computed(() => {
  if (sitiosSeleccionadosComparar.value.length !== 2) return '';
  const [a, b] = sitiosSeleccionadosComparar.value;
  if (a.score === b.score) return 'Both candidates have the same suitability score.';
  const g = a.score > b.score ? a : b;
  return 'Recommended: Candidate #' + g.rank + ' (suitability ' + g.score + ').';
});

function crearBalizaSondeo() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });

  const agujaGeo = new THREE.ConeGeometry(25, 1000, 16);
  agujaGeo.rotateX(Math.PI);
  agujaGeo.translate(0, 500, 0);
  group.add(new THREE.Mesh(agujaGeo, mat));

  const esferaGeo = new THREE.SphereGeometry(90, 16, 16);
  const esfera = new THREE.Mesh(esferaGeo, mat);
  esfera.position.y = 1050;
  group.add(esfera);

  const anilloGeo = new THREE.RingGeometry(120, 200, 32);
  anilloGeo.rotateX(-Math.PI / 2);
  const anillo = new THREE.Mesh(anilloGeo, new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide }));
  anillo.position.y = 5;
  group.add(anillo);

  return group;
}

function onPointerDown(e) {
  pointerDownPos = { x: e.clientX, y: e.clientY };
}

function onCanvasClick(e) {
  const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  if (dist > 5) return;

  if (!terrenoMeshRef || !demDataCache || !sceneManager) return;

  const rect = canvas3d.value.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, sceneManager.camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const p = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, p)) return;

  const col = Math.round(((p.x + terrainCenter.x) / MPC) + COLS / 2);
  const fila = Math.round(((p.z + terrainCenter.z) / MPC) + ROWS / 2);

  if (fila >= 1 && fila < ROWS - 1 && col >= 1 && col < COLS - 1) {
    const alt = Math.round(demDataCache[fila * COLS + col] || 0);
    const loc = gradienteLocal(demDataCache, ROWS, COLS, MPC, fila, col);
    const pend = Math.round(loc.slope * 10) / 10;
    const cls = clasificarPendiente(pend, vehiculo.value.maxPendiente);

    // La telemetría (Sol, Tierra, horizonte, térmica, DSN) pasa a ser la de ESTE punto
    puntoActivo.value = { fila, col };
    recalcularEfemérides();

    sondeoPunto.value = {
      fila,
      col,
      altura: alt,
      pendiente: pend,
      temperatura: thermalTelemetria.value.kelvin,
      seguridad: cls.texto,
      seguridadClase: cls.clase
    };

    probeMarker.position.set(p.x, alt - terrainCenter.y, p.z);
    probeMarker.visible = true;
  }
}

function cerrarSondeo() {
  sondeoPunto.value = null;
  if (probeMarker) probeMarker.visible = false;
}

function cambiarCapaGIS(tipo) {
  if (!terrenoMeshRef || !demDataCache) return;
  capaGISActiva.value = tipo;

  if (tipo === 'pbr') {
    terrenoMeshRef.material.map = null;
    terrenoMeshRef.material.color.setHex(0x666666);
    terrenoMeshRef.material.needsUpdate = true;
  } else if (tipo === 'elevation') {
    if (!texturaElevation) {
      texturaElevation = generateElevationTexture(demDataCache, ROWS, COLS);
    }
    terrenoMeshRef.material.map = texturaElevation;
    terrenoMeshRef.material.color.setHex(0xffffff);
    terrenoMeshRef.material.needsUpdate = true;
  } else if (tipo === 'slope') {
    if (!texturaSlope) {
      const slopes = calculateSlopeDegrees(demDataCache, ROWS, COLS, MPC);
      texturaSlope = generateSlopeTexture(slopes, ROWS, COLS, vehiculo.value.maxPendiente);
    }
    terrenoMeshRef.material.map = texturaSlope;
    terrenoMeshRef.material.color.setHex(0xffffff);
    terrenoMeshRef.material.needsUpdate = true;
  } else if (tipo === 'illumination') {
    if (!texturaIllumination) {
      solicitarIluminacion();   // se aplicará al terminar el worker
      return;
    }
    terrenoMeshRef.material.map = texturaIllumination;
    terrenoMeshRef.material.color.setHex(0xffffff);
    terrenoMeshRef.material.needsUpdate = true;
  }
}

function limpiarResultadosAuditoria() {
  texturaSlope = null;
  sitiosCandidatos.value = [];
  sitiosSeleccionadosComparar.value = [];
}

function aplicarPresetVehiculo() {
  vehiculo.value = { ...PRESETS_VEHICULOS[vehiculoSeleccionado.value] };
  limpiarResultadosAuditoria();
  recalcularEfemérides();
}

function geoActivo() {
  return pixelToGeo(puntoActivo.value.fila, puntoActivo.value.col, ROWS, COLS, MPC);
}

function asegurarHorizonte() {
  const { fila, col } = puntoActivo.value;
  const key = fila + '|' + col + '|' + vehiculo.value.alturaMastil;
  if (key !== horizonteKey && demDataCache) {
    horizonteActivo = calculateHorizonProfile(demDataCache, ROWS, COLS, MPC, fila, col, vehiculo.value.alturaMastil);
    horizonteKey = key;
  }
}

function generarTimelineEstancia() {
  if (!demDataCache) return;
  asegurarHorizonte();
  const { fila, col } = puntoActivo.value;
  const fecha0 = new Date(selectedDate.value + 'T00:00:00Z');
  const vis = visibilidadDiaria(demDataCache, ROWS, COLS, MPC, fila, col, fecha0, duracionEstancia.value, simHora.value,
                                vehiculo.value.alturaMastil, horizonteActivo);
  const dias = [];
  for (let i = 0; i < duracionEstancia.value; i++) {
    dias.push({ dia: i + 1, sol: vis.sol[i] === 1, dte: vis.dte[i] === 1 });
  }
  timelineDias.value = dias;
}

// Salta al siguiente día con línea de visión real a la Tierra (horizonte del terreno incluido)
function saltarAProximaVentanaDTE() {
  if (!demDataCache) return;
  asegurarHorizonte();
  const { fila, col } = puntoActivo.value;
  const fecha0 = new Date(selectedDate.value + 'T00:00:00Z');
  const vis = visibilidadDiaria(demDataCache, ROWS, COLS, MPC, fila, col, new Date(fecha0.getTime() + 86400000), 35, simHora.value,
                                vehiculo.value.alturaMastil, horizonteActivo);
  for (let i = 0; i < 35; i++) {
    if (vis.dte[i] === 1) {
      selectedDate.value = new Date(fecha0.getTime() + (i + 1) * 86400000).toISOString().split('T')[0];
      recalcularEfemérides();
      return;
    }
  }
}

function toggleSimulationPlay() {
  isPlaying.value = !isPlaying.value;
}

function actualizarIluminacion() {
  if (!sceneManager) return;
  sceneManager.renderer.toneMappingExposure = exposicion.value;
  if (sceneManager.ambientLight) {
    sceneManager.ambientLight.intensity = luzSombras.value;
  }
}

function recalcularEfemérides() {
  if (!demDataCache) return;
  asegurarHorizonte();

  const g = geoActivo();
  const d = new Date(selectedDate.value + 'T00:00:00Z');
  d.setUTCHours(simHora.value);

  // Efemérides DEL PUNTO ACTIVO (latitud, longitud y rumbo del mapa en ese punto)
  const ef = calcularEfemeridesMeeus(d, g.lat, g.lon, g.rumbo);
  efemerides.value = ef;

  // Criterio único de visibilidad: elevación (+ radio solar) sobre el horizonte del terreno
  const solVis = isTargetVisible(ef.sol_el, ef.sol_az, horizonteActivo, RADIO_SOL);
  const tierraVis = isTargetVisible(ef.tierra_el, ef.tierra_az, horizonteActivo, 0);
  solVisible.value = solVis;
  tierraVisible.value = tierraVis;

  potencia.value = calcular_potencia_electrica(solVis, ef.sol_el, vehiculo.value.areaSolar, 0.29, vehiculo.value.cargaBase, 'vertical');

  const loc = gradienteLocal(demDataCache, ROWS, COLS, MPC, puntoActivo.value.fila, puntoActivo.value.col);
  thermalTelemetria.value = calculateRadiativeEquilibrium({ solEl: ef.sol_el, solAz: ef.sol_az, dzdx: loc.dzdx, dzdrow: loc.dzdrow, sunVisible: solVis });
  trnTelemetria.value = evaluateTrnFeasibility(ef.sol_el);

  const idxAz = ((Math.round(ef.tierra_az) % 360) + 360) % 360;
  libracionTelemetria.value = evaluateLibrationRisk(ef.tierra_el - horizonteActivo[idxAz], tierraVis);

  // DSN: elevación REAL de la Luna sobre cada complejo
  dsnTelemetria.value = telemetria_dsn(d);
  estacionActiva.value = estacionActivaDSN(dsnTelemetria.value);

  generarTimelineEstancia();
  actualizarLuzSolar3D();
  dibujarRadarHorizonte();
}

function actualizarLuzSolar3D() {
  if (!sceneManager) return;
  const azRad = efemerides.value.sol_az * (Math.PI / 180);
  const elRad = efemerides.value.sol_el * (Math.PI / 180);

  const x = RADIO_ORBITA_SOL * Math.cos(elRad) * Math.sin(azRad);
  const y = RADIO_ORBITA_SOL * Math.sin(elRad);
  const z = ROW_DIR * RADIO_ORBITA_SOL * Math.cos(elRad) * Math.cos(azRad);   // az 0 = arriba del mapa = filas decrecientes

  sceneManager.sunLight.position.set(x, y, z);
}

function dibujarRadarHorizonte() {
  if (!radarCanvas.value || !demDataCache || !horizonteActivo) return;
  const ctx = radarCanvas.value.getContext('2d');
  const w = radarCanvas.value.width;
  const h = radarCanvas.value.height;
  const cX = w / 2;
  const cY = h / 2;
  const rMax = w / 2 - 12;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  [0.33, 0.66, 1.0].forEach(f => {
    ctx.beginPath();
    ctx.arc(cX, cY, rMax * f, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.beginPath();
  ctx.moveTo(cX, cY - rMax); ctx.lineTo(cX, cY + rMax);
  ctx.moveTo(cX - rMax, cY); ctx.lineTo(cX + rMax, cY);
  ctx.stroke();

  const horiz = horizonteActivo;   // horizonte del PUNTO ACTIVO
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  for (let az = 0; az < 360; az++) {
    const rad = (az - 90) * (Math.PI / 180);
    const elev = horiz[az];
    const r = rMax * (1.0 - Math.min(30, elev) / 30);
    const x = cX + Math.cos(rad) * r;
    const y = cY + Math.sin(rad) * r;
    if (az === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  const sunRad = (efemerides.value.sol_az - 90) * (Math.PI / 180);
  const sunR = rMax * (1.0 - Math.max(0, Math.min(30, efemerides.value.sol_el)) / 30);
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(cX + Math.cos(sunRad) * sunR, cY + Math.sin(sunRad) * sunR, 5, 0, Math.PI * 2);
  ctx.fill();

  const earthRad = (efemerides.value.tierra_az - 90) * (Math.PI / 180);
  const earthR = rMax * (1.0 - Math.max(0, Math.min(30, efemerides.value.tierra_el)) / 30);
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.arc(cX + Math.cos(earthRad) * earthR, cY + Math.sin(earthRad) * earthR, 4, 0, Math.PI * 2);
  ctx.fill();
}

function inspeccionarSitio(sitio) {
  sitioActivo.value = sitio;
  gncCorredor.value = sitio.gnc;
  puntoActivo.value = { fila: sitio.fila, col: sitio.col };
  recalcularEfemérides();
  activeTab.value = 'viewer3d';

  if (!landingMarker || !sceneManager) return;

  const x = (sitio.col - COLS / 2) * MPC;
  const z = (sitio.fila - ROWS / 2) * MPC;
  const y = (demDataCache[sitio.fila * COLS + sitio.col] || 0) - terrainCenter.y;

  landingMarker.position.set(x, y, z);
  landingMarker.visible = true;

  if (glideslopeLine) sceneManager.scene.remove(glideslopeLine);
  const glideslopeGroup = new THREE.Group();
  const paso = pasoAzimut(AZIMUT_APROXIMACION + 180.0);   // dc: columnas (x), dr: filas (z)
  const distLlegadaM = 25000;
  const xOrigen = x + paso.dc * distLlegadaM;
  const zOrigen = z + paso.dr * distLlegadaM;
  const yOrigen = y + Math.tan(ANGULO_DESCENSO * (Math.PI / 180.0)) * distLlegadaM;

  const puntosTrayectoria = [new THREE.Vector3(xOrigen, yOrigen, zOrigen), new THREE.Vector3(x, y, z)];
  const trayectoriaGeo = new THREE.BufferGeometry().setFromPoints(puntosTrayectoria);
  const trayectoriaMat = new THREE.LineDashedMaterial({ color: 0xf59e0b, dashSize: 800, gapSize: 400 });
  const lineaVuelo = new THREE.Line(trayectoriaGeo, trayectoriaMat);
  lineaVuelo.computeLineDistances();
  glideslopeGroup.add(lineaVuelo);

  for (let d = 5000; d <= 20000; d += 5000) {
    const factor = d / distLlegadaM;
    const ringGeo = new THREE.RingGeometry(400, 500, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(x + (xOrigen - x) * factor, y + (yOrigen - y) * factor, z + (zOrigen - z) * factor);
    ring.lookAt(x, y, z);
    glideslopeGroup.add(ring);
  }
  glideslopeLine = glideslopeGroup;
  sceneManager.scene.add(glideslopeLine);

  sceneManager.controls.target.set(x, y, z);
  sceneManager.camera.position.set(x, y + 3500, z + 6500);
  sceneManager.controls.update();
}

function navegarAPOI(poi) {
  if (!sceneManager || !demDataCache) return;
  const p = geoToPixel(poi.lat, poi.lon, ROWS, COLS, MPC);
  const fila = Math.round(p.fila), col = Math.round(p.col);
  if (fila < 0 || fila >= ROWS || col < 0 || col >= COLS) return;

  // Update active point for telemetry
  puntoActivo.value = { fila, col };
  recalcularEfemérides();

  // Switch to 3D view if not already
  activeTab.value = 'viewer3d';

  // Position camera
  const x = (col - COLS / 2) * MPC;
  const z = (fila - ROWS / 2) * MPC;
  const y = (demDataCache[fila * COLS + col] || 0) - terrainCenter.y;

  if (landingMarker) {
    landingMarker.position.set(x, y, z);
    landingMarker.visible = true;
  }

  sceneManager.controls.target.set(x, y, z);
  sceneManager.camera.position.set(x, y + 5000, z + 10000);
  sceneManager.controls.update();

  // Highlight in legend (brief flash)
  const btn = document.querySelector(`button[title="${poi.desc}"]`);
  if (btn) { btn.style.boxShadow = '0 0 0 2px #f59e0b'; setTimeout(() => btn.style.boxShadow = '', 800); }
}

function exportMissionBrief() {
  const g = geoActivo();
  const dossier = {
    mission: "L-SEA Mission Brief (Space Apps 2026 prototype)",
    generatedAt: new Date().toISOString(),
    activePoint: { fila: puntoActivo.value.fila, col: puntoActivo.value.col, lat: g.lat, lon: g.lon },
    vehicleModel: { ...vehiculo.value, nota: 'illustrative values' },
    flightDynamics: {
      t0LandingDate: selectedDate.value,
      missionDurationDays: duracionEstancia.value,
      radiativeEquilibriumTemperature: thermalTelemetria.value,
      trnOpticalQuality: trnTelemetria.value,
      earthLineOfSight: libracionTelemetria.value,
      dsnMoonElevation: dsnTelemetria.value
    },
    candidateLandingSites: sitiosCandidatos.value,
    assumptions: [
      'One evaluation per day at the selected UTC hour',
      'Sun and Earth positions: truncated Meeus series (errors ~0.05 deg in elevation)',
      'Vertical Sun-facing solar panel; slope limits and vehicle data are illustrative',
      'Straight-line 12-degree glideslope with fixed approach azimuth',
      'Temperature: instantaneous radiative equilibrium, no regolith conduction'
    ]
  };

  const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `LSEA_MissionBrief_${selectedDate.value}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function crearEtiquetaPOI(nombre, fila, col) {
  const group = new THREE.Group();
  const x = (col - COLS / 2) * MPC;
  const z = (fila - ROWS / 2) * MPC;
  const ySuelo = (demDataCache[fila * COLS + col] || 0) - terrainCenter.y;
  const alturaMastil = 6000;

  const lineaGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, alturaMastil, 0)
  ]);
  const lineaMat = new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.7 });
  group.add(new THREE.Line(lineaGeo, lineaMat));

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(10, 15, 25, 0.9)';
  ctx.roundRect(8, 8, 496, 112, 16);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#3b82f6';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(nombre, 256, 74);

  const spriteMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.y = alturaMastil + 800;
  sprite.scale.set(8000, 2000, 1);
  group.add(sprite);

  group.position.set(x, ySuelo, z);
  return group;
}

function crearPuntosDeInteresRegionales() {
  if (!demDataCache) return;
  // Coordenadas de catálogos NASA/IAU/USGS. Polo sur lunar (80°S–90°S).
  // Incluye cráteres, montañas, sitios CLPS y PSR proxy.
  const pois = [
    // Cráteres principales (PSR candidates)
    ['Shackleton Crater', -89.9, 129.8],      // Polo sur, PSR floor
    ['Amundsen Crater', -84.5, 82.8],         // Gran cráter, piso PSR
    ['Scott Crater', -82.1, 53.2],            // Cerca del polo
    ['Faustini Crater', -87.3, 77.0],         // PSR candidate
    ['Shoemaker Crater', -88.1, 44.9],        // PSR floor
    ['Haworth Crater', -87.5, -5.0],          // PSR candidate
    ['Nobile Crater', -84.2, -28.5],          // VIPER landing site region
    ['Cabeus Crater', -84.9, -35.5],          // LCROSS impact, PSR
    ['Wiechert Crater', -85.5, -15.0],        // Degradado, piso plano
    ['Sverdrup Crater', -88.5, -110.0],       // Cerca del polo
    ['de Gerlache Crater', -88.3, -85.0],     // PSR rim
    ['Idel\'son Crater', -81.5, -110.0],      // Borde 80°S

    // Montes / Masas montañosas
    ['Malapert Mountain', -86.0, 0.1],        // Pico iluminado, CLPS target
    ['Leibnitz Beta', -83.5, 30.0],           // Macizo Leibniz
    ['Leibnitz Gamma', -82.0, 15.0],          // Macizo Leibniz
    ['Mons Malapert', -85.8, 355.0],          // Variante nombre Malapert

    // Sitios de interés CLPS / Artemis
    ['Connecting Ridge', -89.8, 45.0],        // Cresta Shackleton-de Gerlache
    ['Shackleton Rim Point A', -89.7, 0.0],   // Punto en borde Shackleton
    ['Shackleton Rim Point B', -89.7, 90.0],
    ['Shackleton Rim Point C', -89.7, 180.0],
    ['Shackleton Rim Point D', -89.7, 270.0],
    ['Nobile Rim', -84.0, -30.0],             // Candidato VIPER/CLPS
    ['Cabeus Rim', -84.5, -35.0],             // Acceso a PSR Cabeus

    // Otros puntos notables
    ['South Pole (90°S)', -90.0, 0.0],        // Polo geográfico exacto
    ['Amundsen Rim', -84.0, 85.0],            // Borde norte Amundsen
  ];
  for (const [nombre, lat, lon] of pois) {
    const p = geoToPixel(lat, lon, ROWS, COLS, MPC);
    const fila = Math.round(p.fila), col = Math.round(p.col);
    if (fila >= 0 && fila < ROWS && col >= 0 && col < COLS) {
      sceneManager.scene.add(crearEtiquetaPOI(nombre, fila, col));
    }
  }
}

function crearIndicadorAlunizaje() {
  const markerGroup = new THREE.Group();
  const pinMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });

  const conoGeo = new THREE.ConeGeometry(30, 1200, 16);
  conoGeo.rotateX(Math.PI);
  conoGeo.translate(0, 600, 0);
  markerGroup.add(new THREE.Mesh(conoGeo, pinMat));

  const cabezaGeo = new THREE.SphereGeometry(120, 16, 16);
  const cabeza = new THREE.Mesh(cabezaGeo, pinMat);
  cabeza.position.y = 1200;
  markerGroup.add(cabeza);

  const dianaGeo = new THREE.RingGeometry(150, 250, 32);
  dianaGeo.rotateX(-Math.PI / 2);
  const diana = new THREE.Mesh(dianaGeo, new THREE.MeshBasicMaterial({ color: 0xff2222, side: THREE.DoubleSide }));
  diana.position.y = 5;
  markerGroup.add(diana);

  return markerGroup;
}

let lastSimTick = performance.now();

function animate(now) {
  requestAnimationFrame(animate);

  if (isPlaying.value) {
    const intervaloMs = simSpeed.value === 3600 ? 50 : (simSpeed.value === 60 ? 150 : 600);
    if (now - lastSimTick > intervaloMs) {
      simHora.value++;
      if (simHora.value >= 24) {
        simHora.value = 0;
        const siguienteDia = new Date(new Date(selectedDate.value).getTime() + 86400000);
        selectedDate.value = siguienteDia.toISOString().split('T')[0];
      }
      recalcularEfemérides();
      lastSimTick = now;
    }
  }

  if (sceneManager) {
    sceneManager.controls.update();
    sceneManager.renderer.render(sceneManager.scene, sceneManager.camera);
  }
}
</script>