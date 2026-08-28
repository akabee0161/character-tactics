import { describe, expect, it } from 'vitest';
import { ALL_CHAR_IDS, charDef, CHARACTERS, MELEE_RANGE, BOW_RANGE } from './characters';
import { enemyDef, ENEMIES } from './enemies';

describe('CHARACTERS', () => {
  it('4人が定義されている', () => {
    expect(Object.keys(CHARACTERS).sort()).toEqual([...ALL_CHAR_IDS].sort());
  });

  it('キーと id が一致している', () => {
    for (const id of ALL_CHAR_IDS) {
      expect(charDef(id).id).toBe(id);
    }
  });

  it('設計書のステータスどおり', () => {
    expect(charDef('roran')).toMatchObject({ maxHp: 30, power: 6, guard: 5, attack: 'melee', skill: 'funbaru' });
    expect(charDef('ines')).toMatchObject({ maxHp: 20, power: 8, guard: 2, attack: 'bow', skill: 'neraiuchi' });
    expect(charDef('mist')).toMatchObject({ maxHp: 22, power: 4, guard: 3, attack: 'melee', skill: 'omajinai' });
    expect(charDef('gau')).toMatchObject({ maxHp: 24, power: 7, guard: 3, attack: 'melee', skill: 'kakenukeru' });
  });

  it('イネスだけ弓レンジ、ほかは近接レンジ', () => {
    expect(charDef('ines').range).toBe(BOW_RANGE);
    expect(charDef('roran').range).toBe(MELEE_RANGE);
    expect(charDef('mist').range).toBe(MELEE_RANGE);
    expect(charDef('gau').range).toBe(MELEE_RANGE);
  });

  it('攻撃間隔は近接 1.6 秒 / 弓 2.2 秒', () => {
    expect(charDef('roran').attackInterval).toBe(1.6);
    expect(charDef('ines').attackInterval).toBe(2.2);
  });

  it('ガウだけ速い', () => {
    expect(charDef('gau').speed).toBe(100);
    for (const id of ['roran', 'ines', 'mist'] as const) {
      expect(charDef(id).speed).toBe(60);
    }
  });

  it('表示名に漢字が含まれない', () => {
    for (const id of ALL_CHAR_IDS) {
      expect(charDef(id).name).not.toMatch(/[一-鿿]/);
    }
  });
});

describe('ENEMIES', () => {
  it('3種が定義されている', () => {
    expect(Object.keys(ENEMIES).sort()).toEqual(['garum', 'narazumono', 'tatemochi']);
  });

  it('設計書のステータスどおり', () => {
    expect(enemyDef('narazumono')).toMatchObject({ maxHp: 12, power: 5, guard: 1, fortDamage: 3, bowDamageCap: null, fleeAtHpRatio: null });
    expect(enemyDef('tatemochi')).toMatchObject({ maxHp: 20, power: 5, guard: 3, fortDamage: 5, bowDamageCap: 1, fleeAtHpRatio: null });
    expect(enemyDef('garum')).toMatchObject({ maxHp: 40, power: 9, guard: 4, fortDamage: 10, bowDamageCap: null, fleeAtHpRatio: 0.3 });
  });

  it('敵は全員近接', () => {
    for (const e of Object.values(ENEMIES)) {
      expect(e.range).toBe(MELEE_RANGE);
    }
  });

  it('表示名に漢字が含まれない', () => {
    for (const e of Object.values(ENEMIES)) {
      expect(e.name).not.toMatch(/[一-鿿]/);
    }
  });
});
