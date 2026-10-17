# SDD ledger — plan: docs/superpowers/plans/2026-10-16-policy-check-tools-pr2.md
Spec: docs/superpowers/specs/2026-10-16-policy-check-tools-design.md
Pre-flight: Task 2〜6 は Task 1 の UnitConfig・Frame・Part・run_check・points・OUTLINE と unit_fixture を使う（計画の写しで同じ名前を確かめた）。Task 7 は Task 2〜6 の main と今ある道具の main を呼ぶ（compose は --root が無いので --out だけ渡す）。Task 8 は Task 7 の plan・run・failure_lines・covered_by を使う。Task 9 は Task 8 の判断を使う。食い違いは無い
Ruling: 77 は設計の「--arm を逆にする」でなく「--arm を今後使わない」（2026-10-16 依頼者の判断）— 逆にするとロラン 22/22・ガウ 20/21 が落ちる — 誤りなら D で袖の名残を body_check で拾えない分が残る
Ruling: 実行はこのセッションで（2026-10-16 依頼者が選んだ）
Task 1: complete (commits 2201879..eb3a94a, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_unit_config' → OK)
Task 2: complete (commits eb3a94a..5c42f18, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_order_check tests.test_blade_height tests.test_height_check' → OK)
Task 3: complete (commits 5c42f18..c0bf8e3, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_still_check' → OK)
Task 4: complete (commits c0bf8e3..586b11c, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_tip_check tests.test_part_chars' → OK)
Task 5: complete (commits 586b11c..eee2e4a, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_eye_check' → OK)
Task 6: complete (commits eee2e4a..5e9400a, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_part_outline tests.test_fist_check' → OK)
Task 7: Ruling: 全体のテストは計画の Expected 542 でなく 544 件で OK — 計画の 542 は、写しで test_unit_rules に2件（終了 1 で失敗の行が無い・道具が 2 で止まる）を足す前に数えた値だった（テストのファイルは写しと同じ）。失敗は0 — 誤りなら件数の書き違いだけ
Task 7: complete (commits 5e9400a..cf973ff, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_unit_rules' → OK)
Task 8: Finding: 3体の結果は計画の試算の表と同じ（ロラン NG 5 確認・イネス NG 6・ガウ NG 4）
Task 8: Ruling: a-1 イネスの body_check の肩の画素は髪でなくバンダナ。例外にせず、body_check が頭の髪・かぶり物（設定の色）とそれを囲む輪郭を胴のはみ出しから外すように判定を直す（2026-10-16 依頼者）。ISSUES の「髪で必ず出る」の行もバンダナに直す
Task 8: Ruling: a-1 イネスの core_right_* の (12,23)(12,24)（腰の後ろの輪郭が胴の端より1列外）は腰のくびれに見えないので、道具が正しい＝絵を直す（ISSUES に立てる）（2026-10-16 依頼者）
Task 8: Ruling: a-2 ガウの body_check の「胴からはみ出した画素」「中心がそろっていない」は頭巾の垂れのせい。a-1 と同じく、頭のかぶり物の色とそれを囲む輪郭を、はみ出しと中心の計算から外す判定の直しで扱う（2026-10-16 依頼者）
Task 8: Ruling: 部品は素体（芯）・髪・被り物・拳・武器に分ける。ミストからこの方式。ロラン・イネス・ガウは髪・被り物が芯に入っているので例外が出うる（2026-10-16 依頼者）。SPEC「部品で組む規約」に書いた
Task 8: Ruling: a-2 ガウの body_check の輪郭の切れ目（首元の角 y=15、down・up の裾の角 y=24、left・right のつま先 y=29・歩き y=28）は道具の指摘どおり絵を直す（ISSUES に立てる）（2026-10-16 依頼者）
Task 8: Ruling: a-2 ガウ up の穴 (21,12)（耳と頭巾の間のすき間）はそのまま。body_check の穴を「外とつながらない透明」だけにする判定の直し（脚の間のすき間も出なくなる）（2026-10-16 依頼者）
Task 8: Ruling: a-3 イネス down の脚の中心は、手前の弓の輪郭がつま先を隠したための誤検出。unit_check の脚の中心を、部品で組むユニットは芯で測るように判定を直す（武器が重なる形はほかにも多くありうる）（2026-10-16 依頼者）
Task 8: Ruling: b-4 イネス up_atk_wind・up_atk_draw の矢の部品は鏃だけで軸が無い（部品の欠け）。道具が正しい＝絵を直す（ISSUES）（2026-10-16 依頼者）。一覧で「SPEC どおり」に分けたのは私の見立ての誤り
Task 8: Ruling: 例外は基本的に作らない（2026-10-16 依頼者の方針）。b-5 ロランの鍔の端は剣の形をよく表すので、tip_check を設定の刃・鏃の文字（blade）の画素だけを見るように判定を直す。イネスの矢に blade "t" を書く。先端の描き方はドット絵全体の課題として ISSUES「決めてもらう必要があるもの」に立てた（2026-10-16 依頼者）
Task 8: Ruling: b-6・d-14・d-15 は tip_check を刃・鏃の文字だけにする直しで出なくなる（試算: 残るのはイネス up_idle2 (9,19)・up_atk_draw (9,14) の鏃だけ＝c-13、絵を直す）
Task 8: Ruling: e-16 eye_check は、目の位置（x と行）を設定ファイルに書き、目の左右の隣の色が probe_colors.verdict で輪郭と見分けられない（WARN・HARD）なら落とす形に直す。上下・斜めは見ない（SPEC「真上は縁でよい」）。目の上端の行のそろいは残す。試算で3体とも通る（2026-10-16 依頼者。ガウのときの「髪・かぶり物が横に接すると不可」は、見分けられる色なら問題ないと依頼者が判断）— 誤りなら暗い髪の色が目の横に来たときの境目の判定になる
Task 8: Ruling: ロランの left と right で髪の形が違う。絵を直す（ISSUES に立てる）（2026-10-16 依頼者の指摘。道具の件ではない）
Task 8: Ruling: c（7〜13）は依頼者が「ツールが正しい」とした＝絵を直す（ISSUES）。c-11 イネスの歩きの y=27 も絵を直す側。c-13 は弓の端を見なくなるので鏃の2コマだけ
Task 8: fixed tip_check を blade の画素だけに — test_other_pixels_with_outline_on_all_four_sides_pass ほか RED→GREEN
Task 8: fixed eye_check を目の画素＋色の見分けに、設定の colours を head_chars（文字）に — test_dark_hair_beside_the_eye_passes_when_it_can_be_told_apart ほか RED→GREEN、3体とも 目: ok
Task 8: Ruling: body_check の「はみ出し」は袖の名残のためのもの。男性の体だけに掛け、D で敵の袖を消し終えたら使わない。女性の体（イネス）には掛けない（設定に素体の型を書く）。女性の体の線の確かめ方は ISSUES に立てる。中心・切れ目・穴は男女とも掛ける（2026-10-17 依頼者）
Task 8: Ruling: ガウ（男性）の頭巾の垂れは、芯の head_chars のうち y>=15 に届く塊とそれを囲む輪郭を、はみ出しと中心から外す形で直す（髪を全部外すとロラン down の頭の中心がずれたため、垂れた塊だけ）
Task 8: Ruling: イネスの攻撃のコマだけバンダナの垂れの形が違う（輪郭だけ）は ISSUES に「確かめる」で立てる。腰の後ろ (12,23)(12,24) は道具では見なくなるが ISSUES に残す
Task 9: Ruling: 計画の Task 9 に Step 9「保留にした課題の棚卸しと、直すタイミングを依頼者に尋ねる」を足した（2026-10-17 依頼者の指示）。計画はログだが、実行中の計画への依頼者の指示なので書き足した
Task 8: fixed body_check（穴＝外とつながらない透明、--hanging、--no-protrusion）— test_a_gap_open_to_the_outside_is_not_a_hole ほか RED→GREEN
Task 8: fixed unit_check --core（脚の中心を芯で測る）— test_core_measures_the_legs_on_the_core_parts RED→GREEN
Task 8: fixed 設定に body（male・female）、入口が --hanging・--no-protrusion・--core を渡す — test_body_check_gets_the_hanging_chars_and_skips_protrusion_for_a_female_body ほか RED→GREEN、suite 562/562
Task 8: Ruling: 「絵を直す」と決めた失敗は例外にしない（依頼者の方針「例外は基本的に作らない」）。そのため3体の unit_rules は E で絵を直すまで終了 1 のまま。NG の行が E の直す一覧になる — 誤りなら、この3体で新しい失敗が出ても既存の NG に紛れる（行の数で気付く）
Task 8: Finding: 直した後の3体の NG は、すべて「絵を直す」と決めたもの（ロラン 3 確認・イネス 4・ガウ 3）。イネスの body_check の down 攻撃4コマの中心ずれは、攻撃のコマだけバンダナの垂れが輪郭で描かれている件（ISSUES「確かめる」）
Task 8: complete (commits cf973ff..f449c88, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests' → ok   /tmp/tmpljlzrvve/tmp_h7srxoa_attack.gif  1 frame(s) at 6fps (170ms))
Task 8: Ruling: イネス down 攻撃の芯のバンダナの垂れは、弓に隠れる所の芯の欠け。「部品は単品として完全に描く」により芯を直す（ISSUES）。依頼者に判断を求めたのは誤り（組んだ絵を確かめず、既にある決まりを当てはめなかった）（2026-10-17）
Task 8: Ruling: 「絵を直す」と決めた絵を、E を待たずこの作業で直す（2026-10-17 依頼者の判断。設計の「絵はこの作業では直さない」を変えた）。直した絵は見せて承認を得てからコミットする
Task 8: Ruling: ガウの芯の輪郭の切れ目は、切れ目の画素を輪郭に置き換えて直す（案A、外形は変えない）（2026-10-17 依頼者が画像を見て承認）
Task 8: Ruling: ロランの盾の下端は案A（先の1画素を輪郭に置き換え）（2026-10-17 依頼者が画像を見て選んだ）。ガウの短剣 left_atk_wind の鍔の下 (18,19) も同じく輪郭に置き換え（体に隠れて組んだコマは変わらない）
Task 8: Ruling: イネスの歩きの y=27 は絵が正しい（細い脚で上げた足が脚の幅からはみ出し、その上を閉じる輪郭が y=27 に来る）。still_check と SPEC の歩きの範囲を y=27〜30 にする（2026-10-17 依頼者が拡大画像で確かめて判断）。私が最初に出した「y=27 の輪郭を消す」案は、道具を通すことを優先した誤り
Task 8: fixed still_check LEG_TOP 27 — test_walk_may_change_y27_for_the_outline_over_a_raised_foot RED→GREEN
Task 8: Finding: 見た目が変わらない直し（組んだコマの色が同じ）: ロランの芯の文字 H・J→u・v（ベルト・靴底）、ロランの待機2の頭のてっぺん（剣の輪郭に隠れる）、イネスの攻撃の芯の垂れ（弓に隠れる）、イネスの left_idle2 (12,25)（隠れる）、ガウの短剣の鍔の下（体に隠れる）
Task 8: Ruling: イネス right の腰の後ろ (12,23)(12,24) は、輪郭を胴と同じ x=13 にそろえて直す（2026-10-17 依頼者が画像を見て承認）
Task 8: Ruling: 背丈 24〜26 は変えない（2026-10-17 依頼者）。ガウは頭巾の側面の同じ幅の2行（y=7・8）の1行を詰めて 26px にする（案1。頂の形・顔・目は変えない。依頼者が画像を見て選んだ）
Task 8: Ruling: tip_check は部品ごとの形で判断（隠れた結果1画素に見えるのは1画素の先端ではない）（2026-10-17 依頼者）。test_a_tip_that_looks_one_pixel_only_because_it_is_hidden_passes RED→GREEN。残るのはイネスの arrow_up_atk_draw（部品自体が鏃1画素）で、矢の部品を完全に描き直して直す
Task 8: Ruling: イネスの up の攻撃の矢は、弓に対して斜めに構え、鏃・軸・矢羽根を 45° の1本の線（1画素幅）に並べた完全な部品にする（2026-10-17 依頼者が案を見て選んだ。2画素幅の先端の案は採らなかった）。この鏃は tip_check で落ちるが、先端のルールは後で見直す（依頼者）ので失敗のまま残す
Task 8: Finding: 直した後の unit_rules — ロラン 0・ガウ 0・イネス 1（tip_check の矢の鏃 2件のみ）
Task 8: Ruling: ロランの後頭部は right の立ち・待機2・歩き4コマの芯をふくらみのある形（left 全コマ・right 攻撃と同じ）にそろえる（2026-10-17 依頼者承認）。組んだコマは剣に隠れて変わらない
Task 8: Finding: ゲームの assets/images の roran・ines・gau-map.png は 2026-10-03〜04 から書き出されておらず、体＋拳の組み直し（10-11〜10-15）が入っていない。今回 export すると組み直し全体がゲームに入るので、書き出しは依頼者に聞く（書き出した画像は git stash に退けた）
Task 8: Ruling: ゲームのシートをこの PR で書き出す（体＋拳の組み直しも含めて、承認済みの絵をゲームに入れる。2026-10-17 依頼者）。動きのページ（Artifact）の作り直しは残る
Task 8: continued after complete line (commits f449c88..3e0d96b): 道具の判定の直し・絵の直し・シートの書き出し・ISSUES。suite と unit_rules は Task 9 で確かめる
Task 9: complete (commits 3e0d96b..ac24940, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests' → ok   /tmp/tmpwn6ecpfi/tmpywvdl1sw_attack.gif  1 frame(s) at 6fps (170ms))
Final review: opus のレビュアー（Critical 0・Important 2・Minor 7）。Minor も PR の前に直す（依頼者の方針）
Final: fixed grips の型の誤りでトレースバック — test_grips_must_be_a_string RED→GREEN
Final: fixed eyes の向きの書き忘れを黙って通す — test_eyes_must_list_every_direction RED→GREEN
Final: fixed 道具の想定外の例外が終了 1（絵の失敗）になる — test_an_unexpected_exception_in_a_tool_exits_2_not_1 RED→GREEN
Final: fixed validate の失敗の理由が入口の出力から消える — test_validate_reasons_are_kept_with_the_failure RED→GREEN
Final: fixed 空の拳でも握る部品が無いと落ちる — test_an_empty_fist_without_the_gripped_layer_is_not_checked RED→GREEN
Final: fixed 目の上端の比べが状態の数だけ同じ行を出す — test_eye_top_rows_must_match_across_directions（1回だけ）RED→GREEN
Final: fixed 使われない Frame.composed・rows・charmap を消した（テストは無し: 動きを変えない整理。suite で確かめた）
Final: fixed 例外の frames に書く名前と compose の --root の制約を unit_rules の docstring と SPEC に書いた（文書）
Final: fixed 髪を別の部品にしたユニットで目の確認が髪を見ない件を ISSUES に立てた（文書）
Final: suite 568/568、unit_rules roran 0・ines 1（tip_check の矢、意図）・gau 0
Final: Ruling: Minor も直した — 依頼者の方針（レビューの Minor も PR 前に直す）— 誤りなら変更が少し増えただけ
Task 9: Ruling: 保留にした6件（先端の描き方・女性の体の線・はみ出しを D の後にやめる・手が細いの例外の見直し・髪を分けたユニットの目の確認・動きのページの作り直し）は、すべて D の前に行う（2026-10-17 依頼者）。ISSUES に時期を書いた
