# 敵ユニットのバリエーション自動生成 実装計画（段階1：短剣）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ガウ（短剣）の完成したコマを色替えし、男女の素体で、新しい敵のシートを機械的に作る。段階1では短剣の敵を男女で作って依頼者に見せる。

**Architecture:** 敵1種類ごとに「レシピ」（`pixel-asset-forge/enemy/<id>.json`）を1ファイル書く。新しい道具 `tools/enemy_build.py` が、原型と素体から**完成済みのコマの置き場**を選び、`# map:` の色名だけを置き換え（画素は変えない）、`build/enemy/<id>/` にコマを書いて、既存の `sheet.py` の関数でシートの PNG にする。男性の元は `assets/unit/gau/`（読むだけ）、女性の元は新しく描く `assets/unit/enemy-src/dagger-female/`。既存の道具の中身は変えない。

**Tech Stack:** Python 3.14（`.venv/bin/python`）、Pillow、標準の `unittest`。ゲーム側の確認は `npm test`（Vitest）。

**Spec:** `docs/superpowers/specs/2026-10-06-enemy-variants-design.md`

**対象範囲:** この計画は**段階1（短剣）だけ**を詳しく書く。段階2（剣盾）と段階3（弓）は、段階1の確認で見えたことを踏まえて、段階ごとに別の計画ファイルを書く（末尾の「段階2・3」）。これは設計の「各段階の終わりで止まる」に沿った分け方。

## 仕様との違い（調べて分かったこと。2026-10-06）

仕様は「素体と部品を `compose.py` で重ねて作る」前提で書いたが、ガウの完成コマを調べると前提が合わなかった。この計画は次のように直している。

1. **ガウの完成コマは compose の出力と違う。** `compose.py compose/gau.json --check` は16コマすべてで「差あり」になる（目・服の色・襟・ズボン・攻撃の腕を手で描き足してあるため）。そこで男性の敵は**完成コマを元にして色替えだけ**する（compose 設定は組まない）。
2. **女性は、素体＋部品の組み立てでは完成品にならない。** 目・襟・ズボン・動きのコマは手で描いた分が品質を決める。そこで女性は、ガウと同じ手順（compose で下書き → 手で仕上げ）で**女性の短剣の完成コマ一式（24コマ）**を1回描く。以後は男性と同じく色替えだけで増やす。仕様の「描いた素体コマは武器の型をまたいで使い回す」は成り立たず、型ごとに女性の完成コマ一式が要る（段階2・3の作業量に効く）。
3. **`recolor` の鍵は役割名でなく、元のコマが使うパレット名**（`cloak_dark_base` など）。完成コマは `# map:` にパレット名を直接持っているので、役割の層を足さない。
4. **`head`（かぶり物の差し替え）は段階1のレシピに入れない。** ガウの頭の部分は、歩きを除くコマで行 y=10〜12 より上が全コマ共通だが（調査済み）、頭巾は y=20 付近まである外套の縁とつながっていて、頭の帯だけを差し替えると縁が残る恐れがある。段階1の確認で、色替え・男女の見た目を見せたうえで、かぶり物の差し替えを続けるか依頼者に決めてもらう。頭巾と髪は色を別々に替えられるので（`roof_*` が髪、`cloak_*` が頭巾と外套）、色だけでも見た目は変わる。
5. **シートは `sheet.py` の関数を import して作る**（`sheet.py` を子プロセスで呼ばない）。`sheet.py` の出力名が定義ファイル名で決まるため、敵ごとに定義ファイルを複製しないで済ませる。
6. **テストは `unittest`**（このリポジトリの規約。`pytest` ではない）。
7. **顔の絵は既存の `narazumono-face.png` を流用する**（仕様の未決を決めた）。敵を置き換える作業のときに描き直す。

## Global Constraints

- 同じレシピからは**常に同じ PNG**ができる。乱数・時刻を使わない
- 既存の道具（`compose.py` `sheet.py` `export.py` ほか）の中身は変えない。`enemy_build.py` から import して呼ぶだけ
- 既存の敵5種（弓兵・盾持ち・ならず者・まじない師・ガルム）と味方3体の絵・JSON には触らない
- 色は `palette/master.json` の既存色だけ（足すときは描く前に `tools/probe_colors.py` で測る）
- シート定義は `sheets/`、レシピは `enemy/`、compose 設定は `compose/` に置く。**`assets/` の下に置くのは絵のグリッドだけ**（定義を置くと `validate.py` と `render.py` が `rglob` で読んで落ちる）
- シートは12行（3状態 × 4方向）、コマは32px の正方形、足元は y=30（`sheet.py` のレポートで確かめる）。コマ数は idle 2 / walk 4 / attack 3
- `tests/` から `assets/` の現役の絵を読まない（描き直すとテストが落ちる）。テストの絵は `tempfile` に書いた小さなグリッドを使う
- コミットは Conventional Commits ＋ 日本語の要約。**push と PR は依頼者の指示があったときだけ**
- 絵のグリッド（`assets/**/*.txt`）を変えたら、見せる前に `tools/validate.py` を通す
- `tools/export.py` は実行のたびに `build/` を空にする。敵の PNG は `export.py` の後に `enemy_build.py` で作り直す（この計画のゲーム書き出しは `enemy_build.py --export-game` を使い、`export.py` は使わない）
- 作業ディレクトリは `pixel-asset-forge/`（コマンドはここからの相対）。`git add` もここからの相対パスでよい

## Review Focus

レシピの検査やシートの組み立てで、仕様が黙っているが利用者が踏みやすい入力。それぞれ、持ち主のタスクにテストを足してある。

1. **色の入れ替え（A→B と B→A を同時に書く）。** 順に置き換えると元に戻って何も変わらない。同時に置き換わること（T1）
2. **`recolor` の鍵の綴り間違い。** 元のコマで使われていない色名は、黙って無視せず、色名を挙げて止める（T3）
3. **レシピの `id` とファイル名が違う／`../x` のような名前。** 出力先が意図しない場所へ出る。`id` は小文字・数字・ハイフンだけで、ファイル名と同じに限る（T2）
4. **レシピを直して作り直したとき、古いコマが `build/enemy/<id>/` に残る。** 出力先を作り直す前に空にする（T3）
5. **色替えで別々の色が1色にまとまる**（例: 髪の影とズボンが同じ色になる）。止めはしないが、色の数が減ったと警告する（T3）。複数ファイルで `id` が重なる場合は、作る前に止める（T3）

---

## ファイル構成

| ファイル | 作る/変える | 役割 |
|---|---|---|
| `tools/enemy_build.py` | 作る | レシピの読み込み、色替え、グリッドの書き出し、シートの組み立て、ゲーム書き出し。CLI |
| `tools/enemy_gallery.py` | 作る | 全レシピのシートを1つの HTML に並べて、状態×4方向の動きを再生する確認ページ |
| `tests/test_enemy_build.py` | 作る | `enemy_build.py` のテスト |
| `tests/test_enemy_gallery.py` | 作る | `enemy_gallery.py` のテスト |
| `enemy/<id>.json` | 作る | 敵ごとのレシピ。段階1で6本 |
| `compose/enemy_dagger_female.json` | 作る | 女性の短剣の下書き（正面の4コマ）の compose 設定 |
| `assets/unit/enemy-src/dagger-female/*.txt` | 作る | 女性の短剣の完成コマ一式（24コマ）。手で仕上げた絵（これが正） |
| `CLAUDE.md` `README.md`（forge） | 変える | コマンド一覧と使い方に `enemy_build.py` を足す |

`assets/unit/enemy-src/` は、`sheet.py` が `assets/unit/<定義名>/` を読む規約の外に置く（敵の元コマは `enemy_build.py` だけが読む）。`validate.py` は `assets/` を `rglob` で読むので、描いたコマは自動で検査される。

---

### Task 1: コマの色替えと書き出し

**Files:**
- Create: `tools/enemy_build.py`
- Create: `tests/test_enemy_build.py`

**Interfaces:**
- Produces（後のタスクが使う）:
  - `Frame = list[list[str | None]]` — 行ごと・列ごとのパレット名。透明は `None`
  - `class EnemyError(Exception)`
  - `read_frame(path: Path) -> Frame`
  - `recolor_frame(frame: Frame, mapping: dict[str, str]) -> Frame` — 元を変えず、同時に置き換える
  - `serialize_frame(frame: Frame, note: str) -> str` — グリッドファイルの文字列。`outline` は文字 `o`、ほかは最初に出た順に `a` から（`o` を飛ばす）。`note` に半角コロンがあれば `EnemyError`

- [ ] **Step 1: 失敗するテストを書く**

`tests/test_enemy_build.py` を作る。

```python
"""Checks for tools/enemy_build.py (味方の完成コマの色替えで敵のシートを作る)."""
from __future__ import annotations

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

import enemy_build  # noqa: E402
from enemy_build import EnemyError, read_frame, recolor_frame, serialize_frame  # noqa: E402
from gridfile import load_palette  # noqa: E402

PALETTE = load_palette()


def blank() -> list[list[str | None]]:
    return [[None] * 32 for _ in range(32)]


class RecolorTest(unittest.TestCase):
    def test_swap_is_simultaneous(self):
        frame = [["cloth_base", "skin_base", None]]
        swapped = recolor_frame(frame, {"cloth_base": "skin_base", "skin_base": "cloth_base"})
        self.assertEqual(swapped, [["skin_base", "cloth_base", None]])

    def test_unmapped_colours_and_transparent_stay(self):
        frame = [["outline", "cloth_base", None]]
        self.assertEqual(recolor_frame(frame, {"cloth_base": "orchid_base"}), [["outline", "orchid_base", None]])

    def test_input_is_not_modified(self):
        frame = [["cloth_base"]]
        recolor_frame(frame, {"cloth_base": "orchid_base"})
        self.assertEqual(frame, [["cloth_base"]])


class SerializeTest(unittest.TestCase):
    def test_round_trip_keeps_every_pixel(self):
        frame = blank()
        frame[30][10] = "outline"
        frame[30][11] = "cloth_base"
        frame[29][11] = "skin_base"
        frame[29][12] = "cloth_base"
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "f.txt"
            path.write_text(serialize_frame(frame, "テストのコマ"), encoding="utf-8")
            self.assertEqual(read_frame(path), frame)

    def test_outline_uses_the_letter_o(self):
        frame = blank()
        frame[0][0] = "cloth_base"
        frame[0][1] = "outline"
        self.assertIn("o=outline", serialize_frame(frame, "x"))

    def test_same_frame_gives_same_text(self):
        frame = blank()
        frame[5][5] = "skin_base"
        frame[5][6] = "cloth_base"
        self.assertEqual(serialize_frame(frame, "x"), serialize_frame(frame, "x"))

    def test_colon_in_note_is_refused(self):
        with self.assertRaises(EnemyError):
            serialize_frame(blank(), "a: b")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 失敗を確かめる**

Run: `.venv/bin/python -m unittest discover -s tests -p "test_enemy_build.py" -v`
Expected: `ModuleNotFoundError: No module named 'enemy_build'`

- [ ] **Step 3: 最小の実装を書く**

`tools/enemy_build.py` を作る（この時点では、CLI と build は書かない）。

```python
#!/usr/bin/env python3
"""味方の完成したコマを色替えして、敵のシートを作る。

    tools/enemy_build.py enemy/dagger-red-m.json
    tools/enemy_build.py --all

レシピ（enemy/<id>.json）の形と、設計の経緯は
docs/superpowers/specs/2026-10-06-enemy-variants-design.md と
docs/superpowers/plans/2026-10-06-enemy-variants.md を参照。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import BACKGROUND, GridError, parse  # noqa: E402

Frame = list[list["str | None"]]

# 'o' は輪郭に使うので割り当てから外す
LETTERS = "abcdefghijklmnpqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
MAP_ENTRIES_PER_LINE = 4


class EnemyError(Exception):
    """レシピや元のコマが、組み立ての前提に合わない。"""


def read_frame(path: Path) -> Frame:
    grid = parse(path)
    frame: Frame = []
    for row in grid.rows:
        cells: list[str | None] = []
        for ch in row:
            if ch == BACKGROUND:
                cells.append(None)
            elif ch in grid.charmap:
                cells.append(grid.charmap[ch])
            else:
                raise EnemyError(f"{path.name}: 文字 {ch!r} に色が割り当てられていない")
        frame.append(cells)
    return frame


def recolor_frame(frame: Frame, mapping: dict[str, str]) -> Frame:
    """色名を同時に置き換える（A→B と B→A を同時に書いても入れ替わるだけ）。"""
    return [[mapping.get(c, c) if c is not None else None for c in row] for row in frame]


def serialize_frame(frame: Frame, note: str) -> str:
    if ":" in note:
        raise EnemyError(f"注記に半角コロンは書けない（ヘッダと読まれる）: {note!r}")
    names: list[str] = []
    for row in frame:
        for c in row:
            if c is not None and c not in names:
                names.append(c)
    letters = iter(LETTERS)
    chars = {name: "o" if name == "outline" else next(letters) for name in names}
    entries = [f"{chars[name]}={name}" for name in names]
    lines = [
        f"# {note}",
        "# type: unit",
        f"# size: {len(frame[0])}x{len(frame)}",
        "# light: upper-left",
        "# bg: transparent",
    ]
    for i in range(0, len(entries), MAP_ENTRIES_PER_LINE):
        lines.append("# map: " + " ".join(entries[i : i + MAP_ENTRIES_PER_LINE]))
    lines += ["".join(chars[c] if c is not None else BACKGROUND for c in row) for row in frame]
    return "\n".join(lines) + "\n"
```

`Frame` の型は実行時に評価されるので、`"str | None"` を文字列で書いている（`from __future__ import annotations` は型エイリアスの代入には効かない）。

- [ ] **Step 4: 通ることを確かめる**

Run: `.venv/bin/python -m unittest discover -s tests -p "test_enemy_build.py" -v`
Expected: 7 tests, すべて OK

- [ ] **Step 5: コミット**

```bash
git add tools/enemy_build.py tests/test_enemy_build.py
git commit -m "feat: 敵のコマを色名の置き換えで色替えする部品を追加"
```

---

### Task 2: レシピの読み込みと検査

**Files:**
- Modify: `tools/enemy_build.py`
- Modify: `tests/test_enemy_build.py`

**Interfaces:**
- Consumes: `EnemyError`（T1）
- Produces:
  - 定数 `ARCHETYPES = {"dagger": "sheets/gau.txt"}`（原型 → シート定義）、`BODIES = ("male", "female")`、`SOURCES = {("dagger","male"): "assets/unit/gau", ("dagger","female"): "assets/unit/enemy-src/dagger-female"}`、`ENEMY_DIR = REPO_ROOT / "enemy"`
  - `@dataclass(frozen=True) class Recipe: id: str; name: str; archetype: str; body: str; recolor: dict[str, str]; path: Path | None = None`
  - `load_recipe(path: Path, palette: dict) -> Recipe`
  - `source_paths(recipe: Recipe, root: Path = REPO_ROOT) -> tuple[Path, Path]` — `(元のコマの置き場, シート定義)`

- [ ] **Step 1: 失敗するテストを書く**

`tests/test_enemy_build.py` に足す（`import` 行に `load_recipe, source_paths, Recipe` を足す）。

```python
class RecipeTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def write(self, data, name="dagger-test-m.json") -> Path:
        path = self.dir / name
        path.write_text(data if isinstance(data, str) else json.dumps(data), encoding="utf-8")
        return path

    def good(self, **change):
        data = {"id": "dagger-test-m", "name": "テスト", "archetype": "dagger", "body": "male",
                "recolor": {"cloth_base": "orchid_base"}}
        data.update(change)
        return data

    def test_valid_recipe_is_read(self):
        recipe = load_recipe(self.write(self.good()), PALETTE)
        self.assertEqual((recipe.id, recipe.archetype, recipe.body), ("dagger-test-m", "dagger", "male"))
        self.assertEqual(recipe.recolor, {"cloth_base": "orchid_base"})

    def test_recolor_is_optional(self):
        data = self.good()
        del data["recolor"]
        self.assertEqual(load_recipe(self.write(data), PALETTE).recolor, {})

    def test_unknown_key_is_refused_with_the_allowed_ones(self):
        with self.assertRaisesRegex(EnemyError, "知らないキー head"):
            load_recipe(self.write(self.good(head="cap")), PALETTE)

    def test_missing_required_key(self):
        data = self.good()
        del data["name"]
        with self.assertRaisesRegex(EnemyError, "name"):
            load_recipe(self.write(data), PALETTE)

    def test_id_must_match_the_file_name(self):
        with self.assertRaisesRegex(EnemyError, "ファイル名"):
            load_recipe(self.write(self.good(id="dagger-other-m")), PALETTE)

    def test_id_with_path_characters_is_refused(self):
        path = self.write(self.good(id="../x"), name="x.json")
        with self.assertRaisesRegex(EnemyError, "id は"):
            load_recipe(path, PALETTE)

    def test_uppercase_id_is_refused(self):
        path = self.write(self.good(id="Dagger"), name="Dagger.json")
        with self.assertRaisesRegex(EnemyError, "id は"):
            load_recipe(path, PALETTE)

    def test_unknown_archetype_and_body(self):
        with self.assertRaisesRegex(EnemyError, "archetype"):
            load_recipe(self.write(self.good(archetype="staff")), PALETTE)
        with self.assertRaisesRegex(EnemyError, "body"):
            load_recipe(self.write(self.good(body="other")), PALETTE)

    def test_colour_not_in_palette(self):
        with self.assertRaisesRegex(EnemyError, "パレットに無い.*no_such_colour"):
            load_recipe(self.write(self.good(recolor={"cloth_base": "no_such_colour"})), PALETTE)
        with self.assertRaisesRegex(EnemyError, "パレットに無い.*typo_colour"):
            load_recipe(self.write(self.good(recolor={"typo_colour": "orchid_base"})), PALETTE)

    def test_not_json(self):
        with self.assertRaisesRegex(EnemyError, "JSON として読めない"):
            load_recipe(self.write("{not json"), PALETTE)

    def test_source_paths_follow_archetype_and_body(self):
        recipe = Recipe("a", "A", "dagger", "female", {})
        source, sheet_def = source_paths(recipe, Path("/forge"))
        self.assertEqual(source, Path("/forge/assets/unit/enemy-src/dagger-female"))
        self.assertEqual(sheet_def, Path("/forge/sheets/gau.txt"))
```

- [ ] **Step 2: 失敗を確かめる**

Run: `.venv/bin/python -m unittest discover -s tests -p "test_enemy_build.py" -v`
Expected: `ImportError: cannot import name 'load_recipe'`

- [ ] **Step 3: 実装を書く**

`tools/enemy_build.py` の `import` を次のように直し、末尾に足す。

```python
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import BACKGROUND, REPO_ROOT, GridError, parse  # noqa: E402
```

```python
ENEMY_DIR = REPO_ROOT / "enemy"
ARCHETYPES = {"dagger": "sheets/gau.txt"}
BODIES = ("male", "female")
SOURCES = {
    ("dagger", "male"): "assets/unit/gau",
    ("dagger", "female"): "assets/unit/enemy-src/dagger-female",
}
RECIPE_KEYS = {"id", "name", "archetype", "body", "recolor"}
ID_RE = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")


@dataclass(frozen=True)
class Recipe:
    id: str
    name: str
    archetype: str
    body: str
    recolor: dict[str, str]
    path: Path | None = None


def load_recipe(path: Path, palette: dict) -> Recipe:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise EnemyError(f"{path}: 読めない: {exc}") from None
    except json.JSONDecodeError as exc:
        raise EnemyError(f"{path}: JSON として読めない: {exc}") from None
    where = path.name
    if not isinstance(data, dict):
        raise EnemyError(f"{where}: オブジェクトでない")
    unknown = sorted(set(data) - RECIPE_KEYS)
    if unknown:
        raise EnemyError(f"{where}: 知らないキー {', '.join(unknown)}（使えるのは {', '.join(sorted(RECIPE_KEYS))}）")
    for key in ("id", "name", "archetype", "body"):
        if not isinstance(data.get(key), str) or not data[key]:
            raise EnemyError(f"{where}: {key} が無いか、文字列でない")
    if not ID_RE.fullmatch(data["id"]):
        raise EnemyError(f"{where}: id は小文字・数字・ハイフンだけ（{data['id']!r} だった）")
    if data["id"] != path.stem:
        raise EnemyError(f"{where}: id {data['id']!r} がファイル名 {path.stem!r} と違う（ファイル名は <id>.json）")
    if data["archetype"] not in ARCHETYPES:
        raise EnemyError(f"{where}: archetype は {', '.join(ARCHETYPES)} のどれか（{data['archetype']!r} だった）")
    if data["body"] not in BODIES:
        raise EnemyError(f"{where}: body は {', '.join(BODIES)} のどちらか（{data['body']!r} だった）")
    recolor = data.get("recolor", {})
    if not isinstance(recolor, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in recolor.items()):
        raise EnemyError(f"{where}: recolor は 色名 → 色名 のオブジェクトにする")
    bad = sorted({name for pair in recolor.items() for name in pair if name not in palette})
    if bad:
        raise EnemyError(f"{where}: recolor にパレットに無い色名 {', '.join(bad)}")
    return Recipe(data["id"], data["name"], data["archetype"], data["body"], dict(recolor), path)


def source_paths(recipe: Recipe, root: Path = REPO_ROOT) -> tuple[Path, Path]:
    """(元のコマの置き場, シート定義)。"""
    return root / SOURCES[(recipe.archetype, recipe.body)], root / ARCHETYPES[recipe.archetype]
```

- [ ] **Step 4: 通ることを確かめる**

Run: `.venv/bin/python -m unittest discover -s tests -p "test_enemy_build.py" -v`
Expected: 全テスト OK（T1 の7 + 12）

- [ ] **Step 5: コミット**

```bash
git add tools/enemy_build.py tests/test_enemy_build.py
git commit -m "feat: 敵のレシピの読み込みと検査を追加"
```

---

### Task 3: シートの組み立てと CLI

**Files:**
- Modify: `tools/enemy_build.py`
- Modify: `tests/test_enemy_build.py`
- Modify: `CLAUDE.md`（forge）、`README.md`（forge）

**Interfaces:**
- Consumes: `read_frame` `recolor_frame` `serialize_frame` `load_recipe` `source_paths` `Recipe` `EnemyError`（T1・T2）、`sheet.read_sheet` `sheet.read_frames_declaration` `sheet.check_columns` `sheet.load_frames` `sheet.compose_sheet` `sheet.preview` `sheet.frame_size`
- Produces:
  - `build(recipe, source_dir: Path, sheet_def: Path, palette, build_root: Path = BUILD_ROOT, sheet_dir: Path = SHEET_DIR) -> Path` — `build/sheets/<id>.png`（と `<id>_preview.png`）を作り、PNG のパスを返す。`build_root/<id>/` を空にしてから書く
  - `source_colours(source_dir: Path, sheet_def: Path) -> set[str]`
  - `main(argv) -> int` — `enemy_build.py RECIPE... | --all | --colours ARCHETYPE`。エラーは終了コード 2
  - 定数 `BUILD_ROOT = REPO_ROOT / "build" / "enemy"`、`SHEET_DIR = REPO_ROOT / "build" / "sheets"`

- [ ] **Step 1: 失敗するテストを書く**

`tests/test_enemy_build.py` の `import` 行に `build, main, source_colours` を足し、次を足す。

```python
STATES = ("base", "walk", "atk")
DIRS = ("down", "up", "left", "right")
NAMES = [f"{d}_{s}" for s in STATES for d in DIRS]
SHEET_DEF = "\n".join(["# frames: idle=1 walk=1 attack=1"] + NAMES) + "\n"
FRAME_TEXT = (
    "# type: unit\n# size: 32x32\n# light: upper-left\n# bg: transparent\n"
    "# map: o=outline b=cloth_base c=skin_base\n"
    + "\n".join(
        "".join({(10, 30): "b", (11, 30): "c", (10, 29): "o"}.get((x, y), ".") for x in range(32))
        for y in range(32)
    )
    + "\n"
)


class Fixture:
    """12コマ・1列の小さな元のコマと、そのシート定義。"""

    def __init__(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.src = self.root / "src"
        self.src.mkdir()
        for name in NAMES:
            (self.src / f"{name}.txt").write_text(FRAME_TEXT, encoding="utf-8")
        self.sheet_def = self.root / "def.txt"
        self.sheet_def.write_text(SHEET_DEF, encoding="utf-8")
        self.build_root = self.root / "build"
        self.sheet_dir = self.root / "sheets"

    def recipe(self, **change) -> enemy_build.Recipe:
        data = {"id": "t-a", "name": "テスト", "archetype": "dagger", "body": "male", "recolor": {}}
        data.update(change)
        return enemy_build.Recipe(**data)

    def build(self, recipe) -> Path:
        return build(recipe, self.src, self.sheet_def, PALETTE, self.build_root, self.sheet_dir)

    def close(self) -> None:
        self._tmp.cleanup()


class BuildTest(unittest.TestCase):
    def setUp(self):
        self.fx = Fixture()

    def tearDown(self):
        self.fx.close()

    def test_recolour_reaches_the_sheet(self):
        png = self.fx.build(self.fx.recipe(recolor={"cloth_base": "orchid_base"}))
        image = Image.open(png).convert("RGBA")
        self.assertEqual(image.size, (32, 32 * 12))
        self.assertEqual(image.getpixel((10, 30))[:3], PALETTE["orchid_base"])
        self.assertEqual(image.getpixel((11, 30))[:3], PALETTE["skin_base"])

    def test_without_recolour_the_colours_are_unchanged(self):
        png = self.fx.build(self.fx.recipe())
        self.assertEqual(Image.open(png).convert("RGBA").getpixel((10, 30))[:3], PALETTE["cloth_base"])

    def test_same_recipe_gives_the_same_png(self):
        recipe = self.fx.recipe(recolor={"cloth_base": "orchid_base"})
        first = self.fx.build(recipe).read_bytes()
        second = self.fx.build(recipe).read_bytes()
        self.assertEqual(first, second)

    def test_stale_frames_from_an_older_build_are_removed(self):
        recipe = self.fx.recipe()
        self.fx.build(recipe)
        stale = self.fx.build_root / "t-a" / "old_frame.txt"
        stale.write_text("stale", encoding="utf-8")
        self.fx.build(recipe)
        self.assertFalse(stale.exists())
        self.assertTrue((self.fx.build_root / "t-a" / "down_base.txt").exists())

    def test_recolor_key_that_no_frame_uses_is_refused_by_name(self):
        with self.assertRaisesRegex(EnemyError, "cloth_hi"):
            self.fx.build(self.fx.recipe(recolor={"cloth_hi": "orchid_hi"}))

    def test_merging_two_colours_warns_but_builds(self):
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            png = self.fx.build(self.fx.recipe(recolor={"cloth_base": "skin_base"}))
        self.assertTrue(png.exists())
        self.assertIn("色に減った", err.getvalue())

    def test_source_colours_lists_every_colour_the_sheet_uses(self):
        self.assertEqual(source_colours(self.fx.src, self.fx.sheet_def), {"outline", "cloth_base", "skin_base"})

    def test_a_sheet_definition_that_disagrees_with_its_declaration_is_refused(self):
        self.fx.sheet_def.write_text(SHEET_DEF.replace("idle=1", "idle=2"), encoding="utf-8")
        with self.assertRaisesRegex(EnemyError, "idle"):
            self.fx.build(self.fx.recipe())


class MainTest(unittest.TestCase):
    def test_the_same_id_in_two_files_is_refused_before_building(self):
        with tempfile.TemporaryDirectory() as tmp:
            paths = []
            for sub in ("a", "b"):
                path = Path(tmp) / sub / "dagger-dup-m.json"
                path.parent.mkdir()
                path.write_text(json.dumps({"id": "dagger-dup-m", "name": "x", "archetype": "dagger", "body": "male"}),
                                encoding="utf-8")
                paths.append(str(path))
            err = io.StringIO()
            with contextlib.redirect_stderr(err):
                code = main(paths)
        self.assertEqual(code, 2)
        self.assertIn("重複", err.getvalue())

    def test_no_recipe_given_is_an_error(self):
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            self.assertEqual(main([]), 2)
```

- [ ] **Step 2: 失敗を確かめる**

Run: `.venv/bin/python -m unittest discover -s tests -p "test_enemy_build.py" -v`
Expected: `ImportError: cannot import name 'build'`

- [ ] **Step 3: 実装を書く**

`tools/enemy_build.py` の `import` を次のようにする（`argparse` `shutil` と `sheet` を足す）。

```python
import argparse
import json
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import sheet  # noqa: E402
from gridfile import BACKGROUND, REPO_ROOT, GridError, display, load_palette, parse  # noqa: E402
```

定数を足す。

```python
BUILD_ROOT = REPO_ROOT / "build" / "enemy"
SHEET_DIR = REPO_ROOT / "build" / "sheets"
```

末尾に足す。

```python
def _sheet_rows(sheet_def: Path) -> list[list[str | None]]:
    """シート定義を読み、`# frames:` の宣言と合うか確かめる（sheet.py の関数は SystemExit で止まるので、EnemyError にする）。"""
    try:
        rows = sheet.read_sheet(sheet_def)
        declared = sheet.read_frames_declaration(sheet_def)
    except SystemExit as exc:
        raise EnemyError(str(exc)) from None
    if declared is not None:
        problems = sheet.check_columns(rows, declared)
        if problems:
            raise EnemyError(f"{display(sheet_def)}: " + " / ".join(problems))
    return rows


def _frame_names(rows: list[list[str | None]]) -> list[str]:
    return sorted({name for row in rows for name in row if name})


def _used(frames) -> set[str]:
    return {c for frame in frames for row in frame for c in row if c is not None}


def source_colours(source_dir: Path, sheet_def: Path) -> set[str]:
    names = _frame_names(_sheet_rows(sheet_def))
    return _used(read_frame(source_dir / f"{name}.txt") for name in names)


def build(recipe: Recipe, source_dir: Path, sheet_def: Path, palette: dict,
          build_root: Path = BUILD_ROOT, sheet_dir: Path = SHEET_DIR) -> Path:
    rows = _sheet_rows(sheet_def)
    names = _frame_names(rows)
    frames = {name: read_frame(source_dir / f"{name}.txt") for name in names}

    used = _used(frames.values())
    unused = sorted(set(recipe.recolor) - used)
    if unused:
        raise EnemyError(
            f"{recipe.id}: recolor の {', '.join(unused)} は、{display(source_dir)} のどのコマでも使われていない（綴りの間違い？）"
        )
    after = {recipe.recolor.get(c, c) for c in used}
    if len(after) < len(used):
        print(f"warning: {recipe.id}: 色替えで {len(used)} 色が {len(after)} 色に減った（別々の色が同じ色になっている）",
              file=sys.stderr)

    out = build_root / recipe.id
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    for name, frame in frames.items():
        note = f"{name} は enemy_build.py が {recipe.id} のレシピで作った（手で編集しない）"
        (out / f"{name}.txt").write_text(serialize_frame(recolor_frame(frame, recipe.recolor), note), encoding="utf-8")

    loaded = sheet.load_frames(rows, palette, out)
    canvas = sheet.compose_sheet(rows, loaded)
    sheet_dir.mkdir(parents=True, exist_ok=True)
    png = sheet_dir / f"{recipe.id}.png"
    canvas.save(png)
    sheet.preview(canvas, sheet.frame_size(loaded)).save(sheet_dir / f"{recipe.id}_preview.png")
    return png


def _print_colours(archetype: str) -> int:
    if archetype not in ARCHETYPES:
        raise EnemyError(f"archetype は {', '.join(ARCHETYPES)} のどれか（{archetype!r} だった）")
    sheet_def = REPO_ROOT / ARCHETYPES[archetype]
    sets = {body: source_colours(REPO_ROOT / SOURCES[(archetype, body)], sheet_def) for body in BODIES}
    for body, colours in sets.items():
        print(f"{body}: {len(colours)} 色")
        print("  " + " ".join(sorted(colours)))
    only_male = sorted(sets["male"] - sets["female"])
    only_female = sorted(sets["female"] - sets["male"])
    print(f"男性だけ: {' '.join(only_male) or 'なし'}")
    print(f"女性だけ: {' '.join(only_female) or 'なし'}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("recipes", nargs="*", type=Path, help="enemy/<id>.json")
    parser.add_argument("--all", action="store_true", help="enemy/ のレシピをすべて作る")
    parser.add_argument("--colours", metavar="ARCHETYPE",
                        help="男女の元のコマが使う色の一覧と差（女性の色が男性とそろっているか）")
    args = parser.parse_args(argv)
    try:
        if args.colours:
            return _print_colours(args.colours)
        if args.all and args.recipes:
            raise EnemyError("--all とレシピのパスは同時に指定できない")
        paths = sorted(ENEMY_DIR.glob("*.json")) if args.all else args.recipes
        if not paths:
            raise EnemyError("作るレシピが無い（enemy/<id>.json を渡すか --all）")
        palette = load_palette()
        recipes = [load_recipe(path, palette) for path in paths]
        seen: dict[str, Path] = {}
        for recipe in recipes:
            if recipe.id in seen:
                raise EnemyError(f"id {recipe.id!r} が重複している（{seen[recipe.id]} と {recipe.path}）")
            seen[recipe.id] = recipe.path
        for recipe in recipes:
            source_dir, sheet_def = source_paths(recipe)
            png = build(recipe, source_dir, sheet_def, palette)
            print(f"ok   {display(png)}  {recipe.name}")
    except (EnemyError, GridError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

`Recipe` が先に定義されている必要があるので、`build` は T2 の `Recipe` の後ろに置く。

- [ ] **Step 4: 通ることを確かめる**

Run: `.venv/bin/python -m unittest discover -s tests -p "test_enemy_build.py" -v`
Expected: 全テスト OK

続けて全体の回帰を確かめる。
Run: `.venv/bin/python -m unittest discover -s tests`
Expected: `OK`（既存のテストを壊していない）

- [ ] **Step 5: 本物のガウで、画素が変わらないことを確かめる（手で。テストには入れない）**

色替え無しのレシピが、ガウのシートと**1画素も違わない PNG** を作ること。

```bash
mkdir -p /tmp/enemy-check
printf '{"id": "check-gau", "name": "確認", "archetype": "dagger", "body": "male"}\n' > /tmp/enemy-check/check-gau.json
.venv/bin/python tools/sheet.py sheets/gau.txt
.venv/bin/python tools/enemy_build.py /tmp/enemy-check/check-gau.json
cmp build/sheets/gau.png build/sheets/check-gau.png && echo SAME
```
Expected: `ok   build/sheets/check-gau.png ...` と `SAME`。`cmp` が差を出したら、`enemy_build.py` が画素を変えている。直してから進む（`Image` を開いて比べる: `.venv/bin/python -c "from PIL import Image; print(Image.open('build/sheets/gau.png').tobytes() == Image.open('build/sheets/check-gau.png').tobytes())"`）。

- [ ] **Step 6: forge の `CLAUDE.md` と `README.md` に書く**

`CLAUDE.md` の「コマンド」のコードブロックの `sheet_gif.py` の行の後に足す。

```
.venv/bin/python tools/enemy_build.py enemy/dagger-red-m.json  # 敵のレシピから、味方の完成コマを色替えして敵のシートを作る（build/sheets/<id>.png）
.venv/bin/python tools/enemy_build.py --all                      # enemy/ の全レシピを作る
.venv/bin/python tools/enemy_build.py --colours dagger           # 男女の元のコマが使う色の差
```

`README.md` には、`unit` の説明の近くに「敵のバリエーション」の節を足し、次を書く。

- レシピは `enemy/<id>.json`（キー: `id` `name` `archetype` `body` `recolor`）。`id` はファイル名と同じ
- `archetype` は今は `dagger` だけ。`body` は `male`（元は `assets/unit/gau/`）か `female`（元は `assets/unit/enemy-src/dagger-female/`）
- `recolor` は「元のコマが使うパレット名 → 置き換え後のパレット名」。画素は変えない
- 元のコマの絵を直したら `enemy_build.py --all` で作り直す。`build/` は生成物

- [ ] **Step 7: コミット**

```bash
git add tools/enemy_build.py tests/test_enemy_build.py CLAUDE.md README.md
git commit -m "feat: 敵のレシピからシートを作る enemy_build.py を追加"
```

---

### Task 4: 確認用の一覧ページ

**Files:**
- Create: `tools/enemy_gallery.py`
- Create: `tests/test_enemy_gallery.py`
- Modify: `CLAUDE.md`（forge。コマンド一覧に1行）

**Interfaces:**
- Consumes: `enemy_build.load_recipe` `enemy_build.ENEMY_DIR` `enemy_build.SHEET_DIR` `enemy_build.EnemyError`
- Produces:
  - `render_gallery(entries: list[tuple[str, str, Path]]) -> str` — `(id, 名前, シートの PNG)` の並びから、自己完結の HTML を作る。各カードに状態（idle/walk/attack）と方向（4つ）を選ぶボタンと、`<canvas>` での再生
  - `main(argv) -> int` — `enemy_gallery.py OUT.html [--ref PNG:名前 ...]`。`enemy/` のレシピ順に並べる。味方の比較用に `--ref build/sheets/gau.png:ガウ（味方）` のように先頭へ足せる

- [ ] **Step 1: 失敗するテストを書く**

```python
"""Checks for tools/enemy_gallery.py (敵の確認ページ)."""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from enemy_gallery import render_gallery  # noqa: E402


class GalleryTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.png = Path(self._tmp.name) / "sheet.png"
        Image.new("RGBA", (128, 384)).save(self.png)

    def tearDown(self):
        self._tmp.cleanup()

    def test_each_entry_becomes_a_card_with_its_sheet_inline(self):
        html = render_gallery([("dagger-red-m", "赤の盗賊", self.png), ("dagger-red-f", "赤の盗賊", self.png)])
        self.assertEqual(html.count('class="card"'), 2)
        self.assertIn("dagger-red-m", html)
        self.assertIn("dagger-red-f", html)
        self.assertIn("data:image/png;base64,", html)

    def test_names_are_escaped(self):
        html = render_gallery([("x", "<b>名前</b>", self.png)])
        self.assertNotIn("<b>名前</b>", html)
        self.assertIn("&lt;b&gt;名前&lt;/b&gt;", html)

    def test_the_page_offers_every_state_and_direction(self):
        html = render_gallery([("x", "名前", self.png)])
        for token in ("idle", "walk", "attack", "down", "up", "left", "right"):
            self.assertIn(f'data-{"state" if token in ("idle", "walk", "attack") else "dir"}', html)
            self.assertIn(token, html)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 失敗を確かめる**

Run: `.venv/bin/python -m unittest discover -s tests -p "test_enemy_gallery.py" -v`
Expected: `ModuleNotFoundError: No module named 'enemy_gallery'`

- [ ] **Step 3: 実装を書く**

`tools/enemy_gallery.py` を作る。

```python
#!/usr/bin/env python3
"""敵のシートを1つの HTML に並べて、状態×4方向の動きを再生する（依頼者の確認用）。

    tools/enemy_build.py --all
    tools/enemy_gallery.py build/enemy_gallery.html --ref build/sheets/gau.png:ガウ（味方）

PNG は HTML の中に埋め込む（1ファイルで渡せる）。コマ数と fps はゲームの JSON と同じ
（idle 2 / 4fps、walk 4 / 8fps、attack 3 / 6fps）。
"""
from __future__ import annotations

import argparse
import base64
import html
import sys
from pathlib import Path
from string import Template

sys.path.insert(0, str(Path(__file__).resolve().parent))

from enemy_build import ENEMY_DIR, SHEET_DIR, EnemyError, load_recipe  # noqa: E402
from gridfile import GridError, load_palette  # noqa: E402

CARD = Template(
    '<section class="card" data-sheet="data:image/png;base64,$data">'
    '<canvas width="128" height="128"></canvas>'
    '<h2>$name</h2><p class="id">$id</p>'
    '<div class="row">$states</div><div class="row">$dirs</div></section>'
)
STATE_BUTTONS = "".join(f'<button data-state="{s}">{s}</button>' for s in ("idle", "walk", "attack"))
DIR_BUTTONS = "".join(f'<button data-dir="{i}">{d}</button>' for i, d in enumerate(("down", "up", "left", "right")))

PAGE = Template("""<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>敵の一覧</title>
<style>
:root { --bg: #fafafa; --fg: #1c1c22; --card: #ffffff; --line: #d8d8e0; --mute: #666; --btn: #eceef6; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #14141a; --fg: #ececf2; --card: #1e1e28; --line: #34344a; --mute: #9a9ab0; --btn: #2a2a3a; } }
:root[data-theme="dark"] { --bg: #14141a; --fg: #ececf2; --card: #1e1e28; --line: #34344a; --mute: #9a9ab0; --btn: #2a2a3a; }
body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font-family: system-ui, sans-serif; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 8px; }
canvas { width: 100%; height: auto; aspect-ratio: 1; image-rendering: pixelated; background: #48484f; border-radius: 4px; }
h2 { font-size: 14px; margin: 6px 0 0; } .id { margin: 0 0 6px; font-size: 11px; color: var(--mute); }
.row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
button { font: inherit; font-size: 12px; background: var(--btn); color: var(--fg); border: 1px solid var(--line); border-radius: 4px; padding: 2px 6px; }
</style></head><body>
<div class="grid">$cards</div>
<script>
const STATES = { idle: { frames: 2, fps: 4, row: 0 }, walk: { frames: 4, fps: 8, row: 4 }, attack: { frames: 3, fps: 6, row: 8 } };
document.querySelectorAll(".card").forEach(function (card) {
  const img = new Image();
  img.src = card.dataset.sheet;
  const canvas = card.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  let state = "idle", dir = 0;
  card.querySelectorAll("button[data-state]").forEach(function (b) { b.onclick = function () { state = b.dataset.state; }; });
  card.querySelectorAll("button[data-dir]").forEach(function (b) { b.onclick = function () { dir = Number(b.dataset.dir); }; });
  function draw(t) {
    const s = STATES[state];
    const col = Math.floor(t / 1000 * s.fps) % s.frames;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, col * 32, (s.row + dir) * 32, 32, 32, 0, 0, canvas.width, canvas.height);
    requestAnimationFrame(draw);
  }
  img.onload = function () { requestAnimationFrame(draw); };
});
</script></body></html>
""")


def render_gallery(entries: list[tuple[str, str, Path]]) -> str:
    cards = [
        CARD.substitute(
            data=base64.b64encode(png.read_bytes()).decode("ascii"),
            name=html.escape(name),
            id=html.escape(id_),
            states=STATE_BUTTONS,
            dirs=DIR_BUTTONS,
        )
        for id_, name, png in entries
    ]
    return PAGE.substitute(cards="\n".join(cards))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("out", type=Path, help="書き出す HTML")
    parser.add_argument("--ref", action="append", default=[], metavar="PNG:名前", help="比較用に先頭へ足すシート（味方など）")
    args = parser.parse_args(argv)
    try:
        entries: list[tuple[str, str, Path]] = []
        for ref in args.ref:
            png, _, name = ref.rpartition(":")
            if not png or not Path(png).is_file():
                raise EnemyError(f"--ref {ref!r}: PNG:名前 の形で、PNG が存在すること")
            entries.append((Path(png).stem, name, Path(png)))
        palette = load_palette()
        for path in sorted(ENEMY_DIR.glob("*.json")):
            recipe = load_recipe(path, palette)
            png = SHEET_DIR / f"{recipe.id}.png"
            if not png.is_file():
                raise EnemyError(f"{png} が無い（先に tools/enemy_build.py --all）")
            entries.append((recipe.id, recipe.name, png))
        if not entries:
            raise EnemyError("並べるシートが無い")
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(render_gallery(entries), encoding="utf-8")
        print(f"ok   {args.out}  {len(entries)} 体")
    except (EnemyError, GridError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: 通ることを確かめる**

Run: `.venv/bin/python -m unittest discover -s tests -p "test_enemy_gallery.py" -v`
Expected: 3 tests OK

Run: `.venv/bin/python -m unittest discover -s tests`
Expected: `OK`

- [ ] **Step 5: `CLAUDE.md` のコマンド一覧に1行足し、コミット**

```
.venv/bin/python tools/enemy_gallery.py build/enemy_gallery.html --ref build/sheets/gau.png:ガウ（味方）  # 敵を並べて動きを再生する確認ページ（依頼者へ渡す）
```

```bash
git add tools/enemy_gallery.py tests/test_enemy_gallery.py CLAUDE.md
git commit -m "feat: 敵の一覧と動きを確かめるページを作る enemy_gallery.py を追加"
```

---

### Task 5: 男性の短剣の敵 3種と色の確認（確認ポイント 1a）

**Files:**
- Create: `enemy/dagger-red-m.json`、`enemy/dagger-green-m.json`、`enemy/dagger-violet-m.json`

**Interfaces:**
- Consumes: `enemy_build.py`（T3）、`enemy_gallery.py`（T4）

ガウの完成コマが使う色は、肌 `skin_rose_*`、頭巾と外套 `cloak_dark_hi/base/shadow` と `cloak_teal_hi`、髪 `roof_hi/base/shadow`、刃 `stone_hi/base`、鍔と柄頭 `wood_*`、ズボン `wood_shadow`。**武器（`stone_*` `wood_*`）は替えない**（持ち物の見た目を保つ。ズボンの `wood_shadow` も替えない）。

色の組み合わせ（案。確認ポイントで依頼者が見て変える前提）:

| id | 名前 | 頭巾と外套 | 髪 | 印象 |
|---|---|---|---|---|
| `dagger-red-m` | 赤の盗賊 | `carpet_*` ＋ ハイライト `flame_base` | `hair_slate_*` | 暗い赤の外套に灰青の髪 |
| `dagger-green-m` | 緑の盗賊 | `leaf_*` | `metal_*` | 緑の外套に金髪 |
| `dagger-violet-m` | 紫の盗賊 | `orchid_*`（影を濃く） | そのまま（`roof_*`） | 紫の外套に赤い髪 |

- [ ] **Step 1: 外套の色が地面に埋もれないか測る**

地面の色（草・土・床）に対して、敵が最も大きく映る外套の基調色を測る。

```bash
.venv/bin/python tools/probe_colors.py --candidate '#8b2637' --against grass_base dirt_base floor_base
.venv/bin/python tools/probe_colors.py --candidate '#1f5c40' --against grass_base dirt_base floor_base
.venv/bin/python tools/probe_colors.py --candidate '#7f2783' --against grass_base dirt_base floor_base
```
Expected: それぞれの判定（`has_lightness_edge` と ΔE）が出る。出力をそのまま控えておく（確認ポイントで依頼者に見せる）。しきい値に届かない色は、その外套の色を別の組み合わせに替える（`leaf_*` は草に近いので届かない可能性が高い。届かなければ `water_*` などに替え、替えたことを控える）。

- [ ] **Step 2: レシピを書く**

`enemy/dagger-red-m.json`

```json
{
  "id": "dagger-red-m",
  "name": "赤の盗賊",
  "archetype": "dagger",
  "body": "male",
  "recolor": {
    "cloak_dark_hi": "carpet_hi",
    "cloak_dark_base": "carpet_base",
    "cloak_dark_shadow": "carpet_shadow",
    "cloak_teal_hi": "flame_base",
    "roof_hi": "hair_slate_hi",
    "roof_base": "hair_slate_base",
    "roof_shadow": "hair_slate_shadow"
  }
}
```

`enemy/dagger-green-m.json`

```json
{
  "id": "dagger-green-m",
  "name": "緑の盗賊",
  "archetype": "dagger",
  "body": "male",
  "recolor": {
    "cloak_dark_hi": "leaf_hi",
    "cloak_dark_base": "leaf_base",
    "cloak_dark_shadow": "leaf_shadow",
    "roof_hi": "metal_hi",
    "roof_base": "metal_base",
    "roof_shadow": "metal_shadow"
  }
}
```

`enemy/dagger-violet-m.json`

```json
{
  "id": "dagger-violet-m",
  "name": "紫の盗賊",
  "archetype": "dagger",
  "body": "male",
  "recolor": {
    "cloak_dark_hi": "orchid_base",
    "cloak_dark_base": "orchid_shadow",
    "cloak_dark_shadow": "orchid_dark",
    "cloak_teal_hi": "orchid_hi"
  }
}
```

Step 1 で色を替えたレシピは、その色に直して書く。

- [ ] **Step 2b: 作って、シートの検査をする**

```bash
.venv/bin/python tools/enemy_build.py --all
.venv/bin/python tools/validate.py
```
Expected: 3体とも `ok   build/sheets/...`、警告（`色に減った`）が出ない。`validate.py` は異常なし。

- [ ] **Step 3: 一覧のページを作って、依頼者に見せる**

```bash
.venv/bin/python tools/sheet.py sheets/gau.txt
.venv/bin/python tools/enemy_gallery.py build/enemy_gallery.html --ref build/sheets/gau.png:ガウ（味方）
```

`Artifact` ツールで `build/enemy_gallery.html` を公開してよい。公開の前に `artifact-design` skill を読み、ページをその規約（タイトル・配色・幅）に合わせて直してから publish する（`tools/enemy_gallery.py` のスタイルはその下書き）。

依頼者に見せるもの: 味方のガウと並べた一覧のページ、Step 1 の測定結果、3体の色の組み合わせの表。

- [ ] **Step 4: ここで止まる（確認ポイント 1a）**

依頼者の返事を待つ。決めてもらうこと:
- 色の組み合わせ（直すところ）
- ガウと見分けがつくか

承認をもらうまで、次のタスクに進まない。直しが出たら、レシピの `recolor` を直して Step 2b からやり直す。

- [ ] **Step 5: コミット（承認後）**

```bash
git add enemy/dagger-red-m.json enemy/dagger-green-m.json enemy/dagger-violet-m.json
git commit -m "feat: 男性の短剣の敵3種（赤・緑・紫の盗賊）のレシピを追加"
```

---

### Task 6: 女性の短剣の下書きと正面の4コマの仕上げ（確認ポイント 1b）

**Files:**
- Create: `compose/enemy_dagger_female.json`
- Create: `assets/unit/enemy-src/dagger-female/{down,up,left,right}_base.txt`

**Interfaces:**
- Consumes: `tools/compose.py`、素体 `types/unit/base/female_<dir>.txt`、ガウの部品 `assets/unit/gau/parts/{hood,hair}_<dir>.txt` と `assets/part/dagger/dagger_<dir>.txt`
- Produces: 女性の短剣の `<dir>_base` 4コマ（後のタスクがこの上に idle2・歩き・攻撃を描く）

**絵の規約（この先の女性のコマすべてに共通）:**
- 色の名前は**ガウの完成コマと同じ役割に同じ名前**を使う（`# map:` の文字は何でもよいが、色名をそろえる）。これで男女に同じ `recolor` が使える。肌 `skin_rose_*`、頭巾と外套 `cloak_dark_*` と `cloak_teal_hi`、髪 `roof_*`、刃 `stone_hi/base`、鍔と柄頭 `wood_*`、ズボン `wood_shadow`、襟 `stone_hi`
- 足元は y=30、左右の中央は 15.5（4方向とも）
- 持ち物（短剣）の位置はガウと同じ（右手の拳。`up` と `left` は奥の手）
- 光は左上
- 男性の頭の部分（y=0〜9 付近）は女性の素体と同じなので、頭巾・髪・目はガウの完成コマの頭と同じ画素にそろえる

- [ ] **Step 1: 下書きの compose 設定を書く**

`compose/enemy_dagger_female.json`（ガウの `compose/gau.json` の `*_base` の4コマだけを、素体を女性にして写す）

```json
{
  "unit": "enemy-dagger-female",
  "frames": {
    "down_base": {
      "body": "types/unit/base/female_down.txt",
      "layers": [
        {"part": "assets/unit/gau/parts/hood_down.txt", "z": "front"},
        {"part": "assets/unit/gau/parts/hair_down.txt", "z": "front"},
        {"part": "assets/part/dagger/dagger_down.txt", "z": "front"}
      ]
    },
    "up_base": {
      "body": "types/unit/base/female_up.txt",
      "layers": [
        {"part": "assets/unit/gau/parts/hood_up.txt", "z": "front"},
        {"part": "assets/unit/gau/parts/hair_up.txt", "z": "front"},
        {"part": "assets/part/dagger/dagger_up.txt", "z": "back"}
      ]
    },
    "left_base": {
      "body": "types/unit/base/female_left.txt",
      "layers": [
        {"part": "assets/unit/gau/parts/hood_left.txt", "z": "front"},
        {"part": "assets/unit/gau/parts/hair_left.txt", "z": "front"},
        {"part": "assets/part/dagger/dagger_left.txt", "z": "back"}
      ]
    },
    "right_base": {
      "body": "types/unit/base/female_right.txt",
      "layers": [
        {"part": "assets/unit/gau/parts/hood_right.txt", "z": "front"},
        {"part": "assets/unit/gau/parts/hair_right.txt", "z": "front"},
        {"part": "assets/part/dagger/dagger_right.txt", "z": "front"}
      ]
    }
  }
}
```

- [ ] **Step 2: 下書きを作る**

```bash
.venv/bin/python tools/compose.py compose/enemy_dagger_female.json --out assets/unit/enemy-src/dagger-female
```
Expected: `書いた assets/unit/enemy-src/dagger-female/down_base.txt` など4行。部品の大きさや色の文字が合わないと `error:` で止まる（その場合は、部品の `# map:` の文字と素体の文字の衝突をメッセージどおりに直す。ガウの `compose.py` は男性素体で同じ部品を通っているので、衝突するなら女性素体の側の文字）。

- [ ] **Step 3: ガウで手を入れたところを調べる**

ガウの完成コマが、下書きの何を直したか（男性側で見つかったもの）を、男性で比べて確かめる。

```bash
.venv/bin/python tools/compose.py compose/gau.json --out /tmp/gau_draft
diff /tmp/gau_draft/down_base.txt assets/unit/gau/down_base.txt
diff /tmp/gau_draft/left_base.txt assets/unit/gau/left_base.txt
diff /tmp/gau_draft/up_base.txt assets/unit/gau/up_base.txt
diff /tmp/gau_draft/right_base.txt assets/unit/gau/right_base.txt
```
Expected: 直したのは次の4種類（調査済み）。①目（頭の `o` と肌の `b` の入れ替え。`down` は y=20・21 付近）②服の色（`cloth_*` → `cloak_dark_*`、肌 `skin_*` → `skin_rose_*`）③襟（`v` = `stone_hi`、胸の y=24 付近）④ズボン（脚の `r` → `y` = `wood_shadow`）。

- [ ] **Step 4: 女性の4コマを同じ4点で仕上げる**

`assets/unit/enemy-src/dagger-female/<dir>_base.txt` を、ガウの同じ向きの完成コマ（`assets/unit/gau/<dir>_base.txt`）の次の点に合わせて直す。女性の素体は胴と脚が細い（`female_down` と `male_down` の y=9 以降を比べる）ので、**頭の部分（目・髪・頭巾）はガウの画素をそのまま写し、胴から下だけを女性の形にあわせて描く**。

1. 目: ガウと同じ位置・同じ画素
2. 服の色: `# map:` の肌と服の色名を、ガウのコマと同じ色名にする
3. 襟: ガウの襟の幅を、女性の肩幅（狭い）に合わせて縮める
4. ズボン: 脚の `r`（`cloth_shadow`）を `y`（`wood_shadow`）に替える

直すたびに検査する。

```bash
.venv/bin/python tools/validate.py
.venv/bin/python tools/unit_check.py assets/unit/enemy-src/dagger-female --items stlmn
```
Expected: `validate.py` は異常なし。`unit_check.py` は脚の中心がそろい、終了コード 0（`<向き>_base` だけなので、増えた切れ目の報告は出ないか0件）。

- [ ] **Step 5: 男女を並べて見せる**

`tools/present.py` で男性のガウと女性の4コマを並べた画像を作る。

```bash
.venv/bin/python tools/present.py build/female_base_compare.png assets/unit/gau/down_base.txt assets/unit/enemy-src/dagger-female/down_base.txt
```
（使い方は `tools/present.py` の先頭の説明に従う。4方向ぶん作る。）

画像は `Read` ツールで開いて見せる。

- [ ] **Step 6: ここで止まる（確認ポイント 1b）**

依頼者に見せるもの: 男女を並べた4方向の画像。決めてもらうこと:
- 女性の体の形（肩幅・胴・脚）
- 胴から下を描き直す方向で進めてよいか

承認をもらうまで、次のタスクに進まない。直しが出たら、`<dir>_base.txt` を直して Step 4 からやり直す。

- [ ] **Step 7: コミット（承認後）**

```bash
git add compose/enemy_dagger_female.json assets/unit/enemy-src/dagger-female/
git commit -m "feat: 女性の短剣の敵の正面の4コマを追加"
```

---

### Task 7: 女性の短剣の待機2コマ目・歩き・攻撃（20コマ）

**Files:**
- Create: `assets/unit/enemy-src/dagger-female/{down,up,left,right}_{idle2,walk_a,walk_b,atk_wind,atk_hit}.txt`（20ファイル）

**Interfaces:**
- Consumes: T6 の `<dir>_base`、ガウの完成コマ（形の手本）、`sheets/gau.txt`（コマの名前の一覧）
- Produces: `sheets/gau.txt` が読む24コマがすべてそろった女性の元のコマ

ガウの完成コマを調べると、動きのコマは**元の `base` から次のように違う**（4方向とも、調査済み）。

| コマ | `base` との差 |
|---|---|
| `walk_a` `walk_b` | 脚（y=28〜30 の3行）だけ。ほかの行は `base` と同じ |
| `idle2` | 右手の拳を2px 上げる（短剣も2px 上げる）。差は y=10 付近から |
| `atk_wind` `atk_hit` | 右腕と短剣を描き直す。差は y=12 付近から（頭は同じ） |

- [ ] **Step 1: 歩き（8コマ）を作る**

`<dir>_walk_a` と `<dir>_walk_b` を、女性の `<dir>_base` を写して、**y=28〜30 の3行だけ**ガウの同じコマの脚（`assets/unit/gau/<dir>_walk_a.txt` の y=28〜30）を手本に描き直す。女性の脚は男性より細く（`female_down` の脚は x=13〜18、`male_down` は x=12〜19）、中心がそろうようにする。足元は y=30。

向きごとの脚の振りは、ガウと同じ向き・同じ前後にする（`walk_a` と `walk_b` で左右の足が逆）。

```bash
.venv/bin/python tools/validate.py
```
Expected: 異常なし

- [ ] **Step 2: 待機の2コマ目（4コマ）を作る**

`<dir>_idle2` を、女性の `<dir>_base` の右手の拳（と、短剣）を**2px 上げて**作る。ガウの `<dir>_idle2` と `<dir>_base` を比べて（`diff`）、どの画素が動いたかを手本にする。短剣の位置も、ガウと同じく2px 上げる（`up` と `left` は奥の手なので短剣は `base` の位置のまま2px だけずらす）。

- [ ] **Step 3: 攻撃（8コマ）を作る**

`<dir>_atk_wind`（振りかぶり）と `<dir>_atk_hit`（突き）を、女性の `<dir>_base` から右腕と短剣を外し、ガウの同じコマを手本に腕と短剣を描き直す。女性は肩の位置が男性より内側なので、腕の付け根を肩に合わせて動かす。攻撃は `[atk_wind, atk_hit, base]` の順で再生されるので、`atk_wind` → `atk_hit` → `base` の流れが、ガウと同じ向き・同じ幅で動くこと。

- [ ] **Step 4: 検査する**

```bash
.venv/bin/python tools/validate.py
.venv/bin/python tools/unit_check.py assets/unit/enemy-src/dagger-female --items stlmn
.venv/bin/python tools/enemy_build.py --colours dagger
```
Expected:
- `validate.py`: 異常なし
- `unit_check.py`: 全コマの脚の中心がそろう（終了コード 0）。「増えた輪郭の切れ目」の報告は、1件ずつ目で見て、わざとの切れ目（歩きの足先・攻撃）か確かめる（男性は7件が正常）
- `--colours dagger`: 「女性だけ:」に色が出ない（出たら、その色は男性に無い＝男女で同じ `recolor` が効かない。ガウと同じ色名に直す）。「男性だけ:」は、女性に使わない色（髪の色など）が出てよいが、`recolor` の鍵になる色（`cloak_dark_*` `roof_*` `cloak_teal_hi`）は両方にあること

- [ ] **Step 5: 動きを見る**

女性だけで、シートを作って動きを見る。

```bash
printf '{"id": "check-female", "name": "確認", "archetype": "dagger", "body": "female"}\n' > /tmp/enemy-check/check-female.json
.venv/bin/python tools/enemy_build.py /tmp/enemy-check/check-female.json
.venv/bin/python tools/sheet_gif.py sheets/gau.txt --unitdir assets/unit/enemy-src/dagger-female
```
Expected: `build/sheets/check-female.png` と `build/sheets/check-female_preview.png`。**赤い足元ライン（y=30）**に全コマの足が乗り、青い中心線に全コマの中心がそろうこと。`sheet.py` のレポートに `<-- off` が出るコマは、攻撃で前に出るもの以外は直す。（`sheet_gif.py` の引数が違えば、`tools/sheet_gif.py` の先頭の説明に従う。）

- [ ] **Step 6: コミット**

```bash
git add assets/unit/enemy-src/dagger-female/
git commit -m "feat: 女性の短剣の敵の待機・歩き・攻撃のコマを追加"
```

---

### Task 8: 女性の短剣の敵 3種と、段階1の確認（確認ポイント 1）

**Files:**
- Create: `enemy/dagger-red-f.json`、`enemy/dagger-green-f.json`、`enemy/dagger-violet-f.json`

**Interfaces:**
- Consumes: T5 で確定した男性3体の `recolor`（**確認ポイント 1a で直した色をそのまま使う**）、T7 の女性の元のコマ

- [ ] **Step 1: 男性のレシピを写して、`id` と `body` だけ変える**

`enemy/dagger-red-m.json` を写して `enemy/dagger-red-f.json` にする。`id` を `dagger-red-f`、`body` を `female` に変え、`name` は男性と同じにする（同じ「赤の盗賊」で、ID だけで男女を分ける）。緑・紫も同じ。

```json
{
  "id": "dagger-red-f",
  "name": "赤の盗賊",
  "archetype": "dagger",
  "body": "female",
  "recolor": {
    "cloak_dark_hi": "carpet_hi",
    "cloak_dark_base": "carpet_base",
    "cloak_dark_shadow": "carpet_shadow",
    "cloak_teal_hi": "flame_base",
    "roof_hi": "hair_slate_hi",
    "roof_base": "hair_slate_base",
    "roof_shadow": "hair_slate_shadow"
  }
}
```
（`recolor` は T5 で最終にした値と一致させる。）

- [ ] **Step 2: 6体を作って、全バリエーションを検査する**

```bash
.venv/bin/python tools/enemy_build.py --all
.venv/bin/python tools/validate.py
.venv/bin/python -m unittest discover -s tests
```
Expected: 6体とも `ok`、警告なし、`validate.py` 異常なし、テスト `OK`。

各バリエーションの絵を `unit_check.py` に通す（作ったコマは `build/enemy/<id>/`）。

```bash
.venv/bin/python tools/unit_check.py build/enemy/dagger-red-m --items stlmn
.venv/bin/python tools/unit_check.py build/enemy/dagger-red-f --items stlmn
.venv/bin/python tools/unit_check.py build/enemy/dagger-green-m --items stlmn
.venv/bin/python tools/unit_check.py build/enemy/dagger-green-f --items stlmn
.venv/bin/python tools/unit_check.py build/enemy/dagger-violet-m --items stlmn
.venv/bin/python tools/unit_check.py build/enemy/dagger-violet-f --items stlmn
```
Expected: 6体とも、脚の中心がそろう（終了コード 0）。増えた切れ目は男性 7 件・女性は T7 で確かめた件数と同じ（色替えで画素は変わらない）。

- [ ] **Step 3: 一覧のページを作って見せる**

```bash
.venv/bin/python tools/enemy_gallery.py build/enemy_gallery.html --ref build/sheets/gau.png:ガウ（味方）
```
T5 と同じく、`artifact-design` skill を読んでから `Artifact` で公開する。

依頼者に見せるもの: 味方のガウと、6体（男女×3色）の一覧と動きのページ。

- [ ] **Step 4: ここで止まる（段階1の確認ポイント）**

決めてもらうこと:
1. 女性の体の品質（動きを含む）
2. 色の組み合わせ（直すところ）
3. **かぶり物の差し替えを続けるか**（「仕様との違い」4。色だけの違いで足りるか、頭の帯の差し替えを試すか）
4. 段階2（剣盾）に進んでよいか。進む前に、段階1でかかった作業量を踏まえて、段階2・3の方針（女性の元のコマを型ごとに描く）を続けるか

承認をもらうまで、次のタスクに進まない。

- [ ] **Step 5: コミット（承認後）**

```bash
git add enemy/dagger-red-f.json enemy/dagger-green-f.json enemy/dagger-violet-f.json
git commit -m "feat: 女性の短剣の敵3種のレシピを追加"
```

---

### Task 9: ゲームへの書き出し（承認後のみ）

**Files:**
- Modify: `tools/enemy_build.py`
- Modify: `tests/test_enemy_build.py`
- Create（ゲーム側。書き出しで作る）: `../assets/images/<id>-map.png`、`../assets/enemies/<id>.json`（承認された敵だけ）

**Interfaces:**
- Consumes: `build` が作る PNG、`Recipe`、`load_palette()`
- Produces:
  - `game_json(recipe: Recipe, palette: dict) -> dict` — ゲームの敵 JSON の雛形（数値は `narazumono` と同じ。バランスは調整しない）。`color` は `recipe.recolor.get("cloak_dark_base", "cloak_dark_base")` のパレット色。`face` は `narazumono-face.png`、`role` は `role-teki.png`
  - `export_game(recipe, png: Path, palette: dict, game_root: Path) -> list[Path]` — `assets/images/<id>-map.png` と `assets/enemies/<id>.json` を書く。JSON が既にあれば上書きせず `EnemyError`
  - CLI `--export-game GAME_ROOT`: 作ったあとに書き出す

この Task は、確認ポイント（Task 8）の承認後にだけ行う。ステージへの配置・バランス調整はしない（範囲外）。書き出す敵は、承認された敵に限る（`enemy/` に承認前のレシピが残っているなら、レシピのパスを渡して選ぶ）。

- [ ] **Step 1: 失敗するテストを書く**

`tests/test_enemy_build.py` の `import` 行に `export_game, game_json` を足し、次を足す。

```python
class ExportGameTest(unittest.TestCase):
    def setUp(self):
        self.fx = Fixture()
        self.game = self.fx.root / "game"
        (self.game / "assets" / "images").mkdir(parents=True)
        (self.game / "assets" / "enemies").mkdir(parents=True)
        self.recipe = self.fx.recipe(recolor={"cloak_dark_base": "orchid_base"})

    def tearDown(self):
        self.fx.close()

    def test_json_follows_the_enemy_shape(self):
        data = game_json(self.recipe, PALETTE)
        self.assertEqual(data["id"], "t-a")
        self.assertEqual(data["sprites"]["map"]["sheet"], "t-a-map.png")
        self.assertEqual(data["sprites"]["map"]["frame"], 32)
        self.assertEqual([data["sprites"]["map"][s]["frames"] for s in ("idle", "walk", "attack")], [2, 4, 3])
        r, g, b = PALETTE["orchid_base"]
        self.assertEqual(data["color"], f"#{r:02x}{g:02x}{b:02x}")

    def test_files_are_written_to_the_game(self):
        png = self.fx.root / "sheet.png"
        Image.new("RGBA", (128, 384)).save(png)
        written = export_game(self.recipe, png, PALETTE, self.game)
        self.assertTrue((self.game / "assets/images/t-a-map.png").is_file())
        data = json.loads((self.game / "assets/enemies/t-a.json").read_text(encoding="utf-8"))
        self.assertEqual(data["name"], "テスト")
        self.assertEqual(len(written), 2)

    def test_an_existing_enemy_json_is_never_overwritten(self):
        png = self.fx.root / "sheet.png"
        Image.new("RGBA", (128, 384)).save(png)
        existing = self.game / "assets/enemies/t-a.json"
        existing.write_text("{}", encoding="utf-8")
        with self.assertRaisesRegex(EnemyError, "既に"):
            export_game(self.recipe, png, PALETTE, self.game)
        self.assertEqual(existing.read_text(encoding="utf-8"), "{}")
        self.assertFalse((self.game / "assets/images/t-a-map.png").exists())
```

- [ ] **Step 2: 失敗を確かめる**

Run: `.venv/bin/python -m unittest discover -s tests -p "test_enemy_build.py" -v`
Expected: `ImportError: cannot import name 'export_game'`

- [ ] **Step 3: 実装を書く**

`tools/enemy_build.py` に足す（`build` の後）。

```python
def game_json(recipe: Recipe, palette: dict) -> dict:
    r, g, b = palette[recipe.recolor.get("cloak_dark_base", "cloak_dark_base")]
    return {
        "id": recipe.id, "name": recipe.name, "role": "敵",
        "combat": True,
        "maxHp": 12, "power": 5, "guard": 1,
        "attack": "melee", "range": 24,
        "attackInterval": 1.6, "speed": 34,
        "skillId": None,
        "color": f"#{r:02x}{g:02x}{b:02x}",
        "sprites": {
            "role": "role-teki.png",
            "face": "narazumono-face.png",
            "map": {
                "sheet": f"{recipe.id}-map.png", "frame": 32,
                "idle": {"frames": 2, "fps": 4},
                "walk": {"frames": 4, "fps": 8},
                "attack": {"frames": 3, "fps": 6},
            },
        },
        "xpReward": 8, "bowDamageCap": None, "fleeAtHpRatio": None,
    }


def export_game(recipe: Recipe, png: Path, palette: dict, game_root: Path) -> list[Path]:
    json_path = game_root / "assets" / "enemies" / f"{recipe.id}.json"
    image_path = game_root / "assets" / "images" / f"{recipe.id}-map.png"
    if json_path.exists():
        raise EnemyError(f"{json_path} は既にある（上書きしない。直すなら手で）")
    shutil.copyfile(png, image_path)
    json_path.write_text(json.dumps(game_json(recipe, palette), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return [image_path, json_path]
```

`main` に `--export-game` を足す。

```python
    parser.add_argument("--export-game", type=Path, metavar="GAME_ROOT",
                        help="作ったあと、PNG と敵の JSON の雛形をゲーム（character-tactics のルート）へ書く")
```
```python
            png = build(recipe, source_dir, sheet_def, palette)
            print(f"ok   {display(png)}  {recipe.name}")
            if args.export_game:
                for written in export_game(recipe, png, palette, args.export_game):
                    print(f"     書いた {written}")
```

- [ ] **Step 4: 通ることを確かめる**

Run: `.venv/bin/python -m unittest discover -s tests`
Expected: `OK`

- [ ] **Step 5: 承認された敵を書き出して、ゲーム側のテストを通す**

```bash
.venv/bin/python tools/enemy_build.py enemy/dagger-red-m.json enemy/dagger-red-f.json --export-game ..
```
（承認された敵のレシピをすべて並べる。承認されなかった敵は書き出さない。）

ゲームのルートで:

```bash
cd ..
npm test
```
Expected: `sheet-size.test.ts` が新しいシートの `ほぼ 128x384`（`frame 32 × 最大コマ数 4` ×  `32 × 12`）を JSON と照らして通る。落ちたら、`assets/images/<id>-map.png` の寸法か JSON の `frames` を見る。

- [ ] **Step 6: コミット**

`git status` で、書き出した敵のファイルだけが対象か確かめてから足す。

```bash
git status --short
git add assets/images/dagger-red-m-map.png assets/images/dagger-red-f-map.png assets/enemies/dagger-red-m.json assets/enemies/dagger-red-f.json
git add pixel-asset-forge/tools/enemy_build.py pixel-asset-forge/tests/test_enemy_build.py
git commit -m "feat: 敵のシートと JSON の雛形をゲームへ書き出す機能を追加し、短剣の敵を足す"
```
（書き出した敵の id に合わせてパスを直す。）

---

## 段階2・3（剣盾・弓）

**この計画では詳しく書かない。** 段階1の確認で、女性の絵の作業量、色替えの見え方、かぶり物の差し替えの要否が決まるので、それを踏まえて段階ごとに別の計画ファイル（`docs/superpowers/plans/2026-..-enemy-variants-stage2.md`、`...-stage3.md`）を書く。見込みだけ記す。

| 段階 | 主な作業 | 段階1から分かっている注意 |
|---|---|---|
| 2 剣盾 | ① ロランの完成コマから剣と盾を単品の部品（4方向）に分ける。分けたあとでロランのコマが1画素も変わらないことを、色替え無しの `enemy_build.py` の出力とロランの `sheet.py` の出力の `cmp` で確かめる ② 女性の剣盾の完成コマ一式（24コマ）を、T6・T7 と同じ手順で描く ③ `ARCHETYPES` `SOURCES` に `swordshield` を足し、レシピとテストを足す | ロランは `atk_wind` で剣を頭より上に振り上げるので（頭の部分が `base` と y=0 から違う）、頭の帯の差し替えは使えない |
| 3 弓 | ① イネスの完成コマから弓を部品に分ける ② 女性の弓の完成コマ一式（`attack` は6コマ。ゲームの JSON とシート定義の `# frames:` を 6 に）を描く ③ `archery` の原型を足す | 弓は体の横へはみ出すので、`unit_check.py` の `--items` を弓の持ち物の文字（イネスは `klmstuw`）にする。敵の JSON の雛形は `attack: "bow"` `range: 120` の `yumihei` を雛形にする |

各段階は、段階1と同じく、一覧と動きのページを依頼者に見せて止まる。

---

## 自己レビュー

**仕様の対応:**

| 仕様 | タスク |
|---|---|
| 1. 仕組み全体（レシピ・`enemy_build.py`・決定的な出力） | T1〜T3 |
| 2. 色替え（色名の置き換えだけ・既存色だけ・味方と区別） | T1、T3、T5（色の測定、ガウとの比較） |
| 3. 男女（男性は流用・女性は新しく描く・`body` だけで切り替え） | T6〜T8（仕様と違い、型ごとに女性の完成コマ一式。「仕様との違い」2） |
| 4. 段階（1 短剣 → 2 剣盾 → 3 弓、終わりで止まる） | T5・T6・T8 の止まる所、末尾の段階2・3 |
| 5. 範囲外（配置・バランス・既存5種・ミスト・顔の絵） | T9 でバランスに触れない、顔は流用（「仕様との違い」7） |
| 6. 検査（unittest・色替えが画素を変えない・決定的・規約・`unit_check`・一覧のページ・`npm test`） | T1〜T4（テスト）、T3 Step 5（画素が変わらない）、T7・T8（`unit_check`）、T4・T5・T8（ページ）、T9（`npm test`） |

**かぶり物（`head`）:** 仕様の設計には入っていたが、調べて分かったこと（「仕様との違い」4）により、段階1の確認で依頼者が決める。この計画のレシピには入れない（`enemy_build.py` は `head` キーを「知らないキー」として断る。T2 のテストで確かめた）。

**プレースホルダーの確認:** 「TBD」「あとで」は無い。絵を描くタスク（T6・T7）は、描くコマの名前・手本・直す点・合格の基準（`validate.py`・`unit_check.py`・`--colours`・`sheet.py` の足元ライン）で書いた。具体的な画素は、手本の完成コマと女性の素体を見て描く（コードではなく絵なので、ここに画素は書かない）。

**型の一致:** `Frame`・`EnemyError`・`read_frame`・`recolor_frame`・`serialize_frame`（T1）、`Recipe`・`load_recipe`・`source_paths`・`SOURCES`・`ARCHETYPES`・`BODIES`・`ENEMY_DIR`（T2）、`build`・`source_colours`・`main`・`BUILD_ROOT`・`SHEET_DIR`（T3）、`render_gallery`（T4）、`game_json`・`export_game`（T9）は、後のタスクで同じ名前・同じ引数で使っている。

**Review Focus の対応:** 1（T1 `test_swap_is_simultaneous`）、2（T3 `test_recolor_key_that_no_frame_uses_is_refused_by_name`）、3（T2 `test_id_must_match_the_file_name` `test_id_with_path_characters_is_refused` `test_uppercase_id_is_refused`）、4（T3 `test_stale_frames_from_an_older_build_are_removed`）、5（T3 `test_merging_two_colours_warns_but_builds` と `test_the_same_id_in_two_files_is_refused_before_building`）。
