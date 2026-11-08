# SDD ledger — plan: docs/superpowers/plans/2026-11-06-garum-unit.md
Spec: docs/superpowers/specs/2026-11-06-garum-unit-design.md（第2段階）
Pre-flight: T1 色の名前 → T2〜T5 の # map、T3 checks/garum.json → T4・T5 の unit_rules — 連続して使うだけで食い違いなし
Task 0: complete (plan fc64155 はコミット・push 済み)
確認1: 未 / 確認2: 未 / 確認3: 未 / 確認4: 未
Task 1: complete (commit 540d547; validate OK, check_colors 0, unittest OK, body_check 24/24)
Task 1: 色: armor_blue_*（cloak_dark）・armor_rose_*（skin_rose_shadow/deep, rose_dark 新）・helm_blue_*/helm_rose_*（同じ色見本）・shield_steel_*（stone_base/shadow/dark）・shield_emblem
Task 2: Ruling: 盾は equip/shield/shield_garum_*（部品の名前 shield_garum）、剣は equip/greatsword/greatsword_*（greatsword）に置いた — validate.py が equip の盾を equip/shield/ にしか許さず、ロランの shield_* と名前がぶつかるため — 誤りなら置き場の名前だけ
Task 2: Ruling: 拳の base と compose/garum.json・checks/garum.json（base の4コマ）を Task 2 で先に作った — 確認1のページに組んだ姿とロランとの比較を載せ、道具を通した物を見せるため — 誤りなら Task 3 の作業が前に移っただけ
Task 2: base の4コマで unit_rules 18種すべて ok（2026-11-06）
Task 2: 確認1のページ https://claude.ai/artifact/XL1MiYneoJpwQU6p9ox2RR を出し、依頼者の返事待ち（未コミット）
Task 2: 確認1 指摘1（2026-11-06）: 目がのっぺり → 顔グラと同じ斜めの切れ込み（外が高く内が低い）＋上に眉の影。横向きは面頬の前の縁へ。unit_rules 18種 ok。ページ v2 を出した
Task 2: 確認1 指摘2（2026-11-06）: 兜がバケツを逆さにした形 → 顔グラと同じ頭の形（頭頂は丸く、目の高さが最も広く、顎へ細く）。体の頭も兜の1画素内側の形に。unit_rules 18種 ok
Task 2: 確認1 指摘3（2026-11-06）: 兜の後ろ・襟・兜と鎧の釣り合い → 依頼者の承認で兜と鎧を1から作り直し。顔グラを32升に戻して読み、兜・襟・鎧を1つの輪郭で描いた（shapes.py の2回目）。輪郭のページ https://claude.ai/artifact/V19n8mwsuo8DYEoojeiQxH を出し返事待ち。剣・盾・拳は未調整
Task 2: 輪郭 指摘（2026-11-06）: 正面の肩当てが胸までかぶさる → 肩当てをやめ、胸当ての上の端を肩まで広げた（横向きも）
Task 2: 輪郭 指摘（2026-11-06）: 目の切れ込みを太く・真ん中でつなげる → 太さ2画素、正面は V 字でつながる。unit_rules 18種 ok
Task 2: 剣と盾を胸当ての肩に合わせて付け直した（剣 x9..11 down・x33..35 left、盾 x34）。unit_rules 18種 ok。確認1のページ v4 を出し返事待ち
Task 2: 確認1 指摘（2026-11-06）: 剣をもっと大きく → 刃 幅4（上限）・長さ23、切っ先 y=8、握り行33〜35。unit_rules 18種 ok
Task 2: 確認1 指摘（2026-11-06）: 剣の手を盾の手の高さに・盾の手は変えない・剣は元の長さ → 刃 幅4・長さ17、切っ先 y=10、両手とも行30〜32。止めた操作で盾の拳が行33に動いていたので戻した。unit_rules 18種 ok
Task 2: 確認1 指摘（2026-11-06）: 剣を拳を変えずに限界まで → 長さ20（切っ先の刃の色 y=8）。unit_rules 18種 ok
Task 2: 確認1 指摘（2026-11-06）: 横向きの剣の手が後ろすぎ → 剣と拳を2px前へ（中身 x31〜34）。3px 前は weapon_check（拳が柄の真ん中に無い 0.7px）で落ちたので道具に従い2pxに。unit_rules 18種 ok
Task 2: 道具の直し（2026-11-07 依頼者の判断）: 「拳が柄の真ん中」を組んだコマでなく武器と拳の部品だけで見る。tools/grip_centre_check.py を足し、weapon_check に --no-grip-centre、unit_rules が渡す。テスト追加、全テスト OK。既存20体は前後で unit_rules の結果が同じ（新しい ok 行だけ増えた。偽陽性0）。未コミット
Task 2: 横向きの剣の位置の3案（元から2・3・5px 前）のページ https://claude.ai/artifact/XKKni8AnAdMfvMTuDHNQ2E を出し返事待ち。今のファイルは2px（x31）
Task 2: 道具の直しをコミット（3ec8550）。横向きの剣は依頼者の選択で C（元から5px 前、x28）。unit_rules 19種 ok
引き継ぎ（2026-11-07）: 確認1は未承認。残りの指摘: 盾が体の横に離れすぎ。体を守るよう体寄りに持たせる（剣の位置は今のままでよい）。
引き継ぎ: 絵の部品・compose/garum.json・checks/garum.json・palette は未コミット（確認1の承認後にコミット）。道具の直しは 3ec8550 でコミット済み（未 push）
引き継ぎ: 絵を作るスクリプトは .superpowers/sdd/2026-11-06-garum-unit/scripts/（px.py 道具、shapes.py 兜・襟・鎧の外形と目、gen_core.py 芯、gen_body2.py 兜・目・鎧、gen_parts.py 剣・盾・拳（SHIELD_X・SHIELD_HAND・SWORD_* の定数）、gen_compose.py compose、view.py・silhouette.py 自分で見る PNG、cp1.py 確認1のページ）。forge の直下で .venv/bin/python -I <script> で動かす（scripts の中で互いに import する）
引き継ぎ: 確認1のページ https://claude.ai/artifact/XL1MiYneoJpwQU6p9ox2RR（cp1.py で作り直し、同じファイルパスでなく url を指定して更新）
引き継ぎ（訂正）: palette（swatches・uses/unit.json）と芯の最初の版は 540d547 でコミット済み。未コミットは芯の作り直し・兜・目・鎧・剣・盾・拳・compose/garum.json・checks/garum.json・assets/unit/garum
Task 2: 確認1 指摘（2026-11-07）: 盾が体の横に離れすぎ → 正面・背面の盾を 6px 内側へ（SHIELD_X 34→28、拳も同じだけ。行30〜32 は変えない）。正面で胸の左半分を覆う。横向きは元から胸当ての前の縁に接するので変えない。unit_rules 19種 ok。確認1のページ v10 を出し返事待ち（前後の比較を載せた）
Task 2: 確認1 指摘（2026-11-07）: 目の部品が兜の上に重なり、兜の単品と組んだ姿で目の濃さが違う → 目のすき間を兜（head_garum）に輪郭の色で描き、目の部品（eye/garum）を消した。compose・checks の orders から eye_garum を外し、checks に eyes 全向き null を足した。unit_rules 19種 ok。ページ v11
Task 2: Ruling: 設計書の「目の部品は兜のすき間の暗い所として描く」「部品に目を分ける」に従わず、目を兜に描いた — 依頼者の指示（2026-11-07）— 誤りなら目の部品を戻すだけ。eye_check はガルムでは目を見なくなる（eyes が全向き null）
確認1: 承認（2026-11-07）。commit b3d25e8
Task 3: Step 1・2 は Task 2 で済み（拳・compose・checks は b3d25e8、unit_rules 19種 ok）。確認2のページ https://claude.ai/artifact/4bDXfXtWBcWzNfoBgAAGYw を出し返事待ち（scripts/cp2.py で作る）
Task 3: Ruling: 計画の orders 案「芯の直後に 目・鎧・兜」から目を外した — 確認1で目を兜に描いたため — 誤りなら目の部品を戻して順に入れる
Task 3: 確認2 指摘（2026-11-07）: 上と下で拳どうしの前後が違う → 上を 剣 → 盾 → 盾の拳 → 剣の拳 に（下と同じ盾の拳→剣の拳）。盾と盾の拳の前後は表裏の理由で上下で違うまま。上の組んだ絵は変わらない（cmp 同じ）。unit_rules 19種 ok。ページ v2
Task 3: 確認2 指摘（2026-11-07、訂正）: 上は下の逆順にする → 上を 剣の拳 → 剣 → 盾 → 盾の拳 → 体 → 鎧 → 兜 に。上の組んだ絵で剣の拳が柄の後ろに隠れ柄が見えるようになった。unit_rules 19種 ok。ページ v3
Task 3: 確認2（2026-11-07）: 上を元の順（剣 → 盾 → 剣の拳 → 盾の拳 → 体 → 鎧 → 兜、ロランと同じ）に戻した — 依頼者: 剣の拳は剣より手前に見えるべきで、それが上下で順が違う理由。上の絵は元と同じ、b3d25e8 から差分なし。unit_rules 19種 ok。ページ v4
Task 2: complete (commit b3d25e8; unit_rules 19種 ok, validate 1269 ok)
確認2: 承認（2026-11-07）。orders は b3d25e8 のまま（変更なし）
Task 3: complete (orders は b3d25e8 に含む。新しいコミットなし; unit_rules 19種 ok)
Task 4: complete (commits b3d25e8..33be07b; unit_rules 19種 ok（16コマ）, compose --check 0)
Task 5: 剣と剣の拳の atk_wind（base から 7px 上）・atk_hit（down は下向きの剣・刃 11 に縮める、left は 45° の斜め・刃 14 行、up は体に隠す、right は left を映す）を scripts/gen_attack.py で作った。weapon_check で落ちた4件（up の縮めた剣の長さ・right の手から切っ先まで）を絵で直した。unit_rules 19種 ok（24コマ）、compose --check 0。sheets/garum.txt を作り sheet.py ok
Task 5: Ruling: up_atk_hit の剣と拳を down の左右の映しでなく体に隠れる位置（x21、先端 41）に置いた — 縮めた剣が見えると weapon_check（長さ・握る位置）で落ちるため、ロランの up_atk_hit と同じく隠した — 誤りなら位置を描き直すだけ
Task 5: 確認3のページ https://claude.ai/artifact/3JbSsQr66u6KNkey7PrZXq を出し返事待ち（未コミット、scripts/cp3.py で作る）
Task 5: 確認3 指摘（2026-11-08）: 横向きの剣が尖りすぎ → 斜めの刃の最後の4行（中身 4・3・2・1）を最後の1行だけ中身2に。unit_rules 19種 ok。ページ v2
Task 5: 確認3 指摘（2026-11-08）: まだ尖りすぎ → 斜めの刃の最後の行を、左の縁を前の行にそろえ右の縁を1px引く形に（先端が縦と横の縁の 90° の角）。unit_rules 19種 ok。ページ v3（3つの版の比較つき）
Task 5: 確認3（2026-11-08）: 先端の形は承認。依頼者の試しの依頼で斜めの刃を1行5画素に（DIAG_EXTRA=1）。unit_rules 19種 ok だが tip_check は「中身5画素は決まりの外」で対象外（NOTE）。ページ v4 に4画素と5画素の比較。返事待ち
確認3: 承認（2026-11-08、斜めの刃は1行5画素）
Task 5: Ruling: tip_rule に MAX_DIAGONAL_WIDTH = floor(MAX_WIDTH × √2) を足した（ee7605b）— 依頼者と決めた（倍率で決める・倍率は √2）。計画の「新しい道具は作る前に相談」に沿い相談済み — 既存の絵で新しく落ちるもの 0
Task 5: complete (commits 33be07b..d172849; unit_rules 19種 ok 24コマ, compose --check 0, unittest 784 OK, validate 1313 ok)
Task 6: Step 1: sheet.py の center_x の off は剣・盾を含む絵全体の幅の中心（down 22・up 25・left 23・right 24）。攻撃以外のコマは向きごとに同じ値でそろい、足の中心は unit_check で ok
Task 6: Step 2: unit_rules 19種 ok（24コマ）、compose --check 0、validate 1313 ok、check_colors -q 0（警告は他の敵の既存分のみ）、unittest 784 OK
Task 6: 確認4のページ https://claude.ai/artifact/7SUxdV4kKtpZ7UaDqB3DES を出し返事待ち
確認4: 承認（2026-11-08）
Task 6: Step 5: export で garum-map.png（192x576、仮の絵と画素が違う）。npm test 776 passed、npm run build ok。Step 6: forge の CLAUDE.md・README・contact_sheet を更新
Task 6: complete (commits d172849..45472b8; unit_rules 19種 ok, compose --check 0, npm test 776 passed, build ok)
Task 7: ISSUES.md の garum の行を火花・矢の件だけに直し、sheet.py の足元の表の誤報を足した
Task 7: complete（台帳を docs/superpowers/ledgers/2026-11-06-garum-unit.md に写した）
Final review: code-reviewer（opus）。Critical 0・Important 0・Minor 3
Final: fixed Minor 3件（テストの太さの確認・grip_centre_check の対比と keep のテスト・tip_check の docstring）— keep のテストは分岐を壊すと落ちるのを確かめた、suite 787/787（0eac926）
