import type { StageDef, Vec2 } from '../engine/schema';
import type { Unit } from '../core/types';

/** 倒れたら即敗北するユニットの defId。定義順・重複なし */
export function escortDefIds(stage: StageDef): string[] {
  const out: string[] = [];
  for (const cond of stage.defeat) {
    if (cond.type !== 'unitLost') continue;
    for (const defId of cond.defIds) {
      if (!out.includes(defId)) out.push(defId);
    }
  }
  return out;
}

export type SightCircle = { pos: Vec2; radius: number; alerted: boolean };

/**
 * 索敵範囲の表示は装飾ではない。範囲が見えなければ sentry と aggressive の区別が
 * プレイヤーに伝わらず、「近づかずに迂回する」という判断そのものが成立しない。
 */
export function sightCircles(units: Unit[]): SightCircle[] {
  const out: SightCircle[] = [];
  for (const u of units) {
    if (u.retired || u.ai === null) continue;
    const def = u.ai.def;
    const alerted = u.ai.mode === 'chase';
    if (def.kind === 'sentry' || def.kind === 'guard') {
      out.push({ pos: { ...u.pos }, radius: def.sightRange, alerted });
    }
  }
  return out;
}
