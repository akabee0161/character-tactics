import type { TitleDef } from '../engine/schema';
import type { SimEvent } from './types';

export function bump(counters: Record<string, number>, key: string, amount: number): void {
  counters[key] = (counters[key] ?? 0) + amount;
}

/**
 * その tick のイベントからカウンタのキーを起こす。
 * 特定のスキル名・キャラ名をここに書かないこと。キーの規約（設計書 6.8）だけで完結させる。
 */
export function accumulate(counters: Record<string, number>, events: SimEvent[]): void {
  for (const ev of events) {
    switch (ev.type) {
      case 'skill':
        bump(counters, `skill:${ev.skillId}:uses`, 1);
        bump(counters, `skill:${ev.skillId}:hits`, ev.hits);
        break;
      case 'unitDefeated':
        if (ev.byDefId === null) break;
        if (ev.neraiuchi) bump(counters, 'kill:neraiuchi', 1);
        break;
      case 'bondSupport':
        bump(counters, 'bond:supports', 1);
        break;
      default:
        break;
    }
  }
}

/**
 * 称号が参照するキーだけをセーブへ持ち越す。
 * こうしないと、ステージ内だけで意味のあるキーがセーブに溜まり続ける。
 */
export function mergeCounters(
  prev: Record<string, number>,
  battle: Record<string, number>,
  titles: TitleDef[],
): Record<string, number> {
  const out: Record<string, number> = { ...prev };
  for (const title of titles) {
    const gained = battle[title.counter];
    if (gained === undefined) continue;
    out[title.counter] = (out[title.counter] ?? 0) + gained;
  }
  return out;
}
