import type { MapSheet } from '../engine/schema';
import type { Vec2 } from '../core/types';

export type Dir = 'down' | 'up' | 'left' | 'right';
export type AnimState = 'idle' | 'walk' | 'attack';
export type AnimFrame = { row: number; col: number };

/** 行の並びの規約。シートの 12 行はこの順で並ぶ */
export const DIRS: readonly Dir[] = ['down', 'up', 'left', 'right'];
export const STATES: readonly AnimState[] = ['idle', 'walk', 'attack'];

/** アニメ状態を持たない相手（ドラッグ中の残像など）に使う静止コマ */
export const STILL: AnimFrame = { row: 0, col: 0 };

/**
 * 歩行と判定する時間を伸ばす幅。シムは 1/60 の固定ステップ、描画は rAF なので、
 * 120Hz 端末では描画2回につきシム1回になり、差分ゼロのフレームが必ず出る。
 * 素直に差分だけで判定すると歩行と待機がちらつく
 */
export const WALK_HOLD = 0.12;

/** これ以下の移動は止まっているとみなす */
const MOVE_EPS = 0.01;

export type AnimEntry = {
  dir: Dir;
  lastPos: Vec2;
  movingUntil: number;
  attackUntil: number;
  attackFrom: number;
};

export type AnimStore = { byUid: Map<string, AnimEntry> };

export function makeAnimStore(): AnimStore {
  return { byUid: new Map() };
}

/** ステージ跨ぎで捨てる。uid は使い回されうるので持ち越さない */
export function resetAnim(store: AnimStore): void {
  store.byUid.clear();
}

/** 優勢な軸で4方向に丸める。動いていなければ null。y は下向きが正 */
export function dirOf(dx: number, dy: number): Dir | null {
  if (Math.abs(dx) < MOVE_EPS && Math.abs(dy) < MOVE_EPS) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/**
 * 行 = 状態index × 4 + 方向index。列は経過時間から。
 * idle と walk はループし、attack だけは最終コマでクランプする
 */
export function frameOf(state: AnimState, dir: Dir, sheet: MapSheet, elapsed: number): AnimFrame {
  const row = STATES.indexOf(state) * 4 + DIRS.indexOf(dir);
  const anim = sheet[state];
  const i = Math.floor(Math.max(0, elapsed) * anim.fps);
  const col = state === 'attack' ? Math.min(i, anim.frames - 1) : i % anim.frames;
  return { row, col };
}
