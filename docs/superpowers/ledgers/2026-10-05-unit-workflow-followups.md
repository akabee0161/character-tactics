# SDD ledger — plan: docs/superpowers/plans/2026-10-05-unit-workflow-followups.md

- Spec: 依頼者との会話（2026-10-04〜05）。文書の spec は無い。②12〜18 は依頼者が推しのまま承認
- 開始時: forge unittest 230 OK、npm test 776 pass。ブランチ chore/unit-workflow-followups（main 4781cce から）、計画のコミット 411935e
Pre-flight: Task 3（sheets/*.txt に # frames: を足す）と Task 4（sheets/*.txt の breathe を idle2 に）が同じファイルを触る。Task 3 → 4 の順なので衝突なし。Task 4 と Task 5 は SPEC.md を両方触る（4 は名前、5 は内容）。順番どおりで衝突なし
Ruling: Task 9 Step 3（依頼者に atk_hit の画像を見せて返答を待つ）は、待つ場所を最後にする。Task 9 の撮影までを先に行い、Task 10 と最終レビューの後にまとめて見せる — 依頼者は「進めて」と言っており、途中で止めると他のタスクが止まるため — 外れたら ISSUES の2行の削除コミットを戻すだけ
Task 1: Ruling: 「部品だけの絵が後の部品の色で上書きされる」は実際には起きない。同じ案の中で同じ文字に別の色があると、その前に組み合わせの組み立て（compose_frame）が PickerError で止まる（RED のテストで確かめた）。encode_names への作り直しはせず、止まることをテスト test_two_parts_giving_one_letter_two_colours_stop_the_page で固定した — 計画の Step 3 の部品だけの作り直しは不要と判断 — 外れたら、compose_frame の検査が緩んだときに部品だけの絵の色が違う（テストが落ちて気付く）
Task 1: ブラウザ確認: ラベル 刃<4px & "長"・<script>・頭<i>巾</i>・refs の名前 ロラン<u> がすべて文字のまま表示、JS のエラーなし、初期の組み合わせ H1-D1 が表示された（headless chromium の --dump-dom）。ボタンのクリックは確かめていない
Task 1: complete (commits 411935e..688ac94, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests' → ok   /tmp/tmpp3sntv3c/tmpjrfenpq1_attack.gif  1 frame(s) at 6fps (170ms))
Task 2: complete (commits 688ac94..06f9657, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests >/dev/null' → OK)
Task 3: complete (commits 06f9657..21922a6, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests >/dev/null' → OK)
Task 4: 確認: sheet.py の3体の PNG は cmp で同じ、compose --check の出力は名前の置き換えを除いて同じ（もともと全16コマ差あり・exit 1）、validate 189 ok、export 後の assets/images に差なし
Task 4: Ruling: /tmp に before/after を置く計画だったが rm -rf が許可されなかったので、作業フォルダの idle2-before/idle2-after に置いた — 中身は同じ — 影響なし
Task 4: complete (commits 21922a6..4945459, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests >/dev/null' → OK)
Task 5: Ruling: README のコマ数を計画の「イネスは28コマ」でなく実物の 32コマ（24＋atk_draw・atk_release ×4）で書いた — 計画の数え違い — 影響なし
Task 5: complete (commits 4945459..c52513b, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python tools/validate.py >/dev/null && .venv/bin/python -m unittest discover -s tests >/dev/null' → OK)
Task 6: 確認: 壊れた JSON・無いファイル・name の無い JSON の3つが1行のメッセージで exit 1。足元の線を出したガウのページのスクリーンショットが直す前と同じ（cmp）。frame 48 に書き換えたページではチェックボックスが hidden
Task 6: Ruling: 計画どおり <span id="foot-y"> にすると .check の flex の gap で「y= 30 」と空きが出たので、文言全体を <span id="foot-text"> に入れて差し替える形にした — 見た目を直す前と同じに保つため — 影響なし
Task 6: complete (commits c52513b..0721a79, tests: bash -c 'python3 tools/anim-page.py assets/units/roran.json .superpowers/sdd/2026-10-05-unit-workflow-followups/anim-roran.html && python3 tools/anim-page.py assets/units/ines.json .superpowers/sdd/2026-10-05-unit-workflow-followups/anim-ines.html' → .superpowers/sdd/2026-10-05-unit-workflow-followups/anim-ines.html)
Task 7: complete (commits 0721a79..fccd1f5, tests: bash -c 'test -f .github/pull_request_template.md && grep -c '^## ' .github/pull_request_template.md' → 5)
Task 8: Ruling: この計画自身の台帳（2026-10-05-unit-workflow-followups）は作業中なので、Task 8 では写さず Task 10 の最後に写す — 写した後に書いた行が抜けないように — 外れたら最後の数行が抜ける
Task 8: complete (commits fccd1f5..4fdfca2, tests: bash -c 'for d in .superpowers/sdd/*/; do n=$(basename $d); [ $n = 2026-10-05-unit-workflow-followups ] && continue; cmp -s $d/progress.md docs/superpowers/ledgers/$n.md || exit 1; done; echo 17 ledgers identical' → 17 ledgers identical)
Task 9: 確認: bodyCenter は draw.ts の描画7か所と main.ts で使われ、sprites.test.ts 12 pass。足元アンカーの行は消した（8ad?）
Task 9: atk_hit を ?debug で捉えた: ロラン（左向き）r_034、イネス（背面）b_016・b_018、ガウ（背面）b_046。拡大は atk_hit_in_game.png。依頼者に見せて返答を待つ（「atk_hit がゲーム内で未確認」の行は返答の後に消す）
Task 9: Ruling: 足元アンカーの行は、依頼者に見せる必要のないコードの事実なので先に消した。atk_hit の行だけ返答を待つ — 計画の Step 4 は2行まとめて消す想定だった — 外れたら行を戻すだけ
Task 10: complete (commits 3251255..dc5aac4, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests >/dev/null && cd .. && npx vitest run >/dev/null 2>&1 && echo 'forge OK, npm test pass'' → forge OK, npm test pass)
Final review: レビューエージェント（opus）。判定は Ready、Critical・Important なし
Final: fixed 台帳の写しに作業端末の一時フォルダのパス（セッション ID 入り）が入っていた（Minor → Important に格上げ。public リポジトリで、依頼者の security ルール「private working directories を出さない」に当たるため） — grep "/tmp/claude|claude-1000" docs/superpowers/ledgers が 1件 → 0件（テストでなく grep で確かめた）
Final: minor (deferred): sheet.py の列数の検査は状態ごとの一番右の列しか見ないので、ある向きだけコマが抜けた定義（up_base . . .）も通る
Final: minor (deferred): anim-page.py で sprites.map.sheet が文字列でない・frame が数値でないと、try の外でトレースバックになる
Final: minor (deferred): sheet.py の main が宣言の食い違いで FAIL・終了コード1を返す経路にテストがない（手で1回確かめただけ）
Final: Ruling: レビュアーが見送った項目（HANDOVER の当時の節の breathe、__DATA__ という題名、face_down の出力先フォルダ、# frames: で始まるコメント、Artifact の URL、イネスの32コマ、足元の線の位置、ブラウザでのラベル確認、atk_hit の目視）はすべてそのまま — 当時の記録・ありえない入力・変更前からの挙動・依頼者が既に決めたこと・実行者が確かめ済み・依頼者の返答待ち — 外れたら個別に直す程度
Task 9（2026-10-06 依頼者の指摘で撮り直し）: 最初に見せた画像は、ガウが idle2（idle up col=1）で、体に重なった「attack 1」は上の敵の表示だった。イネスの背面は attack col2〜5 が同じ絵で動きの確認に向かなかった。画面のコマ番号は 0 始まり（frame.col）
Task 9: 撮り直し: 表示の文字でなく、シートのセルと画素で照らし合わせて特定した（match_frame.py・batch_match.py）。ロラン左 atk_wind r_032（0.97、輪が重なる）・atk_hit r_034（1.00）、イネス左 atk_wind s_010・atk_draw s_013・atk_hit s_016・atk_release s_024（すべて 1.00）、ガウ左 atk_wind t_044・atk_hit t_047（1.00）。atk_in_game_v2.png
Task 9: 依頼者が撮り直した画像で atk_hit を確認（2026-10-06「okです」）。ISSUES の「atk_hit がゲーム内で未確認」の行を消し、この台帳を docs/superpowers/ledgers/ に写した
