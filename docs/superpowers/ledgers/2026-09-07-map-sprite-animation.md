# SDD ledger — plan: docs/superpowers/plans/2026-09-07-map-sprite-animation.md

## Pre-flight scan (2026-09-07)
- Task1→Task2 (MapSheet型の消費): 整合
- Task4→Task5 (anim.ts の骨格→状態更新): 整合
- Task6→Task7 (draw.ts の STILL 直書き→frameFor 差し替え): 整合、Task7 Step1 に明記あり
- Task8→Task9 (PNGファイル名の一致): 整合
- Global Constraints (総ひらがなの適用範囲、描画コードのテスト無し方針): 各タスク本文と整合
- 軽微な漏れ: Task9 の Files 一覧に package-lock.json の明記なし（git add 手順には含まれる）。実害なし
- 結論: 大きな矛盾なし。Task 1 から実行する

## Baseline
- npm test: 528 passed (30 files)
- npm run build: success

## Task 1
- Ruling: registry.ts の checkSprites に sprites.map.sheet の実在検証ロジックを追加していたのを、Task2実施前に revert し「mapは実在チェック対象から一旦除外(TODOコメントのみ)」に戻す — Task2の計画テキストは「checkSprites が map を文字列として素通しする」ことを前提に失敗するテストを書く手順になっており、Task1の先取り実装があるとTask2のTDDフロー(失敗確認→実装)が成立しない。functionalには等価だが、計画が要求する検証プロセスの意義が失われる — 誤っていた場合のコスト: 小さな revert-and-redo 一往復のみ、Task2で結局同等のロジックを正式実装するため実害なし
Task 1: fix round 1/5 (1 addressed, 0 open — registry.ts の Task2先取りロジックを削除; commits d38fb17..4ded809)
Task 1: complete (commits e352e8f..4ded809, review clean after 1 fix round)

## Task 2
Task 2: minor (deferred): task-2-report.md の「9行追加」表記が実際の18行と食い違う(report.md:32)。コード自体には影響なし
Task 2: complete (commits 4ded809..7f1fe20, review clean)

## Task 3
Task 3: minor (deferred): 必殺技実行時に attack イベントが出ないことを明示的に検証するテストがない(構造的には保証されているが将来のリファクタで壊れうる)
Task 3: complete (commits 7f1fe20..178e6e0, review clean)

## Task 4
Task 4: minor (deferred): MOVE_EPS の境界(dx=0.01ちょうど)が未テスト。仕様上の要求でもない
Task 4: complete (commits 178e6e0..89fdc66, review clean)

## Task 5
Task 5: minor (deferred): noteAttacks が lastPos を更新しない(ブリーフ通りの挙動、Task7配線時の潜在的な考慮点)
Task 5: complete (commits 89fdc66..c55c31d, review clean)

## Task 6
Task 6: complete (commits c55c31d..b4c366e, review clean)

## Task 7
Task 7: minor (deferred): attackDuration の fps=0除算対策なし(ブリーフ通り、schema側でfps min:1を強制しているため実害なし)
Task 7: complete (commits b4c366e..991d670, review clean)

## Task 8
Task 8: minor (deferred): task-8-report.md の「328行」表記が実際の224行と食い違う。コード自体には影響なし
Task 8: complete (commits 991d670..6b10aca, review clean)

## Task 9
Task 9: complete (commits 6b10aca..71a2b72, review clean)

## Task 10
Task 10: fix round pending — チェックポイント2(歩行→待機の復帰)とチェックポイント3(攻撃モーションが1回で止まる)がスクリーンショットでの直接確認ではなくコード・テストからの推測になっている(task-10-report.md 33-34,40)。連続スクリーンショットでの再確認を依頼
Task 10: fix round 1/5 (2 addressed, 0 open — チェックポイント2は完全確認、チェックポイント3は静止→変化→静止の遷移を確認、コマ単位の切り分けのみ未確認; commits 8cce2c3 変更なし)
Task 10: parked — 攻撃3コマの個々のコマ単位のスクリーンショット確認は技術的制約(吹き出しの遮蔽・250msの短さ・ヒットエフェクトとの重なり)で不可 — Ruling: モーションが1回で停止し元の静止姿勢に戻ることは連続キャプチャで確認済みであり、コマ単位の切り分けは anim.ts のロジックとanim.test.tsのテストで担保されているため、これ以上のfix roundは不要と判断し deferred として記録する。誤っていた場合のコスト: 実機での視覚的な完全証拠が無いだけで、コードとテストによる担保は健在なので実害は小さい
Task 10: complete (commits 71a2b72..8cce2c3, review clean after 1 fix round)

## All 10 tasks complete. Proceeding to final whole-branch review.

## Final whole-branch review
Ready to merge: With fixes (Critical 0, Important 1, Minor 8)

Ruling: fix wave のスコープを次に絞る — Ruling: 計画のTask7は UNIT_R→half の移行対象を「はた・選択リング・ふんばり・ねらいうち・HPバー」の6箇所と明示的に列挙しており、drawEffects(ダメージ/回復数値・被弾/回復/撃破/絆リング)は計画のFiles一覧にもInterfacesにも含まれていない。従って厳密には「計画の要求漏れ」ではなく計画のスコープ外だったクロスタスクの副作用。ただし視覚的な実害(Garumの48pxスプライトでHPバーとダメージ数値が重なる)は実在するため、レビュアー提案の安価な応急処置(EFFECT_R定数へ差し替え)のみ採用し、Effect構造体にhalfを持たせる本格対応は別チケットとする。誤っていた場合のコスト: Garum戦のダメージ数値がなお僅かにHPバーへ寄る可能性が残るのみで機能的な実害はない
Ruling: 以下は fix wave に含めず ledger に park する
  - Minor#3(戦闘開始時に味方の初期向きが下向き→上向きへ切り替わる): 意図的な仕様か未確定の見た目の一貫性の問題であり、バグではない。Ruling: 現状維持。誤っていた場合のコスト: 見た目の些細な違和感のみ
  - Minor#6(tsconfig の types:node がsrc全体に適用されbrowser codeでもprocess/Bufferが型チェックを通ってしまう): レビュアー自身が「複雑化に見合わない」と判定。Ruling: 現状維持
  - Minor#7(package.jsonのengines整形・sim-combat.test.tsの末尾空行というnpm install起因の些細な差分): 実害なし。Ruling: 現状維持
  - Minor#8(drawUnitsとdrawMapUnit双方でsheet===nullを判定する二重チェック): レビュアー自身が「3つ目の分岐が増えない限り変更不要」と判定。Ruling: 現状維持
  - レビュアー推奨のGarum戦での実機スクショ確認: 計画本文で明示的に任意("ガルムのいるステージまで進めれば...のも見える")とされている。Ruling: 別セッションでの追加確認に委ね、今回のfix waveには含めない

## Final review fix wave
Final review: fix round 1/1 (5 addressed, 0 open; commits 8cce2c3..0e462d6)
Final review: complete (all 10 tasks + final fix wave clean)
