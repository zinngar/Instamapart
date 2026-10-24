// Builds a Litematica (.litematic) schematic: gzipped NBT with one region.
import { nbt, writeNbt, gzip } from './nbt.js';

// 1.21.1. Litematica upgrades older data versions, and the blocks used here
// exist in every version since 1.19.
const DATA_VERSION = 3955;

/**
 * @param {{sizeX:number, sizeY:number, sizeZ:number, hits:Int32Array}} shape  from voxelize()
 * @param {string[]} blockNames  palette index -> block id, e.g. "minecraft:white_wool"
 * @param {{name:string, author?:string, description?:string}} info
 * @returns {Promise<Uint8Array>} file contents
 */
export async function buildLitematic(shape, blockNames, info) {
    const { sizeX, sizeY, sizeZ, hits } = shape;
    const volume = sizeX * sizeY * sizeZ;

    // Litematica requires air at palette index 0.
    const palette = ['minecraft:air', ...blockNames];
    const bits = Math.max(2, Math.ceil(Math.log2(palette.length)));

    // Litematica packs entries back to back across longs (unlike vanilla chunks,
    // entries may straddle two longs). Pack into 32-bit words, then view them as
    // little-endian 64-bit longs.
    const longCount = Math.ceil(volume * bits / 64);
    const words = new Uint32Array(longCount * 2);
    for (let i = 0; i < hits.length; i += 4) {
        const index = hits[i + 1] * sizeX * sizeZ + hits[i + 2] * sizeX + hits[i];
        const value = hits[i + 3] + 1;
        const bit = index * bits;
        for (let b = 0; b < bits; b++) {
            if (value & (1 << b)) {
                const g = bit + b;
                words[g >>> 5] |= 1 << (g & 31);
            }
        }
    }
    const blockStates = new BigInt64Array(words.buffer);

    const now = Date.now();
    const region = nbt.compound({
        Position: nbt.compound({ x: nbt.int(0), y: nbt.int(0), z: nbt.int(0) }),
        Size: nbt.compound({ x: nbt.int(sizeX), y: nbt.int(sizeY), z: nbt.int(sizeZ) }),
        BlockStatePalette: nbt.list('compound', palette.map((name) => ({ Name: nbt.string(name) }))),
        BlockStates: nbt.longArray(blockStates),
        TileEntities: nbt.list('compound', []),
        Entities: nbt.list('compound', []),
        PendingBlockTicks: nbt.list('compound', []),
        PendingFluidTicks: nbt.list('compound', [])
    });

    const root = nbt.compound({
        Version: nbt.int(6),
        SubVersion: nbt.int(1),
        MinecraftDataVersion: nbt.int(DATA_VERSION),
        Metadata: nbt.compound({
            Name: nbt.string(info.name),
            Author: nbt.string(info.author ?? 'Instamapart'),
            Description: nbt.string(info.description ?? ''),
            RegionCount: nbt.int(1),
            TotalBlocks: nbt.int(hits.length / 4),
            TotalVolume: nbt.int(volume),
            TimeCreated: nbt.long(now),
            TimeModified: nbt.long(now),
            EnclosingSize: nbt.compound({ x: nbt.int(sizeX), y: nbt.int(sizeY), z: nbt.int(sizeZ) })
        }),
        Regions: nbt.compound({ [info.name]: region })
    });

    return gzip(writeNbt(root));
}
