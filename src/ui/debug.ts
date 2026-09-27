/** ?debug のときだけ使う、シム時間の進め方 */
export type DebugClock = { paused: boolean; slow: boolean; stepQueued: boolean };

/** S で切り替える速さ */
export const SLOW_FACTOR = 0.25;

export function isDebugMode(search: string): boolean {
  return new URLSearchParams(search).has('debug');
}

export function makeDebugClock(): DebugClock {
  return { paused: false, slow: false, stepQueued: false };
}

/**
 * キー1つぶんの操作。知らないキーなら false を返す（呼び出し側は preventDefault しない）。
 * repeat は押しっぱなしの自動リピート。P と S は切り替えなので、リピートでは何もしない
 */
export function debugKey(clock: DebugClock, key: string, repeat = false): boolean {
  switch (key) {
    case 'p':
    case 'P':
      if (repeat) return true;
      clock.paused = !clock.paused;
      clock.stepQueued = false;
      return true;
    case 's':
    case 'S':
      if (repeat) return true;
      clock.slow = !clock.slow;
      return true;
    case '.':
      if (clock.paused) clock.stepQueued = true;
      return true;
    default:
      return false;
  }
}

/**
 * 実時間の経過 dt を、シムに渡す時間へ変換する。
 * 一時停止中は 0。ただし1ステップ送りが積まれていれば fixedDt をちょうど1回返す
 */
export function simDt(clock: DebugClock, dt: number, fixedDt: number): number {
  if (clock.paused) {
    if (!clock.stepQueued) return 0;
    clock.stepQueued = false;
    return fixedDt;
  }
  return clock.slow ? dt * SLOW_FACTOR : dt;
}

export function debugLabel(clock: DebugClock): string {
  if (clock.paused) return 'PAUSE';
  return clock.slow ? 'x1/4' : 'x1';
}
