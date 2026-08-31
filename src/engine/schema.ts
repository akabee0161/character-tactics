export type Vec2 = { x: number; y: number };
export type AttackKind = 'melee' | 'bow';

export const ATTACK_KINDS: readonly AttackKind[] = ['melee', 'bow'];

export type ValidationError = { file: string; path: string; reason: string };
export type Validated<T> = { ok: true; value: T } | { ok: false; errors: ValidationError[] };

/** 1ファイルぶんの検証中に集めたエラー。1つ目で打ち切らず全部集める */
export type Ctx = { file: string; errors: ValidationError[] };

export function makeCtx(file: string): Ctx {
  return { file, errors: [] };
}

function fail(ctx: Ctx, path: string, reason: string): null {
  ctx.errors.push({ file: ctx.file, path, reason });
  return null;
}

/**
 * どのヘルパも、値が不正なら ctx.errors に積んで null を返す。
 * 「正しく null だった」場合と区別はつかないが、errors が空でないかぎり
 * 結果そのものが捨てられるので、呼び出し側で区別する必要はない。
 */
export function requireObject(ctx: Ctx, path: string, v: unknown): Record<string, unknown> | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    return fail(ctx, path, 'オブジェクトが ひつよう');
  }
  return v as Record<string, unknown>;
}

export function requireString(ctx: Ctx, path: string, v: unknown): string | null {
  if (typeof v !== 'string' || v === '') return fail(ctx, path, 'からでない もじれつが ひつよう');
  return v;
}

export function requireNumber(
  ctx: Ctx,
  path: string,
  v: unknown,
  opts: { min?: number; max?: number; int?: boolean } = {},
): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fail(ctx, path, 'かずが ひつよう');
  if (opts.int === true && !Number.isInteger(v)) return fail(ctx, path, 'せいすうが ひつよう');
  if (opts.min !== undefined && v < opts.min) return fail(ctx, path, `${opts.min} いじょうが ひつよう`);
  if (opts.max !== undefined && v > opts.max) return fail(ctx, path, `${opts.max} いかが ひつよう`);
  return v;
}

export function requireNumberOrNull(
  ctx: Ctx,
  path: string,
  v: unknown,
  opts: { min?: number; max?: number } = {},
): number | null {
  if (v === null) return null;
  if (v === undefined) return fail(ctx, path, 'かず または null が ひつよう');
  return requireNumber(ctx, path, v, opts);
}

export function requireBoolean(ctx: Ctx, path: string, v: unknown): boolean | null {
  if (typeof v !== 'boolean') return fail(ctx, path, 'true か false が ひつよう');
  return v;
}

export function requireEnum<T extends string>(
  ctx: Ctx,
  path: string,
  v: unknown,
  allowed: readonly T[],
): T | null {
  if (typeof v !== 'string' || !allowed.includes(v as T)) {
    return fail(ctx, path, `つぎの どれかが ひつよう: ${allowed.join(' / ')}`);
  }
  return v as T;
}

export function requireArray(
  ctx: Ctx,
  path: string,
  v: unknown,
  opts: { min?: number } = {},
): unknown[] | null {
  if (!Array.isArray(v)) return fail(ctx, path, 'はいれつが ひつよう');
  if (opts.min !== undefined && v.length < opts.min) {
    return fail(ctx, path, `ようそが ${opts.min} こ いじょう ひつよう`);
  }
  return v;
}

export function requireVec2(ctx: Ctx, path: string, v: unknown): Vec2 | null {
  const o = requireObject(ctx, path, v);
  if (!o) return null;
  const x = requireNumber(ctx, `${path}.x`, o.x);
  const y = requireNumber(ctx, `${path}.y`, o.y);
  if (x === null || y === null) return null;
  return { x, y };
}

/** ctx にエラーが1つでもあれば失敗として返す。なければ value を包んで返す */
function finish<T>(ctx: Ctx, value: T): Validated<T> {
  return ctx.errors.length > 0 ? { ok: false, errors: ctx.errors } : { ok: true, value };
}

export type UnitDef = {
  id: string;
  name: string;
  role: string;
  /** false なら攻撃しない。狙われはする（同行 NPC） */
  combat: boolean;
  maxHp: number;
  power: number;
  guard: number;
  attack: AttackKind;
  range: number;
  attackInterval: number;
  speed: number;
  skillId: string | null;
  color: string;
};

export type EnemyDef = UnitDef & {
  /** 撃破時に、とどめを刺したユニットへ与える経験値 */
  xpReward: number;
  /** 弓によるダメージの上限。null なら上限なし */
  bowDamageCap: number | null;
  /** この HP 割合を下回ると撤退する。null なら撤退しない */
  fleeAtHpRatio: number | null;
};

function readUnitFields(ctx: Ctx, o: Record<string, unknown>): UnitDef {
  return {
    id: requireString(ctx, 'id', o.id) ?? '',
    name: requireString(ctx, 'name', o.name) ?? '',
    role: requireString(ctx, 'role', o.role) ?? '',
    combat: requireBoolean(ctx, 'combat', o.combat) ?? false,
    maxHp: requireNumber(ctx, 'maxHp', o.maxHp, { min: 1 }) ?? 1,
    power: requireNumber(ctx, 'power', o.power, { min: 0 }) ?? 0,
    guard: requireNumber(ctx, 'guard', o.guard, { min: 0 }) ?? 0,
    attack: requireEnum(ctx, 'attack', o.attack, ATTACK_KINDS) ?? 'melee',
    range: requireNumber(ctx, 'range', o.range, { min: 1 }) ?? 1,
    attackInterval: requireNumber(ctx, 'attackInterval', o.attackInterval, { min: 0.1 }) ?? 1,
    speed: requireNumber(ctx, 'speed', o.speed, { min: 0 }) ?? 0,
    skillId: o.skillId === null ? null : requireString(ctx, 'skillId', o.skillId),
    color: requireString(ctx, 'color', o.color) ?? '#000000',
  };
}

export function validateUnitDef(file: string, raw: unknown): Validated<UnitDef> {
  const ctx = makeCtx(file);
  const o = requireObject(ctx, '', raw);
  if (!o) return { ok: false, errors: ctx.errors };
  return finish(ctx, readUnitFields(ctx, o));
}

export function validateEnemyDef(file: string, raw: unknown): Validated<EnemyDef> {
  const ctx = makeCtx(file);
  const o = requireObject(ctx, '', raw);
  if (!o) return { ok: false, errors: ctx.errors };
  const base = readUnitFields(ctx, o);
  const def: EnemyDef = {
    ...base,
    xpReward: requireNumber(ctx, 'xpReward', o.xpReward, { min: 0, int: true }) ?? 0,
    bowDamageCap: requireNumberOrNull(ctx, 'bowDamageCap', o.bowDamageCap, { min: 1 }),
    fleeAtHpRatio: requireNumberOrNull(ctx, 'fleeAtHpRatio', o.fleeAtHpRatio, { min: 0, max: 1 }),
  };
  return finish(ctx, def);
}

export type SkillDef = { id: string; label: string; params: Record<string, number> };
export type BondDef = { a: string; b: string; bonus: number };
export type TitleDef = {
  id: string;
  label: string;
  /** 持ち主の UnitDef id。null は全員共通 */
  owner: string | null;
  /** counters のキー。例: "skill:funbaru:uses" */
  counter: string;
  threshold: number;
};

/** id を持つ定義の配列を検証する共通部分。id の重複もここで見る */
function validateIdArray<T extends { id: string }>(
  file: string,
  raw: unknown,
  readOne: (ctx: Ctx, path: string, o: Record<string, unknown>) => T,
): Validated<T[]> {
  const ctx = makeCtx(file);
  const arr = requireArray(ctx, '', raw, { min: 1 });
  if (!arr) return { ok: false, errors: ctx.errors };

  const seen = new Set<string>();
  const out: T[] = [];
  arr.forEach((item, i) => {
    const path = `[${i}]`;
    const o = requireObject(ctx, path, item);
    if (!o) return;
    const def = readOne(ctx, path, o);
    if (def.id !== '') {
      if (seen.has(def.id)) fail(ctx, `${path}.id`, `id が じゅうふくしている: ${def.id}`);
      seen.add(def.id);
    }
    out.push(def);
  });
  return finish(ctx, out);
}

function readParams(ctx: Ctx, path: string, v: unknown): Record<string, number> {
  const o = requireObject(ctx, path, v);
  if (!o) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(o)) {
    const n = requireNumber(ctx, `${path}.${key}`, value);
    if (n !== null) out[key] = n;
  }
  return out;
}

export function validateSkillsFile(file: string, raw: unknown): Validated<SkillDef[]> {
  return validateIdArray<SkillDef>(file, raw, (ctx, path, o) => ({
    id: requireString(ctx, `${path}.id`, o.id) ?? '',
    label: requireString(ctx, `${path}.label`, o.label) ?? '',
    params: readParams(ctx, `${path}.params`, o.params),
  }));
}

export function validateBondsFile(file: string, raw: unknown): Validated<BondDef[]> {
  const ctx = makeCtx(file);
  const arr = requireArray(ctx, '', raw, { min: 1 });
  if (!arr) return { ok: false, errors: ctx.errors };

  const out: BondDef[] = [];
  arr.forEach((item, i) => {
    const path = `[${i}]`;
    const o = requireObject(ctx, path, item);
    if (!o) return;
    const a = requireString(ctx, `${path}.a`, o.a) ?? '';
    const b = requireString(ctx, `${path}.b`, o.b) ?? '';
    if (a !== '' && a === b) fail(ctx, `${path}.b`, 'じぶん じしんとの きずなは つくれない');
    out.push({ a, b, bonus: requireNumber(ctx, `${path}.bonus`, o.bonus, { min: 1 }) ?? 1 });
  });
  return finish(ctx, out);
}

export function validateTitlesFile(file: string, raw: unknown): Validated<TitleDef[]> {
  return validateIdArray<TitleDef>(file, raw, (ctx, path, o) => ({
    id: requireString(ctx, `${path}.id`, o.id) ?? '',
    label: requireString(ctx, `${path}.label`, o.label) ?? '',
    owner: o.owner === null ? null : requireString(ctx, `${path}.owner`, o.owner),
    counter: requireString(ctx, `${path}.counter`, o.counter) ?? '',
    threshold: requireNumber(ctx, `${path}.threshold`, o.threshold, { min: 1, int: true }) ?? 1,
  }));
}

export function validateLinesFile(file: string, raw: unknown): Validated<Record<string, string>> {
  const ctx = makeCtx(file);
  const o = requireObject(ctx, '', raw);
  if (!o) return { ok: false, errors: ctx.errors };
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(o)) {
    const text = requireString(ctx, key, value);
    if (text !== null) out[key] = text;
  }
  return finish(ctx, out);
}

export type AiDef =
  | { kind: 'sentry'; sightRange: number }
  | { kind: 'aggressive' }
  | { kind: 'guard'; post: Vec2; leash: number; sightRange: number };

export const AI_KINDS: readonly AiDef['kind'][] = ['sentry', 'aggressive', 'guard'];

export type VictoryCond = {
  type: 'reach';
  pos: Vec2;
  radius: number;
  /** 'any' なら味方のだれでもよい。それ以外は到達すべき UnitDef id */
  by: 'any' | string;
};

export type DefeatCond =
  | { type: 'unitLost'; defIds: string[] }
  | { type: 'allPlayerUnitsLost' };

export type EnemyPlacement = { defId: string; pos: Vec2; ai: AiDef };

export type StageDef = {
  /** ファイル名と一致させる。セーブのキーになる */
  id: string;
  name: string;
  cell: number;
  /** '.' 歩ける / '#' 歩けない */
  mapRows: string[];
  placementZone: { pos: Vec2 }[];
  roster: string[];
  enemies: EnemyPlacement[];
  victory: VictoryCond;
  defeat: DefeatCond[];
  intro?: { speaker: string; lineId: string }[];
};

function readMapRows(ctx: Ctx, v: unknown): string[] {
  const arr = requireArray(ctx, 'mapRows', v, { min: 1 });
  if (!arr) return [];
  const rows: string[] = [];
  let width = -1;
  arr.forEach((item, y) => {
    const row = requireString(ctx, `mapRows[${y}]`, item);
    if (row === null) return;
    if (width < 0) width = row.length;
    else if (row.length !== width) {
      fail(ctx, `mapRows[${y}]`, `ながさが ${width} で ないと いけない（じっさいは ${row.length}）`);
      return;
    }
    if (!/^[.#]+$/.test(row)) {
      fail(ctx, `mapRows[${y}]`, "つかえる もじは '.' と '#' だけ");
      return;
    }
    rows.push(row);
  });
  return rows;
}

function readAiDef(ctx: Ctx, path: string, v: unknown): AiDef {
  const o = requireObject(ctx, path, v);
  if (!o) return { kind: 'aggressive' };
  const kind = requireEnum(ctx, `${path}.kind`, o.kind, AI_KINDS);
  switch (kind) {
    case 'sentry':
      return {
        kind: 'sentry',
        sightRange: requireNumber(ctx, `${path}.sightRange`, o.sightRange, { min: 1 }) ?? 1,
      };
    case 'guard':
      return {
        kind: 'guard',
        post: requireVec2(ctx, `${path}.post`, o.post) ?? { x: 0, y: 0 },
        leash: requireNumber(ctx, `${path}.leash`, o.leash, { min: 1 }) ?? 1,
        sightRange: requireNumber(ctx, `${path}.sightRange`, o.sightRange, { min: 1 }) ?? 1,
      };
    default:
      // kind が null（未知の値）だったときもここに来る。エラーはすでに積まれている
      return { kind: 'aggressive' };
  }
}

function readVictory(ctx: Ctx, v: unknown): VictoryCond {
  const fallback: VictoryCond = { type: 'reach', pos: { x: 0, y: 0 }, radius: 1, by: 'any' };
  const o = requireObject(ctx, 'victory', v);
  if (!o) return fallback;
  if (requireEnum(ctx, 'victory.type', o.type, ['reach'] as const) === null) return fallback;
  return {
    type: 'reach',
    pos: requireVec2(ctx, 'victory.pos', o.pos) ?? { x: 0, y: 0 },
    radius: requireNumber(ctx, 'victory.radius', o.radius, { min: 1 }) ?? 1,
    by: requireString(ctx, 'victory.by', o.by) ?? 'any',
  };
}

function readDefeat(ctx: Ctx, v: unknown): DefeatCond[] {
  const arr = requireArray(ctx, 'defeat', v, { min: 1 });
  if (!arr) return [];
  const out: DefeatCond[] = [];
  arr.forEach((item, i) => {
    const path = `defeat[${i}]`;
    const o = requireObject(ctx, path, item);
    if (!o) return;
    const type = requireEnum(ctx, `${path}.type`, o.type, ['unitLost', 'allPlayerUnitsLost'] as const);
    if (type === 'unitLost') {
      const ids = requireArray(ctx, `${path}.defIds`, o.defIds, { min: 1 }) ?? [];
      const defIds: string[] = [];
      ids.forEach((id, j) => {
        const s = requireString(ctx, `${path}.defIds[${j}]`, id);
        if (s !== null) defIds.push(s);
      });
      out.push({ type: 'unitLost', defIds });
    } else if (type === 'allPlayerUnitsLost') {
      out.push({ type: 'allPlayerUnitsLost' });
    }
  });
  return out;
}

function readStringArray(ctx: Ctx, path: string, v: unknown, min: number): string[] {
  const arr = requireArray(ctx, path, v, { min });
  if (!arr) return [];
  const out: string[] = [];
  arr.forEach((item, i) => {
    const s = requireString(ctx, `${path}[${i}]`, item);
    if (s !== null) out.push(s);
  });
  return out;
}

function isWalkableCell(cell: number, mapRows: string[], pos: Vec2): boolean {
  const cx = Math.floor(pos.x / cell);
  const cy = Math.floor(pos.y / cell);
  const row = mapRows[cy];
  return row !== undefined && cx >= 0 && cx < row.length && row[cx] === '.';
}

export function validateStageDef(file: string, raw: unknown): Validated<StageDef> {
  const ctx = makeCtx(file);
  const o = requireObject(ctx, '', raw);
  if (!o) return { ok: false, errors: ctx.errors };

  // walkable 検証に つかうので、mapRows/cell を さきに よむ
  const cell = requireNumber(ctx, 'cell', o.cell, { min: 1, int: true }) ?? 32;
  const mapRows = readMapRows(ctx, o.mapRows);
  const checkWalkable = (path: string, pos: Vec2): void => {
    if (mapRows.length > 0 && !isWalkableCell(cell, mapRows, pos)) {
      fail(ctx, path, 'あるけない マスに ある');
    }
  };

  const zoneRaw = requireArray(ctx, 'placementZone', o.placementZone, { min: 1 }) ?? [];
  const placementZone = zoneRaw.map((item, i) => {
    const z = requireObject(ctx, `placementZone[${i}]`, item);
    const pos = (z && requireVec2(ctx, `placementZone[${i}].pos`, z.pos)) ?? { x: 0, y: 0 };
    checkWalkable(`placementZone[${i}].pos`, pos);
    return { pos };
  });

  const enemiesRaw = requireArray(ctx, 'enemies', o.enemies) ?? [];
  const enemies = enemiesRaw.map((item, i) => {
    const path = `enemies[${i}]`;
    const e = requireObject(ctx, path, item);
    const pos = (e && requireVec2(ctx, `${path}.pos`, e.pos)) ?? { x: 0, y: 0 };
    checkWalkable(`${path}.pos`, pos);
    const ai = readAiDef(ctx, `${path}.ai`, e?.ai);
    if (ai.kind === 'guard') checkWalkable(`${path}.ai.post`, ai.post);
    return {
      defId: (e && requireString(ctx, `${path}.defId`, e.defId)) ?? '',
      pos,
      ai,
    };
  });

  const stage: StageDef = {
    id: requireString(ctx, 'id', o.id) ?? '',
    name: requireString(ctx, 'name', o.name) ?? '',
    cell,
    mapRows,
    placementZone,
    roster: readStringArray(ctx, 'roster', o.roster, 1),
    enemies,
    victory: readVictory(ctx, o.victory),
    defeat: readDefeat(ctx, o.defeat),
  };

  if (o.intro !== undefined) {
    const introRaw = requireArray(ctx, 'intro', o.intro) ?? [];
    stage.intro = introRaw.map((item, i) => {
      const path = `intro[${i}]`;
      const l = requireObject(ctx, path, item);
      return {
        speaker: (l && requireString(ctx, `${path}.speaker`, l.speaker)) ?? '',
        lineId: (l && requireString(ctx, `${path}.lineId`, l.lineId)) ?? '',
      };
    });
  }

  return finish(ctx, stage);
}
