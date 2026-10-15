# SDD ledger — plan: docs/superpowers/plans/2026-10-15-unit-parts-gau.md

Spec: pixel-asset-forge/types/unit/SPEC.md、計画 A・B
Pre-flight: Task 1 が書く部品・compose/gau.json を Task 2〜5 が直す。名前は Task 1 の表で一致。新しいコードの受け渡しは無い
Ruling: 計画は依頼者が 2026-10-15 に承認（「はい、進めてください」）
Task 1: Step 2〜4 済み。72 ファイル、validate ok、24コマ「今の絵と違う画素 0」、閉じていない拳の画素 75、空の拳は up_atk_hit の短剣の拳・right の空き手の拳4つ（計画どおり）。ORDERS は初めの案のまま。Step 5 で依頼者の承認待ち（コミット前）
Task 1: SendUserFile はプロジェクトのスレッドでないため届かず。build/gau_parts.html のパスを渡し、ヘッドレスで表示を確認した
Task 1: Ruling: 重なり順は初めの案のまま依頼者が承認（2026-10-15、スマホ用の向きごとの PNG で確認）
Task 1: complete (commits a76d6d7..9a7c98e, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests' → ok   /tmp/tmp21iaelsl/tmpilf0kcno_attack.gif  1 frame(s) at 6fps (170ms))
Task 2: down を描いた。芯は胴の左右の輪郭を x=10・x=21 のまっすぐに戻し（拳の所のへこみと攻撃の肩のふくらみを消す）、行 0〜27 を全状態で同じにした（耳の左下の角は攻撃の形にそろえた）。短剣は拳に隠れた柄（m）と柄頭（n）を描き足し、拳は hand_outline で閉じて元の絵の角の輪郭を消した。今の絵との差は atk_wind・atk_hit の (9,16)(10,16) の2画素だけ
Task 2: Finding: body_check の down の FAIL（中心・はみ出し (22..24,15..18)・切れ目 3件）は書き出した直後の芯でも同じ。はみ出しは頭巾の垂れ。描き直しで増えていない
Task 2: dagger_down_atk_wind の map に n=wood_shadow を足した（元のコマに n が無かった）。build/ を消す rm -rf が拒否されたので、案は /tmp/gau_cand_down に組んだ
Task 2: Ruling: 依頼者が down を承認し、この見え方で残り3方向も進めてよいと回答（2026-10-15、スマホ用 PNG で確認）。拳は今の位置（胴の縁に重なる）のまま
Task 2: コマを組み直した。compose --check 0、validate ok
Task 2: complete (commits 9a7c98e..4c18f3d, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | tail -1' → ok   /tmp/tmp8pfyksfk/tmpyzsi_swo_attack.gif  1 frame(s) at 6fps (170ms))
Task 3: Ruling: up の重なり順を 短剣・芯・短剣の拳・空き手の拳 に変える案にした（承認待ち）— 芯の胴の輪郭を x=10・x=21 のまっすぐに戻すと、体の後ろの拳が1列隠れ、空き手は1px 幅・短剣の拳は影の色だけになって消えて見えたため。体の手前に置くと今の絵と同じ見え方になる — 外れたら拳を外へ1px 動かす（hand_mirror が down と合わなくなる）
Task 3: Ruling: up_atk_wind・up_atk_hit の短剣、up_atk_hit の短剣の拳は空のままにする — SPEC「部品で組む規約」の、剣ごと体に隠れるコマの剣と剣の拳は空の部品を置く（ロランの up_atk_hit）に合わせた。計画の「隠れる位置に描く」より SPEC が優先 — 外れたら隠れる位置に描き足す
Task 3: up を描いた。芯は胴の左右をまっすぐにし行 0〜27 を全状態で同じにした（肩のふくらみ・突きの肘を消す）。短剣は idle2 の形（鍔4px・柄・柄頭）にそろえ、base は柄頭が拳の下からのぞく（down と同じ）。今の絵との差: base・歩き 3、idle2 1、atk_wind 1、atk_hit 8（肘）
Task 3: 依頼者が差し戻し: 拳を体の手前に回したのは誤り。奥の物が隠れるのは問題ではなく、承認された順を勝手に変えてはならない。上の up の順の Ruling は取り消し、compose/gau.json は承認された順（短剣・短剣の拳・空き手の拳・芯）に戻した。決まりを SPEC「部品で組む規約」とメモリに書いた
Task 3: 依頼者が up を承認（2026-10-15、承認された順のまま）。コマを組み直した。down・up の12コマ compose --check 0
Task 3: complete (commits 4c18f3d..3cb68cd, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | tail -1' → ok   /tmp/tmpgajqg3jf/tmpknkvrjnr_attack.gif  1 frame(s) at 6fps (170ms))
Task 4: 描く前の拳の案A: left の短剣の拳を right（3×2、x=10〜12）の反転 x=19〜21 に置き、短剣（刃 x=20〜21、柄 x=20）を完全に描いた。拳は体の後ろなので x=21 の1列だけ見える。芯は胴の左の穴（y=20〜21）を埋め、全状態で同じにした。依頼者に案を見せて止まる
Task 4: Ruling: 依頼者が案A（left の短剣の拳を right の反転 x=19〜21・3×2）を承認（2026-10-15）
Task 4: left を描いた。構えの拳は 3×2 で元と同じ行（y=16〜17、見えるのは x=21 の1列）、短剣は体に隠れるので空。突きの拳は 2×2 のまま閉じ（攻撃は位置合わせの例外）、短剣の柄と柄頭を拳の下に描き足した。空き手の拳の上下の輪郭を閉じた。body_check の left は直す前の4件から2件に減った（残りは元からある (18,15)・(11,29)）。今の絵との差: base・歩き 10、idle2 13、atk_wind 5、atk_hit 4
Task 4: 依頼者が left を承認（2026-10-15）。コマを組み直した。down・up・left の18コマ compose --check 0
Task 4: complete (commits 3cb68cd..49f2c3e, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | tail -1' → ok   /tmp/tmp4cdjlipt/tmp8_1zcwjd_attack.gif  1 frame(s) at 6fps (170ms))
Task 5: right を描いた。芯は胴の左の穴（y=16〜20）を埋め、頭は短剣から離れた突きの形にそろえて全状態で同じにした。短剣の拳は left の反転 x=10〜12。空き手の拳は left の反転 x=19〜20・y=20〜21 に体の奥へ描いた（体の輪郭の外に輪郭 x=21 だけが見える）。短剣は柄・柄頭を描き足し、構え・突きは握りを拳の下に描いた。hand_mirror ok。body_check の right は直す前の3件から2件に減った。今の絵との差: base・歩き 5、idle2 9、atk_wind 11、atk_hit 32（袖を消した）
Task 5: 依頼者が right を承認（2026-10-15）。コマを組み直した。24コマ compose --check 0
Task 5: complete (commits 49f2c3e..b9392de, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | tail -1' → ok   /tmp/tmptpxk1hft/tmpdm88fhi4_attack.gif  1 frame(s) at 6fps (170ms))
Task 6: SPEC（体＋拳の対応状況、短剣の持ち方を部品・重なり順・腕なしの攻撃に書き直し、書き出しの定義にガウ）・README・CLAUDE.md・ISSUES（敵だけ残す、ガウの古い部品は敵だけが使う、描き足しの道具の行は解消して消す、body_check・unit_check・スマホ用画像の道具を足す）を直した
Task 6: Ruling: 作業フォルダ（.superpowers/sdd/2026-10-15-unit-parts-gau/）は計画の終わりでも消さない — ISSUES にスマホ用画像の道具の置き場として書いたため（イネスでも作業スクリプトは消さなかった） — 外れたら手で消す
Task 6: complete (commits b9392de..030d640, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | grep -E '^(OK|FAILED)'' → OK)
Final review: opus の code-reviewer。Critical 0、Important 2、Minor 4
Final: fixed I-1 weapon_check の left「手が細い」が正典に無い — SPEC の weapon_check の節と ISSUES のロランの行（ガウを含める）を直した（文書のみ。weapon_check を走らせて 4件の FAIL を確かめた）
Final: I-2 体に隠れる短剣（up_atk_wind・left_atk_wind）を空にした件は、計画どおり依頼者に聞く（Task 3 の Ruling は剣と拳が両方隠れる場合の例外を当てはめ過ぎていた）
Final: fixed M-1 SPEC の拳の大きさの記述、M-2 ISSUES の body_check の up、M-3 空き手の拳の keep を外した（compose --check 0、24コマ変わらず）、M-4 台帳の写しを最後に取り直す
Final: Ruling 取り消し: up_atk_wind・left_atk_wind の短剣を空にしたのは誤り（決まりは「部品は単品として完全に描く」で、依頼者に聞くことでもなかった。2026-10-15 依頼者の指摘）。隠れる位置に描いた: up は拳の後ろに刃を奥へ向けた端からの姿（鍔と刃の断面）、left は拳から体の後ろを通って前へ向けた水平の短剣（right の構えの形）。compose --check 0（24コマ変わらず）
