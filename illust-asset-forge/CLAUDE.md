# illust-asset-forge 作業規約（Claude 向け）

人間向けの手引きは [`README.md`](README.md)。ここには Claude が守ることだけを書く。

## 役割の分担

- 量産（顔グラ 26 枚のような、たくさんの候補）は、**Claude が Modal の T4 で作る**（`python -m artgen.cloud generate --jobs FILE`）。GPU は T4 だけ。同じシードでも GPU の種類が違うと絵が変わるので、T4 が空いていなければ別の GPU に替えず、待つかやり直す（条件の `gpu` が `Tesla T4` でない絵は返らない）。このサーバーには GPU が無く、Modal のコードは偽のパイプラインを使ったテストの外（実際に動かす）でしか確かめられない
- 画風の調整のように、依頼者が自分の手でタグを変えながら 1 枚ずつ試すときは、**依頼者が Colab で動かす**（`notebooks/run.ipynb`。壊さない）。ノートブックの画面（`picker`）は、偽のウィジェットでしか確かめていない。Colab は GitHub からリポジトリを取るので、設定の変更は push するまで Colab に届かない。**push は依頼者が頼んだときだけ**行う
- Modal の道は、手元のコードと設定をそのまま送るので、push せずに試せる。ジョブに画風（`style`）は付けない（量産はデフォルトの画風だけ）

## 受け取った画像の扱い

- 候補（生成された画像）はリポジトリに入れない。入れるのは `characters/<id>/source/` の採用した画像と、書き出した画像・`params.json` だけ
- 採用した絵は、依頼者がノートブックのまとめのセルで作った zip で届く。**`python -m artgen.intake <zip>` で `source/` に取り込む**（`face.png`・`face_<表情>.png`・`fullbody.png` の名前、PNG に条件があること、キャラクターの一致を検査し、通らなければ何も書かずに止まる）。条件が無いときは添付で消えた可能性があるので、依頼者に知らせて止める
- 採用した絵は、zip の代わりに Google Drive のコネクター（`download_file_content`）で `DRIVE_DIR` の `selected/<id>/` から取ってもよい。このコピーの `DRIVE_DIR` は `MyDrive/character-tactics/illust-asset-forge` なので、取る場所は `MyDrive/character-tactics/illust-asset-forge/selected/<id>/` だけ。`face.png` などの名前で探すと、forge 本体の Drive（`MyDrive/illust-asset-forge/selected/<id>/`）の古い絵も見つかる。親フォルダをたどって、この場所の下にあるものだけを取る（`character` が同じ ID の古い絵は、取り込みの検査を通ってしまう）。取った絵を `selected/<id>/` の形（`<id>/face.png` など）に置き、`install_selection` で取り込む。1 枚ごとに絵が会話に入るので、取るのは採用した絵だけにする。表情の範囲の `selection.json`（`selected/<id>/` にある）は画像ではないので、あれば一緒に取る（無いと範囲を書き戻せない）
- Modal の道で作った候補は、このサーバーの `local/`（`.gitignore` 済み）にある。候補のページには全部を並べ、Claude が機械的に外したり、目で見て選り分けたりしない（依頼者が全部を目で見て選ぶ）。依頼者が候補のページ（Artifact）の番号で答えたら、`python -m artgen.cloud adopt local/rounds/<run_id>.json <番号> [--flip]` で採用し（`--flip` は顔だけ）、`python -m artgen.cloud install <id>` で `characters/<id>/source/` に取り込む（頼んだキャラクターだけ。ほかの採用は触らない）。`install` は選び直していない全身絵（`source/fullbody.png`）を持ち越すが、表情は持ち越さない。取り込みの後の書き戻し・書き出しは、下の zip の道と同じ
- `intake` は `source/` を丸ごと置き換える。出力の「消した」に意図しないもの（特に `face.png`）があるときはコミットせず、依頼者に確かめる
- `intake` の出力にある書き戻しの一覧を、`character.yaml` などの設定に戻してからコミットする（以後は上書きなしで同じプロンプトになるように）。条件の `overrides` の `style` は `character.yaml` の `style` に戻す（そのキャラクターだけの上書きになる）。ただし、その画風が `defaults.yaml` の `style` と同じなら、`style` を書かず、`character.yaml` に `style` があれば消す（デフォルトに戻す）
- 画風はデフォルト（`defaults.yaml` の `style`）を全キャラクターで使う。新しいキャラクターの `character.yaml` には `style` を書かない
- 書き戻しの一覧に `overrides.style_definition`（その場で書いた画風の定義）があるときは、その `prompt`・`negative` で `styles/<style>.yaml` を作る。依頼者がその画風を全員に使いたいときは `defaults.yaml` の `style` をそれにし、`style` を書いているキャラクターがいればその行を消す。1 人だけに使いたいときはその `character.yaml` の `style` をそれにする
- 表情の範囲（`inpaint_box`）は、依頼者がノートブックで決め、`selection.json` で届く。Claude は `intake` の一覧を見て `character.yaml` に書き戻す。顔の自動検出は入れず、Claude が顔を見て範囲を決めることもしない（これは表情の範囲の話。切り出しの範囲 `face_crop` は Claude が決め、承認用のページで依頼者の承認を受ける）
- 書き出しは `python -m artgen.export <id>`。顔は `face_crop`（切り出しの範囲）を書いてから書き出し、`python -m artgen.crop_review <id>` の承認用のページを Artifact で見せて依頼者の承認を受ける。範囲の辺で服が切れると服の白が透明になるので、`local/check/<id>/` の確認図（透明にした画素が赤）を必ず自分でも見る

## 守ること

- このコピーは character-tactics 専用。ゲーム側の事情を書いてよい。エンジン・道具・画風・テンプレートを直したら、`UPSTREAM.md` に 1 行足す（forge 本体に戻す候補、およびこのゲームだけの変更の記録）
- modal は `modal_app.py` の中でだけ import する（`cloud.py` は `generate` の中で `modal_app` を import する）。diffusers・torch は `forge.load_pipeline()`・`forge.attach()` の中でだけ import する。`ipywidgets`・`IPython` も関数の中でだけ import する。ほかのモジュールとテストはそれらが無くても動くままにする
- 取り込みの関数（`install_selection`）は、将来 Colab から直接コミットするときに使うので、zip・標準出力に依らないままにする（zip の展開は `extract_pack`、表示は `main` が受け持つ）
- 設定の誤りは `ConfigError` で、`<相対パス>: <キーの位置>: <何がおかしいか>` の形で止める
- コミットは Conventional Commits + 日本語の要約

## テスト

```sh
uv venv .venv && uv pip install -e '.[dev]' && .venv/bin/pytest
```

## ドキュメントの扱い

- `docs/superpowers/` 配下（設計書・計画）は作成時点のログ。後から実装が変わっても遡って更新しない
- 最新の状態の正典は `README.md` と `CLAUDE.md`。両者が食い違うときは正典が正しい
