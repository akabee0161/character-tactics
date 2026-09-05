/**
 * 会話フェーズの本文を、枠に収まる行とページに割る。
 *
 * 文字幅の測定は関数として受け取る。本番は ctx.measureText(t).width、
 * テストはダミーを渡す。これによりこのモジュールは Canvas に依存しない。
 */
export type Measure = (text: string) => number;

/** 行頭に置いてはいけない文字。前の行の末尾へぶら下げる */
const NO_LINE_START = '。、！？」';

/**
 * 行頭禁則。ぶら下げ方式なので、押し込んだ行は maxWidth を1文字ぶん超えうる。
 * 追い出し（前の行の最後の文字を次へ送る）はしない。日本語として目立つのは
 * 行頭の約物だけで、そこまでやる価値がないため。
 */
function hangPunctuation(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (prev !== undefined && prev !== '' && line !== '' && NO_LINE_START.includes(line[0]!)) {
      out[out.length - 1] = prev + line[0];
      const rest = line.slice(1);
      if (rest !== '') out.push(rest);
    } else {
      out.push(line);
    }
  }
  return out;
}

/** 明示的な改行で切り、さらに maxWidth で貪欲に折り返す */
export function wrapText(text: string, measure: Measure, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      // line が空のときは幅を見ない。見ると1文字も入らない幅で無限ループする
      if (line !== '' && measure(line + ch) > maxWidth) {
        out.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    out.push(line);
  }
  return hangPunctuation(out);
}

/** 折り返した行を maxLines 行ずつのページに切る */
export function splitPages(
  text: string,
  measure: Measure,
  maxWidth: number,
  maxLines: number,
): string[][] {
  const wrapped = wrapText(text, measure, maxWidth);
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += maxLines) {
    pages.push(wrapped.slice(i, i + maxLines));
  }
  return pages.length > 0 ? pages : [['']];
}
