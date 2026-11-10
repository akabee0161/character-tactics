import { describe, expect, it } from 'vitest';
import { testRegistry } from './testing';
import { MAX_PARTY } from './constants';
import { partyIds, recruitUnitIds } from './party';
import type { Registry } from '../engine/registry';
import type { UnitDef } from '../engine/schema';

function reg(ids: string[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']): Registry {
  const base = testRegistry();
  const unit = (id: string): UnitDef => ({ ...base.units.values().next().value!, id, name: id });
  const units = new Map<string, UnitDef>();
  for (const id of ids) units.set(id, unit(id));
  const stage = { ...base.stages[0]!, roster: ['a', 'b'] };
  stage.joins = [{ unitId: 'e', level: 1, talk: [] }];
  stage.persuasions = [];
  stage.villages = [
    { id: 'v', col: 0, row: 0, text: null, effect: { type: 'recruit', recruit: { unitId: 'f', level: 1, talk: [] } } },
  ];
  return { ...base, units, stages: [stage] };
}

describe('recruitUnitIds', () => {
  it('joins・persuasions・recruit の村の unitId を集める', () => {
    expect([...recruitUnitIds(reg())].sort()).toEqual(['e', 'f']);
  });
});

describe('partyIds', () => {
  it('加入しうる仲間は一覧から外れ、加わった順に後ろへ並ぶ', () => {
    expect(partyIds(reg(), [])).toEqual(['a', 'b', 'c', 'd', 'g', 'h']);
    expect(partyIds(reg(), ['f', 'e', 'zzz', 'f'])).toEqual(['a', 'b', 'c', 'd', 'g', 'h', 'f', 'e']);
  });

  it('8 人で切る', () => {
    expect(MAX_PARTY).toBe(8);
    expect(partyIds(reg(), ['e', 'f'])).toHaveLength(8);
    expect(partyIds(reg(), ['e', 'f']).slice(-2)).toEqual(['e', 'f']);
    // 一覧そのものが 8 を超えても切る
    const r = reg(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
    r.stages[0]!.joins = [];
    r.stages[0]!.villages = [];
    expect(partyIds(r, [])).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  });
});
