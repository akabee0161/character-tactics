# 顔グラを生成 AI で作る 工程 1（取り込み方式にする）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** illust-asset-forge（以下 forge）を汎用の見本 4 人だけを持つ形にし、ノートブックをコピー先から動かせるようにしたうえで、character-tactics に丸ごとコピーする。

**Architecture:** forge 側で、ノートブックの準備のセルに `REPO_URL`・`REPO_BRANCH`・`SUBDIR`・`DRIVE_DIR` を置き、キャラクターを汎用の見本 4 人に入れ替える。依頼者がその作業ブランチから Colab で見本 8 枚を作り、Claude が Google Drive のコネクターで取って取り込む。forge の PR のマージ後、character-tactics に `illust-asset-forge/` としてコピーし、`UPSTREAM.md` を置く（`pixel-asset-forge/` と同じ形）。

**Tech Stack:** Python 3（pytest・PyYAML・Pillow）、Jupyter ノートブック（Colab で実行）、git、Google Drive のコネクター（`download_file_content`）

**Spec:** `docs/superpowers/specs/2026-11-22-face-gen-ai-design.md`（character-tactics）

## Global Constraints

- forge に、ゲームの ID（`ally05`・`ally06` など）、見比べのときの仮の画風の名前（`tlf-r2-b` など）、ゲームのリポジトリの名前を残さない。設定・見本の PNG の条件・README・CLAUDE.md・HANDOVER のどこにも（`docs/superpowers/` のログは除く）
- 見本 4 人の ID は `knight`・`mage`・`schoolboy`・`schoolgirl`、表示名は 騎士・魔法使い・男子生徒・女子生徒
- 見本は 4 人 × 顔・全身 = 8 枚。表情は作らない。顔は 4 人とも左向き
- 騎士のシードは顔・全身とも 3034254740、魔法使いは顔 3034254740・全身 4074111561
- 4 人とも `character.yaml` に `style` も `inpaint_box` も書かない（デフォルトの thick-line-flat）
- ノートブックの変数の既定値（forge）: `REPO_URL = "https://github.com/akabee0161/illust-asset-forge.git"`、`REPO_BRANCH = "main"`、`SUBDIR = ""`、`DRIVE_DIR = "/content/drive/MyDrive/illust-asset-forge"`
- character-tactics のコピーの値: `REPO_URL = "https://github.com/akabee0161/character-tactics.git"`、`REPO_BRANCH = "develop"`、`SUBDIR = "illust-asset-forge"`、`DRIVE_DIR = "/content/drive/MyDrive/character-tactics/illust-asset-forge"`
- diffusers・torch・ipywidgets・IPython は関数の中でだけ import する（forge の CLAUDE.md）。テストはそれらが無くても動く
- push は依頼者が頼んだときだけ（forge の CLAUDE.md）。PR も依頼者の指示があったときだけ
- コミットは Conventional Commits + 日本語の要約
- forge のテスト: `cd illust-asset-forge && .venv/bin/pytest`（初回は `uv venv .venv && uv pip install -e '.[dev]'`）

## Review Focus

- `REPO_BRANCH` を変えて準備のセルを実行し直す → 古いブランチのままにならず、指定したブランチに切り替わってから pull される（Task 1 のテスト `test_prepare_cell_switches_branch_before_pull`）
- `/content/<clone 先>` に別のリポジトリの clone が残っている → 使い続けずに止まる（Task 1 のテスト `test_prepare_cell_refuses_other_repo_clone`）
- `SUBDIR` が空（forge 本体）でも `illust-asset-forge`（コピー）でも、`os.chdir`・`sys.path`・`pip install` が forge の根を指す（Task 1 のテスト `test_prepare_cell_uses_forge_root_everywhere`）
- Drive から取った PNG の条件の `character` が取り込み先の ID と違う → `install_selection` が `ConfigError` で止まり、何も書かない（既存の検査。Task 4 で止まったら依頼者に知らせる）
- forge の設定に `ally\d+` の ID や `tlf-` で始まる画風が紛れ込む → テストで落ちる（Task 2 のテスト `test_no_game_ids_or_trial_style_names`）

---

## forge（illust-asset-forge）側

作業場所: `/home/ubuntu/workspace/illust-asset-forge`、ブランチ `feat/generic-samples`（main から作る）

### Task 1: ノートブックの取得先・ブランチ・置き場を変数にする

**Files:**
- Modify: `notebooks/run.ipynb`（準備のセル = 最初のコードのセル、モデルの読み込みのセル）
- Modify: `tests/test_notebook.py`
- Modify: `README.md`（ノートブックの手順、コピーして使うときの説明）

**Interfaces:**
- Produces: 準備のセルの先頭の 4 つの代入 `REPO_URL`・`REPO_BRANCH`・`SUBDIR`・`DRIVE_DIR`（文字列リテラル）。forge の根を表す変数 `ROOT`（`os.path.join(<clone 先>, SUBDIR)`）。Task 5 でコピーの値に書き換える

- [ ] **Step 1: 失敗するテストを書く**（`tests/test_notebook.py`）

準備のセルは `code_cells()[1][0]`。テスト用に、準備のセルから `!` 行を除いて `ast.parse` し、モジュール直下の `Assign` を `{名前: リテラル値}` にする小さな関数 `prepare_assigns()` を足す。

```python
def test_prepare_cell_has_source_variables_with_forge_defaults():
    a = prepare_assigns()
    assert a["REPO_URL"] == "https://github.com/akabee0161/illust-asset-forge.git"
    assert a["REPO_BRANCH"] == "main"
    assert a["SUBDIR"] == ""
    assert a["DRIVE_DIR"] == "/content/drive/MyDrive/illust-asset-forge"

def test_notebook_passes_drive_dir_to_attach():
    _, cells = code_cells()
    code = "\n".join(cells)
    assert code.count("F.attach(") == code.count("base_dir=DRIVE_DIR")
    assert "illust-asset-forge.git" not in "\n".join(cells[1:])  # URL は準備のセルの変数だけ

def test_prepare_cell_switches_branch_before_pull():
    src = code_cells()[1][0]
    assert "REPO_BRANCH" in src
    assert src.index("checkout") < src.index("pull")  # 切り替えてから pull

def test_prepare_cell_refuses_other_repo_clone():
    src = code_cells()[1][0]
    assert "remote" in src and "get-url" in src and "raise" in src

def test_prepare_cell_uses_forge_root_everywhere():
    src = code_cells()[1][0]
    assert "os.chdir(ROOT)" in src
    assert '{ROOT}/requirements-colab.txt' in src and "-e {ROOT}" in src
    assert 'os.path.join(ROOT, "src")' in src
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `.venv/bin/pytest tests/test_notebook.py -v`
Expected: 新しい 5 件が FAIL（`KeyError: 'REPO_URL'` など）。既存のテストは PASS

- [ ] **Step 3: 準備のセルを書き換える**

先頭に 4 つの代入を置き、その下にコメントで「コピーして使うときはこの 4 つを書き換える」と書く。clone 先は `/content/` + `REPO_URL` の末尾のリポジトリ名（`.git` を除く）。clone 済みなら `git -C <clone 先> remote get-url origin` が `REPO_URL` と違うときに `RuntimeError` を raise し、同じなら `git fetch` → `git checkout REPO_BRANCH` → `git pull`。未 clone なら `git clone --branch REPO_BRANCH`。`ROOT = os.path.join(<clone 先>, SUBDIR)`（`SUBDIR` が空ならリポジトリの根）とし、`pip install`・`os.chdir`・`sys.path` は `ROOT` を使う。`F.attach(pipe, ".", base_dir=DRIVE_DIR)` は準備のセルとモデルの読み込みのセルの両方。出力と `execution_count` は空のまま（`test_notebook_has_no_outputs`）

- [ ] **Step 4: 通ることを確かめる**

Run: `.venv/bin/pytest -q`
Expected: 全件 PASS

- [ ] **Step 5: README を直す**

「1. 準備」の手順に 4 つの変数の意味を足す。新しい節「コピーして使う」: 各作品のリポジトリへ丸ごとコピーし、4 つの変数をそのリポジトリ・ブランチ・フォルダ・Drive の置き場に書き換える。`DRIVE_DIR` は作品ごとに分ける（候補が混ざらないように）。ゲームのリポジトリの名前は書かない

- [ ] **Step 6: コミット**

```bash
git add notebooks/run.ipynb tests/test_notebook.py README.md
git commit -m "feat: ノートブックの取得先・ブランチ・Drive の置き場を変数にし、コピーした先から動かせるようにする"
```

### Task 2: キャラクターを汎用の見本 4 人に入れ替える

**Files:**
- Delete: `characters/ally05/`（全部）、`characters/ally06/`（全部）
- Create: `characters/knight/character.yaml`・`characters/mage/character.yaml`・`characters/schoolboy/character.yaml`・`characters/schoolgirl/character.yaml`
- Modify: `notebooks/run.ipynb`（`CHAR = "ally05"`・`CHARS = ["ally05"]` を見本の ID に）
- Modify: `tests/test_repo_configs.py`
- Modify: `README.md`・`CLAUDE.md`・`HANDOVER.md`

**Interfaces:**
- Consumes: Task 1 の準備のセル
- Produces: 見本 4 人の ID（Task 3・4・5 が使う）

- [ ] **Step 1: 失敗するテストを書く**（`tests/test_repo_configs.py`）

```python
def test_sample_characters_are_the_four_generic_ones():
    assert CHARACTER_IDS == ["knight", "mage", "schoolboy", "schoolgirl"]

def test_no_game_ids_or_trial_style_names():
    assert not [c for c in CHARACTER_IDS if re.fullmatch(r"ally\d+", c)]
    styles = sorted(p.stem for p in (ROOT / "styles").glob("*.yaml"))
    assert not [s for s in styles if s.startswith("tlf-")]

def test_samples_have_no_style_or_inpaint_box(char_id):  # 既存の char_id のパラメータ化に合わせる
    data = yaml.safe_load((ROOT / "characters" / char_id / "character.yaml").read_text(encoding="utf-8"))
    assert "style" not in data and "inpaint_box" not in data
    assert set(data["expressions"]) == {"normal", "hurt", "shout"}
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `.venv/bin/pytest tests/test_repo_configs.py -v`
Expected: 新しいテストが FAIL（ID が `ally05`・`ally06`）

- [ ] **Step 3: 見本 4 人の設定を書き、ally05・ally06 を消す**

- `knight`: `name: 騎士`。`subject`・`appearance`・`outfit`・`items`・`default_expression`・`expressions` は今の `characters/ally05/character.yaml` をそのまま写す（`inpaint_box` は写さない）
- `mage`: `name: 魔法使い`。今の `characters/ally06/character.yaml` をそのまま写す
- `schoolboy`: `name: 男子生徒`、`subject: [1boy, solo, teenage boy]`、`appearance: [short hair, black hair, brown eyes]`、`outfit: [school uniform, blazer, white shirt, necktie, trousers]`、`items` は書かない（省略すると空。`config.py` の `r.tags("items", [])`）、`default_expression: normal`、`expressions` は ally06 と同じ（`normal: [calm, closed mouth]`・`hurt: [pain, clenched teeth, one eye closed, sweat]`・`shout: [shouting, open mouth]`）
- `schoolgirl`: `name: 女子生徒`、`subject: [1girl, solo, teenage girl]`、`appearance: [medium hair, brown hair, brown eyes]`、`outfit: [school uniform, blazer, white shirt, ribbon, pleated skirt]`、ほかは `schoolboy` と同じ
- `git rm -r characters/ally05 characters/ally06`
- ノートブックの `CHAR`・`CHARS` の例を `knight`・`["knight", "mage", "schoolboy", "schoolgirl"]` に

- [ ] **Step 4: 通ることを確かめる**

Run: `.venv/bin/pytest -q`
Expected: 全件 PASS（`test_all_characters_build_for_every_template_and_expression` が 4 人で通る）

- [ ] **Step 5: 騎士・魔法使いのプロンプトが、依頼者の選んだ 4 枚と同じことを確かめる**

画風を洗練したときの 4 枚の条件のプロンプトとネガティブ（設計書の表。Drive から取らずに、この計画の付録の値と比べる）と、`build_prompt(load_style(root, load_default_style(root)), load_template(root, tpl), load_character(root, cid))` の `positive`・`negative` が一致することを、使い捨てのスクリプトで確かめる（リポジトリには入れない）。Expected: 4 通りとも一致

- [ ] **Step 6: 文書を直す**

- README: 見本 4 人の節（ID・表示名・何の見本か）。ボルグ・セラ・`ally05`・`ally06` の記述を消すか見本の記述に直す。見本の作り方（下の Task 3 の手順）を書く
- CLAUDE.md「受け取った画像の扱い」に 1 行: 採用した絵は、zip の代わりに Google Drive のコネクター（`download_file_content`）で `DRIVE_DIR` の `selected/<id>/` から取ってもよい。取った絵を `selected/<id>/` の形に置いて `install_selection` で取り込む。1 枚ごとに絵が会話に入るので、取るのは採用した絵だけ
- HANDOVER: `## 進捗` を今の状態に。ボルグの書き戻しの注意など、ボルグ・セラの記述を消す（ゲームの名前は書かない）

- [ ] **Step 7: 残っていないことを確かめる**

Run: `git grep -nE "ally0[0-9]|tlf-r|ボルグ|セラ|character-tactics" -- . ':!docs/superpowers'`
Expected: 出力なし

- [ ] **Step 8: コミット**

```bash
git add -A characters notebooks/run.ipynb tests/test_repo_configs.py README.md CLAUDE.md HANDOVER.md
git commit -m "feat: キャラクターを汎用の見本 4 人（騎士・魔法使い・男子生徒・女子生徒）に入れ替える"
```

### Task 3: 依頼者が Colab で見本 8 枚を作る（チェックポイント）

- [ ] **Step 1: push してよいか依頼者に聞き、許可が出たら `git push -u origin feat/generic-samples`**
- [ ] **Step 2: 依頼者に手順を渡して止まる**

渡す手順（README の見本の節と同じ内容）:
1. 準備のセルの `REPO_BRANCH` を `"feat/generic-samples"` にして実行する
2. 騎士・魔法使い: `forge.generate(["knight"], "face", seeds=[3034254740])`・`forge.generate(["knight"], "fullbody", seeds=[3034254740])`・`forge.generate(["mage"], "face", seeds=[3034254740])`・`forge.generate(["mage"], "fullbody", seeds=[4074111561])`。それぞれ `P.pick(forge, paths)` で採用する。顔は右向きに出るはずなので「左右反転して採用」
3. 男子生徒・女子生徒: 顔の候補を作り（`n=4` など）、選んで採用する（右向きなら反転）。続けて全身の候補を作り、選んで採用する
4. 表情は作らない。zip も要らない。終わったら Claude に知らせる

依頼者から「終わった」と届くまで次へ進まない。

### Task 4: 見本 8 枚を取り込み、書き出す

**Files:**
- Create: `characters/{knight,mage,schoolboy,schoolgirl}/source/{face,fullbody}.png`、`characters/<id>/{face,fullbody}.png`・`params.json`（`export` の出力）

**Interfaces:**
- Consumes: Task 2 の ID、Task 3 で Drive の `DRIVE_DIR/selected/<id>/` にできた `face.png`・`fullbody.png`

- [ ] **Step 1: Drive から 8 枚を取る**

Google Drive のコネクターの `search_files` で `title = 'face.png'`・`title = 'fullbody.png'` の、`selected/<id>/` のフォルダにあるものを探し（親フォルダの名前が ID）、`download_file_content` で取る。保存された PNG を一時フォルダ `<tmp>/<id>/face.png`・`fullbody.png` に写す

- [ ] **Step 2: 条件を確かめる**

Run: `.venv/bin/python -m artgen.pnginfo <tmp>/*/*.png`
Expected: 8 枚とも、`character` が置いたフォルダの ID、`style` が `thick-line-flat`、`overrides` が空か画風を含まない。騎士・魔法使いの `seed` が Global Constraints の値。顔の 4 枚は `flipped: true` か、左向き（反転しなかったなら依頼者に理由を確かめる）

- [ ] **Step 3: 取り込む**

`install_selection(Path("."), Path("<tmp>"))` を呼ぶ（使い捨てのスクリプト）。書き戻しの一覧に画風が出ないこと。出たら止めて依頼者に知らせる。`ConfigError` で止まったら、その文を依頼者に知らせる

- [ ] **Step 4: 書き出す**

Run: `for id in knight mage schoolboy schoolgirl; do .venv/bin/python -m artgen.export $id || break; done`
Expected: 4 人とも通り、`characters/<id>/face.png`（256×256）・`fullbody.png`・`params.json` ができる

- [ ] **Step 5: 騎士・魔法使いを前の絵と並べて見せる**

作り直した顔・全身（4 枚）と、画風を洗練したときの 4 枚（Drive のファイル ID は設計書の表。前の顔は反転して並べる）を、PNG を data URI で埋め込んだ HTML にして Artifact で公開し、依頼者に見せる。制服の 2 人の採用した絵も同じページに並べる。大きく違っても作り直すかは依頼者が決める

- [ ] **Step 6: テストとコミット**

Run: `.venv/bin/pytest -q` → 全件 PASS

```bash
git add characters
git commit -m "feat: 見本 4 人の顔と全身を取り込み、書き出す"
```

- [ ] **Step 7: 依頼者の指示があれば push して main への PR を作る**（PR の説明に、Colab で確かめた範囲と、確かめていないことを書く）

## character-tactics 側

作業場所: `/home/ubuntu/workspace/character-tactics`、ブランチ `feat/face-gen-ai`（develop から作成済み。設計書・計画はここにコミット済み）。**forge の PR が main にマージされてから始める**

### Task 5: forge をコピーし、character-tactics 向けにする

**Files:**
- Create: `illust-asset-forge/`（forge の main の追跡ファイル。`HANDOVER.md`・`docs/superpowers/` は除く）
- Create: `illust-asset-forge/UPSTREAM.md`
- Create: `illust-asset-forge/characters/ally05/character.yaml`・`illust-asset-forge/characters/ally06/character.yaml`
- Modify: `illust-asset-forge/notebooks/run.ipynb`・`illust-asset-forge/tests/test_notebook.py`・`illust-asset-forge/tests/test_repo_configs.py`・`illust-asset-forge/CLAUDE.md`

**Interfaces:**
- Consumes: forge の main（Task 1〜4 のマージ後）の commit
- Produces: `illust-asset-forge/` のコピー（Task 6 の文書が指す）

- [ ] **Step 1: コピーする**

```bash
git -C ../illust-asset-forge fetch origin && git -C ../illust-asset-forge archive origin/main | tar -x -C illust-asset-forge --exclude=HANDOVER.md --exclude='docs/superpowers'
```
（`illust-asset-forge/` を先に作る。コピー元の commit は `git -C ../illust-asset-forge rev-parse origin/main`）

- [ ] **Step 2: `UPSTREAM.md` を書く**

`pixel-asset-forge/UPSTREAM.md` と同じ形: このフォルダは illust-asset-forge のコピーでこのゲーム専用に自由に直してよい／コピー元 `https://github.com/akabee0161/illust-asset-forge.git`・commit（Step 1 の値）・コピーした日／forge の改善を取り込む仕組みは無く、要るものは手で持ってくる／「forge に戻す候補」の欄（初めは空）／「このゲームだけの変更」の欄に、Step 3〜5 の変更を 1 行ずつ

- [ ] **Step 3: ノートブックの 4 つの変数を character-tactics の値にし、`tests/test_notebook.py` の既定値のテストをその値に合わせる**（値は Global Constraints）
- [ ] **Step 4: ボルグ・セラの設定を置く**

`git -C ../illust-asset-forge show 9627e8d:characters/ally05/character.yaml` と `...ally06/character.yaml` の中身を `illust-asset-forge/characters/ally05/`・`ally06/` に置く。ally05 の `inpaint_box` の行は消す。絵は置かない。コピーの `tests/test_repo_configs.py` の `test_sample_characters_are_the_four_generic_ones` と `test_no_game_ids_or_trial_style_names` の ID の部分は、このゲームでは当てはまらないので、見本 4 人が含まれることと `tlf-` の画風が無いことだけを見るように直す

- [ ] **Step 5: コピーの `CLAUDE.md` を直す**

「リポジトリにゲーム側の事情（…）や、ゲームのリポジトリの名前を書かない」の行を、「このコピーは character-tactics 専用。ゲーム側の事情を書いてよい。エンジン・道具・画風・テンプレートを直したら `UPSTREAM.md` に 1 行足す」に書き換える

- [ ] **Step 6: テストと確認**

Run: `cd illust-asset-forge && uv venv .venv && uv pip install -e '.[dev]' && .venv/bin/pytest -q`
Expected: 全件 PASS
Run: `.venv/bin/python -m artgen.pnginfo characters/knight/source/face.png && .venv/bin/python -m artgen.export knight`
Expected: 条件が読め、書き出しが通る（書き出した結果が変わらないこと: `git status --short illust-asset-forge/characters/knight` が空）
Run: `git status --short | grep -E "\.venv|__pycache__|egg-info|pytest_cache"`
Expected: 出力なし（コピーした `.gitignore` が効いている）

- [ ] **Step 7: コミット**

```bash
git add illust-asset-forge
git commit -m "feat: illust-asset-forge をコピーし、ノートブックとボルグ・セラの設定を character-tactics 向けにする"
```

### Task 6: 正典を直す

**Files:**
- Modify: `README.md`（構成の表、「顔グラの例外」、イラストの作りかたの節）
- Modify: `CLAUDE.md`
- Modify: `HANDOVER.md`（`## 進捗`）

- [ ] **Step 1: README を直す**

- 構成の表に `| \`illust-asset-forge/\` | 顔グラなどのイラストを Colab で生成する道具（forge のコピー。「イラストの作りかた」） |` を足す（`pixel-asset-forge/` の行の下）
- 「顔グラの例外」の元画像の場所 `characters/ally05/source/face.png` を、illust-asset-forge の commit `9627e8d` の同じパス（`https://github.com/akabee0161/illust-asset-forge/blob/9627e8d/characters/ally05/source/face.png`）に直す
- 「ドット絵の作りかた」の後に節「イラストの作りかた」: 顔グラなどのイラストは `illust-asset-forge/` で作る／forge のコピーで自由に直してよい、コピー元と戻す候補は `illust-asset-forge/UPSTREAM.md`／使い方は `illust-asset-forge/README.md`、作業規約は `illust-asset-forge/CLAUDE.md`／Colab は character-tactics の develop を取るので、設定の変更は develop にマージするまで Colab に届かない／テストは `cd illust-asset-forge && .venv/bin/pytest`

- [ ] **Step 2: CLAUDE.md に節「イラストの道具」**: `illust-asset-forge/` の作業は `illust-asset-forge/CLAUDE.md` に従う。エンジン・道具・画風・テンプレートを直したら `illust-asset-forge/UPSTREAM.md` に 1 行足す
- [ ] **Step 3: HANDOVER の `## 進捗` を、工程 1 を完了・工程 2 を「今ここ」にする**
- [ ] **Step 4: 確認**

Run: `npm test`
Expected: PASS（ゲームのコードは変えていない）
Run: `grep -n "illust-asset-forge" README.md CLAUDE.md`
Expected: 構成の表・顔グラの例外・イラストの作りかた・CLAUDE.md の節が出る

- [ ] **Step 5: コミット**

```bash
git add README.md CLAUDE.md HANDOVER.md
git commit -m "docs: illust-asset-forge のコピーの使い方と、顔グラの例外の元画像の場所を正典に書く"
```

- [ ] **Step 6: 依頼者の指示があれば push して develop への PR を作る**（`.github/pull_request_template.md` の 5 項目）

## 付録: 騎士・魔法使いの元の 4 枚のプロンプト（Task 2 Step 5 で比べる）

画風を洗練したときの 4 枚（commit c4602a6 で生成）の条件。2026-11-22 に、今の設定で組み直した `positive`・`negative` と完全に一致することを確かめた。Task 2 で写した後の `knight`・`mage` でも同じになるはず。

- 騎士・顔 `positive`: `1boy, solo, adult, mature male, muscular, broad shoulders, square jaw, short hair, dark reddish brown hair, slicked back hair, stubble, brown eyes, thick eyebrows, dark grey armor, gold trim, steel shoulder armor, breastplate, gauntlets, portrait, looking to the side, simple background, white background, serious, closed mouth, thick outlines, flat color, limited palette, bold lineart, simple shading, masterpiece, high score, great score, absurdres`
- 騎士・全身 `positive`: 顔の `portrait, looking to the side` の代わりに、`gauntlets` の後へ `large shield, holding shield, full body, standing, front view, looking at viewer`（以降は顔と同じ）
- 魔法使い・顔 `positive`: `1girl, solo, young woman, long hair, purple hair, purple eyes, purple robe, long sleeves, hooded cape, portrait, looking to the side, simple background, white background, calm, closed mouth, thick outlines, flat color, limited palette, bold lineart, simple shading, masterpiece, high score, great score, absurdres`
- 魔法使い・全身 `positive`: `hooded cape` の後へ `holding staff, full body, standing, front view, looking at viewer`（以降は顔と同じ）
- `negative` は 4 枚とも `styles/thick-line-flat.yaml` の `negative` にテンプレートの `negative` を足したもの（顔: `full body, cowboy shot, upper body, from behind, profile, head out of frame, cropped head`、全身: `close-up, portrait, cropped legs, out of frame`）
