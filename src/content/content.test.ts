import { describe, expect, it } from 'vitest';
import { CHARACTERS, MELEE_RANGE, BOW_RANGE } from './characters';
import { ENEMIES } from './enemies';
import { CHAR_IDS } from '../core/types';

describe('CHARACTERS', () => {
  it('4人が定義されている', () => {
    expect(Object.keys(CHARACTERS).sort()).toEqual([...CHAR_IDS].sort());
  });

  it('キーと id が一致している', () => {
    for (const id of CHAR_IDS) {
      expect(CHARACTERS[id].id).toBe(id);
    }
  });

  it('設計書のステータスどおり', () => {
    expect(CHARACTERS.roran).toMatchObject({ maxHp: 30, power: 6, guard: 5, attack: 'melee', skill: 'funbaru' });
    expect(CHARACTERS.ines).toMatchObject({ maxHp: 20, power: 8, guard: 2, attack: 'bow', skill: 'neraiuchi' });
    expect(CHARACTERS.mist).toMatchObject({ maxHp: 22, power: 4, guard: 3, attack: 'melee', skill: 'omajinai' });
    expect(CHARACTERS.gau).toMatchObject({ maxHp: 24, power: 7, guard: 3, attack: 'melee', skill: 'kakenukeru' });
  });

  it('イネスだけ弓レンジ、ほかは近接レンジ', () => {
    expect(CHARACTERS.ines.range).toBe(BOW_RANGE);
    expect(CHARACTERS.roran.range).toBe(MELEE_RANGE);
    expect(CHARACTERS.mist.range).toBe(MELEE_RANGE);
    expect(CHARACTERS.gau.range).toBe(MELEE_RANGE);
  });

  it('攻撃間隔は近接 1.6 秒 / 弓 2.2 秒', () => {
    expect(CHARACTERS.roran.attackInterval).toBe(1.6);
    expect(CHARACTERS.ines.attackInterval).toBe(2.2);
  });

  it('ガウだけ速い', () => {
    expect(CHARACTERS.gau.speed).toBe(100);
    for (const id of ['roran', 'ines', 'mist'] as const) {
      expect(CHARACTERS[id].speed).toBe(60);
    }
  });

  it('表示名に漢字が含まれない', () => {
    for (const id of CHAR_IDS) {
      expect(CHARACTERS[id].name).not.toMatch(/[一-鿿]/);
    }
  });
});

describe('ENEMIES', () => {
  it('3種が定義されている', () => {
    expect(Object.keys(ENEMIES).sort()).toEqual(['garum', 'narazumono', 'tatemochi']);
  });

  it('設計書のステータスどおり', () => {
    expect(ENEMIES.narazumono).toMatchObject({ maxHp: 12, power: 5, guard: 1, fortDamage: 3, bowDamageCap: null, fleeAtHpRatio: null });
    expect(ENEMIES.tatemochi).toMatchObject({ maxHp: 20, power: 5, guard: 3, fortDamage: 5, bowDamageCap: 1, fleeAtHpRatio: null });
    expect(ENEMIES.garum).toMatchObject({ maxHp: 40, power: 9, guard: 4, fortDamage: 10, bowDamageCap: null, fleeAtHpRatio: 0.3 });
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
