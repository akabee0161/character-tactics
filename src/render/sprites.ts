import { imageFor } from './images';
import type { ImageCache } from './images';
import type { Sprites } from '../engine/schema';
import type { Vec2 } from '../core/types';
import type { Rect } from '../ui/hit';

/** 描画に要るぶんだけ。UnitDef / EnemyDef のどちらでも渡せる */
export type SpriteDef = { color: string; role: string; sprites: Sprites };

function circle(ctx: CanvasRenderingContext2D, c: Vec2, radius: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 画像とプレースホルダの分岐はこの中だけに置く。呼び出し側で分けると、
 * 片方だけ位置がずれる事故が必ず起きる。
 * 画像は直径 2*radius の正方形に収める。丸くしたいならアセット側でそう描く
 */
function drawSquareOrCircle(
  ctx: CanvasRenderingContext2D,
  c: Vec2,
  radius: number,
  color: string,
  img: CanvasImageSource | null,
): void {
  if (img === null) {
    circle(ctx, c, radius, color);
    return;
  }
  ctx.drawImage(img, c.x - radius, c.y - radius, radius * 2, radius * 2);
}

export function drawFace(
  ctx: CanvasRenderingContext2D, center: Vec2, radius: number,
  def: SpriteDef, images: ImageCache,
): void {
  drawSquareOrCircle(ctx, center, radius, def.color, imageFor(images, def.sprites.face));
}

export function drawMapUnit(
  ctx: CanvasRenderingContext2D, center: Vec2, radius: number,
  def: SpriteDef, images: ImageCache,
): void {
  // TODO Task 2: map シートの描画を実装。今はフォールバックで circle を描く
  drawSquareOrCircle(ctx, center, radius, def.color, null);
}

/** クラス。画像が無ければ role の文字を出す */
export function drawRoleBadge(
  ctx: CanvasRenderingContext2D, rect: Rect, def: SpriteDef, images: ImageCache,
): void {
  const img = imageFor(images, def.sprites.role);
  if (img === null) {
    ctx.fillStyle = '#ffd479';
    ctx.font = '14px sans-serif';
    ctx.fillText(def.role, rect.x, rect.y + 18);
    return;
  }
  ctx.drawImage(img, rect.x, rect.y, rect.h, rect.h);
}
