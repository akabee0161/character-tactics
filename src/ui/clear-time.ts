import type { ParTimes } from '../engine/schema';

export type Rank = 'gold' | 'silver' | 'bronze';

export const RANK_LABEL: Record<Rank, string> = { gold: '金', silver: '銀', bronze: '銅' };

/** 評価の文字の色（結果の画面・ステージ選択） */
export const RANK_COLOR: Record<Rank, string> = { gold: '#ffd479', silver: '#d6dde4', bronze: '#d39a6a' };

/** 画面に出す秒（端数は切り捨て）。評価もこの秒で決める */
const shownSeconds = (seconds: number): number => Math.floor(seconds);

/** 「48秒」「2分14秒」。秒の端数は切り捨て、秒は 0 埋めしない */
export function formatClearTime(seconds: number): string {
  const s = shownSeconds(seconds);
  return s < 60 ? `${s}秒` : `${Math.floor(s / 60)}分${s % 60}秒`;
}

/** 画面に出す秒が金・銀・銅の目安以下なら対応する評価。銅より遅ければ null（評価なし） */
export function rankFor(seconds: number, par: ParTimes): Rank | null {
  const s = shownSeconds(seconds);
  if (s <= par.gold) return 'gold';
  if (s <= par.silver) return 'silver';
  if (s <= par.bronze) return 'bronze';
  return null;
}
