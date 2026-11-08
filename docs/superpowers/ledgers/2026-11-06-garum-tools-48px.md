# SDD ledger — plan: docs/superpowers/plans/2026-11-06-garum-tools-48px.md
Spec: docs/superpowers/specs/2026-11-06-garum-unit-design.md
Pre-flight: T1→T2 cfg.scale/UnitFixture(size=48)/core48 — consistent
Pre-flight: T1→T3 cfg.size — consistent
Pre-flight: T1→T4 scale_for/ScaleError; T2 removes head_cover's DEFAULT_BANDS import before T4 deletes it — order ok; T4 unskips T1's fixture test — ok
Pre-flight: T1→T5 scale_for — consistent
Task 1: complete (commits 607af93..7e0aea8, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests' → OK（738 件、skip 1））
Task 2: complete (commits 7e0aea8..cadefd3, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | grep -E '^(Ran|OK|FAILED)'' → OK (skipped=1))
Task 3: complete (commits cadefd3..97800bd, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests > /dev/null 2>&1 && echo 'unittest OK'' → unittest OK)
Task 3: Ruling: test_48_uses_47 は計画の「right を 31 − x で反転」ではなく right の剣だけを 16 左へずらして作った — 31 − x で反転したコマ全体は組み立てで止まりテストの前提にならない — 誤りなら影響はテストの作り方だけ
Task 4: Ruling: weapon_check は scale_for を使わずコマの行数だけで端と中心を決める（ScaleError を出さない） — 比率の値を使わないので大きさの表に縛る理由が無く、大きさの検査は unit_config・unit_check・body_check が先に止める — 誤りなら 40px のコマが weapon_check だけ通る
Task 4: complete (commits 97800bd..1c1bee6, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests > /dev/null 2>&1 && echo 'unittest OK'' → unittest OK)
Task 5: Ruling: sheet.py の足元は scale_for(frame).foot でなく frame − FOOT_INSET(2) — 既存のテストが 4px のコマで preview を呼び、表に無い大きさで止めると壊れる。32・48 では同じ値（30・46）でゲームの FOOT_INSET とも同じ — 誤りなら 32・48 以外のシートでも足元の線が出るだけ
Task 5: Ruling: anim_compare は load_states の戻り値を変えず、別の load_frame_size(path) を足した — 既存の呼び出しとテストを変えずに済む — 誤りなら関数が1つ多いだけ
Task 5: Ruling: unit_picker は素体と手本（refs）の大きさがそろわなければ止める — ページが1つの大きさで全部を描くため。ガルムの横に 32px のロランを手本として並べることはできない — 誤りなら CP1 で大きさの比べ方を別に用意する
Task 5: complete (commits 1c1bee6..64e9e8c, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests > /dev/null 2>&1 && echo 'unittest OK'' → unittest OK)
Task 6: Ruling: 台帳の写しは最終レビューの後に別のコミットで入れる — 計画の Step 4 の時点では最終レビューの結果が台帳にまだ無い — 誤りならコミットが1つ増えるだけ
Task 6: complete (commits 64e9e8c..94e6cde, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests > /dev/null 2>&1 && .venv/bin/python tools/validate.py > /dev/null 2>&1 && echo 'unittest OK, validate OK, 32px diff none'' → unittest OK, validate OK, 32px diff none)
Final: Ruling: hand_outline.HAND_MAX（Minor 2）を Important に上げた — 48px の拳（9〜15画素）で weapon_check の「拳が柄の真ん中」が黙って飛ばされ、ガルムで判定が抜ける — 誤りなら直しが1つ余計なだけ
Final: fixed 48px の拳の上限 hand_max=27（12×1.5²） — test_48_large_fist_off_the_middle_fails・test_48_large_hand_gets_outline・test_hand_max_scales_by_area RED→GREEN, suite 773/773
Final: Ruling: hand_max を表に足したので weapon_check も scale_for を使い、表に無い大きさは WeaponCheckError（終了2）にした（Task 4 の Ruling を改める） — 誤りなら 40px のコマが weapon_check でも止まるだけ
Final: fixed 道具を単独で使ったとき、正方形でないコマと大きさの混ざりで止める（body_check・unit_check。Minor 1、依頼者の方針で PR 前に直す） — test_non_square_stops・test_mixed_sizes_stop・test_mixed_sizes_in_a_directory_stop RED→GREEN, suite 773/773
Final: fixed SPEC の部品の大きさの説明（Minor 4）
Final: minor (deferred): tip_rule.MAX_WIDTH=4 で、ガルムの太い剣の刃の中身が5画素以上だと決まりの外で落ちる。第2段階で剣を描く前に確かめる（コードは変えない）
Final: Ruling: anim_compare に 32px の設定と 48px のシートを渡すと左上だけ再生する — この PR より前からの動きで、ガルムでは起きない組み合わせ — 誤りなら比較ページが一部だけ映る
32px regression after fixes: unit_rules・compose --check・sheet.py の出力とプレビューが基準と差なし
