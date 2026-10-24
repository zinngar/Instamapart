// Minimal big-endian NBT writer (Java Edition format).
// Values are tagged objects so every number gets the exact NBT type it needs.

const TAG = {
    end: 0, byte: 1, short: 2, int: 3, long: 4, float: 5, double: 6,
    byteArray: 7, string: 8, list: 9, compound: 10, intArray: 11, longArray: 12
};

export const nbt = {
    byte: (v) => ({ type: 'byte', value: v }),
    short: (v) => ({ type: 'short', value: v }),
    int: (v) => ({ type: 'int', value: v }),
    long: (v) => ({ type: 'long', value: BigInt(v) }),
    string: (v) => ({ type: 'string', value: v }),
    intArray: (v) => ({ type: 'intArray', value: v }),
    longArray: (v) => ({ type: 'longArray', value: v }), // BigInt64Array
    compound: (v) => ({ type: 'compound', value: v }),
    list: (itemType, v) => ({ type: 'list', itemType, value: v })
};

class Writer {
    constructor() {
        this.buf = new Uint8Array(1 << 16);
        this.view = new DataView(this.buf.buffer);
        this.pos = 0;
    }

    ensure(n) {
        if (this.pos + n <= this.buf.length) return;
        let size = this.buf.length * 2;
        while (size < this.pos + n) size *= 2;
        const next = new Uint8Array(size);
        next.set(this.buf);
        this.buf = next;
        this.view = new DataView(next.buffer);
    }

    u8(v) { this.ensure(1); this.view.setInt8(this.pos, v); this.pos += 1; }
    i16(v) { this.ensure(2); this.view.setInt16(this.pos, v); this.pos += 2; }
    i32(v) { this.ensure(4); this.view.setInt32(this.pos, v); this.pos += 4; }
    i64(v) { this.ensure(8); this.view.setBigInt64(this.pos, v); this.pos += 8; }

    str(s) {
        const bytes = new TextEncoder().encode(s);
        this.ensure(2 + bytes.length);
        this.view.setUint16(this.pos, bytes.length);
        this.pos += 2;
        this.buf.set(bytes, this.pos);
        this.pos += bytes.length;
    }

    payload(tag) {
        const { type, value } = tag;
        switch (type) {
            case 'byte': this.u8(value); break;
            case 'short': this.i16(value); break;
            case 'int': this.i32(value); break;
            case 'long': this.i64(value); break;
            case 'string': this.str(value); break;
            case 'byteArray':
                this.i32(value.length);
                for (const b of value) this.u8(b);
                break;
            case 'intArray':
                this.i32(value.length);
                for (const v of value) this.i32(v);
                break;
            case 'longArray':
                this.i32(value.length);
                for (const v of value) this.i64(v);
                break;
            case 'list':
                this.u8(value.length ? TAG[tag.itemType] : TAG.end);
                this.i32(value.length);
                for (const item of value) this.payload({ type: tag.itemType, value: item.value ?? item });
                break;
            case 'compound':
                for (const [name, child] of Object.entries(value)) {
                    this.u8(TAG[child.type]);
                    this.str(name);
                    this.payload(child);
                }
                this.u8(TAG.end);
                break;
            default:
                throw new Error(`Unknown NBT type: ${type}`);
        }
    }
}

// Serialises a root compound to raw (uncompressed) NBT bytes.
export function writeNbt(root, rootName = '') {
    const w = new Writer();
    w.u8(TAG.compound);
    w.str(rootName);
    w.payload(root);
    return w.buf.slice(0, w.pos);
}

export async function gzip(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}
