import { describe, expect, it } from 'vitest';
import { FOOT_INSET } from '../render/sprites';
import { compareCell, countCovered, expectedTopLeft } from './unit-view-compare';
import type { Pixels } from './unit-view-compare';

const BG = [255, 0, 255] as const;
const F = 8;

function blank(w: number, h: number): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([BG[0], BG[1], BG[2], 255], i * 4);
  return { width: w, height: h, data };
}

/** シートの 1 コマ（8×8）。(1,1) 赤・(2,1) 緑・(3,5) 青が不透明、あとは透明（アルファ 0） */
function makeSheet(): Pixels {
  const data = new Uint8ClampedArray(F * F * 4);
  const put = (x: number, y: number, rgb: [number, number, number]) => data.set([...rgb, 255], (y * F + x) * 4);
  put(1, 1, [200, 10, 10]);
  put(2, 1, [10, 200, 10]);
  put(3, 5, [10, 10, 200]);
  return { width: F, height: F, data };
}

/** シートのコマを、背景の上の (ox, oy) にそのまま置いた画素 */
function place(sheet: Pixels, ox: number, oy: number, w = 24, h = 24): Pixels {
  const px = blank(w, h);
  for (let y = 0; y < F; y++) {
    for (let x = 0; x < F; x++) {
      const i = (y * F + x) * 4;
      if (sheet.data[i + 3]! > 0) px.data.set([sheet.data[i]!, sheet.data[i + 1]!, sheet.data[i + 2]!, 255], ((oy + y) * w + ox + x) * 4);
    }
  }
  return px;
}

const SRC = { x: 0, y: 0 };

describe('compareCell', () => {
  it('シートのコマをそのまま置いた画素は 0', () => {
    const sheet = makeSheet();
    expect(compareCell(place(sheet, 8, 8), { x: 8, y: 8 }, sheet, SRC, F, BG)).toBe(0);
  });

  it('1 画素ずれて置くと 0 でない（右に 1、下に 1 の両方）', () => {
    const sheet = makeSheet();
    expect(compareCell(place(sheet, 9, 8), { x: 8, y: 8 }, sheet, SRC, F, BG)).toBeGreaterThan(0);
    expect(compareCell(place(sheet, 8, 9), { x: 8, y: 8 }, sheet, SRC, F, BG)).toBeGreaterThan(0);
  });

  it('色が 1 画素違えば 1', () => {
    const sheet = makeSheet();
    const px = place(sheet, 8, 8);
    px.data[((8 + 1) * 24 + 8 + 1) * 4] = 201; // (1,1) の赤を 1 ずらす
    expect(compareCell(px, { x: 8, y: 8 }, sheet, SRC, F, BG)).toBe(1);
  });

  it('透明の所に色があれば数える', () => {
    const sheet = makeSheet();
    const px = place(sheet, 8, 8);
    px.data.set([1, 2, 3, 255], ((8 + 6) * 24 + 8 + 6) * 4); // シートでは透明の (6,6)
    expect(compareCell(px, { x: 8, y: 8 }, sheet, SRC, F, BG)).toBe(1);
  });

  it('周り 1px にはみ出した色を数える', () => {
    const sheet = makeSheet();
    const px = place(sheet, 8, 8);
    px.data.set([1, 2, 3, 255], (8 - 1) * 24 * 4 + 8 * 4); // コマの 1 行上
    px.data.set([1, 2, 3, 255], (8 * 24 + 8 + F) * 4); // コマの 1 列右
    expect(compareCell(px, { x: 8, y: 8 }, sheet, SRC, F, BG)).toBe(2);
  });

  it('周り 1px より外は数えない', () => {
    const sheet = makeSheet();
    const px = place(sheet, 8, 8);
    px.data.set([1, 2, 3, 255], (8 - 2) * 24 * 4 + 8 * 4);
    expect(compareCell(px, { x: 8, y: 8 }, sheet, SRC, F, BG)).toBe(0);
  });

  it('lift の分だけ上にずれた絵を一致とみなす', () => {
    const sheet = makeSheet();
    const foot = { x: 12, y: 18 };
    const top = expectedTopLeft(foot, F, 5);
    expect(compareCell(place(sheet, top.x, top.y), top, sheet, SRC, F, BG)).toBe(0);
    // lift なしの位置と比べると違う
    const noLift = expectedTopLeft(foot, F, 0);
    expect(compareCell(place(sheet, top.x, top.y), noLift, sheet, SRC, F, BG)).toBeGreaterThan(0);
  });

  it('シートの src の位置のコマを見る（シートの中の別のコマ）', () => {
    const wide: Pixels = { width: F * 2, height: F, data: new Uint8ClampedArray(F * 2 * F * 4) };
    wide.data.set([9, 9, 9, 255], (2 * wide.width + F + 2) * 4); // 右のコマの (2,2)
    const px = blank(24, 24);
    px.data.set([9, 9, 9, 255], ((8 + 2) * 24 + 8 + 2) * 4);
    expect(compareCell(px, { x: 8, y: 8 }, wide, { x: F, y: 0 }, F, BG)).toBe(0);
  });
});

describe('expectedTopLeft', () => {
  it('足元の行（frame - FOOT_INSET）が foot.y に来る位置（32 と 48）', () => {
    for (const frame of [32, 48]) {
      const foot = { x: 100, y: 200 };
      const t = expectedTopLeft(foot, frame, 0);
      expect(t.x).toBe(foot.x - frame / 2);
      expect(t.y + (frame - FOOT_INSET)).toBe(foot.y);
    }
  });

  it('lift だけ上へ', () => {
    expect(expectedTopLeft({ x: 0, y: 100 }, 32, 5).y).toBe(expectedTopLeft({ x: 0, y: 100 }, 32, 0).y - 5);
  });
});

describe('countCovered', () => {
  it('絵の上に塗った印の画素だけを数え、背景の上の印は数えない', () => {
    const sheet = makeSheet();
    const body = place(sheet, 8, 8);
    const withMarks = place(sheet, 8, 8);
    withMarks.data.set([0, 0, 0, 255], ((8 + 1) * 24 + 8 + 1) * 4); // 絵（赤）の上
    withMarks.data.set([0, 0, 0, 255], ((8 + 3) * 24 + 8 + 5) * 4); // 背景の上
    expect(countCovered(body, withMarks, { x: 8, y: 8 }, F, BG)).toBe(1);
  });

  it('同じ色で塗り替えた画素は数えない', () => {
    const sheet = makeSheet();
    const body = place(sheet, 8, 8);
    expect(countCovered(body, place(sheet, 8, 8), { x: 8, y: 8 }, F, BG)).toBe(0);
  });
});
