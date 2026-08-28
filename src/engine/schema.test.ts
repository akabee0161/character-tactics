import { describe, expect, it } from 'vitest';
import {
  validateBondsFile, validateEnemyDef, validateLinesFile, validateSkillsFile,
  validateTitlesFile, validateUnitDef,
} from './schema';

const VALID_UNIT = {
  id: 'roran', name: 'ロラン', role: 'たて',
  combat: true,
  maxHp: 30, power: 6, guard: 5,
  attack: 'melee', range: 24,
  attackInterval: 1.6, speed: 60,
  skillId: 'funbaru',
  color: '#4a80c8',
};

const VALID_ENEMY = {
  ...VALID_UNIT,
  id: 'garum', name: 'ガルム', role: 'てき',
  skillId: null,
  xpReward: 8, bowDamageCap: null, fleeAtHpRatio: 0.3,
};

describe('validateUnitDef', () => {
  it('正しい定義を受け入れる', () => {
    const r = validateUnitDef('units/roran.json', VALID_UNIT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.id).toBe('roran');
  });

  it('skillId は null を許す', () => {
    const r = validateUnitDef('units/npc.json', { ...VALID_UNIT, skillId: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.skillId).toBeNull();
  });

  it('欠けたフィールドを、ファイル名とフィールド名と理由つきで弾く', () => {
    const { maxHp: _drop, ...missing } = VALID_UNIT;
    const r = validateUnitDef('units/roran.json', missing);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual({
        file: 'units/roran.json', path: 'maxHp', reason: 'かずが ひつよう',
      });
    }
  });

  it('負の maxHp を弾く', () => {
    const r = validateUnitDef('units/roran.json', { ...VALID_UNIT, maxHp: -1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('maxHp');
  });

  it('未知の attack を弾き、許される値を理由に含める', () => {
    const r = validateUnitDef('units/roran.json', { ...VALID_UNIT, attack: 'magic' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.reason).toContain('melee');
  });

  it('エラーは1つ目で打ち切らず、すべて集める', () => {
    const r = validateUnitDef('units/bad.json', { ...VALID_UNIT, maxHp: 'x', power: 'y' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.path).sort()).toEqual(['maxHp', 'power']);
  });

  it('オブジェクトでない入力を弾く', () => {
    const r = validateUnitDef('units/bad.json', [1, 2, 3]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('');
  });
});

describe('validateEnemyDef', () => {
  it('正しい定義を受け入れる', () => {
    const r = validateEnemyDef('enemies/garum.json', VALID_ENEMY);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.fleeAtHpRatio).toBe(0.3);
  });

  it('bowDamageCap と fleeAtHpRatio は null を許す', () => {
    const r = validateEnemyDef('enemies/x.json', {
      ...VALID_ENEMY, bowDamageCap: null, fleeAtHpRatio: null,
    });
    expect(r.ok).toBe(true);
  });

  it('fleeAtHpRatio が 1 を超えたら弾く', () => {
    const r = validateEnemyDef('enemies/x.json', { ...VALID_ENEMY, fleeAtHpRatio: 1.5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('fleeAtHpRatio');
  });

  it('xpReward が欠けたら弾く', () => {
    const { xpReward: _drop, ...missing } = VALID_ENEMY;
    const r = validateEnemyDef('enemies/x.json', missing);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('xpReward');
  });
});

describe('validateSkillsFile', () => {
  it('id と label と params を読む', () => {
    const r = validateSkillsFile('skills.json', [
      { id: 'funbaru', label: 'ふんばる', params: { duration: 5 } },
      { id: 'neraiuchi', label: 'ねらいうち', params: {} },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value[0]?.params.duration).toBe(5);
  });

  it('params の値が数でなければ、その キーを path に含めて弾く', () => {
    const r = validateSkillsFile('skills.json', [
      { id: 'funbaru', label: 'ふんばる', params: { duration: 'ごびょう' } },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('[0].params.duration');
  });

  it('id が重複したら弾く', () => {
    const r = validateSkillsFile('skills.json', [
      { id: 'funbaru', label: 'ふんばる', params: {} },
      { id: 'funbaru', label: 'べつ', params: {} },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.reason).toContain('じゅうふく');
  });

  it('はいれつでなければ弾く', () => {
    const r = validateSkillsFile('skills.json', { funbaru: {} });
    expect(r.ok).toBe(false);
  });
});

describe('validateBondsFile', () => {
  it('正しい絆を受け入れる', () => {
    const r = validateBondsFile('bonds.json', [{ a: 'roran', b: 'ines', bonus: 2 }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value[0]?.bonus).toBe(2);
  });

  it('bonus が 0 以下なら弾く', () => {
    const r = validateBondsFile('bonds.json', [{ a: 'roran', b: 'ines', bonus: 0 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('[0].bonus');
  });

  it('自分自身との絆を弾く', () => {
    const r = validateBondsFile('bonds.json', [{ a: 'roran', b: 'roran', bonus: 2 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.reason).toContain('じぶん');
  });
});

describe('validateTitlesFile', () => {
  it('owner に null を許す', () => {
    const r = validateTitlesFile('titles.json', [
      { id: 'nakayoshi', label: 'なかよし', owner: null, counter: 'bond:supports', threshold: 20 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value[0]?.owner).toBeNull();
  });

  it('threshold が 1 未満なら弾く', () => {
    const r = validateTitlesFile('titles.json', [
      { id: 'x', label: 'エックス', owner: null, counter: 'bond:supports', threshold: 0 },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('[0].threshold');
  });
});

describe('validateLinesFile', () => {
  it('もじれつの じしょを 受け入れる', () => {
    const r = validateLinesFile('lines/common.json', { 'skill:roran': 'ここは とおさない！' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value['skill:roran']).toBe('ここは とおさない！');
  });

  it('あたいが もじれつでなければ、その キーを path にして弾く', () => {
    const r = validateLinesFile('lines/common.json', { 'skill:roran': 42 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('skill:roran');
  });
});
