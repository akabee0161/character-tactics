// テスト専用。`node:zlib` を使うのでブラウザのコードから import しない。
// 対応する形式は、色の型 6（RGBA）・深度 8・インターレースなしだけ（pixel-asset-forge/tools/export.py の出力）。
import { inflateSync } from 'node:zlib';

export type Rgba = { width: number; height: number; data: Uint8Array };

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const BPP = 4;

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export function readPng(bytes: Uint8Array): Rgba {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buf.length < 8 || SIGNATURE.some((v, i) => buf[i] !== v)) {
    throw new Error('PNG の署名が無い');
  }
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  let sawHeader = false;
  let pos = 8;
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString('latin1');
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8];
      const colorType = body[9];
      const interlace = body[12];
      if (colorType !== 6 || depth !== 8 || interlace !== 0) {
        throw new Error(`PNG の形式に対応していない: 色の型 ${colorType} / 深度 ${depth} / インターレース ${interlace}`);
      }
      sawHeader = true;
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  if (!sawHeader) throw new Error('PNG に IHDR が無い');

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * BPP;
  if (raw.length !== (stride + 1) * height) {
    throw new Error(`PNG の画素の長さが合わない: ${raw.length} / 期待 ${(stride + 1) * height}`);
  }
  const data = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[src + i]!;
      const a = i >= BPP ? data[dst + i - BPP]! : 0;
      const b = y > 0 ? data[dst - stride + i]! : 0;
      const c = y > 0 && i >= BPP ? data[dst - stride + i - BPP]! : 0;
      let v: number;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: v = x + paeth(a, b, c); break;
        default: throw new Error(`PNG のフィルタが不明: ${filter}（${y} 行目）`);
      }
      data[dst + i] = v & 0xff;
    }
  }
  return { width, height, data };
}
