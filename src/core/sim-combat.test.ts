import { describe, expect, it } from 'vitest';
import { COUNTER_DEFEAT_BY } from './counters';
import { beginBattle, createBattleState } from './state';
import { step } from './sim';
import { testRegistry } from './testing';
import type { BattleState, CharProgress, EnemyUnit, StageDef, Vec2 } from './types';

// enemies に常時 1 体だけ入れておく。updatePhase は敵が 0 体になった瞬間に victory へ
// 進めてしまうので（フェーズ 5 で updateObjectives に置き換わるまでの暫定挙動）、
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
  for (const a of s.allies) a.pos = { x: 16, y: 300 }; // マップ外の遠くへ退避
  return s;
}

const ally = (s: BattleState, id: string) => s.allies.find((a) => a.id === id)!;

function spawnEnemy(s: BattleState, kind: string, pos: Vec2, hp?: number): EnemyUnit {
  const def = s.reg.enemies.get(kind)!;
  const e: EnemyUnit = {
    uid: `t${s.nextEnemyUid++}`, kind, ai: { kind: 'aggressive' },
    pos: { ...pos }, hp: hp ?? def.maxHp, maxHp: def.maxHp,
    engagedWith: null, attackCooldown: 0, lastHitBy: null, lastHitNeraiuchi: false,
  };
  s.enemies.push(e);
  return e;
}

/** 交戦させて 1 回攻撃が入るところまで進める */
function engageAndAttack(s: BattleState, dt = 1.7): void {
  step(s, [], 0.01);
  step(s, [], dt);
}

describe('攻撃の解決', () => {
  it('攻撃間隔ごとに 1 回ダメージが入る', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 30, y: 16 });
    step(s, [], 0.01);
    expect(e.hp).toBe(12);      // 交戦成立の直後はまだ攻撃していない
    step(s, [], 1.7);
    expect(e.hp).toBe(12 - 5);  // ロラン ちから6 - まもり1
  });

  it('攻撃間隔が来るまでは追加ダメージが入らない', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 30, y: 16 });
    step(s, [], 0.01);
    step(s, [], 1.7);
    step(s, [], 0.5);
    expect(e.hp).toBe(7);
  });

  it('なかよし支援が乗り、bondSupport イベントが出る', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    // イネスの弓レンジ(160)の外、なかよしレンジ(200)の内に置き、
    // イネス自身が交戦を横取りせず支援だけする状況にする
    ally(s, 'ines').pos = { x: 200, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 30, y: 16 });
    step(s, [], 0.01);
    step(s, [], 1.7);
    expect(e.hp).toBe(12 - 7); // (6+2)-1
    expect(s.events).toContainEqual({ type: 'bondSupport', targetId: 'roran', supporterIds: ['ines'] });
    expect(s.counters['bond:supports']).toBe(1);
  });

  it('イネスはたてもちに 1 しか通らない', () => {
    const s = fresh();
    ally(s, 'ines').pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'tatemochi', { x: 100, y: 16 });
    step(s, [], 0.01);
    step(s, [], 2.3);
    expect(e.hp).toBe(19);
  });

  it('ねらいうちならたてもちにも通る', () => {
    const s = fresh();
    ally(s, 'ines').pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'tatemochi', { x: 100, y: 16 });
    step(s, [{ type: 'skill', allyId: 'ines' }], 0.01);
    step(s, [], 2.3);
    expect(e.hp).toBe(20 - 10); // (8-3)*2
    expect(ally(s, 'ines').neraiuchiArmed).toBe(false);
  });

  it('イネスは密着されると攻撃間隔が倍になる', () => {
    const s = fresh();
    ally(s, 'ines').pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 32, y: 16 });
    step(s, [], 0.01);
    step(s, [], 2.3);
    expect(e.hp).toBe(12); // まだ撃てない
    step(s, [], 2.2);
    expect(e.hp).toBe(12 - 7);
  });

  it('敵の攻撃で味方の HP が減る', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    spawnEnemy(s, 'garum', { x: 30, y: 16 });
    engageAndAttack(s, 1.5);
    expect(ally(s, 'roran').hp).toBe(30 - 4); // 9 - 5
  });

  it('ふんばり中はダメージが半分になる', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    spawnEnemy(s, 'garum', { x: 30, y: 16 });
    step(s, [{ type: 'skill', allyId: 'roran' }], 0.01);
    step(s, [], 1.5);
    expect(ally(s, 'roran').hp).toBe(30 - 2);
  });
});

describe('ピンチ', () => {
  it('HP が 30% を切った瞬間に 1 回だけ pinch イベントが出る', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    ally(s, 'roran').hp = 11;
    spawnEnemy(s, 'garum', { x: 30, y: 16 });
    engageAndAttack(s, 1.5);
    expect(ally(s, 'roran').hp).toBe(7);
    expect(s.events).toContainEqual({ type: 'pinch', allyId: 'roran' });
    step(s, [], 1.5);
    expect(s.events.filter((e) => e.type === 'pinch')).toHaveLength(0);
  });
});

describe('撃破と撤退', () => {
  it('敵を倒すと消え、enemyDefeated が出て戦績が増える', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 30, y: 16 }, 3);
    engageAndAttack(s, 1.7);
    expect(s.enemies.find((en) => en.uid === e.uid)).toBeUndefined();
    expect(s.events).toContainEqual({
      type: 'enemyDefeated', uid: e.uid, kind: 'narazumono', byAlly: 'roran', neraiuchi: false,
    });
    expect(s.counters[COUNTER_DEFEAT_BY('roran')]).toBe(1);
  });

  it('ねらいうちで倒すと kill:neraiuchi が増える', () => {
    const s = fresh();
    ally(s, 'ines').pos = { x: 16, y: 16 };
    spawnEnemy(s, 'narazumono', { x: 100, y: 16 }, 5);
    step(s, [{ type: 'skill', allyId: 'ines' }], 0.01);
    step(s, [], 2.3);
    expect(s.counters['kill:neraiuchi']).toBe(1);
  });

  it('かけぬけるで倒すと defeats が増え、enemyDefeated イベントに byAlly が入る', () => {
    const s = fresh();
    ally(s, 'gau').pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 100, y: 16 }, 3);
    step(s, [{ type: 'skill', allyId: 'gau', dest: { x: 200, y: 16 } }], 0.01);
    expect(s.enemies.find((en) => en.uid === e.uid)).toBeUndefined();
    expect(s.events).toContainEqual({
      type: 'enemyDefeated', uid: e.uid, kind: 'narazumono', byAlly: 'gau', neraiuchi: false,
    });
    expect(s.counters[COUNTER_DEFEAT_BY('gau')]).toBe(1);
  });

  it('ガルムは 30% を切ると撤退し unitFled が出る', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'garum', { x: 30, y: 16 }, 12);
    engageAndAttack(s, 1.7);
    expect(s.enemies.find((en) => en.uid === e.uid)).toBeUndefined();
    expect(s.events).toContainEqual({ type: 'unitFled', uid: e.uid, kind: 'garum', byAlly: 'roran' });
    expect(s.counters[COUNTER_DEFEAT_BY('roran')]).toBeUndefined();
  });

  it('味方は HP 0 でたいきゃくし、交戦が解除される', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    ally(s, 'roran').hp = 2;
    const e = spawnEnemy(s, 'garum', { x: 30, y: 16 });
    engageAndAttack(s, 1.5);
    expect(ally(s, 'roran').retired).toBe(true);
    expect(ally(s, 'roran').hp).toBe(0);
    expect(ally(s, 'roran').engagedWith).toBeNull();
    expect(e.engagedWith).toBeNull();
    expect(s.events).toContainEqual({ type: 'allyRetired', allyId: 'roran' });
  });
});

describe('とりでとフェーズ遷移', () => {
  it('敵が味方の初期配置地点に着くと とりで HP が減り、その敵は消える', () => {
    const s = fresh();
    const e = spawnEnemy(s, 'narazumono', { x: 20, y: 16 });
    step(s, [], 0.01);
    expect(s.fortHp).toBe(30 - 5);
    expect(s.enemies.find((en) => en.uid === e.uid)).toBeUndefined();
    expect(s.events).toContainEqual({ type: 'fortDamaged', amount: 5 });
  });

  it('とりで HP が 0 で defeat', () => {
    const s = fresh();
    s.fortHp = 2;
    spawnEnemy(s, 'narazumono', { x: 20, y: 16 });
    step(s, [], 0.01);
    expect(s.fortHp).toBeLessThanOrEqual(0);
    expect(s.phase).toBe('defeat');
  });

  it('敵が全滅すると victory', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    // ステージ既定の背景敵も含め、この場に居合わせるすべての敵を全滅させる
    s.enemies = [];
    spawnEnemy(s, 'narazumono', { x: 30, y: 16 }, 3);
    engageAndAttack(s, 1.7);
    expect(s.phase).toBe('victory');
  });
});
