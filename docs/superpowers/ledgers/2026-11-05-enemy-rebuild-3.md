# SDD ledger — D 敵の組み直し 3回目（槍の敵5体）と後始末

Spec: docs/superpowers/specs/2026-10-27-enemy-rebuild-design.md の「2回目・3回目で決まっていること」「後始末（3回目の最後）」、2回目の追記 docs/superpowers/specs/2026-11-03-enemy-rebuild-2-design.md
Plan: 書いていない（引継ぎ 2026-11-05 の指示に沿い、2回目の計画 docs/superpowers/plans/2026-11-03-enemy-rebuild-2.md と同じ流れで進めた）
Executor: native

## 前提
- Ruling: ブランチは引継ぎの feat/enemy-rebuild-3 でなく、このセッションに指定された claude/inspiring-bardeen-cg39oe（main 360cca9 = PR #43 のマージと同じ）— セッションの指定が優先 — 違ったら feat/enemy-rebuild-3 に付け替える
- 対象と組み合わせ（gen/enemy/mkweapons.py の ENEMIES のまま）: spear-knight（男・E0・full・belt）、spear-thug（男・E2・bare・tatter）、spear-thug-{a,b,c}-f（女・E2・被り物なし・tatter_female・長い髪 A/B/C）
- gen/enemy/ は走らせず import もしない。図形は scratchpad の mk_spear.py に写した

## 部品と設定
- 槍 assets/part/equip/spear/{male,female}/spear_<dir>_<状態>（16枚ずつ）、拳 assets/part/fist/enemy_{male,female}/spear_hand_*（16枚ずつ）。空き手は斧の敵と同じ（男 gau/free_hand、女 enemy_female/free_hand）
- compose・checks は scratchpad の mk_spear_cfg.py で axe-horn・axe-horn-b-f から作った（斧→槍、目・服・頭・髪を差し替え。女性は被り物の層を消した）。fist_sizes は 3x2（縦の柄）・2x3（横の柄）
- Ruling: right は left の x→31−x の左右反転で作った（立ち x=10、古い絵は x=11）— 斧の2回目と同じく weapon_mirror の決まり — 違ったら right を x=11 に戻し left を x=20 にする
- Ruling: up の拳は HAND_CAPS（輪郭だけ）でなく握りに完全な 3×2 の拳を置いた。up の槍は全状態で芯の奥（古い振りかぶり・当たりは手前の層）— 承認済みの順「up は槍が芯の奥」と、部品は単品として完全に — 違ったら依頼者に順を確認
- Ruling: left の振りかぶり・当たりの拳（横の柄、2×3）は芯の奥で影の色。古い振りかぶりは体の手前で明るかった — far_fist_check と承認済みの順 — 違ったら依頼者に順を確認
- Ruling: 女性のずれは斧と同じ考え: 立ち・待機・振りかぶり down +1・up −1・left −1・right +1、当たり down +2（FEMALE_SHIFT_WEAPON の槍の例外）・left +1・right −1
- 1回目の unit_rules: 男性2体と女性 C は全項目 ok。女性 A・B は weapon_check「up_atk_hit: 拳が柄の真ん中に無い（1.0px）」で落ちた（長い髪に拳が隠れる）
- Ruling: 女性の up_atk_hit のずれを −2 から 0 にした（−1 でも 0.7px で落ちた）— 道具に従って絵を直す — 違ったら −2 に戻す（道具で落ちる）
- 5体とも unit_rules 0（18項目 ok、exceptions 0件）、compose --check 0。noweapon を消した
Task 槍: complete (commit f2b3e5d)

## 後始末
- gen/enemy/（mkparts・mkframes・mkweapons・PICKER.json・PICKER_female.json）、tests/test_gen_enemy.py・tests/fixtures/enemy_part_paths.txt、どの compose/*.json からも使われない assets/part の古い部品128件（body/female・body/gau の body_idle2/noarm/gau_body・cloth/none と各服の旧版・equip/dagger/dagger_<dir>・eye/E1・E3・E4 と各目の旧版・hair/gau・hair/{A,B,C} の旧版・head/hood と各頭の旧版）を消した
- Ruling: eye/E1・E3・E4 と cloth/none（選ぶページの案で、どの敵も使わない）も消した — gen/enemy/PICKER.json だけが使っていた（引継ぎ「それだけが使う物」）— 違ったら git から戻す
- PROTRUSION_BODIES を () に（tests/test_unit_rules.py を先に直して RED→GREEN）。19体 unit_rules 0
- ISSUES: はみ出し・far-shade・生成スクリプトの出力・mkframes の後ろ髪・ガウの部品の単品・体＋拳の6行を消した。gen/*.py の行から gen/enemy の記述を外した（「短剣の敵4体のコマを…」の行は既に無かった）
- README（敵の作り方）・CLAUDE.md（槍の compose --check、unit_picker の例、body_check の --no-protrusion）・SPEC（槍の部品、古い槍の weapon_check の手順を消した）・UPSTREAM.md を直した
- 確認: unittest 729 OK、validate 1109 ok、19体 unit_rules・compose --check 0、enemy_build --all 16体 ok、contact_sheet ok、npm test 776 passed、npm run build ok
Task 後始末: complete (commit 7143733 と台帳のコミット)

## 今回の対象外で残したもの
- 空の武器部品をコマごとに確かめる仕組み、握る拳の grips を必須にするか（引継ぎの「前回から残っている課題」。ISSUES には足していない）
- ISSUES「刃・鏃と柄・軸の線のつながりを確かめる道具が無い」の時期は「D の敵を描いた後」で、D が終わったので次に決める番
