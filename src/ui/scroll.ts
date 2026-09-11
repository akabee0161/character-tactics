import { TAP_SLOP } from './input';

/**
 * 縦スクロールの計算。描画にも入力にも属さないので独立させる。
 * ステージ選択の一覧が画面に収まらなくなったため用意した
 */

/** 内容が見える範囲に収まりきらないぶんの高さ。収まるなら 0 */
export function maxScroll(contentH: number, viewH: number): number {
  return Math.max(0, contentH - viewH);
}

/** スクロール位置を 0〜max に収める */
export function clampScroll(offset: number, max: number): number {
  return Math.min(max, Math.max(0, offset));
}

/**
 * 指を離したときにタップ扱いにするか。しきい値は盤面のドラッグ判定と同じ
 * TAP_SLOP を使う。画面ごとに違う値にすると、同じ指の動きが場所によって
 * タップになったりならなかったりする
 */
export function isTap(dy: number): boolean {
  return Math.abs(dy) <= TAP_SLOP;
}
