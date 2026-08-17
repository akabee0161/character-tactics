import { BOND_RANGE } from './bonds';
import { MELEE_RANGE } from '../content/characters';
import { distance, distanceToSegment, isWalkableAt } from './field';
import type { AllyUnit, BattleState, CharId, Vec2 } from './types';

export const FUNBARU_DURATION = 5;
export const OMAJINAI_HEAL = 12;
export const KAKENUKERU_DAMAGE = 5;

export function isFunbaruActive(ally: AllyUnit, time: number): boolean {
  return time < ally.funbaruUntil;
}

export function canUseSkill(state: BattleState, allyId: CharId): boolean {
  if (state.phase !== 'wave') return false;
  const ally = state.allies.find((a) => a.id === allyId);
  if (!ally) return false;
  return !ally.retired && !ally.skillUsed;
}

export function useSkill(state: BattleState, allyId: CharId, dest?: Vec2): boolean {
  if (!canUseSkill(state, allyId)) return false;
  const ally = state.allies.find((a) => a.id === allyId)!;

  switch (ally.skill) {
    case 'funbaru':
      ally.funbaruUntil = state.time + FUNBARU_DURATION;
      break;

    case 'neraiuchi':
      ally.neraiuchiArmed = true;
      break;

    case 'omajinai': {
      const candidates = state.allies.filter(
        (a) => !a.retired && distance(ally.pos, a.pos) <= BOND_RANGE,
      );
      if (candidates.length === 0) return false;
      let target = candidates[0]!;
      for (const c of candidates) {
        if (c.hp / c.maxHp < target.hp / target.maxHp) target = c;
      }
      target.hp = Math.min(target.maxHp, target.hp + OMAJINAI_HEAL);
      break;
    }

    case 'kakenukeru': {
      if (!dest) return false;
      if (!isWalkableAt(state.grid, dest)) return false;
      const from = { ...ally.pos };
      let hits = 0;
      for (const enemy of state.enemies) {
        if (distanceToSegment(enemy.pos, from, dest) <= MELEE_RANGE) {
          enemy.hp -= KAKENUKERU_DAMAGE;
          hits++;
          state.events.push({ type: 'hit', targetPos: { ...enemy.pos }, amount: KAKENUKERU_DAMAGE });
        }
      }
      state.stats[allyId].kakenukeruHits += hits;
      ally.pos = { ...dest };
      ally.goalField = null;
      ally.engagedWith = null;
      break;
    }
  }

  ally.skillUsed = true;
  state.stats[allyId].skillUses += 1;
  state.events.push({ type: 'skill', allyId, skill: ally.skill });
  return true;
}
