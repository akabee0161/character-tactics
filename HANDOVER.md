# Session Handover
## Generated: 2026-09-07T03:15:00+00:00

## Current State

- **Branch**: `feat/map-sprite-animation`(`origin/main` の `dfa9d8b` から分岐、**未 push**)
- **Last Commit**: `93c66bc docs: スプライトシート対応の実装計画を追加する`
- **Uncommitted Changes**: なし
- **ベースライン**: `npm test` 528件通過(30ファイル)、`npm run build` 成功。この状態から始められる

PR #9(縦画面化)は `dfa9d8b` として `main` にマージ済み。その続きの作業。

## What Was Done

このセッションでやったのは**設計と計画だけ**で、実装コードには一切触っていない。

1. PR #9 のマージを確認し、`main` から `feat/map-sprite-animation` を切った
2. 前セッションで3節に分けて合意した設計を、spec として書き起こしてコミットした(`2c4065b`)
   - `docs/superpowers/specs/2026-09-06-map-sprite-animation-design.md`(222行、9節)
3. spec をユーザーがレビューして承認した
4. 実装計画を書いてコミットした(`93c66bc`)
   - `docs/superpowers/plans/2026-09-07-map-sprite-animation.md`(全10タスク・59ステップ)
5. 計画に載せる前に2点を実地で確かめた
   - **PNG 生成器**: Node 標準 `zlib` だけで 128×384 / 192×576 の RGBA PNG を書けることを `/tmp` で検証済み。`file` コマンドが正しく認識し、余った列が透明になることも確認した。計画の Task 8 に載っているコードはその検証済みのもの
   - **`@types/node` が要ること**: 実寸テストが `node:fs` を読む一方、`tsconfig.json` の `types` に node が無いので `tsc --noEmit` が落ちる。レジストリから取得できることは `--dry-run` で確認済み(`@types/node` 26.4.1)

## What Remains

実装計画の Task 1 から順に実行する。各タスクは TDD(失敗するテスト → 実装 → 通す → コミット)で、
タスクごとに `npm test` と `npm run build` の両方を通してからコミットする。

- [ ] Task 1: `schema.ts` に `MapSheet` を入れる(`sprites.map` を文字列からオブジェクトへ)
- [ ] Task 2: `registry.ts` で `sprites.map.sheet` の実在を検証する
- [ ] Task 3: `core` に `attack` イベントを足す(`sim.ts` の `resolveAttacks`、純粋な追加)
- [ ] Task 4: `src/render/anim.ts` を新設(`dirOf` / `frameOf` などの純粋関数)
- [ ] Task 5: `anim.ts` に状態更新を足す(`noteAttacks` / `updateMotion` / `frameFor`)
- [ ] Task 6: `sprites.ts` の `drawMapUnit` をシート対応にし、`drawHalf` を足す
- [ ] Task 7: `draw.ts` と `main.ts` を配線(オフセット・ドラッグ残像・`imageSmoothingEnabled`)
- [ ] Task 8: `tools/gen-placeholder-sprites.mjs` で仮アセットを生成し同梱する
- [ ] Task 9: 7体の JSON をシートにつなぎ、PNG 実寸のテストを足す(`@types/node` もここ)
- [ ] Task 10: README と `assets/images/README.txt` を直し、CDP でブラウザ目視する

実装が終わったあと: ブランチを push して PR を作る(このセッションでは push していない)。

## Key Decisions Made

設計時にユーザーと合意済み。**実装中に蒸し返さないこと。**

- **フレームは正方形固定。** 縦長(32×48 など)を許すと足元アンカーの規約が別途必要になる
- **`sprites.map` は `MapSheet` オブジェクトか `null` のみ。** 旧い単体 PNG 文字列との互換は残さない(実アセットがまだ無く、互換を残す相手がいない)
- **`role` と `face` は静止画のまま。** 動かす対象ではない
- **シートの実寸検証は起動時ではなく vitest。** `images.ts` は方針として画像の読み込みを待たないので、起動時点では幅も高さも分からない。PNG の IHDR(先頭24バイト)を直接読んで JSON と突き合わせる
- **必殺技には専用モーションを付けない。** 攻撃モーションは通常攻撃だけに紐づける
- **攻撃中は向きを攻撃方向に固定する。** 歩きながら撃つゲームなので移動由来の向きと競合する。固定されるのは時間の1〜2割(攻撃 0.25秒 / 攻撃間隔 1.4〜2.4秒)
- **歩行判定に `WALK_HOLD = 0.12` 秒のヒステリシス。** シムは 1/60 固定ステップ、描画は rAF なので、120Hz 端末では差分ゼロのフレームが必ず出てちらつく
- **アニメの時計は壁時計ではなく `battle.time`。** 補間描画は無く、シムが止まればアニメも止まるのが正しい
- **絵が入ると味方は直径 22px → 32px になる。** `UNIT_R` を直接見ているオフセット(HPバー・はた・選択リング・護衛の印)は `drawHalf(def, fallback)` に寄せる
- **`enemyRadius(maxHp)` は丸フォールバック専用として残す。** スプライトの大小は `frame` で表す(ガルムだけ 48)
- **仮アセットは生成器で作ってコミットする。** 本番の絵が揃ったら `tools/gen-placeholder-sprites.mjs` ごと消す前提

## Known Issues / Blockers

- ブロッカーは無い。ベースラインは green
- `.claude/worktrees/character-tactics-impl/` に古い worktree が残っている(`vite.config.ts` の `exclude` で二重実行は防いである)。今回の作業とは無関係なので触らない
- 仮アセットの品質はチビ体のシルエット止まり。デバッグの丸よりは良いが本番の絵には遠い、というのは織り込み済み

## Context Files

上から順に読む。

- `docs/superpowers/plans/2026-09-07-map-sprite-animation.md` — 実装計画。**これが作業の本体**
- `docs/superpowers/specs/2026-09-06-map-sprite-animation-design.md` — なぜその設計なのか
- `CLAUDE.md` — コミット規約・テスト方針・ドキュメントの扱い
- `README.md` — 現状の仕様と CDP でのブラウザ確認手順
- `src/engine/schema.ts` — Task 1 で最初に触る
- `src/render/sprites.ts` / `src/render/draw.ts` — Task 6, 7 で触る

## Recommended Next Steps

1. 新しいセッションを開く: `claude`
2. `git checkout feat/map-sprite-animation`
3. superpowers:subagent-driven-development(タスクごとに新しいサブエージェント)か
   superpowers:executing-plans(このセッションで順に実行)のどちらかで、計画の Task 1 から始める
