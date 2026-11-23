# 残りの顔グラ 29 枚 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 残りの顔 29 枚を illust-asset-forge の生成イラストに替えてゲームに入れる。敵の顔は「性別と頭の形」の括りにする。

**Architecture:** 先に道具を 3 つ直す（候補のページの見出しと JPEG、回りをまとめる `cloud merge`、承認用のページの複数指定）。ゲーム側は敵の顔のそろいのテストを緩め、仮の絵の生成器が顔を書かないようにする。そのあと 2 組それぞれで「設定 → Modal で生成 → 依頼者が選ぶ → 範囲 → 依頼者が承認 → ゲームに入れる」を回す。

**Tech Stack:** Python 3（`illust-asset-forge/`、pytest、Pillow、Modal の T4）、TypeScript（Vitest）、Node（`tools/`）

**Spec:** `docs/superpowers/specs/2026-11-23-face-remaining-design.md`

## Global Constraints

- GPU は T4 だけ。別の GPU に替えない
- 候補・確認図・ページは `illust-asset-forge/local/` に置き、リポジトリに入れない。絵は HTML のページにして Artifact で見せる
- 候補は依頼者が全部を目で見て選ぶ。Claude は機械的にも目でも外さない
- 依頼者は番号だけを答える。右向きの絵は Claude が `--flip` で採用する。依頼者が「反転して」と言ったらそれに従う
- 顔と服以外の背景は透明。確認図（`local/check/<id>/`）で顔・服・鎧に赤が無いことを Claude が必ず見る
- Modal の 1 回は 120 枚（10 人 × 12 枚）までにする（上限 1 時間、時間切れでその回の絵は全部失われる）
- 1 人 12 枚（`n: 12`）。`style` は書かない。表情は作らないが `normal`・`hurt`・`shout` を書く
- エンジン・道具・テンプレートを直したら `illust-asset-forge/UPSTREAM.md` に 1 行足す
- コミットは Conventional Commits + 日本語。push と PR は依頼者が頼んだときだけ（PR は develop 向け、`.github/pull_request_template.md` の 5 項目）
- 依頼者の承認（候補の番号・承認用のページ）を待つ所では止まる。承認前にコミット・ゲームへの取り込みへ進まない
- 敵の顔の ID と割り当ては設計書の「敵の顔の括り」の表のとおり

## Review Focus

- 2 回に分けた Modal の結果をまとめたページで、番号と絵の対応がずれる → `cloud merge` の番号は通しで、元の記録は変えない（Task 2 のテスト）
- 承認用のページを 17 人分まとめたとき、1 人だけ古い書き出しが混ざる → 1 人でも古ければページを作らず、その ID を言って止まる（Task 3 のテスト）
- 候補のページが 200 枚で Artifact の上限 16MB を超える → サムネイルは JPEG。実物の大きさは Task 6 で `ls -l` を見る（Task 1 のテストは 1 枚の大きさの上限）
- 敵の JSON の顔を括りに替えたあと、同じ種類の強さなどの食い違いを見逃す → `face`・`faceSmall` だけを比べる対象から外し、それ以外の比較は残す（Task 4）
- 仮の絵の生成器を後で走らせて新しい顔を上書きする → 生成器が顔を書かない（Task 4）

---

### Task 1: 候補のページを人ごとの見出しと JPEG にする

**Files:**
- Modify: `illust-asset-forge/src/artgen/review_page.py`
- Modify: `illust-asset-forge/src/artgen/cloud.py`（`cmd_generate`・`cmd_page` が `root` を渡す）
- Test: `illust-asset-forge/tests/test_review_page.py`
- Modify: `illust-asset-forge/UPSTREAM.md`・`illust-asset-forge/README.md`（10 の流れの 3）

**Interfaces:**
- Produces: `build_page(round_: Round, out_path: Path, root: Path | None = None) -> Path`。`root` があれば見出しに `character.yaml` の `name` を出す（読めなければ ID だけ）

- [ ] **Step 1: テストを書く**（既存の `test_page_embeds_small_images_and_title` の `data:image/png` の数え方を JPEG に直す）

```python
def test_page_groups_candidates_by_character_with_name(repo, tmp_path):
    # c1 と c2 の候補を 1 回りに混ぜる（cloud_helpers.make_candidates に c2 を足すか、make_forge で作る）
    html = build_page(round_with_c1_c2, tmp_path / "p.html", root=repo).read_text(encoding="utf-8")
    assert html.count("<h2") == 2
    assert html.index("（c1）") < html.index("1 番")          # 見出しの下に候補
    assert html.index("（c2）") < html.index(f"{n_c1 + 1} 番")  # 番号は通し
    assert "<details" not in html

def test_page_thumbnails_are_jpeg_and_small(repo, tmp_path):
    html = build_page(make_round(repo), tmp_path / "p.html").read_text(encoding="utf-8")
    assert len(re.findall(r"data:image/jpeg;base64,", html)) == 3
    assert "data:image/png" not in html
    for uri in re.findall(r'src="(data:image/jpeg;base64,[^"]+)"', html):
        assert len(uri) < 80_000   # 210 枚で 16MB に収まる大きさ

def test_page_heading_falls_back_to_id_without_root(repo, tmp_path):
    html = build_page(make_round(repo), tmp_path / "p.html").read_text(encoding="utf-8")
    assert "c1" in html
```

- [ ] **Step 2: 落ちることを確かめる** — `cd illust-asset-forge && .venv/bin/pytest tests/test_review_page.py -v` が FAIL
- [ ] **Step 3: 実装する** — 候補を条件の `character` ごとに、最初に出た順でまとめ、`<h2>{name}（{id}）</h2>` の下に今の `grid` を置く。サムネイルは長辺 `THUMB` の RGB を JPEG（quality 80）にする。`cloud.py` の 2 か所は `build_page(..., root=root)` にする
- [ ] **Step 4: 通ることを確かめる** — `.venv/bin/pytest tests/test_review_page.py tests/test_cloud.py -v` が PASS
- [ ] **Step 5: UPSTREAM.md に 1 行（forge 本体に戻す候補）、README に「候補は人ごとの見出しの下に並ぶ」を書き、コミット** — `feat: 候補のページを人ごとの見出しで分け、サムネイルを JPEG にする`

### Task 2: 回りをまとめる `cloud merge`

**Files:**
- Modify: `illust-asset-forge/src/artgen/cloud.py`
- Test: `illust-asset-forge/tests/test_cloud.py`
- Modify: `illust-asset-forge/UPSTREAM.md`・`illust-asset-forge/README.md`（10 の流れ）

**Interfaces:**
- Consumes: `new_round`・`read_round`・`unused_run_id`（`rounds.py`）、Task 1 の `build_page(..., root=)`
- Produces: `python -m artgen.cloud merge ROUND_JSON ROUND_JSON [...]`。`local/rounds/merged_<YYYYmmdd_HHMMSS>.json` と同名の `.html` を作り、そのパスを出力する。番号は 1 つ目の記録の候補から順に通しで振り直す。元の記録は変えない。`adopt` はまとめた記録を受け取る

- [ ] **Step 1: テストを書く**

```python
def test_merge_renumbers_in_order_and_keeps_originals(cli_env, capsys):
    r1, r2 = two_rounds(cli_env)            # 候補 3 枚と 2 枚
    before = (r1.read_text(), r2.read_text())
    assert main(["--root", str(cli_env), "merge", str(r1), str(r2)]) == 0
    merged = only_new_round(cli_env, "merged_")
    data = read_round(merged)
    assert [c.number for c in data.candidates] == [1, 2, 3, 4, 5]
    assert [c.path for c in data.candidates] == [*paths_of(r1), *paths_of(r2)]
    assert merged.with_suffix(".html").is_file()
    assert (r1.read_text(), r2.read_text()) == before

def test_merge_then_adopt_uses_merged_number(cli_env):
    # まとめた記録の 4 番 = 2 つ目の記録の 1 番を採用する
    ...
    assert adopted_file_bytes == bytes_of(paths_of(r2)[0])

def test_merge_missing_round_is_one_line(cli_env, capsys):
    assert main(["--root", str(cli_env), "merge", "nope.json", "nope2.json"]) == 1
    assert capsys.readouterr().out.startswith("止まった:")

def test_merge_needs_two_rounds(cli_env, capsys):
    # 引数が 1 つなら argparse ではなく ConfigError で 1 行（「2 つ以上」）
```

- [ ] **Step 2: 落ちることを確かめる** — `.venv/bin/pytest tests/test_cloud.py -k merge -v` が FAIL
- [ ] **Step 3: `cmd_merge(args)` を実装し、`merge` のサブコマンド（`rounds` は `nargs="+"`）を足す** — 候補のパスを順につなげて `new_round(dirs.rounds, unused_run_id(dirs.rounds, "merged_" + 日時), paths)`、続けて `build_page(..., root=root)`
- [ ] **Step 4: 通ることを確かめる** — `.venv/bin/pytest -q` が全部 PASS
- [ ] **Step 5: UPSTREAM.md・README（2 回に分けたら `merge` でまとめて 1 枚のページにする）を書き、コミット** — `feat: 回りの記録をまとめる cloud merge を足す`

### Task 3: 承認用のページに複数の人をまとめる

**Files:**
- Modify: `illust-asset-forge/src/artgen/crop_review.py`
- Test: `illust-asset-forge/tests/test_crop_review.py`
- Modify: `illust-asset-forge/UPSTREAM.md`・`illust-asset-forge/README.md`（顔の切り出し）・`illust-asset-forge/CLAUDE.md`（書き出しの行）

**Interfaces:**
- Produces: `build_reviews(root: Path, char_ids: list[str], out: Path | None = None) -> Path`。既定の `out` は `local/check/reviews/<YYYYmmdd_HHMMSS>.html`。`build_review(root, char_id)`（1 人）は今のまま
- CLI: `python -m artgen.crop_review ID [ID ...] [--out PATH]`。ID が 1 つなら `build_review`、2 つ以上なら `build_reviews`

- [ ] **Step 1: テストを書く**（`cropped_repo` に c2 を足す fixture を作る）

```python
def test_reviews_one_section_per_character(two_exported):
    out = build_reviews(two_exported, ["c1", "c2"], two_exported / "local/check/reviews/t.html")
    html = out.read_text(encoding="utf-8")
    assert html.count("<section") == 2 and "（c1）" in html and "（c2）" in html
    assert html.count("data:image/jpeg;base64,") == 8   # 1 人 4 枚（枠あり・枠なし・確認図 2）
    assert html.count("data:image/png;base64,") == 6    # 1 人 3 枚（64・40・32、書き出した PNG）

def test_reviews_stop_if_any_export_is_stale(two_exported):
    write(two_exported, "characters/c2/character.yaml", ...範囲を変える...)
    with pytest.raises(ExportError, match="c2"):
        build_reviews(two_exported, ["c1", "c2"], two_exported / "local/check/reviews/t.html")
    assert not (two_exported / "local/check/reviews/t.html").exists()

def test_reviews_are_small_enough(two_exported):
    out = build_reviews(two_exported, ["c1", "c2"], two_exported / "local/check/reviews/t.html")
    assert out.stat().st_size < 2 * 900_000   # 17 人で 16MB に収まる目安

def test_cli_single_id_keeps_old_page(exported_repo):
    assert main([ "c1", "--root", str(exported_repo)]) == 0
    assert (exported_repo / "local/check/c1/review.html").is_file()
```

- [ ] **Step 2: 落ちることを確かめる** — `.venv/bin/pytest tests/test_crop_review.py -v` が FAIL
- [ ] **Step 3: 実装する** — 今の `build_review` の中身を「検査して部品を返す」関数と「1 人のページを書く」に分け、`build_reviews` は全員の検査を先に済ませてから書く。複数のページでは、元画像の 2 枚は 512px、確認図は長辺 320px に縮めて JPEG（quality 85）。64・40・32px は書き出した PNG をそのまま使う。節の見出しは `{name}（{id}）`、範囲の座標も節ごとに出す
- [ ] **Step 4: 通ることを確かめる** — `.venv/bin/pytest -q` が全部 PASS
- [ ] **Step 5: UPSTREAM.md（このゲームだけの変更。顔の構図は forge 本体に戻さない）・README・CLAUDE.md を書き、コミット** — `feat: 承認用のページに複数の人をまとめられるようにする`

### Task 4: ゲーム側の準備（敵の顔のそろい・仮の絵の生成器）

**Files:**
- Modify: `src/engine/enemy-looks.test.ts`
- Modify: `tools/gen-placeholder-sprites.mjs`
- Modify: `README.md`（仮の絵の作り直しの行）

- [ ] **Step 1: `stripLook` で `sprites.face`・`sprites.faceSmall` も消す**（テストの名前を「id・sprites.map.sheet・color・顔 以外が一致する」に直す）
- [ ] **Step 2: `npm test -- enemy-looks` が PASS（今の JSON のままでも通る）**
- [ ] **Step 3: 生成器から顔を書く処理を消す** — `CHARS` のループは `-map.png` だけ書く。`NPCS` と `faceFor` を消し、`known` から村人の ID を外す（村人の ID を渡すと「知らない ID」で止まる）
- [ ] **Step 4: 確かめる** — `node tools/gen-placeholder-sprites.mjs npc01` が終了コード 1 で「知らない ID」。`git status` で `assets/images/` が変わっていない。README の「仮の絵の作り直し」から顔の分を消し、生成器は顔を書かないと 1 行書く
- [ ] **Step 5: `npm test`・`npm run build` が通り、コミット** — `chore: 顔を生成イラストに替えるため、敵の顔のそろいを見ず、仮の絵の生成器が顔を書かないようにする`

### Task 5: 組 1 の設定（17 人の `character.yaml`）

**Files:**
- Create: `illust-asset-forge/characters/{roran,ines,gau,mist,garum,tatemochi,majinaishi,enemy-m-thug,enemy-m-bandit,enemy-m-horn,enemy-f-thug,enemy-f-bandit,enemy-f-horn,ally07,ally08,ally09}/character.yaml`
- Modify: `illust-asset-forge/characters/ally06/character.yaml`（必要なら）

- [ ] **Step 1: 材料を見る** — 主人公・ガルムは `assets/images/<id>-face.png`・`<id>-map.png` と `pixel-asset-forge/types/unit/SPEC.md` の各節。敵は括りごとの代表のマップの絵（設計書の表の 1 つ目の JSON の ID の `-map.png`）
- [ ] **Step 2: 書く** — 形は `characters/ally05/character.yaml` にならう（`name`・`subject`・`appearance`・`outfit`・`items`・`default_expression: normal`・表情 3 つ）。`name` はゲームの名前（敵は「ならず者（男・とがった髪）」など括りが分かる名前）。仲間 ally07〜09 は設計書の表、敵は人相を悪くするタグ、盾持ち・ガルムは兜で顔を覆うタグ
- [ ] **Step 3: 確かめる** — `cd illust-asset-forge && .venv/bin/pytest tests/test_repo_configs.py -q` が PASS（17 人とも全テンプレート・全表情で組める）
- [ ] **Step 4: コミット** — `feat: 組 1（主人公・ガルム・敵・仲間 ally06〜09）の顔の設定を足す`

### Task 6: 組 1 を生成し、依頼者が選ぶ

**Files:**
- Create: `illust-asset-forge/local/jobs/group1-a.json`（9 人）・`group1-b.json`（8 人）（リポジトリに入れない）

- [ ] **Step 1: ジョブを書く** — 各人 `{"char": "<id>", "template": "face", "n": 12}`
- [ ] **Step 2: 2 回を同時に動かす** — `cd illust-asset-forge && .venv/bin/python -m artgen.cloud generate --jobs local/jobs/group1-a.json` と `-b` を別々にバックグラウンドで実行。両方が「N 枚できた」を出し、条件の `gpu` が `Tesla T4`
- [ ] **Step 3: まとめる** — `.venv/bin/python -m artgen.cloud merge local/rounds/<a>.json local/rounds/<b>.json`。`ls -l` でページが 16MB 未満
- [ ] **Step 4: ページを Artifact で見せ、依頼者が人ごとに番号を答えるまで止まる**
- [ ] **Step 5: 採用する** — 人ごとに `cloud adopt local/rounds/merged_<日時>.json <番号>`、右向きは `--flip`。合う絵が無いと言われた人は、タグを直して 1 人だけもう 1 回り作り、Step 4 へ（ほかの人は先へ進めてよい）
- [ ] **Step 6: 取り込む** — `.venv/bin/python -m artgen.cloud install <組 1 の全 ID>`。出力の書き戻しの一覧を確かめる（上書き無しのジョブなので空のはず）

### Task 7: 組 1 の範囲を決め、依頼者が承認する

**Files:**
- Modify: 組 1 の各 `illust-asset-forge/characters/<id>/character.yaml`（`face_crop`）

- [ ] **Step 1: 人ごとに範囲を決めて書く** — `large` は頭の全体（ガルム・盾持ちは兜の全体）と首元、`small` は顔のアップ。正方形、元画像の中。飾りの色が残る人だけ `clear_colors`
- [ ] **Step 2: 書き出す** — 人ごとに `.venv/bin/python -m artgen.export <id>`
- [ ] **Step 3: 確認図を自分で見る** — `local/check/<id>/face-large.png`・`face-small.png` で顔・服・鎧に赤が無い。あれば Step 1 に戻る
- [ ] **Step 4: まとめた承認用のページを作る** — `.venv/bin/python -m artgen.crop_review <組 1 の全 ID>`。16MB 未満
- [ ] **Step 5: Artifact で見せ、依頼者の承認まで止まる。直す点がある人だけ Step 1 へ**
- [ ] **Step 6: コミット**（`source/`・書き出し・`params.json`・`character.yaml`） — `feat: 組 1 の顔を生成イラストで作る`

### Task 8: 組 1 をゲームに入れる

**Files:**
- Modify: `assets/images/{roran,ines,gau,mist,garum,tatemochi,majinaishi,ally06,ally07,ally08,ally09}-face.png`、Create: 同じ ID の `-face-small.png`、Create: `assets/images/enemy-{m,f}-{thug,bandit,horn}-face.png`・`-face-small.png`
- Delete: `assets/images/narazumono-face.png`・`yumihei-face.png`
- Modify: `assets/units/{roran,ines,gau,mist,ally06,ally07,ally08,ally09}.json`、`assets/enemies/*.json`（`ally06-foe`・`ally08-foe` を含む）

- [ ] **Step 1: 画像を写す** — `illust-asset-forge/characters/<id>/face.png` → `assets/images/<id>-face.png`、`face-small.png` → `<id>-face-small.png`
- [ ] **Step 2: JSON を直す** — `sprites.faceSmall` を足す。敵は設計書の表のとおり `face`・`faceSmall` を括りの画像にする（ならず者・弓兵の 17 ファイル）。説得の相手は仲間と同じ画像
- [ ] **Step 3: 使わない顔を消す** — `git rm assets/images/narazumono-face.png assets/images/yumihei-face.png`。`grep -rn "narazumono-face\|yumihei-face" assets src` が空
- [ ] **Step 4: `npm test`・`npm run build` が通る**
- [ ] **Step 5: ブラウザで見る**（README の CDP 手順）— 会話かカード（64px）・下のバー（40px）・仲間一覧（32px）で、ロラン・ガウ・ならず者 2 体（違う括り）・ガルムの顔。撮った絵を Artifact で見せる
- [ ] **Step 6: コミット** — `feat: 組 1 の顔をゲームに入れ、敵の顔を性別と頭の形の括りにする`

### Task 9: 組 2（ally10〜15・npc01〜06）

Task 5〜8 と同じ手順を組 2 の 12 人で行う。違うところだけ書く。

- [ ] **Step 1: 設定** — 12 人の `character.yaml`（設計書の 16 人の表）。組 1 で効いたタグ・効かなかったタグを反映する。`tests/test_repo_configs.py` が PASS。コミット `feat: 組 2（仲間 ally10〜15・村人）の顔の設定を足す`
- [ ] **Step 2: 生成と選択** — `group2-a.json`（6 人）・`group2-b.json`（6 人）を同時に動かし、`merge`、Artifact、依頼者の番号まで止まる、`adopt`・`install`
- [ ] **Step 3: 範囲と承認** — Task 7 と同じ。承認まで止まる。コミット `feat: 組 2 の顔を生成イラストで作る`
- [ ] **Step 4: ゲームに入れる** — 画像を写し、`assets/units/ally1{0..5}.json`・`assets/npcs/npc0{1..6}.json` に `faceSmall`。`npm test`・`npm run build`。ブラウザで仲間 2 人と村の会話の村人 1 人を見て Artifact で見せる。コミット `feat: 組 2 の顔をゲームに入れる`

### Task 10: 正典と引き継ぎ

**Files:**
- Modify: `README.md`・`HANDOVER.md`・`illust-asset-forge/README.md`（必要なら）
- Create: `docs/superpowers/ledgers/2026-11-23-face-remaining.md`

- [ ] **Step 1: README（ゲーム）** — 「顔グラの例外」をボルグだけの例外から「顔グラは illust-asset-forge の生成イラスト（大きい顔 256px・小さい顔 128px）」に書き直す。敵の顔は括りごと（表へのリンクは設計書）。村人の顔が仮の絵という記述（「村と説得」・「村人」）、アセットの大きさの表の顔グラの行と「ドット絵は 128px」を今の状態に直す
- [ ] **Step 2: `grep -n "仮の絵\|ドット絵の顔\|顔は今は" README.md` で残りを確かめる**
- [ ] **Step 3: HANDOVER.md の `## 進捗`** を工程 5 の完了に直し、結果（効いたタグ・作り直した人・確かめていないこと）を書く
- [ ] **Step 4: 台帳を `docs/superpowers/ledgers/2026-11-23-face-remaining.md` に写す**
- [ ] **Step 5: `npm test`・`cd illust-asset-forge && .venv/bin/pytest -q` が通り、コミット** — `docs: 顔グラを生成イラストに替えたことを正典と引き継ぎに書く`
