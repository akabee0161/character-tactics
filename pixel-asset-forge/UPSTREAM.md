# UPSTREAM

このフォルダは pixel-asset-forge のコピーで、このゲーム専用に自由に直してよい。

- コピー元: https://github.com/akabee0161/pixel-asset-forge.git
- commit: 00ef131ef16dd27ce4c1d63f36eca6075022e0b3
- コピーした日: 2026-09-30

forge 本体も並行して開発が続く。forge の改善をこちらへ取り込む仕組みは無く、要るものはその都度手で持ってくる。

## forge に戻す候補

ここでエンジン・規約・道具を直したら、何を・なぜ直したかを1行足す。

- `tools/export.py`: 書き出し先がシンボリックリンクなら止める（`copyfile` がリンクをたどってフォルダの外を上書きしないように）。`build/` を消せないときは描き直す前に `FAIL` で止める（残った古い PNG を書き出さないように）。テストは `tests/test_export.py` に2件（character-tactics の PR の CodeRabbit の指摘、2026-09-30）
- `tools/sheet_gif.py`（新規）: unit のシート定義から状態ごとの GIF（4方向を横並び、拡大と等倍）を作る。静止画のシートでは攻撃の動きの違和感が分からなかったため（依頼者の要望、2026-10-01）。テストは `tests/test_sheet_gif.py`。README 2.7・CLAUDE.md に案内
- `ISSUES.md`: 「行の長さがそろわないグリッドを回転すると `IndexError` で止まる」（`gridfile.py`）の課題を足した
- `types/item/SPEC.md`（新規）と `assets/item/sword.txt`・`bow.txt`（新規）: item 型の規約が無く、剣・弓のアイコンを描くのに合わせて実測値から規約を作った（向きは右上が先端の45°、形は軸について対称、素材ごとの色の割り当て）。`README.md` の表と `ISSUES.md` の該当行も直した（character-tactics の issue #23 の3番目、2026-10-02）
- `assets/unit/roran/`（23コマ）と `types/unit/SPEC.md`: ロランの剣の鍔を木、柄頭を赤い宝石にして item の剣（`assets/item/sword.txt`）に色を揃えた。鍔と柄頭に専用の文字（`G H J R`）を割り当て、`# map:` 行で色を切り替えた。SPEC に剣の色・平らな切っ先・持ち物の専用の文字の規約を足した。`ISSUES.md` と `types/item/SPEC.md` の色の命名の整理の時期も直した（character-tactics の issue #23 の4番目、2026-10-03）
- `ISSUES.md`: 「アセットのテキストとビルドをゲームリポジトリへ移設する」「タイルの受け渡し方が未定」の2行を消した（移設が済んだため。pixel-asset-forge の移設の issue は 2026-09-30 に閉じた）
- `tools/unit_check.py`（新規）・`tests/test_unit_check.py`: unit の脚の中心と、同じ向きの `base` から増えた輪郭の切れ目を確かめる（自己チェック①）。README 2.7・CLAUDE.md に案内（character-tactics のユニットを描く標準のワークフロー、2026-10-04）
- `tools/compose.py`（新規）・`tests/test_compose.py`: 素体と部品（髪・かぶり物・武器）を前後の順番で重ねて unit のコマを組み立てる。設定は `compose/<unit>.json`。README 2.7・CLAUDE.md に案内（同、2026-10-04）
- `tools/present.py`・`tools/face_down.py`（新規）・`tests/test_present_face_down.py`: 案を並べて見せる画像を作る、拡大された顔を元の画素に戻す。ロランとイネスの作業で2回作った使い捨てをまとめた（同、2026-10-04）
- `tools/unit_picker.py`・`tools/unit_picker.html`（新規）・`tests/test_unit_picker.py`: unit の部品の案を組み合わせて選ぶページを書き出す。全部の組み合わせを `compose.py` の規則で組み立てて埋め込み、4方向・ゲームの大きさ・部品だけ・見本との比較・一覧で見せる。ロランの顔の `compose_face.py --html` と同じ考え。部品を一括で作るときの必須の道具（依頼者の判断、ガウの CP1、2026-10-04）。README 2.7・CLAUDE.md・SPEC の「描く手順」に案内
- `types/unit/SPEC.md`: 「描く手順」（確認ポイント CP0〜CP4 と自己チェック①②③）と、部品・組み立ての設定ファイルの配置を足した。`CLAUDE.md` の原則にも案内（同、2026-10-04）

## forge から持ってきたもの

コピーした後に forge で直され、手でこちらへ持ってきたもの。ゲームの開発が終わって差分を見るとき、ここにあるものはゲーム側の改善ではない。

- forge `95c2501`（[pixel-asset-forge#9](https://github.com/akabee0161/pixel-asset-forge/pull/9) の squash マージ）: Python を 3.14 前提にし uv で venv を作る手順とインストール手順へのリンク（`README.md`・`CLAUDE.md`）、Pillow の下限を 12.3.0 に（`requirements.txt`）、`ISSUES.md` の更新（3.10 の課題を消し、`RiverDerivationTest` の課題を足す）
- forge `ad734ee`・`82162a5`: ここで作った `tools/export.py`（と `tests/test_export.py`）を forge が取り込み、README 2.10・CLAUDE.md に案内を足した。`new-game` スキルの手順が forge の main だけで動くよう、ゲームの開発の終わりを待たずに戻した（依頼者の判断、2026-09-30）。あわせて `probe_colors.py --pairs` の課題2件を `ISSUES.md` に足した

## ゲーム側だけの変更

forge に戻さない、コピーだからこそ要る変更。

- `README.md`「1. セットアップ」: ゲームリポジトリでは `pixel-asset-forge/` に `cd` してから実行する、という注意書き

## ゲームの開発が終わったら

上の候補と、このフォルダを足したコミットからの差分を材料に、forge の issue を出す。
差分は `git diff $(git log --format=%H --diff-filter=A -1 -- pixel-asset-forge/UPSTREAM.md) -- pixel-asset-forge/` で見られる。
取り込むときに、そのまま採用するか、抽象化してから入れるかを1件ずつ決める。
