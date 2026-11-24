# illust-asset-forge

ゲーム用のキャラクターのイラスト（顔・表情の差分・全身絵）を、Google Colab（手で試すとき）か Modal（量産）の GPU で生成するリポジトリ。

- キャラクターの設定を YAML で持ち、画風・絵の種類（型）と組み合わせてプロンプトを組み立てる
- 生成の条件（プロンプト・シード・版）を PNG に埋め込み、採用した絵を作り直せるようにする
- 採用した絵を、受け渡しの形（顔は 256×256 と、切り出し範囲があれば小さい顔 128×128、全身は元の大きさ、`params.json`）に書き出す

GPU を使う処理は、量産は Claude が Modal で、手で試すときは依頼者が Colab で動かす（[10. Modal で作る](#10-modal-で作る量産)）。GPU を使わない処理（設定・プロンプト・書き出し）はサーバーで Claude が動かす。
この README は**人間向けの手引き**である。Claude が守る作業規約は [`CLAUDE.md`](CLAUDE.md) にある。

**目次**

1. [ファイルの地図](#1-ファイルの地図)
2. [Colab での使い方](#2-colab-での使い方)
3. [採用した絵の渡し方](#3-採用した絵の渡し方)
4. [Claude 側の流れ](#4-claude-側の流れ)
5. [初めて Colab で動かすときの確認](#5-初めて-colab-で動かすときの確認)
6. [ライセンスと再現の限界](#6-ライセンスと再現の限界)
7. [テストの実行](#7-テストの実行)
8. [コピーして使う](#8-コピーして使う)
9. [見本の 4 人](#9-見本の-4-人)
10. [Modal で作る（量産）](#10-modal-で作る量産)

---

## 1. ファイルの地図

| ファイル | 内容 |
|---|---|
| `defaults.yaml` | 全キャラクター共通の設定。`style` がデフォルトの画風（今は `thick-line-flat`） |
| `styles/<name>.yaml` | 画風（プロンプトとネガティブ）。複数あり、`compare_styles` で見比べる |
| `templates/face.yaml`・`fullbody.yaml` | 絵の種類（大きさ・構図のタグ・書き出しの大きさ・inpaint の既定の範囲） |
| `characters/<id>/character.yaml` | キャラクターの設定（外見・表情の一覧・描き直す範囲 `inpaint_box`）。画風 `style` は、デフォルトと違う画風にするときだけ書く |
| `characters/<id>/source/` | 採用した元の画像（受け取ったもの） |
| `characters/<id>/face.png` など・`params.json` | 書き出した受け渡しの形 |
| `src/artgen/` | `config`（読み込み）・`prompt`（組み立て）・`pnginfo`（条件の読み書き）・`mask`（描き直す範囲）・`selection`（採用した絵の置き場・run の候補探し）・`picker`（ノートブックのボタンの画面）・`intake`（zip の取り込み）・`export`（書き出し）・`forge`（Colab 側） |
| `notebooks/run.ipynb` | Colab の入口 |
| `requirements-colab.txt` | Colab で入れるライブラリ（版を固定） |

`DRIVE_DIR`（このコピーでは Drive の `MyDrive/character-tactics/illust-asset-forge/`。forge 本体の `MyDrive/illust-asset-forge/` とは別の場所）の下の置き場:

| 置き場 | 内容 |
|---|---|
| `runs/<キャラクター>/<種類>/<日時>/` | 生成した候補（`<id>_<型>[_<表情>]_<seed>.png`）。画風の見比べは `<id>_<型>_<画風>_<seed>.png`。古い `runs/<日時>/` のフォルダは `char`・`kind` では絞れず、`P.pick(forge, run_id="<日時>")` だけで開く |
| `selected/<id>/` | 採用した絵（`face.png`・`face_<表情>.png`・`fullbody.png`）と、表情の範囲 `selection.json`。顔を採り直すと、古い表情と範囲は `replaced/<日時>/` へ退く |
| `packs/` | まとめの zip（`selected_<日時>.zip`） |

## 2. Colab での使い方（手で試すとき。画風の調整など）

1. `notebooks/run.ipynb` を Colab で開き、ランタイムを GPU（T4）にする
2. 各セルは先頭の変数（キャラクターの ID・枚数・表情名・画風名）だけ書き換えて、上から順に実行する
   - **準備**: Drive をつなぎ、リポジトリを clone（2 回目以降は `REPO_BRANCH` に切り替えてから pull）し、ライブラリを入れる。Claude が設定を直して push した後は、このセルだけ実行し直せば取り込める（モデルは読み込み直さない）。セルの先頭の 4 つの変数で、取る先と置き場を決める
     - `REPO_URL`: clone するリポジトリ（このコピーでは `https://github.com/akabee0161/character-tactics.git`）。`/content/` の下に同じ名前の clone があって、別のリポジトリのものだったときは、止まって知らせる
     - `REPO_BRANCH`: 取るブランチ（このコピーでは `develop`）。作業ブランチの絵を試すときは、これを書き換えて準備のセルを実行し直す
     - `SUBDIR`: リポジトリの中の forge のフォルダ（このコピーでは `illust-asset-forge`）
     - `DRIVE_DIR`: 候補・採用した絵を置く Drive の場所（このコピーでは `/content/drive/MyDrive/character-tactics/illust-asset-forge`）
   - **モデルの読み込み**: `pipe` が無いときだけ `F.load_pipeline()` で読み込む（数分）。メモリ不足で止まったときだけ `F.load_pipeline(low_memory=True)` にする（遅くなる）。続けて `forge = F.attach(pipe, ".", base_dir=DRIVE_DIR)` で、読み込み済みのパイプラインに設定を結びつける
   - **画風の見比べ（任意）**: `forge.compare_styles(CHAR, n=2)` が、同じシードで画風だけを変えた顔を作り、`P.show_styles(paths)` で画風ごとに並べる。気に入った画風名を後ろの `STYLE` に書く
     - **その場で画風を書く**: YAML を書いて push しなくても、`style=` と `compare_styles(styles=[...])` の要素に `{"name": "my-style", "prompt": ["flat color"], "negative": ["gradient"]}` のような辞書を渡せる（`name` は半角英数字・`_`・`-` だけ。画風名と混ぜてよい。同じ名前の `styles/<name>.yaml` があっても、その場の定義が優先する）。定義は PNG の条件の `overrides.style_definition` に残り、顔を採用すれば表情・全身にも引き継がれる。気に入ったら zip（または辞書）を Claude に渡すと、`styles/<name>.yaml` にしてもらえる
   - **顔**: `forge.generate(CHARS, "face", n=4, style=STYLE, on_image=F.show_one)`。`CHARS` に並べたキャラクターをまとめて作り、1 枚できるたびに表示される。調整中は `n=2` など少なくし、気に入らなければ ■ で止めて作り直す（止めても、できた分は Drive に残る）。一気に作るときは `n=16` などにして、後から `P.pick(forge, char="knight", kind="face")`（そのキャラクター・種類の最新の候補。中断・切断の後も同じ。日時を決めるときは `run_id=` を足し、`P.pick(forge, run_id=None)` なら最新の日時の全部。古い `runs/<日時>/` のフォルダは `P.pick(forge, run_id="<日時>")` だけで開く。`char`・`kind` は書かない）で候補を開き直す。`P.pick(forge, paths)` の画面で、採用する顔のボタンを押す
   - **表情の範囲**: `P.edit_box(forge, CHAR)` が、採用した顔に目と口の赤枠を重ね、スライダーで動かして `selection.json` に保存する。キャラクターごとに表情を作る前に 1 回
   - **表情**: `forge.inpaint(CHAR, "hurt", n=4, on_image=F.show_one)` のあと `P.pick(forge, paths)`。採用した顔と決めた範囲を使うので、パスは書かない
   - **全身**: `forge.generate(CHARS, "fullbody", n=4, on_image=F.show_one)` のあと `P.pick(forge, paths)`
   - **まとめ**: `forge.pack()` が採用した絵を zip にして `packs/` に置く。続くセルでダウンロードする
3. 候補は `DRIVE_DIR`（このコピーでは Drive の `MyDrive/character-tactics/illust-asset-forge/`）の `runs/<キャラクター>/<種類>/<日時>/` に保存される

型 face は、**左向き**の頭から胸までの構図で作る。顔は常に左向きにそろえる。候補が右向きに出たときは、顔の候補の画面で「左右反転して採用」を押して左向きにする（反転は顔の元絵だけで、表情・全身には出ない）。画風は、次の順で決まる。

1. `style="<画風名>"`（または `STYLE`）を渡せば、その画風（一時的な差し替え。YAML は変わらない）
2. `character.yaml` に `style` があれば、その画風（そのキャラクターだけの上書き）
3. どちらも無ければ、`defaults.yaml` の `style`（デフォルト）

表情・全身は、採用した顔の画風を引き継ぐ（1 を渡したときを除く）。

試すときの引数（YAML は書き換えない）:

```python
forge.generate(CHARS, "face", extra="scar on cheek", remove="stubble")  # タグを足す・消す
forge.generate(CHARS, "face", extra="(stubble:1.3)")  # 設定と同じタグを重み付きで書くと置き換わる（remove は設定のタグにだけ効く）
forge.generate(CHARS, "face", extra_negative="hat", remove_negative="lowres")
forge.generate(CHARS, "face", seeds=[123, 456])  # シードを固定（n は無視される）
forge.generate(CHARS, "face", style="watercolor")  # 画風を差し替える
forge.generate(CHARS, "face", guidance=6, steps=30)  # inpaint は strength も
forge.adopt("<ファイル名>", flip=True)  # 画面を使わずに採用する（ファイル名は全 run から新しい順に探す。flip=True で左右反転）
```

YAML のタグにカンマを含む重み付きタグを書くときは、引用符で囲む（`"(a, b:1.1)"`）。囲まないと YAML が黙って割るので、カッコの対応が取れないタグは `ConfigError` で止まる。

**YAML は Colab で書き換えない。** Colab はリポジトリを GitHub から取るので、書き換えは GitHub に戻らず、次の pull でぶつかる。上書きした内容（画風の差し替えも含む）は PNG の条件に `overrides` として残るので、採用した絵を受け取った Claude が設定に戻す。表情の範囲も、`selection.json` で Claude に届く。

## 3. 採用した絵の渡し方

まとめのセルで `forge.pack()` が zip を作る。セルが自動でダウンロードするので、それをチャットに添付する。ダウンロードできなかったときは、Drive の `packs/` から取る。zip にするのは、PNG の条件（シードなど）が添付で消えたり、画像が縮められたりするのを避けるため。

## 4. Claude 側の流れ

1. `python -m artgen.intake <zip>` で、zip の中身を `characters/<id>/source/` に取り込む。`source/` は丸ごと置き換わり、検査に通らなければ何も書かれない。出力に、取り込んだ・消したファイルと、書き戻すもの（PNG の条件の `overrides`・`selection.json` の範囲 `inpaint_box`）の一覧が出る
2. 出力の一覧を `character.yaml` などの設定に戻す（`overrides` の `style` は `character.yaml` の `style` へ。ただし `defaults.yaml` の `style` と同じ画風なら、書かずに `character.yaml` の `style` を消してデフォルトに戻す。範囲は `inpaint_box` へ）
3. 必要なら `python -m artgen.pnginfo characters/<id>/source/*.png` で PNG の条件を確かめる
4. `face_crop` を決める（下の「顔の切り出し」。Claude が範囲を決め、承認用のページで依頼者の承認を受ける）。`python -m artgen.export <id>` で書き出す（顔は 256×256、`face_crop` があれば小さい顔 128×128 も。`params.json` を作る）
5. push は依頼者が頼んだときだけ行う

### 顔の切り出し（`face_crop`）

顔のテンプレートは「胸から上」（`upper body`）で写すので、元画像は頭の上に余白があり、顔は画面の一部になる。ゲームに渡す顔は、元画像から範囲を切り出して作る。範囲は `character.yaml` の `face_crop` に書く（元画像の画素の座標 `[x0, y0, x1, y1]`。正方形で、元画像の中）。

```yaml
face_crop:
  large: [x0, y0, x1, y1]   # 大きい顔（頭の全体＋首元）。64px の枠（会話・セリフ欄・カード）
  small: [x0, y0, x1, y1]   # 小さい顔（顔のアップ）。40px・32px の枠。省いてよい
  clear_colors:             # 省いてよい。外につながる白のほかに透明にする色
    - {min: 214, max_rg: 14, max_gb: 16}
```

- `python -m artgen.export <id>` が、範囲を切り出して背景を透明にし、`face.png`（256px）と `face-small.png`（128px。`small` があるとき）を RGBA で作る。表情（`face_<表情>.png`）も同じ範囲で作る。使った範囲は `params.json` の `face_crop` に残る。`face_crop` が無いキャラクターは、今までどおり元画像を丸ごと 256px に縮める（RGB。透明にしない）
- 透明にするのは、切り出した範囲の四辺から続く画素のうち、白（全チャンネル 240 以上）と `clear_colors` に当たるもの。範囲の内側にあって外につながらない白（白目・服の白）は残る
- **範囲の辺で服が切れていると、服の白が辺から塗りつぶされて透明になる**。`local/check/<id>/` の確認図（透明にした画素を赤で塗った絵）で、顔・服・鎧に赤が無いことを必ず見る
- `python -m artgen.crop_review <id>` が、承認用のページ `local/check/<id>/review.html` を作る（元画像に範囲の枠を描いた絵と枠なしの絵・確認図・64/40/32px での見え方。1 ファイル）。Claude が範囲を決め、このページを Artifact で見せて依頼者の承認を受ける
- 何人分かをまとめて承認してもらうときは `python -m artgen.crop_review <id> <id> ... [--out PATH]`。1 枚のページ（既定は `local/check/reviews/<日時>.html`）に人ごとの節（`名前（ID）`）を並べる。元画像は 512px・確認図は長辺 320px の JPEG に縮め、64/40/32px の見え方は書き出した PNG のまま（17 人でも 16MB に収まる）。全員を先に検査し、1 人でも書き出しが古ければページを作らず、その人を言って止まる
- 表情の範囲 `inpaint.box` の既定値（`templates/face.yaml`）は顔のアップのときの値で、胸から上の絵とは合わない。表情を作るときは、キャラクターごとに範囲を決める

## 5. 初めて Colab で動かすときの確認

GPU を使う部分は Claude が動かして確かめられない。次を 1 回ずつ実行して確かめる。

1. **準備・モデルのセル**: エラーなく終わり、`pipe` と `forge` ができる
2. **画風の見比べ・顔のセル**: 画像が 1 枚ずつ表示され、Drive の `runs/` に PNG ができる。顔の画面のボタンで採用でき、`selected/<id>/face.png` ができる。左向きの構図になっているか、画風の候補が見比べに足りるか
3. **範囲・表情のセル**: 赤枠を目と口に合わせられ、表情は目と口のあたりだけが変わり、境目が目立たない。`templates/face.yaml` の `inpaint.box` の初期値が合っているか
4. **全身のセル**: 832×1216 の全身絵が出て、ボタンで採用できる
5. **まとめのセル**: zip ができてダウンロードされる。Claude が `python -m artgen.intake` で取り込め、PNG の条件が残っている

## 6. ライセンスと再現の限界

- モデル `cagliostrolab/animagine-xl-4.0` は CreativeML Open RAIL++-M。ライセンスを出した側は生成物に権利を主張せず、商用利用も認められている。生成物の使い方の責任は使う側が負い、禁止用途には使えない。モデルを配らないので、ライセンスの写しを付ける決まりは関係しない（Hugging Face のモデルのページと SDXL の LICENSE.md、2026-11-21 取得。法律の専門家の判断ではない）
- 同じシードでも、GPU の種類やライブラリの版が変わると同じ絵にならないことがある。版を固定し条件を記録しても、完全な再現は保証できない。採用した元の画像を `source/` に残すのはそのため

## 7. テストの実行

```sh
uv venv .venv && uv pip install -e '.[dev]' && .venv/bin/pytest
```

`src/artgen/forge.py` の `load_pipeline()`・`attach()`・`show_one()`・`show()` だけが torch・diffusers を使う。`picker` のボタンの画面は ipywidgets（Colab には入っている）が要るが、torch は要らない。それ以外は、どちらが無くても動く。

## 8. コピーして使う

このリポジトリは、汎用の部品（エンジン・道具・画風・テンプレート）と見本だけを持つ。作品で使うときは、その作品のリポジトリへ**丸ごとコピー**し、コピーの中で作品のキャラクターを作る。

1. コピーした先の `notebooks/run.ipynb` の準備のセルで、4 つの変数をその作品の値に書き換える
   - `REPO_URL`: その作品のリポジトリ
   - `REPO_BRANCH`: Colab に取らせるブランチ（設定を直しても、そのブランチに入るまでは Colab に届かない）
   - `SUBDIR`: コピーを置いたフォルダ（例: `illust-asset-forge`）
   - `DRIVE_DIR`: **作品ごとに分ける**。同じ場所を使うと、別の作品の候補や採用した絵が混ざる
2. `tests/test_notebook.py` の既定値のテストを、書き換えた値に合わせる
3. コピー先のリポジトリ名・フォルダ名が禁止語（`tests/test_repo_configs.py` の `forbidden`）を含むときは、`test_repo_does_not_mention_the_game` が落ちる。このテストは `tests/` の外のファイル（ノートブックの `REPO_URL` など）を調べるので、手順 2 のテストを直しても解消しない。`forbidden` の一覧から外すか、禁止語を含まない名前にする（どちらにするかはコピーする側が決める）
4. 画風・テンプレート・道具を直したときは、コピー元へ戻す候補として控えておく。コピー元の改善は、必要なときに手で持ってくる（自動では届かない）

## 9. 見本の 4 人

`characters/` には、画風と構図の手本になる見本の 4 人だけを置く。作品のキャラクターは、コピーした先で作る。

| ID | 表示名 | 何の見本か |
|---|---|---|
| `knight` | 騎士 | 鎧と盾を持つ成人男性（持ち物あり） |
| `mage` | 魔法使い | ローブと杖の若い女性（持ち物あり） |
| `schoolboy` | 男子生徒 | 現代の制服（ブレザー）の男子。持ち物なし |
| `schoolgirl` | 女子生徒 | 現代の制服（ブレザー）の女子。持ち物なし |

4 人とも、`character.yaml` に `style`・`inpaint_box` は書かない（デフォルトの画風 thick-line-flat。表情の範囲は、表情を作るときに決める）。表情は `normal`・`hurt`・`shout` を定義している。絵は顔と全身の 8 枚だけで、表情は作っていない。顔は 4 人とも左向き。

### 見本の作り方（Colab）

1. 準備のセルの `REPO_BRANCH` を、絵を作るブランチにして実行する
2. 騎士・魔法使い（シードを固定して、同じ絵に近づける）:
   - 騎士の顔: `paths = forge.generate(["knight"], "face", seeds=[3034254740])` のあと `P.pick(forge, paths)` で採用する。顔は右向きに出るはずなので「左右反転して採用」を押す
   - 騎士の全身: `paths = forge.generate(["knight"], "fullbody", seeds=[3034254740])` のあと `P.pick(forge, paths)` で採用する（`paths` は全身の結果に入れ直す）
   - 魔法使いの顔: `paths = forge.generate(["mage"], "face", seeds=[3034254740])` のあと `P.pick(forge, paths)`（反転して採用）
   - 魔法使いの全身: `paths = forge.generate(["mage"], "fullbody", seeds=[4074111561])` のあと `P.pick(forge, paths)`
3. 男子生徒・女子生徒: 顔の候補を作り（`n=4` など）、選んで採用する（右向きなら反転する）。続けて全身の候補を作り、選んで採用する
4. 表情は作らない。採用した絵は Drive の `DRIVE_DIR/selected/<id>/` に入る

---

## 10. Modal で作る（量産）

顔グラ 26 枚のような量産は、Claude がこのサーバーから Modal の GPU（T4）で作る。依頼者は、候補のページ（Artifact）を見て番号で答えるだけ。Colab は、自分の手でタグを変えながら 1 枚ずつ試すとき（画風の調整など）に使う。

### 最初の一度

1. Modal のアカウントを作り（Starter）、管理画面で使う金額の上限を決める（任意）
2. `uv pip install -e '.[modal]'`（Modal のライブラリを venv に入れる）
3. このサーバーで、Claude が `.venv/bin/modal token new` を実行する。出た URL を依頼者がブラウザで開いて承認する。鍵は `~/.modal.toml` に入り、リポジトリには入らない

### 流れ（`illust-asset-forge/` で実行する）

1. ジョブのファイル（JSON の配列）を `local/jobs/` に書く。例: 顔の 2 案 × 4 枚

   ```json
   [
     {"char": "ally05", "template": "face", "seeds": [3034254740]},
     {"char": "ally05", "template": "face", "n": 3}
   ]
   ```

   キーは `char`・`template` と、`n`（枚数）か `seeds`（シードの一覧）のどちらか一方、任意で `extra`・`remove`・`extra_negative`・`remove_negative`・`guidance`・`steps`（`Forge.generate` の引数と同じ）。画風（`style`）は書けない。誤りは Modal を起動する前に、`ファイル名: [番号].キー: 理由` で止まる
2. `.venv/bin/python -m artgen.cloud generate --jobs local/jobs/<ファイル>.json` — Modal で作り、`local/runs/` に置き、回りの記録（`local/rounds/<日時>.json`）と候補のページ（同名の `.html`）を作る
   - Modal の 1 回は 1 時間で打ち切られ、その回の絵は全部失われる。1 回は 120 枚（10 人 × 12 枚）までにし、それより多いときはジョブのファイルを分けて同時に動かす。分けたら `.venv/bin/python -m artgen.cloud merge local/rounds/<a>.json local/rounds/<b>.json` で 1 つの記録（`local/rounds/merged_<日時>.json`）と 1 枚のページにまとめる。番号は通しで振り直し、元の記録は変えない。採用はまとめた記録の番号で行う
3. 候補のページを Artifact で依頼者に見せる。番号で答えてもらう
4. `.venv/bin/python -m artgen.cloud adopt local/rounds/<日時>.json <番号> [--flip]` で採用する（`--flip` は顔だけ左右反転する）。ページを作り直すときは `page <回りの記録>`
5. `.venv/bin/python -m artgen.cloud install <id>` で `characters/<id>/source/` に取り込む。`source/` は丸ごと置き換わるが、`local/selected/<id>/` に選び直した全身絵が無いときは、今の `source/fullbody.png` を持ち越す（Colab の道で採った全身絵を消さないため）。表情（`face_*.png`）は持ち越さない（顔が変わると検査で落ちる）。以降（書き戻し・`python -m artgen.export <id>`）は 4 の流れと同じ
6. 範囲を決めて承認を受ける: `character.yaml` に `face_crop` を書き（[顔の切り出し](#顔の切り出しface_crop)）、`.venv/bin/python -m artgen.export <id>` のあと `.venv/bin/python -m artgen.crop_review <id>` でページを作る。`local/check/<id>/review.html` を Artifact で依頼者に見せ、承認を受けてからゲームに入れる

`--root` は `cloud` の直後に置く（`cloud --root DIR adopt …`）。

### `local/` の中身（リポジトリに入れない）

| 場所 | 内容 |
|---|---|
| `local/runs/<キャラクター>/<種類>/<日時>/` | Modal で作った候補（Colab の `runs/` と同じ名前と形） |
| `local/selected/<id>/` | 採用した絵（`face.png`・`fullbody.png`） |
| `local/rounds/` | 回りの記録（`.json`）と候補のページ（`.html`） |
| `local/jobs/` | ジョブのファイル |

### 候補は全部見て選ぶ

候補のページには、作った候補を番号順に全部並べる。何人分かを 1 回で作ったときは、人ごとの見出し（`名前（ID）`）の下に並び、番号は通しになる。絵は長辺 320px の JPEG で埋め込む（200 枚でも 16MB に収まる）。頭が切れているか・背景がどうかを、画素を数えて機械的に外す仕組みは入れていない（2026-11-23 に試して、髪と鎧を区別できず、収まっている絵まで外したため。依頼者が全部を目で見て選ぶ）。

### GPU・版・料金

- GPU は T4 だけ。T4 でなければ絵を返さずに止める。同じシードでも GPU が違うと絵が変わるため
- 版は Colab と同じ（`torch` 2.14.1・`diffusers` 0.42.1・`transformers` 5.22.2。`src/artgen/modal_app.py`）。Colab 側の torch は固定していないので、Colab の版が変わったら Modal 側を合わせ直す
- 条件の `commit` は、このサーバーで調べた値を記録する。未コミットの変更があるときは `+dirty` が付く
- モデル（約 7GB）は Modal の Volume `character-tactics-illust-models` に置く。初回だけ取るので遅い
- T4 は 1 枚 20 秒ほど。12 枚の 1 回りでモデルの読み込みを含めて数分、10 円前後が見込み
