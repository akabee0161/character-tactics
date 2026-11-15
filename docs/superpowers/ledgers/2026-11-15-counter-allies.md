# SDD ledger — plan: docs/superpowers/plans/2026-11-15-counter-allies.md
Spec: docs/superpowers/specs/2026-11-15-counter-allies-design.md
Pre-flight: T2/T3 consume T1 DamageParams.resist — consistent. T4 none. T5 independent. T6 consumes T1-T5 fields/skills/MAX_MEMBERS — consistent.
Ruling: 旧セーブの bonus に resist が無い場合の救済はしない（BONUS_KEYS に resist を足すだけ） — 依頼者が「旧セーブは気にしなくてよい」と指示（2026-11-15） — 旧セーブの村ボーナスが消えるが依頼者が許容
Task 1: complete (commits 9f2fed9..d6b482e, tests: npx vitest run →    Duration  32.67s (transform 1.67s, setup 0ms, collect 5.69s, tests 14.81s, environment 10ms, prepare 3.85s))
Task 2: Ruling: loader.test.ts の KNOWN_SKILLS と技の数（8→9）を更新 — 計画に書き漏れたが技を足すと必ず要る — 誤りでも影響なし。Task 3・4 でも同じく足す
Task 2: complete (commits d6b482e..f483d17, tests: npx vitest run →    Duration  30.81s (transform 1.71s, setup 0ms, collect 5.40s, tests 14.55s, environment 10ms, prepare 3.30s))
Task 3: complete (commits 3aa9de8..a19a310, tests: npx vitest run →    Duration  34.61s (transform 1.90s, setup 0ms, collect 5.97s, tests 16.04s, environment 13ms, prepare 3.74s))
Task 4: Ruling: 敵が歩けないマスの上の飛行の仲間を追う件は「例外を出さない」だけを確かめる（敵は経路が無く、近づけない） — 計画の指定どおり。壁越しに追わせるかは未定 — 飛行の仲間は壁の向こうから敵に狙われても安全になる
Task 4: Ruling: 急降下のダメージは skillHit のとおり守備を引かない（8 そのまま） — 他の技（火の雨）と同じ — なし
Task 4: complete (commits a19a310..9fd7696, tests: npx vitest run →    Duration  33.71s (transform 1.78s, setup 0ms, collect 5.70s, tests 16.81s, environment 11ms, prepare 3.40s))
Task 5: Ruling: 場に出る人の選びは「joins → roster → members」の優先で決めるが、場の並びは今のまま roster → members → joins にする — 計画どおり並べると加入者が先頭に来て uid（p1〜）と下の段の並びが変わり既存テストと画面が崩れる — 8 人を超えない限り挙動は変わらない
Task 5: Ruling: applyStageClear は benchedRecruits の仲間の記録が「無いとき」に加えて「初期値（レベル 1・経験値 0・ボーナスなし）のとき」も加わったときのレベルで書く — newSave は未加入の仲間も初期値で入れておくため、計画の「無ければ」だけでは一度も働かない — 初期値のまま実際に進めた記録は無いので誤っても実害なし
Task 5: complete (commits 9fd7696..e85956f, tests: npx vitest run →    Duration  31.73s (transform 1.68s, setup 0ms, collect 5.53s, tests 15.03s, environment 10ms, prepare 3.40s))
Task 6: complete (commits e85956f..b330ea4, tests: npx vitest run →    Duration  34.55s (transform 1.82s, setup 0ms, collect 6.17s, tests 17.07s, environment 10ms, prepare 3.50s))
Task 7: complete (commits b330ea4..a71d77d, tests: npx vitest run →    Duration  36.36s (transform 2.14s, setup 0ms, collect 7.08s, tests 16.73s, environment 12ms, prepare 3.83s))
Final review: 新しい目のレビュー 1 回（Critical 0・Important 2・Minor 4）
Final: fixed 戦闘中に 9 人目の仲間が場に出て下の段に出ない — events.test「倒れた味方も場の人数に数える」RED→GREEN, suite 1040/1040
Final: fixed 歩けないマスの上の飛行の仲間を狙った aggressive の敵が固まる — ai.test「飛行の相手」2 件 RED→GREEN, suite 1040/1040
Final: Ruling: 場の人数は倒れた味方も数える（下の段の枠が倒れた人も含めた先頭 8 人のため）。倒れた人の枠を新しい仲間に譲る案は採らない — 画面の枠と一致し最小の直し — 倒れた人がいると加入が記録だけになり、次のステージから出る
Final: Ruling: aggressive は歩けないマスの上の相手を追わず、届く相手がいなければ idle。弓・魔法の敵は射程内なら idle でも撃つ — 固まりを避ける最小の直し — 飛行の仲間が壁の向こうにいる間、近接の敵は寄ってこない
Final: minor (deferred): 村の加入の present 判定が save.members を見ない（工程 3 で出撃を選べるようになると、仲間が場にいないとき再加入の会話が出てレベルが戻りうる）
Final: minor (deferred): マップの端で飛行の 1 歩が clampToMap のあと敵との最小距離を少し破りうる
Final: minor (deferred): 飛行の影が先に描いたユニットの絵に重なりうる／マップ上のタップの当たり（unitBody）が持ち上げ 5px ぶんずれる
Final: minor (deferred): 開始時の加入が場に出られなかったときは benchedRecruits に入らずレベルが残らない（今のデータでは起きない）
