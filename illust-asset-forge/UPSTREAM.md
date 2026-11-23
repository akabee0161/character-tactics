# UPSTREAM

このフォルダは illust-asset-forge のコピーで、このゲーム専用に自由に直してよい。

- コピー元: https://github.com/akabee0161/illust-asset-forge.git
- commit: b9cbe53042c284c2ce5480f3e649d3181a67b8b4
- コピーした日: 2026-11-23

forge 本体も並行して開発が続く。forge の改善をこちらへ取り込む仕組みは無く、要るものはその都度手で持ってくる。

## forge に戻す候補

ここでエンジン・規約・道具を直したら、何を・なぜ直したかを1行足す。

直した（forge 本体にも同じ問題があり、forge の `fix/review-findings-from-ct` ブランチで同じ修正を入れた。forge の PR がマージされたら、forge 側は対応済み。2026-11-23、character-tactics の PR #60 の CodeRabbit の指摘）:

- `notebooks/run.ipynb` の準備のセル: `!pip install` は失敗しても例外にならず、古い依存のまま import に進む。`subprocess.run([sys.executable, "-m", "pip", "install", "-q", ...], check=True)` にして、失敗したらセルを止める（`tests/test_notebook.py` の `test_prepare_cell_stops_when_pip_install_fails`）
- `src/artgen/forge.py` の `Forge.adopt`: 設定から消した表情の候補（Drive に残った古い候補）を採用すると、画面は成功を出すが、あとの `intake` が `face_<表情>.png` を拒否してほかのキャラクターも取り込めなくなる。採用の前に、今の `character.yaml` の `expressions` に無い表情を `ConfigError` で止める（`tests/test_forge.py` の `test_adopt_rejects_expression_missing_from_current_config`）

直した（上の 2 件と同じく forge 本体の `fix/review-findings-from-ct` ブランチと同じ差分を、このコピーに入れた。まれな条件でだけ起きる 5 件。2026-11-23）。下の説明は直す前の問題:

- `src/artgen/intake.py` の `_swap_all`: 入れ替えの途中で強制終了すると、前の `source` の控え（`.source.old`）が唯一の写しになり、次の取り込みがそれを消す（`source/` は git にも入っているので戻せる）。控えが残っていたら、復旧するか止まる。今回の控えだけを今回戻す
- 同じ `_swap_all` の戻す処理: 1 件の戻しに失敗すると、残りのキャラクターを戻さずに止まる。キャラクターごとに失敗を記録して続け、最後に手で戻すパスを報告する
- `src/artgen/selection.py` の `adopt`: 初回の採用で、新しい `face.png` を置いた直後に中断すると、採用前の状態（無い）に戻らず新しい顔が残る
- 同じ `adopt`: 顔の置き換えと表情の退避が済んだあとに、控えの削除だけが `OSError` になると、採用できたのに「採用できない」と返す。採用の結果と削除の警告を分ける
- `src/artgen/selection.py` の `pack`: 同じ秒に 2 回呼ぶと、同じ名前の zip を上書きする。別名を確保し、一時ファイルに書き終えてから公開する

追加した（2026-11-23。Colab のランタイムに接続できなかったため、forge 本体に戻す候補。GPU の処理だけを Modal に出した）:

- Modal の道: `src/artgen/jobs.py`（ジョブのファイルの読み込み・Modal の上での実行。T4 以外なら生成しない）・`local.py`（`local/` の置き場と条件の `commit` に付ける `+dirty` の印）・`modal_app.py`（Modal の入口。T4 固定、版は requirements-colab.txt に合わせる）・`cloud.py`（Claude が叩く CLI: generate / page / adopt / install）。Colab の道（`notebooks/run.ipynb`・`attach()`）は変えていない
- 決まりで外す道具と候補のページ: `src/artgen/screen.py`（頭が切れている・背景が白やクリーム色でない、を画素を数えて判定）・`rounds.py`（1 回りの記録）・`review_page.py`（外した候補を理由つきで下にたたむ HTML）。`intake.py` に `print_reports` を切り出した

## このゲームだけの変更

コピーしたあとにこのゲームのために直したこと。forge 本体には戻さない。

- `notebooks/run.ipynb`: 準備のセルの 4 つの変数を、このゲームの値にした（`REPO_URL` = character-tactics、`REPO_BRANCH` = `develop`、`SUBDIR` = `illust-asset-forge`、`DRIVE_DIR` = `/content/drive/MyDrive/character-tactics/illust-asset-forge`）。`develop` にするのは、機能ブランチを `develop` にマージした時点で Colab に届くようにするため
- `tests/test_notebook.py`: 既定値のテストを、このゲームの値に合わせた
- `characters/ally05/`・`characters/ally06/`: ゲームのボルグ・セラの設定を置いた（forge の `9627e8d` の同じファイル。ボルグの `inpaint_box` は古い顔に合わせた値なので外した。絵は置いていない）
- `tests/test_repo_configs.py`: 見本 4 人だけを前提にしたテスト 2 件を、見本 4 人が含まれることと `tlf-` の画風が無いことだけを見る形にした。ゲームの名前を禁止語にする検査（`test_repo_does_not_mention_the_game`）は、`REPO_URL` などにゲームの名前が入るので削除した
- `CLAUDE.md`: 「ゲーム側の事情を書かない」を、このコピーはこのゲーム専用で書いてよい、という内容に書き換えた。Drive から絵を取る手順に、このゲームの置き場（`MyDrive/character-tactics/illust-asset-forge/selected/<id>/`）だけから取ること（forge 本体の Drive の古い絵を取り込まないため）を書いた
- `notebooks/run.ipynb`・`src/artgen/forge.py`・`tests/`: 上の「直した」2 件（`pip` の失敗で止める、設定に無い表情を採用しない）を、このコピーだけに入れた
- `README.md`: 変数の「既定は」と Drive の置き場の説明を、このコピーの値に直した（`tests/test_notebook.py` の `test_docs_name_this_games_drive_dir` が見る）

## ゲームの開発が終わったら

上の候補と、このフォルダを足したコミットからの差分を材料に、forge の issue を出す。
差分は `git diff $(git log --format=%H --diff-filter=A -1 -- illust-asset-forge/UPSTREAM.md) -- illust-asset-forge/` で見られる。
取り込むときに、そのまま採用するか、抽象化してから入れるかを1件ずつ決める。
