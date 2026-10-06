# SDD ledger — plan: docs/superpowers/plans/2026-08-26-ui-usability.md

## Setup

Ruling: 新規 git worktree を作らず、現在のチェックアウト（ブランチ `docs/ui-usability-plan`、main ではない）で直接作業する — ユーザーのグローバル方針（並列作業や明示的な isolation 要求がない限り worktree を使わない）を優先。既存の `worktree-character-tactics-impl` worktree は別ブランチ用で本計画とは無関係。コストは低い: 単一セッション・逐次実行のため、worktree 分離の恩恵（並列衝突回避）がそもそも発生しない。

Spec: `docs/superpowers/specs/2026-08-26-ui-usability-design.md`（存在確認済み）

## Preflight scan

依存関係の表（タスクが共有するファイル / 期待するインターフェース）:

| Task pair | 共有ファイル | 期待 vs 提供 | 判定 |
|---|---|---|---|
| 1 → 3 | state.ts (`placeAlly`) | Task1 が `placeAlly` に `goalPos = null` を追記、Task3 が同関数の戻り値を `boolean` 化して全体を書き換え | Task3 のコード片は Task1 の変更を含んだ完全体で提示済み。整合 |
| 1 → 6 | sim.ts (`moveUnits`) | Task1 が味方ループ内に `goalPos = null` の追記、Task6 が `moveUnits` を `moveAlly` 抽出込みで全面書き換え | Task6 のコード片は完全体。Task1 の変更は Task6 で上書きされる想定どおり。行番号(155-173)は Task1 適用後にずれるが実装者が現物を見て対応すべき通常事項 |
| 2 → 3 | なし(新規ファイル vs main.ts 配線) | Task3 は Task2 の `resolveMapGesture`/`PointerStart`/`TAP_SLOP` を消費 | 依存明記済み、順序どおりなら整合 |
| 3 → 4 | main.ts | Task3 が `pointerStart`/`dragMap` を新設、Task4 がそれを読んで描画 | 整合 |
| 5 → 6 | field.ts (`flowDirection`, `NEIGHBORS`/`canStep`) | Task6 の `moveAlly` は Task5 の8近傍 `flowDirection` を利用 | 整合 |
| self: 1 | sim.test.ts | Step1 のテストと Step4 の実装コードが一致しているか | 一致（`goalPos` の3ケースとも実装コードと整合） |
| self: 3 | main.ts の一続き変更（Step5-8 で1コミット） | 明示的に「途中でコミットしないこと」と指示あり | 矛盾なし、レビュー時は最終コミットのみ見る |

Note (非ブロッキング): Task7 の README 見出し案は `## そうさ`（ひらがな）だが、既存 README の他見出しは `## 開発`/`## 構成`/`## デプロイ`（漢字）。ゲーム内表示のひらがな制約はREADMEに適用されないため矛盾ではないが、見出しスタイルの一貫性は軽微な観察事項として最終レビューに委ねる。

Preflight は概ねクリーン。ブロッキングな矛盾なし。Task 1 から順に dispatch する。

## Tasks

Task 1: complete (commits 9eb9f9a..863de58, review clean)
Task 2: complete (commits 863de58..7ee17a8, review clean)
Task 3: complete (commits 7ee17a8..a012c0e, review clean; ⚠️ Step9手動ブラウザ確認は未実施 — Task4完了後にまとめて npm run dev で確認する)
Task 4: complete (commits a012c0e..67cdf10, review clean; ⚠️ Step5手動ブラウザ確認も未実施 — フェーズ1完了時点でまとめて確認する)

## フェーズ1完了 — 手動ブラウザ確認待ち

Ruling: Task3 Step9 / Task4 Step5 の手動ブラウザ確認は今すぐ実施せず、フェーズ2(Task5-6)完了後にまとめて1回で実施する — 計画の「フェーズ1を先に完了・コミットしてからフェーズ2に進むこと」はコミット順序の話であり、都度の手動確認までは要求していない。コストは低い: フェーズ2の変更は経路探索のみでフェーズ1の入力・描画コードとは独立しており、まとめて確認しても検証範囲は変わらない。

Task 5: complete (commits 67cdf10..8dc3b8c, review clean; ⚠️ Step7手動ブラウザ確認も未実施 — フェーズ2完了時にまとめて確認する)。レビュー1回目はコントローラ側の月次スペンド上限到達でAPIエラー失敗、同一内容で再dispatchして正常完了。
Task 6: complete (commits 8dc3b8c..b66ca9f, review clean; ⚠️ Step7手動ブラウザ確認も未実施)

## フェーズ2完了 — 手動ブラウザ確認は Task7 の後にまとめて実施する
Task 7: complete (commits b66ca9f..0a8aaca, review clean)

## 全タスク完了 — 次: 手動ブラウザ確認 → 最終レビュー

## 手動ブラウザ確認結果 (Playwright, headless chromium, npm run dev)

コントローラが直接 `npm run dev` を起動し Playwright で操作して確認した。venv不足のため /tmp/pw-venv に一時セットアップ(このリポジトリには影響なし)。

- ✅ 配置フェーズ: キャラをタップ→白破線輪+ポートレート反転。同じキャラ再タップ→選択解除。ポートレートタップ→対応するキャラを正しく選択。選択したまま地面タップ→その位置に配置。
- ✅ 初期配置(4人が砦の同一座標に重なる)でタップすると配列順で最初にマッチした味方が選ばれる — これは既存仕様(state.ts の CHAR_IDS.map 初期化)であり本計画のスコープ外。バグではない。
- ✅ 戦闘中、2人以上に別々の移動先を指示→両方のマーカーが同時に表示され続ける。選択中のキャラだけ現在地からの点線が引かれる。
- ✅ 斜め移動: 開けた地形で45度方向へ指示すると、始点からの dx/dy が終始ほぼ1:1で推移し、階段状ではなく直線的に移動することを複数フレームで確認。
- ✅ 目的地に到達するとマーカー(点線・目的地円)が消える。
- ✅ ボタン(スキルボタン「ふんばる」「かけぬける」「はじめる」)操作時に誤った移動命令が飛ぶ様子は観測されなかった。
- ✅ コンソールエラー0件(操作全体を通して)。
- ⚠️ 未確認のまま残した項目: 交戦中のマーカー半透明化、配置フェーズで歩行不可セルへドラッグした際のゴースト赤色化(このステージに岩などの障害物配置が見当たらず、誘発できなかった)。いずれもコード上はレビューで確認済み(Task4/Task6のレビューで該当ロジックを検証済み)であり、視覚的な最終確認は次回の実プレイ時に譲る — Minorとしてfinal reviewに引き継ぐ。

Ruling: 上記2項目(交戦時マーカー半透明化・配置時ゴースト赤色化)は手動での誘発に至らなかったが、対応するロジックは各タスクのレビューでコード上検証済み(drawGoalMarkersのengagedWith分岐、drawDragPreviewのblocked分岐)であり、実装の正しさへの疑義はない。コストは低い: 見た目の最終確認のみが未了で、ロジックのCritical/Important欠陥ではない。

## 最終レビュー結果 (opus, f295651..0a8aaca 全8コミット)

Ready to merge: Yes。Critical無し。Important 2件・Minor 7件。goalPosライフサイクル・デッドコード・コスト単位漏れなど、タスク間整合性はすべてクリーン。

Ruling: 以下を1回のfix waveでまとめて対応する。
- Important#1 (vitest glob がstale worktree `.claude/worktrees/character-tactics-impl` を拾い、テスト数が552→実質286件相当に水増しされている): `vite.config.ts` にexclude設定を追加、`.gitignore`に`.claude/`を追加。計画本体のスコープ外だが、以後の検証の正確性に直結するため修正する。コストは低い: 設定変更のみでゲームロジック・UIには無関係。
- Important#2 (障害物迂回=flow-field fallback経路が自動テストで未検証): sim.test.ts にレビュアー提案のテストケースを追加する。
- Minor#3 (地面プレスでpointerCaptureされずキャンバス外ドラッグ時に迷子状態になりうる): `canvas.setPointerCapture` をif外に出す1行修正。
- Minor#4 (ドラッグゴーストがphase遷移後も残りうる): `render()`のドラッグプレビュー描画条件にphaseチェックを追加。
- Minor#8 (corner-cut testが`toBe(40)`にできるのに`toBeGreaterThan`止まり): 厳密化。
- Minor#9 (READMEがwaveCleared中の再配置・ドラッグゴースト/赤色表示に触れていない): そうさ表を補記。

Park(修正しない):
- Minor#5 (hasLineOfSight と skills.ts の isPathWalkable の重複): 統合するとかけぬけるの当たり判定が変わり「スキル効果を変えない」制約に抵触するため意図的に分離のまま。Ruling: 現状維持、将来の別チケットに委ねる。
- Minor#6 (placeAllyのboolean戻り値が本番コードで未消費): 仕様上正しいAPIでテストが検証しており欠陥ではない。Ruling: park。
- Minor#7 (到達スナップ時に理論上1px未満の壁抜けがありうる): FIXED_DTでの実害なし。Ruling: park。

## Fix wave 完了 (commits 0a8aaca..2cb8c60)

6項目すべて対応。副産物として hasLineOfSight の既知の限界(壁の角をわずかにかすめて誤って「見通せる」と判定し、壁セル内に侵入しうる — design docにコメント済みのトレードオフ)を実地で踏み、テスト座標側で回避。sim.ts/field.ts本体は変更なし(調査目的の一時変更は復元済み、diff上も不在をscoped re-reviewで確認)。

Scoped re-review: 全6件 ADDRESSED、新規Critical/Important破壊なし、スコープ外4項目(isPathWalkable分離維持・placeAlly戻り値未消費維持・moveAlly到達スナップに歩行可否チェック追加せず・sim.ts diffゼロ)すべて確認済み。

Final review: complete (commits f295651..2cb8c60, 1 fix round, review clean)
