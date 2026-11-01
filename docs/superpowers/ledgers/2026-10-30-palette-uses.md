# SDD ledger — plan: docs/superpowers/plans/2026-10-30-palette-uses.md

Spec: docs/superpowers/specs/2026-10-30-palette-uses-design.md
Branch: chore/palette-uses（main cb6e540 から。設計書 287866d）
Executor: 未選択（依頼者のレビュー待ち）

## 経緯
- 10-29〜30 依頼者: D 敵1回目 Task 4 の確認で落ちた3件（武器の取り違え・装飾品と髪の縁・目）から、パレットの作り直しに。範囲は unit・tile・face・item すべて
- feat/enemy-rebuild-1 の未コミットの変更は git stash（enemy-rebuild-1 Task 4 途中（パレット作り直し待ち。10-30））に退避。台帳 .superpowers/sdd/2026-10-27-enemy-rebuild-1/progress.md

## 実行方式（10-30）
- 依頼者: 計画のレビューは問題なし。Claude の気付き2点（派生ファイルの型・色替えの警告を値で数える）を足してよい → 3f396da で計画に追記
- Executor: Subagent-driven（依頼者 10-30）
- Ruling: 台帳はこのファイル（依頼者・計画が指す場所）に置き、スクリプトが出す .superpowers/sdd/2026-10-30-palette-uses-plans/ は brief・report・review package の置き場にだけ使う — 計画とメモリーがこの場所を指しているため — 誤りでも置き場が2つになるだけ

## 事前の照合（pre-flight）
| 対 | 生む → 使う | 結果 |
|---|---|---|
| T1→T3,T4,T5,T6,T7,T8 | palette.load / Palette の API | 整合 |
| T2→T3,T4 | 対応表の形・migrate CLI | 整合。T2 の既定対象は validate の対象＋tests/fixtures、T5 の validate は fixtures を見ない（矛盾なし） |
| T3→T4 | 3つのファイル＋migration.json | 整合。T3 は依頼者の承認で止まる（依頼者の指示。スキルの連続実行より優先） |
| T4→T6 | checks/compose に名前で書いた色 → T6 で種類へ | 整合 |
| T4 Step 8 ↔ T6/T7/T8 の「前と同じ」 | before/rules_*.txt | 色の名前が変わるので、T6〜T8 でも対応表で読み替えて比べる（Ruling 1） |
| T6 keep の種類化 ↔ 見た目を変えない | 今の keep は種類の一部の色だけ（例 wood_base のみ、water_base を含む） | 種類で広げると、組んだコマが変わるおそれ。compose --check で検出（Ruling 2） |
| T5 ↔ T3 | 武器・盾の決まり ↔ 種類の割り当て | 整合。T5 で落ちたら T3 の割り当てか決まりを直す（例外なし） |
| 各タスク内 | テストと実装・作るファイルと触るファイル | T1・T2・T5・T7・T8・T9 自己矛盾なし。T4: Step 2 に test_recolor_merge_warning_counts_values を足す（3f396da）。T6: tests/test_weapon_check.py は既存 |
- Ruling 1: T6〜T8 の「前と同じ」は、T4 Step 8 と同じく対応表で名前を読み替えて比べる — 名前が変わるのは移し替えの意図どおり — 誤りなら比較をやり直すだけ
- Ruling 2: T6 で keep を種類にして compose --check に差が出たら、見た目を変えないことを優先し、種類の分け方（T3）を細かくする方向で直す。絵は変えない — 設計書「1画素も変えない」が上位 — 誤りなら keep の形を見直す

## 進捗
- Task 1: minor (deferred): HEX_RE の $ が末尾の改行を通す（palette で fullmatch に）
- Task 1: minor (deferred): swatches/kinds の欠け・最上位が object でない・swatch/kind の note 欠けのテストが無い
- Task 1: minor (deferred): uses/ が無いと空の uses を黙って返す
- Task 1: complete (commits 3f396da..ffe25f2, review clean)
- Task 2: review approved（4f41238）。Ruling: レビューの Minor 1〜6（pixels の file が対象外でも黙って無視・末尾の空白や二重の上書き・WRITE の表示・読み書きの例外・main のテスト・規則の無い名前のまとめ）は、Task 3/4 で実物の上書きに使う前に直す — 上書きの取りこぼしは色が同じため PNG の比較で検出できない — 誤りでも小さな修正が1回増えるだけ
- Task 2: fix round 1/5 (6 addressed, 0 open; commits 4f41238..c931e51)
- Task 2: complete (commits ffe25f2..c931e51, review clean)
- Ruling: Task 3 は Step 1〜5 の途中（ページの HTML を作るまで）をサブエージェントに任せ、Artifact の公開と依頼者への質問は私が行う。Step 6 のコミットは承認の後 — サブエージェントからは依頼者に聞けない — 誤りでも手順が分かれるだけ
- Task 3: Step 1〜5 完了（未コミット）。種類15・用途の色174（common1/unit64/tile71/face15/item23）・規則978・上書き1548件（4894画素・562枚）。色の一致を全1281枚・284,006画素で確認（不一致0）。未使用の色見本 iris_slate・iris_slate_dark
- Task 3: 色分けページ https://claude.ai/artifact/RYkb47UmkA1WGhjADqPBvm を公開し、依頼者の承認待ち（10-31）。Task 4 へ進まない
- Task 3: 依頼者が承認（10-31「これで一旦進めて下さい」）。推定した敵のコマ1178画素・ガウの芯の服の上書き・ユニットの目は輪郭・未使用の色見本2色を含めて
- Task 3: review ⚠️ 組んだコマ（assets/unit/）が blade/weapon/shield を持つ — Ruling: 計画 Task 5 の決まり3が assets/unit/ を対象外にしており、部品から受け継ぐ色なので正しい — 誤りなら Task 5 の範囲を見直す
- Task 3: review ⚠️ イネスのピアスは画素の上書きでなくフォルダの規則で earring_* に — Ruling: 結果の画素は同じで、依頼者の承認したページどおり — 誤りでも名前の付け方だけ
- Task 3: minor (deferred): tile/item の用途の色に素材の語が後ろに付く名前（building_wood_* など）。物の接頭辞があり用途は分かる
- Task 3: complete (commits c931e51..c880d79, review clean)
- Task 4: implementer DONE_WITH_CONCERNS（df456e8, d56499c）。PNG 1035枚 差0、unit_rules/compose --check/tip_check/check_colors 前と同じ、unittest 657 OK、validate 0。比べる道具: scratchpad/task4/collect.sh・compare_all.sh
- Task 4: 懸念 weapon_check と keep に legwear_brown・belt_strap・collar_white が入った（前と同じ画素を選ぶため）。Ruling 3: Task 6 で種類で読むと、ベルト・脚の服などが武器として読まれなくなり unit_rules の結果が変わりうる。その差は「前は武器でない物を武器と読んでいた所」に限って許し、1件ずつ台帳に書いて依頼者に報告する。compose --check は 0 のまま（Ruling 2）— 依頼者の目的（ベルトを柄と取り違えない）がまさにこの差 — 誤りなら Task 6 の比較をやり直す
- Task 4: 懸念 gen/ のスクリプトが古い名前のまま → Task 9 で ISSUES に1行
- Task 4: minor (deferred): probe_colors の is_outline が "contour" の名前だけを見る（輪郭の色見本を指す別の用途の色、例 eyepatch で閾値が変わる）。色見本へ引いてから判定するか種類で
- Task 4: minor (deferred): enemy_build.colours_of が gridfile.load_colours の本体を写している
- Task 4: minor (deferred): 古い名前の注釈（unit_config.py:23 のガウの頭巾、compose_page.py:29 の stone_hi）
- Task 4: minor (deferred): build/enemy/<id>/*.txt の map は色見本の名前になる（validate の対象外）→ Task 9 で README 2.11 に書く
- Task 4: 記録: check_colors は移し替えの前から終了コード 1（この作業の前からの失敗）
- Task 4: complete (commits c880d79..d56499c, review clean)
- Task 5: validate の全件（1257枚）: 落ちた件数 0（偽陽性 0）。note: 色見本 iris_slate・iris_slate_dark を指す用途の色が無い。未使用の用途の色は無し
- Task 5: minor (deferred): test_derived_file_takes_type_from_origin が型を確かめていない（origin 未使用）
- Task 5: minor (deferred): 読めなかったグリッドがあると未使用の報告が誤る / リポジトリ外のファイルは決まり2・3が黙って外れる / -q で note: が消えない
- Task 5: complete (commits d56499c..bc35c39, review clean)
- Task 6: implementer DONE_WITH_CONCERNS（409b235）。unittest 674 OK、compose --check 0×3、PNG 1035 差0、unit_rules の変わった行 0。keep は ["blade","weapon"] で組んだコマは変わらない
- Task 6: 懸念 parts_export.py も直した（hand_colours を書き出さないように）/ gen/*_layers.py は古い名前と UnitDef(hand_colours) のまま → Task 9 で ISSUES に / 手の色が unit の肌すべて（skin_fair_*・skin_ruddy_deep も）、今の3体では差なし
- Task 6: minor (deferred): test_ornament_of_grip_colour_is_not_the_grip は新しい作りが無くても通る（本当の守りは test_weapon_check_colours_come_from_kinds）。注釈にするか消す
- Task 6: minor (deferred): gen/ines/ines_layers.py:62・gen/gau/gau_layers.py:58 が import で落ちる。README:282 がまだ使い方として載せている → Task 9
- Task 6: minor (deferred): 古い注釈 hand_colours（part_chars.py:7・fist_check.py:8・hand_mirror.py:7）
- Task 6: complete (commits bc35c39..409b235, review clean)
- Task 7: part_outline の roran・ines・gau は前と同じ（すべて ok、終了コード 0）
- Task 7: minor (deferred): 一部のコマだけ芯の上のテストが、文字列の置き換えで fixture を書き換えていて脆い
- Task 7: complete (commits 409b235..8af9fb8, review clean)
- Task 8: implementer DONE（6b6993a）。unittest 693 OK、eye_check の roran・ines・gau は前と同じ（目: ok）
- Task 8: 覆う部品の決まり = 目の部品より手前の部品のうち、役割 head の部品の画素か、種類 headgear・ornament の画素（武器・拳・盾は数えない）
- Task 8: Ruling: 目の高さの比較を同じ状態のコマの向きどうしにした実装者の判断を、レビューの結果を見て受け入れるか決める
- Task 8: 未決（D 1回目 Task 4 で扱う）: 眼帯を別の部品（ornament）にして目の部品に両目を描くと、片目だけ覆われて「目の一部が被り物に隠れている」で落ちる。設計書の「一部だけ覆われていれば落とす」のまま。E5 の眼帯の描き方を D 1回目で依頼者と決める
- Task 8: Task 9 で types/unit/SPEC.md の eye_check の説明（357行付近）を直す
- Task 8: Ruling: 目の高さの比較は同じ状態のコマの向きどうしで行う実装者の判断を受け入れる — 頭の上下動がある状態どうしを比べないため、レビューも同じ状態の比較は弱めていないと判断 — 誤りなら base の状態だけ、または1つの行と比べる形に直す
- Task 8: minor (deferred): 一部隠れたコマは高さの比較に入らない（先の失敗を直すまで別の原因が見えない）/ 状態が1つの向きにしか無いと高さを比べない
- Task 8: complete (commits 8af9fb8..6b6993a, review clean)

## 中断（10-31、依頼者の指示: 週間の制限のため Task 8 で止める）
- 再開は Task 9（文書と最終確認）から。続けて最終の全体レビュー（最も強いモデル）→ deferred の Minor をまとめて1回で直す → finishing
- Task 9 に入れること: gen/*.py が古い名前・hand_colours のまま（ISSUES に1行、README:282）、build/enemy の map が色見本の名前（README 2.11）、types/unit/SPEC.md の eye_check の説明（357行付近）と目の部品の役割 eye、forge の CLAUDE.md 64・68行と SPEC 299行の古い色名
- PNG の比較: scratchpad/task4/collect.sh <dir> → compare_all.sh before <dir>（scratchpad はセッションが変わると消えるおそれ。消えていたら Task 4 の報告を見て作り直す。before は c880d79 で取る）
- 比べるスクリプトの写し: .superpowers/sdd/2026-10-30-palette-uses/compare/（中のパスは scratchpad を指すので、使う前に確かめる）
