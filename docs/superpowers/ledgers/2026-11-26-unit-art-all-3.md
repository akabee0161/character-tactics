# SDD ledger — plan: docs/superpowers/plans/2026-11-26-unit-art-all-3.md

Pre-flight: Task 2 → Task 3: Task 2 が決める台帳の書き方と後ろの部品の置き方（ミラの SPEC の例外）を Task 3 が読む。部品名の読み替え（ally12→ally06、32→24 コマ）だけが違い、食い違いなし。
Ruling: 実行方法は Native（このセッションで私が実装） — 依頼者が「あなたの方針通りで良いです」と答え、私の推し（Native）を含む計画に同意した — 独立したレビューは最終の 1 回だけ。違えば依頼者が言う
Ruling: 作業は今のチェックアウト（worktree を作らない） — ~/.claude/rules/git-workflow.md「逐次の実装は worktree を使わない」
Ruling: PR のマージは依頼者の合図を待つ（私はマージしない。push・PR は頼まれたときだけ） — 依頼者の指示
Ruling: この作業の「テスト」は確認の道具（validate・unit_rules・compose --check）。checks/<ID>.json と compose を先に作って落ちるのを見てから部品を描く — 絵に単体テストは書かない（CLAUDE.md テスト方針）。TDD の鉄則は道具が落ちる→通る、で満たす
Ruling: 新しいユニットの CP0〜CP4 は止まらず進めて結果を Artifact で見せる — 依頼者の追加指示（2026-11-25）
Task 1: complete (commit 70f887f docs: 計画。ブランチ feat/unit-art-bow-staff は develop c0e6f5f から)
Task 2: Ruling: 矢筒は描かない・頭巾の横の結び目は描かない（背面の小さな結び目は手本のまま残る） — 32px で見えずイネスにも無い。結び目はポニーテールの付け根と重なる（計画の範囲外に書いた判断） — 顔の頭巾の結び目と全身絵の矢筒が無くなる
Task 2: Ruling: 顔と全身絵の食い違いは顔を正（髪の茶・頭巾の黄緑・外套の深緑）、タイツ・靴は全身絵 — 依頼者の追加指示（確認せず進める） — 外套が深緑で、全身絵の黄緑の上着と食い違う
Task 2: Ruling: 芯は body/mist の複製（atk_draw・atk_release の芯は atk_hit の複製）、弓・矢・拳は equip/bow・equip/arrow・fist/ines をそのまま共有 — 計画の「決めてあること」。肌が skin_fair で同じ — イネスの部品を直すとユナも変わる（SPEC に書いた）
Task 2: Ruling: 頭巾を髪の幅（x8〜23）に広げ、横の結び目を無くした（背面の小さな結び目は残る）— head_cover_check が「縁の行の幅より外に髪が出る」を落とすため。道具に従って直した — 頭巾が敵の bandana_female より横に広い
Task 2: Ruling: ポニーテールは肩の高さ（y>=15）から垂らし、頭の後ろの髪を 1 行（y=14）伸ばしてつないだ。背面は前の部品の髪に含めた — head_cover_check（頭の高さの髪は頭巾の外に出せない）に従った。計画の Review Focus 2 — 尾が頭の高い位置の結び目から出ていない。依頼者が見て決める
Task 2: Ruling: 髪の下端に輪郭を足した（正面 y=15 の 2 か所、左の後ろ髪は y=14 に伸ばし、右は左の左右反転） — part_outline が落ちたため道具に従って直した
Task 2: 道具の最初の実行は 2 件落ち（part_outline 3 件・head_cover_check 6 件。RED）。直して unit_rules ally12 は 18 項目 ok（weapon_check は設定が null で、手本のイネス・敵の弓と同じく対象外）、compose --check 0、validate 0、check_colors の hard failure は staff-a-f・staff-b-f の 12 コマだけ
Task 2: 書き出しで変わった PNG は ally12-map.png だけ（Review Focus 5）。equip/bow・equip/arrow・fist/ines は変更なし
Task 3: Ruling: 顔と全身絵の食い違いは顔を正（フード・外套の紫・髪）、ローブの青紫は全身絵。髪はフードと見分けるため顔より明るい薄紫にした — probe_colors で髪の影とフードの明が WARN ΔE 8.7 になり、髪の色を直して 0 件にした。依頼者の追加指示（確認せず進める） — 髪が顔の絵より明るい
Task 3: Ruling: 杖の先の大きな輪の飾りは描かず、ミストの杖と拳をそのまま共有 — 依頼者の指示「ミストの杖を使う」 — 全身絵の杖と形が違う
Task 3: Ruling: ローブはミストの形（cloth/robe）を青紫にし、肩に紫の外套（y16〜18）・裾にレース 1 行（y19）・首に金の留め金（正面だけ）を足した。フードはユナの頭巾の形を紫にして前の縁をレースに — 道具に落ちない範囲で顔・全身絵の特徴を出した — フードが尖っていない（頭巾の形）。見え方は依頼者が決める
Task 3: Ruling: 右向きの後ろ髪は組む順の末尾に置いた — 後ろの部品は後に積んだ方が奥になる。order_check が落ち（6 件）、承認済みのミストの順は変えず、後ろ髪の位置だけを直した — なし
Task 3: unit_rules ally06 は 18 項目 ok（weapon_check は手本のミストと同じく対象外）、compose --check 0、validate 0、check_colors の hard failure は staff-a-f・staff-b-f の 12 コマだけ。書き出しで変わった PNG は ally06-map.png だけ（Review Focus 5。ミストは変わらない）
Ruling: ユナ（Task 2）とセラ（Task 3）を 1 コミットにした — 色見本・SPEC・CLAUDE.md・sprites.json が 2 人で同じファイルに入り、対話的な部分ステージが使えないため — 2 人のどちらかだけを戻すときは手で分ける
Ruling: 勝率の確認（npm run balance -- --check）は流さず止めた。計画の Review Focus 1・Task 2 Step 7 の逸脱 — 依頼者の指示（2026-11-26「開発中に勝率が動くことはさほど重要でない。develop→main の前に確認して調整する」）— ユナの攻撃 6 コマで勝率が動いたかは分からない。develop→main の前に確認する
Ruling: /verify は流さず、直前の npm test・npm run build の結果で代えた — 25 分かかる npm test を同じ内容で重ねないため — なし
Task 2・3: complete (commit 以降。tests: npm test 1276 件 OK・npm run build OK。unit_rules ally12・ally06 全通過・compose --check 0・validate 0)
Task 4: complete (引き継ぎ・台帳。最終レビューはこの後)
Final: 最終レビュー（opus の code-reviewer、c0e6f5f..4814f6e）。重大 0、重要 2、軽微 4。私が確かめて、全部事実だった
Final: fixed 軽微 4（セラの髪に "head": true がなく eye_check が目の横の髪を見ない）— checks/ally06.json に印を足し unit_rules ally06 は 18 項目 ok
Final: fixed 軽微 5・6（台帳の「19 項目」は実際 18 項目 ok で weapon_check は対象外、背面の結び目は残る）— 台帳・SPEC・HANDOVER の記述を事実に直した。文書だけの直しで失敗するテストは無し
Final: 重要 1（ユナの耳の前の房がない）・重要 2（セラの右向きのフードの縁にレースがない）・軽微 3（ユナの右向きの頭巾の縁が明るい）は絵が変わる直し。私が先に描いてしまったので、依頼者の決まり（描く前に赤枠で見せる）に反し、スタッシュ「最終レビュー直しを赤枠で見せる前に描いた変更」に退避してコミット済みの絵に戻した。赤枠の案を Artifact で見せ、依頼者の指示を待つ
