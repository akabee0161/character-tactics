import { describe, expect, it } from 'vitest';
import { testRegistry } from '../core/testing';
import type { SimEvent } from '../core/types';
import {
  SLOW_PER_UNIT, SLOW_SCALE, clearFallen, currentBanner, makeFallenState, noteFallen, tickFallen, timeScale,
} from './fallen';

const reg = testRegistry();
const retired = (uid: string, defId: string): SimEvent => ({ type: 'unitRetired', uid, defId });

describe('倒れたときの順番とゆっくり', () => {
  it('仲間が倒れると帯に最期の言葉が出て、ゆっくりになる', () => {
    const s = makeFallenState();
    expect(timeScale(s)).toBe(1);
    noteFallen(s, reg, [retired('p1', 'roran')]);
    expect(currentBanner(s)).toEqual({ uid: 'p1', defId: 'roran', text: reg.lines.get('retire:roran') });
    expect(timeScale(s)).toBe(SLOW_SCALE);
    expect(SLOW_SCALE).toBe(0.3);
  });

  it('1.5 秒たつと帯が消え、速さが 1 に戻る', () => {
    const s = makeFallenState();
    noteFallen(s, reg, [retired('p1', 'roran')]);
    tickFallen(s, SLOW_PER_UNIT - 0.1);
    expect(currentBanner(s)).not.toBeNull();
    expect(timeScale(s)).toBe(SLOW_SCALE);
    tickFallen(s, 0.1);
    expect(currentBanner(s)).toBeNull();
    expect(timeScale(s)).toBe(1);
  });

  it('2 人が同じ tick に倒れると、帯は 1 人ずつ 1.5 秒ずつ出て、ゆっくりは 3 秒', () => {
    const s = makeFallenState();
    noteFallen(s, reg, [retired('p1', 'roran'), retired('p2', 'ines')]);
    expect(currentBanner(s)!.uid).toBe('p1');
    tickFallen(s, SLOW_PER_UNIT);
    expect(currentBanner(s)!.uid).toBe('p2');
    expect(timeScale(s)).toBe(SLOW_SCALE);
    tickFallen(s, SLOW_PER_UNIT);
    expect(currentBanner(s)).toBeNull();
    expect(timeScale(s)).toBe(1);
  });

  it('1 人目の帯の途中で 2 人目が倒れると、2 人目の帯は 1 人目の後に出る', () => {
    const s = makeFallenState();
    noteFallen(s, reg, [retired('p1', 'roran')]);
    tickFallen(s, 1.0);
    noteFallen(s, reg, [retired('p2', 'ines')]);
    expect(currentBanner(s)!.uid).toBe('p1');
    tickFallen(s, 0.5);
    expect(currentBanner(s)!.uid).toBe('p2');
    tickFallen(s, 1.4);
    expect(currentBanner(s)!.uid).toBe('p2');
    expect(timeScale(s)).toBe(SLOW_SCALE);
    tickFallen(s, 0.1);
    expect(currentBanner(s)).toBeNull();
    expect(timeScale(s)).toBe(1);
  });

  it('最期の言葉が無い仲間は text が null で、帯は出る', () => {
    const s = makeFallenState();
    noteFallen(s, reg, [retired('p9', 'nobody')]);
    expect(currentBanner(s)).toEqual({ uid: 'p9', defId: 'nobody', text: null });
    expect(timeScale(s)).toBe(SLOW_SCALE);
  });

  it('敵の unitDefeated では何もしない', () => {
    const s = makeFallenState();
    noteFallen(s, reg, [{
      type: 'unitDefeated', uid: 'e1', defId: 'narazumono', byUid: 'p1', byDefId: 'roran', pos: { x: 0, y: 0 },
    }]);
    expect(currentBanner(s)).toBeNull();
    expect(timeScale(s)).toBe(1);
  });

  it('clearFallen で帯もゆっくりも消える', () => {
    const s = makeFallenState();
    noteFallen(s, reg, [retired('p1', 'roran')]);
    clearFallen(s);
    expect(currentBanner(s)).toBeNull();
    expect(timeScale(s)).toBe(1);
  });
});
