# 表示の大きさと顔の構図（工程 4）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 顔を「胸から上」で作り、1 枚の元画像から大きい顔（A）と小さい顔（C）を道具で書き出し、ゲームが枠の大きさで使い分けるようにして、ボルグを作り直す。

**Architecture:** forge（`illust-asset-forge/`）の `character.yaml` に任意の `face_crop` を足し、`artgen.export` が切り出し・外につながる白の透明化・2 枚の書き出し・確認図を受け持つ。画像の処理は新しいモジュール `artgen/face_crop.py` に分け、承認用のページは `artgen/crop_review.py` が作る。ゲームは `sprites.faceSmall` を読み、`drawFace` が描く大きさで画像を選ぶ。

**Tech Stack:** Python 3 + Pillow + PyYAML + pytest（forge）、TypeScript + Vitest + Canvas2D（ゲーム）

**Spec:** `docs/superpowers/specs/2026-11-23-face-framing-design.md`

## Global Constraints

- forge のテストは `cd illust-asset-forge && .venv/bin/pytest`、ゲームは `npm test`・`npm run build`（リポジトリの根で）
- `FACE_PX`（`large: 64, small: 32, panel: 40`）は変えない
- 大きい顔は 256px、小さい顔は 128px の RGBA の PNG
- 透明にする白は「全チャンネル 240 以上」。塗りつぶしは切り出した範囲の四辺から始め、つながっている画素だけを透明にする
- `face_crop` が無いキャラクターの書き出しは今と同じ（丸ごと 256px に縮める RGB、透明化なし）
- 設定の誤りは `ConfigError` で `<相対パス>: <キーの位置>: <何がおかしいか>`。書き出せない入力は `ExportError`
- 書き出しは、すべてを検査してから書き始める（今の決まりを小さい顔にも当てはめる）
- エンジン・道具・テンプレートを直したら `illust-asset-forge/UPSTREAM.md` に 1 行足す
- 候補・確認図・承認用のページは `illust-asset-forge/local/`（git に入れない）
- 描画コード（Canvas2D）にはユニットテストを書かない。選ぶ処理は純粋な関数にしてテストする
- ゲームの今の顔のファイル名（`*-face.png`）は変えない。小さい顔は `<id>-face-small.png`
- コミットは Conventional Commits + 日本語の要約。push と PR は依頼者が頼んだときだけ
- 絵（ボルグの範囲）は、依頼者がページで承認するまで、ゲームの `assets/` に入れない

## Review Focus

1. 範囲の辺で服や鎧の明るい所が切れている絵 — 外から塗りつぶすと服の白まで透明になる。確認図で見つかること（Task 2 のテスト `test_edge_white_cloth_is_cleared_and_marked_red` で、確認図の赤がその画素に付くことを確かめる）
2. 範囲の内側にある白（白目・内側の白い服） — 外につながらないので残ること（Task 2 `test_inner_white_is_kept`）
3. `face_crop` を消した・`small` だけ消した後の書き出し — 古い `face-small.png` が残らないこと（Task 3 `test_small_output_removed_when_small_crop_dropped`）
4. 範囲が元画像の外にはみ出す設定 — 何も書かずに止まること（Task 3 `test_crop_outside_image_is_rejected`）
5. 小さい顔が無いユニット・村人 — 40px・32px の枠に今の 1 枚が出ること（Task 5 の `faceImageFor` のテスト）

---

### Task 1: `face_crop` を `character.yaml` から読む

**Files:**
- Modify: `illust-asset-forge/src/artgen/config.py`（`Character` と `load_character`）
- Test: `illust-asset-forge/tests/test_config.py`

**Interfaces:**
- Produces:
  - `@dataclass(frozen=True) class ClearColor: min: int; max_rg: int; max_gb: int`
  - `@dataclass(frozen=True) class FaceCrop: large: tuple[int,int,int,int]; small: tuple[int,int,int,int] | None; clear_colors: tuple[ClearColor, ...]`
  - `Character.face_crop: FaceCrop | None`（既定 `None`。今ある `Character(...)` の呼び出しが壊れないよう、最後の欄にして既定値を付ける）

- [ ] **Step 1: 失敗するテストを書く**

```python
# 既存の write_character(root, text) と CHARACTER_YAML を使う
def test_face_crop_is_read(tmp_path):
    write_character(tmp_path, CHARACTER_YAML + "face_crop:\n  large: [0, 0, 600, 600]\n  small: [100, 100, 400, 400]\n"
                    "  clear_colors:\n    - {min: 214, max_rg: 14, max_gb: 16}\n")
    c = load_character(tmp_path, "c1")
    assert c.face_crop == FaceCrop((0, 0, 600, 600), (100, 100, 400, 400), (ClearColor(214, 14, 16),))

def test_face_crop_absent_is_none(tmp_path): ...  # c.face_crop is None
def test_face_crop_small_and_colors_optional(tmp_path): ...  # small None・clear_colors ()

@pytest.mark.parametrize("yaml, where", [
    ("face_crop:\n  large: [0, 0, 600, 500]\n", "face_crop.large"),          # 正方形でない
    ("face_crop:\n  small: [0, 0, 100, 100]\n", "face_crop.large"),          # large が無い
    ("face_crop:\n  large: [0, 0, 6, 6]\n  small: [0, 0, 5, 4]\n", "face_crop.small"),
    ("face_crop:\n  large: [0, 0, 6, 6]\n  clear_colors: [{min: 300, max_rg: 1, max_gb: 1}]\n", "face_crop.clear_colors[0].min"),
    ("face_crop:\n  large: [0, 0, 6, 6]\n  clear_colors: [{min: 200}]\n", "face_crop.clear_colors[0]"),
    ("face_crop:\n  large: [0, 0, 6, 6]\n  sizes: 1\n", "face_crop"),          # 知らないキー
])
def test_face_crop_errors(tmp_path, yaml, where):
    write_character(tmp_path, CHARACTER_YAML + yaml)
    with pytest.raises(ConfigError, match=f"characters/c1/character.yaml: {re.escape(where)}"):
        load_character(tmp_path, "c1")
```

- [ ] **Step 2: 落ちることを確かめる** — `cd illust-asset-forge && .venv/bin/pytest tests/test_config.py -k face_crop -v` → FAIL（`FaceCrop` が無い）
- [ ] **Step 3: 実装する** — 箱は既存の `r.box()`（`parse_box`）で読み、正方形（`x1-x0 == y1-y0`）を足して検査する。`min`・`max_rg`・`max_gb` は 0〜255 の整数で、3 つとも必須
- [ ] **Step 4: 通ることを確かめる** — 同じコマンドで PASS。あわせて `.venv/bin/pytest` 全体が通る
- [ ] **Step 5: コミット** — `feat: character.yaml の face_crop（顔の切り出し範囲）を読む`

### Task 2: 切り出しと透明化の処理（`face_crop.py`）

**Files:**
- Create: `illust-asset-forge/src/artgen/face_crop.py`
- Test: `illust-asset-forge/tests/test_face_crop.py`

**Interfaces:**
- Consumes: `ClearColor`（Task 1）
- Produces:
  - `WHITE_MIN = 240`
  - `clear_background(image: Image.Image, colors: Sequence[ClearColor]) -> tuple[Image.Image, Image.Image]` — RGB の切り出し済みの絵を受け取り、（透明化した RGBA、確認図の RGB）を返す。確認図は透明にした画素を `(255, 0, 0)` で塗った絵
  - `render_face(source: Image.Image, box, size: int, colors) -> tuple[Image.Image, Image.Image]` — 切り出し → `clear_background` → `size` に縮めた RGBA と、縮める前の確認図を返す

- [ ] **Step 1: 失敗するテストを書く**（小さな絵を手で塗って作る）

```python
def test_outer_white_becomes_transparent():      # 白地の真ん中に灰の四角 → 四隅は alpha 0、灰は 255
def test_inner_white_is_kept():                   # 灰の輪の内側の白 → alpha 255、確認図で赤でない
def test_edge_white_cloth_is_cleared_and_marked_red():  # 下の辺に接した白い帯（服）→ 透明・確認図は赤
def test_clear_color_is_cleared_only_when_connected():  # クリーム (230,220,206) が外につながれば透明、灰に囲まれれば残る
def test_skin_is_not_cream():                     # 肌 (240,200,170) は ClearColor(214,14,16) に当たらない
def test_near_white_below_threshold_is_kept():    # (239,255,255) は残る
def test_render_face_size_and_mode():             # 1024 の絵・箱 (0,0,600,600)・128 → (128,128) RGBA、確認図は (600,600)
def test_resize_does_not_darken_edges():          # 白地に赤の四角を縮めた時、半透明の画素の RGB が黒寄りにならない（R が 200 以上）
```

- [ ] **Step 2: 落ちることを確かめる** — `.venv/bin/pytest tests/test_face_crop.py -v` → FAIL（モジュールが無い）
- [ ] **Step 3: 実装する** — 四辺の画素を起点に 4 近傍で塗りつぶす（`collections.deque`。1024×1024 でも数秒以内）。白の条件は `min(r,g,b) >= WHITE_MIN`、追加の色は `min(r,g,b) >= c.min and r-g <= c.max_rg and g-b <= c.max_gb`。縮めるときは `"RGBa"`（アルファを掛けた形）に変えてから `LANCZOS` で縮め、`"RGBA"` に戻す
- [ ] **Step 4: 通ることを確かめる** — PASS
- [ ] **Step 5: コミット** — `feat: 顔の切り出しと外につながる背景の透明化を足す`

### Task 3: 書き出しで 2 枚と確認図を作る

**Files:**
- Modify: `illust-asset-forge/src/artgen/export.py`
- Test: `illust-asset-forge/tests/test_export.py`

**Interfaces:**
- Consumes: `Character.face_crop`（Task 1）、`render_face`（Task 2）
- Produces:
  - `SMALL_EXPORT_SIZE = 128`（`export.py` の定数）
  - `small_name(name: str) -> str` — `"face.png"` → `"face-small.png"`、`"face_hurt.png"` → `"face_hurt-small.png"`
  - 確認図: `<root>/local/check/<id>/<stem>-large.png`・`<stem>-small.png`（`stem` は `face`・`face_hurt` など）
  - `params.json` に最上位のキー `"face_crop"`（`{"large": [...], "small": [...] | null, "clear_colors": [{"min":..,"max_rg":..,"max_gb":..}]}`）。`face_crop` が無ければキーを書かない

- [ ] **Step 1: 失敗するテストを書く**（fixture の `character.yaml` に `face_crop` を足す版の fixture `cropped_repo` を作る）

```python
def test_cropped_face_and_small(cropped_repo):        # face.png (256,256) RGBA・face-small.png (128,128) RGBA
def test_cropped_expression_gets_small_too(cropped_repo):  # face_hurt.png と face_hurt-small.png
def test_check_images_written(cropped_repo):          # local/check/c1/face-large.png・face-small.png がある
def test_params_json_records_face_crop(cropped_repo): # params["face_crop"]["large"] == [0, 0, 600, 600]
def test_without_face_crop_output_is_unchanged(repo): # 既存の test_face_is_resized_to_256 と同じ。mode == "RGB"、face-small.png が無い、params に face_crop が無い
def test_large_only_writes_no_small(cropped_repo):    # small を書かない → face-small.png が無い
def test_small_output_removed_when_small_crop_dropped(cropped_repo):  # 一度書き出し → small を消して再度 → face-small.png と確認図の small が消える
def test_crop_outside_image_is_rejected(cropped_repo):  # large: [500, 500, 1100, 1100] → ExportError、何も書かれない
def test_fullbody_is_not_cropped(cropped_repo):       # fullbody.png はバイトのまま写す
```

- [ ] **Step 2: 落ちることを確かめる** — `.venv/bin/pytest tests/test_export.py -v` → 新しいテストが FAIL
- [ ] **Step 3: 実装する** — 範囲が元画像に収まるかは、検査の段（書き始める前）で見る。古い出力を消す処理（`accepted` のループ）に `small_name` の名前と確認図を足す。`face_crop` があるときの `face*.png` は `render_face` で、無いときは今のまま
- [ ] **Step 4: 通ることを確かめる** — `.venv/bin/pytest` 全体が PASS
- [ ] **Step 5: コミット** — `feat: 書き出しで大きい顔・小さい顔と確認図を作る`

### Task 4: 承認用のページと、テンプレート・文書

**Files:**
- Create: `illust-asset-forge/src/artgen/crop_review.py`
- Test: `illust-asset-forge/tests/test_crop_review.py`
- Modify: `illust-asset-forge/templates/face.yaml`、`illust-asset-forge/tests/test_repo_configs.py:41-48`
- Modify: `illust-asset-forge/README.md`、`illust-asset-forge/CLAUDE.md`、`illust-asset-forge/UPSTREAM.md`

**Interfaces:**
- Consumes: `load_character`（Task 1）、`small_name`・確認図の置き場（Task 3）
- Produces:
  - `build_review(root: Path, char_id: str) -> Path` — `local/check/<id>/review.html` を作って返す。書き出しが済んでいない・`face_crop` が無いときは `ExportError`
  - CLI: `python -m artgen.crop_review <id> [--root DIR]`

ページの中身（PNG はすべて data URI で埋め込む。Artifact で公開するため 1 ファイルにする）:
1. 元画像（512px に縮める）に `large` を赤、`small` を青の枠で描いた絵と、枠なしの元画像を並べる
2. 確認図（`face-large.png`・`face-small.png`）
3. ゲームの見え方: 背景 `#18222c` の上に、大きい顔を 64px、小さい顔を 40px と 32px で（`<img width=...>`。ブラウザの縮小はゲームと同じくぼかしあり）

- [ ] **Step 1: 失敗するテストを書く**

```python
def test_review_page_has_all_parts(exported_repo):
    html = build_review(exported_repo, "c1").read_text(encoding="utf-8")
    assert html.count("data:image/png;base64,") == 7   # 枠あり・枠なし・確認図 2・64・40・32
    assert 'width="64"' in html and 'width="40"' in html and 'width="32"' in html
    assert "#18222c" in html

def test_review_requires_face_crop(repo): ...      # ExportError
def test_review_requires_export(cropped_repo): ... # 書き出し前は ExportError
def test_face_template_is_upper_body_bust():       # test_repo_configs.py の既存テストを置き換える
    face = load_template(ROOT, "face")
    assert "upper body" in face.prompt and "portrait" not in face.prompt
    assert "upper body" not in face.negative and "cropped head" in face.negative
    # 既存の looking to the side・inpaint_box の検査は残す
```

- [ ] **Step 2: 落ちることを確かめる** — `.venv/bin/pytest tests/test_crop_review.py tests/test_repo_configs.py -v` → FAIL
- [ ] **Step 3: 実装する** — `templates/face.yaml` の `prompt` を `[upper body, looking to the side, simple background, white background]`、`negative` から `upper body` を外す。`crop_review.py` を作る（`small` が無いキャラクターでは 40・32px にも大きい顔を出し、画像は 5 枚）
- [ ] **Step 4: 通ることを確かめる** — `.venv/bin/pytest` 全体が PASS（見本 4 人の書き出しは止まらない）
- [ ] **Step 5: 文書を直す**
  - README: テンプレートが「胸から上」になったこと、`inpaint.box` の既定値は顔のアップのときの値で、表情を作るときはキャラクターごとに範囲を決めること。`face_crop` の書き方。書き出しの出力（2 枚・確認図・`params.json` の `face_crop`）。「10. Modal で作る」の流れの 5 の後に「範囲を決めて `artgen.export` → `artgen.crop_review` → 依頼者の承認」を足す
  - CLAUDE.md: 「顔の自動検出は入れず、Claude が顔を見て範囲を決めることもしない」は表情の範囲（`inpaint_box`）の話で、切り出しの範囲（`face_crop`）は Claude が決めて承認用のページで依頼者の承認を受けることを書き分ける。範囲の辺で服が切れると服の白が透明になるので、確認図を必ず見ること
  - UPSTREAM.md: 顔のテンプレートを `upper body` にしたこと、`face_crop`・書き出しの 2 枚・`crop_review` を足したこと（2 行）
- [ ] **Step 6: コミット** — `feat: 顔のテンプレートを胸から上にし、切り出しの承認用ページを足す`

### Task 5: ゲームが大きい顔と小さい顔を使い分ける

**Files:**
- Modify: `src/engine/schema.ts`（`Sprites`・`NO_SPRITES`・`readSprites`・`NpcDef`・`validateNpcDef`）
- Modify: `src/engine/registry.ts`（`checkSprites`・村人の検査・`lookupSpeaker`）
- Modify: `src/render/sprites.ts`（`drawFace` と新しい関数）
- Test: `src/engine/schema.test.ts`、`src/engine/registry.test.ts`、`src/render/sprites.test.ts`
- Modify: `README.md`（ユニットの絵・村人の節）

**Interfaces:**
- Produces:
  - `type Sprites = { role: string | null; face: string | null; faceSmall: string | null; map: MapSheet | null }`
  - `NpcDef.sprites: { face: string | null; faceSmall: string | null }`
  - `faceImageFor(sprites: Pick<Sprites, 'face' | 'faceSmall'>, sizePx: number): string | null`（`src/render/sprites.ts`）— `sizePx <= FACE_PX.panel` かつ `faceSmall !== null` なら `faceSmall`、それ以外は `face`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// sprites.test.ts
it('40px 以下は小さい顔、64px は大きい顔', () => {
  const s = { face: 'a-face.png', faceSmall: 'a-face-small.png' };
  expect(faceImageFor(s, 64)).toBe('a-face.png');
  expect(faceImageFor(s, 40)).toBe('a-face-small.png');
  expect(faceImageFor(s, 32)).toBe('a-face-small.png');
});
it('小さい顔が無ければ どの大きさでも 大きい顔', () => {
  expect(faceImageFor({ face: 'a-face.png', faceSmall: null }, 32)).toBe('a-face.png');
});
// schema.test.ts
//  - sprites を省くと { role: null, face: null, faceSmall: null, map: null }
//  - faceSmall を読む／文字列でないとエラー（path 'sprites.faceSmall'）
//  - faceSmall だけで face が無いとエラー（path 'sprites.faceSmall'）。村人も同じ
// registry.test.ts
//  - faceSmall のファイルが assets/images/ に無いとエラー（仲間・敵・村人。path 'sprites.faceSmall'）
//  - lookupSpeaker が村人の faceSmall を返す
```

- [ ] **Step 2: 落ちることを確かめる** — `npx vitest run src/render/sprites.test.ts src/engine/schema.test.ts src/engine/registry.test.ts` → FAIL
- [ ] **Step 3: 実装する** — `drawFace` は `imageFor(images, faceImageFor(def.sprites, radius * 2))` にする。呼び出し側（`screens.ts`・`card-view.ts`）は変えない。`{ role, face, map }` を `toEqual` で比べている既存のテストの期待値に `faceSmall: null` を足す
- [ ] **Step 4: 通ることを確かめる** — `npm test` と `npm run build` が PASS
- [ ] **Step 5: README を直す** — ユニットの絵の節に「`faceSmall` は小さい顔（任意）。40px 以下の枠（下のバー・仲間一覧・リザルトなど）で使い、無ければ `face` を使う。`face` 無しで `faceSmall` だけは書けない」、村人の節に `sprites.faceSmall`（任意）
- [ ] **Step 6: コミット** — `feat: 小さい枠では小さい顔の画像（faceSmall）を使う`

### Task 6: ボルグを作り直す（依頼者の承認あり）

**Files:**
- Modify: `illust-asset-forge/characters/ally05/character.yaml`（`face_crop`）
- Replace: `illust-asset-forge/characters/ally05/source/face.png`、`characters/ally05/face.png`・`face-small.png`・`params.json`
- Replace: `assets/images/ally05-face.png`、Create: `assets/images/ally05-face-small.png`
- Modify: `assets/units/ally05.json`（`"faceSmall": "ally05-face-small.png"`）
- Modify: `README.md`（「顔グラの例外」）、`HANDOVER.md`

**Interfaces:**
- Consumes: Task 1〜5 のすべて

- [ ] **Step 1: 取り込む** — `cd illust-asset-forge && .venv/bin/python -m artgen.cloud install ally05`。出力の「消した」に `face.png` 以外の意図しないものが無いこと、`source/fullbody.png` が持ち越されたことを確かめる。書き戻しの一覧（`extra`・`remove`・`remove_negative`）はテンプレートの変更で反映済みとみなし、`character.yaml` に足さない（設計書 6 の 2）
- [ ] **Step 2: 範囲を決める** — 元画像を見て `face_crop.large`（頭の全体＋首元。上は y=0 から。髪の先の 2 画素が上の辺に触れるのは依頼者が許した）と `small`（顔のアップ）を決めて書く。背後の飾りにクリーム色があれば `clear_colors` に `{min: 214, max_rg: 14, max_gb: 16}` を書く
- [ ] **Step 3: 書き出してページを作る** — `.venv/bin/python -m artgen.export ally05 && .venv/bin/python -m artgen.crop_review ally05`。確認図で顔・服・鎧に赤が無いことを自分で確かめてから、`local/check/ally05/review.html` を Artifact で公開して依頼者に見せる
- [ ] **Step 4: 依頼者の承認を待つ（ここで止まる）** — 直す点があれば Step 2 に戻る。承認の前に Step 5 以降へ進まない
- [ ] **Step 5: ゲームに入れる** — `characters/ally05/face.png` → `assets/images/ally05-face.png`、`face-small.png` → `assets/images/ally05-face-small.png` に写し、`assets/units/ally05.json` に `faceSmall` を書く。`npm test`・`npm run build` が通る
- [ ] **Step 6: ブラウザで確かめる** — README の CDP 手順で、会話・セリフ欄・カード（64px）、下のバー（40px）、仲間一覧・リザルト（32px）を撮り、ほかのユニットの顔が今と変わらないことも見る。撮った絵を HTML にまとめて Artifact で依頼者に見せ、マップの絵を直すかを依頼者に聞く（直すなら別の作業として相談する）
- [ ] **Step 7: 正典を直す** — README「顔グラの例外」を、`face_crop` を書いて `artgen.export` で 2 枚を作る流れに書き直し、範囲の辺で服が切れると服の白が透明になる注意を足す。HANDOVER.md の `## 進捗` と工程 4 の結果。消してよくなった候補（`local/runs/ally05/face/20261123_105626/`・`local/selected/ally05/`）を書く（消すのは依頼者）
- [ ] **Step 8: コミット** — `feat: ボルグの顔を胸から上の絵で作り直し、小さい顔を足す`
