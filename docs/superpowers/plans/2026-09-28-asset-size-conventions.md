# アセットの大きさの規約 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 顔グラの枠を 64px / 32px の2通りに、役割アイコンの枠を 32px にそろえ、アセットの大きさの規約を README に書く。

**Architecture:** 枠の大きさはレイアウト（`src/ui/layout.ts`）の定数と矩形関数に寄せ、描画（`src/ui/screens.ts`）はそれを読むだけにする。顔を縮小して描くときだけぼかす判定は純関数（`src/render/sprites.ts`）にしてテストする。描画コードそのものにはユニットテストを書かず、ヘッドレスブラウザで撮って確かめる。

**Tech Stack:** TypeScript、Canvas2D、Vitest、Vite

**Spec:** `docs/superpowers/specs/2026-09-28-asset-size-conventions-design.md`

## Global Constraints

- コミットは Conventional Commits（`feat:` / `fix:` / `refactor:` / `test:` / `docs:` / `chore:`）＋日本語の要約
- 描画コード（Canvas2D）にはユニットテストを書かない。テストは純ロジックとレイアウト計算に寄せ、見た目は README の CDP 手順で確かめる（CLAUDE.md）
- 顔の枠は2通りだけ: 大きい枠 64px（会話・セリフ欄）、小さい枠 32px（仲間一覧・リザルト・下のバー）
- 役割アイコンの枠は 32px（16px の絵を2倍）
- 顔を縮小して描くときだけぼかす。等倍・拡大はぼかさない（ゲーム全体は `imageSmoothingEnabled = false`）。
  spec は「32px の枠だけぼかす」と書いているが、規約どおりの 64px の顔では「縮小するときだけ」と同じ結果になる。
  差し替え前の 128px の顔も、64px の枠で縮小になるのでぼかす
- 画像ファイル（`assets/images/*.png`）と仮アセット生成スクリプトは変えない（spec の「含めないもの」）
- 各タスクの終わりに `npm test` と `npm run build` が通ること

## Review Focus

- **セリフ欄の本文の幅が 8px 狭くなる** → 既存の戦闘中のセリフ（`assets/lines/*.json`）が3行目に落ちて切られないこと（Task 3 のテスト）
- **役割アイコンの画像が無いとき**（`role: null`）の文字のフォールバックが、広げた枠の中に収まり HP バーと重ならないこと（Task 2 のテスト。文字は `rect.y + 18` に描かれ、枠の中にある）
- **ぼかしの設定が他の描画に漏れない** → 顔を描いたあと `imageSmoothingEnabled` を元に戻し、マップのユニットやタイルがぼけないこと（Task 1 のコードと Task 4 の目視）
- **差し替え前の 128px の顔** → 64px の枠でも 32px の枠でもぼかして縮小されること（Task 1 のテスト）
- **顔の画像が読み込み前**（プレースホルダの丸）でも、丸が新しい枠の大きさで出て、名前や本文と重ならないこと（Task 4 の目視）

---

## ファイル構成

| ファイル | 変更 |
|---|---|
| `src/render/sprites.ts` | `smoothFor` を足し、`drawSquareOrCircle` で縮小のときだけぼかす |
| `src/render/sprites.test.ts` | `smoothFor` のテスト |
| `src/ui/layout.ts` | `FACE_PX`・`hpBarIn` を足し、`roleBadgeIn`・`MESSAGE_BAR`・`SPEECH_BODY_X` を変える |
| `src/ui/layout.test.ts` | 下のバーとセリフ欄のレイアウトのテスト |
| `src/ui/screens.ts` | 5か所の `drawFace` の半径と位置、下のバーの HP バー |
| `README.md` | 「コンテンツの足しかた」に規約を書き、ユニットの絵の項の大きさを直す |
| `assets/images/README.txt` | face と role の大きさを直す |
| `HANDOVER.md` | 実装の完了を書く |

---

### Task 1: 顔を縮小して描くときだけぼかす

**Files:**
- Modify: `src/render/sprites.ts:18-35`（`drawSquareOrCircle`）
- Test: `src/render/sprites.test.ts`

**Interfaces:**
- Produces: `export function smoothFor(srcPx: number, destPx: number): boolean`（`src/render/sprites.ts`）

- [ ] **Step 1: 失敗するテストを書く**

`src/render/sprites.test.ts` の import を直し、末尾に足す。

```ts
import { FOOT_INSET, bodyCenter, smoothFor } from './sprites';
```

```ts
describe('smoothFor', () => {
  it('64px の顔を 32px の枠に出すときはぼかす', () => {
    expect(smoothFor(64, 32)).toBe(true);
  });

  it('等倍ではぼかさない', () => {
    expect(smoothFor(64, 64)).toBe(false);
  });

  it('拡大ではぼかさない（16px の役割アイコンを 32px で出すなど）', () => {
    expect(smoothFor(16, 32)).toBe(false);
  });

  it('差し替え前の 128px の顔は、64px の枠でも 32px の枠でもぼかす', () => {
    expect(smoothFor(128, 64)).toBe(true);
    expect(smoothFor(128, 32)).toBe(true);
  });
});
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/render/sprites.test.ts`
Expected: FAIL（`smoothFor` が export されていない）

- [ ] **Step 3: 実装する**

`src/render/sprites.ts` の `drawSquareOrCircle` の直前に足す。

```ts
/**
 * 縮小して描くときだけぼかす。64px の顔を 32px の枠に出すと、最近傍では1画素おきに間引かれて
 * 1px の線が抜ける。ちょうど半分なら2×2画素の平均になり形が残る。等倍と拡大はドット絵のまま
 */
export function smoothFor(srcPx: number, destPx: number): boolean {
  return destPx < srcPx;
}
```

`drawSquareOrCircle` の最後の `ctx.drawImage(...)` の1行を次に置き換える。

```ts
  const size = radius * 2;
  const srcPx = 'naturalWidth' in img ? img.naturalWidth : size;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = smoothFor(srcPx, size);
  ctx.drawImage(img, c.x - radius, c.y - radius, size, size);
  // マップのドット絵までぼけないよう、必ず元に戻す
  ctx.imageSmoothingEnabled = prev;
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `npx vitest run src/render/sprites.test.ts`
Expected: PASS

Run: `npm test && npm run build`
Expected: すべて PASS、ビルド成功

- [ ] **Step 5: コミット**

```bash
git add src/render/sprites.ts src/render/sprites.test.ts
git commit -m "feat: 顔を縮小して描くときだけぼかす"
```

---

### Task 2: 下のバーの顔を 32px、役割アイコンを 32px にする

今の下のバー（`portraitSlot`、129×80）の縦の並び:

| 要素 | 今 | 変更後 |
|---|---|---|
| 顔 | 中心 (x+22, y+22)・直径26 → y+9〜y+35 | 中心 (x+22, y+24)・直径32 → y+8〜y+40、x+6〜x+38 |
| 名前 | x+42、ベースライン y+28 | x+42、ベースライン y+26 |
| 役割アイコン | y+32〜y+58（高さ26） | y+30〜y+62（高さ32） |
| HP バー | y+60〜y+67 | y+66〜y+73 |

アイコンを 32px にすると今の HP バー（y+60）と重なるので、HP バーを下げる。HP バーの位置は
`drawBottomBar` とテストのコメントに別々に書かれていたので、`hpBarIn` に1本化する。

**Files:**
- Modify: `src/ui/layout.ts:60-68`（`portraitSlot` の下、`roleBadgeIn`）
- Modify: `src/ui/screens.ts:180-215`（`drawBottomBar`）
- Test: `src/ui/layout.test.ts:66-80`

**Interfaces:**
- Produces（`src/ui/layout.ts`）:
  - `export const FACE_PX = { large: 64, small: 32 } as const;`
  - `export function hpBarIn(slot: Rect): Rect`
  - `roleBadgeIn(slot)` は `{ x: slot.x + 42, y: slot.y + 30, w: 84, h: 32 }` を返す

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/layout.test.ts` の import に `FACE_PX` と `hpBarIn` を足す。

```ts
import {
  BOTTOM_PANEL_Y, BTN, FACE_PX, MESSAGE_BAR, TALK_WINDOW,
  hpBarIn, portraitSlot, roleBadgeIn, rosterSlot, speechLines, stageSlot,
  STAGE_LIST_VIEW, stageListContentH,
} from './layout';
```

既存の「クラスの わくは HPバーと かさならない」を次に置き換え、その下に2つ足す。

```ts
  it('クラスの わくは HPバーと かさならない', () => {
    const slot = portraitSlot(0);
    expect(roleBadgeIn(slot).y + roleBadgeIn(slot).h).toBeLessThanOrEqual(hpBarIn(slot).y);
  });

  it('クラスの わくは 16px の絵を 2倍にした 32px', () => {
    expect(roleBadgeIn(portraitSlot(0)).h).toBe(32);
  });

  it('HPバーは ポートレートの なかに ある', () => {
    const slot = portraitSlot(0);
    const bar = hpBarIn(slot);
    expect(bar.x).toBeGreaterThanOrEqual(slot.x);
    expect(bar.x + bar.w).toBeLessThanOrEqual(slot.x + slot.w);
    expect(bar.y + bar.h).toBeLessThanOrEqual(slot.y + slot.h);
  });
```

ファイルの末尾に足す。

```ts
describe('FACE_PX', () => {
  it('顔の枠は 64px と、その半分の 32px の2通り', () => {
    expect(FACE_PX.large).toBe(64);
    expect(FACE_PX.small).toBe(FACE_PX.large / 2);
  });
});
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/ui/layout.test.ts`
Expected: FAIL（`FACE_PX` と `hpBarIn` が export されていない）

- [ ] **Step 3: レイアウトを実装する**

`src/ui/layout.ts` の `roleBadgeIn` を次に置き換え、`FACE_PX` と `hpBarIn` を足す。

```ts
/**
 * 顔の枠の直径。顔は 64px のドット絵で、大きい枠（会話・セリフ欄）は等倍、
 * 小さい枠（仲間一覧・リザルト・下のバー）は半分で描く（README「アセットの大きさの規約」）
 */
export const FACE_PX = { large: 64, small: 32 } as const;

/**
 * ポートレートの中でクラス（役割）を出す場所。
 * 画像・プレースホルダの文字・テストの3者が必ずこの1本を見る。
 * 別々に持つと、画像を入れたときだけ位置がずれる。
 * 高さは 16px のアイコンを2倍にした 32px
 */
export function roleBadgeIn(slot: Rect): Rect {
  return { x: slot.x + 42, y: slot.y + 30, w: 84, h: 32 };
}

/** ポートレートの HP バー。クラスの枠の下に置く */
export function hpBarIn(slot: Rect): Rect {
  return { x: slot.x + 8, y: slot.y + 66, w: 113, h: 7 };
}
```

- [ ] **Step 4: 描画を直す**

`src/ui/screens.ts` の import に `FACE_PX` と `hpBarIn` を足す（`./layout` からの import 文に並べる）。

`drawBottomBar` の中を次のように直す。

```ts
      drawFace(ctx, { x: r.x + 22, y: r.y + 24 }, FACE_PX.small / 2, def, images);

      ctx.fillStyle = INK;
      ctx.font = '18px sans-serif';
      ctx.fillText(def.name, r.x + 42, r.y + 26);
```

HP バーの4行を次に置き換える。

```ts
      const bar = hpBarIn(r);
      ctx.fillStyle = '#000';
      ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
      ctx.fillStyle = unit.retired ? '#666' : '#5ad06a';
      ctx.fillRect(bar.x, bar.y, bar.w * Math.max(0, unit.hp / unit.maxHp), bar.h);
```

- [ ] **Step 5: テストとビルドが通ることを確かめる**

Run: `npm test && npm run build`
Expected: すべて PASS、ビルド成功

- [ ] **Step 6: コミット**

```bash
git add src/ui/layout.ts src/ui/layout.test.ts src/ui/screens.ts
git commit -m "feat: 下のバーの顔と役割アイコンを 32px にそろえる"
```

---

### Task 3: セリフ欄・会話・リザルト・仲間一覧の顔の大きさをそろえる

| 画面 | 今（中心・直径） | 変更後 |
|---|---|---|
| セリフ欄 `drawSpeechBar` | (x+34, y+h/2)・48 | (x+36, y+h/2)・64。`MESSAGE_BAR.h` を 64→68、`SPEECH_BODY_X` を 68→76 |
| 会話 `drawTalk` | (x+54, y+60)・60 | (x+54, y+60)・64 → x+22〜x+86。本文は x+100 から（`TALK_BODY_X`）で重ならない |
| リザルト `drawResult` | (40, y-6)・28 | (40, y-6)・32 → 24〜56。名前は x=66 から |
| 仲間一覧 `drawRoster` | (x+28, y+32)・32 | 変えない（定数を使うだけ） |

セリフ欄は高さ 64 のままだと 64px の顔が枠線に重なるので、高さを 68 にする（y 788〜856。
下のバーのポートレートは y=858 から）。顔は x+4〜x+68、y+2〜y+66 に収まる。
本文は顔の右 8px の x+76 から。本文の幅が 8px 狭くなるので、既存のセリフが2行に収まるかをテストで確かめる。

**Files:**
- Modify: `src/ui/layout.ts:11`（`MESSAGE_BAR`）、`src/ui/layout.ts:75`（`SPEECH_BODY_X`）
- Modify: `src/ui/screens.ts`（`drawRoster`・`drawSpeechBar`・`drawTalk`・`drawResult` の `drawFace`）
- Test: `src/ui/layout.test.ts`

**Interfaces:**
- Consumes: `FACE_PX`（Task 2、`src/ui/layout.ts`）
- Produces: `MESSAGE_BAR` は `{ x: 8, y: 788, w: 524, h: 68 }`、`SPEECH_BODY_X` は `76`

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/layout.test.ts` の先頭の import に足す。

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
```

`./layout` からの import に `SPEECH_BODY_X` と `SPEECH_MAX_LINES` を足す。

`describe('MESSAGE_BAR', ...)` の中に足す。

```ts
  it('64px の顔が枠線（2px）の内側に収まる高さ', () => {
    expect(MESSAGE_BAR.h).toBeGreaterThanOrEqual(FACE_PX.large + 4);
  });

  it('本文は顔の右から始まる', () => {
    // drawSpeechBar は顔の中心を x+36 に置く
    expect(SPEECH_BODY_X).toBeGreaterThanOrEqual(36 + FACE_PX.large / 2 + 8);
  });
```

ファイルの末尾に足す。

```ts
describe('戦闘中のセリフ', () => {
  it('assets/lines のセリフは、どれもセリフ欄の行数に収まる', () => {
    const dir = 'assets/lines';
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      const lines = JSON.parse(readFileSync(join(dir, name), 'utf8')) as Record<string, string>;
      for (const [key, text] of Object.entries(lines)) {
        expect(speechLines(text).length, `${name} の ${key}`).toBeLessThanOrEqual(SPEECH_MAX_LINES);
      }
    }
  });
});
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/ui/layout.test.ts`
Expected: FAIL（`MESSAGE_BAR.h` が 64、`SPEECH_BODY_X` が 68）。「戦闘中のセリフ」は今の幅なので PASS でよい

- [ ] **Step 3: レイアウトを直す**

`src/ui/layout.ts`:

```ts
export const MESSAGE_BAR: Rect = { x: 8, y: 788, w: 524, h: 68 };
```

```ts
export const SPEECH_BODY_X = 76;
```

- [ ] **Step 4: 描画を直す**

`src/ui/screens.ts` の4か所を次にする。

`drawRoster`:
```ts
    drawFace(ctx, { x: r.x + 28, y: r.y + 32 }, FACE_PX.small / 2, def, images);
```

`drawSpeechBar`:
```ts
  drawFace(ctx, { x: r.x + 36, y: r.y + r.h / 2 }, FACE_PX.large / 2, def, images);
```

`drawTalk`:
```ts
    drawFace(ctx, { x: r.x + 54, y: r.y + 60 }, FACE_PX.large / 2, info, images);
```

`drawResult`:
```ts
    drawFace(ctx, { x: 40, y: y - 6 }, FACE_PX.small / 2, def, images);
```

- [ ] **Step 5: テストとビルドが通ることを確かめる**

Run: `npm test && npm run build`
Expected: すべて PASS、ビルド成功。「戦闘中のセリフ」が落ちたら、落ちたセリフのキーと行数を報告して止まる（セリフの文面を勝手に変えない）

- [ ] **Step 6: 顔の半径が定数だけになったことを確かめる**

Run: `grep -n "drawFace(" src/ui/screens.ts`
Expected: 5行すべてが `FACE_PX.small / 2` か `FACE_PX.large / 2` を渡している

- [ ] **Step 7: コミット**

```bash
git add src/ui/layout.ts src/ui/layout.test.ts src/ui/screens.ts
git commit -m "feat: セリフ欄・会話・リザルト・仲間一覧の顔を 64px と 32px にそろえる"
```

---

### Task 4: 規約を README に書き、画面を撮って確かめる

**Files:**
- Modify: `README.md`（「コンテンツの足しかた」）
- Modify: `assets/images/README.txt`
- Modify: `HANDOVER.md`

**Interfaces:**
- Consumes: Task 1〜3 の変更（画面の見た目）

- [ ] **Step 1: README に規約を書く**

`README.md` の「## コンテンツの足しかた」の直前に、次の節を足す。

```markdown
## アセットの大きさの規約

絵の1画素を論理座標（540×945）の1pxで描く（等倍）。等倍にしないのは表の「表示」に書いたものだけ。
画面全体は端末に合わせて整数でない倍率で拡大・縮小するので、規約で揃えるのは「絵の1画素＝論理座標の何px」まで。

| アセット | 絵の大きさ | 表示 | 占める範囲 |
|---|---|---|---|
| 1マス | ― | 32px | ― |
| 地面タイル | 16px | 等倍。1マスに2×2で敷く | 1マス |
| 物（村・岩・木・城など） | 16pxの部品を組んだセット。1マスぶんは2×2（32px） | 等倍 | 1マス以上の整数マス（城は2×2マス＝64pxなど） |
| ユニット | コマ32px（大型は48px） | 等倍 | 足元 y=30・左右中央・背丈24〜26px |
| 顔グラ | 64px | 会話・セリフ欄は64px（等倍）、仲間一覧・リザルト・下のバーは32px（半分） | ― |
| 役割アイコン | 16px | 32px（2倍） | ― |

- 物の絵は地面（草）を背景に含めて描く
- 顔を縮小して描くときだけぼかす（`smoothFor`、`src/render/sprites.ts`）。ほかはドット絵のまま
- 顔の枠の大きさは `FACE_PX`、役割アイコンの枠は `roleBadgeIn`（どちらも `src/ui/layout.ts`）

**まだ規約に追いついていないもの:** 物は今のところ16pxの1枚で、1マスに2×2で敷かれて4つ並んで見える
（32pxで描く対応は次の作業）。複数マスを占める物をマップに置く仕組みはまだ無い。
顔（128px）と役割アイコン（32px）の画像は規約より大きく、縮小して描いている。
絵は pixel-asset-forge で作り、PNG をここへコピーしている（アセットのテキストとビルドをこのリポジトリへ移す予定）。
```

- [ ] **Step 2: README のユニットの絵の項を直す**

「コンテンツの足しかた」の「**ユニットの絵**」の項の、次の部分を置き換える。

置き換え前:
```
`role` はクラスアイコン（64×64）、`face` は顔（128×128。下パネル・ステージ選択・会話・リザルト）
```

置き換え後:
```
`role` はクラスアイコン、`face` は顔（下パネル・ステージ選択・会話・リザルト）。大きさは「アセットの大きさの規約」
```

- [ ] **Step 3: assets/images/README.txt を直す**

置き換え前:
```
face は 128×128、role は 64×64 の正方形。
```

置き換え後:
```
face は 64×64、role は 16×16 の正方形（README.md「アセットの大きさの規約」）。
今ある face と role の PNG は規約より大きく、縮小して描いている。
```

- [ ] **Step 4: 画面を撮って確かめる**

README の「描画と入力をブラウザで確認する」の手順で、`npm run build` した `out/` を配信し、ヘッドレス Chromium（540×945）で次の画面を撮る。

1. ステージ選択（仲間一覧の顔 32px）
2. ステージ1の会話（顔 64px。本文・名前と重ならない）
3. 戦闘中の下のバー（顔 32px・役割アイコン 32px・HP バーが重ならない。名前と Lv の文字も欠けない）
4. 戦闘中のセリフ欄（顔 64px が枠線の内側に収まる。本文と重ならない）
5. リザルト（顔 32px。名前と重ならない）

あわせて、マップのユニットとタイルがぼけていない（ドット絵のまま）ことを 3 の画面で見る。
撮った画像は `/tmp/` に置き、依頼者に見せる（コミットしない）。重なりや欠けがあれば、座標を直して Task 2〜3 のテストを通し直す。

- [ ] **Step 5: HANDOVER.md を更新する**

「Current State」の状態を「規約の実装（計画の全4タスク）が完了。次は ③ のタイル描画とめり込み」に書き換え、撮った画面で気付いたことがあれば「後回しにした軽微な点」に足す。

- [ ] **Step 6: テストとビルドを通してコミット**

Run: `npm test && npm run build`
Expected: すべて PASS、ビルド成功

```bash
git add README.md assets/images/README.txt HANDOVER.md
git commit -m "docs: アセットの大きさの規約を README に書く"
```
