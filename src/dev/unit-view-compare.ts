// unit-view の照らし合わせ（純関数）。ゲームの描画関数が描いた画素を、シートのコマと画素ごとに比べる
import { FOOT_INSET } from '../render/sprites';

export type Pixels = { width: number; height: number; data: Uint8ClampedArray | Uint8Array };
type Rgb = readonly [number, number, number];

/**
 * 升の足元の点から、コマの左上があるべき位置。足元の行（frame - FOOT_INSET）が foot.y に来て、
 * 飛行の定義は lift（FLYING_LIFT）だけ上へ。bodyCenter を使わない独立の正解
 */
export function expectedTopLeft(foot: { x: number; y: number }, frame: number, lift: number): { x: number; y: number } {
  return { x: foot.x - frame / 2, y: foot.y - (frame - FOOT_INSET) - lift };
}

function rgbAt(p: Pixels, x: number, y: number): Rgb | null {
  if (x < 0 || y < 0 || x >= p.width || y >= p.height) return null;
  const i = (y * p.width + x) * 4;
  return [p.data[i]!, p.data[i + 1]!, p.data[i + 2]!];
}

const same = (a: Rgb | null, b: Rgb): boolean => a !== null && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/**
 * 違った画素の数。範囲はコマの正方形とその周り 1px。
 * 正方形の中: シートのアルファ > 0 なら RGB が一致、0 なら背景色。周り 1px: 背景色。
 * キャンバスの外は背景色とみなす（そこに絵は無い）
 */
export function compareCell(
  actual: Pixels, topLeft: { x: number; y: number }, sheet: Pixels, src: { x: number; y: number },
  frame: number, bg: Rgb,
): number {
  let bad = 0;
  for (let dy = -1; dy <= frame; dy++) {
    for (let dx = -1; dx <= frame; dx++) {
      const got = rgbAt(actual, topLeft.x + dx, topLeft.y + dy);
      const inside = dx >= 0 && dy >= 0 && dx < frame && dy < frame;
      let want: Rgb = bg;
      if (inside) {
        const si = ((src.y + dy) * sheet.width + src.x + dx) * 4;
        if (sheet.data[si + 3]! > 0) want = [sheet.data[si]!, sheet.data[si + 1]!, sheet.data[si + 2]!];
      }
      if (got === null) {
        if (want !== bg) bad++;
        continue;
      }
      if (!same(got, want)) bad++;
    }
  }
  return bad;
}

/** 正方形の中で、体だけの画素が背景色でなく（＝絵がある）、印を足した後と RGB が違う画素の数 */
export function countCovered(
  bodyOnly: Pixels, withMarks: Pixels, topLeft: { x: number; y: number }, frame: number, bg: Rgb,
): number {
  let n = 0;
  for (let dy = 0; dy < frame; dy++) {
    for (let dx = 0; dx < frame; dx++) {
      const b = rgbAt(bodyOnly, topLeft.x + dx, topLeft.y + dy);
      if (b === null || same(b, bg)) continue;
      if (!same(rgbAt(withMarks, topLeft.x + dx, topLeft.y + dy), b)) n++;
    }
  }
  return n;
}
