import type { Vec2 } from '../core/types';
import type { Registry } from '../engine/registry';
import type { SaveData } from '../save/save';
import { isStageUnlocked } from './flow';
import { hitRect } from './hit';
import { enemyBtnIn, stageSlot } from './layout';

export type SelectTap = { type: 'stage'; index: number } | { type: 'enemies'; index: number } | { type: 'none' };

/** ステージ選択で押した場所の意味。p はスクロールを足した後の座標。まだ行けないステージは none */
export function stageTapTarget(reg: Registry, save: SaveData, p: Vec2): SelectTap {
  for (let i = 0; i < reg.stages.length; i++) {
    const slot = stageSlot(i);
    if (!hitRect(slot, p) || !isStageUnlocked(reg, save, i)) continue;
    return hitRect(enemyBtnIn(slot), p) ? { type: 'enemies', index: i } : { type: 'stage', index: i };
  }
  return { type: 'none' };
}
