# SDD ledger — plan: docs/superpowers/plans/2026-10-02-roran-sword-from-icon.md

Executor: native (executing-plans). 依頼者のルール: ★の段階と、計画の不備では止まって報告する（skill の "rulings, not stalls" より優先）。
Pre-flight: Task1→2,3（G H J R の文字と # map: 行の形 `# map: G=.. H=..`）、Task2→3（選ばれた割り当て）、Task2→4（variants.py tips）、Task3/4→5（24コマ）。食い違いなし。
Task 1: complete (commits e4e17cb..d6e7f26, tests: .venv/bin/python ../.superpowers/sdd/2026-10-02-roran-sword-from-icon/check_parts.py → OK)
Task 2: 依頼者が V1 を選んだ（G=wood_hi H=wood_base J=wood_shadow R=roof_base）。依頼者には V1〜V3 の差が小さく見えた（違いは鍔の左端1画素と柄頭1画素の明るさだけ）
Task 3: complete (commits d6e7f26..5ee537e, tests: .venv/bin/python ../.superpowers/sdd/2026-10-02-roran-sword-from-icon/diff_pixels.py d6e7f26 → OK)
Task 4: 依頼者の判断で切っ先は T0（平らのまま）。理由: 白い刃は長方形でも、上の輪郭2画素で先がある程度尖って見える。最初の24倍の拡大は全体が見えないと言われ、10倍のコマ全体（tips_full.png）で判断された
Task 4: complete (no commits — 試しの画像だけ)
Task 5: ゲームの撮影では選択の輪・旗が重なり剣が読めなかった。依頼者の希望でアニメのページ（使い捨て、make_anim_page.py + anim_template.html）を作り Artifact に出した: https://claude.ai/artifact/QADTgozjh3h7dWko1xXdsZ 。確認手順の見直し（ゲームを動かす代わりにページ・静止画で済ませる）は HANDOVER の Claude の気付きに書く（依頼者合意）
Task 5: complete (commit 3fa39b5, tests: npm test → 776 passed, npm run build → ok。依頼者がページで確認して OK)
Task 6: Ruling（依頼者の承認済み）: アニメのページの道具をゲーム側 tools/anim-page.py・anim-page.html にコミットし README に1節足す — 依頼者が今後もこの見せ方を採用したいと言ったため。forge の tools/ は触らない — 外れたら: 道具1つ分の範囲の広がり
Task 6: complete (commit 76e5b9f。規約の専用文字は依頼者 Yes。SPEC の鍔の幅を実測に合わせて直した（右向きも4px））
Final: review by code-reviewer (opus) — Critical 0 / Important 0 / Minor 5
Final: Ruling: Minor2（doctype・charset 無し）を Important に格上げ — README が「ブラウザでそのまま開ける」と案内しており日本語が化ける余地 — 外れたら: 2行の変更
Final: Ruling: Minor3（タブ名がロラン固定）を Important に格上げ — 5番目でほかのユニットのページを作るとすぐ誤る — 外れたら: 2行の変更
Final: fixed charset と document.title — out/anim/gau.html の grep 0→1 RED→GREEN、npm test 776/776（commit 1c8f4d6）
Final: minor (deferred): anim-page.py のエラー処理（JSON が無い・壊れている、キー欠け、目印の置き換え失敗を黙って通す、メッセージが原因を取り違える）
Final: minor (deferred): 足元の線が frame=32 前提で y=30 固定
Final: minor (deferred): unit/SPEC.md の柄頭の記述に left_atk_hit（柄頭なし）の例外が無い
Final: Ruling: 作業フォルダ（.superpowers/sdd/2026-10-02-roran-sword-from-icon/）は消さずに残す — HANDOVER.md が台帳のパスを指し、公開したページの元ファイルもここにある。これまでの計画の作業フォルダも残している — 外れたら: git 管理外のファイルが少し残るだけ
Final: push 済み、PR #26 作成 https://github.com/akabee0161/character-tactics/pull/26 （2026-10-03）
CodeRabbit PR#26: 4件（reduced-motion・innerHTML・シートのパス・script への埋め込み）すべて正しいと確認、RED→GREEN（cr/ の細工した JSON と check_page.mjs）、commit a26aa21、npm test 776
Final: PR #26 をマージ（merge commit 9e7b421、2026-10-03）。手元の main も合わせた
