# SDD ledger — plan: docs/superpowers/plans/2026-10-03-ines-unit-bow.md

- spec: docs/superpowers/specs/2026-10-03-ines-unit-bow-design.md
- branch: feat/ines-unit-bow（main 9e7b421 から）。開始 commit c80a672
- 実行: Native（executing-plans）。依頼者の指示により、絵は段階ごとに見せて止まる（skill の連続実行より優先）
- 関門: 製品コードは書かない絵の作業なので、TDD の代わりに validate.py / check_colors.py / open_edges.py / sheet.py の実測を各タスクの関門にする

Pre-flight:
- T2→T3: female_down の規則（肩・くびれ・脚）を T3 が他方向に当てはめる — 整合
- T4→T5→T6→T7→T8: ines/down_base を順に上書き。# map 行は T4 で e f g h、T5 で i j（耳飾りを描くとき）、T6 で p q r を metal_*、T7 で k l m s t u w — 文字の重なりなし
- T8→T9→T10: sheets/ines.txt は T9 で置き、攻撃の行は T10 まで ines_t9.txt で代用 — 整合
- T1→T4: orchid_* のキー名 — 整合

基準: male_* の open_edges の切れ目 22（down 9・left 2・right 2・up 9。肩の上と足先に輪郭が無い画素）。female_* はこれより増やさない

Task 0: complete（道具 present.py・open_edges.py・face_down.py、shots/face32.png。コミットなし）
Task 1: orchid_* = hi #f492e4 / base #c059c0 / shadow #7f2783 / dark #571562（顔の色そのまま）。probe 4回＋pairs 13組すべて OK（最小は orchid_shadow/orchid_dark ΔE 14.6）。validate 0。依頼者の確認待ち（未コミット）
Task 1: complete（commit 07a3e04、依頼者 ok）
Task 2: Ruling: F2 の脚の間を透明 1px でなく 2px にした — 32px のコマの中心が x=15.5 なので、奇数幅の隙間は左右対称にならない — 外れたら: 案を1つ描き直すだけ
Task 2: complete（commit 06a3e5d、依頼者が F3 を選択）
Task 3: female_up/left/right を描いた。横向きは胴の前後の幅を male のまま、背中側 y=21〜22 を1px くびれ、尻 y=24 を左右1px 狭め、脚の中身を手前1px・奥2px、足を手前3px・奥2px。open_edges: female 計10（male 22 以下、同じ種類）。PNG は render.py で作成（render.py の docstring: base の PNG はコミットする）。依頼者の確認待ち
Task 3: Ruling: 依頼者の指摘（横向きが太い）で胸〜腰の前後を2px 削った案 S2 を採用 — 依頼者の選択 — 外れたら: 横向き2枚の描き直し
Task 3: complete（commit 98f7bef、female_*.png も render.py で作ってコミット）
Task 4: Ruling: B3 の垂れを胸 y=20 でなく y=18（下端の輪郭 y=19）までにした — y=20〜21 に右の拳があり、重ねると垂れと拳の境目に輪郭を置けない — 外れたら: 案1つの描き直し
Task 4: Ruling: 依頼者の依頼でレビューのページを作った（review_page.py・review_template.html・stages.json、git 管理外）。段階ごとに stages.json に足して review.html を同じパスで出し直す。URL https://claude.ai/artifact/5t6GLvBWuswEjSkB9eR6eo — 計画外の道具だが依頼者が承認 — 外れたら: 作業フォルダの道具1つ
Task 4: 依頼者が B1 をもとに左右の結び目を指示。案 K1・K2 を描いて質問中
Task 4: 結び目の差し戻し3回（K→L→M→N）。依頼者の指示: 結び目は後頭部の1か所、端は×の下半分のように左右へ広がり、頭や肩に重なる部分は見えない。案 N3・N1・N2 を描いて質問中（knot4.py は端の中身を置いて上下左右に輪郭を自動で付ける）
Task 4: Ruling: 結び目の差し戻しの末 S1（後頭部の結び目から真下へ落ちる端、見え始め y=14 が最も広く先端へ細くなる）— 依頼者の選択 — 外れたら: down_base の頭まわりの描き直し
Task 4: complete（commit c810269）
Task 5: 案 E1〜E3 を描いて質問中。耳飾りの色の probe 5組と skin_shadow/skin_base はすべて OK
Task 5: Ruling: 眉は outline で描けないので、バンダナの額の縁を目の真上まで下げて表す E2 — 依頼者の選択 — 外れたら: 額の2行の描き直し
Task 5: complete（commit 1df9d30）
Task 6: Ruling（計画の不備）: 素体は上着とズボンが同じ文字 r なので、計画どおり p q r を metal_* にするとズボンも黄色になる。ズボン（y=24〜29）を新しい文字 y=cloth_shadow に付け替え、上着だけ黄色にした。ズボンの色は案を選んでもらった後で依頼者に確認する — 外れたら: # map 行1行
Task 6: 案 C1〜C3 を描いて質問中。metal_* と肌・バンダナ・草・輪郭の10組の probe はすべて OK
Task 6: C1 を採用・コミット fc76fd9。ズボンの色は依頼者に確認中
Task 6: Ruling: ズボンは B（wood_shadow の1色、文字 y）— 依頼者の選択 — 外れたら: # map 行1行
Task 6: complete（commits fc76fd9..6d209d6）
Task 7: Ruling: 案は計画の3案ではなく W1・W2 を描き、弦の色だけを変えた W3 を足した — 腕を描き直す手間が大きいため — 外れたら: 案を1つ追加で描く
Task 7: 案 W1〜W3 を描いて質問中
Task 7: Ruling: W1（弓は体の右側に縦、弦 x=17、矢は水平 y=19、右手を体の前へ回す）— 依頼者の選択（正面へ寄せた X1・X2 も描いたうえで W1）— 外れたら: down_base の描き直し
Task 7: complete（commit b7d7c51）
Task 8: up/left/right の base 下書き（cand_base3）を描いて質問中
Task 8: 背面の結び端を正面の見えている範囲（y=14〜17、外側 x=10/21）に合わせて描き直した（cand_tail_up）。質問中
Task 8: 依頼者: 背面は直す前を採り、正面を合わせる。正面の端を T1（首の脇1画素）・T2（y=14 で2px・y=15 で1px）で描いて質問中
Task 8: 依頼者: 正面は T2。背面を T2 に合わせた U1 を描いて質問中
Task 8: Ruling: 正面の結び端は T2（y=14 で x=11〜12、y=15 で x=11）、背面は U1（T2 に外側の縁を合わせた）— 依頼者の選択 — 外れたら: 頭まわりの数画素
Task 8: complete（commit 097db24。validate 0、check_colors 4枚 0 failed、open_edges 2（素体と同じ足先）、count: down l12 s12 t2 w6 / left・right l12 s10 t2 w6 / up l7 s0 t2 w2）
Task 9: Ruling: 待機の案は計画の A（弓だけ上げる）を採らず D（構え全体を1px 上げる）・C（右手を1px 引く）・E（D+C）にした。A は矢が左手の拳を通り、B（2px 上げる）は弓の上端が y=12 で右目に重なる — 外れたら: 案の描き直し
Task 9: compose.py（構えを部品ごとにずらして組み立てる。ずらし0で down_base と一致を確認）を作った。途中で結び端の掃除の順番の不具合（ずらした矢を消す）を見つけて直した
Task 9: 依頼者: 待機は上下でなく矢を持つ手を左右に（引いて戻す）。C1（1px）・C2（2px）を描き、レビューのページに 4fps の再生欄（anims）を足して質問中
Task 9: 依頼者: C2 に肘も引く、弦を動かさない案も。F1（弦が折れる）・F2（弦は真っすぐ）を描いて質問中
Task 9: 依頼者: 肩も動かし肘は小さく。G1（弦が折れる）・G2（弦は真っすぐ）を描いて質問中（肩・肘1px、手2px）
Task 9: 依頼者の指摘で、待機の案の矢を手と一緒に動かした（今まで鏃が止まって矢が伸びていた）。compose.py の矢の範囲を pull ぶんずらす。ずらし0の一致は確認済み
Task 9: Ruling: 正面の待機の2コマ目は G1（肩・肘1px、右手と矢2px 引く、弦は矢の尾の行で折れる）— 依頼者の選択 — 外れたら: 1コマの描き直し。down_breathe.txt に書いた（未コミット）
Task 9: 計画の不備: Step 5 の Expected「sheet.py の idle・walk はすべて ok」は成り立たない。イネスは base で弓と矢が体の横へはみ出し、外接矩形の中心がずれる（down 17.0、left 11.5、right 19.5、up 14.0）。体だけ（輪郭と持ち物を除く）の脚の中心は方向ごとに全コマ一致（down・up 15.5、left 15.0、right 16.0）、足元は全コマ y=30。依頼者に報告して判断待ち
Task 9: Ruling: 中心の確認は sheet.py の判定の代わりに、方向ごとに脚の中心（body_center.py、輪郭と持ち物を除く y>=24）が全コマでそろっているかで行う — 依頼者 ok — 外れたら: 確認の方法だけ
Task 9: complete（commit e2e1e0e。validate 0、check_colors 16枚 0 failed、足元 y=30、脚の中心は方向ごとに一致）
Task 10: Ruling: 正面の攻撃は計画の2案（縦・傾ける）でなく、待機と同じ横向きの構えで引き絞りを強める P1 の1案をまず描いた — 正面向きで矢を見る人へ向けると弓が顔の前を縦に横切るため。依頼者が見たければ描く — 外れたら: 正面3コマの描き直し
Task 10: 依頼者: 正面の攻撃は弓を前向きに持ち替えて下へ放つ。V1（弓を横に寝かせ、矢は x=14 の縦で下向き、hit で尾を3px 上へ引く）を描いて質問中（attack_front.py）
Task 10: 依頼者: 正面の攻撃は弓を縦に持って放つ。攻撃を4コマにし ines.json の attack.frames を4に（spec の「ines.json は変えない」を変更、依頼者 Yes）。V2（縦の弓、弦は「く」の字、矢は短い線）4コマを描き、6fps/9fps の再生を並べて質問中
Task 10: 依頼者: 正面4コマ・6fps より遅く、引き絞るを3倍止めたい。シートで atk_hit を3回並べる案（攻撃6コマ、シート 192×384、ines.json frames=6）を示し、6/5/4fps の再生を並べて質問中
Task 10: Ruling（spec の変更、依頼者の判断）: 攻撃は 構える→引き始め→引き絞る×3→放った後 の6コマ・6fps。描く絵は方向ごとに4枚（atk_wind・atk_draw・atk_hit・atk_release。atk_draw は新しい名前）。ines.json の attack は frames 6・fps 6、シートは横6列 192×384（待機・歩きの行は . で6列にそろえる）。正面は弓を縦に持って見る人の方へ放つ V2 — 外れたら: ines.json 1行とシート定義
Task 10: 背面・左・右の攻撃4枚ずつ（attack3.py）を描き、assets に置いた（未コミット）。質問中
Task 10: 依頼者の指摘で直した: 左の奥の右手・矢・弦は体に重なる画素を描かない（side.py hide_far、持ち物を描く前の体の集合で判定）。背面は矢を描かず、右手は肘を上げて肩の後ろ・首の横へ引く。質問中
Task 10: 左向きの攻撃は依頼者 OK。背面: 右側は動かさず、弓と左手を 2px（Y2）/3px（Y3）上げ、矢なし（up.py で組み立て、ずらし0で up_base と一致を確認）。質問中
Task 10: 背面: 依頼者 Y3、さらに左上へ。Z1〜Z4（上3/4px × 左1/2px、袖でつなぐ）を描いて質問中。up.py で結び端の行の描き直しが弓と拳を消す不具合を見つけて直した（ずらし0の一致は確認済み）
Task 10: 背面の左側は Z2 に決定。右腕を下げる案 R1（0,0,1,1）・R2（0,1,1,1）・R3（0,1,2,2）を描いて質問中（up.py に elbow_dy）
Task 10: Ruling: 背面の攻撃は Z3（上4・左1）+ R1（右腕 0,0,1,1px 下げる）、矢なし — 依頼者の選択（Z2 は Z3 の書き間違いと訂正）— 外れたら: 背面4枚。assets に書いた（未コミット）、確認待ち
Task 10: complete（commit a66abca。32枚、validate 0、check_colors 0 failed、シート 192x384、ines.json attack 6/6）
Task 10: 依頼者の指摘: 背面の鏃の直しを見せずに先へ進めた（コミット a66abca に含め、Task 11 の書き出し・npm test/build・anim-page 公開・vite preview と1枚の撮影まで進めた）。vite preview（自分のタスク）は止めた。鏃をレビューのページに載せて確認待ち
Task 10: 依頼者: 鏃は上向き、引くほど見える範囲を少なく。矢を拳の左の列で縦に、見える長さ 3→2→1→0 にした（未コミット）。確認待ち
Task 10: 依頼者: 鏃は弓の向こう側、構えだけで案を。V1/V2（真上）・L1/L2（左上へ傾く）を描いて質問中。弓の画素には描かない
Task 10: 依頼者: V1 と L1 で動きを。鏃 2→1→0→0 の4枚ずつを描いて質問中（head_up2.py）
Task 10: Ruling: 背面の鏃は V1（真上向き、構える2→引き始め1→引き絞る0→放った後0画素、弓の画素には描かない）— 依頼者の選択 — 外れたら: 背面3枚の数画素。commit 3cdf1b1
Task 11: 書き出し（ines-map.png だけ変化）、npm test 776/776、build OK、anim-page を同じ URL に出し直し、ゲームを CDP で撮った（背面の待機と攻撃が写る）。vite preview（自分のタスク）は止めた。確認待ち（sprites.json と ines-map.png は未コミット）
Task 11: complete（commit daee52d。export は ines-map.png だけ変化、npm test 776/776、build OK、anim-page 再公開、ゲームで背面の待機と攻撃を確認、merge-tree で増えたぶつかりなし）
Final review: 新しいレビュアー（opus）。With fixes。Critical 0、Important 2、Minor 4
Final: fixed HANDOVER のマージの記述（ISSUES.md も roran-face と新しくぶつかる）— git merge-tree で HEAD と roran-face を比べて CONFLICT 3件を確認、文書だけの直しなのでテストなし
Final: fixed SPEC の中心の判定の記述が弓のユニットと矛盾 — 脚の中心で確かめる段落を足し、body_center.py で値（down・up 15.5、left 15.0、right 16.0）を確認、文書だけの直し
Final: minor (deferred): forge の README.md 312・332・375行目が「手本は roran」「1体24コマ」のまま（README は roran-face と既にぶつかる）
Final: minor (deferred): down_walk_a/b で弓の下端 (17,28) が脚に上書き、up_breathe で弓 (11,19) が矢の軸に上書き（1画素の点滅。絵なので依頼者に確認する）
Final: minor (deferred): 背面の up_atk_release は up_atk_hit と同じ絵（R1・V1 どおり）。SPEC に明記していない
Final: minor (deferred): 攻撃を6コマにして発射が 0.33秒→0.83秒後に遅れた（バランスへの影響を HANDOVER に書いていない）
Final: Ruling: 作業フォルダ（.superpowers/sdd/2026-10-03-ines-unit-bow/）は消さずに残す — HANDOVER が台帳・道具・レビューのページの元ファイルを指している。これまでの計画のフォルダも残している — 外れたら: git 管理外のファイルが残るだけ
Final: fixed 歩きの正面 (17,28) と背面の待機 (11,19) の弓の1画素 — 依頼者がアニメで見比べて直すと判断。validate 0、check_colors 32枚 0 failed、export は ines-map.png だけ変化、npm test 776/776。commit a5a681b
