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

/** 「気づかれた」印を出しておく長さ（秒） */
export const ALERT_MARK_DURATION = 2.0;

/**
 * 気づかれた敵。索敵範囲そのものは見せない。
 * 範囲が見えると「どこまでなら近づけるか」を測る作業になって緊張感が削がれるため、
 * 気づかれたことだけを伝える。
 *
 * 印は発見の瞬間から ALERT_MARK_DURATION のあいだだけ出す。追跡中ずっと出すと
 * 交戦中も出たままになり、「いま気づかれた」という意味を失う。
 * aggressive は開始時から追ってくるので対象外（常に印が出て意味を持たなくなる）
 */
export function alertMarks(units: Unit[], time: number): AlertMark[] {
  const out: AlertMark[] = [];
  for (const u of units) {
    if (u.retired || u.side !== 'enemy' || u.ai === null) continue;
    if (u.ai.def.kind === 'aggressive') continue;
    const spottedAt = u.ai.spottedAt;
    if (spottedAt === null || time - spottedAt > ALERT_MARK_DURATION) continue;
    out.push({ pos: { ...u.pos }, defId: u.defId });
  }
  return out;
}
