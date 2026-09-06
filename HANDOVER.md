# Session Handover
## Generated: 2026-09-06T13:08:36+00:00

## Current State

- **Branch**: `feat/vertical-pivot`(ローカルのみ、`origin/main` には未 push。`origin/main` から 15 コミット進んでいる)
- **Last Commit**: `3ac0ef2` fix: しじされた いどうは こうせんしても とまらないように する
- **Uncommitted Changes**: なし(`HANDOVER.md` はこのファイル自身のみ。コミットするかは任意)

## What Was Done

前セッションの続きとして、`docs/superpowers/plans/2026-09-06-vertical-pivot.md` の実装計画を Task 1 から Task 14 まで完了した。各タスクは TDD(失敗するテスト → 実装 → 通す → コミット)で進め、タスクごとに `npm test` と `npm run build` の両方を確認してからコミットしている。

1. Task 1〜6: 論理解像度を 540×945 の縦画面にし、レイアウト定数・各画面描画・情報バー・ステージ3本・`index.html` を縦向きに作り直した
2. Task 7: 必殺技ボタンを下パネルの固定位置(`SKILL_BUTTON`)へ移し、`skillbutton.ts` を新設した
3. Task 8: 吹き出しのタップ判定を `pointerdown` から `pointerup` へ移し、ドラッグでの移動指示を吹き出しが奪わないようにした
4. Task 9: 下パネルのポートレートにユニットクラス(役割名)を表示した
5. Task 10〜13: `UnitDef.sprites`(画像ファイル名、省略可)をスキーマに追加し、起動時に画像の存在を検証し、`assets/images/*.png` を読み込む経路(`render/images.ts`)を作り、画像とプレースホルダ描画を1本の関数(`render/sprites.ts`)に統合した
6. Task 14: `sim.ts` の `moveUnits` を直し、プレイヤーが指示した移動は交戦中でも止まらないようにした(`hasOrderedMove`)。移動先マーカーを薄くする演出も廃止した

**計画に無かった追加対応(計画書自体には書かれていない、実装中に見つけた問題への対処):**

- `viewport.test.ts` の既存テスト「マップ原点ぶんずれる」が `MAP_ORIGIN.x` の変更(0→14)で不整合になっていたため、x 成分も原点分ずれるよう修正した
- ステージのマップ縮小(30列→16列)に伴い、`skills.test.ts`(かけぬけるの壁判定テスト2件)と `sim.test.ts`(敵の移動確認テスト1件)がハードコードされた座標のずれで壊れたため、新しい16列マップに合わせて座標を調整した
- Task 13 で画像差し替えの実機検証を行った際、ImageMagick も Pillow も使えない環境だったため Node.js の `zlib` で直接 32×32 の白色 PNG を生成して確認した(確認後、生成物と `roran.json` の変更は元に戻し済み)
- Task 14 の新規テストで、配置ゾーン付近にいる `ines`(弓、range160)が意図せず敵と交戦してしまい、`claimed` セットに敵の uid が入ってロランの交戦判定を妨げる問題を発見。テスト内でロラン以外のプレイヤーユニットを退場させる `isolateRoran` ヘルパーを追加して解決した(計画のテストコードそのままでは通らなかった)

## What Remains

実装計画の Task 15〜20 が未着手。計画に書かれた順で進める。

- [ ] Task 15: 弓と魔法を飛翔体にする(`core/damage.ts`, `core/projectiles.ts` を新設。`isFunbaruActive` を `skills.ts`→`combat.ts`、`PINCH_RATIO` を `sim.ts`→`constants.ts` へ移すところから着手。**着手直前で中断**、まだ1行も編集していない)
- [ ] Task 16: 飛翔体を描き、弓の線の演出を廃止する
- [ ] Task 17: ミストに魔法攻撃を持たせる
- [ ] Task 18: ステージに `outro` を書けるようにする
- [ ] Task 19: 本拠地に到達したときの会話を出す
- [ ] Task 20: README を更新する

## Key Decisions Made

`HANDOVER.md`(前セッション分、`git show 316ae96:HANDOVER.md` などで参照可)に記載の decisions がそのまま有効。加えて今セッションで:

- **ブラウザ確認は Node.js の `ws` パッケージ(character-tactics の node_modules 内)を使い、CDP 経由で `Runtime.evaluate` から直接 `PointerEvent` を dispatch する方式に落ち着いた。** `Input.dispatchMouseEvent` は headless Chromium で `pointerdown`/`pointerup` として正しく届かないことがあった
- **一時ファイル(`.tmp-cdp-drive.cjs` など)はプロジェクト直下に作って作業後に必ず削除する。** `/tmp` 配下だと `ws` モジュールが解決できないため

## Known Issues / Blockers

- ブロッカーは無い
- **作業ディレクトリの cwd が時々 `/home/ubuntu/workspace` に戻ることがある。** `npx vitest` 等を実行する前に `cd /home/ubuntu/workspace/character-tactics` を確認すること(このセッションで何度か "ステージが 1つも ない" エラーの原因になった)
- ブラウザ確認は Playwright パッケージ不要。`~/.cache/ms-playwright/chromium-1140/chrome-linux/chrome` を `--headless=new --no-sandbox --disable-gpu --remote-debugging-port=<port> --window-size=540,945` で起動し、CDP で駆動する

## Context Files

読む順:

1. `docs/superpowers/plans/2026-09-06-vertical-pivot.md` — **実装計画(これが作業の本体)。Task 15 から読む**
2. `docs/superpowers/specs/2026-09-06-vertical-pivot-design.md` — 設計書。なぜその形にしたかはここ
3. `src/core/sim.ts` — Task 15 の中心(`resolveAttacks` を書き換える)
4. `src/core/skills.ts` — Task 15 Step 1 で `isFunbaruActive` を切り出す元
4. `src/core/combat.ts` — Task 15 Step 1 の移動先、Task 17 で `magic` を足す場所
5. `src/core/constants.ts` — Task 15 Step 1 で `PINCH_RATIO` の移動先

## Recommended Next Steps

1. 新しいセッションを開く: `claude`
2. 次のプロンプトを貼る(下記「引き継ぎプロンプト」を参照)
3. 最初の具体的な作業: Task 15 Step 1 — `isFunbaruActive` を `src/core/skills.ts` から `src/core/combat.ts` へ切り取り、`PINCH_RATIO` を `src/core/sim.ts` から `src/core/constants.ts` へ移す。参照元を直してから `npx tsc --noEmit && npm test` を通し、まず1本コミットする

**注意:** Task 15 は依存の向き(`damage.ts` が `skills.ts` を参照すると循環参照になる)の都合で `isFunbaruActive` と `PINCH_RATIO` の移設が最初のステップになっている。計画の Task 15 Step 1 に手順が書いてある。
