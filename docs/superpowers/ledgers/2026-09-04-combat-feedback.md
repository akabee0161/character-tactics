# SDD ledger — plan: docs/superpowers/plans/2026-09-04-combat-feedback.md

## Global Constraints (from plan + spec)
- `src/core/**` と `src/engine/**` は `window` / `document` / `localStorage` を参照しない
- データ（JSON）と振る舞い（コード）の線引きを崩さない
- 効果音・画面シェイクはスコープ外
- `draw.ts` / `screens.ts` の実描画はユニットテスト対象外（既存パターン踏襲、手動確認のみ）
- 各タスクは前タスクが残した正確なコード片を前提にfind/replaceする形で書かれているため、
  タスクの実施順序は厳守する（並列実行不可）

## Pre-flight conflict scan

| 対象ペア | 共有ファイル/インターフェース | 生成 → 消費 | 所見 |
|---|---|---|---|
| Task1 → Task2 | `Unit.skillCooldownUntil` | Task1 core層で定義 → Task2 main.ts/screens.tsで参照 | 整合。Task1完了時点でmain.ts/screens.tsに型エラーが残るのは計画上明記された想定内の中間状態 |
| Task1 → Task3 | `src/core/skills.ts`（`useSkill`） | Task1が`skillCooldownUntil`代入を追加 → Task3が同関数に`fromPos`/`toPos`収集を追加 | Task3のfind文字列はTask1が残した最終形と一致。整合 |
| Task3 → Task4 | `SimEvent`（`hit`/`heal`/`skill`/`unitDefeated`/`bondSupport`） | Task3が型とイベント発行を拡張 → Task4がその型を前提に`spawnEffects`を書く | 整合 |
| Task4 → Task5 → Task6 → Task7 → Task8 | `src/render/effects.ts`（`Effect` union, `spawnEffects`, `EffectState`）／`src/render/draw.ts`（`drawEffects`のimportとswitch） | 各タスクが前タスクの出力を正確にfind/replace | 全タスクを通読し、各Stepのfind対象コードが直前タスクのreplace結果と一致することを確認済み。矛盾なし |
| Task2 vs Task4/Task8 | `src/main.ts` | Task2は`:147`のタップ判定のみ変更、Task4/8はimportと`spawnEffects`呼び出し／`update`関数を変更 | 別箇所のため衝突なし |
| Task4 → Task8 | `EffectState`型（`items`のみ → `items`+`knockback`+`displayedHp`） | Task8 Step8で、Task4が書いた`tickEffects`の既存テスト2箇所を新フィールド込みに直すことを明記 | 計画側で後方互換の破壊を認識し、修正ステップを用意済み。整合 |
| Task6 | `src/core/skills.ts`（`omajinai`） | Task1/Task3で変更されたskills.tsに対し、Task6がomajinai本体を書き換え | Task6のfind対象はTask1/Task3のいずれも触れていない既存のomajinaiブロックそのもの。整合 |

**スキャン結果:** クリーン。タスク間で衝突する変更は見つからなかった。全タスクを事前に通読し、各find/replace対象が直前タスクの出力と一致することを確認済み。

## Worktree判断
ユーザーのグローバル方針（既存チェックアウトで作業をデフォルトとする）に従い、mainではなく
既に`feature/combat-feedback`ブランチにいる現在のワーキングツリーで直接実装する。
新規worktreeは作成しない。既存の`.claude/worktrees/character-tactics-impl`
（`worktree-character-tactics-impl`ブランチ）は本プランと無関係のため触れない。

## Progress

Task 1: complete (commits e71a200..03d9df2, review clean)
Task 2: minor (deferred): src/ui/screens.ts:157 drawSkillButtonにskillId===nullガードが無い。Task1以前からの既存挙動でTask2の新規混入ではない。
Task 2: complete (commits 03d9df2..2aad930, review clean)
Task 3: minor (deferred): src/core/sim.ts resolveAttacks/kakenukeruが発行するhitイベントの新フィールド(sourceUid/sourceDefId/attackKind/sourcePos/neraiuchi)を値レベルで検証するテストが無い。既存ローカル変数のコピーであり新規ロジックではないため低リスク。Task4以降でeffects.test.tsが間接的に使う値なので様子見。
Task 3: complete (commits 2aad930..4ee35a9, review clean)
Task 4: minor (deferred): src/render/draw.ts damageText/healTextの上昇フェードロジックが重複気味。Task5-8でさらにバリアントが増えたら共通ヘルパー抽出を検討。/ tickEffectsのttl===0境界テストが無い(既存パターン踏襲)。
Task 4: complete (commits 4ee35a9..d1b2ca8, review clean)
Task 5: Ruling: ブリーフのdraw.ts diffはswitch文の前で`const p = mapToLogical(e.pos)`を1回だけ計算する前提だったが、`attackLine`バリアント(pos無し、from/toのみ)を追加すると判別可能Union型のnarrowing前に`e.pos`へアクセスすることになりTypeScriptの型エラーになる — プラン記載どおりでは実装不可能というプランの欠陥。実装者がpの計算をhit/damageText/healTextの各case内に個別移動する修正を行い、レビューで必要かつ正しい変更と確認済み(diff/挙動に問題なし)。**Task6-8でも同じパターン(mapToLogicalの計算をswitch文前ではなく各case内で行う)を踏襲すること** — 各タスクのブリーフ文言がswitch外でのpos計算を前提にしていても、実際のコードは既にcase内計算になっている点に注意。
Task 5: minor (deferred): task-5-report.mdの逸脱理由の記述が「型安全性向上」とやや曖昧。実質は「ブリーフ通りだとコンパイルエラーになるための必須修正」。実害なし。
Task 5: complete (commits d1b2ca8..3e3d58b, review clean, 1 ruling above)
Task 6: minor (deferred): skills.test.tsに「最大HP到達済みでhealイベントが出ない」ガードを直接検証するテストが無い。既存の回復量上限テストはhpのみ検証しs.eventsを見ていない。
Task 6: complete (commits 3e3d58b..20e376b, review clean, Task5申し送り通りに構造反映確認済み)
Task 7: minor (deferred): effects.ts skillCastの`skillId`がリテラルUnionでなく`string`型。draw.ts側のif/elseタイポがサイレントに無描画になりうる。ブリーフ指定通りのため必須修正ではない。/ omajinaiのskillCastはfunbaru/neraiuchi以外なので現状無描画のまま(ブリーフの意図的仕様、将来omajinai固有演出を足す際の申し送り)。
Task 7: complete (commits 20e376b..4a02376, review clean, Task5申し送り通りに構造反映確認済み)
Task 8: fix round 1/5 (1 addressed, 0 open — syncDisplayedHpの状態遷移テスト欠如; commits 42f39a9..9077ab6)
Task 8: minor (deferred): 撃破時の個体単位でのdisplayedHp/knockbackクリーンアップは実質ステージ跨ぎでのみ機能する設計(実害なし)。/ 同一tick内で同一uidに複数hitが発生した場合ノックバックが後勝ちで上書きされる(意図的仕様として許容)。
Task 8: complete (commits 4a02376..9077ab6, review clean after 1 fix round)

## Final whole-branch review (base e2c4443, head 9077ab6, most capable model)
Ready to merge: With fixes.
Important findings:
- I-1: beginStageがeffects.knockback/displayedHpをクリアせず、敗北→リトライ等のステージ跨ぎでHPバーが前ステージの値を引き継ぐ実害あるバグ。台帳Task8 deferred #8の「実害なし」判断は最終レビューで誤りと再評価された。
- I-2: drawEffectsのswitchに網羅性チェックが無く、Effect Union追加漏れ・skillIdタイポがサイレント無描画になるリスク(omajinaiで既に発生中、意図的仕様として許容済み)。
Minor(M-1〜M-9、台帳deferredの再評価含む): 詳細は最終レビューエージェントの出力に記録。M-1(かけぬけるの火花演出が未実装、静かな取りこぼし)は別途follow-up判断が必要。M-2/M-3/M-5/M-6/M-7/M-8/M-9はマージ後で可。
Final review fix wave: complete (commits 9077ab6..197af87, re-review clean, I-1/I-2ともADDRESSED)
Final review fix wave: Ruling: I-2のskillCast.skillIdリテラルUnion化は見送り — SimEvent.skillIdがstring型でありspawnEffects内の代入でTS2322になるため。exhaustivenessチェック(default節)のみで必要な安全性は確保されており、シム層まで型を広げる必要は無いという再レビュー判定を採用。
Final review: Ruling: M-1(かけぬけるのヒット時火花演出、設計書§2-12/§7が要求)は本ブランチのスコープに含めず、follow-up課題として次の作業に送る — 理由: 最終レビューのfix waveは「1回のみ」の原則があり、これは新規のビジュアル追加であって指摘されたバグの修正ではないため、ここでスコープを広げるべきではない。ユーザーへの最終報告でfollow-up候補として明示する。
Final review: parked (no action, ruling stands): M-2(味方撃破エフェクトが敵専用、設計書の記述と実装は整合、対称性のみの話)、M-3(ポートレートHPバーがdisplayedHpを使わない、設計書もdrawUnitsのみ言及なので実装はプラン準拠)、M-5(drawEffectsの描画重複、リファクタ候補として次回検討)、M-6(テストがユニットのライブ参照で座標比較、kakenukeru系スキルに広げる際は要注意)、M-7(hitイベント新フィールドの値レベルテスト不足、低リスク)、M-8(drawSkillButtonのskillId===nullガード欠如、現ロスターで実害ゼロ)。
Final review: complete (branch ready to merge, all Important findings fixed, Minor findings parked with rulings above)
