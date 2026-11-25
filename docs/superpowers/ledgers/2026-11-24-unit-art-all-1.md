# SDD ledger — plan: docs/superpowers/plans/2026-11-24-unit-art-all-1.md

Base: b25922c（feat/unit-art-all）。Spec: docs/superpowers/specs/2026-11-24-unit-art-all-design.md

Pre-flight:
- Task 1 → Task 4・5: Task 1 が素体に耳を足し、Task 4・5 の芯がその複製になる予定だった。Task 1 は取りやめ（下の Ruling）。芯は今の素体（耳なし）の複製にする。
- Task 2 → Task 3: 全身絵の作り方（タグを足すか）の結論を Task 3 のジョブが使う。
- Task 3 → Task 4・5: 全身絵と顔が CP0 の入力。
- Task 4 → Task 5: 重なり順と動きを Task 5 が引き継ぐ。

Task 1: Ruling: 素体に耳を足さない — 依頼者（2026-11-24）が、影色 2x2 の案と 4 案（A 影の輪郭・B 黒の輪郭・C 巻いた形・D 明るい耳と影の穴）をすべて「耳に見えない」と却下。代わりに髪の側で耳を避ける髪型にする方針。その作り込みはいったん不要 — 参考画像（FF6 のドット絵）の耳は縁取りのある肌の塊で、32px の素体では再現できなかった — 素体は耳なしのまま。ボルグの芯の耳は残す。
Task 1: cancelled（素体の変更は stash「却下した素体の耳（2x2 影色）」に退避。コミットなし。SPEC の素体の行は変えない。ISSUES の行に決定を書き、HANDOVER の進捗を工程 2 に進めた）
Task 2: Ruling: 全身絵の候補は背景除去なしで作る（Task 3 は generate に --no-matte） — 依頼者（2026-11-24）「このゲームの使い方なら全身絵は背景除去不要」 — 候補のページに背景を消した絵が並ばないだけ。要るとなったら matte で後から作れる
Task 2: 結論: タグは足さない（試し 4 枚のうち依頼者が 3 番を選択。右手左手のタグは使っていない）。割合は数えていない（収まり・持ち物は依頼者が目で選ぶ決まり）。選んだ 3 番は全身が収まり、槍を肩に担ぐ。左手に炎をまとった大きな刃状の物もある（CP0 の食い違い一覧に入れる）。face.png の SHA-256 は adopt 前・install 後とも d31e0332…で一致、install の「消した」なし、書き戻しの一覧なし（character.yaml は変更なし、pytest は設定を直していないので省略）
Task 2: complete (commits dfd9d2b..9fc4c2c, tests: SHA-256 一致・git diff --stat characters/ally07 は fullbody.png の追加のみ)
Task 3: Ruling: 全身絵は候補 76 枚を Claude が顔との食い違いで数えて並べ、依頼者が選び直した（リュカ試し4・セラ1・ノエル16・バルド18・シオン26・ピコ40・ユナ再生成8・オルト54・ガンツ62・ミラ71） — 依頼者の指示（2026-11-24〜25）。候補は全部並べる決まりのまま、並べ替えは依頼者の頼み — 食い違いの件数は私の目測で、見落としがありうる
Task 3: Ruling: ピコの全身絵の頭の上の白い鳥を、画素で白く塗って消した — 依頼者（2026-11-25）「白い鳥は背景除去しましょう」。背景除去のモデルは使わず、位置と色で塗った — 元の絵は local/tmp/ally11_fullbody_with_bird.png。髪の上の細い輪郭が残る。ほかは変えていない
Task 3: Ruling: ユナは頭巾の絵が無く、足したタグで再生成した（8 枚） — 依頼者（2026-11-25）。タグ: green bandana on head, green headscarf, ponytail, holding bow, quiver on back。character.yaml の outfit と items に書き戻した（outfit に既にある hood down と食い違うが、顔の採用済みの絵は変わらない）
Task 3: 顔 face.png の SHA-256 は adopt 前・install 後とも 10 人一致、install の「消した」なし、git status で face.png の変更なし。illust-asset-forge の pytest 578 件 OK（ユナの character.yaml を直したため）。まとまりの組み替えは依頼者が未回答
Task 3: complete (commits dfd9d2b..6cbb127, tests: illust-asset-forge pytest 578 passed)
Ruling: リュカの設定シート（CP0）を承認。新しい色見本 7 種（tawny・scarlet・dove・saddle・beige・crimson・coral）で進める — 依頼者（2026-11-25）「これでOK」 — 色は CP1 以降で変えうる
Ruling: 先に決めたこと（ピコ・ノエル・ガンツ。今の計画の範囲外。PR 4〜6 の計画を書くときに使う）— 依頼者（2026-11-25）: ピコの翼は羽ばたかせる（動かす所は未確認）・翼の色は既存の cloth・攻撃は素手の拳／ノエルの旗は棒だけ weapon・布は cloth、攻撃は槍のように突く／ガンツ（とシオン）の大きな盾はボルグの盾より一回り大きく、攻撃は空き手の拳で盾は base のまま — ピコの羽ばたきは still_check の判定を変えるので、道具を直す前に対象と範囲を依頼者に確認する（ISSUES 等は直さない）
Ruling: ピコの羽ばたき — 依頼者（2026-11-25）: 飛んでいるので歩きの概念が無く、移動している（walk のコマ）ときに翼を動かす。待機の 2 コマ目と攻撃で翼を動かすかは未確認（PR 6 の CP0 で聞く）。walk で動かす所が脚から翼に変わるため still_check の判定が変わる — 道具は今は直さない（PR 6 の計画で対象を決める）
Ruling: 依頼者の追加指示（2026-11-25）— 「私に確認せずに進められるところを一気に進めてください。確認は、あなたの判断で進めた結果を提示してもらえれば十分」。計画の「止まる」所（CP0〜CP4 など）では止まらず、Claude の判断で進めて結果を Artifact で見せる。push・PR は引き続き依頼者が頼んだときだけ。illust-asset-forge の src/・UPSTREAM.md と道具の判定は変えない — 判断を誤ると描き直しになる。承認前にコミットしない決まりは、この指示でコミットしてよいことに変えたが、見せた結果への依頼者の指摘は後から反映する
Task 4: Ruling: リュカの CP1 の組み合わせは E0-J1-S2-K1-H1-W1（目 E0・高い襟＋胸当て・茶の肩当て・膝当てなし・長い前髪・赤い槍）を Claude が選んだ — 依頼者の追加指示（確認せず進める）。膝当ては 32px では見えないので描かない — 髪と上着の形は依頼者の指摘で直す
Task 4: Ruling: 襟の上下に輪郭の行（row 13・15）を足した — part_outline が服の部品が肌・芯の服に直に接する縁を落としたため、道具に従って直した — 首まわりに黒い線が増えた
Task 4: ゲームの画面でのリュカの確認は、リュカが序盤の仲間にいないため再生ページ（ゲームと同じ ally07.json とシート）で代えた — npm test 通過・npm run build 通過 — ゲーム内の見え方は未確認
Task 4: complete (commits 4e25e12..862b3e8, tests: unit_rules ryuka 全通過・npm test・npm run build・forge unittest 804 OK)
Task 5: Ruling: ミラは女性の槍の敵（spear-thug-a-f）の重なり順と動きを使う — 計画の Interfaces は「リュカの順を引き継ぐ。女性の敵と食い違うときは依頼者に聞く」だが、リュカは男性の敵の槍の順、ミラは女性の敵の槍の順で、どちらも同じ作り（長い髪の位置だけが違う）。食い違わないので聞かなかった — 長い髪の前後の重なり順が女性の敵と同じになる
Task 5: Ruling: 顔と全身絵の食い違いは顔を正（髪＝橙の長い髪、鎧＝金の肩当てと胸当て）、下半身は全身絵（茶のタイツ）。鎧の色は顔の #eab27c が肌と近いので全身絵の #c8814c に寄せた — 依頼者の追加指示（確認せず進める）。三つ編みは正面の右の 5 行だけで、背面は敵の女性の後ろ髪のまま — 髪の形は依頼者の指摘で直す
Task 5: complete (commits 862b3e8..HEAD, tests: unit_rules mira 全通過・npm test・npm run build・forge unittest 804 OK)
