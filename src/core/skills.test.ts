import { beforeEach, describe, expect, it } from 'vitest';
import { createBattleState, startWave } from './state';
import { canUseSkill, isFunbaruActive, useSkill, FUNBARU_DURATION, OMAJINAI_HEAL, KAKENUKERU_DAMAGE } from './skills';
import type { BattleState, CharId, CharProgress, EnemyUnit, StageDef } from './types';

const STAGE: StageDef = {
  id: 1, name: 'テスト', cell: 32,
  mapRows: ['..........', '..........', '..........'],
  fort: { x: 16, y: 16 },
  landings: [{ x: 300, y: 16 }],
  garumFlees: true,
  waves: [{ spawns: [] }],
};

const LV1: Record<CharId, CharProgress> = {
  roran: { level: 1, xp: 0 }, ines: { level: 1, xp: 0 },
  mist: { level: 1, xp: 0 }, gau: { level: 1, xp: 0 },
};

function addEnemy(s: BattleState, x: number, y: number, hp = 12): EnemyUnit {
  const e: EnemyUnit = {
    uid: `e${s.nextEnemyUid++}`, kind: 'narazumono',
    pos: { x, y }, hp, maxHp: 12, engagedWith: null, attackCooldown: 0,
    lastHitBy: null, lastHitNeraiuchi: false,
  };
  s.enemies.push(e);
  return e;
}

const ally = (s: BattleState, id: CharId) => s.allies.find((a) => a.id === id)!;

describe('canUseSkill', () => {
  let s: BattleState;
  beforeEach(() => {
    s = createBattleState(STAGE, LV1, 1);
    startWave(s);
  });

  it('ウェーブ中で未使用なら使える', () => {
    expect(canUseSkill(s, 'roran')).toBe(true);
  });

  it('一度使うと同じウェーブでは使えない', () => {
    useSkill(s, 'roran');
    expect(canUseSkill(s, 'roran')).toBe(false);
  });

  it('たいきゃく中は使えない', () => {
    ally(s, 'roran').retired = true;
    expect(canUseSkill(s, 'roran')).toBe(false);
  });

  it('ウェーブ中でなければ使えない', () => {
    s.phase = 'waveCleared';
    expect(canUseSkill(s, 'roran')).toBe(false);
  });

  it('次のウェーブが始まればまた使える', () => {
    useSkill(s, 'roran');
    startWave(s);
    expect(canUseSkill(s, 'roran')).toBe(true);
  });
});

describe('ふんばる', () => {
  it('5 秒間の効果が付き、skill イベントが出る', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    s.time = 10;
    expect(useSkill(s, 'roran')).toBe(true);
    expect(ally(s, 'roran').funbaruUntil).toBe(10 + FUNBARU_DURATION);
    expect(s.events).toContainEqual({ type: 'skill', allyId: 'roran', skill: 'funbaru' });
    expect(s.stats.roran.skillUses).toBe(1);
  });

  it('isFunbaruActive は期限内だけ true', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    useSkill(s, 'roran');
    expect(isFunbaruActive(ally(s, 'roran'), 4.9)).toBe(true);
    expect(isFunbaruActive(ally(s, 'roran'), 5.1)).toBe(false);
  });
});

describe('ねらいうち', () => {
  it('次の一撃に効果が乗る', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    expect(useSkill(s, 'ines')).toBe(true);
    expect(ally(s, 'ines').neraiuchiArmed).toBe(true);
  });
});

describe('おまじない', () => {
  it('範囲内で HP 割合がいちばん低い味方を回復する', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    ally(s, 'mist').pos = { x: 100, y: 16 };
    ally(s, 'roran').pos = { x: 150, y: 16 };
    ally(s, 'roran').hp = 5;
    ally(s, 'gau').pos = { x: 120, y: 16 };
    ally(s, 'gau').hp = 20;
    useSkill(s, 'mist');
    expect(ally(s, 'roran').hp).toBe(5 + OMAJINAI_HEAL);
    expect(ally(s, 'gau').hp).toBe(20);
  });

  it('最大 HP を超えて回復しない', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    for (const a of s.allies) a.pos = { x: 100, y: 16 };
    ally(s, 'ines').hp = 19;
    useSkill(s, 'mist');
    expect(ally(s, 'ines').hp).toBe(20);
  });

  it('範囲内に誰もいなければ自分を回復する', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    ally(s, 'mist').pos = { x: 16, y: 16 };
    for (const a of s.allies) if (a.id !== 'mist') a.pos = { x: 300, y: 80 };
    ally(s, 'mist').hp = 5;
    useSkill(s, 'mist');
    expect(ally(s, 'mist').hp).toBe(17);
  });

  it('たいきゃく中の味方は対象にならない', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    for (const a of s.allies) a.pos = { x: 100, y: 16 };
    ally(s, 'roran').hp = 1;
    ally(s, 'roran').retired = true;
    ally(s, 'ines').hp = 10;
    useSkill(s, 'mist');
    expect(ally(s, 'roran').hp).toBe(1);
    expect(ally(s, 'ines').hp).toBe(20);
  });
});

describe('かけぬける', () => {
  it('目的地まで移動し、経路上の敵にダメージを与える', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    ally(s, 'gau').pos = { x: 16, y: 16 };
    const onPath = addEnemy(s, 100, 16);
    const offPath = addEnemy(s, 100, 80);
    expect(useSkill(s, 'gau', { x: 200, y: 16 })).toBe(true);
    expect(ally(s, 'gau').pos).toEqual({ x: 200, y: 16 });
    expect(onPath.hp).toBe(12 - KAKENUKERU_DAMAGE);
    expect(offPath.hp).toBe(12);
    expect(s.stats.gau.kakenukeruHits).toBe(1);
  });

  it('目的地の指定がなければ発動しない', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    expect(useSkill(s, 'gau')).toBe(false);
    expect(canUseSkill(s, 'gau')).toBe(true);
  });

  it('歩けない目的地なら発動しない', () => {
    const stage: StageDef = { ...STAGE, mapRows: ['..........', '.....#....', '..........'] };
    const s = createBattleState(stage, LV1, 1);
    startWave(s);
    expect(useSkill(s, 'gau', { x: 176, y: 48 })).toBe(false);
    expect(canUseSkill(s, 'gau')).toBe(true);
  });

  it('目的地は歩けても経路上に壁があれば発動しない', () => {
    const stage: StageDef = { ...STAGE, mapRows: ['..........', '.....#....', '..........'] };
    const s = createBattleState(stage, LV1, 1);
    startWave(s);
    ally(s, 'gau').pos = { x: 16, y: 48 };
    expect(useSkill(s, 'gau', { x: 300, y: 48 })).toBe(false);
    expect(ally(s, 'gau').pos).toEqual({ x: 16, y: 48 });
    expect(canUseSkill(s, 'gau')).toBe(true);
  });

  it('倒した敵の lastHitBy が記録され、撃破功績が付く', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    ally(s, 'gau').pos = { x: 16, y: 16 };
    const e = addEnemy(s, 100, 16, 3);
    expect(useSkill(s, 'gau', { x: 200, y: 16 })).toBe(true);
    expect(e.lastHitBy).toBe('gau');
    expect(e.lastHitNeraiuchi).toBe(false);
  });

  it('交戦は解除される', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    ally(s, 'gau').pos = { x: 16, y: 16 };
    ally(s, 'gau').engagedWith = 'e1';
    useSkill(s, 'gau', { x: 200, y: 16 });
    expect(ally(s, 'gau').engagedWith).toBeNull();
  });
});
