import * as NBT from 'https://esm.sh/nbtify@2.2.0';
import { colorToBlockId } from './color-to-block-id.js';

const imageLoader = document.getElementById('imageLoader');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const mapSize = document.getElementById('mapSize');

let originalImage = null;

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
    const blockIds = [];
    const palette = {};
    let paletteIndex = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const closestColor = findClosestColor(r, g, b);
        const blockId = colorToBlockId[closestColor];

        if (!palette[blockId]) {
            palette[blockId] = paletteIndex++;
        }
        blockIds.push(palette[blockId]);

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
            DataVersion: { type: 'int', value: 2730 },
            Width: { type: 'short', value: width },
            Height: { type: 'short', value: 1 },
            Length: { type: 'short', value: height },
            Palette: {
                type: 'compound',
                value: Object.entries(palette).reduce((acc, [name, val]) => {
                    acc[name] = { type: 'int', value: val };
                    return acc;
                }, {})
            },
            BlockData: { type: 'byteArray', value: new Uint8Array(blockIds) },
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
    downloadLink.download = 'mapart.schematic';
    downloadLink.style.display = 'block';
}

function findClosestColor(r, g, b) {
    let closestColor = null;
    let minDistance = Infinity;

    for (const color of Object.keys(colorToBlockId)) {
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
