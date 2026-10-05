# SDD ledger — plan: docs/superpowers/plans/2026-09-28-asset-size-conventions.md
Pre-flight: Task2→Task3 FACE_PX 整合OK。Task2 の hpBarIn(y+66..73) が技のゲージ(y+70..75, screens.ts:222)と重なる
Task 2: Ruling: hpBarIn を y+62 (h7) にし、技のゲージより上のテストを足す — 依頼者が案1を選択(2026-09-28) — 誤りなら1行の座標変更
Task 1: BASE 8ca4287
Task 1: complete (commits 8ca4287..a0ee90c, tests: npm test →    Duration  13.69s (transform 1.44s, setup 0ms, collect 3.32s, tests 854ms, environment 9ms, prepare 2.95s))
Task 2: complete (commits a0ee90c..2d6625f, tests: npx vitest run →    Duration  13.19s (transform 1.39s, setup 0ms, collect 3.16s, tests 811ms, environment 8ms, prepare 2.84s))
Task 3: complete (commits 2d6625f..e9d6443, tests: npx vitest run →    Duration  15.00s (transform 1.48s, setup 0ms, collect 3.42s, tests 904ms, environment 10ms, prepare 3.35s))
Task 4: complete (commits e9d6443..d61497e, tests: npx vitest run →    Duration  17.73s (transform 1.75s, setup 0ms, collect 4.09s, tests 1.07s, environment 23ms, prepare 4.04s))
Final review: subagent (opus) — Ready to merge: Yes, Critical/Important なし
Final: minor (deferred): 128px→32px(1/4縮小)では imageSmoothingQuality が low のままで線が欠けうる
Final: minor (deferred): layout.test の顔中心 36 が screens.ts の値の写し
Final: minor (deferred): README「役割アイコン（32px）」— 敵の role-teki*.png 3枚は 64×64
Final: minor (deferred): 下のバーの「倒れた」文字がクラスの枠と重なる（変更前から）
