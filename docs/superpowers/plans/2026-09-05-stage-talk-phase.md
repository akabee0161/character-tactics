# ステージ開始時の会話フェーズ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 配置フェーズの前に、文字送りとページ送りを備えた会話フェーズを新設し、あわせて戦闘中の吹き出しを「操作を妨げない、キャラ頭上の寿命つき吹き出し」へ作り替える。

**Architecture:** 会話の進行は `src/ui/talk.ts` の純粋な状態機械に閉じ込め、文字幅の測定は関数として注入することでテスト可能にする。戦闘中の吹き出しは `src/ui/bubbles.ts` のキュー + `isBlocking` を捨て、`effects.ts` と同じ「uid をキーにした寿命つき Map」へ置き換える。ステージ定義は JSON のまま拡張し、コードを書かずに会話を足せる状態を保つ。

**Tech Stack:** TypeScript 5.6 / Vite 5.4 / Vitest 2.1 / Canvas2D。フレームワークなし、素の DOM イベント + `requestAnimationFrame`。

**Spec:** `docs/superpowers/specs/2026-09-05-stage-talk-phase-design.md`

**すでにこのブランチに入っているもの:** ダメージ数値の表示時間を 0.6 秒 → 2.0 秒に伸ばす修正（`src/render/effects.ts` の `DAMAGE_TEXT_DURATION`）。この計画のタスクには含まれないが、Task 6 と Task 7 の手動確認では**この 2.0 秒が正しい状態**である。短く感じたらこの定数1つで調整する。

## Global Constraints

- Node.js 22 以上。
- `src/core/**` と `src/engine/**` は `window` / `document` / `localStorage` を参照しない。`src/ui/**` は Canvas コンテキストを受け取ってよい。
- 依存の向きは `engine → (なし)` / `core → engine` / `ui → core, engine, render` / `render → core, engine`。**`core/` から `ui/` を import しない。**
- アセットの不正は起動時に全件を集めてエラー画面で停止する。部分的に読めたぶんで続行しない。
- `SAVE_VERSION` は **2 のまま。上げてはならない。** 上げると旧セーブが読み捨てられ、公開済みプレイヤーの進行が消える。
- ステージ ID（`stage1` / `stage2` / `stage3`）は変更しない。`clearedStageIds` のキーであるため。
- 検証エラーの `reason` は、既存に合わせて**ひらがな中心の日本語**で書く（例: `かずが ひつよう`）。
- テストは日本語の `it(...)` 説明で書く。既存の `describe` / `it` 様式に合わせる。
- 各タスクの完了条件は `npm test` と `npm run build`（`tsc --noEmit && vite build`）が両方通ること。
- コミットは Conventional Commits（`feat:` / `fix:` / `refactor:` / `test:` / `docs:` / `chore:`）。

## タスクの依存関係

```
Task 1 (order) ─┐
                ├─ Task 3 (ページ分割) ─ Task 4 (進行) ─┐
Task 2 (intro) ─┘                                      ├─ Task 6 (talk フェーズ配線) ─ Task 7 (吹き出し作り替え) ─ Task 8 (README)
                   Task 5 (セーブ既読) ────────────────┘
```

**設計書 13 節の「6 だけ先に入れてバグを止められる」は誤りだったので訂正する。** 吹き出しを寿命方式に変えると `pickStageIntro` の行き先がなくなる（敵の `defId` から uid を引く手段がなく、ガルムの台詞を頭上に出せない）。**Task 7 は Task 6 の後に実施する。**

---

### Task 1: `order` フィールドとステージの整列

**Files:**
- Modify: `src/engine/schema.ts`（`StageDef` 型、`validateStageDef`）
- Modify: `src/engine/registry.ts`（整列と重複検査）
- Modify: `assets/stages/stage1.json`, `stage2.json`, `stage3.json`
- Modify: `src/engine/schema.test.ts:186`, `src/engine/registry.test.ts:22`, `src/core/sim.test.ts:26,43`, `src/core/sim-combat.test.ts:10`, `src/core/skills.test.ts:194,208`（フィクスチャに `order` を足す）
- Test: `src/engine/schema.test.ts`, `src/engine/registry.test.ts`

**Interfaces:**
- Consumes: なし（最初のタスク）
- Produces: `StageDef.order: number`。`buildRegistry` が返す `reg.stages` は `order` の昇順で並ぶ。

- [ ] **Step 1: 失敗するテストを書く（schema）**

`src/engine/schema.test.ts` の `describe('validateStageDef', ...)` の中に追加する。

```ts
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
```

同じファイルの `VALID_STAGE`（186行目）に `order: 10,` を1行足す。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/engine/schema.test.ts`
Expected: FAIL。`order` が読まれていないため、欠落しても `ok: true` になる。

- [ ] **Step 3: スキーマに `order` を足す**

`src/engine/schema.ts` の `StageDef` 型に足す。

```ts
export type StageDef = {
  /** ファイル名と一致させる。セーブのキーになる */
  id: string;
  /** ステージの並び順。昇順に並べる。欠番は許すが重複は不可 */
  order: number;
  name: string;
  // ...以下は変更なし
};
```

`validateStageDef` の `const stage: StageDef = {` の中、`id` の直後に足す。

```ts
    id: requireString(ctx, 'id', o.id) ?? '',
    order: requireNumber(ctx, 'order', o.order, { min: 1, int: true }) ?? 1,
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/engine/schema.test.ts`
Expected: PASS

- [ ] **Step 5: 失敗するテストを書く（registry の整列と重複）**

`src/engine/registry.test.ts` に追加する。`files()` ヘルパは既存のものを使う。

```ts
describe('ステージの ならびじゅん', () => {
  it('order の しょうじゅんに ならぶ（ファイルめいの じしょじゅんに よらない）', () => {
    const r = buildRegistry(files({
      'assets/stages/stage1.json': { ...STAGE, id: 'stage1', order: 30 },
      'assets/stages/stage10.json': { ...STAGE, id: 'stage10', order: 10 },
      'assets/stages/stage2.json': { ...STAGE, id: 'stage2', order: 20 },
    }), ['funbaru']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.stages.map((s) => s.id)).toEqual(['stage10', 'stage2', 'stage1']);
  });

  it('order の けつばんは ゆるす', () => {
    const r = buildRegistry(files({
      'assets/stages/stage1.json': { ...STAGE, id: 'stage1', order: 10 },
      'assets/stages/stage2.json': { ...STAGE, id: 'stage2', order: 900 },
    }), ['funbaru']);
    expect(r.ok).toBe(true);
  });

  it('order の じゅうふくは 弾く', () => {
    const r = buildRegistry(files({
      'assets/stages/stage1.json': { ...STAGE, id: 'stage1', order: 10 },
      'assets/stages/stage2.json': { ...STAGE, id: 'stage2', order: 10 },
    }), ['funbaru']);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.path === 'order' && e.reason.includes('じゅうふく'))).toBe(true);
    }
  });
});
```

同じファイルの `STAGE`（22行目）に `order: 10,` を1行足す。

- [ ] **Step 6: テストが失敗することを確認**

Run: `npx vitest run src/engine/registry.test.ts`
Expected: FAIL。並び順はファイルパスの辞書順のままで、重複も検出されない。

- [ ] **Step 7: registry に整列と重複検査を足す**

`src/engine/registry.ts` の「形が崩れているうちに〜」のコメントの直前、ファイル走査ループを抜けた直後に足す。

```ts
  // ステージの並び順は order で決める。ファイルパスの辞書順に依存すると
  // stage10 が stage1 と stage2 の間に入る
  reg.stages.sort((a, b) => a.order - b.order);
  const seenOrder = new Map<number, string>();
  for (const s of reg.stages) {
    const dup = seenOrder.get(s.order);
    if (dup !== undefined) {
      errors.push({
        file: `assets/stages/${s.id}.json`, path: 'order',
        reason: `order が じゅうふくしている: ${s.order}（${dup} と おなじ）`,
      });
    } else {
      seenOrder.set(s.order, s.id);
    }
  }
```

- [ ] **Step 8: テストが通ることを確認**

Run: `npx vitest run src/engine/registry.test.ts`
Expected: PASS

- [ ] **Step 9: 実アセットと残りのフィクスチャに `order` を足す**

- `assets/stages/stage1.json` — `"id": "stage1",` の次の行に `"order": 10,`
- `assets/stages/stage2.json` — 同様に `"order": 20,`
- `assets/stages/stage3.json` — 同様に `"order": 30,`

以下は `StageDef` として型注釈されたフィクスチャなので、足さないと `tsc` が落ちる。それぞれ `id` の隣に `order: 10,` を足す（値は何でもよい）。

- `src/core/sim.test.ts:26` の `STAGE`
- `src/core/sim.test.ts:43` の `AI_STAGE`
- `src/core/sim-combat.test.ts:10` の `STAGE`
- `src/core/skills.test.ts:194` と `:208` の `stage`

`src/render/objectives-view.test.ts:6` は `as unknown as StageDef` を使っているので変更不要。

- [ ] **Step 10: 全テストと型チェックを通す**

Run: `npm test && npm run build`
Expected: 全 PASS、ビルド成功

- [ ] **Step 11: コミット**

```bash
git add src/engine/schema.ts src/engine/registry.ts src/engine/schema.test.ts src/engine/registry.test.ts src/core/sim.test.ts src/core/sim-combat.test.ts src/core/skills.test.ts assets/stages/
git commit -m "feat: ステージの並び順をorderフィールドで明示する

ファイルパスの辞書順に依存していたため、stage10 が stage1 と stage2 の
間に入る状態だった。order の昇順で並べ、重複は起動時に弾く。欠番は許す。
ステージ id は変えないのでセーブは無傷。"
```

---

### Task 2: `intro` の拡張（`speaker` 省略可・`text` 直書き・排他検証）

**Files:**
- Modify: `src/engine/schema.ts`（`IntroLine` 型、`readIntroLine`、`validateStageDef`）
- Modify: `src/engine/registry.ts`（`intro` の相互参照検証）
- Modify: `src/core/dialogue.ts`（`TalkLine` 型、`pickStageIntro`）
- Modify: `assets/stages/stage1.json`（新記法の見本にする）
- Test: `src/engine/schema.test.ts`, `src/core/dialogue.test.ts`

**Interfaces:**
- Consumes: Task 1 の `StageDef.order`
- Produces:
  - `export type IntroLine = { speaker: string | null; text: string | null; lineId: string | null }`（`schema.ts`）
  - `StageDef.intro?: IntroLine[]`
  - `export type TalkLine = { speaker: string | null; text: string }`（`core/dialogue.ts`）
  - `export function pickStageIntro(reg: Registry, stage: StageDef): TalkLine[]`

- [ ] **Step 1: 失敗するテストを書く（schema）**

`src/engine/schema.test.ts` の `describe('validateStageDef', ...)` に追加する。

```ts
  it('intro の speaker は はぶける（地の文）', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE, intro: [{ text: 'みちの さきに、けむりが みえる。' }],
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
```

既存の `intro` のテスト（326行目付近、`intro: [{ speaker: 'roran', lineId: 'stage:stage1:roran' }]`）は**そのまま残す**。後方互換の確認になる。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/engine/schema.test.ts`
Expected: FAIL。`speaker` は必須のまま、`text` は読まれない。

- [ ] **Step 3: スキーマを拡張する**

`src/engine/schema.ts` の `StageDef` の直前に型を足す。

```ts
export type IntroLine = {
  /** null なら地の文。ネームプレートと顔の丸を出さない */
  speaker: string | null;
  /** text と lineId は排他。検証で片方だけが埋まることを保証する */
  text: string | null;
  lineId: string | null;
};
```

`StageDef.intro` の型を差し替える。

```ts
  intro?: IntroLine[];
```

`validateStageDef` の直前に読み取り関数を足す。

```ts
/**
 * text と lineId は排他にする。片方を優先する暗黙のルールを作ると、
 * 直したつもりが効いていない事故が起きるため、両方書いたらエラーにする。
 */
function readIntroLine(ctx: Ctx, path: string, v: unknown): IntroLine {
  const o = requireObject(ctx, path, v);
  if (!o) return { speaker: null, text: null, lineId: null };

  const hasText = o.text !== undefined;
  const hasLineId = o.lineId !== undefined;
  if (hasText && hasLineId) fail(ctx, path, 'text と lineId は どちらか いっぽうだけ');
  else if (!hasText && !hasLineId) fail(ctx, path, 'text か lineId の どちらかが ひつよう');

  return {
    speaker: o.speaker === undefined ? null : requireString(ctx, `${path}.speaker`, o.speaker),
    text: hasText ? requireString(ctx, `${path}.text`, o.text) : null,
    lineId: hasLineId ? requireString(ctx, `${path}.lineId`, o.lineId) : null,
  };
}
```

`validateStageDef` の末尾にある `if (o.intro !== undefined) { ... }` ブロックを、まるごと次で置き換える。

```ts
  if (o.intro !== undefined) {
    const introRaw = requireArray(ctx, 'intro', o.intro) ?? [];
    stage.intro = introRaw.map((item, i) => readIntroLine(ctx, `intro[${i}]`, item));
  }
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/engine/schema.test.ts`
Expected: PASS

- [ ] **Step 5: registry の相互参照検証を更新する**

`src/engine/registry.ts` の `stage.intro?.forEach(...)` ブロックを置き換える。`speaker` が `null` のときは検査しない。

```ts
    stage.intro?.forEach((line, i) => {
      if (line.speaker !== null && lookupDef(reg, line.speaker) === null) {
        errors.push({ file, path: `intro[${i}].speaker`, reason: `しらない はなして: ${line.speaker}` });
      }
      if (line.lineId !== null && !reg.lines.has(line.lineId)) {
        errors.push({ file, path: `intro[${i}].lineId`, reason: `lines に ない id: ${line.lineId}` });
      }
    });
```

- [ ] **Step 6: 失敗するテストを書く（dialogue）**

`src/core/dialogue.test.ts` に追加する。先に import を足す。

```ts
import { pickStageIntro } from './dialogue';
import { testRegistry } from './testing';
import type { StageDef } from '../engine/schema';
```

既存の `pickStageIntro` のテストがあれば、戻り値が `DialogueRequest[]` から `TalkLine[]` に変わるので、あわせて書き換える（`speaker` がオブジェクトから文字列 or `null` になり、`lineId` が消える）。

```ts
describe('pickStageIntro', () => {
  const reg = testRegistry();

  it('lineId を ひいて text に する', () => {
    const stage = { intro: [{ speaker: 'roran', text: null, lineId: 'stage:stage1:roran' }] } as unknown as StageDef;
    const r = pickStageIntro(reg, stage);
    expect(r).toHaveLength(1);
    expect(r[0]!.speaker).toBe('roran');
    expect(r[0]!.text).toBe(reg.lines.get('stage:stage1:roran'));
  });

  it('text の ちょくがきを そのまま つかう', () => {
    const stage = { intro: [{ speaker: 'gau', text: 'いくぞー', lineId: null }] } as unknown as StageDef;
    expect(pickStageIntro(reg, stage)).toEqual([{ speaker: 'gau', text: 'いくぞー' }]);
  });

  it('speaker が null なら 地の文に なる', () => {
    const stage = { intro: [{ speaker: null, text: 'しずかだ。', lineId: null }] } as unknown as StageDef;
    expect(pickStageIntro(reg, stage)).toEqual([{ speaker: null, text: 'しずかだ。' }]);
  });

  it('intro が なければ からの はいれつ', () => {
    expect(pickStageIntro(reg, {} as unknown as StageDef)).toEqual([]);
  });
});
```

- [ ] **Step 7: テストが失敗することを確認**

Run: `npx vitest run src/core/dialogue.test.ts`
Expected: FAIL。`pickStageIntro` は `DialogueRequest[]` を返しており、`text` 直書きに対応していない。

- [ ] **Step 8: `pickStageIntro` を書き換える**

`src/core/dialogue.ts` の `pickStageIntro` を置き換える。`TalkLine` はここで定義する（`ui/talk.ts` がこれを import する。逆向きの依存は禁止）。

```ts
/** 会話フェーズが読む1行。speaker が null なら地の文 */
export type TalkLine = { speaker: string | null; text: string };

/** ステージ開始時の会話を、stage.intro の順番どおりに返す */
export function pickStageIntro(reg: Registry, stage: StageDef): TalkLine[] {
  const out: TalkLine[] = [];
  for (const line of stage.intro ?? []) {
    // 検証で片方だけが埋まることは保証済み。lines に無い lineId も検証で弾かれている
    const text = line.text ?? (line.lineId === null ? undefined : reg.lines.get(line.lineId));
    if (text === undefined) continue;
    out.push({ speaker: line.speaker, text });
  }
  return out;
}
```

型の import に `IntroLine` は不要。`StageDef` は既に import 済み。

- [ ] **Step 9: テストが通ることを確認**

Run: `npx vitest run src/core/dialogue.test.ts`
Expected: PASS

- [ ] **Step 10: `main.ts` の呼び出しを一時的に外す**

この時点で `main.ts:129` の `enqueue(bubbles, pickStageIntro(registry, battle.stage))` は型が合わなくなる。Task 6 で会話フェーズに繋ぐまでの間、**その1行を削除**する（`enqueue` の import が未使用になったら合わせて外す）。ステージ開始時の会話が一時的に出なくなるが、Task 6 で復活する。

- [ ] **Step 11: stage1.json を新記法の見本にする**

`assets/stages/stage1.json` の `intro` を置き換える。地の文と直書きの両方を含む見本にする。

```json
  "intro": [
    { "text": "みちの さきに、けむりが みえる。" },
    { "speaker": "roran", "text": "みんな、いくよ。\nまえに すすもう" },
    { "speaker": "gau", "lineId": "stage:stage1:gau" }
  ]
```

`stage3.json` は既存記法のまま残す（後方互換が実アセットで確認できる）。`assets/lines/common.json` の `stage:stage1:roran` は参照されなくなるが、**消さない**（`lines` は未参照でもエラーにならず、消すと差分が大きくなる）。

- [ ] **Step 12: 全テストと型チェックを通す**

Run: `npm test && npm run build`
Expected: 全 PASS、ビルド成功

- [ ] **Step 13: コミット**

```bash
git add src/engine/schema.ts src/engine/registry.ts src/engine/schema.test.ts src/core/dialogue.ts src/core/dialogue.test.ts src/main.ts assets/stages/stage1.json
git commit -m "feat: ステージのintroに地の文と本文直書きを足す

speaker を省略すると地の文になり、text を直書きできる。text と lineId は
排他で、両方あるか両方ないと起動時に弾く。既存の {speaker, lineId} 記法は
そのまま動く。会話フェーズへの配線は後続タスクで行う。"
```

---

### Task 3: 会話のページ分割（`src/ui/talk.ts` の前半）

**Files:**
- Create: `src/ui/talk.ts`
- Create: `src/ui/talk.test.ts`

**Interfaces:**
- Consumes: なし（純粋な文字列処理）
- Produces:
  - `export type Measure = (text: string) => number`
  - `export function wrapText(text: string, measure: Measure, maxWidth: number): string[]`
  - `export function splitPages(text: string, measure: Measure, maxWidth: number, maxLines: number): string[][]`

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/talk.test.ts` を新規作成する。測定は「1文字 = 10px」のダミー。

```ts
import { describe, expect, it } from 'vitest';
import { splitPages, wrapText } from './talk';

/** テスト用の測定。1文字 = 10px とみなす */
const measure = (t: string): number => t.length * 10;

describe('wrapText', () => {
  it('はばに おさまるなら そのまま', () => {
    expect(wrapText('あいうえお', measure, 100)).toEqual(['あいうえお']);
  });

  it('はばを こえたら おりかえす', () => {
    expect(wrapText('あいうえおかきくけこ', measure, 50)).toEqual(['あいうえお', 'かきくけこ']);
  });

  it('\\n で かならず きる', () => {
    expect(wrapText('あい\nうえ', measure, 1000)).toEqual(['あい', 'うえ']);
  });

  it('1もじが はばを こえても むげんループしない', () => {
    expect(wrapText('あいう', measure, 1)).toEqual(['あ', 'い', 'う']);
  });

  it('からもじれつは 1ぎょうに なる', () => {
    expect(wrapText('', measure, 100)).toEqual(['']);
  });
});

describe('wrapText の ぎょうとう きんそく', () => {
  it('ぎょうとうに くる 。 は まえの ぎょうに おしこむ', () => {
    // 5文字で折り返すと ['あいうえお', '。かきく'] になるはず → 。を前へ
    expect(wrapText('あいうえお。かきく', measure, 50)).toEqual(['あいうえお。', 'かきく']);
  });

  it('ぎょうとうに くる 」 も おしこむ', () => {
    expect(wrapText('あいうえお」かきく', measure, 50)).toEqual(['あいうえお」', 'かきく']);
  });

  it('おしこんだ けっか からに なった ぎょうは のこさない', () => {
    expect(wrapText('あいうえお。', measure, 50)).toEqual(['あいうえお。']);
  });
});

describe('splitPages', () => {
  it('maxLines ごとに ページを きる', () => {
    const pages = splitPages('あ\nい\nう\nえ\nお', measure, 1000, 2);
    expect(pages).toEqual([['あ', 'い'], ['う', 'え'], ['お']]);
  });

  it('1ページに おさまるなら 1ページ', () => {
    expect(splitPages('あ\nい', measure, 1000, 3)).toEqual([['あ', 'い']]);
  });

  it('からもじれつでも 1ページ かえす', () => {
    expect(splitPages('', measure, 1000, 3)).toEqual([['']]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/ui/talk.test.ts`
Expected: FAIL。`Failed to resolve import "./talk"`

- [ ] **Step 3: `talk.ts` の分割部分を実装する**

`src/ui/talk.ts` を新規作成する。

```ts
/**
 * 会話フェーズの本文を、枠に収まる行とページに割る。
 *
 * 文字幅の測定は関数として受け取る。本番は ctx.measureText(t).width、
 * テストはダミーを渡す。これによりこのモジュールは Canvas に依存しない。
 */
export type Measure = (text: string) => number;

/** 行頭に置いてはいけない文字。前の行の末尾へぶら下げる */
const NO_LINE_START = '。、！？」';

/**
 * 行頭禁則。ぶら下げ方式なので、押し込んだ行は maxWidth を1文字ぶん超えうる。
 * 追い出し（前の行の最後の文字を次へ送る）はしない。日本語として目立つのは
 * 行頭の約物だけで、そこまでやる価値がないため。
 */
function hangPunctuation(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (prev !== undefined && prev !== '' && line !== '' && NO_LINE_START.includes(line[0]!)) {
      out[out.length - 1] = prev + line[0];
      const rest = line.slice(1);
      if (rest !== '') out.push(rest);
    } else {
      out.push(line);
    }
  }
  return out;
}

/** 明示的な改行で切り、さらに maxWidth で貪欲に折り返す */
export function wrapText(text: string, measure: Measure, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      // line が空のときは幅を見ない。見ると1文字も入らない幅で無限ループする
      if (line !== '' && measure(line + ch) > maxWidth) {
        out.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    out.push(line);
  }
  return hangPunctuation(out);
}

/** 折り返した行を maxLines 行ずつのページに切る */
export function splitPages(
  text: string,
  measure: Measure,
  maxWidth: number,
  maxLines: number,
): string[][] {
  const wrapped = wrapText(text, measure, maxWidth);
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += maxLines) {
    pages.push(wrapped.slice(i, i + maxLines));
  }
  return pages.length > 0 ? pages : [['']];
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/ui/talk.test.ts`
Expected: PASS（16件）

- [ ] **Step 5: 全テストと型チェックを通す**

Run: `npm test && npm run build`
Expected: 全 PASS、ビルド成功

- [ ] **Step 6: コミット**

```bash
git add src/ui/talk.ts src/ui/talk.test.ts
git commit -m "feat: 会話本文のページ分割を足す

文字幅の測定を関数として注入するので Canvas に依存せず、テストが書ける。
1文字が枠幅を超えても無限ループしない。行頭に来る約物は前の行へぶら下げる。"
```

---

### Task 4: 会話の進行（`src/ui/talk.ts` の後半）

**Files:**
- Modify: `src/ui/talk.ts`
- Modify: `src/ui/talk.test.ts`

**Interfaces:**
- Consumes: Task 2 の `TalkLine`（`core/dialogue.ts`）、Task 3 の `Measure` / `splitPages`
- Produces:
  - `export const TALK_CHARS_PER_SEC = 30`
  - `export type TalkState = { lines: TalkLine[]; index: number; pages: string[][]; page: number; shown: number; done: boolean }`
  - `makeTalkState(lines, measure, maxWidth, maxLines): TalkState`
  - `tickTalk(state, dt): void`
  - `advanceTalk(state, measure, maxWidth, maxLines): void`
  - `skipTalk(state): void`
  - `visibleLines(state): string[]`
  - `isPageComplete(state): boolean`
  - `currentSpeaker(state): string | null`
  - `pageCount(state): number`

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/talk.test.ts` に追加する。import 行に足すこと。

```ts
import {
  TALK_CHARS_PER_SEC, advanceTalk, currentSpeaker, isPageComplete, makeTalkState,
  pageCount, skipTalk, splitPages, tickTalk, visibleLines, wrapText,
} from './talk';
import type { TalkLine } from '../core/dialogue';

const LINES: TalkLine[] = [
  { speaker: 'roran', text: 'あい\nうえ\nおか\nきく' },  // 4行 → maxLines 3 で 2ページ
  { speaker: null, text: 'しずかだ。' },
];
const make = () => makeTalkState(LINES, measure, 1000, 3);

describe('TalkState', () => {
  it('つくった ちょくごは 1ぎょうめの 1ページめ、0もじ', () => {
    const s = make();
    expect(s.index).toBe(0);
    expect(s.page).toBe(0);
    expect(s.shown).toBe(0);
    expect(s.done).toBe(false);
    expect(pageCount(s)).toBe(2);
  });

  it('からの はいれつなら さいしょから done', () => {
    expect(makeTalkState([], measure, 1000, 3).done).toBe(true);
  });

  it('speaker を ひける。null は 地の文', () => {
    const s = make();
    expect(currentSpeaker(s)).toBe('roran');
    advanceTalk(s, measure, 1000, 3);  // 1ページめを全文表示
    advanceTalk(s, measure, 1000, 3);  // 2ページめへ
    advanceTalk(s, measure, 1000, 3);  // 2ページめを全文表示
    advanceTalk(s, measure, 1000, 3);  // 2ぎょうめへ
    expect(currentSpeaker(s)).toBeNull();
  });
});

describe('tickTalk', () => {
  it('じかんに おうじて もじが ふえる', () => {
    const s = make();
    tickTalk(s, 0.1);
    expect(s.shown).toBeCloseTo(TALK_CHARS_PER_SEC * 0.1);
  });

  it('ページの もじすうを こえない', () => {
    const s = make();
    tickTalk(s, 100);
    expect(s.shown).toBe(6);  // 'あい' + 'うえ' + 'おか' = 6文字
    expect(isPageComplete(s)).toBe(true);
  });

  it('done なら すすまない', () => {
    const s = make();
    skipTalk(s);
    tickTalk(s, 1);
    expect(s.shown).toBe(0);
  });
});

describe('visibleLines', () => {
  it('とちゅうまでの ぎょうを かえす', () => {
    const s = make();
    s.shown = 3;
    expect(visibleLines(s)).toEqual(['あい', 'う', '']);
  });

  it('ぜんぶ ひょうじずみなら ページの ぜんぎょう', () => {
    const s = make();
    s.shown = 6;
    expect(visibleLines(s)).toEqual(['あい', 'うえ', 'おか']);
  });
});

describe('advanceTalk の 4ぶんき', () => {
  it('おくりの とちゅうなら ぜんぶん ひょうじ', () => {
    const s = make();
    tickTalk(s, 0.05);
    advanceTalk(s, measure, 1000, 3);
    expect(isPageComplete(s)).toBe(true);
    expect(s.page).toBe(0);
  });

  it('ひょうじずみで ページが のこっていれば つぎの ページ', () => {
    const s = make();
    tickTalk(s, 100);
    advanceTalk(s, measure, 1000, 3);
    expect(s.page).toBe(1);
    expect(s.shown).toBe(0);
    expect(s.index).toBe(0);
  });

  it('さいごの ページなら つぎの ぎょうへ', () => {
    const s = make();
    tickTalk(s, 100);
    advanceTalk(s, measure, 1000, 3);  // 2ページめ
    tickTalk(s, 100);
    advanceTalk(s, measure, 1000, 3);  // 2ぎょうめ
    expect(s.index).toBe(1);
    expect(s.page).toBe(0);
    expect(s.shown).toBe(0);
    expect(pageCount(s)).toBe(1);
  });

  it('さいごの ぎょうまで いくと done', () => {
    const s = make();
    for (let i = 0; i < 10; i++) advanceTalk(s, measure, 1000, 3);
    expect(s.done).toBe(true);
  });

  it('done の あと よんでも こわれない', () => {
    const s = make();
    skipTalk(s);
    expect(() => advanceTalk(s, measure, 1000, 3)).not.toThrow();
  });
});

describe('skipTalk', () => {
  it('そくざに done に なる', () => {
    const s = make();
    skipTalk(s);
    expect(s.done).toBe(true);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/ui/talk.test.ts`
Expected: FAIL。`makeTalkState` などが存在しない。

- [ ] **Step 3: 進行部分を実装する**

`src/ui/talk.ts` の先頭に import を足す。

```ts
import type { TalkLine } from '../core/dialogue';
```

ファイル末尾に追加する。

```ts
/** 文字送りの速さ。読者設定は持たないのでエンジン側の定数 */
export const TALK_CHARS_PER_SEC = 30;

export type TalkState = {
  lines: TalkLine[];
  /** 今どの行か */
  index: number;
  /** 今の行を「ページ × 表示行」に割ったもの */
  pages: string[][];
  /** 今どのページか */
  page: number;
  /** そのページの先頭から何文字表示したか。小数を持つので描画側で floor する */
  shown: number;
  done: boolean;
};

function pageLength(page: string[]): number {
  return page.reduce((n, line) => n + line.length, 0);
}

function currentPage(state: TalkState): string[] {
  return state.pages[state.page] ?? [];
}

export function makeTalkState(
  lines: TalkLine[],
  measure: Measure,
  maxWidth: number,
  maxLines: number,
): TalkState {
  const first = lines[0];
  return {
    lines,
    index: 0,
    pages: first ? splitPages(first.text, measure, maxWidth, maxLines) : [['']],
    page: 0,
    shown: 0,
    done: lines.length === 0,
  };
}

export function tickTalk(state: TalkState, dt: number): void {
  if (state.done) return;
  state.shown = Math.min(pageLength(currentPage(state)), state.shown + TALK_CHARS_PER_SEC * dt);
}

export function isPageComplete(state: TalkState): boolean {
  return Math.floor(state.shown) >= pageLength(currentPage(state));
}

/** 今表示すべき行。文字送りの途中なら途中まで切って返す */
export function visibleLines(state: TalkState): string[] {
  let remain = Math.floor(state.shown);
  return currentPage(state).map((line) => {
    const take = Math.max(0, Math.min(line.length, remain));
    remain -= line.length;
    return line.slice(0, take);
  });
}

export function pageCount(state: TalkState): number {
  return state.pages.length;
}

export function currentSpeaker(state: TalkState): string | null {
  return state.lines[state.index]?.speaker ?? null;
}

/**
 * タップ1回ぶん進める。
 * 送りの途中なら全文表示 → 次のページ → 次の行 → done、の順に落ちる。
 */
export function advanceTalk(
  state: TalkState,
  measure: Measure,
  maxWidth: number,
  maxLines: number,
): void {
  if (state.done) return;

  if (!isPageComplete(state)) {
    state.shown = pageLength(currentPage(state));
    return;
  }
  if (state.page + 1 < state.pages.length) {
    state.page += 1;
    state.shown = 0;
    return;
  }
  const next = state.lines[state.index + 1];
  if (next) {
    state.index += 1;
    state.pages = splitPages(next.text, measure, maxWidth, maxLines);
    state.page = 0;
    state.shown = 0;
    return;
  }
  state.done = true;
}

export function skipTalk(state: TalkState): void {
  state.done = true;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/ui/talk.test.ts`
Expected: PASS

- [ ] **Step 5: 全テストと型チェックを通す**

Run: `npm test && npm run build`
Expected: 全 PASS、ビルド成功

- [ ] **Step 6: コミット**

```bash
git add src/ui/talk.ts src/ui/talk.test.ts
git commit -m "feat: 会話フェーズの進行状態を足す

タップは、送りの途中なら全文表示、表示済みなら次のページ、
最終ページなら次の行、最終行なら終了、の順に落ちる。"
```

---

### Task 5: セーブの既読フィールド

**Files:**
- Modify: `src/save/save.ts`
- Modify: `src/ui/flow.ts`
- Test: `src/save/save.test.ts`, `src/ui/flow.test.ts`

**Interfaces:**
- Consumes: Task 1 の `reg.stages`（整列済み）
- Produces:
  - `SaveData.readIntroStageIds: string[]`
  - `export function hasReadIntro(save: SaveData, stageId: string): boolean`
  - `export function markIntroRead(save: SaveData, stageId: string): SaveData`

- [ ] **Step 1: 失敗するテストを書く（save）**

`src/save/save.test.ts` に追加する。`reg` は既存テストが使っているもの（`testRegistry()` 由来）をそのまま使い、新しく作らない。

```ts
describe('readIntroStageIds', () => {
  it('あたらしい セーブでは からの はいれつ', () => {
    expect(newSave(reg).readIntroStageIds).toEqual([]);
  });

  it('readIntroStageIds の ない きゅうセーブも よめる（バージョンは あげない）', () => {
    const storage = fakeStorage();
    const old = { version: 2, clearedStageIds: ['stage1'], units: {}, counters: {}, titles: [] };
    storage.setItem(SAVE_KEY, JSON.stringify(old));
    const loaded = loadSave(storage, reg);
    expect(loaded).not.toBeNull();
    expect(loaded!.readIntroStageIds).toEqual([]);
    expect(loaded!.clearedStageIds).toEqual(['stage1']);
  });

  it('レジストリに ない ステージ id は すてる', () => {
    const storage = fakeStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({
      ...newSave(reg), readIntroStageIds: ['stage1', 'nonexistent'],
    }));
    expect(loadSave(storage, reg)!.readIntroStageIds).toEqual(['stage1']);
  });

  it('こわれた readIntroStageIds でも ほかの フィールドは のこる', () => {
    const storage = fakeStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({
      ...newSave(reg), readIntroStageIds: 'こわれている', clearedStageIds: ['stage1'],
    }));
    const loaded = loadSave(storage, reg)!;
    expect(loaded.readIntroStageIds).toEqual([]);
    expect(loaded.clearedStageIds).toEqual(['stage1']);
  });
});
```

`fakeStorage` は既存テストにあるヘルパを使う。無ければ次を定義する。

```ts
function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
  };
}
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/save/save.test.ts`
Expected: FAIL。`readIntroStageIds` が存在しない。

- [ ] **Step 3: `save.ts` にフィールドを足す**

`SaveData` に足す。**`SAVE_VERSION` は 2 のまま触らない。**

```ts
export type SaveData = {
  version: number;
  clearedStageIds: string[];
  /** 会話を最後まで読み終えたステージの id。「とばす」を出してよいかの判定に使う */
  readIntroStageIds: string[];
  units: Record<string, CharProgress>;
  counters: Record<string, number>;
  titles: string[];
};
```

`newSave` の戻り値に足す。

```ts
  return {
    version: SAVE_VERSION, clearedStageIds: [], readIntroStageIds: [],
    units, counters: {}, titles: [],
  };
```

`reconcile` の `clearedStageIds` を読むブロックの直後に足す。

```ts
  // 旧セーブにこのフィールドは無い。newSave 由来の [] がそのまま残り、全ステージが未読になる。
  // フィールドを足すだけなら SAVE_VERSION を上げなくてよいのはこのため
  if (Array.isArray(raw.readIntroStageIds)) {
    const known = new Set(reg.stages.map((s) => s.id));
    save.readIntroStageIds = raw.readIntroStageIds.filter(
      (id): id is string => typeof id === 'string' && known.has(id),
    );
  }
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/save/save.test.ts`
Expected: PASS

- [ ] **Step 5: 失敗するテストを書く（flow）**

`src/ui/flow.test.ts` に追加する。

```ts
describe('既読の きろく', () => {
  it('きろくが なければ みどく', () => {
    expect(hasReadIntro(newSave(reg), 'stage1')).toBe(false);
  });

  it('きろくすると きどくに なる', () => {
    const s = markIntroRead(newSave(reg), 'stage1');
    expect(hasReadIntro(s, 'stage1')).toBe(true);
    expect(hasReadIntro(s, 'stage2')).toBe(false);
  });

  it('おなじ ステージを 2ど きろくしても ふえない', () => {
    const once = markIntroRead(newSave(reg), 'stage1');
    const twice = markIntroRead(once, 'stage1');
    expect(twice.readIntroStageIds).toEqual(['stage1']);
    expect(twice).toBe(once);  // 変化がなければ同じ参照を返す
  });

  it('もとの セーブを かきかえない', () => {
    const before = newSave(reg);
    markIntroRead(before, 'stage1');
    expect(before.readIntroStageIds).toEqual([]);
  });
});
```

- [ ] **Step 6: テストが失敗することを確認**

Run: `npx vitest run src/ui/flow.test.ts`
Expected: FAIL。`hasReadIntro` が存在しない。

- [ ] **Step 7: `flow.ts` に判定と記録を足す**

`src/ui/flow.ts` の `isStageUnlocked` の直後に足す。

```ts
export function hasReadIntro(save: SaveData, stageId: string): boolean {
  return save.readIntroStageIds.includes(stageId);
}

/** 変化がなければ同じ参照を返す。呼び出し側が無駄な writeSave をしなくて済む */
export function markIntroRead(save: SaveData, stageId: string): SaveData {
  if (save.readIntroStageIds.includes(stageId)) return save;
  return { ...save, readIntroStageIds: [...save.readIntroStageIds, stageId] };
}
```

- [ ] **Step 8: テストが通ることを確認**

Run: `npx vitest run src/ui/flow.test.ts`
Expected: PASS

- [ ] **Step 9: 全テストと型チェックを通す**

Run: `npm test && npm run build`
Expected: 全 PASS、ビルド成功

- [ ] **Step 10: コミット**

```bash
git add src/save/save.ts src/save/save.test.ts src/ui/flow.ts src/ui/flow.test.ts
git commit -m "feat: 会話を読み終えたステージをセーブに記録する

SAVE_VERSION は上げない。reconcile は欠けたフィールドを既定値で補うので、
フィールドを1つ足すだけなら旧セーブがそのまま読める。"
```

---

### Task 6: `talk` フェーズの配線と描画

**Files:**
- Modify: `src/ui/layout.ts`（`TALK_WINDOW`、`BTN.skip`）
- Modify: `src/ui/screens.ts`（`drawTalk`）
- Modify: `src/main.ts`（`Phase` に `'talk'`、`beginStage`、`onPointerDown`、`update`、`render`）
- Test: 手動確認（描画コードにはテストを書かない方針）

**Interfaces:**
- Consumes: Task 2 の `pickStageIntro`、Task 4 の `TalkState` 一式、Task 5 の `hasReadIntro` / `markIntroRead`
- Produces: `export const TALK_WINDOW: Rect`、`BTN.skip: Rect`、`export function drawTalk(...)`

- [ ] **Step 1: レイアウト定数を足す**

`src/ui/layout.ts` の `BTN` に `skip` を追加し、末尾に会話ウィンドウの定数を足す。

```ts
export const BTN = {
  // ...既存はそのまま
  toSelect: { x: 510, y: 380, w: 200, h: 72 } as Rect,
  skip: { x: 780, y: 276, w: 140, h: 44 } as Rect,
} as const;

/** 会話ウィンドウ。論理解像度 960×540 の下部に置く */
export const TALK_WINDOW = { x: 40, y: 330, w: 880, h: 180 } as Rect;
/** 本文の描き始め（話者の顔の丸のぶん右へ寄せる）。地の文では TALK_PAD を使う */
export const TALK_BODY_X = 100;
export const TALK_PAD = 24;
export const TALK_LINE_H = 36;
export const TALK_MAX_LINES = 3;
export const TALK_FONT = '26px sans-serif';
```

- [ ] **Step 2: `drawTalk` を書く**

`src/ui/screens.ts` の `drawBubble` の直後に足す。先に import を足す。

```ts
import {
  BOTTOM_BAR_H, BOTTOM_BAR_Y, BTN, TALK_BODY_X, TALK_FONT, TALK_LINE_H, TALK_PAD,
  TALK_WINDOW, portraitSlot, skillButtonAt, stageSlot,
} from './layout';
import { currentSpeaker, pageCount, visibleLines } from './talk';
import type { TalkState } from './talk';
```


```ts
/** 会話フェーズのウィンドウ。背景のマップは呼び出し側が先に描いておく */
export function drawTalk(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  state: TalkState,
  canSkip: boolean,
): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  if (canSkip) button(ctx, BTN.skip, 'とばす');

  const r = TALK_WINDOW;
  panel(ctx, r, '#f7f3e6');

  const speaker = currentSpeaker(state);
  // 地の文は顔の丸も名前も出さず、本文を左端から描く
  const bodyX = r.x + (speaker === null ? TALK_PAD : TALK_BODY_X);

  if (speaker !== null) {
    const info = lookupDef(reg, speaker) ?? { name: speaker, color: '#888888' };
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.arc(r.x + 54, r.y + 60, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '20px sans-serif';
    ctx.fillText(info.name, bodyX, r.y + 34);
  }

  ctx.fillStyle = '#1a1a1a';
  ctx.font = TALK_FONT;
  visibleLines(state).forEach((line, i) => {
    ctx.fillText(line, bodyX, r.y + 74 + i * TALK_LINE_H);
  });

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'right';
  if (pageCount(state) > 1) {
    ctx.fillText(`${state.page + 1} / ${pageCount(state)}`, r.x + r.w - 20, r.y + r.h - 18);
  } else {
    ctx.fillText('タップで つぎへ', r.x + r.w - 20, r.y + r.h - 18);
  }
  ctx.textAlign = 'left';
}
```

- [ ] **Step 3: `main.ts` に `talk` フェーズを組み込む**

`Phase` 型に足す。

```ts
type Phase = 'title' | 'select' | 'talk' | 'placement' | 'battle' | 'result' | 'defeat';
```

モジュール変数を足す（`const bubbles = ...` の近く）。

```ts
let talk: TalkState | null = null;
/** 会話の文字幅測定。ctx を閉じ込めるので talk.ts 側は Canvas を知らない */
const talkMeasure: Measure = (t) => {
  ctx.save();
  ctx.font = TALK_FONT;
  const w = ctx.measureText(t).width;
  ctx.restore();
  return w;
};
const talkMaxWidth = TALK_WINDOW.w - TALK_BODY_X - TALK_PAD;
```

`beginStage` の末尾を書き換える。

```ts
  commands.length = 0;
  accumulator = 0;
  talk = makeTalkState(
    pickStageIntro(registry, battle.stage), talkMeasure, talkMaxWidth, TALK_MAX_LINES,
  );
  phase = talk.done ? 'placement' : 'talk';
```

`onPointerDown` の先頭にある `if (isBlocking(bubbles)) { ... }` は**この時点ではまだ残す**（Task 7 で消す）。`switch (phase)` に `talk` の分岐を足す。

```ts
    case 'talk': {
      if (!talk) return;
      if (hasReadIntro(save, stageId) && hitRect(BTN.skip, p)) skipTalk(talk);
      else advanceTalk(talk, talkMeasure, talkMaxWidth, TALK_MAX_LINES);
      if (talk.done) endTalk();
      return;
    }
```

`beginStage` の直後にヘルパを足す。

```ts
/** 会話フェーズを終える。読み切った記録を残してから配置へ移る */
function endTalk(): void {
  const next = markIntroRead(save, stageId);
  if (next !== save) {
    save = next;
    hasSave = writeSave(window.localStorage, save) || hasSave;
  }
  phase = 'placement';
}
```

注意: `skipTalk` でも `done` になるが、「とばす」を押せるのは既読のときだけなので `markIntroRead` は必ず既存の参照を返し、余計な `writeSave` は走らない。

`update` の先頭、`tickEffects` の直後に足す。

```ts
  if (phase === 'talk' && talk) {
    tickTalk(talk, dt);
    return;
  }
```

`render` の `switch (phase)` に足す。

```ts
    case 'talk':
      if (battle && talk) {
        drawBattle(ctx, registry, battle, null, effects, escorts);
        drawTalk(ctx, registry, talk, hasReadIntro(save, stageId));
      }
      break;
```

import 文に次を足す。

```ts
import { TALK_BODY_X, TALK_FONT, TALK_MAX_LINES, TALK_PAD, TALK_WINDOW } from './ui/layout';
import { advanceTalk, makeTalkState, skipTalk, tickTalk } from './ui/talk';
import type { Measure, TalkState } from './ui/talk';
import { drawTalk } from './ui/screens';
import { hasReadIntro, markIntroRead } from './ui/flow';
```

Task 2 の Step 10 で消した `enqueue(bubbles, pickStageIntro(...))` は**復活させない**。会話は `talk` フェーズが持つ。

- [ ] **Step 4: 型チェックとテストを通す**

Run: `npm test && npm run build`
Expected: 全 PASS、ビルド成功

- [ ] **Step 5: 手動で確認する**

Run: `npm run dev`

以下を目で確認する。

1. 「はじめから」→ stage1 を選ぶと、**配置の前に**会話が出る
2. 1行目「みちの さきに、けむりが みえる。」に**名前と顔の丸が出ない**（地の文）
3. 2行目でロランの名前と色つき丸が出る
4. 文字が1文字ずつ出る。**送りの途中でタップすると全文が出て、もう一度タップで次へ**
5. 背景にステージのマップと、配置済みの味方4人が見える
6. 会話が終わると配置フェーズに移り、「きいろい わくの なかに なかまを おこう」が出る
7. 初回は「とばす」が**出ない**
8. 一度会話を読み終えてからステージ選択に戻り、stage1 を選び直すと「とばす」が**出る**。押すと即座に配置へ移る
9. stage2（`intro` なし）を選ぶと、会話フェーズを素通りして配置へ直行する

- [ ] **Step 6: コミット**

```bash
git add src/ui/layout.ts src/ui/screens.ts src/main.ts
git commit -m "feat: ステージ開始時の会話フェーズを足す

配置フェーズの前に会話を置く。文字送りとページ送りがあり、既読の
ステージでは「とばす」を出す。intro のないステージは素通りする。"
```

---

### Task 7: 戦闘中の吹き出しを頭上表示へ作り替える

**Files:**
- Modify: `src/ui/bubbles.ts`（全面書き換え）
- Modify: `src/ui/bubbles.test.ts`（全面書き換え）
- Modify: `src/core/dialogue.ts`（`DialogueRequest` に `uid`）
- Modify: `src/ui/layout.ts`（`bubbleRectAt`）
- Create: `src/ui/layout.test.ts`
- Modify: `src/ui/screens.ts`（`drawBubble` を頭上の小さい吹き出しへ）
- Modify: `src/main.ts`（判定順、`isBlocking` 依存の削除）

**Interfaces:**
- Consumes: Task 6 で `talk` フェーズが動いていること
- Produces:
  - `DialogueRequest.uid: string`
  - `export const BUBBLE_DURATION = 3.0`
  - `export type BubbleState = { items: Map<string, Bubble> }`
  - `makeBubbleState()` / `pushBubbles(state, reqs)` / `tickBubbles(state, dt)` / `dismissBubble(state, uid)` / `clearBubbles(state)`
  - `export function bubbleRectAt(logicalPos: Vec2, text: string): Rect`

- [ ] **Step 1: `DialogueRequest` に `uid` を足す**

`src/core/dialogue.ts` を編集する。

```ts
export type DialogueRequest = { uid: string; speaker: Speaker; lineId: string; text: string };
```

`make` の引数に `uid` を追加する。

```ts
function make(reg: Registry, uid: string, speaker: Speaker, lineId: string): DialogueRequest | null {
  const text = reg.lines.get(lineId);
  if (text === undefined) return null;
  return { uid, speaker, lineId, text };
}
```

`pickDialogue` の各 `make` 呼び出しに、そのイベントの `uid` を渡す。`SimEvent` は喋る側の `uid` を全種類持っている（`types.ts:82`）。

この変更で `src/core/dialogue.test.ts` の既存アサーションが壊れる場合がある（`DialogueRequest` を直接組み立てている箇所、または返り値を `toEqual` で丸ごと比較している箇所）。壊れたら `uid` を足して直す。**`uid` が正しいイベントのものになっているかを1件はアサートすること** — ここを間違えると、別のキャラの頭上に吹き出しが出る。

```ts
      case 'engage': {
        if (!ev.firstMeeting) break;
        const rival = make(reg, ev.uid, ally(ev.defId), `rival:${ev.defId}:${ev.targetDefId}`);
        if (rival) push('rival', rival);
        else push('first', make(reg, ev.uid, ally(ev.defId), `first:${ev.defId}:${ev.targetDefId}`));
        break;
      }
      case 'skill':
        push('skill', make(reg, ev.uid, ally(ev.defId), `skill:${ev.defId}`));
        break;
      case 'levelUp':
        push('levelup', make(reg, ev.uid, { side: 'ally', id: ev.defId }, `levelup:${ev.defId}`));
        break;
      case 'pinch':
        push('pinch', make(reg, ev.uid, ally(ev.defId), `pinch:${ev.defId}`));
        break;
      case 'unitFled':
        // 喋るのは撃退した側なので byUid を使う
        if (ev.byDefId && ev.byUid) push('win', make(reg, ev.byUid, ally(ev.byDefId), `win:${ev.byDefId}`));
        break;
      case 'unitRetired':
        push('retire', make(reg, ev.uid, ally(ev.defId), `retire:${ev.defId}`));
        break;
```

- [ ] **Step 2: 失敗するテストを書く（bubbles）**

`src/ui/bubbles.test.ts` を全面的に書き換える。

```ts
import { describe, expect, it } from 'vitest';
import {
  BUBBLE_DURATION, clearBubbles, dismissBubble, makeBubbleState, pushBubbles, tickBubbles,
} from './bubbles';
import type { DialogueRequest } from '../core/dialogue';

const req = (uid: string, text: string): DialogueRequest =>
  ({ uid, speaker: { side: 'ally', id: 'roran' }, lineId: text, text });

describe('BubbleState', () => {
  it('さいしょは からっぽ', () => {
    expect(makeBubbleState().items.size).toBe(0);
  });

  it('つむと uid ごとに はいる', () => {
    const s = makeBubbleState();
    pushBubbles(s, [req('p1', 'あ'), req('p2', 'い')]);
    expect(s.items.size).toBe(2);
    expect(s.items.get('p1')!.text).toBe('あ');
  });

  it('おなじ uid は うわがきする', () => {
    const s = makeBubbleState();
    pushBubbles(s, [req('p1', 'ふるい')]);
    tickBubbles(s, 1);
    pushBubbles(s, [req('p1', 'あたらしい')]);
    expect(s.items.size).toBe(1);
    expect(s.items.get('p1')!.text).toBe('あたらしい');
    expect(s.items.get('p1')!.ttl).toBe(BUBBLE_DURATION);  // 寿命も引き直す
  });

  it('じゅみょうが つきたら きえる', () => {
    const s = makeBubbleState();
    pushBubbles(s, [req('p1', 'あ')]);
    tickBubbles(s, BUBBLE_DURATION - 0.1);
    expect(s.items.size).toBe(1);
    tickBubbles(s, 0.2);
    expect(s.items.size).toBe(0);
  });

  it('べつの uid は どうじに のこる', () => {
    const s = makeBubbleState();
    pushBubbles(s, [req('p1', 'あ')]);
    tickBubbles(s, 2);
    pushBubbles(s, [req('p2', 'い')]);
    tickBubbles(s, 1.5);
    expect(s.items.has('p1')).toBe(false);  // 3.5秒たった
    expect(s.items.has('p2')).toBe(true);   // 1.5秒しかたっていない
  });

  it('うちけすと その1つだけ きえる', () => {
    const s = makeBubbleState();
    pushBubbles(s, [req('p1', 'あ'), req('p2', 'い')]);
    dismissBubble(s, 'p1');
    expect(s.items.has('p1')).toBe(false);
    expect(s.items.has('p2')).toBe(true);
  });

  it('いない uid を うちけしても こわれない', () => {
    const s = makeBubbleState();
    expect(() => dismissBubble(s, 'いない')).not.toThrow();
  });

  it('からっぽを tick しても こわれない', () => {
    const s = makeBubbleState();
    expect(() => tickBubbles(s, 1)).not.toThrow();
  });

  it('clearBubbles で ぜんぶ きえる', () => {
    const s = makeBubbleState();
    pushBubbles(s, [req('p1', 'あ'), req('p2', 'い')]);
    clearBubbles(s);
    expect(s.items.size).toBe(0);
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `npx vitest run src/ui/bubbles.test.ts`
Expected: FAIL。`makeBubbleState` が存在しない。

- [ ] **Step 4: `bubbles.ts` を書き換える**

`src/ui/bubbles.ts` の中身を全部次で置き換える。

```ts
import type { DialogueRequest } from '../core/dialogue';

/** 頭上の吹き出しが消えるまでの秒数。読ませるのではなく気づかせるための長さ */
export const BUBBLE_DURATION = 3.0;

export type Bubble = { uid: string; text: string; ttl: number };

/**
 * uid をキーにするので、同じキャラの連続発話は自動的に上書きになる。
 * 位置は持たない。描画のたびにそのユニットの現在位置を引くので、
 * 喋りながら移動しても吹き出しが付いてくる。
 */
export type BubbleState = { items: Map<string, Bubble> };

export function makeBubbleState(): BubbleState {
  return { items: new Map() };
}

export function pushBubbles(state: BubbleState, reqs: DialogueRequest[]): void {
  for (const r of reqs) {
    state.items.set(r.uid, { uid: r.uid, text: r.text, ttl: BUBBLE_DURATION });
  }
}

export function tickBubbles(state: BubbleState, dt: number): void {
  // Map は反復中の delete が安全に定義されている
  for (const [uid, b] of state.items) {
    b.ttl -= dt;
    if (b.ttl <= 0) state.items.delete(uid);
  }
}

export function dismissBubble(state: BubbleState, uid: string): void {
  state.items.delete(uid);
}

export function clearBubbles(state: BubbleState): void {
  state.items.clear();
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npx vitest run src/ui/bubbles.test.ts`
Expected: PASS（9件）

- [ ] **Step 6: 失敗するテストを書く（`bubbleRectAt`）**

`src/ui/layout.test.ts` を新規作成する。

```ts
import { describe, expect, it } from 'vitest';
import { bubbleRectAt } from './layout';

describe('bubbleRectAt', () => {
  it('キャラの まうえに でる', () => {
    const r = bubbleRectAt({ x: 480, y: 300 }, 'あいう');
    expect(r.x + r.w / 2).toBeCloseTo(480);
    expect(r.y + r.h).toBeLessThan(300);  // キャラより上
  });

  it('もじすうに おうじて はばが かわる', () => {
    const narrow = bubbleRectAt({ x: 480, y: 300 }, 'あ');
    const wide = bubbleRectAt({ x: 480, y: 300 }, 'あいうえおかきくけこ');
    expect(wide.w).toBeGreaterThan(narrow.w);
  });

  it('ぎょうすうに おうじて たかさが かわる', () => {
    const one = bubbleRectAt({ x: 480, y: 300 }, 'あ');
    const two = bubbleRectAt({ x: 480, y: 300 }, 'あ\nい');
    expect(two.h).toBeGreaterThan(one.h);
  });

  it('ひだりはしで はみださない', () => {
    expect(bubbleRectAt({ x: 0, y: 300 }, 'あいうえお').x).toBeGreaterThanOrEqual(8);
  });

  it('みぎはしで はみださない', () => {
    const r = bubbleRectAt({ x: 960, y: 300 }, 'あいうえお');
    expect(r.x + r.w).toBeLessThanOrEqual(952);
  });

  it('うえはしで はみださない', () => {
    expect(bubbleRectAt({ x: 480, y: 0 }, 'あ').y).toBeGreaterThanOrEqual(52);
  });
});
```

- [ ] **Step 7: テストが失敗することを確認**

Run: `npx vitest run src/ui/layout.test.ts`
Expected: FAIL。`bubbleRectAt` が存在しない。

- [ ] **Step 8: `bubbleRectAt` を実装する**

`src/ui/layout.ts` の末尾に足す。`Vec2` の import を追加すること。

```ts
export const BUBBLE_FONT_PX = 16;
export const BUBBLE_LINE_H = 20;
const BUBBLE_PAD = 10;
const BUBBLE_MAX_W = 320;
/** キャラの中心から吹き出しの下端までの距離。丸（当たり判定は半径32）と重ならない値 */
const BUBBLE_LIFT = 44;

/**
 * キャラの頭上に出す吹き出しの矩形。描画と当たり判定の両方がこれを使う。
 * 別々に書くと必ずずれるため、必ずこの1本を通すこと。
 *
 * 幅は文字数からの概算で、measureText は使わない。当たり判定側が
 * 描画コンテキストを持たないため。全角前提なので実測とほぼ合う。
 */
export function bubbleRectAt(logicalPos: Vec2, text: string): Rect {
  const lines = text.split('\n');
  const longest = lines.reduce((n, l) => Math.max(n, l.length), 0);
  const w = Math.min(BUBBLE_MAX_W, longest * BUBBLE_FONT_PX + BUBBLE_PAD * 2);
  const h = lines.length * BUBBLE_LINE_H + BUBBLE_PAD * 2;
  // 960 は論理解像度の幅。skillButtonAt と同じ書き方に揃えている
  const x = Math.max(8, Math.min(960 - w - 8, logicalPos.x - w / 2));
  const y = Math.max(52, logicalPos.y - BUBBLE_LIFT - h);
  return { x, y, w, h };
}
```

- [ ] **Step 9: テストが通ることを確認**

Run: `npx vitest run src/ui/layout.test.ts`
Expected: PASS（6件）

- [ ] **Step 10: `drawBubble` を頭上の吹き出しへ書き換える**

`src/ui/screens.ts` の `drawBubble` を次で置き換える。全画面の暗幕は無くなる。

```ts
/** 戦闘中の吹き出し。キャラの頭上に出し、時間は止めない */
export function drawBubble(ctx: CanvasRenderingContext2D, bubble: Bubble, logicalPos: Vec2): void {
  const r = bubbleRectAt(logicalPos, bubble.text);
  panel(ctx, r, '#f7f3e6');

  // 吹き出しの尻尾。キャラの方を指す
  ctx.fillStyle = '#f7f3e6';
  ctx.beginPath();
  ctx.moveTo(r.x + r.w / 2 - 8, r.y + r.h);
  ctx.lineTo(r.x + r.w / 2 + 8, r.y + r.h);
  ctx.lineTo(r.x + r.w / 2, r.y + r.h + 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1a1a1a';
  ctx.font = `${BUBBLE_FONT_PX}px sans-serif`;
  bubble.text.split('\n').forEach((line, i) => {
    ctx.fillText(line, r.x + 10, r.y + 24 + i * BUBBLE_LINE_H);
  });
}
```

import に `bubbleRectAt`, `BUBBLE_FONT_PX`, `BUBBLE_LINE_H`, `Bubble`, `Vec2` を足し、不要になった `DialogueRequest` の import を外す。

- [ ] **Step 11: `main.ts` を書き換える**

`onPointerDown` 冒頭の3行を**削除**する。

```ts
  // 削除する
  if (isBlocking(bubbles)) {
    advanceBubble(bubbles);
    return;
  }
```

`case 'battle'` を書き換える。判定順は スキルボタン → 吹き出し → マップ。

```ts
    case 'battle': {
      if (!battle) return;
      if (pendingSkill) {
        pointerStart = null;
        commands.push({ type: 'skill', uid: pendingSkill, dest: logicalToMap(p) });
        pendingSkill = null;
        return;
      }
      // 1) スキルボタン。吹き出しと重なりうるので操作を先に見る
      if (selected) {
        const unit = battle.units.find((u) => u.uid === selected)!;
        const canTap = !unit.retired && battle.time >= unit.skillCooldownUntil;
        if (canTap && hitRect(skillButtonAt(mapToLogical(unit.pos)), p)) {
          pointerStart = null;
          if (skillParam(battle.reg, unit.skillId ?? '', 'needsDest', 0) === 1) pendingSkill = selected;
          else commands.push({ type: 'skill', uid: selected });
          return;
        }
      }
      // 2) 吹き出し。当たったらその1つだけ消す
      for (const b of bubbles.items.values()) {
        const unit = battle.units.find((u) => u.uid === b.uid);
        if (!unit) continue;
        if (hitRect(bubbleRectAt(mapToLogical(unit.pos), b.text), p)) {
          dismissBubble(bubbles, b.uid);
          return;
        }
      }
      // 3) マップ操作
      beginMapPointer(battle, p, ev);
      return;
    }
```

`beginStage` の `bubbles.items.length = 0;` を書き換える。

```ts
  clearBubbles(bubbles);
```

`const bubbles = makeBubbleQueue();` を書き換える。

```ts
const bubbles = makeBubbleState();
```

`update` を書き換える。時間停止が消え、`tickBubbles` が入る。

```ts
function update(dt: number): void {
  tickEffects(effects, dt);
  if (phase === 'talk' && talk) {
    tickTalk(talk, dt);
    return;
  }
  if (phase !== 'battle' || !battle) return;
  syncDisplayedHp(effects, battle.units, dt);
  tickBubbles(bubbles, dt);

  accumulator += dt;
  while (accumulator >= FIXED_DT) {
    accumulator -= FIXED_DT;
    const batch = commands.splice(0, commands.length);
    step(battle, batch, FIXED_DT);
    spawnEffects(effects, battle.events);
    pushBubbles(bubbles, pickDialogue(battle.reg, battle.events));
  }

  // 以下（defeat / victory の判定）は変更なし
```

`while` ループ末尾の `if (isBlocking(bubbles)) break;` を**削除**する。

`render` の末尾、`const bubble = currentBubble(bubbles); if (bubble) drawBubble(...)` を書き換える。**スキルボタンより先に描く**（スキルボタンが上に乗る）。`case 'battle'` の中に移す。

```ts
    case 'battle':
      if (battle) {
        drawBattle(ctx, registry, battle, selected, effects, escorts);
        drawBottomBar(ctx, registry, battle, selected, escorts);
        for (const b of bubbles.items.values()) {
          const unit = battle.units.find((u) => u.uid === b.uid);
          if (unit) drawBubble(ctx, b, mapToLogical(unit.pos));
        }
        if (selected) drawSkillButton(ctx, registry, battle, selected);
      }
      break;
```

import を整理する。`advanceBubble` / `currentBubble` / `enqueue` / `isBlocking` / `makeBubbleQueue` を外し、次を入れる。

```ts
import { clearBubbles, dismissBubble, makeBubbleState, pushBubbles, tickBubbles } from './ui/bubbles';
import { bubbleRectAt } from './ui/layout';
```

- [ ] **Step 12: 全テストと型チェックを通す**

Run: `npm test && npm run build`
Expected: 全 PASS、ビルド成功

- [ ] **Step 13: 手動で確認する（このタスクの本命）**

Run: `npm run dev`

**バグが直ったことを確認する。**

1. stage1 を始め、敵と初遭遇して吹き出しが出た瞬間に、**キャラをドラッグして移動指示を出す** → 線が出て、指示どおり動く（従来はここで指示が消えていた）
2. 吹き出しが出ている間も**戦闘の時間が止まらない**
3. 吹き出しはキャラの頭上に出て、キャラと一緒に**移動する**
4. 吹き出しをタップすると**その1つだけ**消える。他のキャラの吹き出しは残る
5. キャラ本体（丸）をタップすると、**吹き出しを消さずに**選択できる
6. 複数のキャラが同時に喋ると、**それぞれの頭上に出る**
7. 同じキャラが続けて喋ると、**新しい台詞で上書き**される
8. 選択中のキャラが喋ったとき、スキルボタンが吹き出しの**上に**描かれ、タップするとスキルが出る（吹き出しが消えるのではなく）
9. 画面の左右端・上端にいるキャラの吹き出しが**画面外へはみ出さない**

- [ ] **Step 14: コミット**

```bash
git add src/ui/bubbles.ts src/ui/bubbles.test.ts src/ui/layout.ts src/ui/layout.test.ts src/ui/screens.ts src/core/dialogue.ts src/main.ts
git commit -m "fix: 戦闘中の吹き出しが移動指示を食う問題を、頭上表示への作り替えで直す

吹き出し表示中は pointerdown が必ず吹き出し送りに食われて return し、
pointerStart が立たないため後続の pointermove/pointerup が捨てられていた。
ジェスチャ自体が始まらないので、ドラッグしても移動指示にならなかった。

キューと isBlocking を廃止し、uid をキーにした寿命つき Map へ置き換える。
時間停止とタップ横取りが両方なくなる。吹き出しは自身をタップしたときだけ消え、
判定順はスキルボタン→吹き出し→マップとして操作を優先する。"
```

---

### Task 8: README の更新

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1〜7 のすべて
- Produces: なし

- [ ] **Step 1: 「コンテンツの足しかた」を更新する**

`README.md` の「**ステージ** — `assets/stages/<id>.json` を1本置く。ファイル名と `id` を一致させること」の行を置き換える。

```markdown
- **ステージ** — `assets/stages/<id>.json` を1本置く。ファイル名と `id` を一致させ、`order` に並び順を書く（昇順に並ぶ。欠番は自由、重複は起動時エラー。10, 20, 30 と空けておくと後から間に挟める）
- **ステージ開始時の会話** — ステージの `intro` に書く。`speaker` を省略すると地の文になり、本文は `text` に直書きするか `lineId` で `assets/lines/` を参照する（両方書くとエラー）
```

- [ ] **Step 2: 「そうさ」に会話フェーズを足す**

「そうさ」の表の下、既存の説明文の前に段落を足す。

```markdown
ステージを選ぶと、まず会話から始まる。タップで送り、文字送りの途中でタップすると全文が出る。一度読み終えたステージでは「とばす」が出る。

戦闘中の会話は、喋ったキャラの頭上に数秒だけ出る。時間は止まらない。邪魔なら吹き出しをタップすると消える。
```

- [ ] **Step 3: 確認してコミット**

Run: `npm test && npm run build`
Expected: 全 PASS、ビルド成功

```bash
git add README.md
git commit -m "docs: 会話フェーズと order フィールドをREADMEに反映する"
```

---

## 完了の確認

すべてのタスクが終わったら、次を確認する。

- [ ] `npm test` が全件 PASS
- [ ] `npm run build` が成功
- [ ] Task 6 Step 5 と Task 7 Step 13 の手動確認項目がすべて通る
- [ ] `assets/stages/stage4.json` を `order: 40` で新規に置き、`intro` を書くだけで、**コードを触らずに**会話つきステージが増やせる（確認したら消す）
