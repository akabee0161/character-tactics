# 侵攻型への転換とデータ駆動エンジン化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 砦を守るタワーディフェンスを、仲間を率いて敵本拠地へ攻め込む侵攻型に転換し、ステージ・ユニット・敵・スキル・称号・セリフを `assets/**/*.json` で定義できるようにする。

**Architecture:** `src/engine/` を新設し、JSON の型検証（`schema.ts`）・読み込み（`loader.ts`）・索引と相互参照検証（`registry.ts`）を担わせる。JSON には数値と ID 参照だけを置き、AI パターンとスキル効果の実体はコード側のレジストリ（`AI_BEHAVIORS` / `SKILL_EFFECTS`）に置いて ID で結ぶ。`core` は `AllyUnit` / `EnemyUnit` を単一の `Unit` へ統合し、`side` の比較だけで敵味方を判定する。依存の向きは `ui → core → engine` の一方向。

**Tech Stack:** TypeScript / Vite / Canvas2D / Vitest

**Spec:** `docs/superpowers/specs/2026-08-28-invasion-pivot-design.md`

## Global Constraints

- ゲーム内に表示する日本語のセリフ・ラベルは**全文ひらがな・カタカナ**。漢字を使わない（README・コメント・設計書・JSON のキー名は除く）
- 依存の向きは `ui → core → engine` の一方向。**`src/engine/**` は `src/core/**` を import しない**
- `src/core/**` と `src/engine/**` は `window` / `document` / `HTMLCanvasElement` / `localStorage` を参照しない
- 論理解像度は 960×540 固定。マップ座標は論理座標から `MAP_ORIGIN`（`{ x: 0, y: 46 }`）を引いたもの
- ボタンの当たり判定は論理座標で最小 64×64
- JSON には条件分岐・スクリプト・式を置かない。数値と ID 参照だけ（設計書 3 節）
- 検証は手書きバリデータで行う。zod 等の外部依存を追加しない（設計書 5.1）
- アセットの読み込みに失敗したら握り潰さず、エラー一覧を出して停止する。部分的に読めたぶんで続行しない（設計書 5.2）
- コミットは Conventional Commits 形式（`feat:` / `fix:` / `refactor:` / `test:` / `chore:` / `docs:`）
- テストは `npm test`（Vitest）、型チェックとビルドは `npm run build`
- 各タスクの終わりで `npm test` と `npm run build` の両方が通ること

## 進め方

設計書 11 節の段階改造の順序をそのままフェーズに割り当てる。**フェーズをまたぐ前に必ず `npm test` と `npm run build` を通すこと。**

| フェーズ | 内容 | 挙動の変化 |
|---|---|---|
| 1 (Task 1〜5) | エンジン層の新設 | なし（誰も使わない） |
| 2 (Task 6〜11) | ユニオン型の全廃・レジストリへの切り替え | なし（セーブは version 2 へ更新され旧セーブは破棄） |
| 3 (Task 12〜13) | ウェーブの削除 | 大（1ステージ1マップ・敵は配置済み） |
| 4 (Task 14〜15) | ユニット型の統合 | なし |
| 5 (Task 16) | 勝敗条件の差し替え | 大（到達勝利・護衛対象ロスト敗北） |
| 6 (Task 17〜19) | 敵 AI | 大 |
| 7 (Task 20) | ステージ中の成長 | 中 |
| 8 (Task 21〜23) | UI | 中 |
| 9 (Task 24) | 新ステージ | 大 |

**フェーズ 3 から 5 の間はゲームとして中途半端な状態になる。** ウェーブは消えたが勝敗条件がまだ砦のまま、という時期が存在する。これは段階改造の代償として設計書が受け入れているもので、テストが緑であればよい。フェーズ 5 まで一気に進めること。

## 設計上の判断（設計書に書かれていない補足）

実装にあたって仕様の隙間を埋めた箇所。設計書と食い違うわけではないが、実装者が迷う点なので先に決めておく。

1. **`StageDef.roster` の `controller`** — 設計書 5.6 の `roster: string[]` をそのまま採る。roster に載るユニットは全員 `controller: 'player'` になる。`Unit.controller` というフィールド自体は設計書 6.1 のとおり持たせ、`sim.ts` は `side` ではなく `controller === 'ai'` で AI を回すかを分ける。自律行動する味方を足したくなったら `roster` のスキーマだけを拡張すればよい。
2. **フェーズ 3〜4 の敵の目的地** — 設計書 11 節は「この時点では敵はまだ本拠地（旧・砦）へ直進する」と書くが、侵攻型では砦という概念が消える。旧・砦の代わりに `stage.placementZone[0].pos`（味方の初期配置地点）を目的地にする。これで挙動としては従来と同じ「敵が味方のいる方向へ降りてくる」になり、`StageDef` に一時的な `fort` フィールドを足さずに済む。
3. **勝敗の優先順位** — `updateObjectives` は敗北条件を先に評価する。同じ tick で護衛対象が倒れかつ到達条件が満たされた場合は敗北。
4. **`placementZone` の判定** — 配置地点は離散的な点として定義し、そこから `PLACEMENT_RADIUS = 64`（マップ座標のピクセル）以内かつ歩けるマスに置けるものとする。
5. **カウンタの加算** — 設計書 6.8 の「加算は `SimEvent` を見て行う」に従い、`core/counters.ts` の純関数が `SimEvent[]` からキーを起こす。`skill:<skillId>:hits` を汎用に扱えるよう、`SimEvent` の `skill` に `hits: number` を載せる（かけぬける以外は 0）。特定のスキル名を分岐に書かない。

---

# フェーズ 1: エンジン層の新設

このフェーズが終わっても `src/core/` は一切変わらない。`src/engine/` と `assets/` が増えるだけで、ゲームの挙動は同じままである。

### Task 1: 検証の土台と `UnitDef` / `EnemyDef` の検証

`engine/schema.ts` に、エラーの場所と理由を必ず残す小さな検証ヘルパを置き、その上に最初の2つの定義の検証を組む。ヘルパの形をここで固定するので、以降のタスクはすべてこれに乗る。

**Files:**
- Create: `src/engine/schema.ts`
- Create: `src/engine/schema.test.ts`
- Modify: `tsconfig.json`（`types` に `vite/client` を追加。Task 5 の `import.meta.glob` で必要になる）

**Interfaces:**
- Consumes: なし
- Produces:
  - `type Vec2 = { x: number; y: number }` — `core/types.ts` からここへ移す（`engine` は `core` を import できないため）
  - `type AttackKind = 'melee' | 'bow'` — 同上
  - `type ValidationError = { file: string; path: string; reason: string }`
  - `type Validated<T> = { ok: true; value: T } | { ok: false; errors: ValidationError[] }`
  - `type Ctx = { file: string; errors: ValidationError[] }`
  - `function makeCtx(file: string): Ctx`
  - `function requireObject(ctx: Ctx, path: string, v: unknown): Record<string, unknown> | null`
  - `function requireString(ctx: Ctx, path: string, v: unknown): string | null`
  - `function requireNumber(ctx: Ctx, path: string, v: unknown, opts?: { min?: number; max?: number; int?: boolean }): number | null`
  - `function requireNumberOrNull(ctx: Ctx, path: string, v: unknown, opts?: { min?: number; max?: number }): number | null`
  - `function requireBoolean(ctx: Ctx, path: string, v: unknown): boolean | null`
  - `function requireEnum<T extends string>(ctx: Ctx, path: string, v: unknown, allowed: readonly T[]): T | null`
  - `function requireArray(ctx: Ctx, path: string, v: unknown, opts?: { min?: number }): unknown[] | null`
  - `function requireVec2(ctx: Ctx, path: string, v: unknown): Vec2 | null`
  - `type UnitDef` / `type EnemyDef`
  - `function validateUnitDef(file: string, raw: unknown): Validated<UnitDef>`
  - `function validateEnemyDef(file: string, raw: unknown): Validated<EnemyDef>`

- [ ] **Step 1: 失敗するテストを書く**

`src/engine/schema.test.ts` を新規作成する。

```ts
import { describe, expect, it } from 'vitest';
import { validateEnemyDef, validateUnitDef } from './schema';

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
    const r = validateUnitDef('units/roran.json', { ...VALID_UNIT, attack: 'magic' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.reason).toContain('melee');
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
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/engine/schema.test.ts`
Expected: FAIL —「Failed to resolve import "./schema"」

- [ ] **Step 3: `src/engine/schema.ts` を書く**

```ts
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
```

- [ ] **Step 4: `tsconfig.json` の `types` に `vite/client` を足す**

`import.meta.glob` を Task 5 で使う。型が通るように先に入れておく。

```json
    "types": ["vitest/globals", "vite/client"]
```

- [ ] **Step 5: テストが通ることを確かめる**

Run: `npx vitest run src/engine/schema.test.ts && npm run build`
Expected: PASS（`validateUnitDef` 7件 + `validateEnemyDef` 4件）／ビルドも成功

- [ ] **Step 6: コミット**

```bash
git add src/engine/schema.ts src/engine/schema.test.ts tsconfig.json
git commit -m "feat(engine): 定義の検証ヘルパと UnitDef / EnemyDef の検証を追加"
```

---

### Task 2: `SkillDef` / `BondDef` / `TitleDef` / セリフの検証

数値と ID だけを持つ小さい定義を4つ足す。`SkillDef.params` を `Record<string, number>` にすることで、スキルごとの定数（ふんばりの持続秒、おまじないの回復量など）をコードから追い出す。

**Files:**
- Modify: `src/engine/schema.ts`（末尾に追加）
- Modify: `src/engine/schema.test.ts`（末尾に追加）

**Interfaces:**
- Consumes: Task 1 の `Ctx` / ヘルパ群 / `Validated<T>`
- Produces:
  - `type SkillDef = { id: string; label: string; params: Record<string, number> }`
  - `type BondDef = { a: string; b: string; bonus: number }`
  - `type TitleDef = { id: string; label: string; owner: string | null; counter: string; threshold: number }`
  - `function validateSkillsFile(file: string, raw: unknown): Validated<SkillDef[]>`
  - `function validateBondsFile(file: string, raw: unknown): Validated<BondDef[]>`
  - `function validateTitlesFile(file: string, raw: unknown): Validated<TitleDef[]>`
  - `function validateLinesFile(file: string, raw: unknown): Validated<Record<string, string>>`

- [ ] **Step 1: 失敗するテストを書く**

`src/engine/schema.test.ts` の末尾に追加する。

```ts
import {
  validateBondsFile, validateLinesFile, validateSkillsFile, validateTitlesFile,
} from './schema';

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
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/engine/schema.test.ts`
Expected: FAIL —「validateSkillsFile is not a function」等

- [ ] **Step 3: `src/engine/schema.ts` の末尾に実装を足す**

```ts
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
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `npx vitest run src/engine/schema.test.ts && npm run build`
Expected: PASS（Task 1 の 11 件 + 今回の 10 件）

- [ ] **Step 5: コミット**

```bash
git add src/engine/schema.ts src/engine/schema.test.ts
git commit -m "feat(engine): スキル・きずな・しょうごう・セリフの検証を追加"
```

---

### Task 3: `AiDef` と `StageDef` の検証

いちばん項目の多い定義。`AiDef` / `VictoryCond` / `DefeatCond` は判別可能ユニオンなので、`kind` / `type` で分岐して残りを読む。

**Files:**
- Modify: `src/engine/schema.ts`（末尾に追加）
- Modify: `src/engine/schema.test.ts`（末尾に追加）

**Interfaces:**
- Consumes: Task 1 の `Ctx` / ヘルパ群 / `Vec2`
- Produces:
  - `type AiDef = { kind: 'sentry'; sightRange: number } | { kind: 'aggressive' } | { kind: 'guard'; post: Vec2; leash: number; sightRange: number }`
  - `const AI_KINDS: readonly AiDef['kind'][]`
  - `type VictoryCond = { type: 'reach'; pos: Vec2; radius: number; by: 'any' | string }`
  - `type DefeatCond = { type: 'unitLost'; defIds: string[] } | { type: 'allPlayerUnitsLost' }`
  - `type EnemyPlacement = { defId: string; pos: Vec2; ai: AiDef }`
  - `type StageDef = { id: string; name: string; cell: number; mapRows: string[]; placementZone: { pos: Vec2 }[]; roster: string[]; enemies: EnemyPlacement[]; victory: VictoryCond; defeat: DefeatCond[]; intro?: { speaker: string; lineId: string }[] }`
  - `function validateStageDef(file: string, raw: unknown): Validated<StageDef>`

- [ ] **Step 1: 失敗するテストを書く**

`src/engine/schema.test.ts` の末尾に追加する。

```ts
import { validateStageDef } from './schema';

const VALID_STAGE = {
  id: 'stage1',
  name: 'はじまりの しま',
  cell: 32,
  mapRows: ['####', '#..#', '#..#', '####'],
  placementZone: [{ pos: { x: 48, y: 48 } }],
  roster: ['roran', 'ines'],
  enemies: [{ defId: 'narazumono', pos: { x: 80, y: 80 }, ai: { kind: 'aggressive' } }],
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

  it('placementZone が からなら弾く', () => {
    const r = validateStageDef('stages/x.json', { ...VALID_STAGE, placementZone: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('placementZone');
  });

  it('未知の ai.kind を弾く', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE,
      enemies: [{ defId: 'x', pos: { x: 0, y: 0 }, ai: { kind: 'ambush' } }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('enemies[0].ai.kind');
  });

  it('sentry には sightRange が いる', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE,
      enemies: [{ defId: 'x', pos: { x: 0, y: 0 }, ai: { kind: 'sentry' } }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('enemies[0].ai.sightRange');
  });

  it('guard の post と leash を読む', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE,
      enemies: [{
        defId: 'x', pos: { x: 0, y: 0 },
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
});
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/engine/schema.test.ts`
Expected: FAIL —「validateStageDef is not a function」

- [ ] **Step 3: `src/engine/schema.ts` の末尾に実装を足す**

```ts
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

export function validateStageDef(file: string, raw: unknown): Validated<StageDef> {
  const ctx = makeCtx(file);
  const o = requireObject(ctx, '', raw);
  if (!o) return { ok: false, errors: ctx.errors };

  const zoneRaw = requireArray(ctx, 'placementZone', o.placementZone, { min: 1 }) ?? [];
  const placementZone = zoneRaw.map((item, i) => {
    const z = requireObject(ctx, `placementZone[${i}]`, item);
    return { pos: (z && requireVec2(ctx, `placementZone[${i}].pos`, z.pos)) ?? { x: 0, y: 0 } };
  });

  const enemiesRaw = requireArray(ctx, 'enemies', o.enemies) ?? [];
  const enemies = enemiesRaw.map((item, i) => {
    const path = `enemies[${i}]`;
    const e = requireObject(ctx, path, item);
    return {
      defId: (e && requireString(ctx, `${path}.defId`, e.defId)) ?? '',
      pos: (e && requireVec2(ctx, `${path}.pos`, e.pos)) ?? { x: 0, y: 0 },
      ai: readAiDef(ctx, `${path}.ai`, e?.ai),
    };
  });

  const stage: StageDef = {
    id: requireString(ctx, 'id', o.id) ?? '',
    name: requireString(ctx, 'name', o.name) ?? '',
    cell: requireNumber(ctx, 'cell', o.cell, { min: 1, int: true }) ?? 32,
    mapRows: readMapRows(ctx, o.mapRows),
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
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `npx vitest run src/engine/schema.test.ts && npm run build`
Expected: PASS（合計 35 件）

- [ ] **Step 5: コミット**

```bash
git add src/engine/schema.ts src/engine/schema.test.ts
git commit -m "feat(engine): AiDef と StageDef の検証を追加"
```

---

### Task 4: レジストリの構築と相互参照の検証

ファイルごとの形が正しくても、`roster` が存在しないユニットを指していたら起動時に落ちなければならない。ここが「JSON を1本置くだけでステージが増える」を安全にする核心である。

スキル効果の実体（`SKILL_EFFECTS`）は `core` にあり `engine` からは見えないので、実装済みスキル ID の集合だけを引数で受け取る。これで依存の向きを保ったまま「`skills.json` にあるが実装がない」を検出できる。

**Files:**
- Create: `src/engine/registry.ts`
- Create: `src/engine/registry.test.ts`

**Interfaces:**
- Consumes: Task 1〜3 の `validate*` 関数群と定義型すべて
- Produces:
  - `type Registry = { units: Map<string, UnitDef>; enemies: Map<string, EnemyDef>; stages: StageDef[]; skills: Map<string, SkillDef>; titles: TitleDef[]; bonds: BondDef[]; lines: Map<string, string> }`
  - `function buildRegistry(files: Record<string, unknown>, knownSkillIds: readonly string[]): Validated<Registry>`
  - `function lookupDef(reg: Registry, defId: string): UnitDef | EnemyDef | null` — 味方・敵のどちらでも名前と色を引けるようにする
  - `function skillParam(reg: Registry, skillId: string, key: string, fallback: number): number`

`files` のキーはパス（例 `assets/units/roran.json`）。`assets/` からの相対で最初のセグメントが種類を決める：`units/` `enemies/` `stages/` `lines/` はディレクトリ、`skills.json` `bonds.json` `titles.json` は単一ファイル。`stages` の順序はパスの辞書順で決める。

- [ ] **Step 1: 失敗するテストを書く**

`src/engine/registry.test.ts` を新規作成する。

```ts
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
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/engine/registry.test.ts`
Expected: FAIL —「Failed to resolve import "./registry"」

- [ ] **Step 3: `src/engine/registry.ts` を書く**

```ts
import {
  validateBondsFile, validateEnemyDef, validateLinesFile, validateSkillsFile,
  validateStageDef, validateTitlesFile, validateUnitDef,
} from './schema';
import type {
  BondDef, EnemyDef, SkillDef, StageDef, TitleDef, UnitDef, Validated, ValidationError,
} from './schema';

export type Registry = {
  units: Map<string, UnitDef>;
  enemies: Map<string, EnemyDef>;
  /** 順序を持つのでこれだけ配列。パスの辞書順 */
  stages: StageDef[];
  skills: Map<string, SkillDef>;
  titles: TitleDef[];
  bonds: BondDef[];
  lines: Map<string, string>;
};

/** 'assets/units/roran.json' → 'roran' */
function baseName(path: string): string {
  const last = path.split('/').pop() ?? '';
  return last.replace(/\.json$/, '');
}

function inDir(path: string, dir: string): boolean {
  return path.includes(`/${dir}/`);
}

export function buildRegistry(
  files: Record<string, unknown>,
  knownSkillIds: readonly string[],
): Validated<Registry> {
  const errors: ValidationError[] = [];
  const reg: Registry = {
    units: new Map(), enemies: new Map(), stages: [],
    skills: new Map(), titles: [], bonds: [], lines: new Map(),
  };

  const take = <T>(result: Validated<T>, use: (value: T) => void): void => {
    if (result.ok) use(result.value);
    else errors.push(...result.errors);
  };

  // 1) ファイルごとの形を見る
  for (const path of Object.keys(files).sort()) {
    const raw = files[path];
    if (inDir(path, 'units')) {
      take(validateUnitDef(path, raw), (d) => reg.units.set(d.id, d));
    } else if (inDir(path, 'enemies')) {
      take(validateEnemyDef(path, raw), (d) => reg.enemies.set(d.id, d));
    } else if (inDir(path, 'stages')) {
      take(validateStageDef(path, raw), (d) => {
        if (d.id !== baseName(path)) {
          errors.push({ file: path, path: 'id', reason: `ファイルめいと id が ちがう: ${d.id}` });
        }
        reg.stages.push(d);
      });
    } else if (inDir(path, 'lines')) {
      take(validateLinesFile(path, raw), (d) => {
        for (const [k, v] of Object.entries(d)) reg.lines.set(k, v);
      });
    } else if (baseName(path) === 'skills') {
      take(validateSkillsFile(path, raw), (d) => {
        for (const s of d) reg.skills.set(s.id, s);
      });
    } else if (baseName(path) === 'bonds') {
      take(validateBondsFile(path, raw), (d) => reg.bonds.push(...d));
    } else if (baseName(path) === 'titles') {
      take(validateTitlesFile(path, raw), (d) => reg.titles.push(...d));
    } else {
      errors.push({ file: path, path: '', reason: 'どの しゅるいの アセットか わからない' });
    }
  }

  // 形が崩れているうちに相互参照を見ても、正しくない指摘が大量に出るだけなので打ち切る
  if (errors.length > 0) return { ok: false, errors };
  if (reg.stages.length === 0) {
    return { ok: false, errors: [{ file: 'assets/stages/', path: '', reason: 'ステージが 1つも ない' }] };
  }

  // 2) 相互参照を見る
  const known = new Set(knownSkillIds);
  for (const id of reg.skills.keys()) {
    if (!known.has(id)) {
      errors.push({ file: 'assets/skills.json', path: id, reason: `こうかの じっそうが ない: ${id}` });
    }
  }

  const checkSkillId = (file: string, path: string, skillId: string | null): void => {
    if (skillId !== null && !reg.skills.has(skillId)) {
      errors.push({ file, path, reason: `skills.json に ない id: ${skillId}` });
    }
  };
  for (const [id, def] of reg.units) checkSkillId(`assets/units/${id}.json`, 'skillId', def.skillId);
  for (const [id, def] of reg.enemies) checkSkillId(`assets/enemies/${id}.json`, 'skillId', def.skillId);

  for (const stage of reg.stages) {
    const file = `assets/stages/${stage.id}.json`;
    const roster = new Set(stage.roster);
    stage.roster.forEach((defId, i) => {
      if (!reg.units.has(defId)) {
        errors.push({ file, path: `roster[${i}]`, reason: `units に ない id: ${defId}` });
      }
    });
    stage.enemies.forEach((e, i) => {
      if (!reg.enemies.has(e.defId)) {
        errors.push({ file, path: `enemies[${i}].defId`, reason: `enemies に ない id: ${e.defId}` });
      }
    });
    if (stage.victory.by !== 'any' && !roster.has(stage.victory.by)) {
      errors.push({ file, path: 'victory.by', reason: `roster に ない id: ${stage.victory.by}` });
    }
    stage.defeat.forEach((cond, i) => {
      if (cond.type !== 'unitLost') return;
      cond.defIds.forEach((defId, j) => {
        if (!roster.has(defId)) {
          errors.push({ file, path: `defeat[${i}].defIds[${j}]`, reason: `roster に ない id: ${defId}` });
        }
      });
    });
    stage.intro?.forEach((line, i) => {
      if (lookupDef(reg, line.speaker) === null) {
        errors.push({ file, path: `intro[${i}].speaker`, reason: `しらない はなして: ${line.speaker}` });
      }
      if (!reg.lines.has(line.lineId)) {
        errors.push({ file, path: `intro[${i}].lineId`, reason: `lines に ない id: ${line.lineId}` });
      }
    });
  }

  reg.titles.forEach((t, i) => {
    if (t.owner !== null && !reg.units.has(t.owner)) {
      errors.push({ file: 'assets/titles.json', path: `[${i}].owner`, reason: `units に ない id: ${t.owner}` });
    }
  });

  reg.bonds.forEach((b, i) => {
    if (!reg.units.has(b.a)) {
      errors.push({ file: 'assets/bonds.json', path: `[${i}].a`, reason: `units に ない id: ${b.a}` });
    }
    if (!reg.units.has(b.b)) {
      errors.push({ file: 'assets/bonds.json', path: `[${i}].b`, reason: `units に ない id: ${b.b}` });
    }
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: reg };
}

/** 味方・敵のどちらでも名前と色を引けるようにする。吹き出しと描画が使う */
export function lookupDef(reg: Registry, defId: string): UnitDef | EnemyDef | null {
  return reg.units.get(defId) ?? reg.enemies.get(defId) ?? null;
}

export function skillParam(
  reg: Registry,
  skillId: string,
  key: string,
  fallback: number,
): number {
  return reg.skills.get(skillId)?.params[key] ?? fallback;
}
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `npx vitest run src/engine/ && npm run build`
Expected: PASS（schema 35 件 + registry 19 件）

- [ ] **Step 5: コミット**

```bash
git add src/engine/registry.ts src/engine/registry.test.ts
git commit -m "feat(engine): レジストリの こうちくと 相互さんしょうの けんしょうを追加"
```

---

### Task 5: アセットの書き出しとローダ

既存の `src/content/` の内容を `assets/**/*.json` に写す。ここで `src/content/` を消しはしない（消すのは Task 8）。ステージ JSON は**侵攻型の新しい形**で書く。旧ステージの `waves` は写しようがないので、各ウェーブの敵をまとめて上陸地点に静的配置し、勝利条件は上陸地点への到達とする。フェーズ 9 で作り直す前提の暫定データである。

**Files:**
- Create: `assets/units/roran.json` `assets/units/ines.json` `assets/units/mist.json` `assets/units/gau.json`
- Create: `assets/enemies/narazumono.json` `assets/enemies/tatemochi.json` `assets/enemies/garum.json`
- Create: `assets/stages/stage1.json` `assets/stages/stage2.json` `assets/stages/stage3.json`
- Create: `assets/skills.json` `assets/bonds.json` `assets/titles.json`
- Create: `assets/lines/common.json`
- Create: `src/engine/loader.ts`
- Create: `src/engine/loader.test.ts`

**Interfaces:**
- Consumes: `buildRegistry` (Task 4)
- Produces:
  - `function assetFiles(): Record<string, unknown>` — `import.meta.glob` の結果をパス→内容の素の辞書にして返す
  - `function loadRegistry(knownSkillIds: readonly string[]): Validated<Registry>`

- [ ] **Step 1: アセットを書く**

`assets/units/roran.json`（他の3人も同じ形で `src/content/characters.ts` の値をそのまま写す。`MELEE_RANGE = 24` / `BOW_RANGE = 160` は展開する。`combat` は全員 `true`）:

```json
{
  "id": "roran", "name": "ロラン", "role": "たて",
  "combat": true,
  "maxHp": 30, "power": 6, "guard": 5,
  "attack": "melee", "range": 24,
  "attackInterval": 1.6, "speed": 60,
  "skillId": "funbaru",
  "color": "#4a80c8"
}
```

残り3人の値（`src/content/characters.ts:28-45` から写す）:

| id | name | role | maxHp | power | guard | attack | range | attackInterval | speed | skillId | color |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ines | イネス | ゆみ | 20 | 8 | 2 | bow | 160 | 2.2 | 60 | neraiuchi | #3faa6a |
| mist | ミスト | いやし | 22 | 4 | 3 | melee | 24 | 1.6 | 60 | omajinai | #c86fb0 |
| gau | ガウ | ものみ | 24 | 7 | 3 | melee | 24 | 1.6 | 100 | kakenukeru | #e0a03c |

`assets/enemies/narazumono.json`（`fortDamage` は捨てる。`xpReward` は新規で、旧 `XP_PER_DEFEAT = 5` を基準に強さで差をつける）:

```json
{
  "id": "narazumono", "name": "ならずもの", "role": "てき",
  "combat": true,
  "maxHp": 12, "power": 5, "guard": 1,
  "attack": "melee", "range": 24,
  "attackInterval": 1.6, "speed": 45,
  "skillId": null,
  "color": "#8a5a4a",
  "xpReward": 5, "bowDamageCap": null, "fleeAtHpRatio": null
}
```

| id | name | maxHp | power | guard | attackInterval | speed | color | xpReward | bowDamageCap | fleeAtHpRatio |
|---|---|---|---|---|---|---|---|---|---|---|
| tatemochi | たてもち | 20 | 5 | 3 | 1.8 | 35 | #6b6b7a | 8 | 1 | null |
| garum | ガルム | 40 | 9 | 4 | 1.4 | 55 | #b03a3a | 20 | null | 0.3 |

（`role` は3体とも `"てき"`、`attack` は `"melee"`、`range` は `24`、`combat` は `true`、`skillId` は `null`）

`assets/skills.json`（`src/core/skills.ts:6-8` の定数と `src/core/bonds.ts:4` の `BOND_RANGE` を写す）:

```json
[
  { "id": "funbaru",    "label": "ふんばる",   "params": { "duration": 5 } },
  { "id": "neraiuchi",  "label": "ねらいうち", "params": {} },
  { "id": "omajinai",   "label": "おまじない", "params": { "heal": 12, "range": 200 } },
  { "id": "kakenukeru", "label": "かけぬける", "params": { "damage": 5 } }
]
```

`assets/bonds.json`（`src/core/bonds.ts:8-12`）:

```json
[
  { "a": "roran", "b": "ines", "bonus": 2 },
  { "a": "mist",  "b": "gau",  "bonus": 2 },
  { "a": "roran", "b": "mist", "bonus": 1 }
]
```

`assets/titles.json`（`src/core/progress.ts:16-31,83-89` を、設計書 6.8 のカウンタキー規約に載せ替える）:

```json
[
  { "id": "gamanzuyoi",       "label": "がまんづよい",       "owner": "roran", "counter": "skill:funbaru:uses",    "threshold": 5 },
  { "id": "ichigekihissatsu", "label": "いちげきひっさつ",   "owner": "ines",  "counter": "kill:neraiuchi",        "threshold": 3 },
  { "id": "minnanookaasan",   "label": "みんなの おかあさん", "owner": "mist",  "counter": "skill:omajinai:uses",   "threshold": 5 },
  { "id": "kazenoyouni",      "label": "かぜの ように",       "owner": "gau",   "counter": "skill:kakenukeru:hits", "threshold": 8 },
  { "id": "nakayoshi",        "label": "なかよし",           "owner": null,    "counter": "bond:supports",         "threshold": 20 }
]
```

`assets/lines/common.json` — `src/content/lines.ts` の `LINES` をそのまま JSON にする。**ただし `wave:` で始まるキーは捨てる**（ウェーブが消えるため）。代わりにステージ intro 用のキーを4本足す:

```json
{
  "stage:stage1:roran": "みんな、\nじゅんびは いい？",
  "stage:stage1:gau": "ばっちりだよ！\nはやく いこう！",
  "stage:stage3:narazumono": "おい、\nたてもちも きたぞ",
  "stage:stage3:tatemochi": "まもりは まかせろ。\nおまえは すすめ"
}
```

（残りの `first:` / `rival:` / `skill:` / `pinch:` / `win:` / `retire:` の 26 キーは `src/content/lines.ts` から一字一句そのまま写す）

`assets/stages/stage1.json` — マップは `src/content/stages/stage1.ts:9-24` をそのまま写す。旧 `fort`（味方の砦）を配置地点に、旧 `landings`（敵の上陸地点）を敵の配置と勝利地点にする。敵は3ウェーブぶんを縦にばらして並べる:

```json
{
  "id": "stage1",
  "name": "はじまりの しま",
  "cell": 32,
  "mapRows": [
    "##############################",
    "##############################",
    "####......................####",
    "###........................###",
    "##..........................##",
    "##..........................##",
    "##..........................##",
    "##..........................##",
    "##..........................##",
    "##..........................##",
    "###........................###",
    "####......................####",
    "##############################",
    "##############################"
  ],
  "placementZone": [
    { "pos": { "x": 112, "y": 208 } },
    { "pos": { "x": 112, "y": 272 } },
    { "pos": { "x": 176, "y": 208 } },
    { "pos": { "x": 176, "y": 272 } }
  ],
  "roster": ["roran", "ines", "mist", "gau"],
  "enemies": [
    { "defId": "narazumono", "pos": { "x": 464, "y": 176 }, "ai": { "kind": "aggressive" } },
    { "defId": "narazumono", "pos": { "x": 464, "y": 304 }, "ai": { "kind": "aggressive" } },
    { "defId": "narazumono", "pos": { "x": 656, "y": 240 }, "ai": { "kind": "aggressive" } },
    { "defId": "garum",      "pos": { "x": 848, "y": 240 }, "ai": { "kind": "aggressive" } }
  ],
  "victory": { "type": "reach", "pos": { "x": 848, "y": 240 }, "radius": 40, "by": "any" },
  "defeat": [{ "type": "unitLost", "defIds": ["roran"] }],
  "intro": [
    { "speaker": "roran", "lineId": "stage:stage1:roran" },
    { "speaker": "gau", "lineId": "stage:stage1:gau" }
  ]
}
```

`assets/stages/stage2.json` — `src/content/stages/stage2.ts` の `mapRows` を写し、`id` は `"stage2"`、`name` は `"ふたつの みなと"`。`placementZone` は stage1 と同じ4点。敵は上陸地点 A `{x:848,y:80}` / B `{x:848,y:368}` の周辺に `narazumono` を4体（`{x:496,y:112}` `{x:496,y:400}` `{x:720,y:80}` `{x:720,y:368}`）と `garum` を1体（`{x:848,y:80}`）、すべて `aggressive`。`victory` は `{ "type": "reach", "pos": { "x": 848, "y": 80 }, "radius": 40, "by": "any" }`、`defeat` は stage1 と同じ。`intro` は無し。

`assets/stages/stage3.json` — `src/content/stages/stage3.ts` の `mapRows` を写し、`id` は `"stage3"`、`name` は `"ガルムの さいご"`。`placementZone` は stage1 と同じ4点。敵は `narazumono` 3体（`{x:400,y:112}` `{x:432,y:368}` `{x:688,y:240}`）、`tatemochi` 2体（`{x:592,y:176}` `{x:592,y:304}`）、`garum` 1体（`{x:848,y:240}`）、すべて `aggressive`。`victory` は `{ "type": "reach", "pos": { "x": 848, "y": 240 }, "radius": 40, "by": "any" }`、`defeat` は stage1 と同じ。`intro` は `stage:stage3:narazumono` と `stage:stage3:tatemochi`。

> **配置座標の確認方法** — `mapRows` はセル 32px。`{x: 464, y: 176}` はセル `(14, 5)` の中心付近にあたる。上の座標はすべて `.` のマスに落ちているが、書いたあとで Step 4 のテストが歩けるマスかを検証するので、そこで落ちたら直すこと。

- [ ] **Step 2: 失敗するテストを書く**

`src/engine/loader.test.ts` を新規作成する。実際の `assets/` を読むので、アセットの中身の正しさもここで守られる。

```ts
import { describe, expect, it } from 'vitest';
import { assetFiles, loadRegistry } from './loader';

const KNOWN_SKILLS = ['funbaru', 'neraiuchi', 'omajinai', 'kakenukeru'];

describe('assetFiles', () => {
  it('assets/ の JSON を すべて 拾う', () => {
    const files = assetFiles();
    const paths = Object.keys(files);
    expect(paths).toContain('/assets/units/roran.json');
    expect(paths).toContain('/assets/skills.json');
    expect(paths.filter((p) => p.includes('/stages/')).length).toBeGreaterThanOrEqual(3);
  });
});

describe('loadRegistry', () => {
  it('じっさいの assets/ から レジストリを つくれる', () => {
    const r = loadRegistry(KNOWN_SKILLS);
    if (!r.ok) {
      throw new Error(r.errors.map((e) => `${e.file} ${e.path}: ${e.reason}`).join('\n'));
    }
    expect(r.value.units.size).toBe(4);
    expect(r.value.enemies.size).toBe(3);
    expect(r.value.stages.length).toBe(3);
    expect(r.value.skills.size).toBe(4);
    expect(r.value.titles.length).toBe(5);
    expect(r.value.bonds.length).toBe(3);
  });

  it('実装のない スキル ID を わたすと 落ちる', () => {
    const r = loadRegistry(['funbaru']);
    expect(r.ok).toBe(false);
  });

  it('すべての ステージの 配置地点・敵・勝利地点が 歩ける マスに ある', () => {
    const r = loadRegistry(KNOWN_SKILLS);
    if (!r.ok) throw new Error('レジストリの こうちくに しっぱい');
    for (const stage of r.value.stages) {
      const walkable = (p: { x: number; y: number }): boolean => {
        const cx = Math.floor(p.x / stage.cell);
        const cy = Math.floor(p.y / stage.cell);
        return stage.mapRows[cy]?.[cx] === '.';
      };
      for (const z of stage.placementZone) {
        expect(`${stage.id} placement ${z.pos.x},${z.pos.y} walkable=${walkable(z.pos)}`)
          .toContain('walkable=true');
      }
      for (const e of stage.enemies) {
        expect(`${stage.id} ${e.defId} ${e.pos.x},${e.pos.y} walkable=${walkable(e.pos)}`)
          .toContain('walkable=true');
      }
      expect(`${stage.id} victory walkable=${walkable(stage.victory.pos)}`)
        .toContain('walkable=true');
    }
  });

  it('ユニットが さんしょうする すべての セリフ キーが lines に ある', () => {
    const r = loadRegistry(KNOWN_SKILLS);
    if (!r.ok) throw new Error('レジストリの こうちくに しっぱい');
    for (const id of r.value.units.keys()) {
      for (const key of [`skill:${id}`, `pinch:${id}`, `retire:${id}`]) {
        expect(`${key} => ${r.value.lines.has(key)}`).toContain('true');
      }
    }
  });
});
```

- [ ] **Step 3: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/engine/loader.test.ts`
Expected: FAIL —「Failed to resolve import "./loader"」

- [ ] **Step 4: `src/engine/loader.ts` を書く**

```ts
import { buildRegistry } from './registry';
import type { Registry } from './registry';
import type { Validated } from './schema';

/**
 * ビルド時にアセットをバンドルへ同梱する。非同期ロードとローディング画面を作らずに済み、
 * Cloudflare Workers Static Assets 上でもパス解決の問題が起きない。
 * 実行時に外部ファイルから読みたくなったら、差し替えるのはこの1本だけでよい。
 */
export function assetFiles(): Record<string, unknown> {
  return import.meta.glob('/assets/**/*.json', { eager: true, import: 'default' });
}

export function loadRegistry(knownSkillIds: readonly string[]): Validated<Registry> {
  return buildRegistry(assetFiles(), knownSkillIds);
}
```

- [ ] **Step 5: テストが通ることを確かめる**

Run: `npm test && npm run build`
Expected: PASS。既存の 288 件も含めてすべて緑。落ちた場合はアセットの座標か写し漏れなので、エラーメッセージの `file` / `path` / `reason` を見て直す

- [ ] **Step 6: コミット**

```bash
git add assets/ src/engine/loader.ts src/engine/loader.test.ts
git commit -m "feat(engine): アセットを JSON へ書き出し、ローダを追加"
```

---

# フェーズ 2: ユニオン型の全廃とレジストリへの切り替え

ID をコンパイル時の閉じたユニオンからレジストリ照合へ移す。**ゲームの挙動は変えない。**（例外はセーブで、version 2 に上がるため旧セーブは破棄される。設計書 2 節・9 節が明示的に許している）

このフェーズの終わりで `src/content/characters.ts` / `enemies.ts` / `lines.ts` が消え、`src/content/stages/` だけが残る。

### Task 6: ユニオン型を `string` に開く

型だけを触る。`src/content/` はまだ生きたまま、`Record<CharId, X>` を `Record<string, X>` に開く。**挙動は1ミリも変わらない**ので、既存テストは修正なしか、型注釈の修正だけで緑に戻るはずである。

**Files:**
- Modify: `src/core/types.ts:3-8,30-108`（ユニオン型と `CHAR_IDS` の削除、フィールド改名）
- Modify: `src/content/characters.ts:1,6,21`
- Modify: `src/content/enemies.ts:1,4,22`
- Modify: `src/core/progress.ts:1-2,25,67-81`
- Modify: `src/core/bonds.ts:2,6,14-16,25-29,42`
- Modify: `src/core/skills.ts:4,26,33`
- Modify: `src/core/sim.ts:7,13-15,34-35,120-121`
- Modify: `src/core/dialogue.ts:2,6,11`
- Modify: `src/core/state.ts:4-13,20,33,61-68,88`
- Modify: `src/save/save.ts:2-4,23-35,52-56`
- Modify: `src/ui/flow.ts:3,6,14,26-31`
- Modify: `src/ui/hit.ts:2,12,21`
- Modify: `src/ui/screens.ts:5,13,79,123`
- Modify: `src/render/draw.ts:9,122,188`
- Modify: `src/main.ts:24`
- Test: 既存のテストのうち型注釈が壊れたものだけを直す

**Interfaces:**
- Consumes: なし
- Produces:
  - `core/types.ts` から `CharId` / `EnemyKind` / `SkillId` / `CHAR_IDS` が消える。`progress.ts` から `TitleId` が消える
  - `AllyUnit.id: string` / `AllyUnit.skill: string` / `EnemyUnit.kind: string` / `EnemyUnit.engagedWith: string | null`
  - `AllyUnit.seenKinds: EnemyKind[]` → `AllyUnit.seenDefIds: string[]`
  - `Speaker = { side: 'ally' | 'enemy'; id: string }`
  - `const ALL_CHAR_IDS: readonly string[] = Object.keys(CHARACTERS)`（`src/content/characters.ts` が公開する暫定の置き換え。Task 10 で消える）

- [ ] **Step 1: `src/core/types.ts` からユニオン型を落とす**

3〜8 行目と 8 行目の `CHAR_IDS` を削除し、`AttackKind` は残す。`Vec2` の定義はそのまま（`engine/schema.ts` にも同名の型があるが、TypeScript は構造で判定するので相互運用できる。Task 7 で `core/types.ts` 側を `engine` からの再エクスポートに置き換える）。

置き換える箇所:

```ts
export type AttackKind = 'melee' | 'bow';

export type AllyUnit = {
  id: string;
  // ...（変更なし）
  skill: string;
  // ...
  /** このステージで交戦したことのある敵の defId */
  seenDefIds: string[];
};

export type EnemyUnit = {
  uid: string;
  kind: string;
  // ...
  engagedWith: string | null;
  lastHitBy: string | null;
  // ...
};

export type Speaker = { side: 'ally' | 'enemy'; id: string };

export type SpawnEntry = { at: number; kind: string; from: Vec2 };

export type SimEvent =
  | { type: 'engage'; allyId: string; enemyUid: string; kind: string; firstMeeting: boolean }
  | { type: 'skill'; allyId: string; skill: string }
  | { type: 'pinch'; allyId: string }
  | { type: 'hit'; targetPos: Vec2; amount: number }
  | { type: 'enemyDefeated'; uid: string; kind: string; byAlly: string | null }
  | { type: 'garumRepelled'; byAlly: string | null }
  | { type: 'allyRetired'; allyId: string }
  | { type: 'bondSupport'; supporterId: string; targetId: string }
  | { type: 'fortDamaged'; amount: number };

export type BattleState = {
  // ...
  stats: Record<string, CharBattleStats>;
  // ...
};
```

- [ ] **Step 2: `src/content/characters.ts` と `enemies.ts` を `Record<string, ...>` にする**

```ts
// characters.ts
export type CharDef = { id: string; /* 以下変更なし */ skill: string; color: string };
export const CHARACTERS: Record<string, CharDef> = { /* 中身は変更なし */ };
/** CHAR_IDS の置き換え。Task 10 でレジストリに移り、このファイルごと消える */
export const ALL_CHAR_IDS: readonly string[] = Object.keys(CHARACTERS);
```

```ts
// enemies.ts
export type EnemyDef = { kind: string; /* 以下変更なし */ };
export const ENEMIES: Record<string, EnemyDef> = { /* 中身は変更なし */ };
```

`noUncheckedIndexedAccess: true` なので `CHARACTERS[id]` / `ENEMIES[kind]` の戻り値が `| undefined` になる。参照している全箇所（`state.ts:21,34`, `sim.ts:60,134,146,192,247,275`, `skills.ts`, `draw.ts:109,126,197,236`, `screens.ts:82,87,129,136,178,228,235`）で `undefined` を扱う必要が出る。**アクセスをヘルパ1本に集約して、そこで例外を投げる**:

```ts
// src/content/characters.ts
export function charDef(id: string): CharDef {
  const def = CHARACTERS[id];
  if (!def) throw new Error(`しらない キャラ: ${id}`);
  return def;
}
```

```ts
// src/content/enemies.ts
export function enemyDef(kind: string): EnemyDef {
  const def = ENEMIES[kind];
  if (!def) throw new Error(`しらない てき: ${kind}`);
  return def;
}
```

`CHARACTERS[x]` / `ENEMIES[x]` の直接参照をすべて `charDef(x)` / `enemyDef(x)` に置き換える。Task 10 でこれがレジストリ引きに置き換わる。

- [ ] **Step 3: `progress.ts` の `TitleId` を `string` に開く**

```ts
export const TITLE_LABELS: Record<string, string> = { /* 中身は変更なし */ };
export const TITLE_OWNER: Record<string, string | null> = { /* 中身は変更なし */ };

export function accumulateCounters(
  prev: Counters,
  stats: Record<string, CharBattleStats>,
): Counters {
  let bondSupports = prev.bondSupports;
  for (const s of Object.values(stats)) bondSupports += s.bondSupports;

  const of = (id: string): CharBattleStats =>
    stats[id] ?? { defeats: 0, skillUses: 0, neraiuchiKills: 0, kakenukeruHits: 0, bondSupports: 0 };

  return {
    funbaruUses: prev.funbaruUses + of('roran').skillUses,
    neraiuchiKills: prev.neraiuchiKills + of('ines').neraiuchiKills,
    omajinaiUses: prev.omajinaiUses + of('mist').skillUses,
    kakenukeruHits: prev.kakenukeruHits + of('gau').kakenukeruHits,
    bondSupports,
  };
}

const TITLE_RULES: { id: string; test: (c: Counters) => boolean }[] = [ /* 中身は変更なし */ ];

export function earnedTitles(c: Counters): string[] {
  return TITLE_RULES.filter((r) => r.test(c)).map((r) => r.id);
}
```

キャラ名のハードコードはここでは残す（Task 9 で消す）。

- [ ] **Step 4: 残りのファイルの `CharId` / `EnemyKind` / `SkillId` / `TitleId` を `string` に置き換える**

`CHAR_IDS` を参照している箇所（`state.ts:68,78`, `progress.ts:72`, `save.ts:33,53`, `flow.ts:31`, `screens.ts:79,123`）は `ALL_CHAR_IDS` に置き換える。`save.ts` の `TitleId[]` は `string[]`、`Record<CharId, CharProgress>` は `Record<string, CharProgress>` にする。

`ally.seenKinds` → `ally.seenDefIds` の改名は `state.ts:57` と `sim.ts:120-121` の2箇所。

- [ ] **Step 5: テストを走らせ、型注釈だけを直す**

Run: `npm test && npm run build`
Expected: PASS 288 件。テストファイル側で `CharId` / `EnemyKind` / `TitleId` を import している箇所（`save.test.ts` / `progress.test.ts` / `flow.test.ts` / `sim.test.ts` / `dialogue.test.ts`）は import を落として `string` にする。**テストの期待値は1つも変えないこと。** 期待値を変えたくなったら、それは挙動を変えてしまった証拠なので実装を見直す

- [ ] **Step 6: コミット**

```bash
git add -A src/
git commit -m "refactor(core): CharId / EnemyKind / SkillId / TitleId を string に開く"
```

---

### Task 7: `core` をレジストリ参照に切り替える

`core` が `src/content/` ではなく `Registry` から定義を引くようにする。`BattleState` にレジストリを持たせ、`sim` はそこから引く。ステージだけはまだ `src/content/stages/` の旧 `StageDef` を使う（ウェーブが残っているため）。

**Files:**
- Modify: `src/core/types.ts`（`Vec2` / `AttackKind` を `engine/schema` からの再エクスポートにし、`BattleState` に `reg` を足す）
- Modify: `src/core/state.ts`
- Modify: `src/core/sim.ts`
- Modify: `src/core/bonds.ts`
- Modify: `src/core/dialogue.ts`
- Modify: `src/core/combat.ts:2,54`（`MELEE_RANGE` の import 元を `src/content/characters` から自前の定数へ）
- Modify: `src/core/skills.ts:2`（同上）
- Create: `src/core/constants.ts`
- Modify: 上記の各テスト（レジストリを渡すヘルパを足す）
- Create: `src/core/testing.ts`（テスト用にレジストリを組むヘルパ。本番コードからは import しない）

**Interfaces:**
- Consumes: `Registry` / `loadRegistry` (Task 4, 5)
- Produces:
  - `core/constants.ts`: `export const MELEE_RANGE = 24; export const BOW_RANGE = 160;`
  - `BattleState.reg: Registry`
  - `function createBattleState(reg: Registry, stage: StageDef, progress: Record<string, CharProgress>, seed: number): BattleState`
  - `function bondSupporters(reg: Registry, selfId: string, selfPos: Vec2, others: BondSupporter[]): { id: string; bonus: number }[]`
  - `function bondBonus(reg: Registry, selfId: string, selfPos: Vec2, others: BondSupporter[]): number`
  - `function pickDialogue(reg: Registry, events: SimEvent[]): DialogueRequest[]`
  - `function pickWaveIntro(reg: Registry, stage: Pick<StageDef, 'waves'>, waveIndex: number): DialogueRequest[]`
  - `core/testing.ts`: `function testRegistry(): Registry` — `loadRegistry(['funbaru','neraiuchi','omajinai','kakenukeru'])` を1度だけ呼んでキャッシュし、失敗したら例外を投げる

- [ ] **Step 1: `src/core/testing.ts` を書く**

テストが毎回レジストリを組み直すと遅いので1度だけ組む。

```ts
import { loadRegistry } from '../engine/loader';
import { SKILL_EFFECT_IDS } from './skills';
import type { Registry } from '../engine/registry';

let cached: Registry | null = null;

/** テスト専用。じっさいの assets/ からレジストリを組み、失敗したら理由つきで落とす */
export function testRegistry(): Registry {
  if (cached) return cached;
  const r = loadRegistry(SKILL_EFFECT_IDS);
  if (!r.ok) {
    throw new Error(
      'assets の よみこみに しっぱい:\n' +
        r.errors.map((e) => `  ${e.file} ${e.path}: ${e.reason}`).join('\n'),
    );
  }
  cached = r.value;
  return cached;
}
```

`SKILL_EFFECT_IDS` は Task 8 で `SKILL_EFFECTS` から導出するが、この時点では `skills.ts` に直書きで置く:

```ts
// src/core/skills.ts の先頭付近
export const SKILL_EFFECT_IDS: readonly string[] = ['funbaru', 'neraiuchi', 'omajinai', 'kakenukeru'];
```

- [ ] **Step 2: `src/core/constants.ts` を作り、`src/content/` への import を切る**

```ts
/** 近接の間合い。ユニット定義の range とは別に、脅威判定・かけぬけるの当たり判定に使う */
export const MELEE_RANGE = 24;
export const BOW_RANGE = 160;
```

`combat.ts:2` と `skills.ts:2` の `import { MELEE_RANGE } from '../content/characters'` を `from './constants'` に変える。

- [ ] **Step 3: 失敗するテストを書く**

`src/core/state.test.ts` の先頭に追加する。

```ts
import { testRegistry } from './testing';

describe('createBattleState: レジストリ参照', () => {
  it('レジストリの UnitDef から 味方を つくる', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    const roran = s.allies.find((a) => a.id === 'roran')!;
    expect(roran.maxHp).toBe(reg.units.get('roran')!.maxHp);
    expect(roran.skill).toBe('funbaru');
  });

  it('state から レジストリを 引ける', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    expect(s.reg).toBe(reg);
  });

  it('roster は レジストリの units の じゅんばん', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    expect(s.allies.map((a) => a.id)).toEqual([...reg.units.keys()]);
  });
});
```

（`STAGE` / `PROGRESS` は既存の `state.test.ts` にあるフィクスチャ。`PROGRESS` は `Record<string, CharProgress>` に型を開く）

- [ ] **Step 4: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/core/state.test.ts`
Expected: FAIL —「Expected 3 arguments, but got 3」ではなく、`createBattleState` の第1引数が `StageDef` のままなので型エラー／実行時エラー

- [ ] **Step 5: `core` をレジストリ参照へ書き換える**

`src/core/types.ts`:

```ts
export type { AttackKind, Vec2 } from '../engine/schema';
import type { Registry } from '../engine/registry';
import type { Vec2 } from '../engine/schema';

export type BattleState = {
  reg: Registry;
  stage: StageDef;
  // ...以下は変更なし
};
```

`src/core/state.ts`:

```ts
import { computeFlowField, isWalkableAt, makeGrid } from './field';
import { makeRng } from './rng';
import { FORT_MAX_HP } from './types';
import type { Registry } from '../engine/registry';
import type { UnitDef } from '../engine/schema';
import type { AllyUnit, BattleState, CharBattleStats, CharProgress, StageDef, Vec2 } from './types';

const HP_PER_LEVEL = 3;
const POWER_PER_LEVEL = 1;
const WAVE_HEAL_RATIO = 0.3;
const REVIVE_HP_RATIO = 0.5;

export function statsForLevel(def: UnitDef, level: number): { maxHp: number; power: number } {
  const steps = Math.max(0, level - 1);
  return { maxHp: def.maxHp + steps * HP_PER_LEVEL, power: def.power + steps * POWER_PER_LEVEL };
}

function makeAlly(def: UnitDef, level: number, pos: Vec2): AllyUnit {
  const { maxHp, power } = statsForLevel(def, level);
  return {
    id: def.id,
    pos: { ...pos },
    hp: maxHp, maxHp, power,
    guard: def.guard, attack: def.attack, range: def.range,
    attackInterval: def.attackInterval, speed: def.speed,
    skill: def.skillId ?? '',
    goalField: null, goalPos: null, engagedWith: null, attackCooldown: 0,
    skillUsed: false, retired: false,
    funbaruUntil: -1, neraiuchiArmed: false, pinchShown: false,
    seenDefIds: [],
  };
}

export function createBattleState(
  reg: Registry,
  stage: StageDef,
  progress: Record<string, CharProgress>,
  seed: number,
): BattleState {
  const grid = makeGrid(stage.cell, stage.mapRows);
  const stats: Record<string, CharBattleStats> = {};
  const allies: AllyUnit[] = [];
  for (const def of reg.units.values()) {
    stats[def.id] = emptyStats();
    allies.push(makeAlly(def, progress[def.id]?.level ?? 1, stage.fort));
  }
  return {
    reg, stage, grid,
    enemyField: computeFlowField(grid, stage.fort),
    fortHp: FORT_MAX_HP, waveIndex: 0, time: 0, phase: 'placement',
    allies, enemies: [], pending: [], events: [],
    rng: makeRng(seed), stats, nextEnemyUid: 1,
  };
}
```

> **注意** — `statsForLevel` の引数が `(id, level)` から `(def, level)` に変わる。`progress.ts` からこの関数を使っている箇所はないが、`ui/screens.ts` が将来使う。**`statsForLevel` は `state.ts` に残し、`progress.ts` には移さない**（レジストリを引数に取らずに済むため）。

`src/core/sim.ts` — `ENEMIES[...]` / `enemyDef(...)` をすべて `state.reg.enemies.get(...)` に置き換える。取り出しはヘルパにまとめる:

```ts
function enemyDefOf(state: BattleState, enemy: EnemyUnit): EnemyDef {
  const def = state.reg.enemies.get(enemy.kind);
  if (!def) throw new Error(`しらない てき: ${enemy.kind}`);
  return def;
}
```

`bondSupporters(ally.id, ally.pos, state.allies)` は `bondSupporters(state.reg, ally.id, ally.pos, state.allies)` になる。

`src/core/bonds.ts` — `BONDS` 定数を消し、`reg.bonds` を引く:

```ts
import { distance } from './field';
import type { Registry } from '../engine/registry';
import type { Vec2 } from './types';

export const BOND_RANGE = 200;

export type BondSupporter = { id: string; pos: Vec2; retired: boolean };

function bonusBetween(reg: Registry, a: string, b: string): number {
  for (const bond of reg.bonds) {
    if ((bond.a === a && bond.b === b) || (bond.a === b && bond.b === a)) return bond.bonus;
  }
  return 0;
}

export function bondSupporters(
  reg: Registry,
  selfId: string,
  selfPos: Vec2,
  others: BondSupporter[],
): { id: string; bonus: number }[] {
  const result: { id: string; bonus: number }[] = [];
  for (const other of others) {
    if (other.id === selfId || other.retired) continue;
    const bonus = bonusBetween(reg, selfId, other.id);
    if (bonus === 0) continue;
    if (distance(selfPos, other.pos) > BOND_RANGE) continue;
    result.push({ id: other.id, bonus });
  }
  return result;
}

export function bondBonus(reg: Registry, selfId: string, selfPos: Vec2, others: BondSupporter[]): number {
  return bondSupporters(reg, selfId, selfPos, others).reduce((sum, s) => sum + s.bonus, 0);
}
```

`src/core/dialogue.ts` — `LINES` を `reg.lines` に置き換える。`make(reg, speaker, lineId)` で `reg.lines.get(lineId)` を引く。`pickDialogue` / `pickWaveIntro` の第1引数に `reg` を足す。**`RIVAL_SPEAKERS` と `ev.kind === 'garum'` のハードコードはこの時点では残す**（消すのはフェーズ 8 の Task 23。ここで触ると挙動が変わる）。

`src/core/skills.ts` — `BOND_RANGE` の代わりに `skillParam(state.reg, 'omajinai', 'range', BOND_RANGE)` を、`FUNBARU_DURATION` の代わりに `skillParam(state.reg, 'funbaru', 'duration', FUNBARU_DURATION)` を使う。`bondSupporters` 呼び出しに `state.reg` を足す。

- [ ] **Step 6: 既存テストの呼び出しにレジストリを足す**

`state.test.ts` / `sim.test.ts` / `sim-combat.test.ts` / `skills.test.ts` / `bonds.test.ts` / `dialogue.test.ts` で、`createBattleState` / `bondSupporters` / `bondBonus` / `pickDialogue` / `pickWaveIntro` の呼び出しに `testRegistry()` を渡す。**期待値は変えない。**

- [ ] **Step 7: テストが通ることを確かめる**

Run: `npm test && npm run build`
Expected: PASS。件数は 288 + Step 3 の 3 件 = 291 件

- [ ] **Step 8: コミット**

```bash
git add -A src/
git commit -m "refactor(core): 定義の さんしょうを src/content から レジストリへ"
```

---

### Task 8: スキル効果を `SKILL_EFFECTS` レジストリへ

`skills.ts` の `switch (ally.skill)` を、ID 引きのテーブルに変える。効果そのものは変えない。これで「`skills.json` にあるが実装がない」を Task 4 の検証が検出できるようになる。

**Files:**
- Modify: `src/core/skills.ts`（全面）
- Modify: `src/core/skills.test.ts`（末尾に追加）

**Interfaces:**
- Consumes: `skillParam` (Task 4), `BattleState` (Task 7)
- Produces:
  - `type SkillContext = { state: BattleState; self: AllyUnit; dest?: Vec2 }`
  - `type SkillEffect = (ctx: SkillContext) => number | null` — 戻り値は「命中数」。効果が発動できなかったら `null`。かけぬける以外は常に `0`
  - `const SKILL_EFFECTS: Record<string, SkillEffect>`
  - `const SKILL_EFFECT_IDS: readonly string[]`（`Object.keys(SKILL_EFFECTS)`。Task 7 の直書きを置き換える）
  - `function canUseSkill(state: BattleState, allyId: string): boolean`（変更なし）
  - `function useSkill(state: BattleState, allyId: string, dest?: Vec2): boolean`（レジストリ引きに）

- [ ] **Step 1: 失敗するテストを書く**

`src/core/skills.test.ts` の末尾に追加する。

```ts
import { SKILL_EFFECTS, SKILL_EFFECT_IDS } from './skills';
import { testRegistry } from './testing';

describe('SKILL_EFFECTS', () => {
  it('skills.json の すべての id に こうかの じっそうが ある', () => {
    const reg = testRegistry();
    for (const id of reg.skills.keys()) {
      expect(`${id} => ${SKILL_EFFECTS[id] !== undefined}`).toContain('true');
    }
  });

  it('SKILL_EFFECT_IDS は SKILL_EFFECTS の キーと 一致する', () => {
    expect([...SKILL_EFFECT_IDS].sort()).toEqual(Object.keys(SKILL_EFFECTS).sort());
  });

  it('しらない skillId の ユニットは スキルを つかえない', () => {
    const s = fresh();
    const roran = ally(s, 'roran');
    roran.skill = 'sonzaishinai';
    expect(useSkill(s, 'roran')).toBe(false);
    expect(roran.skillUsed).toBe(false);
  });

  it('ふんばりの もちじかんを skills.json から よむ', () => {
    const s = fresh();
    useSkill(s, 'roran');
    expect(ally(s, 'roran').funbaruUntil).toBe(s.time + s.reg.skills.get('funbaru')!.params.duration!);
  });
});
```

（`fresh` / `ally` は既存の `skills.test.ts` にあるヘルパ）

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/core/skills.test.ts`
Expected: FAIL —「SKILL_EFFECTS is not defined」

- [ ] **Step 3: `src/core/skills.ts` を書き換える**

```ts
import { bondSupporters, BOND_RANGE } from './bonds';
import { MELEE_RANGE } from './constants';
import { skillParam } from '../engine/registry';
import { distance, distanceToSegment, isWalkableAt } from './field';
import type { AllyUnit, BattleState, Vec2 } from './types';

/** skills.json に値がなかったときのふぉーるばっく。JSON が正なのでふつうは使われない */
export const FUNBARU_DURATION = 5;
export const OMAJINAI_HEAL = 12;
export const KAKENUKERU_DAMAGE = 5;

export function isFunbaruActive(ally: AllyUnit, time: number): boolean {
  return time < ally.funbaruUntil;
}

function isPathWalkable(state: BattleState, from: Vec2, dest: Vec2): boolean {
  const step = state.grid.cell / 2;
  const steps = Math.max(1, Math.ceil(distance(from, dest) / step));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const p = { x: from.x + (dest.x - from.x) * t, y: from.y + (dest.y - from.y) * t };
    if (!isWalkableAt(state.grid, p)) return false;
  }
  return true;
}

export type SkillContext = { state: BattleState; self: AllyUnit; dest?: Vec2 };

/**
 * 効果の本体。戻り値は「当てた数」で、称号のカウンタ（skill:<id>:hits）に積まれる。
 * 発動できなかった場合だけ null を返す。呼び出し側はそのとき使用回数も消費させない。
 */
export type SkillEffect = (ctx: SkillContext) => number | null;

export const SKILL_EFFECTS: Record<string, SkillEffect> = {
  funbaru: ({ state, self }) => {
    self.funbaruUntil = state.time + skillParam(state.reg, 'funbaru', 'duration', FUNBARU_DURATION);
    return 0;
  },

  neraiuchi: ({ self }) => {
    self.neraiuchiArmed = true;
    return 0;
  },

  omajinai: ({ state, self }) => {
    const range = skillParam(state.reg, 'omajinai', 'range', BOND_RANGE);
    const heal = skillParam(state.reg, 'omajinai', 'heal', OMAJINAI_HEAL);
    const candidates = state.allies.filter((a) => !a.retired && distance(self.pos, a.pos) <= range);
    if (candidates.length === 0) return null;
    let target = candidates[0]!;
    for (const c of candidates) {
      if (c.hp / c.maxHp < target.hp / target.maxHp) target = c;
    }
    target.hp = Math.min(target.maxHp, target.hp + heal);
    return 0;
  },

  kakenukeru: ({ state, self, dest }) => {
    if (!dest) return null;
    if (!isWalkableAt(state.grid, dest)) return null;
    const from = { ...self.pos };
    if (!isPathWalkable(state, from, dest)) return null;
    const damage = skillParam(state.reg, 'kakenukeru', 'damage', KAKENUKERU_DAMAGE);
    let hits = 0;
    for (const enemy of state.enemies) {
      if (distanceToSegment(enemy.pos, from, dest) > MELEE_RANGE) continue;
      enemy.hp -= damage;
      enemy.lastHitBy = self.id;
      enemy.lastHitNeraiuchi = false;
      hits++;
      state.events.push({ type: 'hit', targetPos: { ...enemy.pos }, amount: damage });
    }
    self.pos = { ...dest };
    self.goalField = null;
    self.goalPos = null;
    self.engagedWith = null;
    return hits;
  },
};

export const SKILL_EFFECT_IDS: readonly string[] = Object.keys(SKILL_EFFECTS);

export function canUseSkill(state: BattleState, allyId: string): boolean {
  if (state.phase !== 'wave') return false;
  const ally = state.allies.find((a) => a.id === allyId);
  if (!ally) return false;
  return !ally.retired && !ally.skillUsed;
}

export function useSkill(state: BattleState, allyId: string, dest?: Vec2): boolean {
  if (!canUseSkill(state, allyId)) return false;
  const self = state.allies.find((a) => a.id === allyId)!;
  const effect = SKILL_EFFECTS[self.skill];
  if (!effect) return false;

  const hits = effect({ state, self, dest });
  if (hits === null) return false;

  self.skillUsed = true;
  state.stats[allyId]!.skillUses += 1;
  state.stats[allyId]!.kakenukeruHits += hits;
  state.events.push({ type: 'skill', allyId, skill: self.skill });
  return true;
}
```

> **`kakenukeruHits` を `hits` で埋めることについて** — この時点では `CharBattleStats` の形を変えずに済ませる。Task 9 で `stats` ごと `counters` に置き換わり、`skill:<id>:hits` という汎用キーになる。

- [ ] **Step 4: `src/core/testing.ts` の import を直す**

Task 7 で直書きした `SKILL_EFFECT_IDS` が `SKILL_EFFECTS` から導出されるようになったので、`skills.ts` の直書き定義行を消す（import 側は変更不要）。

- [ ] **Step 5: テストが通ることを確かめる**

Run: `npm test && npm run build`
Expected: PASS 295 件（291 + 4）

- [ ] **Step 6: コミット**

```bash
git add -A src/
git commit -m "refactor(core): スキル効果を SKILL_EFFECTS レジストリへ移す"
```

---

### Task 9: カウンタと称号のデータ化

設計書 6.8。`CharBattleStats` と `TITLE_OWNER` / `TITLE_RULES` を捨て、カウンタを規約キーの `Record<string, number>` に、称号を `titles.json` 駆動にする。ここでキャラ名のハードコードが `core` から完全に消える。

**Files:**
- Create: `src/core/counters.ts`
- Create: `src/core/counters.test.ts`
- Modify: `src/core/types.ts`（`CharBattleStats` を削除、`BattleState.stats` → `BattleState.counters`、`SimEvent` の拡張）
- Modify: `src/core/sim.ts`（`state.stats` の更新を消し、イベントに情報を載せる）
- Modify: `src/core/skills.ts`（同上）
- Modify: `src/core/state.ts`（`stats` → `counters`）
- Modify: `src/core/progress.ts`（`TITLE_LABELS` / `TITLE_OWNER` / `Counters` / `accumulateCounters` / `TITLE_RULES` / `earnedTitles` を削除・置き換え）
- Modify: `src/core/progress.test.ts`（称号まわりを書き換え）
- Modify: `src/ui/flow.ts` / `src/ui/flow.test.ts`
- Modify: `src/save/save.ts` / `src/save/save.test.ts`
- Modify: `src/ui/screens.ts:88-90,233-235`

**Interfaces:**
- Consumes: `Registry` / `TitleDef` (Task 4)
- Produces:
  - `BattleState.counters: Record<string, number>`（`stats` を置き換え）
  - `SimEvent` の変更点:
    - `{ type: 'skill'; allyId: string; skill: string; hits: number }` — `hits` を追加
    - `{ type: 'enemyDefeated'; uid: string; kind: string; byAlly: string | null; neraiuchi: boolean }` — `neraiuchi` を追加
    - `{ type: 'bondSupport'; targetId: string; supporterIds: string[] }` — 1回の攻撃につき1件に集約
  - `core/counters.ts`:
    - `function accumulate(counters: Record<string, number>, events: SimEvent[]): void` — その場で足す
    - `function bump(counters: Record<string, number>, key: string, amount: number): void`
    - `function mergeCounters(prev: Record<string, number>, battle: Record<string, number>, titles: TitleDef[]): Record<string, number>` — **称号が参照するキーだけ**をセーブへ持ち越す。ステージ内だけで使うキー（`defeat:by:<defId>`）はセーブに残さない
    - `const COUNTER_DEFEAT_BY = (defId: string) => \`defeat:by:${defId}\``
  - `progress.ts`:
    - `function earnedTitles(reg: Registry, counters: Record<string, number>): string[]`
    - `function titlesOf(reg: Registry, owned: string[], defId: string): TitleDef[]` — そのユニットが持てる称号（`owner === defId` または `owner === null`）
    - `TITLE_LABELS` / `TITLE_OWNER` / `Counters` / `emptyCounters` / `accumulateCounters` は**削除**

- [ ] **Step 1: 失敗するテストを書く**

`src/core/counters.test.ts` を新規作成する。

```ts
import { describe, expect, it } from 'vitest';
import { accumulate, COUNTER_DEFEAT_BY, mergeCounters } from './counters';
import type { SimEvent } from './types';
import type { TitleDef } from '../engine/schema';

const TITLES: TitleDef[] = [
  { id: 'a', label: 'エー', owner: 'roran', counter: 'skill:funbaru:uses', threshold: 5 },
  { id: 'b', label: 'ビー', owner: null, counter: 'bond:supports', threshold: 20 },
];

describe('accumulate', () => {
  it('スキルの しようかいすうを skill:<id>:uses に つむ', () => {
    const c: Record<string, number> = {};
    accumulate(c, [{ type: 'skill', allyId: 'roran', skill: 'funbaru', hits: 0 }]);
    accumulate(c, [{ type: 'skill', allyId: 'roran', skill: 'funbaru', hits: 0 }]);
    expect(c['skill:funbaru:uses']).toBe(2);
  });

  it('スキルの めいちゅうすうを skill:<id>:hits に つむ', () => {
    const c: Record<string, number> = {};
    accumulate(c, [{ type: 'skill', allyId: 'gau', skill: 'kakenukeru', hits: 3 }]);
    expect(c['skill:kakenukeru:hits']).toBe(3);
    expect(c['skill:kakenukeru:uses']).toBe(1);
  });

  it('めいちゅう 0 でも uses は つむが hits は 0 の まま', () => {
    const c: Record<string, number> = {};
    accumulate(c, [{ type: 'skill', allyId: 'gau', skill: 'kakenukeru', hits: 0 }]);
    expect(c['skill:kakenukeru:uses']).toBe(1);
    expect(c['skill:kakenukeru:hits']).toBe(0);
  });

  it('ねらいうちでの げきはを kill:neraiuchi に つむ', () => {
    const c: Record<string, number> = {};
    const ev: SimEvent[] = [
      { type: 'enemyDefeated', uid: 'e1', kind: 'x', byAlly: 'ines', neraiuchi: true },
      { type: 'enemyDefeated', uid: 'e2', kind: 'x', byAlly: 'ines', neraiuchi: false },
    ];
    accumulate(c, ev);
    expect(c['kill:neraiuchi']).toBe(1);
  });

  it('げきはを defeat:by:<defId> に つむ', () => {
    const c: Record<string, number> = {};
    accumulate(c, [{ type: 'enemyDefeated', uid: 'e1', kind: 'x', byAlly: 'gau', neraiuchi: false }]);
    expect(c[COUNTER_DEFEAT_BY('gau')]).toBe(1);
  });

  it('だれの てがらでも ない げきはは つまない', () => {
    const c: Record<string, number> = {};
    accumulate(c, [{ type: 'enemyDefeated', uid: 'e1', kind: 'x', byAlly: null, neraiuchi: true }]);
    expect(c['kill:neraiuchi']).toBeUndefined();
  });

  it('おうえんは 1かいの こうげきに つき 1 だけ つむ', () => {
    const c: Record<string, number> = {};
    accumulate(c, [{ type: 'bondSupport', targetId: 'roran', supporterIds: ['ines', 'mist'] }]);
    expect(c['bond:supports']).toBe(1);
  });
});

describe('mergeCounters', () => {
  it('しょうごうが さんしょうする キーだけを もちこす', () => {
    const prev = { 'skill:funbaru:uses': 2, 'bond:supports': 1 };
    const battle = { 'skill:funbaru:uses': 3, 'bond:supports': 4, [COUNTER_DEFEAT_BY('gau')]: 9 };
    const merged = mergeCounters(prev, battle, TITLES);
    expect(merged).toEqual({ 'skill:funbaru:uses': 5, 'bond:supports': 5 });
  });

  it('もとに なかった キーも しょうごうが さんしょうするなら 入る', () => {
    const merged = mergeCounters({}, { 'bond:supports': 2 }, TITLES);
    expect(merged['bond:supports']).toBe(2);
  });

  it('たたかいで うごかなかった キーは まえの あたいの まま', () => {
    const merged = mergeCounters({ 'skill:funbaru:uses': 7 }, {}, TITLES);
    expect(merged['skill:funbaru:uses']).toBe(7);
  });
});
```

`src/core/progress.test.ts` の称号テストを次に差し替える。

```ts
import { earnedTitles, titlesOf } from './progress';
import { testRegistry } from './testing';

describe('earnedTitles', () => {
  it('しきいちに とどいた しょうごうだけを かえす', () => {
    const reg = testRegistry();
    expect(earnedTitles(reg, { 'skill:funbaru:uses': 5 })).toEqual(['gamanzuyoi']);
  });

  it('しきいちの 1つ てまえでは かえさない', () => {
    const reg = testRegistry();
    expect(earnedTitles(reg, { 'skill:funbaru:uses': 4 })).toEqual([]);
  });

  it('カウンタが なければ かえさない', () => {
    const reg = testRegistry();
    expect(earnedTitles(reg, {})).toEqual([]);
  });

  it('ふくすうの しょうごうを どうじに かえす', () => {
    const reg = testRegistry();
    const got = earnedTitles(reg, { 'skill:funbaru:uses': 5, 'bond:supports': 20 });
    expect(got.sort()).toEqual(['gamanzuyoi', 'nakayoshi']);
  });
});

describe('titlesOf', () => {
  it('もちぬしの しょうごうと ぜんいん きょうつうの しょうごうを かえす', () => {
    const reg = testRegistry();
    const got = titlesOf(reg, ['gamanzuyoi', 'kazenoyouni', 'nakayoshi'], 'roran');
    expect(got.map((t) => t.id)).toEqual(['gamanzuyoi', 'nakayoshi']);
  });

  it('もっていない しょうごうは かえさない', () => {
    const reg = testRegistry();
    expect(titlesOf(reg, [], 'roran')).toEqual([]);
  });
});
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/core/counters.test.ts src/core/progress.test.ts`
Expected: FAIL —「Failed to resolve import "./counters"」

- [ ] **Step 3: `src/core/counters.ts` を書く**

```ts
import type { TitleDef } from '../engine/schema';
import type { SimEvent } from './types';

/** ステージ内だけで使うカウンタ。経験値の計算に使い、セーブへは持ち越さない */
export const COUNTER_DEFEAT_BY = (defId: string): string => `defeat:by:${defId}`;

export function bump(counters: Record<string, number>, key: string, amount: number): void {
  counters[key] = (counters[key] ?? 0) + amount;
}

/**
 * その tick のイベントからカウンタのキーを起こす。
 * 特定のスキル名・キャラ名をここに書かないこと。キーの規約（設計書 6.8）だけで完結させる。
 */
export function accumulate(counters: Record<string, number>, events: SimEvent[]): void {
  for (const ev of events) {
    switch (ev.type) {
      case 'skill':
        bump(counters, `skill:${ev.skill}:uses`, 1);
        bump(counters, `skill:${ev.skill}:hits`, ev.hits);
        break;
      case 'enemyDefeated':
        if (ev.byAlly === null) break;
        bump(counters, COUNTER_DEFEAT_BY(ev.byAlly), 1);
        if (ev.neraiuchi) bump(counters, 'kill:neraiuchi', 1);
        break;
      case 'bondSupport':
        bump(counters, 'bond:supports', 1);
        break;
      default:
        break;
    }
  }
}

/**
 * 称号が参照するキーだけをセーブへ持ち越す。
 * こうしないと、ステージ内だけで意味のあるキーがセーブに溜まり続ける。
 */
export function mergeCounters(
  prev: Record<string, number>,
  battle: Record<string, number>,
  titles: TitleDef[],
): Record<string, number> {
  const out: Record<string, number> = { ...prev };
  for (const title of titles) {
    const gained = battle[title.counter];
    if (gained === undefined) continue;
    out[title.counter] = (out[title.counter] ?? 0) + gained;
  }
  return out;
}
```

- [ ] **Step 4: `src/core/progress.ts` から称号のハードコードを消す**

`TITLE_LABELS` / `TITLE_OWNER` / `TitleId` / `Counters` / `emptyCounters` / `accumulateCounters` / `TITLE_RULES` を削除し、次を置く。`MAX_LEVEL` / `XP_BASE` / `XP_PER_DEFEAT` / `xpGain` / `xpToNext` / `applyXp` はそのまま残す。

```ts
import type { Registry } from '../engine/registry';
import type { TitleDef } from '../engine/schema';

export function earnedTitles(reg: Registry, counters: Record<string, number>): string[] {
  return reg.titles.filter((t) => (counters[t.counter] ?? 0) >= t.threshold).map((t) => t.id);
}

/** そのユニットが表示すべき称号。owner が一致するものと、全員共通（owner === null）のもの */
export function titlesOf(reg: Registry, owned: string[], defId: string): TitleDef[] {
  const set = new Set(owned);
  return reg.titles.filter((t) => set.has(t.id) && (t.owner === defId || t.owner === null));
}
```

- [ ] **Step 5: `state` / `sim` / `skills` を `counters` に切り替える**

`types.ts`: `CharBattleStats` を削除し、`BattleState.stats` を `counters: Record<string, number>` に。`SimEvent` を Interfaces のとおりに変える。

`state.ts`: `emptyStats` を削除し、`counters: {}` で初期化。

`sim.ts` の変更:

```ts
// resolveAttacks の中
const supporters = bondSupporters(state.reg, ally.id, ally.pos, state.allies);
let bonus = 0;
for (const s of supporters) bonus += s.bonus;
if (supporters.length > 0) {
  state.events.push({
    type: 'bondSupport', targetId: ally.id, supporterIds: supporters.map((s) => s.id),
  });
}
```

```ts
// resolveEnemyRemoval の中
if (enemy.hp <= 0) {
  state.events.push({
    type: 'enemyDefeated',
    uid: enemy.uid, kind: enemy.kind,
    byAlly: enemy.lastHitBy,
    neraiuchi: enemy.lastHitNeraiuchi,
  });
  continue;
}
```

`state.stats[...]` の加算はすべて削除する。代わりに `step` の末尾でイベントから積む:

```ts
import { accumulate } from './counters';

export function step(state: BattleState, commands: SimCommand[], dt: number): void {
  state.events = [];
  if (state.phase !== 'wave') return;
  // ...既存の処理...
  updatePhase(state);
  accumulate(state.counters, state.events);
}
```

`skills.ts` の `useSkill` の末尾:

```ts
  self.skillUsed = true;
  state.events.push({ type: 'skill', allyId, skill: self.skill, hits });
  return true;
```

（`state.stats` への加算 2 行を削除）

- [ ] **Step 6: `ui/flow.ts` と `save/save.ts` を追従させる**

`flow.ts`:

```ts
import { mergeCounters, COUNTER_DEFEAT_BY } from '../core/counters';
import { applyXp, earnedTitles, xpGain } from '../core/progress';
import type { Registry } from '../engine/registry';
import type { BattleState, CharProgress } from '../core/types';
import type { SaveData } from '../save/save';

export type XpGain = {
  id: string;
  before: CharProgress;
  after: CharProgress;
  gained: number;
  leveledUp: boolean;
};

export type StageResult = { save: SaveData; gains: XpGain[]; newTitles: string[] };

export function applyStageClear(
  reg: Registry,
  save: SaveData,
  stageIndex: number,
  battle: BattleState,
): StageResult {
  const chars: Record<string, CharProgress> = { ...save.chars };
  const gains: XpGain[] = [];

  for (const defId of reg.units.keys()) {
    const before = save.chars[defId] ?? { level: 1, xp: 0 };
    const gained = xpGain(battle.counters[COUNTER_DEFEAT_BY(defId)] ?? 0);
    const after = applyXp(before, gained);
    chars[defId] = after;
    gains.push({ id: defId, before, after, gained, leveledUp: after.level > before.level });
  }

  const counters = mergeCounters(save.counters, battle.counters, reg.titles);
  const allTitles = earnedTitles(reg, counters);
  const newTitles = allTitles.filter((t) => !save.titles.includes(t));

  return {
    save: {
      ...save,
      clearedStages: Math.max(save.clearedStages, stageIndex + 1),
      chars, counters, titles: allTitles,
    },
    gains, newTitles,
  };
}
```

`save.ts`: `Counters` 型が消えたので `counters: Record<string, number>` にし、`COUNTER_KEYS` による固定キー検証を「すべての値が非負整数か」に変える。`VALID_TITLE_IDS` の検証はここでは落とす（Task 11 でレジストリ照合に置き換える）。`SAVE_VERSION` はまだ 1 のまま。

```ts
  if (typeof v.counters !== 'object' || v.counters === null || Array.isArray(v.counters)) return false;
  for (const value of Object.values(v.counters as Record<string, unknown>)) {
    if (!isFiniteNonNegInt(value)) return false;
  }
  if (!v.titles.every((t) => typeof t === 'string')) return false;
```

`newSave()` の `counters: emptyCounters()` を `counters: {}` に。

- [ ] **Step 7: `ui/screens.ts` の称号表示を直す**

`drawRoster` の `TITLE_OWNER` / `TITLE_LABELS` 参照を `titlesOf` に置き換える。`drawResult` の `state.stats[g.id]` を使った行は、統計が消えたので次に差し替える:

```ts
    ctx.fillText(`${charDef(g.id).name}`, 90, y);
```

（`drawRoster` / `drawResult` は Task 10 で `reg` を受け取る形に変わるので、ここではまだ `charDef` を使ってよい）

- [ ] **Step 8: テストが通ることを確かめる**

Run: `npm test && npm run build`
Expected: PASS。`counters.test.ts` 10 件が増え、`progress.test.ts` / `save.test.ts` / `flow.test.ts` / `sim.test.ts` は `stats` を見ている箇所を `counters` に書き換えた形で緑になる

- [ ] **Step 9: コミット**

```bash
git add -A src/
git commit -m "refactor(core): カウンタと しょうごうを データくどうに する"
```

---

### Task 10: `render` / `ui` をレジストリ参照へ切り替え、`src/content/` を減らす

描画と画面が `CHARACTERS` / `ENEMIES` / `LINES` を直接見ているのをやめる。これで `src/content/characters.ts` / `enemies.ts` / `lines.ts` が消える。

**Files:**
- Modify: `src/render/draw.ts`（`drawBattle` などに `reg` を渡す）
- Modify: `src/ui/screens.ts`（同上）
- Modify: `src/ui/hit.ts`（`pickAlly` の戻り値が `string | null` になるだけ。すでに Task 6 で済んでいるので変更なしのはず）
- Modify: `src/main.ts`（レジストリの読み込みと、失敗時の停止）
- Modify: `src/ui/screens.ts`（`drawLoadErrors` を追加）
- Delete: `src/content/characters.ts` `src/content/enemies.ts` `src/content/lines.ts` `src/content/content.test.ts`
- Modify: `src/core/constants.ts`（`MELEE_RANGE` / `BOW_RANGE` はすでにここ。追加変更なし）
- Modify: `src/content/stages/stage1.ts` 〜 `stage3.ts`（`from './characters'` などの import がないことを確認する。実際には無い）

**Interfaces:**
- Consumes: `Registry` / `lookupDef` / `titlesOf`
- Produces:
  - `function drawBattle(ctx, reg: Registry, state: BattleState, selected: string | null, effects: EffectState): void`
  - `function drawGoalMarkers(ctx, reg: Registry, state, selected): void`
  - `function drawDragPreview(ctx, reg: Registry, fromMap, toMap, defId: string, blocked: boolean): void`
  - `function drawStageSelect(ctx, reg: Registry, save: SaveData): void`
  - `function drawBottomBar(ctx, reg: Registry, state, selected): void`
  - `function drawSkillButton(ctx, reg: Registry, state, selected): Rect | null`
  - `function drawBubble(ctx, reg: Registry, req: DialogueRequest): void`
  - `function drawResult(ctx, reg: Registry, gains: XpGain[], newTitles: string[]): void` — `state` は不要になる
  - `function drawLoadErrors(ctx, errors: ValidationError[]): void` — 起動時バリデーション失敗の表示

- [ ] **Step 1: `drawLoadErrors` の失敗するテストは書かない**

Canvas 描画関数はこのリポジトリではテストしていない（`draw.ts` / `screens.ts` に対応するテストファイルが無い）。既存の方針に合わせ、このタスクは既存テストが緑のままであることと `npm run build` が通ることで守る。**新しくテストを足すのは `main.ts` に切り出せる純ロジックだけ**にする。

- [ ] **Step 2: `render/draw.ts` の `CHARACTERS` / `ENEMIES` 参照を `reg` に置き換える**

`charDef(id)` / `enemyDef(kind)` を、`reg` を受け取るローカルヘルパに置き換える。

```ts
import { lookupDef } from '../engine/registry';
import type { Registry } from '../engine/registry';

function defOf(reg: Registry, defId: string): { name: string; color: string } {
  return lookupDef(reg, defId) ?? { name: defId, color: '#888888' };
}
```

`drawEnemies` の見た目の分岐（`enemy.kind === 'garum'` で半径を大きく、`'tatemochi'` で盾を描く）は、敵の ID をコードに残す最後の場所になる。**`EnemyDef.maxHp` から半径を導く**ことで ID の直書きを消す:

```ts
function enemyRadius(maxHp: number): number {
  return maxHp >= 40 ? UNIT_R + 3 : UNIT_R;
}
```

盾の描画は `bowDamageCap !== null`（弓を防ぐ敵）を条件にする。どちらもデータから導かれるので、敵を1体足しても `draw.ts` を触らずに済む。

- [ ] **Step 3: `ui/screens.ts` の参照を `reg` に置き換え、`drawLoadErrors` を足す**

`drawSkillButton` のスキル名ラベル辞書（`screens.ts:165-167`）は `reg.skills.get(defId)?.label` に置き換える。`drawRoster` は `titlesOf(reg, save.titles, defId)` を使う。`drawStageSelect` は `reg.stages` を回す。`drawBubble` は `lookupDef(reg, req.speaker.id)` を使う。

```ts
export function drawLoadErrors(ctx: CanvasRenderingContext2D, errors: ValidationError[]): void {
  clear(ctx);
  ctx.fillStyle = '#ff9a9a';
  ctx.font = '28px sans-serif';
  ctx.fillText('データの よみこみに しっぱいしました', 40, 80);
  ctx.fillStyle = INK;
  ctx.font = '16px monospace';
  errors.slice(0, 20).forEach((e, i) => {
    ctx.fillText(`${e.file} ${e.path}: ${e.reason}`, 40, 130 + i * 22);
  });
  if (errors.length > 20) {
    ctx.fillText(`ほか ${errors.length - 20} けん`, 40, 130 + 20 * 22);
  }
}
```

- [ ] **Step 4: `main.ts` で起動時にレジストリを読み、失敗したら停止する**

`main.ts` の先頭（`resize()` の直後）に置く。

```ts
import { loadRegistry } from './engine/loader';
import { SKILL_EFFECT_IDS } from './core/skills';
import { drawLoadErrors } from './ui/screens';

const loadResult = loadRegistry(SKILL_EFFECT_IDS);
if (!loadResult.ok) {
  // 部分的に読めたぶんで続行しない。アセットを足したその場で事故に気づけることを優先する
  const vp = computeViewport(canvas.width, canvas.height);
  ctx.setTransform(vp.scale, 0, 0, vp.scale, vp.offsetX, vp.offsetY);
  drawLoadErrors(ctx, loadResult.errors);
  throw new Error(`assets の よみこみに しっぱい: ${loadResult.errors.length} けん`);
}
const reg = loadResult.value;
```

以降の `createBattleState` / `pickDialogue` / `pickWaveIntro` / `applyStageClear` / `draw*` の呼び出しに `reg` を渡す。

- [ ] **Step 5: `src/content/` から3ファイルを削除する**

```bash
git rm src/content/characters.ts src/content/enemies.ts src/content/lines.ts src/content/content.test.ts
```

`src/content/stages/` だけが残る。

- [ ] **Step 6: テストとビルドが通ることを確かめる**

Run: `npm test && npm run build`
Expected: PASS。`content.test.ts` の 11 件が減る。残った参照があれば `npm run build` の型エラーが指すので順に潰す

- [ ] **Step 7: 手で動作を確かめる**

Run: `npm run dev`
Expected: これまでどおりタイトル → ステージ選択 → 配置 → 戦闘が動く。**ここで挙動が変わっていたらフェーズ 2 のどこかを間違えている。**

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "refactor(ui): びょうがと がめんを レジストリさんしょうへ、src/content の ていぎを けす"
```

---

### Task 11: セーブを version 2 へ

設計書 9 節。旧セーブは読み捨て、キー構成を ID ベースに変える。検証の方針を「1つでも欠けたら全部捨てる」から「壊れたエントリだけ捨て、足りないものは既定値で補う」に変える。これでユニットを1体足してもプレイヤーの進行が消えなくなる。

**Files:**
- Modify: `src/save/save.ts`（全面）
- Modify: `src/save/save.test.ts`（全面書き換え）
- Modify: `src/ui/flow.ts`（`clearedStages` → `clearedStageIds`、`isStageUnlocked`）
- Modify: `src/ui/flow.test.ts`
- Modify: `src/main.ts` / `src/ui/screens.ts`（`save.chars` → `save.units`、`clearedStages` の表示）

**Interfaces:**
- Consumes: `Registry`
- Produces:
  - `const SAVE_VERSION = 2`
  - `type SaveData = { version: 2; clearedStageIds: string[]; units: Record<string, CharProgress>; counters: Record<string, number>; titles: string[] }`
  - `function newSave(reg: Registry): SaveData`
  - `function loadSave(storage: StorageLike, reg: Registry): SaveData | null` — 読めるセーブが無ければ `null`
  - `function isStageUnlocked(reg: Registry, save: SaveData, index: number): boolean` — 先頭は常に解放。それ以外は**1つ前のステージの id** が `clearedStageIds` にあるかで決める（インデックスではなく id で持つので、`stages/` に1本足しても記録がずれない）

- [ ] **Step 1: 失敗するテストを書く**

`src/save/save.test.ts` を全面的に書き換える。

```ts
import { describe, expect, it } from 'vitest';
import { loadSave, newSave, SAVE_KEY, SAVE_VERSION, writeSave } from './save';
import { testRegistry } from '../core/testing';
import type { StorageLike } from './save';

function memoryStorage(initial?: string): StorageLike & { raw: string | null } {
  return {
    raw: initial ?? null,
    getItem(_key: string) { return this.raw; },
    setItem(_key: string, value: string) { this.raw = value; },
  };
}

describe('newSave', () => {
  it('レジストリの すべての ユニットを レベル1で いれる', () => {
    const reg = testRegistry();
    const s = newSave(reg);
    expect(Object.keys(s.units).sort()).toEqual([...reg.units.keys()].sort());
    expect(s.units.roran).toEqual({ level: 1, xp: 0 });
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.clearedStageIds).toEqual([]);
  });
});

describe('loadSave', () => {
  const reg = testRegistry();
  const valid = {
    version: 2,
    clearedStageIds: ['stage1'],
    units: { roran: { level: 3, xp: 10 }, ines: { level: 2, xp: 0 }, mist: { level: 1, xp: 5 }, gau: { level: 1, xp: 0 } },
    counters: { 'bond:supports': 4 },
    titles: ['nakayoshi'],
  };

  it('ただしい セーブを よむ', () => {
    const s = loadSave(memoryStorage(JSON.stringify(valid)), reg);
    expect(s?.units.roran).toEqual({ level: 3, xp: 10 });
    expect(s?.clearedStageIds).toEqual(['stage1']);
  });

  it('セーブが なければ null', () => {
    expect(loadSave(memoryStorage(), reg)).toBeNull();
  });

  it('こわれた JSON なら null', () => {
    expect(loadSave(memoryStorage('{{{'), reg)).toBeNull();
  });

  it('version 1 の きゅうセーブは よみすてる', () => {
    const old = { version: 1, clearedStages: 2, chars: {}, counters: {}, titles: [] };
    expect(loadSave(memoryStorage(JSON.stringify(old)), reg)).toBeNull();
  });

  it('レジストリに ない ユニットの エントリは むしする', () => {
    const raw = { ...valid, units: { ...valid.units, yuurei: { level: 9, xp: 0 } } };
    const s = loadSave(memoryStorage(JSON.stringify(raw)), reg);
    expect(s?.units.yuurei).toBeUndefined();
    expect(s?.units.roran).toEqual({ level: 3, xp: 10 });
  });

  it('レジストリに あって セーブに ない ユニットは レベル1で おぎなう', () => {
    const { gau: _drop, ...units } = valid.units;
    const s = loadSave(memoryStorage(JSON.stringify({ ...valid, units })), reg);
    expect(s?.units.gau).toEqual({ level: 1, xp: 0 });
    expect(s?.units.roran).toEqual({ level: 3, xp: 10 });
  });

  it('かたが こわれた エントリだけを すてて、ほかは のこす', () => {
    const raw = { ...valid, units: { ...valid.units, ines: { level: 'つよい', xp: 0 } } };
    const s = loadSave(memoryStorage(JSON.stringify(raw)), reg);
    expect(s?.units.ines).toEqual({ level: 1, xp: 0 });
    expect(s?.units.roran).toEqual({ level: 3, xp: 10 });
  });

  it('レジストリに ない ステージ id は clearedStageIds から おとす', () => {
    const raw = { ...valid, clearedStageIds: ['stage1', 'kesareta'] };
    expect(loadSave(memoryStorage(JSON.stringify(raw)), reg)?.clearedStageIds).toEqual(['stage1']);
  });

  it('レジストリに ない しょうごうは おとす', () => {
    const raw = { ...valid, titles: ['nakayoshi', 'kesareta'] };
    expect(loadSave(memoryStorage(JSON.stringify(raw)), reg)?.titles).toEqual(['nakayoshi']);
  });

  it('カウンタの あたいが せいすうで なければ その キーだけ おとす', () => {
    const raw = { ...valid, counters: { 'bond:supports': 4, 'kill:neraiuchi': -1 } };
    expect(loadSave(memoryStorage(JSON.stringify(raw)), reg)?.counters).toEqual({ 'bond:supports': 4 });
  });

  it('units が オブジェクトで なければ null', () => {
    expect(loadSave(memoryStorage(JSON.stringify({ ...valid, units: [] })), reg)).toBeNull();
  });
});

describe('writeSave', () => {
  it('かきこめたら true', () => {
    const reg = testRegistry();
    const st = memoryStorage();
    expect(writeSave(st, newSave(reg))).toBe(true);
    expect(JSON.parse(st.raw!).version).toBe(2);
  });

  it('れいがいを なげる ストレージでは false', () => {
    const reg = testRegistry();
    const st: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new Error('いっぱい'); },
    };
    expect(writeSave(st, newSave(reg))).toBe(false);
  });

  it('SAVE_KEY は かわらない', () => {
    expect(SAVE_KEY).toBe('character-tactics/save');
  });
});
```

`src/ui/flow.test.ts` の `isStageUnlocked` テストを差し替える。

```ts
describe('isStageUnlocked', () => {
  const reg = testRegistry();

  it('さいしょの ステージは いつでも あいている', () => {
    expect(isStageUnlocked(reg, { ...newSave(reg), clearedStageIds: [] }, 0)).toBe(true);
  });

  it('1つ まえを クリアしていれば あく', () => {
    const save = { ...newSave(reg), clearedStageIds: ['stage1'] };
    expect(isStageUnlocked(reg, save, 1)).toBe(true);
  });

  it('1つ まえを クリアしていなければ あかない', () => {
    expect(isStageUnlocked(reg, newSave(reg), 1)).toBe(false);
  });

  it('とびこえた さきは あかない', () => {
    const save = { ...newSave(reg), clearedStageIds: ['stage1'] };
    expect(isStageUnlocked(reg, save, 2)).toBe(false);
  });

  it('はんいがいは false', () => {
    expect(isStageUnlocked(reg, newSave(reg), -1)).toBe(false);
    expect(isStageUnlocked(reg, newSave(reg), 99)).toBe(false);
  });
});
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/save/save.test.ts src/ui/flow.test.ts`
Expected: FAIL —「newSave expected 0 arguments, but got 1」等

- [ ] **Step 3: `src/save/save.ts` を書き換える**

```ts
import type { Registry } from '../engine/registry';
import type { CharProgress } from '../core/types';

export const SAVE_KEY = 'character-tactics/save';
export const SAVE_VERSION = 2;

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type SaveData = {
  version: number;
  clearedStageIds: string[];
  units: Record<string, CharProgress>;
  counters: Record<string, number>;
  titles: string[];
};

function isFiniteNonNegInt(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function newSave(reg: Registry): SaveData {
  const units: Record<string, CharProgress> = {};
  for (const id of reg.units.keys()) units[id] = { level: 1, xp: 0 };
  return { version: SAVE_VERSION, clearedStageIds: [], units, counters: {}, titles: [] };
}

/**
 * 壊れたエントリだけを捨て、セーブ全体は捨てない。
 * レジストリに無い ID は無視し、レジストリにあってセーブに無い ID は既定値で補う。
 * これによりコンテンツを足し引きしてもプレイヤーの進行が失われない。
 */
function reconcile(raw: Record<string, unknown>, reg: Registry): SaveData {
  const save = newSave(reg);

  const rawUnits = isPlainObject(raw.units) ? raw.units : {};
  for (const id of reg.units.keys()) {
    const p = rawUnits[id];
    if (!isPlainObject(p) || !isFiniteNonNegInt(p.level) || !isFiniteNonNegInt(p.xp)) continue;
    save.units[id] = { level: p.level as number, xp: p.xp as number };
  }

  if (Array.isArray(raw.clearedStageIds)) {
    const known = new Set(reg.stages.map((s) => s.id));
    save.clearedStageIds = raw.clearedStageIds.filter(
      (id): id is string => typeof id === 'string' && known.has(id),
    );
  }

  if (Array.isArray(raw.titles)) {
    const known = new Set(reg.titles.map((t) => t.id));
    save.titles = raw.titles.filter((id): id is string => typeof id === 'string' && known.has(id));
  }

  if (isPlainObject(raw.counters)) {
    for (const [key, value] of Object.entries(raw.counters)) {
      if (isFiniteNonNegInt(value)) save.counters[key] = value as number;
    }
  }

  return save;
}

export function loadSave(storage: StorageLike, reg: Registry): SaveData | null {
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return null;
    // 旧セーブはマイグレーションせず読み捨てる（設計書 9 節）
    if (parsed.version !== SAVE_VERSION) return null;
    if (!isPlainObject(parsed.units)) return null;
    return reconcile(parsed, reg);
  } catch {
    return null;
  }
}

/** 保存できたら true。localStorage が例外を投げる環境では false */
export function writeSave(storage: StorageLike, data: SaveData): boolean {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: `ui/flow.ts` を追従させる**

```ts
export function isStageUnlocked(reg: Registry, save: SaveData, index: number): boolean {
  if (index < 0 || index >= reg.stages.length) return false;
  if (index === 0) return true;
  const prev = reg.stages[index - 1];
  return prev !== undefined && save.clearedStageIds.includes(prev.id);
}
```

`applyStageClear` の引数を `stageIndex: number` から `stageId: string` に変え、`save.chars` を `save.units` に、`clearedStages` の更新をこうする:

```ts
    clearedStageIds: save.clearedStageIds.includes(stageId)
      ? save.clearedStageIds
      : [...save.clearedStageIds, stageId],
```

- [ ] **Step 5: `main.ts` と `screens.ts` を追従させる**

`loadSave(window.localStorage, reg)` / `newSave(reg)` / `save.units` / `isStageUnlocked(reg, save, i)` / `applyStageClear(reg, save, battle.stage.id, battle)` に置き換える。`screens.ts` の `drawStageSelect` にある「クリア ずみ」判定は `save.clearedStageIds.includes(stage.id)` にする。

> **注意** — この時点で `battle.stage` は旧 `StageDef`（`id: number`）なので、`applyStageClear` に渡す `stageId` は `STAGES[stageIndex]` に対応するレジストリのステージ id が必要になる。`main.ts` の `beginStage(index)` で `reg.stages[index]!.id` を控えておき、そこから渡す。**Task 12 でステージがレジストリ由来になれば、この不整合は消える。**

- [ ] **Step 6: テストが通ることを確かめる**

Run: `npm test && npm run build`
Expected: PASS。`save.test.ts` 17 件、`flow.test.ts` の `isStageUnlocked` 5 件

- [ ] **Step 7: コミット**

```bash
git add -A src/
git commit -m "feat(save): セーブを version 2 の ID ベースに し、こわれた エントリだけを すてる"
```

---

# フェーズ 3: ウェーブの削除

1ステージ = 1マップにする。敵は最初から配置済みになり、時間差スポーンという時間軸の構造が消える。**ここからゲームの手ざわりが変わる。** フェーズ 5 が終わるまでは中途半端な状態（ウェーブは無いのに勝敗条件がまだ砦）が続くので、止めずに進めること。

### Task 12: ステージ定義から敵を直接配置する

`src/content/stages/` を捨て、レジストリのステージを使う。敵はステージ開始時に全員配置される。この時点では敵の `ai` は無視して、全員が**味方の初期配置地点**へ向かう共有フローフィールドを降りてくる（旧・砦が味方の初期位置に置き換わっただけ）。

**Files:**
- Modify: `src/core/types.ts`（`SpawnEntry` / `WaveDef` / 旧 `StageDef` を削除し `engine/schema` の `StageDef` を再エクスポート、`BattlePhase` の値を変更、`BattleState` から `waveIndex` / `pending` を削除、`SimEvent.garumRepelled` を `unitFled` に改名）
- Modify: `src/core/state.ts`（`createBattleState` で敵を配置、`startWave` → `beginBattle`、`placeAlly` → `placeUnit`）
- Modify: `src/core/sim.ts`（`spawnDueEnemies` 削除、`SPAWN_JITTER` 削除、`'wave'` → `'battle'`、`updatePhase` の書き換え、`garumFlees` 参照の削除）
- Modify: `src/core/skills.ts:canUseSkill`（`'wave'` → `'battle'`）
- Modify: `src/core/dialogue.ts`（`pickWaveIntro` → `pickStageIntro`、`garumRepelled` → `unitFled`）
- Modify: `src/core/state.test.ts` / `sim.test.ts` / `sim-combat.test.ts` / `skills.test.ts` / `dialogue.test.ts`
- Delete: `src/content/stages/stage1.ts` `stage2.ts` `stage3.ts` `index.ts` `stages.test.ts`（= `src/content/` が消える）

**Interfaces:**
- Consumes: `Registry.stages` (Task 4), `StageDef` (Task 3)
- Produces:
  - `core/types.ts`: `export type { StageDef, AiDef, VictoryCond, DefeatCond, EnemyPlacement } from '../engine/schema'`
  - `type BattlePhase = 'placement' | 'battle' | 'victory' | 'defeat'`
  - `BattleState` から `waveIndex` / `pending` が消える。`enemyField` は残る（Task 17 でキャッシュに置き換わる）
  - `EnemyUnit.ai: AiDef` — 配置ごとの AI 定義。フェーズ 6 まで読まれないが、ここで持たせておく
  - `const PLACEMENT_RADIUS = 64`
  - `function createBattleState(reg, stage, progress, seed): BattleState` — 味方を `placementZone` に、敵を `stage.enemies` の座標に置く
  - `function placeUnit(state: BattleState, defId: string, pos: Vec2): boolean` — `placementZone` のどれかから `PLACEMENT_RADIUS` 以内、かつ歩けるマスなら移動して `true`
  - `function beginBattle(state: BattleState): void` — `phase` を `'battle'` にし、時間とクールダウンをリセットする
  - `function pickStageIntro(reg: Registry, stage: StageDef): DialogueRequest[]`
  - `SimEvent`: `{ type: 'garumRepelled'; byAlly }` → `{ type: 'unitFled'; uid: string; kind: string; byAlly: string | null }`

- [ ] **Step 1: 失敗するテストを書く**

`src/core/state.test.ts` を、レジストリのステージを使う形に書き換える。旧 `STAGE` フィクスチャは消し、`testRegistry().stages[0]!` を使う。

```ts
import { beginBattle, createBattleState, placeUnit, PLACEMENT_RADIUS } from './state';
import { testRegistry } from './testing';

function fresh() {
  const reg = testRegistry();
  const stage = reg.stages[0]!;
  const progress: Record<string, CharProgress> = {};
  for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
  return { reg, stage, state: createBattleState(reg, stage, progress, 1) };
}

describe('createBattleState: ステージからの はいち', () => {
  it('ステージの roster ぶんだけ 味方を つくる', () => {
    const { stage, state } = fresh();
    expect(state.allies.map((a) => a.id)).toEqual(stage.roster);
  });

  it('味方を placementZone の うえに おく', () => {
    const { stage, state } = fresh();
    for (const ally of state.allies) {
      const near = stage.placementZone.some(
        (z) => Math.hypot(z.pos.x - ally.pos.x, z.pos.y - ally.pos.y) <= PLACEMENT_RADIUS,
      );
      expect(`${ally.id} => ${near}`).toContain('true');
    }
  });

  it('敵を ステージ定義の ざひょうに はいちずみで つくる', () => {
    const { stage, state } = fresh();
    expect(state.enemies.length).toBe(stage.enemies.length);
    expect(state.enemies[0]!.pos).toEqual(stage.enemies[0]!.pos);
    expect(state.enemies[0]!.kind).toBe(stage.enemies[0]!.defId);
  });

  it('敵は それぞれの ai ていぎを もつ', () => {
    const { stage, state } = fresh();
    expect(state.enemies[0]!.ai).toEqual(stage.enemies[0]!.ai);
  });

  it('uid は かぶらない', () => {
    const { state } = fresh();
    expect(new Set(state.enemies.map((e) => e.uid)).size).toBe(state.enemies.length);
  });

  it('はじめは placement フェーズ', () => {
    const { state } = fresh();
    expect(state.phase).toBe('placement');
  });
});

describe('placeUnit', () => {
  it('placementZone の ちかくなら おける', () => {
    const { stage, state } = fresh();
    const zone = stage.placementZone[0]!.pos;
    expect(placeUnit(state, 'roran', { ...zone })).toBe(true);
    expect(state.allies.find((a) => a.id === 'roran')!.pos).toEqual(zone);
  });

  it('placementZone から とおければ おけない', () => {
    const { stage, state } = fresh();
    const far = { x: stage.victory.pos.x, y: stage.victory.pos.y };
    const before = { ...state.allies.find((a) => a.id === 'roran')!.pos };
    expect(placeUnit(state, 'roran', far)).toBe(false);
    expect(state.allies.find((a) => a.id === 'roran')!.pos).toEqual(before);
  });

  it('あるけない マスには おけない', () => {
    const { state } = fresh();
    expect(placeUnit(state, 'roran', { x: 0, y: 0 })).toBe(false);
  });

  it('しらない defId なら false', () => {
    const { state } = fresh();
    expect(placeUnit(state, 'yuurei', { x: 112, y: 208 })).toBe(false);
  });
});

describe('beginBattle', () => {
  it('battle フェーズに する', () => {
    const { state } = fresh();
    beginBattle(state);
    expect(state.phase).toBe('battle');
  });

  it('じかんと クールダウンを リセットする', () => {
    const { state } = fresh();
    state.time = 99;
    state.allies[0]!.attackCooldown = 5;
    beginBattle(state);
    expect(state.time).toBe(0);
    expect(state.allies[0]!.attackCooldown).toBe(0);
  });

  it('敵は そのまま のこる（ウェーブごとに わきなおさない）', () => {
    const { stage, state } = fresh();
    beginBattle(state);
    expect(state.enemies.length).toBe(stage.enemies.length);
  });
});
```

`src/core/sim.test.ts` に追加する。

```ts
describe('ウェーブの さくじょ', () => {
  it('step は battle フェーズでだけ すすむ', () => {
    const { state } = fresh();
    const before = state.enemies[0]!.pos.x;
    step(state, [], 0.5);            // placement のまま
    expect(state.enemies[0]!.pos.x).toBe(before);
    beginBattle(state);
    step(state, [], 0.5);
    expect(state.enemies[0]!.pos.x).not.toBe(before);
  });

  it('じかんが たっても 敵が ふえない', () => {
    const { state } = fresh();
    beginBattle(state);
    const n = state.enemies.length;
    for (let i = 0; i < 600; i++) step(state, [], 1 / 60);
    expect(state.enemies.length).toBeLessThanOrEqual(n);
  });

  it('敵が ぜんめつしたら victory', () => {
    const { state } = fresh();
    beginBattle(state);
    state.enemies = [];
    step(state, [], 1 / 60);
    expect(state.phase).toBe('victory');
  });

  it('とりでが やぶられたら defeat', () => {
    const { state } = fresh();
    beginBattle(state);
    state.fortHp = 0;
    step(state, [], 1 / 60);
    expect(state.phase).toBe('defeat');
  });
});
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/core/state.test.ts`
Expected: FAIL —「placeUnit is not exported」「beginBattle is not exported」

- [ ] **Step 3: `src/core/types.ts` を書き換える**

```ts
export type { AttackKind, Vec2 } from '../engine/schema';
export type { AiDef, DefeatCond, EnemyPlacement, StageDef, VictoryCond } from '../engine/schema';

import type { Registry } from '../engine/registry';
import type { AiDef, StageDef, Vec2 } from '../engine/schema';
import type { Rng } from './rng';

export const FORT_MAX_HP = 30;

export type CharProgress = { level: number; xp: number };

// AllyUnit は変更なし（seenDefIds まで）

export type EnemyUnit = {
  uid: string;
  kind: string;
  /** 配置ごとの AI 定義。フェーズ 6 まで読まれない */
  ai: AiDef;
  pos: Vec2;
  hp: number;
  maxHp: number;
  engagedWith: string | null;
  attackCooldown: number;
  lastHitBy: string | null;
  lastHitNeraiuchi: boolean;
};

export type Speaker = { side: 'ally' | 'enemy'; id: string };

export type BattlePhase = 'placement' | 'battle' | 'victory' | 'defeat';

export type SimEvent =
  | { type: 'engage'; allyId: string; enemyUid: string; kind: string; firstMeeting: boolean }
  | { type: 'skill'; allyId: string; skill: string; hits: number }
  | { type: 'pinch'; allyId: string }
  | { type: 'hit'; targetPos: Vec2; amount: number }
  | { type: 'enemyDefeated'; uid: string; kind: string; byAlly: string | null; neraiuchi: boolean }
  | { type: 'unitFled'; uid: string; kind: string; byAlly: string | null }
  | { type: 'allyRetired'; allyId: string }
  | { type: 'bondSupport'; targetId: string; supporterIds: string[] }
  | { type: 'fortDamaged'; amount: number };

export type BattleState = {
  reg: Registry;
  stage: StageDef;
  grid: Grid;
  /** 味方の初期配置地点をゴールとするフローフィールド。Task 17 でキャッシュに置き換わる */
  enemyField: FlowField;
  fortHp: number;
  time: number;
  phase: BattlePhase;
  allies: AllyUnit[];
  enemies: EnemyUnit[];
  events: SimEvent[];
  counters: Record<string, number>;
  rng: Rng;
  nextEnemyUid: number;
};
```

（`Grid` / `FlowField` の定義はこのファイルにそのまま残す）

- [ ] **Step 4: `src/core/state.ts` を書き換える**

```ts
import { computeFlowField, distance, isWalkableAt, makeGrid } from './field';
import { makeRng } from './rng';
import { FORT_MAX_HP } from './types';
import type { Registry } from '../engine/registry';
import type { StageDef, UnitDef } from '../engine/schema';
import type { AllyUnit, BattleState, CharProgress, EnemyUnit, Vec2 } from './types';

export const PLACEMENT_RADIUS = 64;

// HP_PER_LEVEL / POWER_PER_LEVEL / statsForLevel / makeAlly は Task 7 のまま

function makeEnemy(uid: string, def: EnemyDef, placement: EnemyPlacement): EnemyUnit {
  return {
    uid,
    kind: def.id,
    ai: placement.ai,
    pos: { ...placement.pos },
    hp: def.maxHp,
    maxHp: def.maxHp,
    engagedWith: null,
    attackCooldown: 0,
    lastHitBy: null,
    lastHitNeraiuchi: false,
  };
}

export function createBattleState(
  reg: Registry,
  stage: StageDef,
  progress: Record<string, CharProgress>,
  seed: number,
): BattleState {
  const grid = makeGrid(stage.cell, stage.mapRows);

  const allies = stage.roster.map((defId, i) => {
    const def = reg.units.get(defId);
    if (!def) throw new Error(`roster に しらない ユニット: ${defId}`);
    const zone = stage.placementZone[i % stage.placementZone.length]!;
    return makeAlly(def, progress[defId]?.level ?? 1, zone.pos);
  });

  let nextEnemyUid = 1;
  const enemies = stage.enemies.map((placement) => {
    const def = reg.enemies.get(placement.defId);
    if (!def) throw new Error(`はいちに しらない てき: ${placement.defId}`);
    return makeEnemy(`e${nextEnemyUid++}`, def, placement);
  });

  return {
    reg, stage, grid,
    // フェーズ 6 まで、敵は全員このフィールドを降りてくる。ゴールは味方の初期配置地点
    enemyField: computeFlowField(grid, stage.placementZone[0]!.pos),
    fortHp: FORT_MAX_HP,
    time: 0,
    phase: 'placement',
    allies, enemies, events: [],
    counters: {},
    rng: makeRng(seed),
    nextEnemyUid,
  };
}

export function placeUnit(state: BattleState, defId: string, pos: Vec2): boolean {
  if (!isWalkableAt(state.grid, pos)) return false;
  const inZone = state.stage.placementZone.some((z) => distance(z.pos, pos) <= PLACEMENT_RADIUS);
  if (!inZone) return false;
  const ally = state.allies.find((a) => a.id === defId);
  if (!ally) return false;
  ally.pos = { ...pos };
  ally.goalField = null;
  ally.goalPos = null;
  return true;
}

/** 配置フェーズから戦闘へ。ウェーブが無いので、これはステージ中に1度しか呼ばれない */
export function beginBattle(state: BattleState): void {
  for (const ally of state.allies) {
    ally.engagedWith = null;
    ally.attackCooldown = 0;
    ally.goalField = null;
    ally.goalPos = null;
  }
  state.events = [];
  state.time = 0;
  state.phase = 'battle';
}
```

`startWave` と `placeAlly` と `WAVE_HEAL_RATIO` / `REVIVE_HP_RATIO` は削除する。

- [ ] **Step 5: `src/core/sim.ts` を書き換える**

```ts
export function step(state: BattleState, commands: SimCommand[], dt: number): void {
  state.events = [];
  if (state.phase !== 'battle') return;

  state.time += dt;

  const movedThisTick = applyCommands(state, commands);
  updateEngagements(state, movedThisTick);
  moveUnits(state, dt);
  resolveAttacks(state, dt);
  resolveEnemyRemoval(state);
  resolveAllyRetirement(state);
  resolveFort(state);
  updatePhase(state);
  accumulate(state.counters, state.events);
}
```

`spawnDueEnemies` と `SPAWN_JITTER` を削除する。`resolveEnemyRemoval` の撤退判定から `state.stage.garumFlees` を落とし、イベント名を変える:

```ts
    const def = enemyDefOf(state, enemy);
    if (def.fleeAtHpRatio !== null && enemy.hp / enemy.maxHp < def.fleeAtHpRatio) {
      state.events.push({
        type: 'unitFled', uid: enemy.uid, kind: enemy.kind, byAlly: enemy.lastHitBy,
      });
      continue;
    }
```

`resolveFort` のゴールを配置地点にする:

```ts
function resolveFort(state: BattleState): void {
  const goal = state.stage.placementZone[0]!.pos;
  const survivors: EnemyUnit[] = [];
  for (const enemy of state.enemies) {
    if (enemy.engagedWith === null && distance(enemy.pos, goal) <= FORT_RADIUS) {
      // フェーズ 5 でこの処理ごと消える。それまでの暫定として一律 5 ダメージにする
      state.fortHp -= 5;
      state.events.push({ type: 'fortDamaged', amount: 5 });
      continue;
    }
    survivors.push(enemy);
  }
  state.enemies = survivors;
}
```

`updatePhase` を書き換える:

```ts
function updatePhase(state: BattleState): void {
  if (state.fortHp <= 0) {
    state.fortHp = 0;
    state.phase = 'defeat';
    return;
  }
  // フェーズ 5 で updateObjectives に置き換わる
  if (state.enemies.length === 0) state.phase = 'victory';
}
```

- [ ] **Step 6: `skills.ts` と `dialogue.ts` を追従させる**

`canUseSkill` の `state.phase !== 'wave'` を `state.phase !== 'battle'` にする。

`dialogue.ts` の `pickWaveIntro` を差し替える:

```ts
/** ステージ開始時の会話を、stage.intro の順番どおりに返す */
export function pickStageIntro(reg: Registry, stage: StageDef): DialogueRequest[] {
  const found: DialogueRequest[] = [];
  for (const { speaker, lineId } of stage.intro ?? []) {
    const side = reg.units.has(speaker) ? 'ally' : 'enemy';
    const req = make(reg, { side, id: speaker }, lineId);
    if (req) found.push(req);
  }
  return found;
}
```

`pickDialogue` の `case 'garumRepelled'` を `case 'unitFled'` に変える（`ev.byAlly` を使うところは同じ）。

- [ ] **Step 7: `src/content/` を削除する**

```bash
git rm -r src/content
```

- [ ] **Step 8: 既存テストを直す**

`sim.test.ts` / `sim-combat.test.ts` は、ウェーブ前提のフィクスチャ（`waves` を持つ `STAGE`、`startWave` 呼び出し、`pending` の検査）が壊れる。**`testRegistry().stages[0]` を使う共通の `fresh()` ヘルパに寄せ、`startWave(s)` を `beginBattle(s)` に置き換える。** 敵を任意の位置に置きたいテストは `s.enemies` を直接組み立てる:

```ts
function spawnEnemy(s: BattleState, kind: string, pos: Vec2): EnemyUnit {
  const def = s.reg.enemies.get(kind)!;
  const e: EnemyUnit = {
    uid: `t${s.nextEnemyUid++}`, kind, ai: { kind: 'aggressive' },
    pos: { ...pos }, hp: def.maxHp, maxHp: def.maxHp,
    engagedWith: null, attackCooldown: 0, lastHitBy: null, lastHitNeraiuchi: false,
  };
  s.enemies.push(e);
  return e;
}
```

スポーン・ウェーブ進行・`waveIndex` に関するテストは**削除する**（対象の機能が消えたため）。交戦・攻撃・ダメージ・撤退・退場に関するテストは、上のヘルパで敵を置く形に直したうえで**期待値をそのまま残す**。

- [ ] **Step 9: テストとビルドが通ることを確かめる**

Run: `npm test && npm run build`
Expected: PASS。`stages.test.ts` の 37 件が消え、ウェーブ関連のテストが減り、Step 1 の 14 件が増える

- [ ] **Step 10: コミット**

```bash
git add -A
git commit -m "feat(core): ウェーブを やめ、ステージ定義から 敵を ちょくせつ はいちする"
```

---

### Task 13: `waveCleared` 画面と再配置の削除

画面遷移を「はいち → たたかい → けっか」の一本道にする。

**Files:**
- Modify: `src/main.ts`（`Phase` から `waveCleared` を削除、`onPointerDown` / `onPointerUp` / `update` / `render` の該当分岐を削除）
- Modify: `src/ui/screens.ts`（`drawWaveCleared` を削除、`drawPlacement` を `placementZone` の表示に、`drawResult` の引数から `state` を落とす）
- Modify: `src/render/draw.ts:176-185`（`drawTopBar` から しゅうげき表示を削除）
- Modify: `src/ui/layout.ts`（`BTN.next` は結果画面で使い続ける。変更なし）
- Modify: `README.md`（そうさ表の「しゅうげきクリア中は再配置」を落とす）

**Interfaces:**
- Consumes: `beginBattle` / `placeUnit` (Task 12)
- Produces:
  - `main.ts` の `type Phase = 'title' | 'select' | 'placement' | 'battle' | 'result' | 'defeat'`
  - `function drawPlacement(ctx, state: BattleState): void` — `stage.landings` ではなく `stage.placementZone` を描く

- [ ] **Step 1: `main.ts` から `waveCleared` を落とす**

- `type Phase` から `'waveCleared'` を削除
- `onPointerDown` の `case 'waveCleared'` ブロックを削除
- `onPointerDown` の `case 'placement'` で `startWave(battle)` を `beginBattle(battle)` に、`pickWaveIntro(battle.stage, battle.waveIndex)` を `pickStageIntro(reg, battle.stage)` に置き換える
- `onPointerUp` の `if (phase !== 'placement' && phase !== 'battle' && phase !== 'waveCleared') return;` から `waveCleared` を落とす
- `onPointerUp` の `placeAlly(battle, g.charId, g.dest)` を `placeUnit(battle, g.charId, g.dest)` に
- `update` の `else if (battle.phase === 'waveCleared')` を削除し、`battle.phase === 'stageCleared'` を `'victory'` にする
- `render` の `case 'waveCleared'` を削除
- `const dragPhaseOk = phase === 'placement' || phase === 'battle';`

- [ ] **Step 2: `screens.ts` の `drawWaveCleared` を削除し、`drawPlacement` を書き換える**

```ts
export function drawPlacement(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.fillStyle = 'rgba(16, 24, 32, 0.35)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  // 置ける はんいを 見せる。ここに おけないと プレイヤーが しれない と こまる
  ctx.strokeStyle = '#ffd479';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  for (const z of state.stage.placementZone) {
    const p = mapToLogical(z.pos);
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLACEMENT_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.fillStyle = INK;
  ctx.font = '24px sans-serif';
  ctx.fillText('きいろい わくの なかに なかまを おこう', 40, 380);
  button(ctx, BTN.start, 'はじめる');
}
```

`drawResult` は Task 10 の時点で `(ctx, reg, gains, newTitles)` になっている。追加の変更は要らない。

- [ ] **Step 3: `draw.ts` の `drawTopBar` からウェーブ表示を落とす**

```ts
function drawTopBar(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.fillStyle = COLORS.bar;
  ctx.fillRect(0, 0, LOGICAL_W, 46);
  ctx.fillStyle = COLORS.text;
  ctx.font = '20px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(`とりで ${state.fortHp} / ${FORT_MAX_HP}`, 16, 23);
  ctx.fillText(state.stage.name, 280, 23);
}
```

（`fortHp` の行はフェーズ 5 の Task 16 で消える）

- [ ] **Step 4: テストとビルドが通ることを確かめる**

Run: `npm test && npm run build`
Expected: PASS。件数は Task 12 から変わらない

- [ ] **Step 5: 手で動作を確かめる**

Run: `npm run dev`
Expected: 配置フェーズで黄色い枠が見える。枠の外にはドラッグしても置けない。「はじめる」を押すと戦闘が始まり、敵が最初から全員盤面にいる。敵を全滅させると結果画面へ、砦の HP が尽きると敗北画面へ行く

- [ ] **Step 6: README を直してコミット**

`README.md` の「そうさ」表から「しゅうげきクリア中は再配置」の記述を落とす。

```bash
git add -A
git commit -m "feat(ui): がめん いこうを はいち→たたかい→けっかの いっぽんみちに する"
```

---

# フェーズ 4: ユニット型の統合

`AllyUnit` と `EnemyUnit` を1つの `Unit` にまとめ、`sim.ts` の2本ずつあるループを1本にする。**挙動は変えない。**

### Task 14: `Unit` 型への統合（core）

**Files:**
- Modify: `src/core/types.ts`（`AllyUnit` / `EnemyUnit` を削除し `Unit` を追加、`BattleState.allies` / `enemies` → `units`、`SimEvent` を uid ベースに）
- Modify: `src/core/state.ts`（`makeUnit` に統合）
- Modify: `src/core/sim.ts`（全面。ループを1本化）
- Modify: `src/core/skills.ts`（`state.allies` → 味方の絞り込み）
- Modify: `src/core/bonds.ts`（`BondSupporter` を `Unit` で受ける）
- Modify: `src/core/dialogue.ts`（イベントの形の変更に追従）
- Modify: `src/core/counters.ts`（同上）
- Modify: `src/core/sim.test.ts` / `sim-combat.test.ts` / `state.test.ts` / `skills.test.ts` / `bonds.test.ts` / `dialogue.test.ts` / `counters.test.ts`

**Interfaces:**
- Consumes: `AiDef` (Task 3)
- Produces:
  - `type Unit`（設計書 6.1 のとおり。`level` / `xp` はフィールドとして持つが、書き換わるのはフェーズ 7 から）
  - `type AiState = { def: AiDef; mode: 'idle' | 'chase' | 'return'; targetUid: string | null; home: Vec2 }`
  - `BattleState.units: Unit[]`（`allies` / `enemies` を置き換え）
  - `function playerUnits(state: BattleState): Unit[]` — `side === 'player' && !retired`
  - `function hostilesOf(state: BattleState, self: Unit): Unit[]` — `side !== self.side && !retired`
  - `function unitByUid(state: BattleState, uid: string): Unit | undefined`
  - `type SimCommand = { type: 'move'; uid: string; dest: Vec2 } | { type: 'skill'; uid: string; dest?: Vec2 }`
  - `SimEvent` が全面的に uid ベースになる（下記）
  - `function beginBattle(state: BattleState): void`（変更なし）
  - `function placeUnit(state: BattleState, uid: string, pos: Vec2): boolean` — 引数が defId から uid になる

新しい `SimEvent`:

```ts
export type SimEvent =
  | { type: 'engage'; uid: string; targetUid: string; targetDefId: string; firstMeeting: boolean }
  | { type: 'skill'; uid: string; defId: string; skillId: string; hits: number }
  | { type: 'pinch'; uid: string; defId: string }
  | { type: 'hit'; targetPos: Vec2; amount: number }
  | { type: 'unitDefeated'; uid: string; defId: string; byUid: string | null; byDefId: string | null; neraiuchi: boolean }
  | { type: 'unitFled'; uid: string; defId: string; byUid: string | null; byDefId: string | null }
  | { type: 'unitRetired'; uid: string; defId: string }
  | { type: 'bondSupport'; targetUid: string; targetDefId: string; supporterUids: string[] }
  | { type: 'fortDamaged'; amount: number };
```

> **`unitDefeated` と `unitRetired` の使い分け** — 敵が HP 0 になったら `unitDefeated`、味方が HP 0 になったら `unitRetired` を出す。これは既存の `enemyDefeated` / `allyRetired` の使い分けをそのまま維持したもので、経験値と会話のトリガが別物であるため統合しない。

- [ ] **Step 1: 失敗するテストを書く**

`src/core/sim.test.ts` に追加する。

```ts
describe('ユニット型の とうごう', () => {
  it('味方も 敵も おなじ units に はいる', () => {
    const { stage, state } = fresh();
    expect(state.units.length).toBe(stage.roster.length + stage.enemies.length);
    expect(state.units.filter((u) => u.side === 'player').length).toBe(stage.roster.length);
    expect(state.units.filter((u) => u.side === 'enemy').length).toBe(stage.enemies.length);
  });

  it('てきたい はんていは side の ひかくだけ', () => {
    const { state } = fresh();
    const p = state.units.find((u) => u.side === 'player')!;
    const e = state.units.find((u) => u.side === 'enemy')!;
    expect(hostilesOf(state, p).map((u) => u.uid)).toContain(e.uid);
    expect(hostilesOf(state, p).map((u) => u.uid)).not.toContain(p.uid);
  });

  it('たおれた ユニットは てきたい こうほに ならない', () => {
    const { state } = fresh();
    const p = state.units.find((u) => u.side === 'player')!;
    const e = state.units.find((u) => u.side === 'enemy')!;
    e.retired = true;
    expect(hostilesOf(state, p).map((u) => u.uid)).not.toContain(e.uid);
  });

  it('move コマンドは uid で さす', () => {
    const { state } = fresh();
    beginBattle(state);
    const p = state.units.find((u) => u.side === 'player')!;
    const dest = { ...state.stage.placementZone[0]!.pos };
    step(state, [{ type: 'move', uid: p.uid, dest }], 0.01);
    expect(p.goalPos).toEqual(dest);
  });

  it('こうせん あいては 1たいに つき 1たい', () => {
    const { state } = fresh();
    beginBattle(state);
    const engaged = state.units.filter((u) => u.engagedWith !== null).map((u) => u.engagedWith);
    for (let i = 0; i < 300; i++) step(state, [], 1 / 60);
    const after = state.units.filter((u) => u.engagedWith !== null).map((u) => u.engagedWith!);
    expect(new Set(after).size).toBe(after.length);
    void engaged;
  });

  it('combat: false の ユニットは こうげきしない', () => {
    const { state } = fresh();
    beginBattle(state);
    const p = state.units.find((u) => u.side === 'player')!;
    const e = state.units.find((u) => u.side === 'enemy')!;
    p.combat = false;
    p.pos = { ...e.pos };
    const before = e.hp;
    for (let i = 0; i < 300; i++) step(state, [], 1 / 60);
    expect(e.hp).toBe(before);
  });

  it('combat: false の ユニットも ねらわれる', () => {
    const { state } = fresh();
    beginBattle(state);
    const p = state.units.find((u) => u.side === 'player')!;
    const e = state.units.find((u) => u.side === 'enemy')!;
    p.combat = false;
    p.pos = { ...e.pos };
    const before = p.hp;
    for (let i = 0; i < 300; i++) step(state, [], 1 / 60);
    expect(p.hp).toBeLessThan(before);
  });
});
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/core/sim.test.ts`
Expected: FAIL —「Property 'units' does not exist on type 'BattleState'」

- [ ] **Step 3: `src/core/types.ts` に `Unit` を置く**

```ts
export type AiState = {
  def: AiDef;
  mode: 'idle' | 'chase' | 'return';
  targetUid: string | null;
  /** 初期位置。sentry の帰還先 */
  home: Vec2;
};

export type Unit = {
  uid: string;
  defId: string;
  side: 'player' | 'enemy';
  controller: 'player' | 'ai';
  /** false なら攻撃しない。狙われはする */
  combat: boolean;

  pos: Vec2;
  hp: number;
  maxHp: number;
  power: number;
  guard: number;
  attack: AttackKind;
  range: number;
  attackInterval: number;
  speed: number;
  bowDamageCap: number | null;
  skillId: string | null;

  level: number;
  xp: number;

  goalPos: Vec2 | null;
  goalField: FlowField | null;
  /** 交戦中の相手の uid。null なら非交戦 */
  engagedWith: string | null;
  attackCooldown: number;
  retired: boolean;

  /** controller === 'ai' のときだけ入る */
  ai: AiState | null;

  skillUsed: boolean;
  funbaruUntil: number;
  neraiuchiArmed: boolean;
  pinchShown: boolean;
  /** このステージで交戦したことのある相手の defId */
  seenDefIds: string[];
  lastHitBy: string | null;
  lastHitNeraiuchi: boolean;
};
```

`AllyUnit` / `EnemyUnit` を削除し、`BattleState.allies` / `enemies` を `units: Unit[]` にする。

- [ ] **Step 4: `src/core/state.ts` を1本の `makeUnit` にまとめる**

```ts
type MakeUnitArgs = {
  uid: string;
  def: UnitDef | EnemyDef;
  side: 'player' | 'enemy';
  controller: 'player' | 'ai';
  pos: Vec2;
  level: number;
  xp: number;
  ai: AiDef | null;
};

function makeUnit(a: MakeUnitArgs): Unit {
  const { maxHp, power } = statsForLevel(a.def, a.level);
  const enemyDef = 'bowDamageCap' in a.def ? a.def : null;
  return {
    uid: a.uid,
    defId: a.def.id,
    side: a.side,
    controller: a.controller,
    combat: a.def.combat,
    pos: { ...a.pos },
    hp: maxHp, maxHp, power,
    guard: a.def.guard,
    attack: a.def.attack,
    range: a.def.range,
    attackInterval: a.def.attackInterval,
    speed: a.def.speed,
    bowDamageCap: enemyDef?.bowDamageCap ?? null,
    skillId: a.def.skillId,
    level: a.level, xp: a.xp,
    goalPos: null, goalField: null, engagedWith: null, attackCooldown: 0, retired: false,
    ai: a.ai === null ? null : { def: a.ai, mode: 'idle', targetUid: null, home: { ...a.pos } },
    skillUsed: false, funbaruUntil: -1, neraiuchiArmed: false, pinchShown: false,
    seenDefIds: [], lastHitBy: null, lastHitNeraiuchi: false,
  };
}
```

`createBattleState` は roster と `stage.enemies` の両方をこの1本で作り、`units` に push する。uid は `p1` / `p2`... と `e1` / `e2`... で振る。

`placeUnit(state, uid, pos)` は `state.units.find((u) => u.uid === uid && u.side === 'player')` を探す。

- [ ] **Step 5: `src/core/sim.ts` のループを1本化する**

2本ずつあったループが1本になる。要点だけ示す（残りは同じ構造の機械的な統合）。

```ts
export function playerUnits(state: BattleState): Unit[] {
  return state.units.filter((u) => u.side === 'player' && !u.retired);
}

export function hostilesOf(state: BattleState, self: Unit): Unit[] {
  return state.units.filter((u) => u.side !== self.side && !u.retired);
}

export function unitByUid(state: BattleState, uid: string): Unit | undefined {
  return state.units.find((u) => u.uid === uid);
}

function updateEngagements(state: BattleState, movedThisTick: Set<string>): void {
  const byUid = new Map(state.units.map((u) => [u.uid, u]));

  // 解除
  for (const u of state.units) {
    if (u.retired) { u.engagedWith = null; continue; }
    if (u.engagedWith === null) continue;
    const target = byUid.get(u.engagedWith);
    if (!target || target.retired || distance(u.pos, target.pos) > u.range) u.engagedWith = null;
  }

  // 1ユニットにつき交戦相手は1体。すでに誰かの相手になっている相手は選ばれない
  const claimed = new Set(
    state.units.filter((u) => u.engagedWith !== null).map((u) => u.engagedWith as string),
  );

  for (const u of state.units) {
    if (u.retired || !u.combat || u.engagedWith !== null || movedThisTick.has(u.uid)) continue;
    const available = hostilesOf(state, u).filter((h) => !claimed.has(h.uid));
    const target = nearestWithin(u.pos, available, u.range);
    if (!target) continue;

    u.engagedWith = target.uid;
    u.attackCooldown = effectiveInterval(
      u.attackInterval, u.attack, hasThreatWithinMelee(u.pos, hostilesOf(state, u)),
    );
    claimed.add(target.uid);
    const firstMeeting = !u.seenDefIds.includes(target.defId);
    if (firstMeeting) u.seenDefIds.push(target.defId);
    state.events.push({
      type: 'engage', uid: u.uid, targetUid: target.uid, targetDefId: target.defId, firstMeeting,
    });
  }
}
```

> **`combat: false` の扱い** — 交戦を「成立させる側」にはならない（上の `!u.combat` で弾く）が、相手からは `hostilesOf` に含まれるので狙われる。これが設計書 6.1 の「戦わない同行 NPC」の実装である。

```ts
function resolveAttacks(state: BattleState, dt: number): void {
  const byUid = new Map(state.units.map((u) => [u.uid, u]));

  for (const u of state.units) {
    if (u.retired) continue;
    u.attackCooldown -= dt;
    if (!u.combat || u.engagedWith === null) continue;
    const target = byUid.get(u.engagedWith);
    if (!target || target.retired) continue;

    const hostiles = hostilesOf(state, u);
    const interval = effectiveInterval(u.attackInterval, u.attack, hasThreatWithinMelee(u.pos, hostiles));
    if (u.attackCooldown > 0) continue;

    // 絆は味方どうしの支援なので、同じ side の生存ユニットだけを見る
    const allies = state.units.filter((o) => o.side === u.side);
    const supporters = bondSupporters(state.reg, u.defId, u.pos, allies.map((o) => ({
      id: o.defId, pos: o.pos, retired: o.retired, uid: o.uid,
    })));
    let bonus = 0;
    for (const s of supporters) bonus += s.bonus;
    if (supporters.length > 0) {
      state.events.push({
        type: 'bondSupport', targetUid: u.uid, targetDefId: u.defId,
        supporterUids: supporters.map((s) => s.uid),
      });
    }

    const neraiuchi = u.neraiuchiArmed;
    const before = target.hp;
    const dmg = computeDamage({
      power: u.power,
      guard: target.guard,
      attackKind: u.attack,
      bowDamageCap: target.bowDamageCap,
      bondBonus: bonus,
      neraiuchi,
      targetFunbaru: isFunbaruActive(target, state.time),
    });
    target.hp -= dmg;
    target.lastHitBy = u.uid;
    target.lastHitNeraiuchi = neraiuchi;
    u.neraiuchiArmed = false;
    u.attackCooldown = interval;
    state.events.push({ type: 'hit', targetPos: { ...target.pos }, amount: dmg });

    // ピンチのセリフは操作できる味方にだけ出す
    if (target.side === 'player' && target.hp > 0 && !target.pinchShown) {
      const ratio = target.hp / target.maxHp;
      if (ratio < PINCH_RATIO && before / target.maxHp >= PINCH_RATIO) {
        target.pinchShown = true;
        state.events.push({ type: 'pinch', uid: target.uid, defId: target.defId });
      }
    }
  }
}
```

> **統合による挙動の差に注意** — 統合前は「味方の攻撃は `targetFunbaru: false` 固定」「敵の攻撃は `attackKind: 'melee'` 固定・`bowDamageCap: null` 固定」だった。統合後は一律に相手の値を見る。敵はいま全員 `melee` で `funbaruUntil: -1` のままなので、**結果は完全に同じになる**。既存のダメージ計算テストの期待値は1つも変わらないはずで、変わったら統合を間違えている。

`resolveEnemyRemoval` / `resolveAllyRetirement` は `resolveRemoval(state)` 1本にまとめる:

```ts
function resolveRemoval(state: BattleState): void {
  for (const u of state.units) {
    if (u.retired) continue;
    const byUid = u.lastHitBy;
    const byDefId = byUid === null ? null : (unitByUid(state, byUid)?.defId ?? null);

    if (u.side === 'enemy') {
      const def = state.reg.enemies.get(u.defId);
      if (def?.fleeAtHpRatio != null && u.hp > 0 && u.hp / u.maxHp < def.fleeAtHpRatio) {
        u.retired = true;
        state.events.push({ type: 'unitFled', uid: u.uid, defId: u.defId, byUid, byDefId });
      } else if (u.hp <= 0) {
        u.hp = 0;
        u.retired = true;
        state.events.push({
          type: 'unitDefeated', uid: u.uid, defId: u.defId, byUid, byDefId,
          neraiuchi: u.lastHitNeraiuchi,
        });
      }
    } else if (u.hp <= 0) {
      u.hp = 0;
      u.retired = true;
      state.events.push({ type: 'unitRetired', uid: u.uid, defId: u.defId });
    }

    if (u.retired) {
      u.engagedWith = null;
      u.goalField = null;
      u.goalPos = null;
      for (const other of state.units) {
        if (other.engagedWith === u.uid) other.engagedWith = null;
      }
    }
  }
}
```

> **`retired` で表す** — 統合前は敵を配列から取り除いていたが、統合後は味方と同じく `retired` フラグを立てて配列に残す。`hostilesOf` が `retired` を弾くので、交戦・攻撃・移動の対象からは外れる。撃破された敵を描画から消すのは `render` 側の責務になる（Task 15）。**配列から消さないことで、イベントの `byUid` から後で defId を引ける**という利点もある。

`moveUnits` は `controller` で分ける:

```ts
function moveUnits(state: BattleState, dt: number): void {
  for (const u of state.units) {
    if (u.retired || u.engagedWith !== null) continue;
    if (u.controller === 'player') {
      moveTowardGoal(state, u, dt);
    } else {
      // フェーズ 6 でここが AI の決定に置き換わる
      const dir = flowDirection(state.grid, state.enemyField, u.pos);
      if (!dir) continue;
      u.pos = { x: u.pos.x + dir.x * u.speed * dt, y: u.pos.y + dir.y * u.speed * dt };
    }
  }
}
```

`resolveFort` は `hostilesOf` ではなく `side === 'enemy' && !retired` を回す形に直すだけ（フェーズ 5 で消える）。

- [ ] **Step 6: `bonds.ts` / `skills.ts` / `dialogue.ts` / `counters.ts` を追従させる**

`bonds.ts`: `BondSupporter` に `uid: string` を足す。

```ts
export type BondSupporter = { uid: string; id: string; pos: Vec2; retired: boolean };

export function bondSupporters(
  reg: Registry, selfId: string, selfPos: Vec2, others: BondSupporter[],
): { uid: string; id: string; bonus: number }[] { /* 中身のロジックは変えない */ }
```

`skills.ts`: `state.allies` を `playerUnits(state)` に、`state.enemies` を `hostilesOf(state, self)` に置き換える。`useSkill(state, uid, dest)` の第2引数を uid にする。`SkillContext` の `self: Unit`。イベントは `{ type: 'skill', uid: self.uid, defId: self.defId, skillId: self.skillId!, hits }`。

`dialogue.ts`: イベントの形の変更に追従する。行 ID は defId から作るので `ev.defId` / `ev.targetDefId` を使う:

```ts
      case 'engage': {
        if (!ev.firstMeeting) break;
        const self = /* uid → defId は呼び出し側で解決済みの ev から取れないので */ null;
        break;
      }
```

`engage` イベントには話し手の defId が要る。`SimEvent.engage` に `defId: string` を足す:

```ts
  | { type: 'engage'; uid: string; defId: string; targetUid: string; targetDefId: string; firstMeeting: boolean }
```

`pickDialogue` は `first:${ev.defId}:${ev.targetDefId}` / `skill:${ev.defId}` / `pinch:${ev.defId}` / `win:${ev.byDefId}` / `retire:${ev.defId}` を引く。`RIVAL_SPEAKERS` と `'garum'` のハードコードはまだ残す（Task 23 で消す）。

`counters.ts`: `ev.skill` → `ev.skillId`、`ev.byAlly` → `ev.byDefId`、`case 'enemyDefeated'` → `case 'unitDefeated'`。

- [ ] **Step 7: テストを直す**

`state.allies` / `state.enemies` を参照している全テストを `state.units` + フィルタに書き換える。ヘルパを共通化する:

```ts
function unitOf(s: BattleState, defId: string): Unit {
  const u = s.units.find((x) => x.defId === defId && x.side === 'player');
  if (!u) throw new Error(`いない: ${defId}`);
  return u;
}
```

**期待値は変えない。** 変えたくなったら統合を間違えている。

- [ ] **Step 8: テストとビルドが通ることを確かめる**

Run: `npm test && npm run build`
Expected: PASS。Step 1 の 7 件が増える

- [ ] **Step 9: コミット**

```bash
git add -A src/
git commit -m "refactor(core): AllyUnit と EnemyUnit を Unit に とうごうする"
```

---

### Task 15: `render` / `ui` を `units` ベースへ

**Files:**
- Modify: `src/render/draw.ts`
- Modify: `src/ui/hit.ts`（`pickAlly` → `pickUnit`、戻り値を uid に）
- Modify: `src/ui/hit.test.ts`
- Modify: `src/ui/input.ts`（`charId` → `uid`）
- Modify: `src/ui/input.test.ts`
- Modify: `src/ui/screens.ts`
- Modify: `src/ui/layout.ts`（`portraitSlot` はそのまま。ポートレート数が roster 依存になる）
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `Unit` / `playerUnits` (Task 14)
- Produces:
  - `function pickUnit(units: Unit[], mapPoint: Vec2, radius?: number): string | null` — 返すのは uid
  - `type PointerStart = { uid: string | null; startMap: Vec2; wasSelected: boolean; pointerId: number }`
  - `type MapGesture = { type: 'none' } | { type: 'select'; uid: string } | { type: 'deselect' } | { type: 'moveUnit'; uid: string; dest: Vec2 }`
  - `main.ts` の `selected: string | null` は uid を持つ

- [ ] **Step 1: `hit.ts` / `input.ts` のテストを書き換える**

`hit.test.ts` の `pickAlly(allies, ...)` を `pickUnit(units, ...)` にし、期待値を defId から uid に変える。`retired` を弾く挙動と半径の挙動はそのまま。

`input.test.ts` の `charId` を `uid` に、`moveChar` を `moveUnit` に置き換える。**判定ロジックは1行も変えないので、期待値の意味は変わらない。**

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/ui/`
Expected: FAIL —「pickUnit is not exported」

- [ ] **Step 3: `hit.ts` / `input.ts` を書き換える**

```ts
// hit.ts
export function pickUnit(units: Unit[], mapPoint: Vec2, radius = 32): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const u of units) {
    if (u.retired) continue;
    const d = distance(mapPoint, u.pos);
    if (d <= radius && d < bestDist) {
      bestDist = d;
      best = u.uid;
    }
  }
  return best;
}
```

`input.ts` は `charId` を `uid` に、`moveChar` を `moveUnit` に機械的に置換する。ロジックは変えない。

- [ ] **Step 4: `draw.ts` を `units` ベースにする**

- `drawEnemies` / `drawAllies` を `drawUnits(ctx, reg, state, selected)` 1本にまとめる。`retired` はスキップ（撃破された敵はこれで消える）
- 味方（`side === 'player'`）だけ「はた」と選択リングを描く
- HP バーの色は `u.side === 'player' ? COLORS.hpAlly : COLORS.hpEnemy`
- `drawBonds` は `playerUnits(state)` を回す
- `drawGoalMarkers` は `side === 'player' && goalPos !== null` を回す
- `drawDragPreview` の `charId: CharId` を `defId: string` にする（色を引くため）

- [ ] **Step 5: `screens.ts` / `main.ts` を追従させる**

- `drawBottomBar` は `state.units.filter((u) => u.side === 'player')` を回す。**ポートレートの数は roster 依存になる**ので `portraitSlot(i)` を最大4件までに絞る（`layout.ts` の `portraitSlot` は 240px 間隔で 4 枠ぶんしか無いため）。roster が 4 を超えるステージは今回作らない
- `main.ts` の `selected: CharId | null` を `selected: string | null`（uid）に。`beginMapPointer` のポートレート判定は `playerUnits(state)[i]?.uid` を使う
- `commands.push({ type: 'move', uid: g.uid, dest: g.dest })` / `placeUnit(battle, g.uid, g.dest)`
- スキルボタンの `ally.skill === 'kakenukeru'` という直書きを消す。**「目標地点が要るスキルか」をデータで表す**必要があるので、`skills.json` の `params` に `needsDest` を足す（`1` なら要る）:

```json
  { "id": "kakenukeru", "label": "かけぬける", "params": { "damage": 5, "needsDest": 1 } }
```

```ts
        if (skillParam(reg, unit.skillId ?? '', 'needsDest', 0) === 1) pendingSkill = selected;
        else commands.push({ type: 'skill', uid: selected });
```

- [ ] **Step 6: テストとビルドが通ることを確かめる**

Run: `npm test && npm run build`
Expected: PASS。件数は Task 14 から変わらない

- [ ] **Step 7: 手で動作を確かめる**

Run: `npm run dev`
Expected: 選択・ドラッグ移動・スキル・吹き出しがこれまでどおり動く。倒した敵が消える

- [ ] **Step 8: コミット**

```bash
git add -A src/ assets/
git commit -m "refactor(ui): びょうがと にゅうりょくを units ベースに する"
```

---

# フェーズ 5: 勝敗条件の差し替え

### Task 16: `core/objectives.ts` と砦の削除

`fortHp` を消し、到達勝利と護衛対象ロスト敗北に置き換える。**ここで侵攻型として遊べる形になる。**

**Files:**
- Create: `src/core/objectives.ts`
- Create: `src/core/objectives.test.ts`
- Modify: `src/core/types.ts`（`FORT_MAX_HP` / `BattleState.fortHp` / `SimEvent.fortDamaged` を削除）
- Modify: `src/core/sim.ts`（`resolveFort` / `FORT_RADIUS` / `updatePhase` を削除し `updateObjectives` を呼ぶ）
- Modify: `src/core/state.ts`（`fortHp` の初期化を削除）
- Modify: `src/render/draw.ts`（`drawFort` を削除、`drawTopBar` から砦の表示を削除）
- Modify: `src/ui/screens.ts`（`drawDefeat` の文言）
- Modify: `src/main.ts`（`battle.phase === 'victory'`）
- Modify: `src/core/sim.test.ts`（砦のテストを削除）

**Interfaces:**
- Consumes: `VictoryCond` / `DefeatCond` (Task 3), `Unit` (Task 14)
- Produces:
  - `function isVictorious(state: BattleState, cond: VictoryCond): boolean`
  - `function isDefeated(state: BattleState, cond: DefeatCond): boolean`
  - `function updateObjectives(state: BattleState): void` — `phase` が `'battle'` のときだけ評価し、**敗北を先に見る**

- [ ] **Step 1: 失敗するテストを書く**

`src/core/objectives.test.ts` を新規作成する。

```ts
import { describe, expect, it } from 'vitest';
import { beginBattle, createBattleState } from './state';
import { isDefeated, isVictorious, updateObjectives } from './objectives';
import { testRegistry } from './testing';
import type { BattleState, Unit } from './types';

function fresh(): BattleState {
  const reg = testRegistry();
  const stage = reg.stages[0]!;
  const progress: Record<string, { level: number; xp: number }> = {};
  for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
  const s = createBattleState(reg, stage, progress, 1);
  beginBattle(s);
  return s;
}

function playerOf(s: BattleState, defId: string): Unit {
  return s.units.find((u) => u.side === 'player' && u.defId === defId)!;
}

describe('isVictorious: reach', () => {
  it('だれかが はんいに はいれば しょうり', () => {
    const s = fresh();
    const cond = { type: 'reach' as const, pos: { x: 400, y: 240 }, radius: 40, by: 'any' };
    expect(isVictorious(s, cond)).toBe(false);
    playerOf(s, 'roran').pos = { x: 400, y: 240 };
    expect(isVictorious(s, cond)).toBe(true);
  });

  it('はんいの ふちの そとなら しょうりに ならない', () => {
    const s = fresh();
    const cond = { type: 'reach' as const, pos: { x: 400, y: 240 }, radius: 40, by: 'any' };
    playerOf(s, 'roran').pos = { x: 441, y: 240 };
    expect(isVictorious(s, cond)).toBe(false);
  });

  it('by が していされていたら その ユニットだけ', () => {
    const s = fresh();
    const cond = { type: 'reach' as const, pos: { x: 400, y: 240 }, radius: 40, by: 'roran' };
    playerOf(s, 'ines').pos = { x: 400, y: 240 };
    expect(isVictorious(s, cond)).toBe(false);
    playerOf(s, 'roran').pos = { x: 400, y: 240 };
    expect(isVictorious(s, cond)).toBe(true);
  });

  it('たおれた ユニットは とうたつと みなさない', () => {
    const s = fresh();
    const cond = { type: 'reach' as const, pos: { x: 400, y: 240 }, radius: 40, by: 'any' };
    for (const u of s.units) {
      if (u.side === 'player') { u.pos = { x: 400, y: 240 }; u.retired = true; }
    }
    expect(isVictorious(s, cond)).toBe(false);
  });

  it('敵が はんいに いても しょうりに ならない', () => {
    const s = fresh();
    const cond = { type: 'reach' as const, pos: { x: 400, y: 240 }, radius: 40, by: 'any' };
    s.units.find((u) => u.side === 'enemy')!.pos = { x: 400, y: 240 };
    expect(isVictorious(s, cond)).toBe(false);
  });
});

describe('isDefeated', () => {
  it('unitLost: ごえい たいしょうが たおれたら はいぼく', () => {
    const s = fresh();
    const cond = { type: 'unitLost' as const, defIds: ['roran'] };
    expect(isDefeated(s, cond)).toBe(false);
    playerOf(s, 'roran').retired = true;
    expect(isDefeated(s, cond)).toBe(true);
  });

  it('unitLost: ふくすう していなら どれか 1つで はいぼく', () => {
    const s = fresh();
    const cond = { type: 'unitLost' as const, defIds: ['roran', 'ines'] };
    playerOf(s, 'ines').retired = true;
    expect(isDefeated(s, cond)).toBe(true);
  });

  it('unitLost: ごえい たいしょう いがいが たおれても はいぼくしない', () => {
    const s = fresh();
    const cond = { type: 'unitLost' as const, defIds: ['roran'] };
    playerOf(s, 'gau').retired = true;
    expect(isDefeated(s, cond)).toBe(false);
  });

  it('allPlayerUnitsLost: ぜんいん たおれたら はいぼく', () => {
    const s = fresh();
    const cond = { type: 'allPlayerUnitsLost' as const };
    for (const u of s.units) if (u.side === 'player') u.retired = true;
    expect(isDefeated(s, cond)).toBe(true);
  });

  it('allPlayerUnitsLost: 1にん のこっていれば はいぼくしない', () => {
    const s = fresh();
    const cond = { type: 'allPlayerUnitsLost' as const };
    const ps = s.units.filter((u) => u.side === 'player');
    ps.slice(1).forEach((u) => { u.retired = true; });
    expect(isDefeated(s, cond)).toBe(false);
  });
});

describe('updateObjectives', () => {
  it('とうたつしたら phase が victory に なる', () => {
    const s = fresh();
    playerOf(s, 'roran').pos = { ...s.stage.victory.pos };
    updateObjectives(s);
    expect(s.phase).toBe('victory');
  });

  it('ごえい たいしょうが たおれたら phase が defeat に なる', () => {
    const s = fresh();
    playerOf(s, 'roran').retired = true;
    updateObjectives(s);
    expect(s.phase).toBe('defeat');
  });

  it('どうじに せいりつしたら はいぼくが かつ', () => {
    const s = fresh();
    const roran = playerOf(s, 'roran');
    roran.pos = { ...s.stage.victory.pos };
    roran.retired = true;
    updateObjectives(s);
    expect(s.phase).toBe('defeat');
  });

  it('battle いがいの フェーズでは なにも しない', () => {
    const s = fresh();
    s.phase = 'placement';
    playerOf(s, 'roran').pos = { ...s.stage.victory.pos };
    updateObjectives(s);
    expect(s.phase).toBe('placement');
  });
});
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/core/objectives.test.ts`
Expected: FAIL —「Failed to resolve import "./objectives"」

- [ ] **Step 3: `src/core/objectives.ts` を書く**

```ts
import { distance } from './field';
import type { DefeatCond, VictoryCond } from '../engine/schema';
import type { BattleState, Unit } from './types';

function livingPlayers(state: BattleState): Unit[] {
  return state.units.filter((u) => u.side === 'player' && !u.retired);
}

export function isVictorious(state: BattleState, cond: VictoryCond): boolean {
  const candidates =
    cond.by === 'any'
      ? livingPlayers(state)
      : livingPlayers(state).filter((u) => u.defId === cond.by);
  return candidates.some((u) => distance(u.pos, cond.pos) <= cond.radius);
}

export function isDefeated(state: BattleState, cond: DefeatCond): boolean {
  if (cond.type === 'allPlayerUnitsLost') return livingPlayers(state).length === 0;
  const living = new Set(livingPlayers(state).map((u) => u.defId));
  return cond.defIds.some((defId) => !living.has(defId));
}

/**
 * 敗北を先に見る。同じ tick で護衛対象が倒れかつ到達条件が満たされた場合は敗北とする。
 * 「守りきれなかったが目的地には着いた」を勝利にすると、護衛という目的が意味を失う。
 */
export function updateObjectives(state: BattleState): void {
  if (state.phase !== 'battle') return;
  for (const cond of state.stage.defeat) {
    if (isDefeated(state, cond)) {
      state.phase = 'defeat';
      return;
    }
  }
  if (isVictorious(state, state.stage.victory)) state.phase = 'victory';
}
```

- [ ] **Step 4: 砦を消す**

`types.ts` から `FORT_MAX_HP` / `BattleState.fortHp` / `SimEvent` の `fortDamaged` を削除する。

`sim.ts` から `FORT_RADIUS` / `resolveFort` / `updatePhase` を削除し、`step` の末尾をこうする:

```ts
  resolveRemoval(state);
  updateObjectives(state);
  accumulate(state.counters, state.events);
```

`state.ts` の `fortHp: FORT_MAX_HP` を削除する。

`draw.ts` の `drawFort` と、`drawBattle` からの呼び出し、`COLORS.fort`、`drawTopBar` の砦表示行を削除する。

`screens.ts` の `drawDefeat` の文言を差し替える:

```ts
  ctx.fillText('なかまを まもれなかった', LOGICAL_W / 2, 240);
```

`drawResult` の見出しも差し替える:

```ts
  ctx.fillText('てきの ほんきょちに とうたつ！', LOGICAL_W / 2, 90);
```

`main.ts` の `battle.phase === 'stageCleared'` はすでに `'victory'` になっている（Task 13）。追加変更なし。

- [ ] **Step 5: 砦まわりのテストを削除する**

`sim.test.ts` の `fortHp` / `fortDamaged` / `resolveFort` に関するテストと、Task 12 で足した「とりでが やぶられたら defeat」「敵が ぜんめつしたら victory」の2件を削除する。勝敗の検証は `objectives.test.ts` が担う。

- [ ] **Step 6: テストとビルドが通ることを確かめる**

Run: `npm test && npm run build`
Expected: PASS。`objectives.test.ts` 15 件が増え、砦のテストが減る

- [ ] **Step 7: 手で動作を確かめる**

Run: `npm run dev`
Expected: 配置して開始し、味方を右へ動かして敵本拠地の座標まで行くと勝利画面。ロランを倒されると敗北画面。**この時点で侵攻型として一通り遊べる。** 敵はまだ全員が味方の初期位置へ向かって直進するので、実質すれ違いになる。それはフェーズ 6 で直る

- [ ] **Step 8: コミット**

```bash
git add -A src/
git commit -m "feat(core): とりでを やめ、とうたつ しょうりと ごえい たいしょうロスト はいぼくに する"
```

---

# フェーズ 6: 敵 AI

敵が「その場に配置されていて、それぞれ固有の行動パターンに従う」ようになる。ここが侵攻型の中身である。

### Task 17: フローフィールドのキャッシュ

敵ごとに目的地が変わるため、素朴に実装すると毎ティック敵の数だけ BFS を回すことになる。ゴールを静的・動的に分けてキャッシュする（設計書 6.4）。

**Files:**
- Create: `src/core/fields.ts`
- Create: `src/core/fields.test.ts`
- Modify: `src/core/types.ts`（`BattleState.enemyField` を `fields: FieldCache` に置き換え）
- Modify: `src/core/state.ts`（`fields: makeFieldCache()` で初期化）
- Modify: `src/core/sim.ts`（`state.enemyField` の参照を差し替え、退場時にキャッシュを捨てる）

**Interfaces:**
- Consumes: `computeFlowField` / `cellIndexAt` (`core/field.ts`), `Unit` (Task 14)
- Produces:
  - `type FieldCache = { byUnit: Map<string, { cell: number; field: FlowField }>; static: Map<number, FlowField> }`
  - `function makeFieldCache(): FieldCache`
  - `function fieldToUnit(cache: FieldCache, grid: Grid, target: Unit): FlowField` — 対象ユニットの位置をゴールとするフィールド。対象が別のセルに移ったときだけ再計算する
  - `function fieldToStatic(cache: FieldCache, grid: Grid, goal: Vec2): FlowField` — 動かないゴール。同じセルなら永久に使い回す
  - `function dropUnitField(cache: FieldCache, uid: string): void` — 退場したユニットのぶんを捨てる

- [ ] **Step 1: 失敗するテストを書く**

`src/core/fields.test.ts` を新規作成する。

```ts
import { describe, expect, it } from 'vitest';
import { makeGrid } from './field';
import { dropUnitField, fieldToStatic, fieldToUnit, makeFieldCache } from './fields';
import type { Unit } from './types';

const GRID = makeGrid(32, [
  '########',
  '#......#',
  '#......#',
  '#......#',
  '########',
]);

function fakeUnit(uid: string, x: number, y: number): Unit {
  return { uid, pos: { x, y } } as unknown as Unit;
}

describe('fieldToUnit', () => {
  it('おなじ セルに いる あいだは おなじ フィールドを かえす', () => {
    const cache = makeFieldCache();
    const u = fakeUnit('e1', 48, 48);
    const first = fieldToUnit(cache, GRID, u);
    u.pos = { x: 60, y: 60 };   // 同じセル (1,1) のなか
    expect(fieldToUnit(cache, GRID, u)).toBe(first);
  });

  it('セルを またいだら さいけいさんする', () => {
    const cache = makeFieldCache();
    const u = fakeUnit('e1', 48, 48);
    const first = fieldToUnit(cache, GRID, u);
    u.pos = { x: 80, y: 48 };   // セル (2,1)
    expect(fieldToUnit(cache, GRID, u)).not.toBe(first);
  });

  it('セルを もどっても さいけいさんする（もつのは 1まいだけ）', () => {
    const cache = makeFieldCache();
    const u = fakeUnit('e1', 48, 48);
    const first = fieldToUnit(cache, GRID, u);
    u.pos = { x: 80, y: 48 };
    fieldToUnit(cache, GRID, u);
    u.pos = { x: 48, y: 48 };
    expect(fieldToUnit(cache, GRID, u)).not.toBe(first);
    expect(cache.byUnit.size).toBe(1);
  });

  it('ユニットごとに 1まいだけ もつ', () => {
    const cache = makeFieldCache();
    fieldToUnit(cache, GRID, fakeUnit('a', 48, 48));
    fieldToUnit(cache, GRID, fakeUnit('b', 80, 48));
    expect(cache.byUnit.size).toBe(2);
  });

  it('ゴールへの きょりが ただしく はいる', () => {
    const cache = makeFieldCache();
    const field = fieldToUnit(cache, GRID, fakeUnit('e1', 48, 48));
    expect(field.dist[1 * GRID.cols + 1]).toBe(0);
    expect(field.dist[1 * GRID.cols + 2]).toBeGreaterThan(0);
  });
});

describe('fieldToStatic', () => {
  it('おなじ セルの ゴールなら つかいまわす', () => {
    const cache = makeFieldCache();
    const first = fieldToStatic(cache, GRID, { x: 48, y: 48 });
    expect(fieldToStatic(cache, GRID, { x: 60, y: 60 })).toBe(first);
    expect(cache.static.size).toBe(1);
  });

  it('ちがう セルの ゴールなら べつに もつ', () => {
    const cache = makeFieldCache();
    fieldToStatic(cache, GRID, { x: 48, y: 48 });
    fieldToStatic(cache, GRID, { x: 80, y: 48 });
    expect(cache.static.size).toBe(2);
  });
});

describe('dropUnitField', () => {
  it('していした ユニットの ぶんだけ すてる', () => {
    const cache = makeFieldCache();
    fieldToUnit(cache, GRID, fakeUnit('a', 48, 48));
    fieldToUnit(cache, GRID, fakeUnit('b', 80, 48));
    dropUnitField(cache, 'a');
    expect(cache.byUnit.has('a')).toBe(false);
    expect(cache.byUnit.has('b')).toBe(true);
  });

  it('いない uid を わたしても おちない', () => {
    const cache = makeFieldCache();
    expect(() => dropUnitField(cache, 'nai')).not.toThrow();
  });
});
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/core/fields.test.ts`
Expected: FAIL —「Failed to resolve import "./fields"」

- [ ] **Step 3: `src/core/fields.ts` を書く**

```ts
import { cellIndexAt, computeFlowField } from './field';
import type { FlowField, Grid, Unit, Vec2 } from './types';

/**
 * BFS の実行回数を「プレイヤーユニットのセル移動時」＋「静的ゴールの初回」に抑える。
 * 保持する枚数もユニット数と静的ゴール数の和で固定され、増え続けない。
 */
export type FieldCache = {
  byUnit: Map<string, { cell: number; field: FlowField }>;
  /** キーはゴールのセル index */
  static: Map<number, FlowField>;
};

export function makeFieldCache(): FieldCache {
  return { byUnit: new Map(), static: new Map() };
}

export function fieldToUnit(cache: FieldCache, grid: Grid, target: Unit): FlowField {
  const cell = cellIndexAt(grid, target.pos);
  const cached = cache.byUnit.get(target.uid);
  if (cached && cached.cell === cell) return cached.field;

  const field = computeFlowField(grid, target.pos);
  cache.byUnit.set(target.uid, { cell, field });
  return field;
}

export function fieldToStatic(cache: FieldCache, grid: Grid, goal: Vec2): FlowField {
  const cell = cellIndexAt(grid, goal);
  const cached = cache.static.get(cell);
  if (cached) return cached;

  const field = computeFlowField(grid, goal);
  cache.static.set(cell, field);
  return field;
}

export function dropUnitField(cache: FieldCache, uid: string): void {
  cache.byUnit.delete(uid);
}
```

- [ ] **Step 4: `BattleState` に組み込む**

`types.ts` の `enemyField: FlowField` を `fields: FieldCache` に置き換える。`state.ts` の `enemyField: computeFlowField(...)` を `fields: makeFieldCache()` に置き換える。

`sim.ts` の `moveUnits` で AI ユニットが使っていた `state.enemyField` を、暫定で `fieldToStatic(state.fields, state.grid, state.stage.placementZone[0]!.pos)` に置き換える（Task 19 で AI の決定に置き換わる）。

`resolveRemoval` で `retired` になったユニットのキャッシュを捨てる:

```ts
    if (u.retired) {
      dropUnitField(state.fields, u.uid);
      u.engagedWith = null;
      // ...
    }
```

- [ ] **Step 5: テストとビルドが通ることを確かめる**

Run: `npm test && npm run build`
Expected: PASS。`fields.test.ts` 10 件が増える

- [ ] **Step 6: コミット**

```bash
git add -A src/
git commit -m "feat(core): フローフィールドの キャッシュを ついかする"
```

---

### Task 18: `core/ai.ts` の3パターン

AI は「どこへ行きたいか / 誰を狙うか」だけを返す純関数として登録する。実際の移動と攻撃は既存のループが行う。AI が状態を直接書き換えないので、シミュレーション全体を回さずにテストできる。

**Files:**
- Create: `src/core/ai.ts`
- Create: `src/core/ai.test.ts`

**Interfaces:**
- Consumes: `Unit` / `AiState` (Task 14), `hasLineOfSight` / `distance` (`core/field.ts`), `nearestWithin` (`core/combat.ts`)
- Produces:
  - `type AiContext = { self: Unit; hostiles: Unit[]; grid: Grid }`
  - `type AiDecision = { mode: AiState['mode']; targetUid: string | null; goal: Vec2 | null }`
  - `type AiBehavior = (ctx: AiContext) => AiDecision`
  - `const AI_BEHAVIORS: Record<string, AiBehavior>` — `sentry` / `aggressive` / `guard`
  - `const HOME_EPS = 8` — 帰還先に着いたとみなす距離

- [ ] **Step 1: 失敗するテストを書く**

`src/core/ai.test.ts` を新規作成する。

```ts
import { describe, expect, it } from 'vitest';
import { AI_BEHAVIORS } from './ai';
import { makeGrid } from './field';
import type { AiDef } from '../engine/schema';
import type { Unit } from './types';

// よこに ながい へや。まんなかに かべが 1れつ ある
const GRID = makeGrid(32, [
  '################',
  '#..............#',
  '#..............#',
  '#######.########',
  '#..............#',
  '#..............#',
  '################',
]);

function unit(uid: string, x: number, y: number, def: AiDef | null, home = { x, y }): Unit {
  return {
    uid, pos: { x, y }, retired: false, side: def ? 'enemy' : 'player',
    ai: def ? { def, mode: 'idle', targetUid: null, home } : null,
  } as unknown as Unit;
}

function run(kind: string, self: Unit, hostiles: Unit[]) {
  return AI_BEHAVIORS[kind]!({ self, hostiles, grid: GRID });
}

describe('sentry', () => {
  const def: AiDef = { kind: 'sentry', sightRange: 100 };

  it('だれも いなければ idle', () => {
    const self = unit('e1', 100, 48, def);
    expect(run('sentry', self, [])).toEqual({ mode: 'idle', targetUid: null, goal: null });
  });

  it('さくてき はんいに はいったら chase', () => {
    const self = unit('e1', 100, 48, def);
    const p = unit('p1', 160, 48, null);
    const d = run('sentry', self, [p]);
    expect(d.mode).toBe('chase');
    expect(d.targetUid).toBe('p1');
    expect(d.goal).toEqual({ x: 160, y: 48 });
  });

  it('さくてき はんいの そとなら idle の まま', () => {
    const self = unit('e1', 100, 48, def);
    const p = unit('p1', 400, 48, null);
    expect(run('sentry', self, [p]).mode).toBe('idle');
  });

  it('かべごしの あいてには きづかない', () => {
    // (3,1) と (3,4) のあいだには y=3 の かべが ある
    const self = unit('e1', 112, 48, def);
    const p = unit('p1', 112, 144, null);
    expect(run('sentry', self, [p]).mode).toBe('idle');
  });

  it('もっとも ちかい あいてを えらぶ', () => {
    const self = unit('e1', 100, 48, def);
    const near = unit('near', 140, 48, null);
    const far = unit('far', 180, 48, null);
    expect(run('sentry', self, [far, near]).targetUid).toBe('near');
  });

  it('たおれた あいては ねらわない', () => {
    const self = unit('e1', 100, 48, def);
    const p = unit('p1', 140, 48, null);
    p.retired = true;
    expect(run('sentry', self, [p]).mode).toBe('idle');
  });

  it('みうしなったら home へ return', () => {
    const self = unit('e1', 200, 48, def, { x: 100, y: 48 });
    const d = run('sentry', self, []);
    expect(d.mode).toBe('return');
    expect(d.goal).toEqual({ x: 100, y: 48 });
    expect(d.targetUid).toBeNull();
  });

  it('home に ついたら idle に もどる', () => {
    const self = unit('e1', 100, 48, def, { x: 100, y: 48 });
    expect(run('sentry', self, []).mode).toBe('idle');
  });

  it('もどる とちゅうでも みつけたら chase に もどる', () => {
    const self = unit('e1', 200, 48, def, { x: 100, y: 48 });
    const p = unit('p1', 240, 48, null);
    expect(run('sentry', self, [p]).mode).toBe('chase');
  });
});

describe('aggressive', () => {
  const def: AiDef = { kind: 'aggressive' };

  it('さくてき はんいを むしして いちばん ちかい あいてを おう', () => {
    const self = unit('e1', 100, 48, def);
    const p = unit('p1', 440, 48, null);
    const d = run('aggressive', self, [p]);
    expect(d.mode).toBe('chase');
    expect(d.targetUid).toBe('p1');
  });

  it('かべごしでも おう', () => {
    const self = unit('e1', 112, 48, def);
    const p = unit('p1', 112, 144, null);
    expect(run('aggressive', self, [p]).mode).toBe('chase');
  });

  it('あいてが いなければ idle', () => {
    const self = unit('e1', 100, 48, def);
    expect(run('aggressive', self, [])).toEqual({ mode: 'idle', targetUid: null, goal: null });
  });

  it('home には もどらない', () => {
    const self = unit('e1', 400, 48, def, { x: 100, y: 48 });
    expect(run('aggressive', self, []).mode).toBe('idle');
  });
});

describe('guard', () => {
  const def: AiDef = { kind: 'guard', post: { x: 100, y: 48 }, leash: 120, sightRange: 100 };

  it('post に いて だれも いなければ idle', () => {
    const self = unit('e1', 100, 48, def);
    expect(run('guard', self, []).mode).toBe('idle');
  });

  it('さくてき はんいに はいったら chase', () => {
    const self = unit('e1', 100, 48, def);
    const p = unit('p1', 160, 48, null);
    expect(run('guard', self, [p]).targetUid).toBe('p1');
  });

  it('post から leash を こえたら ついせきを うちきって もどる', () => {
    const self = unit('e1', 240, 48, def);   // post から 140 > leash 120
    const p = unit('p1', 260, 48, null);
    const d = run('guard', self, [p]);
    expect(d.mode).toBe('return');
    expect(d.targetUid).toBeNull();
    expect(d.goal).toEqual({ x: 100, y: 48 });
  });

  it('leash の うちなら ついせきを つづける', () => {
    const self = unit('e1', 200, 48, def);   // post から 100 <= leash 120
    const p = unit('p1', 240, 48, null);
    expect(run('guard', self, [p]).mode).toBe('chase');
  });

  it('post は home と べつに もてる', () => {
    const self = unit('e1', 100, 48, def, { x: 400, y: 48 });
    expect(run('guard', self, []).mode).toBe('idle');   // home ではなく post を みる
  });

  it('post に もどる とちゅうは return', () => {
    const self = unit('e1', 180, 48, def);
    expect(run('guard', self, []).goal).toEqual({ x: 100, y: 48 });
  });

  it('かべごしの あいてには きづかない', () => {
    const self = unit('e1', 112, 48, { kind: 'guard', post: { x: 112, y: 48 }, leash: 200, sightRange: 200 });
    const p = unit('p1', 112, 144, null);
    expect(run('guard', self, [p]).mode).toBe('idle');
  });
});
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/core/ai.test.ts`
Expected: FAIL —「Failed to resolve import "./ai"」

- [ ] **Step 3: `src/core/ai.ts` を書く**

```ts
import { nearestWithin } from './combat';
import { distance, hasLineOfSight } from './field';
import type { AiState, Grid, Unit, Vec2 } from './types';

/** 帰還先に着いたとみなす距離 */
export const HOME_EPS = 8;

export type AiContext = { self: Unit; hostiles: Unit[]; grid: Grid };
export type AiDecision = { mode: AiState['mode']; targetUid: string | null; goal: Vec2 | null };
export type AiBehavior = (ctx: AiContext) => AiDecision;

const IDLE: AiDecision = { mode: 'idle', targetUid: null, goal: null };

function chase(target: Unit): AiDecision {
  return { mode: 'chase', targetUid: target.uid, goal: { ...target.pos } };
}

function returnTo(goal: Vec2): AiDecision {
  return { mode: 'return', targetUid: null, goal: { ...goal } };
}

/**
 * 索敵は距離と視線の両方で判定する。距離だけで判定すると、壁の向こうの見えない敵が
 * 反応してプレイヤーに理不尽に映る。
 */
function spot(ctx: AiContext, sightRange: number): Unit | null {
  const visible = ctx.hostiles.filter(
    (h) => !h.retired && hasLineOfSight(ctx.grid, ctx.self.pos, h.pos),
  );
  return nearestWithin(ctx.self.pos, visible, sightRange);
}

/** post や home へ戻る途中なら return、着いていれば idle */
function settleAt(self: Unit, goal: Vec2): AiDecision {
  return distance(self.pos, goal) <= HOME_EPS ? IDLE : returnTo(goal);
}

export const AI_BEHAVIORS: Record<string, AiBehavior> = {
  sentry: (ctx) => {
    const def = ctx.self.ai?.def;
    if (def?.kind !== 'sentry') return IDLE;
    const target = spot(ctx, def.sightRange);
    if (target) return chase(target);
    return settleAt(ctx.self, ctx.self.ai!.home);
  },

  aggressive: (ctx) => {
    // 索敵範囲も視線も無視して、常に最寄りの敵対ユニットを追う
    const alive = ctx.hostiles.filter((h) => !h.retired);
    const target = nearestWithin(ctx.self.pos, alive, Infinity);
    return target ? chase(target) : IDLE;
  },

  guard: (ctx) => {
    const def = ctx.self.ai?.def;
    if (def?.kind !== 'guard') return IDLE;
    // leash を超えていたら、相手が見えていても追跡を打ち切る
    if (distance(ctx.self.pos, def.post) > def.leash) return returnTo(def.post);
    const target = spot(ctx, def.sightRange);
    if (target) return chase(target);
    return settleAt(ctx.self, def.post);
  },
};
```

> **パターンを増やすとき** — `AI_BEHAVIORS` に1本足し、`engine/schema.ts` の `AiDef` に variant を1つ、`AI_KINDS` に文字列を1つ足す。`sim.ts` は触らない。

- [ ] **Step 4: テストとビルドが通ることを確かめる**

Run: `npx vitest run src/core/ai.test.ts && npm run build`
Expected: PASS 21 件

- [ ] **Step 5: コミット**

```bash
git add src/core/ai.ts src/core/ai.test.ts
git commit -m "feat(core): 敵 AI の 3パターンを ついかする"
```

---

### Task 19: `sim.ts` への AI の組み込み

**Files:**
- Modify: `src/core/sim.ts`（`updateAi` を足し、`moveUnits` を AI 対応に）
- Modify: `src/core/sim.test.ts`（末尾に追加）

**Interfaces:**
- Consumes: `AI_BEHAVIORS` (Task 18), `fieldToUnit` / `fieldToStatic` (Task 17)
- Produces: `step` の内部処理が1つ増えるだけ。公開 API は変わらない

- [ ] **Step 1: 失敗するテストを書く**

`src/core/sim.test.ts` の末尾に追加する。

```ts
describe('AI の くみこみ', () => {
  function withAi(kind: AiDef, enemyPos: Vec2) {
    const { state } = fresh();
    beginBattle(state);
    // 敵を1体だけにして、その1体の ふるまいを 見る
    state.units = state.units.filter((u) => u.side === 'player');
    for (const p of state.units) p.pos = { x: 848, y: 240 };
    const def = state.reg.enemies.get('narazumono')!;
    const e = makeTestUnit(state, def, enemyPos, kind);
    state.units.push(e);
    return { state, e };
  }

  it('sentry は だれも みえなければ うごかない', () => {
    const { state, e } = withAi({ kind: 'sentry', sightRange: 60 }, { x: 300, y: 240 });
    const before = { ...e.pos };
    for (let i = 0; i < 120; i++) step(state, [], 1 / 60);
    expect(e.pos).toEqual(before);
  });

  it('sentry は さくてき はんいに はいると ちかづく', () => {
    const { state, e } = withAi({ kind: 'sentry', sightRange: 600 }, { x: 300, y: 240 });
    const before = e.pos.x;
    for (let i = 0; i < 120; i++) step(state, [], 1 / 60);
    expect(e.pos.x).toBeGreaterThan(before);
  });

  it('aggressive は とおくても ちかづく', () => {
    const { state, e } = withAi({ kind: 'aggressive' }, { x: 300, y: 240 });
    const before = e.pos.x;
    for (let i = 0; i < 120; i++) step(state, [], 1 / 60);
    expect(e.pos.x).toBeGreaterThan(before);
  });

  it('guard は leash を こえたら post に もどる', () => {
    const post = { x: 300, y: 240 };
    const { state, e } = withAi(
      { kind: 'guard', post, leash: 40, sightRange: 600 }, { x: 400, y: 240 },
    );
    for (let i = 0; i < 300; i++) step(state, [], 1 / 60);
    expect(distance(e.pos, post)).toBeLessThan(40);
  });

  it('ai の mode が じょうたいに かきもどされる', () => {
    const { state, e } = withAi({ kind: 'aggressive' }, { x: 300, y: 240 });
    step(state, [], 1 / 60);
    expect(e.ai!.mode).toBe('chase');
    expect(e.ai!.targetUid).not.toBeNull();
  });

  it('たおれた 敵の AI は うごかない', () => {
    const { state, e } = withAi({ kind: 'aggressive' }, { x: 300, y: 240 });
    e.retired = true;
    const before = { ...e.pos };
    for (let i = 0; i < 120; i++) step(state, [], 1 / 60);
    expect(e.pos).toEqual(before);
  });

  it('BFS の かいすうが 敵の かずに ひれいしない', () => {
    const { state } = fresh();
    beginBattle(state);
    for (let i = 0; i < 60; i++) step(state, [], 1 / 60);
    // ユニットごとに 1まい ＋ 静的ゴールぶん。敵の かず × フレームすう には ならない
    expect(state.fields.byUnit.size).toBeLessThanOrEqual(state.units.length);
  });
});
```

`makeTestUnit` はテストヘルパとして `sim.test.ts` の先頭に置く:

```ts
function makeTestUnit(s: BattleState, def: EnemyDef, pos: Vec2, ai: AiDef): Unit {
  return {
    uid: `t${s.units.length + 1}`, defId: def.id, side: 'enemy', controller: 'ai',
    combat: def.combat, pos: { ...pos },
    hp: def.maxHp, maxHp: def.maxHp, power: def.power, guard: def.guard,
    attack: def.attack, range: def.range, attackInterval: def.attackInterval, speed: def.speed,
    bowDamageCap: def.bowDamageCap, skillId: def.skillId,
    level: 1, xp: 0,
    goalPos: null, goalField: null, engagedWith: null, attackCooldown: 0, retired: false,
    ai: { def: ai, mode: 'idle', targetUid: null, home: { ...pos } },
    skillUsed: false, funbaruUntil: -1, neraiuchiArmed: false, pinchShown: false,
    seenDefIds: [], lastHitBy: null, lastHitNeraiuchi: false,
  };
}
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/core/sim.test.ts`
Expected: FAIL — sentry が索敵範囲外でも動いてしまう（まだ全員が共有フィールドを降りているため）

- [ ] **Step 3: `src/core/sim.ts` に `updateAi` を足す**

```ts
import { AI_BEHAVIORS } from './ai';
import { dropUnitField, fieldToStatic, fieldToUnit } from './fields';

function updateAi(state: BattleState): void {
  for (const u of state.units) {
    if (u.retired || u.controller !== 'ai' || u.ai === null) continue;
    const behavior = AI_BEHAVIORS[u.ai.def.kind];
    if (!behavior) continue;
    const decision = behavior({ self: u, hostiles: hostilesOf(state, u), grid: state.grid });
    u.ai.mode = decision.mode;
    u.ai.targetUid = decision.targetUid;
    u.goalPos = decision.goal;
  }
}

export function step(state: BattleState, commands: SimCommand[], dt: number): void {
  state.events = [];
  if (state.phase !== 'battle') return;

  state.time += dt;

  const movedThisTick = applyCommands(state, commands);
  updateAi(state);
  updateEngagements(state, movedThisTick);
  moveUnits(state, dt);
  resolveAttacks(state, dt);
  resolveRemoval(state);
  updateObjectives(state);
  accumulate(state.counters, state.events);
}
```

- [ ] **Step 4: `moveUnits` をキャッシュ経由にする**

```ts
/**
 * そのユニットが今つかうフローフィールド。
 * 追跡中は相手の位置（相手がセルを移ったときだけ再計算）、それ以外は動かないゴール。
 */
function fieldFor(state: BattleState, u: Unit): FlowField | null {
  if (u.controller === 'player') return u.goalField;
  if (u.ai === null) return null;
  if (u.ai.targetUid !== null) {
    const target = unitByUid(state, u.ai.targetUid);
    if (target && !target.retired) return fieldToUnit(state.fields, state.grid, target);
  }
  return u.goalPos ? fieldToStatic(state.fields, state.grid, u.goalPos) : null;
}

function moveTowardGoal(state: BattleState, u: Unit, dt: number): void {
  const goal = u.goalPos;
  if (!goal) return;

  const remaining = distance(u.pos, goal);
  const stepLen = u.speed * dt;
  if (remaining <= stepLen) {
    u.pos = { ...goal };
    // 追跡中は相手が動くので目的地を消さない。消すのは自分で指示された移動だけ
    if (u.controller === 'player') {
      u.goalPos = null;
      u.goalField = null;
    }
    return;
  }

  // 目的地まで見通せるならフローフィールドを使わず直行する
  const dir = hasLineOfSight(state.grid, u.pos, goal)
    ? { x: (goal.x - u.pos.x) / remaining, y: (goal.y - u.pos.y) / remaining }
    : (() => {
        const field = fieldFor(state, u);
        return field ? flowDirection(state.grid, field, u.pos) : null;
      })();

  if (!dir) {
    if (u.controller === 'player') {
      u.goalPos = null;
      u.goalField = null;
    }
    return;
  }
  u.pos = { x: u.pos.x + dir.x * stepLen, y: u.pos.y + dir.y * stepLen };
}

function moveUnits(state: BattleState, dt: number): void {
  for (const u of state.units) {
    if (u.retired || u.engagedWith !== null) continue;
    moveTowardGoal(state, u, dt);
  }
}
```

- [ ] **Step 5: テストとビルドが通ることを確かめる**

Run: `npm test && npm run build`
Expected: PASS。Step 1 の 7 件が増える

- [ ] **Step 6: 手で動作を確かめる**

Run: `npm run dev`
Expected: 敵がその場に立っていて、近づくまで動かない（stage1 の敵は全員 `aggressive` なので今はすぐ寄ってくる。Task 24 で `sentry` / `guard` を混ぜたステージにする）

- [ ] **Step 7: コミット**

```bash
git add -A src/
git commit -m "feat(core): sim に 敵 AI を くみこみ、フィールドを キャッシュから ひく"
```

---

# フェーズ 7: ステージ中の成長

### Task 20: 撃破時の即時経験値とレベルアップ

経験値をステージクリア時にまとめて配るのをやめ、撃破の瞬間にとどめを刺したユニットへ渡す。レベルが上がったら最大 HP と攻撃力を上げ、**増えた最大 HP のぶんだけ現在 HP も増やす**（全回復にはしない）。

**Files:**
- Create: `src/core/growth.ts`
- Create: `src/core/growth.test.ts`
- Modify: `src/core/types.ts`（`SimEvent` に `levelUp` を追加）
- Modify: `src/core/sim.ts`（`resolveRemoval` の後に `awardXpForDefeats` を呼ぶ）
- Modify: `src/core/progress.ts`（`XP_BASE` / `XP_PER_DEFEAT` / `xpGain` を削除）
- Modify: `src/core/counters.ts`（`COUNTER_DEFEAT_BY` を削除。もう経験値の計算に使わない）
- Modify: `src/core/counters.test.ts`（該当テストを削除）
- Modify: `src/ui/flow.ts`（`applyStageClear` が「確定した進行を書き戻す」だけになる）
- Modify: `src/ui/flow.test.ts`
- Modify: `src/ui/screens.ts:drawResult`

**Interfaces:**
- Consumes: `applyXp` / `MAX_LEVEL` (`core/progress.ts`), `statsForLevel` (`core/state.ts`)
- Produces:
  - `SimEvent` に `{ type: 'levelUp'; uid: string; defId: string; level: number }` を追加
  - `function awardXp(state: BattleState, unit: Unit, amount: number): void` — 経験値を渡し、上がったら能力を上げて `levelUp` イベントを出す
  - `function awardXpForDefeats(state: BattleState): void` — その tick の `unitDefeated` を見て、`byUid` のユニットへ `EnemyDef.xpReward` を渡す
  - `applyStageClear(reg, save, stageId, battle)` — 経験値の計算をやめ、`battle` の `units` の `level` / `xp` をそのまま書き戻す

- [ ] **Step 1: 失敗するテストを書く**

`src/core/growth.test.ts` を新規作成する。

```ts
import { describe, expect, it } from 'vitest';
import { awardXp, awardXpForDefeats } from './growth';
import { MAX_LEVEL, xpToNext } from './progress';
import { beginBattle, createBattleState, statsForLevel } from './state';
import { testRegistry } from './testing';
import type { BattleState, Unit } from './types';

function fresh(): BattleState {
  const reg = testRegistry();
  const progress: Record<string, { level: number; xp: number }> = {};
  for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
  const s = createBattleState(reg, reg.stages[0]!, progress, 1);
  beginBattle(s);
  return s;
}

function playerOf(s: BattleState, defId: string): Unit {
  return s.units.find((u) => u.side === 'player' && u.defId === defId)!;
}

describe('awardXp', () => {
  it('レベルが あがらない ぶんは xp に たまる', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    awardXp(s, u, 5);
    expect(u.level).toBe(1);
    expect(u.xp).toBe(5);
  });

  it('しきいちを こえたら レベルが あがる', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    awardXp(s, u, xpToNext(1));
    expect(u.level).toBe(2);
  });

  it('レベルアップで さいだい HP と こうげきりょくが あがる', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    const def = s.reg.units.get('roran')!;
    awardXp(s, u, xpToNext(1));
    expect(u.maxHp).toBe(statsForLevel(def, 2).maxHp);
    expect(u.power).toBe(statsForLevel(def, 2).power);
  });

  it('ふえた さいだい HP の ぶんだけ いまの HP も ふえる', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    const beforeMax = u.maxHp;
    u.hp = 10;
    awardXp(s, u, xpToNext(1));
    expect(u.hp).toBe(10 + (u.maxHp - beforeMax));
  });

  it('ぜんかいふくには しない', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    u.hp = 1;
    awardXp(s, u, xpToNext(1));
    expect(u.hp).toBeLessThan(u.maxHp);
  });

  it('レベルアップの イベントが でる', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    awardXp(s, u, xpToNext(1));
    expect(s.events).toContainEqual({ type: 'levelUp', uid: u.uid, defId: 'roran', level: 2 });
  });

  it('あがらなければ イベントは でない', () => {
    const s = fresh();
    awardXp(s, playerOf(s, 'roran'), 1);
    expect(s.events.filter((e) => e.type === 'levelUp')).toEqual([]);
  });

  it('1どに 2レベル あがったら イベントは さいしゅうレベルで 1けん', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    awardXp(s, u, xpToNext(1) + xpToNext(2));
    expect(u.level).toBe(3);
    expect(s.events.filter((e) => e.type === 'levelUp')).toEqual([
      { type: 'levelUp', uid: u.uid, defId: 'roran', level: 3 },
    ]);
  });

  it('さいだいレベルでは あがらない', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    u.level = MAX_LEVEL;
    awardXp(s, u, 9999);
    expect(u.level).toBe(MAX_LEVEL);
    expect(s.events.filter((e) => e.type === 'levelUp')).toEqual([]);
  });

  it('たおれた ユニットには あげない', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    u.retired = true;
    awardXp(s, u, 9999);
    expect(u.xp).toBe(0);
  });
});

describe('awardXpForDefeats', () => {
  it('とどめを さした ユニットに xpReward を あげる', () => {
    const s = fresh();
    const u = playerOf(s, 'gau');
    const e = s.units.find((x) => x.side === 'enemy')!;
    const reward = s.reg.enemies.get(e.defId)!.xpReward;
    s.events = [{
      type: 'unitDefeated', uid: e.uid, defId: e.defId,
      byUid: u.uid, byDefId: u.defId, neraiuchi: false,
    }];
    awardXpForDefeats(s);
    expect(u.xp).toBe(reward);
  });

  it('てがらが なければ だれにも あげない', () => {
    const s = fresh();
    const e = s.units.find((x) => x.side === 'enemy')!;
    s.events = [{
      type: 'unitDefeated', uid: e.uid, defId: e.defId,
      byUid: null, byDefId: null, neraiuchi: false,
    }];
    awardXpForDefeats(s);
    expect(s.units.filter((u) => u.side === 'player').every((u) => u.xp === 0)).toBe(true);
  });

  it('てったい（unitFled）では けいけんちを あげない', () => {
    const s = fresh();
    const u = playerOf(s, 'gau');
    const e = s.units.find((x) => x.side === 'enemy')!;
    s.events = [{ type: 'unitFled', uid: e.uid, defId: e.defId, byUid: u.uid, byDefId: u.defId }];
    awardXpForDefeats(s);
    expect(u.xp).toBe(0);
  });

  it('おなじ tick に 2たい たおしたら 2たいぶん', () => {
    const s = fresh();
    const u = playerOf(s, 'gau');
    const [a, b] = s.units.filter((x) => x.side === 'enemy');
    const total =
      s.reg.enemies.get(a!.defId)!.xpReward + s.reg.enemies.get(b!.defId)!.xpReward;
    s.events = [
      { type: 'unitDefeated', uid: a!.uid, defId: a!.defId, byUid: u.uid, byDefId: u.defId, neraiuchi: false },
      { type: 'unitDefeated', uid: b!.uid, defId: b!.defId, byUid: u.uid, byDefId: u.defId, neraiuchi: false },
    ];
    awardXpForDefeats(s);
    expect(u.xp).toBe(total);
  });
});
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/core/growth.test.ts`
Expected: FAIL —「Failed to resolve import "./growth"」

- [ ] **Step 3: `src/core/growth.ts` を書く**

```ts
import { applyXp } from './progress';
import { statsForLevel } from './state';
import type { BattleState, Unit } from './types';

/**
 * 経験値を渡し、レベルが上がったら能力を上げる。
 * 増えた最大 HP のぶんだけ現在 HP も増やすが、全回復にはしない。
 * 回復を目的にレベルアップを溜める、という戦い方を成立させないため。
 */
export function awardXp(state: BattleState, unit: Unit, amount: number): void {
  if (unit.retired || amount <= 0) return;

  const before = unit.level;
  const after = applyXp({ level: unit.level, xp: unit.xp }, amount);
  unit.level = after.level;
  unit.xp = after.xp;
  if (after.level === before) return;

  const def = state.reg.units.get(unit.defId) ?? state.reg.enemies.get(unit.defId);
  if (!def) return;
  const stats = statsForLevel(def, after.level);
  const gainedMaxHp = stats.maxHp - unit.maxHp;
  unit.maxHp = stats.maxHp;
  unit.power = stats.power;
  unit.hp = Math.min(unit.maxHp, unit.hp + Math.max(0, gainedMaxHp));

  state.events.push({ type: 'levelUp', uid: unit.uid, defId: unit.defId, level: after.level });
}

/** その tick の撃破を見て、とどめを刺したユニットへ経験値を渡す */
export function awardXpForDefeats(state: BattleState): void {
  // 走査中に events へ levelUp が積まれるので、先にコピーを取る
  const defeats = state.events.filter((e) => e.type === 'unitDefeated');
  for (const ev of defeats) {
    if (ev.type !== 'unitDefeated' || ev.byUid === null) continue;
    const killer = state.units.find((u) => u.uid === ev.byUid);
    if (!killer || killer.side !== 'player') continue;
    const reward = state.reg.enemies.get(ev.defId)?.xpReward ?? 0;
    awardXp(state, killer, reward);
  }
}
```

- [ ] **Step 4: `sim.ts` に組み込む**

```ts
  resolveRemoval(state);
  awardXpForDefeats(state);
  updateObjectives(state);
  accumulate(state.counters, state.events);
```

`types.ts` の `SimEvent` に `| { type: 'levelUp'; uid: string; defId: string; level: number }` を足す。

- [ ] **Step 5: `progress.ts` と `counters.ts` から不要になったものを消す**

`progress.ts` から `XP_BASE` / `XP_PER_DEFEAT` / `xpGain` を削除する。`counters.ts` から `COUNTER_DEFEAT_BY` を削除し、`accumulate` の `case 'unitDefeated'` から `bump(counters, COUNTER_DEFEAT_BY(...), 1)` の行を落とす（`kill:neraiuchi` の加算は残す）。`counters.test.ts` の該当2件（`defeat:by:<defId>` に つむ／`mergeCounters` の除外の検証で使っていた分）は、除外の検証を別のキー名（例 `'temp:key'`）に置き換えて残す。

- [ ] **Step 6: `ui/flow.ts` の `applyStageClear` を「書き戻すだけ」にする**

```ts
export function applyStageClear(
  reg: Registry,
  save: SaveData,
  stageId: string,
  battle: BattleState,
): StageResult {
  const units: Record<string, CharProgress> = { ...save.units };
  const gains: XpGain[] = [];

  // 経験値はステージ中に確定済み。ここでやるのは確定した進行の書き戻しだけ
  for (const u of battle.units) {
    if (u.side !== 'player') continue;
    const before = save.units[u.defId] ?? { level: 1, xp: 0 };
    const after = { level: u.level, xp: u.xp };
    units[u.defId] = after;
    gains.push({ id: u.defId, before, after, leveledUp: after.level > before.level });
  }

  const counters = mergeCounters(save.counters, battle.counters, reg.titles);
  const allTitles = earnedTitles(reg, counters);
  const newTitles = allTitles.filter((t) => !save.titles.includes(t));

  return {
    save: {
      ...save,
      clearedStageIds: save.clearedStageIds.includes(stageId)
        ? save.clearedStageIds
        : [...save.clearedStageIds, stageId],
      units, counters, titles: allTitles,
    },
    gains, newTitles,
  };
}
```

`XpGain` から `gained: number` を落とす（もう「このステージで何点入ったか」を1つの数で言えないため）。

- [ ] **Step 7: `screens.ts` の結果表示を直す**

```ts
    ctx.fillText(`${lookupDef(reg, g.id)?.name ?? g.id}`, 90, y);
    ctx.fillStyle = g.leveledUp ? '#ffd479' : '#9fb3c4';
    ctx.fillText(
      g.leveledUp
        ? `レベルアップ！ Lv${g.before.level} → Lv${g.after.level}`
        : `Lv${g.after.level} (${g.after.xp}/${xpToNext(g.after.level)})`,
      620, y,
    );
```

- [ ] **Step 8: テストとビルドが通ることを確かめる**

Run: `npm test && npm run build`
Expected: PASS。`growth.test.ts` 14 件が増え、`flow.test.ts` の経験値計算のテストが「書き戻し」の検証に置き換わる

- [ ] **Step 9: 手で動作を確かめる**

Run: `npm run dev`
Expected: 敵を倒すとステージ中にレベルが上がる（吹き出しはまだ出ない。Task 22 で出す）。結果画面に最終レベルが出る

- [ ] **Step 10: コミット**

```bash
git add -A src/
git commit -m "feat(core): げきはで そくじに けいけんちを あたえ、ステージちゅうに レベルアップする"
```

---

# フェーズ 8: UI

### Task 21: 目標・護衛対象・索敵範囲の描画

侵攻型では以下がプレイヤーに見えていないとゲームが成立しない（設計書 7 節）。**装飾ではなく必須要素**として扱う。

- 敵本拠地の位置（勝利条件そのもの）
- 護衛対象の識別表示（倒れたら即敗北するユニットがどれか）
- `sentry` と `guard` の索敵範囲（範囲が見えなければ「近づかずに迂回する」という判断が成立しない）

**Files:**
- Modify: `src/render/draw.ts`
- Create: `src/render/objectives-view.ts`
- Create: `src/render/objectives-view.test.ts`
- Modify: `src/ui/screens.ts:drawBottomBar`（護衛対象の印）

**Interfaces:**
- Consumes: `StageDef` / `AiDef` (Task 3), `Unit` (Task 14)
- Produces:
  - `render/objectives-view.ts`:
    - `function escortDefIds(stage: StageDef): string[]` — `defeat` の `unitLost` に挙がっている defId の集合（重複なし・定義順）
    - `function sightCircles(units: Unit[]): { pos: Vec2; radius: number; alerted: boolean }[]` — `sentry` / `guard` の索敵円。`aggressive` は範囲を持たないので含めない。`guard` の中心は `post`、`sentry` の中心は `home`
  - `draw.ts`:
    - `function drawVictoryMarker(ctx, stage: StageDef): void`
    - `function drawSightRanges(ctx, state: BattleState): void`
    - `function drawEscortMarks(ctx, state: BattleState, escorts: Set<string>): void`

- [ ] **Step 1: 失敗するテストを書く**

`src/render/objectives-view.test.ts` を新規作成する。描画そのものではなく、**描くべきものを決める純関数**をテストする。

```ts
import { describe, expect, it } from 'vitest';
import { escortDefIds, sightCircles } from './objectives-view';
import type { StageDef } from '../engine/schema';
import type { Unit } from '../core/types';

const BASE = { id: 's', name: 'S', cell: 32, mapRows: ['..'], placementZone: [], roster: [], enemies: [] } as unknown as StageDef;

describe('escortDefIds', () => {
  it('unitLost の defIds を あつめる', () => {
    const stage = { ...BASE, defeat: [{ type: 'unitLost' as const, defIds: ['roran', 'mist'] }] };
    expect(escortDefIds(stage)).toEqual(['roran', 'mist']);
  });

  it('ふくすうの じょうけんを あわせる', () => {
    const stage = { ...BASE, defeat: [
      { type: 'unitLost' as const, defIds: ['roran'] },
      { type: 'unitLost' as const, defIds: ['ines'] },
    ] };
    expect(escortDefIds(stage)).toEqual(['roran', 'ines']);
  });

  it('じゅうふくを のぞく', () => {
    const stage = { ...BASE, defeat: [
      { type: 'unitLost' as const, defIds: ['roran'] },
      { type: 'unitLost' as const, defIds: ['roran', 'gau'] },
    ] };
    expect(escortDefIds(stage)).toEqual(['roran', 'gau']);
  });

  it('allPlayerUnitsLost だけなら からっぽ', () => {
    const stage = { ...BASE, defeat: [{ type: 'allPlayerUnitsLost' as const }] };
    expect(escortDefIds(stage)).toEqual([]);
  });
});

function enemy(uid: string, x: number, y: number, ai: Unit['ai']): Unit {
  return { uid, pos: { x, y }, side: 'enemy', retired: false, ai } as unknown as Unit;
}

describe('sightCircles', () => {
  it('sentry は home を ちゅうしんに した えん', () => {
    const u = enemy('e1', 200, 100, {
      def: { kind: 'sentry', sightRange: 90 }, mode: 'idle', targetUid: null, home: { x: 100, y: 100 },
    });
    expect(sightCircles([u])).toEqual([{ pos: { x: 100, y: 100 }, radius: 90, alerted: false }]);
  });

  it('guard は post を ちゅうしんに した えん', () => {
    const u = enemy('e1', 200, 100, {
      def: { kind: 'guard', post: { x: 50, y: 60 }, leash: 120, sightRange: 80 },
      mode: 'idle', targetUid: null, home: { x: 200, y: 100 },
    });
    expect(sightCircles([u])).toEqual([{ pos: { x: 50, y: 60 }, radius: 80, alerted: false }]);
  });

  it('aggressive は えんを もたない', () => {
    const u = enemy('e1', 200, 100, {
      def: { kind: 'aggressive' }, mode: 'chase', targetUid: 'p1', home: { x: 200, y: 100 },
    });
    expect(sightCircles([u])).toEqual([]);
  });

  it('ついせきちゅうは alerted に なる', () => {
    const u = enemy('e1', 200, 100, {
      def: { kind: 'sentry', sightRange: 90 }, mode: 'chase', targetUid: 'p1', home: { x: 100, y: 100 },
    });
    expect(sightCircles([u])[0]?.alerted).toBe(true);
  });

  it('たおれた 敵の えんは ださない', () => {
    const u = enemy('e1', 200, 100, {
      def: { kind: 'sentry', sightRange: 90 }, mode: 'idle', targetUid: null, home: { x: 100, y: 100 },
    });
    u.retired = true;
    expect(sightCircles([u])).toEqual([]);
  });

  it('味方（ai が null）は えんを もたない', () => {
    const p = { uid: 'p1', pos: { x: 0, y: 0 }, side: 'player', retired: false, ai: null } as unknown as Unit;
    expect(sightCircles([p])).toEqual([]);
  });
});
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/render/objectives-view.test.ts`
Expected: FAIL —「Failed to resolve import "./objectives-view"」

- [ ] **Step 3: `src/render/objectives-view.ts` を書く**

```ts
import type { StageDef, Vec2 } from '../engine/schema';
import type { Unit } from '../core/types';

/** 倒れたら即敗北するユニットの defId。定義順・重複なし */
export function escortDefIds(stage: StageDef): string[] {
  const out: string[] = [];
  for (const cond of stage.defeat) {
    if (cond.type !== 'unitLost') continue;
    for (const defId of cond.defIds) {
      if (!out.includes(defId)) out.push(defId);
    }
  }
  return out;
}

export type SightCircle = { pos: Vec2; radius: number; alerted: boolean };

/**
 * 索敵範囲の表示は装飾ではない。範囲が見えなければ sentry と aggressive の区別が
 * プレイヤーに伝わらず、「近づかずに迂回する」という判断そのものが成立しない。
 */
export function sightCircles(units: Unit[]): SightCircle[] {
  const out: SightCircle[] = [];
  for (const u of units) {
    if (u.retired || u.ai === null) continue;
    const def = u.ai.def;
    const alerted = u.ai.mode === 'chase';
    if (def.kind === 'sentry') {
      out.push({ pos: { ...u.ai.home }, radius: def.sightRange, alerted });
    } else if (def.kind === 'guard') {
      out.push({ pos: { ...def.post }, radius: def.sightRange, alerted });
    }
  }
  return out;
}
```

- [ ] **Step 4: `draw.ts` に描画を足す**

```ts
import { escortDefIds, sightCircles } from './objectives-view';

const COLORS = {
  // ...既存に足す
  goal: '#ffd479',
  sight: 'rgba(255, 140, 120, 0.30)',
  sightAlert: 'rgba(255, 90, 90, 0.60)',
  escort: '#ffd479',
};

function drawSightRanges(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.lineWidth = 2;
  for (const c of sightCircles(state.units)) {
    const p = mapToLogical(c.pos);
    ctx.strokeStyle = c.alerted ? COLORS.sightAlert : COLORS.sight;
    ctx.setLineDash(c.alerted ? [] : [6, 5]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, c.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawVictoryMarker(ctx: CanvasRenderingContext2D, stage: StageDef): void {
  const p = mapToLogical(stage.victory.pos);
  ctx.strokeStyle = COLORS.goal;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y, stage.victory.radius, 0, Math.PI * 2);
  ctx.stroke();

  // はた。ここが ゴールだと ひと目で わかるように
  ctx.fillStyle = COLORS.goal;
  ctx.fillRect(p.x - 2, p.y - 26, 4, 26);
  ctx.beginPath();
  ctx.moveTo(p.x + 2, p.y - 26);
  ctx.lineTo(p.x + 22, p.y - 19);
  ctx.lineTo(p.x + 2, p.y - 12);
  ctx.closePath();
  ctx.fill();
}

/** 護衛対象の頭上に印を出す。倒れたら即敗北するのがどれかを盤面で示す */
function drawEscortMarks(ctx: CanvasRenderingContext2D, state: BattleState, escorts: Set<string>): void {
  ctx.fillStyle = COLORS.escort;
  for (const u of state.units) {
    if (u.retired || u.side !== 'player' || !escorts.has(u.defId)) continue;
    const p = mapToLogical(u.pos);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - UNIT_R - 14);
    ctx.lineTo(p.x - 6, p.y - UNIT_R - 24);
    ctx.lineTo(p.x + 6, p.y - UNIT_R - 24);
    ctx.closePath();
    ctx.fill();
  }
}
```

`drawBattle` の呼び出し順に組み込む。索敵範囲は地形の上・ユニットの下に描く:

```ts
  drawTerrain(ctx, state);
  drawSightRanges(ctx, state);
  drawVictoryMarker(ctx, state.stage);
  drawGoalMarkers(ctx, reg, state, selected);
  drawBonds(ctx, reg, state);
  drawUnits(ctx, reg, state, selected);
  drawEscortMarks(ctx, state, new Set(escortDefIds(state.stage)));
  drawEffects(ctx, effects);
  drawTopBar(ctx, state);
```

- [ ] **Step 5: `drawBottomBar` に護衛対象の印を足す**

ポートレートにも同じ印を出す。盤面から目を離していても誰が護衛対象かわかるようにする。

```ts
    if (escorts.has(u.defId)) {
      ctx.fillStyle = '#ffd479';
      ctx.beginPath();
      ctx.moveTo(r.x + 12, r.y + 14);
      ctx.lineTo(r.x + 6, r.y + 24);
      ctx.lineTo(r.x + 18, r.y + 24);
      ctx.closePath();
      ctx.fill();
    }
```

`drawBottomBar` の引数に `escorts: Set<string>` を足し、`main.ts` から `new Set(escortDefIds(battle.stage))` を渡す（`beginStage` で1度作ってモジュール変数に保持する）。

- [ ] **Step 6: テストとビルドが通ることを確かめる**

Run: `npm test && npm run build`
Expected: PASS。`objectives-view.test.ts` 10 件が増える

- [ ] **Step 7: 手で動作を確かめる**

Run: `npm run dev`
Expected: 敵本拠地に黄色い旗と円が出る。護衛対象の頭上とポートレートに黄色い三角が出る。（`sentry` / `guard` の円は Task 24 でステージを作り直すまで出ない。確認したければ `assets/stages/stage1.json` の敵の `ai` を一時的に `{"kind":"sentry","sightRange":120}` に書き換えて見ること。**確認したら必ず戻す**）

- [ ] **Step 8: コミット**

```bash
git add -A src/
git commit -m "feat(render): もくひょう・ごえい たいしょう・さくてき はんいを びょうがする"
```

---

### Task 22: レベルアップの吹き出し

**Files:**
- Modify: `src/core/dialogue.ts`（`levelUp` をトリガに足す）
- Modify: `src/core/dialogue.test.ts`
- Modify: `assets/lines/common.json`（`levelup:<defId>` を4本足す）

**Interfaces:**
- Consumes: `SimEvent.levelUp` (Task 20)
- Produces: `pickDialogue` が `levelup:<defId>` を引くようになる。優先順位は `skill` と `pinch` のあいだ

- [ ] **Step 1: 失敗するテストを書く**

`src/core/dialogue.test.ts` の末尾に追加する。

```ts
describe('levelUp の トリガ', () => {
  it('レベルアップで セリフが でる', () => {
    const reg = testRegistry();
    const got = pickDialogue(reg, [{ type: 'levelUp', uid: 'p1', defId: 'roran', level: 2 }]);
    expect(got.map((d) => d.lineId)).toEqual(['levelup:roran']);
  });

  it('セリフが ない ユニットなら なにも でない', () => {
    const reg = testRegistry();
    expect(pickDialogue(reg, [{ type: 'levelUp', uid: 'e1', defId: 'garum', level: 2 }])).toEqual([]);
  });

  it('ゆうせん じゅんは skill の あと、pinch の まえ', () => {
    const reg = testRegistry();
    const got = pickDialogue(reg, [
      { type: 'pinch', uid: 'p1', defId: 'roran' },
      { type: 'levelUp', uid: 'p1', defId: 'roran', level: 2 },
      { type: 'skill', uid: 'p1', defId: 'roran', skillId: 'funbaru', hits: 0 },
    ]);
    expect(got.map((d) => d.lineId)).toEqual(['skill:roran', 'levelup:roran', 'pinch:roran']);
  });
});
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/core/dialogue.test.ts`
Expected: FAIL — `levelup:roran` が返らない

- [ ] **Step 3: `assets/lines/common.json` にセリフを足す**

```json
  "levelup:roran": "つよく なった きが する！",
  "levelup:ines": "うで が あがったわね",
  "levelup:mist": "すこし じしんが つきました",
  "levelup:gau": "うおー！\nもっと いける！"
```

- [ ] **Step 4: `dialogue.ts` にトリガを足す**

```ts
const PRIORITY = ['rival', 'first', 'skill', 'levelup', 'pinch', 'win', 'retire'] as const;
```

```ts
      case 'levelUp':
        push('levelup', make(reg, { side: 'ally', id: ev.defId }, `levelup:${ev.defId}`));
        break;
```

- [ ] **Step 5: テストとビルドが通ることを確かめる**

Run: `npm test && npm run build`
Expected: PASS 3 件増

- [ ] **Step 6: コミット**

```bash
git add -A src/ assets/
git commit -m "feat(ui): レベルアップの ふきだしを ついかする"
```

---

### Task 23: ライバル会話のデータ化

`dialogue.ts` に残った最後のハードコード（`RIVAL_SPEAKERS` と `ev.targetDefId === 'garum'`）を消す。特別扱いをやめ、**セリフキーの探索順**だけで表す。

**Files:**
- Modify: `src/core/dialogue.ts`
- Modify: `src/core/dialogue.test.ts`
- Modify: `assets/lines/common.json`（`rival:<defId>` を `rival:<defId>:<targetDefId>` に改名）

**Interfaces:**
- Consumes: なし
- Produces: 初遭遇のセリフは `rival:<defId>:<targetDefId>` → `first:<defId>:<targetDefId>` の順で探し、最初に見つかったものを使う。`rival` が見つかったときだけ優先度 `rival` を与える

- [ ] **Step 1: 失敗するテストを書く**

`src/core/dialogue.test.ts` の該当部分を差し替える。

```ts
describe('しょそうぐうの セリフ', () => {
  const reg = testRegistry();
  const engage = (defId: string, targetDefId: string) => ({
    type: 'engage' as const, uid: 'p1', defId, targetUid: 'e1', targetDefId, firstMeeting: true,
  });

  it('rival: が あれば そちらを つかう', () => {
    expect(pickDialogue(reg, [engage('roran', 'garum')]).map((d) => d.lineId))
      .toEqual(['rival:roran:garum']);
  });

  it('rival: が なければ first: に おちる', () => {
    expect(pickDialogue(reg, [engage('mist', 'garum')]).map((d) => d.lineId))
      .toEqual(['first:mist:garum']);
  });

  it('どちらも なければ なにも でない', () => {
    expect(pickDialogue(reg, [engage('roran', 'yuurei')])).toEqual([]);
  });

  it('rival は first より さきに でる', () => {
    const got = pickDialogue(reg, [engage('mist', 'garum'), engage('roran', 'garum')]);
    expect(got.map((d) => d.lineId)).toEqual(['rival:roran:garum', 'first:mist:garum']);
  });

  it('firstMeeting でなければ でない', () => {
    expect(pickDialogue(reg, [{ ...engage('roran', 'garum'), firstMeeting: false }])).toEqual([]);
  });
});
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/core/dialogue.test.ts`
Expected: FAIL — `rival:roran` というキーで探しているため `rival:roran:garum` が見つからない

- [ ] **Step 3: `assets/lines/common.json` のキーを改名する**

```json
  "rival:roran:garum": "ガルム……\nまた きたんだね",
  "rival:ines:garum": "また あんたか！\nこんどこそ おいかえす",
```

（`rival:roran` / `rival:ines` は削除する）

- [ ] **Step 4: `dialogue.ts` からハードコードを消す**

```ts
      case 'engage': {
        if (!ev.firstMeeting) break;
        // rival があればそちらを優先し、なければ first に落ちる。
        // 特定の敵やキャラを名指しする分岐はここに書かない
        const rival = make(reg, ally(ev.defId), `rival:${ev.defId}:${ev.targetDefId}`);
        if (rival) push('rival', rival);
        else push('first', make(reg, ally(ev.defId), `first:${ev.defId}:${ev.targetDefId}`));
        break;
      }
```

`RIVAL_SPEAKERS` の定義を削除する。

- [ ] **Step 5: テストとビルドが通ることを確かめる**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 6: `core` にキャラ名が残っていないことを確かめる**

```bash
grep -rniE 'roran|ines|mist|gau|garum|narazumono|tatemochi|funbaru|neraiuchi|omajinai|kakenukeru' src/core src/engine src/render src/ui src/save --include='*.ts' | grep -v '\.test\.ts'
```

Expected: **1件も出ないこと。** 出たら、それがまだデータ化できていない箇所である。`SKILL_EFFECTS` のキー（`funbaru` 等）だけは効果の実装そのものなので残ってよい（`src/core/skills.ts`）

- [ ] **Step 7: コミット**

```bash
git add -A src/ assets/
git commit -m "refactor(core): ライバル かいわを セリフキーの たんさくじゅんで あらわす"
```

---

# フェーズ 9: 新ステージ

### Task 24: 侵攻型のステージを作る

ここまでのステージは旧データの機械的な移し替えで、敵は全員 `aggressive` のまま突っ込んでくる。侵攻型として遊べる形に作り直す。

**Files:**
- Modify: `assets/stages/stage1.json` `stage2.json` `stage3.json`
- Modify: `assets/lines/common.json`（ステージ intro のセリフ）
- Modify: `README.md`
- Modify: `src/engine/loader.test.ts`（ステージ設計の検証を足す）

**Interfaces:**
- Consumes: すべて
- Produces: 遊べる3ステージ

**設計の意図（3ステージで教えること）:**

| ステージ | 教えること | 敵の構成 |
|---|---|---|
| stage1 はじまりの みち | 進めば勝てる。護衛対象がいる | `aggressive` 3体を1本道に。索敵の概念はまだ出さない |
| stage2 みはりの とりで | `sentry` の索敵範囲を避けて回り道できる | `sentry` 4体を通路に散らし、迂回路を用意する。`aggressive` 1体を出口に |
| stage3 ガルムの さいご | `guard` は引き剥がせる。`leash` の外へ逃げれば追ってこない | `guard` 2体が本拠地前を固め、`sentry` 2体が横道を見る。`garum` は `aggressive` |

- [ ] **Step 1: 失敗するテストを書く**

`src/engine/loader.test.ts` の末尾に追加する。データそのものの妥当性を型検証の一段上で守る。

```ts
describe('ステージの せっけい', () => {
  const reg = (() => {
    const r = loadRegistry(KNOWN_SKILLS);
    if (!r.ok) throw new Error(r.errors.map((e) => `${e.file} ${e.path}: ${e.reason}`).join('\n'));
    return r.value;
  })();

  it('3つの ステージが ある', () => {
    expect(reg.stages.map((s) => s.id)).toEqual(['stage1', 'stage2', 'stage3']);
  });

  it('どの ステージにも 敵が 1たい いじょう いる', () => {
    for (const s of reg.stages) {
      expect(`${s.id} => ${s.enemies.length > 0}`).toContain('true');
    }
  });

  it('しょうり ちてんは はいち ちてんから じゅうぶん はなれている', () => {
    for (const s of reg.stages) {
      for (const z of s.placementZone) {
        const d = Math.hypot(z.pos.x - s.victory.pos.x, z.pos.y - s.victory.pos.y);
        expect(`${s.id} きょり ${Math.round(d)} > 300 => ${d > 300}`).toContain('true');
      }
    }
  });

  it('しょうり ちてんは はいち ちてんから あるいて たどりつける', () => {
    for (const s of reg.stages) {
      const grid = makeGrid(s.cell, s.mapRows);
      const field = computeFlowField(grid, s.victory.pos);
      for (const z of s.placementZone) {
        const i = cellIndexAt(grid, z.pos);
        expect(`${s.id} とうたつかのう => ${i >= 0 && (field.dist[i] ?? -1) >= 0}`).toContain('true');
      }
    }
  });

  it('敵の はいちは しょうり ちてんから あるいて たどりつける ばしょに ある', () => {
    for (const s of reg.stages) {
      const grid = makeGrid(s.cell, s.mapRows);
      const field = computeFlowField(grid, s.victory.pos);
      for (const e of s.enemies) {
        const i = cellIndexAt(grid, e.pos);
        expect(`${s.id} ${e.defId} => ${i >= 0 && (field.dist[i] ?? -1) >= 0}`).toContain('true');
      }
    }
  });

  it('guard の post は あるける マスに ある', () => {
    for (const s of reg.stages) {
      const grid = makeGrid(s.cell, s.mapRows);
      for (const e of s.enemies) {
        if (e.ai.kind !== 'guard') continue;
        expect(`${s.id} post => ${isWalkableAt(grid, e.ai.post)}`).toContain('true');
      }
    }
  });

  it('ごえい たいしょうは かならず 1たい いじょう いる', () => {
    for (const s of reg.stages) {
      const escorts = s.defeat.flatMap((c) => (c.type === 'unitLost' ? c.defIds : []));
      expect(`${s.id} => ${escorts.length > 0}`).toContain('true');
    }
  });

  it('さくてき はんいを もつ 敵が stage2 いこうに いる（かいひの あそびが せいりつする）', () => {
    for (const id of ['stage2', 'stage3']) {
      const s = reg.stages.find((x) => x.id === id)!;
      const hasSight = s.enemies.some((e) => e.ai.kind === 'sentry' || e.ai.kind === 'guard');
      expect(`${id} => ${hasSight}`).toContain('true');
    }
  });
});
```

（`makeGrid` / `computeFlowField` / `cellIndexAt` / `isWalkableAt` は `../core/field` から import する。`engine` のテストが `core` を import するのは、テストであり本番の依存の向きには影響しないため許容する）

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/engine/loader.test.ts`
Expected: FAIL — 「さくてき はんいを もつ 敵が stage2 いこうに いる」で落ちる（いまは全員 `aggressive`）

- [ ] **Step 3: `assets/stages/stage1.json` を作り直す**

1本道。護衛対象はロランひとり。`aggressive` 3体。マップは横に長い通路にする。

```json
{
  "id": "stage1",
  "name": "はじまりの みち",
  "cell": 32,
  "mapRows": [
    "##############################",
    "##############################",
    "##..........................##",
    "##..........................##",
    "##..........................##",
    "##..........................##",
    "##..........................##",
    "##..........................##",
    "##..........................##",
    "##..........................##",
    "##..........................##",
    "##..........................##",
    "##############################",
    "##############################"
  ],
  "placementZone": [
    { "pos": { "x": 112, "y": 176 } },
    { "pos": { "x": 112, "y": 272 } },
    { "pos": { "x": 176, "y": 176 } },
    { "pos": { "x": 176, "y": 272 } }
  ],
  "roster": ["roran", "ines", "mist", "gau"],
  "enemies": [
    { "defId": "narazumono", "pos": { "x": 432, "y": 176 }, "ai": { "kind": "aggressive" } },
    { "defId": "narazumono", "pos": { "x": 432, "y": 304 }, "ai": { "kind": "aggressive" } },
    { "defId": "narazumono", "pos": { "x": 656, "y": 240 }, "ai": { "kind": "aggressive" } }
  ],
  "victory": { "type": "reach", "pos": { "x": 880, "y": 240 }, "radius": 40, "by": "any" },
  "defeat": [{ "type": "unitLost", "defIds": ["roran"] }],
  "intro": [
    { "speaker": "roran", "lineId": "stage:stage1:roran" },
    { "speaker": "gau", "lineId": "stage:stage1:gau" }
  ]
}
```

- [ ] **Step 4: `assets/stages/stage2.json` を作り直す**

上下2本の通路。上の通路には `sentry` が並び、下の通路は遠回りだが見張りが薄い。

```json
{
  "id": "stage2",
  "name": "みはりの とりで",
  "cell": 32,
  "mapRows": [
    "##############################",
    "##############################",
    "##..........................##",
    "##..........................##",
    "##..........................##",
    "##....########....########..##",
    "##....########....########..##",
    "##..........................##",
    "##..........................##",
    "##..........................##",
    "##..........................##",
    "##..........................##",
    "##############################",
    "##############################"
  ],
  "placementZone": [
    { "pos": { "x": 112, "y": 112 } },
    { "pos": { "x": 112, "y": 336 } },
    { "pos": { "x": 176, "y": 112 } },
    { "pos": { "x": 176, "y": 336 } }
  ],
  "roster": ["roran", "ines", "mist", "gau"],
  "enemies": [
    { "defId": "narazumono", "pos": { "x": 336, "y": 112 }, "ai": { "kind": "sentry", "sightRange": 110 } },
    { "defId": "tatemochi",  "pos": { "x": 560, "y": 112 }, "ai": { "kind": "sentry", "sightRange": 110 } },
    { "defId": "narazumono", "pos": { "x": 400, "y": 368 }, "ai": { "kind": "sentry", "sightRange": 90 } },
    { "defId": "narazumono", "pos": { "x": 688, "y": 368 }, "ai": { "kind": "sentry", "sightRange": 90 } },
    { "defId": "tatemochi",  "pos": { "x": 848, "y": 240 }, "ai": { "kind": "aggressive" } }
  ],
  "victory": { "type": "reach", "pos": { "x": 880, "y": 240 }, "radius": 40, "by": "any" },
  "defeat": [{ "type": "unitLost", "defIds": ["roran"] }]
}
```

- [ ] **Step 5: `assets/stages/stage3.json` を作り直す**

本拠地の手前を `guard` 2体が固め、横道を `sentry` が見る。ガルムは `aggressive` で、`fleeAtHpRatio: 0.3` により削りきる前に撤退する。

```json
{
  "id": "stage3",
  "name": "ガルムの さいご",
  "cell": 32,
  "mapRows": [
    "##############################",
    "##############################",
    "##..........................##",
    "##......####........####....##",
    "##......####........####....##",
    "##..........................##",
    "##..........................##",
    "##..........................##",
    "##......####........####....##",
    "##......####........####....##",
    "##..........................##",
    "##..........................##",
    "##############################",
    "##############################"
  ],
  "placementZone": [
    { "pos": { "x": 112, "y": 176 } },
    { "pos": { "x": 112, "y": 304 } },
    { "pos": { "x": 176, "y": 176 } },
    { "pos": { "x": 176, "y": 304 } }
  ],
  "roster": ["roran", "ines", "mist", "gau"],
  "enemies": [
    { "defId": "narazumono", "pos": { "x": 400, "y": 208 }, "ai": { "kind": "sentry", "sightRange": 100 } },
    { "defId": "narazumono", "pos": { "x": 400, "y": 336 }, "ai": { "kind": "sentry", "sightRange": 100 } },
    { "defId": "tatemochi",  "pos": { "x": 720, "y": 176 }, "ai": { "kind": "guard", "post": { "x": 752, "y": 208 }, "leash": 140, "sightRange": 120 } },
    { "defId": "tatemochi",  "pos": { "x": 800, "y": 304 }, "ai": { "kind": "guard", "post": { "x": 800, "y": 272 }, "leash": 140, "sightRange": 120 } },
    { "defId": "garum",      "pos": { "x": 848, "y": 240 }, "ai": { "kind": "aggressive" } }
  ],
  "victory": { "type": "reach", "pos": { "x": 880, "y": 240 }, "radius": 40, "by": "any" },
  "defeat": [{ "type": "unitLost", "defIds": ["roran", "mist"] }],
  "intro": [
    { "speaker": "garum", "lineId": "stage:stage3:garum" },
    { "speaker": "roran", "lineId": "stage:stage3:roran" }
  ]
}
```

- [ ] **Step 6: intro のセリフを差し替える**

`assets/lines/common.json` の `stage:` キーを次にする（`stage:stage3:narazumono` / `stage:stage3:tatemochi` は使わなくなるので削除する）。

```json
  "stage:stage1:roran": "みんな、\nいくよ。 まえに すすもう",
  "stage:stage1:gau": "まかせて！\nさきに いってみる！",
  "stage:stage3:garum": "ここから さきは\nとおさんぞ",
  "stage:stage3:roran": "こんどは ぼくたちが\nせめる ばんだ"
```

- [ ] **Step 7: テストとビルドが通ることを確かめる**

Run: `npm test && npm run build`
Expected: PASS。Step 1 の 8 件が増える。落ちたら座標が壁の中に入っているか、到達不能になっている。テストのメッセージがどのステージのどの要素かを教えるので、それを見て直す

- [ ] **Step 8: 3ステージを通しで遊んで確かめる**

Run: `npm run dev`

確かめること:

- stage1: まっすぐ進めば勝てる。ロランを死なせると敗北する
- stage2: 上の通路は索敵円が濃く、迂回して下を通ると気づかれずに抜けられる。**円の外を通れば追ってこないことが目で見てわかること**
- stage3: `guard` の索敵に入ると追ってくるが、`leash` の外へ逃げると post へ戻る。**引き剥がして本拠地へ回り込めること**
- ガルムは HP が 3 割を切ると撤退する
- ステージ中にレベルが上がり、吹き出しが出る
- 結果画面で最終レベルと新しい称号が出る
- ステージ 1 をクリアすると 2 が解放される

うまく遊べない場合は、直すのは**アセットの数値だけ**にすること。コードを触りたくなったら、それは設計上の穴なので理由を書き残す。

- [ ] **Step 9: README を書き直す**

- 冒頭の説明を「小さな島の砦を守る防衛シミュレーション」から「仲間を率いて敵の本拠地へ攻め込むリアルタイム侵攻シミュレーション」に
- 「そうさ」表から再配置の記述を落とす
- 「構成」表を更新する:

| ディレクトリ | 責務 |
|---|---|
| `assets/` | ステージ・ユニット・敵・スキル・称号・セリフの定義（JSON）。ロジックを置かない |
| `src/engine/` | 定義の型検証・読み込み・索引。`core` を知らない |
| `src/core/` | 描画・DOM に依存しない純ロジック |
| `src/render/` | Canvas2D 描画 |
| `src/ui/` | 画面遷移・入力・吹き出しキュー |
| `src/save/` | localStorage の読み書き |

- 「コンテンツの足しかた」の節を新設する:

```markdown
## コンテンツの足しかた

コードを書き換えずに足せるもの:

- **ステージ** — `assets/stages/<id>.json` を1本置く。ファイル名と `id` を一致させること
- **味方・同行 NPC** — `assets/units/<id>.json`。`combat: false` にすると攻撃しない同行者になる
- **敵** — `assets/enemies/<id>.json`
- **セリフ** — `assets/lines/*.json`
- **称号** — `assets/titles.json`。`counter` に使えるキーは `skill:<skillId>:uses` / `skill:<skillId>:hits` / `kill:neraiuchi` / `bond:supports`
- **絆** — `assets/bonds.json`

コードが要るもの:

- **新しいスキル** — `src/core/skills.ts` の `SKILL_EFFECTS` に効果を足し、`assets/skills.json` に数値を足す
- **新しい AI パターン** — `src/core/ai.ts` の `AI_BEHAVIORS` に足し、`src/engine/schema.ts` の `AiDef` と `AI_KINDS` に variant を足す
- **新しい勝敗条件** — `src/engine/schema.ts` の `VictoryCond` / `DefeatCond` に variant を足し、`src/core/objectives.ts` で判定を書く

JSON が壊れていると起動時にエラー画面が出て止まる。どのファイルのどのフィールドがなぜ不正かが出るので、それを直すこと。
```

- [ ] **Step 10: 最終確認とコミット**

Run: `npm test && npm run build`
Expected: PASS

```bash
git add -A
git commit -m "feat(assets): しんこうがたの ステージを 3つ つくり、README を こうしんする"
```

---

## 完了の条件

すべてのタスクを終えたら、次がすべて成り立っていること。

- [ ] `npm test` と `npm run build` が通る
- [ ] `src/content/` が存在しない
- [ ] `src/core` / `src/engine` / `src/render` / `src/ui` / `src/save` の**本番コード**にキャラ名・敵名・称号名が出てこない（Task 23 Step 6 の `grep` が空。`SKILL_EFFECTS` のキーだけは例外）
- [ ] `src/engine/**` が `src/core/**` を import していない（テストを除く）
  - 確認: `grep -rn "from '\.\./core" src/engine --include='*.ts' | grep -v '\.test\.ts'` が空
- [ ] `src/core/**` と `src/engine/**` が `window` / `document` / `localStorage` を参照していない
  - 確認: `grep -rnE '\b(window|document|localStorage)\b' src/core src/engine --include='*.ts'` が空
- [ ] `assets/stages/` に JSON を1本足すだけで、コードを触らずに新しいステージが遊べる
- [ ] 壊れた JSON を置くと、起動時にファイル名・フィールド名・理由が画面に出て停止する
- [ ] 3ステージを通しでクリアでき、称号が取れる
