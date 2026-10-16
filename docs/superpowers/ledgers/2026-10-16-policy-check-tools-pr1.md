# SDD ledger — plan: docs/superpowers/plans/2026-10-16-policy-check-tools-pr1.md
Spec: docs/superpowers/specs/2026-10-16-policy-check-tools-design.md
Pre-flight: Task 1 は compose_page.RED・GROUND・_pixels・analyse_frame と compose.load_config を使う（今のコードにあることを確かめた）。Task 3 の画像は Task 1 の phone_sheet.tile を使う（Task 1 の後なので順は合う）。Task 6 は Task 2〜5 の判断を使う。ほかに共有するものは無い
Ruling: 依頼者に既存の絵の結果を見せる所（Task 2〜5）は、道具ごとに止めず、Task 5 まで作ってからまとめて1回見せる。道具のコードは判断を待たずにコミットし、判断で決まる例外・直しは別のコミットにする — 依頼者の手間（止まる回数）を減らすため。計画は「決まるまでその道具のコミットへ進まない」だが、判断で変わるのは例外の定数と ISSUES だけで、コードの本体は変わらない — 誤りなら例外の追加コミットが1つ増えるだけ
Task 1: Ruling: Review Focus の「部品が dx でコマの外へ出ても落ちない」は前提が誤り。compose.py がコマの外へずれる部品を ComposeError で止めるので、phone_sheet は終了コード 2 と理由を出す。テストを test_order_reports_pixels_shifted_off_the_frame（2 と「コマの外」）に変え、tile の範囲の確かめを消した — 依頼者が得るのは明確なエラー — 誤りなら compose が止めなくなったときに putpixel の例外で落ちる
Task 1: complete (commits 9e0c581..0fda333, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_phone_sheet' → OK)
Task 2: Finding: validate -q は終了 0、unit の from・transform は 0 件（依頼者に決めてもらうものは無い）
Task 2: complete (commits 0fda333..143248c, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_tools' → OK)
Task 3: Finding: item_check は bow・sword とも ok（終了 0）。依頼者に決めてもらうものは無い
Task 3: complete (commits 143248c..9669d17, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_item_check' → OK)
Task 4: Finding: tilemap --unplaced は ISSUES の11点と同じ（bridge_v dirt fence_v mountain_{ne,nw,se,sw} path_sw path_t_{n,s,w}）、終了 1。扱いは依頼者に聞く（まとめて）
Task 5: Finding: 川の変形3件は fixtures へ固定、派生の宣言の1件は ALLOWED。残りは check_colors.RepositoryTest.test_converged_assets_are_clean（castle 4・chest・plain）と tilemap.ComposeTest の3件（plain・river_ne・river_nw）。扱いは依頼者に聞く
Task 4: Ruling: タイル11点はレイアウトに置かず、ISSUES の既存の行に任せる。--unplaced は11点を出し続ける（終了 1）— マップの設計の作業で道具の整備と D から外れる（2026-10-16 依頼者承認）
Task 5: Ruling: tilemap.ComposeTest の3件は tile_dir=tests/fixtures に変え、check_colors.RepositoryTest は6点（castle 4・chest・plain）を fixtures に写して読む（2026-10-16 依頼者承認）。パレットは現役を読むので見張りの目的は残る
Task 4: complete (commits 9669d17..a36ea4f, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_tilemap' → OK)
Task 5: complete (commits 556d27d..a36ea4f, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests' → ok   /tmp/tmpiucfhzuu/tmprhxownla_attack.gif  1 frame(s) at 6fps (170ms))
Task 6: Ruling: 台帳の写しは最終レビューの後に別のコミットで入れる — 最終レビューの行も写しに残すため — 誤りなら写しのコミットが1つ増えるだけ
Task 6: complete (commits a36ea4f..0f02ddd, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | grep -E '^(Ran|OK|FAILED)'' → OK)
Final review: opus のレビュアー（Critical 0・Important 1・Minor 6）
Final: fixed 直接実行で自分のテストを外せない（__name__ が __main__）— python tests/test_no_live_assets.py が FAILED→OK（Path(__file__).stem で外す）、suite 460/460
Final: fixed 2 回 suite を走らせる — functools.cache（テストは無し: 速さだけの変更）
Final: fixed 見えない読み（読み込み時・setUpClass・サブプロセス）を docstring に書いた
Final: fixed phone_sheet が壊れた案で traceback — test_diff_broken_candidate_is_an_error_not_a_traceback RED→GREEN（check と大きさで止める）
Final: fixed phone_sheet の A=@up・--dirs の不明な向き — test_cmp_rejects_a_malformed_candidate[A=@up]・test_order_unknown_direction_is_an_error RED→GREEN
Final: fixed tilemap.unplaced が入れ子のタイルを名前だけで比べる — test_a_nested_tile_is_named_by_its_path_like_load_tile ほか RED→GREEN
Final: fixed item_check が最初の読めないファイルで残りの報告を捨てる — test_an_input_error_does_not_hide_the_other_reports RED→GREEN、docstring に FRONT_FACING の足し方と終了コード
Final: Ruling: Minor も直した — 依頼者の方針（レビューの Minor も PR 前に直す。CodeRabbit が結局指摘する）— 誤りなら変更が少し増えただけ
