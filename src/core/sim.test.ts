import { describe, expect, it } from 'vitest';
import type { EnemyDef } from '../engine/schema';
import { hasThreatWithinMelee } from './combat';
import { MIN_SEPARATION } from './constants';
import { distance, fitsAt, isWalkableAt, speedAt } from './field';
import { hostilesOf, step } from './sim';
import { beginBattle, createBattleState } from './state';
import { instantAttacks, testRegistry } from './testing';
import type { AiDef, BattleState, CharProgress, StageDef, Unit, Vec2 } from './types';

function makeTestUnit(s: BattleState, def: EnemyDef, pos: Vec2, ai: AiDef): Unit {
  return {
    uid: `t${s.units.length + 1}`, defId: def.id, side: 'enemy', controller: 'ai',
    combat: def.combat, pos: { ...pos },
    hp: def.maxHp, maxHp: def.maxHp, power: def.power, guard: def.guard,
    attack: def.attack, range: def.range, attackInterval: def.attackInterval, speed: def.speed,
    bowDamageCap: def.bowDamageCap, skillId: def.skillId,
    level: 1, xp: 0,
    goalPos: null, goalField: null, engagedWith: null, closingOn: null, attackCooldown: 0, retired: false,
    windup: 0, pendingHit: null,
    ai: { def: ai, mode: 'idle', targetUid: null, home: { ...pos }, spottedAt: null },
    skillCooldownUntil: 0, funbaruUntil: -1, neraiuchiArmed: false, pinchShown: false,
    seenDefIds: [], lastHitBy: null, lastHitNeraiuchi: false, damagedBy: [],
  };
}

// このテストファイルの「移動」系テストが途中で phase を失って固まらないよう、
// ゴールから遠く離れた位置に置いて自然には撃破されない状態にしておく
const STAGE: StageDef = {
  id: 'teststage', order: 10, name: 'テスト', cell: 32,
  mapRows: ['..........', '..........', '..........'],
  placement: { minY: 0, starts: [{ x: 16, y: 16 }] },
  roster: ['roran', 'ines', 'mist', 'gau'],
  enemies: [{ defId: 'narazumono', pos: { x: 304, y: 16 }, ai: { kind: 'aggressive' } }],
  spawners: [],
  victory: { type: 'reach', pos: { x: 304, y: 16 }, radius: 40, by: 'any' },
  defeat: [{ type: 'unitLost', defIds: ['roran'] }],
};

const LV1: Record<string, CharProgress> = {
  roran: { level: 1, xp: 0 }, ines: { level: 1, xp: 0 },
  mist: { level: 1, xp: 0 }, gau: { level: 1, xp: 0 },
};

// AI の組み込みテストは x:400 前後〜y:400 前後の座標を使うため、
// STAGE(10x3セル)には収まらない。テスト分だけ広い部屋を別に持つ
const AI_STAGE: StageDef = {
  id: 'ai-teststage', order: 10, name: 'AIテスト', cell: 32,
  mapRows: Array.from({ length: 15 }, () => '.'.repeat(30)),
  placement: { minY: 0, starts: [{ x: 16, y: 16 }] },
  roster: ['roran', 'ines', 'mist', 'gau'],
  enemies: [],
  spawners: [],
  victory: { type: 'reach', pos: { x: 848, y: 240 }, radius: 40, by: 'any' },
  defeat: [{ type: 'unitLost', defIds: ['roran'] }],
};

function fresh(stage: StageDef = STAGE): { stage: StageDef; state: BattleState } {
  const state = createBattleState(testRegistry(), stage, LV1, 42);
  beginBattle(state);
  instantAttacks(state);
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
    goalPos: null, goalField: null, engagedWith: null, closingOn: null, attackCooldown: 0, retired: false,
    windup: 0, pendingHit: null,
    ai: { def: { kind: 'aggressive' }, mode: 'idle', targetUid: null, home: { ...pos }, spottedAt: null },
    skillCooldownUntil: 0, funbaruUntil: -1, neraiuchiArmed: false, pinchShown: false,
    seenDefIds: [], lastHitBy: null, lastHitNeraiuchi: false, damagedBy: [],
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

  it('歩けない目的地は、最も近い歩けるマスへ置き換える', () => {
    const { state: s } = fresh({ ...STAGE, mapRows: ['..........', '.....#....', '..........'] });
    unitOf(s, 'roran').pos = { x: 16, y: 80 };
    step(s, [{ type: 'move', uid: unitOf(s, 'roran').uid, dest: { x: 176, y: 48 } }], 0.1);
    // (176,48) の上下左右のマスはどれも 32px。(16,80) からいちばんたどり着きやすいのは左 (144,48)
    expect(unitOf(s, 'roran').goalPos).toEqual({ x: 144, y: 48 });
  });

  it('壁の脇を指すと、足元の箱が壁にかからない位置へ寄せる', () => {
    // (5,1) が '#'（x:160-192）。(158,48) の箱の右端は 164 で壁にかかるので、x=154 に寄る
    const { state: s } = fresh({ ...STAGE, mapRows: ['..........', '.....#....', '..........'], enemies: [] });
    unitOf(s, 'roran').pos = { x: 16, y: 80 };
    step(s, [{ type: 'move', uid: unitOf(s, 'roran').uid, dest: { x: 158, y: 48 } }], 1 / 60);
    expect(unitOf(s, 'roran').goalPos).toEqual({ x: 154, y: 48 });
  });

  it('壁の脇を通り抜けるあいだ、足元の箱は一度も壁にかからず、目的地に着く', () => {
    // (158,16) から真下の (158,80) へ。まっすぐ下りると (5,1) の壁に箱がかかる
    const { state: s } = fresh({ ...STAGE, mapRows: ['..........', '.....#....', '..........'], enemies: [] });
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 158, y: 16 };
    step(s, [{ type: 'move', uid: roran.uid, dest: { x: 158, y: 80 } }], 1 / 60);
    for (let i = 0; i < 300; i++) {
      step(s, [], 1 / 60);
      expect(fitsAt(s.grid, unitOf(s, 'roran').pos), `tick ${i}`).toBe(true);
    }
    expect(distance(unitOf(s, 'roran').pos, { x: 158, y: 80 })).toBeLessThan(1);
  });

  it('目的地と同じマスに入ってから箱ごとの直進が通らなくても、指示は消えずに目的地に着く', () => {
    // (0,1) が '#'。(34,31) は下の段の斜め隣が壁なので (34,30) に寄る。
    // (60,40) から向かうと、同じマス (1,0) に入ったあとも箱の左下の線が壁を通る
    const { state: s } = fresh({ ...STAGE, mapRows: ['..........', '#.........', '..........'], enemies: [] });
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 60, y: 40 };
    step(s, [{ type: 'move', uid: roran.uid, dest: { x: 34, y: 31 } }], 1 / 60);
    for (let i = 0; i < 120; i++) {
      step(s, [], 1 / 60);
      expect(fitsAt(s.grid, unitOf(s, 'roran').pos), `tick ${i}`).toBe(true);    }
    expect(distance(unitOf(s, 'roran').pos, { x: 34, y: 30 })).toBeLessThan(1);
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
    expect(unitOf(s, 'roran').skillCooldownUntil).toBeGreaterThan(0);
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

  it('歩けない場所への move では、最も近い歩けるマスが目的地になる', () => {
    const stage: StageDef = { ...STAGE, mapRows: ['..........', '..####....', '..........'] };
    const { state: s } = fresh(stage);
    step(s, [{ type: 'move', uid: unitOf(s, 'roran').uid, dest: { x: 80, y: 48 } }], 0.1);
    // (80,48) の左 (48,48)・上 (80,16)・下 (80,80) はどれも 32px。(16,80) からいちばん近いのは斜め1歩の左
    expect(unitOf(s, 'roran').goalPos).toEqual({ x: 48, y: 48 });
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
    const before = { ...enemy.pos };
    step(state, [], 0.5); // placement のまま
    expect(enemy.pos).toEqual(before);
    beginBattle(state);
    step(state, [], 0.5);
    expect(enemy.pos).not.toEqual(before);
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
    const dest = { ...state.stage.placement.starts[0]! };
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
    // ほかの味方が代わりに攻撃しないよう遠ざける
    for (const u of state.units) if (u.side === 'player' && u.uid !== p.uid) u.pos = { x: 900, y: 900 };
    // 到達勝利の範囲の外で交戦させる(そうでないとすぐ victory になり進まない)
    e.pos = { x: 16, y: 80 };
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
    // 到達勝利の範囲の外で交戦させる(そうでないとすぐ victory になり進まない)
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
    // 敵を1体だけにして、その1体の振る舞いを見る
    state.units = state.units.filter((u) => u.side === 'player');
    // victory.pos ({x:848,y:240}, radius 40) と重ならない位置に置く
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
    // ユニットごとに1枚 + 静的ゴール分。敵の数 × フレーム数にはならない
    expect(state.fields.byUnit.size).toBeLessThanOrEqual(state.units.length);
  });
});

describe('時間湧き', () => {
  function spawnStage() {
    const reg = testRegistry();
    const stage = reg.stages.find((s) => s.spawners.length > 0);
    if (!stage) throw new Error('spawners を持つステージが assets に無い');
    const progress: Record<string, CharProgress> = {};
    for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
    const state = createBattleState(reg, stage, progress, 1);
    beginBattle(state);
    return { stage, state };
  }

  it('firstAfter に達すると敵が1体増える', () => {
    const { stage, state } = spawnStage();
    const before = state.units.filter((u) => u.side === 'enemy').length;
    state.time = stage.spawners[0]!.firstAfter;
    step(state, [], 1 / 60);
    expect(state.units.filter((u) => u.side === 'enemy').length).toBe(before + 1);
    expect(state.spawnCounts[0]).toBe(1);
  });

  it('湧いた敵は aggressive で追ってくる', () => {
    const { stage, state } = spawnStage();
    state.time = stage.spawners[0]!.firstAfter;
    step(state, [], 1 / 60);
    const spawned = state.units[state.units.length - 1]!;
    expect(spawned.side).toBe('enemy');
    expect(spawned.ai!.def.kind).toBe('aggressive');
    // 湧いたその tick で aggressive AI が動き出すので、ちょうど湧き口の座標に
    // 止まっているとは限らない。湧いた瞬間の座標は enemySpawned イベント側で見る
    const ev = state.events.find((e) => e.type === 'enemySpawned');
    expect(ev && ev.type === 'enemySpawned' ? ev.pos : null).toEqual(stage.spawners[0]!.pos);
  });

  it('enemySpawned イベントを出す', () => {
    const { stage, state } = spawnStage();
    state.time = stage.spawners[0]!.firstAfter;
    step(state, [], 1 / 60);
    expect(state.events.some((e) => e.type === 'enemySpawned')).toBe(true);
  });

  it('total を超えて湧かない', () => {
    const { stage, state } = spawnStage();
    const before = state.units.filter((u) => u.side === 'enemy').length;
    const total = stage.spawners.reduce((n, s) => n + s.total, 0);
    // 湧き口ごとに1 tick 1体なので、total 回ぶん十分に時間を進めて回す
    for (let i = 0; i < total + 5; i++) {
      state.time += 1000;
      step(state, [], 1 / 60);
    }
    expect(state.units.filter((u) => u.side === 'enemy').length).toBe(before + total);
  });
});

describe('しじされた いどうは とまらない', () => {
  // ines(ゆみ、range160)などが割りこんで交戦してしまうと、claimed に敵の uid が
  // 入ってロランの交戦判定を邪魔する。ロラン単体の検証にするため他は退場させる
  function isolateRoran(state: BattleState, roran: Unit): void {
    for (const u of state.units) {
      if (u.side === 'player' && u.uid !== roran.uid) u.retired = true;
    }
  }

  it('こうせんちゅうでも プレイヤーの いどうしじは すすむ', () => {
    const { state } = fresh();
    const roran = state.units.find((u) => u.defId === 'roran')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    isolateRoran(state, roran);
    roran.pos = { x: 100, y: 16 };
    enemy.pos = { x: 100, y: 36 };   // ロランの射程内（真横 20px）。進行方向（+x）をふさがない
    enemy.speed = 0;

    step(state, [{ type: 'move', uid: roran.uid, dest: { x: 240, y: 16 } }], 1 / 60);
    const before = roran.pos.x;
    for (let i = 0; i < 10; i++) step(state, [], 1 / 60);   // 10px 進んでも敵との距離は射程 24 以内

    expect(roran.engagedWith).not.toBeNull();     // 交戦はしている
    expect(roran.pos.x).toBeGreaterThan(before);  // それでも進んでいる
  });

  it('とうちゃくすると こうせんで あしが とまる', () => {
    const { state } = fresh();
    const roran = state.units.find((u) => u.defId === 'roran')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    isolateRoran(state, roran);
    roran.pos = { x: 100, y: 16 };
    enemy.pos = { x: 110, y: 16 };
    enemy.speed = 0;

    step(state, [{ type: 'move', uid: roran.uid, dest: { x: 104, y: 16 } }], 1 / 60);
    for (let i = 0; i < 20; i++) step(state, [], 1 / 60);
    expect(roran.goalPos).toBeNull();

    const at = { ...roran.pos };
    for (let i = 0; i < 30; i++) step(state, [], 1 / 60);
    expect(roran.pos).toEqual(at);
  });

  it('てきは こうせんすると あしが とまる', () => {
    const { state } = fresh();
    const roran = state.units.find((u) => u.defId === 'roran')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    isolateRoran(state, roran);
    roran.pos = { x: 100, y: 16 };
    enemy.pos = { x: 118, y: 16 };

    for (let i = 0; i < 10; i++) step(state, [], 1 / 60);
    const at = { ...enemy.pos };
    for (let i = 0; i < 30; i++) step(state, [], 1 / 60);

    expect(enemy.engagedWith).not.toBeNull();
    expect(enemy.pos).toEqual(at);
  });
});

describe('spottedAt', () => {
  function sentryState(): BattleState {
    const stage: StageDef = {
      ...AI_STAGE,
      enemies: [{
        defId: 'narazumono',
        pos: { x: 400, y: 240 },
        ai: { kind: 'sentry', sightRange: 100 },
      }],
    };
    return fresh(stage).state;
  }

  it('はじめは null', () => {
    const state = sentryState();
    const e = state.units.find((u) => u.side === 'enemy')!;
    expect(e.ai!.spottedAt).toBeNull();
  });

  it('見つけた tick の時刻が入る', () => {
    const state = sentryState();
    const e = state.units.find((u) => u.side === 'enemy')!;
    const p = state.units.find((u) => u.side === 'player')!;
    p.pos = { x: 440, y: 240 }; // 索敵範囲の内側
    step(state, [], 0.1);
    expect(e.ai!.mode).toBe('chase');
    expect(e.ai!.spottedAt).toBeCloseTo(state.time);
  });

  it('追いかけているあいだ 時刻は更新されない', () => {
    const state = sentryState();
    const e = state.units.find((u) => u.side === 'enemy')!;
    const p = state.units.find((u) => u.side === 'player')!;
    p.pos = { x: 440, y: 240 };
    step(state, [], 0.1);
    const first = e.ai!.spottedAt;
    step(state, [], 0.1);
    expect(e.ai!.spottedAt).toBe(first);
  });

  it('見失ったら null に戻り、見つけ直すと入り直す', () => {
    const state = sentryState();
    const e = state.units.find((u) => u.side === 'enemy')!;
    const p = state.units.find((u) => u.side === 'player')!;
    p.pos = { x: 440, y: 240 };
    step(state, [], 0.1);
    expect(e.ai!.spottedAt).not.toBeNull();

    p.pos = { x: 40, y: 40 }; // 索敵範囲の外
    step(state, [], 0.1);
    expect(e.ai!.spottedAt).toBeNull();

    p.pos = { x: e.pos.x + 40, y: e.pos.y };
    step(state, [], 0.1);
    expect(e.ai!.spottedAt).toBeCloseTo(state.time);
  });
});

describe('敵と味方の最小距離', () => {
  /** ロラン1人だけを残す。ほかの味方が割り込んで交戦すると結果が変わるため */
  function roranOnly(s: BattleState): Unit {
    const roran = unitOf(s, 'roran');
    for (const u of s.units) if (u.side === 'player' && u !== roran) u.retired = true;
    return roran;
  }

  it('追ってきた敵は MIN_SEPARATION より近づかず、そこで交戦する', () => {
    const { state: s } = fresh();
    const roran = roranOnly(s);
    roran.pos = { x: 100, y: 48 };
    roran.combat = false;
    const e = s.units.find((u) => u.side === 'enemy')!;
    e.pos = { x: 200, y: 48 };
    for (let i = 0; i < 300; i++) {
      step(s, [], 1 / 60);
      expect(distance(e.pos, roran.pos)).toBeGreaterThanOrEqual(MIN_SEPARATION - 1e-6);
    }
    expect(e.engagedWith).toBe(roran.uid);
  });

  it('2体目の敵も重ならず、手前で止まる', () => {
    const { state: s } = fresh();
    const roran = roranOnly(s);
    roran.pos = { x: 100, y: 48 };
    roran.combat = false;
    const e1 = s.units.find((u) => u.side === 'enemy')!;
    e1.pos = { x: 160, y: 48 };
    const e2 = spawnEnemy(s, 'narazumono', { x: 40, y: 48 });
    for (let i = 0; i < 300; i++) step(s, [], 1 / 60);
    expect(distance(e1.pos, roran.pos)).toBeGreaterThanOrEqual(MIN_SEPARATION - 1e-6);
    expect(distance(e2.pos, roran.pos)).toBeGreaterThanOrEqual(MIN_SEPARATION - 1e-6);
    expect(distance(e2.pos, roran.pos)).toBeLessThanOrEqual(MIN_SEPARATION + 1);
  });

  it('指示された移動は、敵の横をすべって回り込み、目的地に着く', () => {
    const { state: s } = fresh();
    const roran = roranOnly(s);
    // y:48 だと回り込みが victory.pos ({x:304,y:16}, radius 40) に入って phase が
    // victory に切り替わり、シムが凍って目的地に着けなくなる。y:80 にどけて避ける
    roran.pos = { x: 100, y: 80 };
    roran.combat = false;
    const e = s.units.find((u) => u.side === 'enemy')!;
    e.pos = { x: 160, y: 84 };
    e.speed = 0;
    e.combat = false;
    const dest = { x: 300, y: 80 };
    step(s, [{ type: 'move', uid: roran.uid, dest }], 1 / 60);
    for (let i = 0; i < 600 && roran.goalPos; i++) {
      step(s, [], 1 / 60);
      expect(distance(e.pos, roran.pos)).toBeGreaterThanOrEqual(MIN_SEPARATION - 1e-6);
    }
    expect(roran.pos).toEqual(dest);
  });

  it('真正面をふさがれた指示移動は、手前で止まって目的地が消える', () => {
    const { state: s } = fresh();
    const roran = roranOnly(s);
    roran.pos = { x: 100, y: 48 };
    roran.combat = false;
    const e = s.units.find((u) => u.side === 'enemy')!;
    e.pos = { x: 160, y: 48 };
    e.speed = 0;
    e.combat = false;
    step(s, [{ type: 'move', uid: roran.uid, dest: { x: 300, y: 48 } }], 1 / 60);
    for (let i = 0; i < 120; i++) step(s, [], 1 / 60);
    expect(roran.goalPos).toBeNull();
    expect(roran.pos.x).toBeCloseTo(160 - MIN_SEPARATION, 6);
  });

  it('敵の絵をタップした指示移動は、向こう側へ回り込まず手前で止まって目的地が消える', () => {
    // 足元アンカーのスプライトは敵の胴体をタップすると dest ≈ enemy.pos + (0, -14) になり、
    // 敵の最小距離circleの内側（向こう側）を指す。奥まですべって回り込まず、接触した手前で止まるべき
    const { state: s } = fresh();
    const roran = unitOf(s, 'roran');
    for (const u of s.units) if (u.side === 'player' && u !== roran) u.pos = { x: 16, y: 90 };
    roran.pos = { x: 150, y: 90 };
    const e = s.units.find((u) => u.side === 'enemy')!;
    e.pos = { x: 100, y: 48 };
    e.speed = 0;
    e.combat = false;
    const dest = { x: e.pos.x, y: e.pos.y - 14 };
    step(s, [{ type: 'move', uid: roran.uid, dest }], 1 / 60);
    for (let i = 0; i < 600 && roran.goalPos; i++) step(s, [], 1 / 60);
    expect(roran.goalPos).toBeNull();
    expect(roran.pos.y).toBeGreaterThan(e.pos.y); // 手前側（すり抜ける前の近い側）で止まる
    expect(distance(roran.pos, e.pos)).toBeCloseTo(MIN_SEPARATION, 0);
  });

  it('敵の手前側をタップした指示移動も、接触したらすぐに目的地が消える（すべって粘らない）', () => {
    const { state: s } = fresh();
    const roran = unitOf(s, 'roran');
    for (const u of s.units) if (u.side === 'player' && u !== roran) u.pos = { x: 16, y: 90 };
    roran.pos = { x: 150, y: 90 };
    const e = s.units.find((u) => u.side === 'enemy')!;
    e.pos = { x: 100, y: 48 };
    e.speed = 0;
    e.combat = false;
    const dest = { x: e.pos.x, y: e.pos.y + 10 };
    step(s, [{ type: 'move', uid: roran.uid, dest }], 1 / 60);
    let contactTick = -1;
    let clearTick = -1;
    for (let i = 0; i < 600; i++) {
      step(s, [], 1 / 60);
      if (contactTick === -1 && distance(roran.pos, e.pos) <= MIN_SEPARATION + 1) contactTick = i;
      if (roran.goalPos === null) { clearTick = i; break; }
    }
    expect(contactTick).toBeGreaterThanOrEqual(0);
    expect(clearTick).toBeGreaterThanOrEqual(0);
    expect(clearTick - contactTick).toBeLessThanOrEqual(3);
  });

  it('斜めから詰めてきた敵は、押し戻した先が誤差ぶん24pxを超えても近接脅威とみなされる', () => {
    // 真正面（x軸ぶんだけの移動）だと押し戻し後の距離がちょうど24.0になり、
    // 浮動小数点の誤差が出ない。斜めから詰めさせて、誤差ぶん24pxをわずかに超える
    // ケースを再現する（イネスは弓で、この誤差が hasThreatWithinMelee を素通りすると
    // 密着されても攻撃間隔が倍にならないまま気づかれない）
    const { state: s } = fresh();
    const ines = unitOf(s, 'ines');
    for (const u of s.units) if (u.side === 'player' && u !== ines) u.pos = { x: 16, y: 300 };
    ines.pos = { x: 150, y: 48 };
    const e = s.units.find((u) => u.side === 'enemy')!;
    e.pos = { x: 240, y: 8 };
    for (let i = 0; i < 150; i++) step(s, [], 1 / 60);
    expect(distance(e.pos, ines.pos)).toBeGreaterThanOrEqual(MIN_SEPARATION - 1e-6);
    expect(e.engagedWith).toBe(ines.uid);
    expect(hasThreatWithinMelee(ines.pos, [{ pos: e.pos }])).toBe(true);
  });
});

describe('近接の自動の詰め寄り', () => {
  function setup(enemyPos: Vec2) {
    const { state: s } = fresh();
    const roran = unitOf(s, 'roran');
    for (const u of s.units) if (u.side === 'player' && u !== roran) u.retired = true;
    roran.pos = { x: 100, y: 48 };
    const e = s.units.find((u) => u.side === 'enemy')!;
    e.pos = enemyPos;
    e.speed = 0;
    e.combat = false;
    return { s, roran, e };
  }

  it('ロランは 64px 以内の敵へ自分から近づいて交戦する', () => {
    const { s, roran, e } = setup({ x: 150, y: 48 });
    for (let i = 0; i < 120; i++) step(s, [], 1 / 60);
    expect(roran.engagedWith).toBe(e.uid);
    expect(distance(roran.pos, e.pos)).toBeCloseTo(MIN_SEPARATION, 4);
  });

  it('64px より遠い敵には近づかない', () => {
    const { s, roran } = setup({ x: 180, y: 48 });
    for (let i = 0; i < 60; i++) step(s, [], 1 / 60);
    expect(roran.pos).toEqual({ x: 100, y: 48 });
    expect(roran.closingOn).toBeNull();
  });

  it('移動の指示中は詰め寄らない', () => {
    const { s, roran } = setup({ x: 150, y: 48 });
    step(s, [{ type: 'move', uid: roran.uid, dest: { x: 16, y: 48 } }], 1 / 60);
    for (let i = 0; i < 30; i++) step(s, [], 1 / 60);
    expect(roran.pos.x).toBeLessThan(100);
    expect(roran.closingOn).toBeNull();
  });

  it('敵を倒したあとは元の位置へ戻らない', () => {
    const { s, roran, e } = setup({ x: 150, y: 48 });
    for (let i = 0; i < 120; i++) step(s, [], 1 / 60);
    const at = { ...roran.pos };
    e.hp = 0;
    for (let i = 0; i < 60; i++) step(s, [], 1 / 60);
    expect(roran.pos).toEqual(at);
  });
});

describe('森', () => {
  const FOREST_LEGEND = {
    '.': { tile: null, walkable: true },
    F: { tile: null, walkable: true, speed: 0.5 },
  };
  const ALL_FOREST: StageDef = {
    ...STAGE, mapRows: ['FFFFFFFFFF', 'FFFFFFFFFF', 'FFFFFFFFFF'], legend: FOREST_LEGEND,
  };

  it('森の中では指示した移動が半分の速さになる（ロランは 30px/秒）', () => {
    const { state: s } = fresh(ALL_FOREST);
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 80 };
    step(s, [{ type: 'move', uid: roran.uid, dest: { x: 304, y: 80 } }], 1);
    expect(roran.pos.x).toBeCloseTo(46, 0);
    expect(roran.pos.y).toBeCloseTo(80, 4);
  });

  it('森の中では敵も半分の速さになる', () => {
    const { state: s } = fresh(ALL_FOREST);
    const e = spawnEnemy(s, 'narazumono', { x: 304, y: 16 });
    const before = { ...e.pos };
    step(s, [], 1);
    expect(distance(before, e.pos)).toBeCloseTo(e.speed * 0.5, 0);
  });

  it('森の中では詰め寄りも半分の速さになる', () => {
    const { state: s } = fresh(ALL_FOREST);
    const roran = unitOf(s, 'roran');
    for (const u of s.units) if (u.side === 'player' && u !== roran) u.retired = true;
    roran.pos = { x: 100, y: 48 };
    const e = s.units.find((u) => u.side === 'enemy')!;
    e.pos = { x: 150, y: 48 };
    e.speed = 0;
    e.combat = false;
    step(s, [], 1 / 60);
    expect(roran.closingOn).toBe(e.uid);
    expect(roran.pos.x).toBeCloseTo(100 + 60 * 0.5 / 60, 6);
  });

  // 列 3〜6 の行 0〜2 が森。(16,16) から (304,16) は横切ると 140、行3 を回ると 114。
  // STAGE の勝利地点 (304,16) にロランが入ると戦闘が終わって止まるので、
  // 勝利は (16,80) から動かないイネスだけにする
  const DETOUR: StageDef = {
    ...STAGE,
    mapRows: ['...FFFF...', '...FFFF...', '...FFFF...', '..........'],
    legend: FOREST_LEGEND,
    enemies: [],
    victory: { ...STAGE.victory, by: 'ines' },
  };

  it('まっすぐの線が森を通るときは、森を回って目的地に着く', () => {
    const { state: s } = fresh(DETOUR);
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    const dest = { x: 304, y: 16 };
    step(s, [{ type: 'move', uid: roran.uid, dest }], 0.1);
    let maxY = roran.pos.y;
    for (let i = 0; i < 600 && unitOf(s, 'roran').goalPos; i++) {
      step(s, [], 0.1);
      maxY = Math.max(maxY, unitOf(s, 'roran').pos.y);
    }
    expect(maxY).toBeGreaterThanOrEqual(96); // 行3 に下りた
    expect(unitOf(s, 'roran').pos).toEqual(dest);
  });

  it('まっすぐの線が森を通らなければ、今までどおり直行する', () => {
    const { state: s } = fresh(DETOUR);
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 112 };
    const dest = { x: 304, y: 112 };
    step(s, [{ type: 'move', uid: roran.uid, dest }], 0.1);
    expect(roran.pos.y).toBeCloseTo(112, 4);
    expect(roran.pos.x).toBeCloseTo(22, 4);
  });

  it('森の中の目的地を指示すると、森に入って目的地に着く', () => {
    const { state: s } = fresh(DETOUR);
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    const dest = { x: 176, y: 48 };
    step(s, [{ type: 'move', uid: roran.uid, dest }], 0.1);
    for (let i = 0; i < 600 && unitOf(s, 'roran').goalPos; i++) step(s, [], 0.1);
    expect(unitOf(s, 'roran').pos).toEqual(dest);
    expect(speedAt(s.grid, dest)).toBe(0.5);
  });

  it('森の中から森の外の目的地へ、止まらずに着く', () => {
    const { state: s } = fresh(DETOUR);
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 144, y: 48 };
    const dest = { x: 304, y: 112 };
    step(s, [{ type: 'move', uid: roran.uid, dest }], 0.1);
    for (let i = 0; i < 600 && unitOf(s, 'roran').goalPos; i++) step(s, [], 0.1);
    expect(unitOf(s, 'roran').pos).toEqual(dest);
  });
});
