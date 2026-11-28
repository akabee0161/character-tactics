# SDD ledger — plan: docs/superpowers/plans/2026-11-27-unit-art-all-4.md

Pre-flight: Task 2 → Task 3: Task 2 が equip/shield/ally14（形）・fist/ally14（肌色替えの複製元）・台帳の書き方を作り、Task 3 が複製して色だけ替える。部品名の読み替え（ally14→ally10）だけが違い、食い違いなし。
Ruling: 実行方法は Native（このセッションで私が実装） — 依頼者が「ネイティブ」と答えた（2026-11-27） — 独立したレビューは最終の 1 回だけ
Ruling: 依頼者への確認事項は、私が判断して進め、作業が終わってから最後にまとめて聞く — 依頼者の指示（2026-11-27）— 判断が違えば最後にまとめて直す
Ruling: 作業は今のチェックアウト（worktree を作らない） — ~/.claude/rules/git-workflow.md
Ruling: PR のマージは依頼者の合図を待つ（push・PR は頼まれたときだけ） — 依頼者の指示
Ruling: ブランチ feat/unit-art-shield は develop c5f2eae（PR #72 マージ後）から。上流の追跡は外した — 依頼者が「72 はマージしました」と答えた — なし
Ruling: この作業の「テスト」は確認の道具（validate・unit_rules・compose --check）。checks と compose を先に作って落ちるのを見てから部品を描く — CLAUDE.md テスト方針
Task 1: complete (commit f9a3530 docs: 計画。ブランチ feat/unit-art-shield)
Task 2: Ruling: 顔と全身絵の食い違いは顔を正（黒髪・濃い髭・青の鎧）。全身絵の黒い手甲・肩当ての角・金の渦・膝当て・ベルトの金具は描かない — 依頼者の追加指示（確認せず進める）と、拳は肌の種類の色でないと検査が落ちる決まり — 全身絵より素朴になる
Task 2: Ruling: 芯は body/ally13 の色替え、髪と髭は hair/ally09 の形を黒に、鎧は cloth/ally13 の形を青に（肩当ての上の行を金）。大柄はオルトと同じ形のまま — 計画の「決めてあること」と、新しい素体・背丈の例外を作らない決まり — オルト・バルドと形が似る（色と盾で見分ける）
Task 2: Ruling: 髭は正面だけ顎の下 3 行を埋めた（x13〜18・y14、x14〜17・y15、x15〜16・y16）。鼻の位置（x15〜16・y12〜13）は肌のまま。横・背面は変えない — 全身絵の顎全体を覆う髭に寄せるため。part_outline は一度落ち（x12・x19 の y14 が輪郭で閉じない）、道具に従って 1 行ずつ狭めて通した — 髭の形は依頼者が見て決める
Task 2: Ruling: 盾は外形 12×14（ボルグは 10×11）の B 案にした。A 12×12・C 12×16 を作って比べるのは省いた — 全身絵の盾は人の背丈の 6 割ほどで、B は足元（y27）に収まり顔・目を覆わない。CP1 で 3 案を単体で見せる計画からの逸脱 — 大きさは依頼者が見て決める
Task 2: Ruling: 盾の面の中ほどに金の 2×2 の飾りを足した — 全身絵の盾の大きな金の渦を 32px では 1 つの飾りにまとめた — なし
Task 2: Ruling: 拳はボルグの盾の拳と剣の拳（空き手に読み替え）の複製。fist/ally14 に写した（共有しない）。肌はボルグと同じ skin_fair のまま（顔の肌と合わせて替えなかった）— 計画は空き手をオルトの fist/ally13/free_hand（2x2）の写しとし、肌の色替えも書いていたが、実際は剣の拳（3x2）を写した。計画の書き方（オルトの空き手）は肌の側の手で、攻撃で動く拳ではなかったため。ボルグの部品は変更なし — 剣の拳は上向き・左向きの atk_hit で拳が消える欠陥を生んだ（最終レビューで発見、下の Final 行で直した）
Task 2: 色見本の最初の案（髪 ink の中と暗）は check_colors が落とした（ΔE 5.5、下限 10）。probe_colors を中と暗の組では測っていなかった。髪の 3 色を #5a6480・#3d445a・#272b3b に直して通した
Task 2: unit_rules ally14 は 18 項目 ok（weapon_check は設定が null で対象外）、compose --check 0、validate 0、check_colors の hard failure は staff-a-f・staff-b-f の 12 コマだけ。書き出しで変わった PNG は ally14-map.png だけ。ボルグ・オルト・バルド・ガルムの部品の差分は 0 件。npm run build OK
Task 3: Ruling: 顔と全身絵の食い違いは顔を正（淡い金髪・黄の襟・白）。全身絵の青い十字の胸飾り・金の縦の帯・外套の黒い裏地・白い靴の金の縁・盾の青い宝石は描かない — 依頼者の追加指示（確認せず進める）— 32px で見えない
Task 3: Ruling: 髪はオルトの短い髪の形を淡い金に。顔のあごの高さの毛先（ボブの横の房）は描かない — 顔の開口を狭めて目の検査が落ちる恐れがあり、髪の形を作り直す手間に見合わない — シオンの髪が顔の絵より短い
Task 3: Ruling: 法衣はセラのローブ cloth/ally06 の形を白に（文字を K→N・L→P・U→Y・V→B に替えて盾の文字と衝突させない）。男性の芯にもそのまま載り、足先は見える — 計画（cloth/robe を手本）に近いが、手本は cloth/ally06 を使った — 法衣が裾の広いワンピースに見える
Task 3: Ruling: 盾はガンツの盾の形の複製（B 案）。面は金・縁は砂色・面に白い十字（正面と背面だけ、縦 2×8・横 2×2）。飾りの 2×2 は描かない — 計画（十字が 32px で読めなければ面の金だけ）。十字は読めた — なし
Task 3: 色見本は描く前に測った。白の法衣の明と中が WARN（ΔE 7.9）だったので中を #e0dacf にして ΔE 12 にした。unit_rules ally10 は 18 項目 ok、compose --check 0、validate 0、check_colors の hard failure は staff-a-f・staff-b-f の 12 コマだけ
Review Focus 3: 歩きのコマ間の画素の差は 7〜13（セラは 7〜10）。足先が見え、足元は止まって見えない — ガンツ・シオンとも
Review Focus 4: 攻撃のコマ（空き手の拳だけが動く）の差は、atk_wind 19〜28 画素・atk_hit 6〜26 画素（左向きの atk_hit が 6 画素で最小）。セラ（杖）は atk_wind 65〜157・atk_hit 43〜183 画素（ユナは測っていない）。拳だけの動きは小さい。拳の動きを大きくする・盾を動かす案は、盾 base の決め（依頼者 2026-11-25）に触れるので直していない。依頼者に聞く
Ruling: ガンツ（Task 2）とシオン（Task 3）を 1 コミットにした — 色見本・SPEC・CLAUDE.md・sprites.json が 2 人で同じファイルに入り、対話的な部分ステージが使えないため（前の計画と同じ扱い）— 2 人のどちらかだけを戻すときは手で分ける
Ruling: 勝率の確認（npm run balance）は流さなかった — 依頼者の指示（2026-11-26「開発中に勝率が動くことは重要でない。develop→main の前に確認して調整する」）。両者とも攻撃のコマ数は変えていない — なし
Ruling: /verify は流さず、npm run build・npm test（1276 件 OK）・npx vitest run src/engine（341 件 OK）で代えた — npm test は約 27 分（feat/split-slow-tests が develop に入っていないため、遅い 4 本も流れる。依頼者の指摘 2026-11-27）。npm test はシオンの書き出し前に流した（シオンの PNG と sprites.json の行は、その後の build と src/engine の実行で確かめた）— シオンの PNG が src/ の他のテストに影響すれば見逃す
Ruling: 並行して別のセッションが PR 6（旗と翼）を進めることになった（依頼者 2026-11-27）。そのために私が書いた指示文では、別の worktree を使い、sprites.json・palette・SPEC・CLAUDE.md・HANDOVER の同じ場所への追記はマージ順で衝突する、後からマージする側で解決する、としてある — 衝突の解決は依頼者がマージ順を決めた後
Task 2: complete (commit e32484b。tests: npm test 1276 件 OK・npm run build OK)
Task 3: complete (commit e32484b。tests: npm run build OK・npx vitest run src/engine 341 件 OK。unit_rules ally10 18 項目 ok)
Task 4: HANDOVER の進捗を直し、台帳を docs/superpowers/ledgers/ に写した。最終レビューはこの後
Ruling: 設定シート（CP0）・組み合わせを選ぶページ（CP1）・盾の 3 案の比較・CP2/CP3 の中間の Artifact は作らず、完成品の再生ページ 2 枚（ガンツ・シオン）だけ Artifact で見せた — 依頼者の指示（2026-11-25「確認は結果の提示で十分」・2026-11-27「確認は最後にまとめて」）と、新しいユニットの CP0〜CP4 は止まらず進める決め — 中間の選択（盾の大きさ・髭の形・髪の長さ）を依頼者が見ていない。最後の報告で見せる
Ruling: 髪の左右対称（hair_mirror）の決まりに、ガンツ・シオンの髪は合わない — 元にした髪（hair/ally09・hair/ally13）が合わない形で、ガンツは髭を足した正面の外形も違う。検査は feat/hair-mirror-check にあり、このブランチには無い。作り直しは髪の描き直しなので、検査が入った後に依頼者と決める — 検査が入ると ISSUES 記載の 22 体にこの 2 体が加わる
Final: 最終レビュー（opus の code-reviewer、c5f2eae..9a06ca1）。重大 0、重要 2、軽微 8。私が確かめて、重要 2 は事実（上向き・左向きの atk_hit の拳が消える。空き手の元の部品が計画と違うのに台帳が「計画どおり」）
Final: fixed 重要 1（上向き・左向きの atk_hit で拳が消える）— hand_visible.py（空き手の層を外したコマと比べ、atk_wind・atk_hit で見える拳が 4 画素以上）RED→GREEN。直す前は up_atk_hit・left_atk_hit が 0 画素（ガンツ・シオンとも）、直した後は 15・10 画素。左向きは atk_wind の 4 行下、上向きは base の 2 画素右。unit_rules ally14・ally10 は 18 項目 ok、compose --check 0
Final: fixed 重要 2（台帳の「計画どおり」）・軽微 3（SPEC の盾の高さ「2 行高い」は 1 行）・軽微 4（法衣の丈 y27）・軽微 5（色の WARN の記述）・軽微 6（杖の比較の数字）・軽微 7（拳の部品のコメント 1 行目の「ボルグ」を ally05 に）・軽微 8（HANDOVER の進捗からブランチ名・日付・PR を除いた）・軽微 10（「使い回し」）— 文書の直しと拳のコメント。軽微 9（髪の左右対称）は上の Ruling に載せた
Ruling: 左向きの空き手の攻撃のコマを右向きの鏡像の位置にそろえた（左向き atk_hit はボルグの剣の拳の複製に戻し、atk_wind は 1 画素左へ）。上向きの atk_hit は直したまま（base の 2 画素右）— 依頼者の指摘（2026-11-28「左右で位置を合わせていないのか。手が見えないといけないという判断をしていないか」）。最終レビューの「拳が消える」指摘に対して私が「手は見えるべき」と判断し、左右の鏡像より見えることを優先していた（依頼者の問いに、位置は合わせていない・見えるべきという判断をした、と答えた）。鏡像の確認 hand_mirror_pos.py（左の拳の位置 = 右の拳の x を 31 から引いた位置）RED→GREEN（atk_wind・atk_hit が NG→ok、ガンツ・シオンとも）— 左向きの atk_hit では拳が体と盾に隠れる（右向きでは見える）。最終レビューの重要 1 のうち左向きの部分を取り消した
Ruling: シオンの肌を、セラと同じ白い肌 skin_pale_*（pale_hi/base/shadow）に替えた。芯 24 枚と拳 20 枚の map 行だけの変更 — 依頼者の指示（2026-11-28「肌を白くしてほしい」）。probe_colors で肌と法衣・髪・輪郭を測った（肌の明と法衣の白の明が WARN ΔE 6.2、肌の明と法衣の中が WARN ΔE 9.2。絵の中で隣り合わず check_colors は通る）— なし
Ruling: ガンツの盾（もっと大きく、体がほとんど隠れるぐらい体の前に）は、描く前に赤枠のページ（https://claude.ai/artifact/T4q7daDSzTpj45KEteyzDJ）を見せて依頼者の指示を待つ — 依頼者の決まり（絵のイメージを変える直しは、赤枠で見せてから描く）— まだ描いていない
