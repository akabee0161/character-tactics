import { bondSupporters, BOND_RANGE } from './bonds';
import { MELEE_RANGE } from './constants';
import { hostilesOf, playerUnits } from './sim';
import { skillParam } from '../engine/registry';
import { distance, distanceToSegment, isWalkableAt } from './field';
import type { BattleState, Unit, Vec2 } from './types';

/** skills.json に値がなかったときのふぉーるばっく。JSON が正なのでふつうは使われない */
export const FUNBARU_DURATION = 5;
export const OMAJINAI_HEAL = 12;
export const KAKENUKERU_DAMAGE = 5;
export const DEFAULT_SKILL_COOLDOWN = 10;

export function isFunbaruActive(unit: Unit, time: number): boolean {
  return time < unit.funbaruUntil;
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

export type SkillContext = { state: BattleState; self: Unit; dest?: Vec2 };

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
    const candidates = playerUnits(state).filter((u) => distance(self.pos, u.pos) <= range);
    if (candidates.length === 0) return null;
    let target = candidates[0]!;
    for (const c of candidates) {
      if (c.hp / c.maxHp < target.hp / target.maxHp) target = c;
    }
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + heal);
    const healed = target.hp - before;
    if (healed > 0) {
      state.events.push({
        type: 'heal', targetPos: { ...target.pos }, amount: healed,
        sourceUid: self.uid, sourceDefId: self.defId, sourcePos: { ...self.pos },
      });
    }
    return 0;
  },

  kakenukeru: ({ state, self, dest }) => {
    if (!dest) return null;
    if (!isWalkableAt(state.grid, dest)) return null;
    const from = { ...self.pos };
    if (!isPathWalkable(state, from, dest)) return null;
    const damage = skillParam(state.reg, 'kakenukeru', 'damage', KAKENUKERU_DAMAGE);
    let hits = 0;
    for (const enemy of hostilesOf(state, self)) {
      if (distanceToSegment(enemy.pos, from, dest) > MELEE_RANGE) continue;
      enemy.hp -= damage;
      enemy.lastHitBy = self.uid;
      enemy.lastHitNeraiuchi = false;
      hits++;
      state.events.push({
        type: 'hit', targetUid: enemy.uid, targetPos: { ...enemy.pos }, amount: damage,
        sourceUid: self.uid, sourceDefId: self.defId, attackKind: self.attack, sourcePos: { ...from }, neraiuchi: false,
      });
    }
    self.pos = { ...dest };
    self.goalField = null;
    self.goalPos = null;
    self.engagedWith = null;
    return hits;
  },
};

export const SKILL_EFFECT_IDS: readonly string[] = Object.keys(SKILL_EFFECTS);

export function canUseSkill(state: BattleState, uid: string): boolean {
  if (state.phase !== 'battle') return false;
  const unit = state.units.find((u) => u.uid === uid && u.side === 'player');
  if (!unit) return false;
  return !unit.retired && state.time >= unit.skillCooldownUntil;
}

export function useSkill(state: BattleState, uid: string, dest?: Vec2): boolean {
  if (!canUseSkill(state, uid)) return false;
  const self = state.units.find((u) => u.uid === uid)!;
  const effect = SKILL_EFFECTS[self.skillId ?? ''];
  if (!effect) return false;

  const fromPos = { ...self.pos };
  const hits = effect({ state, self, dest });
  if (hits === null) return false;

  const cooldown = skillParam(state.reg, self.skillId!, 'cooldown', DEFAULT_SKILL_COOLDOWN);
  self.skillCooldownUntil = state.time + cooldown;
  state.events.push({
    type: 'skill', uid: self.uid, defId: self.defId, skillId: self.skillId!, hits,
    fromPos, toPos: { ...self.pos },
  });
  return true;
}
