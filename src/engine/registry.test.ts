import { describe, expect, it } from 'vitest';
import { testRegistry } from '../core/testing';
import { MAX_MEMBERS, MAX_PARTY } from './limits';
import { buildRegistry, lookupDef, lookupSpeaker, skillParam } from './registry';

const UNIT = {
  id: 'roran', name: 'ロラン', role: 'たて', combat: true,
  maxHp: 30, power: 6, guard: 5, resist: 0, attack: 'melee', range: 24,
  attackInterval: 1.6, speed: 60, skillId: 'funbaru', color: '#4a80c8',
  growth: { maxHp: 1, power: 0.34, guard: 0, resist: 0, speed: 0 },
};
const ENEMY = {
  id: 'narazumono', name: 'ならずもの', role: 'てき', combat: true,
  maxHp: 12, power: 5, guard: 1, resist: 0, attack: 'melee', range: 24,
  attackInterval: 1.6, speed: 45, skillId: null, color: '#8a5a4a',
  growth: { maxHp: 1, power: 0.34, guard: 0, resist: 0, speed: 0 },
  xpReward: 5, bowDamageCap: null, fleeAtHpRatio: null,
};
// bonds.json のデフォルトフィクスチャが roran との絆を持つため、
// もう1人のユニットとして定義しておく（ブリーフのフィクスチャ不足を補うためのローカルな追加）
const INES = {
  id: 'ines', name: 'イネス', role: 'ゆみ', combat: true,
  maxHp: 20, power: 4, guard: 2, resist: 0, attack: 'bow', range: 120,
  attackInterval: 1.2, speed: 50, skillId: null, color: '#c8a04a',
  growth: { maxHp: 1, power: 0.34, guard: 0, resist: 0, speed: 0 },
};
const GROWTH = {
  maxLevel: 30, xpPerLevel: 12, enemyLevelXp: 2,
  hitXp: 1, healXp: 1, assistRatio: 0.5, clearXp: 10,
};
const STAGE = {
  id: 'stage1', order: 10, name: 'はじまりの しま', cell: 32,
  mapRows: ['####', '#..#', '#..#', '####'],
  placement: { minY: 64, starts: [{ x: 48, y: 80 }] },
  roster: ['roran'],
  enemyLevel: 1,
  parTimes: { gold: 10, silver: 20, bronze: 30 },
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
    'assets/skills.json': [{ id: 'funbaru', label: 'ふんばる', summary: 'せつめい', params: { duration: 5 } }],
    'assets/bonds.json': [{ a: 'roran', b: 'ines', bonus: 2 }],
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
        { id: 'funbaru', label: 'ふんばる', summary: 'せつめい', params: { duration: 5 } },
        { id: 'mihitsugen', label: 'みじっそう', summary: 'せつめい', params: {} },
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
    expect(reg.growth.maxLevel).toBe(30);
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

  it('faceSmall の ファイルが ない と エラー（仲間・敵）', () => {
    const r = buildRegistry(
      withSprite({ face: 'a-face.png', faceSmall: 'a-face-small.png' }), KNOWN_SKILLS, ['a-face.png'],
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]).toMatchObject({ file: 'assets/units/roran.json', path: 'sprites.faceSmall' });
    const ok = buildRegistry(
      withSprite({ face: 'a-face.png', faceSmall: 'a-face-small.png' }), KNOWN_SKILLS,
      ['a-face.png', 'a-face-small.png'],
    );
    expect(ok.ok).toBe(true);
  });

  it('null は せいじょう', () => {
    const r = buildRegistry(withSprite({ role: null, face: null, faceSmall: null, map: null }), KNOWN_SKILLS, []);
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

  it('intro・outro・敵の名前の知らない id もエラー（出どころのパスつき）', () => {
    const r = buildRegistry(
      files({
        'assets/stages/stage1.json': {
          ...STAGE,
          intro: [{ speaker: null, text: '{nobody1}が いる' }],
          outro: [{ speaker: 'roran', text: '{nobody2}だ' }],
        },
        'assets/enemies/narazumono.json': { ...ENEMY, name: '{nobody3}の かげ' },
      }),
      KNOWN_SKILLS,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const got = r.errors.map((e) => `${e.path}: ${e.reason}`);
    expect(got).toContain('intro[0].text: しらない なまえの id: nobody1');
    expect(got).toContain('outro[0].text: しらない なまえの id: nobody2');
    expect(got).toContain('name: しらない なまえの id: nobody3');
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

describe('実アセットの仲間', () => {
  const reg = testRegistry();

  it('仲間は 15 人', () => {
    expect(reg.units.size).toBe(MAX_MEMBERS);
  });

  it('どの仲間も、伸びが 0.5 以上の能力を 1 つ以上持つ（育てても強くならない仲間を作らない）', () => {
    for (const def of reg.units.values()) {
      const best = Math.max(...Object.values(def.growth));
      expect(best, `${def.id} の伸び`).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('速さの伸びは 0（移動の速さが上がりすぎて操作が難しくなるため）', () => {
    for (const def of [...reg.units.values(), ...reg.enemies.values()]) {
      expect(def.growth.speed, `${def.id} の速さの伸び`).toBe(0);
    }
  });

  // 加わったときのレベルの数字は、成長の調整のたびに変わる（勝率の帯に合わせる）ので、ここでは固定しない
  it.each([
    ['stage5', 'ally09'], ['stage6', 'ally12'], ['stage7', 'ally10'], ['stage8', 'ally11'],
    ['stage8', 'ally13'], ['stage9', 'ally14'], ['stage10', 'ally15'],
  ])('%s の joins に %s がある（1 以上の整数のレベルで、会話が 3 行）', (stageId, unitId) => {
    const stage = reg.stages.find((x) => x.id === stageId)!;
    const j = stage.joins.find((x) => x.unitId === unitId);
    expect(Number.isInteger(j?.level) && j!.level >= 1).toBe(true);
    expect(j!.talk.length).toBe(3);
  });

  it('ally09・ally13 は守備を無視し、ally11 は飛ぶ', () => {
    expect(reg.units.get('ally09')!.ignoresGuard).toBe(true);
    expect(reg.units.get('ally13')!.ignoresGuard).toBe(true);
    expect(reg.units.get('ally11')!.flying).toBe(true);
    expect(reg.units.get('ally10')!.resist).toBe(10);
    expect(reg.units.get('ally10')!.skillId).toBe('kekkai');
  });

  it('7 人ぶんの加入がステージに書かれている', () => {
    const joined = new Set(reg.stages.flatMap((x) => x.joins.map((j) => j.unitId)));
    expect(joined.size).toBeGreaterThanOrEqual(7);
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

  const withJoins = (n: number) => {
    const extra: Record<string, unknown> = {};
    const joins: unknown[] = [];
    for (let i = 0; i < n; i++) {
      extra[`assets/units/x${i}.json`] = { ...INES, id: `x${i}`, name: `x${i}` };
      joins.push({ unitId: `x${i}`, level: 1, talk: TALK });
    }
    return base({ joins }, extra);
  };

  it('roster と加入しうる仲間の合計が 15 人を超えるとエラー', () => {
    const r = withJoins(MAX_MEMBERS);
    expect(reasons(r).some((s) => s.includes(`${MAX_MEMBERS} 人を こえている`))).toBe(true);
  });

  it('合計が 8 人を超えても 15 人以内ならエラーにならない', () => {
    const r = withJoins(MAX_PARTY);
    expect(reasons(r).some((s) => s.includes('人を こえている'))).toBe(false);
  });
});

describe('村人', () => {
  const NPC = { id: 'npc01', name: '村の 人', color: '#a08860', sprites: { face: 'npc01-face.png' } };
  const withNpc = (extra: Record<string, unknown> = {}) => files({ 'assets/npcs/npc01.json': NPC, ...extra });

  it('assets/npcs/ の村人を読み込む', () => {
    const r = buildRegistry(withNpc(), KNOWN_SKILLS, ['npc01-face.png']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.npcs.get('npc01')?.name).toBe('村の 人');
  });

  it('村人の顔の画像が assets/images/ に無いと起動時エラー', () => {
    const r = buildRegistry(withNpc(), KNOWN_SKILLS, []);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]).toMatchObject({ file: 'assets/npcs/npc01.json', path: 'sprites.face' });
  });

  it('lookupSpeaker は村人の名前と顔を返す', () => {
    const r = buildRegistry(withNpc(), KNOWN_SKILLS, ['npc01-face.png']);
    if (!r.ok) throw new Error('読み込み失敗');
    expect(lookupSpeaker(r.value, 'npc01')).toEqual({
      name: '村の 人', color: '#a08860', role: '', sprites: { role: null, face: 'npc01-face.png', faceSmall: null, map: null },
    });
    expect(lookupSpeaker(r.value, 'roran')?.name).toBe('ロラン');
    expect(lookupSpeaker(r.value, 'narazumono')?.name).toBe('ならずもの');
    expect(lookupSpeaker(r.value, 'nobody')).toBeNull();
  });

  it('村人の faceSmall の画像が無いと起動時エラー。lookupSpeaker は faceSmall を返す', () => {
    const npc = { ...NPC, sprites: { face: 'npc01-face.png', faceSmall: 'npc01-face-small.png' } };
    const ng = buildRegistry(files({ 'assets/npcs/npc01.json': npc }), KNOWN_SKILLS, ['npc01-face.png']);
    expect(ng.ok).toBe(false);
    if (!ng.ok) expect(ng.errors[0]).toMatchObject({ file: 'assets/npcs/npc01.json', path: 'sprites.faceSmall' });
    const ok = buildRegistry(
      files({ 'assets/npcs/npc01.json': npc }), KNOWN_SKILLS, ['npc01-face.png', 'npc01-face-small.png'],
    );
    if (!ok.ok) throw new Error('読み込み失敗');
    expect(lookupSpeaker(ok.value, 'npc01')?.sprites.faceSmall).toBe('npc01-face-small.png');
  });

  it('ステージの会話の話し手に村人を書ける', () => {
    const stage = { ...STAGE, intro: [{ speaker: 'npc01', text: 'こんにちは' }] };
    const r = buildRegistry(withNpc({ 'assets/stages/stage1.json': stage }), KNOWN_SKILLS, ['npc01-face.png']);
    expect(r.ok).toBe(true);
  });

  it('村人の id が仲間・敵の id と重なると起動時エラー', () => {
    const r = buildRegistry(
      withNpc({ 'assets/npcs/roran.json': { ...NPC, id: 'roran' } }), KNOWN_SKILLS, ['npc01-face.png'],
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.reason.includes('roran'))).toBe(true);
  });

  it('村人のエラーは実際のファイルパスを指す（ファイル名と id が違っても）', () => {
    const r = buildRegistry(
      files({ 'assets/npcs/shopkeeper.json': { ...NPC, id: 'npc03', sprites: { face: 'nai.png' } } }),
      KNOWN_SKILLS, [],
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]).toMatchObject({ file: 'assets/npcs/shopkeeper.json', path: 'sprites.face' });
  });

  it('同じ id の村人が 2 つあれば弾く', () => {
    const r = buildRegistry(
      withNpc({ 'assets/npcs/npc01b.json': NPC }), KNOWN_SKILLS, ['npc01-face.png'],
    );
    expect(r.ok).toBe(false);
  });
});

describe('村の会話の検証と {visitor}', () => {
  const NPC = { id: 'npc01', name: '村の 人', color: '#a08860', sprites: { face: 'npc01-face.png' } };
  const village = (extra: Record<string, unknown> = {}) => ({
    id: 'v1', col: 0, row: 0, text: '{visitor}の HPが 回復した！', effect: { type: 'heal' }, ...extra,
  });
  const withVillage = (v: Record<string, unknown>, stageExtra: Record<string, unknown> = {}) =>
    files({
      'assets/npcs/npc01.json': NPC,
      'assets/stages/stage1.json': { ...STAGE, villages: [v], ...stageExtra },
    });
  const IMAGES = ['npc01-face.png'];

  it('村の npc が村人に無いと起動時エラー', () => {
    const r = buildRegistry(withVillage(village({ npc: 'npc99' })), KNOWN_SKILLS, IMAGES);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.path === 'villages[0].npc' && e.reason.includes('npc99'))).toBe(true);
  });

  it('村の talk と text の {visitor} は知らない名前にならない（本文は {visitor} のまま残る）', () => {
    const v = village({
      npc: 'npc01',
      talk: [{ speaker: 'npc01', text: 'ようこそ' }, { speaker: '$visitor', text: '{visitor}です' }],
    });
    const r = buildRegistry(withVillage(v), KNOWN_SKILLS, IMAGES);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const got = r.value.stages[0]!.villages[0]!;
    expect(got.text).toBe('{visitor}の HPが 回復した！');
    expect(got.talk[1]).toMatchObject({ speaker: '$visitor', text: '{visitor}です' });
  });

  it('村の talk の話し手は村人でも仲間でもよく、知らない話し手はエラー', () => {
    const bad = village({ talk: [{ speaker: 'nobody', text: 'x' }] });
    const r = buildRegistry(withVillage(bad), KNOWN_SKILLS, IMAGES);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.path === 'villages[0].talk[0].speaker')).toBe(true);
  });

  it('intro の {visitor} は知らない名前のエラーになる', () => {
    const r = buildRegistry(
      withVillage(village(), { intro: [{ speaker: null, text: '{visitor}が 来た' }] }), KNOWN_SKILLS, IMAGES,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.reason.includes('visitor'))).toBe(true);
  });
});

describe('村人の予約 id', () => {
  it('村人の id に $visitor は使えない', () => {
    const NPC = { id: '$visitor', name: '村の 人', color: '#a08860', sprites: { face: null } };
    const r = buildRegistry(files({ 'assets/npcs/visitor.json': NPC }), KNOWN_SKILLS, []);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.file === 'assets/npcs/visitor.json' && e.path === 'id')).toBe(true);
  });
});
