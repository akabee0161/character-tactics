import { describe, expect, it } from 'vitest';
import type { EnemyDef } from '../engine/schema';
import { distance, isWalkableAt } from './field';
import { hostilesOf, step } from './sim';
import { beginBattle, createBattleState } from './state';
import { testRegistry } from './testing';
import type { AiDef, BattleState, CharProgress, StageDef, Unit, Vec2 } from './types';

function makeTestUnit(s: BattleState, def: EnemyDef, pos: Vec2, ai: AiDef): Unit {
  return {
    uid: `t${s.units.length + 1}`, defId: def.id, side: 'enemy', controller: 'ai',
    combat: def.combat, pos: { ...pos },
    hp: def.maxHp, maxHp: def.maxHp, power: def.power, guard: def.guard,
    attack: def.attack, range: def.range, attackInterval: def.attackInterval, speed: def.speed,
    bowDamageCap: def.bowDamageCap, skillId: def.skillId,
    level: 1, xp: 0,
    goalPos: null, goalField: null, engagedWith: null, attackCooldown: 0, retired: false,
    ai: { def: ai, mode: 'idle', targetUid: null, home: { ...pos } },
    skillUsed: false, funbaruUntil: -1, neraiuchiArmed: false, pinchShown: false,
    seenDefIds: [], lastHitBy: null, lastHitNeraiuchi: false,
  };
}

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

// AI の くみこみテストは x:400 前後 〜 y:400 前後の座標を つかうため、
// STAGE(10x3セル)には おさまらない。テストぶんだけ ひろい へやを べつに もつ
const AI_STAGE: StageDef = {
  id: 'ai-teststage', name: 'AIテスト', cell: 32,
  mapRows: Array.from({ length: 15 }, () => '.'.repeat(30)),
  placementZone: [{ pos: { x: 16, y: 16 } }],
  roster: ['roran', 'ines', 'mist', 'gau'],
  enemies: [],
  victory: { type: 'reach', pos: { x: 848, y: 240 }, radius: 40, by: 'any' },
  defeat: [{ type: 'unitLost', defIds: ['roran'] }],
};

function fresh(stage: StageDef = STAGE): { stage: StageDef; state: BattleState } {
  const state = createBattleState(testRegistry(), stage, LV1, 42);
  beginBattle(state);
  // 邪魔にならない場所へ全員どける
  for (const u of state.units) if (u.side === 'player') u.pos = { x: 16, y: 80 };
  return { stage, state };
}

function unitOf(s: BattleState, defId: string): Unit {
  const u = s.units.find((x) => x.defId === defId && x.side === 'player');
  if (!u) throw new Error(`いない: ${defId}`);
  return u;
}

function spawnEnemy(s: BattleState, defId: string, pos: { x: number; y: number }): Unit {
  const def = s.reg.enemies.get(defId)!;
  const uid = `t${s.nextEnemyUid++}`;
  const u: Unit = {
    uid, defId, side: 'enemy', controller: 'ai', combat: def.combat,
    pos: { ...pos }, hp: def.maxHp, maxHp: def.maxHp, power: def.power, guard: def.guard,
    attack: def.attack, range: def.range, attackInterval: def.attackInterval, speed: def.speed,
    bowDamageCap: def.bowDamageCap, skillId: def.skillId,
    level: 1, xp: 0,
    goalPos: null, goalField: null, engagedWith: null, attackCooldown: 0, retired: false,
    ai: { def: { kind: 'aggressive' }, mode: 'idle', targetUid: null, home: { ...pos } },
    skillUsed: false, funbaruUntil: -1, neraiuchiArmed: false, pinchShown: false,
    seenDefIds: [], lastHitBy: null, lastHitNeraiuchi: false,
  };
  s.units.push(u);
  return u;
}

describe('step: 時間とイベント', () => {
  it('dt ぶん時刻が進む', () => {
    const { state: s } = fresh();
    step(s, [], 0.5);
    expect(s.time).toBeCloseTo(0.5);
  });

  it('events は毎 step クリアされる', () => {
    const { state: s } = fresh();
    step(s, [{ type: 'skill', uid: unitOf(s, 'roran').uid }], 0.1);
    expect(s.events.length).toBeGreaterThan(0);
    step(s, [], 0.1);
    expect(s.events).toEqual([]);
  });

  it('battle フェーズでなければ何も進まない', () => {
    const { state: s } = fresh();
    const enemy = s.units.find((u) => u.side === 'enemy')!;
    const before = enemy.pos.x;
    s.phase = 'victory';
    step(s, [], 1);
    expect(s.time).toBe(0);
    expect(enemy.pos.x).toBe(before);
  });
});

describe('step: 移動', () => {
  it('move コマンドで味方が目的地へ向かう', () => {
    const { state: s } = fresh();
    const before = unitOf(s, 'roran').pos.x;
    step(s, [{ type: 'move', uid: unitOf(s, 'roran').uid, dest: { x: 300, y: 80 } }], 1);
    expect(unitOf(s, 'roran').pos.x).toBeGreaterThan(before);
  });

  it('速度どおりに進む（ロランは 60px/秒）', () => {
    const { state: s } = fresh();
    unitOf(s, 'roran').pos = { x: 16, y: 80 };
    step(s, [{ type: 'move', uid: unitOf(s, 'roran').uid, dest: { x: 304, y: 80 } }], 1);
    expect(unitOf(s, 'roran').pos.x).toBeCloseTo(76, 0);
  });

  it('歩けない目的地は無視される', () => {
    const { state: s } = fresh({ ...STAGE, mapRows: ['..........', '.....#....', '..........'] });
    unitOf(s, 'roran').pos = { x: 16, y: 80 };
    step(s, [{ type: 'move', uid: unitOf(s, 'roran').uid, dest: { x: 176, y: 48 } }], 1);
    expect(unitOf(s, 'roran').pos).toEqual({ x: 16, y: 80 });
  });

  it('たいきゃく中の味方は動かない', () => {
    const { state: s } = fresh();
    const roran = unitOf(s, 'roran');
    roran.retired = true;
    step(s, [{ type: 'move', uid: roran.uid, dest: { x: 300, y: 80 } }], 1);
    expect(unitOf(s, 'roran').pos).toEqual({ x: 16, y: 80 });
  });

  it('敵は味方の初期配置地点に向かって進む', () => {
    const { state: s } = fresh();
    const e = spawnEnemy(s, 'narazumono', { x: 304, y: 16 });
    step(s, [], 1);
    expect(e.pos.x).toBeLessThan(304);
  });

  it('交戦中の味方は移動しない', () => {
    const { state: s } = fresh();
    for (const u of s.units) if (u.side === 'player' && u.defId !== 'roran') u.pos = { x: 900, y: 900 };
    const e = spawnEnemy(s, 'narazumono', { x: 20, y: 80 });
    step(s, [], 0.1);
    const pos = { ...unitOf(s, 'roran').pos };
    step(s, [], 1);
    expect(unitOf(s, 'roran').pos).toEqual(pos);
    expect(e.engagedWith).toBe(unitOf(s, 'roran').uid);
  });
});

describe('step: 交戦の成立と解除', () => {
  it('レンジ内に入ると交戦が成立し engage イベントが出る', () => {
    const { state: s } = fresh();
    for (const u of s.units) if (u.side === 'player' && u.defId !== 'roran') u.pos = { x: 900, y: 900 };
    const e = spawnEnemy(s, 'narazumono', { x: 30, y: 80 });
    step(s, [], 0.1);
    const roran = unitOf(s, 'roran');
    expect(roran.engagedWith).toBe(e.uid);
    expect(s.events).toContainEqual({
      type: 'engage', uid: roran.uid, defId: 'roran', targetUid: e.uid, targetDefId: 'narazumono', firstMeeting: true,
    });
  });

  it('同じ敵種の 2 回目は firstMeeting が false', () => {
    const { state: s } = fresh();
    const roran = unitOf(s, 'roran');
    const e1 = spawnEnemy(s, 'narazumono', { x: 30, y: 80 });
    step(s, [], 0.1);
    e1.pos = { x: 900, y: 900 };
    step(s, [], 0.1);
    spawnEnemy(s, 'narazumono', { x: 30, y: 80 });
    step(s, [], 0.1);
    const engages = s.events.filter((ev) => ev.type === 'engage' && ev.uid === roran.uid);
    expect(engages).toHaveLength(1);
    expect(engages[0]).toMatchObject({ firstMeeting: false });
  });

  it('イネスは 160px 離れていても交戦できる', () => {
    const { state: s } = fresh();
    unitOf(s, 'ines').pos = { x: 16, y: 80 };
    for (const u of s.units) if (u.side === 'player' && u.defId !== 'ines') u.pos = { x: 16, y: 300 };
    const e = spawnEnemy(s, 'narazumono', { x: 170, y: 80 });
    step(s, [], 0.1);
    expect(unitOf(s, 'ines').engagedWith).toBe(e.uid);
  });

  it('レンジから外れると交戦が解除される', () => {
    const { state: s } = fresh();
    for (const u of s.units) if (u.side === 'player' && u.defId !== 'roran') u.pos = { x: 900, y: 900 };
    const e = spawnEnemy(s, 'narazumono', { x: 30, y: 80 });
    step(s, [], 0.1);
    e.pos = { x: 900, y: 900 };
    step(s, [], 0.1);
    expect(unitOf(s, 'roran').engagedWith).toBeNull();
  });

  it('move コマンドで交戦から離脱できる', () => {
    const { state: s } = fresh();
    for (const u of s.units) if (u.side === 'player' && u.defId !== 'roran') u.pos = { x: 900, y: 900 };
    spawnEnemy(s, 'narazumono', { x: 30, y: 80 });
    step(s, [], 0.1);
    const roran = unitOf(s, 'roran');
    expect(roran.engagedWith).not.toBeNull();
    step(s, [{ type: 'move', uid: roran.uid, dest: { x: 300, y: 80 } }], 0.1);
    expect(unitOf(s, 'roran').engagedWith).toBeNull();
  });

  it('一度成立した交戦相手は、より近い敵が来ても入れ替わらない', () => {
    const { state: s } = fresh();
    for (const u of s.units) if (u.side === 'player' && u.defId !== 'roran') u.pos = { x: 900, y: 900 };
    const first = spawnEnemy(s, 'narazumono', { x: 40, y: 80 });
    step(s, [], 0.1);
    spawnEnemy(s, 'narazumono', { x: 18, y: 80 });
    step(s, [], 0.1);
    expect(unitOf(s, 'roran').engagedWith).toBe(first.uid);
  });
});

describe('step: skill コマンド', () => {
  it('skill コマンドでスキルが発動する', () => {
    const { state: s } = fresh();
    step(s, [{ type: 'skill', uid: unitOf(s, 'roran').uid }], 0.1);
    expect(unitOf(s, 'roran').skillUsed).toBe(true);
  });

  it('かけぬけるは dest つきで発動する', () => {
    const { state: s } = fresh();
    step(s, [{ type: 'skill', uid: unitOf(s, 'gau').uid, dest: { x: 200, y: 80 } }], 0.1);
    expect(unitOf(s, 'gau').pos).toEqual({ x: 200, y: 80 });
  });
});

describe('goalPos: 目的地の保持', () => {
  it('move コマンドで目的地が入る', () => {
    const { state: s } = fresh();
    step(s, [{ type: 'move', uid: unitOf(s, 'roran').uid, dest: { x: 200, y: 48 } }], 0.1);
    expect(unitOf(s, 'roran').goalPos).toEqual({ x: 200, y: 48 });
  });

  it('歩けない場所への move では目的地が入らない', () => {
    const stage: StageDef = { ...STAGE, mapRows: ['..........', '..####....', '..........'] };
    const { state: s } = fresh(stage);
    step(s, [{ type: 'move', uid: unitOf(s, 'roran').uid, dest: { x: 80, y: 48 } }], 0.1);
    expect(unitOf(s, 'roran').goalPos).toBeNull();
  });

  it('たいきゃくすると目的地が消える', () => {
    const { state: s } = fresh();
    const roran = unitOf(s, 'roran');
    step(s, [{ type: 'move', uid: roran.uid, dest: { x: 200, y: 48 } }], 0.1);
    roran.hp = 0;
    step(s, [], 0.1);
    expect(unitOf(s, 'roran').goalPos).toBeNull();
  });
});

describe('移動: 直線ショートカットと到達', () => {
  it('障害物がなければ目的地へまっすぐ進む', () => {
    const { state: s } = fresh();
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    const dest = { x: 208, y: 80 };
    step(s, [{ type: 'move', uid: roran.uid, dest }], 0.1);
    // 出発点と目的地を結ぶ直線上に乗っていること
    const a = unitOf(s, 'roran');
    const t = (a.pos.x - 16) / (dest.x - 16);
    expect(a.pos.y).toBeCloseTo(16 + t * (dest.y - 16), 4);
  });

  it('目的地に着いたら、その座標ちょうどで止まって goalPos が消える', () => {
    const { state: s } = fresh();
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    const dest = { x: 48, y: 16 };
    step(s, [{ type: 'move', uid: roran.uid, dest }], 0.1);
    for (let i = 0; i < 200 && unitOf(s, 'roran').goalPos; i++) step(s, [], 0.1);
    expect(unitOf(s, 'roran').goalPos).toBeNull();
    expect(unitOf(s, 'roran').pos).toEqual(dest);
  });

  it('障害物ごしでもフローフィールドで回り込んで到達する', () => {
    // (16,16) から (176,80) への直線は壁 (row1, col2-5) を貫くため見通せず、
    // フローフィールドで壁の左側から回り込む経路を取る必要がある
    const stage: StageDef = { ...STAGE, mapRows: ['..........', '..####....', '..........'] };
    const { state: s } = fresh(stage);
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    const dest = { x: 176, y: 80 };
    step(s, [{ type: 'move', uid: roran.uid, dest }], 0.1);
    for (let i = 0; i < 400 && unitOf(s, 'roran').goalPos; i++) {
      step(s, [], 0.1);
      // 壁を突っ切っていないこと（回り込みが働いていることの直接の証拠）
      expect(isWalkableAt(s.grid, unitOf(s, 'roran').pos)).toBe(true);
    }
    expect(unitOf(s, 'roran').pos).toEqual(dest);
  });
});

describe('ウェーブの さくじょ', () => {
  function realStageFresh(): { stage: StageDef; state: BattleState } {
    const reg = testRegistry();
    const stage = reg.stages[0]!;
    const progress: Record<string, CharProgress> = {};
    for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
    return { stage, state: createBattleState(reg, stage, progress, 1) };
  }

  it('step は battle フェーズでだけ すすむ', () => {
    const { state } = realStageFresh();
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    const before = enemy.pos.x;
    step(state, [], 0.5); // placement のまま
    expect(enemy.pos.x).toBe(before);
    beginBattle(state);
    step(state, [], 0.5);
    expect(enemy.pos.x).not.toBe(before);
  });

  it('じかんが たっても 敵が ふえない', () => {
    const { state } = realStageFresh();
    beginBattle(state);
    const n = state.units.filter((u) => u.side === 'enemy').length;
    for (let i = 0; i < 600; i++) step(state, [], 1 / 60);
    expect(state.units.filter((u) => u.side === 'enemy').length).toBe(n);
    expect(state.units.filter((u) => u.side === 'enemy' && !u.retired).length).toBeLessThanOrEqual(n);
  });

});

describe('ユニット型の とうごう', () => {
  it('味方も 敵も おなじ units に はいる', () => {
    const { stage, state } = fresh();
    expect(state.units.length).toBe(stage.roster.length + stage.enemies.length);
    expect(state.units.filter((u) => u.side === 'player').length).toBe(stage.roster.length);
    expect(state.units.filter((u) => u.side === 'enemy').length).toBe(stage.enemies.length);
  });

  it('てきたい はんていは side の ひかくだけ', () => {
    const { state } = fresh();
    const p = state.units.find((u) => u.side === 'player')!;
    const e = state.units.find((u) => u.side === 'enemy')!;
    expect(hostilesOf(state, p).map((u) => u.uid)).toContain(e.uid);
    expect(hostilesOf(state, p).map((u) => u.uid)).not.toContain(p.uid);
  });

  it('たおれた ユニットは てきたい こうほに ならない', () => {
    const { state } = fresh();
    const p = state.units.find((u) => u.side === 'player')!;
    const e = state.units.find((u) => u.side === 'enemy')!;
    e.retired = true;
    expect(hostilesOf(state, p).map((u) => u.uid)).not.toContain(e.uid);
  });

  it('move コマンドは uid で さす', () => {
    const { state } = fresh();
    beginBattle(state);
    const p = state.units.find((u) => u.side === 'player')!;
    const dest = { ...state.stage.placementZone[0]!.pos };
    step(state, [{ type: 'move', uid: p.uid, dest }], 0.01);
    expect(p.goalPos).toEqual(dest);
  });

  it('こうせん あいては 1たいに つき 1たい', () => {
    const { state } = fresh();
    beginBattle(state);
    const engaged = state.units.filter((u) => u.engagedWith !== null).map((u) => u.engagedWith);
    for (let i = 0; i < 300; i++) step(state, [], 1 / 60);
    const after = state.units.filter((u) => u.engagedWith !== null).map((u) => u.engagedWith!);
    expect(new Set(after).size).toBe(after.length);
    void engaged;
  });

  it('combat: false の ユニットは こうげきしない', () => {
    const { state } = fresh();
    beginBattle(state);
    const p = state.units.find((u) => u.side === 'player')!;
    const e = state.units.find((u) => u.side === 'enemy')!;
    p.combat = false;
    p.pos = { ...e.pos };
    const before = e.hp;
    for (let i = 0; i < 300; i++) step(state, [], 1 / 60);
    expect(e.hp).toBe(before);
  });

  it('combat: false の ユニットも ねらわれる', () => {
    const { state } = fresh();
    beginBattle(state);
    const p = state.units.find((u) => u.side === 'player')!;
    const e = state.units.find((u) => u.side === 'enemy')!;
    p.combat = false;
    // 到達勝利の はんいの そとで こうせんさせる（そうでないと すぐ victory になり すすまない）
    e.pos = { x: 16, y: 80 };
    p.pos = { ...e.pos };
    const before = p.hp;
    for (let i = 0; i < 300; i++) step(state, [], 1 / 60);
    expect(p.hp).toBeLessThan(before);
  });
});

describe('AI の くみこみ', () => {
  function withAi(kind: AiDef, enemyPos: Vec2) {
    const { state } = fresh(AI_STAGE);
    beginBattle(state);
    // 敵を1体だけにして、その1体の ふるまいを 見る
    state.units = state.units.filter((u) => u.side === 'player');
    // victory.pos ({x:848,y:240}, radius 40) と かさならない いちに おく
    for (const p of state.units) p.pos = { x: 848, y: 112 };
    const def = state.reg.enemies.get('narazumono')!;
    const e = makeTestUnit(state, def, enemyPos, kind);
    state.units.push(e);
    return { state, e };
  }

  it('sentry は だれも みえなければ うごかない', () => {
    const { state, e } = withAi({ kind: 'sentry', sightRange: 60 }, { x: 300, y: 240 });
    const before = { ...e.pos };
    for (let i = 0; i < 120; i++) step(state, [], 1 / 60);
    expect(e.pos).toEqual(before);
  });

  it('sentry は さくてき はんいに はいると ちかづく', () => {
    const { state, e } = withAi({ kind: 'sentry', sightRange: 600 }, { x: 300, y: 240 });
    const before = e.pos.x;
    for (let i = 0; i < 120; i++) step(state, [], 1 / 60);
    expect(e.pos.x).toBeGreaterThan(before);
  });

  it('aggressive は とおくても ちかづく', () => {
    const { state, e } = withAi({ kind: 'aggressive' }, { x: 300, y: 240 });
    const before = e.pos.x;
    for (let i = 0; i < 120; i++) step(state, [], 1 / 60);
    expect(e.pos.x).toBeGreaterThan(before);
  });

  it('guard は leash を こえたら post に もどる', () => {
    const post = { x: 300, y: 240 };
    const { state, e } = withAi(
      { kind: 'guard', post, leash: 40, sightRange: 600 }, { x: 400, y: 240 },
    );
    for (let i = 0; i < 300; i++) step(state, [], 1 / 60);
    expect(distance(e.pos, post)).toBeLessThan(40);
  });

  it('ai の mode が じょうたいに かきもどされる', () => {
    const { state, e } = withAi({ kind: 'aggressive' }, { x: 300, y: 240 });
    step(state, [], 1 / 60);
    expect(e.ai!.mode).toBe('chase');
    expect(e.ai!.targetUid).not.toBeNull();
  });

  it('たおれた 敵の AI は うごかない', () => {
    const { state, e } = withAi({ kind: 'aggressive' }, { x: 300, y: 240 });
    e.retired = true;
    const before = { ...e.pos };
    for (let i = 0; i < 120; i++) step(state, [], 1 / 60);
    expect(e.pos).toEqual(before);
  });

  it('BFS の かいすうが 敵の かずに ひれいしない', () => {
    const { state } = fresh();
    beginBattle(state);
    for (let i = 0; i < 60; i++) step(state, [], 1 / 60);
    // ユニットごとに 1まい ＋ 静的ゴールぶん。敵の かず × フレームすう には ならない
    expect(state.fields.byUnit.size).toBeLessThanOrEqual(state.units.length);
  });
});
