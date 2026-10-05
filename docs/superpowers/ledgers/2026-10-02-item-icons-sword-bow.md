# SDD ledger — plan: docs/superpowers/plans/2026-10-02-item-icons-sword-bow.md

Executor: executing-plans (Native、依頼者が選択 2026-10-02)。絵の段階では依頼者の指示で止まる（Task 1・3 の見せる段階、直しの確認）。
Pre-flight: Task 1 の item_check.py（--axis X0 X1）を Task 2・3・4 が使う → 引数は全タスクで同じ、矛盾なし。Task 2・4 の sword.txt・bow.txt を Task 5 が実測 → 名前は一致。
Task 1: Ruling: 検査スクリプトの置き場所を /tmp/item_check.py から scratchpad（<scratchpad>/item_check.py）に変える — 環境の指定。依頼者が plan の確認時に了承 — 誤りなら置き場所を戻すだけ
Task 2: Ruling: 剣は計画の3案（a・b・c）のどれでもなく、依頼者の指示で作った e（b の刃の長さ・a の鍔・刃は3列で軸について形が対称）に確定 — 依頼者が選択（b の長さ→a の鍔→左右の非対称を指摘→e）— 誤りなら sword.txt を描き直すだけ
Task 2: Ruling: sword.txt の map から未使用の l=stone_dark・d=wood_dark を消した — Task 5 の色の実測で紛れないため — 誤りでも絵は変わらない
Task 2: complete (commits 37d11aa..4f1f285, tests: validate/check_colors/item_check sword.txt → ok/0 failed/ok)
Task 1: complete (no commit — 案は未コミット、tests: validate/check_colors/item_check sword_a〜f → ok/0 failed/ok。依頼者の指示で案 d・e・f を追加)
Task 3: complete (no commit — 案は未コミット、tests: validate/check_colors/item_check bow_a〜h → ok/0 failed/ok。依頼者の指示で d〜h を追加)
Task 4: Ruling: 弓は計画の3案ではなく、依頼者の指示で作った h（矢は対角線いっぱい、弓はもう一つの対角線で両端が角 (2,2)・(13,13)、反りは b と同じ深さ4、弧の頂点は矢の木の部分と交わる。鏃は d の先端1画素を除いて右上へ1px ずらした）に確定 — 依頼者が選択 — 誤りなら bow.txt を描き直すだけ
Task 4: Ruling: 弓の明暗は、左上の腕の外側を wood_hi、右下の腕の内側を wood_shadow とした（曲線からのずれで決めると点々に散り、e で光源の検査に落ちたため）— 依頼者は h を目視で承認 — 誤りなら塗り直すだけ
Task 4: complete (commits 4f1f285..e693517, tests: validate/check_colors/item_check bow.txt → ok/0 failed/ok)
Task 5: Ruling: SPEC.md に計画に無い「形は軸について対称にする（偶数列は対称にならないので奇数列）」と「弦の描き方は未確定」を入れた — 依頼者が剣で非対称を指摘し、弦の太さを見せたときの弱点として挙げたため — 誤りなら SPEC の該当行を消すだけ
Task 5: complete (commits e693517..62e7c05, tests: validate.py 全件 → exit 0; unittest discover -s tests → 167 OK)
Task 6: complete (commits 62e7c05..03d11dd, tests: validate.py 全件 exit 0; check_colors 109件中 knight 1件のみ失敗（既知）; palette 差分なし)
Final review: subagent（general-purpose, opus）— Critical 0・Important 0・Minor 3、判定 Yes
Final: minor (deferred): SPEC.md の素材表で wood_dark が「3点」の行に入っているが、使うのは chest だけ
Final: minor (deferred): SPEC.md の剣の「列」が、刃（斜めの線の本数）と鍔（軸に直角な画素数）で違う単位になっている
Final: minor (deferred): SPEC.md に、軸の上だけの細い部品（矢の軸・握り）の塗り方が書かれていない
Final: Ruling: 作業領域（この台帳）は消さずに残す — HANDOVER.md が台帳のパスを参照しているため — 誤りなら手で消すだけ
Final: fixed minor 3件（wood_dark は chest のみ・列の単位・軸の上の細い部品の塗り方）— 依頼者の指示で直した（文書のみ、テスト対象なし）
Final: 依頼者の指示で規約「尖った先端を、輪郭に囲まれた1画素で表さない」を SPEC に足し、剣の切っ先を案 g（刃を1段伸ばし先端を3画素の角）に描き直した。validate/check_colors/item_check sword.txt → ok/0 failed/ok
