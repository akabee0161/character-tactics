# SDD ledger — plan: /home/ubuntu/workspace/character-tactics/docs/superpowers/plans/2026-11-23-borg-restyle.md

Pre-flight: Task 1→2→3→4 は絵とセルの受け渡しのみ。Task 4 の書き戻し結果を Task 5/6 が読む。矛盾なし。

Task 1: 参考ページ公開済み (https://claude.ai/artifact/1CFyjvibfjq7YXYnjNTWke)。1回り目のセルを依頼者に渡した（計画 Task 1 Step 2 のとおり。案1 鎧を暗く・金を細く／案2 鋼の灰色／案3 案1＋赤茶の髪、各案 騎士シード1枚＋3枚、計12枚）。結果待ち。

Task 2: complete (1回り目で採用). 採用: 案3「案1＋赤茶の髪」、騎士のシード 3034254740、左右反転して採用(flipped:true)。
  extra=["(dark grey armor:1.3)","thin gold trim","navy blue clothes","(auburn hair:1.2)"] remove=["gold trim","dark reddish brown hair"]
  Drive: character-tactics/illust-asset-forge/selected/ally05/face.png (id 1sFDN4E9..., 親をたどって確認済み), run_id 20261123_050918, commit 71bbf25, style thick-line-flat。
  見た目: 髪は赤茶・後ろへ流す、鎧は明るい青みの灰色(暗くならなかった: (dark grey armor:1.3) は効かず)、金の縁は太め、紺の襟。背後に白い飾り(兜の縁のような物)が写る。
  メモ(工程4用): 案1・2 の見え方は依頼者から聞いていない。Task 5 で背景の白い飾りの扱い(外につながる白だけを透明にする)に注意。
Task 3: 全身のセルを渡す(extra=案3のextra+holding sword, sword in right hand, shield in left hand、remove=案3のremove、n=8、シード固定なし)。結果待ち。

Task 3: complete. 全身絵 8 枚から 1 枚採用: seed 1134822769, run_id 20261123_051307, flipped false。extra=案3のextra+holding sword, sword in right hand, shield in left hand。見た目: 絵の左(キャラの右手)に剣、キャラの左手に盾、髪は赤茶、鎧は灰色、金の縁と飾りが多い、紺のズボン。
Task 4: complete (commits 53197bf..e4e9613, tests: illust-asset-forge/.venv/bin/pytest → 377 passed)。pnginfo: 2 枚とも character ally05・style thick-line-flat・commit 71bbf25、run_id は Task 2・3 のもの。install_selection の「消した」なし。書き戻し: appearance の dark reddish brown hair→(auburn hair:1.2)、outfit を (dark grey armor:1.3)・thin gold trim・navy blue clothes に、items に剣と盾の持ち方 3 タグ。build_prompt の集合と PNG の条件の差は 顔・全身 とも positive/negative 空。export 通る。

Task 5: complete (commits e4e9613..HEAD、tests: npm test → 1268 passed, npm run build 成功)。切り出し (110,0)〜(750,640)、256px。
  Ruling: 背景の透明化は「白」だけでなく背後の飾りのクリーム色も対象（白 min>=240、またはクリーム min>=214 かつ r-g<=14・g-b<=16 を外から塗りつぶし）— 依頼者が「飾りは削除、今後も顔と服以外の背景は削除」と指示 — 計画の「外につながる白だけ」から変えた。違っても顔の絵が変わるだけ。
  32px は依頼者が「つぶれていない」と確認。透明にした画素の図で穴なし。

Task 6 Step 1: 顔と全身絵の食い違いを依頼者に一覧で出した（鎧の明るさ・金の量・髪の明るさ・盾の形と色・剣の刃の色）。測った色: 顔の鎧 #c7c4cd／全身の鎧 #aaa9ab／今の plate_base #7c878d・plate_hi #c2c9cb。髪 顔 #c06f52／全身 #953e23／今 auburn_base #7a3c32・hi #a2584a。全身の剣の刃 #bfb6a8（クリーム）。返答待ち。

Task 6 Step 1: 依頼者「その案で」（食い違いの扱いを承認）。
Task 6 Step 2・3: 差の表と色の測定を設定シート(CP0)にして Artifact 公開。新色: 鎧 hi #d8d0f0／base #c7c4cd(顔の色)／shadow #8e8ca0、髪 hi #e0905e／base #c06f52／shadow #8f4636。probe_colors で輪郭・肌・服・金・刃・互いと各 51 組、HARD/WARN 0。armor_grey・hair_auburn・armor_gold はボルグ専用（ガルムは shield_steel を共有しているので盾はボルグ専用の用途の色を新設）。CP1 の軸: 金の入れ方3案・盾の形2案・すね当ての金2案。承認待ち。

Task 6 Step 3: CP0 承認（依頼者。追加: 髪の形も変える）。
  Ruling: 髪の形の変え方は依頼者の指定が無いので、顔（立ち上げて後ろへ流す）と全身絵（短く逆立つ）の両方を手がかりに CP1 の軸に足した（H1 流す・H2 H1+前髪・H3 逆立ち）。背丈 26px の上限（頭頂 row 5・足元 row 30）があるので、頭頂より上には伸ばさず、頂・生え際・襟足・前髪で形を変える — 違っても CP1 で選び直せる。
  Ruling: 色見本は新しい 2 組を足さず plate_*・auburn_* の値を直接直した（ボルグ専用で他に使うユニットが無いため）。盾の面はボルグ専用の用途の色 shield_plate_* を新設（shield_steel_* はガルムが共有）。CP0 の「2 組を足す」より小さい変更。
  Ruling: unit_picker.py を拡張（keep・layers の向き別指定）。ボルグは向きごとに盾と拳の重なり順が違い、拳の輪郭を柄の上に描かない keep が要るため。テストを先に書き RED→GREEN（picker 37 件、forge 全体 802 件 OK）。UPSTREAM.md に 1 行。
Task 6 Step 4 (CP1): 組み合わせページを Artifact で公開（髪3×鎧の金3×盾2×すね当て2=36通り、4方向）。選択待ち。

Task 6 Step 4 (CP1) 結果: 依頼者が K2-G2-H1-S2 を選んだが、髪は H1 でなく作り直し（顔の絵から最初から作る。今の髪を直した案は顔と別物にならなかった）。
  依頼者の希望(課題): Drive の置き場を MyDrive/character-tactics/illust-asset-forge/ から MyDrive/illust-asset-forge/character-tactics/ にしたい（ゲームが増えるたびにフォルダが増えて分からなくなるため）。今すぐでも変えたいが、現実的には作業が落ち着いてから。→ HANDOVER の次にやることに書く。変えるときは DRIVE_DIR（ノートブックの 4 変数）・illust-asset-forge/CLAUDE.md の取る場所・README の記述。

Task 6 Step 4 (CP1・髪の作り直し): 依頼者が残す特徴を 1(髪の塊の流れ)・3(側頭と襟足は短く細かい線)・4(前の端の尖り)・5(前側の髪は短く耳の前で止まる) と決定（2 の広い額の生え際は不要）。顔の絵から白紙で N1(筋を細かく)・N2(線を減らす) を描き（build/cand/hair_N*_*.txt、右向きは左向きの左右反転＋明暗入れ替え）、同じ URL のページに差し替えた（K2-G2 既定、髪 N1/N2・盾 S1/S2 の 24 通り）。依頼者の確認待ち。
  Ruling: 右向きの髪は左向きの左右反転にした（髪は装備と違い左右で手前・奥が入れ替わらないため）。

Task 6 Step 4 (CP1) 結果2: 依頼者が K2-G2-N1-S2 を選択。髪の前と後ろは良い、横に違和感（原因は依頼者も不明）。
  Ruling: 横向きの違和感を、拡大して見て 2 点と判断して直した — ①耳が無い（短髪で横顔の肌が大きく見える）→ 耳（skin_fair_shadow の 2×2）を頭の部品に足した（SPEC「頭パーツ（髪・耳・かぶり物を合わせて1つ）」どおり）、②前の髪と後ろの髪の間に額が抜けて穴に見える → 生え際をつなげ、前の尖りはその下に残した。前の版は N1o として比較用に残した。違っても 4 方向のうち横 2 方向の髪だけの直し。

Task 6 追記: 依頼者の判断「耳は素体にあるべき」。pixel-asset-forge/ISSUES.md に課題として記載（アセット・構成の表）。今回は私の案（耳を髪の部品に暫定で足す）で進める（依頼者の指示）。耳の置き場について SPEC には規則が無く、私が「SPEC では耳は頭の部品」と言ったのは言い過ぎだったと訂正済み。

Task 6 Step 5 (CP2・CP3): 選んだ K2-G2-N1-S2 を assets/part/ に入れて組み直した（assets/unit/borg/ の 24 コマ、compose --check 一致、unit_rules.py checks/borg.json 全部 ok）。
  道具に従って直した点（CLAUDE.md）: ①part_outline が髪の部品の肌（耳）の画素を落とした→耳は芯（ボルグの core_left/right 12 コマの row 10-11, x15-16 を skin_fair_shadow）に移した（依頼者の「耳は素体にあるべき」とも合う。ISSUES.md の記載を更新する）。②part_chars が cloth と芯の同じ文字 PQS を落とした→芯のすね当ての金は d/e/f の文字に。③part_outline が頭頂の左右端を落とした→髪の頭頂の輪郭を元の幅 (12..19) に戻した。
  すね当ての金(K2): 全 24 コマの芯の row 28 の k/l/m を金にした（歩きの上げた足は 1 行だけなので全体が金になる）。
  新しい見た目を CP2・CP3 のページで見せた。承認待ち。

Task 6 Step 5 完了(CP2・CP3 依頼者「OK」)。Step 6 (CP4): 前(assets/images/ally05-map.png)と新(build/sheets/borg.png)を anim_compare.py でゲームと同じコマ数・fps（待機 2・4fps／歩き 4・8fps／攻撃 3・6fps）で並べた再生ページを Artifact で公開。承認待ち。書き出し(Step 7)は承認後。

Task 6: complete (commits d0aaf2f..f42fb7a, tests: npm test → 1268 passed; npm run build 成功; pixel-asset-forge unittest → 802 OK; unit_rules.py checks/borg.json 全 ok; compose --check 一致)。CP4 は依頼者「OK」。書き出し: 3 段のコマンドで assets/images/ally05-map.png だけが変わった。ブラウザ(playwright で game を配信して続きから→川原の渡し→配置→戦闘)で顔・マップの絵を確認。SPEC のボルグの節・UPSTREAM・ISSUES を更新。
Task 7: HANDOVER.md に工程 2 の結果と進捗（工程 3 ← 今ここ、段階: 設計の相談）を書いた。台帳を docs/superpowers/ledgers/ に写した。

Final review: 新しい目のレビュー役（opus）が 71bbf25..8ff3d9e を確認。Critical なし、Important 1、Minor 4。再現して確かめた範囲（プロンプト集合の一致・顔の切り出し・白いふちなし・鎧に穴なし・色の ΔE・マップの絵の一致・unit_rules 全 ok・各テスト）は問題なし。
Final: fixed UPSTREAM.md の unit_picker の記録が「ゲーム側だけ」欄に入っていた（forge に戻す候補から漏れる）— 「forge に戻す候補」の欄の末尾へ移し、layers の向き別指定も書き足した（文書の直しで、テストの対象外。git diff で確認）。
Final: minor (deferred): illust-asset-forge/UPSTREAM.md:34 が ally05 を「絵は置いていない」と書いたまま
Final: minor (deferred): unit_picker.py の keep の検査が compose.py と重複し、layers が配列のとき向きの数だけ同じ検査とパレット読み込みが走る
Final: minor (deferred): keep が配列でないとき・向きごとの layers の値が配列でないときのテストが無い
Final: minor (deferred): SPEC.md の 2026-11-22 の例の文が「外につながる白を透明にした」のまま（当時の経緯としては正しい）
Final: Ruling: 透明にする条件のクリーム色が g−b に下限が無く、青みの白にも当たる。四辺から塗りつぶすので白い服が下の辺で切れた顔では服が透明になるおそれ（工程 4 の話）— 今回のボルグは輪郭に囲まれていて無事で、赤く塗った図で確かめてある。条件は変えず、HANDOVER に注意を足した — 工程 4 で服が白い人の顔を切り出すとき、赤い図を見落とすと服に穴が開く。
Final: Ruling: character.yaml に効かなかった (dark grey armor:1.3) が残る — 採用した絵の条件を再現する書き戻しで、設計書どおり — 工程 4 でこのタグを写すと鎧が暗くならない（HANDOVER に書いた）。
Final: Ruling: 絵の見た目（耳が影の色とつながって見える、上げた足のすね当てが全部金）— 依頼者が CP2〜CP4 で承認済みなので直さない — 依頼者が後で違和感を言えば直す。
