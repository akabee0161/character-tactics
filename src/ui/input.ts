import { distance } from '../core/field';
import type { Vec2 } from '../core/types';

/** これ以下の移動量で離したらタップ扱いにする（論理座標のピクセル） */
export const TAP_SLOP = 12;

export type PointerStart = {
  /** ポインターを下ろした位置にいた味方。地面なら null */
  uid: string | null;
  startMap: Vec2;
  /** 下ろした時点で、その味方がすでに選択されていたか */
  wasSelected: boolean;
  /** このジェスチャを開始した指/ポインターの識別子。マルチタッチ時に他の指のイベントと区別するために使う */
  pointerId: number;
};

export type MapGesture =
  | { type: 'none' }
  | { type: 'select'; uid: string }
  | { type: 'deselect' }
  | { type: 'moveUnit'; uid: string; dest: Vec2 };

/**
 * マップ上のポインター操作を、フェーズに依存しないジェスチャへ変換する。
 * moveUnit をコマンドにするか再配置にするかは呼び出し側が決める。
 */
export function resolveMapGesture(
  start: PointerStart,
  endMap: Vec2,
  selected: string | null,
): MapGesture {
  const moved = distance(start.startMap, endMap) > TAP_SLOP;

  if (start.uid !== null) {
    if (moved) return { type: 'moveUnit', uid: start.uid, dest: endMap };
    return start.wasSelected ? { type: 'deselect' } : { type: 'select', uid: start.uid };
  }

  if (moved || selected === null) return { type: 'none' };
  return { type: 'moveUnit', uid: selected, dest: endMap };
}
