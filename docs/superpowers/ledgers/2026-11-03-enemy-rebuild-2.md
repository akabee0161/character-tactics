# SDD ledger — plan: docs/superpowers/plans/2026-11-03-enemy-rebuild-2.md

Spec: docs/superpowers/specs/2026-11-03-enemy-rebuild-2-design.md（元の docs/superpowers/specs/2026-10-27-enemy-rebuild-design.md）
Executor: native（2026-11-03 依頼者が選択）

## Pre-flight
- Task 1 → Task 2: 斧 `assets/part/equip/axe/male/axe_<dir>_<状態>`・拳 `assets/part/fist/enemy_male/axe_hand_*`、空き手はガウか enemy_male（Task 1 Step 2 の結果を Task 2 が使う）。一致
- Task 1 → Task 5: 女性用は男性用を FEMALE_SHIFT でずらす。一致
- Task 3・4・5 → Task 6: 芯 `enemy_female/core_*`、髪 `hair_<名前>{,_back}_<dir>_base`、服 `cloth_{belt,tatter}_female_<dir>_base`、斧・拳 female。一致
- Task 2 → Task 6: 男性の compose/checks を元にする。一致
- Task 0: Ruling: ブランチは origin/main でなく feat/enemy-rebuild-1（9cfea1b）から切った — 依頼者が「PR #42 がマージされるものとして進めてよい」（11-03）。PR #42 はマージコミットで入る見込み — 違ったら（PR #42 に直しが入る・スカッシュ）main に rebase し直す
Task 0: complete (commits 9cfea1b..e5c8ed8, build/main_frames に axe-* 7体を写した)

## Task 1（BASE e5c8ed8）
- 部品は scratchpad の mk_axe.py（mkweapons.py の図形を写した。gen/enemy は import しない）で書いた。斧 16枚・握る拳 16枚。validate 1349 ok
- Task 1: Ruling: up の拳は HAND_CAPS（輪郭の端だけ）でなく、握り (22,18)・(22,13) に完全な fist_v を置いた — 部品は単品として完全に、隠れる拳も層を持つ（SPEC）— 違ったら背面の拳の位置を決め直す（組むと体の陰でほぼ隠れる見込み）
- Task 1: Ruling: 斧はすべての向きで、斧の画素の上下左右の空きを輪郭で閉じた（今は right だけ ringed）— 単品として完全に描く決まり — 違ったら left・up の奥の斧の輪郭を開く（体の奥なのでほとんど見えない）
- Step 2: 空き手はガウの free_hand と、2体とも down・up・left の12コマで肌の画素が一致。right の4コマは、今の絵に空き手が無く（体の奥）、ガウの拳は体の奥の (19〜20, 20〜21)
- Task 1: Ruling: 男性の空き手はガウの free_hand を使い回す（right も）— right の違いは、部品の重なり順で体の奥に置いた結果で、今の絵が拳を描いていないだけ（依頼者 11-03「部品と食い違う今の絵は誤り」）— 違ったら enemy_male/free_hand_right_* を作る
- Step 4: 部品のページ https://claude.ai/artifact/61xj78LjgvJZ5h3hXeaNrG 。依頼者の承認待ち
- 11-03: 依頼者が Task 1 の部品を承認。「あなたの判断で進めてもかまいません」→ 以後の止まるステップはページを出して台帳に書き、承認を待たずに進む（致命的な問題があれば止まる）
Task 1: complete (commits e5c8ed8..a17c829, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python tools/validate.py' → 1349 grid(s) ok)

## Task 2（BASE a17c829）
- Step 1・2: compose・checks は scratchpad の mk_axe_cfg.py で短剣の敵から作った。2体とも compose --check 0
- Step 3 の1回目: hand_mirror・weapon_mirror・tip_check・weapon_check が落ちた
- Task 2: Ruling: left と right を x → 31−x の左右反転にそろえた。left の位置を残して right を作り直し、left の奥の拳を 3×2（fist_v、影の色）にした — 今の right は x → 30−x の反転で1px ずれ、left の奥の拳だけ 2×2 だった。right から left を作ると left の斧が頭の陰にほぼ隠れた — 違ったら right の位置に戻す（right の斧が1px 右へ）
- Task 2: Ruling: 正面の縦の棒（stick）の両端を .o. にした — 刃の先端の決まり1（tip_check）に合わず、AXE_FULL の柄の下の端も .o. — 違ったら角を戻し、tip_check の判定を直す
- Task 2: Ruling: 当たりの斜めの斧を AXE_FULL と同じ寸法（raster_axe_full）で描き直した — 今の raster_axe は斧頭が大きく（握りから2〜10）、weapon_check の握る位置・長さが立ちとそろわなかった — 違ったら raster_axe に戻す
- 残り: weapon_check の長さ（right_atk_hit 7.1 対 立ち 11.7）。斜めの柄は拳の輪郭に隠れて、拳の先に柄がほぼのぞかず、のぞいた斜めの切れ端を _shaft_piece が柄と認めない（縦・横の線だけ）。left の当たりは拳が体の奥で見えない（hidden 相当）、bandit の left の立ち・振りかぶりは結び目で斧が隠れる（partial 相当）
- 直したページ https://claude.ai/artifact/4Hm1wFYE8jX8BZQPL5W6b8 を出して依頼者に止まって報告（system の指示: 道具の判定を変える前に見せる）
- 11-03: 依頼者「道具で落ちたらそれに従って絵を変える。完成品を見せればよい。止まる必要はなかった」→ CLAUDE.md（character-tactics・forge）に指針を書いた。以後、計画の『正しい絵が落ちたら道具の判定を直す』より、道具に従って絵を直すを優先し、止まらない
- 依頼者が「拳の輪郭がない」と指摘 → 組んだコマで肌が透明に接する所は0。柄が拳の上下の輪郭を突き抜けるのは compose の keep（2026-10-09 依頼者が選択）で、今のままにした
- Task 2: Ruling: 当たりの斜めの柄の端を s=−3.6 まで描いた（縦の柄の端 s=−3 に一番近い画素）— 拳の先に柄がのぞかず長さがそろわなかった — 違ったら −3.5 に戻す（1画素）
- Task 2: Ruling: weapon_check の _shaft_piece が、柄と同じ斜めの線の上にある斜め45°の切れ端を柄と認めるように直した（tests: test_diagonal_shaft_beyond_the_fist_is_part_of_the_weapon RED→GREEN、test_diagonal_piece_off_the_shaft_line_is_not_the_weapon）— 斜めの柄は拳の輪郭で切れ、縦・横の線しか認めない判定では長さが測れない（絵では直せない）— 違ったら判定を戻し、当たりのコマを partial に書く
- Task 2: Ruling: weapon_check の hidden・partial を実際に隠れるコマに合わせた（horn: hidden left_atk_hit・up_atk_wind・up_atk_hit、partial left_atk_hit。bandit は加えて left_atk_wind を hidden・partial）— left の当たりは拳が体の奥、背面の振りかぶりは斧頭が柄の陰（SPEC）、bandit の left の振りかぶりは拳と斧がバンダナの結び目の陰 — 例外ではなく既存の設定の項目
- weapon_check の「手の輪郭」の偽陽性: 0件。2体とも unit_rules 0・compose --check 0、ほかの7体も unit_rules 0、unittest 718 OK
- Task 2: Ruling: 男性2体のページは出さず、7体が通った後に1つのページで見せる — 依頼者「完成品を見せればよい」（11-03）— 違ったら男性だけのページを出す
Task 2: complete (commits a17c829..9166d64, tests: unittest 718 OK、unit_rules 9体 0)

## Task 3（BASE 9166d64）
- 芯は scratchpad の mk_core_f.py。body_check --no-protrusion の1回目で歩きの4コマ（left・right の walk_a・walk_b）が「輪郭の切れ目」で落ちた。上げた足が脚の幅からはみ出した所の上が開いていた（今の女性の敵のコマも同じ）
- Task 3: Ruling: 上げた足の上を輪郭で閉じた（y=27・28 の1画素ずつ）— SPEC の walk「上げた足の上を閉じる輪郭」、道具で落ちたら絵を直す — 違ったら female_walk の行だけに戻す
- body_check 24/24 ok、validate 1325 ok
Task 3: complete (commits 9166d64..16293c0, tests: bash -c 'cd pixel-asset-forge && .venv/bin/python tools/body_check.py assets/part/body/enemy_female --no-protrusion && .venv/bin/python tools/validate.py' → 1325 grid(s) ok)

## Task 4・5・6（BASE 16293c0）
- Task 4: 髪 A・B・C と女性用の服は scratchpad の mk_hair_cloth.py で今の部品を *_base に写した（文字は1回目の部品と同じ色に同じ文字、新しい色は空いている大文字）。重ねると新しい頭と芯にほぼ合った
- Task 5: 女性用の斧・握る拳は mk_axe.py --female（男性用を x にずらす）、空き手は mk_free_f.py（今の5体の空き手の位置。5体とも同じ）。verify_shift.py で違い0
- Task 5: Ruling: 女性の空き手の right は left の左右反転の位置 (19〜20, 20〜21) に描いた — 今のコマに無い（体の奥）。拳の層は全向きで持つ（SPEC）— 違ったら位置を決め直す（体の奥で見えない）
- Task 6 の1回目: hand_mirror（down と up）、unit_check（left・right の歩きの脚の中心）、weapon_check（武器が見えない）、part_outline（髪）が落ちた
- Task 6: Ruling: 女性の up の斧と拳のずれを −2 から −1 にし、down（+1）の左右反転にそろえた（base・idle2・歩き・atk_wind）— 今の −2 は x→30−x の反転のころの値 — 違ったら −2 に戻し、down を +2 にする
- Task 5: Ruling: 女性の left の atk_hit のずれを −1 から +1 にし、right（−1）の左右反転にそろえた — weapon_mirror。left の拳は体の奥なので、今の「+1 だと胸の中に入り体の手前に見えた」は起きない — 違ったら −1 に戻す
- Task 6: Ruling: 女性の left・right の歩きで、上げた足の先を1画素短くし、素体の足（2画素）にそろえた — unit_check の脚の中心（歩きだけ 0.5 ずれた）。歩きの脚はイネスの足（3画素）の形だった — 違ったら芯の base の足を3画素にする（素体と食い違う）
- Task 6: Ruling: part_outline が、前と後ろに分けた1本の髪の分け目（透明な隣が、すべてのコマでほかの部品の髪の上）を通すように直した（tests: test_split_hair_edges_covered_by_each_other_pass RED→GREEN、test_split_hair_edge_left_open_by_the_other_part_fails）— 分け目を輪郭で閉じると髪の中に線が出て、絵では直せない — 違ったら判定を戻し、分け目に輪郭を描く
- Task 6: 髪の縁の開いた画素（left・right の頭のてっぺん (18,5)・(13,5)、C の横 (21,6)・(10,6)、C の up の (11,12)・(20,12)）は、芯の外の透明な隣を輪郭にした（close_hair_all.py）
- Task 6: Ruling: weapon_check の hidden に、斧が長い髪・体に全部隠れるコマ（left の立ち・待機・歩き、up の待機など。unit_rules の「武器が見えない」で出たコマ）を書いた — 承認済みの重なり順「斧は髪の陰」どおり — 違ったら、斧が見えるように位置を決め直す（重なり順は変えない）
- 14体 unit_rules・compose --check すべて 0、exceptions 0件、validate 1405 ok、unittest 720 OK
Task 4: complete (commits 097e928..16d956f)
Task 5: complete (commits 16293c0..97c7d95)
Task 6: complete (commits 16d956f..205ac7b, tests: unittest 720 OK、14体 unit_rules 0)

## Task 7（BASE 205ac7b）
- Step 1: Task 7: Ruling: 敵の一覧は新しい URL https://claude.ai/artifact/7kwBZHuskoQPxeZqdz7FwJ に出した — 前のページは 157KB で、出し直す前に全部を読み込む必要がある（1回目と同じ判断）— 違ったら前の URL に出し直す。contact_sheet ok
- 7体の組み直しのページ（今と並べた動きと静止、違う画素に印）https://claude.ai/artifact/QXBqNro4taaGVqxgXgxbju
- Step 2: enemy_build --all 16体 ok、斧の7体のシートに clothes_dark_* の画素0
- Step 3: SPEC（斧の部品・重なり順・左右反転・斜めの斧・古い絵と食い違うときの判断）、ISSUES（far-shade・生成スクリプト・体＋拳の3行）、README・CLAUDE.md（斧の7体の compose）
- Step 4: unittest 720 OK、validate ok（1285。noweapon を消した分減った）、14体 unit_rules・compose --check 0、npm test 776 passed、npm run build ok

## 最終レビュー（9cfea1b..f4f6b6c、Opus のサブエージェント）
- Critical 0、Important 1、Minor 5
- Final: fixed I-1 SPEC の斧の古い weapon_check の手順（noweapon を使う）を消し、斧は checks/axe-*.json と unit_rules.py と書いた（槍の部分は残した）。M-5 の「敵のコマに unit_check を使えない」も槍だけに直した
- Final: fixed M-1 _on_shaft_diagonal の切れ端に拳の近さ（_near）を足した — test_diagonal_piece_on_the_shaft_line_far_from_the_fist_is_not_the_weapon RED→GREEN、suite 721/721、14体 unit_rules 0
- Final: fixed M-4 ISSUES の far-shade の行に、部品で組むユニットは unit_rules.py が --far-shade を渡さず奥の拳の色を道具で見ていないことを書いた
- Final: M-3 台帳の訂正: axe-bandit の left_atk_wind を hidden にした理由は、拳が隠れるのではなく、結び目で柄が切れて拳の近くの柄が武器に入らず「手が無い」で落ちるため（奥の拳は影の色で見えている）
- Final: M-2 台帳の訂正: 女性5体の up_idle2 の hidden は「斧が全部隠れる」ではない。待機2で 2px 上げると斧頭（x=22〜26、y=7〜13）が長い髪の上に出て見え、柄は髪の陰で、刃と拳が 2px より離れて道具が武器を見つけられない。hidden が例外のように働いている。絵を変える直しなので依頼者に聞く（直し方の候補: 女性の up の待機2で斧を上げない／斧頭が出ないように位置を決め直す）
- Final: minor (deferred): M-2 女性の up_idle2 の斧頭が見えているのに hidden（依頼者に報告）
- 11-03: PR #42 がマージされた（main 405efef、head 9cfea1b のままマージコミットで入った）。feat/enemy-rebuild-2 は 9cfea1b の上なので載せ直しは不要（main との差は2回目の11コミットだけ）

## 11-04: weapon_check の「武器と手が見える」をやめる（依頼者）
- 依頼者が女性の背面の待機2（up_idle2）の課題を聞き、weapon_check の決まりの説明を受けて決めた: 部品で組むユニットでは、武器があることを確かめない（部品のファイルが担保）。武器の近くに手があることも、fist_check.py が部品で接しているかを見ているので確かめない（依頼者「別の場所で担保できているなら不要」）。手を見つける仕組みは刃先の向き・握る位置に使うので残す
- weapon_check に --no-presence（tests: test_missing_weapon_and_hand_pass_when_parts_check_them・test_presence_off_still_checks_the_hand_outline RED→GREEN）、unit_rules.py が常に渡す（test_weapon_check_arguments_come_from_the_config）、unit_config の weapon_check から hidden をやめた（test_hidden_frames_are_no_longer_written_in_the_config）。checks/*.json 13本から hidden を消した
- roran・gau の checks は手で詰めて書かれていて、json の書き直しで形が崩れたので、git stash（「drop_hidden の書き直しで形が崩れた roran・gau（11-04）」）に退避して元に戻し、hidden の行だけを手で消した
- 14体 unit_rules 0、unittest 724 OK。M-2（女性の up_idle2 が hidden で例外のように通っていた件）はこれで片付いた
- 文書: SPEC（部品で組むユニットは --no-presence、hidden は書けない）、forge CLAUDE.md の weapon_check の例
- 11-04: 依頼者の指摘（女性の被り物が髪より小さく見え、バンダナがベレー帽のよう）→ 試しの確かめ tools/head_cover_check.py（テスト4件 RED→GREEN）。14体に掛けて落ちたのは女性5体だけ（偽陽性0）。髪の前の部品を、被り物の縁から上で被り物の外に出る画素を消して輪郭で閉じた（trim_hair.py）。5体 unit_rules 0・head_cover_check ok、unittest 728 OK。unit_rules への登録は依頼者の判断待ち。ページ https://claude.ai/artifact/NEqMLofo2Hz1hqPDqtyh5V
- 11-04: 依頼者「背面で被り物の下に髪が張り出して不自然」→ 決まりを頭の高さ（y<=14、縁より下は縁の幅）に広げ（テスト5件）、髪を 2217aaf に戻し、女性用の被り物 head/{bandana,horn}_female を髪が収まるまで広げた（mk_headgear_f.py。外側の輪郭をずらして内側の色で埋める、上へ1行、輪郭で閉じる）。5体 unit_rules・head_cover ok、unittest 729 OK。ページ（Version 2）https://claude.ai/artifact/NEqMLofo2Hz1hqPDqtyh5V
- 11-04: 依頼者「ポニーテールのために兜が横長。部品は増やしたくない」→ 試し: horn_female を髪 B だけに合わせて作り直し（mk_horn_b.py）、C にもそのまま被せた（未コミット）。B は全確認 ok、C は head_cover_check だけ横向きで落ちる（ポニーテールが兜の後ろから出る、left・right 各 17＋2 件）。ページ https://claude.ai/artifact/QrJp2HsjhrDvp3fxJA7dYx
- 11-04: 依頼者「兜の後ろにポニーテール用の穴が要る見え方で、背面と横で矛盾する。最初の横幅の広い案を採用」→ horn_female を BC 両方を覆う大きさに戻した（03254d8 と画素まで同じ）。head_cover_check を unit_rules に入れ（test_the_default_unit_passes_every_check RED→GREEN）、SPEC「被り物は髪より大きく描く」・CLAUDE.md に書いた。14体 unit_rules 0、unittest 729 OK
- 11-04: 奥の拳の色を道具で確かめる件（最終レビュー M-4）を今やることに（依頼者）。全ユニットに掛けると、ロラン・イネス・ガウ・短剣の敵の承認済みの絵の奥の拳が明るく、依頼者が「描き直す」と判断。tools/far_fist_check.py（握る部品のある拳で芯より奥、背面以外、肌は _shadow だけ。テスト4件 RED→GREEN）を unit_rules に入れた（test_the_default_unit_passes_every_check RED→GREEN）。32 部品の明るい肌を同じ肌の影の色に（shade_far_fists.py）。14体を組み直し、unit_rules 0、unittest 733 OK。組んだ絵で変わったのはロラン 5・イネス 8・ガウと短剣の敵 各6 コマ（斧の7体は部品だけ、絵は同じ）。ページ https://claude.ai/artifact/B6q7XP7HEpdfhGNC2kX7tN 。SPEC・ISSUES・CLAUDE.md を直した。ゲーム（character-tactics の assets/images）への書き出しはしていない
