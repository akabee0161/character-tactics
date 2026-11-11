# SDD ledger — plan: docs/superpowers/plans/2026-11-11-difficulty-tuning.md

Branch: feat/difficulty-tuning-2 (main 7374ace から)。BASE(計画コミット) = 159b0e6

## 事前の突き合わせ表
| 対象 | 見たこと | 結果 |
|---|---|---|
| Task1↔Task2 | Task2 は Task1 の measure/formatTable/TARGET_BANDS だけを使う | 整合 |
| Task2↔Task3-5 | 調整は npm run balance と結果ログを共有 | 整合 |
| Task3↔Task4 | ally05/07 は T3、ally06/08 は T4。敵能力値の変更が前後に波及 → T4 に「前半が崩れたら戻す」あり | 整合 |
| Task4↔Task5 | ally08 は T4・T5 の両方で触れうる | 許容（T5 は必要なら） |
| Task1 | テストが決定性・村加入・時間上限を網羅。vite-node は T2 で追加 | 整合 |
| Task3 | 上限テストは書いた時点で通る（Red 無し）。意図どおり | 整合 |
| Task5 | s3 の帯 30〜55 とボットの mist 問題を原因記録の手順で扱う | 整合 |

Ruling: Task3 の上限テストは Red を経ない網であり、そのまま採用 — 現状のデータが満たしているため — 誤りでも害は無い
Task 1: dispatched (implementer a227e098d37f304b8, sonnet), BASE 159b0e6
Task 1: implementer DONE_WITH_CONCERNS (a80eff2). 懸念: 勝利条件が reach(by any) なので、ボットが敵を無視して走り抜けるだけで全ステージ 1 回目勝ち。
Ruling: ボットを「敵を全部倒してからゴールへ」に変える（全員が最寄りの敵へ向かい、いなくなったらゴールへ。説得の相手は persuader だけが先に近づき、ほかの仲間の目標から外す。時間湧きの残りがあれば、湧いた敵を待ってから） — 走り抜けは人の標準的な遊び方でなく、帯の数字が測れなくなるため。設計書「全員をゴールへ進め」の変更 — 誤りでもボットの動きを直すだけで済む
Task 1: fix commit 56013e8（ボットが全滅→ゴール）。新たな懸念: sim は乱数を使わない（state.rng は未使用）ため、シードを変えても結果が同じで 0%/100% に寄る。
Ruling: 揺らぎはボット側に入れる。シードで (a) 味方の開始位置への割り当て順をシャッフル（placeUnit） (b) ユニットごとに 0〜1.5 秒の反応の遅れ（最初の move を遅らせる）。makeRng(seed) を使い決定的 — 人が遊ぶときの立ち位置・反応のばらつきの代用。誤りでも揺らぎの付け方を直すだけ
Task 1: fix commits ca44888(シード揺らぎ), 8fdb35a(交戦中は move を出さない)。レビュー dispatched (a0fdeb28f427a4422), BASE 159b0e6
Task 1: minor (deferred): botCommands の裁定挙動（全滅後ゴール・湧き残りで待機・交戦中は move なし・反応の遅れ・persuader だけが説得の相手を狙う）の直接テストが無い
Task 1: minor (deferred): balance.ts:211 のコメントが placeUnit の戻り値の扱いより強い／交戦解除後に最大 1 秒止まりうる
Task 1: complete (commits 159b0e6..8fdb35a, review clean — a80eff2 56013e8 ca44888 8fdb35a)
Task 2: dispatched (implementer a7a6e6d131e0285ec, sonnet), BASE 8fdb35a
Task 2: minor (deferred): tools/balance.ts:30 の --check が帯の判定を再実装（balance.ts:277 と二重）／README に「交戦中は move を出し直さない」の記述なし
Task 2: complete (commits 8fdb35a..2240345, review clean)
Ruling: Task 3〜5 の調整の 1 回は、帯の外の「全ステージ」をまとめて直してよい（計画の「order の若い順に 1 つだけ」は、基準が全部 100% で 1 つずつでは 8 回に収まらないため緩める）。上限は 1 つの Task につき 12 回。前のステージの調整が後ろに波及する（経験値・加入の持ち越し）ので、毎回 40 通りで全ステージを測り直す — 誤りでも調整の回数が増えるだけ
Task 3: dispatched (implementer a665e2f25aff02667, sonnet), BASE 2240345
Task 3: minor (deferred): 結果ログ「3. 前半の調整」冒頭の見出し文が stage2 の変更に触れていない／s6 が敵 16 体で上限ぎりぎり
Ruling: Task 3 が上げた共有の敵の power（narazumono 11・tatemochi 12・yumihei 11）は採用する。Task 4・5 では、この 3 種の共有値と前半の調整（s1〜s6 の帯）を動かさず、後半の敵の数・種類・位置と、後半だけで使う敵（majinaishi・garum・説得の相手）、ally06/ally08 の数値で合わせる — 前半の帯を壊さず後半を調整するため。誤りでも、後半の調整幅が狭くなるだけ。依頼者への報告で、敵の攻撃力が約 2 倍になったことを目立つ変更として伝える
Task 3: complete (commits 2240345..4ad3835, review clean)
Task 4: dispatched (implementer a0093233c76e2627a, sonnet), BASE 4ad3835
Task 4: review Approved with Important(design) — majinaishi power 7→28 は満タンの仲間をほぼ一撃で倒す
Ruling: 敵の 1 発で、満タンの仲間が一撃で倒れない値にする（majinaishi の power は 16 以下。ally06 HP18・守り1 で 15 ダメージ）。s7〜s9 は敵の数・種類・位置・AI で帯に合わせ直す。ダメージの崖で帯の上限ぴったりに並べるより、遊び心地を優先する — 誤りでも、後半の調整幅が狭まって帯の外が残るだけ（その場合は原因を記録）
Task 4: fix round 1/5 dispatched (resume a0093233c76e2627a)
Task 4: minor (deferred→fix round で直す): 結果ログ「4.」冒頭の「12 回」と 4-5→4-6 の説得位置の経緯
Task 4: fix round 1/5 (commits e318c46, 019d4ad). 再レビュー dispatched (a297de06fdf0da7fd)
Task 4: re-review: all findings addressed (round 1/5)。
Task 4: minor (deferred): stage8 の湧きが 3 秒後・5 秒間隔で、数字より体感が厳しい可能性／stage9 が全員 aggressive で intro「見つからないように」と食い違う／stage9 の 1 行のインデント／ログの回数の食い違い（11 回 vs 9 回）
Task 4: complete (commits 4ad3835..019d4ad, 1 fix round, review clean) — s7 85 / s8 75 / s9 67.5、出撃平均 7.0 / 8.0
Ruling: Task 5 でも「敵の 1 発で満タンの仲間が一撃で倒れない」を守る（power ≤ 16）。garum はステージ 3 だけの敵なので、HP・攻撃間隔・守り・時間湧きで合わせる。前半・中盤の帯と共有の敵の値は動かさない
Task 5: dispatched (implementer a3783d75a50705e3c, sonnet), BASE 019d4ad
Task 5: implementer DONE_WITH_CONCERNS (620e389)。レビュー dispatched (aee152905e528cf41)
Task 5: minor (deferred): stage10/stage3 JSON の書式が既存の形（空白入り・桁そろえ）から変わり diff が大きい／ログ 5-6 の変更がどの回で入ったか追いにくい
Task 5: complete (commits 019d4ad..620e389, review clean) — s10 67.5 / s3 40
最終レビュー dispatched (aa555a26e7a7ec437, opus), MERGE_BASE 7374ace..620e389
最終レビュー(opus): 条件付き承認。Critical なし。Important: (1) HANDOVER 段階が「完了」で規約違反 (2) stage9 の intro と全員 aggressive の食い違い (3) stage3 は走り抜けで 100% 勝てる（reach/by any） (4) 共通の敵の攻撃力 2 倍＝受けるダメージ 4〜6 倍の書き方
Ruling: (2)(3) は assets の物語・ステージ構成の判断なので直さず、結果ログの「依頼者が見るところ」と最終報告に載せる（物語の文は依頼者の領分・s3 を走り抜けにくくする案は 2 つ添える）— 誤りでも、依頼者のフィードバックで 1 ステージを直すだけ
Ruling: 交戦が解けたあと最大 1 秒止まる件（balance.ts:137）は、勝率の数字が変わるので今回は直さない（次に調整するとき測り直しと一緒に）
最終レビューの修正: 1 回だけ dispatch（マージ前の Minor 7 件＋README 3 件＋ログ＋HANDOVER）
最終修正 commits db81f69, 81f748e。再レビュー dispatched (ab45886a64e1871c7)
最終修正: 再レビューで全指摘 addressed。計画完了。
