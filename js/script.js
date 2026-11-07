import { colorToBlockId } from './color-to-block-id.js';
import { voxelize, rotationMatrix } from './voxelize.js';
import { buildLitematic } from './litematic.js';

const $ = (id) => document.getElementById(id);
const imageLoader = $('imageLoader');
const canvas = $('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const preview = $('preview3d');
const previewCtx = preview.getContext('2d');
const sizePreset = $('sizePreset');
const widthInput = $('width');
const heightInput = $('height');
const lockAspect = $('lockAspect');
const blockPalette = $('blockPalette');
const transparent = $('transparent');
const orientation = $('orientation');
const solid = $('solid');
const stats = $('stats');
const downloadLink = $('download');

const MAX_SIZE = 512;
const SUGGESTION_COUNT = 3;

let originalImage = null;
let imageName = 'mapart';
// Result of the latest preview: palette + 3D shape, reused by Generate.
let current = null;

const woolColorToBlockId = {
    "221,221,221": "minecraft:white_wool",
    "219,125,62": "minecraft:orange_wool",
    "179,80,188": "minecraft:magenta_wool",
    "107,138,201": "minecraft:light_blue_wool",
    "177,166,39": "minecraft:yellow_wool",
    "65,174,56": "minecraft:lime_wool",
    "208,132,153": "minecraft:pink_wool",
    "64,64,64": "minecraft:gray_wool",
    "154,161,161": "minecraft:light_gray_wool",
    "46,114,142": "minecraft:cyan_wool",
    "126,61,181": "minecraft:purple_wool",
    "46,56,141": "minecraft:blue_wool",
    "79,50,31": "minecraft:brown_wool",
    "53,70,27": "minecraft:green_wool",
    "150,52,48": "minecraft:red_wool",
    "25,22,22": "minecraft:black_wool"
};

const concreteColorToBlockId = Object.fromEntries(
    Object.entries(colorToBlockId).filter(([, blockId]) => blockId.includes('concrete'))
);

const expensiveBlocks = [
    "minecraft:diamond_block",
    "minecraft:gold_block",
    "minecraft:emerald_block",
    "minecraft:lapis_block",
    "minecraft:iron_block",
    "minecraft:redstone_block",
    "minecraft:raw_iron_block"
];

const noExpensiveColorToBlockId = Object.fromEntries(
    Object.entries(colorToBlockId).filter(([, blockId]) => !expensiveBlocks.includes(blockId))
);

// tilt: lean the top back (90 = flat, top pointing north)
// turn: around the vertical axis, same as Minecraft yaw (90 = facing west)
// spin: rotate the picture within its own plane
const orientations = {
    flat: { tilt: 90, turn: 0, spin: 0 },
    south: { tilt: 0, turn: 0, spin: 0 },
    west: { tilt: 0, turn: 90, spin: 0 },
    north: { tilt: 0, turn: 180, spin: 0 },
    east: { tilt: 0, turn: -90, spin: 0 },
    ceiling: { tilt: -90, turn: 0, spin: 0 }
};
const angleNames = ['tilt', 'turn', 'spin'];

function getAngles() {
    return Object.fromEntries(angleNames.map((n) => [n, Number($(n).value)]));
}

function setAngles(angles) {
    for (const n of angleNames) {
        $(n).value = angles[n];
        $(`${n}Value`).value = angles[n];
    }
}

const palettePresets = {
    all: colorToBlockId,
    wool: woolColorToBlockId,
    concrete: concreteColorToBlockId,
    no_expensive: noExpensiveColorToBlockId
};

const allBlocks = [...Object.entries(colorToBlockId), ...Object.entries(woolColorToBlockId)]
    .map(([rgb, id]) => ({ id, color: rgb.split(',').map(Number) }));
const blockById = new Map(allBlocks.map((block) => [block.id, block]));

// Blocks the image may be matched to.
let enabledBlocks = new Set(Object.values(colorToBlockId));
// Block the image matched -> block to place instead.
const swaps = new Map();

const shortName = (id) => id.replace('minecraft:', '');

// --- Block picker -----------------------------------------------------------

function renderBlockPicker() {
    const grid = $('blockGrid');
    for (const block of allBlocks) {
        const label = document.createElement('label');
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.dataset.block = block.id;
        box.addEventListener('change', () => {
            if (box.checked) enabledBlocks.add(block.id);
            else enabledBlocks.delete(block.id);
            blockPalette.value = 'custom';
            syncBlockPicker();
            schedulePreview();
        });
        label.append(box, makeSwatch(block.color), shortName(block.id).replaceAll('_', ' '));
        grid.appendChild(label);
    }
    syncBlockPicker();
}

// Every other block, closest in colour first.
function blocksByCloseness(source) {
    const [r, g, b] = blockById.get(source).color;
    const distance = ({ color }) => (r - color[0]) ** 2 + (g - color[1]) ** 2 + (b - color[2]) ** 2;
    return allBlocks
        .filter((block) => block.id !== source)
        .sort((x, y) => distance(x) - distance(y));
}

// All the swap boxes share one list, so it is filled in for whichever box is in use.
function fillSwapOptions(source) {
    $('blockOptions').replaceChildren(...blocksByCloseness(source).map((block) => {
        const option = document.createElement('option');
        option.value = shortName(block.id);
        return option;
    }));
}

function syncBlockPicker() {
    for (const box of $('blockGrid').querySelectorAll('input')) {
        box.checked = enabledBlocks.has(box.dataset.block);
    }
    $('enabledCount').textContent = `${enabledBlocks.size} of ${allBlocks.length} on`;
}

function makeSwatch(color) {
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    if (color) swatch.style.backgroundColor = `rgb(${color.join(',')})`;
    return swatch;
}

blockPalette.addEventListener('change', () => {
    const preset = palettePresets[blockPalette.value];
    if (preset) enabledBlocks = new Set(Object.values(preset));
    syncBlockPicker();
    schedulePreview();
});

function setAllBlocks(on) {
    enabledBlocks = new Set(on ? allBlocks.map((block) => block.id) : []);
    blockPalette.value = 'custom';
    syncBlockPicker();
    schedulePreview();
}
$('enableAll').addEventListener('click', () => setAllBlocks(true));
$('enableNone').addEventListener('click', () => setAllBlocks(false));

$('clearSwaps').addEventListener('click', () => {
    swaps.clear();
    schedulePreview();
});

// Turns what was typed into a full block id, or null if it can't be one.
function parseBlockId(text) {
    const cleaned = text.trim().toLowerCase().replace(/\s+/g, '_');
    const id = cleaned.includes(':') ? cleaned : `minecraft:${cleaned}`;
    return /^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(id) && !id.endsWith(':air') ? id : null;
}

function setSwap(source, text) {
    if (!text.trim()) {
        swaps.delete(source);
    } else {
        const target = parseBlockId(text);
        if (!target) {
            alert(`"${text}" isn't a block name that can be placed. Try something like smooth_stone.`);
        } else if (target === source) {
            swaps.delete(source);
        } else {
            swaps.set(source, target);
        }
    }
    schedulePreview();
}

// --- Inputs -----------------------------------------------------------------

imageLoader.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
        return;
    }

    const img = new Image();
    img.onload = () => {
        originalImage = img;
        imageName = file.name.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_') || 'mapart';
        applySizePreset();
        URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
        alert("Failed to load the selected file as an image. Please choose a valid image file.");
        URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
});

const clampSize = (v) => Math.max(1, Math.min(MAX_SIZE, Math.round(v) || 1));
const aspect = () => originalImage ? originalImage.width / originalImage.height : 1;

function applySizePreset() {
    if (sizePreset.value !== 'custom') {
        const side = 128 * Number(sizePreset.value);
        // Fit the longer side of the image to the map size.
        if (lockAspect.checked && aspect() < 1) {
            heightInput.value = side;
            widthInput.value = clampSize(side * aspect());
        } else {
            widthInput.value = side;
            heightInput.value = lockAspect.checked ? clampSize(side / aspect()) : side;
        }
    }
    schedulePreview();
}

sizePreset.addEventListener('change', applySizePreset);
lockAspect.addEventListener('change', () => {
    if (lockAspect.checked) heightInput.value = clampSize(Number(widthInput.value) / aspect());
    schedulePreview();
});
widthInput.addEventListener('input', () => {
    sizePreset.value = 'custom';
    if (lockAspect.checked) heightInput.value = clampSize(Number(widthInput.value) / aspect());
    schedulePreview();
});
heightInput.addEventListener('input', () => {
    sizePreset.value = 'custom';
    if (lockAspect.checked) widthInput.value = clampSize(Number(heightInput.value) * aspect());
    schedulePreview();
});

orientation.addEventListener('change', () => {
    if (orientations[orientation.value]) setAngles(orientations[orientation.value]);
    schedulePreview();
});

for (const n of angleNames) {
    const slider = $(n);
    const number = $(`${n}Value`);
    slider.addEventListener('input', () => {
        number.value = slider.value;
        orientation.value = 'custom';
        schedulePreview();
    });
    number.addEventListener('input', () => {
        slider.value = number.value;
        orientation.value = 'custom';
        schedulePreview();
    });
}

for (const el of [transparent, solid]) {
    el.addEventListener('change', schedulePreview);
}

// --- Image → blocks ---------------------------------------------------------

let previewTimer = null;
function schedulePreview() {
    downloadLink.style.display = 'none';
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 60);
}

function updatePreview() {
    if (!originalImage) {
        return;
    }

    const width = clampSize(Number(widthInput.value));
    const height = clampSize(Number(heightInput.value));
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(originalImage, 0, 0, width, height);

    const choices = allBlocks.filter((block) => enabledBlocks.has(block.id));
    if (!choices.length) {
        current = null;
        stats.textContent = 'No blocks are switched on. Choose at least one block to use.';
        $('materialsBox').style.display = 'none';
        render3d();
        return;
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const colors = choices.map((block) => block.color);
    // blockNames holds the blocks the image matched; blockColors how each one
    // looks once any swap is applied (a typed-in block keeps the matched colour).
    const blockNames = [];
    const blockColors = [];
    const indexOfColor = new Map();
    const nearestCache = new Map();
    const pixels = new Int32Array(width * height);

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        if (transparent.checked && data[i + 3] < 128) {
            pixels[p] = -1;
            data[i + 3] = 0;
            continue;
        }
        const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        let c = nearestCache.get(key);
        if (c === undefined) {
            c = findClosestColor(data[i], data[i + 1], data[i + 2], colors);
            nearestCache.set(key, c);
        }
        let idx = indexOfColor.get(c);
        if (idx === undefined) {
            idx = blockNames.length;
            indexOfColor.set(c, idx);
            const name = choices[c].id;
            blockNames.push(name);
            blockColors.push(blockById.get(swaps.get(name))?.color ?? colors[c]);
        }
        pixels[p] = idx;
        [data[i], data[i + 1], data[i + 2]] = blockColors[idx];
        data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    const shape = voxelize(width, height, (x, y) => pixels[y * width + x], getAngles(), solid.checked);
    current = { shape, blockNames, blockColors };

    const count = shape.hits.length / 4;
    stats.textContent = count
        ? `${shape.sizeX} × ${shape.sizeY} × ${shape.sizeZ} (W × H × L) · ${count.toLocaleString()} blocks · ${finalBlocks().names.length} block types`
        : 'Nothing to build — the picture is fully transparent.';
    renderMaterials();
    render3d();
}

function findClosestColor(r, g, b, colors) {
    let best = 0;
    let minDistance = Infinity;
    for (let i = 0; i < colors.length; i++) {
        const [mcR, mcG, mcB] = colors[i];
        const distance = (r - mcR) ** 2 + (g - mcG) ** 2 + (b - mcB) ** 2;
        if (distance < minDistance) {
            minDistance = distance;
            best = i;
        }
    }
    return best;
}

function renderMaterials() {
    const { shape, blockNames } = current;
    const counts = new Array(blockNames.length).fill(0);
    for (let i = 3; i < shape.hits.length; i += 4) counts[shape.hits[i]]++;
    const list = $('materials');
    list.innerHTML = '';
    blockNames
        .map((name, i) => [name, counts[i]])
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .forEach(([name, n]) => {
            const row = document.createElement('div');
            row.className = 'block-row';

            const label = document.createElement('span');
            label.append(makeSwatch(blockById.get(name).color), shortName(name));

            const stacks = Math.floor(n / 64);
            const rest = n % 64;
            const amount = document.createElement('span');
            amount.textContent = n.toLocaleString() +
                (stacks ? ` (${stacks} stack${stacks > 1 ? 's' : ''}${rest ? ` + ${rest}` : ''})` : '');

            const swap = document.createElement('input');
            swap.setAttribute('list', 'blockOptions');
            swap.placeholder = 'Swap to...';
            swap.setAttribute('aria-label', `Swap ${shortName(name)} to`);
            swap.value = swaps.has(name) ? shortName(swaps.get(name)) : '';
            swap.addEventListener('focus', () => fillSwapOptions(name));
            swap.addEventListener('change', () => setSwap(name, swap.value));

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'small';
            remove.textContent = "Don't use";
            remove.addEventListener('click', () => {
                enabledBlocks.delete(name);
                blockPalette.value = 'custom';
                syncBlockPicker();
                schedulePreview();
            });

            const closest = document.createElement('div');
            closest.className = 'closest';
            closest.append('Closest:');
            for (const block of blocksByCloseness(name).slice(0, SUGGESTION_COUNT)) {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'small';
                chip.append(makeSwatch(block.color), shortName(block.id));
                chip.addEventListener('click', () => setSwap(name, shortName(block.id)));
                closest.appendChild(chip);
            }

            row.append(label, amount, swap, remove, closest);
            list.appendChild(row);
        });
    $('materialsBox').style.display = shape.hits.length ? 'block' : 'none';
    $('clearSwaps').style.display = blockNames.some((name) => swaps.has(name)) ? 'inline-block' : 'none';
}

// Blocks to actually place, with swaps applied. Two blocks swapped to the same
// target share one palette entry; remap[i] gives the entry for blockNames[i].
function finalBlocks() {
    const names = [];
    const remap = current.blockNames.map((name) => {
        const target = swaps.get(name) ?? name;
        if (!names.includes(target)) names.push(target);
        return names.indexOf(target);
    });
    return { names, remap };
}

// --- 3D preview ---------------------------------------------------------------

// Camera looks from the south-east, slightly above, like a player would.
const view = { yaw: -35, pitch: 25 };

function render3d() {
    const W = preview.width;
    const H = preview.height;
    const img = previewCtx.createImageData(W, H);
    const px = img.data;
    // Background
    for (let i = 0; i < px.length; i += 4) {
        px[i] = 30; px[i + 1] = 34; px[i + 2] = 42; px[i + 3] = 255;
    }

    if (current && current.shape.hits.length) {
        const { shape, blockColors } = current;
        const { sizeX, sizeY, sizeZ, hits } = shape;
        // Camera rotation: yaw around Y, then pitch around X.
        const cy = Math.cos(view.yaw * Math.PI / 180), sy = Math.sin(view.yaw * Math.PI / 180);
        const cp = Math.cos(view.pitch * Math.PI / 180), sp = Math.sin(view.pitch * Math.PI / 180);
        const radius = Math.hypot(sizeX, sizeY, sizeZ) / 2 || 1;
        const scale = (Math.min(W, H) * 0.46) / radius;
        const half = Math.max(1, Math.ceil(scale * 0.55));
        const depth = new Float32Array(W * H).fill(Infinity);
        // Light from above and the camera side so the faces of angled pictures read clearly.
        const m = rotationMatrix(getAngles());
        const n = [m[2], m[5], m[8]];
        const shade = 0.6 + 0.4 * Math.abs(n[1] * 0.8 + (n[0] * sy + n[2] * cy) * 0.6);

        for (let i = 0; i < hits.length; i += 4) {
            const x = hits[i] - sizeX / 2 + 0.5;
            const y = hits[i + 1] - sizeY / 2 + 0.5;
            const z = hits[i + 2] - sizeZ / 2 + 0.5;
            // yaw
            const x1 = x * cy - z * sy;
            const z1 = x * sy + z * cy;
            // pitch
            const y2 = y * cp - z1 * sp;
            const z2 = y * sp + z1 * cp;
            const sx = Math.round(W / 2 + x1 * scale);
            const syy = Math.round(H / 2 - y2 * scale);
            const d = -z2;
            const [r, g, b] = blockColors[hits[i + 3]];
            for (let py = syy - half; py < syy + half; py++) {
                if (py < 0 || py >= H) continue;
                for (let qx = sx - half; qx < sx + half; qx++) {
                    if (qx < 0 || qx >= W) continue;
                    const k = py * W + qx;
                    if (d >= depth[k]) continue;
                    depth[k] = d;
                    px[k * 4] = r * shade;
                    px[k * 4 + 1] = g * shade;
                    px[k * 4 + 2] = b * shade;
                }
            }
        }
    }
    previewCtx.putImageData(img, 0, 0);
    drawCompass();
}

function drawCompass() {
    const cy = Math.cos(view.yaw * Math.PI / 180), sy = Math.sin(view.yaw * Math.PI / 180);
    const sp = Math.max(0.6, Math.abs(Math.sin(view.pitch * Math.PI / 180)));
    const cx0 = 36, cy0 = preview.height - 36, r = 22;
    previewCtx.font = 'bold 11px sans-serif';
    previewCtx.textAlign = 'center';
    previewCtx.textBaseline = 'middle';
    for (const [label, x, z] of [['N', 0, -1], ['S', 0, 1], ['E', 1, 0], ['W', -1, 0]]) {
        const x1 = x * cy - z * sy;
        const z1 = x * sy + z * cy;
        previewCtx.fillStyle = label === 'N' ? '#ff6b6b' : '#cfd6e0';
        previewCtx.fillText(label, cx0 + x1 * r, cy0 + z1 * sp * r);
    }
}

let drag = null;
preview.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch };
    preview.setPointerCapture(e.pointerId);
});
preview.addEventListener('pointermove', (e) => {
    if (!drag) return;
    view.yaw = drag.yaw + (e.clientX - drag.x) * 0.5;
    view.pitch = Math.max(-89, Math.min(89, drag.pitch + (e.clientY - drag.y) * 0.5));
    render3d();
});
preview.addEventListener('pointerup', () => { drag = null; });

// --- Export -------------------------------------------------------------------

$('generate').addEventListener('click', async () => {
    if (!originalImage) {
        alert('Upload an image first.');
        return;
    }
    clearTimeout(previewTimer);
    updatePreview();
    if (!current || !current.shape.hits.length) {
        return;
    }

    const { names, remap } = finalBlocks();
    const hits = current.shape.hits.slice();
    for (let i = 3; i < hits.length; i += 4) hits[i] = remap[hits[i]];
    const angles = getAngles();
    const bytes = await buildLitematic({ ...current.shape, hits }, names, {
        name: imageName,
        description: `Made with Instamapart. Tilt ${angles.tilt}°, turn ${angles.turn}°, spin ${angles.spin}°.`
    });
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    if (downloadLink.href) URL.revokeObjectURL(downloadLink.href);
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = `${imageName}.litematic`;
    downloadLink.style.display = 'inline-block';
});

renderBlockPicker();
render3d();
