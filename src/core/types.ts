export type Vec2 = { x: number; y: number };

export type CharId = 'roran' | 'ines' | 'mist' | 'gau';
export type EnemyKind = 'narazumono' | 'tatemochi' | 'garum';
export type SkillId = 'funbaru' | 'neraiuchi' | 'omajinai' | 'kakenukeru';
export type AttackKind = 'melee' | 'bow';

export const CHAR_IDS: readonly CharId[] = ['roran', 'ines', 'mist', 'gau'];

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
  id: CharId;
  pos: Vec2;
  hp: number;
  maxHp: number;
  power: number;
  guard: number;
  attack: AttackKind;
  range: number;
  attackInterval: number;
  speed: number;
  skill: SkillId;
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
  /** このステージで交戦したことのある敵種 */
  seenKinds: EnemyKind[];
};

export type EnemyUnit = {
  uid: string;
  kind: EnemyKind;
  pos: Vec2;
  hp: number;
  maxHp: number;
  engagedWith: CharId | null;
  attackCooldown: number;
  /** 最後にこの敵を攻撃した味方。撃破の手柄をつけるのに使う */
  lastHitBy: CharId | null;
  /** 最後に受けた攻撃がねらいうちだったか */
  lastHitNeraiuchi: boolean;
};

export type Speaker = { side: 'ally'; id: CharId } | { side: 'enemy'; id: EnemyKind };

export type SpawnEntry = { at: number; kind: EnemyKind; from: Vec2 };
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
  | { type: 'engage'; allyId: CharId; enemyUid: string; kind: EnemyKind; firstMeeting: boolean }
  | { type: 'skill'; allyId: CharId; skill: SkillId }
  | { type: 'pinch'; allyId: CharId }
  | { type: 'hit'; targetPos: Vec2; amount: number }
  | { type: 'enemyDefeated'; uid: string; kind: EnemyKind; byAlly: CharId | null }
  | { type: 'garumRepelled'; byAlly: CharId | null }
  | { type: 'allyRetired'; allyId: CharId }
  | { type: 'bondSupport'; supporterId: CharId; targetId: CharId }
  | { type: 'fortDamaged'; amount: number };

export type CharBattleStats = {
  defeats: number;
  skillUses: number;
  neraiuchiKills: number;
  kakenukeruHits: number;
  bondSupports: number;
};

export type BattleState = {
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
  stats: Record<CharId, CharBattleStats>;
  nextEnemyUid: number;
};
