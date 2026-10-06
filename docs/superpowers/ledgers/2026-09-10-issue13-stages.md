# SDD ledger — plan: docs/superpowers/plans/2026-09-10-issue13-stages.md

## Pre-flight scan (2026-09-10)

| Task pair / self-check | shares | produces vs consumes | finding |
|---|---|---|---|
| Task1 vs Task5 | `src/ui/screens.ts` | T1: drawBottomBar内の発動可能枠のみ変更 / T5: drawStageSelectのみ変更 | 別関数・順次実行のため衝突なし |
| Task2 vs Task9 | `assets/stages/stage3.json` | T2: enemies座標を修正 / T9: orderを30→100に変更 | 別フィールド・順次実行のため衝突なし |
| Task2 vs Task9 | `src/engine/registry.test.ts` | T2: 既存STAGEフィクスチャのplacement/enemies修正(:27-35) / T9: 末尾にdescribe追加 | 別範囲・順次実行のため衝突なし |
| Task4 → Task5 | `src/ui/scroll.ts`, `src/ui/layout.ts`(STAGE_LIST_VIEW/stageListContentH) | T5がT4の関数を消費 | 順序どおりで整合 |
| Task6 → Task7/8/9 | `assets/enemies/yumihei.json`,`majinaishi.json` | T7-9のステージがdefIdを消費 | 順序どおりで整合 |
| Task9 → Task10 | `reg.stages`が10本になる | T10のテストが10本前提で成長曲線を計算 | 順序どおりで整合 |
| Task2 自己整合 | schema.test.ts fixture変更(minY 32→64) と registry.test.ts fixture変更 | 同一コミットで両方直す指示 | 整合 |
| Task3 自己整合 | AiState必須フィールド追加とフィクスチャ5箇所の追従 | 全箇所を計画が列挙済み | 整合 |
| Global Constraints vs 各タスク | 「描画コードにテストを書かない」 | T1のreadyGlowAlpha、T4のscroll.tsはいずれも純関数でテスト対象 | 矛盾なし |
| Global Constraints vs Task2 | schema.tsの検証エラー文はひらがな調 | T2のfailメッセージ例はひらがな調で記載済み | 矛盾なし |

**Scan結果:** 矛盾なし。ルールなしで Task 1 から実行開始。

## Tasks

Task 1: implemented by impl-task1 (haiku), commit 4376a3f.
Ruling: 計画記載の `readyGlowAlpha` 実装式 `1 - (1 - READY_GLOW_MIN) * (1 - triangle)` は
計画自身のテスト期待値（周期の頭=1.0が最も明るい／周期の半分=0.45が最も暗い）と矛盾するバグだった。
実装エージェントが `1 - (1 - READY_GLOW_MIN) * triangle` に修正し、テスト3件・全590件が通ることを確認済み。
テストが表す仕様（頭が明るい）を正とし、コード例側の誤記と判断。壊れるものは無いため軽微。
review-task1: レビュアーが数式を独立に検算し、逸脱が正しい修正であることを確認。Critical/Important無し。
Task 1: minor (deferred): src/render/effects.ts の readyGlowAlpha 実装がブリーフの式と1行異なる旨を示すインラインコメントが無い（報告書には記載済み、実害無し）
Task 1: complete (commits d6e6164..4376a3f, review clean)

Task 2: implemented by impl-task2 (sonnet), commit 2d2394f.
Ruling: ブリーフ提示の stage2.json 座標 y=496（行15）は実際には壁上（x=208/400 の列は行15で `#`）で
歩けないマスだった。実装エージェントがウォーカブル判定を検証し、代わりに y=520（行16、minY=528 より上）
を採用。「見張りが線のすぐ上・砦の手前にいる」というねらいは維持されている。座標の数値はブリーフの
コメント欄の誤り（マップ行の読み違い）であり、意図（線より上に置く）自体とは矛盾しないため許容する。
Ruling: registry.test.ts の「存在しない defId を敵の配置に書いたら弾く」テスト（ブリーフの変更対象外）が
STAGE.placement.minY 変更の副作用で落ちたため、敵位置を {80,80}→{80,48} に修正。同じ理由（新しい
minY 制約により配置検証がdefId検証より先に失敗する)による必然的な追従で、意図とは無関係な副作用。許容する。
review-task2: レビュアーが mapRows を実際に読み、y=496が壁・y=520が正解であることを座標計算で確認。
両逸脱とも正しいと検証済み。Critical/Important無し。
Task 2: minor (deferred): schema.ts の zoneMinY ガードはplacementがオブジェクトだがminYフィールド自体が
不正/欠落のケースを救済できず、minY=0にフォールバックして誤検出しうる（ブリーフ由来のコードそのまま。
現行の実アセットは全て有効なminYを持つため実害なし）
Task 2: complete (commits 4376a3f..2d2394f, review clean)

Task 3: implemented by impl-task3 (sonnet), commit cb28101. Review clean.
Task 3: minor (deferred): sim.ts の else 分岐が非chase→非chase のときも無条件で spottedAt=null を
書き込む（無害な冗長書き込み、ブリーフのコードそのまま）
Task 3: complete (commits 2d2394f..cb28101, review clean)

Task 4: implemented by impl-task4 (haiku), commit d70b03d. Review clean. No findings.
Task 4: complete (commits cb28101..d70b03d, review clean)

Ruling: Task 5 のブリーフ Step 8（ヘッドレスChromiumでの目視確認）は個別実施をスキップし、Task 12の
通し目視確認にまとめる。各タスクごとにブラウザ環境を立てるのは非効率で、Global Constraintsも各タスクで
必須としているのは npm test && npm run build のみ。もし実際に不具合があれば Task 12 で発覚し fix: で対応する。

Task 5: implemented by impl-task5 (sonnet), commit a502477. Review clean.
Task 5: minor (deferred): STAGE_LIST_VIEW内の複数指同時タッチに対するガードが盤面ドラッグと非対称
（実害小、単発操作前提のUIのため許容）
Task 5: complete (commits d70b03d..a502477, review clean)

Task 6: implemented by impl-task6 (sonnet), commit d8900b3. DONE_WITH_CONCERNS.
Ruling: gen-placeholder-sprites.mjs 実行で roran/ines/mist/gau の実アート顔画像（24〜39KB）が
プレースホルダー（573〜575B）で上書きされる既存の地雷（生成器のCHARSに実アート差し替え済みの
4キャラが残っているため）を実装者が発見。コミットには含めず `git stash push` で退避、コミット後の
`git show --stat HEAD` とファイルサイズで実アートが無傷であることを確認済み。stash内容を確認したところ
プレースホルダー上書きのみで他に価値ある変更は無く、`git stash drop` を試みたが安全フックでブロック
されたため stash@{0} を残置。実害なし（作業ツリーはクリーン、実アートは元のまま）。
Follow-up候補（このタスクのスコープ外、ユーザーへの最終報告で共有）: 生成器自体に「既存の実アート
ファイルを上書きしない」ガードを入れるか、CHARSから実アート済みの4キャラを除去する対応が望ましい。
Task 6: minor (deferred): src/engine/loader.test.ts の enemies.size 期待値を3→5に修正
（ブリーフのスコープ外だが敵def追加の直接の帰結で必須）
review-task6: レビュアーが diff/git show --stat/ls -la/git status/git stash list を独立に実行し、
実アート無傷・stash内容・作業ツリークリーンをすべて確認。Critical/Important無し。
Task 6: complete (commits a502477..d8900b3, review clean, stash@{0}残置=follow-up)

Ruling: 計画のタスク分割に内在する順序制約を発見。stage3.json の order は Task9 まで 30 のまま
残る設計（ガルム戦を最後尾へ動かすのは Task9 のStep5）だが、Task7 のブリーフは stage4=order30を
指定しており、これは既存stage3(order30)と衝突しbuildRegistryのorder重複検査で落ちる。
実装者(impl-task7)がstage4=40, stage5=50へ一時オフセットして回避した。これは正しい応急措置だが、
同じ衝突がTask8（stage6/7/8）・Task9（stage9/10）でも連鎖する。
最終形（計画のTask9記載どおり）: 1:10, 2:20, 4:30, 5:40, 6:50, 7:60, 8:70, 9:80, 10:90, 3:100。
運用方針を以下に確定する:
- Task8: stage3(30)/stage4(40)/stage5(50) と衝突しないよう、stage6=60, stage7=70, stage8=80 の
  暫定orderで追加する（ディスパッチ時に明記する）。
- Task9: (1) stage4~8 の暫定order値をすべて最終形(30,40,50,60,70)へ一括修正 → (2) stage9=80,
  stage10=90 を最終形で新規追加 → (3) stage3のorderを30→100に変更、の3段階を同一コミットで行う。
  Task9のディスパッチ時に、ブリーフのStep5（stage3のorder変更）に加えてこの一括修正が必要である旨を
  明記する。
この一連の暫定値は最終コミット時点（Task9完了時）で計画どおりの最終形に一致するため、
完了条件「ステージが10本あり、order の昇順で最後がガルム戦」は満たされる。

Task 7: implemented by impl-task7 (haiku), commit b037167. stage4=order40(暫定), stage5=order50(暫定)。
review-task7: レビュアーが座標・mapRows・registry.tsの重複検出ロジックを独立検証、order逸脱は正当と確認。
Critical/Important無し。
Task 7: complete (commits d8900b3..b037167, review clean)

Task 8: implemented by impl-task8 (haiku), commit 4ed7a4a.
Ruling適用: stage6=order60, stage7=order70, stage8=order80（暫定値、コントローラー指示どおり）。
review-task8: レビュアーが29座標すべてを独立再計算し、walkable/y<528/order非重複を確認。
Critical/Important無し。
Task 8: minor (deferred): stage6.json のtatemochi(y=224)が他座標のセル中心オフセット(+16)と異なり
セル境界そのもの（ブリーフそのまま、walkableなので実害なし）
Task 8: complete (commits b037167..4ed7a4a, review clean)

Task 9: implemented by impl-task9 (sonnet), commit 6383425.
Ruling適用: stage4~8のorderを最終形(30,40,50,60,70)へ一括修正、stage9=80/stage10=90を新規、
stage3を100へ変更。最終order集合 {10,20,30,40,50,60,70,80,90,100} を重複なく確認済み（コントローラーが
直接ファイルを読んで検証、レビュアーも独立確認）。
review-task9: 座標29点(stage9/10)を独立再計算、stage4~8の変更が1行diffのみであることを確認。
Critical/Important無し。
Task 9: minor (deferred): コミットメッセージがstage4~8のorder整合作業に触れていない（report.mdには記載済み）
Task 9: complete (commits 4ed7a4a..6383425, review clean)

Task 10: implemented by impl-task10 (sonnet), commit 5c513a4. DONE_WITH_CONCERNS.
実測S=300.5（ブリーフ見積り280前後よりやや大）→xpPerLevel=4に決定。両テスト(全通過で上限到達/
前半5ステージ未到達)がともに通過。
Ruling候補（レビューで検証予定）: xpPerLevel=12前提でハードコードされていた既存テスト4ファイル
(growth.test.ts, sim-combat.test.ts, registry.test.ts, flow.test.ts)をブリーフのスコープ外で修正。
production codeは無変更。sim-combat.test.ts の1テストをtoBe→toBeGreaterThanOrEqualに緩和
（反撃なしテスト、レベルアップhp増加+1固定と反撃ダメージが逆方向のため相殺は起きないとの主張）。
レビュアーに技術的妥当性の検証を依頼する。
review-task10 (haiku, sonnetのレート制限によりhaikuで代替): Approvedだが Important 1件
（sim-combat.test.ts の「死んだユニットに反撃されない」テストの toBe→toBeGreaterThanOrEqual 緩和が
理論上の相殺ケースを検知できなくなる、narazumonoのxpRewardが不明で独立検証できないとの指摘）。
コントローラーが検証: narazumono.xpReward=8, hitXp=1, xpPerLevel=4, hpPerLevel=1 のため、このテストの
撃破で最大2レベル程度上がり+2hp程度の増加に留まる。narazumono power=5 の反撃ダメージはこれより大きく
相殺されないため、今回の具体的数値では実害なし。ただし将来xpReward等が変わると頑健性が失われるため、
Important findingとしてfix loopに入れ、レビュアー推奨（ines.xpを事前に低くセットしてレベルアップを
防ぎtoBeに戻す）で恒久対応する。
Task 10: fix round 1/5 (1 addressed, 0 open; commits 5c513a4..cb71acc). 実装者はxpを下げる代わりに
levelを引き上げて閾値そのものを撃破xpより大きくする方式（Math.ceil((potentialGain+1)/xpPerLevel)）を
採用し、レベルアップが起きないことを明示的にアサートしたうえでtoBeの厳密比較に復元。
re-review(haiku)が数値・アサーション・テスト結果を独立検証、ADDRESSED確定。
Task 10: complete (commits 6383425..cb71acc, 1 fix round, review clean)

Task 11: implemented by impl-task11 (haiku), commit 7d7dbc9. Review clean (haiku reviewer). No findings.
Task 11: complete (commits cb71acc..7d7dbc9, review clean)

Task 12: implemented by impl-task12 (sonnet). DONE。不具合なし・コード変更なし。
review-task12 (sonnet): レポートの主張(ALERT_MARK_DURATION=2.0, READY_GLOW_PERIOD=1.0, 10ステージ2列×5行,
敵カラー3色, git log全14件)をすべて実コード・アセット・git履歴と突き合わせて検証、一致を確認。
npm test/npm run buildも実行し628テスト成功を再確認。計画の完了条件5項目すべて満たすことを確認。
Task 12: minor (deferred): 誤検出調査のピクセル値ダンプが本文に一次証拠として残っていない（会話ログのみ）
Task 12: complete (no new commits, review clean)

## ユーザー指示によりここで停止
全12タスク完了。ユーザーから「Task12まで終わったらPRを作る前に報告して止まる」との明示指示があるため、
最終whole-branch reviewとfinishing-a-development-branchは実施せず、ここでSDDループを停止する。

