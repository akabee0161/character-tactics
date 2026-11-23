# SDD ledger — plan: docs/superpowers/plans/2026-11-22-face-gen-ai-step1.md
（3 つのリポジトリにまたがる計画。進捗は実装中に台帳ファイルを持たず、最後にこの写しとして書いた。2026-11-23）
Pre-flight: Task1→Task2（forge のノートブックの 4 変数・ID）/ Task2→Task4（見本の ID）/ Task4→Task5（forge の main）/ Task5→Task6（copy-forge.sh illust）: 値・名前は計画どおり、衝突なし。ただし Task 6 のコピーで、forge 本体の禁止語の検査（`test_repo_does_not_mention_the_game`）が必ず落ちることを、計画は見落としていた（下の Task 6 の Ruling）
Task 1: complete (forge d8c9187, tests: .venv/bin/pytest → 347 passed)
Task 2: complete (forge d761658, tests: .venv/bin/pytest → 357 passed。騎士・魔法使いの 4 通りのプロンプトの positive が付録と完全に一致)
Task 3: 依頼者の許可を取って `git push -u origin feat/generic-samples`（2026-11-23）。Colab で見本 8 枚を依頼者が作った。途中で `P.pick` の画像が大きすぎる件の修正を依頼され、同じブランチに別のコミットで入れた（forge 9b61aa4）
Task 3: Ruling: `P.pick` の画像サイズの修正を、見本の入れ替えと同じ PR に入れた — 依頼者の指示（「今回の PR に入れてください」）— Colab での見え方は未確認（サーバーに ipywidgets も GPU も無い）。同じ作りの `edit_box`・`show_styles` は直していない
Task 4: complete (forge d706861・7d578cc、tests: pytest → 358 passed。8 枚とも `character`=ID・`style`=thick-line-flat・`overrides` 空。騎士・魔法使いの 4 枚は前の絵と画素まで一致、顔は左右反転して比べた。比較ページは Artifact)
Task 4: forge PR #4 を作成（依頼者の指示）→ CodeRabbit の指摘 7 件（すべて Minor）を、依頼者の了承を得て直し（forge 21f118d、tests: 360 passed）、マージ（b9cbe53）
Task 5: complete (ankardo fa13ee9、tests: copy-forge.test.sh → ok、site npm test → 48 passed)。PR #27 を作成（依頼者の指示）→ CodeRabbit の指摘 1 件（設計書のリンク）を、依頼者の了承を得てコミット固定のリンクに直し（b2ba707）、マージ（cad4348）
Task 5: Ruling: SKILL.md の「イラストを使うなら」の手順 3 に、禁止語の検査を直す旨を足した — 計画に無いが、Task 6 で必ず落ちる検査のため — 書き方が言い過ぎ（下の Final の Ruling 評価）
Task 5: Ruling: 設計書リンクは、依頼者が「main を指すべき」と決めたので、設計書が main に入ったら `blob/main/…` に直す（保留。依頼者の指示）
Task 6: complete (commit d6d7a9d, tests: illust-asset-forge/.venv/bin/pytest → 363 passed。knight の export は変わらない（チェックサム一致）。.venv などは .gitignore で除かれた)
Task 6: Ruling: コピーの `tests/test_repo_configs.py` から `test_repo_does_not_mention_the_game`（ゲーム名を禁止語にする検査）を削除した — ノートブックの `REPO_URL` などにゲーム名が入るため必ず落ち、コピーの CLAUDE.md を「このゲーム専用」にしたので目的も無い — 戻すなら、このコピーで禁止語の一覧を直す。`UPSTREAM.md` に記録
Task 6: Ruling: コピーのボルグの `inpaint_box` を外した（設計書どおり）。見本 4 人のテスト 2 件は、見本が含まれることと `tlf-` の画風が無いことだけを見る形に直した
Task 7: complete (commit 8361c15, tests: npm test → 54 files・1268 passed)
Final review: opus（fable は月の利用上限で失敗したため、opus で再依頼。最も能力の高いモデルが使えなかった）。Critical 0・Important 1・Minor 7
Final: fixed Important「工程 2 で、forge 本体の Drive の古いボルグの絵を取り込むおそれ」— `test_docs_name_this_games_drive_dir` RED→GREEN（コピーの README の Drive の説明と CLAUDE.md の取り方を、このゲームの置き場に直した）、suite 364/364
Final: Ruling: Drive の中身は確かめていない — forge 本体の Drive に古い `selected/ally05/` が残っているかは未確認。残っている前提で直した — 無駄になるだけで害は無い
Final: minor (deferred): forge の準備のセルの `git pull` は、clone 済みのブランチが force-push されると止まる（`checkout -B <branch> origin/<branch>` などにする）。止まるだけで古いコードのまま進むことは無い
Final: minor (deferred): forge の `test_prepare_cell_switches_branch_before_pull`・`test_prepare_cell_refuses_other_repo_clone` は文字列の有無しか見ていない（偽の git で実行して順を確かめる形が望ましい）
Final: minor (deferred): forge の `test_no_game_ids_or_trial_style_names` は `styles/*.yaml` のファイル名だけを見る。見本の PNG の条件・`params.json` の `style` に `tlf-` が入るかは見ていない
Final: minor (deferred): forge の README §8 に、コピーでキャラクターを足すと `test_sample_characters_are_the_four_generic_ones` が落ちることが書かれていない（ankardo の SKILL.md には書いてある）
Final: minor (deferred): コピーの文書に forge 本体のままの記述が残る — README §8 手順 3（削除した禁止語の検査）・§9 の「見本の 4 人だけ」（ally05・ally06 がいる）・ノートブックの「push すれば Colab に届く」・CLAUDE.md の `docs/superpowers/` への言及
Final: minor (deferred): ankardo の SKILL.md の「ゲーム側の変更とは分けて 1 つのコミット」と、Task 6 の計画（コピーと変更を 1 コミット）が食い違う。`copy-forge.sh` が作る `UPSTREAM.md` のひな形に「このゲームだけの変更」の節が無い。手順 5 の `uv venv` に Python の版の指定が無い（`requires-python >=3.12`）。手順 3 の「ゲームのリポジトリ名が REPO_URL に入ると落ちる」は言い過ぎ（`forbidden` は character-tactics 用の語だけ）
Final: minor (deferred): forge の `HANDOVER.md` の進捗が、マージ前の状態（実装 7 タスク中 4・PR を作る）のまま。ankardo の `HANDOVER.md` も前の作業（Search Console）のまま
Final: 判断できなかったこと: `P.pick` の Colab での見え方、男子生徒の顔が生成時に左向きか（`flipped: false`。絵は左向きに見えた）、character-tactics の `develop` から Colab がコピーを取れること
PR #60: CodeRabbit の指摘 7 件（すべて Major。forge 本体から変えていないコードで、コピーを足したので新しいファイルとして指摘された）を確かめ、7 件とも技術的に正しいと判断した（2026-11-23）
PR #60: Ruling: 実際の作業で起き得る 2 件（準備のセルの `!pip` が失敗しても止まらない・設定から消した表情の候補を採用できる）だけを、このコピーで直した — 依頼者の了承（「はい、修正してください」）— 直し方は `subprocess.run(check=True)` と `Forge.adopt` の事前検査。テスト `test_prepare_cell_stops_when_pip_install_fails`・`test_adopt_rejects_expression_missing_from_current_config` が RED→GREEN、コピーの pytest 366/366
PR #60: Ruling: 残り 5 件（intake の控えの削除・戻しの継続、selection の初回採用の中断・控えの削除失敗・pack の同秒の上書き）は直さず、`illust-asset-forge/UPSTREAM.md` の「forge に戻す候補」と HANDOVER の「次にやること」に、forge の修正事項として記録した — 強制終了・ディスクの失敗・同じ秒の操作の狭い条件でだけ起き、forge 本体のコードを大きく書き換えるため。依頼者の指示で、継続作業（別のセッション）で forge の PR として直す — 費用: その間、forge 本体とコピーに同じ弱点が残る
