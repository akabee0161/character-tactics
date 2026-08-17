import { describe, expect, it } from 'vitest';
import {
  accumulateCounters, applyXp, earnedTitles, emptyCounters,
  MAX_LEVEL, TITLE_LABELS, TITLE_OWNER, xpGain, xpToNext,
} from './progress';
import type { CharBattleStats, CharId } from './types';

const stats = (over: Partial<Record<CharId, Partial<CharBattleStats>>> = {}) => {
  const base: CharBattleStats = { defeats: 0, skillUses: 0, neraiuchiKills: 0, kakenukeruHits: 0, bondSupports: 0 };
  return {
    roran: { ...base, ...over.roran },
    ines: { ...base, ...over.ines },
    mist: { ...base, ...over.mist },
    gau: { ...base, ...over.gau },
  } as Record<CharId, CharBattleStats>;
};

describe('xpGain / xpToNext', () => {
  it('クリア基礎 20 + 撃破数 x 5', () => {
    expect(xpGain(0)).toBe(20);
    expect(xpGain(4)).toBe(40);
  });

  it('次のレベルに必要な経験値は レベル x 30', () => {
    expect(xpToNext(1)).toBe(30);
    expect(xpToNext(4)).toBe(120);
  });
});

describe('applyXp', () => {
  it('足りなければレベルは上がらない', () => {
    expect(applyXp({ level: 1, xp: 0 }, 25)).toEqual({ level: 1, xp: 25 });
  });

  it('ちょうど足りればレベルが上がって余りが繰り越される', () => {
    expect(applyXp({ level: 1, xp: 10 }, 20)).toEqual({ level: 2, xp: 0 });
  });

  it('一度に 2 レベル上がることもある', () => {
    // Lv1: 30 必要 -> Lv2: 60 必要
    expect(applyXp({ level: 1, xp: 0 }, 95)).toEqual({ level: 3, xp: 5 });
  });

  it('上限レベルでは経験値が貯まらない', () => {
    expect(applyXp({ level: MAX_LEVEL, xp: 0 }, 999)).toEqual({ level: MAX_LEVEL, xp: 0 });
  });

  it('元のオブジェクトを書き換えない', () => {
    const p = { level: 1, xp: 0 };
    applyXp(p, 50);
    expect(p).toEqual({ level: 1, xp: 0 });
  });
});

describe('accumulateCounters', () => {
  it('各キャラのスキル使用が対応するカウンタに積まれる', () => {
    const c = accumulateCounters(emptyCounters(), stats({
      roran: { skillUses: 2 },
      mist: { skillUses: 3 },
      ines: { neraiuchiKills: 1 },
      gau: { kakenukeruHits: 4 },
    }));
    expect(c).toMatchObject({ funbaruUses: 2, omajinaiUses: 3, neraiuchiKills: 1, kakenukeruHits: 4 });
  });

  it('なかよし支援は全員ぶんの合計', () => {
    const c = accumulateCounters(emptyCounters(), stats({
      roran: { bondSupports: 3 }, ines: { bondSupports: 2 },
    }));
    expect(c.bondSupports).toBe(5);
  });

  it('前回までのぶんに積み増す', () => {
    const prev = { ...emptyCounters(), funbaruUses: 4 };
    const c = accumulateCounters(prev, stats({ roran: { skillUses: 2 } }));
    expect(c.funbaruUses).toBe(6);
  });

  it('元のカウンタを書き換えない', () => {
    const prev = emptyCounters();
    accumulateCounters(prev, stats({ roran: { skillUses: 2 } }));
    expect(prev.funbaruUses).toBe(0);
  });
});

describe('earnedTitles', () => {
  it('条件を満たしていなければ空', () => {
    expect(earnedTitles(emptyCounters())).toEqual([]);
  });

  it('ふんばる 5 回で がまんづよい', () => {
    expect(earnedTitles({ ...emptyCounters(), funbaruUses: 5 })).toEqual(['gamanzuyoi']);
  });

  it('ねらいうちで 3 体倒すと いちげきひっさつ', () => {
    expect(earnedTitles({ ...emptyCounters(), neraiuchiKills: 3 })).toEqual(['ichigekihissatsu']);
  });

  it('おまじない 5 回で みんなのおかあさん', () => {
    expect(earnedTitles({ ...emptyCounters(), omajinaiUses: 5 })).toEqual(['minnanookaasan']);
  });

  it('かけぬけるで 8 体に当てると かぜのように', () => {
    expect(earnedTitles({ ...emptyCounters(), kakenukeruHits: 8 })).toEqual(['kazenoyouni']);
  });

  it('なかよし支援 20 回で なかよし', () => {
    expect(earnedTitles({ ...emptyCounters(), bondSupports: 20 })).toEqual(['nakayoshi']);
  });

  it('複数まとめて返す', () => {
    expect(earnedTitles({ funbaruUses: 9, neraiuchiKills: 3, omajinaiUses: 0, kakenukeruHits: 0, bondSupports: 30 }))
      .toEqual(['gamanzuyoi', 'ichigekihissatsu', 'nakayoshi']);
  });
});

describe('TITLE_LABELS / TITLE_OWNER', () => {
  it('全称号にひらがな表記のラベルがある', () => {
    for (const label of Object.values(TITLE_LABELS)) {
      expect(label).not.toMatch(/[一-鿿]/);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('スキルの称号は持ち主が決まっていて、なかよしだけ全員共通', () => {
    expect(TITLE_OWNER.gamanzuyoi).toBe('roran');
    expect(TITLE_OWNER.ichigekihissatsu).toBe('ines');
    expect(TITLE_OWNER.minnanookaasan).toBe('mist');
    expect(TITLE_OWNER.kazenoyouni).toBe('gau');
    expect(TITLE_OWNER.nakayoshi).toBeNull();
  });
});
