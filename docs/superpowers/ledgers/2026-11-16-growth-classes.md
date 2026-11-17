# SDD ledger — plan: /home/ubuntu/workspace/character-tactics/docs/superpowers/plans/2026-11-16-growth-classes.md

Pre-flight: T2 (statsForLevel(def, level, bonus), growth 必須) → T3 (makeEnemyUnit に level、enemyLevelXp を使う): T2 が enemyLevelXp を growth.json に足し T3 が使う。整合。
Pre-flight: T2 statsForLevel → T4 skillAmount(power)/T5 statLabel・enemyCard: statsForLevel の新シグネチャを T5 が使う。整合。
Pre-flight: T1 の balance 仕組み → T7/T8 が帯と平均Lv を使う。整合。
Pre-flight: T7 承認待ちの停止点、T8 は大きな変更のみ承認、T9 は画面承認。
Task 1: Ruling: 計画の goalSafeDest だけでは s6 の敵が残る勝ちが 94.9% 残った。原因 3 つ — (a) 押し出し先が石のマスで、ゲームが最寄りの歩けるマス（ゴールの中）に置き換える (b) s6 は左上の部屋への最短の道がゴールを横切る (c) 駆け抜ける等の技の dest — を、walkableSafeDest・routeAvoidingGoal（円を歩けない地図の道をたどる中継点、キャッシュ付き）・技 dest の押し出しで直し全ステージ 0.0 — 計画の「経路にも効かせる」の範囲 — 誤っても測定が甘く出るだけ
Task 1: Ruling: walkableSafeDest・routeAvoidingGoal のテストは、測定で不具合を確かめて直した後に書いた（先にテストは書いていない。dbg の再現で RED 相当は確認） — 回帰テストとして残す
Task 1: Ruling: 結果の文書の「直す前」の敵が残る勝ちは HANDOVER の記録（s6 94.1・s7 55.9・s9 3.3）。ほかは記録なし
Task 1: 測定 stage3 クリア後の平均Lv 10.4（出撃 8 人）、約 3.5 分（40 シード）。CLAUDE.md の所要時間は Task 9 で直す
Task 1: complete (commits cb44280..dd5b97c, tests: npm test →    Duration  140.18s (transform 4.95s, setup 0ms, collect 22.97s, tests 80.71s, environment 34ms, prepare 11.82s))
Task 2: Ruling: progress.test.ts「全ステージを通せば上限レベルに届く」は旧設計（上限 12）の保証 — 設計は「通しで最後に 15〜18、30 は稼いだとき」なので「通しだけでは上限に届かない」に反転 — 経験値の数字は Task 7 で決め直し、その時このテストの意味（床の見積り < 上限までの合計）を再確認する
Task 2: growth の仮値は全員 {1, 0.34, 0, 0, 0}（今の成長と同じ）。MakeUnitArgs から growth を消した（statsForLevel が def.growth を使うため）
Task 2: complete (commits dd5b97c..acca1d7, tests: npm test →    Duration  57.10s (transform 2.29s, setup 0ms, collect 9.83s, tests 31.62s, environment 16ms, prepare 5.00s))
Task 3: complete (commits acca1d7..7b36fe6, tests: npm test →    Duration  53.13s (transform 2.18s, setup 0ms, collect 8.84s, tests 30.31s, environment 13ms, prepare 4.25s))
Task 4: complete (commits 7b36fe6..782af55, tests: npm test →    Duration  72.86s (transform 2.25s, setup 0ms, collect 9.04s, tests 49.46s, environment 17ms, prepare 4.37s))
Task 5: complete (commits 782af55..96ea7ea, tests: npm test →    Duration  73.25s (transform 2.17s, setup 0ms, collect 9.09s, tests 49.76s, environment 13ms, prepare 4.39s))
Task 6: Ruling: M5 は skill イベントの hits・unitDefeated の neraiuchi・Unit.lastHitNeraiuchi・damage.ts のコメントを消した（grep で src の非テストに読み手が無いことを確認。hit イベントの neraiuchi は effects.ts が読むので残す） — 効果の戻り値（当てた数）は null 判定に使うので残し、コメントに「数は今は読まれない」と書いた — 誤っても描画・会話は無影響
Task 6: Ruling: 称号の残骸のテスト「ねらいうちで倒すと kill:neraiuchi が増える」（assertion なし）を削除した — 名前が消えた機能を指し、何も確かめていなかった
Task 6: M4（古いセーブ）と仲間の数のテストは今のコードで最初から通る（計画の想定どおり）。止めるためのテストとして残す。「強さ」の当たり判定は sortieStrengthHit（80×44、枠の右下）を足した（RED を確認済み）
Task 6: complete (commits 96ea7ea..2c027fb, tests: npm test →    Duration  72.62s (transform 2.15s, setup 0ms, collect 8.68s, tests 49.74s, environment 13ms, prepare 4.35s))
Task 1 追補（Task 7 の測定で発見）: Ruling: s6 で 10% の試行が敵が残ったまま勝った — 壁沿いのすべりで円の縁（40〜54）に入る。円の中にいる点からは walkableSafeDest で外へ出る点を返し、縁（半径 + 14）の内側へ入りかけた味方には 60 tick を待たず move を出し直す（GOAL_ALERT_MARGIN）。20 シードで全ステージ 0.0 — 誤っても測定が甘く出るだけ
Task 7: 停止中（依頼者の承認待ち）。assets・registry.test.ts・skills.test.ts などは未コミット。数字の元は .superpowers/sdd/2026-11-16-growth-classes/numbers.mjs（node numbers.mjs で書き込む。加入レベルは stage JSON を直接編集済み）。表の Artifact: https://claude.ai/artifact/RGFUfkwoBTPqEG4ufHdH93
Task 7: Ruling: 技の基本量 omajinai heal 7・kakenukeru 2・hinoame 3・tsuki 4・tatakiwari 6・kyuukouka 3（足す攻撃力のぶん下げた） — enemyLevelXp 2（敵のレベルで稼ぎが増える） — enemyLevel s1 1/s2 2/s4 3/s5 5/s6 6/s7 7/s8 9/s9 9/s10 10/s3 15（20 シードの測定で通しの帯に近づけた。設計の「最後で 16 くらい」より 1 低い） — 加入レベルは前のステージ着時の平均レベルの 1〜2 下
Task 7: 20 シードの測定（通し/育てた/平均Lv）: s1 100/100/3.0, s2 100/100/4.5, s4 95/100/6.1, s5 100/100/7.5, s6 100/100/9.0, s7 70/95/10.3, s8 90/95/11.5, s9 65/90/12.9, s10 80/95/14.6, s3 50/85/15.5。敵が残った勝ちは全ステージ 0.0。帯の外は s7（通し 70）だけ（Task 8 で調整）
Task 7: 依頼者の指示で数字を変更（承認待ちのまま）: ロラン 攻撃の伸び 0.35→0.6・守備 0.7→0.55／ボルグ 守備 0.8→1.0／ガンツ 守備 0.75→0.95／イネス・ユナ 攻撃 1.05→0.85／シオン 攻撃を魔法（range 120・間隔 2.4・魔力の伸び 0.55）に変更
Task 7: Ruling: シオンの「攻撃のかわりに回復」は実装しない — 通常攻撃で味方を回復する仕組みは無く、新しい攻撃種類を戦闘・AI・描画に足す必要があり、設計の「新しい仲間・敵・技を足すこと」を目標にしないに当たる。依頼者は「難しければそのままでよい」と言った — 後で欲しければ別の工程で
Task 7: complete (commits 2c027fb..c0f11d7, tests: npm test →    Duration  58.25s (transform 2.30s, setup 0ms, collect 9.12s, tests 32.53s, environment 17ms, prepare 4.84s))
Task 7: 依頼者が表を承認（ロラン・ボルグ・ガンツ・イネス・ユナ・シオンの指示を反映した版 3）
Task 8: Ruling: 帯に合わせるため まじない師の攻撃の伸び 0.4→0.3、ガルムの伸び（HP 2.5→2.2・攻撃 0.6→0.5）、敵のレベル s8 9→10・s9 9→8・s3 15→14 を変えた — 役割の強さの順は入れ替わらない（依頼者に見せた表からの大きな変更ではない）ので承認は取らない — stage3 の敵のレベルは設計の「16 くらい」より 2 低い。15・16 では通しが帯の下に出た
Task 8: --check 終了コード 0（40 シード）。stage3 通し 45.0・育てた 82.5 は「端」。stage3 のクリア後の平均Lv 15.5。BAR_MAX を HP 120・攻撃 40・守備 36・魔法防御 36 に（テスト追加）
Task 8: complete (commits c0f11d7..101b45c, tests: npm test →    Duration  54.95s (transform 2.18s, setup 0ms, collect 9.06s, tests 29.44s, environment 19ms, prepare 4.75s))
Task 9: 画面を依頼者が承認。README・CLAUDE.md・HANDOVER を更新、撮影・表・数字の道具を削除（ワークスペースの測定ログは最終レビュー後に消す）
