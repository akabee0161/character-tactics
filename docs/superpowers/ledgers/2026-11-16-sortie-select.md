# SDD ledger — plan: docs/superpowers/plans/2026-11-16-sortie-select.md
Pre-flight: T1→T2 sortie.ts関数をstate.tsが使う / T1→T5 toggleSortie・lockedIdsをoverlayが使う / T2→T6 rebuildForSortie / T3→T6 save.sortie / T4→T6 カードline / T5→T6 overlay・layout。型の食い違いは計画上なし。
Task 1: complete (commits ba28ab7..cfe8e32, tests: npx vitest run src/core/sortie.test.ts src/render →    Duration  4.38s (transform 1.04s, setup 0ms, collect 1.67s, tests 97ms, environment 2ms, prepare 735ms))
Task 2: Ruling: 既存テスト「開始時の加入は、場に出られなくても joined に入る」の期待を 1 人→2 人に直した — 設計の優先（外せない仲間 → 開始時の加入 → …）で、stage[0] の外せないロランが先に 1 枠を取るため。旧コードは joins を roster より先にしてロランも外れていた — 実ステージの 8 人以下・ボットの勝率は不変（balance で確認）
Task 2: balance 勝率は台帳 show-strength Task 7 と全ステージ同じ（s4 92.5 / s5 97.5 / s6 97.5 / s7 47.5 / s8 89.7 / s9 43.6 / s10 22.2 / s3 37.5）
Task 2: complete (commits cfe8e32..6362f3d, tests: npm test →    Duration  44.79s (transform 2.43s, setup 0ms, collect 9.26s, tests 20.21s, environment 13ms, prepare 4.80s))
Task 3: complete (commits 6362f3d..5037aa2, tests: npm test →    Duration  44.91s (transform 2.49s, setup 0ms, collect 9.88s, tests 17.77s, environment 15ms, prepare 5.16s))
Task 4: complete (commits 5037aa2..5d1848b, tests: npm test →    Duration  45.04s (transform 2.66s, setup 0ms, collect 10.80s, tests 17.99s, environment 14ms, prepare 4.93s))
Task 5: 型エラー1件（main.ts の drawEnemyList に sortie が渡る）は Task 6 で直す前提で、vitest のみでコミット
Task 5: complete (commits 5d1848b..88ee6f8, tests: npm test →    Duration  44.36s (transform 2.35s, setup 0ms, collect 10.10s, tests 17.17s, environment 14ms, prepare 5.19s))
Task 6: Ruling: 敵の一覧の行の文字「押すと 札 ›」を「押すと カード ›」に直した — 設計は『画面の文字に札は出ていない』としていたが実際に 1 か所出ていた。依頼者の『札→カード』の指定に合わせた — 誤りでも 1 行の文字の差
Task 6: complete (commits 88ee6f8..1a03f9c, tests: npm test →    Duration  42.00s (transform 2.32s, setup 0ms, collect 9.36s, tests 17.58s, environment 14ms, prepare 4.56s))
Task 7: complete (commits 1a03f9c..24f53b7, tests: npm test →    Duration  44.02s (transform 2.53s, setup 0ms, collect 10.03s, tests 17.52s, environment 14ms, prepare 4.98s))
Final: review (fable) — Critical 0 / Important 0 / Minor 6。Ready to merge: Yes
Final: minor (deferred): 候補が 16 人以上になると出撃の一覧が崩れる。仲間数の上限を確かめるテストが無い（layout.ts の 15 枠）
Final: minor (deferred): 「強さ」ボタンが小さい（52×26。スマホで約 37×19px）。当たり判定だけ広げる案
Final: minor (deferred): 開始時の加入を外してクリアすると、結果の画面の 8 件表示から 8 人目が落ちる（flow.ts・main.ts）。結果の画面を触る工程で扱う
Final: minor (deferred): HANDOVER の「ステージ 6 以降」は誤り（初回に分かれるのはステージ 7）→ 依頼者の確認に誤解を生むため HANDOVER の 1 文だけ直した
Final: minor (deferred): 途中コミット 88ee6f8 は型エラー 1 件（次のコミットで解消。直さない）
Final: Ruling: 計画の台帳の写し（reviewer の Minor 5）— 計画を終えたので docs/superpowers/ledgers/ に写してコミットする（CLAUDE.md の決まり）— 写さないと決まりに反する
Final: Ruling: 戦闘中に加わった仲間が前回の出撃に入らない、挑み直しで導入の会話が再び流れる、ボットの村の判定が membersBefore を見ない（reviewer の Declined to judge）— 設計どおり・既存の挙動でこの工程の範囲外として据え置く — 依頼者のテストプレイで気になれば工程 5 で扱う
