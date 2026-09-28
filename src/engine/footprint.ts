import type { Vec2 } from './schema';

/**
 * 足元の箱。ユニットの位置（足元の点）から左右に FOOT_HALF_W、下に FOOT_BELOW、上には広げない。
 * 32px のコマの体は x=10〜23（中心16）。下の 2px は足先のぶんで、描画側の FOOT_INSET と同じ値。
 * 上を広げないのは、通れないマスの下に立ったとき頭が上のマスに重なるのを、
 * マスの手前に立っている見え方として残すため（README「アセットの大きさの規約」）
 */
export const FOOT_HALF_W = 6;
export const FOOT_BELOW = 2;

/** 右端と下端は含めない。箱の端がマスの境界ちょうどなら、隣のマスにはかからない */
const EDGE = 1e-6;

/**
 * 箱の四隅（左上・右上・左下・右下）。箱は1マス（32px）より小さいので、
 * 四隅がすべて通れるマスにあれば箱全体が通れるマスに収まる
 */
export function footCorners(pos: Vec2): Vec2[] {
  const left = pos.x - FOOT_HALF_W;
  const right = pos.x + FOOT_HALF_W - EDGE;
  const bottom = pos.y + FOOT_BELOW - EDGE;
  return [
    { x: left, y: pos.y }, { x: right, y: pos.y },
    { x: left, y: bottom }, { x: right, y: bottom },
  ];
}
