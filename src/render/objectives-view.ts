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

export type AlertMark = { pos: Vec2; defId: string };

/**
 * 気づかれた敵。索敵範囲そのものは見せない。
 * 範囲が見えると「どこまでなら近づけるか」を測る作業になって緊張感が削がれるため、
 * 気づかれたことだけを伝える。aggressive は開始時から追ってくるので対象外
 * （常に印が出てしまい、「気づかれた」という意味を持たなくなる）
 */
export function alertMarks(units: Unit[]): AlertMark[] {
  const out: AlertMark[] = [];
  for (const u of units) {
    if (u.retired || u.side !== 'enemy' || u.ai === null) continue;
    if (u.ai.def.kind === 'aggressive' || u.ai.mode !== 'chase') continue;
    out.push({ pos: { ...u.pos }, defId: u.defId });
  }
  return out;
}
