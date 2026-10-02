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
- `ISSUES.md`: 「アセットのテキストとビルドをゲームリポジトリへ移設する」「タイルの受け渡し方が未定」の2行を消した（移設が済んだため。pixel-asset-forge の移設の issue は 2026-09-30 に閉じた）

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
