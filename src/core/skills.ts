import { bondSupporters, BOND_RANGE } from './bonds';
import { MELEE_RANGE } from './constants';
import { skillParam } from '../engine/registry';
import { distance, distanceToSegment, isWalkableAt } from './field';
import type { AllyUnit, BattleState, Vec2 } from './types';

/** skills.json に値がなかったときのふぉーるばっく。JSON が正なのでふつうは使われない */
export const FUNBARU_DURATION = 5;
export const OMAJINAI_HEAL = 12;
export const KAKENUKERU_DAMAGE = 5;

export function isFunbaruActive(ally: AllyUnit, time: number): boolean {
  return time < ally.funbaruUntil;
}

function isPathWalkable(state: BattleState, from: Vec2, dest: Vec2): boolean {
  const step = state.grid.cell / 2;
  const steps = Math.max(1, Math.ceil(distance(from, dest) / step));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const p = { x: from.x + (dest.x - from.x) * t, y: from.y + (dest.y - from.y) * t };
    if (!isWalkableAt(state.grid, p)) return false;
  }
  return true;
}

export type SkillContext = { state: BattleState; self: AllyUnit; dest?: Vec2 };

/**
 * 効果の本体。戻り値は「当てた数」で、称号のカウンタ（skill:<id>:hits）に積まれる。
 * 発動できなかった場合だけ null を返す。呼び出し側はそのとき使用回数も消費させない。
 */
export type SkillEffect = (ctx: SkillContext) => number | null;

export const SKILL_EFFECTS: Record<string, SkillEffect> = {
  funbaru: ({ state, self }) => {
    self.funbaruUntil = state.time + skillParam(state.reg, 'funbaru', 'duration', FUNBARU_DURATION);
    return 0;
  },

  neraiuchi: ({ self }) => {
    self.neraiuchiArmed = true;
    return 0;
  },

  omajinai: ({ state, self }) => {
    const range = skillParam(state.reg, 'omajinai', 'range', BOND_RANGE);
    const heal = skillParam(state.reg, 'omajinai', 'heal', OMAJINAI_HEAL);
    const candidates = state.allies.filter((a) => !a.retired && distance(self.pos, a.pos) <= range);
    if (candidates.length === 0) return null;
    let target = candidates[0]!;
    for (const c of candidates) {
      if (c.hp / c.maxHp < target.hp / target.maxHp) target = c;
    }
    target.hp = Math.min(target.maxHp, target.hp + heal);
    return 0;
  },

  kakenukeru: ({ state, self, dest }) => {
    if (!dest) return null;
    if (!isWalkableAt(state.grid, dest)) return null;
    const from = { ...self.pos };
    if (!isPathWalkable(state, from, dest)) return null;
    const damage = skillParam(state.reg, 'kakenukeru', 'damage', KAKENUKERU_DAMAGE);
    let hits = 0;
    for (const enemy of state.enemies) {
      if (distanceToSegment(enemy.pos, from, dest) > MELEE_RANGE) continue;
      enemy.hp -= damage;
      enemy.lastHitBy = self.id;
      enemy.lastHitNeraiuchi = false;
      hits++;
      state.events.push({ type: 'hit', targetPos: { ...enemy.pos }, amount: damage });
    }
    self.pos = { ...dest };
    self.goalField = null;
    self.goalPos = null;
    self.engagedWith = null;
    return hits;
  },
};

export const SKILL_EFFECT_IDS: readonly string[] = Object.keys(SKILL_EFFECTS);

export function canUseSkill(state: BattleState, allyId: string): boolean {
  if (state.phase !== 'wave') return false;
  const ally = state.allies.find((a) => a.id === allyId);
  if (!ally) return false;
  return !ally.retired && !ally.skillUsed;
}

export function useSkill(state: BattleState, allyId: string, dest?: Vec2): boolean {
  if (!canUseSkill(state, allyId)) return false;
  const self = state.allies.find((a) => a.id === allyId)!;
  const effect = SKILL_EFFECTS[self.skill];
  if (!effect) return false;

  const hits = effect({ state, self, dest });
  if (hits === null) return false;

  self.skillUsed = true;
  state.stats[allyId]!.skillUses += 1;
  state.stats[allyId]!.kakenukeruHits += hits;
  state.events.push({ type: 'skill', allyId, skill: self.skill });
  return true;
}
