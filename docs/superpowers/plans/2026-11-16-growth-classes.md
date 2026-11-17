# 成長の幅と兵種の作り直し Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 仲間と敵に能力ごとの伸び方とレベル（上限 30、敵はステージごと）を持たせ、技の量を攻撃力（魔力）で伸ばし、カードに敵のレベルと「魔力」を出し、2 本の目標（通し・育てた）で勝率を合わせる。

**Architecture:** 能力は `statsForLevel` 1 か所で「初めの値 + floor(伸び × (レベル − 1)) + ごほうび」として出し、仲間・敵・カードがすべてここを通る。敵のレベルはステージの `enemyLevel` を `makeEnemyUnit` に渡す。測り方の直し（ボットがゴールに入らない）を最初に入れて土台の勝率を測り、仕組みを入れたあとで数字を決め、依頼者の承認を得てから帯に合わせる。

**Tech Stack:** TypeScript、Vite、Vitest、Canvas2D

**Spec:** `docs/superpowers/specs/2026-11-16-growth-classes-design.md`

## Global Constraints

- レベル上限は 30（`assets/growth.json` の `maxLevel`）
- 能力 = 初めの値 + `floor(伸び × (レベル − 1) + 1e-9)` + `statBonus`。伸びは 0 以上の数（小数可）。`1e-9` は `1.16 × 25 = 28.999999999999996` のような浮動小数点の誤差で 1 つ下がるのを防ぐ
- `growth`（5 能力すべて）は仲間・敵の定義で必須。`enemyLevel`（1 以上の整数）はステージで必須
- 魔法で攻撃するユニット（`attack === 'magic'`）は、カード・レベルアップのカード・結果の画面で、`power` の名前を「魔力」と出す。ほかは「攻撃力」
- 技の量 = `skills.json` の `damage` または `heal` + 使ったユニットの `unit.power`（`stagePower`・はげますの加算は含めない。カードの数値と同じ値にするため。計画で決めた）。技のダメージは守備・魔法防御を引かない（今どおり）
- 斧の `ignoresGuard`・盾持ちの `bowDamageCap`・飛行は残す
- 勝率の帯（通し）: stage1 95〜100、stage2 95〜100、stage4 90〜100、stage5 85〜100、stage6 80〜100、stage7 75〜95、stage8 70〜90、stage9 65〜85、stage10 60〜80、stage3 45〜70。育てた: 全ステージ 80〜100。育てた場合は通しのセーブの全仲間のレベルを +3（上限 30）
- 帯に入れるために動かしてよいのは、仲間と敵の初めの値・伸び方、`enemyLevel`、仲間の加わったときのレベル、技の基本量、経験値の数字（`growth.json`・`xpReward`）、`bowDamageCap`。地形・敵の配置・数は動かさない
- セーブの形と `SAVE_VERSION`（2）は変えない
- 描画にはユニットテストを書かない。純ロジックとレイアウト計算にテストを書き、見た目は README の CDP 手順で確かめ、撮った画面を Artifact（PNG を data URI で埋め込んだ HTML）で依頼者に見せる。headless Chromium はスクリーンショットを撮らないと描画が進まないので、タップの前後に撮る
- `npm run balance` は数分かかるので、バックグラウンドで流す
- 画面の文字は漢字仮名交じり、語の間に半角空白（既存の UI 文字列に合わせる）
- コミットは Conventional Commits ＋ 日本語の要約。push と PR は依頼者に頼まれたときだけ
- 台帳は `.superpowers/sdd/2026-11-16-growth-classes/progress.md`。計画からの変更・判断は `Ruling:` 行に書く

## Review Focus

1. **上限 12 のころの古いセーブ**（レベル 12・経験値が新しい式の必要量より多い）: 読めて、能力は新しい伸び方で出て、次に経験値が入ったときに上がる → Task 2 のテスト `古いセーブのレベル 12 の仲間は、新しい伸び方の能力になる`
2. **小数の伸びの端数**（1.16 × 25 など）: 浮動小数点の誤差でレベルが上がったのに能力が 1 少なく出ない → Task 2 のテスト `伸び 1.16 でレベル 26 は +29`
3. **時間湧きと説得の相手のレベル**: 戦闘の途中に湧く敵と説得の相手も `enemyLevel` で出る。説得して仲間になったら、加わったときのレベル（`enemyLevel` ではない）になる → Task 3 のテスト
4. **魔法の敵のカードと、魔法の仲間のレベルアップの行**: 「攻撃力」でなく「魔力」と出る（まじない師、ミストの「魔力+1」） → Task 5 のテスト
5. **ボットが敵を残したままゴールに入る**: 測り方の直しの後は、1 回目の勝ちのうち敵が残っていた割合が全ステージで 0% → Task 1 のテストと測定

---

## File Structure

| ファイル | 役割 |
|---|---|
| `src/core/balance.ts` | ボットのゴールの避け方、敵が残った勝ちの数、育てた場合の測定、平均レベル、帯 |
| `tools/balance.ts` | 表の出力と `--check`（2 つの帯） |
| `src/engine/schema.ts` | `StatGrowth`・`UnitDef.growth`・`StageDef.enemyLevel`・`GrowthDef` の変更と検査 |
| `src/core/state.ts` | `statsForLevel`・`makeEnemyUnit` |
| `src/core/growth.ts` | 撃破の経験値（敵のレベルで増える） |
| `src/core/skills.ts`・`src/core/skill-summary.ts` | 技の量と一言の数値 |
| `src/ui/stat-card.ts`・`src/ui/card-view.ts`・`src/ui/result-text.ts`・`src/main.ts` | 「魔力」の名前、敵のレベル |
| `assets/units/*.json`・`assets/enemies/*.json`・`assets/stages/*.json`・`assets/growth.json`・`assets/skills.json` | 数字 |
| `docs/superpowers/specs/2026-11-16-growth-classes-results.md`（新規） | 勝率と平均レベルの記録（ログ） |
| `README.md`・`CLAUDE.md`・`HANDOVER.md` | 正典と引き継ぎ |

---

### Task 1: 測り方の直しと、土台の勝率

成長を変える前に、ボットの測り方を直して勝率を測り、結果の文書に残す。育てた場合の測定と平均レベルの列もここで入れる（仕組みは今の成長のままで動く）。

**Files:**
- Modify: `src/core/balance.ts`、`tools/balance.ts`
- Test: `src/core/balance.test.ts`
- Create: `docs/superpowers/specs/2026-11-16-growth-classes-results.md`

**Interfaces:**
- Produces:
  - `goalSafeDest(dest: Vec2, victory: VictoryCond, margin?: number): Vec2` — ゴールの中心から `victory.radius + margin`（既定 `GOAL_KEEP_OUT_MARGIN = 20`）より内側の点を、中心からの向きを保ってその円周へ押し出す。外側の点はそのまま。中心と同じ点は真下（y を増やす向き）へ押し出す
  - `BattleOutcome.enemiesLeft: number` — 終了時に生きている敵の数 + 湧き残りの数
  - `StageRun` に `grownWon: boolean`（育てた場合の 1 回目で勝ったか）、`avgLevel: number`（勝った試行の出撃した仲間の、クリア後のセーブでの平均レベル）、`leftover: boolean`（1 回目で勝ち、そのとき `enemiesLeft > 0`）
  - `StageStat` に `grownRate: number`、`avgLevel: number`、`leftoverRate: number`（1 回目の勝ちのうち `leftover` の割合 %）
  - `boostLevels(save: SaveData, by: number, maxLevel: number): SaveData` — `units` の全員のレベルを `by` 上げ、上限で止める（経験値は 0）。元のセーブは変えない
  - `TARGET_BANDS`（通し。値は Global Constraints の帯）、`GROWN_BAND: [number, number] = [80, 100]`、`GROWN_LEVEL_BOOST = 3`
  - `isOutOfBand(s: StageStat): boolean` — 通しか育てたのどちらかが帯の外なら true

- [ ] **Step 1: 失敗するテストを書く**（`src/core/balance.test.ts` に足す）

```ts
describe('goalSafeDest', () => {
  const victory = { type: 'reach', pos: { x: 240, y: 48 }, radius: 40, by: 'any' } as const;
  it('ゴールの内側の点は半径 + 20 の円周へ押し出す', () => {
    expect(goalSafeDest({ x: 240, y: 68 }, victory)).toEqual({ x: 240, y: 108 });
  });
  it('外側の点はそのまま', () => {
    expect(goalSafeDest({ x: 240, y: 200 }, victory)).toEqual({ x: 240, y: 200 });
  });
  it('中心と同じ点は真下へ押し出す', () => {
    expect(goalSafeDest({ x: 240, y: 48 }, victory)).toEqual({ x: 240, y: 108 });
  });
});

describe('boostLevels', () => {
  it('全員を +3、上限で止め、経験値を 0 にする。元は変えない', () => {
    const reg = testRegistry();
    const save = newSave(reg);
    save.units.roran = { level: 29, xp: 5 };
    save.units.ines = { level: 4, xp: 3 };
    const out = boostLevels(save, 3, 30);
    expect(out.units.roran).toEqual({ level: 30, xp: 0 });
    expect(out.units.ines).toEqual({ level: 7, xp: 0 });
    expect(save.units.roran).toEqual({ level: 29, xp: 5 });
  });
});

it('ボットは敵が残っている間、ゴールの半径 + 20 の内側へ move を出さない', () => {
  // ゴールの近くに敵を置いた状態（既存のテストの組み立て方に合わせて作る）で botCommands を呼び、
  // すべての move の dest がゴールの中心から radius + 20 以上離れていること
});
```

- [ ] **Step 2: 走らせて落ちることを確かめる**

Run: `npx vitest run src/core/balance.test.ts`
Expected: FAIL（`goalSafeDest`・`boostLevels` が無い）

- [ ] **Step 3: 実装する**
  - `botCommands` の `targetFor` が返す dest のうち、敵（`enemies.length > 0`）か湧き残り（`spawnsLeft`）があるときは `goalSafeDest` を通す。ゴールへ向かう dest（`key: 'goal'`）は通さない
  - `runBattle` で `enemiesLeft` を数える。`playThrough` で、各ステージの 1 回目の前に `runBattle(reg, stage, boostLevels(save, GROWN_LEVEL_BOOST, reg.growth.maxLevel), seed * 100 + 50)` を 1 回流して `grownWon` を取る（セーブには反映しない）
  - `measure` で `grownRate`・`avgLevel`・`leftoverRate` を集計。`formatTable` は 1 つの表に「育てた(%)」「目標(育てた)」「平均Lv」「敵が残った勝ち(%)」の列を足す（設計の「表を 2 つ」を、1 つの表の 2 列で出す。計画で決めた）。判定の列は、外れた方を「帯の外(通し)」「帯の外(育てた)」と書く
  - `TARGET_BANDS` を Global Constraints の値に変える

- [ ] **Step 4: テストを通す**

Run: `npx vitest run src/core/balance.test.ts` → PASS。続けて `npm test` → 全部 PASS（勝率の値そのものを見るテストがあれば、帯の変更に合わせて直す）

- [ ] **Step 5: 測る（バックグラウンド）**

Run: `npm run balance` を `run_in_background` で流す。
Expected: 表が出る。「敵が残った勝ち(%)」が全ステージで 0.0。0 でないステージがあれば、原因（通り道がゴールを横切る、技の移動など）を台帳に書き、`goalSafeDest` を経路にも効かせるなどで 0 にする

- [ ] **Step 6: 結果の文書を作る**

`docs/superpowers/specs/2026-11-16-growth-classes-results.md` に「測り方の直しの後（成長は工程 3 のまま）」の表を書く。工程 1 の結果の文書（`2026-11-15-counter-allies-results.md`）の勝率と並べ、直しだけでどう変わったかを 1〜3 行で書く。

- [ ] **Step 7: コミット**

```bash
git add src/core/balance.ts src/core/balance.test.ts tools/balance.ts docs/superpowers/specs/2026-11-16-growth-classes-results.md
git commit -m "feat: ボットが敵の残る間ゴールに入らないようにし、育てた場合の勝率と平均レベルを測る"
```

---

### Task 2: 伸び方とレベル上限 30

**Files:**
- Modify: `src/engine/schema.ts`、`src/core/state.ts`、`src/core/growth.ts`、`src/ui/stat-card.ts`、`src/main.ts`、`assets/growth.json`、`assets/units/*.json`、`assets/enemies/*.json`
- Test: `src/engine/schema.test.ts`、`src/core/state.test.ts`（または `growth.test.ts`）、`src/save/save.test.ts`

**Interfaces:**
- Produces:
  - `export type StatGrowth = { maxHp: number; power: number; guard: number; resist: number; speed: number }`（`schema.ts`）。`UnitDef.growth: StatGrowth`（`EnemyDef` も継承）
  - `GrowthDef` から `hpPerLevel`・`levelsPerPower` を消す。`enemyLevelXp: number`（0 以上の整数。Task 3 で使う）を足す
  - `statsForLevel(def: UnitDef | EnemyDef, level: number, bonus?: StatBonus): UnitStats` — `growth` 引数を消す。呼び出し側（`growth.ts`・`state.ts`・`stat-card.ts`・`main.ts`）を直す

- [ ] **Step 1: 失敗するテストを書く**

```ts
// schema.test.ts
it('growth が無い仲間は読み込みで弾く', () => { /* validateUnitDef の errors に path 'growth' */ });
it('growth の値が負なら弾く', () => { /* growth.guard: -1 → path 'growth.guard' */ });

// state.test.ts
it('能力は 初めの値 + floor(伸び × (レベル − 1)) + ごほうび', () => {
  const def = { ...base, maxHp: 30, power: 6, guard: 5, resist: 2, speed: 60,
    growth: { maxHp: 2.5, power: 0.5, guard: 0.4, resist: 0, speed: 0 } };
  expect(statsForLevel(def, 1)).toEqual({ maxHp: 30, power: 6, guard: 5, resist: 2, speed: 60 });
  expect(statsForLevel(def, 11, { maxHp: 0, power: 1, guard: 0, resist: 0, speed: 0 }))
    .toEqual({ maxHp: 55, power: 12, guard: 9, resist: 2, speed: 60 });
});
it('伸び 1.16 でレベル 26 は +29', () => {
  const def = { ...base, maxHp: 10, growth: { maxHp: 1.16, power: 0, guard: 0, resist: 0, speed: 0 } };
  expect(statsForLevel(def, 26).maxHp).toBe(39);
});

// growth.test.ts / progress.test.ts
it('レベル 30 で止まり、経験値は 0', () => { /* applyXp で 29 → 30 を越える経験値 → level 30, xp 0 */ });

// save.test.ts
it('古いセーブのレベル 12 の仲間は、新しい伸び方の能力になる', () => {
  // level 12・xp 40 のセーブを loadSave → allyCardFromSave の stats が statsForLevel(def, 12) と同じ
});
```

- [ ] **Step 2: 走らせて落ちることを確かめる**

Run: `npx vitest run src/engine/schema.test.ts src/core/state.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**
  - `readUnitFields` で `growth` を必須のオブジェクトとして読み、5 つの値を `min: 0` で検査する
  - `statsForLevel` を Global Constraints の式にする
  - `assets/growth.json`: `maxLevel` を 30、`hpPerLevel`・`levelsPerPower` を消し、`enemyLevelXp: 0` を足す
  - 仲間 15 人と敵 25 ファイルに `growth` を足す。値はこの Task では仮で、全員 `{ "maxHp": 1, "power": 0.34, "guard": 0, "resist": 0, "speed": 0 }`（今の「HP +1・3 レベルで攻撃 +1」に近い値。本当の数字は Task 6）

- [ ] **Step 4: テストを通す**

Run: `npm test` → 全部 PASS。`npm run build` → 型エラーなし

- [ ] **Step 5: コミット**

```bash
git add src assets
git commit -m "feat: 仲間と敵に能力ごとの伸び方を持たせ、レベル上限を 30 にする"
```

---

### Task 3: 敵のレベルと撃破の経験値

**Files:**
- Modify: `src/engine/schema.ts`、`src/core/state.ts`、`src/core/sim.ts`、`src/core/growth.ts`、`assets/stages/*.json`
- Test: `src/engine/schema.test.ts`、`src/core/state.test.ts`、`src/core/growth.test.ts`

**Interfaces:**
- Consumes: Task 2 の `statsForLevel`、`GrowthDef.enemyLevelXp`
- Produces:
  - `StageDef.enemyLevel: number`（必須、1 以上の整数）
  - `makeEnemyUnit(reg: Registry, uid: string, defId: string, pos: Vec2, ai: AiDef, level: number): Unit`。配置・説得の相手（`createBattleState`）と時間湧き（`sim.ts`）は `state.stage.enemyLevel` を渡す
  - `xpForDefeat(reg: Registry, victim: Unit): number` — `xpReward + enemyLevelXp × (victim.level − 1)`。`awardXpForEvents` の撃破の経験値（とどめ・手伝い）はこれを使う

- [ ] **Step 1: 失敗するテストを書く**

```ts
it('enemyLevel が無いステージは読み込みで弾く', () => { /* path 'enemyLevel' */ });
it('配置の敵・説得の相手は enemyLevel で出る', () => {
  // enemyLevel: 5 のステージで createBattleState → 敵の level が全員 5、能力は statsForLevel(def, 5)
});
it('時間湧きの敵も enemyLevel で出る', () => { /* spawner の湧く tick まで step → 湧いた敵の level が enemyLevel */ });
it('説得して加わった仲間は、加わったときのレベル（enemyLevel ではない）', () => {
  // enemyLevel: 9、persuasion.level: 4 → completeRecruit 後の仲間の level が 4
});
it('撃破の経験値は xpReward + enemyLevelXp × (レベル − 1)', () => {
  // xpReward 8、enemyLevelXp 2、レベル 5 の敵 → 16
});
```

- [ ] **Step 2: 走らせて落ちることを確かめる**

Run: `npx vitest run src/engine/schema.test.ts src/core/state.test.ts src/core/growth.test.ts` → FAIL

- [ ] **Step 3: 実装する**。全ステージに `"enemyLevel": 1` を足す（仮。本当の数字は Task 6）

- [ ] **Step 4: テストを通す**

Run: `npm test` → PASS、`npm run build` → 型エラーなし

- [ ] **Step 5: コミット**

```bash
git add src assets/stages
git commit -m "feat: 敵にステージごとのレベルを持たせ、撃破の経験値を敵のレベルで増やす"
```

---

### Task 4: 技の量を攻撃力（魔力）で伸ばす

**Files:**
- Modify: `src/core/skills.ts`、`src/core/skill-summary.ts`、`src/ui/stat-card.ts`
- Test: `src/core/skills.test.ts`、`src/core/skill-summary.test.ts`、`src/ui/stat-card.test.ts`

**Interfaces:**
- Produces:
  - `SCALED_SKILL_PARAMS: readonly ['damage', 'heal']`（`skill-summary.ts`）
  - `skillAmount(reg: Registry, skillId: string, key: 'damage' | 'heal', fallback: number, power: number): number` — `skillParam(reg, skillId, key, fallback) + power`。駆け抜ける・火の雨・突き・たたき割り・急降下の `damage` と、おまじないの `heal` はこれを通し、`power` に `self.power` を渡す
  - `skillSummary(skill: SkillDef, power?: number): string` — `{damage}`・`{heal}` には `params + power` を入れる（`power` 省略時は 0）。ほかの `{...}` は今どおり
  - `stat-card.ts` の `skillOf(reg, skillId, power)` — カードの能力の `power` を渡す

- [ ] **Step 1: 失敗するテストを書く**

```ts
it('おまじないの回復量は heal + 使った人の攻撃力', () => {
  // heal 12、ミストの power 7 → HP が 19 回復（上限まで）
});
it('たたき割りのダメージは damage + 攻撃力（守備を引かない）', () => { /* damage 14、power 10 → 24 */ });
it('一言の {heal} に攻撃力を足す', () => {
  expect(skillSummary(omajinai, 7)).toBe('近くで 一番 弱っている 仲間の HPを 19 回復');
});
it('ミストのカードの技の一言は、そのレベルの攻撃力を足した回復量', () => { /* allyCardFromSave */ });
```

- [ ] **Step 2: 走らせて落ちることを確かめる** → FAIL

- [ ] **Step 3: 実装する**（`skills.json` の基本量はこの Task では変えない。Task 6 で決め直す）

- [ ] **Step 4: テストを通す**。`npm test` → PASS

- [ ] **Step 5: コミット**

```bash
git add src
git commit -m "feat: 技のダメージと回復量に使った人の攻撃力（魔力）を足す"
```

---

### Task 5: カードの「魔力」と敵のレベル

**Files:**
- Modify: `src/ui/stat-card.ts`、`src/ui/card-view.ts`、`src/ui/result-text.ts`、`src/main.ts`
- Test: `src/ui/stat-card.test.ts`、`src/ui/result-text.test.ts`

**Interfaces:**
- Produces:
  - `statLabel(key: StatKey, attack: AttackKind): string` — `key === 'power' && attack === 'magic'` なら「魔力」、ほかは `STAT_LABEL[key]`。`card-view.ts`（能力の行）と `result-text.ts`（「魔力+1」）はこれを使う
  - `enemyCard(reg: Registry, defId: string, count: number, level: number): StatCard` — `level` を `StatCard.level` に入れ、能力は `statsForLevel(def, level)`。`main.ts` の「敵を 見る」は `stage.enemyLevel` を渡す
  - `cardFromUnit` は敵にも `level: unit.level` を入れる
  - `StatCard.level` のコメントを「仲間も敵も持つ」に直す。`card-view.ts` は敵のカードにも仲間と同じ場所にレベルを出し、出る数も今どおり出す

- [ ] **Step 1: 失敗するテストを書く**

```ts
it('魔法の仲間と敵は power を「魔力」と呼ぶ', () => {
  expect(statLabel('power', 'magic')).toBe('魔力');
  expect(statLabel('power', 'melee')).toBe('攻撃力');
  expect(statLabel('guard', 'magic')).toBe('守備');
});
it('敵のカードはレベルを持ち、そのレベルの能力', () => {
  const card = enemyCard(reg, 'majinaishi', 7, 5);
  expect(card.level).toBe(5);
  expect(card.stats).toEqual(statsForLevel(reg.enemies.get('majinaishi')!, 5));
});
it('配置の場面の敵のカードもレベルを持つ', () => { /* cardFromUnit(敵) の level が unit.level */ });
it('ミストの結果の行は「魔力+1」', () => { /* resultLine で power が上がった XpGain → 「魔力+」を含み「攻撃力+」を含まない */ });
```

- [ ] **Step 2: 走らせて落ちることを確かめる** → FAIL

- [ ] **Step 3: 実装する**

- [ ] **Step 4: テストを通す**。`npm test` → PASS、`npm run build` → 型エラーなし

- [ ] **Step 5: コミット**

```bash
git add src
git commit -m "feat: 魔法のユニットのカードで攻撃力を魔力と出し、敵のカードにレベルを出す"
```

---

### Task 6: 先送りの 4 件

**Files:**
- Modify: `src/ui/overlay.ts`（または `src/ui/layout.ts`）、M5 の値がある `src/core/types.ts`・`src/core/damage.ts`・`src/core/sim.ts`・`src/core/skills.ts` ほか
- Test: `src/save/save.test.ts`、`src/engine/stage-limits.test.ts`、`src/ui/overlay.test.ts`

**Interfaces:**
- Produces: `sortieStrengthHit(slot: Rect): Rect`（`layout.ts`）— 「強さ」ボタンの当たり判定。見た目の `sortieStrengthBtn` より上・左・下に広く、枠（`slot`）の中に収まる。`overlayTap` はこれで判定する

- [ ] **Step 1: 失敗するテストを書く**

```ts
// save.test.ts（M4）
it('titles・counters を持つ古いセーブも読め、その値は捨てる', () => {
  // version 2 の raw に titles: {...}, counters: {...} を足して loadSave → null でない、units・members は読める、
  // 戻り値に titles・counters のキーが無い
});
// stage-limits.test.ts（候補 16 人以上）
it('仲間の定義は出撃の一覧の枠（15）以下', () => {
  expect(testRegistry().units.size).toBeLessThanOrEqual(15);
});
// overlay.test.ts（「強さ」）
it('「強さ」の当たり判定は見た目より広く、枠の中に収まる', () => {
  const slot = sortieSlot(0);
  const hit = sortieStrengthHit(slot);
  const btn = sortieStrengthBtn(slot);
  expect(hit.w * hit.h).toBeGreaterThan(btn.w * btn.h);
  // hit が btn を含み、slot に含まれる
});
it('「強さ」の見た目のすぐ上を押してもカードが開く', () => {
  // btn の上端から 8px 上の点で overlayTap → { type: 'strength' }
});
```

- [ ] **Step 2: 走らせて落ちることを確かめる** → `sortieStrengthHit` のテストが FAIL（M4・枠の数のテストは今のコードで通ることがある。通ったら、そのテストは止めるためのものとして残す）

- [ ] **Step 3: 実装する**
  - 「強さ」: `sortieStrengthHit` を足し、`overlayTap` で使う。枠そのもの（入れる・外す）を押せる場所が残るように、当たり判定は枠の右下の半分程度までにとどめる
  - M5: `grep -rn "hits\|neraiuchi\|lastHitNeraiuchi" src` で読まれている所を確かめ、どこからも読まれていない値（skill イベントの `hits`、`unitDefeated` の `neraiuchi`、`Unit.lastHitNeraiuchi`、`damage.ts` の称号のコメント）を消す。描画や会話で読まれている値は消さず、台帳に `Ruling:` で残す

- [ ] **Step 4: テストを通す**。`npm test` → PASS、`npm run build` → 型エラーなし

- [ ] **Step 5: コミット**

```bash
git add src
git commit -m "fix: 先送りの指摘（古いセーブのテスト・読まれない値・仲間の数のテスト・強さの当たり判定）を直す"
```

---

### Task 7: 数字を決めて、依頼者に表で見せる

**Files:**
- Modify: `assets/units/*.json`、`assets/enemies/*.json`、`assets/stages/*.json`（`enemyLevel`・加わったときのレベル）、`assets/growth.json`、`assets/skills.json`
- Create（git 管理外）: `.superpowers/sdd/2026-11-16-growth-classes/table.ts`（数字の表を作る使い捨ての道具）、表の HTML

- [ ] **Step 1: 数字を決める**。設計の「6. 初めの値と伸び方の決め直し」の方針に沿って、仲間 15 人・敵（見た目違いのファイルは同じ値）の初めの値と `growth`、`skills.json` の `damage`・`heal`、`growth.json`（`xpPerLevel`・`clearXp`・`enemyLevelXp`・`hitXp`・`healXp`）、敵の `xpReward`、各ステージの `enemyLevel`（stage1 は 1、stage3 は 16 前後）、加わったときのレベル（`joins`・`persuasions`・村の `recruit`）を決める。決めた理由は台帳に 1 行ずつ書く
  - 目安: 前衛は レベル 15 で、ならず者・盾持ち（そのステージのレベル）の攻撃を 1 回 1〜3 に抑える。まじない師の魔法は前衛に痛く、守護・魔法の仲間には軽い
  - 加わったときのレベルは、そのステージに着いたときの出撃した仲間の平均レベル（Task 1 の表の「平均Lv」の、前のステージの値）の少し下

  - 速さ（`speed`）の伸びは基本 0（設計の判断）
  - `src/engine/registry.test.ts` に「どの仲間も、伸びが 0.5 以上の能力を 1 つ以上持つ」のテストを足す（設計の「育てても強くならない仲間を作らない」）

- [ ] **Step 2: 通る**。`npm test` → PASS（数値に依存するテストが落ちたら、テストの意図を確かめてから値を直す。意図ごと変わるものは台帳に `Ruling:`）、`npm run build` → 型エラーなし

- [ ] **Step 3: 表を作って見せる**。道具で、仲間 15 人のレベル 1・10・15・20・30 の能力と技の量、敵の各ステージのレベルでの能力、「この仲間がこの敵から受ける 1 回のダメージ」「この仲間がこの敵に与える 1 回のダメージ」の対の表（前衛・後衛・魔法の代表で）を HTML にし、Artifact で依頼者に見せる。役割分担と相性が読めるかを聞く

- [ ] **Step 4: 依頼者の承認を待つ**。直しがあれば Step 1 に戻る。承認までコミットしない

- [ ] **Step 5: コミット**

```bash
git add assets
git commit -m "feat: 役割分担と相性が出るように、仲間と敵の能力・伸び方・技の量・経験値を決め直す"
```

---

### Task 8: 勝率を帯に合わせる

**Files:**
- Modify: `assets/**`（Global Constraints で動かしてよいものだけ）、`src/ui/stat-card.ts`（`BAR_MAX`）、`docs/superpowers/specs/2026-11-16-growth-classes-results.md`

- [ ] **Step 1: 測る**。`npm run balance` をバックグラウンドで流す
- [ ] **Step 2: 帯の外を直して測り直す**。1 回ごとに、何を何から何へ変えたかと表を結果の文書に足す。Task 7 で依頼者に見せた表から大きく変わった値（役割の順位が入れ替わる、など）は、先に依頼者に見せて承認を得る
- [ ] **Step 3: 終わりの判定**。`npm run balance -- --check` が終了コード 0（通し・育てた両方が帯の中）。stage3 のクリア後の平均レベルが 15〜18。40 シードの標準偏差（約 ±7%）を考え、帯の端から 3% 以内のステージは結果の文書に「端」と書く
- [ ] **Step 4: `BAR_MAX` を直す**。レベル 30 の仲間と、各ステージの `enemyLevel` の敵の能力のうち、能力ごとの最大値以上の切りのよい値にする。`stat-card.test.ts` に「全員の レベル 30 と、全ステージの敵の能力が BAR_MAX 以下」のテストを足し、PASS を確かめる
- [ ] **Step 5: コミット**

```bash
git add assets src docs/superpowers/specs/2026-11-16-growth-classes-results.md
git commit -m "feat: 勝率を通し・育てたの 2 つの帯に合わせる"
```

---

### Task 9: ブラウザで確かめ、正典を直す

**Files:**
- Modify: `README.md`、`CLAUDE.md`、`HANDOVER.md`
- Create: `docs/superpowers/ledgers/2026-11-16-growth-classes.md`（台帳の写し）
- Create（git 管理外、終わったら消す）: CDP で撮る道具・撮った絵

- [ ] **Step 1: ブラウザで撮る**（README「描画と入力をブラウザで確かめる」の CDP 手順。タップの前後にスクリーンショットを撮る）: ミストのカード（「魔力」と回復量）、「敵を 見る」の一覧と敵のカード（レベル）、配置の場面の敵のカード、レベルアップのカード（伸びた能力）、結果の画面の「魔力+」の行、出撃の一覧の「強さ」の見た目のすぐ上を押してカードが開くところ。Artifact（PNG を data URI で埋め込んだ HTML）で依頼者に見せ、承認を得る
- [ ] **Step 2: README を直す**: 「強さを見せる（カード）」（敵のレベル、「魔力」、技の一言の数値は攻撃力を足した値）、「難易度を測る」（表の列、育てた場合の +3、ボットは敵の残る間ゴールに入らない、帯の置き場は `TARGET_BANDS`・`GROWN_BAND`、結果の文書は `2026-11-16-growth-classes-results.md`）、「コンテンツの足しかた」（`growth`・`enemyLevel`・`enemyLevelXp` の書き方と、能力の式）。CLAUDE.md は `npm run balance` の所要時間を測った値に直す
- [ ] **Step 3: HANDOVER を直す**: 「## 進捗」を今の状態に（段階・次にやること）。工程 4 の結果を工程 3 の結果の上に足す（決めた数字の考え方、勝率、確かめたこと・確かめていないこと）。工程 5 の残課題から、この工程で済んだ「測定の直し」を消す
- [ ] **Step 4: 台帳を写す**: `.superpowers/sdd/2026-11-16-growth-classes/progress.md` を `docs/superpowers/ledgers/2026-11-16-growth-classes.md` に写す
- [ ] **Step 5: 片付けと最終確認**: 撮影の道具と Task 7 の表の道具を `rm` / `rm -r` で消す（`rm -rf` は使えない）。`npm test`・`npm run build` → PASS
- [ ] **Step 6: コミット**

```bash
git add README.md CLAUDE.md HANDOVER.md docs/superpowers/ledgers/2026-11-16-growth-classes.md
git commit -m "docs: 成長の幅と兵種の作り直しを README・HANDOVER に反映し、台帳を写す"
```
