import type { MapSheet } from '../engine/schema';
import type { SimEvent, Vec2 } from '../core/types';

export type Dir = 'down' | 'up' | 'left' | 'right';
export type AnimState = 'idle' | 'walk' | 'attack';
export type AnimFrame = { row: number; col: number };

/** 行の並びの規約。シートの 12 行はこの順で並ぶ */
export const DIRS: readonly Dir[] = ['down', 'up', 'left', 'right'];
export const STATES: readonly AnimState[] = ['idle', 'walk', 'attack'];

/** アニメ状態を持たない相手（ドラッグ中の残像など）に使う静止コマ。呼び出し元で共有されるので凍結しておく */
export const STILL: AnimFrame = Object.freeze({ row: 0, col: 0 });

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

/** updateMotion が必要とするぶんだけ。core の Unit がそのまま通る */
export type AnimUnit = { uid: string; pos: Vec2; side: 'player' | 'enemy' };

function entryFor(store: AnimStore, uid: string, pos: Vec2, initialDir: Dir): AnimEntry {
  const found = store.byUid.get(uid);
  if (found) return found;
  const made: AnimEntry = {
    dir: initialDir, lastPos: { ...pos }, movingUntil: 0, attackUntil: 0, attackFrom: 0,
  };
  store.byUid.set(uid, made);
  return made;
}

/**
 * 前フレームとの位置の差から歩行と向きを決める。
 * 攻撃中は向きを固定する（歩きながら撃つので、移動由来の向きと競合する）
 */
export function updateMotion(store: AnimStore, units: readonly AnimUnit[], now: number): void {
  const seen = new Set<string>();
  for (const u of units) {
    seen.add(u.uid);
    // 味方は上へ、敵は下へ攻めるので、動き出す前の向きはそちらに向けておく
    const e = entryFor(store, u.uid, u.pos, u.side === 'player' ? 'up' : 'down');
    const d = dirOf(u.pos.x - e.lastPos.x, u.pos.y - e.lastPos.y);
    if (d !== null) {
      e.movingUntil = now + WALK_HOLD;
      if (now >= e.attackUntil) e.dir = d;
    }
    e.lastPos = { ...u.pos };
  }
  for (const uid of store.byUid.keys()) {
    if (!seen.has(uid)) store.byUid.delete(uid);
  }
}

/**
 * attack イベントから攻撃モーションを立てる。
 * durationOf はそのユニットの attack.frames / attack.fps を返す。
 * シートを持たないユニットには null を返し、その場合は向きだけ更新する
 */
export function noteAttacks(
  store: AnimStore,
  events: readonly SimEvent[],
  now: number,
  durationOf: (defId: string) => number | null,
): void {
  for (const ev of events) {
    if (ev.type !== 'attack') continue;
    const e = entryFor(store, ev.uid, ev.pos, 'down');
    const d = dirOf(ev.targetPos.x - ev.pos.x, ev.targetPos.y - ev.pos.y);
    if (d !== null) e.dir = d;
    const dur = durationOf(ev.defId);
    if (dur === null || dur <= 0) continue;
    e.attackFrom = now;
    e.attackUntil = now + dur;
  }
}

export function stateOf(store: AnimStore, uid: string, now: number): AnimState {
  const e = store.byUid.get(uid);
  if (!e) return 'idle';
  if (now < e.attackUntil) return 'attack';
  if (now < e.movingUntil) return 'walk';
  return 'idle';
}

/** 描画側が呼ぶのはこれ1本。now は battle.time（シム時刻） */
export function frameFor(store: AnimStore, uid: string, sheet: MapSheet, now: number): AnimFrame {
  const e = store.byUid.get(uid);
  if (!e) return STILL;
  const state = stateOf(store, uid, now);
  const elapsed = state === 'attack' ? now - e.attackFrom : now;
  return frameOf(state, e.dir, sheet, elapsed);
}
