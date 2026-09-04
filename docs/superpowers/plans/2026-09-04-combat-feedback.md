# 戦闘フィードバック強化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 必殺技をクールダウン制にし、攻撃・回復・スキル発動・撃破などの戦闘イベントにプレースホルダー図形のエフェクトとダメージ／回復ポップアップを追加して「戦っている実感」を作る。

**Architecture:** `src/core` のシミュレーションが `SimEvent` を発行し、`src/render/effects.ts` がそれを判別可能Union型 `Effect` に変換して `EffectState.items` に積み、`src/render/draw.ts` が `kind` ごとに描き分ける。スキルのクールダウンと表示は `Unit.skillCooldownUntil` を土台に `src/ui/screens.ts` のポートレートへバー表示する。

**Tech Stack:** TypeScript, Vite, Vitest, Canvas2D（既存スタック。新規ライブラリなし）

**Spec:** `docs/superpowers/specs/2026-09-04-combat-feedback-design.md`

## Global Constraints

- `src/core/**` と `src/engine/**` は `window` / `document` / `localStorage` を参照しない（README.md の既存ルール）
- データはパラメータ（JSON）、振る舞いはコード、という既存の線引きを崩さない
- 効果音・画面シェイクはスコープ外（spec §2「対象外」）
- 実際の Canvas 描画（`draw.ts` / `screens.ts`）は既存パターンに合わせてユニットテスト対象外とする（spec §9）

## 仕様からの具体化（実装時に決めた詳細）

spec は `SimEvent` の拡張を大枠でしか決めていなかった。実装するとフィールド不足が判明したため、以下の点を具体化した。

- `skill` イベントは `pos: Vec2` 1個ではなく `fromPos` / `toPos` の2個にする。理由: かけぬけるの `trail`（移動元→移動先の残像）を描くには両方の位置が要る。他のスキルは `fromPos === toPos` になる。
- `hit` イベントに `targetUid: string` を追加する。理由: 被弾ノックバック（Task 8）はユニット単位でノックバック状態を持つ必要があり、`targetPos` だけでは uid が引けない。
- `heal` イベントに `sourcePos: Vec2` を追加する。理由: `healBeam`（術者→対象の光の弧）の起点に要る。
- `bondSupport` イベントに `pos: Vec2` を追加する。理由: 支援を受けたユニットの位置がイベントに無いと `bondPulse` エフェクトの表示位置が決まらない。
- 各スキルのクールダウン秒数の初期値は仮で決める（`funbaru: 15`, `neraiuchi: 12`, `omajinai: 10`, `kakenukeru: 8`）。`assets/skills.json` の数値なので、プレイ感を見ながら後から自由に調整できる。

---

### Task 1: スキルのクールダウン化（core層）

**Files:**
- Modify: `src/core/types.ts`（`Unit` 型）
- Modify: `src/core/state.ts:49`（`makeUnit`）
- Modify: `src/core/skills.ts`（`canUseSkill` / `useSkill`）
- Modify: `assets/skills.json`
- Modify: `src/core/skills.test.ts`
- Modify: `src/core/sim.test.ts`
- Modify: `src/core/sim-combat.test.ts`

**Interfaces:**
- Produces: `Unit.skillCooldownUntil: number`（絶対シム時刻。この値未満は使用不可）、`DEFAULT_SKILL_COOLDOWN: number`（`src/core/skills.ts` からexport）
- Consumes: なし（このタスクは core 単独で完結する）

- [ ] **Step 1: `Unit` 型を変更する**

`src/core/types.ts` の `Unit` 型で、以下の行を:

```ts
  skillUsed: boolean;
```

次のように置き換える:

```ts
  /** シム時刻の絶対値。この値未満は使用不可（0 なら開始時点で使用可） */
  skillCooldownUntil: number;
```

- [ ] **Step 2: ユニット初期化を変更する**

`src/core/state.ts:49` の `makeUnit` 内、以下の行を:

```ts
    skillUsed: false, funbaruUntil: -1, neraiuchiArmed: false, pinchShown: false,
```

次のように置き換える:

```ts
    skillCooldownUntil: 0, funbaruUntil: -1, neraiuchiArmed: false, pinchShown: false,
```

- [ ] **Step 3: 既存テストのユニットリテラルを直す（この時点ではまだ落ちる）**

以下の3ファイルで、テスト内で直接 `Unit` オブジェクトを組み立てている箇所の
`skillUsed: false,` を `skillCooldownUntil: 0,` に置き換える。

- `src/core/skills.test.ts` の `addEnemy` 関数内（1箇所）
- `src/core/sim.test.ts` の `makeTestUnit` 関数と `spawnEnemy` 関数内（2箇所）
- `src/core/sim-combat.test.ts` の `spawnEnemy` 関数内（1箇所）

- [ ] **Step 4: クールダウンの振る舞いに合わせて既存テストを書き換える**

`src/core/skills.test.ts` の `describe('canUseSkill', ...)` 内、以下のテストを:

```ts
  it('一度使うと同じステージでは使えない', () => {
    const uid = unitOf(s, 'roran').uid;
    useSkill(s, uid);
    expect(canUseSkill(s, uid)).toBe(false);
  });
```

次のように書き換え、新しいテストを1本追加する:

```ts
  it('使うとクールダウン中は使えない', () => {
    const uid = unitOf(s, 'roran').uid;
    useSkill(s, uid);
    expect(canUseSkill(s, uid)).toBe(false);
  });

  it('クールダウンが明けると再び使える', () => {
    const uid = unitOf(s, 'roran').uid;
    useSkill(s, uid);
    const cooldown = s.reg.skills.get('funbaru')!.params.cooldown!;
    s.time += cooldown;
    expect(canUseSkill(s, uid)).toBe(true);
  });
```

同ファイルの `describe('SKILL_EFFECTS', ...)` 内、以下のテストを:

```ts
  it('しらない skillId の ユニットは スキルを つかえない', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    roran.skillId = 'sonzaishinai';
    expect(useSkill(s, roran.uid)).toBe(false);
    expect(unitOf(s, 'roran').skillUsed).toBe(false);
  });
```

次のように書き換える:

```ts
  it('しらない skillId の ユニットは スキルを つかえない', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    roran.skillId = 'sonzaishinai';
    expect(useSkill(s, roran.uid)).toBe(false);
    expect(unitOf(s, 'roran').skillCooldownUntil).toBe(0);
  });
```

同 `describe` 内の末尾（「ふんばりの もちじかんを skills.json から よむ」テストの後）に、
新しいテストを追加する:

```ts
  it('ふんばりの クールダウンを skills.json から よむ', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    useSkill(s, roran.uid);
    expect(unitOf(s, 'roran').skillCooldownUntil)
      .toBe(s.time + s.reg.skills.get('funbaru')!.params.cooldown!);
  });
```

`src/core/sim.test.ts` の `describe('step: skill コマンド', ...)` 内、以下のテストを:

```ts
  it('skill コマンドでスキルが発動する', () => {
    const { state: s } = fresh();
    step(s, [{ type: 'skill', uid: unitOf(s, 'roran').uid }], 0.1);
    expect(unitOf(s, 'roran').skillUsed).toBe(true);
  });
```

次のように書き換える:

```ts
  it('skill コマンドでスキルが発動する', () => {
    const { state: s } = fresh();
    step(s, [{ type: 'skill', uid: unitOf(s, 'roran').uid }], 0.1);
    expect(unitOf(s, 'roran').skillCooldownUntil).toBeGreaterThan(0);
  });
```

- [ ] **Step 5: テストを実行して失敗を確認する**

Run: `npm test -- src/core/skills.test.ts src/core/sim.test.ts src/core/sim-combat.test.ts`
Expected: FAIL（`skillCooldownUntil` が存在しない、または `canUseSkill`/`useSkill` がまだ `skillUsed` を見ているため）

- [ ] **Step 6: `assets/skills.json` に `cooldown` を追加する**

`assets/skills.json` の内容を丸ごと以下に置き換える:

```json
[
  { "id": "funbaru",    "label": "ふんばる",   "params": { "duration": 5, "cooldown": 15 } },
  { "id": "neraiuchi",  "label": "ねらいうち", "params": { "cooldown": 12 } },
  { "id": "omajinai",   "label": "おまじない", "params": { "heal": 12, "range": 200, "cooldown": 10 } },
  { "id": "kakenukeru", "label": "かけぬける", "params": { "damage": 5, "needsDest": 1, "cooldown": 8 } }
]
```

- [ ] **Step 7: `canUseSkill` / `useSkill` を実装する**

`src/core/skills.ts` の冒頭の定数群（`FUNBARU_DURATION` などの近く）に追加する:

```ts
export const DEFAULT_SKILL_COOLDOWN = 10;
```

以下の関数を:

```ts
export function canUseSkill(state: BattleState, uid: string): boolean {
  if (state.phase !== 'battle') return false;
  const unit = state.units.find((u) => u.uid === uid && u.side === 'player');
  if (!unit) return false;
  return !unit.retired && !unit.skillUsed;
}

export function useSkill(state: BattleState, uid: string, dest?: Vec2): boolean {
  if (!canUseSkill(state, uid)) return false;
  const self = state.units.find((u) => u.uid === uid)!;
  const effect = SKILL_EFFECTS[self.skillId ?? ''];
  if (!effect) return false;

  const hits = effect({ state, self, dest });
  if (hits === null) return false;

  self.skillUsed = true;
  state.events.push({ type: 'skill', uid: self.uid, defId: self.defId, skillId: self.skillId!, hits });
  return true;
}
```

次のように置き換える（`skill` イベントへの `fromPos`/`toPos` 追加は Task 3 で行うため、ここではまだ既存の1フィールドのままにする）:

```ts
export function canUseSkill(state: BattleState, uid: string): boolean {
  if (state.phase !== 'battle') return false;
  const unit = state.units.find((u) => u.uid === uid && u.side === 'player');
  if (!unit) return false;
  return !unit.retired && state.time >= unit.skillCooldownUntil;
}

export function useSkill(state: BattleState, uid: string, dest?: Vec2): boolean {
  if (!canUseSkill(state, uid)) return false;
  const self = state.units.find((u) => u.uid === uid)!;
  const effect = SKILL_EFFECTS[self.skillId ?? ''];
  if (!effect) return false;

  const hits = effect({ state, self, dest });
  if (hits === null) return false;

  const cooldown = skillParam(state.reg, self.skillId!, 'cooldown', DEFAULT_SKILL_COOLDOWN);
  self.skillCooldownUntil = state.time + cooldown;
  state.events.push({ type: 'skill', uid: self.uid, defId: self.defId, skillId: self.skillId!, hits });
  return true;
}
```

- [ ] **Step 8: テストを実行してパスを確認する**

Run: `npm test -- src/core/skills.test.ts src/core/sim.test.ts src/core/sim-combat.test.ts`
Expected: PASS

- [ ] **Step 9: 型チェックとテスト全体を実行する**

Run: `npm run build`
Expected: 型エラーなし（`src/main.ts` と `src/ui/screens.ts` はまだ `skillUsed` を参照しているため、ここで型エラーが出るのが正しい。Task 2 で直す）

Run: `npm test`
Expected: `src/core/**` のテストはすべてPASS。ビルドが通らない場合はエラー内容を確認し、Task 2 が担当する箇所（`main.ts` / `ui/screens.ts`）以外にエラーが出ていないことを確認する。

- [ ] **Step 10: コミット**

```bash
git add src/core/types.ts src/core/state.ts src/core/skills.ts assets/skills.json \
  src/core/skills.test.ts src/core/sim.test.ts src/core/sim-combat.test.ts
git commit -m "feat: 必殺技を使い切り制からクールダウン制にする"
```

---

### Task 2: スキルクールダウンの入力判定とUI表示

**Files:**
- Modify: `src/main.ts:147`
- Modify: `src/ui/screens.ts`（`drawBottomBar` / `drawSkillButton`）

**Interfaces:**
- Consumes: `Unit.skillCooldownUntil`（Task 1）、`DEFAULT_SKILL_COOLDOWN`（Task 1, `src/core/skills.ts` からexport）
- Produces: なし（末端のUI層）

- [ ] **Step 1: `main.ts` のタップ判定を直す**

`src/main.ts:147` の以下の行を:

```ts
        const canTap = !unit.retired && !unit.skillUsed;
```

次のように置き換える:

```ts
        const canTap = !unit.retired && battle.time >= unit.skillCooldownUntil;
```

- [ ] **Step 2: `ui/screens.ts` にクールダウンバーを実装する**

`src/ui/screens.ts` の冒頭、以下の行を:

```ts
import { lookupDef } from '../engine/registry';
import { titlesOf, xpToNext } from '../core/progress';
```

次のように置き換える:

```ts
import { lookupDef, skillParam } from '../engine/registry';
import { titlesOf, xpToNext } from '../core/progress';
import { DEFAULT_SKILL_COOLDOWN } from '../core/skills';
```

`drawBottomBar` 内、以下のブロックを:

```ts
      ctx.fillStyle = unit.skillUsed || unit.retired ? '#555' : '#ffd479';
      ctx.beginPath();
      ctx.arc(r.x + 198, r.y + 32, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
```

次のように置き換える（既存の「準備完了マーカー」の丸は廃止し、HPバー直下にクールダウンバーを描く）:

```ts
      ctx.globalAlpha = 1;

      if (unit.skillId !== null && !unit.retired) {
        const total = skillParam(reg, unit.skillId, 'cooldown', DEFAULT_SKILL_COOLDOWN);
        const remaining = Math.max(0, unit.skillCooldownUntil - state.time);
        const ratio = total > 0 ? 1 - remaining / total : 1;
        ctx.fillStyle = '#000';
        ctx.fillRect(r.x + 50, r.y + 46, 120, 6);
        ctx.fillStyle = '#ffd479';
        ctx.fillRect(r.x + 50, r.y + 46, 120 * Math.max(0, Math.min(1, ratio)), 6);
      }
```

- [ ] **Step 3: `drawSkillButton` の表示可否判定を直す**

`src/ui/screens.ts` の `drawSkillButton` 内、以下の行を:

```ts
  if (!unit || unit.retired || unit.skillUsed) return null;
```

次のように置き換える:

```ts
  if (!unit || unit.retired || state.time < unit.skillCooldownUntil) return null;
```

- [ ] **Step 4: 型チェックを実行する**

Run: `npm run build`
Expected: 型エラーなし（`skillUsed` を参照する箇所が残っていればここで検出される）

- [ ] **Step 5: 実際に動かして確認する**

Run: `npm run dev`

ブラウザで以下を確認する:
- ステージ開始→戦闘中にスキルボタンを押すと発動し、ボタンが消える
- ポートレートのHPバー下に黒いバーが現れ、時間経過とともに黄色く満ちていく
- 満タンになったら再度スキルボタンが出て使用できる

- [ ] **Step 6: コミット**

```bash
git add src/main.ts src/ui/screens.ts
git commit -m "feat: スキルのクールダウンをUIに反映する"
```

---

### Task 3: SimEvent の拡張（hit / heal / skill / unitDefeated / bondSupport）

**Files:**
- Modify: `src/core/types.ts`（`SimEvent`）
- Modify: `src/core/sim.ts`（`resolveAttacks` / `resolveRemoval`）
- Modify: `src/core/skills.ts`（`useSkill` の `skill` イベント発行、`kakenukeru` の `hit` イベント発行）
- Modify: `src/core/dialogue.test.ts`
- Modify: `src/core/growth.test.ts`
- Modify: `src/core/sim-combat.test.ts`
- Modify: `src/core/counters.test.ts`
- Modify: `src/render/effects.test.ts`（型を合わせるだけ。`Effect` 自体の変更は Task 4）

**Interfaces:**
- Consumes: `Unit.skillCooldownUntil`（Task 1）
- Produces: 拡張後の `SimEvent`（下記）。Task 4以降はこの型を前提に `spawnEffects` を書く。

```ts
export type SimEvent =
  | { type: 'engage'; uid: string; defId: string; targetUid: string; targetDefId: string; firstMeeting: boolean }
  | { type: 'skill'; uid: string; defId: string; skillId: string; hits: number; fromPos: Vec2; toPos: Vec2 }
  | { type: 'pinch'; uid: string; defId: string }
  | { type: 'hit'; targetUid: string; targetPos: Vec2; amount: number;
      sourceUid: string; sourceDefId: string; attackKind: AttackKind; sourcePos: Vec2; neraiuchi: boolean }
  | { type: 'heal'; targetPos: Vec2; amount: number; sourceUid: string; sourceDefId: string; sourcePos: Vec2 }
  | { type: 'unitDefeated'; uid: string; defId: string; byUid: string | null; byDefId: string | null;
      neraiuchi: boolean; pos: Vec2 }
  | { type: 'unitFled'; uid: string; defId: string; byUid: string | null; byDefId: string | null }
  | { type: 'unitRetired'; uid: string; defId: string }
  | { type: 'bondSupport'; targetUid: string; targetDefId: string; supporterUids: string[]; pos: Vec2 }
  | { type: 'levelUp'; uid: string; defId: string; level: number };
```

（`heal` イベント自体は Task 3 では型を定義するだけで、実際に発行するのは Task 6 の `omajinai` 変更から）

- [ ] **Step 1: `SimEvent` 型を上記のとおり書き換える**

`src/core/types.ts` の `SimEvent` を上記の定義に置き換える。

- [ ] **Step 2: `resolveAttacks` の `hit` イベント発行を直す**

`src/core/sim.ts` の `resolveAttacks` 内、以下の行を:

```ts
    state.events.push({ type: 'hit', targetPos: { ...target.pos }, amount: dmg });
```

次のように置き換える:

```ts
    state.events.push({
      type: 'hit', targetUid: target.uid, targetPos: { ...target.pos }, amount: dmg,
      sourceUid: u.uid, sourceDefId: u.defId, attackKind: u.attack, sourcePos: { ...u.pos }, neraiuchi,
    });
```

- [ ] **Step 3: `resolveRemoval` の `unitDefeated` イベント発行を直す**

`src/core/sim.ts` の `resolveRemoval` 内、以下の行を:

```ts
        state.events.push({
          type: 'unitDefeated', uid: u.uid, defId: u.defId, byUid, byDefId,
          neraiuchi: u.lastHitNeraiuchi,
        });
```

次のように置き換える:

```ts
        state.events.push({
          type: 'unitDefeated', uid: u.uid, defId: u.defId, byUid, byDefId,
          neraiuchi: u.lastHitNeraiuchi, pos: { ...u.pos },
        });
```

- [ ] **Step 4: `resolveAttacks` の `bondSupport` イベント発行を直す**

`src/core/sim.ts` の `resolveAttacks` 内、以下の行を:

```ts
      state.events.push({
        type: 'bondSupport', targetUid: u.uid, targetDefId: u.defId,
        supporterUids: supporters.map((s) => s.uid),
      });
```

次のように置き換える:

```ts
      state.events.push({
        type: 'bondSupport', targetUid: u.uid, targetDefId: u.defId,
        supporterUids: supporters.map((s) => s.uid), pos: { ...u.pos },
      });
```

- [ ] **Step 5: `useSkill` の `skill` イベント発行を `fromPos`/`toPos` にする**

`src/core/skills.ts` の `useSkill` を、以下の行:

```ts
export function useSkill(state: BattleState, uid: string, dest?: Vec2): boolean {
  if (!canUseSkill(state, uid)) return false;
  const self = state.units.find((u) => u.uid === uid)!;
  const effect = SKILL_EFFECTS[self.skillId ?? ''];
  if (!effect) return false;

  const hits = effect({ state, self, dest });
  if (hits === null) return false;

  const cooldown = skillParam(state.reg, self.skillId!, 'cooldown', DEFAULT_SKILL_COOLDOWN);
  self.skillCooldownUntil = state.time + cooldown;
  state.events.push({ type: 'skill', uid: self.uid, defId: self.defId, skillId: self.skillId!, hits });
  return true;
}
```

次のように置き換える（`fromPos` は効果適用前、`toPos` は適用後の自分の位置。`kakenukeru` は効果内で `self.pos` を移動先に書き換えるため、これだけで移動元→移動先が自然に取れる）:

```ts
export function useSkill(state: BattleState, uid: string, dest?: Vec2): boolean {
  if (!canUseSkill(state, uid)) return false;
  const self = state.units.find((u) => u.uid === uid)!;
  const effect = SKILL_EFFECTS[self.skillId ?? ''];
  if (!effect) return false;

  const fromPos = { ...self.pos };
  const hits = effect({ state, self, dest });
  if (hits === null) return false;

  const cooldown = skillParam(state.reg, self.skillId!, 'cooldown', DEFAULT_SKILL_COOLDOWN);
  self.skillCooldownUntil = state.time + cooldown;
  state.events.push({
    type: 'skill', uid: self.uid, defId: self.defId, skillId: self.skillId!, hits,
    fromPos, toPos: { ...self.pos },
  });
  return true;
}
```

- [ ] **Step 6: `kakenukeru` の `hit` イベント発行を直す**

`src/core/skills.ts` の `SKILL_EFFECTS.kakenukeru` 内、以下の行を:

```ts
      state.events.push({ type: 'hit', targetPos: { ...enemy.pos }, amount: damage });
```

次のように置き換える:

```ts
      state.events.push({
        type: 'hit', targetUid: enemy.uid, targetPos: { ...enemy.pos }, amount: damage,
        sourceUid: self.uid, sourceDefId: self.defId, attackKind: self.attack, sourcePos: { ...from }, neraiuchi: false,
      });
```

- [ ] **Step 7: 既存テストのイベントリテラルを型に合わせて直す**

`src/core/skills.test.ts` の `describe('ふんばる', ...)` 内、以下の箇所を:

```ts
    expect(s.events).toContainEqual({
      type: 'skill', uid: roran.uid, defId: 'roran', skillId: 'funbaru', hits: 0,
    });
```

次のように置き換える（`fresh()` 時点で `roran.pos` は動かしていないため、発動前後で同じ位置になる）:

```ts
    expect(s.events).toContainEqual({
      type: 'skill', uid: roran.uid, defId: 'roran', skillId: 'funbaru', hits: 0,
      fromPos: roran.pos, toPos: roran.pos,
    });
```

同ファイルの `describe('かけぬける', ...)` 内、以下の箇所を:

```ts
    expect(useSkill(s, gau.uid, { x: 260, y: 208 })).toBe(true);
    expect(unitOf(s, 'gau').pos).toEqual({ x: 260, y: 208 });
    expect(onPath.hp).toBe(12 - KAKENUKERU_DAMAGE);
    expect(offPath.hp).toBe(12);
    expect(s.events).toContainEqual({
      type: 'skill', uid: gau.uid, defId: 'gau', skillId: 'kakenukeru', hits: 1,
    });
```

次のように置き換える:

```ts
    expect(useSkill(s, gau.uid, { x: 260, y: 208 })).toBe(true);
    expect(unitOf(s, 'gau').pos).toEqual({ x: 260, y: 208 });
    expect(onPath.hp).toBe(12 - KAKENUKERU_DAMAGE);
    expect(offPath.hp).toBe(12);
    expect(s.events).toContainEqual({
      type: 'skill', uid: gau.uid, defId: 'gau', skillId: 'kakenukeru', hits: 1,
      fromPos: { x: 80, y: 208 }, toPos: { x: 260, y: 208 },
    });
```

`src/core/dialogue.test.ts` 内の `skill` イベントリテラル3箇所（`skillId: 'neraiuchi'` / `'kakenukeru'` / `'funbaru'` を含む行）それぞれに `fromPos` / `toPos` を追加する。例えば:

```ts
      { type: 'skill', uid: 'p2', defId: 'ines', skillId: 'neraiuchi', hits: 0 },
```

を:

```ts
      { type: 'skill', uid: 'p2', defId: 'ines', skillId: 'neraiuchi', hits: 0, fromPos: { x: 0, y: 0 }, toPos: { x: 0, y: 0 } },
```

とする（`pickDialogue` は位置を見ないため値は任意でよい）。他の2箇所（`gau`/`kakenukeru`、`roran`/`funbaru`）も同様に追加する。

同ファイル内の `hit` イベントリテラル（1箇所）を:

```ts
      { type: 'hit', targetPos: { x: 0, y: 0 }, amount: 3 },
```

次のように置き換える:

```ts
      {
        type: 'hit', targetUid: 'p1', targetPos: { x: 0, y: 0 }, amount: 3,
        sourceUid: 'e1', sourceDefId: 'narazumono', attackKind: 'melee',
        sourcePos: { x: 10, y: 0 }, neraiuchi: false,
      },
```

同ファイル内の `unitDefeated` イベントリテラル（1箇所）を:

```ts
      { type: 'unitDefeated', uid: 'e1', defId: 'narazumono', byUid: 'p4', byDefId: 'gau', neraiuchi: false },
```

次のように置き換える:

```ts
      { type: 'unitDefeated', uid: 'e1', defId: 'narazumono', byUid: 'p4', byDefId: 'gau', neraiuchi: false, pos: { x: 0, y: 0 } },
```

`src/core/growth.test.ts` 内の `unitDefeated` イベントリテラル4箇所すべてに `pos: { x: 0, y: 0 }`（任意の値でよい。`awardXpForDefeats` は位置を見ない）を追加する。例:

```ts
    s.events = [{
      type: 'unitDefeated', uid: e.uid, defId: e.defId,
      byUid: u.uid, byDefId: u.defId, neraiuchi: false,
    }];
```

を:

```ts
    s.events = [{
      type: 'unitDefeated', uid: e.uid, defId: e.defId,
      byUid: u.uid, byDefId: u.defId, neraiuchi: false, pos: { x: 0, y: 0 },
    }];
```

`src/core/counters.test.ts` 内の `skill` イベントリテラル4箇所すべてに `fromPos`/`toPos`（任意の値）を、`unitDefeated` イベントリテラル3箇所すべてに `pos`（任意の値）を追加する。

`src/core/sim-combat.test.ts` 内、`bondSupport` の検証箇所を:

```ts
    expect(s.events).toContainEqual({
      type: 'bondSupport', targetUid: roran.uid, targetDefId: 'roran', supporterUids: [ines.uid],
    });
```

次のように置き換える:

```ts
    expect(s.events).toContainEqual({
      type: 'bondSupport', targetUid: roran.uid, targetDefId: 'roran', supporterUids: [ines.uid],
      pos: roran.pos,
    });
```

同ファイル内の `unitDefeated` の検証箇所2箇所（`narazumono` を撃破する2テスト）を、それぞれ:

```ts
    expect(s.events).toContainEqual({
      type: 'unitDefeated', uid: e.uid, defId: 'narazumono', byUid: roran.uid, byDefId: 'roran', neraiuchi: false,
    });
```

```ts
    expect(s.events).toContainEqual({
      type: 'unitDefeated', uid: e.uid, defId: 'narazumono', byUid: gau.uid, byDefId: 'gau', neraiuchi: false,
    });
```

次のように置き換える（`e` は撃破された時点でも配列に残り `retired: true` になるだけなので、`e.pos` を参照すれば死亡時点の位置が取れる）:

```ts
    expect(s.events).toContainEqual({
      type: 'unitDefeated', uid: e.uid, defId: 'narazumono', byUid: roran.uid, byDefId: 'roran', neraiuchi: false,
      pos: e.pos,
    });
```

```ts
    expect(s.events).toContainEqual({
      type: 'unitDefeated', uid: e.uid, defId: 'narazumono', byUid: gau.uid, byDefId: 'gau', neraiuchi: false,
      pos: e.pos,
    });
```

`src/render/effects.test.ts` 内の `hit` イベントリテラル3箇所（`spawnHitEffects` のテスト）すべてに `targetUid` / `sourceUid` / `sourceDefId` / `attackKind` / `sourcePos` / `neraiuchi` を追加する。例:

```ts
    const events: SimEvent[] = [{ type: 'hit', targetPos: { x: 10, y: 20 }, amount: 3 }];
```

を:

```ts
    const events: SimEvent[] = [{
      type: 'hit', targetUid: 'e1', targetPos: { x: 10, y: 20 }, amount: 3,
      sourceUid: 'p1', sourceDefId: 'roran', attackKind: 'melee', sourcePos: { x: 0, y: 0 }, neraiuchi: false,
    }];
```

とする（このファイルは Task 4 で全面的に書き直すため、ここでは型エラーを消すだけでよい）。

- [ ] **Step 8: 型チェックとテストを実行する**

Run: `npm run build`
Expected: 型エラーなし

Run: `npm test`
Expected: PASS

- [ ] **Step 9: コミット**

```bash
git add src/core/types.ts src/core/sim.ts src/core/skills.ts \
  src/core/skills.test.ts src/core/dialogue.test.ts src/core/growth.test.ts \
  src/core/sim-combat.test.ts src/core/counters.test.ts src/render/effects.test.ts
git commit -m "feat: 戦闘イベントにエフェクト用の位置・攻撃種別情報を持たせる"
```

---

### Task 4: Effect の判別可能Union化 + ダメージ/回復ポップアップ + クリティカル視覚化

**Files:**
- Modify: `src/render/effects.ts`（全面書き換え）
- Modify: `src/render/effects.test.ts`（全面書き換え）
- Modify: `src/render/draw.ts`（`drawEffects`）
- Modify: `src/main.ts`（`spawnHitEffects` → `spawnEffects`）

**Interfaces:**
- Consumes: 拡張済み `SimEvent`（Task 3）
- Produces: `Effect` 判別可能Union（`kind: 'hit' | 'damageText' | 'healText'`。Task 5〜8でバリアントを追加していく）、`spawnEffects(state: EffectState, events: SimEvent[]): void`（`spawnHitEffects` の後継。以降のタスクはこの関数名を使う）

- [ ] **Step 1: 新しいテストを書く（失敗する）**

`src/render/effects.test.ts` の内容を丸ごと以下に置き換える:

```ts
import { describe, expect, it } from 'vitest';
import {
  DAMAGE_TEXT_DURATION, HEAL_TEXT_DURATION, HIT_EFFECT_DURATION,
  makeEffectState, spawnEffects, tickEffects,
} from './effects';
import type { EffectState } from './effects';
import type { SimEvent } from '../core/types';

function hitEvent(overrides: Partial<Extract<SimEvent, { type: 'hit' }>> = {}): SimEvent {
  return {
    type: 'hit', targetUid: 'e1', targetPos: { x: 10, y: 20 }, amount: 3,
    sourceUid: 'p1', sourceDefId: 'roran', attackKind: 'melee',
    sourcePos: { x: 0, y: 0 }, neraiuchi: false,
    ...overrides,
  };
}

describe('spawnEffects', () => {
  it('hit イベントから hit と damageText を追加する', () => {
    const state = makeEffectState();
    spawnEffects(state, [hitEvent()]);
    expect(state.items).toEqual([
      { kind: 'hit', pos: { x: 10, y: 20 }, ttl: HIT_EFFECT_DURATION, critical: false },
      { kind: 'damageText', pos: { x: 10, y: 20 }, ttl: DAMAGE_TEXT_DURATION, amount: 3, critical: false },
    ]);
  });

  it('neraiuchi な hit は critical フラグが立つ', () => {
    const state = makeEffectState();
    spawnEffects(state, [hitEvent({ neraiuchi: true })]);
    expect(state.items[0]).toMatchObject({ kind: 'hit', critical: true });
    expect(state.items[1]).toMatchObject({ kind: 'damageText', critical: true });
  });

  it('heal イベントから healText を追加する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [
      { type: 'heal', targetPos: { x: 5, y: 5 }, amount: 12, sourceUid: 'p3', sourceDefId: 'mist', sourcePos: { x: 0, y: 0 } },
    ];
    spawnEffects(state, events);
    expect(state.items).toEqual([
      { kind: 'healText', pos: { x: 5, y: 5 }, ttl: HEAL_TEXT_DURATION, amount: 12 },
    ]);
  });

  it('関係ないイベントは無視する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [{ type: 'unitRetired', uid: 'p1', defId: 'roran' }];
    spawnEffects(state, events);
    expect(state.items).toEqual([]);
  });

  it('複数の hit をすべて追加する', () => {
    const state = makeEffectState();
    spawnEffects(state, [
      hitEvent({ targetUid: 'e1', targetPos: { x: 0, y: 0 } }),
      hitEvent({ targetUid: 'e2', targetPos: { x: 5, y: 5 } }),
    ]);
    expect(state.items.filter((i) => i.kind === 'hit')).toHaveLength(2);
  });
});

describe('tickEffects', () => {
  it('dt の分だけ ttl を減らす', () => {
    const state: EffectState = { items: [{ kind: 'hit', pos: { x: 0, y: 0 }, ttl: 0.25, critical: false }] };
    tickEffects(state, 0.1);
    expect(state.items[0]!.ttl).toBeCloseTo(0.15);
  });

  it('ttl が 0 以下になったら取り除く', () => {
    const state: EffectState = { items: [{ kind: 'hit', pos: { x: 0, y: 0 }, ttl: 0.05, critical: false }] };
    tickEffects(state, 0.1);
    expect(state.items).toEqual([]);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- src/render/effects.test.ts`
Expected: FAIL（`spawnEffects` が存在しない、`Effect` がまだ `{pos, ttl}` のため）

- [ ] **Step 3: `effects.ts` を実装する**

`src/render/effects.ts` の内容を丸ごと以下に置き換える:

```ts
import type { SimEvent, Vec2 } from '../core/types';

export const HIT_EFFECT_DURATION = 0.25;
export const DAMAGE_TEXT_DURATION = 0.6;
export const HEAL_TEXT_DURATION = 0.6;

export type Effect =
  | { kind: 'hit'; pos: Vec2; ttl: number; critical: boolean }
  | { kind: 'damageText'; pos: Vec2; ttl: number; amount: number; critical: boolean }
  | { kind: 'healText'; pos: Vec2; ttl: number; amount: number };

export type EffectState = { items: Effect[] };

export function makeEffectState(): EffectState {
  return { items: [] };
}

export function spawnEffects(state: EffectState, events: SimEvent[]): void {
  for (const ev of events) {
    if (ev.type === 'hit') {
      state.items.push({ kind: 'hit', pos: { ...ev.targetPos }, ttl: HIT_EFFECT_DURATION, critical: ev.neraiuchi });
      state.items.push({
        kind: 'damageText', pos: { ...ev.targetPos }, ttl: DAMAGE_TEXT_DURATION,
        amount: ev.amount, critical: ev.neraiuchi,
      });
    } else if (ev.type === 'heal') {
      state.items.push({ kind: 'healText', pos: { ...ev.targetPos }, ttl: HEAL_TEXT_DURATION, amount: ev.amount });
    }
  }
}

export function tickEffects(state: EffectState, dt: number): void {
  for (const e of state.items) e.ttl -= dt;
  state.items = state.items.filter((e) => e.ttl > 0);
}
```

- [ ] **Step 4: テストを実行してパスを確認する**

Run: `npm test -- src/render/effects.test.ts`
Expected: PASS

- [ ] **Step 5: `draw.ts` の `drawEffects` を書き換える**

`src/render/draw.ts` の `HIT_EFFECT_DURATION` のimportを以下のように変更する:

```ts
import { HIT_EFFECT_DURATION } from './effects';
```

を:

```ts
import { DAMAGE_TEXT_DURATION, HEAL_TEXT_DURATION, HIT_EFFECT_DURATION } from './effects';
```

`drawEffects` 関数を以下に置き換える:

```ts
function drawEffects(ctx: CanvasRenderingContext2D, effects: EffectState): void {
  for (const e of effects.items) {
    const p = mapToLogical(e.pos);
    switch (e.kind) {
      case 'hit': {
        const ratio = Math.max(0, e.ttl / HIT_EFFECT_DURATION);
        ctx.strokeStyle = e.critical ? `rgba(255, 120, 60, ${ratio})` : `rgba(255, 235, 150, ${ratio})`;
        ctx.lineWidth = e.critical ? 4 : 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, UNIT_R + (1 - ratio) * (e.critical ? 20 : 14), 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'damageText': {
        const ratio = Math.max(0, e.ttl / DAMAGE_TEXT_DURATION);
        const rise = (1 - ratio) * 20;
        ctx.globalAlpha = ratio;
        ctx.fillStyle = e.critical ? '#ff8a3c' : '#ffffff';
        ctx.font = e.critical ? 'bold 18px sans-serif' : '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${e.amount}`, p.x, p.y - UNIT_R - 14 - rise);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
        break;
      }
      case 'healText': {
        const ratio = Math.max(0, e.ttl / HEAL_TEXT_DURATION);
        const rise = (1 - ratio) * 20;
        ctx.globalAlpha = ratio;
        ctx.fillStyle = '#8fffb0';
        ctx.font = '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`+${e.amount}`, p.x, p.y - UNIT_R - 14 - rise);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
        break;
      }
    }
  }
}
```

- [ ] **Step 6: `main.ts` の呼び出しを直す**

`src/main.ts` の以下の行を:

```ts
import { makeEffectState, spawnHitEffects, tickEffects } from './render/effects';
```

次のように置き換える:

```ts
import { makeEffectState, spawnEffects, tickEffects } from './render/effects';
```

以下の行を:

```ts
    spawnHitEffects(effects, battle.events);
```

次のように置き換える:

```ts
    spawnEffects(effects, battle.events);
```

- [ ] **Step 7: 型チェックとテスト、動作確認**

Run: `npm run build && npm test`
Expected: PASS

Run: `npm run dev`

ブラウザで戦闘を進め、以下を確認する:
- 攻撃が当たると白い円と一緒にダメージ数値が浮かんで消える
- ねらいうち発動後の一撃は、円もダメージ数値もオレンジ色で通常より大きく表示される

- [ ] **Step 8: コミット**

```bash
git add src/render/effects.ts src/render/effects.test.ts src/render/draw.ts src/main.ts
git commit -m "feat: エフェクトをkind別Unionにし、ダメージポップアップとクリティカル演出を足す"
```

---

### Task 5: 攻撃エフェクト（弓の射線）

**Files:**
- Modify: `src/render/effects.ts`
- Modify: `src/render/effects.test.ts`
- Modify: `src/render/draw.ts`

**Interfaces:**
- Consumes: `Effect` Union（Task 4）、`SimEvent.hit.attackKind` / `sourcePos`（Task 3）
- Produces: `Effect` に `kind: 'attackLine'` バリアントを追加

- [ ] **Step 1: 失敗するテストを書く**

`src/render/effects.test.ts` の `import` に `ATTACK_LINE_DURATION` を追加し、`describe('spawnEffects', ...)` 内に以下のテストを2つ追加する:

```ts
  it('bow の hit は attackLine も追加する', () => {
    const state = makeEffectState();
    spawnEffects(state, [hitEvent({ attackKind: 'bow', sourcePos: { x: 100, y: 20 }, targetPos: { x: 10, y: 20 } })]);
    expect(state.items).toContainEqual({
      kind: 'attackLine', from: { x: 100, y: 20 }, to: { x: 10, y: 20 }, ttl: ATTACK_LINE_DURATION,
    });
  });

  it('melee の hit は attackLine を追加しない', () => {
    const state = makeEffectState();
    spawnEffects(state, [hitEvent({ attackKind: 'melee' })]);
    expect(state.items.some((i) => i.kind === 'attackLine')).toBe(false);
  });
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- src/render/effects.test.ts`
Expected: FAIL（`ATTACK_LINE_DURATION` が存在しない）

- [ ] **Step 3: `effects.ts` に `attackLine` を追加する**

`src/render/effects.ts` の定数群に追加する:

```ts
export const ATTACK_LINE_DURATION = 0.15;
```

`Effect` Unionに追加する:

```ts
  | { kind: 'attackLine'; from: Vec2; to: Vec2; ttl: number }
```

`spawnEffects` の `hit` 処理を以下に置き換える:

```ts
    if (ev.type === 'hit') {
      state.items.push({ kind: 'hit', pos: { ...ev.targetPos }, ttl: HIT_EFFECT_DURATION, critical: ev.neraiuchi });
      state.items.push({
        kind: 'damageText', pos: { ...ev.targetPos }, ttl: DAMAGE_TEXT_DURATION,
        amount: ev.amount, critical: ev.neraiuchi,
      });
      if (ev.attackKind === 'bow') {
        state.items.push({ kind: 'attackLine', from: { ...ev.sourcePos }, to: { ...ev.targetPos }, ttl: ATTACK_LINE_DURATION });
      }
    } else if (ev.type === 'heal') {
```

- [ ] **Step 4: テストを実行してパスを確認する**

Run: `npm test -- src/render/effects.test.ts`
Expected: PASS

- [ ] **Step 5: `draw.ts` に `attackLine` の描画を追加する**

`src/render/draw.ts` の以下の行を:

```ts
import { DAMAGE_TEXT_DURATION, HEAL_TEXT_DURATION, HIT_EFFECT_DURATION } from './effects';
```

次のように置き換える:

```ts
import { ATTACK_LINE_DURATION, DAMAGE_TEXT_DURATION, HEAL_TEXT_DURATION, HIT_EFFECT_DURATION } from './effects';
```

`drawEffects` の `switch` に以下の `case` を追加する:

```ts
      case 'attackLine': {
        const a = mapToLogical(e.from);
        const b = mapToLogical(e.to);
        const ratio = Math.max(0, e.ttl / ATTACK_LINE_DURATION);
        ctx.strokeStyle = `rgba(200, 220, 255, ${ratio})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        break;
      }
```

- [ ] **Step 6: 型チェックとテスト、動作確認**

Run: `npm run build && npm test`
Expected: PASS

Run: `npm run dev`

イネス（弓キャラ）を敵と交戦させ、攻撃のたびに射線が一瞬光ることを確認する。

- [ ] **Step 7: コミット**

```bash
git add src/render/effects.ts src/render/effects.test.ts src/render/draw.ts
git commit -m "feat: 弓の攻撃に射線エフェクトを足す"
```

---

### Task 6: 回復エフェクト（おまじない）

**Files:**
- Modify: `src/core/skills.ts`（`omajinai` 効果に `heal` イベント発行を追加）
- Modify: `src/core/skills.test.ts`
- Modify: `src/render/effects.ts`
- Modify: `src/render/effects.test.ts`
- Modify: `src/render/draw.ts`

**Interfaces:**
- Consumes: `SimEvent.heal`（型はTask3で定義済み）、`Effect` Union（Task 4/5）
- Produces: `Effect` に `kind: 'heal'` / `kind: 'healBeam'` バリアントを追加。`omajinai` が `heal` イベントを実際に発行するようになる。

- [ ] **Step 1: `omajinai` が `heal` イベントを出すことを確認するテストを書く**

`src/core/skills.test.ts` の `describe('おまじない', ...)` 内、既存の「範囲内で HP 割合がいちばん低い味方を回復する」テストの直後に、以下のテストを追加する:

```ts
  it('回復すると heal イベントが出る', () => {
    const s = fresh();
    const mist = unitOf(s, 'mist');
    mist.pos = { x: 100, y: 16 };
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 150, y: 16 };
    roran.hp = 5;
    useSkill(s, mist.uid);
    expect(s.events).toContainEqual({
      type: 'heal', targetPos: roran.pos, amount: OMAJINAI_HEAL,
      sourceUid: mist.uid, sourceDefId: 'mist', sourcePos: mist.pos,
    });
  });
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- src/core/skills.test.ts`
Expected: FAIL（`heal` イベントがまだ発行されない）

- [ ] **Step 3: `omajinai` 効果を実装する**

`src/core/skills.ts` の `SKILL_EFFECTS.omajinai` を、以下の内容:

```ts
  omajinai: ({ state, self }) => {
    const range = skillParam(state.reg, 'omajinai', 'range', BOND_RANGE);
    const heal = skillParam(state.reg, 'omajinai', 'heal', OMAJINAI_HEAL);
    const candidates = playerUnits(state).filter((u) => distance(self.pos, u.pos) <= range);
    if (candidates.length === 0) return null;
    let target = candidates[0]!;
    for (const c of candidates) {
      if (c.hp / c.maxHp < target.hp / target.maxHp) target = c;
    }
    target.hp = Math.min(target.maxHp, target.hp + heal);
    return 0;
  },
```

次のように置き換える（実際に回復した量を `heal` イベントに積む。最大HP到達済みなら回復量0のイベントは出さない）:

```ts
  omajinai: ({ state, self }) => {
    const range = skillParam(state.reg, 'omajinai', 'range', BOND_RANGE);
    const heal = skillParam(state.reg, 'omajinai', 'heal', OMAJINAI_HEAL);
    const candidates = playerUnits(state).filter((u) => distance(self.pos, u.pos) <= range);
    if (candidates.length === 0) return null;
    let target = candidates[0]!;
    for (const c of candidates) {
      if (c.hp / c.maxHp < target.hp / target.maxHp) target = c;
    }
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + heal);
    const healed = target.hp - before;
    if (healed > 0) {
      state.events.push({
        type: 'heal', targetPos: { ...target.pos }, amount: healed,
        sourceUid: self.uid, sourceDefId: self.defId, sourcePos: { ...self.pos },
      });
    }
    return 0;
  },
```

- [ ] **Step 4: テストを実行してパスを確認する**

Run: `npm test -- src/core/skills.test.ts`
Expected: PASS

- [ ] **Step 5: `heal`/`healBeam` エフェクトのテストを書く**

`src/render/effects.test.ts` の `import` に `HEAL_BEAM_DURATION` / `HEAL_RING_DURATION` を追加し、
「heal イベントから healText を追加する」テストを以下に置き換える:

```ts
  it('heal イベントから healText / heal / healBeam を追加する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [
      { type: 'heal', targetPos: { x: 5, y: 5 }, amount: 12, sourceUid: 'p3', sourceDefId: 'mist', sourcePos: { x: 0, y: 0 } },
    ];
    spawnEffects(state, events);
    expect(state.items).toEqual([
      { kind: 'healText', pos: { x: 5, y: 5 }, ttl: HEAL_TEXT_DURATION, amount: 12 },
      { kind: 'heal', pos: { x: 5, y: 5 }, ttl: HEAL_RING_DURATION },
      { kind: 'healBeam', from: { x: 0, y: 0 }, to: { x: 5, y: 5 }, ttl: HEAL_BEAM_DURATION },
    ]);
  });
```

- [ ] **Step 6: テストを実行して失敗を確認する**

Run: `npm test -- src/render/effects.test.ts`
Expected: FAIL

- [ ] **Step 7: `effects.ts` に `heal`/`healBeam` を追加する**

定数を追加する:

```ts
export const HEAL_RING_DURATION = 0.4;
export const HEAL_BEAM_DURATION = 0.3;
```

`Effect` Unionに追加する:

```ts
  | { kind: 'heal'; pos: Vec2; ttl: number }
  | { kind: 'healBeam'; from: Vec2; to: Vec2; ttl: number }
```

`spawnEffects` の `heal` 処理を以下に置き換える:

```ts
    } else if (ev.type === 'heal') {
      state.items.push({ kind: 'healText', pos: { ...ev.targetPos }, ttl: HEAL_TEXT_DURATION, amount: ev.amount });
      state.items.push({ kind: 'heal', pos: { ...ev.targetPos }, ttl: HEAL_RING_DURATION });
      state.items.push({ kind: 'healBeam', from: { ...ev.sourcePos }, to: { ...ev.targetPos }, ttl: HEAL_BEAM_DURATION });
    }
```

- [ ] **Step 8: テストを実行してパスを確認する**

Run: `npm test -- src/render/effects.test.ts`
Expected: PASS

- [ ] **Step 9: `draw.ts` に描画を追加する**

`src/render/draw.ts` の以下の行を:

```ts
import { ATTACK_LINE_DURATION, DAMAGE_TEXT_DURATION, HEAL_TEXT_DURATION, HIT_EFFECT_DURATION } from './effects';
```

次のように置き換える:

```ts
import {
  ATTACK_LINE_DURATION, DAMAGE_TEXT_DURATION, HEAL_BEAM_DURATION,
  HEAL_RING_DURATION, HEAL_TEXT_DURATION, HIT_EFFECT_DURATION,
} from './effects';
```

`drawEffects` の `switch` に以下の `case` を追加する:

```ts
      case 'heal': {
        const ratio = Math.max(0, e.ttl / HEAL_RING_DURATION);
        ctx.strokeStyle = `rgba(150, 255, 180, ${ratio})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, UNIT_R + (1 - ratio) * 16, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'healBeam': {
        const a = mapToLogical(e.from);
        const b = mapToLogical(e.to);
        const ratio = Math.max(0, e.ttl / HEAL_BEAM_DURATION);
        ctx.strokeStyle = `rgba(180, 255, 200, ${ratio})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        break;
      }
```

- [ ] **Step 10: 型チェックとテスト、動作確認**

Run: `npm run build && npm test`
Expected: PASS

Run: `npm run dev`

ミスト（回復役）のスキルを発動させ、対象へ光の弧が飛び、足元に緑の輪が広がり、`+数値` が浮かぶことを確認する。

- [ ] **Step 11: コミット**

```bash
git add src/core/skills.ts src/core/skills.test.ts src/render/effects.ts src/render/effects.test.ts src/render/draw.ts
git commit -m "feat: おまじないに回復エフェクトを足す"
```

---

### Task 7: スキル固有の発動エフェクト（ふんばる/ねらいうち/かけぬける）

**Files:**
- Modify: `src/render/effects.ts`
- Modify: `src/render/effects.test.ts`
- Modify: `src/render/draw.ts`

**Interfaces:**
- Consumes: `SimEvent.skill.fromPos` / `toPos`（Task 3）
- Produces: `Effect` に `kind: 'skillCast'` / `kind: 'trail'` バリアントを追加

- [ ] **Step 1: 失敗するテストを書く**

`src/render/effects.test.ts` の `import` に `SKILL_CAST_DURATION` / `TRAIL_DURATION` を追加し、`describe('spawnEffects', ...)` 内に以下のテストを追加する:

```ts
  it('kakenukeru の skill イベントから trail を追加する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [{
      type: 'skill', uid: 'p4', defId: 'gau', skillId: 'kakenukeru', hits: 1,
      fromPos: { x: 0, y: 0 }, toPos: { x: 100, y: 0 },
    }];
    spawnEffects(state, events);
    expect(state.items).toEqual([
      { kind: 'trail', from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, ttl: TRAIL_DURATION },
    ]);
  });

  it('funbaru の skill イベントから skillCast を追加する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [{
      type: 'skill', uid: 'p1', defId: 'roran', skillId: 'funbaru', hits: 0,
      fromPos: { x: 10, y: 10 }, toPos: { x: 10, y: 10 },
    }];
    spawnEffects(state, events);
    expect(state.items).toEqual([
      { kind: 'skillCast', skillId: 'funbaru', pos: { x: 10, y: 10 }, ttl: SKILL_CAST_DURATION },
    ]);
  });

  it('neraiuchi の skill イベントから skillCast を追加する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [{
      type: 'skill', uid: 'p2', defId: 'ines', skillId: 'neraiuchi', hits: 0,
      fromPos: { x: 5, y: 5 }, toPos: { x: 5, y: 5 },
    }];
    spawnEffects(state, events);
    expect(state.items).toEqual([
      { kind: 'skillCast', skillId: 'neraiuchi', pos: { x: 5, y: 5 }, ttl: SKILL_CAST_DURATION },
    ]);
  });
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- src/render/effects.test.ts`
Expected: FAIL

- [ ] **Step 3: `effects.ts` に `skillCast`/`trail` を追加する**

定数を追加する:

```ts
export const SKILL_CAST_DURATION = 0.35;
export const TRAIL_DURATION = 0.25;
```

`Effect` Unionに追加する:

```ts
  | { kind: 'skillCast'; skillId: string; pos: Vec2; ttl: number }
  | { kind: 'trail'; from: Vec2; to: Vec2; ttl: number }
```

`spawnEffects` の末尾（`heal` の `else if` の後）に、以下の分岐を追加する:

```ts
    } else if (ev.type === 'skill') {
      if (ev.skillId === 'kakenukeru') {
        state.items.push({ kind: 'trail', from: { ...ev.fromPos }, to: { ...ev.toPos }, ttl: TRAIL_DURATION });
      } else {
        state.items.push({ kind: 'skillCast', skillId: ev.skillId, pos: { ...ev.toPos }, ttl: SKILL_CAST_DURATION });
      }
    }
```

（`omajinai` はこの分岐で `skillCast` を受け取るが、Task 6 で追加した `heal`/`healBeam` と重なって表示される。これは意図的で、術者側にも短い発動演出が付くようにする）

- [ ] **Step 4: テストを実行してパスを確認する**

Run: `npm test -- src/render/effects.test.ts`
Expected: PASS

- [ ] **Step 5: `draw.ts` に描画を追加する**

`src/render/draw.ts` の以下の行を:

```ts
import {
  ATTACK_LINE_DURATION, DAMAGE_TEXT_DURATION, HEAL_BEAM_DURATION,
  HEAL_RING_DURATION, HEAL_TEXT_DURATION, HIT_EFFECT_DURATION,
} from './effects';
```

次のように置き換える:

```ts
import {
  ATTACK_LINE_DURATION, DAMAGE_TEXT_DURATION, HEAL_BEAM_DURATION, HEAL_RING_DURATION,
  HEAL_TEXT_DURATION, HIT_EFFECT_DURATION, SKILL_CAST_DURATION, TRAIL_DURATION,
} from './effects';
```

`drawEffects` の `switch` に以下の `case` を追加する:

```ts
      case 'skillCast': {
        const ratio = Math.max(0, e.ttl / SKILL_CAST_DURATION);
        if (e.skillId === 'funbaru') {
          ctx.strokeStyle = `rgba(255, 226, 122, ${ratio})`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, (1 - ratio) * 34, 0, Math.PI * 2);
          ctx.stroke();
        } else if (e.skillId === 'neraiuchi') {
          ctx.strokeStyle = `rgba(255, 255, 255, ${ratio})`;
          ctx.lineWidth = 2;
          const s = 10 + (1 - ratio) * 6;
          ctx.beginPath();
          ctx.moveTo(p.x - s, p.y);
          ctx.lineTo(p.x + s, p.y);
          ctx.moveTo(p.x, p.y - s);
          ctx.lineTo(p.x, p.y + s);
          ctx.stroke();
        }
        break;
      }
      case 'trail': {
        const a = mapToLogical(e.from);
        const b = mapToLogical(e.to);
        const ratio = Math.max(0, e.ttl / TRAIL_DURATION);
        ctx.strokeStyle = `rgba(255, 255, 255, ${ratio})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        break;
      }
```

- [ ] **Step 6: 型チェックとテスト、動作確認**

Run: `npm run build && npm test`
Expected: PASS

Run: `npm run dev`

ロラン（ふんばる）で発動時に強めの黄色いリングが出ること、イネス（ねらいうち）で頭上に照準が一瞬出ること、ガウ（かけぬける）で移動元→移動先に白い残像線が出ることを確認する。

- [ ] **Step 7: コミット**

```bash
git add src/render/effects.ts src/render/effects.test.ts src/render/draw.ts
git commit -m "feat: スキルごとの固有発動エフェクトを足す"
```

---

### Task 8: 撃破エフェクト・被弾ノックバック・絆強調・HPバーアニメーション

**Files:**
- Modify: `src/render/effects.ts`
- Modify: `src/render/effects.test.ts`
- Modify: `src/render/draw.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `SimEvent.unitDefeated.pos` / `SimEvent.bondSupport.pos`（Task 3）
- Produces: `Effect` に `kind: 'defeat'` / `kind: 'bondPulse'` バリアントを追加。`EffectState` に `knockback` / `displayedHp` を追加。`syncDisplayedHp(state: EffectState, units: Unit[], dt: number): void` を新規export。

- [ ] **Step 1: 失敗するテストを書く（defeat / bondPulse）**

`src/render/effects.test.ts` の `import` に `BOND_PULSE_DURATION` / `DEFEAT_DURATION` を追加し、`describe('spawnEffects', ...)` 内に以下のテストを追加する:

```ts
  it('unitDefeated イベントから defeat を追加する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [
      { type: 'unitDefeated', uid: 'e1', defId: 'narazumono', byUid: 'p1', byDefId: 'roran', neraiuchi: false, pos: { x: 30, y: 40 } },
    ];
    spawnEffects(state, events);
    expect(state.items).toEqual([{ kind: 'defeat', pos: { x: 30, y: 40 }, ttl: DEFEAT_DURATION }]);
  });

  it('bondSupport イベントから bondPulse を追加する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [
      { type: 'bondSupport', targetUid: 'p1', targetDefId: 'roran', supporterUids: ['p2'], pos: { x: 1, y: 2 } },
    ];
    spawnEffects(state, events);
    expect(state.items).toEqual([{ kind: 'bondPulse', pos: { x: 1, y: 2 }, ttl: BOND_PULSE_DURATION }]);
  });
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npm test -- src/render/effects.test.ts`
Expected: FAIL

- [ ] **Step 3: `effects.ts` に `defeat`/`bondPulse` を追加する**

定数を追加する:

```ts
export const DEFEAT_DURATION = 0.5;
export const BOND_PULSE_DURATION = 0.3;
```

`Effect` Unionに追加する:

```ts
  | { kind: 'defeat'; pos: Vec2; ttl: number }
  | { kind: 'bondPulse'; pos: Vec2; ttl: number }
```

`spawnEffects` の `skill` 分岐の後に、以下を追加する:

```ts
    } else if (ev.type === 'unitDefeated') {
      state.items.push({ kind: 'defeat', pos: { ...ev.pos }, ttl: DEFEAT_DURATION });
    } else if (ev.type === 'bondSupport') {
      state.items.push({ kind: 'bondPulse', pos: { ...ev.pos }, ttl: BOND_PULSE_DURATION });
    }
```

- [ ] **Step 4: テストを実行してパスを確認する**

Run: `npm test -- src/render/effects.test.ts`
Expected: PASS

- [ ] **Step 5: ノックバックのテストを書く**

`describe('spawnEffects', ...)` 内に以下のテストを追加する:

```ts
  it('hit で被弾したユニットにノックバックが付く', () => {
    const state = makeEffectState();
    spawnEffects(state, [hitEvent({
      targetUid: 'e1', targetPos: { x: 10, y: 0 }, sourcePos: { x: 0, y: 0 },
    })]);
    const kb = state.knockback.get('e1');
    expect(kb).toBeDefined();
    expect(kb!.dir.x).toBeCloseTo(1);
    expect(kb!.dir.y).toBeCloseTo(0);
  });
```

`describe('tickEffects', ...)` 内に以下のテストを追加する:

```ts
  it('ノックバックの ttl が尽きたら削除する', () => {
    const state: EffectState = { items: [], knockback: new Map([['e1', { ttl: 0.05, dir: { x: 1, y: 0 } }]]), displayedHp: new Map() };
    tickEffects(state, 0.1);
    expect(state.knockback.has('e1')).toBe(false);
  });
```

- [ ] **Step 6: テストを実行して失敗を確認する**

Run: `npm test -- src/render/effects.test.ts`
Expected: FAIL（`EffectState` に `knockback` が無い）

- [ ] **Step 7: `EffectState` に `knockback` / `displayedHp` を追加する**

`src/render/effects.ts` の先頭のimportに `Unit` を追加する:

```ts
import type { SimEvent, Unit, Vec2 } from '../core/types';
```

定数を追加する:

```ts
export const KNOCKBACK_DURATION = 0.15;
export const HP_BAR_CATCHUP_RATE = 6;
```

`EffectState` 型と `makeEffectState` を以下に置き換える:

```ts
export type EffectState = {
  items: Effect[];
  knockback: Map<string, { ttl: number; dir: Vec2 }>;
  displayedHp: Map<string, number>;
};

export function makeEffectState(): EffectState {
  return { items: [], knockback: new Map(), displayedHp: new Map() };
}
```

`spawnEffects` の先頭に、方向を計算するヘルパー関数をファイルに追加する（`spawnEffects` の直前に置く）:

```ts
function knockbackDir(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}
```

`spawnEffects` の `hit` 処理の中（`attackLine` の `if` ブロックの後）に、以下を追加する:

```ts
      state.knockback.set(ev.targetUid, { ttl: KNOCKBACK_DURATION, dir: knockbackDir(ev.sourcePos, ev.targetPos) });
```

`tickEffects` を以下に置き換える:

```ts
export function tickEffects(state: EffectState, dt: number): void {
  for (const e of state.items) e.ttl -= dt;
  state.items = state.items.filter((e) => e.ttl > 0);

  for (const [uid, kb] of state.knockback) {
    kb.ttl -= dt;
    if (kb.ttl <= 0) state.knockback.delete(uid);
  }
}
```

ファイル末尾に、表示用HPを実HPへ追従させる関数を追加する:

```ts
export function syncDisplayedHp(state: EffectState, units: Unit[], dt: number): void {
  const seen = new Set<string>();
  for (const u of units) {
    seen.add(u.uid);
    const current = state.displayedHp.get(u.uid) ?? u.hp;
    const diff = u.hp - current;
    const next = Math.abs(diff) < 0.05 ? u.hp : current + diff * Math.min(1, dt * HP_BAR_CATCHUP_RATE);
    state.displayedHp.set(u.uid, next);
  }
  for (const uid of state.displayedHp.keys()) {
    if (!seen.has(uid)) state.displayedHp.delete(uid);
  }
}
```

- [ ] **Step 8: Task 4 で書いた既存の `tickEffects` テストを新しい `EffectState` 型に合わせる**

`EffectState` に `knockback` / `displayedHp` が必須プロパティとして加わったため、Task 4 で
`{ items: [...] }` とだけ書いていた既存の2テストがこのままでは型エラーになる。
`describe('tickEffects', ...)` 内の以下2箇所を:

```ts
    const state: EffectState = { items: [{ kind: 'hit', pos: { x: 0, y: 0 }, ttl: 0.25, critical: false }] };
```

```ts
    const state: EffectState = { items: [{ kind: 'hit', pos: { x: 0, y: 0 }, ttl: 0.05, critical: false }] };
```

それぞれ次のように置き換える:

```ts
    const state: EffectState = {
      items: [{ kind: 'hit', pos: { x: 0, y: 0 }, ttl: 0.25, critical: false }],
      knockback: new Map(), displayedHp: new Map(),
    };
```

```ts
    const state: EffectState = {
      items: [{ kind: 'hit', pos: { x: 0, y: 0 }, ttl: 0.05, critical: false }],
      knockback: new Map(), displayedHp: new Map(),
    };
```

- [ ] **Step 9: テストを実行してパスを確認する**

Run: `npm test -- src/render/effects.test.ts`
Expected: PASS

- [ ] **Step 10: `draw.ts` に defeat/bondPulse の描画とノックバック/HPバーアニメーションの適用を追加する**

`src/render/draw.ts` の以下の行を:

```ts
import {
  ATTACK_LINE_DURATION, DAMAGE_TEXT_DURATION, HEAL_BEAM_DURATION, HEAL_RING_DURATION,
  HEAL_TEXT_DURATION, HIT_EFFECT_DURATION, SKILL_CAST_DURATION, TRAIL_DURATION,
} from './effects';
```

次のように置き換える:

```ts
import {
  ATTACK_LINE_DURATION, BOND_PULSE_DURATION, DAMAGE_TEXT_DURATION, DEFEAT_DURATION,
  HEAL_BEAM_DURATION, HEAL_RING_DURATION, HEAL_TEXT_DURATION, HIT_EFFECT_DURATION,
  KNOCKBACK_DURATION, SKILL_CAST_DURATION, TRAIL_DURATION,
} from './effects';
```

`drawEffects` の `switch` に以下の `case` を追加する:

```ts
      case 'defeat': {
        const ratio = Math.max(0, e.ttl / DEFEAT_DURATION);
        ctx.globalAlpha = ratio;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, UNIT_R + (1 - ratio) * 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case 'bondPulse': {
        const ratio = Math.max(0, e.ttl / BOND_PULSE_DURATION);
        ctx.strokeStyle = `rgba(255, 158, 196, ${ratio})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, UNIT_R + (1 - ratio) * 18, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
```

`drawUnits` のシグネチャに `effects: EffectState` を追加する。以下の行を:

```ts
function drawUnits(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  state: BattleState,
  selected: string | null,
): void {
  for (const unit of state.units) {
    if (unit.retired) continue;
    const isAlly = unit.side === 'player';
    const p = mapToLogical(unit.pos);
```

次のように置き換える:

```ts
function drawUnits(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  state: BattleState,
  selected: string | null,
  effects: EffectState,
): void {
  for (const unit of state.units) {
    if (unit.retired) continue;
    const isAlly = unit.side === 'player';
    const kb = effects.knockback.get(unit.uid);
    const kbOffset = kb
      ? { x: kb.dir.x * (kb.ttl / KNOCKBACK_DURATION) * 6, y: kb.dir.y * (kb.ttl / KNOCKBACK_DURATION) * 6 }
      : { x: 0, y: 0 };
    const p = mapToLogical({ x: unit.pos.x + kbOffset.x, y: unit.pos.y + kbOffset.y });
```

同じ関数の末尾、以下の行を:

```ts
    drawHpBar(ctx, p, unit.hp / unit.maxHp, isAlly ? COLORS.hpAlly : COLORS.hpEnemy);
  }
}
```

次のように置き換える:

```ts
    const displayedHp = effects.displayedHp.get(unit.uid) ?? unit.hp;
    drawHpBar(ctx, p, displayedHp / unit.maxHp, isAlly ? COLORS.hpAlly : COLORS.hpEnemy);
  }
}
```

`drawBattle` 内の `drawUnits` 呼び出しを以下に置き換える:

```ts
  drawUnits(ctx, reg, state, selected);
```

```ts
  drawUnits(ctx, reg, state, selected, effects);
```

- [ ] **Step 11: `main.ts` で `syncDisplayedHp` を呼ぶ**

`src/main.ts` の `import` を以下に変更する:

```ts
import { makeEffectState, spawnEffects, tickEffects } from './render/effects';
```

```ts
import { makeEffectState, spawnEffects, syncDisplayedHp, tickEffects } from './render/effects';
```

`update` 関数を以下に置き換える:

```ts
function update(dt: number): void {
  tickEffects(effects, dt);
  if (phase !== 'battle' || !battle) return;
  if (isBlocking(bubbles)) return; // 吹き出し中は時間が止まる
```

```ts
function update(dt: number): void {
  tickEffects(effects, dt);
  if (phase !== 'battle' || !battle) return;
  syncDisplayedHp(effects, battle.units, dt);
  if (isBlocking(bubbles)) return; // 吹き出し中は時間が止まる
```

- [ ] **Step 12: 型チェックとテスト、動作確認**

Run: `npm run build && npm test`
Expected: PASS

Run: `npm run dev`

以下を確認する:
- 敵を倒すと、消える瞬間に白いリングが広がる
- 被弾したユニットが一瞬押し出されるように見える
- なかよし支援が発動した瞬間、支援を受けたユニットにピンク色の輪が一瞬出る
- ダメージを受けるとHPバーがスッと滑らかに減る（瞬時には切り替わらない）

- [ ] **Step 13: コミット**

```bash
git add src/render/effects.ts src/render/effects.test.ts src/render/draw.ts src/main.ts
git commit -m "feat: 撃破エフェクト・被弾ノックバック・絆強調・HPバーアニメーションを足す"
```

---

## 全タスク完了後の最終確認

- [ ] `npm run build` が通る
- [ ] `npm test` が全てPASSする
- [ ] `npm run dev` で1ステージを最初から最後までプレイし、すべてのスキル（ふんばる/ねらいうち/おまじない/かけぬける）を一度は発動して見た目を確認する
