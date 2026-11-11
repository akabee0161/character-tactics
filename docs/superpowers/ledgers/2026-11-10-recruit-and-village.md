# SDD ledger — plan: docs/superpowers/plans/2026-11-10-recruit-and-village.md

Spec: docs/superpowers/specs/2026-11-10-recruit-and-village-design.md（到達可・読了）。BASE(Task1前) = 1a80a45

## Pre-flight scan

| 対象 | 作るもの ↔ 使うもの | 所見 |
|---|---|---|
| T1 自身 | names.ts と registry の置き換え | 整合。T5 が joins/persuasions/villages の本文を足す旨を T1 が明記済み |
| T1↔T5 | T1 は buildRegistry 末尾で置換。T5 は相互参照を足す | 置換は相互参照の後。T5 で本文を置換対象に足す（T5 に明記済み） |
| T2 自身 | StatBonus/Unit 新項目/SaveData members,claimed,bonus | 整合。`sim.ts:349-352` の行番号は目安 |
| T2↔T3 | T2 の cheerUntil/cheerPower/tauntUntil/attackPower ↔ T3 が消費 | 整合 |
| T2↔T6 | T2 の SaveData members/claimed ↔ T6 の PartyProgress | 整合（SaveData が PartyProgress を満たす） |
| T3 自身 | skills.ts / sim.ts applyTaunts / skills.json | 整合。skills.test.ts と sim.test.ts の既存の組み方に合わせる |
| T4 自身 | 新ユニット JSON・生成器 | 整合。role-tate/role-mahou/role-teki/role-teki-mahou は assets/images に実在。role-yari/role-ouen は生成 |
| T4↔T5 | ユニット/敵 JSON ↔ registry 相互参照 | T4 時点で roster でも加入先でもないユニットが reg.units にいる（T5〜で解消）。T4 の注意書きのとおり |
| T4↔T6/T10 | 新 4 人が一覧（reg.units の全部）に出る | T6/T10 で partyIds に置換。中間状態は許容（計画に明記） |
| T5 自身 | schema 型・検証・party.ts | 整合。StatKey は T2 の types.ts から import |
| T5↔T6 | MAX_PARTY/partyIds/StageDef 3 項目 ↔ createBattleState | 整合 |
| T6 自身 | createBattleState 第3引数 PartyProgress | 呼び出し元（main.ts・全テスト）の修正が必要。計画に main.ts:168 と「テスト」と明記 |
| T6↔T7/T8 | visited/claimed/claimedBefore/pendingRecruit/nextPlayerUid | 整合 |
| T7 自身 | events.ts・step・dialogue | テスト用の `V` を足す legend は通れないマス（T5 検証と整合） |
| T7↔T8 | step の pendingRecruit 停止 ↔ completeRecruit | T7 は先頭で return、T8 は updateObjectives を pending の tick で呼ばない。呼び順は resolveRemoval→updatePersuasions→updateVillages→updateObjectives。整合 |
| T8↔T9 | completeRecruit ↔ main.ts event フェーズ | 整合 |
| T9↔T10 | main.ts / screens.ts を両方触る | 別の箇所（event フェーズ・drawResult 加入表示 / 下の段・一覧）。T10 が drawResult の行配置を変えるので T9 の「仲間に 加わった！」行と干渉しうる → T10 に注意を渡す |
| T10 自身 | layout の数値 | 整合（resultSlot 8 行は y 342+56=398 < 称号 450） |
| T11↔T5 | JSON の形 | 整合。stage1 だけ legend あり、`V` 済み。ほかは legend 追記 |
| T11 自身 | 6 種類の村を 1 回ずつ置く | talk(s1) recruit(s4) heal(s5) powerUp(s6) xp(s8) stat(s10)。加入先は ally05=s2 開始時, ally07=s4 村, ally06=s7, ally08=s9。重複なし。整合 |
| T12 | README・HANDOVER・撮影 | 整合 |

所見に致命的な矛盾なし。

Ruling: 計画の `sim.ts:349-352` 等の行番号は目安として扱う — 実コードに合わせるため — 外れても実装者が探す手間のみ
Ruling: スクリプトは変数入りのコマンドが安全フックで止まるため、リテラルのパスで呼ぶ — 環境の制約 — なし
Task 1: minor (deferred): 未知 id のエラーのテストが lines のみ（intro/outro・敵名は未検査）
Task 1: minor (deferred): names.test.ts に未知 id の重複除去・既知と未知の混在のテストが無い
Task 1: minor (deferred): registry.ts で line.text/def.name を直接書き換えている（新しいオブジェクトである旨のコメントが欲しい）
Task 1: complete (commits 1a80a45..cd1a535, review clean)
Task 2: Ruling: src/ui/flow.ts を brief 外で最小修正した（statBonus が 0 でなければ bonus を書き戻す）のを容認 — これが無いとクリアで bonus が消える — Task 6 が applyStageClear を作り直すので、そこで bonus の書き戻しを必ず残しテストを足す（Task 6 の dispatch に渡す）
Task 2: minor (deferred): NO_BONUS が可変の export（Object.freeze/Readonly 推奨）
Task 2: minor (deferred): sim-combat.test.ts の攻撃力テストが 1 つの it に 3 ケース
Task 2: complete (commits ee2f17d..0c17565, review clean)
Task 3: minor (deferred): skills.test.ts の敵 HP 12 の直書き（maxHp から導く方が堅い）
Task 3: minor (deferred): tsuki の d===0 で null になる境界にテスト・コメントが無い
Task 3: minor (deferred): 引きつけは交戦中の敵も引き剥がす（brief どおり。挙動として記録）
Task 3: complete (commits 69cc104..6723018, review clean)
Task 4: Ruling: 生成器の未知 ID 拒否（計画外の追加）を容認 — 書き込み前に止まるだけで無害 — 不要なら削るだけ
Task 4: minor (deferred): allies.json の pinch:ally06 が {ally05} を呼ぶ。ally05 が仲間にいない場面でも出うるので、最終レビューで文面を見直す（仲間の名前を呼ばない文に直すのが無難）
Task 4: minor (deferred): allies.json の本文は実装役の案（計画は例 1 つのみ）。依頼者へ最後の報告で伝える
Task 4: complete (commits 6a3dc4e..0caba9e, review clean)
Task 5: Ruling: StageDef の 3 項目を TS 型では必須にし（schema は省略時 []）、talk は 1 行以上を必須にした実装を容認 — 設計書に反せず、会話が読み飛ばされない側の厳格化 — Task 9 の「行が無ければすぐ completeRecruit」は防御的な処理として残る。不要なら緩めるだけ
Task 5: minor (deferred): registry.test.ts の 8 人超えテストの検査が s.includes('8') で緩い
Task 5: minor (deferred): schema.ts readVillages で col/row が不正なとき ?? 0 で余計なエラーが重なりうる
Task 5: minor (deferred): partyIds は roster にも加入先にもいない reg.units を数える（MAX_PARTY の検査は数えない）。今のアセットでは起きない
Task 5: complete (commits 7ac8cce..f59af7c, review clean)
Task 6: fix round 1/5 (1 addressed, 0 open — 出撃 8 人のテストが 8 人を超えない; commits 5fc9426..98f5ac5)
Task 6: Ruling: createBattleState は partyIds のうち members に含まれるものだけを roster の後ろに足す（ブリーフは partyIds 全体）— Task 11 で新 4 人が加入先になれば partyIds の非加入先は旧 4 人（全員 roster 内）だけで同じ結果。それまでは新 4 人が全ステージに常駐するのを防ぐ — roster に旧 4 人がいない将来のステージには旧 4 人が自動では入らない
Task 6: Ruling: applyStageClear は statBonus が 0 でないときだけ bonus を書き戻す（ブリーフは常に）— 常に書くと既存の {level,xp} 等価テストが多数壊れる。statBonus は減らないので情報は失われない。専用テストあり — 全員に bonus: 0 が入らないだけ
Task 6: minor (deferred): 8 人上限のテストは MAX_PARTY=8・roster 4 に依存
Task 6: complete (commits 7536b9d..98f5ac5, 1 fix round, review clean)
Task 7: minor (deferred): pendingRecruit が埋まっている tick に recruit の村へ着くと、その村は visited になるが加入せず、二度と加入できない（events.ts:58-66,79）。出荷データ（recruit の村は stage4 の 1 つ、説得は stage7・9）では起きない。最終レビューで「recruit の村は pendingRecruit が空でないとき visited にせず continue」に直すか判断。Task 8（説得と同 tick）の dispatch に注意として渡す
Task 7: minor (deferred): text が null の村に VILLAGE_DONE_TEXT が出る fallback（初回の文として不自然）
Task 7: complete (commits b127934..5a33fc5, review clean)
Task 8: Ruling: src/core/retire.ts を新設し後始末を resolveRemoval と共有、makeUnit を export した変更を容認 — 動作は同じで重複を避ける — なし
Task 8: minor (deferred): 説得と recruit の村が同 tick に重なると村側の加入が失われる（Task 7 の minor と同根）。最終レビューで updateVillages を「recruit の村は pendingRecruit が空でないとき visited にせず continue」に直す
Task 8: minor (deferred): MAX_PARTY 満員のとき、説得の会話が出て敵だけ消え誰も加わらない。出荷データは roster 4 + 加入 4 = 8 で満員にならない。最終レビューで updatePersuasions を満員なら始めない形にするか判断
Task 8: minor (deferred): completeRecruit の allies 数は hp<=0 で未 retired の味方も数える（resolveRemoval 後なので実害なし）
Task 8: complete (commits 1c65086..3f7c5d7, review clean)
Task 9: minor (deferred): 既読ステージでは「とばす」で、まだ members に入っていない開始時の加入の会話も飛ばせる（負けて再挑戦した場合）。設計書の「加わる会話の間は戦闘を止める」には反しない。最終レビューで、スキップ判定に members を渡して加入の会話は飛ばせなくするか判断
Task 9: minor (deferred): pendingSkill が event 開始時に消えない（戦闘再開時にまだ有効）。Task 11-12 の目視で確認
Task 9: minor (deferred): 説得の吹き出しと「！」の印が頭上で重なりうる。Task 11-12 の目視で確認
Task 9: complete (commits 65e6a5f..0e979cf, review clean)
Task 10: minor (deferred): 役割の絵が無いときの代わりの文字（sprites.ts:88-92, 14px）が新しい 64px 枠をはみ出す。今の全ユニットに役割の絵があるので潜在的。最終レビューで maxWidth を付けて直す
Task 10: minor (deferred): 護衛の印（screens.ts ~242）が新しい顔の左上に重なる。Task 12 の目視で確認
Task 10: minor (deferred): 称号の行に maxWidth が無い（既存と同じ弱点）。長文の称号は Task 12 の目視で確認
Task 10: Ruling: fillText の maxWidth で長い文字列を縮める変更を容認 — はみ出しだけを縮める低リスクの処理 — 見た目が少し詰まる
Task 10: complete (commits 7bc9756..8398e31, review clean)
Task 11: Ruling: 村をタップしても訪問が起きない（タップは隣のマスの中心＝村の縁から 16px へ動くが VISIT_MARGIN=10）は、計画の定数の誤り — 設計書「足元の箱が村のマスに隣り合う位置」に合わせ、VISIT_MARGIN を 18 に上げる（隣のマスの中心が入る最小限。Task 5 の定数・Task 7 のテストの境界を直す）— 斜め隣でも発火するようになる（許容）
Task 11: fix round 1/5 (1 addressed, 0 open — VISIT_MARGIN 10→18; commits 48c879a..bf341c2)
Task 11: minor (deferred): 斜めに隣のマスの中心でも訪問になる（正方形の枠）。許容
Task 11: minor (deferred): stage5 の村 (11,10) は通り道の行をふさぐが、(10,10) から届く
Task 11: complete (commits a7448bd..bf341c2, 1 fix round, review clean)
Task 12: Ruling: タイトル画面の「4人の 仲間で」→「仲間と ともに」を容認 — 8 人まで仲間が増えて古い文言が偽になった — なし
Task 12: Ruling: 説得の吹き出しを HP バーの右へ、加入の会話の開始で pendingSkill を解く小修正を容認（ブラウザ確認で見つけた不具合）— 最小の直し — なし
Task 12: minor (deferred): 説得の吹き出しが右端（p.x+27 > 540）でクリップしうる（draw.ts:138）。今のステージでは起きない
Task 12: minor (deferred): 選択画面の仲間の枠で名前と Lv が顔に対して上寄り（見た目）
Task 12: complete (commits 89754d1..451163b, review clean)
最終レビュー: 修正すれば可 → 修正 1 回（5 コミット 679ee47..7f277c1）→ 範囲を絞った再レビュー Ready。Important 3 件・Minor（見た目・テスト・README）を直した
最終レビュー: Ruling: 最大レベルの仲間が経験値の村を訪れると claimed だけが入る件は直さない — 一度きりの決まりに反しない — なし
最終レビュー: Ruling: 会話・回復・攻撃力の村の文が、同じ tick に加入の会話が始まると clearSpeech で消えるのは許容 — 出荷データでは起きない — 効果は入るが文が出ない
最終レビュー: Ruling: text が null の recruit の村で加入済みなら何も出さない — 初回の文として不自然な代わりの文を出さない — README の該当 1 文が少し古い（minor）
最終レビュー: minor (残り): flow.ts の import の空白（BattleState,CharProgress）、README の「手を ふっている」の記述が recruit・加入済みの場合に少し古い、main.ts の canSkipIntro の配線はテストされない
完了: 12 タスク + 最終レビューの修正。npm test 881 件・npm run build 成功
