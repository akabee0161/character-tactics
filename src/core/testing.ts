import { loadRegistry } from '../engine/loader';
import { SKILL_EFFECT_IDS } from './skills';
import type { Registry } from '../engine/registry';
import type { BattleState } from './types';

let cached: Registry | null = null;

/** テスト専用。じっさいの assets/ からレジストリを組み、失敗したら理由つきで落とす */
export function testRegistry(): Registry {
  if (cached) return cached;
  const r = loadRegistry(SKILL_EFFECT_IDS);
  if (!r.ok) {
    throw new Error(
      'assets の よみこみに しっぱい:\n' +
        r.errors.map((e) => `  ${e.file} ${e.path}: ${e.reason}`).join('\n'),
    );
  }
  cached = r.value;
  return cached;
}

/**
 * テスト専用。振りかぶりを 0 にして、攻撃を出した tick にダメージが入るようにする。
 * ダメージ計算や交戦のルールを見るテストで、攻撃モーションの長さに結果を左右させないため
 */
export function instantAttacks(state: BattleState): void {
  for (const u of state.units) u.windup = 0;
}
