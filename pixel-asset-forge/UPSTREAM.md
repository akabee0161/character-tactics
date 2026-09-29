# UPSTREAM

このフォルダは pixel-asset-forge のコピーで、このゲーム専用に自由に直してよい。

- コピー元: https://github.com/akabee0161/pixel-asset-forge.git
- commit: 00ef131ef16dd27ce4c1d63f36eca6075022e0b3
- コピーした日: 2026-09-30

forge 本体も並行して開発が続く。forge の改善をこちらへ取り込む仕組みは無く、要るものはその都度手で持ってくる。

## forge に戻す候補

ここでエンジン・規約・道具を直したら、何を・なぜ直したかを1行足す。

- `tools/export.py`（と `tests/test_export.py`）: ビルドして、ゲーム側の対応表どおりに PNG をコピーする。どのゲームでも使える。forge の README のツアーにも足す必要がある
- Python 3.14 を前提にする: forge の README のセットアップは `python3 -m venv` だけで、バージョンの前提が書かれていない。`tests/test_tools.py` の `contextlib.chdir` は 3.11 からなので、3.10（2026-10-31 でサポート終了）では3件落ちる。ゲーム側は uv で 3.14 の venv を作る手順にした（README「ドット絵の作りかた」）

## ゲームの開発が終わったら

上の候補と、このフォルダを足したコミットからの差分を材料に、forge の issue を出す。
差分は `git diff $(git log --format=%H --diff-filter=A -1 -- pixel-asset-forge/UPSTREAM.md) -- pixel-asset-forge/` で見られる。
取り込むときに、そのまま採用するか、抽象化してから入れるかを1件ずつ決める。
