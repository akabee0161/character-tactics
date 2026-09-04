import { beforeEach, describe, expect, it } from 'vitest';
import { beginBattle, createBattleState } from './state';
import { canUseSkill, isFunbaruActive, useSkill, FUNBARU_DURATION, OMAJINAI_HEAL, KAKENUKERU_DAMAGE, SKILL_EFFECTS, SKILL_EFFECT_IDS } from './skills';
import { testRegistry } from './testing';
import type { BattleState, CharProgress, StageDef, Unit } from './types';

function fresh(stage?: StageDef): BattleState {
  const reg = testRegistry();
  const progress: Record<string, CharProgress> = {};
  for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
  const s = createBattleState(reg, stage ?? reg.stages[0]!, progress, 1);
  beginBattle(s);
  return s;
}

function addEnemy(s: BattleState, x: number, y: number, hp = 12): Unit {
  const def = s.reg.enemies.get('narazumono')!;
  const uid = `e${s.nextEnemyUid++}`;
  const e: Unit = {
    uid, defId: 'narazumono', side: 'enemy', controller: 'ai', combat: def.combat,
    pos: { x, y }, hp, maxHp: 12, power: def.power, guard: def.guard,
    attack: def.attack, range: def.range, attackInterval: def.attackInterval, speed: def.speed,
    bowDamageCap: def.bowDamageCap, skillId: def.skillId,
    level: 1, xp: 0,
    goalPos: null, goalField: null, engagedWith: null, attackCooldown: 0, retired: false,
    ai: { def: { kind: 'aggressive' }, mode: 'idle', targetUid: null, home: { x, y } },
    skillCooldownUntil: 0, funbaruUntil: -1, neraiuchiArmed: false, pinchShown: false,
    seenDefIds: [], lastHitBy: null, lastHitNeraiuchi: false,
  };
  s.units.push(e);
  return e;
}

function unitOf(s: BattleState, defId: string): Unit {
  const u = s.units.find((x) => x.defId === defId && x.side === 'player');
  if (!u) throw new Error(`いない: ${defId}`);
  return u;
}

describe('canUseSkill', () => {
  let s: BattleState;
  beforeEach(() => {
    s = fresh();
  });

  it('バトル中で未使用なら使える', () => {
    expect(canUseSkill(s, unitOf(s, 'roran').uid)).toBe(true);
  });

  it('使うとクールダウン中は使えない', () => {
    const uid = unitOf(s, 'roran').uid;
    useSkill(s, uid);
    expect(canUseSkill(s, uid)).toBe(false);
  });

  it('クールダウンが明けると再び使える', () => {
    const uid = unitOf(s, 'roran').uid;
    useSkill(s, uid);
    const cooldown = s.reg.skills.get('funbaru')!.params.cooldown!;
    s.time += cooldown;
    expect(canUseSkill(s, uid)).toBe(true);
  });

  it('たいきゃく中は使えない', () => {
    const roran = unitOf(s, 'roran');
    roran.retired = true;
    expect(canUseSkill(s, roran.uid)).toBe(false);
  });

  it('battle フェーズでなければ使えない', () => {
    s.phase = 'placement';
    expect(canUseSkill(s, unitOf(s, 'roran').uid)).toBe(false);
  });
});

describe('ふんばる', () => {
  it('5 秒間の効果が付き、skill イベントが出る', () => {
    const s = fresh();
    s.time = 10;
    const roran = unitOf(s, 'roran');
    expect(useSkill(s, roran.uid)).toBe(true);
    expect(unitOf(s, 'roran').funbaruUntil).toBe(10 + FUNBARU_DURATION);
    expect(s.events).toContainEqual({
      type: 'skill', uid: roran.uid, defId: 'roran', skillId: 'funbaru', hits: 0,
      fromPos: roran.pos, toPos: roran.pos,
    });
  });

  it('isFunbaruActive は期限内だけ true', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    useSkill(s, roran.uid);
    expect(isFunbaruActive(unitOf(s, 'roran'), 4.9)).toBe(true);
    expect(isFunbaruActive(unitOf(s, 'roran'), 5.1)).toBe(false);
  });
});

describe('ねらいうち', () => {
  it('次の一撃に効果が乗る', () => {
    const s = fresh();
    const ines = unitOf(s, 'ines');
    expect(useSkill(s, ines.uid)).toBe(true);
    expect(unitOf(s, 'ines').neraiuchiArmed).toBe(true);
  });
});

describe('おまじない', () => {
  it('範囲内で HP 割合がいちばん低い味方を回復する', () => {
    const s = fresh();
    unitOf(s, 'mist').pos = { x: 100, y: 16 };
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 150, y: 16 };
    roran.hp = 5;
    const gau = unitOf(s, 'gau');
    gau.pos = { x: 120, y: 16 };
    gau.hp = 20;
    useSkill(s, unitOf(s, 'mist').uid);
    expect(unitOf(s, 'roran').hp).toBe(5 + OMAJINAI_HEAL);
    expect(unitOf(s, 'gau').hp).toBe(20);
  });

  it('最大 HP を超えて回復しない', () => {
    const s = fresh();
    for (const u of s.units) if (u.side === 'player') u.pos = { x: 100, y: 16 };
    unitOf(s, 'ines').hp = 19;
    useSkill(s, unitOf(s, 'mist').uid);
    expect(unitOf(s, 'ines').hp).toBe(20);
  });

  it('範囲内に誰もいなければ自分を回復する', () => {
    const s = fresh();
    const mist = unitOf(s, 'mist');
    mist.pos = { x: 16, y: 16 };
    for (const u of s.units) if (u.side === 'player' && u.defId !== 'mist') u.pos = { x: 300, y: 80 };
    mist.hp = 5;
    useSkill(s, mist.uid);
    expect(unitOf(s, 'mist').hp).toBe(17);
  });

  it('たいきゃく中の味方は対象にならない', () => {
    const s = fresh();
    for (const u of s.units) if (u.side === 'player') u.pos = { x: 100, y: 16 };
    const roran = unitOf(s, 'roran');
    roran.hp = 1;
    roran.retired = true;
    unitOf(s, 'ines').hp = 10;
    useSkill(s, unitOf(s, 'mist').uid);
    expect(unitOf(s, 'roran').hp).toBe(1);
    expect(unitOf(s, 'ines').hp).toBe(20);
  });
});

describe('かけぬける', () => {
  it('目的地まで移動し、経路上の敵にダメージを与える', () => {
    const s = fresh();
    const gau = unitOf(s, 'gau');
    gau.pos = { x: 80, y: 208 };
    const onPath = addEnemy(s, 160, 208);
    const offPath = addEnemy(s, 160, 272);
    expect(useSkill(s, gau.uid, { x: 260, y: 208 })).toBe(true);
    expect(unitOf(s, 'gau').pos).toEqual({ x: 260, y: 208 });
    expect(onPath.hp).toBe(12 - KAKENUKERU_DAMAGE);
    expect(offPath.hp).toBe(12);
    expect(s.events).toContainEqual({
      type: 'skill', uid: gau.uid, defId: 'gau', skillId: 'kakenukeru', hits: 1,
      fromPos: { x: 80, y: 208 }, toPos: { x: 260, y: 208 },
    });
  });

  it('目的地の指定がなければ発動しない', () => {
    const s = fresh();
    const gau = unitOf(s, 'gau');
    expect(useSkill(s, gau.uid)).toBe(false);
    expect(canUseSkill(s, gau.uid)).toBe(true);
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
    const gau = unitOf(s, 'gau');
    expect(useSkill(s, gau.uid, { x: 480, y: 208 })).toBe(false);
    expect(canUseSkill(s, gau.uid)).toBe(true);
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
    const gau = unitOf(s, 'gau');
    gau.pos = { x: 400, y: 208 };
    expect(useSkill(s, gau.uid, { x: 600, y: 208 })).toBe(false);
    expect(unitOf(s, 'gau').pos).toEqual({ x: 400, y: 208 });
    expect(canUseSkill(s, gau.uid)).toBe(true);
  });

  it('倒した敵の lastHitBy が記録され、撃破功績が付く', () => {
    const s = fresh();
    const gau = unitOf(s, 'gau');
    gau.pos = { x: 80, y: 208 };
    const e = addEnemy(s, 160, 208, 3);
    expect(useSkill(s, gau.uid, { x: 260, y: 208 })).toBe(true);
    expect(e.lastHitBy).toBe(gau.uid);
    expect(e.lastHitNeraiuchi).toBe(false);
  });

  it('交戦は解除される', () => {
    const s = fresh();
    const gau = unitOf(s, 'gau');
    gau.pos = { x: 80, y: 208 };
    gau.engagedWith = 'e1';
    useSkill(s, gau.uid, { x: 260, y: 208 });
    expect(unitOf(s, 'gau').engagedWith).toBeNull();
  });
});

describe('SKILL_EFFECTS', () => {
  it('skills.json の すべての id に こうかの じっそうが ある', () => {
    const reg = testRegistry();
    for (const id of reg.skills.keys()) {
      expect(SKILL_EFFECTS[id], `こうかの じっそうが ない skillId: ${id}`).toBeDefined();
    }
  });

  it('SKILL_EFFECT_IDS は SKILL_EFFECTS の キーと 一致する', () => {
    expect([...SKILL_EFFECT_IDS].sort()).toEqual(Object.keys(SKILL_EFFECTS).sort());
  });

  it('しらない skillId の ユニットは スキルを つかえない', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    roran.skillId = 'sonzaishinai';
    expect(useSkill(s, roran.uid)).toBe(false);
    expect(unitOf(s, 'roran').skillCooldownUntil).toBe(0);
  });

  it('ふんばりの もちじかんを skills.json から よむ', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    useSkill(s, roran.uid);
    expect(unitOf(s, 'roran').funbaruUntil).toBe(s.time + s.reg.skills.get('funbaru')!.params.duration!);
  });

  it('ふんばりの クールダウンを skills.json から よむ', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    useSkill(s, roran.uid);
    expect(unitOf(s, 'roran').skillCooldownUntil)
      .toBe(s.time + s.reg.skills.get('funbaru')!.params.cooldown!);
  });
});
