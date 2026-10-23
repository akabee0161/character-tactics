# SDD ledger — plan: docs/superpowers/plans/2026-10-22-tip-drawing-rule.md

Executor: native (executing-plans)。依頼者のルール: ★の段階（Task 4 の1件ずつの判断、Task 5 の絵の承認）では止まって聞く。
Spec: docs/superpowers/specs/2026-10-22-tip-drawing-rule-design.md
Pre-flight: Task1→2（find_tips(rows, blade, outline) -> list[Tip]、Tip.point/direction/problems/skipped）一致。Task2→3（NOTE の形・run_check の notes）一致。Task1→3（斜めの point は (X,Y)、no_corner の期待 (13,2) は今の剣のアイコンの刃の色 X=13,Y=2 と一致）。Task4→5（Task 4 で聞かない直しは Task 5 の3枚）一致。
Task 1: Ruling: A のテストの絵を上5行から鍔までの9行に変えた — 5行では刃が短く、根元の重心→まとまりの重心の向きが 24° になり対象外になったため（実物の A は鍔まである） — 外れたら: テストの絵1枚
Task 1: complete (commits a337f03..f7f355f, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_tip_rule' → OK)
Task 2: complete (commits f7f355f..37c02ff, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests' → OK（597 件）)
Task 3: complete (commits 37c02ff..779bc29, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | grep -E '^(Ran|OK|FAILED)'' → OK)
Task 4: 数えた結果（HEAD 779bc29）: roran FAIL 1（sword_right_atk_hit 決まり5 角 (31,9)）、ines FAIL 2（arrow_up_atk_wind・draw 決まり5、Task 5 で直す）、gau FAIL 9（短剣の down_base・down_idle2・down_atk_hit・left_base・left_idle2・right_base・right_idle2・right_atk_wind・right_atk_hit、決まり1＋対称: 先の黒3画素が片側にはみ出す）＋NOTE 2（dagger_down_atk_wind・up_atk_wind「45°以外」は誤り: 刃が1行で全画素が根元になり向きが決まらない。形は同じ3画素の蓋）、items FAIL 2（sword・bow 決まり5 角 (14,1)）。一覧 https://claude.ai/artifact/71uURb9brnx4TWKySxQPoQ
Task 4: 依頼者の判断 1（ガウの短剣 11枚）: 絵を直す（はみ出した黒1画素を消す）。判定の誤り（1行の刃の向き）も直した（e4e67a6、test_a_one_row_blade_gets_its_direction_from_the_hilt RED→GREEN、suite 602）
Task 4: Ruling: 柄に接する行（根元の行）は外形・決まり4を見ない（蓋の幅と蓋の対称は見る） — 1行だけの刃では柄の黒まで外形に数え、dagger_up_atk_wind が誤って落ちたため（fa814eb、test_outline_of_a_wider_hilt_is_not_counted_as_the_blade RED→GREEN、suite 603） — 外れたら: 根元の行で本当に崩れた外形を見逃す
Task 4: ガウの短剣11枚を直した（未コミット、部品11＋組んだコマ3、シートの差は3画素）。前後のページ https://claude.ai/artifact/Se9Y3NmxXYXepXd2g29uNE 、再生 https://claude.ai/artifact/4qDLPMYCJ8gxqETCmkXccD 。依頼者の承認待ち。残りの判断: 2 ロラン右攻撃の剣、3 弓のアイコン
Task 4: 依頼者が短剣の直しを承認、a473a94 でコミット（ゲームへの書き出しは Task 5 でまとめて行う）
Task 4: 依頼者の判断 2（ロラン右攻撃の剣）: 絵を直す（角を黒で埋める）。3（弓のアイコン）も依頼者「その他の武器の先端も修正してよい」で絵を直す。Task 5 で、剣・弓のアイコン、イネスの矢2枚とまとめて直す
Task 4: complete (commits 779bc29..a473a94, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | grep -E '^(Ran|OK|FAILED)'' → OK)
Task 5: Ruling: イネスの矢は計画の4画素の書き換えのうち、角 (8,12)・(8,13) の1画素だけが実際の変更になった（ほかの3画素は元から同じ文字。試しの「案＋1段」と画素まで同じ） — 計画は試しの差分を書き写したため — 外れたら: なし
Task 5: 5枚の角を埋めた（未コミット）: sword.txt・bow.txt (14,1)、sword_right_atk_hit (31,9)、arrow_up_atk_wind (8,12)、arrow_up_atk_draw (8,13)。組み直し roran・ines（--check 0、unit_rules 3体とも NG なし、ines は初めて終了 0）。シートの差: roran 1画素、ines 2画素。前後 https://claude.ai/artifact/MUcfHLBhbx6NjqtvXcfr8c 、再生 ロラン https://claude.ai/artifact/SgT1RLK4tuW2LiN8gLCng1 イネス https://claude.ai/artifact/VcZ2ZYxUk54d9nuxhbheZ3 。依頼者の承認待ち
Task 5: 依頼者が承認、c5e778b（絵）・02be6e5（シートの書き出し、npm test 776/776、書き出しは確認用シートと画素まで同じ）。3体の動きのページを同じ URL に出し直した。Ruling: 計画の Task 5 Step 5 は絵とシートを1コミットにする予定だったが、2コミットに分けた — 絵の承認の後に書き出したため — 外れたら: なし
Task 5: complete (commits a473a94..02be6e5, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | grep -E '^(Ran|OK|FAILED)'' → OK)
Task 6: Ruling: README の「刃と鏃の1画素の先端」も「先端（決まり1〜5）」に直した — 計画の Files に無いが同じ古い記述のため — 外れたら: 1行
Task 6: complete (commits 02be6e5..ff33dcf, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | grep -E '^(Ran|OK|FAILED)'' → OK)
Final: review by code-reviewer (opus) — Critical 0 / Important 2 / Minor 6
Final: fixed Important1 unit_rules で NOTE が消える — test_skipped_tips_are_counted_and_listed RED→GREEN
Final: fixed Important2 根元の行で狭い外形が通る — test_a_root_row_narrower_than_expected_fails RED→GREEN
Final: fixed Minor1 向きが決まらない理由 — test_an_undetermined_direction_is_reported_as_such RED→GREEN
Final: fixed Minor2 テスト追加 — test_diagonal_tips_pointing_down_are_judged・test_a_part_file_used_by_several_frames_is_reported_once（最初から通った: 既存の動きの確認）
Final: fixed Minor3 --items= — test_the_items_option_can_be_written_with_an_equals_sign RED→GREEN
Final: fixed Minor4 対象外の件数 — Important1 と同じ直し
Final: fixed Minor6 README に --items と対象外の説明
Final: Minor5（台帳の写し）は PR の前に docs/superpowers/ledgers/ へ写す。suite 609/609
