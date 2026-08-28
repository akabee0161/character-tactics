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
