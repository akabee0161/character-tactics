export type { AttackKind, Vec2 } from '../engine/schema';
import type { Registry } from '../engine/registry';
import type { AttackKind, Vec2 } from '../engine/schema';

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

export const FORT_MAX_HP = 30;

export type CharProgress = { level: number; xp: number };

export type AllyUnit = {
  id: string;
  pos: Vec2;
  hp: number;
  maxHp: number;
  power: number;
  guard: number;
  attack: AttackKind;
  range: number;
  attackInterval: number;
  speed: number;
  skill: string;
  /** 移動先へのフローフィールド。null なら移動しない */
  goalField: FlowField | null;
  /** 移動先として指定されたマップ座標。null なら移動しない */
  goalPos: Vec2 | null;
  /** 交戦中の敵の uid。null なら非交戦 */
  engagedWith: string | null;
  attackCooldown: number;
  /** このウェーブでスキルを使ったか */
  skillUsed: boolean;
  retired: boolean;
  /** ふんばりの効果が切れる時刻（state.time 基準）。過去の値なら効果なし */
  funbaruUntil: number;
  neraiuchiArmed: boolean;
  /** このウェーブでピンチのセリフを出したか */
  pinchShown: boolean;
  /** このステージで交戦したことのある敵の defId */
  seenDefIds: string[];
};

export type EnemyUnit = {
  uid: string;
  kind: string;
  pos: Vec2;
  hp: number;
  maxHp: number;
  engagedWith: string | null;
  attackCooldown: number;
  /** 最後にこの敵を攻撃した味方。撃破の手柄をつけるのに使う */
  lastHitBy: string | null;
  /** 最後に受けた攻撃がねらいうちだったか */
  lastHitNeraiuchi: boolean;
};

export type Speaker = { side: 'ally' | 'enemy'; id: string };

export type SpawnEntry = { at: number; kind: string; from: Vec2 };
export type WaveDef = {
  spawns: SpawnEntry[];
  /** ウェーブ開始時に順番に表示する会話。省略時は何も表示しない */
  intro?: { speaker: Speaker; lineId: string }[];
};

export type StageDef = {
  id: number;
  name: string;
  cell: number;
  /** '.' = 歩ける / '#' = 歩けない */
  mapRows: string[];
  fort: Vec2;
  landings: Vec2[];
  waves: WaveDef[];
  /** false ならガルムは撤退せず最後まで戦う（ステージ3） */
  garumFlees: boolean;
};

export type BattlePhase = 'placement' | 'wave' | 'waveCleared' | 'stageCleared' | 'defeat';

export type SimEvent =
  | { type: 'engage'; allyId: string; enemyUid: string; kind: string; firstMeeting: boolean }
  | { type: 'skill'; allyId: string; skill: string; hits: number }
  | { type: 'pinch'; allyId: string }
  | { type: 'hit'; targetPos: Vec2; amount: number }
  | { type: 'enemyDefeated'; uid: string; kind: string; byAlly: string | null; neraiuchi: boolean }
  | { type: 'garumRepelled'; byAlly: string | null }
  | { type: 'allyRetired'; allyId: string }
  | { type: 'bondSupport'; targetId: string; supporterIds: string[] }
  | { type: 'fortDamaged'; amount: number };

export type BattleState = {
  reg: Registry;
  stage: StageDef;
  grid: Grid;
  /** 砦をゴールとするフローフィールド。全敵で共有する */
  enemyField: FlowField;
  fortHp: number;
  waveIndex: number;
  /** ウェーブ開始からの経過秒 */
  time: number;
  phase: BattlePhase;
  allies: AllyUnit[];
  enemies: EnemyUnit[];
  /** まだ出現していないスポーン */
  pending: SpawnEntry[];
  /** 直近の step で発生したイベント */
  events: SimEvent[];
  rng: Rng;
  counters: Record<string, number>;
  nextEnemyUid: number;
};
