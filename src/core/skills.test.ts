import { beforeEach, describe, expect, it } from 'vitest';
import { beginBattle, createBattleState } from './state';
import { canUseSkill, isFunbaruActive, useSkill, FUNBARU_DURATION, OMAJINAI_HEAL, KAKENUKERU_DAMAGE, SKILL_EFFECTS, SKILL_EFFECT_IDS } from './skills';
import { testRegistry } from './testing';
import type { BattleState, CharProgress, EnemyUnit, StageDef } from './types';

function fresh(stage?: StageDef): BattleState {
  const reg = testRegistry();
  const progress: Record<string, CharProgress> = {};
  for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
  const s = createBattleState(reg, stage ?? reg.stages[0]!, progress, 1);
  beginBattle(s);
  return s;
}

function addEnemy(s: BattleState, x: number, y: number, hp = 12): EnemyUnit {
  const e: EnemyUnit = {
    uid: `e${s.nextEnemyUid++}`, kind: 'narazumono', ai: { kind: 'aggressive' },
    pos: { x, y }, hp, maxHp: 12, engagedWith: null, attackCooldown: 0,
    lastHitBy: null, lastHitNeraiuchi: false,
  };
  s.enemies.push(e);
  return e;
}

const ally = (s: BattleState, id: string) => s.allies.find((a) => a.id === id)!;

describe('canUseSkill', () => {
  let s: BattleState;
  beforeEach(() => {
    s = fresh();
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

  it('battle フェーズでなければ使えない', () => {
    s.phase = 'placement';
    expect(canUseSkill(s, 'roran')).toBe(false);
  });
});

describe('ふんばる', () => {
  it('5 秒間の効果が付き、skill イベントが出る', () => {
    const s = fresh();
    s.time = 10;
    expect(useSkill(s, 'roran')).toBe(true);
    expect(ally(s, 'roran').funbaruUntil).toBe(10 + FUNBARU_DURATION);
    expect(s.events).toContainEqual({ type: 'skill', allyId: 'roran', skill: 'funbaru', hits: 0 });
  });

  it('isFunbaruActive は期限内だけ true', () => {
    const s = fresh();
    useSkill(s, 'roran');
    expect(isFunbaruActive(ally(s, 'roran'), 4.9)).toBe(true);
    expect(isFunbaruActive(ally(s, 'roran'), 5.1)).toBe(false);
  });
});

describe('ねらいうち', () => {
  it('次の一撃に効果が乗る', () => {
    const s = fresh();
    expect(useSkill(s, 'ines')).toBe(true);
    expect(ally(s, 'ines').neraiuchiArmed).toBe(true);
  });
});

describe('おまじない', () => {
  it('範囲内で HP 割合がいちばん低い味方を回復する', () => {
    const s = fresh();
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
    const s = fresh();
    for (const a of s.allies) a.pos = { x: 100, y: 16 };
    ally(s, 'ines').hp = 19;
    useSkill(s, 'mist');
    expect(ally(s, 'ines').hp).toBe(20);
  });

  it('範囲内に誰もいなければ自分を回復する', () => {
    const s = fresh();
    ally(s, 'mist').pos = { x: 16, y: 16 };
    for (const a of s.allies) if (a.id !== 'mist') a.pos = { x: 300, y: 80 };
    ally(s, 'mist').hp = 5;
    useSkill(s, 'mist');
    expect(ally(s, 'mist').hp).toBe(17);
  });

  it('たいきゃく中の味方は対象にならない', () => {
    const s = fresh();
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
    const s = fresh();
    ally(s, 'gau').pos = { x: 80, y: 208 };
    const onPath = addEnemy(s, 160, 208);
    const offPath = addEnemy(s, 160, 272);
    expect(useSkill(s, 'gau', { x: 260, y: 208 })).toBe(true);
    expect(ally(s, 'gau').pos).toEqual({ x: 260, y: 208 });
    expect(onPath.hp).toBe(12 - KAKENUKERU_DAMAGE);
    expect(offPath.hp).toBe(12);
    expect(s.events).toContainEqual({ type: 'skill', allyId: 'gau', skill: 'kakenukeru', hits: 1 });
  });

  it('目的地の指定がなければ発動しない', () => {
    const s = fresh();
    expect(useSkill(s, 'gau')).toBe(false);
    expect(canUseSkill(s, 'gau')).toBe(true);
  });

  it('歩けない目的地なら発動しない', () => {
    const reg = testRegistry();
    // row6（y:192-224）の col14-16（x:448-544）を壁にする
    const stage: StageDef = {
      ...reg.stages[0]!,
      mapRows: reg.stages[0]!.mapRows.map((row, y) =>
        y === 6 ? `${row.slice(0, 14)}###${row.slice(17)}` : row,
      ),
    };
    const s = fresh(stage);
    expect(useSkill(s, 'gau', { x: 480, y: 208 })).toBe(false);
    expect(canUseSkill(s, 'gau')).toBe(true);
  });

  it('目的地は歩けても経路上に壁があれば発動しない', () => {
    const reg = testRegistry();
    const stage: StageDef = {
      ...reg.stages[0]!,
      mapRows: reg.stages[0]!.mapRows.map((row, y) =>
        y === 6 ? `${row.slice(0, 14)}###${row.slice(17)}` : row,
      ),
    };
    const s = fresh(stage);
    ally(s, 'gau').pos = { x: 400, y: 208 };
    expect(useSkill(s, 'gau', { x: 600, y: 208 })).toBe(false);
    expect(ally(s, 'gau').pos).toEqual({ x: 400, y: 208 });
    expect(canUseSkill(s, 'gau')).toBe(true);
  });

  it('倒した敵の lastHitBy が記録され、撃破功績が付く', () => {
    const s = fresh();
    ally(s, 'gau').pos = { x: 80, y: 208 };
    const e = addEnemy(s, 160, 208, 3);
    expect(useSkill(s, 'gau', { x: 260, y: 208 })).toBe(true);
    expect(e.lastHitBy).toBe('gau');
    expect(e.lastHitNeraiuchi).toBe(false);
  });

  it('交戦は解除される', () => {
    const s = fresh();
    ally(s, 'gau').pos = { x: 80, y: 208 };
    ally(s, 'gau').engagedWith = 'e1';
    useSkill(s, 'gau', { x: 260, y: 208 });
    expect(ally(s, 'gau').engagedWith).toBeNull();
  });
});

describe('SKILL_EFFECTS', () => {
  it('skills.json の すべての id に こうかの じっそうが ある', () => {
    const reg = testRegistry();
    for (const id of reg.skills.keys()) {
      expect(`${id} => ${SKILL_EFFECTS[id] !== undefined}`).toContain('true');
    }
  });

  it('SKILL_EFFECT_IDS は SKILL_EFFECTS の キーと 一致する', () => {
    expect([...SKILL_EFFECT_IDS].sort()).toEqual(Object.keys(SKILL_EFFECTS).sort());
  });

  it('しらない skillId の ユニットは スキルを つかえない', () => {
    const s = fresh();
    const roran = ally(s, 'roran');
    roran.skill = 'sonzaishinai';
    expect(useSkill(s, 'roran')).toBe(false);
    expect(roran.skillUsed).toBe(false);
  });

  it('ふんばりの もちじかんを skills.json から よむ', () => {
    const s = fresh();
    useSkill(s, 'roran');
    expect(ally(s, 'roran').funbaruUntil).toBe(s.time + s.reg.skills.get('funbaru')!.params.duration!);
  });
});
