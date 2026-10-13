# pixel-asset-forge の置き場の整理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `pixel-asset-forge/cand/` をなくし、敵のコマを `assets/unit/<id>/`、部品をすべて `assets/part/<種類>/<名前>/`、1体用のスクリプトを `gen/<ユニット>/` へ移す。絵は1画素も変えない。

**Architecture:** ファイルは `git mv` で動かし、パスを書いているコード・設定・テスト・文書を書き換える。敵の部品のパスは `gen/enemy/mkparts.py` の `part_path()` 1か所で決め、生成スクリプトと移動の作業用スクリプトの両方がそれを使う。`tools/parts_export.py` は部品ごとの置き場（`PartDef.dir`）を持つ。絵が変わっていないことは、作業前に取った控え（シートの PNG のハッシュ・ファイルの中身のハッシュ・生成スクリプトの出力）と比べて確かめる。

**Tech Stack:** Python 3.14（`pixel-asset-forge/.venv`）、unittest、Pillow。ゲーム側は TypeScript + Vite + vitest（触らないが最後に通す）。

**Spec:** `docs/superpowers/specs/2026-10-12-asset-layout-design.md`

## Global Constraints

- 絵は1画素も変えない。変えるのは置き場（パス）と、パスを書いているコード・設定・文書だけ
- 部品の置き場は `assets/part/<種類>/<名前>/`。ファイル名は変えない。種類は `equip` `fist` `body` `head` `hair` `eye` `cloth`
- 敵のコマは `assets/unit/<id>/`（味方と同じ）。1体（または敵だけ）のためのスクリプトは `gen/<ユニット>/`。汎用の道具は `tools/`
- `docs/superpowers/`（character-tactics と forge の両方）の過去の spec・plan・台帳は書き換えない
- 作業フォルダは `character-tactics/.superpowers/sdd/2026-10-12-asset-layout/`（git 管理外）。以下 `$W`。forge から見て `../.superpowers/sdd/2026-10-12-asset-layout`
- コマンドは特に書かない限り `pixel-asset-forge/` で実行する。Python は `.venv/bin/python`
- コミットは Conventional Commits + 日本語（例 `refactor: …`）。リポジトリは character-tactics（forge はその中のフォルダ）。ブランチは `refactor/asset-layout`
- push と PR は依頼者の指示があったときだけ
- 安全フックが `git checkout -- <path>` と `python - <<EOF` を止める。走らせて変わったファイルを戻すときは `git stash push -m "<理由>" -- <path>` を使う（stash は消さずに残してよい）。Python のスクリプトはファイルに書いてから走らせる

## Review Focus

1. **部品の名前から置き場が決まらないとき**（`part_path("cape_red", "down")`、`part_path("hair_", "down")`）: 黙って変な場所を返さず `ValueError` で止まる → Task 4 のテスト
2. **`PartDef` に置き場 `dir` を書き忘れた／`..` を含めたとき**: 書き出しを始める前に `ExportError` で止まり、何も書かない → Task 4 のテスト
3. **`anim_compare.py` にゲームのユニット設定でないファイル・壊れた JSON・`sprites.map.attack` が無い設定を渡したとき**: トレースバックでなく `error:` と終了コード 2 → Task 5 のテスト
4. **`reorder.py` の順に、部品に無い名前を書いた／部品を書き漏らした／芯（CORE）が無いとき**: `KeyError` で落ちずに、どの名前かを言って終了コード 2 → Task 5 のテスト
5. **移動の作業用スクリプトを2回走らせたとき**（途中で止まって再実行した）: 既に移したファイルを二重に動かさず、残りだけ動かす → Task 3・4 の Step（`git ls-files` で今ある元の場所だけを対象にする）

---

## ファイルの対応（整理前 → 整理後）

| 整理前 | 整理後 |
|---|---|
| `cand/enemy-frames/<id>/`（16体） | `assets/unit/<id>/` |
| `cand/enemy/<部品>_<dir>.txt` | `assets/part/<種類>/<名前>/<部品>_<dir>.txt`（`part_path()` が決める） |
| `cand/enemy/PICKER.json` `PICKER_female.json` | `gen/enemy/` |
| `cand/gen/mkparts.py` `mkframes.py` `mkweapons.py` | `gen/enemy/` |
| `cand/gen/ines_layers.py` | `gen/ines/ines_layers.py` |
| `cand/gen/roran_layers.py` | `gen/roran/roran_layers.py` |
| `assets/part/dagger/` | `assets/part/equip/dagger/` |
| `assets/unit/roran/parts/` | `sword_*`→`equip/sword/`、`shield_*`→`equip/shield/`、`sword_hand_*` `shield_hand_*`→`fist/roran/`、`core_*`→`body/roran/` |
| `assets/unit/ines/parts/` | `bow_*`→`equip/bow/`、`arrow_*`→`equip/arrow/`、`bow_hand_*` `arrow_hand_*`→`fist/ines/`、`core_*`→`body/ines/` |
| `assets/unit/gau/parts/` | `body_*`→`body/gau/`、`hood_*`→`head/hood/`、`hair_*`→`hair/gau/` |
| イネスの作業フォルダの `anim_compare.py` `reorder.py` | `tools/` |
| 消す | `cand/layer-trial/`、`cand/gen/{mklayers,layer_page,table_page,build_sheets,render_combos}.py`、`tests/test_{mklayers,layer_page,table_page}.py`、`tools/layers.py` の `shifted` `attach` `finish` `ADDED` |

---

### Task 0: 作業前の控えを取る

**Files:**
- Create: `$W/before/`（git 管理外）

- [ ] **Step 1: 作業フォルダを作り、2026-10-12 に取った生成スクリプトの出力を移す**

ブレインストーミングのとき、`cand/gen/` の3本を走らせた出力を Claude の作業用フォルダ（`/tmp/claude-1000/.../scratchpad/regen-before/`）に控えてある。これを `$W/before/regen/` に写す。見つからなければ Step 2 で作り直す。

```bash
mkdir -p ../.superpowers/sdd/2026-10-12-asset-layout/before
ls /tmp/claude-1000/-home-ubuntu-workspace/*/scratchpad/regen-before 2>/dev/null
```

あれば:

```bash
cp -r /tmp/claude-1000/-home-ubuntu-workspace/f920d12a-8ccd-50af-87c7-b0be3375b8f9/scratchpad/regen-before ../.superpowers/sdd/2026-10-12-asset-layout/before/regen
```

- [ ] **Step 2: 控えが無ければ、生成スクリプトを走らせて作り、ファイルを戻す**

```bash
.venv/bin/python cand/gen/mkparts.py && .venv/bin/python cand/gen/mkframes.py && .venv/bin/python cand/gen/mkweapons.py
mkdir -p ../.superpowers/sdd/2026-10-12-asset-layout/before/regen
cp -r cand/enemy-frames cand/enemy ../.superpowers/sdd/2026-10-12-asset-layout/before/regen/
git stash push -m "Task 0: 生成スクリプトの出力（控えを取った後に戻す）" -- cand/enemy-frames cand/enemy
git status --porcelain   # 何も出ない
```

- [ ] **Step 3: シートの PNG とファイルの中身のハッシュを取る**

```bash
W=../.superpowers/sdd/2026-10-12-asset-layout
.venv/bin/python tools/enemy_build.py --all > /dev/null
(cd build/sheets && sha256sum $(ls *.png | sort)) > $W/before/sheets.sha256
git ls-files -s -- cand/enemy-frames cand/enemy assets/part assets/unit | grep '\.txt$' | awk '{print $2}' | sort > $W/before/blobs.txt
wc -l $W/before/blobs.txt          # 782 + 味方のコマ・部品
.venv/bin/python tools/validate.py | tail -1        # 405 grid(s) ok
for u in roran ines gau; do .venv/bin/python tools/compose.py compose/$u.json --check | grep -c 差あり; done   # 0 0 16
.venv/bin/python -m unittest discover -s tests 2>&1 | tail -1   # OK（425件）
```

結果（件数）を `$W/before/README.txt` に書いておく。コミットは無し。

---

### Task 1: 試作と役目を終えたものを消す

**Files:**
- Delete: `cand/layer-trial/`、`cand/gen/mklayers.py`、`cand/gen/layer_page.py`、`cand/gen/table_page.py`、`cand/gen/build_sheets.py`、`cand/gen/render_combos.py`、`tests/test_mklayers.py`、`tests/test_layer_page.py`、`tests/test_table_page.py`
- Modify: `tools/layers.py`（`shifted` `attach` `finish` `ADDED` と `close_hands` の import を消す）
- Modify: `tests/test_layers.py`（`PlaceTest` と `FinishTest.test_added_outline_is_labelled_and_reproducible` を消す）
- Modify: `cand/gen/roran_layers.py`（`layer_page` から借りていた `png`・`uri` を自分で持つ）

**Interfaces:**
- Produces: `tools/layers.py` は `SIZE` `Frame` `Point` `Layer` `LayerError` `blank` `compose` `differences` だけを持つ。`tools/cut_layers.py` と `cand/gen/roran_layers.py` が使う

- [ ] **Step 1: 消すものが他から使われていないことを確かめる**

```bash
grep -rn "mklayers\|layer_page\|table_page\|build_sheets\|render_combos\|layer-trial" --include=*.py tools tests cand/gen | grep -v "^cand/gen/\(mklayers\|layer_page\|table_page\|build_sheets\|render_combos\)\.py\|^tests/test_\(mklayers\|layer_page\|table_page\)\.py"
grep -rn "shifted\|attach\|finish\|ADDED" --include=*.py tools tests cand/gen | grep -v "^cand/gen/\(mklayers\|layer_page\|table_page\)\.py\|^tests/test_\(mklayers\|layer_page\|table_page\|layers\)\.py\|^tools/layers\.py"
```

Expected: 1つ目は `cand/gen/roran_layers.py:17:from layer_page import png, uri` だけ。2つ目は何も出ない（`hand_outline.py` などの `finish` という語が出たら、`layers` の `finish` を import していないかを見る）。違うものが出たら止めて報告する。

- [ ] **Step 2: ファイルを消す**

```bash
git rm -rq cand/layer-trial cand/gen/mklayers.py cand/gen/layer_page.py cand/gen/table_page.py cand/gen/build_sheets.py cand/gen/render_combos.py tests/test_mklayers.py tests/test_layer_page.py tests/test_table_page.py
```

- [ ] **Step 3: `tools/layers.py` を削る**

docstring の後を次にする（`compose` と `differences` の本体は今のまま）:

```python
from __future__ import annotations

from dataclasses import dataclass, field

Frame = list[list[str | None]]
Point = tuple[int, int]
SIZE = 32


class LayerError(Exception):
    """層や重なり順の表が合成の前提に合わない。"""


@dataclass
class Layer:
    frame: Frame
    anchors: dict[str, Point] = field(default_factory=dict)


def blank() -> Frame:
    return [[None] * SIZE for _ in range(SIZE)]


def _check_size(layer: Layer, name: str) -> None:
    if len(layer.frame) != SIZE or any(len(row) != SIZE for row in layer.frame):
        raise LayerError(f"{name}: 層の大きさが {SIZE}x{SIZE} でない")


def compose(layers: dict[str, Layer], order: list[str]) -> tuple[Frame, Frame]:
    ...（今のまま）


def differences(a: Frame, b: Frame) -> list[Point]:
    return [(x, y) for y in range(SIZE) for x in range(SIZE) if a[y][x] != b[y][x]]
```

docstring の1行目の後に1行足す: `敵の層の試作（mklayers、2026-10-09）で使った shifted・attach・finish は、試作を消したときに消した（2026-10-12）。`

`anchors` は `cut_layers.py` が `Layer(frame)` で作るだけで使わないが、今回は形を変えない（範囲外）。

- [ ] **Step 4: `tests/test_layers.py` を直す**

- import を `from layers import Layer, LayerError, blank, compose, differences  # noqa: E402` にする
- `class PlaceTest` を丸ごと消す
- `class FinishTest` を `class DifferencesTest` に改名し、`test_added_outline_is_labelled_and_reproducible` を消す（`test_differences_lists_changed_pixels` は残す）
- `close_hands` などの import が残っていたら消す

- [ ] **Step 5: `cand/gen/roran_layers.py` に `png`・`uri` を持たせる**

`from layer_page import png, uri  # noqa: E402` の行を消し、import を次のようにする（`gridfile` の行を置き換え）:

```python
import base64
import io
...
from PIL import Image, ImageDraw
...
from gridfile import load_palette, parse  # noqa: E402
```

`SRC = Path(...)` の直前に足す（消した `layer_page.py` と同じ中身）:

```python
S = 8  # 表のページの拡大率
PAL = load_palette()


def png(frame, bg=(225, 225, 225, 255), marks=()):
    im = Image.new("RGBA", (32, 32), bg)
    for y, row in enumerate(frame):
        for x, n in enumerate(row):
            if n:
                im.putpixel((x, y), tuple(PAL[n][:3]) + (255,))
    im = im.resize((32 * S, 32 * S), Image.NEAREST)
    d = ImageDraw.Draw(im)
    for x, y in marks:
        d.rectangle([x * S, y * S, x * S + S - 1, y * S + S - 1], outline=(230, 0, 0), width=2)
    return im


def uri(im):
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
```

- [ ] **Step 6: 確かめる**

```bash
.venv/bin/python -m unittest discover -s tests 2>&1 | tail -3      # OK（425 から消したテストの分が減る）
.venv/bin/python cand/gen/roran_layers.py build/table_roran.html   # ok build/table_roran.html
.venv/bin/python cand/gen/mkweapons.py axe-horn > /dev/null && git stash push -m "Task 1: mkweapons の試し走らせ" -- cand/enemy-frames; git status --porcelain   # 何も出ない（mkweapons が mklayers に頼っていない）
```

- [ ] **Step 7: コミット**

```bash
git add -A pixel-asset-forge
git commit -m "refactor: 敵の層の試作（mklayers と比較ページ）と役目を終えたスクリプトを消す"
```

---

### Task 2: 1体用のスクリプトを `gen/` へ移す

**Files:**
- Move: `cand/gen/{mkparts,mkframes,mkweapons}.py` → `gen/enemy/`、`cand/enemy/PICKER.json` `PICKER_female.json` → `gen/enemy/`、`cand/gen/ines_layers.py` → `gen/ines/`、`cand/gen/roran_layers.py` → `gen/roran/`
- Modify: `gen/enemy/mkweapons.py`（`sys.path` と docstring）、`gen/enemy/mkparts.py`（PICKER の書き先）、`gen/enemy/mkframes.py`（コメント）、`gen/ines/ines_layers.py` と `gen/roran/roran_layers.py`（docstring のコマンド）

**Interfaces:**
- Produces: `gen/enemy/mkparts.py`（module `mkparts`）・`gen/enemy/mkframes.py`（`mkframes`、`import mkparts as mp`）・`gen/enemy/mkweapons.py`（`mkweapons`、`import mkframes as mf`）。cwd は forge の直下で走らせる

- [ ] **Step 1: 移す**

```bash
mkdir -p gen/enemy gen/ines gen/roran
git mv cand/gen/mkparts.py cand/gen/mkframes.py cand/gen/mkweapons.py gen/enemy/
git mv cand/enemy/PICKER.json cand/enemy/PICKER_female.json gen/enemy/
git mv cand/gen/ines_layers.py gen/ines/
git mv cand/gen/roran_layers.py gen/roran/
ls cand/gen   # __pycache__ だけ（あれば rm -rf cand/gen/__pycache__）
```

- [ ] **Step 2: パスを直す**

- `gen/enemy/mkweapons.py`: `sys.path.insert(0, "cand/gen")` → `sys.path.insert(0, "gen/enemy")`。docstring の `python cand/gen/mkweapons.py` → `.venv/bin/python gen/enemy/mkweapons.py`
- `gen/enemy/mkframes.py`: `# 同じ cand/gen の mkparts を読む` → `# 同じ gen/enemy の mkparts を読む`
- `gen/enemy/mkparts.py`: `Path("cand/enemy/PICKER.json")` → `Path("gen/enemy/PICKER.json")`、`Path("cand/enemy/PICKER_female.json")` → `Path("gen/enemy/PICKER_female.json")`。`main()` の docstring の「cand/enemy/ に書き出す」を「部品を cand/enemy/ に、選ぶページの設定を gen/enemy/ に書き出す」にする（部品の置き場は Task 4 で変わる）
- `gen/ines/ines_layers.py`: docstring の `cand/gen/ines_layers.py` → `gen/ines/ines_layers.py`
- `gen/roran/roran_layers.py`: docstring の `cand/gen/roran_layers.py` → `gen/roran/roran_layers.py`。docstring の最後に足す: `--export は走らせない。2026-10-11 に描き直した部品（体 + 拳）と compose/roran.json を、描き直す前の切り方で上書きしてしまう。`

確かめる:

```bash
grep -rn "cand/gen" gen tools tests | grep -v __pycache__   # 何も出ない（tools/parts_export.py の docstring は Task 6 で直すので出てよい）
```

- [ ] **Step 3: 比べる作業用スクリプトを書く**

`$W/compare_regen.py` を書く（git 管理外）:

```python
"""生成スクリプトの出力を、Task 0 の控え（before/regen）とファイルごとに比べる（作業用、2026-10-12）。

    .venv/bin/python ../.superpowers/sdd/2026-10-12-asset-layout/compare_regen.py FRAMES_ROOT PARTS_MODE

FRAMES_ROOT: 敵のコマの親（cand/enemy-frames か assets/unit）。
PARTS_MODE: cand（cand/enemy/<名前>.txt）か part（gen/enemy/mkparts.part_path で引く）。
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BEFORE = HERE / "before" / "regen"


def main(frames_root: str, parts_mode: str) -> int:
    bad, n = [], 0
    for old in sorted((BEFORE / "enemy-frames").rglob("*.txt")):
        rel = old.relative_to(BEFORE / "enemy-frames")
        now = Path(frames_root) / rel
        n += 1
        if not now.is_file() or now.read_bytes() != old.read_bytes():
            bad.append(str(now))
    if parts_mode == "part":
        sys.path.insert(0, "tools")
        sys.path.insert(0, "gen/enemy")
        from mkparts import part_path
    for old in sorted((BEFORE / "enemy").glob("*.txt")):
        if parts_mode == "cand":
            now = Path("cand/enemy") / old.name
        else:
            stem, d = old.stem.rsplit("_", 1)
            now = part_path(stem, d)
        n += 1
        if not now.is_file() or now.read_bytes() != old.read_bytes():
            bad.append(str(now))
    for old in sorted((BEFORE / "enemy").glob("*.json")):
        now = Path("gen/enemy") / old.name
        n += 1
        # PICKER は中のパスが変わるので、Task 4 以降は中身でなく有無だけを見る
        if not now.is_file() or (parts_mode == "cand" and now.read_bytes() != old.read_bytes()):
            bad.append(str(now))
    for p in bad:
        print("違う", p)
    print(f"{n - len(bad)}/{n} 同じ")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
```

- [ ] **Step 4: テストを通してコミットする**

`git stash` は HEAD との差分をすべて退避するので、Step 2 の書き換えを先にコミットしてから、生成スクリプトを走らせる。

```bash
.venv/bin/python -m unittest discover -s tests 2>&1 | tail -1   # OK
.venv/bin/python gen/roran/roran_layers.py build/table_roran.html
git add -A pixel-asset-forge && git commit -m "refactor: 1体用のスクリプトを cand/gen から gen/<ユニット>/ へ移す"
```

- [ ] **Step 5: 生成スクリプトの出力が控えと同じことを確かめる**

```bash
W=../.superpowers/sdd/2026-10-12-asset-layout
.venv/bin/python gen/enemy/mkparts.py && .venv/bin/python gen/enemy/mkframes.py && .venv/bin/python gen/enemy/mkweapons.py > /dev/null
.venv/bin/python $W/compare_regen.py cand/enemy-frames cand    # 782/782 同じ（コマ 672 + 部品 108 + PICKER 2）
git stash push -m "Task 2: 生成スクリプトの出力（控えと比べた後に戻す）" -- cand gen/enemy
git status --porcelain   # 何も出ない
```

Expected: `782/782 同じ`。違うと出たら、`git stash` の前に `git diff` で中身を見て、止めて報告する。

---

### Task 3: 敵のコマを `assets/unit/<id>/` へ移す

**Files:**
- Move: `cand/enemy-frames/<id>/` → `assets/unit/<id>/`（16体）
- Modify: `enemy/*.json`（16本の `frames`）、`gen/enemy/mkframes.py`（`OUT`）、`gen/enemy/mkweapons.py`（`OUT`）、`gen/enemy/mkparts.py`（`cfg_female["refs"]`）、`tools/enemy_build.py`（`SOURCES`）、`tests/test_enemy_build.py:148`
- Create: `$W/move_frames.py`（git 管理外）

**Interfaces:**
- Produces: 敵 `<id>` のコマは `assets/unit/<id>/<dir>_<状態>.txt`、武器を持たせる前は `assets/unit/<id>/noweapon/`。`enemy_build.SOURCES[("dagger", "female")] == "assets/unit/dagger-female"`

- [ ] **Step 1: 失敗するテストに直す**

`tests/test_enemy_build.py` の `test_source_paths_follow_archetype_and_body`:

```python
        self.assertEqual(source, Path("/forge/assets/unit/dagger-female"))
```

```bash
.venv/bin/python -m unittest tests.test_enemy_build 2>&1 | tail -3   # FAILED（enemy-src/dagger-female が返る）
```

- [ ] **Step 2: `tools/enemy_build.py` を直す**

```python
SOURCES = {
    ("dagger", "male"): "assets/unit/gau",
    ("dagger", "female"): "assets/unit/dagger-female",  # まだ作っていない（--colours dagger は置き場が無いと言って止まる）
}
```

```bash
.venv/bin/python -m unittest tests.test_enemy_build 2>&1 | tail -1   # OK
```

- [ ] **Step 3: 移動の作業用スクリプトを書く**

`$W/move_frames.py`:

```python
"""敵のコマを cand/enemy-frames/<id>/ から assets/unit/<id>/ へ git mv し、レシピの frames を書き換える（作業用、2026-10-12）。
何度走らせてもよい（git ls-files で今 cand/enemy-frames にあるものだけを動かす）。

    .venv/bin/python ../.superpowers/sdd/2026-10-12-asset-layout/move_frames.py
"""
import json
import subprocess
from pathlib import Path

OLD, NEW = "cand/enemy-frames", "assets/unit"


def main() -> None:
    files = subprocess.run(["git", "ls-files", "--", OLD], capture_output=True, text=True, check=True).stdout.split()
    for old in files:
        new = Path(NEW) / Path(old).relative_to(OLD)
        if new.exists():
            raise SystemExit(f"移す先に既にある: {new}")
        new.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "mv", old, str(new)], check=True)
    print("移した", len(files))
    for recipe in sorted(Path("enemy").glob("*.json")):
        text = recipe.read_text(encoding="utf-8")
        data = json.loads(text)
        frames = data.get("frames")
        if isinstance(frames, str) and frames.startswith(OLD + "/"):
            recipe.write_text(text.replace(f'"{frames}"', f'"{NEW}/{frames[len(OLD) + 1:]}"'), encoding="utf-8")
            print("書き換えた", recipe)


if __name__ == "__main__":
    main()
```

（`text.replace` を使うのは、レシピの書式（改行・並び）を変えないため。`frames` の値はレシピの中に1回しか出ない）

- [ ] **Step 4: 移す**

```bash
.venv/bin/python ../.superpowers/sdd/2026-10-12-asset-layout/move_frames.py   # 移した 672、書き換えた ×16
ls cand/enemy-frames 2>/dev/null | wc -l   # 0（空のフォルダが残れば rmdir）
git diff -U0 enemy | grep '^[-+] ' | grep -v '"frames"'   # 何も出ない
```

- [ ] **Step 5: 生成スクリプトの書き先を直す**

- `gen/enemy/mkframes.py`: `OUT = Path("cand/enemy-frames")` → `OUT = Path("assets/unit")`
- `gen/enemy/mkweapons.py`: `OUT = Path("cand/enemy-frames")` → `OUT = Path("assets/unit")`
- `gen/enemy/mkparts.py` の `cfg_female["refs"]` の4行: `"cand/enemy-frames/` → `"assets/unit/`

- [ ] **Step 6: 確かめる**

```bash
W=../.superpowers/sdd/2026-10-12-asset-layout
.venv/bin/python tools/enemy_build.py --all > /dev/null
(cd build/sheets && sha256sum $(ls *.png | sort)) | diff - $W/before/sheets.sha256 && echo シート同じ
.venv/bin/python tools/validate.py | tail -1        # 1077 grid(s) ok（405 + 672）
.venv/bin/python -m unittest discover -s tests 2>&1 | tail -1   # OK
grep -rn "cand/enemy-frames" gen tools tests enemy | grep -v __pycache__   # tools/weapon_check.py の docstring だけ（Task 6 で直す）
```

- [ ] **Step 7: コミットしてから、生成スクリプトの出力を比べる**

```bash
git add -A pixel-asset-forge
git commit -m "refactor: 敵16体のコマを cand/enemy-frames から assets/unit/<id>/ へ移す"
.venv/bin/python gen/enemy/mkparts.py && .venv/bin/python gen/enemy/mkframes.py && .venv/bin/python gen/enemy/mkweapons.py > /dev/null
.venv/bin/python ../.superpowers/sdd/2026-10-12-asset-layout/compare_regen.py assets/unit cand   # 782/782 同じ
git stash push -m "Task 3: 生成スクリプトの出力（控えと比べた後に戻す）" -- assets/unit cand gen/enemy
git status --porcelain   # 何も出ない
```

PICKER は `refs` が変わったので、ここでは `compare_regen.py` の PICKER の比較が「違う」と出る。その2件だけなら問題ない（Task 4 で PICKER を作り直す）。それ以外が出たら止めて報告する。

---

### Task 4: 部品を `assets/part/<種類>/<名前>/` へ移す

**Files:**
- Modify: `gen/enemy/mkparts.py`（`part_path()` を足し、書き先と PICKER のパスに使う）、`gen/enemy/mkframes.py`（`RAW` `WALK` と読み込み）、`gen/enemy/mkweapons.py`（髪の読み込み）
- Modify: `tools/parts_export.py`（`PartDef.dir`、`export()` の書き先）、`tests/test_parts_export.py`
- Modify: `gen/ines/ines_layers.py`、`gen/roran/roran_layers.py`（書き出し先）
- Modify: `compose/roran.json` `compose/ines.json` `compose/gau.json`（部品と芯のパス）、`gen/enemy/PICKER*.json`（作り直す）
- Create: `tests/test_gen_enemy.py`、`$W/move_parts.py`（git 管理外）
- Move: 上の「ファイルの対応」の部品すべて

**Interfaces:**
- Consumes: Task 2 の `gen/enemy/mkparts.py`
- Produces:
  - `mkparts.part_path(name: str, d: str) -> Path` — `assets/part/<種類>/<名前>/<name>_<d>.txt`。決まらなければ `ValueError`。`d` に `"{dir}"` を渡すとテンプレートの文字列を作れる
  - `parts_export.PartDef(name, file, chars, boxes=None, hand=False, keep=(), dir="")` — `dir` は `assets/part/` からの相対（例 `"equip/bow"`）。空・絶対パス・`..` は `ExportError`
  - `parts_export.export(unit: UnitDef, part_root: Path, config_path: Path, root: Path) -> None` — 芯は `part_root / "body" / unit.unit`、部品は `part_root / part.dir` に書く

- [ ] **Step 1: `part_path` の失敗するテストを書く**

`tests/test_gen_enemy.py`:

```python
"""Checks for gen/enemy/mkparts.py の part_path（敵の部品の置き場）。"""
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))
sys.path.insert(0, str(REPO_ROOT / "gen" / "enemy"))

from mkparts import part_path  # noqa: E402


class PartPathTest(unittest.TestCase):
    def test_kind_and_name_come_from_the_part_name(self):
        cases = {
            ("head_horn", "down"): "assets/part/head/horn/head_horn_down.txt",
            ("hair_A", "up"): "assets/part/hair/A/hair_A_up.txt",
            ("hair_A_back", "left"): "assets/part/hair/A/hair_A_back_left.txt",
            ("eye_E0", "right"): "assets/part/eye/E0/eye_E0_right.txt",
            ("cloth_belt_female", "down"): "assets/part/cloth/belt_female/cloth_belt_female_down.txt",
            ("cloth_none", "down"): "assets/part/cloth/none/cloth_none_down.txt",
            ("gau_body", "down"): "assets/part/body/gau/gau_body_down.txt",
            ("female_gau_body", "up"): "assets/part/body/female/female_gau_body_up.txt",
            ("female_walk_a", "left"): "assets/part/body/female/female_walk_a_left.txt",
            ("female_body_idle2", "down"): "assets/part/body/female/female_body_idle2_down.txt",
        }
        for (name, d), expected in cases.items():
            self.assertEqual(part_path(name, d).as_posix(), expected, name)

    def test_template_keeps_the_direction_placeholder(self):
        self.assertEqual(part_path("head_bare", "{dir}").as_posix(), "assets/part/head/bare/head_bare_{dir}.txt")

    def test_unknown_name_stops(self):
        for name in ("cape_red", "hair_", "head__back", ""):
            with self.assertRaisesRegex(ValueError, "置き場が決まらない"):
                part_path(name, "down")

    def test_every_enemy_part_on_disk_is_where_part_path_says(self):
        root = REPO_ROOT / "assets" / "part"
        found = [p for kind in ("head", "hair", "eye", "cloth") for p in (root / kind).rglob("*.txt")
                 if p.parent.name not in ("hood", "gau")]  # ガウの頭巾（head/hood）・髪（hair/gau）は mkparts の部品でない
        found += list((root / "body" / "female").glob("*.txt")) + list((root / "body" / "gau").glob("gau_body_*.txt"))
        self.assertEqual(len(found), 108, "敵の部品は108ファイル")
        for p in found:
            stem, d = p.stem.rsplit("_", 1)
            self.assertEqual(REPO_ROOT / part_path(stem, d), p)


if __name__ == "__main__":
    unittest.main()
```

```bash
.venv/bin/python -m unittest tests.test_gen_enemy 2>&1 | tail -3   # ImportError（part_path が無い）
```

- [ ] **Step 2: `part_path` を書く**

`gen/enemy/mkparts.py` の `OUT = Path("cand/enemy")` を消し、次に置き換える:

```python
PART_ROOT = Path("assets/part")
KINDS = (("head_", "head"), ("hair_", "hair"), ("eye_", "eye"), ("cloth_", "cloth"))  # 部品の名前の前半 → 種類


def part_path(name, d):
    """敵の部品の名前（head_horn・hair_A_back・female_walk_a など）と向きから、assets/part/<種類>/<名前>/ のファイルを返す。
    d に "{dir}" を渡すと、選ぶページの設定のテンプレートになる。決まらない名前は ValueError（黙って変な所に書かない）。"""
    if name == "gau_body":
        where = "body/gau"
    elif name.startswith("female_") and len(name) > len("female_"):
        where = "body/female"
    else:
        where = None
        for prefix, kind in KINDS:
            rest = name[len(prefix):].removesuffix("_back") if name.startswith(prefix) else ""
            if rest and not rest.startswith("_"):
                where = f"{kind}/{rest}"
                break
        if where is None:
            raise ValueError(f"部品の名前から置き場が決まらない: {name!r}")
    return PART_ROOT / where / f"{name}_{d}.txt"
```

`write()` を次にする:

```python
def write(name, d, g, note):
    path = part_path(name, d)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(ser(g, note), encoding="utf-8")
```

`main()` の `OUT.mkdir(parents=True, exist_ok=True)` を消す。`emit()` が `write()` 以外でファイルを書いていないかを確かめる（`grep -n "OUT" gen/enemy/mkparts.py` が何も出なければよい）。

選ぶページの設定のパスを直す:

```python
def lay(name, zs=None):
    return [{"part": part_path(name, "{dir}").as_posix(), "z": "front"}]
```

- `cfg["body"]`: `part_path("gau_body", "{dir}").as_posix()`
- `cfg_female["body"]`: `part_path("female_gau_body", "{dir}").as_posix()`
- 長い髪の後ろ: `{"part": part_path(f"hair_{k}_back", "{dir}").as_posix(), "z": "back"}`
- 短剣: `"assets/part/dagger/dagger_{dir}.txt"` → `"assets/part/equip/dagger/dagger_{dir}.txt"`
- `main()` の docstring: 「部品を assets/part/<種類>/<名前>/ に、選ぶページの設定を gen/enemy/ に書き出す」

```bash
.venv/bin/python -m unittest tests.test_gen_enemy.PartPathTest.test_kind_and_name_come_from_the_part_name tests.test_gen_enemy.PartPathTest.test_template_keeps_the_direction_placeholder tests.test_gen_enemy.PartPathTest.test_unknown_name_stops 2>&1 | tail -1   # OK
```

（`test_every_enemy_part_on_disk_is_where_part_path_says` は Step 7 で部品を移すまで落ちる）

- [ ] **Step 3: `parts_export` の失敗するテストを書く**

`tests/test_parts_export.py` を直す:

- `setUp` の `PartDef` に置き場を足す: `PartDef("弓", "bow", frozenset("m"), dir="equip/bow")`、`PartDef("矢", "arrow", frozenset("w"), dir="equip/arrow")`、`弓の拳` と `矢の拳` には `dir="fist/t"`（キーワード引数で最後に）
- `run_export` を次にする:

```python
    def run_export(self, unit=None):
        export(unit or self.unit, self.root / "assets/part", self.root / "compose/t.json", self.root)
        return json.loads((self.root / "compose/t.json").read_text(encoding="utf-8"))
```

- `"assets/unit/t/parts/bow_hand_down_base.txt"` → `"assets/part/fist/t/bow_hand_down_base.txt"`
- `self.root / "assets/unit/t/parts/arrow_hand_down_base.txt"` → `self.root / "assets/part/fist/t/arrow_hand_down_base.txt"`
- `stops_without_writing` を次にする:

```python
    def stops_without_writing(self, unit, message):
        """書き出しが message で止まり、前からある部品・芯・設定を1つも変えず、新しいファイルも作らない。"""
        part_root = self.root / "assets/part"
        kept = {part_root / "body/t/core_down_base.txt": "前からある芯\n",
                part_root / "equip/bow/bow_down_base.txt": "前からある弓\n",
                self.root / "compose/t.json": "前からある設定\n"}
        for path, text in kept.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
        with self.assertRaisesRegex(ExportError, message):
            self.run_export(unit)
        for path, text in kept.items():
            self.assertEqual(path.read_text(encoding="utf-8"), text, path.name)
        self.assertEqual(sorted(p.relative_to(part_root).as_posix() for p in part_root.rglob("*") if p.is_file()),
                         ["body/t/core_down_base.txt", "equip/bow/bow_down_base.txt"])
```

- `test_unreadable_frame_in_a_later_state_writes_nothing` の `parts = self.root / "assets/unit/t/parts"` を `parts = self.root / "assets/part/body/t"` にする（中の `core_down_base.txt` の扱いはそのまま）
- 新しいテストを足す:

```python
    def test_parts_land_in_their_kind_directories(self):
        config = self.run_export()
        part_root = self.root / "assets/part"
        for rel in ("body/t/core_down_base.txt", "body/t/core_down_walk_a.txt", "equip/bow/bow_down_base.txt",
                    "equip/arrow/arrow_down_base.txt", "fist/t/bow_hand_down_base.txt"):
            self.assertTrue((part_root / rel).is_file(), rel)
        frame = config["frames"]["down_walk_a"]
        self.assertEqual(frame["body"], "assets/part/body/t/core_down_walk_a.txt")
        self.assertIn("assets/part/equip/bow/bow_down_base.txt", [layer["part"] for layer in frame["layers"]])

    def test_part_without_a_directory_writes_nothing(self):
        parts = tuple(PartDef(p.name, p.file, p.chars, p.boxes, p.hand, p.keep) for p in self.unit.parts)
        self.stops_without_writing(UnitDef(**{**self.unit.__dict__, "parts": parts}), "置き場")

    def test_part_directory_must_stay_under_the_part_root(self):
        for bad in ("../equip/bow", "/tmp/bow"):
            parts = (PartDef("弓", "bow", frozenset("m"), dir=bad), *self.unit.parts[1:])
            with self.assertRaisesRegex(ExportError, "置き場"):
                self.run_export(UnitDef(**{**self.unit.__dict__, "parts": parts}))
```

```bash
.venv/bin/python -m unittest tests.test_parts_export 2>&1 | tail -3   # FAILED（dir を知らない／書き先が違う）
```

- [ ] **Step 4: `tools/parts_export.py` を直す**

docstring の2〜6行目を次にする:

```
ロランの書き出し（gen/roran/roran_layers.py --export）は色名で切ったが、イネスは弓の暗い面・矢の軸・ズボンが
同じ wood_shadow なので、専用の文字（SPEC「持ち物の部品には専用の文字を割り当てる」）で切る。
部品の取り方は tools/cut_layers.cut と同じ（箱の中の、その部品の文字。輪郭は接するすべての層に入る）。
ユニットごとの定義（UnitDef）は gen/<ユニット>/<ユニット>_layers.py に置く。書くのは部品と設定だけで、コマは書かない。
部品は assets/part/<種類>/<名前>/ に書く（芯は body/<ユニット>/、ほかは PartDef.dir。2026-10-12 依頼者と決めた置き場）。
```

`PartDef` に足す（最後のフィールド）:

```python
    dir: str = ""  # 置き場（assets/part/ からの相対。例 equip/bow・fist/ines）
```

`_validate` の先頭（`names = ...` の前）に足す:

```python
    for part in unit.parts:
        where = Path(part.dir)
        if not part.dir or where.is_absolute() or ".." in where.parts:
            raise ExportError(f"{part.name} の置き場（dir）が無いか、assets/part/ の中の相対パスでない: {part.dir!r}")
```

`export` を次のように変える（変わる行だけ）:

```python
def export(unit: UnitDef, part_root: Path, config_path: Path, root: Path) -> None:
    """部品のファイルと compose の設定を書く（コマは書かない）。芯は part_root/body/<ユニット>/、部品は part_root/<dir>/。
    設定のパスは root からの相対。定義に誤りがあれば、何も書かずに ExportError で止める。"""
    _validate(unit)
    charmap = unit_charmap(sorted(unit.src.glob("*.txt")))
    by_name = {p.name: p for p in unit.parts}
    core_dir = part_root / "body" / unit.unit
    for folder in {core_dir, *(part_root / p.dir for p in unit.parts)}:
        folder.mkdir(parents=True, exist_ok=True)
    ...
            core_path = core_dir / f"core_{d}_{st}.txt"
    ...
                path = part_root / part.dir / f"{part.file}_{d}_{key}.txt"
```

（`parts_dir.mkdir(...)` の行は消す）

注意: 今の `test_unreadable_frame_in_a_later_state_writes_nothing` は、読めないコマで止まったときにフォルダを作っていないことまでは見ていない（中身のファイルだけを見る）。フォルダの作成が `_validate` の後・最初の書き込みの前なのは今と同じ。

```bash
.venv/bin/python -m unittest tests.test_parts_export 2>&1 | tail -1   # OK
```

- [ ] **Step 5: ユニットの書き出し定義を直す（走らせない）**

`gen/ines/ines_layers.py`:

```python
    parts=(PartDef("弓", "bow", frozenset("klms"), dir="equip/bow"),
           PartDef("矢", "arrow", frozenset("wtu"), dir="equip/arrow"),
           PartDef("弓の拳", "bow_hand", SKIN, BOW_HAND, hand=True,
                   keep=GRIPPED, dir="fist/ines"),
           PartDef("矢の拳", "arrow_hand", SKIN, ARROW_HAND, hand=True,
                   keep=GRIPPED, dir="fist/ines")),
```

`main` の `export(INES, Path("assets/unit/ines/parts"), ...)` → `export(INES, Path("assets/part"), Path("compose/ines.json"), Path("."))`、`print` → `"書き出した assets/part/ の弓・矢・拳・芯と compose/ines.json"`。

`gen/roran/roran_layers.py`:

```python
PART_ROOT = Path("assets/part")
CONFIG = Path("compose/roran.json")
...
# ファイルの名前の前半 → 置き場（assets/part/ からの相対）
PART_DIR = {"sword": "equip/sword", "shield": "equip/shield", "sword_hand": "fist/roran", "shield_hand": "fist/roran"}
```

（`PARTS_DIR = Path("assets/unit/roran/parts")` は消す）`export(parts_dir, config_path)` を `export(part_root, config_path)` にし、中を次のように変える:

```python
    core_dir = part_root / "body" / "roran"
    for folder in {core_dir, *(part_root / where for where in PART_DIR.values())}:
        folder.mkdir(parents=True, exist_ok=True)
    ...
            core_path = core_dir / f"core_{d}_{st}.txt"
    ...
                path = part_root / PART_DIR[PART_FILE[name]] / f"{PART_FILE[name]}_{d}_{key}.txt"
```

`__main__` の `export(PARTS_DIR, CONFIG)` → `export(PART_ROOT, CONFIG)`、`print("書いた", PARTS_DIR, CONFIG)` → `print("書いた", PART_ROOT, CONFIG)`。

`.venv/bin/python -c "import ast,sys; [ast.parse(open(p).read()) for p in sys.argv[1:]]" gen/ines/ines_layers.py gen/roran/roran_layers.py` で構文だけ確かめる（`--export` は走らせない）。

- [ ] **Step 6: 生成スクリプトの読み込みを直す**

`gen/enemy/mkframes.py`:

```python
RAW = {
    "male": {"base": "types/unit/base/male_{d}.txt",
             "idle2": "assets/part/body/gau/body_idle2_{d}.txt",
             "noarm": "assets/part/body/gau/body_noarm_{d}.txt"},
    "female": {"base": "types/unit/base/female_{d}.txt",
               "idle2": mp.part_path("female_body_idle2", "{d}").as_posix(),
               "noarm": mp.part_path("female_body_noarm", "{d}").as_posix()},
}
# 歩きの脚（y=28〜30 だけを使う）。男性はガウの完成コマ、女性は女性の細い脚
WALK = {"male": "assets/unit/gau/{d}_{st}.txt", "female": mp.part_path("female_{st}", "{d}").as_posix()}
```

（`female_{st}` は `female_` で始まるので `body/female` になる。`.format(d=..., st=...)` で今と同じファイル名になる）

`ENEMIES` のコメントの `cand/enemy/hair_<名前>_<dir>.txt` → `assets/part/hair/<名前>/`。`frame()` の中:

- `Path(f"cand/enemy/eye_{eye}_{d}.txt")` → `mp.part_path(f"eye_{eye}", d)`
- `Path(f"cand/enemy/hair_{hair}_{d}.txt")` → `mp.part_path(f"hair_{hair}", d)`
- `Path(f"cand/enemy/head_{head}_{d}.txt")` → `mp.part_path(f"head_{head}", d)`
- `Path(f"cand/enemy/hair_{hair}_back_{d}.txt")` → `mp.part_path(f"hair_{hair}_back", d)`
- `Path(f"assets/part/dagger/dagger_{d}.txt")` → `Path(f"assets/part/equip/dagger/dagger_{d}.txt")`

`gen/enemy/mkweapons.py` の `build_frame()`:

- `Path(f"cand/enemy/hair_{hair}_back_{d}.txt")` → `mf.mp.part_path(f"hair_{hair}_back", d)`
- `Path(f"cand/enemy/hair_{hair}{s}_{d}.txt")` → `mf.mp.part_path(f"hair_{hair}{s}", d)`

```bash
grep -rn "cand/\|/parts/\|part/dagger" gen | grep -v __pycache__   # 何も出ない
```

- [ ] **Step 7: 部品を移し、compose の設定を書き換える**

`$W/move_parts.py`:

```python
"""部品を assets/part/<種類>/<名前>/ へ git mv し、compose/*.json のパスを書き換える（作業用、2026-10-12）。
何度走らせてもよい（git ls-files で今 元の場所にあるものだけを動かす）。

    .venv/bin/python ../.superpowers/sdd/2026-10-12-asset-layout/move_parts.py
"""
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, "tools")
sys.path.insert(0, "gen/enemy")
from mkparts import part_path  # noqa: E402

UNIT_RULES = {  # ユニット → (ファイル名の前半, assets/part/ からの置き場)。長い前半を先に当てる
    "roran": [("sword_hand", "fist/roran"), ("shield_hand", "fist/roran"), ("sword", "equip/sword"),
              ("shield", "equip/shield"), ("core", "body/roran")],
    "ines": [("bow_hand", "fist/ines"), ("arrow_hand", "fist/ines"), ("bow", "equip/bow"),
             ("arrow", "equip/arrow"), ("core", "body/ines")],
    "gau": [("body", "body/gau"), ("hood", "head/hood"), ("hair", "hair/gau")],
}
SOURCES = ["assets/part/dagger", "assets/unit/roran/parts", "assets/unit/ines/parts", "assets/unit/gau/parts", "cand/enemy"]


def new_path(old: str) -> str | None:
    """元のパス → 新しいパス。部品でなければ None。部品なのに決まらなければ止める。"""
    p = Path(old)
    if p.parent.as_posix() == "assets/part/dagger":
        return f"assets/part/equip/dagger/{p.name}"
    if len(p.parts) == 5 and p.parts[:2] == ("assets", "unit") and p.parts[3] == "parts":
        for prefix, where in UNIT_RULES[p.parts[2]]:
            if p.name.startswith(prefix + "_"):
                return f"assets/part/{where}/{p.name}"
        raise SystemExit(f"置き場が決まらない: {old}")
    if p.parent.as_posix() == "cand/enemy" and p.suffix == ".txt":
        stem, d = p.stem.rsplit("_", 1)
        return part_path(stem, d).as_posix()
    return None


def rewrite(value):
    if isinstance(value, dict):
        return {k: rewrite(v) for k, v in value.items()}
    if isinstance(value, list):
        return [rewrite(v) for v in value]
    if isinstance(value, str):
        return new_path(value) or value
    return value


def main() -> None:
    files = subprocess.run(["git", "ls-files", "--", *SOURCES], capture_output=True, text=True, check=True).stdout.split()
    moved = 0
    for old in files:
        new = new_path(old)
        if new is None:
            raise SystemExit(f"部品でないファイルがある（止める）: {old}")
        if Path(new).exists():
            raise SystemExit(f"移す先に既にある: {new}")
        Path(new).parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "mv", old, new], check=True)
        moved += 1
    print("移した", moved)
    for config in sorted(Path("compose").glob("*.json")):
        text = config.read_text(encoding="utf-8")
        data = json.loads(text)
        out = json.dumps(rewrite(data), ensure_ascii=False, indent=2) + ("\n" if text.endswith("\n") else "")
        if out != text:
            config.write_text(out, encoding="utf-8")
            print("書き換えた", config)


if __name__ == "__main__":
    main()
```

走らせる前に、compose の書式が `json.dumps(indent=2)` と同じかを確かめる（同じでなければ、パス以外の行も変わってしまう）:

```bash
for f in compose/*.json; do .venv/bin/python -c "import json,sys; t=open(sys.argv[1],encoding='utf-8').read(); print(sys.argv[1], json.dumps(json.loads(t),ensure_ascii=False,indent=2)+'\n'==t)" $f; done
```

Expected: 3本とも `True`。`False` があれば止めて報告する（書き換えを文字列の置き換えに変える）。

```bash
.venv/bin/python ../.superpowers/sdd/2026-10-12-asset-layout/move_parts.py   # 移した N、書き換えた ×3
find cand assets/unit/*/parts assets/part/dagger -type f 2>/dev/null | grep -v __pycache__   # 何も出ない
rm -rf cand assets/part/dagger assets/unit/roran/parts assets/unit/ines/parts assets/unit/gau/parts   # 空のフォルダと __pycache__ だけが残っていれば消す
git diff -U0 compose | grep '^[-+] ' | grep -v '"part"\|"body"'   # 何も出ない
```

- [ ] **Step 8: 選ぶページの設定を作り直す**

```bash
.venv/bin/python gen/enemy/mkparts.py   # ok
git status --porcelain assets/part      # 何も出ない（部品の中身は変わらない）
git diff --stat gen/enemy/PICKER.json gen/enemy/PICKER_female.json   # パスの行だけが変わる
git diff -U0 gen/enemy/PICKER*.json | grep '^[-+] ' | grep -v '"part"\|"body"\|_base.txt"'   # 何も出ない
```

- [ ] **Step 9: 確かめる**

```bash
W=../.superpowers/sdd/2026-10-12-asset-layout
.venv/bin/python -m unittest discover -s tests 2>&1 | tail -1     # OK
for u in roran ines gau; do .venv/bin/python tools/compose.py compose/$u.json --check | grep -c 差あり; done   # 0 0 16
.venv/bin/python tools/hand_mirror.py compose/ines.json | tail -1
.venv/bin/python tools/enemy_build.py --all > /dev/null
(cd build/sheets && sha256sum $(ls *.png | sort)) | diff - $W/before/sheets.sha256 && echo シート同じ
git ls-files -s -- assets/part assets/unit | grep '\.txt$' | awk '{print $2}' | sort | diff - $W/before/blobs.txt && echo 中身同じ
.venv/bin/python tools/validate.py | tail -1        # 1185 grid(s) ok（405 + 672 + 108）
.venv/bin/python tools/body_check.py assets/part/body/roran | tail -1
.venv/bin/python gen/roran/roran_layers.py build/table_roran.html
```

`validate.py` の数が違ったら、`assets/part/` の下で検査されていないファイル・二重に数えたファイルが無いかを見る（`assets/` は今も既定で検査されるので、部品は前から数に入っていた。敵の部品108だけが増えるはず）。

- [ ] **Step 10: コミットしてから、生成スクリプトの出力を比べる**

```bash
git add -A pixel-asset-forge
git commit -m "refactor: 部品をすべて assets/part/<種類>/<名前>/ に置き、敵の部品の置き場を part_path で決める"
.venv/bin/python gen/enemy/mkparts.py && .venv/bin/python gen/enemy/mkframes.py && .venv/bin/python gen/enemy/mkweapons.py > /dev/null
.venv/bin/python ../.superpowers/sdd/2026-10-12-asset-layout/compare_regen.py assets/unit part   # 782/782 同じ
git stash push -m "Task 4: 生成スクリプトの出力（控えと比べた後に戻す）" -- assets gen/enemy
git status --porcelain   # 何も出ない
```

---

### Task 5: 汎用の道具を `tools/` へ移す（`anim_compare.py`・`reorder.py`）

**Files:**
- Create: `tools/anim_compare.py`（イネスの作業フォルダから写して直す）、`tools/reorder.py`、`tests/test_anim_compare.py`、`tests/test_reorder.py`

**Interfaces:**
- Produces:
  - `anim_compare.AnimError(Exception)`、`anim_compare.load_states(path: Path) -> list[tuple[str, str, int, float]]`（(状態, 日本語名, コマ数, fps) を idle・walk・attack の順に）、`anim_compare.build_page(now: Path, cand: Path, states, dirs: list[str], title: str, note: str, labels: list[str]) -> str`、`anim_compare.main(argv: list[str] | None = None) -> int`
  - `reorder.ReorderError(Exception)`、`reorder.reorder(config: dict, direction: str, order: list[str]) -> dict`（元の dict は変えない）、`reorder.main(argv: list[str] | None = None) -> int`

- [ ] **Step 1: `reorder` の失敗するテストを書く**

`tests/test_reorder.py`:

```python
"""Checks for tools/reorder.py（compose の設定の、ある向きの重なり順だけを変えた写し）."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

from reorder import ReorderError, main, reorder  # noqa: E402


def layer(name, d, z):
    return {"part": f"assets/part/x/{name}_{d}_base.txt", "z": z}


CONFIG = {"unit": "t", "frames": {
    "left_base": {"body": "core.txt", "layers": [layer("bow", "left", "back"), layer("arrow", "left", "front"),
                                                 layer("bow_hand", "left", "front", ) | {"hand": True}]},
    "down_base": {"body": "core.txt", "layers": [layer("bow", "down", "front")]},
}}


class ReorderTest(unittest.TestCase):
    def test_back_is_listed_nearest_the_core_first_and_front_far_to_near(self):
        out = reorder(CONFIG, "left", ["arrow", "bow", "CORE", "bow_hand"])
        layers = out["frames"]["left_base"]["layers"]
        self.assertEqual([(Path(l["part"]).stem, l["z"]) for l in layers],
                         [("bow_left_base", "back"), ("arrow_left_base", "back"), ("bow_hand_left_base", "front")])
        self.assertTrue(layers[2]["hand"])  # 部品のほかのキーは残す

    def test_other_directions_and_the_input_are_unchanged(self):
        before = json.dumps(CONFIG)
        out = reorder(CONFIG, "left", ["CORE", "bow", "arrow", "bow_hand"])
        self.assertEqual(out["frames"]["down_base"], CONFIG["frames"]["down_base"])
        self.assertEqual(json.dumps(CONFIG), before)

    def test_order_must_name_every_part_once_and_the_core_once(self):
        for order, word in ((["bow", "arrow", "bow_hand"], "CORE"),
                            (["bow", "CORE", "arrow"], "bow_hand"),
                            (["bow", "CORE", "arrow", "bow_hand", "shield"], "shield"),
                            (["bow", "CORE", "arrow", "bow_hand", "bow"], "bow")):
            with self.assertRaisesRegex(ReorderError, word):
                reorder(CONFIG, "left", order)

    def test_direction_without_frames_stops(self):
        with self.assertRaisesRegex(ReorderError, "up"):
            reorder(CONFIG, "up", ["CORE"])

    def test_main_writes_the_copy_and_reports_errors(self):
        with tempfile.TemporaryDirectory() as tmp:
            src, out = Path(tmp) / "c.json", Path(tmp) / "o.json"
            src.write_text(json.dumps(CONFIG), encoding="utf-8")
            self.assertEqual(main([str(src), str(out), "left", "arrow,bow,CORE,bow_hand"]), 0)
            self.assertEqual(json.loads(out.read_text(encoding="utf-8"))["frames"]["left_base"]["layers"][0]["z"], "back")
            self.assertEqual(main([str(src), str(out), "left", "bow,CORE"]), 2)
            self.assertEqual(main([str(Path(tmp) / "none.json"), str(out), "left", "CORE"]), 2)


if __name__ == "__main__":
    unittest.main()
```

```bash
.venv/bin/python -m unittest tests.test_reorder 2>&1 | tail -3   # ModuleNotFoundError
```

- [ ] **Step 2: `tools/reorder.py` を書く**

```python
#!/usr/bin/env python3
"""compose の設定の、ある向きの重なり順だけを変えた写しを作る（2026-10-12、イネスの作業で使ったものを移した）。

    tools/reorder.py compose/ines.json build/ines_left.json left bow,arrow,arrow_hand,CORE,bow_hand

順は奥→手前で、部品のファイル名の前半（bow など）と芯（CORE）で書く。CORE より前は back（芯に近いものから並べ直す）、
後ろは front。その向きのコマの部品を、過不足なく1回ずつ書く。写しを tools/compose.py --out や compose_page.py に渡して見比べる。
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path

CORE = "CORE"


class ReorderError(Exception):
    """重なり順が、設定の部品と合わない。"""


def _key(part: str, direction: str) -> str:
    return Path(part).stem.split(f"_{direction}_")[0]


def reorder(config: dict, direction: str, order: list[str]) -> dict:
    if order.count(CORE) != 1:
        raise ReorderError(f"順に芯（{CORE}）がちょうど1つ無い: {','.join(order)}")
    dup = sorted({n for n in order if order.count(n) > 1})
    if dup:
        raise ReorderError(f"順に同じ名前が2回ある: {', '.join(dup)}")
    core = order.index(CORE)
    back, front = order[:core], order[core + 1:]
    out = copy.deepcopy(config)
    names = [n for n in out.get("frames", {}) if n.startswith(direction + "_")]
    if not names:
        raise ReorderError(f"{direction} のコマが設定に無い")
    for name in names:
        frame = out["frames"][name]
        by_key = {_key(layer["part"], direction): layer for layer in frame["layers"]}
        missing = [k for k in by_key if k not in order]
        unknown = [k for k in order if k != CORE and k not in by_key]
        if missing or unknown:
            raise ReorderError(f"{name}: 順に無い部品 {', '.join(missing) or 'なし'}、部品に無い名前 {', '.join(unknown) or 'なし'}")
        frame["layers"] = [{**by_key[k], "z": "back" if k in back else "front"} for k in [*reversed(back), *front]]
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("config", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("direction")
    parser.add_argument("order", help="奥→手前、カンマ区切り（CORE を1つ含む）")
    args = parser.parse_args(argv)
    try:
        config = json.loads(args.config.read_text(encoding="utf-8"))
        out = reorder(config, args.direction, args.order.split(","))
    except (OSError, json.JSONDecodeError, ReorderError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("書いた", args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

```bash
.venv/bin/python -m unittest tests.test_reorder 2>&1 | tail -1   # OK
.venv/bin/python tools/reorder.py compose/ines.json build/ines_left.json left bow,arrow,arrow_hand,CORE,bow_hand
.venv/bin/python tools/compose.py build/ines_left.json --frames left_base --out /tmp/reorder_check > /dev/null; echo $?
```

（最後の行は動くことだけを見る。重なり順を変えたので絵は今と違ってよい）

- [ ] **Step 3: `anim_compare` の失敗するテストを書く**

`tests/test_anim_compare.py`:

```python
"""Checks for tools/anim_compare.py（今のシートと案のシートを並べて再生するページ）."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

from anim_compare import AnimError, build_page, load_states, main  # noqa: E402

GAME = {"id": "t", "sprites": {"map": {"sheet": "t.png", "frame": 32,
                                       "idle": {"frames": 2, "fps": 4}, "walk": {"frames": 4, "fps": 8},
                                       "attack": {"frames": 3, "fps": 6}}}}


class AnimCompareTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        for name in ("now.png", "cand.png"):
            Image.new("RGBA", (32 * 6, 32 * 12)).save(self.dir / name)

    def tearDown(self):
        self.tmp.cleanup()

    def game(self, data):
        path = self.dir / "game.json"
        path.write_text(json.dumps(data) if not isinstance(data, str) else data, encoding="utf-8")
        return path

    def test_states_come_from_the_game_unit(self):
        self.assertEqual(load_states(self.game(GAME)),
                         [("idle", "待機", 2, 4), ("walk", "歩き", 4, 8), ("attack", "攻撃", 3, 6)])

    def test_broken_game_unit_stops_with_a_message(self):
        no_attack = json.loads(json.dumps(GAME))
        del no_attack["sprites"]["map"]["attack"]
        zero = json.loads(json.dumps(GAME))
        zero["sprites"]["map"]["walk"]["frames"] = 0
        for data, word in ((no_attack, "attack"), (zero, "walk"), ({"id": "t"}, "sprites.map"), ("{not json", "JSON")):
            with self.assertRaisesRegex(AnimError, word):
                load_states(self.game(data))
        with self.assertRaisesRegex(AnimError, "読めない"):
            load_states(self.dir / "none.json")

    def test_page_has_a_cell_per_state_direction_and_sheet(self):
        page = build_page(self.dir / "now.png", self.dir / "cand.png", load_states(self.game(GAME)),
                          ["down", "left"], "題", "", ["今", "案"])
        self.assertEqual(page.count("<canvas"), 3 * 2 * 2)
        # シートの行は 状態の番号×4 + 向きの番号（down=0, up=1, left=2, right=3）
        self.assertIn('data-row="8" data-frames="3" data-fps="6"', page)   # 攻撃の down
        self.assertIn('data-row="6" data-frames="4" data-fps="8"', page)   # 歩きの left
        self.assertIn("<title>題</title>", page)

    def test_unknown_direction_stops(self):
        with self.assertRaisesRegex(AnimError, "north"):
            build_page(self.dir / "now.png", self.dir / "cand.png", load_states(self.game(GAME)),
                       ["north"], "題", "", ["今", "案"])

    def test_main_writes_the_page_and_reports_errors(self):
        out = self.dir / "page.html"
        args = [str(self.dir / "now.png"), str(self.dir / "cand.png"), str(out)]
        self.assertEqual(main(args + ["--anim", str(self.game(GAME))]), 0)
        self.assertTrue(out.read_text(encoding="utf-8").startswith("<title>"))
        self.assertEqual(main(args + ["--anim", str(self.dir / "none.json")]), 2)
        self.assertEqual(main([str(self.dir / "none.png"), args[1], args[2], "--anim", str(self.game(GAME))]), 2)


if __name__ == "__main__":
    unittest.main()
```

```bash
.venv/bin/python -m unittest tests.test_anim_compare 2>&1 | tail -3   # ModuleNotFoundError
```

- [ ] **Step 4: `tools/anim_compare.py` を書く**

```bash
cp ../.superpowers/sdd/2026-10-12-unit-parts-ines/anim_compare.py tools/anim_compare.py
```

次のように直す:

1. 先頭に `#!/usr/bin/env python3` を足し、docstring を次にする:

```
"""今のシートと案のシートを、状態×向きで並べて再生するページを作る（2026-10-12、イネスの作業で4回使ったものを移した）。

    tools/anim_compare.py build/sheets/ines.png build/cand_ines.png build/ines_anim.html \\
        --anim ../assets/units/ines.json --dirs down --title "イネスの下向き"

シートの並びは sheets/<ユニット>.txt と同じ（行 = 状態×4 + 向き、向きは down, up, left, right）。
コマ数と fps は、ゲームのユニット設定（--anim、assets/units/<ユニット>.json の sprites.map）から読む。
"""
```

2. import に `import json`、`import sys` を足す。`STATES = [...]` を消し、次を足す:

```python
STATE_JA = {"idle": "待機", "walk": "歩き", "attack": "攻撃"}


class AnimError(Exception):
    """ゲームのユニット設定・シート・向きの指定が合わない。"""


def load_states(path: Path) -> list[tuple[str, str, int, float]]:
    """(状態, 日本語名, コマ数, fps) を idle・walk・attack の順に。"""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise AnimError(f"{path}: 読めない: {exc}") from None
    except json.JSONDecodeError as exc:
        raise AnimError(f"{path}: JSON として読めない: {exc}") from None
    anim = data.get("sprites", {}).get("map") if isinstance(data, dict) and isinstance(data.get("sprites"), dict) else None
    if not isinstance(anim, dict):
        raise AnimError(f"{path}: sprites.map が無い（ゲームのユニット設定 assets/units/<ユニット>.json を渡す）")
    out = []
    for key, ja in STATE_JA.items():
        spec = anim.get(key)
        frames = spec.get("frames") if isinstance(spec, dict) else None
        fps = spec.get("fps") if isinstance(spec, dict) else None
        ok_frames = isinstance(frames, int) and not isinstance(frames, bool) and frames >= 1
        ok_fps = isinstance(fps, (int, float)) and not isinstance(fps, bool) and fps > 0
        if not (ok_frames and ok_fps):
            raise AnimError(f"{path}: sprites.map.{key} に frames（1以上の整数）と fps（正の数）が要る")
        out.append((key, ja, frames, fps))
    return out
```

3. `uri(path)` を、読めないときに `AnimError` にする:

```python
def uri(path: Path) -> str:
    try:
        return "data:image/png;base64," + base64.b64encode(Path(path).read_bytes()).decode()
    except OSError as exc:
        raise AnimError(f"{path}: 読めない: {exc}") from None
```

4. `main()` の本体のうちページを組む部分を `build_page` に移し、`main` を次にする:

```python
def build_page(now: Path, cand: Path, states, dirs: list[str], title: str, note: str, labels: list[str]) -> str:
    unknown = [d for d in dirs if d not in DIRS]
    if unknown:
        raise AnimError(f"向きは {', '.join(DIRS)} から選ぶ（{', '.join(unknown)} だった）")
    labels = [html.escape(s) for s in labels]
    sections = []
    for si, (_key, ja, frames, fps) in enumerate(states):
        figs = []
        for d in dirs:
            row = si * 4 + DIRS.index(d)
            pair = "".join(
                f'<div class="{k}"><canvas width="32" height="32" data-sheet="{k}" data-row="{row}" '
                f'data-frames="{frames}" data-fps="{fps}"></canvas>{label}</div>'
                for k, label in zip(("now", "cand"), labels))
            figs.append(f'<figure><div class="pair">{pair}</div><figcaption>{DIR_JA[d]}</figcaption></figure>')
        sections.append(f'<section><h2>{ja}（{frames}コマ・{fps}fps）</h2><div class="row">{"".join(figs)}</div></section>')
    return PAGE.format(title=html.escape(title), note=html.escape(note), sections="".join(sections),
                       now=uri(now), cand=uri(cand))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("now", type=Path)
    ap.add_argument("cand", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--anim", type=Path, required=True, help="ゲームのユニット設定（assets/units/<ユニット>.json）")
    ap.add_argument("--dirs", default="down,up,left,right")
    ap.add_argument("--title", default="動きの比較")
    ap.add_argument("--note", default="")
    ap.add_argument("--labels", default="今,新しい案", help="左,右 の見出し")
    a = ap.parse_args(argv)
    try:
        page = build_page(a.now, a.cand, load_states(a.anim), a.dirs.split(","), a.title, a.note, a.labels.split(","))
    except AnimError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(page, encoding="utf-8")
    print("書いた", a.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

（`--labels` が2つでないときは `zip` が短い方に合わせて黙って欠ける。今回の範囲では直さない。テストも置かない）

```bash
.venv/bin/python -m unittest tests.test_anim_compare tests.test_reorder 2>&1 | tail -1   # OK
.venv/bin/python tools/sheet.py sheets/ines.txt > /dev/null
.venv/bin/python tools/anim_compare.py build/sheets/ines.png build/sheets/ines.png build/ines_anim.html --anim ../assets/units/ines.json --dirs down
```

最後のページを1回開いて（ヘッドレスの Chromium でスクリーンショットを撮ってよい）、待機・歩き・攻撃の行が出て、絵が動くことを見る。

- [ ] **Step 5: テスト全体を通してコミット**

```bash
.venv/bin/python -m unittest discover -s tests 2>&1 | tail -1   # OK
git add pixel-asset-forge/tools/anim_compare.py pixel-asset-forge/tools/reorder.py pixel-asset-forge/tests/test_anim_compare.py pixel-asset-forge/tests/test_reorder.py
git commit -m "feat: シートを並べて再生する anim_compare.py と、重なり順を変えた写しを作る reorder.py を tools に足す"
```

---

### Task 6: 文書・設定を新しい置き場に合わせ、全体を確かめる

**Files:**
- Modify: `pixel-asset-forge/README.md`、`pixel-asset-forge/CLAUDE.md`、`pixel-asset-forge/types/unit/SPEC.md`、`pixel-asset-forge/ISSUES.md`、`pixel-asset-forge/tools/{weapon_check,unit_picker,present,hand_outline,body_check,compose,parts_export}.py`（docstring だけ）、`.coderabbit.yaml`、`HANDOVER.md`

- [ ] **Step 1: 古いパスを洗い出す**

```bash
cd .. && grep -rnE "cand/|/parts/|parts/|assets/part/dagger|enemy-src" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.superpowers --exclude-dir=docs --exclude-dir=__pycache__ --exclude-dir=build --include=*.md --include=*.yaml --include=*.py --include=*.ts --include=*.json . ; cd pixel-asset-forge
```

出たものを Step 2〜6 で直す。`tools/unit_check.py:18`（「`parts/` などの下は読まない」）と `tests/test_unit_check.py`・`tests/test_hand_mirror.py` の `parts/`（一時フォルダの中の名前）は、置き場の話ではないので直さない。

- [ ] **Step 2: `tools/` の docstring**

- `weapon_check.py`: `cand/enemy-frames/spear-soldier` → `assets/unit/spear-knight`
- `unit_picker.py`: `cand/hood_A_{dir}.txt` → `build/cand/hood_A_{dir}.txt`、`cand/dagger_A_{dir}.txt` → `build/cand/dagger_A_{dir}.txt`（案は作業中の置き場に置く例）
- `present.py`: `cand/hood_A.txt cand/hood_B.txt` → `build/cand/hood_A.txt build/cand/hood_B.txt`
- `hand_outline.py`: `assets/unit/<ユニット>/parts/ の拳` → `assets/part/fist/<ユニット>/ の拳`、`assets/unit/roran/parts/sword_hand_down_base.txt` → `assets/part/fist/roran/sword_hand_down_base.txt`
- `body_check.py`: `assets/unit/roran/parts/core_down_base.txt` → `assets/part/body/roran/core_down_base.txt`
- `compose.py`: 「ユニットだけの部品は assets/unit/<ユニット>/parts/、使い回す武器は assets/part/」→「部品は assets/part/<種類>/<名前>/（種類は equip・fist・body・head・hair・eye・cloth）」
- `parts_export.py`: Task 4 で直した（残っていないことだけ見る）

- [ ] **Step 3: `types/unit/SPEC.md`**

- 置き場の表（30〜35行目あたり）の2行を次の3行にする:

```
assets/part/<種類>/<名前>/<部品>_<dir>[_<状態>].txt  部品。種類は equip（武器・盾）・fist（拳）・body（芯・体）・head・hair・eye・cloth。
                                                     1体だけの部品は名前をユニット名にする（body/roran・fist/ines・hair/gau）。ファイル名は変えない
gen/<ユニット>/                                      1体（または敵だけ）のためのスクリプト（敵は gen/enemy）。汎用の道具は tools/
```

  表の後に1文足す: 「部品は「何の部品か」で分ける。何体が使うかでは分けない（2026-10-12 依頼者と決めた）。」
- 138行目: `assets/part/dagger/dagger_<dir>.txt` → `assets/part/equip/dagger/dagger_<dir>.txt`
- 147行目: `parts/body_idle2_<dir>.txt` → `assets/part/body/gau/body_idle2_<dir>.txt`
- 151行目: `cand/enemy-frames/axe-*`・`spear-*`、生成は `cand/gen/mkweapons.py` → `assets/unit/axe-*`・`spear-*`、生成は `gen/enemy/mkweapons.py`
- 225行目: `cand/gen/<unit>_layers.py` → `gen/<unit>/<unit>_layers.py`（同じ行の `cand/gen/ines_layers.py` も `gen/ines/ines_layers.py`）
- 262〜304行目: `cand/enemy-frames/` → `assets/unit/`（`weapon_check.py` の例のパスすべて）
- 直した例のコマンドを1つ走らせて、パスが合っていることを確かめる:

```bash
C="--blade stone_hi,stone_base --weapon wood_base,wood_shadow --hand skin_rose_hi,skin_rose_base,skin_rose_shadow --arm cloak_dark_hi,cloak_dark_base,cloak_dark_shadow"
.venv/bin/python tools/weapon_check.py assets/unit/axe-bandit $C --ref assets/unit/axe-bandit/noweapon --far left --far-shade skin_rose_shadow \
    --hidden up_atk_wind,up_atk_hit --depth down,up \
    --partial left_base,left_idle2,left_walk_a,left_walk_b,left_atk_wind; echo exit=$?
B=../.superpowers/sdd/2026-10-12-asset-layout/wc_before && mkdir -p $B
(cd .. && git archive 86adaf4 pixel-asset-forge/cand/enemy-frames/axe-bandit | tar -x -C pixel-asset-forge/$B)
A=$B/pixel-asset-forge/cand/enemy-frames/axe-bandit
.venv/bin/python tools/weapon_check.py $A $C --ref $A/noweapon --far left --far-shade skin_rose_shadow \
    --hidden up_atk_wind,up_atk_hit --depth down,up \
    --partial left_base,left_idle2,left_walk_a,left_walk_b,left_atk_wind; echo exit=$?
```

  2回の出力（終了コードと指摘の行）が、置き場のパス以外で同じことを見る。違えば止めて報告する。
  整理前から通らない（SPEC の「2026-10-07 の時点で4体とも通る」と違う）なら、ISSUES.md に1行足す

- [ ] **Step 4: `README.md` と `CLAUDE.md`**

README:
- 275行目: `部品は assets/unit/ines/parts/` → `部品は assets/part/body/ines/・equip/bow/・equip/arrow/・fist/ines/`
- 284行目: `cand/gen/<ユニット>_layers.py` → `gen/<ユニット>/<ユニット>_layers.py`、`cand/gen/ines_layers.py` → `gen/ines/ines_layers.py`
- 347行目: `--colours dagger` の説明はそのまま
- 352〜358行目を次にする:

```
- `frames` は元のコマの置き場（リポジトリからの相対パス）。今の16体（男性8・女性8）は `assets/unit/<id>`
  （部品で組んだコマ）を指す。`axe` `spear` では必須。
  書かなければ `dagger` の `male` は `assets/unit/gau/`、`female` は `assets/unit/dagger-female/`
  （`--colours` が比べるのもこの2つ。短剣の女性の元のコマはまだ無いので、今は置き場が無いと言って止まる）
- 部品で組んだコマの生成（cwd は forge の直下）: `gen/enemy/mkparts.py`（頭・目・服・長い髪の部品を `assets/part/` に、選ぶページの設定を `gen/enemy/PICKER*.json` に）→
  `gen/enemy/mkweapons.py`（斧・槍の男女の敵。敵の一覧は `gen/enemy/mkframes.py` の `ENEMIES`、女性の8体は
  `mkweapons.py` で足す）。女性の id は `<男性の id>-<髪 a・b・c>-f`（a 前髪ありのロング・b 前髪なしのロング・c ポニーテール）。
  今走らせると、コマはコミット済みのものと違う（`ISSUES.md`「敵の生成スクリプトの出力が、コミット済みのコマと違う」）
```

- `tools/` の一覧（README の道具の章）に `anim_compare.py` と `reorder.py` を、`sheet_gif.py` の近くに1行ずつ足す:

```sh
.venv/bin/python tools/anim_compare.py NOW.png CAND.png OUT.html --anim ../assets/units/ines.json --dirs down   # 今と案のシートを並べて再生する確認ページ
.venv/bin/python tools/reorder.py compose/ines.json OUT.json left bow,arrow,arrow_hand,CORE,bow_hand          # ある向きの重なり順だけを変えた設定の写し
```

CLAUDE.md:
- 61行目: `tools/body_check.py assets/unit/roran/parts` → `tools/body_check.py assets/part/body/roran`
- 63行目: `assets/unit/roran/parts/sword_hand_down_base.txt` → `assets/part/fist/roran/sword_hand_down_base.txt`
- 66行目: `cand/gen/ines_layers.py` → `gen/ines/ines_layers.py`。同じ行の後ろに「`gen/roran/roran_layers.py --export` も同じ理由で実行しない」を足す
- 69行目: `tools/unit_picker.py PICKER.json` → `tools/unit_picker.py gen/enemy/PICKER.json`
- コマンドの一覧に README と同じ `anim_compare.py`・`reorder.py` の2行を足す
- CLAUDE.md に置き場の説明（「ディレクトリ」などの章）があれば、`assets/part/<種類>/<名前>/` と `gen/<ユニット>/` を足す。無ければ足さない（SPEC にある）

- [ ] **Step 5: `ISSUES.md`**

消す行:
- 「`cand/gen/build_sheets.py` が色替え済みのシートを上書きする」（32行目）
- 「`weapon_check.py` の docstring の例が無いディレクトリを指す」（48行目）
- 「レシピが読む元のコマが `validate.py` の既定の範囲に無い」（49行目。敵のコマが `assets/` に入り、既定で検査される）
- 「`cand/` の中身と名前が合わず…」（57行目）
- 「イネスの部品を描き直したスクリプトが作業フォルダにだけある」（70行目）
- 「`mklayers --check` が試作の書き出し済みコマで FAIL 23件」（83行目）

書き換える行:
- 30行目（`weapon_check.py --far-shade`）: `層の試作（cand/gen/mklayers.py）は left の握る手を影の色にしたが、cand/enemy-frames/ の男女の斧・槍の振りかぶりは今も明るい` → `層の試作（2026-10-09。2026-10-12 に消した）は left の握る手を影の色にしたが、assets/unit/ の男女の斧・槍の振りかぶりは今も明るい`
- 58行目（短剣の敵4体）: `cand/gen/mkframes.py` → `gen/enemy/mkframes.py`、`cand/enemy-frames/dagger-*/` → `assets/unit/dagger-*/`
- 67行目（ガウの部品）: `assets/unit/gau/parts/` の頭巾・髪と耳 → `assets/part/head/hood/`・`assets/part/hair/gau/` の頭巾・髪と耳
- 82行目（ガウ・敵を 体 + 拳）: 「その前に `cand/` の整理を行う（下の行）」を消す
- `.coderabbit.yaml` に触れている行があれば、`cand/` の除外を消したことに合わせる

足す行（「ツールの不具合」の表）:

```
| **敵の生成スクリプトの出力が、コミット済みのコマと違う** | `gen/enemy/` の `mkparts`→`mkframes`→`mkweapons` を走らせると、部品は今のファイルと同じになるが、敵のコマは419ファイルが画素で変わる（2026-10-12 に確かめた。例 `axe-horn/left_atk_hit` の y=28〜31 の輪郭）。コマは 2026-10-08 にコミットしたままで、その後 2026-10-10 に `hand_outline.py` の手の輪郭の閉じ方（KEEP）を変えたためとみられる（原因は未確認）。D（敵の組み直し）でコマを作り直すので、それまでは走らせない。走らせるなら、出たコマを依頼者に見せて採否を決める | 小 | 2026-10-12 |
```

（例のコマと行は、Task 0 の控えとコミット済みを `diff` して、実際に違う所を書く）

- [ ] **Step 6: `.coderabbit.yaml` と `HANDOVER.md`（character-tactics の直下）**

`.coderabbit.yaml`: 次の4行を消す:

```yaml
    # cand/ は絵のテキストと試作。生成スクリプトの cand/gen だけレビューする
    - "!pixel-asset-forge/cand/enemy-frames/**"
    - "!pixel-asset-forge/cand/enemy/**"
    - "!pixel-asset-forge/cand/layer-trial/**"
```

（敵のコマと部品は `assets/**` の除外に入る。`gen/` はレビューされる）

`HANDOVER.md` 37行目: `pixel-asset-forge/assets/unit/gau/`（24コマと部品）、`assets/part/dagger/` → `pixel-asset-forge/assets/unit/gau/`（24コマ）、部品は `assets/part/body/gau/`・`head/hood/`・`hair/gau/`・`equip/dagger/`。
HANDOVER.md に、ロラン・イネスの部品の置き場や `cand/` を書いた所がほかにあれば同じように直す（Step 1 の grep で出る）。

- [ ] **Step 7: 全体を確かめる（spec の「確かめ方」1〜9）**

```bash
W=../.superpowers/sdd/2026-10-12-asset-layout
.venv/bin/python tools/enemy_build.py --all > /dev/null
(cd build/sheets && sha256sum $(ls *.png | sort)) | diff - $W/before/sheets.sha256 && echo "1 シート同じ"
for u in roran ines gau; do .venv/bin/python tools/compose.py compose/$u.json --check | grep -c 差あり; done   # 2: 0 0 16
git ls-files -s -- assets/part assets/unit | grep '\.txt$' | awk '{print $2}' | sort | diff - $W/before/blobs.txt && echo "3 中身同じ"
# 4 は Task 4 Step 10 で確かめた（782/782）
.venv/bin/python tools/validate.py | tail -1                                   # 5: 1185 grid(s) ok
.venv/bin/python -m unittest discover -s tests 2>&1 | tail -1                  # 6: OK
.venv/bin/python gen/roran/roran_layers.py build/table_roran.html             # 7
(cd .. && npm test 2>&1 | tail -3 && npm run build 2>&1 | tail -2)            # 8
cd .. && grep -rnE "cand/|assets/unit/[a-z-]+/parts|assets/part/dagger|enemy-src" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.superpowers --exclude-dir=docs --exclude-dir=__pycache__ --exclude-dir=build . ; cd pixel-asset-forge   # 9: build/cand の例だけ
git status --porcelain   # 文書の変更だけ
```

`git status` に `build/` 以外の生成物が出たら、走らせたスクリプトが何かを書いたということなので、中身を見てから `git stash` で退避する。

- [ ] **Step 8: コミット**

```bash
git add -A pixel-asset-forge ../.coderabbit.yaml ../HANDOVER.md
git commit -m "docs: 置き場の整理（assets/part/<種類>/<名前>/・gen/<ユニット>/）に README・SPEC・ISSUES.md などを合わせる"
```

- [ ] **Step 9: 最終レビュー**

ブランチ全体（`git diff 86adaf4..HEAD`）を、新しいレビュアーに見てもらう。見てほしい点: パスの書き換え漏れ、`part_path` と `parts_export` の入力の検査、絵が変わっていないことの確かめ方に穴が無いか、ISSUES.md の消した行・足した行が正しいか。指摘を受けて直したら、Step 7 をもう一度通す。

- [ ] **Step 10: 台帳を写してコミット**

character-tactics の CLAUDE.md の決まり（計画を終えたら台帳を `docs/superpowers/ledgers/` に写す）に従う。

```bash
cd .. && cp .superpowers/sdd/2026-10-12-asset-layout/progress.md docs/superpowers/ledgers/2026-10-12-asset-layout.md
git add docs/superpowers/ledgers/2026-10-12-asset-layout.md
git commit -m "docs: 置き場の整理の台帳を写す"
```

push と PR は依頼者の指示を待つ。
