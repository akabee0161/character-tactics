# とりでの なかまたち (character-tactics)

4人の仲間を率いて、敵の本拠地へ攻め込むリアルタイム侵攻シミュレーション。
[ankardo](https://ankardo.com) のサブリソースとして `ankardo.com/play/character-tactics/` で公開する。

- 設計: `docs/superpowers/specs/2026-09-06-vertical-pivot-design.md`
- 実装計画: `docs/superpowers/plans/2026-09-06-vertical-pivot.md`

## そうさ

| 操作 | 結果 |
|---|---|
| なかまをタップ | 選択する。もう一度タップで選択を外す |
| 下のポートレートをタップ | 同じく選択・解除 |
| なかまをドラッグして離す | 戦闘中はその地点へ移動 |
| 選択中に地面をタップ | 戦闘中はその地点へ移動 |

必殺技ボタンは下パネルの固定位置に常に出ている。なかまを選んでいないときや、クールダウン中で押せないときも「なかまを えらぶ」「わざめい あと ○びょう」のように理由が文字で読める。配置フェーズの「はじめる」も同じ場所に出るので、押す場所がフェーズをまたいで変わらない。

ステージを選ぶと、まず会話から始まる。タップで送り、文字送りの途中でタップすると全文が出る。一度読み終えたステージでは「とばす」が出る。会話はステージ開始時と、敵の本拠地に到達したときの2回ある。

戦闘中の会話は、喋ったキャラの頭上に数秒だけ出る。時間は止まらない。吹き出しをタップすると消え、吹き出しの上から始めたドラッグはタップ扱いにならず移動指示として通る。

移動先は 4 人ぶんが常に表示される。選択中のなかまだけ、現在地から目的地への線が引かれる。指示した移動は交戦しても最後まで進む（歩きながら攻撃する）。配置中は、ドラッグ先が配置できないマス（壁など）だとプレビューの線と丸が赤く変わり、そのまま離しても失敗することが事前にわかる。

## 開発

必要なもの: Node.js 22 以上

```bash
npm install
npm run dev     # 開発サーバ
npm test        # ユニットテスト (Vitest)
npm run build   # 型チェック + 本番ビルド (out/play/character-tactics/)
```

### 描画と入力をブラウザで確認する

描画コードにはユニットテストを書かない方針なので、`drawTalk` / `drawBubble` の見た目や
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
論理座標 540×945 からクライアント座標への変換は `computeViewport`（`src/render/viewport.ts`）
と同じ式を使う。

判定はスクリーンショットを見るほか、`getImageData` で色の塊を数えると機械的に取れる。
吹き出しのパネルは `#f7f3e6`、ユニットの丸は各 def の `color`。下部バーのポートレートも
同じ色なので、マップ領域（論理 y が 50〜786）に絞ること。

**確認しにくいもの:** 飛翔体（弓・魔法）は着弾までの数フレームしか画面に映らないため、
`Page.captureScreenshot` を短い間隔で連写しないと捉えられない。同様に「同じキャラの
連続発話で上書き」「画面端での吹き出しのはみ出し」は狙って起こしにくい。後者は
`src/ui/layout.test.ts` のクランプ試験で担保する。

## 構成

| ディレクトリ / ファイル | 責務 |
|---|---|
| `assets/` | ステージ・ユニット・敵・スキル・称号・セリフの定義（JSON）。ロジックを置かない |
| `assets/images/` | ユニットの絵（PNG）。`sprites` から名前で参照する |
| `src/engine/` | 定義の型検証・読み込み・索引。`core` を知らない |
| `src/core/` | 描画・DOM に依存しない純ロジック |
| `src/core/damage.ts` | 命中1回ぶんの解決。近接も飛翔体の着弾も通る |
| `src/core/projectiles.ts` | 飛翔体の生成・移動・命中 |
| `src/render/` | Canvas2D 描画 |
| `src/render/images.ts` | 画像の読み込みとキャッシュ |
| `src/render/sprites.ts` | 画像とプレースホルダを1本にまとめた描画 |
| `src/ui/` | 画面遷移・入力・会話フェーズ・吹き出し |
| `src/ui/skillbutton.ts` | 必殺技ボタンの表示状態 |
| `src/save/` | localStorage の読み書き |

`src/core/**` と `src/engine/**` は `window` / `document` / `localStorage` を参照しない。

## コンテンツの足しかた

コードを書き換えずに足せるもの:

- **ステージ** — `assets/stages/<id>.json` を1本置く。ファイル名と `id` を一致させ、`order` に並び順を書く（昇順に並ぶ。欠番は自由、重複は起動時エラー。10, 20, 30 と空けておくと後から間に挟める）。マップは **16列 × 23行、`cell` は 32**。`placementZone` は最下段、`victory.pos` は最上段に置く（下から上へ攻める）
- **ステージ開始時の会話** — ステージの `intro` に書く。`speaker` を省略すると地の文になり、本文は `text` に直書きするか `lineId` で `assets/lines/` を参照する（両方書いても、どちらも書かなくてもエラー）
- **本拠地に到達したときの会話** — ステージの `outro` に書く。書き方は `intro` と同じ
- **味方・同行 NPC** — `assets/units/<id>.json`。`combat: false` にすると攻撃しない同行者になる
- **敵** — `assets/enemies/<id>.json`
- **ユニットの絵** — `assets/images/` に正方形の PNG を置き、`assets/units/<id>.json` の `sprites` にファイル名を書く。`role` はクラスアイコン、`face` は顔（下パネル・ステージ選択・会話・リザルト）、`map` はフィールド上の姿。`null` のあいだは色つきの丸とクラス名の文字が出る。推奨サイズは `face` 128×128、`map` / `role` 64×64
- **攻撃の種別** — `attack` は `melee` / `bow` / `magic`。`bow` と `magic` は飛翔体として飛び、届いた瞬間にダメージが出る。`bowDamageCap` が効くのは `bow` だけ
- **セリフ** — `assets/lines/*.json`
- **称号** — `assets/titles.json`。`counter` に使えるキーは `skill:<skillId>:uses` / `skill:<skillId>:hits` / `kill:neraiuchi` / `bond:supports`
- **絆** — `assets/bonds.json`

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
