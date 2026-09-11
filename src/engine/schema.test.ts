import { describe, expect, it } from 'vitest';
import {
  validateBondsFile, validateEnemyDef, validateGrowthFile, validateLinesFile, validateSkillsFile,
  validateStageDef, validateTitlesFile, validateUnitDef,
} from './schema';

const VALID_UNIT = {
  id: 'roran', name: 'ロラン', role: 'たて',
  combat: true,
  maxHp: 30, power: 6, guard: 5,
  attack: 'melee', range: 24,
  attackInterval: 1.6, speed: 60,
  skillId: 'funbaru',
  color: '#4a80c8',
};

const VALID_ENEMY = {
  ...VALID_UNIT,
  id: 'garum', name: 'ガルム', role: 'てき',
  skillId: null,
  xpReward: 8, bowDamageCap: null, fleeAtHpRatio: 0.3,
};

describe('validateUnitDef', () => {
  it('正しい定義を受け入れる', () => {
    const r = validateUnitDef('units/roran.json', VALID_UNIT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.id).toBe('roran');
  });

  it('skillId は null を許す', () => {
    const r = validateUnitDef('units/npc.json', { ...VALID_UNIT, skillId: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.skillId).toBeNull();
  });

  it('欠けたフィールドを、ファイル名とフィールド名と理由つきで弾く', () => {
    const { maxHp: _drop, ...missing } = VALID_UNIT;
    const r = validateUnitDef('units/roran.json', missing);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual({
        file: 'units/roran.json', path: 'maxHp', reason: 'かずが ひつよう',
      });
    }
  });

  it('負の maxHp を弾く', () => {
    const r = validateUnitDef('units/roran.json', { ...VALID_UNIT, maxHp: -1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('maxHp');
  });

  it('未知の attack を弾き、許される値を理由に含める', () => {
    const r = validateUnitDef('units/roran.json', { ...VALID_UNIT, attack: 'fire' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.reason).toContain('melee');
  });

  it('attack に magic を かける', () => {
    const r = validateUnitDef('units/roran.json', { ...VALID_UNIT, attack: 'magic' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.attack).toBe('magic');
  });

  it('エラーは1つ目で打ち切らず、すべて集める', () => {
    const r = validateUnitDef('units/bad.json', { ...VALID_UNIT, maxHp: 'x', power: 'y' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.path).sort()).toEqual(['maxHp', 'power']);
  });

  it('オブジェクトでない入力を弾く', () => {
    const r = validateUnitDef('units/bad.json', [1, 2, 3]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('');
  });

  it('sprites を しょうりゃくすると すべて null に なる', () => {
    const r = validateUnitDef('assets/units/roran.json', VALID_UNIT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.sprites).toEqual({ role: null, face: null, map: null });
  });

  it('sprites に ファイルめいを かける', () => {
    const r = validateUnitDef('assets/units/roran.json', {
      ...VALID_UNIT, sprites: { role: 'tate.png', face: 'roran-face.png', map: null },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.sprites).toEqual({ role: 'tate.png', face: 'roran-face.png', map: null });
  });

  it('sprites の あたいが もじれつでも null でも ないと エラー', () => {
    const r = validateUnitDef('assets/units/roran.json', { ...VALID_UNIT, sprites: { role: 3 } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]?.path).toBe('sprites.role');
  });
});

const SHEET = {
  sheet: 'roran-map.png', frame: 32,
  idle: { frames: 2, fps: 4 },
  walk: { frames: 4, fps: 8 },
  attack: { frames: 3, fps: 12 },
};

describe('sprites.map の シート', () => {
  it('シートを かくと そのまま よめる', () => {
    const r = validateUnitDef('assets/units/roran.json', { ...VALID_UNIT, sprites: { map: SHEET } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.sprites.map).toEqual(SHEET);
  });

  it('null なら null の まま', () => {
    const r = validateUnitDef('assets/units/roran.json', { ...VALID_UNIT, sprites: { map: null } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.sprites.map).toBe(null);
  });

  it('もじれつは うけつけない', () => {
    const r = validateUnitDef('assets/units/roran.json', { ...VALID_UNIT, sprites: { map: 'roran.png' } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]?.path).toBe('sprites.map');
  });

  it('frames が 0 なら エラー', () => {
    const r = validateUnitDef('assets/units/roran.json', {
      ...VALID_UNIT, sprites: { map: { ...SHEET, walk: { frames: 0, fps: 8 } } },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.path === 'sprites.map.walk.frames')).toBe(true);
  });

  it('frame が かけていると エラー', () => {
    const { frame, ...noFrame } = SHEET;
    const r = validateUnitDef('assets/units/roran.json', { ...VALID_UNIT, sprites: { map: noFrame } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.path === 'sprites.map.frame')).toBe(true);
  });
});

describe('validateEnemyDef', () => {
  it('正しい定義を受け入れる', () => {
    const r = validateEnemyDef('enemies/garum.json', VALID_ENEMY);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.fleeAtHpRatio).toBe(0.3);
  });

  it('bowDamageCap と fleeAtHpRatio は null を許す', () => {
    const r = validateEnemyDef('enemies/x.json', {
      ...VALID_ENEMY, bowDamageCap: null, fleeAtHpRatio: null,
    });
    expect(r.ok).toBe(true);
  });

  it('fleeAtHpRatio が 1 を超えたら弾く', () => {
    const r = validateEnemyDef('enemies/x.json', { ...VALID_ENEMY, fleeAtHpRatio: 1.5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('fleeAtHpRatio');
  });

  it('xpReward が欠けたら弾く', () => {
    const { xpReward: _drop, ...missing } = VALID_ENEMY;
    const r = validateEnemyDef('enemies/x.json', missing);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('xpReward');
  });
});

describe('validateSkillsFile', () => {
  it('id と label と params を読む', () => {
    const r = validateSkillsFile('skills.json', [
      { id: 'funbaru', label: 'ふんばる', params: { duration: 5 } },
      { id: 'neraiuchi', label: 'ねらいうち', params: {} },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value[0]?.params.duration).toBe(5);
  });

  it('params の値が数でなければ、その キーを path に含めて弾く', () => {
    const r = validateSkillsFile('skills.json', [
      { id: 'funbaru', label: 'ふんばる', params: { duration: 'ごびょう' } },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('[0].params.duration');
  });

  it('id が重複したら弾く', () => {
    const r = validateSkillsFile('skills.json', [
      { id: 'funbaru', label: 'ふんばる', params: {} },
      { id: 'funbaru', label: 'べつ', params: {} },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.reason).toContain('じゅうふく');
  });

  it('はいれつでなければ弾く', () => {
    const r = validateSkillsFile('skills.json', { funbaru: {} });
    expect(r.ok).toBe(false);
  });
});

describe('validateBondsFile', () => {
  it('正しい絆を受け入れる', () => {
    const r = validateBondsFile('bonds.json', [{ a: 'roran', b: 'ines', bonus: 2 }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value[0]?.bonus).toBe(2);
  });

  it('bonus が 0 以下なら弾く', () => {
    const r = validateBondsFile('bonds.json', [{ a: 'roran', b: 'ines', bonus: 0 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('[0].bonus');
  });

  it('自分自身との絆を弾く', () => {
    const r = validateBondsFile('bonds.json', [{ a: 'roran', b: 'roran', bonus: 2 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.reason).toContain('じぶん');
  });
});

describe('validateTitlesFile', () => {
  it('owner に null を許す', () => {
    const r = validateTitlesFile('titles.json', [
      { id: 'nakayoshi', label: 'なかよし', owner: null, counter: 'bond:supports', threshold: 20 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value[0]?.owner).toBeNull();
  });

  it('threshold が 1 未満なら弾く', () => {
    const r = validateTitlesFile('titles.json', [
      { id: 'x', label: 'エックス', owner: null, counter: 'bond:supports', threshold: 0 },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('[0].threshold');
  });
});

describe('validateLinesFile', () => {
  it('もじれつの じしょを 受け入れる', () => {
    const r = validateLinesFile('lines/common.json', { 'skill:roran': 'ここは とおさない！' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value['skill:roran']).toBe('ここは とおさない！');
  });

  it('あたいが もじれつでなければ、その キーを path にして弾く', () => {
    const r = validateLinesFile('lines/common.json', { 'skill:roran': 42 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('skill:roran');
  });
});

const VALID_STAGE = {
  id: 'stage1',
  order: 10,
  name: 'はじまりの しま',
  cell: 32,
  mapRows: ['####', '#..#', '#..#', '####'],
  placement: { minY: 64, starts: [{ x: 48, y: 80 }] },
  roster: ['roran', 'ines'],
  enemies: [{ defId: 'narazumono', pos: { x: 80, y: 48 }, ai: { kind: 'aggressive' } }],
  victory: { type: 'reach', pos: { x: 80, y: 80 }, radius: 24, by: 'any' },
  defeat: [{ type: 'unitLost', defIds: ['roran'] }],
};

describe('validateStageDef', () => {
  it('正しいステージを受け入れる', () => {
    const r = validateStageDef('stages/stage1.json', VALID_STAGE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.roster).toEqual(['roran', 'ines']);
  });

  it('intro は省略できる', () => {
    const r = validateStageDef('stages/stage1.json', VALID_STAGE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.intro).toBeUndefined();
  });

  it('mapRows の行の長さが そろっていなければ弾く', () => {
    const r = validateStageDef('stages/x.json', { ...VALID_STAGE, mapRows: ['####', '#..'] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('mapRows[1]');
  });

  it('mapRows に . と # 以外の文字があれば弾く', () => {
    const r = validateStageDef('stages/x.json', { ...VALID_STAGE, mapRows: ['####', '#x.#', '#..#', '####'] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.reason).toContain('#');
  });

  it('roster が からなら弾く', () => {
    const r = validateStageDef('stages/x.json', { ...VALID_STAGE, roster: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('roster');
  });

  it('placement.starts が からなら弾く', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE, placement: { minY: 0, starts: [] },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('placement.starts');
  });

  it('order が ないと 弾く', () => {
    const { order: _drop, ...missing } = VALID_STAGE;
    const r = validateStageDef('stages/x.json', missing);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual({
        file: 'stages/x.json', path: 'order', reason: 'かずが ひつよう',
      });
    }
  });

  it('order は せいすうでないと 弾く', () => {
    const r = validateStageDef('stages/x.json', { ...VALID_STAGE, order: 1.5 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual({
        file: 'stages/x.json', path: 'order', reason: 'せいすうが ひつよう',
      });
    }
  });

  it('未知の ai.kind を弾く', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE,
      enemies: [{ defId: 'x', pos: { x: 48, y: 48 }, ai: { kind: 'ambush' } }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('enemies[0].ai.kind');
  });

  it('placement.starts が かべの なかなら弾く', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE,
      placement: { minY: 0, starts: [{ x: 0, y: 0 }] },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('placement.starts[0]');
  });

  it('enemies の pos が マップの そとなら弾く', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE,
      enemies: [{ defId: 'x', pos: { x: 999, y: 999 }, ai: { kind: 'aggressive' } }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('enemies[0].pos');
  });

  it('guard の post が かべの なかなら弾く', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE,
      enemies: [{
        defId: 'x', pos: { x: 48, y: 48 },
        ai: { kind: 'guard', post: { x: 0, y: 0 }, leash: 120, sightRange: 100 },
      }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('enemies[0].ai.post');
  });

  it('sentry には sightRange が いる', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE,
      enemies: [{ defId: 'x', pos: { x: 48, y: 48 }, ai: { kind: 'sentry' } }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('enemies[0].ai.sightRange');
  });

  it('guard の post と leash を読む', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE,
      enemies: [{
        defId: 'x', pos: { x: 48, y: 48 },
        ai: { kind: 'guard', post: { x: 64, y: 64 }, leash: 120, sightRange: 100 },
      }],
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.value.enemies[0]?.ai.kind === 'guard') {
      expect(r.value.enemies[0].ai.leash).toBe(120);
    }
  });

  it('aggressive は sightRange を持たない', () => {
    const r = validateStageDef('stages/x.json', VALID_STAGE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.enemies[0]?.ai).toEqual({ kind: 'aggressive' });
  });

  it('未知の victory.type を弾く', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE, victory: { type: 'annihilate' },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('victory.type');
  });

  it('defeat が からなら弾く（敗北しないステージは作れない）', () => {
    const r = validateStageDef('stages/x.json', { ...VALID_STAGE, defeat: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('defeat');
  });

  it('allPlayerUnitsLost は追加のフィールドを要らない', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE, defeat: [{ type: 'allPlayerUnitsLost' }],
    });
    expect(r.ok).toBe(true);
  });

  it('intro があれば speaker と lineId を読む', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE, intro: [{ speaker: 'roran', lineId: 'stage:stage1:roran' }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.intro?.[0]?.speaker).toBe('roran');
  });

  it('intro の speaker は はぶける（地の文）', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE, intro: [{ text: 'みちの さきに、けむりが みえる。' }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.intro![0]).toEqual({ speaker: null, text: 'みちの さきに、けむりが みえる。', lineId: null });
  });

  it('intro の speaker は あきらかに null と かいても 地の文', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE, intro: [{ speaker: null, text: 'みちの さきに、けむりが みえる。' }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.intro![0]).toEqual({ speaker: null, text: 'みちの さきに、けむりが みえる。', lineId: null });
  });

  it('intro に text を ちょくせつ かける', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE, intro: [{ speaker: 'roran', text: 'いくよ' }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.intro![0]!.text).toBe('いくよ');
  });

  it('intro の text と lineId を りょうほう かくと 弾く', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE, intro: [{ speaker: 'roran', text: 'いくよ', lineId: 'a' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual({
        file: 'stages/x.json', path: 'intro[0]',
        reason: 'text と lineId は どちらか いっぽうだけ',
      });
    }
  });

  it('intro に text も lineId も ないと 弾く', () => {
    const r = validateStageDef('stages/x.json', { ...VALID_STAGE, intro: [{ speaker: 'roran' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual({
        file: 'stages/x.json', path: 'intro[0]',
        reason: 'text か lineId の どちらかが ひつよう',
      });
    }
  });

  it('outro を かける', () => {
    const r = validateStageDef('assets/stages/stage1.json', { ...VALID_STAGE, outro: [{ text: 'おわり' }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.outro).toEqual([{ speaker: null, text: 'おわり', lineId: null }]);
  });

  it('outro でも text と lineId の りょうほうは かけない', () => {
    const r = validateStageDef('assets/stages/stage1.json', {
      ...VALID_STAGE, outro: [{ text: 'あ', lineId: 'い' }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.path === 'outro[0]')).toBe(true);
  });
});

/** 検証を通る最小のステージ。引数で1フィールドだけ差し替える */
function stageRaw(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 't', order: 10, name: 'T', cell: 32,
    mapRows: ['###', '#.#', '#.#', '###'],
    placement: { minY: 64, starts: [{ x: 48, y: 80 }] },
    roster: ['roran'],
    enemies: [],
    victory: { type: 'reach', pos: { x: 48, y: 48 }, radius: 10, by: 'any' },
    defeat: [{ type: 'allPlayerUnitsLost' }],
    ...over,
  };
}

describe('validateStageDef: spawners', () => {
  it('書かなければ空配列', () => {
    const r = validateStageDef('assets/stages/t.json', stageRaw());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.spawners).toEqual([]);
  });

  it('読める', () => {
    const raw = stageRaw({
      spawners: [{ defId: 'narazumono', pos: { x: 48, y: 48 }, firstAfter: 5, every: 10, total: 2 }],
    });
    const r = validateStageDef('assets/stages/t.json', raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.spawners[0]!.total).toBe(2);
  });

  it('歩けないマスはエラー', () => {
    const raw = stageRaw({
      spawners: [{ defId: 'narazumono', pos: { x: 0, y: 0 }, firstAfter: 5, every: 10, total: 2 }],
    });
    expect(validateStageDef('assets/stages/t.json', raw).ok).toBe(false);
  });

  it('total が 0 以下はエラー', () => {
    const raw = stageRaw({
      spawners: [{ defId: 'narazumono', pos: { x: 48, y: 48 }, firstAfter: 5, every: 10, total: 0 }],
    });
    expect(validateStageDef('assets/stages/t.json', raw).ok).toBe(false);
  });
});

describe('validateStageDef: placement', () => {
  it('minY と starts を読む', () => {
    const r = validateStageDef('assets/stages/t.json', stageRaw());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.placement).toEqual({ minY: 64, starts: [{ x: 48, y: 80 }] });
  });

  it('starts が minY より上だとエラー', () => {
    const raw = stageRaw({ placement: { minY: 48, starts: [{ x: 48, y: 32 }] } });
    const r = validateStageDef('assets/stages/t.json', raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.path === 'placement.starts[0]')).toBe(true);
  });

  it('starts が空だとエラー', () => {
    const r = validateStageDef('assets/stages/t.json', stageRaw({ placement: { minY: 32, starts: [] } }));
    expect(r.ok).toBe(false);
  });

  it('placement が無いとエラー', () => {
    const raw = stageRaw();
    delete (raw as Record<string, unknown>).placement;
    expect(validateStageDef('assets/stages/t.json', raw).ok).toBe(false);
  });
});

describe('validateStageDef: 敵は配置範囲より上', () => {
  it('敵が minY より下だとエラー', () => {
    const raw = stageRaw({
      enemies: [{ defId: 'narazumono', pos: { x: 48, y: 80 }, ai: { kind: 'aggressive' } }],
    });
    const r = validateStageDef('assets/stages/t.json', raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.path === 'enemies[0].pos')).toBe(true);
  });

  it('敵が minY ちょうどでもエラー（線上は配置できる側）', () => {
    const raw = stageRaw({
      enemies: [{ defId: 'narazumono', pos: { x: 48, y: 64 }, ai: { kind: 'aggressive' } }],
    });
    expect(validateStageDef('assets/stages/t.json', raw).ok).toBe(false);
  });

  it('敵が minY より上なら通る', () => {
    const raw = stageRaw({
      enemies: [{ defId: 'narazumono', pos: { x: 48, y: 48 }, ai: { kind: 'aggressive' } }],
    });
    expect(validateStageDef('assets/stages/t.json', raw).ok).toBe(true);
  });

  it('時間湧きが minY より下だとエラー', () => {
    const raw = stageRaw({
      spawners: [{ defId: 'narazumono', pos: { x: 48, y: 80 }, firstAfter: 5, every: 10, total: 2 }],
    });
    const r = validateStageDef('assets/stages/t.json', raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.path === 'spawners[0].pos')).toBe(true);
  });

  it('placement 自体が無いときは、敵の位置では弾かない', () => {
    const raw = stageRaw({
      enemies: [{ defId: 'narazumono', pos: { x: 48, y: 80 }, ai: { kind: 'aggressive' } }],
    });
    delete (raw as Record<string, unknown>).placement;
    const r = validateStageDef('assets/stages/t.json', raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.every((e) => !e.path.startsWith('enemies['))).toBe(true);
  });

  it('placement.minY が欠けているときは、敵の位置では弾かない（フォールバック0による誤検出を防ぐ）', () => {
    const raw = stageRaw({
      placement: { starts: [{ x: 48, y: 80 }] },
      enemies: [{ defId: 'narazumono', pos: { x: 48, y: 48 }, ai: { kind: 'aggressive' } }],
    });
    const r = validateStageDef('assets/stages/t.json', raw);
    expect(r.ok).toBe(false); // minY 自体が無いのでステージとしては不正
    if (!r.ok) expect(r.errors.every((e) => !e.path.startsWith('enemies['))).toBe(true);
  });

  it('placement.minY が数値でないときは、敵の位置では弾かない', () => {
    const raw = stageRaw({
      placement: { minY: 'abc', starts: [{ x: 48, y: 80 }] },
      enemies: [{ defId: 'narazumono', pos: { x: 48, y: 48 }, ai: { kind: 'aggressive' } }],
    });
    const r = validateStageDef('assets/stages/t.json', raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.every((e) => !e.path.startsWith('enemies['))).toBe(true);
  });

  it('placement.minY が範囲外のときは、敵の位置では弾かない', () => {
    const raw = stageRaw({
      placement: { minY: 200, starts: [{ x: 48, y: 80 }] },
      enemies: [{ defId: 'narazumono', pos: { x: 48, y: 48 }, ai: { kind: 'aggressive' } }],
    });
    const r = validateStageDef('assets/stages/t.json', raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.every((e) => !e.path.startsWith('enemies['))).toBe(true);
  });
});

describe('validateGrowthFile', () => {
  const raw = () => ({
    maxLevel: 12, xpPerLevel: 12, hpPerLevel: 1, levelsPerPower: 3,
    hitXp: 1, healXp: 1, assistRatio: 0.5, clearXp: 10,
  });

  it('正しい形を読む', () => {
    const r = validateGrowthFile('assets/growth.json', raw());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(raw());
  });

  it('maxLevel が 0 以下はエラー', () => {
    expect(validateGrowthFile('assets/growth.json', { ...raw(), maxLevel: 0 }).ok).toBe(false);
  });

  it('hitXp が小数はエラー（経験値が小数になるとリザルトに出てしまう）', () => {
    expect(validateGrowthFile('assets/growth.json', { ...raw(), hitXp: 0.5 }).ok).toBe(false);
  });

  it('assistRatio が 1 を超えるとエラー', () => {
    expect(validateGrowthFile('assets/growth.json', { ...raw(), assistRatio: 1.5 }).ok).toBe(false);
  });

  it('フィールドが欠けているとエラー', () => {
    const o: Record<string, unknown> = raw();
    delete o.clearXp;
    expect(validateGrowthFile('assets/growth.json', o).ok).toBe(false);
  });
});
