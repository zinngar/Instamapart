import * as NBT from 'https://esm.sh/nbtify@2.2.0';
import { colorToBlockId } from './color-to-block-id.js';

const imageLoader = document.getElementById('imageLoader');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const mapSize = document.getElementById('mapSize');
const woolOnly = document.getElementById('woolOnly');

let originalImage = null;

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

imageLoader.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
        return;
    }

    const img = new Image();
    img.onload = () => {
        originalImage = img;
        updateCanvas();
        URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
        alert("Failed to load the selected file as an image. Please choose a valid image file.");
        URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
});

mapSize.addEventListener('change', updateCanvas);

function updateCanvas() {
    if (!originalImage) {
        return;
    }

    const size = parseInt(mapSize.value);
    const newWidth = 128 * size;
    const newHeight = 128 * size;

    const aspectRatio = originalImage.width / originalImage.height;
    let drawWidth = newWidth;
    let drawHeight = newHeight;

    if (aspectRatio > 1) {
        drawHeight = newWidth / aspectRatio;
    } else {
        drawWidth = newHeight * aspectRatio;
    }

    canvas.width = newWidth;
    canvas.height = newHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(originalImage, 0, 0, drawWidth, drawHeight);
}

const generateButton = document.getElementById('generate');
generateButton.addEventListener('click', processImage);

async function processImage() {
    if (!originalImage) {
        return;
    }

    updateCanvas();

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const palette = {};
    let paletteIndex = 0;
    const blockDataBytes = [];

    const activePalette = woolOnly.checked ? woolColorToBlockId : colorToBlockId;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const closestColor = findClosestColor(r, g, b, activePalette);
        const blockId = activePalette[closestColor];

        if (!(blockId in palette)) {
            palette[blockId] = paletteIndex++;
        }
        const paletteId = palette[blockId];
        blockDataBytes.push(...writeVarInt(paletteId));

        const [newR, newG, newB] = closestColor.split(',').map(Number);
        data[i] = newR;
        data[i + 1] = newG;
        data[i + 2] = newB;
    }

    ctx.putImageData(imageData, 0, 0);

    const width = canvas.width;
    const height = canvas.height;

    const schematic = {
        name: 'Schematic',
        value: {
            Version: { type: 'int', value: 2 },
            DataVersion: { type: 'int', value: 2730 },
            Width: { type: 'short', value: width },
            Height: { type: 'short', value: 1 },
            Length: { type: 'short', value: height },
            PaletteMax: { type: 'int', value: paletteIndex },
            Palette: {
                type: 'compound',
                value: Object.entries(palette).reduce((acc, [name, val]) => {
                    acc[name] = { type: 'int', value: val };
                    return acc;
                }, {})
            },
            BlockData: { type: 'byteArray', value: new Uint8Array(blockDataBytes) },
            BlockEntities: { type: 'list', value: { type: 'end', value: [] } },
            Entities: { type: 'list', value: { type: 'end', value: [] } },
            Metadata: {
                type: 'compound',
                value: {
                    WEOffsetX: { type: 'int', value: 0 },
                    WEOffsetY: { type: 'int', value: 0 },
                    WEOffsetZ: { type: 'int', value: 0 }
                }
            }
        }
    };

    const nbtData = NBT.write(schematic, { compressed: true });
    const blob = new Blob([nbtData], { type: 'application/octet-stream' });
    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.getElementById('download');
    downloadLink.href = downloadUrl;
    downloadLink.download = 'mapart.schem';
    downloadLink.style.display = 'block';
}

function writeVarInt(value) {
    const bytes = [];
    while (value & 0xFFFFFF80) {
        bytes.push((value & 0x7F) | 0x80);
        value >>>= 7;
    }
    bytes.push(value & 0x7F);
    return bytes;
}

function findClosestColor(r, g, b, palette) {
    let closestColor = null;
    let minDistance = Infinity;

    for (const color of Object.keys(palette)) {
        const [mcR, mcG, mcB] = color.split(',').map(Number);
        const distance = Math.sqrt(
            Math.pow(r - mcR, 2) +
            Math.pow(g - mcG, 2) +
            Math.pow(b - mcB, 2)
        );

        if (distance < minDistance) {
            minDistance = distance;
            closestColor = color;
        }
    }

    return closestColor;
}
