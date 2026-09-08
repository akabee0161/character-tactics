#!/usr/bin/env node
// 仮アセットの生成器。本番の絵が揃ったら、このファイルごと消してよい。
// 使い方: node tools/gen-placeholder-sprites.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images');

// ---- PNG の書き出し（8bit RGBA、フィルタなし） ----

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(c) {
  const stride = 1 + c.w * 4;
  const raw = Buffer.alloc(c.h * stride);
  for (let y = 0; y < c.h; y++) {
    raw[y * stride] = 0; // フィルタ種別 0
    Buffer.from(c.px.buffer, c.px.byteOffset + y * c.w * 4, c.w * 4).copy(raw, y * stride + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.w, 0);
  ihdr.writeUInt32BE(c.h, 4);
  ihdr[8] = 8; // ビット深度
  ihdr[9] = 6; // カラータイプ RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- 画布 ----

const canvas = (w, h) => ({ w, h, px: new Uint8Array(w * h * 4) });
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const shade = (c, f) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * f))));

function put(c, x, y, col) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  c.px[i] = col[0]; c.px[i + 1] = col[1]; c.px[i + 2] = col[2]; c.px[i + 3] = 255;
}

function rect(c, x, y, w, h, col) {
  for (let j = 0; j < Math.round(h); j++) for (let i = 0; i < Math.round(w); i++) put(c, x + i, y + j, col);
}

function disc(c, cx, cy, r, col) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(c, x, y, col);
}

const SKIN = [242, 214, 178];
const DARK = [40, 36, 44];
const STEEL = [176, 182, 196];

const WEAPON = {
  shield: { w: 0.20, h: 0.26, col: STEEL },
  bow:    { w: 0.07, h: 0.30, col: [150, 106, 62] },
  staff:  { w: 0.07, h: 0.36, col: [198, 150, 96] },
  dagger: { w: 0.07, h: 0.18, col: STEEL },
  sword:  { w: 0.08, h: 0.28, col: STEEL },
  club:   { w: 0.12, h: 0.30, col: [122, 92, 66] },
};

// ---- 1コマ ----

/** s×s のコマを (ox, oy) に描く */
function drawFrame(c, ox, oy, s, def, state, dir, i) {
  const body = hex(def.color);
  const hair = shade(body, 0.55);
  const bob = state === 'idle' && i % 2 === 1 ? 1 : 0;
  const ext = state === 'attack' ? [0, 0.14, 0.07][i] * s : 0;
  const w = WEAPON[def.weapon];
  const ww = w.w * s, wh = w.h * s;

  const drawWeapon = () => {
    if (dir === 'left') rect(c, ox + 0.20 * s - ext, oy + 0.46 * s + bob, ww, wh, w.col);
    else if (dir === 'right') rect(c, ox + 0.80 * s - ww + ext, oy + 0.46 * s + bob, ww, wh, w.col);
    else if (dir === 'down') rect(c, ox + 0.66 * s, oy + 0.50 * s + bob + ext, ww, wh * 0.7, w.col);
    else rect(c, ox + 0.24 * s, oy + 0.34 * s + bob - ext, ww, wh * 0.7, w.col);
  };

  // 上向きは背中なので、武器は体より先に（＝奥に）描く
  if (dir === 'up') drawWeapon();

  // 脚。walk は左右を振る
  const swing = state === 'walk' ? [0, 1, 0, -1][i] * 0.05 * s : 0;
  rect(c, ox + 0.36 * s, oy + 0.74 * s + bob, 0.10 * s, 0.14 * s + swing, DARK);
  rect(c, ox + 0.54 * s, oy + 0.74 * s + bob, 0.10 * s, 0.14 * s - swing, DARK);

  // 胴
  rect(c, ox + 0.32 * s, oy + 0.48 * s + bob, 0.36 * s, 0.28 * s, body);
  // 頭
  disc(c, ox + 0.50 * s, oy + 0.36 * s + bob, 0.17 * s, SKIN);

  // 髪・被り物。上向きは後頭部なので頭を全部おおう
  const capH = dir === 'up' ? 0.34 * s : 0.16 * s;
  for (let y = 0; y < capH; y++) {
    for (let x = 0; x < 0.34 * s; x++) {
      const px = ox + 0.33 * s + x, py = oy + 0.19 * s + bob + y;
      const dx = px - (ox + 0.50 * s), dy = py - (oy + 0.36 * s + bob);
      if (dx * dx + dy * dy <= (0.17 * s) ** 2) put(c, px, py, hair);
    }
  }

  // 顔。下向きは両目、横向きは片目だけ、上向きは無し
  if (dir === 'down') {
    rect(c, ox + 0.42 * s, oy + 0.38 * s + bob, 0.05 * s, 0.06 * s, DARK);
    rect(c, ox + 0.55 * s, oy + 0.38 * s + bob, 0.05 * s, 0.06 * s, DARK);
  } else if (dir === 'left') {
    rect(c, ox + 0.38 * s, oy + 0.38 * s + bob, 0.05 * s, 0.06 * s, DARK);
  } else if (dir === 'right') {
    rect(c, ox + 0.58 * s, oy + 0.38 * s + bob, 0.05 * s, 0.06 * s, DARK);
  }

  if (dir !== 'up') drawWeapon();
}

// ---- シート・顔・クラス ----

const STATES = [['idle', 2], ['walk', 4], ['attack', 3]];
const DIRS = ['down', 'up', 'left', 'right'];

function sheetFor(def) {
  const s = def.frame;
  const cols = Math.max(...STATES.map(([, n]) => n));
  const c = canvas(cols * s, 12 * s);
  STATES.forEach(([state, n], si) => {
    DIRS.forEach((dir, di) => {
      // フレーム数が少ない状態の余った右側は透明のまま置く
      for (let i = 0; i < n; i++) drawFrame(c, i * s, (si * 4 + di) * s, s, def, state, dir, i);
    });
  });
  return c;
}

/** 顔。128×128 のバスト */
function faceFor(def) {
  const s = 128, c = canvas(s, s);
  const body = hex(def.color), hair = shade(body, 0.55);
  rect(c, 0, 0, s, s, shade(body, 1.35));
  rect(c, 0.22 * s, 0.74 * s, 0.56 * s, 0.26 * s, body);
  disc(c, 0.50 * s, 0.46 * s, 0.26 * s, SKIN);
  for (let y = 0; y < 0.30 * s; y++) {
    for (let x = 0; x < 0.54 * s; x++) {
      const px = 0.23 * s + x, py = 0.20 * s + y;
      if ((px - 0.50 * s) ** 2 + (py - 0.46 * s) ** 2 <= (0.26 * s) ** 2) put(c, px, py, hair);
    }
  }
  rect(c, 0.38 * s, 0.48 * s, 0.06 * s, 0.08 * s, DARK);
  rect(c, 0.56 * s, 0.48 * s, 0.06 * s, 0.08 * s, DARK);
  rect(c, 0.45 * s, 0.62 * s, 0.10 * s, 0.03 * s, shade(SKIN, 0.75));
  return c;
}

/** クラスの印。64×64。武器の形だけ */
function roleFor(weapon, color) {
  const s = 64, c = canvas(s, s);
  const w = WEAPON[weapon];
  rect(c, 0, 0, s, s, shade(hex(color), 0.45));
  rect(c, 0.5 * s - (w.w * s * 1.6) / 2, 0.5 * s - (w.h * s * 1.6) / 2, w.w * s * 1.6, w.h * s * 1.6, w.col);
  return c;
}

// ---- 定義 ----

const CHARS = [
  { id: 'roran', color: '#4a80c8', weapon: 'shield', frame: 32 },
  { id: 'ines', color: '#3faa6a', weapon: 'bow', frame: 32 },
  { id: 'mist', color: '#c86fb0', weapon: 'staff', frame: 32 },
  { id: 'gau', color: '#e0a03c', weapon: 'dagger', frame: 32 },
  // ボスだけ大きい。ユニットごとに違う frame が通ることも実地で確かめる
  { id: 'garum', color: '#b03a3a', weapon: 'club', frame: 48 },
  { id: 'narazumono', color: '#8a5a4a', weapon: 'sword', frame: 32 },
  { id: 'tatemochi', color: '#6b6b7a', weapon: 'shield', frame: 32 },
];

const ROLES = [
  ['role-tate', 'shield', '#4a80c8'],
  ['role-yumi', 'bow', '#3faa6a'],
  ['role-mahou', 'staff', '#c86fb0'],
  ['role-monomi', 'dagger', '#e0a03c'],
  ['role-teki', 'sword', '#b03a3a'],
];

for (const def of CHARS) {
  const sheet = sheetFor(def);
  writeFileSync(join(OUT, `${def.id}-map.png`), encodePng(sheet));
  writeFileSync(join(OUT, `${def.id}-face.png`), encodePng(faceFor(def)));
  console.log(`${def.id}-map.png ${sheet.w}x${sheet.h}`);
}
for (const [name, weapon, color] of ROLES) {
  writeFileSync(join(OUT, `${name}.png`), encodePng(roleFor(weapon, color)));
  console.log(`${name}.png 64x64`);
}
