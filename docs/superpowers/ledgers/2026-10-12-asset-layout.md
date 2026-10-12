# SDD ledger — plan: docs/superpowers/plans/2026-10-12-asset-layout.md
Pre-flight: T2→T3/T4 gen/enemy の mkparts/mkframes/mkweapons（名前一致）; T4 part_path → move_parts/compare_regen（一致）; T4 parts_export.export(part_root) → ines_layers/roran_layers（一致）。衝突なし
Task 0: complete (no commits; baseline in before/: 52 sheets, 1096 blobs, validate 405, unittest 425 OK, compose 0/0/16)
Task 1: complete (commits cfcc856..0b7330a, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests' → ok   /tmp/tmp86k5qz6y/tmp9hpur12q_attack.gif  1 frame(s) at 6fps (170ms))
Task 1: note: unittest 406 OK（425 − 消したテスト19）
Task 2: complete (commits 0b7330a..64e9368, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | grep -E '^(Ran|OK|FAILED)'' → OK)
Task 2: note: regen 782/782 同じ
Task 3: complete (commits 64e9368..ef3074f, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | grep -E '^(Ran|OK|FAILED)'' → OK)
Task 3: note: sheets 同じ, validate 1077, regen 781/782（PICKER_female の refs だけ。計画は2件と書いたが refs は女性用だけ）
Task 4: complete (commits ef3074f..dddc19f, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | grep -E '^(Ran|OK|FAILED)'' → OK)
Task 4: note: 344 files moved, sheets 同じ, blobs 同じ, validate 1185, compose 0/0/16, regen 782/782, unittest 413 OK. Ruling: test_unknown_name_stops に 'female_' を足した — part_path の female_ 単独の分岐を確かめるため — 外れても テスト1件
Task 5: complete (commits dddc19f..d9549cc, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | grep -E '^(Ran|OK|FAILED)'' → OK)
Task 5: note: unittest 423 想定、ines の再生ページをヘッドレスで撮り、歩きの足元が時間で変わるのを確認
Task 6: note: 確かめ方1 で ines.png だけ控えと違った — 控えの build/sheets/ines.png が PR #32 前の古いファイル（enemy_build --all はイネスを作らない、Task 5 で sheet.py が作り直した）。86adaf4 のコマから作ったシートと今のシートは同じ f54d51… を確認
Task 6: complete (commits d9549cc..3794941, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | grep -E '^(Ran|OK|FAILED)'' → OK)
Task 6: note: 確かめ方 1(イネスは上の注記) 2:0/0/16 3:同じ 4:782/782(Task4) 5:1185 6:423 OK 7:ok 8:npm test 776 pass・build ok 9:古いパス無し。weapon_check の SPEC 例は整理前と出力同じ。Ruling: CLAUDE.md の unit_picker の例の出力名を build/picker/gau.html から enemy.html にした — 読む設定が gen/enemy/PICKER.json（敵の部品）になったため — 外れても例の名前だけ
Final review: opus 新しいレビュアー、修正すればマージ可
Final: fixed parts_export がほかのユニットの部品を黙って上書きする — test_part_used_by_another_unit_is_not_overwritten RED→GREEN, suite 424/424
Final: fixed ISSUES.md に消した試作（mklayers・build_layers）の行が2つ残っていた — 文書のみ（テストなし）
Final: fixed README の地図と unit の表が新しい置き場を反映していない — 文書のみ（テストなし）
Final: minor (deferred): reorder.py の _key が状態の付かない部品名（ガウの hood_left など）を扱えない
Final: minor (deferred): anim_compare の PAGE に doctype と charset が無い
Final: minor (deferred): anim_compare がシートの大きさと --labels の数を確かめない
Final: minor (deferred): SPEC.md の『assets/unit/ の生成したコマには unit_check.py を使えない』が味方も含むように読める
Final: minor (deferred): test_gen_enemy が現役の assets/part の件数 108 を固定で確かめる
Final: minor (deferred): parts_export の .. と絶対パスのテストが何も書かないことまでは見ていない。dir='.' が通る
Final: minor (deferred): mkparts.py・anim_compare.py の空行の体裁
Final: minor (deferred): 確かめ方の弱い所（ガウの compose --check は件数だけ、味方のシートは enemy_build で作り直されない）
Final: 依頼者の決定（2026-10-12）: Minor も PR 前にこのセッションで直す。下の deferred はすべて 7e5c502 で直した
Final: fixed reorder の状態の無い部品名 — test_parts_without_a_state_in_the_name_are_named_by_their_first_half RED→GREEN
Final: fixed reorder が一部のコマにしか無い部品で止まる（ガウの left_atk_wind で見つけた） — test_part_missing_from_some_frames_is_skipped_there RED→GREEN
Final: fixed anim_compare の doctype・charset — test_page_declares_html5_and_utf8 RED→GREEN
Final: fixed anim_compare の見出しの数・シートの大きさ — test_labels_must_be_two・test_sheet_too_small_for_the_game_unit_stops RED→GREEN
Final: fixed parts_export の dir='.' と、.. ・絶対パスで何も書かないこと — test_part_directory_must_stay_under_the_part_root RED（. と ./）→GREEN
Final: fixed test_gen_enemy の件数固定、SPEC の一文、空行の体裁 — 文書・テストのみ
Final: fixed 確かめ方の弱い所 — ガウの差ありのコマ名16件が整理前と同じ、味方3体のシートが 86adaf4 のコマから作ったものと同じ（check_allies.sh）。suite 429/429
