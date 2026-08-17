import { emptyCounters } from '../core/progress';
import { CHAR_IDS } from '../core/types';
import type { Counters, TitleId } from '../core/progress';
import type { CharId, CharProgress } from '../core/types';

export const SAVE_KEY = 'character-tactics/save';
export const SAVE_VERSION = 1;

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type SaveData = {
  version: number;
  clearedStages: number;
  chars: Record<CharId, CharProgress>;
  counters: Counters;
  titles: TitleId[];
};

export function newSave(): SaveData {
  const chars = {} as Record<CharId, CharProgress>;
  for (const id of CHAR_IDS) chars[id] = { level: 1, xp: 0 };
  return { version: SAVE_VERSION, clearedStages: 0, chars, counters: emptyCounters(), titles: [] };
}

function isValid(value: unknown): value is SaveData {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (v.version !== SAVE_VERSION) return false;
  if (typeof v.clearedStages !== 'number') return false;
  if (!Array.isArray(v.titles)) return false;
  if (typeof v.counters !== 'object' || v.counters === null) return false;
  if (typeof v.chars !== 'object' || v.chars === null) return false;

  const chars = v.chars as Record<string, unknown>;
  for (const id of CHAR_IDS) {
    const p = chars[id] as Record<string, unknown> | undefined;
    if (!p || typeof p.level !== 'number' || typeof p.xp !== 'number') return false;
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

export function writeSave(storage: StorageLike, data: SaveData): void {
  storage.setItem(SAVE_KEY, JSON.stringify(data));
}
