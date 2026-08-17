import { CHAR_IDS } from './types';
import type { CharBattleStats, CharId, CharProgress } from './types';

export const MAX_LEVEL = 5;
export const XP_BASE = 20;
export const XP_PER_DEFEAT = 5;
const XP_PER_LEVEL = 30;

export type TitleId =
  | 'gamanzuyoi'
  | 'ichigekihissatsu'
  | 'minnanookaasan'
  | 'kazenoyouni'
  | 'nakayoshi';

export const TITLE_LABELS: Record<TitleId, string> = {
  gamanzuyoi: 'がまんづよい',
  ichigekihissatsu: 'いちげきひっさつ',
  minnanookaasan: 'みんなの おかあさん',
  kazenoyouni: 'かぜの ように',
  nakayoshi: 'なかよし',
};

/** その称号が誰のものか。null は全員共通 */
export const TITLE_OWNER: Record<TitleId, CharId | null> = {
  gamanzuyoi: 'roran',
  ichigekihissatsu: 'ines',
  minnanookaasan: 'mist',
  kazenoyouni: 'gau',
  nakayoshi: null,
};

export type Counters = {
  funbaruUses: number;
  neraiuchiKills: number;
  omajinaiUses: number;
  kakenukeruHits: number;
  bondSupports: number;
};

export function emptyCounters(): Counters {
  return { funbaruUses: 0, neraiuchiKills: 0, omajinaiUses: 0, kakenukeruHits: 0, bondSupports: 0 };
}

export function xpGain(defeats: number): number {
  return XP_BASE + defeats * XP_PER_DEFEAT;
}

export function xpToNext(level: number): number {
  return level * XP_PER_LEVEL;
}

export function applyXp(p: CharProgress, gained: number): CharProgress {
  let level = p.level;
  let xp = p.xp;
  if (level >= MAX_LEVEL) return { level, xp };

  xp += gained;
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }
  if (level >= MAX_LEVEL) xp = 0;
  return { level, xp };
}

export function accumulateCounters(
  prev: Counters,
  stats: Record<CharId, CharBattleStats>,
): Counters {
  let bondSupports = prev.bondSupports;
  for (const id of CHAR_IDS) bondSupports += stats[id].bondSupports;

  return {
    funbaruUses: prev.funbaruUses + stats.roran.skillUses,
    neraiuchiKills: prev.neraiuchiKills + stats.ines.neraiuchiKills,
    omajinaiUses: prev.omajinaiUses + stats.mist.skillUses,
    kakenukeruHits: prev.kakenukeruHits + stats.gau.kakenukeruHits,
    bondSupports,
  };
}

const TITLE_RULES: { id: TitleId; test: (c: Counters) => boolean }[] = [
  { id: 'gamanzuyoi', test: (c) => c.funbaruUses >= 5 },
  { id: 'ichigekihissatsu', test: (c) => c.neraiuchiKills >= 3 },
  { id: 'minnanookaasan', test: (c) => c.omajinaiUses >= 5 },
  { id: 'kazenoyouni', test: (c) => c.kakenukeruHits >= 8 },
  { id: 'nakayoshi', test: (c) => c.bondSupports >= 20 },
];

export function earnedTitles(c: Counters): TitleId[] {
  return TITLE_RULES.filter((r) => r.test(c)).map((r) => r.id);
}
