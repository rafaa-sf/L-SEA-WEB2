<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import Icon from './components/Icon.vue';

import { initScene } from './3d/scene.js';
import { createSoftwareView } from './3d/software.js';
import { loadBinaryDEM } from './3d/loader.js';
import { createTerrainMesh } from './3d/terrain.js';
import {
    generateReliefTexture,
    generateElevationTexture,
    generateSlopeTexture,
    generateIlluminationTexture
} from './3d/layers.js';

import { calcularEfemeridesMeeus, RADIO_SOL } from './core/astro.js';
import { calcular_potencia_electrica, telemetria_dsn, estacionActivaDSN, DSN_MIN_ELEVACION } from './core/power.js';
import {
    calculateSlopeDegrees,
    calculateHorizonProfile,
    isTargetVisible,
    gradienteLocal,
    clasificarPendiente
} from './core/engine.js';
import { pixelToGeo, geoToPixel, pasoAzimut, ROW_DIR } from './core/geo.js';
import { advanceClock } from './core/clock.js';
import { visibilidadDiaria } from './core/windows.js';
import {
    calculateRadiativeEquilibrium,
    evaluateGlideslopeCorridor,
    evaluateTrnFeasibility,
    evaluateLibrationRisk,
    AZIMUT_APROXIMACION,
    ANGULO_DESCENSO
} from './core/nasa_suite.js';
import { POIS, POI_TIPOS } from './core/pois.js';
import { LANDING_ELLIPSE, scoreDispersion, ellipseOutline } from './core/dispersion.js';

// ---------------------------------------------------------------------------
// Modelos de aterrizador. Valores ilustrativos, no especificaciones oficiales.
// ---------------------------------------------------------------------------
const LANDERS = {
    'nova-c': { label: 'Nova-C · Intuitive Machines', mastHeight: 3.0, solarArea: 2.5, baseLoad: 120, maxSlope: 8 },
    griffin: { label: 'Griffin · Astrobotic', mastHeight: 2.0, solarArea: 3.8, baseLoad: 210, maxSlope: 12 },
    hakuto: { label: 'HAKUTO-R M1 · ispace', mastHeight: 1.6, solarArea: 1.2, baseLoad: 85, maxSlope: 6 },
    hls: { label: 'Starship HLS · SpaceX', mastHeight: 16.0, solarArea: 25.0, baseLoad: 1800, maxSlope: 10 }
};

const SPEEDS = [
    { value: 1, label: '1x' },
    { value: 60, label: '60x' },
    { value: 3600, label: '3600x' }
];

const MISSION_EPOCH = Date.UTC(2026, 9, 8, 12, 0, 0);
const DEM_URL = '/data/lola_shackleton.bin';

// ---------------------------------------------------------------------------
// Input state
// ---------------------------------------------------------------------------
const activeTab = ref('plan');
const selectedDate = ref('2026-10-08');
const simHour = ref(12);
// Whole seconds inside the current simulated hour. The planner clock advances on
// this value, so 1x moves once per second instead of once per simulated hour.
const simSecond = ref(0);
const stayDays = ref(7);
const landerId = ref('nova-c');
const lander = ref({ ...LANDERS['nova-c'] });
const footprintM = ref(480);

const robustRanking = ref(true);
const ellipseMajor = ref(LANDING_ELLIPSE.semiMajorM);
const ellipseMinor = ref(LANDING_ELLIPSE.semiMinorM);

const overlayLayer = ref('pbr');
const exposure = ref(1.4);
const fillLight = ref(0.4);

// ---------------------------------------------------------------------------
// Execution state
// ---------------------------------------------------------------------------
const demLoaded = ref(false);
const loadError = ref('');
const bootError = ref('');
const sceneReady = ref(false);
const renderMode = ref('webgl');
const demBytes = ref('');
const demInfo = ref('');
const busy = ref(false);
const progressPct = ref(0);
const progressStatus = ref('Idle');
const candidates = ref([]);
const hasRun = ref(false);
const activeSiteId = ref(null);
const comparedSites = ref([]);
const showCompare = ref(false);

const poiMenuOpen = ref(false);
const poiQuery = ref('');
const poiType = ref('todos');
const activePoiName = ref('');

// ---------------------------------------------------------------------------
// Active point telemetry
// ---------------------------------------------------------------------------
const activeCell = ref({ fila: 1000, col: 1000 });
const ephemeris = ref({ sol_el: 0, sol_az: 0, tierra_el: 0, tierra_az: 0, sol_km: 0, tierra_km: 0, flujo: 1361 });
const sunVisible = ref(false);
const earthVisible = ref(false);
const power = ref({ bruta: 0, neta: 0, radiacion: 0 });
const thermal = ref({ kelvin: 0, celsius: 0, status: 'NOMINAL' });
const trn = ref({ score: 0, status: '', detail: '' });
const libration = ref({ status: '', marginDeg: '0', risk: 'LOW' });
const dsn = ref({});
const dsnStation = ref(null);
const gnc = ref({ clear: true, minMarginM: 500 });
const horizonMaxDeg = ref(0);
const timelineDays = ref([]);
const probe = ref(null);

const isPlaying = ref(false);
const simSpeed = ref(1);

// ---------------------------------------------------------------------------
// Referencias de escena
// ---------------------------------------------------------------------------
const canvas3d = ref(null);
const radarCanvas = ref(null);

let sceneManager = null;
let softwareView = null;
let softwareLayers = null;
let demData = null;
let terrainMesh = null;
let landingMarker = null;
let footprintRing = null;
let probeMarker = null;
let glideslopeGroup = null;
let terrainCenter = new THREE.Vector3();
let horizonProfile = null;
let horizonKey = '';
let illumData = null;
let illumKey = '';
let auditWorker = null;
let auditPending = false;
let pointerDown = { x: 0, y: 0 };
let textureRelief = null;
let textureElevation = null;
let textureSlope = null;
let textureIllumination = null;

let ROWS = 2000;
let COLS = 2000;
let MPC = 160;

const ILLUM_STEP = 8;
const LOD_DECIMATE = 4;
const SUN_ORBIT_RADIUS = 250000;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function fmt(n, digits = 1) {
    return Number.isFinite(n) ? n.toFixed(digits) : '—';
}

function textClass(nivel) {
    return nivel === 'HAZARD' ? 'is-bad' : nivel === 'CAUTION' ? 'is-warn' : 'is-ok';
}

function slopeClass(slope) {
    const max = lander.value.maxSlope;
    if (slope > max) return 'val-bad';
    if (slope > max * 0.75) return 'val-warn';
    return '';
}

// Colour follows the value of the score, not the slope that produced it.
function scoreClass(value) {
    if (value >= 70) return 'is-ok';
    if (value >= 45) return 'is-warn';
    return 'is-bad';
}

const sunClass = computed(() => (sunVisible.value ? 'is-ok' : 'is-bad'));
const earthClass = computed(() => (earthVisible.value ? 'is-ok' : 'is-bad'));

// ---------------------------------------------------------------------------
// Site catalogue
// ---------------------------------------------------------------------------
const filteredPois = computed(() => {
    const q = poiQuery.value.trim().toLowerCase();
    return POIS.filter((p) => {
        const byType = poiType.value === 'todos' || p.tipo === poiType.value;
        const byText = !q || p.nombre.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q);
        return byType && byText;
    });
});

const poiTypeCounts = computed(() =>
    POI_TIPOS.filter((t) => t.id !== 'todos').map((t) => ({
        ...t,
        count: POIS.filter((p) => p.tipo === t.id).length
    }))
);

function togglePoiMenu() {
    poiMenuOpen.value = !poiMenuOpen.value;
    if (poiMenuOpen.value) poiQuery.value = '';
}

function choosePoi(poi) {
    poiMenuOpen.value = false;
    activePoiName.value = poi.nombre;
    navigateToPoi(poi);
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------
const rankedCandidates = computed(() => {
    const key = robustRanking.value ? 'robustScore' : 'pointScore';
    return [...candidates.value]
        .sort((a, b) => b[key] - a[key])
        .slice(0, 5)
        .map((s, i) => ({ ...s, rank: i + 1 }));
});

const selectedSite = computed(() => {
    if (!rankedCandidates.value.length) return null;
    return rankedCandidates.value.find((s) => s.siteId === activeSiteId.value) || rankedCandidates.value[0];
});

const leadingMetric = computed(() => (robustRanking.value ? 'robustScore' : 'pointScore'));

// Summary of the 360-bearing skyline that the radar draws. `horizonMaxDeg` is
// read so the computed refreshes when ensureHorizon rebuilds the profile.
const horizonStats = computed(() => {
    void horizonMaxDeg.value;
    const profile = horizonProfile;
    if (!profile) return { peak: 0, peakAz: 0, mean: 0, blocked: 0, sunHorizon: 0 };
    let peak = -Infinity;
    let peakAz = 0;
    let sum = 0;
    let blocked = 0;
    for (let az = 0; az < 360; az++) {
        const value = profile[az];
        sum += value;
        if (value > peak) {
            peak = value;
            peakAz = az;
        }
        if (value > 1) blocked += 1;
    }
    const sunAz = ((Math.round(ephemeris.value.sol_az) % 360) + 360) % 360;
    return { peak, peakAz, mean: sum / 360, blocked, sunHorizon: profile[sunAz] };
});

const COMPARE_LIMIT = 5;

// Each metric knows how to read the candidate and which direction wins, so the
// comparison table works for two sites or five without special cases.
const COMPARE_METRICS = [
    { label: 'Suitability, point', get: (s) => s.pointScore, best: 'high', format: (x) => x.toFixed(1) },
    { label: 'Survival, dispersion', get: (s) => s.robustScore, best: 'high', format: (x) => x.toFixed(1) },
    { label: 'Ellipse coverage, percent', get: (s) => (s.dispersion ? s.dispersion.coverage * 100 : 0), best: 'high', format: (x) => Math.round(x) },
    { label: 'Footprint worst slope, deg', get: (s) => s.worstSlope, best: 'low', format: (x) => x.toFixed(1) },
    { label: 'Approach margin, m', get: (s) => s.gnc.minMarginM, best: 'high', format: (x) => Math.round(x) },
    { label: 'Sun, 30 days, percent', get: (s) => s.solPct, best: 'high', format: (x) => Math.round(x) },
    { label: 'Earth line of sight, percent', get: (s) => s.dtePct, best: 'high', format: (x) => Math.round(x) },
    { label: 'Equilibrium temperature, K', get: (s) => s.thermal.kelvin, best: 'low', format: (x) => Math.round(x) },
    { label: 'TRN feasibility', get: (s) => s.trn.score, best: 'high', format: (x) => Math.round(x) },
    { label: 'Elevation, m', get: (s) => s.altura, best: 'none', format: (x) => Math.round(x) }
];

const comparisonTable = computed(() => {
    if (comparedSites.value.length < 2) return [];
    return COMPARE_METRICS.map((metric) => {
        const values = comparedSites.value.map(metric.get);
        let bestIndex = -1;
        if (metric.best !== 'none') {
            const target = metric.best === 'high' ? Math.max(...values) : Math.min(...values);
            const hits = values.filter((v) => v === target).length;
            if (hits < values.length) bestIndex = values.indexOf(target);
        }
        return {
            label: metric.label,
            cells: comparedSites.value.map((site, i) => ({
                siteId: site.siteId,
                value: metric.format(values[i]),
                best: i === bestIndex
            }))
        };
    });
});

const comparisonVerdict = computed(() => {
    if (comparedSites.value.length < 2) return '';
    const metric = leadingMetric.value;
    const ordered = [...comparedSites.value].sort((a, b) => b[metric] - a[metric]);
    if (ordered[0][metric] === ordered[1][metric]) {
        return 'The current ranking does not separate these candidates.';
    }
    const label = robustRanking.value ? 'dispersion survival' : 'point suitability';
    return `Ranking prefers ${ordered[0].siteId} (${label} ${ordered[0][metric].toFixed(1)}) over ${ordered[1].siteId} (${ordered[1][metric].toFixed(1)}).`;
});

function isCompared(site) {
    return comparedSites.value.some((s) => s.siteId === site.siteId);
}

function toggleCompare(site) {
    if (isCompared(site)) {
        comparedSites.value = comparedSites.value.filter((s) => s.siteId !== site.siteId);
        return;
    }
    // Newest selection wins the last column; dropping the oldest keeps the table
    // readable instead of refusing the click without feedback.
    comparedSites.value = [...comparedSites.value, site].slice(-COMPARE_LIMIT);
}

function selectSite(site) {
    activeSiteId.value = site.siteId;
    gnc.value = site.gnc;
    activeCell.value = { fila: site.fila, col: site.col };
    recomputeEphemeris();
    updateSiteMarker(site);
}

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------
// Boot is split into independent halves: the WebGL scene, the audit worker and
// the DEM. A GPU or driver failure in one must not leave the planner without
// data, so each half is caught on its own and the failure is written to the
// status bar instead of dying silently in the console.
function reportBootError(cause) {
    const detail = cause && cause.message ? cause.message : String(cause);
    console.error('Boot failure:', cause);
    if (!bootError.value) bootError.value = detail;
}

function webgl2Available() {
    try {
        const probe = document.createElement('canvas');
        return !!(window.WebGL2RenderingContext && probe.getContext('webgl2'));
    } catch (err) {
        return false;
    }
}

// The 3D tab has two renderers: WebGL2 when the browser exposes a context, and a
// CPU raycaster otherwise. The GPU path is tried first and any failure downgrades
// to the software view, so the tab is never a dead black panel.
function bootScene() {
    if (webgl2Available()) {
        try {
            sceneManager = initScene(canvas3d.value);
            renderMode.value = 'webgl';
        } catch (err) {
            sceneManager = null;
            console.error('WebGL scene unavailable, falling back to the software renderer:', err);
        }
    }
    if (!sceneManager) renderMode.value = 'software';
    sceneReady.value = true;
    try {
        // The clock loop must run even when no renderer exists: the planner timeline
    // depends on it, and that is the whole app in a browser without WebGL2.
    requestAnimationFrame(animate);
    } catch (err) {
        reportBootError(err);
    }
}

function bootWorker() {
    try {
        auditWorker = new Worker(new URL('./core/autopilot.worker.js', import.meta.url), { type: 'module' });
        auditWorker.onmessage = handleWorkerMessage;
        auditWorker.onerror = (err) => {
            console.error('Worker execution failure:', err);
            busy.value = false;
            progressStatus.value = 'Worker failure';
        };
    } catch (err) {
        console.error('Worker instantiation failure:', err);
    }
}

async function bootTerrain() {
    try {
        const result = await loadBinaryDEM(DEM_URL, (loaded, total) => {
            const mb = (bytes) => (bytes / 1048576).toFixed(1);
            demBytes.value = total ? `${mb(loaded)} of ${mb(total)} MB` : `${mb(loaded)} MB`;
        });
        demData = result.data;
        ROWS = result.rows;
        COLS = result.cols;
        MPC = result.mpc;
        demInfo.value = `${ROWS} x ${COLS} / ${MPC} m per cell`;
        demLoaded.value = true;

        terrainMesh = createTerrainMesh(demData, ROWS, COLS, MPC, 1.0, LOD_DECIMATE);
        terrainMesh.geometry.computeBoundingBox();
        textureRelief = generateReliefTexture(demData, ROWS, COLS, MPC);
        terrainMesh.geometry.boundingBox.getCenter(terrainCenter);

        // Everything below needs a live renderer; the data itself does not.
        if (sceneManager) {
            terrainMesh.position.sub(terrainCenter);
            sceneManager.scene.add(terrainMesh);
            sceneManager.resize();
            setSurfaceTexture(textureRelief);

            landingMarker = createLandingMarker();
            landingMarker.visible = false;
            sceneManager.scene.add(landingMarker);

            probeMarker = createProbeBeacon();
            probeMarker.visible = false;
            sceneManager.scene.add(probeMarker);

            createCatalogueLabels();
            applyLighting();
        } else {
            softwareLayers = { relief: toLayerData(textureRelief) };
            softwareView = createSoftwareView(canvas3d.value, {
                dem: demData,
                rows: ROWS,
                cols: COLS,
                mpc: MPC,
                center: { x: terrainCenter.x, z: terrainCenter.z },
                ellipse: {
                    semiMajorM: ellipseMajor.value,
                    semiMinorM: ellipseMinor.value,
                    azimuthDeg: LANDING_ELLIPSE.azimuthDeg
                },
                layers: softwareLayers
            });
            softwareView.setCatalogue(catalogueCells());
            softwareView.setLighting(exposure.value, fillLight.value);
        }

        const shackleton = geoToPixel(-89.9, 129.8, ROWS, COLS, MPC);
        activeCell.value = { fila: Math.round(shackleton.fila), col: Math.round(shackleton.col) };

        recomputeEphemeris();
        drawHorizonRadar();
    } catch (err) {
        console.error('DEM load failure:', err);
        loadError.value = err && err.message ? err.message : String(err);
        progressStatus.value = 'DEM unavailable';
    }
}

function onWindowError(event) {
    if (event && event.message) reportBootError(event.message);
}

function onWindowRejection(event) {
    reportBootError(event && event.reason ? event.reason : 'Unhandled promise rejection');
}

onMounted(() => {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onWindowRejection);
    bootScene();
    bootWorker();
    bootTerrain();
});

onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('error', onWindowError);
    window.removeEventListener('unhandledrejection', onWindowRejection);
    if (auditWorker) auditWorker.terminate();
});

// The canvas lives in a v-show panel: while the Planning tab is up its host has
// zero size, so the renderer is only worth measuring once the view is shown.
let viewFramed = false;
watch(activeTab, async (tab) => {
    if (tab !== 'view') return;
    await nextTick();
    if (softwareView) {
        softwareView.resize();
        return;
    }
    if (!sceneManager) return;
    sceneManager.resize();
    if (!viewFramed) {
        viewFramed = true;
        resetCamera();
    }
});

watch([ellipseMajor, ellipseMinor], ([major, minor]) => {
    if (softwareView) softwareView.setEllipse(Number(major), Number(minor));
});

// A manual date or hour change restarts the second hand instead of inheriting a
// stale fractional offset from wherever the previous run stopped. Programmatic
// changes from the clock itself must not pass through here.
function resetClockFraction() {
    simSeconds = 0;
    simSecond.value = 0;
    frameClock = 0;
}

function onKeyDown(e) {
    if (e.key === 'Escape') {
        poiMenuOpen.value = false;
        showCompare.value = false;
        probe.value = null;
        if (probeMarker) probeMarker.visible = false;
    }
}

// ---------------------------------------------------------------------------
// Pipeline del worker
// ---------------------------------------------------------------------------
function handleWorkerMessage(e) {
    const data = e.data;

    if (data.type === 'PROGRESS') {
        progressPct.value = data.progress;
        progressStatus.value = data.status;
        return;
    }

    if (data.type === 'ILLUM_COMPLETE') {
        illumData = { data: data.illum, nr: data.nr, nc: data.nc, paso: data.paso };
        textureIllumination = generateIlluminationTexture(data.illum, data.nr, data.nc);
        if (overlayLayer.value === 'illumination' && terrainMesh) {
            setSurfaceTexture(textureIllumination);
        }
        if (auditPending) {
            auditPending = false;
            launchAudit();
        } else {
            progressPct.value = 100;
            setTimeout(() => { busy.value = false; }, 250);
        }
        return;
    }

    if (data.type === 'COMPLETE') {
        progressStatus.value = 'Refining candidates against site horizon and ephemeris';
        candidates.value = refineCandidates(data.candidates);
        hasRun.value = true;
        if (candidates.value.length) {
            activeSiteId.value = rankedCandidates.value[0].siteId;
            gnc.value = rankedCandidates.value[0].gnc;
            updateSiteMarker(rankedCandidates.value[0]);
        }
        progressPct.value = 100;
        setTimeout(() => { busy.value = false; }, 250);
        return;
    }

    if (data.type === 'ERROR') {
        console.error('Worker computation failed:', data.error);
        busy.value = false;
        auditPending = false;
        progressStatus.value = 'Computation failed';
    }
}

function illuminationKey() {
    return `${selectedDate.value}|${simHour.value}`;
}

function requestIllumination() {
    if (!demData || !auditWorker) return;
    busy.value = true;
    progressPct.value = 5;
    progressStatus.value = 'Starting illumination sweep';
    illumKey = illuminationKey();
    auditWorker.postMessage({
        task: 'ILLUMINATION',
        demData,
        rows: ROWS,
        cols: COLS,
        mpc: MPC,
        fechaISO: selectedDate.value,
        dias: 30,
        paso: ILLUM_STEP,
        hora: simHour.value
    });
}

function runEvaluation() {
    if (!demData || !auditWorker) return;
    if (!illumData || illumKey !== illuminationKey()) {
        auditPending = true;
        requestIllumination();
        return;
    }
    launchAudit();
}

function launchAudit() {
    busy.value = true;
    progressPct.value = 5;
    progressStatus.value = 'Starting terrain audit';
    auditWorker.postMessage({
        task: 'AUDIT',
        demData,
        rows: ROWS,
        cols: COLS,
        mpc: MPC,
        maxSlope: lander.value.maxSlope,
        footprintMeters: footprintM.value,
        illum: illumData.data,
        illumNr: illumData.nr,
        illumNc: illumData.nc,
        illumPaso: illumData.paso
    });
}

function slopeAt(fila, col) {
    if (!demData || fila < 0 || col < 0 || fila >= ROWS || col >= COLS) return NaN;
    return gradienteLocal(demData, ROWS, COLS, MPC, fila, col).slope;
}

function illuminationAt(fila, col) {
    if (!illumData) return 0;
    const i = Math.floor(fila / illumData.paso);
    const j = Math.floor(col / illumData.paso);
    if (i < 0 || j < 0 || i >= illumData.nr || j >= illumData.nc) return 0;
    return illumData.data[i * illumData.nc + j];
}

// Re-score the worker pool with the real site horizon, its own ephemeris and
// the survival of the contact ellipse (landing dispersion).
function refineCandidates(pool) {
    const start = new Date(`${selectedDate.value}T00:00:00Z`);
    const moment = new Date(`${selectedDate.value}T00:00:00Z`);
    moment.setUTCHours(simHour.value);

    const maxSlope = lander.value.maxSlope;
    const ellipse = {
        semiMajorM: ellipseMajor.value,
        semiMinorM: ellipseMinor.value,
        azimuthDeg: LANDING_ELLIPSE.azimuthDeg
    };

    const refined = pool.map((s, index) => {
        const vis = visibilidadDiaria(
            demData, ROWS, COLS, MPC, s.fila, s.col,
            start, 30, simHour.value, lander.value.mastHeight
        );
        const geo = vis.geo;
        const ef = calcularEfemeridesMeeus(moment, geo.lat, geo.lon, geo.rumbo);
        const local = gradienteLocal(demData, ROWS, COLS, MPC, s.fila, s.col);
        const sunSeen = isTargetVisible(ef.sol_el, ef.sol_az, vis.horizonte, RADIO_SOL);
        const temperature = calculateRadiativeEquilibrium({
            solEl: ef.sol_el,
            solAz: ef.sol_az,
            dzdx: local.dzdx,
            dzdrow: local.dzdrow,
            sunVisible: sunSeen,
            flux: ef.flujo
        });

        const dispersion = scoreDispersion({
            fila: s.fila,
            col: s.col,
            mpc: MPC,
            maxSlope,
            ellipse: ellipse,
            slopeAt,
            illumAt: illuminationAt
        });

        const pointScore = 100 * (0.6 * s.safety + 0.4 * (vis.sol_pct / 100));
        const worstSlope = dispersion ? dispersion.worstSlope : s.worstSlope;
        const approach = s.gnc || evaluateGlideslopeCorridor(demData, ROWS, COLS, MPC, s.fila, s.col, AZIMUT_APROXIMACION, ANGULO_DESCENSO);

        return {
            siteId: `C-${String(index + 1).padStart(2, '0')}`,
            fila: s.fila,
            col: s.col,
            altura: s.altura,
            lat: geo.lat,
            lon: geo.lon,
            worstSlope,
            pointSafety: s.safety,
            pointScore: Math.round(pointScore * 10) / 10,
            robustScore: dispersion ? dispersion.score : 0,
            dispersion,
            solPct: Math.round(vis.sol_pct),
            dtePct: Math.round(vis.dte_pct),
            thermal: temperature,
            trn: evaluateTrnFeasibility(demData, ROWS, COLS, MPC, s.fila, s.col, ef.sol_el),
            gnc: approach,
            safety: clasificarPendiente(worstSlope, maxSlope)
        };
    });

    return refined;
}

// ---------------------------------------------------------------------------
// Ajustes de entrada
// ---------------------------------------------------------------------------
function applyLander() {
    lander.value = { ...LANDERS[landerId.value] };
    candidates.value = [];
    hasRun.value = false;
    textureSlope = null;
    recomputeEphemeris();
}

function setLayer(layer) {
    if (!terrainMesh || !demData) return;
    overlayLayer.value = layer;

    if (layer === 'pbr') {
        if (!textureRelief && demData) textureRelief = generateReliefTexture(demData, ROWS, COLS, MPC);
        if (textureRelief) setSurfaceTexture(textureRelief);
        return;
    }

    if (layer === 'elevation') {
        if (!textureElevation) textureElevation = generateElevationTexture(demData, ROWS, COLS);
        setSurfaceTexture(textureElevation);
        return;
    }

    if (layer === 'slope') {
        if (!textureSlope) {
            const slopes = calculateSlopeDegrees(demData, ROWS, COLS, MPC);
            textureSlope = generateSlopeTexture(slopes, ROWS, COLS, lander.value.maxSlope);
        }
        setSurfaceTexture(textureSlope);
        return;
    }

    if (layer === 'illumination') {
        if (!textureIllumination) {
            requestIllumination();
            return;
        }
        setSurfaceTexture(textureIllumination);
    }
}

function toLayerData(texture) {
    const image = texture && texture.image;
    if (!image || !image.data) return null;
    return { width: image.width, height: image.height, data: image.data };
}

function layerIdOf(texture) {
    if (texture === textureRelief) return 'relief';
    if (texture === textureElevation) return 'elevation';
    if (texture === textureSlope) return 'slope';
    if (texture === textureIllumination) return 'illumination';
    return null;
}

function setSurfaceTexture(texture) {
    if (sceneManager && terrainMesh) {
        terrainMesh.material.map = texture;
        terrainMesh.material.color.setHex(0xffffff);
        terrainMesh.material.needsUpdate = true;
    }
    if (softwareView && texture) {
        const id = layerIdOf(texture);
        const data = id ? toLayerData(texture) : null;
        if (id && data) {
            softwareLayers[id] = data;
            softwareView.setLayer(id === 'relief' ? 'pbr' : id);
        }
    }
}

function applyLighting() {
    if (softwareView) softwareView.setLighting(exposure.value, fillLight.value);
    if (!sceneManager) return;
    sceneManager.renderer.toneMappingExposure = exposure.value;
    if (sceneManager.ambientLight) sceneManager.ambientLight.intensity = fillLight.value;
}

function resetCamera() {
    if (softwareView) {
        softwareView.reset();
        return;
    }
    if (!sceneManager) return;
    sceneManager.controls.target.set(0, 0, 0);
    sceneManager.camera.position.set(456000, 396000, 720000);
    sceneManager.controls.update();
}

function togglePlay() {
    isPlaying.value = !isPlaying.value;
    frameClock = 0;
}

// ---------------------------------------------------------------------------
// Active point telemetry
// ---------------------------------------------------------------------------
function activeGeo() {
    return pixelToGeo(activeCell.value.fila, activeCell.value.col, ROWS, COLS, MPC);
}

function ensureHorizon() {
    const { fila, col } = activeCell.value;
    const key = `${fila}|${col}|${lander.value.mastHeight}`;
    if (key !== horizonKey && demData) {
        horizonProfile = calculateHorizonProfile(demData, ROWS, COLS, MPC, fila, col, lander.value.mastHeight);
        horizonKey = key;
        let peak = 0;
        for (let i = 0; i < horizonProfile.length; i++) {
            if (horizonProfile[i] > peak) peak = horizonProfile[i];
        }
        horizonMaxDeg.value = Math.round(peak * 10) / 10;
    }
}

function recomputeEphemeris() {
    if (!demData) return;
    ensureHorizon();

    const geo = activeGeo();
    const moment = new Date(`${selectedDate.value}T00:00:00Z`);
    moment.setUTCHours(simHour.value);

    const ef = calcularEfemeridesMeeus(moment, geo.lat, geo.lon, geo.rumbo);
    ephemeris.value = ef;

    const sunSeen = isTargetVisible(ef.sol_el, ef.sol_az, horizonProfile, RADIO_SOL);
    const earthSeen = isTargetVisible(ef.tierra_el, ef.tierra_az, horizonProfile, 0);
    sunVisible.value = sunSeen;
    earthVisible.value = earthSeen;

    power.value = calcular_potencia_electrica(sunSeen, ef.sol_el, lander.value.solarArea, 0.29, lander.value.baseLoad, 'vertical', ef.flujo);

    const local = gradienteLocal(demData, ROWS, COLS, MPC, activeCell.value.fila, activeCell.value.col);
    thermal.value = calculateRadiativeEquilibrium({
        solEl: ef.sol_el,
        solAz: ef.sol_az,
        dzdx: local.dzdx,
        dzdrow: local.dzdrow,
        sunVisible: sunSeen,
        flux: ef.flujo
    });
    trn.value = evaluateTrnFeasibility(demData, ROWS, COLS, MPC, activeCell.value.fila, activeCell.value.col, ef.sol_el);

    const azimuthIndex = ((Math.round(ef.tierra_az) % 360) + 360) % 360;
    libration.value = evaluateLibrationRisk(ef.tierra_el - horizonProfile[azimuthIndex], earthSeen);

    dsn.value = telemetria_dsn(moment);
    dsnStation.value = estacionActivaDSN(dsn.value);

    buildTimeline();
    placeSunLight();
    drawHorizonRadar();
}

function buildTimeline() {
    if (!demData) return;
    ensureHorizon();
    const { fila, col } = activeCell.value;
    const start = new Date(`${selectedDate.value}T00:00:00Z`);
    const vis = visibilidadDiaria(
        demData, ROWS, COLS, MPC, fila, col,
        start, stayDays.value, simHour.value,
        lander.value.mastHeight, horizonProfile
    );
    const days = [];
    for (let i = 0; i < stayDays.value; i++) {
        days.push({ day: i + 1, sun: vis.sol[i] === 1, earth: vis.dte[i] === 1 });
    }
    timelineDays.value = days;
}

function jumpToNextWindow() {
    if (!demData) return;
    ensureHorizon();
    const { fila, col } = activeCell.value;
    const start = new Date(`${selectedDate.value}T00:00:00Z`);
    const vis = visibilidadDiaria(
        demData, ROWS, COLS, MPC, fila, col,
        new Date(start.getTime() + 86400000), 35, simHour.value,
        lander.value.mastHeight, horizonProfile
    );
    for (let i = 0; i < 35; i++) {
        if (vis.dte[i] === 1) {
            selectedDate.value = new Date(start.getTime() + (i + 1) * 86400000).toISOString().slice(0, 10);
            simSecond.value = 0;
            simSeconds = 0;
            recomputeEphemeris();
            return;
        }
    }
}

function placeSunLight() {
    if (!sceneManager) return;
    const az = ephemeris.value.sol_az * (Math.PI / 180);
    // The real Sun never clears ~2 deg at the south pole; lighting the relief
    // from that angle erases every landform, so the lamp is lifted for
    // legibility. The physical Sun angle is what the Sun/Earth columns and the
    // illumination layer report.
    const elDeg = Math.max(ephemeris.value.sol_el, 14);
    const el = elDeg * (Math.PI / 180);
    const x = SUN_ORBIT_RADIUS * Math.cos(el) * Math.sin(az);
    const y = SUN_ORBIT_RADIUS * Math.sin(el);
    const z = ROW_DIR * SUN_ORBIT_RADIUS * Math.cos(el) * Math.cos(az);
    sceneManager.sunLight.position.set(x, y, z);
    if (sceneManager.renderer && sceneManager.renderer.shadowMap) {
        sceneManager.renderer.shadowMap.needsUpdate = true;
    }
}

function drawHorizonRadar() {
    if (!radarCanvas.value || !demData || !horizonProfile) return;
    const canvas = radarCanvas.value;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cX = w / 2;
    const cY = h / 2;
    const rMax = w / 2 - 10;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.lineWidth = 1;
    [0.33, 0.66, 1.0].forEach((f) => {
        ctx.beginPath();
        ctx.arc(cX, cY, rMax * f, 0, Math.PI * 2);
        ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(cX, cY - rMax);
    ctx.lineTo(cX, cY + rMax);
    ctx.moveTo(cX - rMax, cY);
    ctx.lineTo(cX + rMax, cY);
    ctx.stroke();

    // Bearing labels and the two inner rings, so the plot reads without the legend.
    ctx.font = '8px "Cascadia Mono", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(138, 148, 161, 0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cX, cY - rMax - 5);
    ctx.fillText('S', cX, cY + rMax + 5);
    ctx.fillText('E', cX + rMax + 6, cY);
    ctx.fillText('W', cX - rMax - 6, cY);
    ctx.fillText('10', cX + rMax * 0.66 + 8, cY - 7);
    ctx.fillText('20', cX + rMax * 0.33 + 8, cY - 7);

    ctx.strokeStyle = 'rgba(79, 154, 209, 0.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let az = 0; az < 360; az++) {
        const rad = (az - 90) * (Math.PI / 180);
        const r = rMax * (1 - Math.min(30, horizonProfile[az]) / 30);
        const x = cX + Math.cos(rad) * r;
        const y = cY + Math.sin(rad) * r;
        if (az === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    const sunRad = (ephemeris.value.sol_az - 90) * (Math.PI / 180);
    const sunR = rMax * (1 - Math.max(0, Math.min(30, ephemeris.value.sol_el)) / 30);
    ctx.fillStyle = '#c9a04a';
    ctx.beginPath();
    ctx.arc(cX + Math.cos(sunRad) * sunR, cY + Math.sin(sunRad) * sunR, 4.5, 0, Math.PI * 2);
    ctx.fill();

    const earthRad = (ephemeris.value.tierra_az - 90) * (Math.PI / 180);
    const earthR = rMax * (1 - Math.max(0, Math.min(30, ephemeris.value.tierra_el)) / 30);
    ctx.fillStyle = '#4f9ad1';
    ctx.beginPath();
    ctx.arc(cX + Math.cos(earthRad) * earthR, cY + Math.sin(earthRad) * earthR, 3.5, 0, Math.PI * 2);
    ctx.fill();
}

// ---------------------------------------------------------------------------
// Sondeo sobre el terreno
// ---------------------------------------------------------------------------
function onPointerDown(e) {
    pointerDown = { x: e.clientX, y: e.clientY };
}

function onCanvasClick(e) {
    if (Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 5) return;
    if (!demData || !canvas3d.value) return;

    if (softwareView) {
        const hit = softwareView.pick(e.clientX, e.clientY);
        if (!hit) return;
        showProbeAt(hit.fila, hit.col);
        return;
    }
    if (!terrainMesh || !sceneManager) return;

    const rect = canvas3d.value.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, sceneManager.camera);
    terrainMesh.updateMatrixWorld();
    const hits = raycaster.intersectObject(terrainMesh);
    if (!hits.length) return;

    const point = hits[0].point;
    const col = Math.round((point.x + terrainCenter.x) / MPC + COLS / 2);
    const fila = Math.round((point.z + terrainCenter.z) / MPC + ROWS / 2);
    showProbeAt(fila, col);
}

function showProbeAt(fila, col) {
    if (fila < 1 || fila >= ROWS - 1 || col < 1 || col >= COLS - 1) return;

    const elevation = Math.round(demData[fila * COLS + col] || 0);
    const local = gradienteLocal(demData, ROWS, COLS, MPC, fila, col);
    const slope = Math.round(local.slope * 10) / 10;

    activeCell.value = { fila, col };
    activePoiName.value = '';
    recomputeEphemeris();

    probe.value = {
        code: 'PROBE',
        geo: activeGeo(),
        elevation,
        slope,
        safety: clasificarPendiente(slope, lander.value.maxSlope)
    };

    if (softwareView) {
        softwareView.setProbe({ fila, col });
        return;
    }
    if (probeMarker) {
        probeMarker.position.set(
            (col - COLS / 2) * MPC,
            elevation - terrainCenter.y,
            (fila - ROWS / 2) * MPC
        );
        probeMarker.visible = true;
    }
}

function closeProbe() {
    probe.value = null;
    if (softwareView) softwareView.setProbe(null);
    if (probeMarker) probeMarker.visible = false;
}

// ---------------------------------------------------------------------------
// Objetos de escena
// ---------------------------------------------------------------------------
function createLandingMarker() {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0x4f9ad1 });

    const mast = new THREE.ConeGeometry(30, 1200, 12);
    mast.rotateX(Math.PI);
    mast.translate(0, 600, 0);
    group.add(new THREE.Mesh(mast, material));

    const head = new THREE.Mesh(new THREE.SphereGeometry(90, 12, 12), material);
    head.position.y = 1240;
    group.add(head);

    const ring = new THREE.RingGeometry(130, 170, 40);
    ring.rotateX(-Math.PI / 2);
    const ringMesh = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0x4f9ad1, side: THREE.DoubleSide }));
    ringMesh.position.y = 6;
    group.add(ringMesh);

    return group;
}

function createProbeBeacon() {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0xc9a04a });
    const mast = new THREE.ConeGeometry(22, 900, 12);
    mast.rotateX(Math.PI);
    mast.translate(0, 450, 0);
    group.add(new THREE.Mesh(mast, material));
    const head = new THREE.Mesh(new THREE.SphereGeometry(70, 12, 12), material);
    head.position.y = 940;
    group.add(head);
    return group;
}

function updateSiteMarker(site) {
    if (!demData) return;
    if (softwareView) {
        softwareView.setSite({ fila: site.fila, col: site.col, siteId: site.siteId });
        return;
    }
    if (!sceneManager) return;

    const x = (site.col - COLS / 2) * MPC;
    const z = (site.fila - ROWS / 2) * MPC;
    const y = (demData[site.fila * COLS + site.col] || 0) - terrainCenter.y;

    if (landingMarker) {
        landingMarker.position.set(x, y, z);
        landingMarker.visible = true;
    }

    drawFootprintRing(site);

    if (glideslopeGroup) {
        sceneManager.scene.remove(glideslopeGroup);
        glideslopeGroup = null;
    }
    glideslopeGroup = buildApproachPath(x, y, z);
    sceneManager.scene.add(glideslopeGroup);
}

function drawFootprintRing(site) {
    if (!sceneManager || !demData) return;
    if (footprintRing) {
        sceneManager.scene.remove(footprintRing);
        footprintRing.geometry.dispose();
        footprintRing = null;
    }

    const ellipse = {
        semiMajorM: ellipseMajor.value,
        semiMinorM: ellipseMinor.value,
        azimuthDeg: LANDING_ELLIPSE.azimuthDeg
    };
    const outline = ellipseOutline(site.fila, site.col, MPC, ellipse, 64);
    const points = outline.map((p) => {
        const fila = Math.round(p.fila);
        const col = Math.round(p.col);
        const inside = fila >= 0 && col >= 0 && fila < ROWS && col < COLS;
        const height = inside ? demData[fila * COLS + col] || 0 : site.altura;
        return new THREE.Vector3(
            (p.col - COLS / 2) * MPC,
            height - terrainCenter.y + 25,
            (p.fila - ROWS / 2) * MPC
        );
    });

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    footprintRing = new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color: 0x4f9ad1, transparent: true, opacity: 0.85 }));
    sceneManager.scene.add(footprintRing);
}

function buildApproachPath(x, y, z) {
    const group = new THREE.Group();
    const step = pasoAzimut(AZIMUT_APROXIMACION + 180.0);
    const distance = 25000;
    const originX = x + step.dc * distance;
    const originZ = z + step.dr * distance;
    const originY = y + Math.tan(ANGULO_DESCENSO * (Math.PI / 180.0)) * distance;

    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(originX, originY, originZ),
        new THREE.Vector3(x, y, z)
    ]);
    const material = new THREE.LineDashedMaterial({ color: 0xc9a04a, dashSize: 800, gapSize: 500 });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    group.add(line);

    for (let d = 5000; d <= 20000; d += 5000) {
        const f = d / distance;
        const ringGeometry = new THREE.RingGeometry(320, 400, 28);
        const ring = new THREE.Mesh(
            ringGeometry,
            new THREE.MeshBasicMaterial({ color: 0xc9a04a, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
        );
        ring.position.set(x + (originX - x) * f, y + (originY - y) * f, z + (originZ - z) * f);
        ring.lookAt(x, y, z);
        group.add(ring);
    }

    return group;
}

function createSiteLabel(text, fila, col) {
    const group = new THREE.Group();
    const x = (col - COLS / 2) * MPC;
    const z = (fila - ROWS / 2) * MPC;
    const groundY = (demData[fila * COLS + col] || 0) - terrainCenter.y;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(18, 21, 25, 0.92)';
    ctx.beginPath();
    ctx.roundRect(4, 8, 504, 80, 3);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#363d47';
    ctx.stroke();
    ctx.fillStyle = '#c8d0da';
    ctx.font = '500 34px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 50);

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvas),
        depthTest: false,
        transparent: true,
        // fixed on-screen size: a 6000 m sprite would be six pixels wide from the
        // opening framing, and a catalogue you cannot read is not a catalogue
        sizeAttenuation: false
    }));
    sprite.position.y = 900;
    sprite.scale.set(0.19, 0.036, 1);
    group.add(sprite);

    group.position.set(x, groundY, z);
    return group;
}

function catalogueCells() {
    const cells = [];
    for (const poi of POIS) {
        const p = geoToPixel(poi.lat, poi.lon, ROWS, COLS, MPC);
        const fila = Math.round(p.fila);
        const col = Math.round(p.col);
        if (fila >= 0 && fila < ROWS && col >= 0 && col < COLS) cells.push({ fila, col });
    }
    return cells;
}

function createCatalogueLabels() {
    if (!demData || !sceneManager) return;
    for (const poi of POIS) {
        const p = geoToPixel(poi.lat, poi.lon, ROWS, COLS, MPC);
        const fila = Math.round(p.fila);
        const col = Math.round(p.col);
        if (fila >= 0 && fila < ROWS && col >= 0 && col < COLS) {
            sceneManager.scene.add(createSiteLabel(poi.nombre, fila, col));
        }
    }
}

function inspectSelectedSite() {
    const site = selectedSite.value;
    activeTab.value = 'view';
    if (!site || !demData) return;
    if (softwareView) {
        softwareView.focus(site.fila, site.col);
        return;
    }
    if (!sceneManager) return;
    const x = (site.col - COLS / 2) * MPC;
    const z = (site.fila - ROWS / 2) * MPC;
    const y = (demData[site.fila * COLS + site.col] || 0) - terrainCenter.y;
    sceneManager.controls.target.set(x, y, z);
    sceneManager.camera.position.set(x, y + 5000, z + 10000);
    sceneManager.controls.update();
}

function navigateToPoi(poi) {
    if (!demData) return;
    const p = geoToPixel(poi.lat, poi.lon, ROWS, COLS, MPC);
    const fila = Math.round(p.fila);
    const col = Math.round(p.col);
    if (fila < 0 || fila >= ROWS || col < 0 || col >= COLS) return;

    activeCell.value = { fila, col };
    recomputeEphemeris();
    activeTab.value = 'view';

    if (softwareView) {
        softwareView.focus(fila, col);
        return;
    }
    if (!sceneManager) return;

    const x = (col - COLS / 2) * MPC;
    const z = (fila - ROWS / 2) * MPC;
    const y = (demData[fila * COLS + col] || 0) - terrainCenter.y;

    if (landingMarker) {
        landingMarker.position.set(x, y, z);
        landingMarker.visible = true;
    }

    sceneManager.controls.target.set(x, y, z);
    sceneManager.camera.position.set(x, y + 5000, z + 10000);
    sceneManager.controls.update();
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
function exportBrief() {
    const geo = activeGeo();
    const brief = {
        mission: 'L-SEA mission brief (Space Apps 2026 prototype)',
        generatedAt: new Date().toISOString(),
        dem: { rows: ROWS, cols: COLS, metersPerCell: MPC, source: 'LOLA 80S reduction' },
        activePoint: { row: activeCell.value.fila, col: activeCell.value.col, lat: geo.lat, lon: geo.lon },
        landerModel: { ...lander.value, note: 'illustrative values' },
        landingDispersion: {
            semiMajorM: ellipseMajor.value,
            semiMinorM: ellipseMinor.value,
            azimuthDeg: LANDING_ELLIPSE.azimuthDeg,
            samples: 37,
            ranking: robustRanking.value ? 'ellipse survival' : 'point suitability'
        },
        flightDynamics: {
            t0LandingDate: selectedDate.value,
            missionDurationDays: stayDays.value,
            radiativeEquilibriumTemperature: thermal.value,
            trnOpticalQuality: trn.value,
            earthLineOfSight: libration.value,
            dsnMoonElevation: dsn.value
        },
        candidateLandingSites: rankedCandidates.value,
        assumptions: [
            'One evaluation per day at the selected UTC hour',
            'Sun and Earth positions: truncated Meeus series, errors near 0.05 degrees in elevation',
            'Vertical Sun-facing solar panel; slope limits and lander data are illustrative',
            'Straight-line 12 degree glideslope at a fixed approach azimuth',
            'Temperature: instantaneous radiative equilibrium, no regolith conduction',
            'Landing dispersion: 37 contact points on a 3-sigma ellipse, weighted 60 percent slope safety and 40 percent illumination'
        ]
    };

    const blob = new Blob([JSON.stringify(brief, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LSEA_MissionBrief_${selectedDate.value}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Mission clock
// ---------------------------------------------------------------------------
const metClock = computed(() => {
    void simHour.value;
    const current = Date.UTC(
        Number(selectedDate.value.slice(0, 4)),
        Number(selectedDate.value.slice(5, 7)) - 1,
        Number(selectedDate.value.slice(8, 10)),
        simHour.value,
        0,
        simSecond.value
    );
    let delta = Math.round((current - MISSION_EPOCH) / 1000);
    const sign = delta < 0 ? '-' : '+';
    delta = Math.abs(delta);
    const days = Math.floor(delta / 86400);
    const hours = Math.floor((delta % 86400) / 3600);
    const minutes = Math.floor((delta % 3600) / 60);
    const seconds = delta % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `T${sign}${String(days).padStart(3, '0')}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
});

const metRunning = computed(() => isPlaying.value);

// Wall-clock bookkeeping for the simulated clock. `frameClock` is the previous
// animation timestamp (0 forces a re-sync), `simSeconds` is the exact fractional
// second inside the current simulated hour, and `lastClockPush` throttles the
// reactive write so a 3600x run does not re-render the panel sixty times a second.
let frameClock = 0;
let simSeconds = 0;
let lastClockPush = 0;

// Applies the pure clock result to the refs and recomputes once per hour boundary.
function applyClock(step) {
    if (step.dayShift > 0) {
        const next = new Date(new Date(`${selectedDate.value}T00:00:00Z`).getTime() + step.dayShift * 86400000);
        selectedDate.value = next.toISOString().slice(0, 10);
    }
    simHour.value = step.hour;
    simSeconds = step.second;
    recomputeEphemeris();
}

function animate(now) {
    requestAnimationFrame(animate);

    const dt = frameClock ? Math.min(0.5, (now - frameClock) / 1000) : 0;
    frameClock = now;

    if (isPlaying.value && dt > 0) {
        const step = advanceClock(simHour.value, simSeconds, dt, simSpeed.value);
        if (step.dayShift > 0 || step.hour !== simHour.value) applyClock(step);
        else simSeconds = step.second;

        if (now - lastClockPush >= 100) {
            simSecond.value = Math.floor(simSeconds);
            lastClockPush = now;
        }
    }

    if (sceneManager && activeTab.value === 'view') {
        sceneManager.controls.update();
        sceneManager.renderer.render(sceneManager.scene, sceneManager.camera);
    }
}
</script>

<template>
    <div class="app">
        <header class="topbar">
            <div class="brand">
                <Icon name="mountain" :size="18" />
                <span class="brand-name">L-SEA</span>
                <span class="brand-sub">Lunar Site Evaluation</span>
            </div>

            <nav class="tabs">
                <button class="tab" :class="{ 'is-on': activeTab === 'plan' }" @click="activeTab = 'plan'">
                    <Icon name="grid" :size="14" /> Planning
                </button>
                <button class="tab" :class="{ 'is-on': activeTab === 'view' }" @click="activeTab = 'view'">
                    <Icon name="cube" :size="14" /> 3D view
                </button>
            </nav>

            <span class="spacer"></span>

            <button class="btn" @click.stop="togglePoiMenu">
                <Icon name="globe" :size="14" />
                <span>{{ activePoiName || 'Select site' }}</span>
            </button>
            <button class="btn" :disabled="!demLoaded" @click="exportBrief">
                <Icon name="download" :size="14" /> Export brief
            </button>
            <span class="tag" :class="busy ? 'tag--warn' : 'tag--ok'">
                <span class="status-dot" :class="{ 'is-busy': busy }"></span>
                {{ busy ? 'COMPUTING' : 'READY' }}
            </span>
        </header>

        <div v-if="poiMenuOpen" class="dropdown dropdown--fixed" @click.stop>
            <div class="dropdown__search">
                <Icon name="search" :size="13" />
                <input v-model="poiQuery" type="text" placeholder="Search catalogue" />
            </div>
            <div class="chips">
                <button
                    v-for="t in POI_TIPOS"
                    :key="t.id"
                    class="chip"
                    :class="{ 'is-on': poiType === t.id }"
                    @click="poiType = t.id">
                    {{ t.etiqueta }}
                </button>
            </div>
            <div class="poi-list">
                <button v-for="p in filteredPois" :key="p.codigo" class="poi-item" @click="choosePoi(p)">
                    <span class="poi-item__code">{{ p.codigo }}</span>
                    <span>
                        <span class="poi-item__name">{{ p.nombre }}</span>
                        <span class="poi-item__desc">{{ p.desc }}</span>
                    </span>
                    <span class="poi-item__coord">{{ p.lat.toFixed(1) }} / {{ p.lon.toFixed(1) }}</span>
                </button>
                <div v-if="!filteredPois.length" class="empty" style="padding: 18px">
                    <span class="empty__text">No site matches this filter.</span>
                </div>
            </div>
        </div>

        <div class="workspace">
            <!-- ------------------------------------------------------------------
                 PLANNING
            ------------------------------------------------------------------ -->
            <div v-show="activeTab === 'plan'" class="planner">
                <aside class="rail">
                    <section class="panel">
                        <div class="panel__head">
                            <Icon name="clock" :size="14" />
                            <span class="panel__title">Surface conditions</span>
                        </div>
                        <div class="panel__body">
                            <div class="field">
                                <label for="date">Landing date, UTC</label>
                                <input id="date" v-model="selectedDate" class="mono" type="date" @change="resetClockFraction(); recomputeEphemeris()" />
                            </div>
                            <div class="field">
                                <label for="hour">Local evaluation hour</label>
                                <select id="hour" v-model.number="simHour" class="mono" @change="resetClockFraction(); recomputeEphemeris()">
                                    <option v-for="h in 24" :key="h" :value="h - 1">{{ String(h - 1).padStart(2, '0') }}:00</option>
                                </select>
                            </div>
                            <div class="field">
                                <label for="stay">Surface stay</label>
                                <select id="stay" v-model.number="stayDays" class="mono" @change="buildTimeline">
                                    <option v-for="d in 14" :key="d" :value="d">{{ d }} days</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    <section class="panel">
                        <div class="panel__head">
                            <Icon name="cube" :size="14" />
                            <span class="panel__title">Lander model</span>
                        </div>
                        <div class="panel__body">
                            <div class="field">
                                <label for="lander">Vehicle</label>
                                <select id="lander" v-model="landerId" @change="applyLander">
                                    <option v-for="(l, id) in LANDERS" :key="id" :value="id">{{ l.label }}</option>
                                </select>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Slope limit</span>
                                <span class="kv__v">{{ lander.maxSlope.toFixed(1) }} deg</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Mast height</span>
                                <span class="kv__v">{{ lander.mastHeight.toFixed(1) }} m</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Solar area</span>
                                <span class="kv__v">{{ lander.solarArea.toFixed(1) }} m2</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Base load</span>
                                <span class="kv__v">{{ lander.baseLoad }} W</span>
                            </div>
                            <div class="field-row" style="margin-top: 9px">
                                <span>Footprint radius</span>
                                <input v-model.number="footprintM" class="mono" type="number" min="80" max="1200" step="20" />
                            </div>
                        </div>
                    </section>

                    <section class="panel">
                        <div class="panel__head">
                            <Icon name="target" :size="14" />
                            <span class="panel__title">Landing dispersion</span>
                        </div>
                        <div class="panel__body">
                            <div class="switch-wrap" style="justify-content: space-between; margin-bottom: 8px">
                                <span>Robust ranking</span>
                                <button class="switch" :class="{ 'is-on': robustRanking }" @click="robustRanking = !robustRanking">
                                    <span class="switch__knob"></span>
                                </button>
                            </div>
                            <div class="field-row">
                                <span>Semi-major axis</span>
                                <input v-model.number="ellipseMajor" class="mono" type="number" min="40" max="900" step="20" />
                            </div>
                            <div class="field-row">
                                <span>Semi-minor axis</span>
                                <input v-model.number="ellipseMinor" class="mono" type="number" min="40" max="900" step="20" />
                            </div>
                            <div class="kv">
                                <span class="kv__k">Approach azimuth</span>
                                <span class="kv__v">{{ LANDING_ELLIPSE.azimuthDeg.toFixed(1) }} deg</span>
                            </div>
                            <p class="hint">
                                Survival is the weighted mean over 37 contact points on the ellipse, using the same
                                60 percent slope and 40 percent illumination criterion as the point score.
                            </p>
                        </div>
                    </section>

                    <section class="panel">
                        <div class="panel__body" style="padding: 9px">
                            <button class="btn btn--primary btn--block" :disabled="!demLoaded || busy" @click="runEvaluation">
                                <Icon name="play" :size="14" />
                                {{ busy ? 'Computing' : 'Run evaluation' }}
                            </button>
                        </div>
                    </section>
                </aside>

                <div class="col-main">
                    <section class="panel panel--grow">
                        <div class="panel__head">
                            <Icon name="chart" :size="14" />
                            <span class="panel__title">Candidate landing sites</span>
                            <div class="panel__aside">
                                <span class="tag">{{ busy ? 'RUNNING' : `${candidates.length} POOL` }}</span>
                                <button
                                    class="btn btn--sm"
                                    :disabled="comparedSites.length < 2"
                                    :title="comparedSites.length < 2 ? 'Tick two or more sites in the matrix to compare them' : 'Open the comparison table'"
                                    @click="showCompare = true">
                                    <Icon name="compare" :size="12" /> Compare {{ comparedSites.length }}/{{ COMPARE_LIMIT }}
                                </button>
                            </div>
                        </div>

                        <div class="audit-strip">
                            <Icon name="signal" :size="12" />
                            <span class="audit-strip__label">{{ progressStatus }}</span>
                            <div class="bar"><div class="bar__fill" :style="{ width: progressPct + '%' }"></div></div>
                            <span class="audit-strip__pct mono">{{ String(Math.round(progressPct)).padStart(3, '0') }}%</span>
                        </div>

                        <div v-if="!rankedCandidates.length" class="empty">
                            <Icon name="crosshair" :size="28" />
                            <span class="empty__title">No candidates scored</span>
                            <span class="empty__text">
                                Set the surface conditions and the lander model, then run the evaluation to rank the
                                landing sites.
                            </span>
                            <button class="btn btn--primary" style="margin-top: 4px" :disabled="!demLoaded || busy" @click="runEvaluation">
                                <Icon name="play" :size="14" /> Run evaluation
                            </button>
                        </div>

                        <div v-else class="matrix-wrap">
                            <table class="matrix">
                                <thead>
                                    <tr>
                                        <th class="cell-check"></th>
                                        <th class="cell-rank">#</th>
                                        <th>SITE</th>
                                        <th class="num">LAT</th>
                                        <th class="num">LON</th>
                                        <th class="num">ELEV</th>
                                        <th class="num">SLOPE</th>
                                        <th class="num" :class="{ 'is-key': robustRanking }">SURVIVAL</th>
                                        <th class="num">SUN</th>
                                        <th class="num">EARTH</th>
                                        <th class="num" :class="{ 'is-key': !robustRanking }">SCORE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for="s in rankedCandidates"
                                        :key="s.siteId"
                                        :class="{ 'is-active': selectedSite && selectedSite.siteId === s.siteId }"
                                        @click="selectSite(s)">
                                        <td class="cell-check">
                                            <input type="checkbox" :checked="isCompared(s)" @click.stop="toggleCompare(s)" />
                                        </td>
                                        <td class="cell-rank mono">{{ s.rank }}</td>
                                        <td class="mono">{{ s.siteId }}</td>
                                        <td class="num">{{ s.lat.toFixed(2) }}</td>
                                        <td class="num">{{ s.lon.toFixed(1) }}</td>
                                        <td class="num">{{ Math.round(s.altura) }}</td>
                                        <td class="num" :class="slopeClass(s.worstSlope)">{{ s.worstSlope.toFixed(1) }}</td>
                                        <td class="num" :class="[scoreClass(s.robustScore), { 'is-key-cell': robustRanking }]">
                                            {{ s.robustScore.toFixed(1) }}
                                        </td>
                                        <td class="num" :class="s.solPct < 50 ? 'val-warn' : ''">{{ s.solPct }}</td>
                                        <td class="num" :class="s.dtePct < 50 ? 'val-warn' : ''">{{ s.dtePct }}</td>
                                        <td class="num" :class="{ 'is-key-cell': !robustRanking }">{{ s.pointScore.toFixed(1) }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div class="panel__foot" style="padding: 6px 10px; border-top: 1px solid var(--line-soft)">
                            <span class="sub">
                                Top five of the evaluated pool. Slope limit {{ lander.maxSlope }} deg, footprint radius
                                {{ footprintM }} m, ellipse {{ ellipseMajor }} by {{ ellipseMinor }} m.
                            </span>
                        </div>
                    </section>

                    <section class="panel">
                        <div class="panel__head">
                            <Icon name="route" :size="14" />
                            <span class="panel__title">Surface timeline</span>
                            <div class="panel__aside">
                                <span class="tag mono">{{ metClock }}</span>
                                <button class="icon-btn" :title="isPlaying ? 'Pause' : 'Play'" @click="togglePlay">
                                    <Icon :name="isPlaying ? 'pause' : 'play'" :size="13" />
                                </button>
                                <button
                                    v-for="sp in SPEEDS"
                                    :key="sp.value"
                                    class="btn btn--sm"
                                    :class="{ 'is-on': simSpeed === sp.value }"
                                    @click="simSpeed = sp.value">
                                    {{ sp.label }}
                                </button>
                                <button class="btn btn--sm" title="Jump to the next Earth link window" @click="jumpToNextWindow">
                                    <Icon name="route" :size="12" /> Next link
                                </button>
                            </div>
                        </div>
                        <div class="timeline">
                            <div class="timeline__row">
                                <div class="timeline__label">
                                    <span>Sun above terrain horizon</span>
                                    <span class="mono">{{ timelineDays.filter((d) => d.sun).length }} of {{ timelineDays.length }} days</span>
                                </div>
                                <div class="timeline__grid timeline__grid--sm">
                                    <span
                                        v-for="d in timelineDays"
                                        :key="'sun' + d.day"
                                        class="day"
                                        :class="d.sun ? 'day--sun' : 'day--none'">{{ d.day }}</span>
                                </div>
                            </div>
                            <div class="timeline__row">
                                <div class="timeline__label">
                                    <span>Earth line of sight</span>
                                    <span class="mono">{{ timelineDays.filter((d) => d.earth).length }} of {{ timelineDays.length }} days</span>
                                </div>
                                <div class="timeline__grid timeline__grid--sm">
                                    <span
                                        v-for="d in timelineDays"
                                        :key="'earth' + d.day"
                                        class="day"
                                        :class="d.earth ? 'day--dte' : 'day--none'">{{ d.day }}</span>
                                </div>
                            </div>
                            <div v-if="!timelineDays.length" class="sub">No timeline computed.</div>
                        </div>
                    </section>
                </div>

                <aside class="rail">
                    <section class="panel">
                        <div class="panel__head">
                            <Icon name="crosshair" :size="14" />
                            <span class="panel__title">Selected site</span>
                            <div class="panel__aside">
                                <span class="tag">{{ selectedSite ? selectedSite.siteId : 'NONE' }}</span>
                            </div>
                        </div>
                        <div class="hero">
                            <div class="hero__value">
                                <span class="hero__num">{{ selectedSite ? (robustRanking ? selectedSite.robustScore : selectedSite.pointScore).toFixed(1) : '—' }}</span>
                                <span class="hero__unit">SUITABILITY</span>
                            </div>
                            <div class="hero__sub" v-if="selectedSite">
                                Ellipse survival {{ selectedSite.robustScore.toFixed(1) }} percent over
                                {{ selectedSite.dispersion ? selectedSite.dispersion.samples : 0 }} contacts
                            </div>
                            <div class="hero__sub" v-else>No site scored yet</div>
                        </div>
                        <div class="panel__body" style="padding-top: 0" v-if="selectedSite">
                            <div class="kv">
                                <span class="kv__k">Latitude</span>
                                <span class="kv__v">{{ selectedSite.lat.toFixed(3) }} deg</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Longitude</span>
                                <span class="kv__v">{{ selectedSite.lon.toFixed(2) }} deg</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Elevation</span>
                                <span class="kv__v">{{ Math.round(selectedSite.altura) }} m</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Worst slope in footprint</span>
                                <span class="kv__v" :class="textClass(selectedSite.safety.nivel)">{{ selectedSite.worstSlope.toFixed(1) }} deg</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Ellipse coverage under limit</span>
                                <span class="kv__v">{{ selectedSite.dispersion ? Math.round(selectedSite.dispersion.coverage * 100) : 0 }} percent</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Sun, 30 days</span>
                                <span class="kv__v">{{ selectedSite.solPct }} percent</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Earth line of sight</span>
                                <span class="kv__v">{{ selectedSite.dtePct }} percent</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Equilibrium temperature</span>
                                <span class="kv__v">{{ Math.round(selectedSite.thermal.kelvin) }} K</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Terrain relative navigation</span>
                                <span class="kv__v" :class="selectedSite.trn.status === 'OPTIMAL' ? 'is-ok' : selectedSite.trn.status === 'NO-GO (BLIND)' ? 'is-bad' : 'is-warn'">
                                    {{ selectedSite.trn.status }}
                                </span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Approach margin</span>
                                <span class="kv__v" :class="selectedSite.gnc.clear ? 'is-ok' : 'is-bad'">
                                    {{ Math.round(selectedSite.gnc.minMarginM) }} m
                                </span>
                            </div>
                            <button class="btn btn--block" style="margin-top: 9px" @click="inspectSelectedSite">
                                <Icon name="cube" :size="14" /> Inspect on terrain
                            </button>
                        </div>
                    </section>

                    <section class="panel">
                        <div class="panel__head">
                            <Icon name="sun" :size="14" />
                            <span class="panel__title">Power and link</span>
                        </div>
                        <div class="panel__body">
                            <div class="kv">
                                <span class="kv__k">Solar elevation</span>
                                <span class="kv__v">{{ ephemeris.sol_el.toFixed(2) }} deg</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Sun distance</span>
                                <span class="kv__v">{{ (ephemeris.sol_km / 1e6).toFixed(4) }} M km</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Irradiance at surface</span>
                                <span class="kv__v">{{ Math.round(power.radiacion) }} W per m2</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Array output, net</span>
                                <span class="kv__v">{{ Math.round(power.neta) }} W</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Sun visibility</span>
                                <span class="kv__v" :class="sunClass">{{ sunVisible ? 'ABOVE HORIZON' : 'OCCLUDED' }}</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Earth visibility</span>
                                <span class="kv__v" :class="earthClass">{{ earthVisible ? 'ABOVE HORIZON' : 'OCCLUDED' }}</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Active station</span>
                                <span class="kv__v">{{ dsnStation ? dsn[dsnStation].nombre : 'None' }}</span>
                            </div>
                            <div class="kv" v-if="dsnStation">
                                <span class="kv__k">Station range</span>
                                <span class="kv__v">{{ dsn[dsnStation].km.toLocaleString('en-US') }} km</span>
                            </div>
                            <div class="kv" v-if="dsnStation">
                                <span class="kv__k">One-way light time</span>
                                <span class="kv__v">{{ dsn[dsnStation].owlt.toFixed(3) }} s</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Minimum elevation</span>
                                <span class="kv__v">{{ DSN_MIN_ELEVACION.toFixed(0) }} deg</span>
                            </div>
                        </div>
                    </section>

                    <section class="panel">
                        <div class="panel__head">
                            <Icon name="radar" :size="14" />
                            <span class="panel__title">Horizon profile</span>
                            <div class="panel__aside">
                                <span class="tag mono">{{ horizonMaxDeg.toFixed(1) }} DEG</span>
                            </div>
                        </div>
                        <div class="radar">
                            <canvas ref="radarCanvas" width="150" height="150"></canvas>
                            <div class="radar__legend">
                                <span><i class="dot dot--sun"></i> Sun {{ ephemeris.sol_az.toFixed(0) }} deg</span>
                                <span><i class="dot dot--earth"></i> Earth {{ ephemeris.tierra_az.toFixed(0) }} deg</span>
                                <span class="sub">Radius is elevation: the outer ring is the horizon at 0 deg, the centre is 30 deg.</span>
                            </div>
                        </div>
                        <div class="panel__body">
                            <div class="kv">
                                <span class="kv__k">Skyline peak</span>
                                <span class="kv__v">{{ horizonStats.peak.toFixed(1) }} deg at bearing {{ horizonStats.peakAz }} deg</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Mean skyline</span>
                                <span class="kv__v">{{ horizonStats.mean.toFixed(2) }} deg</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Bearings above 1 deg</span>
                                <span class="kv__v">{{ horizonStats.blocked }} of 360</span>
                            </div>
                            <div class="kv">
                                <span class="kv__k">Sun clearance</span>
                                <span class="kv__v" :class="sunClass">
                                    {{ (ephemeris.sol_el - horizonStats.sunHorizon).toFixed(2) }} deg
                                </span>
                            </div>
                            <p class="hint">
                                The profile is the maximum terrain elevation on 360 bearings, ray marched
                                from {{ lander.mastHeight.toFixed(1) }} m above this cell out to 200 km, with
                                lunar curvature subtracted. A body is above the local horizon when its
                                elevation exceeds the profile at its own bearing; the clearance row is that
                                difference for the Sun now.
                            </p>
                        </div>
                    </section>
                </aside>
            </div>

            <!-- ------------------------------------------------------------------
                 3D VIEW
            ------------------------------------------------------------------ -->
            <div v-show="activeTab === 'view'" class="viewer">
                <canvas
                    ref="canvas3d"
                    @pointerdown="onPointerDown"
                    @click="onCanvasClick"></canvas>

                <div v-if="!demLoaded" class="viewer-note">
                    <span class="status-dot" :class="{ 'is-busy': !loadError }"></span>
                    <span v-if="loadError">Terrain unavailable — {{ loadError }}</span>
                    <span v-else-if="demBytes">Loading terrain — {{ demBytes }}</span>
                    <span v-else>Requesting terrain — 64 MB LOLA south pole reduction</span>
                </div>

                <div v-else-if="!sceneReady" class="viewer-note">
                    <span class="status-dot"></span>
                    <span>3D renderer unavailable — {{ bootError || 'no WebGL context' }}</span>
                </div>

                <div class="overlay overlay--tl">
                    <div class="overlay__head">
                        <Icon name="layers" :size="13" /> Display
                        <div class="panel__aside">
                            <span class="tag" :title="renderMode === 'software' ? 'Rendered on the CPU: this browser exposes no WebGL2 context' : 'Rendered on the GPU through WebGL2'">
                                {{ renderMode === 'software' ? 'CPU' : 'GPU' }}
                            </span>
                        </div>
                    </div>
                    <div class="overlay__body">
                        <button
                            v-for="l in [
                                { id: 'pbr', label: 'Shaded relief' },
                                { id: 'elevation', label: 'Elevation' },
                                { id: 'slope', label: 'Slope' },
                                { id: 'illumination', label: 'Illumination' }
                            ]"
                            :key="l.id"
                            class="layer-btn"
                            :class="{ 'is-on': overlayLayer === l.id }"
                            @click="setLayer(l.id)">
                            {{ l.label }}
                            <i v-if="overlayLayer === l.id" class="layer-btn__mark"></i>
                        </button>
                        <div class="field" style="margin-top: 10px">
                            <span class="field-label">Exposure</span>
                            <input v-model.number="exposure" type="range" min="0.5" max="3.5" step="0.05" @input="applyLighting" />
                        </div>
                        <div class="field">
                            <span class="field-label">Fill light</span>
                            <input v-model.number="fillLight" type="range" min="0" max="1.2" step="0.02" @input="applyLighting" />
                        </div>
                        <button class="btn btn--sm btn--block" style="margin-top: 4px" @click="resetCamera">
                            <Icon name="refresh" :size="12" /> Reset camera
                        </button>
                    </div>
                </div>

                <div class="overlay overlay--tr">
                    <div class="overlay__head">
                        <Icon name="crosshair" :size="13" /> Probe
                        <div class="panel__aside">
                            <button v-if="probe" class="icon-btn" @click="closeProbe"><Icon name="x" :size="12" /></button>
                        </div>
                    </div>
                    <div class="overlay__body" v-if="probe">
                        <div class="kv">
                            <span class="kv__k">Coordinates</span>
                            <span class="kv__v">{{ probe.geo.lat.toFixed(2) }} / {{ probe.geo.lon.toFixed(1) }}</span>
                        </div>
                        <div class="kv">
                            <span class="kv__k">Elevation</span>
                            <span class="kv__v">{{ probe.elevation }} m</span>
                        </div>
                        <div class="kv">
                            <span class="kv__k">Local slope</span>
                            <span class="kv__v" :class="textClass(probe.safety.nivel)">{{ probe.slope.toFixed(1) }} deg</span>
                        </div>
                        <div class="kv">
                            <span class="kv__k">Temperature</span>
                            <span class="kv__v">{{ Math.round(thermal.kelvin) }} K</span>
                        </div>
                        <div class="kv">
                            <span class="kv__k">Sun at point</span>
                            <span class="kv__v" :class="sunClass">{{ sunVisible ? 'VISIBLE' : 'OCCLUDED' }}</span>
                        </div>
                    </div>
                    <div class="overlay__body" v-else>
                        <span class="sub">Click the terrain to probe a point. The readout drives the telemetry panels.</span>
                    </div>
                </div>

                <div class="overlay overlay--bl">
                    <div class="overlay__head"><Icon name="globe" :size="13" /> Catalogue · {{ POIS.length }} sites</div>
                    <div class="overlay__body" style="padding: 7px 9px">
                        <div class="radar__legend">
                            <span v-for="t in poiTypeCounts" :key="t.id">
                                <i
                                    class="dot"
                                    :style="{
                                        background:
                                            t.id === 'psr'
                                                ? 'var(--txt-mute)'
                                                : t.id === 'mount'
                                                  ? 'var(--txt-dim)'
                                                  : t.id === 'clps'
                                                    ? 'var(--accent)'
                                                    : 'var(--warn)'
                                    }"></i>
                                {{ t.etiqueta }} · {{ t.count }}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="overlay overlay--br" v-if="selectedSite">
                    <div class="overlay__head">
                        <Icon name="target" :size="13" /> {{ selectedSite.siteId }}
                        <div class="panel__aside">
                            <button class="btn btn--sm" @click="activeTab = 'plan'">Open plan</button>
                        </div>
                    </div>
                    <div class="overlay__body">
                        <div class="kv">
                            <span class="kv__k">Dispersion survival</span>
                            <span class="kv__v">{{ selectedSite.robustScore.toFixed(1) }} percent</span>
                        </div>
                        <div class="kv">
                            <span class="kv__k">Approach margin</span>
                            <span class="kv__v" :class="selectedSite.gnc.clear ? 'is-ok' : 'is-bad'">{{ Math.round(selectedSite.gnc.minMarginM) }} m</span>
                        </div>
                        <div class="kv">
                            <span class="kv__k">Coordinates</span>
                            <span class="kv__v">{{ selectedSite.lat.toFixed(2) }} / {{ selectedSite.lon.toFixed(1) }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <footer class="statusbar">
            <span class="status-item">
                <span class="status-dot" :class="{ 'is-busy': !demLoaded }"></span>
                DEM {{ demLoaded ? 'LOADED' : 'PENDING' }}
            </span>
            <span class="status-item"><strong>{{ demInfo || 'LOLA 80S reduction' }}</strong></span>
            <span class="status-item">Lunar south pole, 80 to 90 degrees south</span>
            <span class="status-item">Ephemeris Meeus, validated against DE421</span>
            <span v-if="bootError" class="status-item is-bad">Runtime — {{ bootError }}</span>
            <span class="spacer"></span>
            <span class="status-item">{{ metRunning ? 'Clock running' : 'Clock held' }}</span>
            <span class="status-item">Space Apps 2026, prototype build</span>
        </footer>

        <div v-if="showCompare" class="modal" @click.self="showCompare = false">
            <div class="modal__box">
                <div class="modal__head">
                    <Icon name="compare" :size="14" />
                    <span class="panel__title">Site comparison</span>
                    <div class="panel__aside">
                        <button class="icon-btn" @click="showCompare = false"><Icon name="x" :size="13" /></button>
                    </div>
                </div>
                <table class="cmp">
                    <thead>
                        <tr>
                            <th style="width: 34%">Metric</th>
                            <th v-for="site in comparedSites" :key="site.siteId">
                                {{ site.siteId }}
                                <span class="cmp__name">{{ site.label }}</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in comparisonTable" :key="row.label">
                            <td>{{ row.label }}</td>
                            <td
                                v-for="cell in row.cells"
                                :key="cell.siteId"
                                class="mono"
                                :class="{ best: cell.best }">{{ cell.value }}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="modal__foot">{{ comparisonVerdict }}</div>
            </div>
        </div>
    </div>
</template>
