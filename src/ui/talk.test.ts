import { describe, expect, it } from 'vitest';
import { splitPages, wrapText } from './talk';

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
});
