# SDD ledger — plan: docs/superpowers/plans/2026-11-18-clear-score.md
Pre-flight: Task2→Task1 (技の距離 limitReach) / Task3→Task2 (突っ込み列) / Task4→Task3 (表の秒) / Task6→Task4,5 (rankFor, ClearRecord): 型は計画どおり、衝突なし
Task 1: Ruling: 既存の駆け抜ける・急降下のテスト 4 件が 4 マスを超える距離を指していたため、距離を 4 マス以内に直した（sim.test.ts 含む）— 仕様の変更の結果 — 誤りでも影響はテストのみ
Task 1: complete (commits d7d54f5..ebb0972, tests: npm test → 1230 passed)
Task 2: balance 測定（技の距離 4 マス後・配置はまだ元）: 通し s1 100/s2 100/s4 100/s5 100/s6 92.5/s7 77.5/s8 65.0(帯外)/s9 70/s10 55.0(帯外)/s3 21.1(帯外 45〜70)。育てた s3 60.5(帯外)。突っ込みは s2・s5・s8 で歩き・ガウ 100%、s8 は飛行 100%。工程 5 の値（s10 60.0・s3 47.5・育てた s3 82.5）から下がったのは Task 1 の技の距離（ボットの駆け抜ける・急降下が敵まで届かない）の影響。Task 3 で配置などを直す前提。表は .superpowers/sdd/.../balance-task2.txt
Task 2: complete (commits ebb0972..HEAD, tests: npm test → 1241 passed)
Task 3: 停止（依頼者に戻す）— 突っ込みを配置だけでは止められない。測った事実: (1) ゲームの決まりで 1 人の相手を同時に攻撃できる敵は 1 体だけ（sim.ts の claimed）。(2) 突っ込みの歩き=ガウは 0.65 秒で 4 マス跳び、8 秒後にまた跳べる。(3) ステージ 2 に敵 12 体で上下 2 本の壁（ゲートと側道を全部ふさぐ）を作ると、ガウは 4〜8 秒止まるが、8 秒で跳び越えて勝つ（7/10）。駆け抜けるの再使用を 14 秒にすると 0/10、通し 10/10、育てた 10/10。(4) 通し・育てたの低下は技の距離の影響が大きい（stage3 21.1%）。ステージ 2 の配置の変更は破棄して元に戻した。
Task 3: Ruling: 依頼者の返事「再使用までの時間を延ばす」に従い、駆け抜ける・急降下の cooldown を 8/10 → 14 秒にした — 突っ込みを壁で止めると 8 秒後の再使用で跳び越えて勝つため — 誤りなら skills.json の 2 つの数字を戻すだけ（突っ込みが再び通る）
Task 3: Ruling: 敵の配置は「ゴールの手前の壁」。壁の敵は guard（leash 2・sightRange 140〜150）で持ち場を離れない。1 人の相手を同時に攻撃できる敵は 1 体（sim.ts の claimed）で、最初に交戦した敵が相手を握るため、壁に使う敵は射程が長いまじない師より近接・弓兵が良い。間隔は 24〜40px（敵どうしは押し合わず、すき間が 48px 以下なら通れない）。端の敵は壁の縁から 11px に置く（20px だとすり抜けた）
Task 3: Ruling: stage2 = 上のゲート 4 マスと側道 2 マスの 6 体（今の敵 4 体を移し 2 体を足す）。stage5 = 森の 6 マス幅の列 6 体（今の 4 体を移し 2 体を足す）。stage3 = 行 13・14 の 2 つの出入り口に 4 体ずつ 8 体（今の敵 8 体を移す。ガルム付近は動かさない）。stage10 = 城門の脇の 2 つの通路に 3 体ずつ 6 体（今の敵 6 体を移す）。stage8 = 飛行のピコが家や柵を越えるため、ゴールを囲む半円の 9 体（今の 6 体を移し 3 体を足す。時間湧きのならず者 3 体を削って敵の総数 16 に収める）
Task 3: Ruling: 帯に戻すために動かした数字 — stage3・stage10 の enemyLevel 17 ではなく 16（遊ぶ順に下がらない）、stage3 の壁は近接より魔法の方が倒しやすいため魔法 6・近接 2 の組み合わせ、stage8 の壁の新しい 3 体は盾持ち、growth.json の clearXp 10→12（stage9 の帯の下端 65.0 に収めるため。全ステージに少しずつ効く）
Task 3: 最終測定 balance --check 終了コード 0（balance-task3-final.txt）。通し s1 100/s2 100/s4 95/s5 95/s6 92.5/s7 82.5/s8 90.0/s9 65.0/s10 79.5/s3 64.1。育てた s3 92.3。突っ込みは全ステージ 0%（stage8 は飛行も 0%）。端の値が多い（s8 90.0・s9 65.0・s10 79.5）。依頼者の承認待ち（変える前後の画像）
Task 3: complete (commits 690e424..aa6ce0c, tests: npm test → 1241 passed（enemy-looks の並びを直した後）、balance --check → 0)
Task 4: Ruling: 目安の時間は依頼者が表（Artifact）で承認した案のまま。急ぎは手で遊ばずボットで測った（計画の変更どおり）。Task 4: complete (commit 12fc60f, tests: npm test → 1250 passed)
Task 5: complete (commit f0647af, tests: npm test → 1261 passed。SAVE_VERSION は上げない)
Task 6: Ruling: 依頼者が「承認を経ずに進める。確認ポイントは最後にまとめて確認する」と指示（2026-11-19）。見せた画面（Artifact 11UmD5W2SFAP9Wd9aYegog）の承認は取らずにコミット。Task 6: complete (commit be17929, tests: tsc 通過・npm test は Task 7 で)
Final review: 最初の依頼（fable）は月の利用上限で失敗したため、opus で再依頼（ledger: 最も能力の高いモデルが使えなかった）。
Task 7: 実施: 最終測定・全テスト・ビルド・HANDOVER。最終レビュー後に再測定したため、Task 7 の最初の測定（balance-t7）は下の Final で置き換え
Final: review (opus, a98ffcdc29df6785b): Critical 1・Important 0・Minor 5（+引き継ぎメモ 1）。fable は月の利用上限で失敗
Final: fixed Critical「技を壁の前まで取っておくとガウ 1 人で stage1・2・4・6・7 を抜けられる」— 作業用ボット smartrush.ts で再現（5/5 など）→ 測定のボットを同じ動きに変え、駆け抜ける・急降下に startCooldown 14 秒を足した。テスト: skills.test の startCooldown 2 件・balance.test の rushCommands の取っておく／出す条件 2 件を先に書いて RED→GREEN、suite 1265/1265 通過。smartrush で stage2 以降 0%
Final: Ruling: startCooldown は依頼者が決めた「再使用の時間を延ばす」の延長（戦闘の開始からの再使用待ち）として入れた — 取っておかれると再使用の時間だけでは壁を跳び越えられるため — 誤りなら skills.json の startCooldown を 0 にする（突っ込みが再び通る）
Final: Ruling: 再測定で動いた通しの勝率を、stage6・7 の enemyLevel 6→5、stage8・10・3 の壁の一部を盾持ちに替えて帯へ戻した（端の値: stage2 95.0・stage8 90.0・stage10 80.0）— 誤りなら balance --check が帯の外を出す
Final: Ruling（未解決）: stage1 は突っ込みが歩き・ガウとも 100%。敵 3 体・15 マス幅の開けた野原で、壁が作れない（ゴールを囲む半円でも約 14 体）。決まり（突っ込みの上限）を緩めず、作業を止めて依頼者に戻す（案は結果の文書の 6 節）。--check は終了コード 1
Final: minor (deferred): 前と同じ秒に見えても「記録更新！」が出る（60.9→60.1 秒。比較は小数、表示は切り捨て）
Final: minor (deferred): 結果の画面の時間の行が 2〜4px 右へずれる（評価の幅を 22px の字で測り、26px の太字で描く）
Final: minor (deferred): 「駆け抜ける」が止めた所が壁で出なかったとき、画面で分からない
Final: minor (deferred): 突っ込み（歩き）と（ガウ）は同じ人を測る（ガウが一番足の速い歩く仲間）。技を持たない歩く仲間は測っていない
Final: minor (deferred): maxCells を 0 にすると距離の上限が外れる（今は 4）
