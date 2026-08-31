import type { Registry } from '../engine/registry';
import type { CharProgress } from '../core/types';

export const SAVE_KEY = 'character-tactics/save';
export const SAVE_VERSION = 2;

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type SaveData = {
  version: number;
  clearedStageIds: string[];
  units: Record<string, CharProgress>;
  counters: Record<string, number>;
  titles: string[];
};

function isFiniteNonNegInt(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

/** level は 1 はじまりの せっけいなので、0 は こわれた ちとして あつかう */
function isFinitePositiveInt(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function newSave(reg: Registry): SaveData {
  const units: Record<string, CharProgress> = {};
  for (const id of reg.units.keys()) units[id] = { level: 1, xp: 0 };
  return { version: SAVE_VERSION, clearedStageIds: [], units, counters: {}, titles: [] };
}

/**
 * 壊れたエントリだけを捨て、セーブ全体は捨てない。
 * レジストリに無い ID は無視し、レジストリにあってセーブに無い ID は既定値で補う。
 * これによりコンテンツを足し引きしてもプレイヤーの進行が失われない。
 */
function reconcile(raw: Record<string, unknown>, reg: Registry): SaveData {
  const save = newSave(reg);

  const rawUnits = isPlainObject(raw.units) ? raw.units : {};
  for (const id of reg.units.keys()) {
    const p = rawUnits[id];
    if (!isPlainObject(p) || !isFinitePositiveInt(p.level) || !isFiniteNonNegInt(p.xp)) continue;
    save.units[id] = { level: p.level as number, xp: p.xp as number };
  }

  if (Array.isArray(raw.clearedStageIds)) {
    const known = new Set(reg.stages.map((s) => s.id));
    save.clearedStageIds = raw.clearedStageIds.filter(
      (id): id is string => typeof id === 'string' && known.has(id),
    );
  }

  if (Array.isArray(raw.titles)) {
    const known = new Set(reg.titles.map((t) => t.id));
    save.titles = raw.titles.filter((id): id is string => typeof id === 'string' && known.has(id));
  }

  if (isPlainObject(raw.counters)) {
    for (const [key, value] of Object.entries(raw.counters)) {
      if (isFiniteNonNegInt(value)) save.counters[key] = value as number;
    }
  }

  return save;
}

export function loadSave(storage: StorageLike, reg: Registry): SaveData | null {
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return null;
    // 旧セーブはマイグレーションせず読み捨てる（設計書 9 節）
    if (parsed.version !== SAVE_VERSION) return null;
    if (!isPlainObject(parsed.units)) return null;
    return reconcile(parsed, reg);
  } catch {
    return null;
  }
}

/** 保存できたら true。localStorage が例外を投げる環境では false */
export function writeSave(storage: StorageLike, data: SaveData): boolean {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
