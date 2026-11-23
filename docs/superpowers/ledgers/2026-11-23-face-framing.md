# SDD ledger — plan: docs/superpowers/plans/2026-11-23-face-framing.md
Pre-flight: T1→T2 ClearColor/FaceCrop, T1→T3 Character.face_crop, T2→T3 render_face, T3→T4 small_name/check path, T1-5→T6. 型は計画の Interfaces どおりで食い違いなし。
Task 1: complete (tests: pytest → 429 passed)
Task 2: Ruling: 計画のテストのクリーム色 (230,220,206) は最小値 206 で min=214 に当たらない — 色を (236,226,218) に替えた（条件 214/14/16 は設計書どおり）— 無し。 
Task 2: complete (tests: pytest tests/test_face_crop.py → 8 passed)
Task 3: complete (tests: pytest → 447 passed)
Task 4: Ruling: crop_review の small 無し画像数は計画の 5 でなく 6（枠あり・枠なし・確認図・64・40・32）— 数え間違い — 無し
Task 4: complete (tests: pytest → 451 passed)
Task 5: complete (tests: npm test → 1276 passed; build OK)
Task 6: Step 1-3 done (取り込み・face_crop large[20,0,650,630] small[50,100,550,600]・確認図に顔/服の赤なし・review Artifact https://claude.ai/artifact/GbwApUPFpPLVkMqSx1vKxj)。Step 4 で依頼者の承認待ち。ally05 の変更（character.yaml・source/face.png・書き出し）は未コミット
Task 6: complete (承認済み 2026-11-23。ゲームに入れ、ブラウザで 64/40/32px を確認。forge pytest 451 passed。npm test は最終実行中)
Final review: opus の fresh reviewer。Critical/Important なし、Minor 6 件。
Final: Ruling: M2（crop_review が古い export を承認用に出しうる）— 効果は設計書の失敗条件 4（古い画像を承認）なので Important に格上げ — 直した。M5（進捗の「完了」書式）も作業ページの表示に響くので直した。M4（台帳の写し）・M6（README の大きさ）は私の記述の誤りなので直した — 費用は無し
Final: fixed M2 crop_review の古い export — test_review_rejects_stale_export RED→GREEN, suite 452/452
Final: minor (deferred): M1 はみ出す範囲のテストは書き出し済みの状態からも試す（今の実装は正しいと確認済み）
Final: minor (deferred): M3 範囲のはみ出しは ExportError（設計書・CLAUDE.md は ConfigError と書く。メッセージの形は同じ）
Final: minor (deferred): 表情を expressions から消した古い出力は残る（前からの制限）／確認図の横に印なしの切り出しが無い／clear_colors に偽の値を書くと空で通る
CodeRabbit(883bfec): fixed 5 件（clear_colors の偽値・params.json 無しの承認・元画像の入れ替え・範囲のはみ出しを ConfigError・出力名の衝突）— 各テスト RED→GREEN, suite 461/461
CodeRabbit: Ruling: export.py の元画像ハッシュと crop_review.py の照合を、描画と同じ 1 回の読み込みから取る（元画像の読み込みの間に source/ が入れ替わる競合）— 直さない。起きるのは `cloud install` と `export`・`crop_review` が同時に動いたときだけで、この流れでは Claude が 1 つずつ順に実行する。ほかのプロセスが source/ を差し替えない — 同時に動かすと、旧画像の書き出しに新画像のハッシュが記録され、承認用ページが古い書き出しを受け入れうる。直す場合は、元画像を一度だけ読んでそのバイト列からハッシュと描画を行い、`face_crop_record` の引数を変える（2 ファイル）。依頼者の判断（2026-11-23）
