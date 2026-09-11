# とりでの なかまたち (character-tactics)

4人の仲間を率いて、敵の本拠地へ攻め込むリアルタイム侵攻シミュレーション。
[ankardo](https://ankardo.com) のサブリソースとして `ankardo.com/play/character-tactics/` で公開する。

- 設計: `docs/superpowers/specs/2026-09-06-map-sprite-animation-design.md`
- 実装計画: `docs/superpowers/plans/2026-09-07-map-sprite-animation.md`

## そうさ

| 操作 | 結果 |
|---|---|
| なかまをタップ | 選択する。もう一度タップで選択を外す |
| 下のポートレートをタップ | そのなかまを選び、必殺技を出す |
| なかまをドラッグして離す | 戦闘中はその地点へ移動 |
| 選択中に地面をタップ | 戦闘中はその地点へ移動 |

必殺技は下のポートレートをタップして出す。タップすると同時にそのなかまが選択される。クールダウン中・必殺技を持たない場合は選択だけになる。倒れているなかまはタップしても何も起きない（選択も変わらない）。いま出せるなかまのポートレートには太い縁がゆっくり明滅して付き、残り時間はポートレートのゲージで読める。配置フェーズでは同じ下パネルの上段に「始める」が出る。

ステージ選択の一覧は縦にドラッグしてスクロールする。指をほとんど動かさずに離すとそのステージを選ぶ。右端の細いバーで今どのあたりを見ているかが分かる。

ステージを選ぶと、まず会話から始まる。タップで送り、文字送りの途中でタップすると全文が出る。一度読み終えたステージでは「とばす」が出る。会話はステージ開始時と、敵の本拠地に到達したときの2回ある。

戦闘中のセリフは下パネルの上段に数秒だけ出る。時間は止まらない。同じ瞬間に複数のなかまが喋ったときは、優先度の高い1件だけを出す。盤面にはかぶらない。

移動先は 4 人ぶんが常に表示される。選択中のなかまだけ、現在地から目的地への線が引かれる。指示した移動は交戦しても最後まで進む（歩きながら攻撃する）。配置は黄色い線より下の、歩けるマスのどこにでもできる。ドラッグ先が線より上か壁だと、プレビューの線と丸が赤く変わり、そのまま離しても失敗することが事前にわかる。

敵の索敵範囲は表示しない。気づかれた瞬間、その敵の頭上に赤い「！」が2秒だけ出る。追われているあいだずっと出しっぱなしにはしない。

## 開発

必要なもの: Node.js 22 以上

```bash
npm install
npm run dev     # 開発サーバ
npm test        # ユニットテスト (Vitest)
npm run build   # 型チェック + 本番ビルド (out/play/character-tactics/)
```

### 描画と入力をブラウザで確認する

描画コードにはユニットテストを書かない方針なので、`drawTalk` / `drawSpeechBar` の見た目や
ポインタ操作は実ブラウザで確かめる。**Playwright パッケージは要らない。** Chromium の
バイナリさえあれば（`~/.cache/ms-playwright/` に落ちているものでよい）、追加の依存なしで
CDP から駆動できる。

```bash
npm run build                       # out/ を任意の静的サーバで配信する
chrome --headless=new --no-sandbox --disable-gpu \
       --remote-debugging-port=9222 --window-size=540,945 <URL>
```

`http://127.0.0.1:9222/json/list` から WebSocket に繋ぎ、`Runtime.evaluate` で
`document.getElementById('game')` に対して `PointerEvent` を直接 dispatch してタップと
ドラッグを送り、`Page.captureScreenshot` で画面を撮る。`Input.dispatchMouseEvent` は
headless Chromium で `pointerdown` / `pointerup` として正しく届かないことがあるため使わない。
論理座標 540×945 からクライアント座標への変換は `computeViewport` と `fitCanvas`
（どちらも `src/render/viewport.ts`）と同じ式を使う。

判定はスクリーンショットを見るほか、`getImageData` で色の塊を数えると機械的に取れる。
セリフ欄のパネルは `#f7f3e6`、ユニットの丸は各 def の `color`。下部バーのポートレートも
同じ色なので、マップ領域（論理 y が 50〜786）に絞ること。

**確認しにくいもの:** 飛翔体（弓・魔法）は着弾までの数フレームしか画面に映らないため、
`Page.captureScreenshot` を短い間隔で連写しないと捉えられない。

## 構成

| ディレクトリ / ファイル | 責務 |
|---|---|
| `assets/` | ステージ・ユニット・敵・スキル・称号・セリフの定義（JSON）。ロジックを置かない |
| `assets/images/` | ユニットの絵（PNG）。`sprites` から名前で参照する |
| `src/engine/` | 定義の型検証・読み込み・索引。`core` を知らない |
| `src/core/` | 描画・DOM に依存しない純ロジック |
| `src/core/damage.ts` | 命中1回ぶんの解決。近接も飛翔体の着弾も通る |
| `src/core/projectiles.ts` | 飛翔体の生成・移動・命中 |
| `src/core/spawns.ts` | 時間湧きの判定（純関数） |
| `src/render/` | Canvas2D 描画 |
| `src/render/images.ts` | 画像の読み込みとキャッシュ |
| `src/render/sprites.ts` | 画像とプレースホルダを1本にまとめた描画 |
| `src/render/anim.ts` | 向き・状態・コマ番号の計算（DOM に触らない） |
| `src/ui/` | 画面遷移・入力・会話フェーズ |
| `src/ui/speech.ts` | 戦闘中のセリフの保持と寿命 |
| `src/ui/scroll.ts` | 縦スクロールの計算（ステージ選択が使う） |
| `src/save/` | localStorage の読み書き |
| `tools/` | 仮アセットの生成器。本番の絵が揃ったら消す |

`src/core/**` と `src/engine/**` は `window` / `document` / `localStorage` を参照しない。

## コンテンツの足しかた

コードを書き換えずに足せるもの:

- **ステージ** — `assets/stages/<id>.json` を1本置く。ファイル名と `id` を一致させ、`order` に並び順を書く（昇順に並ぶ。欠番は自由、重複は起動時エラー。10, 20, 30 と空けておくと後から間に挟める）。**並び順を決めるのは `order` だけで、`id` の数字ではない**（ガルム戦は `stage3` のまま `order: 100` で最後尾にいる。`id` はセーブデータのクリア記録が参照するので、あとから振り直さない）。マップは **16列 × 23行、`cell` は 32**。`placement.minY` より下（画面で下）の歩けるマスが配置できる範囲で、`placement.starts` に開始時の立ち位置を並べる（roster より少なければ先頭から繰り返す）。**敵と時間湧きは `placement.minY` より上（`y < minY`）に置く**。線より下はプレイヤーの配置範囲なので、置くと起動時エラーになる。`victory.pos` は最上段に置く（下から上へ攻める）
- **ステージ開始時の会話** — ステージの `intro` に書く。`speaker` を省略すると地の文になり、本文は `text` に直書きするか `lineId` で `assets/lines/` を参照する（両方書いても、どちらも書かなくてもエラー）
- **本拠地に到達したときの会話** — ステージの `outro` に書く。書き方は `intro` と同じ
- **味方・同行 NPC** — `assets/units/<id>.json`。`combat: false` にすると攻撃しない同行者になる
- **敵** — `assets/enemies/<id>.json`
- **時間湧きの敵** — ステージの `spawners` に `{ "defId": ..., "pos": ..., "firstAfter": 20, "every": 15, "total": 3 }` を並べる。`firstAfter` 秒後に1体目、以降 `every` 秒ごとに1体、合計 `total` 体まで湧く。湧いた敵の AI は `aggressive` 固定。総数上限は必須（上限がないと持久戦で詰む）
- **ユニットの絵** — `assets/images/` に PNG を置き、`assets/units/<id>.json`（敵は `assets/enemies/<id>.json`）の `sprites` に書く。`role` はクラスアイコン（64×64）、`face` は顔（128×128。下パネル・ステージ選択・会話・リザルト）、`map` はフィールド上の姿。`map` だけはスプライトシートで、`{ "sheet": "<file>.png", "frame": 32, "idle": { "frames": 2, "fps": 4 }, "walk": {...}, "attack": {...} }` の形。シートは**列 = コマ、行 = 12（3状態 × 4方向）**で、行番号 = 状態index × 4 + 方向index、状態は `idle, walk, attack`、方向は `down, up, left, right` の順。コマは正方形。列数は最大コマ数にそろえ、余りは透明のまま置く。`map` が `null` のあいだは色つきの丸だけが出る（クラス名の文字は `role` が `null` のときに出る別のフォールバックで、`map` とは無関係）。`frame` と各状態の `frames` は1以上の整数、`fps` は1以上の数値であること。実寸と JSON が食い違うと `npm test` が落ちる（`src/engine/sheet-size.test.ts`）
- **仮の絵の作り直し** — `node tools/gen-placeholder-sprites.mjs`。本番の絵が揃ったらこの生成器は消してよい。差し替えは PNG を上書きするだけで、コマ数を変えるときだけ JSON の数値を直す
- **攻撃の種別** — `attack` は `melee` / `bow` / `magic`。`bow` と `magic` は飛翔体として飛び、届いた瞬間にダメージが出る。`bowDamageCap` が効くのは `bow` だけ
- **セリフ** — `assets/lines/*.json`
- **称号** — `assets/titles.json`。`counter` に使えるキーは `skill:<skillId>:uses` / `skill:<skillId>:hits` / `kill:neraiuchi` / `bond:supports`
- **絆** — `assets/bonds.json`
- **成長の調整** — `assets/growth.json`。`xpPerLevel`（レベルアップの必要量）、`hpPerLevel` と `levelsPerPower`（1レベルの強化量）、`hitXp` / `healXp` / `assistRatio` / `clearXp`（経験値の入り口）、`maxLevel`。経験値が小数にならないよう `hitXp` / `healXp` / `clearXp` は整数で検証する

コードが要るもの:

- **新しいスキル** — `src/core/skills.ts` の `SKILL_EFFECTS` に効果を足し、`assets/skills.json` に数値を足す。`assets/skills.json` の各スキルには `params.cooldown`（秒）が必須
- **新しい AI パターン** — `src/core/ai.ts` の `AI_BEHAVIORS` に足し、`src/engine/schema.ts` の `AiDef` と `AI_KINDS` に variant を足す
- **新しい勝敗条件** — `src/engine/schema.ts` の `VictoryCond` / `DefeatCond` に variant を足し、`src/core/objectives.ts` で判定を書く

JSON が壊れていると起動時にエラー画面が出て止まる。どのファイルのどのフィールドがなぜ不正かが出るので、それを直すこと。

## デプロイ

`main` への push で GitHub Actions がビルドし、Cloudflare Workers Static Assets へデプロイする。

ビルド設定で注意する点:

- `vite.config.ts` の `base` は `/play/character-tactics/`
- `vite.config.ts` の `build.outDir` は `out/play/character-tactics`（`out` 直下にすると、パス付きルートの Workers では deploy が失敗する）
- `wrangler` は `^4` 系に固定し、CI の Node.js は 22 以上にする
