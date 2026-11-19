import { describe, expect, it } from 'vitest';
import { loadSave, newSave, SAVE_KEY, SAVE_VERSION, writeSave } from './save';
import { testRegistry } from '../core/testing';
import { applyXp } from '../core/progress';
import { statsForLevel } from '../core/state';
import { allyCardFromSave } from '../ui/stat-card';
import type { StorageLike } from './save';

function memoryStorage(initial?: string): StorageLike & { raw: string | null } {
  return {
    raw: initial ?? null,
    getItem(_key: string) { return this.raw; },
    setItem(_key: string, value: string) { this.raw = value; },
  };
}

describe('newSave', () => {
  it('レジストリの すべての ユニットを レベル1で いれる', () => {
    const reg = testRegistry();
    const s = newSave(reg);
    expect(Object.keys(s.units).sort()).toEqual([...reg.units.keys()].sort());
    expect(s.units.roran).toEqual({ level: 1, xp: 0 });
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.clearedStageIds).toEqual([]);
  });
});

describe('loadSave', () => {
  const reg = testRegistry();
  const valid = {
    version: 2,
    clearedStageIds: ['stage1'],
    units: { roran: { level: 3, xp: 10 }, ines: { level: 2, xp: 0 }, mist: { level: 1, xp: 5 }, gau: { level: 1, xp: 0 } },
  };

  it('ただしい セーブを よむ', () => {
    const s = loadSave(memoryStorage(JSON.stringify(valid)), reg);
    expect(s?.units.roran).toEqual({ level: 3, xp: 10 });
    expect(s?.clearedStageIds).toEqual(['stage1']);
  });

  it('セーブが なければ null', () => {
    expect(loadSave(memoryStorage(), reg)).toBeNull();
  });

  it('こわれた JSON なら null', () => {
    expect(loadSave(memoryStorage('{{{'), reg)).toBeNull();
  });

  it('version 1 の きゅうセーブは よみすてる', () => {
    const old = { version: 1, clearedStages: 2, chars: {} };
    expect(loadSave(memoryStorage(JSON.stringify(old)), reg)).toBeNull();
  });

  it('レジストリに ない ユニットの エントリは むしする', () => {
    const raw = { ...valid, units: { ...valid.units, yuurei: { level: 9, xp: 0 } } };
    const s = loadSave(memoryStorage(JSON.stringify(raw)), reg);
    expect(s?.units.yuurei).toBeUndefined();
    expect(s?.units.roran).toEqual({ level: 3, xp: 10 });
  });

  it('レジストリに あって セーブに ない ユニットは レベル1で おぎなう', () => {
    const { gau: _drop, ...units } = valid.units;
    const s = loadSave(memoryStorage(JSON.stringify({ ...valid, units })), reg);
    expect(s?.units.gau).toEqual({ level: 1, xp: 0 });
    expect(s?.units.roran).toEqual({ level: 3, xp: 10 });
  });

  it('かたが こわれた エントリだけを すてて、ほかは のこす', () => {
    const raw = { ...valid, units: { ...valid.units, ines: { level: 'つよい', xp: 0 } } };
    const s = loadSave(memoryStorage(JSON.stringify(raw)), reg);
    expect(s?.units.ines).toEqual({ level: 1, xp: 0 });
    expect(s?.units.roran).toEqual({ level: 3, xp: 10 });
  });

  it('level が 0 いかの エントリは こわれた ちとして すてる', () => {
    const raw = { ...valid, units: { ...valid.units, ines: { level: 0, xp: 0 } } };
    const s = loadSave(memoryStorage(JSON.stringify(raw)), reg);
    expect(s?.units.ines).toEqual({ level: 1, xp: 0 });
    expect(s?.units.roran).toEqual({ level: 3, xp: 10 });
  });

  it('レジストリに ない ステージ id は clearedStageIds から おとす', () => {
    const raw = { ...valid, clearedStageIds: ['stage1', 'kesareta'] };
    expect(loadSave(memoryStorage(JSON.stringify(raw)), reg)?.clearedStageIds).toEqual(['stage1']);
  });

  it('units が オブジェクトで なければ null', () => {
    expect(loadSave(memoryStorage(JSON.stringify({ ...valid, units: [] })), reg)).toBeNull();
  });
});

describe('readIntroStageIds', () => {
  const reg = testRegistry();

  it('あたらしい セーブでは からの はいれつ', () => {
    expect(newSave(reg).readIntroStageIds).toEqual([]);
  });

  it('readIntroStageIds の ない きゅうセーブも よめる（バージョンは あげない）', () => {
    const old = { version: 2, clearedStageIds: ['stage1'], units: {} };
    const loaded = loadSave(memoryStorage(JSON.stringify(old)), reg);
    expect(loaded).not.toBeNull();
    expect(loaded!.readIntroStageIds).toEqual([]);
    expect(loaded!.clearedStageIds).toEqual(['stage1']);
  });

  it('レジストリに ない ステージ id は すてる', () => {
    const raw = { ...newSave(reg), readIntroStageIds: ['stage1', 'nonexistent'] };
    const loaded = loadSave(memoryStorage(JSON.stringify(raw)), reg);
    expect(loaded!.readIntroStageIds).toEqual(['stage1']);
  });

  it('こわれた readIntroStageIds でも ほかの フィールドは のこる', () => {
    const raw = { ...newSave(reg), readIntroStageIds: 'こわれている', clearedStageIds: ['stage1'] };
    const loaded = loadSave(memoryStorage(JSON.stringify(raw)), reg)!;
    expect(loaded.readIntroStageIds).toEqual([]);
    expect(loaded.clearedStageIds).toEqual(['stage1']);
  });
});

describe('writeSave', () => {
  it('かきこめたら true', () => {
    const reg = testRegistry();
    const st = memoryStorage();
    expect(writeSave(st, newSave(reg))).toBe(true);
    expect(JSON.parse(st.raw!).version).toBe(2);
  });

  it('れいがいを なげる ストレージでは false', () => {
    const reg = testRegistry();
    const st: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new Error('いっぱい'); },
    };
    expect(writeSave(st, newSave(reg))).toBe(false);
  });

  it('SAVE_KEY は かわらない', () => {
    expect(SAVE_KEY).toBe('character-tactics/save');
  });
});

describe('members / claimed / bonus', () => {
  const reg = testRegistry();
  const load = (raw: object) => loadSave(memoryStorage(JSON.stringify(raw)), reg)!;

  it('新しいセーブは members・claimed が空', () => {
    expect(newSave(reg).members).toEqual([]);
    expect(newSave(reg).claimed).toEqual([]);
  });

  it('members・claimed・bonus が往復する', () => {
    const bonus = { maxHp: 3, power: 1, guard: 2, speed: 0, resist: 1 };
    const raw = { ...newSave(reg), members: ['gau'], claimed: ['village:a'] };
    raw.units = { ...raw.units, roran: { level: 2, xp: 1, bonus } };
    const loaded = load(raw);
    expect(loaded.members).toEqual(['gau']);
    expect(loaded.claimed).toEqual(['village:a']);
    expect(loaded.units.roran).toEqual({ level: 2, xp: 1, bonus });
  });

  it('壊れた bonus は捨てる（負の数・小数・欠け）', () => {
    for (const bad of [{ maxHp: -1, power: 0, guard: 0, speed: 0 }, { maxHp: 1.5, power: 0, guard: 0, speed: 0 }, { maxHp: 1 }, 'x']) {
      const raw = { ...newSave(reg) };
      raw.units = { ...raw.units, roran: { level: 2, xp: 1, bonus: bad } as never };
      expect(load(raw).units.roran).toEqual({ level: 2, xp: 1 });
    }
  });

  it('members の知らない ID と重複は捨てる', () => {
    const loaded = load({ ...newSave(reg), members: ['gau', 'nobody', 'gau', 5] });
    expect(loaded.members).toEqual(['gau']);
  });

  it('claimed は文字列だけ残す', () => {
    expect(load({ ...newSave(reg), claimed: ['a', 3, null, 'b'] }).claimed).toEqual(['a', 'b']);
  });

  it('フィールドの無い古いセーブは [] になる', () => {
    const old = { version: 2, clearedStageIds: [], units: {} };
    const loaded = load(old);
    expect(loaded.members).toEqual([]);
    expect(loaded.claimed).toEqual([]);
  });
});

describe('前回の出撃（sortie）', () => {
  const reg = testRegistry();
  const load = (raw: object) => loadSave(memoryStorage(JSON.stringify(raw)), reg)!;

  it('sortie を書いて読むと同じ並び', () => {
    const st = memoryStorage();
    expect(writeSave(st, { ...newSave(reg), sortie: ['ines', 'roran'] })).toBe(true);
    expect(loadSave(st, reg)!.sortie).toEqual(['ines', 'roran']);
  });
  it('知らない ID・文字列でない値・重複は捨てる', () => {
    expect(load({ ...newSave(reg), sortie: ['roran', 'ghost', 3, 'roran', 'ines'] }).sortie)
      .toEqual(['roran', 'ines']);
  });
  it('sortie が無いセーブ・配列でない値は []', () => {
    const { sortie: _omit, ...without } = newSave(reg);
    expect(load(without).sortie).toEqual([]);
    expect(load({ ...newSave(reg), sortie: 'roran' }).sortie).toEqual([]);
    expect(newSave(reg).sortie).toEqual([]);
  });
});

describe('称号を持っていたころのセーブ（titles・counters）', () => {
  const reg = testRegistry();
  it('titles・counters を持つ古いセーブも読め、その値は捨てる', () => {
    const raw = {
      ...newSave(reg),
      units: { roran: { level: 5, xp: 3 } },
      titles: { roran: ['neraiuchi-master'] },
      counters: { roran: { neraiuchi: 7 } },
    };
    const loaded = loadSave(memoryStorage(JSON.stringify(raw)), reg);
    expect(loaded).not.toBeNull();
    expect(loaded!.units.roran).toEqual({ level: 5, xp: 3 });
    expect(loaded!.clearedStageIds).toEqual([]);
    expect(Object.keys(loaded!)).not.toContain('titles');
    expect(Object.keys(loaded!)).not.toContain('counters');
  });
  it('書き戻しても titles・counters は残らない', () => {
    const raw = { ...newSave(reg), titles: { roran: ['x'] }, counters: { roran: { x: 1 } } };
    const st = memoryStorage(JSON.stringify(raw));
    expect(writeSave(st, loadSave(st, reg)!)).toBe(true);
    expect(st.raw).not.toMatch(/titles|counters/);
  });
});

describe('上限 12 のころの古いセーブ（上限 30 の今）', () => {
  const reg = testRegistry();
  const raw = {
    version: 2, clearedStageIds: ['stage1'],
    units: { roran: { level: 12, xp: 400 }, ines: { level: 12, xp: 0 } },
  };

  it('古いセーブのレベル 12 の仲間は、新しい伸び方の能力になる', () => {
    const save = loadSave(memoryStorage(JSON.stringify(raw)), reg)!;
    expect(save.units.roran).toEqual({ level: 12, xp: 400 });
    const card = allyCardFromSave(reg, save, 'roran');
    expect(card.level).toBe(12);
    expect(card.stats).toEqual(statsForLevel(reg.units.get('roran')!, 12));
  });

  it('ためた経験値が新しい式の必要量を超えていても読め、次に経験値が入ったときに上がる', () => {
    const save = loadSave(memoryStorage(JSON.stringify(raw)), reg)!;
    const after = applyXp(save.units.roran!, 1, reg.growth);
    expect(after.level).toBeGreaterThan(12);
  });
});

describe('bestTimes（ステージごとの一番速いクリアの秒）', () => {
  const reg = testRegistry();
  const base = { version: 2, clearedStageIds: [], units: { roran: { level: 1, xp: 0 } } };
  const load = (extra: Record<string, unknown>) => loadSave(memoryStorage(JSON.stringify({ ...base, ...extra })), reg);

  it('newSave は空', () => {
    expect(newSave(reg).bestTimes).toEqual({});
  });
  it('今までのセーブ（bestTimes が無い）は記録なしで読め、ほかの欄はそのまま', () => {
    const s = load({ clearedStageIds: ['stage1'] });
    expect(s?.bestTimes).toEqual({});
    expect(s?.clearedStageIds).toEqual(['stage1']);
  });
  it('正しい項目を読む。小数のまま', () => {
    expect(load({ bestTimes: { stage1: 50.5, stage2: 12 } })?.bestTimes).toEqual({ stage1: 50.5, stage2: 12 });
  });
  it('壊れた項目だけ捨てる（知らないステージ・負・0・文字・null・無限大）', () => {
    const raw = JSON.stringify({ ...base, bestTimes: 'X' }).replace('"X"', '{"stage1":50.5,"nope":30,"stage2":-1,"stage4":0,"stage5":"x","stage6":null,"stage7":1e999}');
    const s = loadSave(memoryStorage(raw), reg);
    expect(s?.bestTimes).toEqual({ stage1: 50.5 });
  });
  it('配列や数なら空にする。セーブ全体は捨てない', () => {
    for (const bad of [[1, 2], 5, 'x', null]) {
      const s = load({ bestTimes: bad, clearedStageIds: ['stage1'] });
      expect(s?.bestTimes).toEqual({});
      expect(s?.clearedStageIds).toEqual(['stage1']);
    }
  });
  it('書いて読み直しても同じ', () => {
    const st = memoryStorage();
    const data = { ...newSave(reg), bestTimes: { stage1: 61.25 } };
    writeSave(st, data);
    expect(loadSave(st, reg)?.bestTimes).toEqual({ stage1: 61.25 });
  });
});
