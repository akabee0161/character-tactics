# SDD ledger — plan: docs/superpowers/plans/2026-11-18-battle-direction.md

Spec: docs/superpowers/specs/2026-11-17-battle-direction-design.md (読了)
Pre-flight: T1→T2 (skill 出来事の aim/affected), T1→T7/T8 (fresh, PendingRecruit.village), T4→T5 (fallen.ts), T6→T7 (lookupSpeaker/npcs), T7→T8 (pickVillageTalk/villageStops). いずれも plan の Interfaces と一致、衝突なし。
Task 1: complete (commits 1f94372..0dafd38, tests: npm test →    Duration  58.91s (transform 2.26s, setup 0ms, collect 9.34s, tests 34.78s, environment 17ms, prepare 4.60s))
Task 2: complete (commits 0dafd38..5e13f34, tests: npm test →    Duration  61.11s (transform 2.47s, setup 0ms, collect 11.69s, tests 31.94s, environment 15ms, prepare 5.23s))
Task 2: Ruling: 急降下で本体を弧のとおり持ち上げる(displayLift、DASH_LIFT.kyuukouka=40)・たたき割りの揺れは画面全体(shakeOffset)・狙い撃ちの会心の hit に大きな火花(drawSpark)を足した — plan の「弧」「強い揺れ」「大きな火花」を設計書の表どおりに満たすため。Task 3 の見本で依頼者が判断する — 不要なら消すだけ
Task 3: Ruling: 依頼者承認（技 11 個・滑り 0.6 秒）。指摘「ガウで一番遠い敵が最初に倒れる」→ 滑る技で倒した敵の白い輪を通る時刻まで wait、姿を lingering で残す。滑っている仲間への攻撃の hit は着くまで wait。ほか Task 2 の追加 3 点（急降下の弧・たたき割りの揺れ・狙い撃ちの火花）も承認。 — 依頼者の指示 — 戻すなら該当の描き方を消すだけ
Task 3: complete (commits 5e13f34..HEAD, 見本ページ承認、npm test 緑)
Task 4: complete (commits 5424a41..1459962, tests: npm test →    Duration  56.47s (transform 2.24s, setup 0ms, collect 9.54s, tests 32.03s, environment 16ms, prepare 4.61s))
Task 5: complete (commits 1459962..4bebf1c, tests: npm test →    Duration  66.46s (transform 2.43s, setup 0ms, collect 12.48s, tests 35.86s, environment 16ms, prepare 5.61s))
Task 5: Ruling: 帯・ゆっくり・点滅は依頼者「特になし」で承認。「負けのときも帯を見せてから進むか」の問いへの答えも「特になし」だったので、計画どおり「すぐ負けの画面へ進む」（変更なし）とした — 負けは今のまま、コードを足さない — 見せたい場合は defeat の移行を currentBanner が空になるまで遅らせるだけ（最終報告で依頼者に伝える）
Task 5: Ruling: 村・レベルアップの会話の間も tickEffects は止めない（既存の挙動）ので、点滅は帯と違い会話中も進む — 設計書の「点滅は会話の後に残りの時間」と少し違うが、会話の間にマップ上の演出だけ止めると輪や数字が固まって見えるため — 点滅が会話の間に終わるだけ
Task 6: complete (commits 4bebf1c..419f2b3, tests: npm test →    Duration  61.44s (transform 2.60s, setup 0ms, collect 10.62s, tests 35.48s, environment 13ms, prepare 4.69s))
Task 7: complete (commits 419f2b3..c6e34fb, tests: npm test →    Duration  62.95s (transform 2.50s, setup 0ms, collect 13.03s, tests 30.63s, environment 17ms, prepare 6.12s))
Task 7: Ruling: 村の npc は存在を検証するだけ（話し手は talk の行の speaker に ID で直接書く）。Review Focus 3 の「pickVillageTalk が null を返す」は Interfaces に合わせ villageStops(false)＋fresh でない出来事のセリフ欄表示のテストで見た — plan の書き違い — 仕様は同じ
Task 8: complete (commits c6e34fb..947c314, tests: npm test →    Duration  64.40s (transform 2.74s, setup 0ms, collect 12.88s, tests 32.50s, environment 19ms, prepare 6.00s))
Task 9: Ruling: 依頼者「直したい文はあるが、あとで調整する。とりあえずこれで進める」— 下書きのまま JSON に入れた（村人の名前も下書きの 村の 人・村の 人・薬師・鍛冶屋・長老・仕立て屋）— 文は後で依頼者が直す
Task 9: complete (commits 947c314..9736ebf, tests: npm test →    Duration  56.62s (transform 2.56s, setup 0ms, collect 10.80s, tests 30.02s, environment 15ms, prepare 4.97s))
Task 10: complete (依頼者承認。変更なし、コミットなし。同じ tick に他の仲間のレベルアップが重なる場合は未撮影＝nextInterrupt のテストのみ)
Task 11: README・HANDOVER を更新、tools/fx-page と out/fx を片付け、balance --check exit=0（stage10 60.0・stage3 47.5/82.5 で工程 4 と同じ）。台帳の写しは最終レビューの後
Final: レビュアーは fable を指定したが利用上限で失敗したため opus で実施（最も能力の高いモデルが使えなかった）
Final: fixed 暗いステージで点滅中の倒れた仲間が膜の上にも重ねて描かれる — 描画のためユニットテスト無し（CLAUDE.md）、draw.ts の retired 分岐で phase==='marks' を飛ばす、suite 1218/1218・build 成功。ブラウザでは未確認
Final: fixed README の「ゆっくりは打ち切られ」が実装と食い違う — 実装（会話・カードの間は止まり、戻った後に残りが続く。計画 Task 8 どおり）に README を合わせた
Final: minor (deferred): 加入の会話とレベルアップが同じ tick のとき、カードの前に戦闘が 1 tick 進む（endRecruitTalk が levelUps を見ない）
Final: minor (deferred): 同じ tick に初めての村が 2 つあると 2 つ目の会話もセリフ欄も出ない（今は村が 1 ステージ 1 つなので起きない）
Final: minor (deferred): 村の npc は存在確認のみで話し手と照合しない
Final: minor (deferred): 村に着いた tick に負けが決まると村の会話を見せてから負けの画面になる
Final: minor (deferred): ?debug の一時停止中も帯・ゆっくりの残りが減る
Final: minor (deferred): 滑っている途中のタップの当たり判定は計算の位置・残像は cancelDash 後も元の道筋・滑り中に倒れた点滅がとどめの数字より先・滑り中の仲間自身の殴る数字は待たない
Final: minor (deferred): HANDOVER の「次にやること」に push・PR の行が無い（push 前に直す）
Final: minor (deferred): main.ts の event フェーズのコメントが加入の会話のままで古い
