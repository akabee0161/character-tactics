import { MAX_PARTY } from './constants';
import type { Registry } from '../engine/registry';

/** 全ステージの joins・persuasions・recruit の村で加わる仲間の ID */
export function recruitUnitIds(reg: Registry): Set<string> {
  const ids = new Set<string>();
  for (const stage of reg.stages) {
    for (const j of stage.joins) ids.add(j.unitId);
    for (const p of stage.persuasions) ids.add(p.unitId);
    for (const v of stage.villages) {
      if (v.effect.type === 'recruit') ids.add(v.effect.recruit.unitId);
    }
  }
  return ids;
}

/**
 * 出撃できる仲間の並び。units の並びのうち加入しうる仲間でないもの、
 * 続けて members（加わった順）のうち units にあるもの。重複を除き MAX_PARTY で切る
 */
export function partyIds(reg: Registry, members: readonly string[]): string[] {
  const recruits = recruitUnitIds(reg);
  const out: string[] = [];
  const add = (id: string): void => {
    if (!out.includes(id)) out.push(id);
  };
  for (const id of reg.units.keys()) if (!recruits.has(id)) add(id);
  for (const id of members) if (reg.units.has(id)) add(id);
  return out.slice(0, MAX_PARTY);
}
