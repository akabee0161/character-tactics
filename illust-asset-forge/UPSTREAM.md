# UPSTREAM

このフォルダは illust-asset-forge のコピーで、このゲーム専用に自由に直してよい。

- コピー元: https://github.com/akabee0161/illust-asset-forge.git
- commit: b9cbe53042c284c2ce5480f3e649d3181a67b8b4
- コピーした日: 2026-11-23

forge 本体も並行して開発が続く。forge の改善をこちらへ取り込む仕組みは無く、要るものはその都度手で持ってくる。

## forge に戻す候補

ここでエンジン・規約・道具を直したら、何を・なぜ直したかを1行足す。

## このゲームだけの変更

コピーしたあとにこのゲームのために直したこと。forge 本体には戻さない。

- `notebooks/run.ipynb`: 準備のセルの 4 つの変数を、このゲームの値にした（`REPO_URL` = character-tactics、`REPO_BRANCH` = `develop`、`SUBDIR` = `illust-asset-forge`、`DRIVE_DIR` = `/content/drive/MyDrive/character-tactics/illust-asset-forge`）。`develop` にするのは、機能ブランチを `develop` にマージした時点で Colab に届くようにするため
- `tests/test_notebook.py`: 既定値のテストを、このゲームの値に合わせた
- `characters/ally05/`・`characters/ally06/`: ゲームのボルグ・セラの設定を置いた（forge の `9627e8d` の同じファイル。ボルグの `inpaint_box` は古い顔に合わせた値なので外した。絵は置いていない）
- `tests/test_repo_configs.py`: 見本 4 人だけを前提にしたテスト 2 件を、見本 4 人が含まれることと `tlf-` の画風が無いことだけを見る形にした。ゲームの名前を禁止語にする検査（`test_repo_does_not_mention_the_game`）は、`REPO_URL` などにゲームの名前が入るので削除した
- `CLAUDE.md`: 「ゲーム側の事情を書かない」を、このコピーはこのゲーム専用で書いてよい、という内容に書き換えた

## ゲームの開発が終わったら

上の候補と、このフォルダを足したコミットからの差分を材料に、forge の issue を出す。
差分は `git diff $(git log --format=%H --diff-filter=A -1 -- illust-asset-forge/UPSTREAM.md) -- illust-asset-forge/` で見られる。
取り込むときに、そのまま採用するか、抽象化してから入れるかを1件ずつ決める。
