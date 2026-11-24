# SDD ledger — plan: docs/superpowers/plans/2026-11-23-face-remaining.md
Pre-flight: T1 build_page(root=) → T2 merge が使う: 一致。T2 merge 記録 → T6 adopt: 一致。T3 build_reviews → T7: 一致。T4 stripLook の顔除外 → T8 敵 JSON の顔の括り: 一致。
Task 1: complete (commits 8b2d4e5..b01593e, tests: bash -c 'cd illust-asset-forge && .venv/bin/pytest -q' → 464 passed in 24.54s)
Task 2: complete (commits b01593e..ac86c25, tests: bash -c 'cd illust-asset-forge && .venv/bin/pytest -q' → 468 passed in 26.71s)
Task 2: Ruling: merge→adopt のテストはバイト一致でなく条件の character・seed で比べた — adopt が PNG を書き直すためバイトは一致しない — 誤りなら番号ずれを見逃すが、seed は候補ごとに違うので見逃さない
Task 3: complete (commits ac86c25..efea0fe, tests: bash -c 'cd illust-asset-forge && .venv/bin/pytest -q' → 474 passed in 36.10s)
Task 3: Ruling: --out を 1 人だけに付けたときも build_reviews でそのパスに書く — 黙って無視するより指定どおりに書く方が驚きが少ない — 誤りでも 1 人用の review.html が作られないだけ
Task 4: complete (commits efea0fe..af48930, tests: npx vitest run src/engine/enemy-looks.test.ts →    Duration  11.84s (transform 8.39s, setup 0ms, collect 8.44s, tests 284ms, environment 0ms, prepare 958ms))
Task 4: Ruling: stripLook の緩めは先に落ちるテストが無い（今の JSON で通る）— 計画どおり。落ちる確認は Task 8 で敵の顔を括りに替えたときに、緩めなければ落ちることで代える — 誤りなら顔以外の差を見逃すが、顔の 2 キーだけを消している。全体の npm test 1276 件・build は通過
Task 5: complete (commits af48930..d74b94a, tests: bash -c 'cd illust-asset-forge && .venv/bin/pytest -q tests/test_repo_configs.py' → 55 passed in 0.42s)
Task 5: Ruling: ガウの性別の資料がゲームに無いので 1boy・耳の尖った若者にした。ally06 セラは既存のまま — 候補を依頼者が目で選ぶので、合わなければタグを直して 1 人だけ作り直す — 1 人分の再生成
Task 6: 生成 group1-a 108 枚（20261124_010759）・group1-b 96 枚（20261124_010503）、全部 Tesla T4。merge → merged_20261124_010838（8.4MB）を Artifact https://claude.ai/artifact/YZycvydwa3tihsYcT3Qop5 で提示。依頼者の番号待ち
Task 9: Ruling: 依頼者の頼みで、組 1 の選択の前に組 2 の設定・生成を始めた。組 1 で効いたタグの反映はできていない — 合わない人は 1 人ずつ作り直す — 1 人分の再生成。村人の items は []
develop（d89b798、UPSTREAM.md の Modal の項）を 4f22b0c で取り込んだ。ぶつからず。forge だけで直した問題（install の全身絵・既存の記録の置き換え等）はこのコピーに残っているが、組 1・2 は顔だけを採用し新しい人なので当たらない
Task 9: 生成 group2-a 72 枚（20261124_014738）・group2-b 72 枚（20261124_014809）、全部 Tesla T4。merge → merged_20261124_014825（5.7MB）を Artifact https://claude.ai/artifact/G5bcdjKK7cH1vy9ryewSeC で提示。依頼者の番号待ち
Task 7: Ruling: 計画に無い道具の変更として clear_colors に min_rg を足した（ally09 の背景とシャツを上限だけで見分けられない）— 設計書の「服に穴をあけない」と「背景は透明」を両方満たす最小の変更 — 誤りでも書いた人にしか効かない。テスト 7 件 RED→GREEN、forge 537 件通過
Task 7: Ruling: 反転を 6 人で初回に誤った（ally06・07・09・f-bandit は反転不要、majinaishi・ally08 は反転が要る）。耳の見える側で判断し直して採用し直した — 承認用のページで依頼者も確かめられる
Task 7: ガウ・まじない師は範囲の辺が肌を横切って顔に穴、辺をずらした。garum・majinaishi・m-bandit・ally09 は背景が白でないので clear_colors。承認用のページ https://claude.ai/artifact/AjhHpubRDNFQUhRARXX1o8 で依頼者の承認待ち
Task 9: 組 2 採用（12・19・25・46・58・65・73・94・98・115・121・136）。反転: 25・58・65・94・121・136・98（98 は初回に反転し忘れ、耳の側で見直して反転）。範囲を決め、ally10・npc06 は辺が髪のハイライト・シャツを横切ったのでずらした。ally10・ally15・npc06・npc01 に clear_colors。承認用のページ https://claude.ai/artifact/8Zgh2JPpMCkmGUVq2Q2FnD で依頼者の承認待ち
Task 7: Ruling: 背景の飾り・囲まれた白が「辺から続く白」の方式では消えない（ロラン・ミスト・セラ・リュカ）。依頼者と相談し、案 C（キャラクターの形を判定するモデル anime-seg isnetis.onnx で背景を消す）に決定。手元はメモリ 1.9GB で推論が OOM（依頼者が停止）→ Modal の CPU で動かす。手元にモデルと onnxruntime は置かない — 計画に無い道具の変更 — 30 人を書き出し直して承認をやり直す
Task 7: 道具: matte（Modal の CPU で anime-seg）・erase（多角形）・cloud matte を足した。テスト RED→GREEN、forge 561 件通過。30 人を matte: true（clear_colors は外した）で書き出し直し、ally06・ally07 に erase。ボルグ（ally05）も同じ方法で書き出し直したので承認用のページに入れた
Task 7: harden（128 以下を透明・200 以上を不透明）を足した（RED→GREEN、563 件）。依頼者が赤で囲んだ所（イネス・セラ・リュカ・ノエル・ピコ）を erase で消した。ノエルの顎の下は純白 255 で肌（253,240,226）と違うので背景と判断
Task 7: 依頼者: イネス・セラは今の erase で可。リュカ・ノエル・ピコは選び直し。候補 60 枚に背景除去をかけたページを提示（組1 https://claude.ai/artifact/WsJxLAtoUW9p5P38UbSnfK 、組2 https://claude.ai/artifact/3rdquTP1h3x777TSQ8gU3k）。依頼者の番号待ち。だめなら生成のプロンプトの工夫か、依頼者が手で直す手順を相談（依頼者）
Task 7: 依頼者の選び直し: セラ 93・リュカ 101・ノエル 189（組1）・ピコ 21（組2）。4 人とも反転なし。前の絵の erase は外した（残りはイネスだけ）。リュカの右肩の白い斜線は上着に重なるので消さずに提示。承認用 https://claude.ai/artifact/AWSfHe2E2sbQ3wpWUk4W5C
Task 7: 全候補の背景除去の費用見込み: 348 枚で約 12 分・約 $0.03（48 枚 2 分・12 枚 1 分の実測から。単価は記憶で、請求画面では未確認）。今後は候補のページに背景を消した絵も並べる案を依頼者に提示、いつ入れるかは相談
Task 7: 依頼者: 顔の大きさをそろえる。30 人の目の高さ・顎・顔の中心を 64px の目盛りで測り（local/tools/normalize.py）、大きい顔＝目から顎の 3.6 倍・目の高さ 50%、小さい顔＝2.4 倍・42% で範囲を計算。兜の 2 人は兜の高さ÷2.56 で換算。f-thug は元画像に収まらず 1024（本来 1044）。ines・gau・ally09・npc05 は見比べて顎の値を直した
Task 7: 依頼者の指摘で直した: mist・ally09・ally14 は顔を大きく（倍率 0.85）、ally10（1.15）・ally13（1.2）は小さく、f-thug は胸が入らないよう 0.7。リュカは 101 を --flip で採用し直し、マスクを作り直した。まじない師は選び直し（候補ページ https://claude.ai/artifact/7rcWeus2RNqnRuCuTkgBTf ）。7 人の承認用 https://claude.ai/artifact/VDswrf47qLkZkH1eERrbeY
Task 7: f-thug を 0.58 に狭めた（首が大きすぎ、の指摘）。依頼者: ほかの 6 人は OK。時期の提案（候補ページの背景除去はこの作業の最後、forge 本体は PR 後に別セッション）は承認
Task 7: f-thug は依頼者が承認用のページに描いた緑の枠を座標に直して large [266,70,686,490]。small は顎が入るよう [296,96,666,466]（normalize.py の FIXED）
Task 7: まじない師を 74 に選び直し（耳が左に見えたので --flip）。マスクを作り直し、目・顎を測り直した
Task 7: f-thug の顔が大きすぎ、の指摘で large [186,5,766,585]・small [251,46,701,496] に広げた（緑の枠 420 と、首が大きすぎた 606 の間の 580）
Task 7: complete (commits d74b94a..fc63029, tests: bash -c 'cd illust-asset-forge && .venv/bin/pytest -q' → 563 passed in 34.47s)
Task 7: Ruling: 組 1 と組 2 の範囲・承認を 1 回にまとめ、コミットも 1 つにした（Task 9 の Step 3 を含む）— 依頼者が組 2 を先に進めるよう頼み、承認も 30 人まとめて行ったため — 誤りでも履歴の分け方だけ
Task 7: Ruling: ボルグ（ally05）も matte と大きさそろえで書き出し直した（承認用のページに入れ、依頼者が承認）— 30 人で同じ方法・同じ大きさにするため — ボルグのゲームの顔も替わる
Task 8: complete (commits fc63029..0a2dd6d, tests: npm test →    Duration  322.65s (transform 5.76s, setup 0ms, collect 17.97s, tests 276.49s, environment 18ms, prepare 8.30s))
Task 8: Ruling: 組 2 のゲームへの取り込み（Task 9 Step 4）も同じコミットにした。ブラウザで見たのはステージ 1 で出る画面（仲間一覧 32px・敵のカード 64px・会話 64px・下のバー）だけ。ガルム・女のならず者・組 2 の仲間・村人は、先のステージを解かないと出ないので画面では見ていない（描く処理は全員同じ drawFace）— 誤りなら先のステージで顔が出ない人がいる
Task 8: 事故: 127.0.0.1:9222 で 11-15 から動いていた別のブラウザ（pid 3235117）に、誤ってタップを 3 回送った（負けの画面→ステージ選択→始まりの道）。以後は自分のブラウザをポート 9333 にした。依頼者に報告する
Task 8: Task 4 の緩めの確かめ: 古い enemy-looks.test.ts は、今の JSON で narazumono・yumihei の 2 件が落ちる（顔が括りで違うため）
Task 9: complete (commits d74b94a..0a2dd6d, tests: bash -c 'cd illust-asset-forge && .venv/bin/pytest -q tests/test_repo_configs.py' → 79 passed in 0.83s)
Task 9: Ruling: 組 2 は組 1 と同時に進めた（設定 66f…・範囲と承認は Task 7 のコミット・ゲームは Task 8 のコミット）— 依頼者の頼み — 履歴の分け方だけ
Ruling: 合意した追加（候補のページに背景を消した絵を並べる）を Task 10 の前に入れた。generate・merge・page の既定にし、--no-matte で止める — 依頼者「今後は全候補の背景を除去してから選ぶ」— 1 回あたり数セントと数分が足される
事故: 実装の途中、既存のテストが既定で本物の Modal を呼び、背景除去のアプリが 1 つ起動した（12:18 UTC、CPU、すぐ modal app stop）。tests/conftest.py で本物の Modal を呼べないようにした。依頼者に報告する。forge 569+1 件通過
