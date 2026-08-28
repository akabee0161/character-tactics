import { ALL_CHAR_IDS } from '../content/characters';
import { emptyCounters, TITLE_LABELS } from '../core/progress';
import type { Counters } from '../core/progress';
import type { CharProgress } from '../core/types';

const COUNTER_KEYS: readonly (keyof Counters)[] = [
  'funbaruUses', 'neraiuchiKills', 'omajinaiUses', 'kakenukeruHits', 'bondSupports',
];
const VALID_TITLE_IDS: readonly string[] = Object.keys(TITLE_LABELS);

function isFiniteNonNegInt(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

export const SAVE_KEY = 'character-tactics/save';
export const SAVE_VERSION = 1;

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type SaveData = {
  version: number;
  clearedStages: number;
  chars: Record<string, CharProgress>;
  counters: Counters;
  titles: string[];
};

export function newSave(): SaveData {
  const chars = {} as Record<string, CharProgress>;
  for (const id of ALL_CHAR_IDS) chars[id] = { level: 1, xp: 0 };
  return { version: SAVE_VERSION, clearedStages: 0, chars, counters: emptyCounters(), titles: [] };
}

function isValid(value: unknown): value is SaveData {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (v.version !== SAVE_VERSION) return false;
  if (!isFiniteNonNegInt(v.clearedStages)) return false;
  if (!Array.isArray(v.titles)) return false;
  if (!v.titles.every((t) => typeof t === 'string' && VALID_TITLE_IDS.includes(t))) return false;
  if (typeof v.counters !== 'object' || v.counters === null) return false;
  if (typeof v.chars !== 'object' || v.chars === null) return false;

  const counters = v.counters as Record<string, unknown>;
  for (const key of COUNTER_KEYS) {
    if (!isFiniteNonNegInt(counters[key])) return false;
  }

  const chars = v.chars as Record<string, unknown>;
  for (const id of ALL_CHAR_IDS) {
    const p = chars[id] as Record<string, unknown> | undefined;
    if (!p || !isFiniteNonNegInt(p.level) || !isFiniteNonNegInt(p.xp)) return false;
  }
  return true;
}

export function loadSave(storage: StorageLike): SaveData | null {
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** 保存できたら true。localStorage が例外を投げる環境(容量超過・プライベートブラウジング等)では false */
export function writeSave(storage: StorageLike, data: SaveData): boolean {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
