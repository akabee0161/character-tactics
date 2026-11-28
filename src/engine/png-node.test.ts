import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { readPng } from './png-node';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** RGBA の画素を、行ごとに指定したフィルタで符号化した PNG のバイト列にする */
function makePng(
  w: number,
  h: number,
  rgba: number[],
  filters: number[],
  opts: { colorType?: number; depth?: number; interlace?: number; idatParts?: number } = {},
): Buffer {
  const bpp = 4;
  const stride = w * bpp;
  const raw: number[] = [];
  for (let y = 0; y < h; y++) {
    const f = filters[y % filters.length]!;
    raw.push(f);
    for (let i = 0; i < stride; i++) {
      const cur = rgba[y * stride + i]!;
      const a = i >= bpp ? rgba[y * stride + i - bpp]! : 0;
      const b = y > 0 ? rgba[(y - 1) * stride + i]! : 0;
      const c = y > 0 && i >= bpp ? rgba[(y - 1) * stride + i - bpp]! : 0;
      let pred = 0;
      if (f === 1) pred = a;
      else if (f === 2) pred = b;
      else if (f === 3) pred = (a + b) >> 1;
      else if (f === 4) pred = paeth(a, b, c);
      raw.push((cur - pred) & 0xff);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = opts.depth ?? 8;
  ihdr[9] = opts.colorType ?? 6;
  ihdr[12] = opts.interlace ?? 0;
  const z = deflateSync(Buffer.from(raw));
  const parts = opts.idatParts ?? 1;
  const size = Math.ceil(z.length / parts);
  const idats: Buffer[] = [];
  for (let i = 0; i < z.length; i += size) idats.push(chunk('IDAT', z.subarray(i, i + size)));
  return Buffer.concat([SIG, chunk('IHDR', ihdr), ...idats, chunk('IEND', Buffer.alloc(0))]);
}

const PIX3 = Array.from({ length: 3 * 3 * 4 }, (_, i) => (i * 37 + 11) % 256);

describe('readPng', () => {
  it('2×2 の RGBA をフィルタ 0 で読める', () => {
    const rgba = [255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 10, 20, 30, 40];
    const r = readPng(makePng(2, 2, rgba, [0]));
    expect(r.width).toBe(2);
    expect(r.height).toBe(2);
    expect(Array.from(r.data)).toEqual(rgba);
  });

  it('フィルタ 1〜4 で書いた 3×3 を読むと、フィルタ 0 と同じ画素になる', () => {
    const plain = readPng(makePng(3, 3, PIX3, [0]));
    // 行ごとに 1,2,3 / 4,0,1 …と混ぜる（Paeth を含む）
    const mixed = readPng(makePng(3, 3, PIX3, [1, 2, 3]));
    const mixed2 = readPng(makePng(3, 3, PIX3, [4, 0, 4]));
    expect(Array.from(plain.data)).toEqual(PIX3);
    expect(Array.from(mixed.data)).toEqual(PIX3);
    expect(Array.from(mixed2.data)).toEqual(PIX3);
  });

  it('IDAT が複数に分かれていても読める', () => {
    const r = readPng(makePng(3, 3, PIX3, [0], { idatParts: 4 }));
    expect(Array.from(r.data)).toEqual(PIX3);
  });

  it('色の型 2（RGB）は形式のエラーで止まる', () => {
    expect(() => readPng(makePng(3, 3, PIX3, [0], { colorType: 2 }))).toThrow(/対応していない/);
  });

  it('PNG の署名が無ければ止まる', () => {
    expect(() => readPng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toThrow(/PNG/);
  });

  it('assets/images/roran-map.png を読むと、幅と高さが IHDR と一致し、data の長さが 幅×高さ×4', () => {
    const b = readFileSync('assets/images/roran-map.png');
    const r = readPng(b);
    expect(r.width).toBe(b.readUInt32BE(16));
    expect(r.height).toBe(b.readUInt32BE(20));
    expect(r.data.length).toBe(r.width * r.height * 4);
  });
});
