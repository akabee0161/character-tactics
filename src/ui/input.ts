import { distance } from '../core/field';
import type { CharId, Vec2 } from '../core/types';

/** これ以下の移動量で離したらタップ扱いにする（論理座標のピクセル） */
export const TAP_SLOP = 12;

export type PointerStart = {
  /** ポインターを下ろした位置にいた味方。地面なら null */
  charId: CharId | null;
  startMap: Vec2;
  /** 下ろした時点で、その味方がすでに選択されていたか */
  wasSelected: boolean;
  /** このジェスチャを開始した指/ポインターの識別子。マルチタッチ時に他の指のイベントと区別するために使う */
  pointerId: number;
};

export type MapGesture =
  | { type: 'none' }
  | { type: 'select'; charId: CharId }
  | { type: 'deselect' }
  | { type: 'moveChar'; charId: CharId; dest: Vec2 };

/**
 * マップ上のポインター操作を、フェーズに依存しないジェスチャへ変換する。
 * moveChar をコマンドにするか再配置にするかは呼び出し側が決める。
 */
export function resolveMapGesture(
  start: PointerStart,
  endMap: Vec2,
  selected: CharId | null,
): MapGesture {
  const moved = distance(start.startMap, endMap) > TAP_SLOP;

  if (start.charId !== null) {
    if (moved) return { type: 'moveChar', charId: start.charId, dest: endMap };
    return start.wasSelected ? { type: 'deselect' } : { type: 'select', charId: start.charId };
  }

  if (moved || selected === null) return { type: 'none' };
  return { type: 'moveChar', charId: selected, dest: endMap };
}
