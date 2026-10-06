# SDD ledger — plan: docs/superpowers/plans/2026-09-05-stage-talk-phase.md

Spec: docs/superpowers/specs/2026-09-05-stage-talk-phase-design.md (読了)
Branch: feat/stage-talk-phase / start HEAD: ce1490e

## Pre-flight scan

### タスク間（ファイル/インタフェース共有ペア）

| ペア | 生産 → 消費 | 結果 |
|---|---|---|
| T1↔T2 | schema.ts / registry.ts を両方が編集 | 編集ブロックが別（T1=order, T2=intro/IntroLine）。矛盾なし |
| T1↔T5 | T1: reg.stages を order 昇順に整列 → T5: known = reg.stages の id 集合 | 整合。順序に依存しない使い方 |
| T1↔T6 | T1: order 必須 → T6 は stages を index で引くのみ | 整合 |
| T2↔T6 | T2 Step10 で main.ts:129 の enqueue(pickStageIntro) を削除 → T6 が beginStage で復活配線 | 整合（T6 は「復活させない」と明記、talk が持つ） |
| T2↔T7 | dialogue.ts を両方が編集。T2=pickStageIntro/TalkLine, T7=DialogueRequest.uid/make() | 編集箇所が分離。T2 後の pickStageIntro は make() を使わないので T7 の make() 変更と衝突しない |
| T3↔T4 | talk.ts / talk.test.ts。T4 は追記のみ | 整合。ただし T4 のテスト import は T3 の import 行へマージが必要（同一モジュール2回 import を避ける） |
| T4↔T6 | T4: TalkState 一式 → T6: main.ts が消費 | 署名一致を確認（makeTalkState/tickTalk/advanceTalk/skipTalk/visibleLines/currentSpeaker/pageCount） |
| T5↔T6 | T5: hasReadIntro/markIntroRead → T6: onPointerDown/endTalk/render | 整合 |
| T6↔T7 | layout.ts（T6=BTN.skip,TALK_*／T7=bubbleRectAt,BUBBLE_*）、screens.ts（T6=drawTalk／T7=drawBubble 書き換え）、main.ts | 追記位置が分離。順次実行なら衝突なし |
| T7←T6 | T7 は talk フェーズ稼働を前提 | 計画 L37 で順序訂正済み（設計書13節の誤りを訂正）。妥当 |
| T8←T1..7 | README のみ | 衝突なし |

### タスク内自己整合（テスト vs 実装 vs 触るファイル）

| Task | 検査 | 結果 |
|---|---|---|
| T1 | 期待 reason 文字列 vs requireNumber の実出力 | 一致（schema.ts:44 'かずが ひつよう' / :45 'せいすうが ひつよう'）。opts に min/int あり |
| T1 | sort/重複検査の挿入位置 vs 早期 return | registry.ts:94 の直前 → :95 の `errors.length>0` return で重複エラーが返る。整合 |
| T2 | readIntroLine が使う fail/requireObject/requireArray | すべて schema.ts 内に存在。fail は非 export だが同一ファイル内なので可 |
| T2 | 既存 pickStageIntro テストの破壊 | dialogue.test.ts:150-165 に実在。計画どおり書き換えが必須 |
| T3 | 手計算でテスト16件の期待値を検証 | 全件、示された実装で通る |
| T4 | advanceTalk 4分岐・visibleLines・pageCount の期待値を手計算 | 全件、示された実装で通る |
| T5 | テストが使うヘルパ vs 実在 | **不一致**（下記 Ruling 1） |
| T6 | drawTalk の描画順 vs button() の副作用 | **不具合**（下記 Ruling 2） |
| T6 | drawBattle の署名 | render の placement ケースと同一。整合 |
| T7 | ev.byUid の存在 | types.ts:91 unitFled に byUid あり。整合 |
| T7 | layout.ts の Vec2 import | 現在 Rect のみ import。追加が必要（計画に明記あり） |
| T8 | README | 実装者が現物確認 |

### Rulings（実行前）

Ruling 1 (Task 5): 計画 Step 1 のテストが使う `fakeStorage` と共有 `reg` は save.test.ts に存在しない。
実在するのは `memoryStorage(initial?)`（キーを無視して1本の文字列を保持）で、`reg` は describe ごとのローカル。
決定: 新規 describe 内で `const reg = testRegistry();` を自前で宣言し、ストレージは既存の
`memoryStorage(JSON.stringify(...))` を使う（キーを無視する実装なので SAVE_KEY 経由の setItem と等価）。
新ヘルパ `fakeStorage` は作らない。
理由: 計画自身が「無ければ定義する」と逃げ道を用意しているが、既存ヘルパで足りる以上、
重複ヘルパを足すのは YAGNI であり、レビュー時に指摘される。
間違っていた場合のコスト: save.test.ts のテスト4件の記述様式だけ。挙動と実装コードには影響しない。

Ruling 2 (Task 6): 計画 Step 2 の `drawTalk` は `button(ctx, BTN.skip, 'とばす')` を本文描画より先に呼ぶが、
`button`（screens.ts:27-35）は `ctx.textBaseline = 'middle'` を設定したまま復元しない（textAlign だけ戻す）。
結果、既読ステージ（canSkip=true）でのみ話者名と本文のベースラインがずれ、初回と再訪で文字位置が変わる。
決定: `button(...)` の直後に `ctx.textBaseline = 'alphabetic';` を1行足す。
理由: 既存の `button` の副作用を全画面で直すのは今回のスコープ外（他の描画関数への影響を検証できない）。
呼び出し側で局所的に打ち消すのが最小の変更。
間違っていた場合のコスト: 会話ウィンドウ内の文字が縦に半行ずれるだけの見た目の問題。1行で戻せる。

## Progress

Task 1: complete (commits ce1490e..8ffad89, review clean)
Task 1: minor (deferred): registry.test.ts の新規テストが KNOWN_SKILLS 定数でなく ['funbaru'] 直書き
Task 1: Ruling: 実装者が既存テスト 'ステージは パスの じしょじゅんに ならぶ' を削除した件 — レビューが「order 必須化で同テストは3ステージが order:10 の重複となり成立せず、新 describe が上位互換」と判定。削除を承認する。間違っていた場合のコスト: パス辞書順に関する回帰検知の喪失だが、その挙動自体を本タスクが廃止しているため実害なし。
Task 2: implemented (commit 95012da) — 初回のレビュー派遣が API のスペンド上限で異常終了。レビューを再派遣する。
Task 2: complete (commits 8ffad89..95012da, review clean)
Task 2: minor (deferred): registry.ts の intro null ガード分岐（speaker/lineId が null のとき検査しない）に専用テストがない
Task 2: minor (deferred): dialogue.ts pickStageIntro の `if (text === undefined) continue;` は起動時検証済みのため到達不能な防御コード。将来 validation を経ない経路が出来ると無言で行を落とす
Task 3: review ❌ — Critical: splitPages(maxLines<=0) が無限ループ→OOM / Important: hangPunctuation が連続約物（`」。`）を1文字しか引き戻さず、2文字目が行頭に残る
Task 3: Ruling: Critical（maxLines<=0 の OOM）は計画本文どおりのコードだが修正する。実際の呼び出しは layout.ts の定数 TALK_MAX_LINES=3 のみでレビューの言う「設定由来で0になる」経路は本コードベースに存在しない。それでもガードを入れるのは、故障モードがタブごと落ちる回復不能なハングであり、内部不変条件の違反として即座に大きな音で失敗させるほうが安いため。silent clamp ではなく throw にする（黙って1に丸めると呼び出し側のバグが隠れる）。間違っていた場合のコスト: 到達不能な throw が1行増えるだけ。
Task 3: Ruling: Important（連続約物）は修正する。計画のコメントが禁じているのは「追い出し」（前行の末尾を次行へ送ること）であって、ぶら下げの連鎖ではない。連鎖させても設計方針には反せず、計画が明記した「行頭に来る約物は前の行へぶら下げる」という規則を実際に成立させるだけ。ぶら下げで maxWidth を超える量が1文字→複数文字に増えるので、talk.ts のコメントもあわせて直す。間違っていた場合のコスト: 約物が連続する行で行末が数文字ぶん枠を超える見た目。
Task 3: fix round 1/5 (2 addressed, 0 open; commits fb620f3..e1b159e)
Task 3: complete (commits 95012da..e1b159e, review clean)
Task 3: minor (deferred): hangPunctuation の `prev !== ''` により空行直後の約物はぶら下げられない
Task 3: minor (deferred): 約物ぶら下げとページ境界の相互作用に対するテストがない
Task 3: minor (deferred): splitPages の throw メッセージ 'maxLines must be positive' が英語。本リポジトリの他の throw（main.ts）は日本語
Task 4: complete (commits e1b159e..ece4a59, review clean)
Task 4: ⚠️解決: レビューが確認できなかったコミットメッセージ本文を controller が git log -1 --format=%B で確認 → 計画の指定と一致。ギャップなし
Task 4: minor (deferred): tickTalk が shown の下限をクランプしないため、負の dt で shown が負になる（現状の呼び出し元では発生しない）
Task 5: complete (commits ece4a59..85e8046, review clean)
Task 5: minor (deferred): reconcile の readIntroStageIds ブロックが clearedStageIds ブロックの known-set+filter を逐語的に重複（2箇所なので抽象化は保留）
Task 5: minor (deferred): reconcile も markIntroRead も永続化された配列内の重複 ID を除去しない（clearedStageIds と同じ既存挙動）
Task 6: complete (commits 85e8046..3aebbb1, review clean)
Task 6: ⚠️解決: コミットメッセージ本文を controller が確認 → 計画の指定と一致
Task 6: ⚠️未解決（人間に委ねる）: 計画 Task 6 Step 5 の手動ブラウザ確認9項目は本環境に Playwright / ヘッドレスブラウザが無いため実行不能。task-6-report.md に逐語で記載済み。最終報告でユーザーに提示する
Task 6: minor (deferred): talkMaxWidth が TALK_BODY_X(100) 基準で計算されるため、地の文（TALK_PAD=24 始まり）は実際に使える幅より約76px 早く折り返す。計画本文どおりの式
Task 7: complete (commits 3aebbb1..82f5c76, review clean — spec ✅, Critical/Important なし)
Task 7: ⚠️解決: コミットメッセージ本文を controller が確認 → 計画の指定と一致
Task 7: ⚠️未解決（人間に委ねる）: 計画 Task 7 Step 13 の手動ブラウザ確認9項目。本タスクのバグ修正の実証そのものであり、静的検証は全て通ったが実ポインタでの検証は未実施
Task 7: minor (deferred): main.ts の吹き出し当たり判定が描画と逆順に「最初のヒットで return」するため、重なった吹き出しでは見えていない側が先に消える
Task 7: minor (deferred): 吹き出しの矩形が別ユニットの選択タップを食いうる（下のユニットの吹き出しが上のユニットのタップ円を覆う）。計画が指定した bubbles→map の順序に由来。従来のバグより軽い（1タップ無駄になるだけ）
Task 7: minor (deferred): screens.ts:213 が BUBBLE_PAD(10) と初回ベースライン offset を直書きしており、layout.ts の非 export 定数と二重管理
Task 7: minor (deferred): BUBBLE_MAX_W=320 は箱を切り詰めるがテキストを折り返さないため、18文字超の台詞を足すと無言で溢れる（現データの最長は16文字なので到達不能）
Task 7: minor (deferred): layout.test.ts の左端・上端クランプテストが toBeGreaterThanOrEqual で境界値そのものを検証していない（誤ったクランプ定数でも通る）。計画本文どおりのテスト
Task 7: minor (deferred): retired ユニットは描画されないが吹き出しは3秒間その場に残る
Task 7: minor (deferred): layout.ts が LOGICAL_W でなく 960 を直書き（隣接の skillButtonAt と揃えた意図的なもの）
Task 8: complete (commits 82f5c76..c142434, review clean)
Task 8: minor (deferred): README が「text と lineId の両方を書くとエラー」は明記するが「どちらも書かないとエラー」に触れていない（計画本文どおりの文面）
Task 8: minor (deferred): README の文字送り説明が「全文が出る」で止まり、そのあと更にタップで次へ進む点を明示していない（計画本文どおりの文面）

## Final whole-branch review (a2173ba..c142434, opus)

判定: Ready to merge = With fixes。Critical なし。Important 3件（うち1件は手動ブラウザ確認そのもの）。
繰り越し Minor 15件のトリアージ: blocks merge = 0 / fix soon = #1,#2,#3,#4,#11,#14,#15 / leave = 残り。

Task Final: Ruling: レビュー推奨「spec §8.1 の記述（吹き出しはキャラの丸より上に出すのでキャラ選択のタップとは重ならない）を訂正する」は採らない。docs/superpowers/ 配下は作成時点のログであり遡って更新しない、が本プロジェクトの規約。代わりに、再導出の起点になる main.ts の当たり判定側にコメントで正しい制約（自分の丸とは重ならないが他ユニットの丸とは重なりうる）を書く。間違っていた場合のコスト: 設計書を読んだ人が同じ誤りを再導出しうる。コード側コメントで受け止める前提。

Task Final: Ruling: 繰り越し Minor #4（BUBBLE_MAX_W が箱を切り詰めるだけでテキストを折り返さない）に、レビュー推奨の「起動時バリデーションで台詞長を弾く」は入れない。18文字という閾値は設計書のどこにも根拠がなく、外すとコンテンツ作者が正当な台詞を書けなくなる。代わりに BUBBLE_MAX_W にこの制約をコメントで明記するに留める。間違っていた場合のコスト: 長い台詞を足したときに吹き出しから文字が溢れる（起動時には気づけない）。
