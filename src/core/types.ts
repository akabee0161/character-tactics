export type { AttackKind, Vec2 } from '../engine/schema';
export type { AiDef, DefeatCond, EnemyPlacement, StageDef, VictoryCond } from '../engine/schema';

import type { Registry } from '../engine/registry';
import type { AiDef, AttackKind, StageDef, Vec2 } from '../engine/schema';
import type { FieldCache } from './fields';

export type Grid = {
  cols: number;
  rows: number;
  cell: number;
  walkable: boolean[];
};

export type FlowField = {
  cols: number;
  rows: number;
  /** ゴールからのセル距離。-1 は到達不能 */
  dist: Int32Array;
};

import type { Rng } from './rng';

export type CharProgress = { level: number; xp: number };

export type AiState = {
  def: AiDef;
  mode: 'idle' | 'chase' | 'return';
  targetUid: string | null;
  /** 初期位置。sentry の帰還先 */
  home: Vec2;
};

export type Unit = {
  uid: string;
  defId: string;
  side: 'player' | 'enemy';
  controller: 'player' | 'ai';
  /** false なら攻撃しない。狙われはする */
  combat: boolean;

  pos: Vec2;
  hp: number;
  maxHp: number;
  power: number;
  guard: number;
  attack: AttackKind;
  range: number;
  attackInterval: number;
  speed: number;
  bowDamageCap: number | null;
  skillId: string | null;

  level: number;
  xp: number;

  goalPos: Vec2 | null;
  goalField: FlowField | null;
  /** 交戦中の相手の uid。null なら非交戦 */
  engagedWith: string | null;
  attackCooldown: number;
  retired: boolean;

  /** controller === 'ai' のときだけ入る */
  ai: AiState | null;

  /** シム時刻の絶対値。この値未満は使用不可（0 なら開始時点で使用可） */
  skillCooldownUntil: number;
  funbaruUntil: number;
  neraiuchiArmed: boolean;
  pinchShown: boolean;
  /** このステージで交戦したことのある相手の defId */
  seenDefIds: string[];
  lastHitBy: string | null;
  lastHitNeraiuchi: boolean;
};

export type Speaker = { side: 'ally' | 'enemy'; id: string };

export type BattlePhase = 'placement' | 'battle' | 'victory' | 'defeat';

export type SimEvent =
  | { type: 'engage'; uid: string; defId: string; targetUid: string; targetDefId: string; firstMeeting: boolean }
  | { type: 'skill'; uid: string; defId: string; skillId: string; hits: number; fromPos: Vec2; toPos: Vec2 }
  | { type: 'pinch'; uid: string; defId: string }
  | { type: 'hit'; targetUid: string; targetPos: Vec2; amount: number;
      sourceUid: string; sourceDefId: string; attackKind: AttackKind; sourcePos: Vec2; neraiuchi: boolean }
  | { type: 'heal'; targetPos: Vec2; amount: number; sourceUid: string; sourceDefId: string; sourcePos: Vec2 }
  | { type: 'unitDefeated'; uid: string; defId: string; byUid: string | null; byDefId: string | null;
      neraiuchi: boolean; pos: Vec2 }
  | { type: 'unitFled'; uid: string; defId: string; byUid: string | null; byDefId: string | null }
  | { type: 'unitRetired'; uid: string; defId: string }
  | { type: 'bondSupport'; targetUid: string; targetDefId: string; supporterUids: string[]; pos: Vec2 }
  | { type: 'levelUp'; uid: string; defId: string; level: number };

export type BattleState = {
  reg: Registry;
  stage: StageDef;
  grid: Grid;
  /** フローフィールドのキャッシュ（core/fields.ts） */
  fields: FieldCache;
  time: number;
  phase: BattlePhase;
  units: Unit[];
  events: SimEvent[];
  counters: Record<string, number>;
  rng: Rng;
  nextEnemyUid: number;
};
