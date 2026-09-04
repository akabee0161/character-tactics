import { describe, expect, it } from 'vitest';
import { step } from './sim';
import { beginBattle, createBattleState } from './state';
import { testRegistry } from './testing';
import type { StageDef, Unit } from './types';
import type { BattleState, CharProgress, Vec2 } from './types';

// units のうち敵側に常時 1 体だけ入れておく。ゴールから遠く離れた位置に置いて
// 自然には撃破されない状態にしておく
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
  for (const u of s.units) if (u.side === 'player') u.pos = { x: 16, y: 300 }; // マップ外の遠くへ退避
  return s;
}

function unitOf(s: BattleState, defId: string): Unit {
  const u = s.units.find((x) => x.defId === defId && x.side === 'player');
  if (!u) throw new Error(`いない: ${defId}`);
  return u;
}

function spawnEnemy(s: BattleState, defId: string, pos: Vec2, hp?: number): Unit {
  const def = s.reg.enemies.get(defId)!;
  const uid = `t${s.nextEnemyUid++}`;
  const u: Unit = {
    uid, defId, side: 'enemy', controller: 'ai', combat: def.combat,
    pos: { ...pos }, hp: hp ?? def.maxHp, maxHp: def.maxHp, power: def.power, guard: def.guard,
    attack: def.attack, range: def.range, attackInterval: def.attackInterval, speed: def.speed,
    bowDamageCap: def.bowDamageCap, skillId: def.skillId,
    level: 1, xp: 0,
    goalPos: null, goalField: null, engagedWith: null, attackCooldown: 0, retired: false,
    ai: { def: { kind: 'aggressive' }, mode: 'idle', targetUid: null, home: { ...pos } },
    skillCooldownUntil: 0, funbaruUntil: -1, neraiuchiArmed: false, pinchShown: false,
    seenDefIds: [], lastHitBy: null, lastHitNeraiuchi: false,
  };
  s.units.push(u);
  return u;
}

/** 交戦させて 1 回攻撃が入るところまで進める */
function engageAndAttack(s: BattleState, dt = 1.7): void {
  step(s, [], 0.01);
  step(s, [], dt);
}

describe('攻撃の解決', () => {
  it('攻撃間隔ごとに 1 回ダメージが入る', () => {
    const s = fresh();
    unitOf(s, 'roran').pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 30, y: 16 });
    step(s, [], 0.01);
    expect(e.hp).toBe(12);      // 交戦成立の直後はまだ攻撃していない
    step(s, [], 1.7);
    expect(e.hp).toBe(12 - 5);  // ロラン ちから6 - まもり1
  });

  it('攻撃間隔が来るまでは追加ダメージが入らない', () => {
    const s = fresh();
    unitOf(s, 'roran').pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 30, y: 16 });
    step(s, [], 0.01);
    step(s, [], 1.7);
    step(s, [], 0.5);
    expect(e.hp).toBe(7);
  });

  it('なかよし支援が乗り、bondSupport イベントが出る', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    // イネスの弓レンジ(160)の外、なかよしレンジ(200)の内に置き、
    // イネス自身が交戦を横取りせず支援だけする状況にする
    const ines = unitOf(s, 'ines');
    ines.pos = { x: 200, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 30, y: 16 });
    step(s, [], 0.01);
    step(s, [], 1.7);
    expect(e.hp).toBe(12 - 7); // (6+2)-1
    expect(s.events).toContainEqual({
      type: 'bondSupport', targetUid: roran.uid, targetDefId: 'roran', supporterUids: [ines.uid],
    });
    expect(s.counters['bond:supports']).toBe(1);
  });

  it('イネスはたてもちに 1 しか通らない', () => {
    const s = fresh();
    unitOf(s, 'ines').pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'tatemochi', { x: 100, y: 16 });
    step(s, [], 0.01);
    step(s, [], 2.3);
    expect(e.hp).toBe(19);
  });

  it('ねらいうちならたてもちにも通る', () => {
    const s = fresh();
    const ines = unitOf(s, 'ines');
    ines.pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'tatemochi', { x: 100, y: 16 });
    step(s, [{ type: 'skill', uid: ines.uid }], 0.01);
    step(s, [], 2.3);
    expect(e.hp).toBe(20 - 10); // (8-3)*2
    expect(unitOf(s, 'ines').neraiuchiArmed).toBe(false);
  });

  it('イネスは密着されると攻撃間隔が倍になる', () => {
    const s = fresh();
    unitOf(s, 'ines').pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 32, y: 16 });
    step(s, [], 0.01);
    step(s, [], 2.3);
    expect(e.hp).toBe(12); // まだ撃てない
    step(s, [], 2.2);
    expect(e.hp).toBe(12 - 7);
  });

  it('敵の攻撃で味方の HP が減る', () => {
    const s = fresh();
    unitOf(s, 'roran').pos = { x: 16, y: 16 };
    spawnEnemy(s, 'garum', { x: 30, y: 16 });
    engageAndAttack(s, 1.5);
    expect(unitOf(s, 'roran').hp).toBe(30 - 4); // 9 - 5
  });

  it('ふんばり中はダメージが半分になる', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    spawnEnemy(s, 'garum', { x: 30, y: 16 });
    step(s, [{ type: 'skill', uid: roran.uid }], 0.01);
    step(s, [], 1.5);
    expect(unitOf(s, 'roran').hp).toBe(30 - 2);
  });
});

describe('ピンチ', () => {
  it('HP が 30% を切った瞬間に 1 回だけ pinch イベントが出る', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    roran.hp = 11;
    spawnEnemy(s, 'garum', { x: 30, y: 16 });
    engageAndAttack(s, 1.5);
    expect(unitOf(s, 'roran').hp).toBe(7);
    expect(s.events).toContainEqual({ type: 'pinch', uid: roran.uid, defId: 'roran' });
    step(s, [], 1.5);
    expect(s.events.filter((e) => e.type === 'pinch')).toHaveLength(0);
  });
});

describe('撃破と撤退', () => {
  it('敵を倒すと消え、unitDefeated が出て とどめを さした ユニットに けいけんちが はいる', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 30, y: 16 }, 3);
    engageAndAttack(s, 1.7);
    expect(e.retired).toBe(true);
    expect(s.events).toContainEqual({
      type: 'unitDefeated', uid: e.uid, defId: 'narazumono', byUid: roran.uid, byDefId: 'roran', neraiuchi: false,
    });
    expect(roran.xp).toBe(s.reg.enemies.get('narazumono')!.xpReward);
  });

  it('ねらいうちで倒すと kill:neraiuchi が増える', () => {
    const s = fresh();
    const ines = unitOf(s, 'ines');
    ines.pos = { x: 16, y: 16 };
    spawnEnemy(s, 'narazumono', { x: 100, y: 16 }, 5);
    step(s, [{ type: 'skill', uid: ines.uid }], 0.01);
    step(s, [], 2.3);
    expect(s.counters['kill:neraiuchi']).toBe(1);
  });

  it('かけぬけるで倒すと unitDefeated イベントに byDefId が入り、けいけんちが はいる', () => {
    const s = fresh();
    const gau = unitOf(s, 'gau');
    gau.pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 100, y: 16 }, 3);
    step(s, [{ type: 'skill', uid: gau.uid, dest: { x: 200, y: 16 } }], 0.01);
    expect(e.retired).toBe(true);
    expect(s.events).toContainEqual({
      type: 'unitDefeated', uid: e.uid, defId: 'narazumono', byUid: gau.uid, byDefId: 'gau', neraiuchi: false,
    });
    expect(gau.xp).toBe(s.reg.enemies.get('narazumono')!.xpReward);
  });

  it('ガルムは 30% を切ると撤退し unitFled が出る', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'garum', { x: 30, y: 16 }, 12);
    engageAndAttack(s, 1.7);
    expect(e.retired).toBe(true);
    expect(s.events).toContainEqual({
      type: 'unitFled', uid: e.uid, defId: 'garum', byUid: roran.uid, byDefId: 'roran',
    });
    expect(roran.xp).toBe(0);
  });

  it('味方は HP 0 でたいきゃくし、交戦が解除される', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    roran.hp = 2;
    const e = spawnEnemy(s, 'garum', { x: 30, y: 16 });
    engageAndAttack(s, 1.5);
    expect(unitOf(s, 'roran').retired).toBe(true);
    expect(unitOf(s, 'roran').hp).toBe(0);
    expect(unitOf(s, 'roran').engagedWith).toBeNull();
    expect(e.engagedWith).toBeNull();
    expect(s.events).toContainEqual({ type: 'unitRetired', uid: roran.uid, defId: 'roran' });
  });
});

