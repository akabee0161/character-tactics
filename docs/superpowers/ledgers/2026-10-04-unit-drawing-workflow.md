# SDD ledger — plan: docs/superpowers/plans/2026-10-04-unit-drawing-workflow.md
Task 1: complete (commits 0648851..91af434, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | grep -E "^(Ran|OK|FAILED)"; exit ${PIPESTATUS[0]}' → OK)
Task 2: complete (commits 91af434..fb3c366, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | grep -E "^(Ran|OK|FAILED)"; exit ${PIPESTATUS[0]}' → OK)
Task 3: complete (commits fb3c366..9fe2cb4, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | grep -E "^(Ran|OK|FAILED)"; exit ${PIPESTATUS[0]}' → OK)
Task 4: complete (commits 9fe2cb4..deb5dff, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python tools/validate.py -q && .venv/bin/python -m unittest discover -s tests 2>&1 | grep -E "^(Ran|OK|FAILED)"; exit ${PIPESTATUS[0]}' → OK)

- Task 5〜10: ガウの台帳は .superpowers/sdd/2026-10-04-unit-workflow-gau/progress.md（deb5dff..81920ad）
Final review: self-review (no subagent tool — 依頼者の設定でエージェントを起動しない)。Review Focus 5項目はテストで確認済み
Final: minor (deferred): unit_picker.py の「部品だけ」の絵は、1つの案に部品が複数あると文字の色を後の部品で上書きする（今は1案1部品なので起きない）
Final: minor (deferred): unit_picker.py の refs の検査はオブジェクトかどうかだけで、キーの中身は見ていない
Final: fixed compose.py が手で直したコマを黙って上書きする（Important） — test_refuses_to_overwrite_a_hand_edited_frame・test_force_overwrites_a_hand_edited_frame RED→GREEN、suite 230/230（ee133f2）。文書の例も --out・--check に替え、gau.json は出発点の記録と README に書いた
Final: fixed unit_picker.py が rows だけの matrix を通しページの JS が止まる（Minor → Important に格上げ。必須の道具で、設定の誤りで絵が出ないため） — test_matrix_needs_both_rows_and_cols・test_matrix_rows_and_cols_must_differ RED→GREEN、suite 230/230（ee133f2）
Final: minor (deferred): unit_picker.html がラベルを HTML として埋め込む・docstring の倍率（ISSUES に記録）
Final: minor (deferred): face_down.py が正方形前提・ValueError を捕まえない（ISSUES に記録）
Final: minor (deferred): present.py の --scale が0以下でも通る（ISSUES に記録）
Final: minor (deferred): gau のコマのコメントが git 管理外のスクリプトを指す（ISSUES の行に説明を足した）
Final: Ruling: レビュアーが判断しなかった項目（絵の見た目・候補の枚数の内訳・作業スクリプトを forge へ移さないこと・部品だけの絵と refs・npm run build・contact_sheet・Google Fonts）はすべてそのまま — 絵は依頼者が承認済み、枚数は台帳から実行時に数えた値、build と contact_sheet は実行者が流して確かめた、フォントは読めなくても代わりで表示される — 誤っていたら結果の文書の枚数を数え直す程度
Final review: レビューエージェント（opus）。判定は With fixes、Critical なし
