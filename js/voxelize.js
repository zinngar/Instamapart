// Places a flat picture into 3D block space at any orientation.
//
// The picture starts upright in the X/Y plane, facing south (+Z), so someone
// standing south of it looking north sees it the right way round.
// Then it is rotated by:
//   spin - turns the picture within its own plane (around Z)
//   tilt - leans the top away from the viewer (around X); 90 = lying flat, top pointing north
//   turn - turns the whole thing around the vertical axis (around Y)
//
// Every block in the bounding box is mapped back into picture space; blocks
// whose centre lies within the picture's slab get that pixel's colour. This
// inverse mapping means rotated pictures never end up with missing pixels.

const EPS = 1e-6;
const rad = (deg) => deg * Math.PI / 180;

// Rounds away float noise so exact angles (0, 90, 45...) give clean grids.
const snap = (v) => Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) : v;

function multiply(a, b) {
    const out = [];
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
        }
    }
    return out;
}

export function rotationMatrix({ tilt, turn, spin }) {
    const [t, y, s] = [rad(-tilt), rad(-turn), rad(spin)];
    const rx = [1, 0, 0, 0, Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t)];
    const ry = [Math.cos(y), 0, Math.sin(y), 0, 1, 0, -Math.sin(y), 0, Math.cos(y)];
    const rz = [Math.cos(s), -Math.sin(s), 0, Math.sin(s), Math.cos(s), 0, 0, 0, 1];
    return multiply(ry, multiply(rx, rz)).map(snap);
}

/**
 * @param {number} width   picture width in pixels (= blocks)
 * @param {number} height  picture height in pixels
 * @param {(px: number, py: number) => number} pixelAt  palette index at a pixel, or -1 for empty
 * @param {{tilt:number, turn:number, spin:number}} angles  degrees
 * @param {boolean} solid  thicken diagonal pictures so there are no see-through gaps
 * @returns {{sizeX:number, sizeY:number, sizeZ:number, hits: Int32Array}} filled blocks as
 *          flat [x, y, z, paletteIndex, ...] quadruples; everything else is air
 */
export function voxelize(width, height, pixelAt, angles, solid) {
    const m = rotationMatrix(angles);
    const normal = [m[2], m[5], m[8]];
    const thickness = solid
        ? Math.abs(normal[0]) + Math.abs(normal[1]) + Math.abs(normal[2])
        : Math.max(Math.abs(normal[0]), Math.abs(normal[1]), Math.abs(normal[2]));
    const half = thickness / 2;

    // Bounding box of the rotated picture (plus slab thickness).
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const [u, v] of [[-width / 2, -height / 2], [width / 2, -height / 2], [-width / 2, height / 2], [width / 2, height / 2]]) {
        for (const w of [-half, half]) {
            for (let i = 0; i < 3; i++) {
                const p = m[i * 3] * u + m[i * 3 + 1] * v + m[i * 3 + 2] * w;
                min[i] = Math.min(min[i], p);
                max[i] = Math.max(max[i], p);
            }
        }
    }
    const lo = min.map((v) => Math.floor(v) - 1);
    const hi = max.map((v) => Math.ceil(v) + 1);

    // Walk the two axes the picture spreads across, and for each one solve
    // for the few blocks along the remaining axis that fall inside the slab.
    // This keeps the work proportional to the picture's area, not the box volume.
    const d = [0, 1, 2].reduce((best, i) => Math.abs(normal[i]) > Math.abs(normal[best]) ? i : best, 0);
    const [a, b] = [0, 1, 2].filter((i) => i !== d);
    const hits = [];
    const tightMin = [Infinity, Infinity, Infinity];
    const tightMax = [-Infinity, -Infinity, -Infinity];
    const p = [0, 0, 0];
    for (p[a] = lo[a]; p[a] <= hi[a]; p[a]++) {
        for (p[b] = lo[b]; p[b] <= hi[b]; p[b]++) {
            const rest = normal[a] * p[a] + normal[b] * p[b];
            const c1 = (-half - rest) / normal[d];
            const c2 = (half - rest) / normal[d];
            const cEnd = Math.ceil(Math.max(c1, c2)) + 1;
            for (p[d] = Math.floor(Math.min(c1, c2)) - 1; p[d] <= cEnd; p[d]++) {
                const [x, y, z] = p;
                // Inverse rotation (transpose) takes the block centre into picture space.
                const w = m[2] * x + m[5] * y + m[8] * z;
                if (w < -half - EPS || w >= half - EPS) continue;
                const u = m[0] * x + m[3] * y + m[6] * z;
                const v = m[1] * x + m[4] * y + m[7] * z;
                const px = Math.floor(u + width / 2 + EPS);
                const py = Math.floor(height / 2 - v + EPS);
                if (px < 0 || px >= width || py < 0 || py >= height) continue;
                const id = pixelAt(px, py);
                if (id < 0) continue;
                hits.push(x, y, z, id);
                for (let i = 0; i < 3; i++) {
                    if (p[i] < tightMin[i]) tightMin[i] = p[i];
                    if (p[i] > tightMax[i]) tightMax[i] = p[i];
                }
            }
        }
    }

    if (!hits.length) {
        return { sizeX: 0, sizeY: 0, sizeZ: 0, hits: new Int32Array(0) };
    }

    // Shift so the box starts at 0,0,0.
    const out = new Int32Array(hits);
    for (let i = 0; i < out.length; i += 4) {
        out[i] -= tightMin[0];
        out[i + 1] -= tightMin[1];
        out[i + 2] -= tightMin[2];
    }
    return {
        sizeX: tightMax[0] - tightMin[0] + 1,
        sizeY: tightMax[1] - tightMin[1] + 1,
        sizeZ: tightMax[2] - tightMin[2] + 1,
        hits: out
    };
}
