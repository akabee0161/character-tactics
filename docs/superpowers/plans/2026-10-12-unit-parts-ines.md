# イネスを「体＋拳」の部品から組み直す Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** イネスの4方向×8状態（描く絵は 4×7 = 28 枚、歩き2枚は立ちの部品を使い回す）を、完全な単品の部品（芯・弓・矢・弓の拳・矢の拳）から `tools/compose.py` で組み直し、腕と袖を消して拳だけを残す。

**Architecture:** ロラン（計画 A）の書き出し `cand/gen/roran_layers.py --export` は色名で切っていたが、イネスは弓の暗い面 `m`・矢の軸 `w`・ズボン `y` が同じ `wood_shadow` なので、色名では分けられない。そこで書き出しを **文字で切る** 共通の道具 `tools/parts_export.py` にし（2体目で使うので共通にする。C ガウ・D 敵でも使う）、イネスの定義は `cand/gen/ines_layers.py` に置く。書き出した部品で今の絵と同じに組めることを確かめ、重なり順の表を依頼者に承認してもらってから、向きごとに腕を消して部品を完全に描き、承認を得てコマを組み直す。

**Tech Stack:** Python 3.14（`pixel-asset-forge/.venv`）、Pillow、unittest。

**Spec:** `docs/superpowers/plans/2026-10-10-unit-parts-roran.md`（計画 A の「決めたこと」と全体の順。この計画は B）、`pixel-asset-forge/types/unit/SPEC.md`（「部品で組む規約」「弓の持ち方」「立ち絵4方向の規約」の 体＋拳）。この計画で決めたことは下の「決めたこと」。

## 決めたこと（2026-10-12 依頼者と合意）

- イネスも腕・袖を消し、拳を体から浮かせる（体＋拳の方針どおり）。弓を握る拳・矢をつまむ拳は、腕が無くても今の位置に置く
- **違和感が強すぎれば方針を変えることがある。** そのため、最初の向き（down）の承認で「この見え方で残り3方向も進めてよいか」を必ず聞く
- ガウ（C）・敵（D）は B の後。この計画ではイネスだけを組み直す

## Global Constraints

- コマンドは `pixel-asset-forge/` で実行する。Python は `.venv/bin/python`。テストは `.venv/bin/python -m unittest discover -s tests`
- イネスの手の肌は `skin_hi,skin_base,skin_shadow`（文字 `a` `b` `c`）。顔・うなじも同じ色なので、拳は箱で切る
- イネスの専用の文字: 弓 `k` `l` `m`、弦 `s`、鏃 `t`、矢の軸 `w`、矢羽根 `u`（SPEC「弓の持ち方」）。服（袖を含む）は `p` `q` `r`（`metal_*`）
- **イネスのコマ（`assets/unit/ines/*.txt`）は、その向きの部品の確認ページを依頼者が承認するまで書き換えない**。承認は重なり順の表（1回）と向きごと（down・up・left・right の4回）
- イネス以外の絵（`assets/unit/roran`・`gau`、`cand/`）は作り直さない
- ゲームへの書き出し（`tools/export.py`、character-tactics の `assets/images/ines-map.png`）はしない（ロランの計画 A でもしていない。E 以降で全ユニットまとめて行う）
- 絵を見せるときは、印（赤枠）を付けた絵と印なしの絵を並べる。Artifact の HTML ページで渡す。動きは再生できるページで見せる
- 回帰テストに `assets/` の生きている絵を読ませない（`pixel-asset-forge/CLAUDE.md`）。テストは一時ディレクトリに作った小さな絵で書く
- push と PR は依頼者の指示があったときだけ
- コミットは Conventional Commits ＋ 日本語の要約。`git add` はファイルを指定する
- 進捗台帳は `.superpowers/sdd/2026-10-12-unit-parts-ines/progress.md`。依頼者の判断と計画からの変更は `Ruling:` 行で書く

## Review Focus

- 同じ色に別の文字（`m`・`w`・`y` が `wood_shadow`）を持つ絵を切ると、色名で逆引きして文字が1つに潰れる → Task 1 のテスト `test_same_colour_different_chars_stay_apart`
- 何も描かない部品（`up` の矢の拳など、箱が `NONE`）のファイルが読めない・組めない → Task 1 のテスト `test_empty_part_is_written_with_the_outline_map`
- `back` の部品を奥から書くと重なりが逆になる（「部品で組む規約」） → Task 1 のテスト `test_back_parts_are_listed_nearest_the_core_first`
- 矢の拳の `keep`（`wood_shadow` を含む）が、拳の輪郭の真下にあるズボン `y`（同じ `wood_shadow`）まで見せてしまう → Task 2 Step 4 で、組んだ28コマが今の絵と画素まで同じことを確かめる（拳はズボンより上にあるので、差が出たらこの取り違えを疑う）。描き直した後は Task 3〜6 の Step 2 で「今の絵と違う画素」に拳の下の輪郭が出ていないかを見る
- 歩きの部品を立ちから使い回したのに、今の歩きの絵で弓・矢・拳が立ちと違う → Task 2 Step 4（歩きのコマも「今の絵と違う画素 0」）

---

### Task 1: 文字で切って部品を書き出す共通の道具 `tools/parts_export.py`

**Files:**
- Create: `pixel-asset-forge/tools/parts_export.py`
- Test: `pixel-asset-forge/tests/test_parts_export.py`

**Interfaces:**
- Consumes: `tools/cut_layers.py` の `CORE`・`Part`・`cut`（画素の値は何でもよい。`"outline"` だけを輪郭として扱う）、`tools/gridfile.py` の `parse`（`Grid.rows: list[str]`、`Grid.charmap: dict[str, str]`）、`tools/compose.py` の `_compose`・`load_config`・`stack_order`（テストで使う）
- Produces:
  - `Box = tuple[int, int, int, int]`、`NONE: Box = (0, 0, 0, 0)`（左上の1画素。どのコマでも空いている）
  - `@dataclass(frozen=True) class PartDef: name: str; file: str; chars: frozenset[str]; boxes: dict[tuple[str, str], Box] | None = None; hand: bool = False; keep: tuple[str, ...] = ()`
    - `boxes` のキーは（向き, 部品の状態）。`None` は枠全体。`keep` は色名
  - `@dataclass(frozen=True) class UnitDef: unit: str; src: Path; dirs: tuple[str, ...]; states: tuple[str, ...]; shares: dict[str, str]; parts: tuple[PartDef, ...]; orders: dict[str, tuple[str, ...]]; hand_colours: tuple[str, ...]`
    - `shares` は「状態 → 部品を使い回す状態」（`{"walk_a": "base", "walk_b": "base"}`）。芯は使い回さない
    - `orders[向き]` は奥→手前の層の名前で、`CORE` を1つ含む
  - `unit_charmap(paths: list[Path]) -> dict[str, str]` 全コマで共通の 文字→色名。食い違えば `ExportError`
  - `cut_chars(rows: list[str], charmap: dict[str, str], parts: list[Part]) -> dict[str, list[str]]` 層の名前 → 32行の文字列（透明は `.`）。`Part.colors` には **文字** を入れる
  - `grid_text(rows: list[str], charmap: dict[str, str], note: str) -> str`
  - `export(unit: UnitDef, parts_dir: Path, config_path: Path, root: Path) -> None` 部品のファイルと compose の設定を書く（コマは書かない）。設定の `part`・`body` は `root` からの相対パス
  - `class ExportError(Exception)`

- [ ] **Step 1: 失敗するテストを書く**

`tests/test_parts_export.py`:

```python
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

from compose import _compose, load_config, stack_order  # noqa: E402
from cut_layers import CORE, Part  # noqa: E402
from gridfile import parse  # noqa: E402
from parts_export import NONE, ExportError, PartDef, UnitDef, cut_chars, export, grid_text, unit_charmap  # noqa: E402

MAP = {"o": "outline", "b": "skin_base", "m": "wood_shadow", "w": "wood_shadow", "q": "metal_base"}
HEAD = "# type: unit\n# size: 32x32\n# light: upper-left\n# bg: transparent\n# map: " + \
       " ".join(f"{k}={v}" for k, v in MAP.items()) + "\n"


def frame(pixels: dict[tuple[int, int], str]) -> str:
    rows = [["."] * 32 for _ in range(32)]
    for (x, y), ch in pixels.items():
        rows[y][x] = ch
    return HEAD + "\n".join("".join(r) for r in rows) + "\n"


# 体（q、輪郭 o）・弓（m）・矢（w）・拳（b）。弓と矢は同じ wood_shadow
BODY = {(x, y): "q" for x in range(12, 15) for y in range(12, 20)}
BOW = {(20, y): "m" for y in range(10, 20)}
ARROW = {(x, 15): "w" for x in range(16, 20)}
FIST = {(21, 15): "b", (21, 16): "b", (22, 15): "o", (22, 16): "o", (21, 14): "o", (21, 17): "o"}


class PartsExportTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.src = self.root / "assets/unit/t"
        self.src.mkdir(parents=True)
        for st in ("base", "walk_a"):
            (self.src / f"down_{st}.txt").write_text(frame({**BODY, **BOW, **ARROW, **FIST}), encoding="utf-8")
        self.unit = UnitDef(
            unit="t", src=self.src, dirs=("down",), states=("base", "walk_a"), shares={"walk_a": "base"},
            parts=(PartDef("弓", "bow", frozenset("m")),
                   PartDef("矢", "arrow", frozenset("w")),
                   PartDef("弓の拳", "bow_hand", frozenset("b"), {("down", "base"): (21, 15, 21, 16)},
                           hand=True, keep=("wood_shadow",)),
                   PartDef("矢の拳", "arrow_hand", frozenset("b"), {("down", "base"): NONE}, hand=True)),
            orders={"down": ("矢の拳", "弓", CORE, "矢", "弓の拳")},
            hand_colours=("skin_base",))

    def tearDown(self):
        self.tmp.cleanup()

    def run_export(self):
        export(self.unit, self.root / "assets/unit/t/parts", self.root / "compose/t.json", self.root)
        return json.loads((self.root / "compose/t.json").read_text(encoding="utf-8"))

    def test_same_colour_different_chars_stay_apart(self):
        grid = parse(self.src / "down_base.txt")
        layers = cut_chars(grid.rows, grid.charmap, [Part("弓", (0, 0, 31, 31), {"m"}), Part("矢", (0, 0, 31, 31), {"w"})])
        self.assertEqual(layers["弓"][15][20], "m")
        self.assertEqual(layers["矢"][15][17], "w")
        self.assertEqual(layers["弓"][15][17], ".")
        self.assertEqual(layers[CORE][15][17], ".")

    def test_composed_parts_reproduce_every_frame(self):
        self.run_export()
        _unit, specs = load_config(self.root / "compose/t.json", self.root)
        for name, spec in specs.items():
            rows = _compose(*spec.grids())[0]
            self.assertEqual(rows, parse(self.src / f"{name}.txt").rows, name)

    def test_walk_reuses_the_base_part_files_but_not_the_core(self):
        config = self.run_export()
        base, walk = config["frames"]["down_base"], config["frames"]["down_walk_a"]
        self.assertEqual([l["part"] for l in base["layers"]], [l["part"] for l in walk["layers"]])
        self.assertNotEqual(base["body"], walk["body"])

    def test_back_parts_are_listed_nearest_the_core_first(self):
        config = self.run_export()
        layers = config["frames"]["down_base"]["layers"]
        self.assertEqual([Path(l["part"]).name for l in layers],
                         ["bow_down_base.txt", "arrow_hand_down_base.txt", "arrow_down_base.txt", "bow_hand_down_base.txt"])
        self.assertEqual([l["z"] for l in layers], ["back", "back", "front", "front"])

    def test_hand_parts_carry_hand_and_keep(self):
        config = self.run_export()
        self.assertEqual(config["hand_colours"], ["skin_base"])
        by_name = {Path(l["part"]).name: l for l in config["frames"]["down_base"]["layers"]}
        self.assertEqual(by_name["bow_hand_down_base.txt"], {"part": "assets/unit/t/parts/bow_hand_down_base.txt",
                                                            "z": "front", "hand": True, "keep": ["wood_shadow"]})
        self.assertNotIn("keep", by_name["arrow_hand_down_base.txt"])

    def test_empty_part_is_written_with_the_outline_map(self):
        self.run_export()
        grid = parse(self.root / "assets/unit/t/parts/arrow_hand_down_base.txt")
        self.assertEqual(grid.charmap, {"o": "outline"})
        self.assertTrue(all(set(r) == {"."} for r in grid.rows))

    def test_conflicting_charmaps_stop(self):
        bad = self.root / "bad.txt"
        bad.write_text(frame({}).replace("m=wood_shadow", "m=wood_base"), encoding="utf-8")
        with self.assertRaisesRegex(ExportError, "'m'"):
            unit_charmap([self.src / "down_base.txt", bad])

    def test_grid_text_lists_only_used_chars_outline_first(self):
        rows = ["." * 32] * 31 + ["ob" + "." * 30]
        text = grid_text(rows, MAP, "note")
        self.assertIn("# map: o=outline b=skin_base\n", text)
        self.assertTrue(text.startswith("# note\n"))
```

`spec.grids()` は `compose.py` の `FrameSpec` が部品を読み込んだ形を返すものとして書いている。実装の前に `grep -n "class FrameSpec\|def " tools/compose.py` と `main` の中の組み立ての呼び出し（`_compose` / `compose_frame` に何を渡しているか）を読み、`main` と同じ方法で `(body, layers)` を作る形にテストを合わせる（メソッドが無ければテストの中に小さな関数 `grids(spec)` を書く）。`_compose` の戻り値の1つ目は行の文字列のリスト。

Run: `.venv/bin/python -m unittest tests.test_parts_export -v`
Expected: ImportError（`parts_export` が無い）

- [ ] **Step 2: 実装する**

`tools/parts_export.py`:

```python
"""完成した unit のコマを、文字で切って部品のファイルにし、tools/compose.py の設定を書く（2026-10-12）。

ロランの書き出し（cand/gen/roran_layers.py --export）は色名で切ったが、イネスは弓の暗い面・矢の軸・ズボンが
同じ wood_shadow なので、専用の文字（SPEC「持ち物の部品には専用の文字を割り当てる」）で切る。
部品の取り方は tools/cut_layers.cut と同じ（箱の中の、その部品の文字。輪郭は接するすべての層に入る）。
ユニットごとの定義（UnitDef）は cand/gen/<ユニット>_layers.py に置く。書くのは部品と設定だけで、コマは書かない。
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from cut_layers import CORE, Part, cut
from gridfile import parse

Box = tuple[int, int, int, int]
NONE: Box = (0, 0, 0, 0)
MAP_PER_LINE = 6


class ExportError(Exception):
    pass


@dataclass(frozen=True)
class PartDef:
    name: str
    file: str
    chars: frozenset[str]
    boxes: dict[tuple[str, str], Box] | None = None
    hand: bool = False
    keep: tuple[str, ...] = ()


@dataclass(frozen=True)
class UnitDef:
    unit: str
    src: Path
    dirs: tuple[str, ...]
    states: tuple[str, ...]
    shares: dict[str, str]
    parts: tuple[PartDef, ...]
    orders: dict[str, tuple[str, ...]]
    hand_colours: tuple[str, ...]


def unit_charmap(paths: list[Path]) -> dict[str, str]:
    out: dict[str, str] = {}
    for path in paths:
        for ch, colour in parse(path).charmap.items():
            if out.setdefault(ch, colour) != colour:
                raise ExportError(f"{path.name}: 文字 {ch!r} が {colour} だが、ほかのコマでは {out[ch]}")
    return out


def cut_chars(rows: list[str], charmap: dict[str, str], parts: list[Part]) -> dict[str, list[str]]:
    outline = {ch for ch, colour in charmap.items() if colour == "outline"}
    frame = [[None if ch == "." else "outline" if ch in outline else ch for ch in row] for row in rows]
    layers = cut(frame, parts)
    out_ch = min(outline)
    return {name: ["".join("." if v is None else out_ch if v == "outline" else v for v in row) for row in layer.frame]
            for name, layer in layers.items()}


def grid_text(rows: list[str], charmap: dict[str, str], note: str) -> str:
    used = {ch for row in rows for ch in row if ch != "."}
    outline = min(ch for ch, colour in charmap.items() if colour == "outline")
    chars = sorted(used, key=lambda ch: (charmap[ch] != "outline", ch)) or [outline]
    entries = [f"{ch}={charmap[ch]}" for ch in chars]
    lines = [f"# {note}", "# type: unit", "# size: 32x32", "# light: upper-left", "# bg: transparent"]
    lines += ["# map: " + " ".join(entries[i:i + MAP_PER_LINE]) for i in range(0, len(entries), MAP_PER_LINE)]
    return "\n".join(lines + rows) + "\n"


def export(unit: UnitDef, parts_dir: Path, config_path: Path, root: Path) -> None:
    charmap = unit_charmap(sorted(unit.src.glob("*.txt")))
    by_name = {p.name: p for p in unit.parts}
    parts_dir.mkdir(parents=True, exist_ok=True)
    rel = lambda p: p.relative_to(root).as_posix()  # noqa: E731
    frames = {}
    for d in unit.dirs:
        order = unit.orders[d]
        core = order.index(CORE)
        back, front = order[:core], order[core + 1:]
        for st in unit.states:
            key = unit.shares.get(st, st)
            grid = parse(unit.src / f"{d}_{st}.txt")
            cuts = [Part(p.name, (p.boxes or {}).get((d, key), (0, 0, 31, 31)) if p.boxes is not None else (0, 0, 31, 31),
                         set(p.chars)) for p in unit.parts]
            layers = cut_chars(grid.rows, charmap, cuts)
            core_path = parts_dir / f"core_{d}_{st}.txt"
            core_path.write_text(grid_text(layers[CORE], charmap, f"{unit.unit} {d}_{st} の芯"), encoding="utf-8")
            entries = []
            for name in [*reversed(back), *front]:  # back は芯に近いものから（「部品で組む規約」）
                part = by_name[name]
                path = parts_dir / f"{part.file}_{d}_{key}.txt"
                if st == key:
                    path.write_text(grid_text(layers[name], charmap, f"{unit.unit} {d}_{key} の{name}"), encoding="utf-8")
                entry = {"part": rel(path), "z": "back" if name in back else "front"}
                if part.hand:
                    entry["hand"] = True
                if part.keep:
                    entry["keep"] = sorted(part.keep)
                entries.append(entry)
            frames[f"{d}_{st}"] = {"body": rel(core_path), "layers": entries}
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps({"unit": unit.unit, "hand_colours": list(unit.hand_colours), "frames": frames},
                                      ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
```

注:
- `boxes` が `None` の部品は枠全体。`boxes` があってその（向き, 状態）が無いときも枠全体になるが、拳の部品は全コマぶん箱を書く（Task 2）。書き漏れを止めたいので、`boxes` があるのにキーが無ければ `ExportError(f"{name}: {d}_{key} の箱が無い")` にする（上のコードの `cuts` の内包表記をこの検査を含む小さな関数に置き換える）。テストを1件足す: `boxes={("down","base"): ...}` の部品で `states` に `"idle2"` を足すと `ExportError`（`down_idle2.txt` も setUp と同じ絵で書いておく）
- `NONE` の箱は (0,0) の1画素だけを見る。`cut` は箱が枠の内なら通る
- 拳の箱に顔やうなじの肌が入らないことは、箱で決まる（Task 2 で確かめる）

Run: `.venv/bin/python -m unittest tests.test_parts_export -v`
Expected: PASS（9件）

- [ ] **Step 3: 全体のテスト**

Run: `.venv/bin/python -m unittest discover -s tests 2>&1 | tail -3`
Expected: OK

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/workspace/character-tactics
git add pixel-asset-forge/tools/parts_export.py pixel-asset-forge/tests/test_parts_export.py
git commit -m "feat: 完成したユニットのコマを文字で切って部品と compose の設定に書き出す parts_export.py を足す"
```

---

### Task 2: イネスの部品を書き出し、重なり順の表を承認してもらう

**Files:**
- Create: `pixel-asset-forge/cand/gen/ines_layers.py`
- Create: `pixel-asset-forge/assets/unit/ines/parts/*.txt`、`pixel-asset-forge/compose/ines.json`

**Interfaces:**
- Consumes: Task 1 の `PartDef`・`UnitDef`・`NONE`・`export`、`tools/compose_page.py`（`compose/<ユニット>.json OUT.html [--dirs ...]`）

部品（奥→手前の表は下の `ORDERS`）:

| 部品 | ファイル | 文字 | 箱 |
|---|---|---|---|
| 芯（体・頭・脚・腕と袖） | `core_<向き>_<状態>.txt` | 残り | |
| 弓（弦を含む） | `bow_<向き>_<状態>.txt` | `k` `l` `m` `s` | 枠全体 |
| 矢（軸・鏃・矢羽根） | `arrow_<向き>_<状態>.txt` | `w` `t` `u` | 枠全体 |
| 弓の拳（左手） | `bow_hand_<向き>_<状態>.txt`、`hand`、`keep`: `wood_hi,wood_base,wood_shadow,stone_hi` | `a` `b` `c` | 下の表 |
| 矢の拳（右手） | `arrow_hand_<向き>_<状態>.txt`、`hand`、`keep`: `wood_shadow,stone_base,water_base,stone_hi` | `a` `b` `c` | 下の表 |

拳の箱（x0, y0, x1, y1。今の絵の肌の塊を 2026-10-12 に数えたもの。歩きは立ちを使い回す）:

| 向き | 状態 | 弓の拳 | 矢の拳 |
|---|---|---|---|
| down | base / idle2 | (20,20,21,21) | (15,19,16,20) / (13,19,14,20) |
| down | atk_wind / atk_draw / atk_hit / atk_release | (19,20,20,21) | (15,19,16,20) / (13,17,14,18) / (11,15,12,16) / (10,14,11,15) |
| up | base・idle2 | (10,20,11,21) | NONE（見せない） |
| up | atk_* の4つ | (9,16,10,17) | NONE |
| left | すべて | (6,19,7,20) | base (10,17,11,17) / idle2 (12,17,13,18) / atk_wind (11,17,11,17) / atk_draw・atk_hit・atk_release NONE（体に隠れる） |
| right | すべて | (24,19,25,20) | base (20,17,21,18) / idle2 (18,17,19,18) / atk_wind (19,17,20,18) / atk_draw (17,17,18,18) / atk_hit (15,17,16,18) / atk_release (14,17,15,18) |

重なり順の初めの案（奥→手前。SPEC「弓の持ち方」から: 奥の手・矢・弦は体に重なる画素を描かない＝芯より奥、拳は握る物より手前、`up` の鏃は弓の向こう側）:

```python
ORDERS = {
    "down": (CORE, "弓", "矢", "弓の拳", "矢の拳"),
    "up": ("矢", "矢の拳", "弓", "弓の拳", CORE),
    "left": ("矢の拳", "矢", CORE, "弓", "弓の拳"),
    "right": ("弓", "弓の拳", CORE, "矢", "矢の拳"),
}
```

- [ ] **Step 1: 定義を書く**

`cand/gen/ines_layers.py` に、上の表どおりの `UnitDef`（`unit="ines"`、`src=Path("assets/unit/ines")`、`dirs=("down","up","left","right")`、`states=("base","idle2","walk_a","walk_b","atk_wind","atk_draw","atk_hit","atk_release")`、`shares={"walk_a":"base","walk_b":"base"}`、`hand_colours=("skin_hi","skin_base","skin_shadow")`）と、`--export` で `export(INES, Path("assets/unit/ines/parts"), Path("compose/ines.json"), Path("."))` を呼ぶ `main` を書く。`sys.path.insert(0, "tools")` は `roran_layers.py` と同じ。docstring に「イネスの今のコマを部品に書き出す（2026-10-12。描き直す前に一度だけ使う）」と、拳の箱を数えた日を書く。

- [ ] **Step 2: 書き出して、構造を検査する**

Run: `.venv/bin/python cand/gen/ines_layers.py --export && .venv/bin/python tools/validate.py assets/unit/ines/parts`
Expected: 書き出した（芯 32・部品 4×4×6 = 96、計 128 ファイル）。validate が ok

- [ ] **Step 3: 今の絵と同じに組めることを確かめる**

Run: `.venv/bin/python tools/compose_page.py compose/ines.json build/ines_parts.html`
Expected: 32コマすべて「今の絵と違う画素 0」。閉じていない拳の一覧が出る（Task 3〜6 で描き足す所）

差が出たら、重なり順の案が今の絵と合っていない（2つの部品が重なる所で、手前と奥が逆）。差の出た画素で重なっている2つの部品の順を入れ替え、差が 0 になる順を探す。どの順でも 0 にならないとき（今の絵が、ある所では A が手前、別の所では B が手前になっている）は、その画素を台帳に `Finding:` で書き、Step 5 で依頼者に見せる。順を変えたら台帳に `Ruling:` で書く。歩きのコマだけ差が出たら、歩きの弓・矢・拳が立ちと違う → `shares` から外す。

- [ ] **Step 4: 拳の部品に拳以外が入っていないことを確かめる**

Run: `grep -c "[abc]" assets/unit/ines/parts/*hand_*.txt | grep -v ":0$" | head -60` と、ページの拳の部品の絵
Expected: 拳の部品に、顔・うなじ・首の肌が入っていない（入っていたら箱を直して Step 2 から）。`up` の矢の拳、`left` の atk_draw・atk_hit・atk_release の矢の拳は空

- [ ] **Step 5: 依頼者に重なり順の表を見せて止まる**

`build/ines_parts.html`（4方向の全コマ。各行が部品を奥→手前に並べた絵＋組んだ絵＋今の絵）を Artifact で公開し、向きごとの重なり順（奥→手前）を文で添える。**承認まで Task 3 へ進まない。** 指摘で順を変えたら `ORDERS` を直して Step 2 から（今の絵と同じに組めなくなる順を求められたら、その差は Task 3〜6 の描き直しで出る差として台帳に書く）。

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/workspace/character-tactics
git add pixel-asset-forge/cand/gen/ines_layers.py pixel-asset-forge/assets/unit/ines/parts pixel-asset-forge/compose/ines.json
git status --short
git commit -m "feat: イネスの32コマを部品のファイルに書き出す（描き足す前。組むと今の絵と同じ）"
```

---

### Task 3〜6: 腕を消し、部品を完全に描く（down → up → left → right、向きごとに承認）

向きごとに同じ手順を繰り返す（Task 3 = down、Task 4 = up、Task 5 = left、Task 6 = right）。

**Files:**
- Modify: `pixel-asset-forge/assets/unit/ines/parts/*_<向き>_*.txt`
- Modify（承認後）: `pixel-asset-forge/assets/unit/ines/<向き>_*.txt`（8コマ）

その向きで描くもの（部品を単品で見て完全な形にする。「部品で組む規約」）:
- **芯から腕と袖を消す**（体＋拳）。肩から先の服（`p` `q` `r`）と、胴の前を横切る前腕を消し、消した所は胴なら上下の行と同じ服の色・輪郭で埋め、胴の外なら透明にして胴の輪郭を閉じる。袖の名残（1px の袖口）も残さない
- 芯の穴（弓・矢・拳に隠れていた体）を描く
- 拳: 四方とも輪郭で閉じる（`.venv/bin/python tools/hand_outline.py <拳の部品> --hand skin_hi,skin_base,skin_shadow --write` で閉じ、形を目で直す）。隠れる拳は隠す物（体）の領域の内側に置く（境界にぴったり接しない）。`up` の矢の拳・`left` の引き絞る間の矢の拳は、体に完全に隠れる位置に描く（空のままにしない。「両手の拳の層を必ず持つ」）
- 弓・矢: 手前の部品に隠れていた所を描く
- 向きごとの注意:
  - down: 右の前腕が胴の前を横切っている（y=19 の辺り）。消すと矢の拳が弦の上に浮く。`idle2` の「肩と肘も1px 外へ出す」動きは腕と一緒に無くなる
  - up: 矢を引く右腕の肘・弓を持つ左手と体をつなぐ袖（攻撃の4コマ）が消える。攻撃で動くのが弓と弓の拳だけになる（引き絞る・放った後の「右腕を1px 下げる」動きは無くなる）
  - left: 手前の左腕（y=19 の x=8〜12）を消すと、弓の拳が顔の前に浮く
  - right: 奥の左腕（y=19 の x=19〜23）を消すと、弓の拳が体の右に浮く

- [ ] **Step 1: 描く**

部品のファイルを直接直す。直したら `.venv/bin/python tools/validate.py assets/unit/ines/parts` と `.venv/bin/python tools/body_check.py assets/unit/ines/parts` を通す（body_check の報告は1件ずつ目で確かめ、腕を消した結果として正しいものは台帳に書く）。

- [ ] **Step 2: 確かめる**

Run: `.venv/bin/python tools/compose_page.py compose/ines.json build/ines_parts.html --dirs <向き>`
Expected: その向きの拳がすべて閉じている。「今の絵と違う画素」は、腕・袖を消した所、拳の輪郭が見えるようになった所、穴を描いた所だけ（それ以外の差は描き間違い。直してから進む）

組んだコマで動きのページを作る（コマはまだ書き換えないので、一時フォルダに組む）:

```bash
rm -rf build/ines_cand && cp -r assets/unit/ines build/ines_cand && rm -rf build/ines_cand/parts
.venv/bin/python tools/compose.py compose/ines.json --out build/ines_cand
```

`build/ines_cand` の8コマ（この向き）と、今の絵の残りの向きでシートを作り、動きを再生するページにする。`tools/sheet.py` はシート定義の置き場（`assets/unit/<ユニット>/` を読む）を `--help` で確かめ、読めないなら `sheets/ines.txt` を写した一時の定義で `build/ines_cand` を読ませる。再生のページは character-tactics の `tools/anim-page.py`（`assets/images/` の中のシートしか読まない）に、`assets/images/ines-map-cand.png`（一時。コミットしない、見せた後に消す）と、`assets/units/ines.json` を写して `sprites.map.sheet` だけを `ines-map-cand.png` にした一時の JSON を渡して作る。今のイネスのページも並べる。

- [ ] **Step 3: 依頼者に見せて止まる**

部品のページ（印あり・印なし）と動きのページ（今の絵と並べる）を Artifact で公開し、変わった所（腕を消した所、拳の位置、穴）を文で添える。**承認まで次へ進まない。** 指摘があれば台帳に書き、Step 1 へ戻る。

**down（Task 3）のときだけ、「腕の無い見え方で、残りの3方向も進めてよいか」を1つの質問として聞く。** 違和感が強すぎて方針を変えると言われたら、Task 4 以降へ進まず、台帳に `Ruling:` を書いて止まる（計画を書き直す）。

- [ ] **Step 4: 承認後、コマを組み直す**

Run: `.venv/bin/python tools/compose.py compose/ines.json --frames <向き>_base <向き>_idle2 <向き>_walk_a <向き>_walk_b <向き>_atk_wind <向き>_atk_draw <向き>_atk_hit <向き>_atk_release --force`
Run: `.venv/bin/python tools/compose.py compose/ines.json --frames <同じ8コマ> --check`（終了 0）、`.venv/bin/python tools/validate.py assets/unit/ines`、`.venv/bin/python tools/unit_check.py assets/unit/ines --items klmstuw`
Expected: 書いた。`--check` は差なし。validate は ok。unit_check の脚の中心は ok（増えた輪郭の切れ目の報告は1件ずつ目で確かめ、台帳に書く）

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/workspace/character-tactics
git add pixel-asset-forge/assets/unit/ines/parts pixel-asset-forge/assets/unit/ines/<向き>_*.txt
git commit -m "feat: イネスの <向き> を体＋拳の部品から組み直す（腕と袖を消す）"
```

---

### Task 7: 文書と台帳

**Files:**
- Modify: `pixel-asset-forge/types/unit/SPEC.md`
  - 「立ち絵4方向の規約」の体＋拳の項: 「ロランはこの方針で組み直した。ガウ・イネスは未対応」→ ロランとイネスは組み直した、ガウは未対応
  - 「弓の持ち方」: 腕の記述（`down` の「前腕が胴の前を y=19 で横切る」、`left` の「腕 y=19 の x=8〜12」、`right` の「腕 y=19 の x=19〜23」、`idle2` の「肩と肘も1px 外へ」、`up` の「体との間は袖でつなぐ」「右腕を1px 下げる」「右腕の肘」）を、体＋拳で組んだ今の絵に合わせて書き直す（2026-10-12 に変えたと書く）。イネスは部品から組む（`compose/ines.json`）
  - 「描く手順」の近くに、完成した絵を部品に書き出す道具 `tools/parts_export.py`（文字で切る）と、ユニットごとの定義を `cand/gen/<ユニット>_layers.py` に置くことを書く
- Modify: `pixel-asset-forge/README.md`（`parts_export.py` の使い方、イネスの部品の置き場）、`pixel-asset-forge/CLAUDE.md`（コマンドの一覧に `.venv/bin/python cand/gen/ines_layers.py --export  # 完成したコマを部品に書き出す（描き直す前に一度だけ）` と `compose.py compose/ines.json --check`）
- Modify: `pixel-asset-forge/ISSUES.md`（「ガウ・イネス・敵を 体 + 拳 の方針で組み直す」の行を、イネスは済み（2026-10-12）・残りはガウ（C）と敵（D）に書き換える。作業中に見つけて直していないものを1行ずつ足す）
- Create: `docs/superpowers/ledgers/2026-10-12-unit-parts-ines.md`（台帳の写し）

- [ ] **Step 1: 更新し、全体テスト**

Run: `.venv/bin/python -m unittest discover -s tests 2>&1 | tail -3` → OK
Run: `.venv/bin/python tools/compose.py compose/ines.json --check` → 終了 0（32コマすべて部品から再現できる）

- [ ] **Step 2: Commit**

```bash
cd /home/ubuntu/workspace/character-tactics
git add pixel-asset-forge/types/unit/SPEC.md pixel-asset-forge/README.md pixel-asset-forge/CLAUDE.md pixel-asset-forge/ISSUES.md docs/superpowers/ledgers/2026-10-12-unit-parts-ines.md
git commit -m "docs: イネスを体＋拳の部品から組んだことと parts_export.py を SPEC・README・ISSUES に反映する"
```

---

## Self-Review

- 決めたこととの対応: 腕を消して拳を浮かせる→Task 3〜6、違和感で方針を変える余地→Task 3 Step 3 の質問、イネスだけ→Global Constraints
- 計画 A の手順との対応: 書き出して今の絵と同じに組めることを確かめる（A の Task 6）→Task 2、重なり順を先に合わせる（「部品で組む規約」）→Task 2 Step 5、向きごとの承認（A の Task 7〜10）→Task 3〜6、文書→Task 7
- A との違い: 色名ではなく文字で切る（`wood_shadow` の3文字）→Task 1。書き出しを共通の道具にした（2体目。C・D でも使う）。ロランの書き出しのような生きた絵を読むテストは作らない（Task 2 は確認ページで確かめる）
- 型の整合: `PartDef`・`UnitDef`・`NONE`・`export`・`cut_chars` を Task 1・2 で同じ名前で使う
- 承認の止まりどころ: Task 2 Step 5（重なり順）、Task 3〜6 の Step 3（4回）。down では方針の確認も
