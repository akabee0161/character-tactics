# SDD ledger — plan: docs/superpowers/plans/2026-10-12-unit-parts-ines.md

- 実行方法: Native（2026-10-12 依頼者の判断。絵と動きの監修を依頼者が行うため、Subagent-driven から変更）
- BASE（計画を始める時点の HEAD）: 2d4bf88
- Spec: 計画の「Spec」の行（計画 A の決めたこと・SPEC の「部品で組む規約」「弓の持ち方」）。新しい spec 文書は無い

## Pre-flight
| 生む側 | 使う側 | 確かめたこと |
|---|---|---|
| Task 1 PartDef/UnitDef/NONE/export | Task 2 ines_layers.py | 名前と引数（export(unit, parts_dir, config_path, root)）は一致 |
| Task 2 compose/ines.json・parts | Task 3〜6 | ファイル名 core/bow/arrow/bow_hand/arrow_hand_<向き>_<状態> で一致 |
| Task 1 テスト | compose.py の FrameSpec | spec.grids() は存在しないかもしれない → 計画どおり実装前に確かめて合わせる |
Task 1: complete (commits 2d4bf88..c84bca8, tests: unittest discover → Ran 411, OK)
- Task 2: 書き出し 128 ファイル（芯32・部品96）、validate ok。組んだ32コマのうち差は down_walk_b (18,28) の1画素だけ（今の絵はズボン y、組むと弓の下端の輪郭 o）。閉じていない拳の画素 115
- Task 2: Ruling: down_walk_b (18,28) の差は、歩きの使い回し（shares）から外さず、組んだ結果（弓の輪郭）を正とする — 今の絵では持ち上げた脚のズボンが弓の下端 l に輪郭なしで直に接しており、down は弓が芯より手前なので輪郭が見えるのが重なり順どおり。計画の「歩きだけ差が出たら shares から外す」は、歩きの弓が立ちと違う場合の想定で、これは今の絵の欠け — 誤りなら walk_b の弓の部品を別に持つ（down の4ファイルほど）。重なり順の表で依頼者に伝える
- Task 2: 重なり順の表を公開 https://claude.ai/artifact/DeimMmEHRNLCUF2Cu9HVeV（build/ines_parts.html）。依頼者の承認待ち（Step 5）。Step 6 のコミットは承認後
- Task 2: 依頼者が重なり順の表を承認（2026-10-12）
Task 2: complete (commits c84bca8..5654e62, tests: unittest discover → Ran 411, OK)
- Task 3 (down): 作業スクリプト build_dir.py・data_down.py（このフォルダ）で部品を書き直した。元の部品の控えは orig/
- Task 3: Ruling: 弓・矢の拳の keep を両方とも 弓・弦・矢の全色（wood_hi/base/shadow, stone_hi/base, water_base）にそろえた（ines_layers.py の GRIPPED、compose/ines.json） — 計画の keep では idle2 の鏃 t（stone_base）の上に弓の拳の輪郭が描かれ、今の絵で見えていた鏃が欠けた — 誤りなら拳ごとに分ける（ズボン y も wood_shadow だが拳は y≤21 で接しない）
- Task 3: Ruling: 弓・矢・弦（1px の線）の輪郭は、芯の色の画素の上には描かず、芯が透明か輪郭の所と拳の下にだけ描く — SPEC の「弦は体の上で輪郭を付けない」と今の絵（矢・弓の内側も体の上では輪郭なし）に合わせた — 誤りなら部品を単品として全周囲う（胸の上に暗い線が出る）
- Task 3: Ruling: 頭（y0〜13）は全状態で base の芯を使い、首の行 y14〜15 は待機・歩きと攻撃の2通り（攻撃は弓の線の外側の髪を輪郭にした元の絵どおり） — 元の芯の頭は状態で同じで、違いは攻撃の弓の周りだけだった
- Task 3: Finding: body_check は新しい down の芯で「胴からはみ出した画素 6 件」（垂れた髪 x10〜11・x20〜21 と肩の輪郭）だけを出す。元の芯の中心のずれ・切れ目・穴は消えた。髪が肩の下まであるユニットでは誤検出になる（ISSUES に書く）
- Task 3: 確認ページを公開: 部品 https://claude.ai/artifact/DeimMmEHRNLCUF2Cu9HVeV（v2、down のみ）、動き https://claude.ai/artifact/BfmUpGqga38bY8ZtJw69Dw。依頼者の承認と「残り3方向も進めてよいか」の回答待ち
- Task 3: 依頼者の指摘（2026-10-12）: 弓の単体の部品に弦が無いように見える（確認ページの薄い灰色の地に白い弦 stone_hi が溶けていた）。組んだ絵で弓が手前のはずなのに、髪や顔が手前に見える（弓の輪郭を体の上に描かなかったため）
- Task 3: 上の Ruling「弓・矢・弦の輪郭は芯の色の上に描かない」を取り消す。弓の木と矢は単品として全周を輪郭で囲う。弦だけ SPEC どおり体の上で輪郭なし（透明の上では囲う）。弦の決まりを弓・矢に広げた根拠は無く、「部品は単品として完全に描く」に反していた
- Task 3: Finding: 拳以外の部品（武器・弓・矢・盾）が輪郭で閉じているかを確かめる道具が無い（compose.py の hand は拳だけ、body_check は芯だけ）。規約に反した部品が検査をすり抜けた → ISSUES.md に書く（Task 7）
- Task 3: Ruling: compose_page.py の地の色を (225,225,225) から (60,150,150) に変えた（テスト test_ground_stands_apart_from_every_palette_colour、全体 412 件 OK、c57604f） — 弦 stone_hi (#dfe3ea) が地に溶けて依頼者が弦を見つけられなかった。計画外の道具の変更 — 誤りなら色を戻す1行
- Task 3: 弓の木・矢を全周で囲って組み直し、ページを再公開（部品 v3・動き v2）。依頼者の承認と「残り3方向も進めてよいか」の回答待ち
- Task 3: 依頼者の指摘（2026-10-12）: 肘が無くなって横に余裕ができたので、矢を長くし、矢を持つ手を左へ寄せる。攻撃で矢がゴムのように伸びる（鏃が動かない）→ 鏃は最初弓の前方にあり、引くごとに手と鏃が弓に近づく動きにする
- Task 3: 待機: 拳を base (13,19)・idle2 (11,19) に（各2px 左）、矢を2px 長く（鏃は base x23〜24 のまま）。拳が弦より左になったので base から弦が筈へ曲がる（今の idle2 の弦の形）。攻撃: 矢の長さ固定で軸 y=x+4 に沿って動かす（鏃 構え (21,25) → 引き始め (19,23) → 引き絞る (17,21) = 握りの左）。data_down.py の REPLACE。再公開（部品 v4・動き v3）、承認待ち
- Task 3: 依頼者が down を承認（2026-10-12）。「残り3方向も体＋拳で進めてよいか」には、前の版で「概ねOK。肘がなくなってすっきりした」との回答 → 進める
- Task 3: compose.py --force で down 8コマを書き込み、--check は差なし（終了 0）、validate 160 ok
- Task 3: Ruling: unit_check の「down: 脚の中心がそろっていない（攻撃 15、待機・歩き 15.5）」は誤検出として通す — 弓の下端の輪郭（弓は体より手前なので全周を囲う）が足先の1画素（待機 x17・攻撃 x18、y29）にかかり、輪郭を除いて数えるため。芯の脚は全コマ同じ形で body_check も中心のずれを出さない — 誤りなら弓の下端を1行短くする（SPEC の弓の長さ15行が変わる）。ISSUES に「unit_check が手前の持ち物の輪郭に隠れた脚の画素を数えない」を書く（Task 7）
- Task 3: unit_check の増えた切れ目 left_walk_a (12,28)・right_walk_a (19,28) は、まだ手を付けていない向きの今の絵のまま（前から同じ）
Task 3: complete (commits 5654e62..9d073b9, tests: unittest discover → Ran 412, OK)
- Task 4 (up): data_up.py。芯は右の肘（x20〜22、y17〜21）と左の袖・拳の輪郭の名残を消し、頭と胴は全状態で base。見えない弓・弦・矢・矢の拳は down（承認済み）の左右反転。idle2 は矢の拳 (19,19) が体の右から1px のぞく（今の絵は肘が1px 外へ出ていた）。攻撃の鏃は 2→1→0 画素のまま、弓の上半分は鏃と頭の左に輪郭が出ない位置（頭の陰）
- Task 4: 弓が矢より手前（承認した重なり順）で弓を全周で囲うので、base の矢 (10,19)・idle2 の鏃 (10,19) が弓の輪郭に隠れる（今の絵では見えていた）
- Task 4: 公開: 部品 https://claude.ai/artifact/DeimMmEHRNLCUF2Cu9HVeV（v5、up のみ）、動き https://claude.ai/artifact/WjHpQ5H2PXeuGbfqncxBdM。承認待ち
- Task 4: 依頼者が up を ok（2026-10-12）。続けて「down と up の拳の位置を合わせるルールとツールを足す」と決定。順番は ルールとツール → イネスの up に当てはめる → left・right → ロランの見直し（依頼者 ok）
- Task 4: 見えている弓の拳は、up の攻撃が base から上へ4px・左へ1px（SPEC で承認済み）で down と合わない。依頼者の依頼で「4px 下げた試し」を描いた（data_up.py の末尾。前の案は data_up_v1.py）。矢を引く拳は down の攻撃の左右反転。放った後の拳 (20,14) は髪の陰に入り、輪郭だけが x22 に1画素ずつのぞく
- Task 4: 動きのページを更新（前の案と試しを並べる）https://claude.ai/artifact/WjHpQ5H2PXeuGbfqncxBdM v2。依頼者の判断待ち
- Task 4: 依頼者の決定（2026-10-12）: 「原則、上下左右で拳の位置を合わせる。攻撃は動きの表現で位置がずれることが多いのでチェックの例外」。up の攻撃は前の案（元々の構え、弓を base から上へ4px・左へ1px）に戻した（data_up_v1.py）
- Task 4: Ruling: 決まりの検査を tools/hand_mirror.py として足した（テスト7件、全体 419 件 OK、9d08fb4）。SPEC「部品で組む規約」に決まりを書き、ロランの「他の向きの位置をそのままコピーしない」と食い違うことを注記。ISSUES にロランの見直し（B の後）を書いた — 計画外の道具の追加（依頼者の指示） — 誤りなら道具を外す
- Task 4: hand_mirror: イネスの down と up は ok。left・right の矢の拳は合わない（left の奥の拳が体に隠れて欠けたまま切り出されている）→ Task 5・6 で直す。ロランは立ち・待機2・歩きの剣の拳・盾の拳がほぼすべて合わない
- Task 4: 依頼者が up を承認。compose.py --force で up 8コマを書き込み、--check 差なし、validate 160 ok、unit_check に up の失敗なし
Task 4: complete (commits 9d073b9..5f1e6ce, tests: unittest discover → Ran 419, OK)
- Task 5 (left): data_left.py。手前の左腕（y19 x8〜12）を消し、胴の左の輪郭を x12 にそろえた。足先の上の輪郭のずれ（元の絵の (11,28)→(12,28)、歩き a は (11,27)→(12,27)）を直した。拳は right と左右反転（hand_mirror ok）。矢は長さ10（鏃2・軸6・矢羽根2）で拳と一緒に動く。弦は筈（拳の位置、y18）へ曲がる
- Task 5: Finding: 承認済みの重なり順（矢の拳・矢・芯・弓・弓の拳）で部品を完全に描くと、base で奥の拳が弦と矢の輪郭に隠れて消える、矢が弓に切られる、idle2・攻撃で弦が胴の上を通る（SPEC「奥の手・矢・弦は体に重なる画素を描かない」に反する）。元の絵は切り出しの穴で見えていた。案 B（弓・矢・矢の拳・芯・弓の拳）を作り、A と並べたページ https://claude.ai/artifact/AdWPXmdng9ypkprtX35nUS 、B の部品 https://claude.ai/artifact/DeimMmEHRNLCUF2Cu9HVeV v6。依頼者の判断待ち
- Task 5: 依頼者が left の重なり順を B（弓・矢・矢の拳・芯・弓の拳）に変更し、B の絵で承認（2026-10-12）。compose/ines.json と ines_layers.ORDERS を変えた。left 8コマを書き込み、--check（left）差なし、validate ok、unit_check に left の失敗なし（left_walk_a の増えた切れ目 (12,28) も消えた）、body_check は垂れた髪だけ
Task 5: complete (commits 5f1e6ce..9ae5155, tests: unittest discover → Ran 419, OK)
- Task 6 (right): data_right.py。奥の左腕（y19 x20〜23）を消し、胴の右の輪郭を x19 にそろえた。足先の上の輪郭のずれ（(20,28)→(19,28)、歩き a は (20,27)→(19,27)）を直した。弓・弦・矢・拳は left（承認済み）の左右反転。hand_mirror ok
- Task 6: Finding: 承認済みの順（弓・弓の拳・芯・矢・矢の拳）では、idle2・攻撃で手前の手が胴の前で引く弦が胴に隠れる（元の絵は切り出しの穴で見えていた）。案 C（芯・弓・弓の拳・矢・矢の拳）を作った。どちらも、矢の下の輪郭が奥の弓の拳の上の行（y19）を隠す。A と C を並べたページ https://claude.ai/artifact/2yp3zY8RevgEUEBBdZJABt 、C の部品 https://claude.ai/artifact/DeimMmEHRNLCUF2Cu9HVeV v7。依頼者の判断待ち
- Task 6: 依頼者が right の重なり順を C（芯・弓・弓の拳・矢・矢の拳）に変更し、C の絵で承認（2026-10-12）。compose/ines.json と ines_layers.ORDERS を変えた。攻撃の芯の脚は立ちと同じにした（元の right_atk_hit の芯は弦の所 (19,24) が欠け、(19,25) に余分な輪郭があった。組んだ絵は承認した C と同じ）
- Task 6: 32コマすべて compose.py --check 差なし、validate（コマ 160・部品 128）ok、hand_mirror ok、unit_check は down の脚の中心（Task 3 の Ruling の誤検出）だけ、body_check は全32の芯で「胴からはみ出した画素」（垂れた髪と肩）だけ
Task 6: complete (commits 9ae5155..2c4a80d, tests: unittest discover → Ran 419, OK)
- Task 7: SPEC（体＋拳の対応状況、弓の持ち方を腕なし・新しい拳と矢の位置・重なり順・弓と矢の全周の輪郭に、idle2・攻撃の動き、部品で組む規約に「文字で切る」「重なり順は完全に描いた後に確かめる」）、README（イネスの部品と parts_export）、CLAUDE.md（ines の --check、書き出しは実行しない注意）、ISSUES（体＋拳の行を更新、拳以外の部品の輪郭の検査が無い・unit_check の脚の中心・body_check の髪・作業スクリプトの置き場の4行）を更新
- Task 7: Ruling: ines_layers.py の docstring と CLAUDE.md に「今は --export を走らせない（描き直した部品を上書きする）」と書いた — 計画では「描き直す前に一度だけ使う」コマンドとして CLAUDE.md に載せる予定だったが、今走らせると作業が消える — 誤りなら注意書きを外すだけ
