# UPSTREAM

このフォルダは pixel-asset-forge のコピーで、このゲーム専用に自由に直してよい。

- コピー元: https://github.com/akabee0161/pixel-asset-forge.git
- commit: 00ef131ef16dd27ce4c1d63f36eca6075022e0b3
- コピーした日: 2026-09-30

forge 本体も並行して開発が続く。forge の改善をこちらへ取り込む仕組みは無く、要るものはその都度手で持ってくる。

## forge に戻す候補

ここでエンジン・規約・道具を直したら、何を・なぜ直したかを1行足す。

- `tools/export.py`（と `tests/test_export.py`）: ビルドして、ゲーム側の対応表どおりに PNG をコピーする。どのゲームでも使える。forge の README のツアーにも足す必要がある

## forge から持ってきたもの

コピーした後に forge で直され、手でこちらへ持ってきたもの。ゲームの開発が終わって差分を見るとき、ここにあるものはゲーム側の改善ではない。

- forge `95c2501`（[pixel-asset-forge#9](https://github.com/akabee0161/pixel-asset-forge/pull/9) の squash マージ）: Python を 3.14 前提にし uv で venv を作る手順とインストール手順へのリンク（`README.md`・`CLAUDE.md`）、Pillow の下限を 12.3.0 に（`requirements.txt`）、`ISSUES.md` の更新（3.10 の課題を消し、`RiverDerivationTest` の課題を足す）

## ゲーム側だけの変更

forge に戻さない、コピーだからこそ要る変更。

- `README.md`「1. セットアップ」: ゲームリポジトリでは `pixel-asset-forge/` に `cd` してから実行する、という注意書き

## ゲームの開発が終わったら

上の候補と、このフォルダを足したコミットからの差分を材料に、forge の issue を出す。
差分は `git diff $(git log --format=%H --diff-filter=A -1 -- pixel-asset-forge/UPSTREAM.md) -- pixel-asset-forge/` で見られる。
取り込むときに、そのまま採用するか、抽象化してから入れるかを1件ずつ決める。
