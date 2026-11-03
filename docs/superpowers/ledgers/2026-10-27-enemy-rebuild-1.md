# SDD ledger — plan: docs/superpowers/plans/2026-10-27-enemy-rebuild-1.md

Spec: docs/superpowers/specs/2026-10-27-enemy-rebuild-design.md
Executor: native (2026-10-27 依頼者が選択)

## Pre-flight
- Task 1 → Task 2: 素体8枚（男性4枚）を芯が複製。一致
- Task 1 Step 5 → Task 3: 被り物を広げるかの答えを Task 3 が使う。一致
- Task 2・3 → Task 4: 芯 `assets/part/body/enemy_male/core_<dir>_<状態>`、部品 `*_<dir>_base.txt`。一致
- Task 4 → Task 5: 組んだコマとシート。一致

## Task 1（BASE 3f88717）
- 新しい素体は scratchpad の base_fix.py（H1 の案 d1/*_H1.txt に胴の行を当てる）で t1/new に作った。リポジトリは未変更
- Task 1: Ruling: 計画は肩の段と拳だけを挙げていたが、素体には輪郭の切れ目もあった（男性 down・up の y=15 の肩の上・y=24 の脚の付け根、横向きの y=15 と足先 y=29、女性 left の y=15、女性 right の y=15・y=29）。body_check を通すため輪郭で閉じた — 単品として完全に描く決まり — 違ったら足先・肩の1画素の戻し
- body_check: 男性 4/4 ok、女性（--no-protrusion）4/4 ok
- Step 5: 確認ページ https://claude.ai/artifact/7umye5Rr7wytvQ3MgenCjw を出して依頼者の承認と被り物の答えを待つ

- 依頼者（10-27）: 新しい素体を採用、被り物は広げない（Claude の意見: 被り物の厚みとして自然、H1 の理由と同じ）
- SPEC: 素体の説明（拳なし・地肌の頭・男性の胴は筒）、分け方に目・服、奥の手の記述を過去形に。ISSUES: 素体の暫定の行と男性 left の奥の手の行を消した
Task 1: complete (commits 3f88717..0032c5b, tests: .venv/bin/python -m unittest discover -s tests → Ran 623 OK; body_check 男性4/4・女性4/4 ok; validate 1257 ok)

## Task 2（BASE 0032c5b）
- Step 1: ガウの芯は idle2・atk_wind・atk_hit が base と同じ。walk_a・walk_b は y=28〜30 の脚だけ（4方向とも）。素体の脚の外形はガウの芯と同じ
- Task 2: Ruling: 脚 y=25〜30 は全部 wood_shadow にした（計画は mkframes の body() どおり cloth_shadow だけを wood_shadow。それだと横向きの手前の脚 q が cloak_dark_base のまま）— ガウの芯と今の敵の歩きのコマ（ガウの完成コマの脚を写す）がどちらも全部 wood_shadow で、立ちと歩きで手前の脚の色が変わらないように — 違ったら横向きの手前の脚を cloak_dark_base に戻す（画素は同じ）
- 作るスクリプトは scratchpad の mk_core.py。body_check 24/24 ok、validate 1281 ok
Task 2: complete (commits 0032c5b..2ab4c58, tests: .venv/bin/python -m unittest discover -s tests → Ran 623 OK; body_check enemy_male 24/24 ok)

## Task 3（BASE 2ab4c58）
- 部品は scratchpad の mk_parts.py で *_<dir>_base.txt に書いた（未コミット）。被り物は輪郭の開いた所（てっぺん・飾り・結び目・角の付け根）を閉じ、さらに顔に接する縁も閉じた（案 A）。目は今のファイルを写した（背面は空の部品で、serialize すると map が無く validate が落ちたため）。服は belt()・tatter() を新しい芯に当てた
- 部品を単品で見ると、ベルトとぼろ布の木の当て布は体の上に描く物で輪郭が無い → Task 4 で checks の open_chars に書く見込み（例外ではなく既存の仕組み）
- 角付きの兜の鼻当て・素の髪の房の内側を閉じると、E2 の目に重なる・接する。決まりどうし（単品として閉じる／目が見分けられる）がぶつかるので、案 A・B を並べて依頼者に聞く。ページ https://claude.ai/artifact/22p5THNFcVky9op95wHh45
- 依頼者（10-28）: 角付きの兜は案 B。素の髪は A・B どちらもおかしい（顔が小さくなり房が顔に入り込んだため）→ 素体＋目の絵を作り、髪を描き直す。案は scratchpad の mk_hair.py（t3/hair、房を頭の輪郭の1px 外へ、前髪の下を輪郭で閉じる、横向きの後ろ髪は目から1px あける）。単品で輪郭に閉じている。ページ https://claude.ai/artifact/F7hgZBS3RryJvxzQkQ1R1M
- 依頼者（10-29）: フルフェイスの兜のバイザーを、添付の兜のような縦の細い隙間が並び前へ突き出した形に。頭のドームとてっぺんは変えない。位置を2段上げた案を承認（down・left・right。up は変えない）。書き込んだのは scratchpad の mk_full2.py。芯・目・ベルトに重ねたページ https://claude.ai/artifact/SQmFTSTz895se1DfN6nGaa
- 依頼者（10-29）: 素の髪はおかっぱになったので元の形に直す → 元の head_bare_<dir>.txt の画素をそのまま *_base に写した（新しい頭が1px 小さいので、元の髪の外側の輪郭がそのまま髪の厚みになり、重ねると今の敵とほぼ同じ見た目）。前髪と房の内側は輪郭が無く肌に接する → Task 4 の part_outline で落ちる見込み。ページ https://claude.ai/artifact/4mKDnVPx6A8HtMHPC4kVHb 。前の案は scratchpad の bare_prev/
- 依頼者（10-29）: Task 3 の36枚を承認（確認ページ https://claude.ai/artifact/NBzQH1rKrNfuZwvJ2sZ9Qi）
Task 3: complete (commits 2ab4c58..4a9a472, tests: .venv/bin/python -m unittest discover -s tests → Ran 623 OK; validate 1317 ok)

## Task 4（BASE 4a9a472）
- Step 1・2: compose・checks はガウの設定から scratchpad の mk_enemy_cfg.py で作った（芯を enemy_male に、最初の front の前に 目→服→頭）。compose が「同じ文字が部品ごとに別の色」で止まったので、頭・目・服36枚の文字を色ごとに1つの大文字にそろえた（remap_chars.py。画素の色は HEAD と比べて0件の違い）
- Step 3: 4体とも compose --force・--check 0
- Step 4 の1回目: weapon_check・eye_check・part_outline が落ちた。分けた結果:
  - 絵の誤り（直した、事後報告）: 兜のバイザーの下の両端（各向き2画素）、素の髪のてっぺんの房の間（元の絵から輪郭が無い。1〜2画素）を輪郭に
  - 前のセッションの取りこぼし: 角付きの兜の案 B（10-28 依頼者）がページの中だけで、部品のファイルは案 A のままコミットしていた（4a9a472）→ apply_horn_b.py で当てた
  - 判定の誤り（依頼者に直し方の案を出す）: part_outline が体の上の縁（ベルト・ぼろ布・素の髪・兜の案 B）を落とす、weapon_check がベルト（wood_base の1行）を隠れた柄と数える（bandit・knight の down_atk_wind）、eye_check の設定が x×y の矩形で E2 の斜めの目を書けない
  - 設定: knight の目はバイザーに隠れる → eyes を全向き null にする見込み
  - 絵の判断（依頼者）: bandit の E5 の横顔の目が顔の縁の輪郭に接する（今の敵も同じ）。ページ https://claude.ai/artifact/8ZzvcZtHka6GiyEjTNsYFE
- 依頼者（10-29）: 道具の直し3件（part_outline の体の上の縁・weapon_check を芯＋武器＋拳で測る・eye_check の点の並び）を承認。E5 の横顔は、left を眼帯の無い普通の目（x=12、1x2）、right を眼帯（2x2）を1px 内側の x=18〜19 に（正面の眼帯は本人の右目）。ページ https://claude.ai/artifact/HUk9p4jBx9CaMLAoDWxJKj
- 依頼者（10-29）: 鼻当ては被り物なので輪郭で閉じる（装飾品にしない）→ 鼻当てを1段（y=10）にし y=11 で閉じた。ページ https://claude.ai/artifact/QeKUugByMXuPPwqT9CpD9N 。課題1: 装飾品の区別を作り、装飾品と髪は体の上の縁に輪郭が無くてよい（設計中）。課題2: 武器は専用の色（パレットの管理リストで用途を持たせる。設計中）。課題3: 目の部品から目を読み、被り物・装飾品で完全に隠れた目は通す
- 10-30: 課題1〜3をパレットの作り直し（色見本・種類・用途の色、unit・tile・face・item すべて）として別の設計にした。設計書 docs/superpowers/specs/2026-10-30-palette-uses-design.md（未コミット）、読むページ https://claude.ai/artifact/1y2eAGrc9Q6yCHY6C5L15Y 。builder check 済み（盾・3件の確かめ方・同じ色の別用途の決め方は Claude の判断）。Task 4 はここで止め、パレットは main から別ブランチ・別 PR。依頼者の承認待ち
- 10-30: 設計 287866d・計画（chore/palette-uses）。Task 4 の途中は git stash に退避
- 11-01: パレットの作り直し（PR #41、main 5e8d391）がマージされたので再開。feat/enemy-rebuild-1 を main に rebase（Task 1〜4a9a472 → 0d1fc60..eb73ce2、衝突なし）。stash を pop → 組んだコマ96枚（dagger-* 24枚×4）が衝突。compose の出力なので依頼者の承認で main 側に戻した（stash@{0} は消さずに残してある）
- 11-01: 頭・服・目 E0・E2 の *_base 32枚を palette_migrate.py で用途の色へ（対応表から、対象外ファイルの pixels を除いた写しを scratchpad の subset_mapping.py で作って使用。規則は同じ）。素体8枚は main 側で移し済み（validate ok）
- 11-01: 残り: 敵の男性の芯24枚（対応表に規則なし）、E5 の *_base 4枚（規則 outline→eyepatch だと、left と down の普通の目も眼帯になる）→ 依頼者に見せて決める。compose/checks の dagger-* 8本は旧い形式（色の名前・hand）なので、main の gau.json から作り直す（前のセッションの mk_enemy_cfg.py は /tmp/claude-1000/-home-ubuntu-workspace/276ed727-5094-54c9-80f3-e82c7be8b228/scratchpad/ に残っている）
- 11-03: 依頼者が E5 の分け方を承認（ページ https://claude.ai/artifact/ECzJVLfmuoGp4LFd4xypGe）。下 x=13〜14 眼帯・x=17 目、左 x=12 目、右 x=18〜19 眼帯。敵の男性の芯24枚は短剣の敵のコマと同じ移し方（outline→contour、skin_rose_*→skin_ruddy_*、cloak_dark_*→clothes_dark_*、wood_shadow→legwear_brown。色の違う画素0）。scratchpad の extra_12.json を対応表の写しに足して移した。validate 全件 ok。未コミット
- 11-03: 依頼者「以後、致命的な問題が無ければあなたで判断して進めて」
- Step 1・2: compose・checks を main のガウの設定から scratchpad の mk_enemy_cfg.py で作り直した（目の部品は parts で {"eye": true}、eyes は書かない）
- compose が文字のぶつかりで止まった2件を、色を変えずに文字だけ付け替えた（rename_char.py）: E5 の眼帯 o→P（芯の輪郭 o とぶつかる）、ぼろ布の patch_base M→N（ベルトの belt_strap M とぶつかる）
- Step 4: knight・horn・thug は1回目から例外0件で通った。bandit は eye_check が眼帯の画素を目として読み「輪郭の色でない」で落ちた
- Task 4: Ruling: 眼帯は目の部品 E5 の中に装飾品の色で描いたまま、eye_check が目の部品の中の装飾品・被り物の色を目として読まないように直した（dcefb58、テスト3件）— パレットの設計が眼帯を「目の部品 E5 の 2x2 の塊」の装飾品の色と決めていて、依頼者が 11-03 に眼帯と目の分け方を承認した。眼帯を別の部品にする案は、片目が一部隠れて設計どおり落ちる — 違ったら、眼帯を別の装飾品の部品に分け、目の部品は見える目だけにする（組んだコマの画素は同じ）
- 7体（ロラン・イネス・ガウ・短剣4体）unit_rules・compose --check すべて 0、exceptions 0件。weapon_check の「手の輪郭」の偽陽性 0件。unittest 714 OK、validate ok
- Step 5: noweapon は main で既に消えていた（何もしない）。Step 6: enemy_build --all 16体 ok、短剣4体のシートに clothes_dark_* の色は0画素
Task 4: complete (commits eb73ce2..0623e08, review: 差分は自分で確認。tests 714 OK)

## Task 5（BASE 0623e08）
- Step 1: 今（main）と組み直しを並べたページ https://claude.ai/artifact/R5vaMk9cuj1a2kamxhXNiT （main のコマは build/main_frames に写し、build/main_recipes の *-main レシピでシートを作り、anim_compare.py で4体）。依頼者の承認待ち
- 11-03: 依頼者が4体の組み直しを承認（ページに戻るリンクを足した Version 2）
- Step 2: enemy_gallery.py がパレットの作り直し（PR #41）の後、レシピを読めずに落ちていた（load_palette の辞書を load_recipe に渡していた）。テストを足して直した（06a74b9）
- Task 5: Ruling: 一覧のページは前の URL（37JAEfycU1ZNCMbJJhQDdp）を更新せず、新しい URL https://claude.ai/artifact/6oELhX8j1eV8NSHeckYFBq に出した — 前のページは base64 の画像で 158KB あり、更新の前に全部を読み込む必要があるため — 違ったら、前の URL を読み込んで同じ内容で出し直す
- contact_sheet.py ok（1317）
- Step 3: SPEC（短剣の持ち方に敵4体）・README（compose の説明）・CLAUDE.md（compose --check の例）・ISSUES（「短剣の敵4体のコマを作り直せない」の行を消し、「敵を 体＋拳で組み直す」の行に進み具合）
- Step 4: unittest 715 OK、validate 0、7体 unit_rules・compose --check 0、npm test 776 passed、npm run build ok
- 最終レビュー（d41d35e まで）: Critical・Important 0、Minor 3（eye_check が装飾品の色の目を全部外して目の確認を飛ばせる・README/ISSUES の敵の生成手順が短剣の4体の作り方とずれている・CLAUDE.md の確認コマンドが1体だけ）。3件とも直した（9830e52。eye_check は装飾品の色の 2x2 の塊だけを外す。テスト1件追加、既存テスト1件の眼帯を 2x2 に）。再レビュー: 3件 ADDRESSED、新しい壊れ無し
- 最終レビュー: minor (deferred): 2列以上の幅の目を眼帯の色で塗ると 2x2 の塊として外れる（E5 の目は1列なので今は当たらない）
- 最終レビュー: minor (deferred): E5 の left_base・up_base の map に使っていない項目（P=eyepatch）がある。validate は通る。up_base は空の部品で map が無いと validate が落ちる
- 確認（9830e52）: unittest 716 OK、7体 unit_rules・compose --check 0
Task 5: complete (commits 0623e08..9830e52, final review clean after 1 fix wave)
- 11-03: 依頼者と保留2件を決めた。E5 left の使っていない P=eyepatch を消した。2列以上の目の抜け道は直さず ISSUES に1行（まれな件）
