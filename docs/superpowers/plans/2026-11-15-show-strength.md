# 強さを見せる 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 仲間と敵の能力を同じ形の「札」で見せ、レベルアップで戦闘を止めて上がった能力を見せ、称号を無くす。

**Architecture:** 札の中身は純ロジックの `src/ui/stat-card.ts` で組み、描画は `src/ui/card-view.ts`、札や敵の一覧を重ねる状態と押した場所の判定は `src/ui/overlay.ts` に置く。`main.ts` はフェーズごとに「重ねている物があればそちらへ入力を渡す」だけにする。戦闘の途中のレベルアップは、加入の会話と同じ止め方（`main.ts` の `update` でシムのループを抜ける）で新しいフェーズ `levelup` に入る。

**Tech Stack:** TypeScript、Canvas2D、Vite、Vitest

**Spec:** `docs/superpowers/specs/2026-11-15-show-strength-design.md`（見本: https://claude.ai/artifact/TPwku4h97BhPmQh9UpuZEu ）

## Global Constraints

- ゲーム内の表示文字列は漢字仮名交じり（常用漢字中心、ルビなし）。今の画面と同じく語の間に半角スペースを入れる書き方（例「敵を 見る」）
- 描画コード（Canvas2D）にはユニットテストを書かない。テストは純ロジックとレイアウト計算に書き、見た目は README の CDP 手順で確かめる
- 論理解像度は 540×945。札・一覧・ボタンは画面の内側に収める
- 戦闘中は札を開かない。下の段（戦闘中の 8 枠）の表示は変えない（バフの印は Task 9 で見本を見てから決める）
- 出撃する仲間を選ぶ操作・伸び方（`growth.json`）は変えない
- 遊んでいる途中のセーブは、`titles` と `counters` を読み飛ばし、ほかはそのまま引き継ぐ。`SAVE_VERSION` は上げない
- コミットは Conventional Commits + 日本語の要約

## Review Focus

- 戦闘の途中で、同じ tick に 2 人がレベルアップし、同じ tick に加入の会話も起きる → 札を 1 人ずつ出し終えてから加入の会話に入る（Task 7 のテスト `mergeLevelUps` と、Task 10 のブラウザ確認）
- 同じ仲間が同じ tick に 2 回経験値を得て、2 回 `levelUp` が出る → 札は 1 枚で、上がる前は最初の値、上がった後は最後の値（Task 7）
- ステージ選択で、スクロールした状態で「敵を 見る」を押す → スクロール後の位置で判定し、ステージは始まらない（Task 5 の `stageTapTarget` のテスト）
- 札や敵の一覧を開いたまま、下にあるステージや仲間の枠の位置を押す → 下の物には届かず、札を閉じるだけ（Task 4 の `overlayTap` のテスト）
- 古いセーブ（`titles` と `counters` を持つ）を読む → エラーにならず、レベル・仲間・クリアの記録が残る（Task 1）

---

### Task 1: 称号を無くす

**Files:**
- Delete: `assets/titles.json`
- Modify: `src/engine/schema.ts`（`TitleDef`・`validateTitlesFile` を消す）、`src/engine/registry.ts`（`titles` の読み込み・検証・`Registry.titles` を消す）、`src/core/progress.ts`（`earnedTitles`・`titlesOf` を消す）、`src/core/counters.ts`（ファイルごと消す）、`src/core/sim.ts:122`（`accumulate` の呼び出しを消す）、`src/core/types.ts:186` と `src/core/state.ts:188`（`BattleState.counters` を消す）、`src/ui/flow.ts`（`StageResult.newTitles` と称号・記録の書き戻しを消す）、`src/save/save.ts`（`SaveData.counters`・`titles` を消す）、`src/ui/screens.ts`（`drawRoster` の称号の行、`drawResult` の `newTitles` 引数と「称号 ゲット」）、`src/main.ts`（`result` の型と `drawResult` の呼び出し）、`src/core/skills.ts:33-35` のコメント（「称号のカウンタに積まれる」を消す。戻り値の「当てた数」は `skill` イベントの `hits` に残る）、`src/ui/layout.ts`（`resultSlot` のコメントの「称号の行は y 450」）、README.md（「称号」の行と `assets/` の説明の「称号・」）
- Test: `src/save/save.test.ts`、`src/ui/flow.test.ts`、`src/engine/registry.test.ts`、`src/engine/schema.test.ts`、`src/engine/loader.test.ts`、`src/core/sim-combat.test.ts`（`s.counters` を見ている 2 か所）

**Interfaces:**
- Produces: `SaveData` から `counters`・`titles` が無くなる。`StageResult = { save: SaveData; gains: XpGain[] }`。`drawResult(ctx, reg, gains, images)`。`Registry` に `titles` は無い

- [ ] **Step 1: 古いセーブのテストを書く**

`src/save/save.test.ts` に追加:

```ts
it('称号と記録を持つ古いセーブも、レベル・仲間・クリアを引き継いで読める', () => {
  const old = {
    version: 2, clearedStageIds: ['stage1'], readIntroStageIds: [],
    units: { roran: { level: 5, xp: 3 } }, members: ['ally05'], claimed: [],
    counters: { 'bond:supports': 4 }, titles: ['nakayoshi'],
  };
  const s = loadSave(memoryStorage(JSON.stringify(old)), reg)!;
  expect(s.clearedStageIds).toEqual(['stage1']);
  expect(s.units.roran).toEqual({ level: 5, xp: 3 });
  expect(s.members).toEqual(['ally05']);
  expect('counters' in s).toBe(false);
  expect('titles' in s).toBe(false);
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/save/save.test.ts`
Expected: FAIL（`'counters' in s` が true）

- [ ] **Step 3: 上の Files の通りに称号と記録を消す**

`src/core/counters.ts` を消し、`counters`・`titles`・`TitleDef`・`earnedTitles`・`titlesOf`・`mergeCounters`・`accumulate` を参照している所をすべて消す。称号・記録だけを見ていたテスト（`save.test.ts` の titles/counters の 2 件、`flow.test.ts` の称号まわり、`registry.test.ts:179` の owner の検証、`schema.test.ts` の `validateTitlesFile`、`sim-combat.test.ts` の `s.counters` の expect）は消し、fixture から `titles`・`counters` を外す。`loader.test.ts:28` の `titles.length` の expect は消す。`drawRoster` は名前とレベルの 1 行だけにする（15 人化は Task 5）。

- [ ] **Step 4: 全テストと型チェック**

Run: `npm test && npm run build`
Expected: すべて PASS、ビルド成功。`grep -rn "titles\|counters\|TitleDef" src assets README.md` が何も出さない

- [ ] **Step 5: Commit**

```bash
git add -A src assets README.md
git commit -m "feat: 称号と称号のための記録を無くす"
```

---

### Task 2: 技の一言の説明を skills.json に持たせる

**Files:**
- Modify: `assets/skills.json`（各技に `summary`）、`src/engine/schema.ts:248,297-303`（`SkillDef.summary` と検証）、README.md（「新しいスキル」の段落に `summary` が必須と書く）
- Create: `src/core/skill-summary.ts`
- Test: `src/engine/schema.test.ts`、`src/core/skill-summary.test.ts`

**Interfaces:**
- Produces: `SkillDef = { id: string; label: string; summary: string; params: Record<string, number> }`、`skillSummary(skill: SkillDef): string`（`{param}` を `params` の値に置き換えた文）

`summary` の文面（`{}` は params のキー）:

| id | summary |
|---|---|
| funbaru | `{duration}秒の あいだ、受ける ダメージが 半分` |
| neraiuchi | `次の 矢の ダメージが 2倍` |
| omajinai | `近くで 一番 弱っている 仲間の HPを {heal} 回復` |
| kakenukeru | `指した 所へ 走り抜け、通り道の 敵に {damage} ダメージ` |
| hikitsukeru | `{duration}秒の あいだ、近くの 敵を 自分に 向かわせる` |
| hinoame | `指した 所の まわりの 敵に {damage} ダメージ` |
| tsuki | `まっすぐ 突き、並んだ 敵に {damage} ダメージ` |
| hagemasu | `{duration}秒の あいだ、近くの 仲間の 攻撃力 +{power}` |
| tatakiwari | `目の前の 敵 1体に {damage} ダメージ（守備を 無視）` |
| kekkai | `{duration}秒の あいだ、近くの 仲間の 魔法防御 +{resist}` |
| kyuukouka | `指した 所へ 飛び、まわりの 敵に {damage} ダメージ` |

- [ ] **Step 1: テストを書く**

```ts
// schema.test.ts
it('summary が無い技は弾く', () => {
  const r = validateSkillsFile('skills.json', [{ id: 'a', label: 'A', params: { cooldown: 1 } }]);
  expect(r.ok).toBe(false);
});
it('summary の {名前} が params に無ければ弾く', () => {
  const r = validateSkillsFile('skills.json', [{ id: 'a', label: 'A', summary: '{damage} ダメージ', params: { cooldown: 1 } }]);
  expect(r.ok).toBe(false);
});
// skill-summary.test.ts
it('params の値を差し込む', () => {
  expect(skillSummary({ id: 'x', label: 'X', summary: '{duration}秒 +{power}', params: { duration: 8, power: 2, cooldown: 1 } }))
    .toBe('8秒 +2');
});
it('本物の skills.json の全部の技に summary がある', () => {
  for (const s of testRegistry().skills.values()) expect(skillSummary(s)).not.toMatch(/[{}]/);
});
```

- [ ] **Step 2: 失敗を確かめる** — Run: `npx vitest run src/engine/schema.test.ts src/core/skill-summary.test.ts` / Expected: FAIL

- [ ] **Step 3: `summary` を必須にして検証し、`skillSummary` を書き、skills.json に上の表の文面を入れる**（ほかのテストの fixture の技にも `summary` を足す）

- [ ] **Step 4: Run: `npm test` / Expected: PASS**

- [ ] **Step 5: Commit** — `git commit -m "feat: 技に一言の説明を持たせる"`

---

### Task 3: 札の中身を組む

**Files:**
- Create: `src/ui/stat-card.ts`
- Modify: `src/core/types.ts`（`UnitStats` を足す）
- Test: `src/ui/stat-card.test.ts`

**Interfaces:**
- Consumes: `skillSummary`（Task 2）、`statsForLevel`（`src/core/state.ts`）、`lookupDef`
- Produces:

```ts
// src/core/types.ts
export type UnitStats = Record<StatKey, number>; // maxHp / power / guard / speed / resist

// src/ui/stat-card.ts
export const STAT_ORDER: readonly StatKey[] = ['maxHp', 'power', 'guard', 'resist', 'speed'];
export const STAT_LABEL: Record<StatKey, string> = { maxHp: 'HP', power: '攻撃力', guard: '守備', resist: '魔法防御', speed: '速さ' };
/** 棒の長さの上限。仲間と敵で共通（設計書「札」） */
export const BAR_MAX: Record<StatKey, number> = { maxHp: 40, power: 18, guard: 8, resist: 12, speed: 100 };
export const KIND_LABEL: Record<AttackKind, string> = { melee: '近接', bow: '弓', magic: '魔法' };
export const KIND_NOTE: Record<AttackKind, string> = { melee: '相手の 守備で 減る', bow: '相手の 守備で 減る', magic: '相手の 魔法防御で 減る' };

export type StatCard = {
  defId: string;
  name: string;
  /** 仲間だけ。敵は null */
  level: number | null;
  /** 敵だけ。ステージに出る数。仲間は null */
  count: number | null;
  role: string;
  attack: AttackKind;
  range: number;
  stats: UnitStats;
  /** レベルアップの札だけ。上がる前の値と見出しのレベル */
  before: { level: number; stats: UnitStats } | null;
  skill: { label: string; summary: string } | null;
  traits: string[];
};

export function allyCardFromSave(reg: Registry, save: SaveData, defId: string): StatCard;
export function cardFromUnit(reg: Registry, unit: Unit, count: number | null): StatCard;
export function enemyCard(reg: Registry, defId: string, count: number): StatCard;
export type StageEnemy = { defId: string; name: string; count: number };
export function stageEnemies(reg: Registry, stage: StageDef): StageEnemy[];
export function cardFromGain(reg: Registry, gain: XpGain): StatCard;
export function statGains(before: UnitStats, after: UnitStats): { key: StatKey; delta: number }[];
export function barRatio(key: StatKey, value: number): number; // 0〜1 に収める
```

決まり:
- `traits` の文面: 飛行 `'飛行: 水や 壁の 上を 飛んで 越える'`、`ignoresGuard` `'斧: 相手の 守備を 無視して 攻撃する'`、`bowDamageCap` が数のとき `` `盾: 矢の ダメージは ${n} まで` ``。この順
- `allyCardFromSave` は `statsForLevel(def, save.units[id].level, reg.growth, save.units[id].bonus)`
- `cardFromUnit` はユニットの今の `maxHp / power / guard / resist / speed`。味方なら `level` に `unit.level`、敵なら `null`
- `stageEnemies` は `stage.enemies`（1 体ずつ）・`stage.spawners`（`total` 体）・`stage.persuasions`（`foeId` を 1 体）を、敵の定義の `name` ごとにまとめる。並びは最初に出てきた順。`defId` はその名前で最初に出てきた定義
- `cardFromGain` は `before = { level: gain.before.level, stats: statsForLevel(def, gain.before.level, growth, gain.before.bonus) }`、`stats` は `gain.after` から同じく。`statGains` は差が正の能力だけを `STAT_ORDER` の順で返す

- [ ] **Step 1: テストを書く**（本物の assets を `testRegistry()` で使う）

```ts
it('魔導士の塔の敵は名前ごとにまとまる', () => {
  const reg = testRegistry();
  const stage = reg.stages.find((s) => s.name === '魔導士の塔')!;
  const foe = reg.enemies.get('ally06-foe')!.name; // 説得できる敵（セラ）
  expect(stageEnemies(reg, stage).map((e) => [e.name, e.count])).toEqual(
    [['ならず者', 6], ['盾持ち', 1], ['まじない師', 7], ['弓兵', 2], [foe, 1]],
  );
});
it('湧き口の敵は total 体で数える（石切り場のならず者は配置 6 + 湧き口 3）', () => {
  const reg = testRegistry();
  const stage = reg.stages.find((s) => s.name === '石切り場')!;
  expect(stageEnemies(reg, stage).find((e) => e.name === 'ならず者')!.count).toBe(9);
});
it('盾持ちの札に矢の上限の特徴が出る', () => {
  const c = enemyCard(testRegistry(), 'tatemochi', 1);
  expect(c.traits).toEqual(['盾: 矢の ダメージは 1 まで']);
  expect(c.level).toBeNull();
  expect(c.stats).toEqual({ maxHp: 20, power: 12, guard: 3, resist: 0, speed: 26 });
});
it('セーブのレベルと加算から仲間の札の値を出す', () => {
  const reg = testRegistry();
  const save = newSave(reg);
  save.units.roran = { level: 7, xp: 0, bonus: { maxHp: 0, power: 0, guard: 1, speed: 0, resist: 0 } };
  const c = allyCardFromSave(reg, save, 'roran');
  expect(c.level).toBe(7);
  expect(c.stats).toEqual({ maxHp: 36, power: 8, guard: 6, resist: 2, speed: 60 });
  expect(c.skill).toEqual({ label: '踏ん張る', summary: '5秒の あいだ、受ける ダメージが 半分' });
});
it('上がった能力だけを順に返す', () => {
  const a = { maxHp: 30, power: 6, guard: 5, resist: 2, speed: 60 };
  expect(statGains(a, { ...a, maxHp: 31, power: 7 })).toEqual([{ key: 'maxHp', delta: 1 }, { key: 'power', delta: 1 }]);
});
it('棒は上限で止まる', () => { expect(barRatio('maxHp', 80)).toBe(1); expect(barRatio('guard', 4)).toBe(0.5); });
```

- [ ] **Step 2: 失敗を確かめる** — Run: `npx vitest run src/ui/stat-card.test.ts` / Expected: FAIL（モジュールが無い）
- [ ] **Step 3: `src/ui/stat-card.ts` を書く**
- [ ] **Step 4: Run: `npm test` / Expected: PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: 仲間と敵の能力の札の中身を組む"`

---

### Task 4: 札と敵の一覧を重ねて描き、押した場所を判定する

**Files:**
- Create: `src/ui/overlay.ts`（状態と判定。純ロジック）、`src/ui/card-view.ts`（描画）
- Modify: `src/ui/layout.ts`（札と一覧の寸法）
- Test: `src/ui/overlay.test.ts`、`src/ui/layout.test.ts`

**Interfaces:**
- Consumes: `StatCard`・`StageEnemy`・`STAT_ORDER`・`STAT_LABEL`・`barRatio`・`KIND_LABEL`・`KIND_NOTE`（Task 3）
- Produces:

```ts
// src/ui/layout.ts
export const STAT_CARD: Rect = { x: 30, y: 130, w: 480, h: 640 };
export const CARD_CLOSE_BTN: Rect = { x: 170, y: 696, w: 200, h: 56 };
export const ENEMY_LIST: Rect = { x: 30, y: 200, w: 480, h: 520 };
export function enemyListRow(index: number): Rect; // ENEMY_LIST の中、見出しの下に 64px ずつ
export const ENEMY_LIST_CLOSE_BTN: Rect;            // ENEMY_LIST の下端の中央

// src/ui/overlay.ts
export type Overlay =
  | { kind: 'card'; card: StatCard; back: Overlay | null }
  | { kind: 'enemies'; title: string; enemies: StageEnemy[]; cards: StatCard[] };
export type OverlayTap = { type: 'close' } | { type: 'open'; card: StatCard } | { type: 'none' };
export function overlayTap(o: Overlay, p: Vec2): OverlayTap;
/** 閉じた後に残る物。札を閉じたら、開いた元の敵の一覧へ戻る */
export function closeOverlay(o: Overlay): Overlay | null;

// src/ui/card-view.ts
export function drawStatCard(ctx: CanvasRenderingContext2D, reg: Registry, card: StatCard, images: ImageCache, closeLabel: string): void;
export function drawEnemyList(ctx: CanvasRenderingContext2D, reg: Registry, o: Extract<Overlay, { kind: 'enemies' }>, images: ImageCache): void;
```

決まり:
- `overlayTap`: 札は「閉じる」ボタンか札の外で `close`、札の中のほかの場所は `none`。敵の一覧は行で `open`（その行の `cards[i]`）、閉じるボタンか一覧の外で `close`
- 描画は見本の形: 画面全体に `rgba(8, 12, 16, 0.72)` をかけ、札は `#16202a` の地に 3px の `#f2efe4` の枠。上に顔（64px 等倍、`drawFace`）・名前・レベル（敵は「×数」）・役割アイコンと役割名。攻撃の種類と「届く距離 N」、`KIND_NOTE` の一行。能力は名前・棒・数値の 3 列で `STAT_ORDER` の順。最後に技（`label` と `summary`）と `traits`（`#ffd479`）
- `card.before` があるとき: 見出しに `レベルアップ！ Lv{before.level} → Lv{level}`（`#ffd479`）、上がった能力の行は文字と棒を `#ffd479` にして数値を `前→後` で書く
- 敵の一覧の見出しは `{ステージ名}に 出る 敵`、各行は顔・名前・`×数`・`押すと 札 ›`

- [ ] **Step 1: テストを書く**

```ts
// overlay.test.ts
const card = enemyCard(testRegistry(), 'tatemochi', 1);
it('札の外を押すと閉じる。中を押しても何も起きない', () => {
  const o: Overlay = { kind: 'card', card, back: null };
  expect(overlayTap(o, { x: 5, y: 5 })).toEqual({ type: 'close' });
  expect(overlayTap(o, { x: STAT_CARD.x + 20, y: STAT_CARD.y + 20 })).toEqual({ type: 'none' });
  expect(overlayTap(o, { x: CARD_CLOSE_BTN.x + 5, y: CARD_CLOSE_BTN.y + 5 })).toEqual({ type: 'close' });
});
it('敵の一覧の行を押すとその札が開き、札を閉じると一覧へ戻る', () => {
  const list: Overlay = { kind: 'enemies', title: 't', enemies: [{ defId: 'tatemochi', name: '盾持ち', count: 1 }], cards: [card] };
  const r = enemyListRow(0);
  expect(overlayTap(list, { x: r.x + 5, y: r.y + 5 })).toEqual({ type: 'open', card });
  expect(closeOverlay({ kind: 'card', card, back: list })).toBe(list);
  expect(closeOverlay(list)).toBeNull();
});
// layout.test.ts
it('札・閉じるボタン・敵の一覧は画面に収まる', () => {
  for (const r of [STAT_CARD, CARD_CLOSE_BTN, ENEMY_LIST, ENEMY_LIST_CLOSE_BTN]) expect(inScreen(r)).toBe(true);
  expect(inside(CARD_CLOSE_BTN, STAT_CARD)).toBe(true);
  // 今のステージで敵の名前は最大 5 種類（魔導士の塔）。1 行の余裕を持たせて 6 行
  expect(inside(enemyListRow(5), ENEMY_LIST)).toBe(true);
  expect(enemyListRow(5).y + enemyListRow(5).h).toBeLessThanOrEqual(ENEMY_LIST_CLOSE_BTN.y);
});
```

（`inside(a, b)` が `layout.test.ts` に無ければ、a が b の内側かを見る小さな関数をテストの中に書く）

- [ ] **Step 2: 失敗を確かめる** — Run: `npx vitest run src/ui/overlay.test.ts src/ui/layout.test.ts` / Expected: FAIL
- [ ] **Step 3: `layout.ts` の寸法、`overlay.ts`、`card-view.ts` を書く**
- [ ] **Step 4: Run: `npm test && npm run build` / Expected: PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: 札と敵の一覧を重ねて描く"`

---

### Task 5: ステージ選択に 15 人の一覧と「敵を 見る」を付ける

**Files:**
- Modify: `src/ui/layout.ts`（`rosterSlot` を 3 列 × 5 行、`enemyBtnIn` を足す、`STAGE_LIST_VIEW` の高さ）、`src/ui/screens.ts`（`drawStageSelect`・`drawRoster`）、`src/main.ts`（`select` の入力と描画）
- Create: `src/ui/select-tap.ts`
- Test: `src/ui/layout.test.ts`、`src/ui/select-tap.test.ts`

**Interfaces:**
- Consumes: `Overlay`・`overlayTap`・`closeOverlay`・`drawStatCard`・`drawEnemyList`（Task 4）、`allyCardFromSave`・`stageEnemies`・`enemyCard`（Task 3）
- Produces:

```ts
// layout.ts
export function rosterSlot(index: number): Rect; // 15 人を 3 列 × 5 行。{ x: 12 + (i % 3) * 174, y: 652 + ⌊i / 3⌋ * 56, w: 168, h: 50 }
export function enemyBtnIn(slot: Rect): Rect;    // ステージの枠の中、下寄りの中央。{ x: slot.x + 50, y: slot.y + 72, w: 140, h: 36 }
// select-tap.ts
export type SelectTap = { type: 'stage'; index: number } | { type: 'enemies'; index: number } | { type: 'none' };
/** p はスクロールを足した後の座標。まだ行けないステージは none */
export function stageTapTarget(reg: Registry, save: SaveData, p: Vec2): SelectTap;
```

決まり:
- `drawRoster` は `partyIds(reg, save.members)` を `MAX_PARTY` で切らずに全員出す。1 枠は顔（32px）・名前・その下に `Lv{n}`、名前の右に攻撃の種類の小さな印（`KIND_LABEL` を 1px の枠で囲む。色は近接 `#e8c48a`・弓 `#9fd38a`・魔法 `#c8a2ff`）。一覧の上に `仲間 {人数}人` の見出し
- ステージの枠: 名前を上寄りに、行けるステージには `enemyBtnIn` のボタン「敵を 見る」。「クリア済み」は枠の右上に小さく
- `STAGE_LIST_VIEW` の下端は見出しと `rosterSlot(0)` の上に収める
- `main.ts`: `let overlay: Overlay | null = null`（`toStageSelect` と `beginStage` で `null` に戻す）。`select` で `overlay` があれば、押した位置を `overlayTap` に渡すだけにする（下のステージ・仲間には届かない）。無ければ、`rosterSlot(i)` を押したら `{ kind: 'card', card: allyCardFromSave(...), back: null }`、ステージの範囲のタップは今どおり pointerup で判定し、`stageTapTarget` が `enemies` なら `{ kind: 'enemies', title: stage.name, enemies, cards: enemies.map((e) => enemyCard(reg, e.defId, e.count)) }`、`stage` なら `beginStage`
- 描画: `drawStageSelect` の後、`overlay` があれば `drawEnemyList` か `drawStatCard(..., '閉じる')`

- [ ] **Step 1: テストを書く**

```ts
// select-tap.test.ts
it('「敵を 見る」を押すと一覧、枠のほかの所は開始', () => {
  const reg = testRegistry(); const save = newSave(reg);
  const b = enemyBtnIn(stageSlot(0));
  expect(stageTapTarget(reg, save, { x: b.x + 5, y: b.y + 5 })).toEqual({ type: 'enemies', index: 0 });
  expect(stageTapTarget(reg, save, { x: stageSlot(0).x + 5, y: stageSlot(0).y + 5 })).toEqual({ type: 'stage', index: 0 });
});
it('まだ行けないステージは何もしない', () => {
  const reg = testRegistry(); const save = newSave(reg);
  const b = enemyBtnIn(stageSlot(1));
  expect(stageTapTarget(reg, save, { x: b.x + 5, y: b.y + 5 })).toEqual({ type: 'none' });
});
it('スクロールした後の座標で判定する', () => {
  const reg = testRegistry(); const save = newSave(reg);
  save.clearedStageIds = reg.stages.map((s) => s.id);
  const b = enemyBtnIn(stageSlot(8)); // 呼び出し側が scrollY を足した座標を渡す
  expect(stageTapTarget(reg, save, { x: b.x + 5, y: b.y + 5 })).toEqual({ type: 'enemies', index: 8 });
});
// layout.test.ts（今の rosterSlot のテストを置き換える）
it('仲間一覧は 15 人が 3 列で画面に収まり、ステージ一覧と重ならない', () => {
  for (let i = 0; i < MAX_MEMBERS; i++) expect(inScreen(rosterSlot(i))).toBe(true);
  expect(rosterSlot(1).x).toBeGreaterThanOrEqual(rosterSlot(0).x + rosterSlot(0).w);
  expect(rosterSlot(3).y).toBeGreaterThanOrEqual(rosterSlot(0).y + rosterSlot(0).h);
  expect(STAGE_LIST_VIEW.y + STAGE_LIST_VIEW.h).toBeLessThanOrEqual(rosterSlot(0).y - 24);
});
it('「敵を 見る」はステージの枠の内側', () => { expect(inside(enemyBtnIn(stageSlot(0)), stageSlot(0))).toBe(true); });
```

- [ ] **Step 2: 失敗を確かめる** — Run: `npx vitest run src/ui/select-tap.test.ts src/ui/layout.test.ts` / Expected: FAIL
- [ ] **Step 3: layout・`select-tap.ts`・`screens.ts`・`main.ts` を直す**
- [ ] **Step 4: Run: `npm test && npm run build` / Expected: PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: ステージ選択で仲間 15 人と敵の札を見られるようにする"`

---

### Task 6: 配置の場面で札を開く

**Files:**
- Modify: `src/main.ts`（`placement` の入力と描画）、`src/ui/screens.ts:157-178`（`drawPlacement` の案内文）
- Test: `src/ui/hit.test.ts`（敵を拾う判定に既存の `pickUnit` を使うだけなら追加しない。`main.ts` は今どおりテストを書かず Task 10 で確かめる）

**Interfaces:**
- Consumes: `Overlay`・`overlayTap`・`closeOverlay`・`drawStatCard`（Task 4）、`cardFromUnit`・`stageEnemies`（Task 3）

決まり:
- `placement` で `overlay` があれば、押した位置を `overlayTap` に渡すだけにする（「始める」・マップ・顔の枠には届かない）
- 顔の枠（`portraitSlot(i)`）を押したら、そのユニットの `cardFromUnit(reg, unit, null)` を開く。配置の場面では顔の枠で仲間を選ばない（`beginMapPointer` の顔の枠の処理を、`phase === 'placement'` なら札を開いて return にする）。戦闘中は今どおり必殺技
- マップを押したとき、仲間（`playerUnits`）に当たらず敵（`side === 'enemy'` の生きているユニット）に `pickUnit` が当たったら、`cardFromUnit(reg, enemy, count)` を開く。`count` は `stageEnemies(reg, battle.stage)` でその敵の名前の行の数
- 描画: `drawPlacement` の後、`overlay` があれば `drawStatCard(..., '閉じる')`
- 案内文を `黄色い 線より 下に 仲間を 置こう` から、2 行に収まる形で「顔や 敵を 押すと 強さが 見られる」も足す（文面は実装者に任せる。漢字仮名交じり）

- [ ] **Step 1: `main.ts` と `drawPlacement` を直す**
- [ ] **Step 2: Run: `npm test && npm run build` / Expected: PASS**
- [ ] **Step 3: Commit** — `git commit -m "feat: 配置の場面で顔の枠と敵から札を開く"`

---

### Task 7: 戦闘の途中のレベルアップで止めて札を出す

**Files:**
- Modify: `src/core/types.ts:141`（`levelUp` イベント）、`src/core/growth.ts:13-31`（イベントに前後の値を載せる）、`src/main.ts`（フェーズ `levelup`）
- Create: `src/ui/levelup.ts`
- Test: `src/core/growth.test.ts`、`src/core/dialogue.test.ts`（イベントの形に合わせて直す）、`src/ui/levelup.test.ts`

**Interfaces:**
- Consumes: `UnitStats`・`StatCard`（Task 3）、`drawStatCard`（Task 4）
- Produces:

```ts
// types.ts
| { type: 'levelUp'; uid: string; defId: string; level: number; fromLevel: number; before: UnitStats; after: UnitStats }
// src/ui/levelup.ts
export type LevelUpEvent = Extract<SimEvent, { type: 'levelUp' }>;
/** queue に events の levelUp を足す。同じ uid は 1 件にまとめ、before/fromLevel は最初、after/level は最後 */
export function mergeLevelUps(queue: LevelUpEvent[], events: SimEvent[]): LevelUpEvent[];
export function levelUpCard(reg: Registry, ev: LevelUpEvent): StatCard; // stats = after、before = { level: fromLevel, stats: before }
```

決まり:
- `awardXp` は上がる前のユニットの `maxHp / power / guard / resist / speed` を `before`、書き換えた後を `after` にしてイベントに載せる
- `main.ts`: `type Phase` に `'levelup'` を足し、`let levelUps: LevelUpEvent[] = []`（`beginStage` で空に）。`update` のシムのループで、`step` の後に `levelUps = mergeLevelUps(levelUps, battle.events)` し、空でなければループを抜ける（`pendingRecruit` と同じ位置）。ループの後、`levelUps` が空でなければ `accumulator = 0`・`pendingSkill = null`・`clearSpeech(speech)`・`resetAnim(anim)` をして `phase = 'levelup'` で return（`pendingRecruit` と勝利の判定より先）
- `levelup` では時間を進めない。描画は `drawBattle` + `drawBottomBar` + `drawStatCard(ctx, reg, levelUpCard(reg, levelUps[0]), images, '戦闘に 戻る')`。どこを押しても先頭を外し、空になったら `phase = 'battle'`（次の `update` で加入の会話・勝利を今どおり判定する）
- 勝利と同じ tick に上がったときも、札を出し終えてから勝利の会話に入る

- [ ] **Step 1: テストを書く**

```ts
// growth.test.ts（既存の levelUp の expect を新しい形に直したうえで追加）
it('levelUp に上がる前と後の能力を載せる', () => {
  const s = fresh(); const u = playerOf(s, 'roran');
  awardXp(s, u, xpToNext(1, s.reg.growth.xpPerLevel));
  const ev = s.events.find((e) => e.type === 'levelUp')!;
  expect(ev).toMatchObject({ fromLevel: 1, level: 2, before: { maxHp: 30, power: 6 }, after: { maxHp: 31, power: 6 } });
});
// levelup.test.ts
const st = (hp: number) => ({ maxHp: hp, power: 6, guard: 5, resist: 2, speed: 60 });
const lv = (uid: string, from: number, to: number, b: number, a: number): LevelUpEvent =>
  ({ type: 'levelUp', uid, defId: 'roran', fromLevel: from, level: to, before: st(b), after: st(a) });
it('同じ人の 2 回は 1 件にまとめる', () => {
  expect(mergeLevelUps([], [lv('p1', 1, 2, 30, 31), lv('p1', 2, 3, 31, 32)])).toEqual([lv('p1', 1, 3, 30, 32)]);
});
it('別の人は起きた順に並ぶ。ほかのイベントは無視する', () => {
  const q = mergeLevelUps([lv('p1', 1, 2, 30, 31)], [{ type: 'unitRetired', uid: 'x', defId: 'x' }, lv('p2', 3, 4, 20, 21)]);
  expect(q.map((e) => e.uid)).toEqual(['p1', 'p2']);
});
it('札の前後と見出しのレベル', () => {
  const c = levelUpCard(testRegistry(), lv('p1', 4, 5, 33, 34));
  expect(c.level).toBe(5);
  expect(c.before).toEqual({ level: 4, stats: st(33) });
  expect(c.stats).toEqual(st(34));
});
```

- [ ] **Step 2: 失敗を確かめる** — Run: `npx vitest run src/core/growth.test.ts src/ui/levelup.test.ts` / Expected: FAIL
- [ ] **Step 3: イベント・`awardXp`・`levelup.ts`・`main.ts` を直す**（`dialogue.test.ts` などイベントを手で作っているテストに新しいフィールドを足す）
- [ ] **Step 4: Run: `npm test && npm run build && npm run balance` / Expected: テスト PASS、ビルド成功、balance の勝率の表が工程 1 の結果（`docs/superpowers/specs/2026-11-15-counter-allies-results.md`）と同じ**（ボットはイベントの形が変わっても動きが変わらないことの確認）
- [ ] **Step 5: Commit** — `git commit -m "feat: 戦闘の途中のレベルアップで止めて上がった能力を見せる"`

---

### Task 8: 結果の画面に上がった能力を書き、押すと札を開く

**Files:**
- Modify: `src/ui/screens.ts:324-367`（`drawResult`）、`src/main.ts`（`result` の入力と描画）
- Create: `src/ui/result-text.ts`
- Test: `src/ui/result-text.test.ts`

**Interfaces:**
- Consumes: `cardFromGain`・`statGains`・`STAT_LABEL`（Task 3）、`overlayTap`・`closeOverlay`・`drawStatCard`（Task 4）
- Produces: `resultLine(reg: Registry, gain: XpGain): string`

決まり:
- `resultLine`: 加入 → `仲間に 加わった！`、レベルアップ → `` `レベルアップ！ Lv${before} → Lv${after}　${上がった能力を「HP+1　攻撃力+1」の形で全角スペースでつなぐ}` ``、それ以外 → 今の `Lv{n} ({xp}/{次まで})`。「上がる前」はステージを始めた時点（今の `XpGain.before`）
- 枠の幅で収まらないときは今と同じく `maxWidth` で縮める
- レベルアップした行には右端に `›` を出す。`result` で `overlay` があれば `overlayTap` だけ。無ければ、`gains[i].leveledUp && !gains[i].joined` の `resultSlot(i)` を押すと `cardFromGain` の札（ボタンは「閉じる」）、`BTN.next` は今どおり

- [ ] **Step 1: テストを書く**

```ts
it('レベルアップした行に上がった能力を書く', () => {
  const reg = testRegistry();
  const g: XpGain = { id: 'roran', before: { level: 3, xp: 0 }, after: { level: 4, xp: 1 }, leveledUp: true, joined: false };
  expect(resultLine(reg, g)).toBe('レベルアップ！ Lv3 → Lv4　HP+1　攻撃力+1');
});
it('上がらなかった行は今の形', () => {
  const reg = testRegistry();
  const g: XpGain = { id: 'roran', before: { level: 3, xp: 0 }, after: { level: 3, xp: 5 }, leveledUp: false, joined: false };
  expect(resultLine(reg, g)).toBe(`Lv3 (5/${3 * reg.growth.xpPerLevel})`);
});
```

- [ ] **Step 2: 失敗を確かめる** — Run: `npx vitest run src/ui/result-text.test.ts` / Expected: FAIL
- [ ] **Step 3: `result-text.ts`・`drawResult`・`main.ts` を直す**
- [ ] **Step 4: Run: `npm test && npm run build` / Expected: PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat: 結果の画面で上がった能力を見せる"`

---

### Task 9: はげます・結界の印（見本で合わせてから描く）

**Files:**
- Modify: `src/render/draw.ts:349-363`（`drawUnits` の輪の並び）
- Create（リポジトリ外）: 見本の HTML（スクラッチパッド）

**Interfaces:**
- Consumes: `Unit.cheerUntil`・`Unit.wardUntil`（`src/core/types.ts:82-87`）

- [ ] **Step 1: 見本を作って依頼者に見せる**

Artifact に、ユニット 1 体の状態ごとの押せる見本を出す。状態は「何も無し・踏ん張る・狙い撃ち・はげます・結界・はげます＋結界・4 つ全部」。今の輪（踏ん張る `#ffe27a` 半径 half+4・3px、狙い撃ち `#ffffff` 半径 half+7・2px）は変えず、はげます・結界の印の案を 2〜3 通り並べる。マップのタイルの上に 32px のユニットを置いた大きさで見せる。

- [ ] **Step 2: 依頼者の承認を待つ（ここで止まる）**

承認されるまで Step 3 に進まない。下の段に印を出すかもここで聞く（設計書「目標にしないこと」）。

- [ ] **Step 3: 承認された形で `drawUnits` に描く**（`state.time < unit.cheerUntil`・`state.time < unit.wardUntil` の間）

- [ ] **Step 4: Run: `npm test && npm run build` / Expected: PASS**

- [ ] **Step 5: Commit** — `git commit -m "feat: はげますと結界が効いている間の印を出す"`

---

### Task 10: ブラウザで確かめ、正典を直す

**Files:**
- Modify: README.md（画面の操作の説明に札・「敵を 見る」・レベルアップで止まることを足す。称号の記述が残っていないこと）、HANDOVER.md（`## 進捗`）

- [ ] **Step 1: README の CDP 手順でブラウザを動かし、次を撮って目で確かめる**
  1. ステージ選択に仲間 15 人と攻撃の種類の印が出る（セーブを作り、`members` に ally05〜15 を入れて開く）
  2. 仲間の枠を押すと札、「敵を 見る」で一覧、行で札、札を閉じると一覧に戻る
  3. スクロールしてから「敵を 見る」を押してもステージが始まらない
  4. 配置の場面で顔の枠と敵を押すと札が出る。マップの仲間を押すと今どおり選べて動かせる
  5. 戦闘の途中でレベルが上がると止まり、札が出て、押すと戦闘に戻る（`?debug` と経験値の多いステージで起こす）
  6. 結果の画面に上がった能力が出て、行を押すと札
  7. はげます・結界の印が承認された形で出る

- [ ] **Step 2: README と HANDOVER.md を直す**（HANDOVER は `段階: 実装（10 タスク中 10）` と次にやること）

- [ ] **Step 3: Run: `npm test && npm run build` / Expected: PASS**

- [ ] **Step 4: Commit** — `git commit -m "docs: 強さを見せる工程の正典を更新する"`
