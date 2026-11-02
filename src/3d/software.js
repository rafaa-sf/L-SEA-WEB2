// ==============================================================================
// src/3d/software.js
// CPU terrain renderer for browsers with no WebGL2 context.
//
// Same LOLA sheet, same camera framing and the same overlay semantics as the
// WebGL path, drawn with a column raycaster into an ImageData buffer. It is the
// automatic fallback: when the GPU path cannot start, the 3D tab keeps working
// instead of showing a dead panel.
// ==============================================================================

const FOV_Y = 45 * Math.PI / 180;
const MIN_DISTANCE = 6000;
const MAX_DISTANCE = 1500000;
const PITCH_MIN = 0.06;
const PITCH_MAX = 1.15;
const FOG_RGB = [16, 19, 23];
const SKY_TOP = [10, 12, 16];
const SKY_HORIZON = [26, 32, 40];
const STEPS = 900;

function pack(r, g, b) {
    return (255 << 24) | (b << 16) | (g << 8) | r;
}

function hexToRgb(hex) {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function createSoftwareView(canvas, options) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    const { dem, rows, cols, mpc, center, layers } = options;

    const view = {
        yaw: 0.78,
        pitch: 0.52,
        distance: 780000,
        target: { x: 0, y: 0, z: 0 }
    };

    const camera = { x: 0, y: 0, z: 0 };
    const shot = { mode: 'software', status: 'software' };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let image = null;
    let pixels = null;
    let yBuffer = null;
    let horizonY = 0;
    let focal = 1;
    let dirty = true;
    let frame = 0;
    let layerId = 'relief';
    let exposure = 1.3;
    let fillLight = 0.25;
    let site = null;
    let probe = null;
    let pois = [];

    function placeCamera() {
        camera.x = view.target.x + view.distance * Math.cos(view.pitch) * Math.sin(view.yaw);
        camera.y = view.target.y + view.distance * Math.sin(view.pitch);
        camera.z = view.target.z + view.distance * Math.cos(view.pitch) * Math.cos(view.yaw);
        focal = (height / 2) / Math.tan(FOV_Y / 2);
        horizonY = Math.max(8, height / 2 - focal * Math.tan(view.pitch));
    }

    // World metres to DEM cell, with the same origin the mesh uses.
    function cellOf(x, z) {
        return {
            col: (x + center.x) / mpc + cols / 2,
            row: (z + center.z) / mpc + rows / 2
        };
    }

    function worldOf(row, col) {
        return {
            x: (col - cols / 2) * mpc - center.x,
            z: (row - rows / 2) * mpc - center.z
        };
    }

    function heightAt(x, z) {
        const c = cellOf(x, z);
        if (c.col < 0 || c.row < 0 || c.col >= cols - 1 || c.row >= rows - 1) return NaN;
        const c0 = c.col | 0;
        const r0 = c.row | 0;
        const fx = c.col - c0;
        const fy = c.row - r0;
        const i = r0 * cols + c0;
        const h00 = dem[i];
        const h10 = dem[i + 1];
        const h01 = dem[i + cols];
        const h11 = dem[i + cols + 1];
        return (h00 * (1 - fx) + h10 * fx) * (1 - fy) + (h01 * (1 - fx) + h11 * fx) * fy;
    }

    function currentLayer() {
        if (!layers) return null;
        if (layerId === 'elevation' && layers.elevation) return layers.elevation;
        if (layerId === 'slope' && layers.slope) return layers.slope;
        if (layerId === 'illumination' && layers.illumination) return layers.illumination;
        return layers.relief || null;
    }

    // The thematic layers are flat colour ramps; they borrow the relief channel
    // as a hillshade so that elevation and slope still read as terrain.
    let shadeTexture = null;
    function shadeOf() {
        if (shadeTexture !== null) return shadeTexture;
        const relief = layers && layers.relief;
        if (!relief) return null;
        const n = relief.width * relief.height;
        const data = new Uint8Array(n);
        for (let i = 0; i < n; i++) data[i] = relief.data[i * 4];
        shadeTexture = { width: relief.width, height: relief.height, data };
        return shadeTexture;
    }

    function project(x, y, z) {
        const dx = x - camera.x;
        const dy = y - camera.y;
        const dz = z - camera.z;
        const s = Math.sin(view.yaw);
        const c = Math.cos(view.yaw);
        // forward axis points from the camera toward the target
        const forward = -(dx * s + dz * c);
        if (forward <= 1) return null;
        const right = dx * c - dz * s;
        return {
            x: width / 2 + (focal * right) / forward,
            y: horizonY + (focal * -dy) / forward,
            depth: forward
        };
    }

    function paintSky() {
        for (let y = 0; y < height; y++) {
            let r;
            let g;
            let b;
            if (y <= horizonY) {
                const t = y / Math.max(1, horizonY);
                r = SKY_TOP[0] + (SKY_HORIZON[0] - SKY_TOP[0]) * t;
                g = SKY_TOP[1] + (SKY_HORIZON[1] - SKY_TOP[1]) * t;
                b = SKY_TOP[2] + (SKY_HORIZON[2] - SKY_TOP[2]) * t;
            } else {
                // below the sheet edge there is no data: fall to the void colour
                const t = Math.min(1, (y - horizonY) / Math.max(1, height - horizonY));
                r = SKY_HORIZON[0] + (7 - SKY_HORIZON[0]) * t;
                g = SKY_HORIZON[1] + (9 - SKY_HORIZON[1]) * t;
                b = SKY_HORIZON[2] + (12 - SKY_HORIZON[2]) * t;
            }
            const line = pack(r | 0, g | 0, b | 0);
            const base = y * width;
            for (let x = 0; x < width; x++) pixels[base + x] = line;
        }
        for (let x = 0; x < width; x++) yBuffer[x] = -1;
    }

    function march() {
        const texture = currentLayer();
        const texW = texture ? texture.width : 0;
        const texH = texture ? texture.height : 0;
        const texData = texture ? texture.data : null;
        const sunShade = layerId === 'relief' ? null : shadeOf();
        const gain = 0.35 + exposure * 0.35;
        const ambient = fillLight;

        for (let x = 0; x < width; x++) {
            // camera looks from yaw toward the target: forward is -(sin yaw, cos yaw)
            const tanPhi = (x - width / 2) / focal;
            const dirX = -Math.sin(view.yaw) + Math.cos(view.yaw) * tanPhi;
            const dirZ = -Math.cos(view.yaw) - Math.sin(view.yaw) * tanPhi;
            const norm = Math.hypot(dirX, dirZ);
            const sin = dirX / norm;
            const cos = dirZ / norm;
            // far to near: the first hit is the far edge of the sheet, and every
            // nearer sample fills the vertical strip between the two projections
            let prevY = -1;
            const step = Math.pow(2200000 / 4200, 1 / STEPS);
            let t = 4200 * Math.pow(step, STEPS);
            for (let s = 0; s < STEPS; s++, t /= step) {
                const wx = camera.x + sin * t;
                const wz = camera.z + cos * t;
                const h = heightAt(wx, wz);
                if (h !== h) continue;
                const sy = Math.round(horizonY + (focal * (camera.y - h)) / t);
                if (sy < 0) continue;
                const bottom = sy > height ? height : sy;
                if (prevY < 0) {
                    prevY = bottom;
                    continue;
                }
                if (bottom <= prevY) continue;

                let r = 120;
                let g = 124;
                let b = 130;
                if (texData) {
                    const c = cellOf(wx, wz);
                    // bilinear: at grazing angles one column spans several texels, and
                    // nearest-neighbour turns that into vertical colour streaks
                    const fx = (1 - c.col / cols) * texW - 0.5;
                    const fy = (1 - c.row / rows) * texH - 0.5;
                    let x0 = Math.floor(fx);
                    let y0 = Math.floor(fy);
                    const ax = fx - x0;
                    const ay = fy - y0;
                    let x1 = x0 + 1;
                    let y1 = y0 + 1;
                    if (x0 < 0) x0 = 0; else if (x0 >= texW) x0 = texW - 1;
                    if (x1 < 0) x1 = 0; else if (x1 >= texW) x1 = texW - 1;
                    if (y0 < 0) y0 = 0; else if (y0 >= texH) y0 = texH - 1;
                    if (y1 < 0) y1 = 0; else if (y1 >= texH) y1 = texH - 1;
                    const k00 = (y0 * texW + x0) * 4;
                    const k10 = (y0 * texW + x1) * 4;
                    const k01 = (y1 * texW + x0) * 4;
                    const k11 = (y1 * texW + x1) * 4;
                    const w00 = (1 - ax) * (1 - ay);
                    const w10 = ax * (1 - ay);
                    const w01 = (1 - ax) * ay;
                    const w11 = ax * ay;
                    r = texData[k00] * w00 + texData[k10] * w10 + texData[k01] * w01 + texData[k11] * w11;
                    g = texData[k00 + 1] * w00 + texData[k10 + 1] * w10 + texData[k01 + 1] * w01 + texData[k11 + 1] * w11;
                    b = texData[k00 + 2] * w00 + texData[k10 + 2] * w10 + texData[k01 + 2] * w01 + texData[k11 + 2] * w11;
                    if (sunShade) {
                        const sh = (sunShade.data[y0 * texW + x0] * w00 + sunShade.data[y0 * texW + x1] * w10 +
                            sunShade.data[y1 * texW + x0] * w01 + sunShade.data[y1 * texW + x1] * w11) / 255;
                        const lit = (0.72 + 0.28 * ambient) * (0.62 + gain * sh);
                        r *= lit;
                        g *= lit;
                        b *= lit;
                    }
                }

                const fog = Math.min(1, Math.pow(t / 2400000, 0.85));
                r = r + (FOG_RGB[0] - r) * fog;
                g = g + (FOG_RGB[1] - g) * fog;
                b = b + (FOG_RGB[2] - b) * fog;
                const colour = pack(r | 0, g | 0, b | 0);

                for (let y = prevY; y < bottom; y++) pixels[y * width + x] = colour;
                prevY = bottom;
                if (prevY >= height) break;
            }
            yBuffer[x] = prevY;
        }
    }

    function strokeEllipse() {
        if (!site) return;
        const major = options.ellipse ? options.ellipse.semiMajorM : 240;
        const minor = options.ellipse ? options.ellipse.semiMinorM : 120;
        const azimuth = options.ellipse ? options.ellipse.azimuthDeg : 270;
        const origin = worldOf(site.fila, site.col);
        const height = dem[Math.round(site.fila) * cols + Math.round(site.col)] || 0;
        const rad = (azimuth * Math.PI) / 180;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 48; i++) {
            const a = (i / 48) * Math.PI * 2;
            const u = Math.cos(a) * major;
            const v = Math.sin(a) * minor;
            const wx = origin.x + u * Math.sin(rad) + v * Math.cos(rad);
            const wz = origin.z + u * Math.cos(rad) - v * Math.sin(rad);
            const p = project(wx, height, wz);
            if (!p) {
                started = false;
                continue;
            }
            if (!started) {
                ctx.moveTo(p.x, p.y);
                started = true;
            } else {
                ctx.lineTo(p.x, p.y);
            }
        }
        ctx.strokeStyle = 'rgba(79, 154, 209, 0.95)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    function strokeApproach() {
        if (!site) return;
        const origin = worldOf(site.fila, site.col);
        const rad = (270 * Math.PI) / 180;
        const descent = Math.tan((12 * Math.PI) / 180);
        ctx.beginPath();
        let started = false;
        for (let d = 25000; d >= 0; d -= 1250) {
            const wx = origin.x + Math.sin(rad) * d;
            const wz = origin.z + Math.cos(rad) * d;
            const p = project(wx, d * descent, wz);
            if (!p) {
                started = false;
                continue;
            }
            if (!started) {
                ctx.moveTo(p.x, p.y);
                started = true;
            } else {
                ctx.lineTo(p.x, p.y);
            }
        }
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = 'rgba(201, 160, 74, 0.75)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function strokePois() {
        for (const poi of pois) {
            const origin = worldOf(poi.fila, poi.col);
            const h = dem[Math.round(poi.fila) * cols + Math.round(poi.col)] || 0;
            const p = project(origin.x, h, origin.z);
            if (!p) continue;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(138, 148, 161, 0.85)';
            ctx.fill();
        }
    }

    function strokeMarkers() {
        if (site) {
            const origin = worldOf(site.fila, site.col);
            const h = dem[Math.round(site.fila) * cols + Math.round(site.col)] || 0;
            const base = project(origin.x, h, origin.z);
            const top = project(origin.x, h + 1200, origin.z);
            if (base && top) {
                ctx.strokeStyle = '#4f9ad1';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.moveTo(base.x, base.y);
                ctx.lineTo(top.x, top.y);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(top.x, top.y, 3.4, 0, Math.PI * 2);
                ctx.fillStyle = '#4f9ad1';
                ctx.fill();
                if (site.siteId) {
                    ctx.font = '11px "Cascadia Mono", Consolas, monospace';
                    ctx.fillStyle = '#c8d0da';
                    ctx.fillText(site.siteId, top.x + 8, top.y - 3);
                }
            }
        }
        if (probe) {
            const origin = worldOf(probe.fila, probe.col);
            const h = dem[Math.round(probe.fila) * cols + Math.round(probe.col)] || 0;
            const p = project(origin.x, h, origin.z);
            if (p) {
                ctx.strokeStyle = '#e6ebf2';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p.x - 6, p.y);
                ctx.lineTo(p.x + 6, p.y);
                ctx.moveTo(p.x, p.y - 6);
                ctx.lineTo(p.x, p.y + 6);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }

    function drawScaleBar() {
        const metres = Math.round(view.distance / 8);
        ctx.font = '10px "Cascadia Mono", Consolas, monospace';
        ctx.fillStyle = 'rgba(200, 208, 218, 0.75)';
        ctx.fillText(`${metres} km scale`, 14, height - 14);
    }

    function render() {
        if (!pixels || width < 2 || height < 2) return;
        placeCamera();
        paintSky();
        march();
        ctx.putImageData(image, 0, 0);
        strokePois();
        strokeApproach();
        strokeEllipse();
        strokeMarkers();
        drawScaleBar();
        dirty = false;
    }

    function schedule() {
        dirty = true;
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            if (dirty) render();
        });
    }

    function resize() {
        const host = canvas.parentElement;
        const w = Math.max(2, Math.round((host && host.clientWidth) || canvas.clientWidth || 640));
        const h = Math.max(2, Math.round((host && host.clientHeight) || canvas.clientHeight || 360));
        // one CSS pixel per terrain sample: the CPU cost is linear in pixels and the
        // canvas scales up cleanly, while markers stay drawn at CSS resolution
        dpr = 1;
        width = Math.max(2, Math.round(w * dpr));
        height = Math.max(2, Math.round(h * dpr));
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        image = ctx.createImageData(width, height);
        pixels = new Uint32Array(image.data.buffer);
        yBuffer = new Int32Array(width);
        render();
    }

    // ---- input ------------------------------------------------------------
    let drag = null;

    function panBy(dx, dy) {
        const s = Math.sin(view.yaw);
        const c = Math.cos(view.yaw);
        const scale = view.distance / 900;
        view.target.x -= (dx * c + dy * s) * scale;
        view.target.z += (dx * s - dy * c) * scale;
    }

    function onPointerDown(e) {
        drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey };
        canvas.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e) {
        if (!drag) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        drag.x = e.clientX;
        drag.y = e.clientY;
        if (drag.pan) {
            panBy(dx, dy);
        } else {
            view.yaw -= dx * 0.005;
            view.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, view.pitch + dy * 0.004));
        }
        schedule();
    }

    function onPointerUp(e) {
        if (drag && canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
        drag = null;
    }

    function onWheel(e) {
        e.preventDefault();
        view.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, view.distance * Math.exp(e.deltaY * 0.0012)));
        schedule();
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // ---- public surface ---------------------------------------------------
    function setLayer(id) {
        // 'pbr' is the GPU name for the shaded-relief texture
        layerId = id === 'pbr' ? 'relief' : id;
        schedule();
    }

    function setLighting(nextExposure, nextFill) {
        if (typeof nextExposure === 'number') exposure = nextExposure;
        if (typeof nextFill === 'number') fillLight = nextFill;
        schedule();
    }

    function setSite(next) {
        site = next ? { fila: next.fila, col: next.col, siteId: next.siteId || null } : null;
        schedule();
    }

    function setProbe(next) {
        probe = next ? { fila: next.fila, col: next.col } : null;
        schedule();
    }

    function setEllipse(semiMajorM, semiMinorM) {
        if (!options.ellipse) options.ellipse = { azimuthDeg: 270 };
        options.ellipse.semiMajorM = semiMajorM;
        options.ellipse.semiMinorM = semiMinorM;
        schedule();
    }

    function setCatalogue(list) {
        pois = list || [];
        schedule();
    }

    // Screen to DEM cell: march the same ray the renderer used and stop at the
    // first sample that projects at or above the pointer.
    function pick(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const px = (clientX - rect.left) * (width / rect.width);
        const py = (clientY - rect.top) * (height / rect.height);
        placeCamera();
        const tanPhi = (px - width / 2) / focal;
        const dirX = -Math.sin(view.yaw) + Math.cos(view.yaw) * tanPhi;
        const dirZ = -Math.cos(view.yaw) - Math.sin(view.yaw) * tanPhi;
        const norm = Math.hypot(dirX, dirZ);
        const sin = dirX / norm;
        const cos = dirZ / norm;
        const step = Math.pow(2200000 / 4200, 1 / STEPS);
        let t = 4200;
        for (let s = 0; s < STEPS * 2; s++, t *= step) {
            const wx = camera.x + sin * t;
            const wz = camera.z + cos * t;
            const h = heightAt(wx, wz);
            if (h !== h) continue;
            if (horizonY + (focal * (camera.y - h)) / t <= py) {
                const c = cellOf(wx, wz);
                const fila = Math.round(c.row);
                const col = Math.round(c.col);
                if (fila < 1 || fila >= rows - 1 || col < 1 || col >= cols - 1) return null;
                return { fila, col };
            }
        }
        return null;
    }

    function focus(row, col) {
        const origin = worldOf(row, col);
        const h = dem[Math.round(row) * cols + Math.round(col)] || 0;
        view.target.x = origin.x;
        view.target.y = h;
        view.target.z = origin.z;
        view.distance = 32000;
        view.pitch = 0.42;
        schedule();
    }

    function reset() {
        view.target.x = 0;
        view.target.y = 0;
        view.target.z = 0;
        view.distance = 780000;
        view.yaw = 0.78;
        view.pitch = 0.52;
        schedule();
    }

    function setPoisFromCells(list) {
        pois = (list || []).map((p) => ({ fila: p.fila, col: p.col }));
        schedule();
    }

    function dispose() {
        cancelAnimationFrame(frame);
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('wheel', onWheel);
    }

    resize();

    return {
        ...shot,
        name: 'software',
        setLayer,
        setLighting,
        setSite,
        setProbe,
        setCatalogue,
        setEllipse,
        setPoisFromCells,
        focus,
        pick,
        reset,
        resize,
        render,
        schedule,
        dispose,
        camera: view,
        worldOf,
        site: () => site
    };
}
