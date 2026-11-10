import { describe, expect, it } from 'vitest';
import { testRegistry } from '../core/testing';
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
// bonds.json のデフォルトフィクスチャが roran との絆を持つため、
// もう1人のユニットとして定義しておく（ブリーフのフィクスチャ不足を補うためのローカルな追加）
const INES = {
  id: 'ines', name: 'イネス', role: 'ゆみ', combat: true,
  maxHp: 20, power: 4, guard: 2, attack: 'bow', range: 120,
  attackInterval: 1.2, speed: 50, skillId: null, color: '#c8a04a',
};
const GROWTH = {
  maxLevel: 12, xpPerLevel: 12, hpPerLevel: 1, levelsPerPower: 3,
  hitXp: 1, healXp: 1, assistRatio: 0.5, clearXp: 10,
};
const STAGE = {
  id: 'stage1', order: 10, name: 'はじまりの しま', cell: 32,
  mapRows: ['####', '#..#', '#..#', '####'],
  placement: { minY: 64, starts: [{ x: 48, y: 80 }] },
  roster: ['roran'],
  enemies: [{ defId: 'narazumono', pos: { x: 80, y: 48 }, ai: { kind: 'aggressive' } }],
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
    'assets/growth.json': GROWTH,
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
        enemies: [{ defId: 'yuurei', pos: { x: 80, y: 48 }, ai: { kind: 'aggressive' } }],
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

  it('speaker が null の 地の文は しらない はなしてとして 弾かれない', () => {
    const r = buildRegistry(files({
      'assets/stages/stage1.json': {
        ...STAGE, intro: [{ speaker: null, text: 'みちの さきに、けむりが みえる。' }],
      },
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(true);
  });

  it('lineId が null の text ちょくがきは lines に ない id として 弾かれない', () => {
    const r = buildRegistry(files({
      'assets/stages/stage1.json': {
        ...STAGE, intro: [{ speaker: 'roran', text: 'いくよ' }],
      },
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(true);
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

  it('同じ id の unitDef が 2つ あれば弾く（サイレント上書き防止）', () => {
    const r = buildRegistry(files({
      'assets/units/roran2.json': { ...UNIT },
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.reason.includes('じゅうふく'))).toBe(true);
  });

  it('同じ id の enemyDef が 2つ あれば弾く（サイレント上書き防止）', () => {
    const r = buildRegistry(files({
      'assets/enemies/narazumono2.json': { ...ENEMY },
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.reason.includes('じゅうふく'))).toBe(true);
  });

  it('複数の lines ファイルで id が かぶったら弾く（サイレント上書き防止）', () => {
    const r = buildRegistry(files({
      'assets/lines/stage1.json': { 'skill:roran': 'べつの せりふ' },
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.reason.includes('じゅうふく'))).toBe(true);
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

describe('growth', () => {
  it('assets/growth.json を読んで registry に入れる', () => {
    const reg = testRegistry();
    expect(reg.growth.maxLevel).toBe(12);
    expect(reg.growth.xpPerLevel).toBe(4);
    expect(reg.growth.assistRatio).toBe(0.5);
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

describe('ステージの ならびじゅん', () => {
  it('order の しょうじゅんに ならぶ（ファイルめいの じしょじゅんに よらない）', () => {
    const r = buildRegistry(files({
      'assets/stages/stage1.json': { ...STAGE, id: 'stage1', order: 30 },
      'assets/stages/stage10.json': { ...STAGE, id: 'stage10', order: 10 },
      'assets/stages/stage2.json': { ...STAGE, id: 'stage2', order: 20 },
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.stages.map((s) => s.id)).toEqual(['stage10', 'stage2', 'stage1']);
  });

  it('order の けつばんは ゆるす', () => {
    const r = buildRegistry(files({
      'assets/stages/stage1.json': { ...STAGE, id: 'stage1', order: 10 },
      'assets/stages/stage2.json': { ...STAGE, id: 'stage2', order: 900 },
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(true);
  });

  it('order の じゅうふくは 弾く', () => {
    const r = buildRegistry(files({
      'assets/stages/stage1.json': { ...STAGE, id: 'stage1', order: 10 },
      'assets/stages/stage2.json': { ...STAGE, id: 'stage2', order: 10 },
    }), KNOWN_SKILLS);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.path === 'order' && e.reason.includes('じゅうふく'))).toBe(true);
    }
  });
});

describe('sprites の ファイルの そんざい', () => {
  const withSprite = (sprites: Record<string, unknown>) =>
    files({ 'assets/units/roran.json': { ...UNIT, sprites } });

  it('ある ファイルめいなら とおる', () => {
    const r = buildRegistry(withSprite({ role: 'tate.png' }), KNOWN_SKILLS, ['tate.png']);
    expect(r.ok).toBe(true);
  });

  it('ない ファイルめいは エラーに なる', () => {
    const r = buildRegistry(withSprite({ role: 'nai.png' }), KNOWN_SKILLS, ['tate.png']);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]?.path).toBe('sprites.role');
    expect(r.errors[0]?.reason).toContain('nai.png');
  });

  it('null は せいじょう', () => {
    const r = buildRegistry(withSprite({ role: null, face: null, map: null }), KNOWN_SKILLS, []);
    expect(r.ok).toBe(true);
  });

  const SHEET = {
    sheet: 'roran-map.png', frame: 32,
    idle: { frames: 2, fps: 4 }, walk: { frames: 4, fps: 8 }, attack: { frames: 3, fps: 12 },
  };

  it('ある シートなら とおる', () => {
    const r = buildRegistry(withSprite({ map: SHEET }), KNOWN_SKILLS, ['roran-map.png']);
    expect(r.ok).toBe(true);
  });

  it('ない シートは エラーに なる', () => {
    const r = buildRegistry(withSprite({ map: { ...SHEET, sheet: 'nai.png' } }), KNOWN_SKILLS, ['roran-map.png']);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]?.path).toBe('sprites.map.sheet');
    expect(r.errors[0]?.reason).toContain('nai.png');
  });
});

describe('legend の タイルの そんざい', () => {
  const withLegend = () => files({
    'assets/stages/stage1.json': {
      ...STAGE,
      mapRows: ['TTTT', 'T..T', 'T..T', 'TTTT'],
      legend: { '.': { tile: null, walkable: true }, T: { tile: 'tile-tree.png', walkable: false } },
    },
  });

  it('assets/images に ない タイルを弾く', () => {
    const r = buildRegistry(withLegend(), KNOWN_SKILLS, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('legend.T.tile');
  });

  it('ある タイルなら通る', () => {
    const r = buildRegistry(withLegend(), KNOWN_SKILLS, ['tile-tree.png']);
    expect(r.ok).toBe(true);
  });
});

describe('本文の {id} の置き換え', () => {
  it('lines の {id} を名前にする', () => {
    const r = buildRegistry(files({ 'assets/lines/common.json': { x: '{roran}が 来た' } }), KNOWN_SKILLS);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.lines.get('x')).toBe('ロランが 来た');
  });

  it('知らない id は エラー', () => {
    const r = buildRegistry(files({ 'assets/lines/common.json': { x: '{nobody}が 来た' } }), KNOWN_SKILLS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.reason).toBe('しらない なまえの id: nobody');
  });

  it('intro と outro の text を名前にする', () => {
    const r = buildRegistry(
      files({
        'assets/stages/stage1.json': {
          ...STAGE,
          intro: [{ speaker: null, text: '{ines}が いる' }],
          outro: [{ speaker: 'roran', text: '{roran}だ' }],
        },
      }),
      KNOWN_SKILLS,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.stages[0]?.intro?.[0]?.text).toBe('イネスが いる');
    expect(r.value.stages[0]?.outro?.[0]?.text).toBe('ロランだ');
  });

  it('敵の name の {id} を味方の名前にする', () => {
    const r = buildRegistry(
      files({ 'assets/enemies/narazumono.json': { ...ENEMY, name: '{ines}の かげ' } }),
      KNOWN_SKILLS,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.enemies.get('narazumono')?.name).toBe('イネスの かげ');
  });

  it('敵の id も {id} で引ける', () => {
    const r = buildRegistry(
      files({ 'assets/lines/common.json': { x: '{narazumono}だ' } }),
      KNOWN_SKILLS,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.lines.get('x')).toBe('ならずものだ');
  });
});

describe('実アセットのステージ', () => {
  it('10本ある', () => {
    expect(testRegistry().stages.length).toBe(10);
  });

  it('order は昇順で 重複しない', () => {
    const orders = testRegistry().stages.map((s) => s.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('ガルム戦が いちばん最後', () => {
    const stages = testRegistry().stages;
    expect(stages[stages.length - 1]!.id).toBe('stage3');
  });
});

describe('buildRegistry: joins / persuasions / villages', () => {
  const ALLY5 = { ...INES, id: 'ally05', name: 'ごにん' };
  const ALLY6 = { ...INES, id: 'ally06', name: 'ろくにん' };
  const FOE6 = { ...ENEMY, id: 'ally06-foe', name: 'ろくの てき' };
  const TALK = [{ speaker: 'roran', text: '{ally05}、よろしく' }];
  const stageWith = (extra: Record<string, unknown>, id = 'stage1', order = 10) => ({
    ...STAGE, id, order, ...extra,
  });
  const base = (extra: Record<string, unknown>, more: Record<string, unknown> = {}) =>
    buildRegistry(files({
      'assets/units/ally05.json': ALLY5,
      'assets/units/ally06.json': ALLY6,
      'assets/enemies/ally06-foe.json': FOE6,
      'assets/stages/stage1.json': stageWith(extra),
      ...more,
    }), KNOWN_SKILLS);
  const reasons = (r: ReturnType<typeof buildRegistry>) => (r.ok ? [] : r.errors.map((e) => `${e.path}: ${e.reason}`));

  it('正しく書けば通り、talk と村の text の {id} が名前になる', () => {
    const r = base({
      joins: [{ unitId: 'ally05', level: 2, talk: TALK }],
      villages: [{ id: 'v1', col: 0, row: 0, text: '{ally05}が いる', effect: { type: 'heal' } }],
    });
    expect(reasons(r)).toEqual([]);
    if (!r.ok) return;
    expect(r.value.stages[0]!.joins[0]!.talk[0]!.text).toBe('ごにん、よろしく');
    expect(r.value.stages[0]!.villages[0]!.text).toBe('ごにんが いる');
  });

  it('persuasions と recruit の村の talk の {id} も名前になる', () => {
    const r = base({
      persuasions: [{
        unitId: 'ally06', level: 1, talk: TALK, foeId: 'ally06-foe',
        pos: { x: 80, y: 48 }, ai: { kind: 'aggressive' }, persuader: 'roran',
      }],
      villages: [{ id: 'v1', col: 0, row: 0, effect: { type: 'recruit', unitId: 'ally05', level: 1, talk: TALK } }],
    });
    expect(reasons(r)).toEqual([]);
    if (!r.ok) return;
    expect(r.value.stages[0]!.persuasions[0]!.talk[0]!.text).toBe('ごにん、よろしく');
    const e = r.value.stages[0]!.villages[0]!.effect;
    expect(e.type === 'recruit' && e.recruit.talk[0]!.text).toBe('ごにん、よろしく');
  });

  it('同じ unitId を 2 か所で加えるとエラー', () => {
    const r = base({
      joins: [{ unitId: 'ally05', level: 2, talk: TALK }],
      villages: [{ id: 'v1', col: 0, row: 0, effect: { type: 'recruit', unitId: 'ally05', level: 1, talk: TALK } }],
    });
    expect(reasons(r).some((s) => s.includes('1 か所'))).toBe(true);
  });

  it('別のステージで二重に加えてもエラー', () => {
    const r = base(
      { joins: [{ unitId: 'ally05', level: 2, talk: TALK }] },
      { 'assets/stages/stage2.json': stageWith({ joins: [{ unitId: 'ally05', level: 2, talk: TALK }] }, 'stage2', 20) },
    );
    expect(r.ok).toBe(false);
  });

  it('roster にいる仲間を加えるとエラー', () => {
    const r = base({ joins: [{ unitId: 'roran', level: 2, talk: TALK }] });
    expect(reasons(r).some((s) => s.includes('roster'))).toBe(true);
  });

  it('知らない unitId・foeId・persuader・speaker がエラー', () => {
    const r = base({
      joins: [{ unitId: 'nobody', level: 1, talk: [{ speaker: 'ghost', text: 'x' }] }],
      persuasions: [{
        unitId: 'ally06', level: 1, talk: TALK, foeId: 'nofoe',
        pos: { x: 80, y: 48 }, ai: { kind: 'aggressive' }, persuader: 'noone',
      }],
    });
    const rs = reasons(r).join('\n');
    expect(rs).toContain('joins[0].unitId');
    expect(rs).toContain('joins[0].talk[0].speaker');
    expect(rs).toContain('persuasions[0].foeId');
    expect(rs).toContain('persuasions[0].persuader');
  });

  it('roster と加入しうる仲間の合計が 8 人を超えるとエラー', () => {
    const extra: Record<string, unknown> = {};
    const joins: unknown[] = [];
    for (let i = 0; i < 8; i++) {
      extra[`assets/units/x${i}.json`] = { ...INES, id: `x${i}`, name: `x${i}` };
      joins.push({ unitId: `x${i}`, level: 1, talk: TALK });
    }
    const r = base({ joins }, extra);
    expect(reasons(r).some((s) => s.includes('8'))).toBe(true);
  });
});
