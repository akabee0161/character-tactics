# SDD ledger — plan: docs/superpowers/plans/2026-11-15-show-strength.md
Spec: docs/superpowers/specs/2026-11-15-show-strength-design.md
Branch start (review base): 0c4498a
Pre-flight: T2→T3 skillSummary/SkillDef.summary; T3→T4 StatCard/StageEnemy; T4→T5,T6,T7,T8 Overlay/drawStatCard; T3→T7 UnitStats(levelUp event); T3→T8 cardFromGain/statGains. 型の食い違いは見当たらない（各タスクで brief を読んで確認）。
Task 1: complete (commits 0c4498a..55e240c, tests: npm test →    Duration  38.73s (transform 2.08s, setup 0ms, collect 7.69s, tests 17.39s, environment 13ms, prepare 4.22s))
Task 2: complete (commits 55e240c..c8bf492, tests: npm test →    Duration  36.73s (transform 1.99s, setup 0ms, collect 7.55s, tests 16.64s, environment 12ms, prepare 3.81s))
Task 3: complete (commits c8bf492..fac1722, tests: npm test →    Duration  39.89s (transform 2.14s, setup 0ms, collect 8.23s, tests 17.18s, environment 17ms, prepare 4.41s))
Task 4: complete (commits fac1722..2938dc0, tests: npm test →    Duration  36.77s (transform 2.08s, setup 0ms, collect 7.36s, tests 16.65s, environment 12ms, prepare 3.84s))
Task 5: complete (commits 2938dc0..8538d72, tests: npm test →    Duration  39.15s (transform 1.95s, setup 0ms, collect 7.58s, tests 18.51s, environment 14ms, prepare 4.00s))
Task 6: complete (commits 8538d72..a5f96d4, tests: npm test →    Duration  39.63s (transform 2.00s, setup 0ms, collect 7.72s, tests 18.59s, environment 12ms, prepare 4.07s))
Task 7: complete (commits a5f96d4..4ca0d04, tests: npm test →    Duration  38.06s (transform 2.15s, setup 0ms, collect 7.89s, tests 16.92s, environment 12ms, prepare 4.03s))
Task 7: balance は工程 1 の結果の表と全ステージ同じ値（s4 92.5 / s5 97.5 / s6 97.5 / s7 47.5 / s8 89.7 / s9 43.6 / s10 22.2 / s3 37.5）
Task 8: complete (commits 4ca0d04..e49a2e9, tests: npm test →    Duration  39.44s (transform 2.15s, setup 0ms, collect 8.78s, tests 16.69s, environment 13ms, prepare 4.35s))
Task 9: Step 1 完了（見本 https://claude.ai/artifact/VsZvPngMFyCba6Q4Np2ecf を公開）。Step 2 は依頼者の承認待ち。承認前に Step 3 へ進まない
Task 9: Ruling: 印は見本の 3 案でなく、依頼者の指示で『上三角 1 形・色分け（橙=はげます／水色=結界）』にし、マップ上と下の段の両方に出す — 戦闘中は札を開かないため詳細は見られない点も依頼者が了承 — 見た目が合わなければ色・大きさだけの直し
Task 9: complete (commits e49a2e9..aedb976, tests: npm test →    Duration  42.28s (transform 2.21s, setup 0ms, collect 9.26s, tests 17.49s, environment 14ms, prepare 4.68s))
Task 10: complete (commits aedb976..d847d0c, tests: npm test →    Duration  39.87s (transform 2.27s, setup 0ms, collect 8.68s, tests 17.01s, environment 14ms, prepare 4.34s))
Final: fixed M1 斧の札に「守備で減る」と「守備を無視」が並ぶ — stat-card.test.ts の note のテスト RED→GREEN, suite 1053/1053
Final: Ruling: I1 戦闘中のレベルアップのセリフ（levelup:*）が出なくなった — 設計書 82 行目が「セリフ欄を消す」と決めており実装は設計どおり。使い方（札に入れる／閉じた後に出す／廃止）は依頼者が決めること — 15 行のセリフが使われないまま残る
Final: Ruling: M2 結果の画面の「上がった能力」に村でもらった能力（statBonus）が含まれる — 設計書は「そのステージ全体で上がった分をまとめて出す」としており、直すなら含めるかの判断が要る — 守備+1 などが「レベルアップ」の行に出て誤解されうる
Final: minor (deferred): M3 敵の一覧は 6 行までで、7 種類の敵が出るステージを足すと 7 行目が閉じるボタンと重なる（stage-limits と同じ形のテストを足せる）
Final: minor (deferred): M4 titles・counters を持つ古いセーブを読むテストが無くなった（Task 1 で足したテストは残っている。fixture の古いセーブは新しい形に直した）
Final: minor (deferred): M5 称号を消した後に読まれない値が残る（skill イベントの hits・unitDefeated.neraiuchi・Unit.lastHitNeraiuchi・damage.ts のコメント）
Final: minor (deferred): M6 レベルアップの札は出た直後の 1 タップでも閉じる（設計書どおり）
Final: minor (deferred): M7 別の指でステージ一覧をドラッグ中に札を開くと、札の下で一覧が動き続ける（見た目だけ）
