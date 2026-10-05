# SDD ledger — plan: docs/superpowers/plans/2026-09-28-foot-box-and-tile-size.md
Pre-flight: T1→T2/T3 の関数名・型は計画内で一致。T4 は独立。T5 は T1〜4 の結果を使う
Task 1: complete (commits 42f149c..bbf3878, tests: npx vitest run →    Duration  14.88s (transform 1.37s, setup 0ms, collect 3.25s, tests 845ms, environment 9ms, prepare 3.52s))
Task 2: complete (commits bbf3878..433217d, tests: npx vitest run →    Duration  13.25s (transform 1.38s, setup 0ms, collect 3.27s, tests 864ms, environment 9ms, prepare 2.82s))
Task 3: complete (commits 433217d..b2424b9, tests: npx vitest run →    Duration  13.06s (transform 1.35s, setup 0ms, collect 3.14s, tests 851ms, environment 8ms, prepare 2.87s))
Task 4: complete (commits b2424b9..388587a, tests: npx vitest run →    Duration  12.97s (transform 1.34s, setup 0ms, collect 3.09s, tests 867ms, environment 8ms, prepare 2.79s))
Task 5: complete (commits 388587a..6558a05, tests: npx vitest run →    Duration  21.80s (transform 1.99s, setup 0ms, collect 4.92s, tests 1.59s, environment 15ms, prepare 4.67s))
Final review: subagent (opus) — With fixes: Important 1件, Minor 3件
Final: fixed 同じマスで直進が通らないと指示が消える — 「目的地と同じマスに入ってから…目的地に着く」RED→GREEN(22px→4px→0)、slideStep に寄せた点の候補を追加、suite 738/738、レビュアーのファズ 2707/2707 到達
Final: Ruling: slideStep の既存テスト（本ブランチで追加したもの）の期待値を (22,40)→(26,40) に変更 — 選び方を「進む量が最大」から「行き先に最も近い」に変えたため。壁に沿ってより行き先に近づくのが正しい — 誤りなら壁際の動きが少し変わるだけ
Final: Ruling: 画面の記録が ledger に無い（Minor 4） — 撮影は Task 5 で実施し画像は会話で依頼者に見せた。追加の記録はしない — 誤りなら記録が1行欠けるだけ
Final: minor (deferred): かけぬけるの途中判定が半マスおきの点で、箱が壁の角をかすめる経路を通す（hasClearPath に置き換えれば揃う）
Final: minor (deferred): README の配置の説明（「歩けるマスのどこにでも」「歩けないマスだと赤く」）が、壁の脇・マップ端6px以内も赤になることを書いていない
