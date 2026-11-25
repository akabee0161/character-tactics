# SDD ledger — plan: /home/ubuntu/workspace/character-tactics/docs/superpowers/plans/2026-11-25-unit-art-all-2.md

Pre-flight: Task 2 → Task 3: Task 2 が作る compose/ally09.json・checks/ally09.json の重なり順と fist/ally09 の形を Task 3 が写す。名前の読み替え（目・服・髪）だけが違い、食い違いなし。
Task 1: Ruling: ブランチ分けは計画より先に済ませた — 依頼者が「作業をやめて PR を出してマージ」と指示（2026-11-25）。feat/unit-art-fullbody = PR #69、feat/unit-art-spear = PR #70、どちらも develop にマージ済み。feat/unit-art-axe は develop をマージして切り直した（cbc0aa3）。46f0644 は槍側に残し、ピコ全身絵とユナの yaml だけを PR A に足した（e035bf0）。
Task 1: complete (commits c5bde2a..e52fba2, tests: npm test 1276 件・forge unittest 804 件は PR B のブランチで実測 → OK)
Ruling: 実行方法は Native（このセッションで私が実装） — 依頼者が「進めましょう」とだけ答え、方法を選ばなかった。計画の流れが 1 体ずつの確認で依存が強いため — 独立したレビューは最終の 1 回だけ。
Ruling: 作業は今のチェックアウト（worktree を作らない） — ~/.claude/rules/git-workflow.md「逐次の実装は worktree を使わない」。
Ruling: PR のマージは依頼者の合図を待つ — 依頼者（2026-11-25）。メモリに記録済み。
Task 2: Ruling: 芯・斧・拳は既存部品の色替えの写し（芯 = ally07 の芯、斧 = equip/axe/male、斧の拳 = fist/enemy_male の肌を skin_fair、空き手 = ally07 のもの）、髪と髭・ベストと袖だけを新しく描いた — 計画の「形と位置は敵の斧のまま、色だけ替える」に従う — 髪・ベストの形は依頼者の指摘で直す
Task 2: Ruling: 髭は髪の部品（hair/ally09）に入れた。part_outline は通った。head_cover_check は被り物が無いので検査の対象外（髪と被り物の両方があるコマだけを見る）— Review Focus 2 は part_outline の通過だけで確かめた
Task 2: Ruling: 顔と全身絵の食い違いは顔を正（髪・髭・ベストの色と形）、ズボン・靴は全身絵。腰の小物入れは描かない — 依頼者の追加指示（確認せず進める）
Task 2: Ruling: 後ろ向きのベストの上の縁（row 18 の中央）を輪郭で閉じた — part_outline が落ちたため、道具に従って直した
Task 2: Ruling: 色見本の警告 2 件（linen の明と中 ΔE 9.8、bark の中と暗 10.0）を、色を少し離して解消した — check_colors の警告
Task 2: Ruling: PR #70 の書き出しで ally07-map.png の更新が漏れていた（髪の直しのあとに assets/images を書き出していなかった）。今回の書き出しで気付き、別コミット e0308fb で直した — PR B にはマージ済みの古い画像が入っている
Task 2: check_colors の hard failure は ISSUES 記録済みの staff-a-f・staff-b-f の 12 コマだけ。unit_rules ally09 は 19 項目すべて ok、compose --check は終了コード 0
Task 3: Ruling: オルトの手袋・籠手は描かず、肌の拳にした — 拳は肌の種類の色でないと compose の hand と fist_check が落ちる（Review Focus 1）。顔に手は写らない — 全身絵の黒い手袋とは食い違う
Task 3: Ruling: 大柄は背丈 24px の芯のまま、橙のつなぎと肩当ての面積で出した。肩当ては 4 画素幅のまま（リュカの形） — 新しい素体と背丈の例外を作らない決まり（設計書）。大柄に見えにくければ依頼者と相談
Task 3: Ruling: 顔と全身絵の食い違いは顔を正（髪・つなぎ・肩当ての青灰）、靴は全身絵（暗い灰）。頬の傷は描かない — 依頼者の追加指示（確認せず進める）。襟は芯の row 14 を青灰（肩当てと同じ色）にした
Task 3: Ruling: オルトの髪の形はリュカの髪（色替え）に、正面だけ左へ流れる前髪を足した。左・右・後ろはリュカと同じ形 — 同じ形で赤と茶になる。形の違いは依頼者の指摘で直す
Task 3: Ruling: 橙のつなぎはミラの髪の橙と WARN ΔE 6〜10、赤い髪はリュカの上着の赤と近い — 顔の色が正で、別のユニット。見比べのページ（compare4）で依頼者に見せる（Review Focus 4）
Task 3: Ruling: 色見本の警告（tangerine の明と中 ΔE 8.4）を明を明るくして解消 — check_colors の警告
Task 3: 書き出しで変わった PNG は ally13-map.png だけ（Review Focus 5）。unit_rules ally13 は 19 項目すべて ok、compose --check は終了コード 0。check_colors の hard failure は staff-a-f・staff-b-f の 12 コマだけ
Task 2: complete (commits e0308fb..7416dd4, tests: unit_rules ally09 全通過・compose --check 0)
Task 3: complete (commits 7416dd4..f82d8d9, tests: unit_rules ally13 全通過・compose --check 0)
Tests (Task 2・3 まとめて): npm test 1276 件 OK・npm run build OK・forge unittest 804 件 OK
Task 4: complete (commits 8cfead0.., 最終レビューの直し込み。台帳と HANDOVER の更新)
Final: 最終レビュー（opus の code-reviewer、origin/develop..8cfead0）。重要 0、軽微 7。私が確かめて、1・2・3・4・6 を直した
Final: fixed SPEC の「weapon_check の例外は無い」（実際は partial の 2 コマ）— types/unit/SPEC.md のバルド・オルトの節。checks/ally09.json・ally13.json の weapon_check.partial を確認。文書だけの直しなので失敗するテストは無し、validate 2151 件・unit_rules 両ユニット 0
Final: fixed SPEC・HANDOVER の「大柄は面積で出した」「形で見分ける」「肩当てを描いた」（実際はリュカの形の色替えで、大柄の形の違いは無い）— 事実に合わせた。大柄を出すかは依頼者が絵を見て決める
Final: fixed 部品の 1 行目のコメント（リュカの名前・持ち主の取り違え・描き直す途中の土台）55 ファイル — grep でキャラクターの名前が 0 件、compose --check 0
Final: fixed 色見本 ember・pauldron・harness の説明に残っていた別の組の文を直した（ember は scarlet との WARN ΔE 6〜7 を書いた）
Final: fixed Task 2 の Ruling の「head_cover_check も通った」— 被り物が無いので検査の対象外。part_outline の通過だけで確かめた、と直した
Final: minor (deferred): 色見本が似た組が 2 つ — forge_hi/cleaver_hi ΔE 1.6、forge_base/cleaver_base ΔE 2.6（HARD）、walnut/ironwood ΔE 6.8〜6.9。バルドとオルトは隣り合わない。共有するかは依頼者の判断
Final: minor (deferred): バルドの髭が目の下の行（y=12）の鼻の位置まで来ている（顔グラは口ひげが鼻の下から）。道具は通っている。依頼者が絵を見て決める
Final: Ruling: オルトの大柄は、リュカと同じ形のままで OK — 依頼者（2026-11-25）「オルトは OK」 — 大柄に見せる形の違いは無い
Final: fixed バルドの髭が鼻の位置まで来ていた — 依頼者の指摘（要修正）。赤枠の案のあと、依頼者の指示（正面は赤枠を下に 1px 広げる・左右は目の後ろ側の髭も 1px 下げる）どおりに描いた。変えた画素 13（正面 4・左 5・右 4）、validate・compose --check・unit_rules ally09 とも 0。画像を書き出した（ally09-map.png だけが変わった）。依頼者が見て OK
