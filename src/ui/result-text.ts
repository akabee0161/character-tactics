import { xpToNext } from '../core/progress';
import type { Registry } from '../engine/registry';
import type { XpGain } from './flow';
import { STAT_LABEL, cardFromGain, statGains } from './stat-card';

/**
 * 結果の画面の仲間の行の 2 行目。
 * 上がる前はステージを始めた時点（XpGain.before）なので、戦闘の途中で上がった分も含めてまとめて出す
 */
export function resultLine(reg: Registry, gain: XpGain): string {
  if (gain.joined) return '仲間に 加わった！';
  if (gain.leveledUp) {
    const card = cardFromGain(reg, gain);
    const ups = statGains(card.before!.stats, card.stats).map((g) => `${STAT_LABEL[g.key]}+${g.delta}`);
    return `レベルアップ！ Lv${gain.before.level} → Lv${gain.after.level}${ups.map((u) => `　${u}`).join('')}`;
  }
  return `Lv${gain.after.level} (${gain.after.xp}/${xpToNext(gain.after.level, reg.growth.xpPerLevel)})`;
}
