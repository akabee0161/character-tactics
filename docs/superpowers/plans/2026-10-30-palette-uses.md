# パレットを色見本と用途の色に分ける Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `palette/master.json` を、色見本（`swatches.json`）・種類（`kinds.json`）・用途の色（`uses/<型>.json`）に分け、全グリッドを用途の色の名前に移し替え、確認の道具が色の名前でなく種類で武器・手・髪・装飾品・目を見分けるようにする。見た目は1画素も変えない。

**Architecture:** 新しいモジュール `tools/palette.py` が3つのファイルを読み、`gridfile.load_palette()` はそれを使って「用途の色の名前 → 値」を返す（呼び出し側18本はそのまま）。移し替えは、置き場ごとの対応表と画素ごとの上書きを読む道具 `tools/palette_migrate.py` で機械的に行い、書き出した PNG が前後で1バイトも変わらないことで確かめる。道具（`validate.py`・`unit_rules.py`→`weapon_check`・`compose.py`・`part_outline.py`・`eye_check.py`）は `palette.Palette` の種類を読む。

**Tech Stack:** Python 3.14（forge の `.venv`）、unittest、Pillow（既存）。

**Spec:** `docs/superpowers/specs/2026-10-30-palette-uses-design.md`

コマンドは断りが無ければ `pixel-asset-forge/` で実行する。ブランチは `chore/palette-uses`（main `cb6e540` から。設計書は `287866d`）。進捗台帳は `.superpowers/sdd/2026-10-30-palette-uses/progress.md`（character-tactics の直下）。

## Global Constraints

- **見た目は1画素も変えない。** 書き出した PNG（`render.py`・`sheet.py`・`enemy_build.py --all`・`contact_sheet.py`・`sets.py`・`tilemap.py --layout`・`export.py`）が、移し替えの前後で1バイトも変わらない
- 色の値を変えない。新しい色を足さない（用途を分けるための、値が同じ用途の色は足してよい）
- 色の値は `palette/swatches.json` だけが持つ。`uses` は色見本の名前を指す
- 道具は、色の名前の付け方（接頭辞など）で種類を推測しない。種類は必ず `palette.Palette` から読む
- 落ちた絵を `exceptions` や `open_chars` で通さない。新しい判定は、作った後に既存のアセット全件に掛けて落ちる件数を台帳に書く（forge の CLAUDE.md）
- 用途の色のファイルは型ごとに1つで、その型の全アセットが共有する（ユニット1体ごとのパレットは作らない）
- 種類 `blade`・`weapon` は武器の部品（`assets/part/equip/` のうち `shield` 以外）と item の武器のアイコンだけ。盾は種類 `shield`。被り物（兜の鼻当てを含む）は `headgear` で、縁はすべて輪郭で閉じる。`hair`・`ornament` だけが、体の上の縁に輪郭が無くてよい（依頼者 2026-10-29・30）
- 用途の色の名前と色見本の名前は重ならない（`palette.py` が落とす）
- テストは `assets/` を読まない（`tests/test_no_live_assets.py`）。新しいテストは一時フォルダにパレットとグリッドを作る
- コミットは Conventional Commits＋日本語。push・PR は依頼者の指示があったときだけ。一時の出力は scratchpad（`rm -rf` は使えない）

## Review Focus

- **派生ファイル（`# from:`）**: `map` を持たず由来元から継承するファイルが、移し替えで壊れたり二重に書き換えられたりしないか → Task 2 の `test_derived_file_without_map_is_left_alone`
- **1つのファイルの中で同じ文字が別の物に使われている所**: 画素の上書きで新しい文字を割り当てたとき、使える文字が尽きる・既存の文字とぶつかる → Task 2 の `test_pixel_override_takes_unused_char`・`test_pixel_override_runs_out_of_chars`
- **色替えした敵のコマ**: `recolor` の行き先が色見本の名前になると、書き出したコマが用途の色に無い名前を持つ。シートの PNG が前と同じ色になるか → Task 4 Step 7 の PNG の比較（`build/sheets/*.png`）と、Task 4 の `test_recolor_to_swatch`
- **組んだコマ（`compose.py` の出力）**: 部品とコマの両方を書き換えた後、`compose.py --check` がロラン・イネス・ガウで差を出さないか → Task 4 Step 8
- **テストの文字列**: 今のテストが `skin_base`・`wood_base`・`leaf_base` などの名前を、現役のパレットとして読んでいる。名前が消えると大量に落ちる → Task 4 Step 6

---

### Task 1: パレットの新しい読み込み（`tools/palette.py`）

**Files:**
- Create: `tools/palette.py`
- Test: `tests/test_palette.py`

**Interfaces:**
- Produces:
  - `PALETTE_DIR = REPO_ROOT / "palette"`、`TYPES = ("common", "unit", "tile", "face", "item")`
  - `@dataclass(frozen=True) class Use: name: str; swatch: str; kind: str; note: str; type: str`
  - `@dataclass(frozen=True) class Palette: swatches: dict[str, tuple[int,int,int]]; swatch_notes: dict[str,str]; kinds: dict[str, str]; uses: dict[str, Use]`
    - `rgb(name: str) -> tuple[int,int,int]`（用途の色の名前。無ければ `KeyError`）
    - `kind_of(name: str) -> str`
    - `names_of_kind(*kinds: str, type: str | None = None) -> frozenset[str]`（`type` を渡すと、その型と `common` の用途の色だけ）
    - `allowed(type: str) -> frozenset[str]`（その型と `common` の用途の色の名前）
  - `load(root: Path = PALETTE_DIR) -> Palette`。形の誤りは `gridfile.GridError`（ファイル名とキーを文に入れる）

ファイルの形は設計書どおり: `swatches.json` は `{"<名前>": {"hex": "#rrggbb", "note": "..."}}`、`kinds.json` は `{"<種類>": {"note": "..."}}`、`uses/<型>.json` は `{"<名前>": {"swatch": "...", "kind": "...", "note": "..."}}`（`<型>` は `TYPES`）。

- [ ] **Step 1: 失敗するテストを書く**（一時フォルダに3種類のファイルを書いて `load(tmp)` を呼ぶ）
  - `test_loads_uses_with_swatch_values`: `uses/unit.json` の `weapon_blade_hi`（swatch `stone_hi` = `#dfe3ea`, kind `blade`）→ `rgb("weapon_blade_hi") == (0xdf, 0xe3, 0xea)`、`kind_of(...) == "blade"`
  - `test_names_of_kind_by_type`: `common` の `outline`（kind `outline`）と `unit`・`tile` に `blade` が1つずつ → `names_of_kind("blade", type="unit") == {"unit の名前"}`、`allowed("unit") == {"outline", "unit の名前"}`
  - `test_rejects_missing_note`・`test_rejects_unknown_swatch`・`test_rejects_unknown_kind`・`test_rejects_bad_hex`・`test_rejects_duplicate_use_across_files`・`test_rejects_use_named_like_swatch`・`test_rejects_unknown_type_file`（`uses/foo.json`）: どれも `GridError` で、文にファイル名とキーが入る
- [ ] **Step 2: 走らせて落ちることを確かめる** Run: `.venv/bin/python -m unittest tests.test_palette -v` → Expected: `ModuleNotFoundError: palette`
- [ ] **Step 3: `tools/palette.py` を書く**（`json` で読み、`gridfile.HEX_RE`・`hex_to_rgb`・`GridError` を使う）
- [ ] **Step 4: 走らせて通ることを確かめる** Run: 同上 → Expected: OK
- [ ] **Step 5: コミット** `git add tools/palette.py tests/test_palette.py && git commit -m "feat: 色見本・種類・用途の色を読む palette.py を足す"`

---

### Task 2: 移し替えの道具（`tools/palette_migrate.py`）

**Files:**
- Create: `tools/palette_migrate.py`
- Test: `tests/test_palette_migrate.py`

**Interfaces:**
- Produces:
  - 対応表のファイル（JSON）: `{"rules": [{"glob": "assets/part/equip/dagger/*.txt", "from": "stone_hi", "to": "weapon_blade_hi"}, ...], "pixels": [{"file": "assets/part/body/gau/core_down_base.txt", "points": [[x, y], ...], "to": "hair_gau_base"}, ...]}`。`glob` は forge の直下からの相対パスで、上から順に最初に当たった規則を使う
  - `migrate_text(path: str, text: str, rules: list[dict], pixels: list[dict]) -> str`（1ファイルの書き換え。純粋な関数）
  - CLI: `tools/palette_migrate.py MAPPING.json [--write] [targets ...]`（既定の対象は `validate.py` の `default_targets()` と同じ＋`tests/fixtures/`）。`--write` なしは、ファイルごとの書き換える名前の数と、規則の無い名前の一覧を出すだけ。規則の無い名前が1つでもあれば終了コード 1

- [ ] **Step 1: 失敗するテストを書く**
  - `test_rewrites_map_by_first_matching_rule`: `# map: o=outline s=stone_hi` で、規則が equip 用と全体用の2つ → equip のファイルは前の規則の名前になる。行（画素）は変わらない
  - `test_unmapped_name_is_reported`: 規則の無い名前があると、`migrate_text` が `MigrateError`（ファイル名と名前）
  - `test_pixel_override_takes_unused_char`: 文字 `b`（skin_base）の画素のうち2点を `hair_x` に → その2点だけ、ファイルで使われていない新しい文字に替わり、`map` に `<新しい文字>=hair_x` が足される。ほかの `b` は規則どおり
  - `test_pixel_override_runs_out_of_chars`: 使える文字（`gridfile.MAP_ENTRY_RE` が許す1文字のうち `.` と `#` 以外）を使い切っていると `MigrateError`
  - `test_pixel_override_point_must_hit_a_pixel`: 上書きの点が背景（`.`）なら `MigrateError`
  - `test_derived_file_without_map_is_left_alone`: `# from:` と `# transform:` だけのファイルは、そのまま返る
- [ ] **Step 2: 落ちることを確かめる** Run: `.venv/bin/python -m unittest tests.test_palette_migrate -v` → Expected: ImportError
- [ ] **Step 3: `tools/palette_migrate.py` を書く**（`map` の行は1行4組まで、名前順に並べ直さず元の順を保つ。上書きの新しい文字は小文字 → 大文字 → 数字の順で、ファイルに無いものの最初）
- [ ] **Step 4: 通ることを確かめる** Run: 同上 → Expected: OK
- [ ] **Step 5: コミット** `git add tools/palette_migrate.py tests/test_palette_migrate.py && git commit -m "feat: 色の名前を用途の色へ書き換える palette_migrate.py を足す"`

---

### Task 3: 用途の色の表と対応表を作り、依頼者の承認を得る（承認で止まる）

**Files:**
- Create: `palette/swatches.json`、`palette/kinds.json`、`palette/uses/{common,unit,tile,face,item}.json`、`palette/migration.json`（Task 4 の最後に消す一時の対応表）

**Interfaces:**
- Consumes: Task 1 の `palette.load`、Task 2 の対応表の形
- Produces: Task 4 が使う、完全な3つのパレットのファイルと対応表

- [ ] **Step 1: 色見本を作る。** `swatches.json` に `master.json` の70色を同じ名前・同じ値で写し、`note` に色の説明（「冷たい灰の明」など）を書く（未使用の2色も写す。未使用は Task 5 で報告される）
- [ ] **Step 2: 種類を決める。** `kinds.json` に少なくとも `outline`・`skin`・`hair`・`eye`（白目・瞳）・`mouth`・`cloth`・`headgear`・`ornament`・`blade`・`weapon`・`shield`。tile・face・item の種類は、物の種類で作る人が足す（例: `terrain`・`plant`・`building`・`object`・`background`）。`note` に、道具がその種類をどう扱うか（設計書の表）を書く
- [ ] **Step 3: 全グリッドの色を、物ごとに読み分ける。** 型・`assets/` の下のフォルダごとに、使っている色の名前と、それが描いている物を一覧にする（scratchpad のスクリプト）。1つのファイルで同じ色が別の物に使われている所（芯に描いた髪・被り物・服、ガウとロランの芯の `wood_*`・`stone_hi`、イネスのピアスなど）は、その画素の座標を拾う。基準は「その画素が描いている物の種類」（設計書）
- [ ] **Step 4: 用途の色と対応表を書く。** `uses/<型>.json` に用途の色（名前から用途が分かる名前。色見本の名前と重ねない）を、`migration.json` に `rules` と `pixels` を書く。同じ値でも物が違えば別の項目（短剣の刃と兜、柄とベルト）。Run: `.venv/bin/python -c "import sys; sys.path.insert(0,'tools'); import palette; palette.load()"` → 例外なし。Run: `.venv/bin/python tools/palette_migrate.py palette/migration.json` → 終了コード 0（規則の無い名前が無い）
- [ ] **Step 5: 物ごとに色分けしたページを Artifact で見せて止まる。** 型・フォルダごとに、グリッドを「種類ごとの塗り分け」で描き、凡例（種類と用途の色の名前・説明）を付ける。画素の上書きをした所は赤枠＋印なしの対で。依頼者に聞く: 種類の分け方と、上書きの判断の承認。答えを台帳に書く。**承認が出るまで Task 4 へ進まない**
- [ ] **Step 6: コミット**（この時点では `master.json` も残っている。道具はまだ `master.json` を読む）`git add palette && git commit -m "feat: 色見本・種類・用途の色の表と、移し替えの対応表を足す"`

---

### Task 4: 移し替えて `master.json` を消し、見た目が変わらないことを確かめる

**Files:**
- Modify: `tools/gridfile.py`（`load_palette`・`PALETTE_PATH`）、`tools/enemy_build.py`（色替え）、`tools/probe_colors.py`（名前の引き方）、`assets/**/*.txt`・`types/**/*.txt`・`tests/fixtures/*.txt`（`map` の行）、`enemy/*.json`（`recolor`）、`compose/*.json`（`hand_colours`・`keep`）、`checks/*.json`（`weapon_check` の色）、`tests/test_*.py`（色の名前の文字列）
- Delete: `palette/master.json`、`palette/migration.json`
- Test: `tests/test_enemy_build.py`（`test_recolor_to_swatch` を足す）

**Interfaces:**
- Consumes: Task 1・2・3
- Produces:
  - `gridfile.load_palette() -> dict[str, tuple[int,int,int]]`（すべての用途の色の名前 → 値。中身は `palette.load()`）
  - `gridfile.load_colours() -> dict[str, tuple[int,int,int]]`（用途の色と色見本の両方。色替えした敵のコマを描くときだけ使う）
  - `enemy/*.json` の `recolor` は「用途の色の名前 → 色見本の名前」

- [ ] **Step 1: 前の出力を取っておく。** scratchpad の新しいフォルダ `before/` に、`render.py -o before/render`、`sheet.py` の3体、`enemy_build.py --all`（`build/sheets` を写す）、`contact_sheet.py`、`sets.py`、`tilemap.py --layout layouts/*.txt` の PNG と、`export.py` で scratchpad へ書き出したゲーム用の PNG（README 2.10 の対応表すべて）を集める。あわせて `unit_rules.py checks/{roran,ines,gau}.json` の出力を `before/rules_<unit>.txt` に保存する
- [ ] **Step 2: 色替えの失敗するテストを書く。** `test_recolor_to_swatch`: 一時フォルダのパレット（用途の色 `cloth_main_base` → 色見本 `cloak_dark_base`）で、レシピの `recolor` が `{"cloth_main_base": "floor_shadow"}` のとき、書き出したシートのその画素が `floor_shadow` の値になる。`recolor` の値が色見本に無ければ `EnemyError`
- [ ] **Step 3: 落ちることを確かめる** Run: `.venv/bin/python -m unittest tests.test_enemy_build -v` → Expected: FAIL
- [ ] **Step 4: 道具を新しいパレットへ切り替える。** `gridfile.load_palette()` と `load_colours()` を `palette.load()` から作る（`PALETTE_PATH` は `PALETTE_DIR` に）。`enemy_build.py` は `recolor` の値を色見本として検査し、シートは `load_colours()` で描く。`probe_colors.py` は用途の色と色見本の両方の名前と `#rrggbb` を受ける
- [ ] **Step 5: 書き換える。** Run: `.venv/bin/python tools/palette_migrate.py palette/migration.json --write`。`enemy/*.json` の `recolor` のキーを用途の色の名前に（値は今の名前＝色見本の名前のまま）、`compose/*.json` の `hand_colours`・`keep`、`checks/*.json` の `weapon_check` の `blade`・`weapon`・`hand` を、`migration.json` の対応どおりの名前に書き換える（この3つは Task 6 で種類に置き換える。ここでは名前だけ）
- [ ] **Step 6: テストを直す。** `tests/test_*.py` の色の名前の文字列を、対応表どおりの用途の色の名前に替える。Run: `.venv/bin/python -m unittest discover -s tests` → Expected: OK
- [ ] **Step 7: 見た目が変わらないことを確かめる。** Step 1 と同じ出力を `after/` に作り、Run: `cmp -r` 相当の比較（scratchpad のスクリプトでファイルごとに `filecmp.cmp(shallow=False)`）→ Expected: 差 0 件、ファイル数も同じ
- [ ] **Step 8: 確認の道具の結果が変わらないことを確かめる。** Run: `.venv/bin/python tools/unit_rules.py checks/{roran,ines,gau}.json` を `after/rules_<unit>.txt` に → `before/` と同じ（色の名前が出る行は、対応表で読み替えて同じ）。`compose.py compose/<unit>.json --check` が3体とも 0
- [ ] **Step 9: 消す。** `git rm palette/master.json palette/migration.json`。Run: `.venv/bin/python tools/validate.py` → 0、unittest → OK
- [ ] **Step 10: コミット** `git add -A tools tests assets types enemy compose checks palette && git commit -m "refactor: 全グリッドを用途の色の名前に移し替え、master.json を消す"`

---

### Task 5: `validate.py` の新しい決まり

**Files:**
- Modify: `tools/validate.py`
- Test: `tests/test_validate.py`

**Interfaces:**
- Consumes: `palette.Palette`（`allowed`・`kind_of`）
- Produces: `validate.palette_rules(path: Path, grid: Grid, pal: Palette) -> list[str]`（失敗の文の並び）。`validate.unused(pal: Palette, used: set[str]) -> tuple[set[str], set[str]]`（使われていない用途の色・色見本）

決まり（設計書）:
1. `map` の名前が、そのグリッドの `# type:` の `allowed(type)` にある
2. `assets/part/equip/<物>/` のうち `shield` 以外は、輪郭と種類 `blade`・`weapon` だけ。`shield` は輪郭と `shield` だけ
3. `assets/part/` のうち `equip` 以外と `types/unit/base/` は、種類 `blade`・`weapon`・`shield` を使わない（`assets/unit/` の組んだコマは対象外）
4. 使われていない用途の色・色見本は、最後に `note:` の行で報告する（終了コードは変えない）

- [ ] **Step 1: 失敗するテストを書く**（一時フォルダのパレットとグリッド。パスは `assets/part/...` の形の相対パスを作って渡す）: `test_name_from_other_type_fails`、`test_weapon_part_with_headgear_colour_fails`、`test_shield_part_with_blade_colour_fails`、`test_head_part_with_blade_colour_fails`、`test_composed_unit_frame_may_use_weapon`、`test_unused_are_reported`
- [ ] **Step 2: 落ちることを確かめる** Run: `.venv/bin/python -m unittest tests.test_validate -v` → FAIL
- [ ] **Step 3: 書く**（`main` で `palette.load()` を1回読み、各グリッドに `palette_rules` を掛ける）
- [ ] **Step 4: 通ることを確かめる** → OK
- [ ] **Step 5: 既存の全件に掛ける。** Run: `.venv/bin/python tools/validate.py` → Expected: 終了コード 0。落ちた件数（偽陽性）と、未使用の報告を台帳に書く。落ちたら、絵の色の割り当て（Task 3 の対応表）の誤りか、決まりの誤りかを確かめて直す（例外は作らない）
- [ ] **Step 6: コミット** `git commit -am "feat: validate が用途の色の型と、武器・盾の色の決まりを確かめる"`（新しいテストファイルなら `git add` も）

---

### Task 6: `weapon_check` と `compose.py` を種類で読む

**Files:**
- Modify: `tools/unit_rules.py`、`tools/unit_config.py`（`weapon_check` のキー）、`tools/compose.py`（`hand_colours`・`keep`）、`compose/{roran,ines,gau}.json`、`checks/{roran,gau}.json`、`tools/hand_outline.py`（`--hand` の既定を肌の種類から）
- Test: `tests/test_unit_rules.py`、`tests/test_compose.py`、`tests/test_weapon_check.py`

**Interfaces:**
- Consumes: `palette.Palette.names_of_kind`
- Produces:
  - `checks/<unit>.json` の `weapon_check` から `blade`・`weapon`・`hand` を消す。書いてあれば `UnitConfigError`（「色はパレットの種類から読む」）
  - `unit_rules.build_steps` は `--blade` に `names_of_kind("blade", type="unit")`、`--weapon` に `names_of_kind("weapon", type="unit")`、`--hand` に `names_of_kind("skin", type="unit")` を渡す（`weapon_check.py` の CLI は今のまま）
  - `compose/*.json` の最上位の `hand_colours` を消し、手の色は `names_of_kind("skin", type="unit")`。`keep` は色の名前でなく種類の並び（例: `"keep": ["blade", "weapon"]`）。古い形が書いてあれば `ComposeError`

- [ ] **Step 1: 失敗するテストを書く**
  - `test_weapon_check_colours_come_from_kinds`（unit_rules）: 一時パレットで `blade` 2つ・`weapon` 1つ・`skin` 2つ → 組み立てた引数の `--blade`・`--weapon`・`--hand` がそれぞれその名前（順不同）
  - `test_old_weapon_check_colour_keys_rejected`（unit_config）
  - `test_ornament_of_grip_colour_is_not_the_grip`（weapon_check）: 柄と同じ値で種類 `ornament` の横1行の帯を、短剣の下2行に置いたコマで、`--weapon` に柄の名前だけを渡すと「拳が柄の真ん中に無い」が出ない（今回のベルトの形）
  - `test_keep_lists_kinds`・`test_hand_colours_rejected`（compose）
- [ ] **Step 2: 落ちることを確かめる** → FAIL
- [ ] **Step 3: 書き、3体の設定を新しい形にする**
- [ ] **Step 4: 通ることを確かめる。** unittest → OK。Run: `.venv/bin/python tools/unit_rules.py checks/{roran,ines,gau}.json` → Task 4 の `before/rules_<unit>.txt` と同じ。`compose.py compose/<unit>.json --check` → 0
- [ ] **Step 5: コミット** `git commit -am "feat: weapon_check と compose が武器・手の色をパレットの種類から読む"`

---

### Task 7: `part_outline` で、髪と装飾品の体の上の縁を許す

**Files:**
- Modify: `tools/part_outline.py`
- Test: `tests/test_part_outline.py`

**Interfaces:**
- Consumes: `palette.Palette.kind_of`、`UnitConfig.frames`（部品を使うコマと、その芯）
- Produces: 判定 — 輪郭でない画素が透明に接していても、(a) その画素の種類が `hair` か `ornament` で、(b) 接している透明な所が、その部品を使う**すべての**コマの芯で透明でないなら、落とさない。ほかはすべて今までどおり

- [ ] **Step 1: 失敗するテストを書く**（一時の部品と芯）: `test_hair_edge_over_core_passes`、`test_hair_edge_outside_core_fails`、`test_ornament_edge_over_core_passes`、`test_headgear_edge_over_core_fails`（兜の後ろの縁が後頭部の上で切れている今回の形）、`test_edge_over_core_in_only_some_frames_fails`（歩きの脚のように、芯がコマで違う所）
- [ ] **Step 2: 落ちることを確かめる** → FAIL
- [ ] **Step 3: 書く**（docstring の `open_chars` の説明に、髪・装飾品の扱いを足す）
- [ ] **Step 4: 通ることを確かめる。** unittest → OK。Run: `.venv/bin/python tools/part_outline.py checks/{roran,ines,gau}.json` → 前と同じ結果
- [ ] **Step 5: コミット** `git commit -am "feat: part_outline が髪と装飾品の体の上の縁を輪郭なしで通す"`

---

### Task 8: `eye_check` が目の部品から目を読む

**Files:**
- Modify: `tools/eye_check.py`、`tools/unit_config.py`（`parts` の役割 `eye`、`eyes` のキー）
- Test: `tests/test_eye_check.py`、`tests/test_unit_config.py`

**Interfaces:**
- Produces:
  - `parts` の役割 `"eye": true`（目の部品）。目の部品があるユニットでは、設定に `eyes` を書かない（書けば `UnitConfigError`）。目の部品が無いユニット（ロラン・イネス・ガウ）は、今までどおり `eyes` が必要
  - 判定（コマごと）: 目の画素 = 目の部品の背景でない画素。目の部品より手前に積んだ `head` の部品で、目の画素が**すべて**覆われていれば、その向きは目なしとして通す。**一部だけ**覆われていれば「目の一部が被り物に隠れている N 件」で落とす。覆われていなければ、今の2つの判定（輪郭の色か、左右の隣が見分けられるか）
  - 目の上端の行の比較は、目がすべて隠れた向きを除く

- [ ] **Step 1: 失敗するテストを書く**（一時の芯・目・被り物の部品と compose・checks の設定）: `test_eyes_read_from_eye_part_diagonal`（E2 の斜めの目が通る）、`test_fully_hidden_eyes_pass`（バイザーで全部隠れる）、`test_partly_hidden_eyes_fail`、`test_eye_next_to_face_edge_still_fails`（E5 の直す前の形）、`test_eyes_key_with_eye_part_rejected`、`test_top_row_ignores_hidden_direction`
- [ ] **Step 2: 落ちることを確かめる** → FAIL
- [ ] **Step 3: 書く**
- [ ] **Step 4: 通ることを確かめる。** unittest → OK。Run: `.venv/bin/python tools/eye_check.py checks/{roran,ines,gau}.json` → 前と同じ
- [ ] **Step 5: コミット** `git commit -am "feat: eye_check が目の部品から目を読み、被り物に全部隠れた目を通す"`

---

### Task 9: 文書と最終確認

**Files:**
- Modify: `README.md`、`CLAUDE.md`（forge）、`types/unit/SPEC.md`、`types/item/SPEC.md`（素材ごとの色の表）、`ISSUES.md`、`docs/HANDOFF.md` の `master.json` の記述（あれば）、character-tactics の `CLAUDE.md`・`README.md`（パレットに触れていれば）
- Create: `docs/superpowers/ledgers/2026-10-30-palette-uses.md`（台帳の写し）

- [ ] **Step 1: 文書を直す。** `master.json` を指す記述をすべて新しい構成に（`grep -rn "master.json"` が、ログの `docs/superpowers/` 以外で0件）。forge の CLAUDE.md:「`map` の値は `palette/uses/<型>.json` か `common.json` の用途の色」「パレットに色を足すなら（色見本）、描く前に `probe_colors.py` で測る」「用途の色を足すときは種類と説明を書く」。`types/unit/SPEC.md` に武器・盾・装飾品・髪・被り物の色の決まり（Global Constraints の文）。ISSUES に「イネスのピアスは芯に描かれている。イネスを組み直すときに装飾品の部品へ分ける」
- [ ] **Step 2: 最終確認。** Run: `.venv/bin/python -m unittest discover -s tests` → OK、`tools/validate.py` → 0、Task 4 Step 7 の PNG の比較をもう一度 → 差 0、`unit_rules.py checks/{roran,ines,gau}.json` → `before/` と同じ
- [ ] **Step 3: 台帳を写してコミット** `git add -A && git commit -m "docs: パレットの新しい構成と色の決まりを README・CLAUDE.md・SPEC に書く"`

---

## この計画の後

- PR は依頼者の指示で作る（`.github/pull_request_template.md` の5項目）
- マージ後、`feat/enemy-rebuild-1` を新しい main に載せ直し、`git stash` の「enemy-rebuild-1 Task 4 途中（パレット作り直し待ち。10-30）」を戻す。退避した部品（頭・目・服・敵の男性の芯）を `palette_migrate.py` で用途の色に移し、1回目の Task 4 をやり直す（3件が例外なしに通ることをそこで確かめる）
