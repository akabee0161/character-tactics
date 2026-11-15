import { describe, expect, it } from 'vitest';
import { activeBuffs } from './buff-marks';

const u = (cheerUntil: number, wardUntil: number) => ({ cheerUntil, wardUntil });

describe('activeBuffs', () => {
  it('効いている間だけ true。期限の時刻ちょうどで切れる', () => {
    expect(activeBuffs(u(10, 0), 9.9)).toEqual({ cheer: true, ward: false });
    expect(activeBuffs(u(10, 0), 10)).toEqual({ cheer: false, ward: false });
    expect(activeBuffs(u(0, 12), 3)).toEqual({ cheer: false, ward: true });
    expect(activeBuffs(u(10, 12), 3)).toEqual({ cheer: true, ward: true });
  });
});
