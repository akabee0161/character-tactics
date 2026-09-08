import { describe, expect, it } from 'vitest';
import {
  TALK_CHARS_PER_SEC, advanceTalk, currentSpeaker, isPageComplete, makeTalkState,
  pageCount, skipTalk, splitPages, tickTalk, visibleLines, wrapText,
} from './talk';
import type { TalkLine } from '../core/dialogue';

/** テスト用の測定。1文字 = 10px とみなす */
const measure = (t: string): number => t.length * 10;

describe('wrapText', () => {
  it('はばに おさまるなら そのまま', () => {
    expect(wrapText('あいうえお', measure, 100)).toEqual(['あいうえお']);
  });

  it('はばを こえたら おりかえす', () => {
    expect(wrapText('あいうえおかきくけこ', measure, 50)).toEqual(['あいうえお', 'かきくけこ']);
  });

  it('\\n で かならず きる', () => {
    expect(wrapText('あい\nうえ', measure, 1000)).toEqual(['あい', 'うえ']);
  });

  it('1もじが はばを こえても むげんループしない', () => {
    expect(wrapText('あいう', measure, 1)).toEqual(['あ', 'い', 'う']);
  });

  it('からもじれつは 1ぎょうに なる', () => {
    expect(wrapText('', measure, 100)).toEqual(['']);
  });
});

describe('wrapText の ぎょうとう きんそく', () => {
  it('ぎょうとうに くる 。 は まえの ぎょうに おしこむ', () => {
    // 5文字で折り返すと ['あいうえお', '。かきく'] になるはず → 。を前へ
    expect(wrapText('あいうえお。かきく', measure, 50)).toEqual(['あいうえお。', 'かきく']);
  });

  it('ぎょうとうに くる 」 も おしこむ', () => {
    expect(wrapText('あいうえお」かきく', measure, 50)).toEqual(['あいうえお」', 'かきく']);
  });

  it('おしこんだ けっか からに なった ぎょうは のこさない', () => {
    expect(wrapText('あいうえお。', measure, 50)).toEqual(['あいうえお。']);
  });

  it('ぎょうとうの やくものが つづいても ぜんぶ おしこむ', () => {
    // 連続する禁則文字「」。」はカスケード的に全て前行へ
    expect(wrapText('あいうえおか」。さしすせそ', measure, 60)).toEqual(['あいうえおか」。', 'さしすせ', 'そ']);
  });

  it('\\n の 直後の やくものは まえの だんらくへ おしこまない', () => {
    // 段落をまたいで ぶら下げると、著者が書いた \n の改行が消えてしまう
    expect(wrapText('あい\n。うえ', measure, 1000)).toEqual(['あい', '。うえ']);
  });
});

describe('splitPages', () => {
  it('maxLines ごとに ページを きる', () => {
    const pages = splitPages('あ\nい\nう\nえ\nお', measure, 1000, 2);
    expect(pages).toEqual([['あ', 'い'], ['う', 'え'], ['お']]);
  });

  it('1ページに おさまるなら 1ページ', () => {
    expect(splitPages('あ\nい', measure, 1000, 3)).toEqual([['あ', 'い']]);
  });

  it('からもじれつでも 1ページ かえす', () => {
    expect(splitPages('', measure, 1000, 3)).toEqual([['']]);
  });

  it('maxLines が 0 なら エラーに する', () => {
    expect(() => splitPages('あ', measure, 1000, 0)).toThrow('maxLines must be positive');
  });

  it('maxLines が ふなら エラーに する', () => {
    expect(() => splitPages('あ', measure, 1000, -1)).toThrow('maxLines must be positive');
  });
});

const LINES: TalkLine[] = [
  { speaker: 'roran', text: 'あい\nうえ\nおか\nきく' },  // 4行 → maxLines 3 で 2ページ
  { speaker: null, text: 'しずかだ。' },
];
const make = () => makeTalkState(LINES, measure, 1000, 3);

describe('TalkState', () => {
  it('つくった ちょくごは 1ぎょうめの 1ページめ、0もじ', () => {
    const s = make();
    expect(s.index).toBe(0);
    expect(s.page).toBe(0);
    expect(s.shown).toBe(0);
    expect(s.done).toBe(false);
    expect(pageCount(s)).toBe(2);
  });

  it('からの はいれつなら さいしょから done', () => {
    expect(makeTalkState([], measure, 1000, 3).done).toBe(true);
  });

  it('speaker を ひける。null は 地の文', () => {
    const s = make();
    expect(currentSpeaker(s)).toBe('roran');
    advanceTalk(s, measure, 1000, 3);  // 1ページ目を全文表示
    advanceTalk(s, measure, 1000, 3);  // 2ページ目へ
    advanceTalk(s, measure, 1000, 3);  // 2ページ目を全文表示
    advanceTalk(s, measure, 1000, 3);  // 2行目へ
    expect(currentSpeaker(s)).toBeNull();
  });
});

describe('tickTalk', () => {
  it('じかんに おうじて もじが ふえる', () => {
    const s = make();
    tickTalk(s, 0.1);
    expect(s.shown).toBeCloseTo(TALK_CHARS_PER_SEC * 0.1);
  });

  it('ページの もじすうを こえない', () => {
    const s = make();
    tickTalk(s, 100);
    expect(s.shown).toBe(6);  // 'あい' + 'うえ' + 'おか' = 6文字
    expect(isPageComplete(s)).toBe(true);
  });

  it('done なら すすまない', () => {
    const s = make();
    skipTalk(s);
    tickTalk(s, 1);
    expect(s.shown).toBe(0);
  });
});

describe('visibleLines', () => {
  it('とちゅうまでの ぎょうを かえす', () => {
    const s = make();
    s.shown = 3;
    expect(visibleLines(s)).toEqual(['あい', 'う', '']);
  });

  it('ぜんぶ ひょうじずみなら ページの ぜんぎょう', () => {
    const s = make();
    s.shown = 6;
    expect(visibleLines(s)).toEqual(['あい', 'うえ', 'おか']);
  });
});

describe('advanceTalk の 4ぶんき', () => {
  it('おくりの とちゅうなら ぜんぶん ひょうじ', () => {
    const s = make();
    tickTalk(s, 0.05);
    advanceTalk(s, measure, 1000, 3);
    expect(isPageComplete(s)).toBe(true);
    expect(s.page).toBe(0);
  });

  it('ひょうじずみで ページが のこっていれば つぎの ページ', () => {
    const s = make();
    tickTalk(s, 100);
    advanceTalk(s, measure, 1000, 3);
    expect(s.page).toBe(1);
    expect(s.shown).toBe(0);
    expect(s.index).toBe(0);
  });

  it('さいごの ページなら つぎの ぎょうへ', () => {
    const s = make();
    tickTalk(s, 100);
    advanceTalk(s, measure, 1000, 3);  // 2ページ目
    tickTalk(s, 100);
    advanceTalk(s, measure, 1000, 3);  // 2行目
    expect(s.index).toBe(1);
    expect(s.page).toBe(0);
    expect(s.shown).toBe(0);
    expect(pageCount(s)).toBe(1);
  });

  it('さいごの ぎょうまで いくと done', () => {
    const s = make();
    for (let i = 0; i < 10; i++) advanceTalk(s, measure, 1000, 3);
    expect(s.done).toBe(true);
  });

  it('done の あと よんでも こわれない', () => {
    const s = make();
    skipTalk(s);
    expect(() => advanceTalk(s, measure, 1000, 3)).not.toThrow();
  });
});

describe('skipTalk', () => {
  it('そくざに done に なる', () => {
    const s = make();
    skipTalk(s);
    expect(s.done).toBe(true);
  });
});
