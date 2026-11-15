import { describe, expect, it } from 'vitest';
import { stageTapTarget } from './select-tap';
import { enemyBtnIn, stageSlot } from './layout';
import { testRegistry } from '../core/testing';
import { newSave } from '../save/save';

describe('stageTapTarget', () => {
  it('「敵を 見る」を押すと一覧、枠のほかの所は開始', () => {
    const reg = testRegistry(); const save = newSave(reg);
    const b = enemyBtnIn(stageSlot(0));
    expect(stageTapTarget(reg, save, { x: b.x + 5, y: b.y + 5 })).toEqual({ type: 'enemies', index: 0 });
    expect(stageTapTarget(reg, save, { x: stageSlot(0).x + 5, y: stageSlot(0).y + 5 })).toEqual({ type: 'stage', index: 0 });
  });

  it('まだ行けないステージは何もしない', () => {
    const reg = testRegistry(); const save = newSave(reg);
    const b = enemyBtnIn(stageSlot(1));
    expect(stageTapTarget(reg, save, { x: b.x + 5, y: b.y + 5 })).toEqual({ type: 'none' });
    expect(stageTapTarget(reg, save, { x: stageSlot(1).x + 5, y: stageSlot(1).y + 5 })).toEqual({ type: 'none' });
  });

  it('スクロールした後の座標で判定する（呼び出し側が scrollY を足した座標を渡す）', () => {
    const reg = testRegistry(); const save = newSave(reg);
    save.clearedStageIds = reg.stages.map((s) => s.id);
    const b = enemyBtnIn(stageSlot(8));
    expect(stageTapTarget(reg, save, { x: b.x + 5, y: b.y + 5 })).toEqual({ type: 'enemies', index: 8 });
  });

  it('どの枠でもない所は none', () => {
    const reg = testRegistry(); const save = newSave(reg);
    expect(stageTapTarget(reg, save, { x: 0, y: 0 })).toEqual({ type: 'none' });
  });
});
