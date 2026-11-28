# SDD ledger — plan: /home/ubuntu/workspace/character-tactics-unitview/docs/superpowers/plans/2026-11-28-unit-view-check.md
Spec: docs/superpowers/specs/2026-11-28-unit-view-check-design.md (read)
Pre-flight: T1->T2 readPng; T3->T6/T7 cdp.ts,drawUnitFigure; T4->T5? (layout->compare independent) T4,T5->T6; T6->T7 UnitViewResult. No conflicts found on read.
Task 1: complete (commits c08ab9e..c08ab9e, tests: npx vitest run src/engine/png-node.test.ts →    Duration  17.60s (transform 3.34s, setup 0ms, collect 2.63s, tests 881ms, environment 0ms, prepare 3.84s))
Task 2: Ruling: 「足元の行より下は空」の確認を外した — 依頼者 2026-11-28 が承認（14 コマの y=31 は問題でない。32px では y=31 が最終行で、許すと何も見ない確認になる）— 足元の位置は Task 5〜7 の照らし合わせが見る。Step 3（FOOT_INSET をずらす変異）は対象が無くなったので、代わりに「コマ数より左」の条件を >= から > に変えて落ちることを確認し戻した
Task 2: complete (commits c08ab9e..c08ab9e, tests: npx vitest run src/engine/sheet-frames.test.ts →    Duration  13.12s (transform 2.33s, setup 0ms, collect 2.95s, tests 4.48s, environment 153ms, prepare 1.77s))
Task 3: 前後の撮影（明るい stage1・暗い stage7、performance.now=1000、seed 12345）が cmp でバイト一致。一時ファイルは削除済み。Ruling: tools/ は tsconfig の include 外なので、cdp.ts は単体の tsc で型を確かめた — 計画の「npx tsc --noEmit」では検査されないため — 無視した場合 cdp.ts の型誤りが build で見えない
Task 3: complete (commits c08ab9e..c08ab9e, tests: npx tsc --noEmit → (no output))
Task 4: complete (commits c08ab9e..c08ab9e, tests: npx vitest run src/dev/unit-view-layout.test.ts →    Duration  15.33s (transform 3.45s, setup 0ms, collect 4.01s, tests 2.64s, environment 64ms, prepare 2.40s))
Task 5: 追加の「src の位置のコマを見る」テストの添字が誤っていたのをテスト側で直した（実装の誤りではない）
Task 5: complete (commits c08ab9e..c08ab9e, tests: npx vitest run src/dev/unit-view-compare.test.ts →    Duration  8.07s (transform 2.21s, setup 0ms, collect 2.09s, tests 82ms, environment 0ms, prepare 1.68s))
Task 6: tsc 無出力、vite build 成功、out/play/character-tactics に unit-view の名のファイルも __unitView の文字も無し（find/grep 空）
Task 7: Ruling: 時間切れの確認は計画の「待ち時間を 1ms」では起きない（waitFor は 1 回目の評価が先でページが既に完了していた）ため、待つ式を一時的に存在しない値へ変え 1500ms で exit 2 を確認し戻した — 計画の手順が成り立たないため — 時間切れ経路の確認が弱ければ README の説明どおりに動かない
Task 7: 結果 今のアセットで exit 0（38 シート全 OK、かぶり最大は tatemochi 14・tatemochi-2 19、他 0）。変異 足元+1 と 行^1 はどちらも 38 シート全 NG・exit 1。CHROME=/nonexistent は exit 2。時間切れは exit 2。変異は戻して sprites.ts に差分なし
Task 6: complete (commits c08ab9e..c08ab9e, tests: npx tsc --noEmit → (no output))
Task 7: complete (commits c08ab9e..c08ab9e, tests: npx vitest run src/dev →    Duration  8.71s (transform 1.88s, setup 0ms, collect 2.07s, tests 1.51s, environment 2ms, prepare 1.60s))
Task 8: README・CLAUDE.md 更新。npm test 58 ファイル 1376 件合格、npm run build 成功（out に unit-view 無し）、npm run unit-view exit 0
Final: 全体レビュー（opus の別エージェント）。Critical なし
Final: fixed I-1 Chromium が読み込み中に落ちると止まる — /tmp 内の再現スクリプト（応答しないサーバへ navigate 中に Chromium を殺す）HUNG→rejected、型は tsc で確認（自動テストは無い: tools/ はテスト対象外）
Final: fixed I-2 開発サーバ起動失敗が exit 1 になる — startDevServer を try の中へ、main の reject を exit 2 に。自動テスト・再現は未実施（コードと型だけ）
Final: fixed M-1(Important に再格付け) README の飛行の持ち上げの記述を実際の確認範囲に合わせた
Final: minor (deferred): M-2 半透明画素があると理由不明の NG／M-3 ページが壊れると 60 秒待つ／M-4 9333 使用中だと別の Chromium を操作／M-5 起動失敗待ちのループが止まらない／M-6 開発サーバのポート 5180 固定・台帳の写しが未作成／M-7 tools/ は型検査の対象外／M-8 コメントの食い違い 2 件／M-9 README の旧 CDP 節の 9222
PR #75 CodeRabbit(Minor 2件): fixed 敵の区画が同じ ID の味方の定義で描かれる — isAlly で units/enemies を選ぶ（描画ページなので自動テスト無し。unit-view 38 シート OK）
PR #75 CodeRabbit: fixed CDP のポートを取り違える（M-4 と同じ）— 起こす前にポートが空きか確かめ、繋ぐ前に /json/version の User-Agent の印で自分の Chromium かを確かめる。同じポートで 2 回起こす再現スクリプト ACCEPTED→rejected。Ruling: 計画の DevToolsActivePort 案・URL の印案は、この Chromium では書かれない／最初のページが chrome://newtab になるため使えず、User-Agent の印にした。競合（確認後に別の Chromium が取る）側の経路は再現していない
