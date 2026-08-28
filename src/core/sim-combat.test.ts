import { describe, expect, it } from 'vitest';
import { createBattleState, startWave } from './state';
import { step } from './sim';
import type { BattleState, CharProgress, EnemyUnit, StageDef } from './types';

const STAGE: StageDef = {
  id: 1, name: 'テスト', cell: 32,
  mapRows: ['..........', '..........', '..........'],
  fort: { x: 16, y: 16 },
  landings: [{ x: 304, y: 16 }],
  garumFlees: true,
  waves: [{ spawns: [] }, { spawns: [] }],
};

const LV1: Record<string, CharProgress> = {
  roran: { level: 1, xp: 0 }, ines: { level: 1, xp: 0 },
  mist: { level: 1, xp: 0 }, gau: { level: 1, xp: 0 },
};

function fresh(stage: StageDef = STAGE): BattleState {
  const s = createBattleState(stage, LV1, 42);
  startWave(s);
  for (const a of s.allies) a.pos = { x: 16, y: 300 }; // マップ外の遠くへ退避
  return s;
}

const ally = (s: BattleState, id: string) => s.allies.find((a) => a.id === id)!;

function addEnemy(s: BattleState, kind: string, x: number, y: number, hp?: number): EnemyUnit {
  const maxHp = ({ narazumono: 12, tatemochi: 20, garum: 40 } as Record<string, number>)[kind]!;
  const e: EnemyUnit = {
    uid: `t${s.nextEnemyUid++}`, kind, pos: { x, y },
    hp: hp ?? maxHp, maxHp, engagedWith: null, attackCooldown: 0,
    lastHitBy: null, lastHitNeraiuchi: false,
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
    const e = addEnemy(s, 'narazumono', 30, 16);
    step(s, [], 0.01);
    expect(e.hp).toBe(12);      // 交戦成立の直後はまだ攻撃していない
    step(s, [], 1.7);
    expect(e.hp).toBe(12 - 5);  // ロラン ちから6 - まもり1
  });

  it('攻撃間隔が来るまでは追加ダメージが入らない', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    const e = addEnemy(s, 'narazumono', 30, 16);
    step(s, [], 0.01);
    step(s, [], 1.7);
    step(s, [], 0.5);
    expect(e.hp).toBe(7);
  });

  it('なかよし支援が乗り、bondSupport イベントが出る', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    ally(s, 'ines').pos = { x: 100, y: 16 };
    const e = addEnemy(s, 'narazumono', 30, 16);
    step(s, [], 0.01);
    step(s, [], 1.7);
    expect(e.hp).toBe(12 - 7); // (6+2)-1
    expect(s.events).toContainEqual({ type: 'bondSupport', supporterId: 'ines', targetId: 'roran' });
    expect(s.stats.roran!.bondSupports).toBe(1);
  });

  it('イネスはたてもちに 1 しか通らない', () => {
    const s = fresh();
    ally(s, 'ines').pos = { x: 16, y: 16 };
    const e = addEnemy(s, 'tatemochi', 100, 16);
    step(s, [], 0.01);
    step(s, [], 2.3);
    expect(e.hp).toBe(19);
  });

  it('ねらいうちならたてもちにも通る', () => {
    const s = fresh();
    ally(s, 'ines').pos = { x: 16, y: 16 };
    const e = addEnemy(s, 'tatemochi', 100, 16);
    step(s, [{ type: 'skill', allyId: 'ines' }], 0.01);
    step(s, [], 2.3);
    expect(e.hp).toBe(20 - 10); // (8-3)*2
    expect(ally(s, 'ines').neraiuchiArmed).toBe(false);
  });

  it('イネスは密着されると攻撃間隔が倍になる', () => {
    const s = fresh();
    ally(s, 'ines').pos = { x: 16, y: 16 };
    const e = addEnemy(s, 'narazumono', 32, 16);
    step(s, [], 0.01);
    step(s, [], 2.3);
    expect(e.hp).toBe(12); // まだ撃てない
    step(s, [], 2.2);
    expect(e.hp).toBe(12 - 7);
  });

  it('敵の攻撃で味方の HP が減る', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    addEnemy(s, 'garum', 30, 16);
    engageAndAttack(s, 1.5);
    expect(ally(s, 'roran').hp).toBe(30 - 4); // 9 - 5
  });

  it('ふんばり中はダメージが半分になる', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    addEnemy(s, 'garum', 30, 16);
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
    addEnemy(s, 'garum', 30, 16);
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
    const e = addEnemy(s, 'narazumono', 30, 16, 3);
    engageAndAttack(s, 1.7);
    expect(s.enemies).toHaveLength(0);
    expect(s.events).toContainEqual({ type: 'enemyDefeated', uid: e.uid, kind: 'narazumono', byAlly: 'roran' });
    expect(s.stats.roran!.defeats).toBe(1);
  });

  it('ねらいうちで倒すと neraiuchiKills が増える', () => {
    const s = fresh();
    ally(s, 'ines').pos = { x: 16, y: 16 };
    addEnemy(s, 'narazumono', 100, 16, 5);
    step(s, [{ type: 'skill', allyId: 'ines' }], 0.01);
    step(s, [], 2.3);
    expect(s.stats.ines!.neraiuchiKills).toBe(1);
  });

  it('かけぬけるで倒すと defeats が増え、enemyDefeated イベントに byAlly が入る', () => {
    const s = fresh();
    ally(s, 'gau').pos = { x: 16, y: 16 };
    const e = addEnemy(s, 'narazumono', 100, 16, 3);
    step(s, [{ type: 'skill', allyId: 'gau', dest: { x: 200, y: 16 } }], 0.01);
    expect(s.enemies).toHaveLength(0);
    expect(s.events).toContainEqual({ type: 'enemyDefeated', uid: e.uid, kind: 'narazumono', byAlly: 'gau' });
    expect(s.stats.gau!.defeats).toBe(1);
  });

  it('ガルムは 30% を切ると撤退する（garumFlees が true のとき）', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    addEnemy(s, 'garum', 30, 16, 12);
    engageAndAttack(s, 1.7);
    expect(s.enemies).toHaveLength(0);
    expect(s.events).toContainEqual({ type: 'garumRepelled', byAlly: 'roran' });
    expect(s.stats.roran!.defeats).toBe(0);
  });

  it('garumFlees が false なら撤退せず最後まで戦う', () => {
    const s = fresh({ ...STAGE, garumFlees: false });
    ally(s, 'roran').pos = { x: 16, y: 16 };
    const g = addEnemy(s, 'garum', 30, 16, 12);
    engageAndAttack(s, 1.7);
    expect(s.enemies).toHaveLength(1);
    expect(g.hp).toBe(10);
  });

  it('味方は HP 0 でたいきゃくし、交戦が解除される', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    ally(s, 'roran').hp = 2;
    const e = addEnemy(s, 'garum', 30, 16);
    engageAndAttack(s, 1.5);
    expect(ally(s, 'roran').retired).toBe(true);
    expect(ally(s, 'roran').hp).toBe(0);
    expect(ally(s, 'roran').engagedWith).toBeNull();
    expect(e.engagedWith).toBeNull();
    expect(s.events).toContainEqual({ type: 'allyRetired', allyId: 'roran' });
  });
});

describe('砦とフェーズ遷移', () => {
  it('敵が砦に着くと砦 HP が減り、その敵は消える', () => {
    const s = fresh();
    const e = addEnemy(s, 'narazumono', 20, 16);
    step(s, [], 0.01);
    expect(s.fortHp).toBe(30 - 3);
    expect(s.enemies).toHaveLength(0);
    expect(s.events).toContainEqual({ type: 'fortDamaged', amount: 3 });
    expect(e.hp).toBeGreaterThan(0);
  });

  it('砦 HP が 0 で defeat', () => {
    const s = fresh();
    s.fortHp = 2;
    addEnemy(s, 'narazumono', 20, 16);
    step(s, [], 0.01);
    expect(s.fortHp).toBeLessThanOrEqual(0);
    expect(s.phase).toBe('defeat');
  });

  it('敵が全滅し pending も空なら waveCleared', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    addEnemy(s, 'narazumono', 30, 16, 3);
    engageAndAttack(s, 1.7);
    expect(s.phase).toBe('waveCleared');
  });

  it('最終ウェーブなら stageCleared', () => {
    const s = fresh();
    s.waveIndex = 1;
    ally(s, 'roran').pos = { x: 16, y: 16 };
    addEnemy(s, 'narazumono', 30, 16, 3);
    engageAndAttack(s, 1.7);
    expect(s.phase).toBe('stageCleared');
  });

  it('まだ pending が残っていれば wave のまま', () => {
    const s = fresh();
    s.pending = [{ at: 99, kind: 'narazumono', from: { x: 304, y: 16 } }];
    step(s, [], 0.01);
    expect(s.phase).toBe('wave');
  });
});
