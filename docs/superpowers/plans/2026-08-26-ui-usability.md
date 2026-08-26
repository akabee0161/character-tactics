# 戦闘 UI ユーザビリティ改善 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 配置・戦闘中の「誰を選んでいるか」「誰がどこへ向かうか」を常に見える状態にし、選んだ移動先へまっすぐ進んでその点で止まるようにする。

**Architecture:** 味方の目的地を `AllyUnit.goalPos` として状態に持たせ、これを描画と移動判定の共通の土台にする。経路はフローフィールドを 8 近傍ダイクストラへ変え、ゴールまで視線が通っている間はフィールドを無視して直行する。入力はジェスチャ判定を純関数 `src/ui/input.ts` に切り出し、移動命令の発行を `pointerup` に一本化する。

**Tech Stack:** TypeScript / Vite / Canvas2D / Vitest

**Spec:** `docs/superpowers/specs/2026-08-26-ui-usability-design.md`

## Global Constraints

- ゲーム内に表示する日本語のセリフ・ラベルは**全文ひらがな・カタカナ**。漢字を使わない（README・コメント・設計書は除く）
- `src/core/**` と `src/content/**` は `window` / `document` / `HTMLCanvasElement` / `localStorage` を参照しない
- 論理解像度は 960×540 固定。すべての座標はこの論理座標系で扱う。マップ座標は論理座標から `MAP_ORIGIN`（`{ x: 0, y: 46 }`）を引いたもの
- ボタンの当たり判定は論理座標で最小 64×64
- ゲームルール（戦闘計算・交戦条件・スキル効果・ステージデータ）は変更しない
- コミットは Conventional Commits 形式（`feat:` / `fix:` / `test:` / `chore:` / `docs:`）
- テストは `npm test`（Vitest）、型チェックとビルドは `npm run build`

## 進め方

フェーズ 1（Task 1〜4）は入力と可視化で、経路探索には触れない。ここまでで単独で意味のある改善になる。フェーズ 2（Task 5〜6）が経路の変更で、`FlowField` の意味が変わるため既存テストの更新を伴う。**フェーズ 1 を先に完了・コミットしてからフェーズ 2 に進むこと。**

---

## フェーズ 1: 入力と可視化

### Task 1: 目的地 `goalPos` を味方の状態に持たせる

移動命令を受けたときのタップ座標そのものを状態に残す。今はフローフィールドしか持っていないため、目的地の描画も正確な到達判定もできない。

**Files:**
- Modify: `src/core/types.ts:43`（`AllyUnit` に 1 フィールド追加）
- Modify: `src/core/state.ts:48,92,107`
- Modify: `src/core/sim.ts:42,289`
- Modify: `src/core/skills.ts:76`
- Test: `src/core/sim.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `AllyUnit.goalPos: Vec2 | null` — 移動命令で指定されたマップ座標。移動していないときは `null`

- [ ] **Step 1: 失敗するテストを書く**

`src/core/sim.test.ts` の末尾に追加する。

```ts
describe('goalPos: 目的地の保持', () => {
  it('move コマンドで目的地が入る', () => {
    const s = fresh();
    step(s, [{ type: 'move', allyId: 'roran', dest: { x: 200, y: 48 } }], 0.1);
    expect(ally(s, 'roran').goalPos).toEqual({ x: 200, y: 48 });
  });

  it('歩けない場所への move では目的地が入らない', () => {
    const stage: StageDef = { ...STAGE, mapRows: ['..........', '..####....', '..........'] };
    const s = fresh(stage);
    step(s, [{ type: 'move', allyId: 'roran', dest: { x: 80, y: 48 } }], 0.1);
    expect(ally(s, 'roran').goalPos).toBeNull();
  });

  it('たいきゃくすると目的地が消える', () => {
    const s = fresh();
    const a = ally(s, 'roran');
    step(s, [{ type: 'move', allyId: 'roran', dest: { x: 200, y: 48 } }], 0.1);
    a.hp = 0;
    step(s, [], 0.1);
    expect(a.goalPos).toBeNull();
  });
});
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/core/sim.test.ts -t goalPos`
Expected: FAIL（`goalPos` が `AllyUnit` に存在しないので型エラー、または `undefined`）

- [ ] **Step 3: 型に追加する**

`src/core/types.ts` の `AllyUnit` の `goalField` の直後に入れる。

```ts
  /** 移動先へのフローフィールド。null なら移動しない */
  goalField: FlowField | null;
  /** 移動先として指定されたマップ座標。null なら移動しない */
  goalPos: Vec2 | null;
```

- [ ] **Step 4: 生成とクリアの箇所を埋める**

`src/core/state.ts` の `makeAlly`（`goalField: null,` の直後）:

```ts
    goalField: null,
    goalPos: null,
```

`src/core/state.ts` の `placeAlly`（`ally.goalField = null;` の直後）:

```ts
  ally.goalField = null;
  ally.goalPos = null;
```

`src/core/state.ts` の `startWave`（`ally.goalField = null;` の直後）:

```ts
    ally.goalField = null;
    ally.goalPos = null;
```

`src/core/sim.ts` の `applyCommands`:

```ts
    if (cmd.type === 'move') {
      if (!isWalkableAt(state.grid, cmd.dest)) continue;
      ally.goalField = computeFlowField(state.grid, cmd.dest);
      ally.goalPos = { ...cmd.dest };
      ally.engagedWith = null;
      movedThisTick.add(ally.id);
    } else {
```

`src/core/sim.ts` の `resolveAllyRetirement`（`ally.goalField = null;` の直後）:

```ts
    ally.goalField = null;
    ally.goalPos = null;
```

`src/core/sim.ts` の `moveUnits` で、フローフィールドが尽きて `goalField` を捨てている箇所も揃える:

```ts
    const dir = flowDirection(state.grid, ally.goalField, ally.pos);
    if (!dir) {
      ally.goalField = null;
      ally.goalPos = null;
      continue;
    }
```

`src/core/skills.ts` の「かけぬける」（`ally.goalField = null;` の直後）:

```ts
      ally.goalField = null;
      ally.goalPos = null;
```

- [ ] **Step 5: テストを走らせて通ることを確かめる**

Run: `npm test`
Expected: PASS（既存テストも含めて全部通ること）

- [ ] **Step 6: コミット**

```bash
git add src/core/types.ts src/core/state.ts src/core/sim.ts src/core/skills.ts src/core/sim.test.ts
git commit -m "feat: 味方の移動先座標を goalPos として状態に持たせる"
```

---

### Task 2: 入力ジェスチャの判定を純関数に切り出す

移動命令の発行経路が `pointerdown` と `pointerup` の 2 つあり、選択解除の手段がない。判定を DOM に依存しない純関数にして、テストできる形にする。

**Files:**
- Create: `src/ui/input.ts`
- Test: `src/ui/input.test.ts`
- Modify: `src/ui/hit.ts:12`（`pickAlly` の既定半径 24 → 32）
- Modify: `src/ui/hit.test.ts`

**Interfaces:**
- Consumes: `distance` (`src/core/field.ts`)、`CharId` / `Vec2` (`src/core/types.ts`)
- Produces:
  - `TAP_SLOP: number`（= 12、論理座標のピクセル）
  - `PointerStart = { charId: CharId | null; startMap: Vec2; wasSelected: boolean }`
  - `MapGesture = { type: 'none' } | { type: 'select'; charId: CharId } | { type: 'deselect' } | { type: 'moveChar'; charId: CharId; dest: Vec2 }`
  - `resolveMapGesture(start: PointerStart, endMap: Vec2, selected: CharId | null): MapGesture`

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/input.test.ts` を新規作成する。

```ts
import { describe, expect, it } from 'vitest';
import { TAP_SLOP, resolveMapGesture } from './input';
import type { PointerStart } from './input';

const at = (x: number, y: number) => ({ x, y });

function start(charId: PointerStart['charId'], wasSelected = false): PointerStart {
  return { charId, startMap: at(100, 100), wasSelected };
}

describe('resolveMapGesture', () => {
  it('キャラを短くタップしたら選択する', () => {
    expect(resolveMapGesture(start('roran'), at(103, 101), null))
      .toEqual({ type: 'select', charId: 'roran' });
  });

  it('選択中のキャラを短くタップしたら選択を外す', () => {
    expect(resolveMapGesture(start('roran', true), at(103, 101), 'roran'))
      .toEqual({ type: 'deselect' });
  });

  it('キャラを掴んで動かしたら、そのキャラへの移動になる', () => {
    expect(resolveMapGesture(start('roran'), at(300, 100), null))
      .toEqual({ type: 'moveChar', charId: 'roran', dest: at(300, 100) });
  });

  it('地面を短くタップしたら、選択中のキャラへの移動になる', () => {
    expect(resolveMapGesture(start(null), at(103, 101), 'ines'))
      .toEqual({ type: 'moveChar', charId: 'ines', dest: at(103, 101) });
  });

  it('選択中のキャラがいなければ、地面のタップは何もしない', () => {
    expect(resolveMapGesture(start(null), at(103, 101), null)).toEqual({ type: 'none' });
  });

  it('地面を掴んで動かしても何も起きない（誤操作を移動にしない）', () => {
    expect(resolveMapGesture(start(null), at(300, 100), 'ines')).toEqual({ type: 'none' });
  });

  it('しきい値ちょうどはタップ扱い', () => {
    const end = at(100 + TAP_SLOP, 100);
    expect(resolveMapGesture(start(null), end, 'ines'))
      .toEqual({ type: 'moveChar', charId: 'ines', dest: end });
  });
});
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/ui/input.test.ts`
Expected: FAIL（`./input` が解決できない）

- [ ] **Step 3: `src/ui/input.ts` を実装する**

```ts
import { distance } from '../core/field';
import type { CharId, Vec2 } from '../core/types';

/** これ以下の移動量で離したらタップ扱いにする（論理座標のピクセル） */
export const TAP_SLOP = 12;

export type PointerStart = {
  /** ポインターを下ろした位置にいた味方。地面なら null */
  charId: CharId | null;
  startMap: Vec2;
  /** 下ろした時点で、その味方がすでに選択されていたか */
  wasSelected: boolean;
};

export type MapGesture =
  | { type: 'none' }
  | { type: 'select'; charId: CharId }
  | { type: 'deselect' }
  | { type: 'moveChar'; charId: CharId; dest: Vec2 };

/**
 * マップ上のポインター操作を、フェーズに依存しないジェスチャへ変換する。
 * moveChar をコマンドにするか再配置にするかは呼び出し側が決める。
 */
export function resolveMapGesture(
  start: PointerStart,
  endMap: Vec2,
  selected: CharId | null,
): MapGesture {
  const moved = distance(start.startMap, endMap) > TAP_SLOP;

  if (start.charId !== null) {
    if (moved) return { type: 'moveChar', charId: start.charId, dest: endMap };
    return start.wasSelected ? { type: 'deselect' } : { type: 'select', charId: start.charId };
  }

  if (moved || selected === null) return { type: 'none' };
  return { type: 'moveChar', charId: selected, dest: endMap };
}
```

- [ ] **Step 4: テストを走らせて通ることを確かめる**

Run: `npx vitest run src/ui/input.test.ts`
Expected: PASS

- [ ] **Step 5: `pickAlly` の判定半径を広げる**

`src/ui/hit.ts:12` の既定値を変える。ユニットの描画半径は 11 で、指で触るには 24 は小さい。

```ts
export function pickAlly(allies: AllyUnit[], mapPoint: Vec2, radius = 32): CharId | null {
```

`src/ui/hit.test.ts` に既定半径の回帰テストを足す。ファイル冒頭にある既存のヘルパー `unit(id, x, y, retired?)` をそのまま使い、`describe('pickAlly')` の中に追加する。既存の `pickAlly` のテストで半径 24 を前提にした期待値があれば、あわせて 32 基準に直すこと。

```ts
it('既定の判定半径は 32 まで拾う', () => {
  const list = [unit('roran', 100, 100)];
  expect(pickAlly(list, { x: 132, y: 100 })).toBe('roran');
  expect(pickAlly(list, { x: 133, y: 100 })).toBeNull();
});
```

- [ ] **Step 6: テストを走らせて通ることを確かめる**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/ui/input.ts src/ui/input.test.ts src/ui/hit.ts src/ui/hit.test.ts
git commit -m "feat: マップ操作のジェスチャ判定を純関数として切り出す"
```

---

### Task 3: `main.ts` の入力を pointerup へ一本化する

Task 2 の純関数を実際に配線する。あわせて配置フェーズでも `selected` が入るようにし、既存のハイライト描画を効かせる。

**Files:**
- Modify: `src/main.ts:36-46,88-205`
- Modify: `src/core/state.ts:87-93`（`placeAlly` の戻り値）
- Modify: `src/core/state.test.ts`

**Interfaces:**
- Consumes: `resolveMapGesture` / `PointerStart` / `TAP_SLOP` (`src/ui/input.ts`)、`AllyUnit.goalPos`（Task 1）
- Produces: `placeAlly(state, id, pos): boolean` — 置けたら `true`、歩行不可で拒否したら `false`。`main.ts` のモジュール変数 `pointerStart: PointerStart | null` と `dragMap: Vec2 | null`（Task 4 の描画が読む）

- [ ] **Step 1: `placeAlly` の失敗するテストを書く**

`src/core/state.test.ts` の末尾に追加する。

```ts
describe('placeAlly の戻り値', () => {
  it('歩ける場所なら true を返して移動する', () => {
    const s = createBattleState(STAGE, LV1, 1);
    expect(placeAlly(s, 'roran', { x: 48, y: 48 })).toBe(true);
    expect(s.allies.find((a) => a.id === 'roran')!.pos).toEqual({ x: 48, y: 48 });
  });

  it('歩けない場所なら false を返して動かさない', () => {
    const stage = { ...STAGE, mapRows: ['..........', '..####....', '..........'] };
    const s = createBattleState(stage, LV1, 1);
    const before = { ...s.allies.find((a) => a.id === 'roran')!.pos };
    expect(placeAlly(s, 'roran', { x: 80, y: 48 })).toBe(false);
    expect(s.allies.find((a) => a.id === 'roran')!.pos).toEqual(before);
  });
});
```

`STAGE` / `LV1` / `placeAlly` は `state.test.ts` の既存の定義・import に合わせること。未 import なら `import { createBattleState, placeAlly } from './state';` に足す。

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/core/state.test.ts -t placeAlly`
Expected: FAIL（戻り値が `undefined`）

- [ ] **Step 3: `placeAlly` を実装する**

`src/core/state.ts`:

```ts
export function placeAlly(state: BattleState, id: CharId, pos: Vec2): boolean {
  if (!isWalkableAt(state.grid, pos)) return false;
  const ally = state.allies.find((a) => a.id === id);
  if (!ally) return false;
  ally.pos = { ...pos };
  ally.goalField = null;
  ally.goalPos = null;
  return true;
}
```

- [ ] **Step 4: テストを走らせて通ることを確かめる**

Run: `npx vitest run src/core/state.test.ts`
Expected: PASS

- [ ] **Step 5: `main.ts` の状態変数を差し替える**

`src/main.ts:37`（`let dragging: CharId | null = null;`）と `:45-46`（`moveMarker` / `moveMarkerUntil`）を削除し、代わりに以下を置く。

```ts
let pointerStart: PointerStart | null = null;
/** ドラッグ中の指の位置（マップ座標）。プレビュー描画が読む */
let dragMap: Vec2 | null = null;
```

import を足す。`drawMoveMarker` の関数本体は Task 4 で削除するので、この Task では `main.ts` 側の import と呼び出しだけ外す。`tsconfig.json` に `noUnusedLocals` はないので、`draw.ts` に本体が残っていてもビルドは通る。**Step 5 から Step 8 までは一続きで行い、途中でコミットしないこと。**

```ts
import { resolveMapGesture } from './ui/input';
import type { PointerStart } from './ui/input';
```

`src/main.ts:70-73` の `setMoveMarker` と、`:82` の `moveMarker = null;`、`:236` の `if (moveMarker && ...)` を削除する。`beginStage` には `pointerStart = null; dragMap = null;` を足す。

- [ ] **Step 6: マップ操作を pointerup へ移す**

`onPointerDown` の `placement` / `battle` / `waveCleared` の各ケースを、ボタン判定だけ残して以下の形にする。**ボタンを消費したケースでは必ず `pointerStart = null;` を入れてから `return` すること。** これを忘れると、ボタンを押した指が離れたときに地面タップとして移動命令になる。

```ts
    case 'placement': {
      if (!battle) return;
      if (hitRect(BTN.start, p)) {
        pointerStart = null;
        writeSave(window.localStorage, save); // ステージ開始時点を保存する
        startWave(battle);
        enqueue(bubbles, pickWaveIntro(battle.stage, battle.waveIndex));
        phase = 'battle';
        return;
      }
      beginMapPointer(battle, p, ev);
      return;
    }

    case 'battle': {
      if (!battle) return;
      if (pendingSkill) {
        pointerStart = null;
        commands.push({ type: 'skill', allyId: pendingSkill, dest: logicalToMap(p) });
        pendingSkill = null;
        return;
      }
      if (selected) {
        const ally = battle.allies.find((a) => a.id === selected)!;
        const canTap = !ally.retired && !ally.skillUsed;
        if (canTap && hitRect(skillButtonAt(mapToLogical(ally.pos)), p)) {
          pointerStart = null;
          if (ally.skill === 'kakenukeru') pendingSkill = selected;
          else commands.push({ type: 'skill', allyId: selected });
          return;
        }
      }
      beginMapPointer(battle, p, ev);
      return;
    }

    case 'waveCleared': {
      if (!battle) return;
      if (hitRect(BTN.next, p)) {
        pointerStart = null;
        battle.waveIndex += 1;
        effects.items.length = 0;
        startWave(battle);
        enqueue(bubbles, pickWaveIntro(battle.stage, battle.waveIndex));
        phase = 'battle';
        return;
      }
      // しゅうげきの あいだは 再配置できる
      beginMapPointer(battle, p, ev);
      return;
    }
```

ポートレートのタップ選択は 3 フェーズ共通なので、`beginMapPointer` の中で先に処理する。

```ts
function beginMapPointer(state: BattleState, p: Vec2, ev: PointerEvent): void {
  for (let i = 0; i < 4; i++) {
    if (hitRect(portraitSlot(i), p)) {
      const id = state.allies[i]!.id;
      selected = selected === id ? null : id;
      pointerStart = null;
      return;
    }
  }
  const startMap = logicalToMap(p);
  const charId = pickAlly(state.allies, startMap);
  pointerStart = { charId, startMap, wasSelected: charId !== null && selected === charId };
  dragMap = startMap;
  if (charId !== null) {
    selected = charId; // 掴んだ時点で見た目に反映する。解除は pointerup で判定する
    canvas.setPointerCapture(ev.pointerId);
  }
}
```

`startDrag`（`src/main.ts:65-68`）は不要になるので削除する。

- [ ] **Step 7: pointermove と pointerup を実装する**

`onPointerUp` を丸ごと差し替え、`onPointerMove` を新設する。

```ts
function onPointerMove(ev: PointerEvent): void {
  if (!pointerStart) return;
  dragMap = logicalToMap(toLogical(ev));
}

function onPointerUp(ev: PointerEvent): void {
  const start = pointerStart;
  pointerStart = null;
  dragMap = null;
  if (!battle || !start) return;
  if (phase !== 'placement' && phase !== 'battle' && phase !== 'waveCleared') return;

  const endMap = logicalToMap(toLogical(ev));
  const g = resolveMapGesture(start, endMap, selected);
  switch (g.type) {
    case 'select':
      selected = g.charId;
      return;
    case 'deselect':
      selected = null;
      return;
    case 'moveChar':
      if (phase === 'battle') commands.push({ type: 'move', allyId: g.charId, dest: g.dest });
      else placeAlly(battle, g.charId, g.dest);
      return;
    case 'none':
      return;
  }
}

function onPointerCancel(): void {
  pointerStart = null;
  dragMap = null;
}
```

リスナー登録に `pointermove` を足す。

```ts
canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerup', onPointerUp);
canvas.addEventListener('pointercancel', onPointerCancel);
```

`render()` の `battle` ケースから `if (moveMarker) drawMoveMarker(ctx, moveMarker);` を削除し、`drawMoveMarker` の import も外す。

- [ ] **Step 8: 型チェックとテストを走らせる**

Run: `npm run build && npm test`
Expected: 両方成功。`drawMoveMarker` が未使用で残っていれば `src/render/draw.ts` からは消さずに置いたままでよい（Task 4 で削除する）が、`main.ts` からの import は必ず外すこと

- [ ] **Step 9: 手で動かして確かめる**

Run: `npm run dev` してブラウザで開き、以下を確認する。

1. 配置フェーズでキャラをタップすると、白い破線の輪と下部ポートレートの反転が出る
2. 同じキャラをもう一度タップすると選択が外れる
3. ポートレートをタップしても選択できる
4. 選択したまま地面をタップすると、そこへ配置される
5. 戦闘中、ボタン（スキルボタン・「つぎへ」）を押しても移動命令が飛ばない

- [ ] **Step 10: コミット**

```bash
git add src/main.ts src/core/state.ts src/core/state.test.ts
git commit -m "feat: マップ操作を pointerup に一本化し、配置中も選択を表示する"
```

---

### Task 4: 目的地とドラッグを常時可視化する

`goalPos` を読んで 4 人ぶんの目的地を描き、ドラッグ中は離す前に結果が見えるようにする。

**Files:**
- Modify: `src/render/draw.ts:26-44,186-199`
- Modify: `src/main.ts`（`render()` の描画呼び出し）

**Interfaces:**
- Consumes: `AllyUnit.goalPos`（Task 1）、`dragMap` / `pointerStart`（Task 3）
- Produces:
  - `drawGoalMarkers(ctx, state, selected)` — `drawBattle` の内部から呼ぶ
  - `drawDragPreview(ctx, fromMap, toMap, charId, blocked)` — `main.ts` から呼ぶ
  - `drawMoveMarker` は削除する

- [ ] **Step 1: `drawGoalMarkers` を実装する**

`src/render/draw.ts` の `drawMoveMarker`（`:186-199`）を丸ごと以下で置き換える。

```ts
/** 4人ぶんの移動先を常に出す。誰がどこへ向かっているかを盤面だけで読めるようにする */
export function drawGoalMarkers(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  selected: CharId | null,
): void {
  for (const ally of state.allies) {
    if (ally.retired || !ally.goalPos) continue;
    const a = mapToLogical(ally.pos);
    const g = mapToLogical(ally.goalPos);
    const color = CHARACTERS[ally.id].color;
    const isSelected = ally.id === selected;

    // 交戦中は足が止まっているので薄くする。交戦が解けたら再開するため消しはしない
    ctx.globalAlpha = ally.engagedWith !== null ? 0.35 : 1;
    ctx.strokeStyle = color;

    if (isSelected) {
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(g.x, g.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.beginPath();
    ctx.arc(g.x, g.y, isSelected ? 11 : 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/** ドラッグ中に、離したらどうなるかを先に見せる */
export function drawDragPreview(
  ctx: CanvasRenderingContext2D,
  fromMap: Vec2,
  toMap: Vec2,
  charId: CharId,
  blocked: boolean,
): void {
  const a = mapToLogical(fromMap);
  const b = mapToLogical(toMap);
  const color = blocked ? COLORS.hpEnemy : CHARACTERS[charId].color;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalAlpha = 0.5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(b.x, b.y, UNIT_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
```

- [ ] **Step 2: `drawBattle` から呼ぶ**

マーカーはユニットより下に描く。`src/render/draw.ts:36-40` の並びを変える。

```ts
  drawTerrain(ctx, state);
  drawFort(ctx, state);
  drawGoalMarkers(ctx, state, selected);
  drawBonds(ctx, state);
  drawEnemies(ctx, state);
  drawAllies(ctx, state, selected);
```

- [ ] **Step 3: `main.ts` からドラッグプレビューを呼ぶ**

`render()` に、`drawBattle` を呼ぶ 3 フェーズ（`placement` / `battle` / `waveCleared`）共通の後処理として入れる。`switch` の直後、吹き出し描画の前に置く。

`pointerStart` はモジュール変数なので、コールバック内では型が絞られない。ローカルに取り出してから使う。

```ts
  const dragChar = pointerStart?.charId ?? null;
  if (battle && dragChar !== null && dragMap !== null) {
    const ally = battle.allies.find((a) => a.id === dragChar)!;
    const blocked = !isWalkableAt(battle.grid, dragMap);
    drawDragPreview(ctx, ally.pos, dragMap, dragChar, blocked);
  }
```

import を足す。

```ts
import { drawBattle, drawDragPreview } from './render/draw';
import { isWalkableAt } from './core/field';
```

`drawMoveMarker` の import は Task 3 で外してある。

- [ ] **Step 4: 型チェックとテストを走らせる**

Run: `npm run build && npm test`
Expected: 両方成功

- [ ] **Step 5: 手で動かして確かめる**

Run: `npm run dev`

1. 戦闘中に 2 人以上へ別々の移動先を指示し、両方のマーカーが出たままになる
2. 選択中のキャラだけ現在地からの線が引かれる
3. 目的地に着いたらマーカーが消える
4. 交戦が始まるとマーカーが薄くなる
5. 配置フェーズで岩の上へドラッグすると、ゴーストが赤くなる

- [ ] **Step 6: コミット**

```bash
git add src/render/draw.ts src/main.ts
git commit -m "feat: 4人ぶんの移動先とドラッグ中のプレビューを常時表示する"
```

---

## フェーズ 2: 経路（A+B）

ここから `FlowField.dist` の意味が「セル数」から「スケール整数コスト（直交 10 / 斜め 14）」へ変わる。値を直接検査している既存テストの更新が必要になる。

### Task 5: フローフィールドを 8 近傍ダイクストラにする

4 近傍 BFS のままでは斜め移動が構造的に存在せず、必ず階段状の経路になる。

**Files:**
- Modify: `src/core/field.ts:37-100`
- Modify: `src/core/field.test.ts:64-115`
- Modify: `src/core/state.test.ts:65-66`

**Interfaces:**
- Consumes: なし
- Produces:
  - `ORTHO_COST = 10` / `DIAG_COST = 14`（export する）
  - `computeFlowField(grid, goal): FlowField` — シグネチャ据え置き、`dist` の単位のみ変更
  - `flowDirection(grid, field, pos): Vec2 | null` — シグネチャ据え置き、斜めの隣接セルも候補にする

- [ ] **Step 1: 失敗するテストを書く**

`src/core/field.test.ts` の `describe('computeFlowField')` と `describe('flowDirection')` を以下で置き換える。`MAP` はファイル冒頭の既存の定義（`['.....', '.###.', '.....']`）をそのまま使う。

```ts
describe('computeFlowField', () => {
  it('ゴールからのコストを 8 近傍で埋める', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 }); // セル 0
    expect(f.dist[0]).toBe(0);
    expect(f.dist[1]).toBe(ORTHO_COST);
    expect(f.dist[5]).toBe(ORTHO_COST);
  });

  it('壁は -1 のまま', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(f.dist[1 * 5 + 1]).toBe(-1);
  });

  it('開けたマップでは斜めが直交2回より安い', () => {
    const g = makeGrid(32, ['.....', '.....', '.....']);
    const f = computeFlowField(g, { x: 16, y: 16 }); // 左上
    expect(f.dist[1 * 5 + 1]).toBe(DIAG_COST);
    expect(f.dist[1 * 5 + 1]).toBeLessThan(ORTHO_COST * 2);
  });

  it('壁の角はすり抜けない（コーナーカット禁止）', () => {
    // セル(1,1) が壁。(0,0) から (2,2) へ斜めに 2 回では行けない
    const g = makeGrid(32, ['...', '.#.', '...']);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(f.dist[2 * 3 + 2]).toBeGreaterThan(DIAG_COST * 2);
  });

  it('壁の内側をゴールにしたら全部 -1', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 48, y: 48 });
    expect(Array.from(f.dist).every((d) => d === -1)).toBe(true);
  });
});

describe('flowDirection', () => {
  it('コストが下がる隣へ向かう', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    const dir = flowDirection(g, f, { x: 144, y: 16 })!; // 右上から左へ
    expect(dir.x).toBeLessThan(0);
  });

  it('開けたマップでは斜めを返す', () => {
    const g = makeGrid(32, ['.....', '.....', '.....']);
    const f = computeFlowField(g, { x: 16, y: 16 }); // 左上
    const dir = flowDirection(g, f, { x: 80, y: 80 })!; // セル(2,2)
    expect(dir.x).toBeLessThan(0);
    expect(dir.y).toBeLessThan(0);
  });

  it('ゴールのセルにいたら null', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(flowDirection(g, f, { x: 16, y: 16 })).toBeNull();
  });

  it('到達できないセルからは null', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(flowDirection(g, f, { x: 48, y: 48 })).toBeNull();
  });
});
```

ファイル冒頭の import に `DIAG_COST` と `ORTHO_COST` を足す。

```ts
import {
  DIAG_COST,
  ORTHO_COST,
  cellCenter,
  cellIndexAt,
  computeFlowField,
  distance,
  distanceToSegment,
  flowDirection,
  isWalkableAt,
  makeGrid,
} from './field';
```

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/core/field.test.ts`
Expected: FAIL（`ORTHO_COST` が export されていない）

- [ ] **Step 3: `src/core/field.ts` の近傍定義とダイクストラを実装する**

`:37-68` の `NEIGHBORS` と `computeFlowField` を置き換える。

```ts
/** セル距離を整数で持つためのスケール。斜めは √2 ≒ 1.4 倍 */
export const ORTHO_COST = 10;
export const DIAG_COST = 14;

const NEIGHBORS: readonly [number, number, number][] = [
  [1, 0, ORTHO_COST],
  [-1, 0, ORTHO_COST],
  [0, 1, ORTHO_COST],
  [0, -1, ORTHO_COST],
  [1, 1, DIAG_COST],
  [1, -1, DIAG_COST],
  [-1, 1, DIAG_COST],
  [-1, -1, DIAG_COST],
];

/** 斜めに進むには両隣のセルも歩けること。これがないと壁の角をすり抜ける */
function canStep(grid: Grid, cx: number, cy: number, dx: number, dy: number): boolean {
  const nx = cx + dx;
  const ny = cy + dy;
  if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) return false;
  if (grid.walkable[ny * grid.cols + nx] !== true) return false;
  if (dx !== 0 && dy !== 0) {
    if (grid.walkable[cy * grid.cols + nx] !== true) return false;
    if (grid.walkable[ny * grid.cols + cx] !== true) return false;
  }
  return true;
}

export function computeFlowField(grid: Grid, goal: Vec2): FlowField {
  const n = grid.cols * grid.rows;
  const dist = new Int32Array(n).fill(-1);
  const field: FlowField = { cols: grid.cols, rows: grid.rows, dist };
  const start = cellIndexAt(grid, goal);
  if (start < 0 || grid.walkable[start] !== true) return field;

  // グリッドは最大でも 30x14 なので、優先度キューは持たず素朴に最小値を線形探索する
  const settled = new Uint8Array(n);
  dist[start] = 0;
  for (;;) {
    let cur = -1;
    let curDist = Infinity;
    for (let i = 0; i < n; i++) {
      const d = dist[i]!;
      if (settled[i] === 1 || d < 0 || d >= curDist) continue;
      curDist = d;
      cur = i;
    }
    if (cur < 0) break;
    settled[cur] = 1;

    const cx = cur % grid.cols;
    const cy = Math.floor(cur / grid.cols);
    for (const [dx, dy, cost] of NEIGHBORS) {
      if (!canStep(grid, cx, cy, dx, dy)) continue;
      const ni = (cy + dy) * grid.cols + (cx + dx);
      if (settled[ni] === 1) continue;
      const nd = curDist + cost;
      if (dist[ni]! < 0 || nd < dist[ni]!) dist[ni] = nd;
    }
  }
  return field;
}
```

- [ ] **Step 4: `flowDirection` を 8 近傍に対応させる**

`:70-100` のループ内の近傍走査を `canStep` 経由に変える。他の部分は据え置き。

```ts
  const cx = cur % grid.cols;
  const cy = Math.floor(cur / grid.cols);
  let best = -1;
  let bestDist = curDist;
  for (const [dx, dy] of NEIGHBORS) {
    if (!canStep(grid, cx, cy, dx, dy)) continue;
    const ni = (cy + dy) * grid.cols + (cx + dx);
    const d = field.dist[ni];
    if (d === undefined || d < 0) continue;
    if (d < bestDist) {
      bestDist = d;
      best = ni;
    }
  }
  if (best < 0) return null;
```

- [ ] **Step 5: `state.test.ts` の期待値を直す**

`src/core/state.test.ts:65-66`（`it('砦へのフローフィールドが計算されている')`）は `enemyField.dist` をセル数で検査している。コストへ読み替える。テスト用ステージのマップは `['.....', '.....', '.....']`、砦は `{ x: 16, y: 16 }` = セル 0 なので、セル 4 へは同じ行を真横に 4 歩で届く。斜めの近道はない。

```ts
    expect(s.enemyField.dist[0]).toBe(0);
    expect(s.enemyField.dist[4]).toBe(ORTHO_COST * 4);
```

`import { ORTHO_COST } from './field';` を足す。

- [ ] **Step 6: テスト一式を走らせる**

Run: `npm test`
Expected: PASS。`src/content/stages/stages.test.ts` は `> 0` の検査のみなので影響しないはず。落ちたらマップ側の到達性が壊れた合図なので、コーナーカット禁止が厳しすぎないか `canStep` を見直す

- [ ] **Step 7: 手で動かして確かめる**

Run: `npm run dev`

斜め方向へ移動を指示して、階段状ではなく斜めに進むことを確認する。敵も `enemyField` を共有しているので、上陸地点から砦への動きが自然になっているはず。

- [ ] **Step 8: コミット**

```bash
git add src/core/field.ts src/core/field.test.ts src/core/state.test.ts
git commit -m "feat: フローフィールドを8近傍ダイクストラにして斜め移動を可能にする"
```

---

### Task 6: 直線ショートカットと正確な到達

8 近傍でも経路は 8 方向に量子化される。障害物がなければフローフィールドを無視して目的地へ直行させ、指定した点そのもので止める。

**Files:**
- Modify: `src/core/field.ts`（`hasLineOfSight` を追加）
- Modify: `src/core/sim.ts:155-173`
- Test: `src/core/field.test.ts`、`src/core/sim.test.ts`

**Interfaces:**
- Consumes: `isWalkableAt` / `distance` (`src/core/field.ts`)、`AllyUnit.goalPos`（Task 1）
- Produces: `hasLineOfSight(grid: Grid, from: Vec2, to: Vec2): boolean`

- [ ] **Step 1: 失敗するテストを書く**

`src/core/field.test.ts` の末尾に追加する。

```ts
describe('hasLineOfSight', () => {
  it('開けたマップでは通る', () => {
    const g = makeGrid(32, ['.....', '.....', '.....']);
    expect(hasLineOfSight(g, { x: 16, y: 16 }, { x: 144, y: 80 })).toBe(true);
  });

  it('壁をまたぐと通らない', () => {
    const g = makeGrid(32, MAP); // 中段の (1,1)-(3,1) が壁
    expect(hasLineOfSight(g, { x: 48, y: 16 }, { x: 48, y: 80 })).toBe(false);
  });

  it('同じ点なら、その場所が歩けるかどうかを返す', () => {
    const g = makeGrid(32, MAP);
    expect(hasLineOfSight(g, { x: 16, y: 16 }, { x: 16, y: 16 })).toBe(true);
    expect(hasLineOfSight(g, { x: 48, y: 48 }, { x: 48, y: 48 })).toBe(false);
  });
});
```

`src/core/sim.test.ts` の末尾に追加する。

```ts
describe('移動: 直線ショートカットと到達', () => {
  it('障害物がなければ目的地へまっすぐ進む', () => {
    const s = fresh();
    const a = ally(s, 'roran');
    a.pos = { x: 16, y: 16 };
    const dest = { x: 208, y: 80 };
    step(s, [{ type: 'move', allyId: 'roran', dest }], 0.1);
    // 出発点と目的地を結ぶ直線上に乗っていること
    const t = (a.pos.x - 16) / (dest.x - 16);
    expect(a.pos.y).toBeCloseTo(16 + t * (dest.y - 16), 4);
  });

  it('目的地に着いたら、その座標ちょうどで止まって goalPos が消える', () => {
    const s = fresh();
    const a = ally(s, 'roran');
    a.pos = { x: 16, y: 16 };
    const dest = { x: 48, y: 16 };
    step(s, [{ type: 'move', allyId: 'roran', dest }], 0.1);
    for (let i = 0; i < 200 && a.goalPos; i++) step(s, [], 0.1);
    expect(a.goalPos).toBeNull();
    expect(a.pos).toEqual(dest);
  });
});
```

`fresh()` は全員を `{ x: 16, y: 80 }` へどけるので、テスト内で `pos` を上書きしてから使うこと。

- [ ] **Step 2: テストを走らせて落ちることを確かめる**

Run: `npx vitest run src/core/field.test.ts src/core/sim.test.ts`
Expected: FAIL（`hasLineOfSight` が未定義、移動が階段状で直線に乗らない）

- [ ] **Step 3: `hasLineOfSight` を実装する**

`src/core/field.ts` の `distance` の下に追加する。

```ts
/**
 * 2点を結ぶ線分がすべて歩けるセルの上を通るか。
 * セルの 1/4 ごとにサンプリングする。壁の角を一瞬かすめる程度は拾えないが、
 * 通れなかった場合はフローフィールドに戻るだけなので実害はない。
 */
export function hasLineOfSight(grid: Grid, from: Vec2, to: Vec2): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return isWalkableAt(grid, from);

  const steps = Math.ceil(len / (grid.cell / 4));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!isWalkableAt(grid, { x: from.x + dx * t, y: from.y + dy * t })) return false;
  }
  return true;
}
```

- [ ] **Step 4: `moveUnits` を書き換える**

`src/core/sim.ts:155-173` の味方ループを、`goalPos` 起点の処理に差し替える。敵のループはそのまま残す。

```ts
function moveAlly(state: BattleState, ally: AllyUnit, dt: number): void {
  const goal = ally.goalPos;
  if (!goal) return;

  const remaining = distance(ally.pos, goal);
  const stepLen = ally.speed * dt;
  if (remaining <= stepLen) {
    ally.pos = { ...goal };
    ally.goalPos = null;
    ally.goalField = null;
    return;
  }

  // 目的地まで見通せるならフローフィールドを使わず直行する
  const dir = hasLineOfSight(state.grid, ally.pos, goal)
    ? { x: (goal.x - ally.pos.x) / remaining, y: (goal.y - ally.pos.y) / remaining }
    : ally.goalField && flowDirection(state.grid, ally.goalField, ally.pos);

  if (!dir) {
    ally.goalPos = null;
    ally.goalField = null;
    return;
  }
  ally.pos = { x: ally.pos.x + dir.x * stepLen, y: ally.pos.y + dir.y * stepLen };
}

function moveUnits(state: BattleState, dt: number): void {
  for (const ally of state.allies) {
    if (ally.retired || ally.engagedWith !== null) continue;
    moveAlly(state, ally, dt);
  }

  for (const enemy of state.enemies) {
    if (enemy.engagedWith !== null) continue;
    const dir = flowDirection(state.grid, state.enemyField, enemy.pos);
    if (!dir) continue;
    const speed = ENEMIES[enemy.kind].speed;
    enemy.pos = { x: enemy.pos.x + dir.x * speed * dt, y: enemy.pos.y + dir.y * speed * dt };
  }
}
```

`src/core/sim.ts` の import に `hasLineOfSight` を足す。

```ts
import { computeFlowField, distance, flowDirection, hasLineOfSight, isWalkableAt } from './field';
```

`AllyUnit` 型がまだ import されていなければ足す（`import type { AllyUnit, ... } from './types';` にはすでにある）。

- [ ] **Step 5: テスト一式を走らせる**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: 型チェックとビルド**

Run: `npm run build`
Expected: 成功

- [ ] **Step 7: 手で動かして確かめる**

Run: `npm run dev`

1. 開けた場所へ移動を指示すると、階段状にならず完全な直線で進む
2. タップした点ちょうどで止まり、マーカーが同時に消える
3. 岩を挟んだ向こう側へ指示すると、回り込んでいる間はフローフィールドの経路をたどり、岩を抜けた瞬間に直線へ切り替わる
4. 移動中に敵と交戦すると足が止まり、敵を倒すと残りの経路を再開する

- [ ] **Step 8: コミット**

```bash
git add src/core/field.ts src/core/sim.ts src/core/field.test.ts src/core/sim.test.ts
git commit -m "feat: 見通せる場所へは直進し、指定した座標ちょうどで止まるようにする"
```

---

### Task 7: 操作説明を README に反映する

操作方法が変わったので、正典である README を更新する。

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 「そうさ」セクションを追加する**

`## 開発` の直前に入れる。

```markdown
## そうさ

| 操作 | 結果 |
|---|---|
| なかまをタップ | 選択する。もう一度タップで選択を外す |
| 下のポートレートをタップ | 同じく選択・解除 |
| なかまをドラッグして離す | 配置中は再配置、戦闘中はその地点へ移動 |
| 選択中に地面をタップ | 配置中は再配置、戦闘中はその地点へ移動 |

移動先は 4 人ぶんが常に表示される。選択中のなかまだけ、現在地から目的地への線が引かれる。交戦中は足が止まるためマーカーが薄くなり、交戦が解けたら残りの経路を再開する。
```

- [ ] **Step 2: コミット**

```bash
git add README.md
git commit -m "docs: 変更後の操作方法を README に反映する"
```

---

## 完了条件

- `npm test` が全部通る
- `npm run build` が通る
- `npm run dev` で、Task 3 / 4 / 5 / 6 の手動確認項目がすべて満たされる
- 攻撃モーションには手を付けていない（意図的にスコープ外）

## 引き継ぎメモ

- 途中で切れた場合、どこまで進んだかは `git log --oneline` で分かる。各タスクが 1 コミットに対応している
- フェーズ 1 だけ終わってフェーズ 2 が未着手でも、動作としては破綻しない（経路が階段状のままなだけ）
- 逆にフェーズ 2 だけ先にやるのは避けること。Task 6 は Task 1 の `goalPos` に依存している
