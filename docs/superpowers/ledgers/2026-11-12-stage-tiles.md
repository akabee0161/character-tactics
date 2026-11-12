# SDD ledger — plan: docs/superpowers/plans/2026-11-12-stage-tiles.md
Pre-flight: Task 2 の形ファイル→Task 6 の写し、Task 3 の darkness/light→Task 4 描画・Task 6 JSON、Task 5 のタイル→Task 6 の sprites.json。矛盾なし
Task 1: complete (commits 8cdcbb2..76bb8a2, tests: npm test →    Duration  31.17s (transform 1.65s, setup 0ms, collect 5.02s, tests 15.32s, environment 10ms, prepare 3.28s))
Task 2: Ruling: 依頼者が10ステージの形を承認（2026-11-12、shapes/stage*.txt のとおり）。地形の種類 — s1 草地/道/森(0.5)/木/岩/村; s2 砦の外壁/城壁の天面・正面/見張り台の屋根・正面/門(歩ける)/砦の中庭/砦の外の草地/木; s3 城の壁/石の床/絨毯/柱/玉座; s4 草地/木/岩/砂利の川原/川/浅瀬(歩ける)/村; s5 森の地面/道/木/村; s6 石切り場の地面/岩壁/切り出した石/村; s7 石の床/塔の壁/燭台(light48)/魔法陣/祭壇; s8 地面/道/関所の外柵/柵/番小屋の屋根・正面/村; s9 踏み固めた地面/木/テント/たき火(light72)/ランプ(light40); s10 地面/城壁の外周/城壁の天面・正面/大きな門の上・門/村 — 敵などの置き直しは0件（全て歩けるマス上）
Task 2: complete (承認済み。コミットなし。形は .superpowers/sdd/2026-11-12-stage-tiles/shapes/)
Task 3: complete (commits 76bb8a2..ab185d2, tests: npm test →    Duration  35.62s (transform 1.71s, setup 0ms, collect 5.05s, tests 19.58s, environment 10ms, prepare 3.36s))
Task 4: complete (commits ab185d2..c67a36b, tests: npm test →    Duration  31.63s (transform 1.70s, setup 0ms, collect 4.94s, tests 15.50s, environment 10ms, prepare 3.39s))
Task 4: Ruling: 膜の順は「暗いステージだけ体→膜→印と線→HPバー・輪」に分けた（暗くないステージの描画順は不変）— 計画の選択肢のうち drawUnits を phase で分ける方を採用 — 暗いステージで勝利地点の印・つなぐ線がユニットの体の上に描かれる（影響は暗い2ステージだけ）
Task 5a(川原): 依頼者承認、コミット済み。Ruling: tilemap --unplaced は以前からの未配置 11 件（bridge_v・dirt・fence_v・mountain_*・path_*）で終了 1 になる — 新タイルが 0 件であることで確かめた — 計画の「0 で終わる」は満たせない（既存の課題。dirt は後の家族のレイアウトで置く）。check_colors の FAIL 12 件（staff-a-f・b-f の up_*）も以前からで、新タイルとは無関係
Task 5: Ruling: 依頼者が「家族ごとに止まる」指示を撤回し、残り5家族（石切り場・城壁・関所・野営地・塔）を続けて進めると決めた（2026-11-12） — 家族ごとの承認待ちをしない。Task 7（全ステージの画面）の確認は残す — 絵は Task 7 でまとめて見てもらう
Task 5: complete (commits 76bb8a2..882fdf4, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python tools/validate.py && .venv/bin/python -m unittest discover -s tests' → ok   /tmp/tmp_vyzldk8/tmpqwkns0pv_attack.gif  1 frame(s) at 6fps (170ms))
Task 6: complete (commits 882fdf4..279db7c, tests: npm test →    Duration  29.91s (transform 1.64s, setup 0ms, collect 5.30s, tests 13.83s, environment 10ms, prepare 3.26s))
Task 8: complete (commits 279db7c..c7ac273, tests: npm test →    Duration  32.20s (transform 1.67s, setup 0ms, collect 5.40s, tests 15.52s, environment 10ms, prepare 3.43s))
Task 7: Ruling: 暗さ・明かりの値は初めの値のまま採った（stage9 darkness 0.72・たき火 72・ランプ 40、stage7 darkness 0.55・燭台 48）— 実画面（stages.html）で依頼者が承認した — 濃さ・半径は JSON の数値だけで直せる
Task 7: complete (実画面を 10 ステージ×配置・戦闘で撮り、Review Focus 1・2 を画面で確認。依頼者承認 2026-11-12。コミットなし)
Final: 最終レビュー（opus）— Critical なし・Important なし
Final: minor (deferred): 範囲外の light を書くとその文字が legend から外れ、mapRows の行が詰まって関係のない足元エラーが大量に出る（schema.ts の light 検査。speed も同じ形。起動時エラーにはなる）
Final: minor (deferred): 勝利地点への到達テストが開始位置と敵だけで、時間湧き・説得の相手・村の隣は見ていない（loader.test.ts。今のデータは全て到達できると確認済み）
Final: Ruling: 台帳に Task 7 の行が無かった指摘は記録漏れとして直した — 上の 2 行 — 無し
