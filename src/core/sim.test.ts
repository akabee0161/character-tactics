import { describe, expect, it } from 'vitest';
import { isWalkableAt } from './field';
import { beginBattle, createBattleState } from './state';
import { step } from './sim';
import { testRegistry } from './testing';
import type { BattleState, CharProgress, EnemyUnit, StageDef, Vec2 } from './types';

// enemies に常時 1 体だけ入れておく。updatePhase は敵が 0 体になった瞬間に victory へ
// 進めてしまうので（フェーズ 5 で updateObjectives に置き換わるまでの暫定挙動）、
// このテストファイルの「移動」系テストが途中で phase を失って固まらないよう、
// ゴールから遠く離れた位置に置いて自然には撃破されない状態にしておく
const STAGE: StageDef = {
  id: 'teststage', name: 'テスト', cell: 32,
  mapRows: ['..........', '..........', '..........'],
  placementZone: [{ pos: { x: 16, y: 16 } }],
  roster: ['roran', 'ines', 'mist', 'gau'],
  enemies: [{ defId: 'narazumono', pos: { x: 304, y: 16 }, ai: { kind: 'aggressive' } }],
  victory: { type: 'reach', pos: { x: 304, y: 16 }, radius: 40, by: 'any' },
  defeat: [{ type: 'unitLost', defIds: ['roran'] }],
};

const LV1: Record<string, CharProgress> = {
  roran: { level: 1, xp: 0 }, ines: { level: 1, xp: 0 },
  mist: { level: 1, xp: 0 }, gau: { level: 1, xp: 0 },
};

function fresh(stage: StageDef = STAGE): BattleState {
  const s = createBattleState(testRegistry(), stage, LV1, 42);
  beginBattle(s);
  // 邪魔にならない場所へ全員どける
  for (const a of s.allies) a.pos = { x: 16, y: 80 };
  return s;
}

const ally = (s: BattleState, id: string) => s.allies.find((a) => a.id === id)!;

function spawnEnemy(s: BattleState, kind: string, pos: Vec2): EnemyUnit {
  const def = s.reg.enemies.get(kind)!;
  const e: EnemyUnit = {
    uid: `t${s.nextEnemyUid++}`, kind, ai: { kind: 'aggressive' },
    pos: { ...pos }, hp: def.maxHp, maxHp: def.maxHp,
    engagedWith: null, attackCooldown: 0, lastHitBy: null, lastHitNeraiuchi: false,
  };
  s.enemies.push(e);
  return e;
}

describe('step: 時間とイベント', () => {
  it('dt ぶん時刻が進む', () => {
    const s = fresh();
    step(s, [], 0.5);
    expect(s.time).toBeCloseTo(0.5);
  });

  it('events は毎 step クリアされる', () => {
    const s = fresh();
    step(s, [{ type: 'skill', allyId: 'roran' }], 0.1);
    expect(s.events.length).toBeGreaterThan(0);
    step(s, [], 0.1);
    expect(s.events).toEqual([]);
  });

  it('battle フェーズでなければ何も進まない', () => {
    const s = fresh();
    const before = s.enemies[0]!.pos.x;
    s.phase = 'victory';
    step(s, [], 1);
    expect(s.time).toBe(0);
    expect(s.enemies[0]!.pos.x).toBe(before);
  });
});

describe('step: 移動', () => {
  it('move コマンドで味方が目的地へ向かう', () => {
    const s = fresh();
    const before = ally(s, 'roran').pos.x;
    step(s, [{ type: 'move', allyId: 'roran', dest: { x: 300, y: 80 } }], 1);
    expect(ally(s, 'roran').pos.x).toBeGreaterThan(before);
  });

  it('速度どおりに進む（ロランは 60px/秒）', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 80 };
    step(s, [{ type: 'move', allyId: 'roran', dest: { x: 304, y: 80 } }], 1);
    expect(ally(s, 'roran').pos.x).toBeCloseTo(76, 0);
  });

  it('歩けない目的地は無視される', () => {
    const s = fresh({ ...STAGE, mapRows: ['..........', '.....#....', '..........'] });
    ally(s, 'roran').pos = { x: 16, y: 80 };
    step(s, [{ type: 'move', allyId: 'roran', dest: { x: 176, y: 48 } }], 1);
    expect(ally(s, 'roran').pos).toEqual({ x: 16, y: 80 });
  });

  it('たいきゃく中の味方は動かない', () => {
    const s = fresh();
    ally(s, 'roran').retired = true;
    step(s, [{ type: 'move', allyId: 'roran', dest: { x: 300, y: 80 } }], 1);
    expect(ally(s, 'roran').pos).toEqual({ x: 16, y: 80 });
  });

  it('敵は味方の初期配置地点に向かって進む', () => {
    const s = fresh();
    const e = spawnEnemy(s, 'narazumono', { x: 304, y: 16 });
    step(s, [], 1);
    expect(e.pos.x).toBeLessThan(304);
  });

  it('交戦中の味方は移動しない', () => {
    const s = fresh();
    for (const a of s.allies) if (a.id !== 'roran') a.pos = { x: 900, y: 900 };
    const e = spawnEnemy(s, 'narazumono', { x: 20, y: 80 });
    step(s, [], 0.1);
    const pos = { ...ally(s, 'roran').pos };
    step(s, [], 1);
    expect(ally(s, 'roran').pos).toEqual(pos);
    expect(e.engagedWith).toBe('roran');
  });
});

describe('step: 交戦の成立と解除', () => {
  it('レンジ内に入ると交戦が成立し engage イベントが出る', () => {
    const s = fresh();
    for (const a of s.allies) if (a.id !== 'roran') a.pos = { x: 900, y: 900 };
    const e = spawnEnemy(s, 'narazumono', { x: 30, y: 80 });
    step(s, [], 0.1);
    expect(ally(s, 'roran').engagedWith).toBe(e.uid);
    expect(s.events).toContainEqual({
      type: 'engage', allyId: 'roran', enemyUid: e.uid, kind: 'narazumono', firstMeeting: true,
    });
  });

  it('同じ敵種の 2 回目は firstMeeting が false', () => {
    const s = fresh();
    const e1 = spawnEnemy(s, 'narazumono', { x: 30, y: 80 });
    step(s, [], 0.1);
    e1.pos = { x: 900, y: 900 };
    step(s, [], 0.1);
    spawnEnemy(s, 'narazumono', { x: 30, y: 80 });
    step(s, [], 0.1);
    const engages = s.events.filter((ev) => ev.type === 'engage');
    expect(engages).toHaveLength(1);
    expect(engages[0]).toMatchObject({ firstMeeting: false });
  });

  it('イネスは 160px 離れていても交戦できる', () => {
    const s = fresh();
    ally(s, 'ines').pos = { x: 16, y: 80 };
    for (const a of s.allies) if (a.id !== 'ines') a.pos = { x: 16, y: 300 };
    const e = spawnEnemy(s, 'narazumono', { x: 170, y: 80 });
    step(s, [], 0.1);
    expect(ally(s, 'ines').engagedWith).toBe(e.uid);
  });

  it('レンジから外れると交戦が解除される', () => {
    const s = fresh();
    for (const a of s.allies) if (a.id !== 'roran') a.pos = { x: 900, y: 900 };
    const e = spawnEnemy(s, 'narazumono', { x: 30, y: 80 });
    step(s, [], 0.1);
    e.pos = { x: 900, y: 900 };
    step(s, [], 0.1);
    expect(ally(s, 'roran').engagedWith).toBeNull();
  });

  it('move コマンドで交戦から離脱できる', () => {
    const s = fresh();
    for (const a of s.allies) if (a.id !== 'roran') a.pos = { x: 900, y: 900 };
    spawnEnemy(s, 'narazumono', { x: 30, y: 80 });
    step(s, [], 0.1);
    expect(ally(s, 'roran').engagedWith).not.toBeNull();
    step(s, [{ type: 'move', allyId: 'roran', dest: { x: 300, y: 80 } }], 0.1);
    expect(ally(s, 'roran').engagedWith).toBeNull();
  });

  it('一度成立した交戦相手は、より近い敵が来ても入れ替わらない', () => {
    const s = fresh();
    for (const a of s.allies) if (a.id !== 'roran') a.pos = { x: 900, y: 900 };
    const first = spawnEnemy(s, 'narazumono', { x: 40, y: 80 });
    step(s, [], 0.1);
    spawnEnemy(s, 'narazumono', { x: 18, y: 80 });
    step(s, [], 0.1);
    expect(ally(s, 'roran').engagedWith).toBe(first.uid);
  });
});

describe('step: skill コマンド', () => {
  it('skill コマンドでスキルが発動する', () => {
    const s = fresh();
    step(s, [{ type: 'skill', allyId: 'roran' }], 0.1);
    expect(ally(s, 'roran').skillUsed).toBe(true);
  });

  it('かけぬけるは dest つきで発動する', () => {
    const s = fresh();
    step(s, [{ type: 'skill', allyId: 'gau', dest: { x: 200, y: 80 } }], 0.1);
    expect(ally(s, 'gau').pos).toEqual({ x: 200, y: 80 });
  });
});

describe('goalPos: 目的地の保持', () => {
  it('move コマンドで目的地が入る', () => {
    const s = fresh();
    step(s, [{ type: 'move', allyId: 'roran', dest: { x: 200, y: 48 } }], 0.1);
    expect(ally(s, 'roran').goalPos).toEqual({ x: 200, y: 48 });
  });

  it('歩けない場所への move では目的地が入らない', () => {
    const stage: StageDef = { ...STAGE, mapRows: ['..........', '..####....', '..........'] };
    const s = fresh(stage);
    step(s, [{ type: 'move', allyId: 'roran', dest: { x: 80, y: 48 } }], 0.1);
    expect(ally(s, 'roran').goalPos).toBeNull();
  });

  it('たいきゃくすると目的地が消える', () => {
    const s = fresh();
    const a = ally(s, 'roran');
    step(s, [{ type: 'move', allyId: 'roran', dest: { x: 200, y: 48 } }], 0.1);
    a.hp = 0;
    step(s, [], 0.1);
    expect(a.goalPos).toBeNull();
  });
});

describe('移動: 直線ショートカットと到達', () => {
  it('障害物がなければ目的地へまっすぐ進む', () => {
    const s = fresh();
    const a = ally(s, 'roran');
    a.pos = { x: 16, y: 16 };
    const dest = { x: 208, y: 80 };
    step(s, [{ type: 'move', allyId: 'roran', dest }], 0.1);
    // 出発点と目的地を結ぶ直線上に乗っていること
    const t = (a.pos.x - 16) / (dest.x - 16);
    expect(a.pos.y).toBeCloseTo(16 + t * (dest.y - 16), 4);
  });

  it('目的地に着いたら、その座標ちょうどで止まって goalPos が消える', () => {
    const s = fresh();
    const a = ally(s, 'roran');
    a.pos = { x: 16, y: 16 };
    const dest = { x: 48, y: 16 };
    step(s, [{ type: 'move', allyId: 'roran', dest }], 0.1);
    for (let i = 0; i < 200 && a.goalPos; i++) step(s, [], 0.1);
    expect(a.goalPos).toBeNull();
    expect(a.pos).toEqual(dest);
  });

  it('障害物ごしでもフローフィールドで回り込んで到達する', () => {
    // (16,16) から (176,80) への直線は壁 (row1, col2-5) を貫くため見通せず、
    // フローフィールドで壁の左側から回り込む経路を取る必要がある
    const stage: StageDef = { ...STAGE, mapRows: ['..........', '..####....', '..........'] };
    const s = fresh(stage);
    const a = ally(s, 'roran');
    a.pos = { x: 16, y: 16 };
    const dest = { x: 176, y: 80 };
    step(s, [{ type: 'move', allyId: 'roran', dest }], 0.1);
    for (let i = 0; i < 400 && a.goalPos; i++) {
      step(s, [], 0.1);
      // 壁を突っ切っていないこと（回り込みが働いていることの直接の証拠）
      expect(isWalkableAt(s.grid, a.pos)).toBe(true);
    }
    expect(a.pos).toEqual(dest);
  });
});

describe('ウェーブの さくじょ', () => {
  function realStageFresh() {
    const reg = testRegistry();
    const stage = reg.stages[0]!;
    const progress: Record<string, CharProgress> = {};
    for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
    return { stage, state: createBattleState(reg, stage, progress, 1) };
  }

  it('step は battle フェーズでだけ すすむ', () => {
    const { state } = realStageFresh();
    const before = state.enemies[0]!.pos.x;
    step(state, [], 0.5); // placement のまま
    expect(state.enemies[0]!.pos.x).toBe(before);
    beginBattle(state);
    step(state, [], 0.5);
    expect(state.enemies[0]!.pos.x).not.toBe(before);
  });

  it('じかんが たっても 敵が ふえない', () => {
    const { state } = realStageFresh();
    beginBattle(state);
    const n = state.enemies.length;
    for (let i = 0; i < 600; i++) step(state, [], 1 / 60);
    expect(state.enemies.length).toBeLessThanOrEqual(n);
  });

  it('敵が ぜんめつしたら victory', () => {
    const { state } = realStageFresh();
    beginBattle(state);
    state.enemies = [];
    step(state, [], 1 / 60);
    expect(state.phase).toBe('victory');
  });

  it('とりでが やぶられたら defeat', () => {
    const { state } = realStageFresh();
    beginBattle(state);
    state.fortHp = 0;
    step(state, [], 1 / 60);
    expect(state.phase).toBe('defeat');
  });
});
