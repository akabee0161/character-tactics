# Session Handover
## Generated: 2026-09-30

## Current State

- **Branch**: `feat/move-pixel-asset-forge`（⑥用。`origin/main` の `befcd83` = PR #21 のマージから分岐。⑥の spec・計画・実装をコミット済み。push していない）
- **main**: PR #19（②規約）と PR #20（③足元の箱・タイル描画、④の PNG、CodeRabbit の指摘5件の修正）はマージ済み（2026-09-29）。PR #21（⑤森）もマージ済み
- **pixel-asset-forge**: PR #7 はマージ済み（2026-09-30、main は `00ef131`）
- **ankardo**: ブランチ `feat/copy-forge-script`（`copy-forge.sh` と `new-game` スキルの手順。push していない）
- issue #17 は PR #18 のマージ後にクローズ済み（2026-09-28）

## What Remains（上から順に）

- [x] forge の `docs/issue6-asset-policy` を push し、main 向きの PR を作る → forge の PR #7（2026-09-29）
- [x] ⑤ 森で移動が遅くなる（PR #21 でマージ。下記「⑤で決めたこと」）
- [x] ⑥ pixel-asset-forge をこのリポジトリへ移設する → ブランチ `feat/move-pixel-asset-forge`（未 push）。ankardo は `feat/copy-forge-script`（下記「⑥で決めたこと」）

## issue #6 への対応の順番（依頼者と合意、2026-09-28）

pixel-asset-forge #6: https://github.com/akabee0161/pixel-asset-forge/issues/6

1. #6 の5項目め（リポジトリごとのアセット方針・移設）を forge の ISSUES.md に記録 → **済み**（forge の PR #7）
2. アセットの大きさの規約を決めて README に書く → **済み**（PR #19 でマージ）
3. ゲーム側: 通れないマスへのめり込みと、タイルを元の大きさで描く → **済み**（PR #20 でマージ）
4. forge 側: 待機アニメ・村/岩/木の 32px セット・森の絵 → **済み**（forge の絵は forge の PR #7。PNG は PR #20 でこのリポジトリにマージ済み）。待機は剣を持つ拳を2px上げる。村は小さな家3軒、岩は同じくらいの岩5つの岩場、木は小さい木5本の林。森は今の forge の `forest` をそのまま使う
5. ゲーム側: 森で移動が遅くなる → **済み**（PR #21 でマージ）
6. pixel-asset-forge をこのリポジトリへ移設する → **済み**（このブランチ。PR は未作成）

## ⑤で決めたこと（2026-09-29）

設計は `docs/superpowers/specs/2026-09-29-forest-slow-tile-design.md`、計画は `docs/superpowers/plans/2026-09-29-forest-slow-tile.md`。

- 依頼者の判断: stage1 に森を置く（行 9〜12・列 4〜10）。森の中は 0.5倍。まっすぐの線が森を通るときはフローフィールドに従って回り道する（時間を比べる案・Theta* は採らない）
- `legend` の `speed`（省略時 1、0.1 以上 1 以下、通れないマスには書けない）。下限 0.1 は PR #21 の CodeRabbit の指摘（ごく小さい値でフローフィールドの距離 `Int32Array` があふれる）への対応で、依頼者が承認（根拠は `MIN_TILE_SPEED` のコメント）。どのマスにいるかは足元の点で決める。敵も同じく遅くなり回り道する
- 森の絵は forge の `build/tile/forest.png` を `tile-forest.png` としてコピーした。森の端が四角く切れるのは範囲外（依頼者が「いずれ解消する」）
- 計画のテストの不備1件（回り道のテストの目的地がテスト用ステージの勝利地点と重なり、戦闘が終わって止まった）は、依頼者の承認を得てテストの勝利条件を動かないイネスに変えた
- 画面で確かめたこと（2026-09-29）: 森が描かれる。ロランにゴールを指示すると森の左の草（列3）を通って回る。森の中を指示すると森に入る
- 気付いた点: 選択中のなかまの目的地への線は、回り道をしていてもまっすぐに引かれる（今までも壁を回るときは同じ）

## この2日で決まった進め方（依頼者の指示）

- superpowers の brainstorming → spec → 実装計画 → 実行方法の選択、の順に、それぞれ承認を取る。質問は1回に1つ、短く
- **計画に不備が見つかったら、直す前に止めて報告する**（④では3回あった。CDP の表示領域、コマ送りのキー、`slideStep` の既存テストの期待値）
- 作った絵・撮った画面は Read で見せる。絵は何案か並べて選んでもらうと早い（岩・木はこの形で決まった）
- PR は依頼者の指示で作る。CodeRabbit のレビューは依頼者が依頼する。指摘はまず正しいかをコードで確かめ、修正方針を示して承認を得てから直す（直すときは TDD）。コメントへの返信はしない

## Context Files（次のセッションで最初に読むもの）

- この `HANDOVER.md`
- `README.md`「アセットの大きさの規約」「コンテンツの足しかた」（ステージの `legend`）
- `src/core/field.ts`（`computeFlowField`・`slideStep`・`hasClearPath`）と `src/core/sim.ts`（`stepTo`・移動の速さ）
- `pixel-asset-forge/ISSUES.md`（④で見つけて残した軽微な点）と `pixel-asset-forge/types/tile/SPEC.md`「物のセット（32px）」
- `pixel-asset-forge/UPSTREAM.md`（コピー元の commit と、forge に戻す候補）
- forge の④の spec と計画: `pixel-asset-forge/docs/2026-09-28-issue6-forge-assets-spec.md`・`pixel-asset-forge/docs/2026-09-28-issue6-forge-assets-plan.md`（作成時点のログ）

## アセットの大きさの規約: ここまでに決まったこと

- 規約の範囲は**全アセット**（地面・物・ユニットに加え、顔グラ・役割アイコンなど画面のアセットも）
- 1マスは 32px のまま。地面は 16px タイルを1マスに 2×2 で敷く
- 物（村・岩・木・城など）は城と同じく **16px の部品を 2×2 などに組んだセット**で作る
- **物は1マス以上の整数マスを占めてよい**（例: 城は 2×2 マス = 64px）。複数マスの物をマップに置く仕組みは、使うステージが出てきたときに作る
- **顔グラと役割アイコンもドット絵として整数倍で描く。** 今は顔が 128px の絵を直径 26/28/32/48/60px の5通りに縮小して描いており、役割アイコンは 32px を 26px に縮小している。画面の枠を整数倍の大きさ（1〜2通り）に寄せるレイアウト修正が要る
- 画面全体の表示倍率は整数でないまま（issue #17 で依頼者が「変えない」と判断）。規約で揃えるのは「絵の1画素 = 論理座標の何px」まで

- 顔グラは 64px。大きい枠（会話・セリフ欄）は 64px で等倍、小さい枠（仲間一覧・リザルト・下のバー）は 32px に半分で縮小（ここだけぼかす）
- 役割アイコンは 16px で描き、32px（2倍）で表示

全体は spec を参照。

## ⑥ pixel-asset-forge の移設で決めたこと（2026-09-30）

設計は `docs/superpowers/specs/2026-09-30-move-pixel-asset-forge-design.md`、計画は `docs/superpowers/plans/2026-09-30-move-pixel-asset-forge.md`。

- forge を `pixel-asset-forge/` へ丸ごとコピーした（ankardo の `scripts/copy-forge.sh`）。forge は凍結せず並行して開発する
- ゲーム側で直したものは `pixel-asset-forge/UPSTREAM.md` の「forge に戻す候補」に書き溜め、ゲームの開発が終わったら forge の issue にまとめる
- PNG は `sprites.json` と `pixel-asset-forge/tools/export.py` で書き出す（README「ドット絵の作りかた」）。移設直後に書き出した6枚は、コミット済みの PNG と同じだった
- Python は 3.14 を前提にした（依頼者の判断）。手元の python3 は 3.10.12（2026-10-31 でサポート終了）で、forge のテストのうち `contextlib.chdir`（3.11 から）を使う3件が落ちるため。uv（`~/.local/bin`）で 3.14.7 を入れ、`pixel-asset-forge/.venv` を作り直すと 141件すべて通った
- 残り: PR を作る（依頼者の指示で）→ ankardo の `new-game` スキルに character-tactics の PR へのリンクを足してから ankardo の PR をマージ → forge #8 に結果を書いて閉じる

## 後回しにした軽微な点（issue #17 から変わらず）

⑤の最終レビュー（2026-09-29）で出た Minor:

- `field.test.ts` のテスト名「森が無いマップの hasLineOfSight は今までどおり」は、実際には森のあるマップで確かめている（「森があっても hasLineOfSight は変わらない」が正しい）
- `field.ts` の `computeFlowField` のコメント「グリッドは最大でも 30x14」は古い（今は 16x23）。`fields.ts` の「BFS」も実際はダイクストラ（どちらも⑤の前から）

- README の CDP の手順（「描画と入力をブラウザで確認する」）どおり `--window-size=540,945` で headless Chromium を立てると、表示領域が 540×802 になり canvas が 458×802 に縮む。CDP の `Emulation.setDeviceMetricsOverride`（540×945・倍率1）を接続のたびにかけると、論理座標1px＝画面1px になる（2026-09-29、forge の ④ の確認で判明）
- `?debug` のコマ送り `.` は、同じフレームの中で何回押しても1ステップにしかならない（`DebugClock.stepQueued` が真偽値）。CDP から続けて送るときは1回ごとに1フレーム待つ。また 1/60 秒 × 15 ステップでは浮動小数の丸めで 4fps のコマが切り替わらず、16 ステップ要った
- `npx vite preview` は `localhost` でだけ待ち受けるので、`127.0.0.1` では繋がらない

- 地形タイルを毎フレーム描き直している（約1500回の drawImage。今は問題なし）
- 画像の読み込み前は、丸が足元から3px浮く。ドラッグを始めると残像が14px上へずれる
- ふさがれた詰め寄りは `closingOn` が残る（見た目は待機と同じ）
- 振りかぶり中に相手が倒れるケース、2体目の敵が待つケースなどのテストが薄い
- sim.ts の「近接は位置を使わないので影響しない」というコメントが不正確（近接のノックバックの向きは攻撃時の位置のまま）
- ステージ1の最上段で頭が上部バーに隠れる件は、依頼者が動かしてみて違和感があれば直す
- 下のバーの護衛の印（黄色い三角、x+2〜14・y+10〜20）が顔の左上に重なる。顔を 32px にする前から重なっていた
- 通れないマスの真下に立つと、体（背丈24〜26px）がほぼ全部上のマスの絵に重なる。今の木・岩の絵はマスいっぱいに描かれているため。依頼者の判断（2026-09-28）で「手前に立っている見え方」として残した。32px のセットに描き直したときに違和感があれば見直す
- ロランは剣先が体より 4px 外に出るので、通れないマスの左の脇では剣先がそのマスの絵に少しかかる（足元の箱は全ユニット共通で左右6px）
- 下のバーの「倒れた」の文字（x+42、ベースライン y+50）が役割アイコンの枠（y+30〜62）に重なる。前から重なっていて、枠を 32px にしたぶん少し増えた。重なった画面はまだ撮っていない
- 128px の顔を 32px の枠に出すと4分の1の縮小になり、`imageSmoothingQuality` が既定（low）のままなので、ブラウザによっては1pxの線が欠けうる。64px の顔に差し替えれば消える
- セリフ欄のテスト（layout.test.ts「本文は顔の右から始まる」）は、顔の中心 x+36 を screens.ts から書き写している。描画側だけ変えるとテストが通ったまま重なる
- README の規約の節の「役割アイコン（32px）」は味方の分だけで、敵の `role-teki*.png` の3枚は 64×64。今は敵の役割アイコンを画面に出していない。16px に描き直すときに合わせて直す

## 未対応として残すもの（前回から変わらず）

- 村のイベント（依頼者が別件で扱う）
- pixel-asset-forge の CLAUDE.md の「ゲーム側で倍率を直す予定」という記述（別リポジトリ。直す前に依頼者に確認）

## 資料

- forge の issue: https://github.com/akabee0161/pixel-asset-forge/issues/6
- 前回（issue #17）の設計: `docs/superpowers/specs/2026-09-26-issue17-fixes-design.md`
