/**
 * 会話フェーズの本文を、枠に収まる行とページに割る。
 *
 * 文字幅の測定は関数として受け取る。本番は ctx.measureText(t).width、
 * テストはダミーを渡す。これによりこのモジュールは Canvas に依存しない。
 */
import type { TalkLine } from '../core/dialogue';

export type Measure = (text: string) => number;

/** 行頭に置いてはいけない文字。前の行の末尾へぶら下げる */
const NO_LINE_START = '。、！？」';

/**
 * 行頭禁則。ぶら下げ方式なので、押し込んだ行は maxWidth を複数文字ぶん超えうる。
 * 行頭の禁則文字をすべて前の行へ連鎖的にぶら下げる。
 * 追い出し（前の行の最後の文字を次へ送る）はしない。日本語として目立つのは
 * 行頭の約物だけで、そこまでやる価値がないため。
 */
function hangPunctuation(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (prev !== undefined && prev !== '' && line !== '') {
      // Cascade: pull back all leading forbidden characters
      let currentLine = line;
      let hanged = '';
      while (currentLine !== '' && NO_LINE_START.includes(currentLine[0]!)) {
        hanged += currentLine[0];
        currentLine = currentLine.slice(1);
      }

      if (hanged !== '') {
        out[out.length - 1] = prev + hanged;
        if (currentLine !== '') out.push(currentLine);
      } else {
        out.push(line);
      }
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
    const lines: string[] = [];
    let line = '';
    for (const ch of para) {
      // line が空のときは幅を見ない。見ると1文字も入らない幅で無限ループする
      if (line !== '' && measure(line + ch) > maxWidth) {
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    lines.push(line);
    // 段落ごとに ぶら下げる。段落をまたぐと \n による明示的な改行が壊れるため
    out.push(...hangPunctuation(lines));
  }
  return out;
}

/** 折り返した行を maxLines 行ずつのページに切る */
export function splitPages(
  text: string,
  measure: Measure,
  maxWidth: number,
  maxLines: number,
): string[][] {
  if (maxLines <= 0) {
    throw new Error('maxLines must be positive');
  }
  const wrapped = wrapText(text, measure, maxWidth);
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += maxLines) {
    pages.push(wrapped.slice(i, i + maxLines));
  }
  return pages.length > 0 ? pages : [['']];
}

/** 文字送りの速さ。読者設定は持たないのでエンジン側の定数 */
export const TALK_CHARS_PER_SEC = 30;

export type TalkState = {
  lines: TalkLine[];
  /** 今どの行か */
  index: number;
  /** 今の行を「ページ × 表示行」に割ったもの */
  pages: string[][];
  /** 今どのページか */
  page: number;
  /** そのページの先頭から何文字表示したか。小数を持つので描画側で floor する */
  shown: number;
  done: boolean;
};

function pageLength(page: string[]): number {
  return page.reduce((n, line) => n + line.length, 0);
}

function currentPage(state: TalkState): string[] {
  return state.pages[state.page] ?? [];
}

export function makeTalkState(
  lines: TalkLine[],
  measure: Measure,
  maxWidth: number,
  maxLines: number,
): TalkState {
  const first = lines[0];
  return {
    lines,
    index: 0,
    pages: first ? splitPages(first.text, measure, maxWidth, maxLines) : [['']],
    page: 0,
    shown: 0,
    done: lines.length === 0,
  };
}

export function tickTalk(state: TalkState, dt: number): void {
  if (state.done) return;
  state.shown = Math.min(pageLength(currentPage(state)), state.shown + TALK_CHARS_PER_SEC * dt);
}

export function isPageComplete(state: TalkState): boolean {
  return Math.floor(state.shown) >= pageLength(currentPage(state));
}

/** 今表示すべき行。文字送りの途中なら途中まで切って返す */
export function visibleLines(state: TalkState): string[] {
  let remain = Math.floor(state.shown);
  return currentPage(state).map((line) => {
    const take = Math.max(0, Math.min(line.length, remain));
    remain -= line.length;
    return line.slice(0, take);
  });
}

export function pageCount(state: TalkState): number {
  return state.pages.length;
}

export function currentSpeaker(state: TalkState): string | null {
  return state.lines[state.index]?.speaker ?? null;
}

/**
 * タップ1回ぶん進める。
 * 送りの途中なら全文表示 → 次のページ → 次の行 → done、の順に落ちる。
 */
export function advanceTalk(
  state: TalkState,
  measure: Measure,
  maxWidth: number,
  maxLines: number,
): void {
  if (state.done) return;

  if (!isPageComplete(state)) {
    state.shown = pageLength(currentPage(state));
    return;
  }
  if (state.page + 1 < state.pages.length) {
    state.page += 1;
    state.shown = 0;
    return;
  }
  const next = state.lines[state.index + 1];
  if (next) {
    state.index += 1;
    state.pages = splitPages(next.text, measure, maxWidth, maxLines);
    state.page = 0;
    state.shown = 0;
    return;
  }
  state.done = true;
}

export function skipTalk(state: TalkState): void {
  state.done = true;
}
