import { imageFor } from './images';
import type { ImageCache } from './images';
import type { AnimFrame } from './anim';
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

/**
 * シートがあるときの描画サイズは frame から決まる（等倍）。
 * radius は丸フォールバック専用で、シートがあるときは使わない
 */
export function drawMapUnit(
  ctx: CanvasRenderingContext2D, center: Vec2, radius: number,
  def: SpriteDef, images: ImageCache, frame: AnimFrame,
): void {
  const sheet = def.sprites.map;
  if (sheet === null) {
    circle(ctx, center, radius, def.color);
    return;
  }
  const img = imageFor(images, sheet.sheet);
  if (img === null) {
    circle(ctx, center, radius, def.color);
    return;
  }
  const s = sheet.frame;
  ctx.drawImage(
    img, frame.col * s, frame.row * s, s, s,
    Math.round(center.x - s / 2), Math.round(center.y - s / 2), s, s,
  );
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

/**
 * 実際に描く大きさの半分。HPバー・はた・リングの基準にする。
 * 画像の読み込み待ちでも同じ値を返す（読み終わった瞬間に位置が跳ねないように）
 */
export function drawHalf(def: SpriteDef, fallback: number): number {
  return def.sprites.map === null ? fallback : def.sprites.map.frame / 2;
}
