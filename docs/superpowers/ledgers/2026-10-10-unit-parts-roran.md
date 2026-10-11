# SDD ledger — plan: docs/superpowers/plans/2026-10-10-unit-parts-roran.md

- 計画を書いた（2026-10-10）。依頼者が中身と全体の順（A〜G、この計画は A）を確認し、実行は Native（Claude が全部実装し、最後に別のレビュアーが1回見る）。作業は次のセッションから
- BASE（計画を始める時点の HEAD）: 70f94b3a0f7dfbc0d12c20486c6ad7bd770af694
- Spec: docs/superpowers/specs/2026-10-09-unit-layer-parts-design.md、docs/superpowers/specs/2026-10-04-unit-drawing-workflow-design.md。この計画で変えた方針は計画の「決めたこと」

## 引き継ぎ（2026-10-10・次のセッション用）

- 作業ツリーには、まだコミットしていない変更がある（前の計画 2026-10-09-unit-tools-maintenance の Task 1 の途中まで）。Task 1 で整理してコミットする。どれを残しどれを外すかは計画の Task 1 に書いてある
  - 変更したファイル: pixel-asset-forge/CLAUDE.md、cand/gen/{cut_layers,layers,mklayers,mkweapons,roran_layers}.py、tests/{test_cut_layers,test_hand_outline,test_layers,test_weapon_check}.py、tools/{hand_outline,weapon_check}.py
  - 新しいファイル（未追跡）: docs/superpowers/plans/2026-10-09-unit-tools-maintenance.md（中止した前の計画）、docs/superpowers/plans/2026-10-10-unit-parts-roran.md（この計画）
  - この時点で全体テスト 383/383 通過
- 前の計画の台帳: .superpowers/sdd/2026-10-09-unit-tools-maintenance/progress.md（Task 1 Step 5 で docs/superpowers/ledgers/ へ写す）
- build/hand_rule_preview.html（Artifact HvKLbhCiXKnZ32pbnaJ4pM）は当てにならない。手の色に首の skin_rose_deep を入れて作ったため、顔が首とつながって大きな塊になり、うなじ・横顔を囲う誤りが見えていなかった。使わない
- build/table_roran.html（Artifact UNaMxpHYfHUzSJQwsXRj93）は、up を盾が一番奥に直した表と、破れの検査の赤枠を出している

## この計画の前に分かっていること（2026-10-10）

- ロランの今の絵の欠け（Task 7〜10 で直す）:
  - left 全6コマ: 手前の拳 (11,20)(11,21) が盾の右の輪郭の上に描かれ、盾より手前に見える（依頼者の指摘）。盾が一番手前なので、拳は盾に隠れる
  - up 全6コマ: 盾の金属 (8,20)(8,21) が盾を持つ拳に直に接し、拳の左・上・下の黒枠が無い（依頼者の指摘。盾が一番奥なので拳の黒枠は見える）
  - right の base・idle2・walk_a・walk_b: 剣の鍔の右端 (12,17)（idle2 は (12,15)）に輪郭が無く、体の服 (13,17) に直に接する（破れの検査で見つけた。拳と同じ種類の欠け）
- 「12画素以下の肌の塊を拳とみなす」決め方は、うなじ・横顔・後ろ姿の首も拾う。塗る画素のうち頭の肌の周りが、ロラン 252/324、spear-thug 60/81、dagger-thug 60/83。この計画では拳を部品の名前（"hand": true）で決めるので使わない。hand_outline.py は拳の部品のファイルにだけ使う
- 破れの検査（cut_layers.torn）の決め方は、誤検出を数えて選んだ。「奥の層が手前の層に輪郭なしで接する」は帽子と額・髪と顔・柄と拳など数百か所を拾って不採用。今の決め方（部品の箱の中で、部品に挟まれた所が奥の1つの層だけ／奥の層の色が部品の面に直に接する）はロラン24コマで上の3件（16コマ）だけを拾う
- ガウの compose/gau.json は、今の assets/unit/gau の16コマと全部「差あり」（部品で組んだ後に手で直してある）。Task 2 の「出力が変わらない」は、今の compose.py の出力どうしを比べる（assets/unit/gau とは比べない）

## 進捗（2026-10-10・Native 実行）

- Task 1 完了: 4fe1eb1、5b932fe（全体テスト 376 件）
- Task 2 完了: 68f9291（ガウの compose 出力は前後で diff なし）
- Task 3 完了: 55ccd5d（keep・hand・hand_colours。FrameSpec に hand_colours を持たせ、load_config の戻り値は変えていない。全体 391 件）
- Task 4 完了: 4231428（移す前後で mklayers --check の出力が同じ、全体 391 件）
- Finding: 計画の Task 4 Step 1 は「mklayers --check で試作の2体が ok」を期待したが、Task 1 の KEEP への切り替え（close_hands が袖の上にも輪郭を描く）で、cand/layer-trial/ の書き出し済みコマが古くなり FAIL 23 件（axe-horn ほか）。移す前から同じ。試作の絵は作り直さない決まりなので触らない。敵を部品で組み直す計画 D で、試作ごと置き換わる → ISSUES.md に1行立てる（Task 11）
- Task 6 完了: roran_layers.export と --export。書き出した80ファイル（芯24・部品56）+ compose/roran.json。24コマすべて「今の絵と違う画素 0」、閉じていない拳の画素 133（Task 7〜10 で描き足す所）、compose.py --check は拳が閉じていないので終了 2（正しい）
- Ruling: tests/test_roran_export.py は生きているロランの絵を読む（CLAUDE.md「回帰テストに現役のアートを参照させない」に反する）ので、Task 6 の確認（4件OK）に使った後、コミット前に消した。書き出しは描き直し前に一度だけ使う道具なので回帰テストを持たない
- Task 7 完了: 65d1660（down）。Task 8 完了: c81ea7a（up）。Task 9 完了: 280fd4f（left、盾の拳は盾に半分入れる）。Task 10 完了: 15b589b（right、down/right に盾の拳の層を追加。down の拳は盾に完全に隠れる位置 x20-24、合成結果は従来と同一）
- 依頼者の指摘の共通化: SPEC「部品で組む規約」に5点（奥→手前の言い方、両手の拳の層を常に持つ、隠れる拳は隠す物の内側、部品は完全な単品、形・奥行きを先に合わせる）
- Task 11: README・SPEC・CLAUDE.md・ISSUES.md を更新
