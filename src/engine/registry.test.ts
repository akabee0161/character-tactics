import { describe, expect, it } from 'vitest';
import { buildRegistry, lookupDef, skillParam } from './registry';

const UNIT = {
  id: 'roran', name: 'ロラン', role: 'たて', combat: true,
  maxHp: 30, power: 6, guard: 5, attack: 'melee', range: 24,
  attackInterval: 1.6, speed: 60, skillId: 'funbaru', color: '#4a80c8',
};
const ENEMY = {
  id: 'narazumono', name: 'ならずもの', role: 'てき', combat: true,
  maxHp: 12, power: 5, guard: 1, attack: 'melee', range: 24,
  attackInterval: 1.6, speed: 45, skillId: null, color: '#8a5a4a',
  xpReward: 5, bowDamageCap: null, fleeAtHpRatio: null,
};
// bonds.json のデフォルトフィクスチャが roran との きずなを持つため、
// もう1人のユニットとして定義しておく（ブリーフのフィクスチャ不足を補うためのローカルな追加）
const INES = {
  id: 'ines', name: 'イネス', role: 'ゆみ', combat: true,
  maxHp: 20, power: 4, guard: 2, attack: 'bow', range: 120,
  attackInterval: 1.2, speed: 50, skillId: null, color: '#c8a04a',
};
const STAGE = {
  id: 'stage1', name: 'はじまりの しま', cell: 32,
  mapRows: ['####', '#..#', '#..#', '####'],
  placementZone: [{ pos: { x: 48, y: 48 } }],
  roster: ['roran'],
  enemies: [{ defId: 'narazumono', pos: { x: 80, y: 80 }, ai: { kind: 'aggressive' } }],
  victory: { type: 'reach', pos: { x: 80, y: 80 }, radius: 24, by: 'any' },
  defeat: [{ type: 'unitLost', defIds: ['roran'] }],
};

function files(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    'assets/units/roran.json': UNIT,
    'assets/units/ines.json': INES,
    'assets/enemies/narazumono.json': ENEMY,
    'assets/stages/stage1.json': STAGE,
    'assets/skills.json': [{ id: 'funbaru', label: 'ふんばる', params: { duration: 5 } }],
    'assets/bonds.json': [{ a: 'roran', b: 'ines', bonus: 2 }],
    'assets/titles.json': [
      { id: 'nakayoshi', label: 'なかよし', owner: null, counter: 'bond:supports', threshold: 20 },
    ],
    'assets/lines/common.json': { 'skill:roran': 'ここは とおさない！' },
    ...over,
  };
}

const KNOWN_SKILLS = ['funbaru'];

describe('buildRegistry', () => {
  it('そろった アセットから レジストリを つくる', () => {
    const r = buildRegistry(files(), KNOWN_SKILLS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.units.get('roran')?.name).toBe('ロラン');
    expect(r.value.enemies.get('narazumono')?.xpReward).toBe(5);
    expect(r.value.stages.map((s) => s.id)).toEqual(['stage1']);
    expect(r.value.lines.get('skill:roran')).toBe('ここは とおさない！');
  });

  it('ステージは パスの じしょじゅんに ならぶ', () => {
    const r = buildRegistry(files({
      'assets/stages/stage2.json': { ...STAGE, id: 'stage2' },
      'assets/stages/stage0.json': { ...STAGE, id: 'stage0' },
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.stages.map((s) => s.id)).toEqual(['stage0', 'stage1', 'stage2']);
  });

  it('複数の lines ファイルを1つに まとめる', () => {
    const r = buildRegistry(files({
      'assets/lines/stage1.json': { 'stage:stage1:roran': 'いくよ' },
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.lines.get('skill:roran')).toBeDefined();
      expect(r.value.lines.get('stage:stage1:roran')).toBe('いくよ');
    }
  });

  it('ファイル名と id が ちがう ステージを弾く', () => {
    const r = buildRegistry(files({
      'assets/stages/stage1.json': { ...STAGE, id: 'chigau' },
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.reason).toContain('ファイルめい');
  });

  it('存在しない skillId を指す ユニットを弾く', () => {
    const r = buildRegistry(files({
      'assets/units/roran.json': { ...UNIT, skillId: 'sonzaishinai' },
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]).toEqual({
        file: 'assets/units/roran.json',
        path: 'skillId',
        reason: 'skills.json に ない id: sonzaishinai',
      });
    }
  });

  it('実装のない skillId を skills.json に書いたら弾く', () => {
    const r = buildRegistry(files({
      'assets/skills.json': [
        { id: 'funbaru', label: 'ふんばる', params: { duration: 5 } },
        { id: 'mihitsugen', label: 'みじっそう', params: {} },
      ],
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.reason).toContain('こうかの じっそうが ない');
  });

  it('存在しない defId を roster に書いたら弾く', () => {
    const r = buildRegistry(files({
      'assets/stages/stage1.json': { ...STAGE, roster: ['roran', 'yuurei'] },
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('roster[1]');
  });

  it('存在しない defId を敵の配置に書いたら弾く', () => {
    const r = buildRegistry(files({
      'assets/stages/stage1.json': {
        ...STAGE,
        enemies: [{ defId: 'yuurei', pos: { x: 80, y: 80 }, ai: { kind: 'aggressive' } }],
      },
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('enemies[0].defId');
  });

  it('victory.by が roster にいない ユニットなら弾く', () => {
    const r = buildRegistry(files({
      'assets/stages/stage1.json': {
        ...STAGE, victory: { ...STAGE.victory, by: 'ines' },
      },
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('victory.by');
  });

  it('defeat の defIds が roster にいなければ弾く', () => {
    const r = buildRegistry(files({
      'assets/stages/stage1.json': {
        ...STAGE, defeat: [{ type: 'unitLost', defIds: ['ines'] }],
      },
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('defeat[0].defIds[0]');
  });

  it('存在しない lineId を intro に書いたら弾く', () => {
    const r = buildRegistry(files({
      'assets/stages/stage1.json': {
        ...STAGE, intro: [{ speaker: 'roran', lineId: 'nai:line' }],
      },
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('intro[0].lineId');
  });

  it('titles.json の owner が存在しない ユニットなら弾く', () => {
    const r = buildRegistry(files({
      'assets/titles.json': [
        { id: 'x', label: 'エックス', owner: 'yuurei', counter: 'bond:supports', threshold: 1 },
      ],
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('[0].owner');
  });

  it('bonds.json が存在しない ユニットを指していたら弾く', () => {
    const r = buildRegistry(files({
      'assets/bonds.json': [{ a: 'roran', b: 'yuurei', bonus: 2 }],
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('[0].b');
  });

  it('ステージが1つも なければ弾く', () => {
    const f = files();
    delete f['assets/stages/stage1.json'];
    const r = buildRegistry(f, KNOWN_SKILLS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.reason).toContain('ステージ');
  });

  it('形の エラーが あるときは 相互さんしょうを 見ない（レジストリが 未完成なため）', () => {
    const r = buildRegistry(files({
      'assets/units/roran.json': { ...UNIT, maxHp: 'ダメ' },
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.every((e) => e.file === 'assets/units/roran.json')).toBe(true);
  });
});

describe('lookupDef', () => {
  it('味方でも敵でも 引ける', () => {
    const r = buildRegistry(files(), KNOWN_SKILLS);
    if (!r.ok) throw new Error('レジストリの こうちくに しっぱい');
    expect(lookupDef(r.value, 'roran')?.name).toBe('ロラン');
    expect(lookupDef(r.value, 'narazumono')?.name).toBe('ならずもの');
    expect(lookupDef(r.value, 'yuurei')).toBeNull();
  });
});

describe('skillParam', () => {
  it('あれば その あたい、なければ ふぉーるばっく', () => {
    const r = buildRegistry(files(), KNOWN_SKILLS);
    if (!r.ok) throw new Error('レジストリの こうちくに しっぱい');
    expect(skillParam(r.value, 'funbaru', 'duration', 99)).toBe(5);
    expect(skillParam(r.value, 'funbaru', 'nai', 99)).toBe(99);
    expect(skillParam(r.value, 'nai', 'duration', 99)).toBe(99);
  });
});
