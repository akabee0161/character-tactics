import { loadRegistry } from '../engine/loader';
import { SKILL_EFFECT_IDS } from './skills';
import type { Registry } from '../engine/registry';

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
