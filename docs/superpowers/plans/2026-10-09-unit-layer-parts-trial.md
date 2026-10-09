# ユニットを層で組む試作（槍の女性 a の left）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 槍の女性 a（`spear-thug-a-f`）の `left` 6コマを、7つの層と重なり順の表で合成して作り、今の絵と比べるページで依頼者に見せる。

**Architecture:** 層の合成は汎用の小さなモジュール `cand/gen/layers.py`（層の数を決め打ちしない。テスト付き）。
試作の組み立ては `cand/gen/mklayers.py`（今の部品と `mkweapons.py` のパッチから層を作り、取り付け点で槍を拳に付け、表の順で合成する）。
比較ページは `cand/gen/layer_page.py`。出力は `cand/layer-trial/spear-thug-a-f/`。

**Tech Stack:** Python 3.14（`pixel-asset-forge/.venv`）、Pillow、unittest。

**Spec:** `docs/superpowers/specs/2026-10-09-unit-layer-parts-design.md`

## Global Constraints

- コマンドは `pixel-asset-forge/` で実行する。Python は `.venv/bin/python`
- 重なり順（奥→手前、left の6コマ共通）: 武器 → 奥の腕・拳 → 長い髪（背中）→ 芯 → 長い髪（頭）→ かぶり物 → 手前の腕・拳
- 振りかぶりの奥の拳は胴の後ろ（依頼者の判断 2026-10-09）
- 奥の拳は影の色で描く（立ち・待機2・歩きは `mkweapons.FIST_FAR_L` が影の色）
- 槍の握る位置は穂先から12px（SPEC の規約。`mkweapons.GRIP`）
- 層の数・層の名前を決め打ちしない（後で頭・胴・脚を分ける可能性がある）
- 絵（`cand/layer-trial/` の生成物）は、依頼者に見せて承認を取るまでコミットしない。道具とテストのコミットはよい
- 試作の道具は `cand/gen/`。採用が決まってから `tools/` へ移す（この計画の範囲外）
- push と PR は依頼者の指示があったときだけ
- コミットは Conventional Commits ＋ 日本語の要約

## Review Focus

- 取り付け点や手の位置でずらした層の画素が 32x32 の外へ出る → 黙って捨てずに `LayerError`（`mkweapons.apply` は黙って捨てる。前回の最終レビューで指摘された）。Task 1 でテスト
- 重なり順の表に無い層・表にあるのに無い層・表の重複 → `LayerError`。Task 1 でテスト
- 取り付け点が片方に無い → `LayerError`。Task 1 でテスト
- 合成の後に `close_hands` が足す輪郭が、合成し直しで同じに再現される（`--check` が誤検出しない）。Task 1 のテストと Task 4 の実行で確かめる
- 層の大きさが 32x32 でない → `LayerError`。Task 1 でテスト

---

### Task 1: 層の合成モジュール `layers.py`

**Files:**
- Create: `pixel-asset-forge/cand/gen/layers.py`
- Test: `pixel-asset-forge/tests/test_layers.py`

**Interfaces:**
- Consumes: `tools/hand_outline.py` の `close_hands(frame, hand: set[str], arm: set[str]) -> (frame, changed: list[(x, y)])`
- Produces:
  - `Frame = list[list[str | None]]`（32行×32列、色名か None）
  - `class LayerError(Exception)`
  - `@dataclass Layer(frame: Frame, anchors: dict[str, tuple[int, int]] = {})`
  - `blank() -> Frame`
  - `shifted(layer: Layer, dx: int, dy: int, name: str = "層") -> Layer`
  - `attach(item: Layer, holder: Layer, point: str, name: str = "層") -> Layer`（item の取り付け点を holder の同じ名前の点に合わせる）
  - `compose(layers: dict[str, Layer], order: list[str]) -> tuple[Frame, Frame]`（(絵, 画素ごとの層の名前)。order は奥→手前）
  - `ADDED = "後から足した輪郭"`
  - `finish(frame: Frame, labels: Frame, hand: set[str], arm: set[str]) -> tuple[Frame, Frame]`
  - `differences(a: Frame, b: Frame) -> list[tuple[int, int]]`

- [ ] **Step 1: 失敗するテストを書く**

`pixel-asset-forge/tests/test_layers.py`:

```python
"""Checks for cand/gen/layers.py (層を重なり順の表で合成する。試作)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))
sys.path.insert(0, str(REPO_ROOT / "cand" / "gen"))

from layers import ADDED, Layer, LayerError, attach, blank, compose, differences, finish, shifted  # noqa: E402

HAND = {"skin_base", "skin_shadow"}
ARM = {"cloth_base"}


def box(x0, y0, x1, y1, name):
    """x0..x1・y0..y1（両端を含む）を name で塗った層。"""
    f = blank()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            f[y][x] = name
    return Layer(f)


class ComposeTest(unittest.TestCase):
    def test_front_layer_overwrites_and_labels(self):
        frame, labels = compose({"胴": box(10, 10, 15, 20, "cloth_base"), "拳": box(14, 14, 16, 15, "skin_base")},
                                ["胴", "拳"])
        self.assertEqual(frame[14][14], "skin_base")
        self.assertEqual(labels[14][14], "拳")
        self.assertEqual(frame[16][14], "cloth_base")
        self.assertEqual(labels[16][14], "胴")
        self.assertIsNone(labels[0][0])

    def test_far_layer_is_hidden_behind_nearer_layer(self):
        """奥の拳が髪の後ろに入る（試作の動機）: 重なる画素はすべて手前の層になる。"""
        frame, labels = compose({"奥の拳": box(20, 16, 21, 17, "skin_shadow"), "髪": box(18, 14, 21, 18, "hair")},
                                ["奥の拳", "髪"])
        self.assertTrue(all(labels[y][x] == "髪" for y in (16, 17) for x in (20, 21)))

    def test_order_must_match_layers(self):
        layers = {"a": box(0, 0, 1, 1, "x"), "b": box(0, 0, 1, 1, "y")}
        for order in (["a"], ["a", "b", "c"], ["a", "b", "a"]):
            with self.assertRaises(LayerError):
                compose(layers, order)

    def test_layer_must_be_32x32(self):
        with self.assertRaises(LayerError):
            compose({"a": Layer([[None] * 31 for _ in range(32)])}, ["a"])


class PlaceTest(unittest.TestCase):
    def test_shifted_moves_pixels_and_anchors(self):
        layer = box(5, 5, 5, 5, "x")
        layer.anchors["grip"] = (5, 5)
        moved = shifted(layer, -1, 2)
        self.assertEqual(moved.frame[7][4], "x")
        self.assertIsNone(moved.frame[5][5])
        self.assertEqual(moved.anchors["grip"], (4, 7))

    def test_shifted_out_of_frame_raises(self):
        with self.assertRaises(LayerError):
            shifted(box(0, 0, 0, 0, "x"), -1, 0)

    def test_attach_aligns_points(self):
        spear = box(9, 0, 9, 24, "wood_base")
        spear.anchors["grip"] = (9, 12)
        fist = box(20, 18, 21, 19, "skin_shadow")
        fist.anchors["grip"] = (20, 18)
        placed = attach(spear, fist, "grip")
        self.assertEqual(placed.anchors["grip"], (20, 18))
        self.assertEqual(placed.frame[18][20], "wood_base")
        self.assertEqual(placed.frame[6][20], "wood_base")

    def test_attach_without_point_raises(self):
        with self.assertRaises(LayerError):
            attach(box(0, 0, 0, 0, "x"), box(1, 1, 1, 1, "y"), "grip")


class FinishTest(unittest.TestCase):
    def test_added_outline_is_labelled_and_reproducible(self):
        frame, labels = compose({"拳": box(20, 20, 21, 21, "skin_base")}, ["拳"])
        out1, lab1 = finish(frame, labels, HAND, ARM)
        out2, _ = finish(frame, labels, HAND, ARM)
        self.assertEqual(out1[19][20], "outline")
        self.assertEqual(lab1[19][20], ADDED)
        self.assertEqual(lab1[20][20], "拳")
        self.assertEqual(differences(out1, out2), [])

    def test_differences_lists_changed_pixels(self):
        a, b = blank(), blank()
        b[3][4] = "x"
        self.assertEqual(differences(a, b), [(4, 3)])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `.venv/bin/python -m unittest tests.test_layers -v`
Expected: FAIL（`ModuleNotFoundError: No module named 'layers'`）

- [ ] **Step 3: 実装を書く**

`pixel-asset-forge/cand/gen/layers.py`:

```python
"""層（パーツ）を重なり順の表で合成する（試作、2026-10-09。採用したらテスト付きで tools/ へ移す）。

層は 32x32 のコマと、取り付け点（名前→座標）を持つ。重なり順の表（奥→手前の層の名前の並び）の順に、
手前の層の画素で上書きして合成する。どの画素がどの層から来たか（labels）も返す。層の数は決め打ちしない。
設計: character-tactics の docs/superpowers/specs/2026-10-09-unit-layer-parts-design.md
"""
from __future__ import annotations

from dataclasses import dataclass, field

from hand_outline import close_hands

Frame = list[list[str | None]]
Point = tuple[int, int]
SIZE = 32
ADDED = "後から足した輪郭"  # 合成の後に close_hands が足した輪郭の labels


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


def shifted(layer: Layer, dx: int, dy: int, name: str = "層") -> Layer:
    """層を (dx, dy) ずらす。枠の外へ出る画素があれば止める（黙って捨てない）。"""
    _check_size(layer, name)
    out = blank()
    for y, row in enumerate(layer.frame):
        for x, n in enumerate(row):
            if n is None:
                continue
            nx, ny = x + dx, y + dy
            if not (0 <= nx < SIZE and 0 <= ny < SIZE):
                raise LayerError(f"{name}: ({x},{y}) をずらすと枠の外 ({nx},{ny}) に出る")
            out[ny][nx] = n
    return Layer(out, {k: (x + dx, y + dy) for k, (x, y) in layer.anchors.items()})


def attach(item: Layer, holder: Layer, point: str, name: str = "層") -> Layer:
    """item の取り付け点 point を、holder の同じ名前の点に合わせて置く（武器を拳の握る点に付ける）。"""
    for who, layer in (("付ける側", item), ("持つ側", holder)):
        if point not in layer.anchors:
            raise LayerError(f"{name}: {who}に取り付け点 {point} が無い")
    (ix, iy), (hx, hy) = item.anchors[point], holder.anchors[point]
    return shifted(item, hx - ix, hy - iy, name)


def compose(layers: dict[str, Layer], order: list[str]) -> tuple[Frame, Frame]:
    """order（奥→手前）の順に重ねる。(絵, 画素ごとの層の名前)。"""
    missing = [n for n in order if n not in layers]
    extra = [n for n in layers if n not in order]
    dup = sorted({n for n in order if order.count(n) > 1})
    if missing or extra or dup:
        raise LayerError(f"重なり順の表と層が合わない: 表にあって層に無い {missing}、層にあって表に無い {extra}、重複 {dup}")
    frame, labels = blank(), blank()
    for name in order:
        _check_size(layers[name], name)
        for y, row in enumerate(layers[name].frame):
            for x, n in enumerate(row):
                if n is not None:
                    frame[y][x] = n
                    labels[y][x] = name
    return frame, labels


def finish(frame: Frame, labels: Frame, hand: set[str], arm: set[str]) -> tuple[Frame, Frame]:
    """合成の後に手の輪郭を閉じる（tools/hand_outline.py）。足した画素の labels は ADDED。"""
    out, changed = close_hands(frame, hand, arm)
    lab = [row[:] for row in labels]
    for x, y in changed:
        lab[y][x] = ADDED
    return out, lab


def differences(a: Frame, b: Frame) -> list[Point]:
    return [(x, y) for y in range(SIZE) for x in range(SIZE) if a[y][x] != b[y][x]]
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_layers -v`
Expected: 10 tests OK。続けて全体: `.venv/bin/python -m unittest discover -s tests` が OK（今は 341 件）

- [ ] **Step 5: コミット**

```bash
git add pixel-asset-forge/cand/gen/layers.py pixel-asset-forge/tests/test_layers.py
git commit -m "feat: 層を重なり順の表で合成する layers.py を足す（試作）"
```

---

### Task 2: 試作の組み立て `mklayers.py`

**Files:**
- Create: `pixel-asset-forge/cand/gen/mklayers.py`
- 出力（コミットは Task 5）: `pixel-asset-forge/cand/layer-trial/spear-thug-a-f/left_<状態>.txt`・`noweapon/left_<状態>.txt`・`labels.json`

**Interfaces:**
- Consumes: Task 1 の `Layer`・`attach`・`blank`・`compose`・`differences`・`finish`・`shifted`。
  `mkweapons`（`apply`・`mirror`・`spear_base_down`・`spear_horizontal`・`spear_hit_left`・`fist_h`・`FIST_FAR_L`・`HAND`・`ARM`・`mf`）。
  `mkframes`（`body(kind, d, sex)`・`overlay(canvas, part, z)`・`WALK`・`mp.bodies`・`mp.tatter(d)`）。`enemy_build`（`read_frame`・`serialize_frame`）
- Produces:
  - `STATES: list[str]`・`ORDER_LEFT: list[str]`・`WEAPONLESS: list[str]`・`OUT: Path`
  - `build_layers(st: str) -> dict[str, Layer]`（7層、男女の差は手の位置 `FAR_HAND` だけ）
  - `compose_frame(st: str, weapon: bool = True) -> tuple[Frame, Frame]`（finish 済みの (絵, labels)）
  - CLI: 引数なしで書く、`--check [--dir DIR]` で書いてあるコマと合成し直しを比べる（差があれば終了コード 1）

- [ ] **Step 1: 素体の前提を確かめる（芯に `noarm` を使ってよいか）**

`noarm` の素体が、立ちの素体と奥の腕のところ（x≥19）しか違わないことを確かめる。scratchpad に次のスクリプトを書いて実行する:

```python
import sys
sys.path.insert(0, "tools"); sys.path.insert(0, "cand/gen")
import mkframes as mf
a, b = mf.body("base", "left", "female"), mf.body("noarm", "left", "female")
print(sorted((x, y) for y in range(32) for x in range(32) if a[y][x] != b[y][x]))
```

Expected: 差の座標がすべて x≥19 かつ y=15〜21 の範囲。**範囲の外に差があれば止めて依頼者に報告する**（芯の作り方を決め直す）

- [ ] **Step 2: `mklayers.py` を書く**

```python
"""槍の女性 a（spear-thug-a-f）の left 6コマを、層と重なり順の表で組む（試作、2026-10-09）。

設計: character-tactics の docs/superpowers/specs/2026-10-09-unit-layer-parts-design.md
使い方（pixel-asset-forge で）:
    .venv/bin/python cand/gen/mklayers.py                  # cand/layer-trial/spear-thug-a-f/ に書く
    .venv/bin/python cand/gen/mklayers.py --check          # 書いてあるコマが、表の順で合成し直した結果と同じか
    .venv/bin/python cand/gen/mklayers.py --check --dir D  # D のコマと比べる（検査が差を拾うかの確認用）
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, "tools")
sys.path.insert(0, str(Path(__file__).resolve().parent))
import enemy_build as eb  # noqa: E402
import mkweapons as mw  # noqa: E402
from layers import ADDED, Layer, attach, blank, compose, differences, finish, shifted  # noqa: E402

mf = mw.mf
EID = "spear-thug-a-f"
HAIR, EYE = "A", "E2"  # 素の髪のごろつき（目 E2・ぼろ）、長い髪 A、かぶり物なし
OUT = Path("cand/layer-trial") / EID
STATES = ["base", "idle2", "walk_a", "walk_b", "atk_wind", "atk_hit"]
# left の重なり順（奥→手前）。6コマとも同じ（設計書 3.3、2026-10-09 依頼者と合意。振りかぶりの拳も胴の後ろ）
ORDER_LEFT = ["武器", "奥の腕・拳", "長い髪（背中）", "芯", "長い髪（頭）", "かぶり物", "手前の腕・拳"]
WEAPONLESS = [n for n in ORDER_LEFT if n not in ("武器", "奥の腕・拳")]  # weapon_check --ref 用（武器を持たせる前）
CODES = {"武器": "W", "奥の腕・拳": "F", "長い髪（背中）": "B", "芯": "C", "長い髪（頭）": "H",
         "かぶり物": "K", "手前の腕・拳": "N", ADDED: "+"}
# 女性の素体の奥の手の位置（男性の座標の拳からのずれ）。手の位置は体の性質で、武器は拳の取り付け点に付く
# （今の mkweapons の FEMALE_SHIFT の left と同じ値。待機2は拳を2px上げる）
FAR_HAND = {"base": (-1, 0), "idle2": (-1, -2), "walk_a": (-1, 0), "walk_b": (-1, 0),
            "atk_wind": (-1, 0), "atk_hit": (1, 0)}
NEAR_BOX = (12, 19)  # left の手前の手: x≤12・y≥19（顔の肌を拾わない）


def patch_frame(patch):
    canvas = blank()
    mw.apply(canvas, patch)
    return canvas


def male_fist(st):
    """男性の座標の奥の拳。grip は拳の中で柄が通る点（今の mkweapons の配置と同じ所）。"""
    if st == "atk_wind":
        return Layer(patch_frame(mw.fist_h(18)), {"grip": (18, 17)})
    if st == "atk_hit":  # 体の向こうで握る（芯に隠れる。今の絵は拳を描いていない）
        return Layer(patch_frame(mw.fist_h(13)), {"grip": (13, 17)})
    return Layer(patch_frame(mw.FIST_FAR_L), {"grip": (21, 18)})  # 影の色、2px 幅


def male_spear(st):
    if st == "atk_wind":
        return Layer(patch_frame(mw.spear_horizontal(7, 30)), {"grip": (18, 17)})
    if st == "atk_hit":
        return Layer(patch_frame(mw.spear_hit_left), {"grip": (13, 17)})
    return Layer(patch_frame(mw.mirror(mw.spear_base_down, 30)), {"grip": (21, 18)})


def read(name):
    return eb.read_frame(Path(f"cand/enemy/{name}.txt"))


def near_hand(core):
    """芯から手前の手（肌と、それに接する輪郭）を写す。芯からは消さない（上に同じ画素が重なる）。"""
    x_max, y_min = NEAR_BOX
    skin = {(x, y) for y in range(y_min, 32) for x in range(x_max + 1) if core[y][x] in mw.HAND}
    cells = set(skin)
    for x, y in skin:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            qx, qy = x + dx, y + dy
            if 0 <= qx < 32 and 0 <= qy < 32 and core[qy][qx] == "outline":
                cells.add((qx, qy))
    f = blank()
    for x, y in cells:
        f[y][x] = core[y][x]
    return Layer(f)


def build_layers(st):
    base = mf.body("noarm", "left", "female")  # 奥の腕を外した女性の素体（6コマ共通）
    mf.mp.bodies["left"] = base  # 服の飾りは女性の素体に合わせる（mkframes と同じ）
    core = [row[:] for row in base]
    for part in (read(f"eye_{EYE}_left"), mf.mp.tatter("left")):
        mf.overlay(core, part)
    if st.startswith("walk"):  # 歩きは脚（y=28〜30）だけ差し替える（mkframes と同じ）
        w = eb.read_frame(Path(mf.WALK["female"].format(d="left", st=st)))
        for y in range(28, 31):
            core[y] = w[y][:]
    fist = shifted(male_fist(st), *FAR_HAND[st], "奥の腕・拳")
    return {
        "武器": attach(male_spear(st), fist, "grip", "武器"),
        "奥の腕・拳": fist,
        "長い髪（背中）": Layer(read(f"hair_{HAIR}_back_left")),
        "芯": Layer(core),
        "長い髪（頭）": Layer(read(f"hair_{HAIR}_left")),
        "かぶり物": Layer(blank()),
        "手前の腕・拳": near_hand(core),
    }


def compose_frame(st, weapon=True):
    layers = build_layers(st)
    order = ORDER_LEFT if weapon else WEAPONLESS
    frame, labels = compose({k: v for k, v in layers.items() if k in order}, order)
    return finish(frame, labels, mw.HAND, mw.ARM)


def write():
    (OUT / "noweapon").mkdir(parents=True, exist_ok=True)
    codes = {}
    for st in STATES:
        frame, labels = compose_frame(st)
        (OUT / f"left_{st}.txt").write_text(
            eb.serialize_frame(frame, f"{EID} left_{st}（層で組んだ試作）"), encoding="utf-8")
        (OUT / "noweapon" / f"left_{st}.txt").write_text(
            eb.serialize_frame(compose_frame(st, weapon=False)[0], f"{EID} left_{st} の武器を持たせる前（層で組んだ試作）"),
            encoding="utf-8")
        codes[f"left_{st}"] = ["".join(CODES[n] if n else "." for n in row) for row in labels]
    (OUT / "labels.json").write_text(json.dumps({"codes": CODES, "frames": codes}, ensure_ascii=False, indent=1),
                                     encoding="utf-8")
    print("ok", OUT)


def check(directory):
    fails = 0
    for st in STATES:
        path = directory / f"left_{st}.txt"
        if not path.is_file():
            print(f"FAIL {path}: ファイルが無い", file=sys.stderr)
            fails += 1
            continue
        diff = differences(compose_frame(st)[0], eb.read_frame(path))
        if diff:
            print(f"FAIL left_{st}: 表の順で合成し直した結果と違う画素 {' '.join(f'({x},{y})' for x, y in diff)}",
                  file=sys.stderr)
            fails += 1
    if fails:
        return 1
    print("重なり順: ok")
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--check", action="store_true")
    p.add_argument("--dir", type=Path, default=OUT)
    args = p.parse_args(argv)
    if args.check:
        return check(args.dir)
    write()
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: 書いて、合成し直しの検査を通す**

Run: `.venv/bin/python cand/gen/mklayers.py && .venv/bin/python cand/gen/mklayers.py --check`
Expected: `ok cand/layer-trial/spear-thug-a-f` のあと `重なり順: ok`（誤検出 0 件）

- [ ] **Step 4: 検査が差を拾うことを確かめる**

scratchpad に出力を写し、`left_idle2.txt` の拳の画素を1つ、別の色の文字に書き換えて `--check --dir <写し>` を実行する。
Expected: `FAIL left_idle2: 表の順で合成し直した結果と違う画素 (x,y)` で終了コード 1

- [ ] **Step 5: 道具だけコミット（生成したコマはまだコミットしない）**

```bash
git add pixel-asset-forge/cand/gen/mklayers.py
git commit -m "feat: 槍の女性 a の left を層と重なり順の表で組む mklayers.py を足す（試作）"
```

---

### Task 3: 比較ページ `layer_page.py`

**Files:**
- Create: `pixel-asset-forge/cand/gen/layer_page.py`
- 出力: `pixel-asset-forge/build/layer_trial.html`（build/ は git 管理外）

**Interfaces:**
- Consumes: Task 2 の `STATES`・`ORDER_LEFT`・`OUT`・`build_layers(st)`・`compose_frame(st)`。Task 1 の `ADDED`・`differences`
- Produces: `build/layer_trial.html`

- [ ] **Step 1: ページのスクリプトを書く**

```python
"""層で組んだ試作（槍の女性 a の left）を今の絵と並べ、層ごとに表示を切り替えるページ（2026-10-09）。

    .venv/bin/python cand/gen/layer_page.py build/layer_trial.html
"""
import base64
import io
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, "tools")
sys.path.insert(0, str(Path(__file__).resolve().parent))
import enemy_build as eb  # noqa: E402
import mklayers as ml  # noqa: E402
from gridfile import load_palette  # noqa: E402
from layers import ADDED, differences  # noqa: E402

pal = load_palette()
S = 8
BG = (225, 225, 225, 255)
CURRENT = Path("cand/enemy-frames") / ml.EID  # 今の絵（4aad550 で承認済み）
LOOP = ["base", "idle2", "base", "idle2", "walk_a", "base", "walk_b", "base", "atk_wind", "atk_hit"]


def png(frame, bg=BG, marks=()):
    im = Image.new("RGBA", (32, 32), bg)
    for y, row in enumerate(frame):
        for x, n in enumerate(row):
            if n:
                im.putpixel((x, y), tuple(pal[n][:3]) + (255,))
    im = im.resize((32 * S, 32 * S), Image.NEAREST)
    d = ImageDraw.Draw(im)
    for x, y in marks:
        d.rectangle([x * S, y * S, x * S + S - 1, y * S + S - 1], outline=(230, 0, 0), width=2)
    return im


def uri(im):
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def main(out):
    names = ml.ORDER_LEFT + [ADDED]
    html = ["<!doctype html><meta charset=utf-8><title>層で組んだ試作</title>",
            "<style>body{background:#bbb;font-family:sans-serif;max-width:1400px}"
            "figure{display:inline-block;margin:4px 10px 4px 4px;text-align:center;vertical-align:top}"
            "img{image-rendering:pixelated}.stack{position:relative;width:256px;height:256px;background:#e1e1e1}"
            ".stack img{position:absolute;left:0;top:0}label{margin-right:12px}</style>",
            "<h1>槍の女性 a の left: 今の絵と、層で組んだ試作</h1>",
            "<p>8倍。各状態は 左＝今の絵（4aad550）・中＝試作（赤い枠＝今の絵と変わった画素）・右＝試作を層で重ねたもの。"
            "右は下のチェックで層を消せる（手前の層を消すと、奥の層の隠れた部分が見える）。"
            "重なり順（奥→手前）: " + " → ".join(ml.ORDER_LEFT) + "。最後に手の輪郭を閉じた画素は「後から足した輪郭」。</p>",
            "<p>" + "".join(f"<label><input type=checkbox checked data-layer='{i}'>{n}</label>" for i, n in enumerate(names)) + "</p>",
            "<h2>再生（立ち・待機2・歩き・振りかぶり・当たり）</h2>"]
    cur, trial = {}, {}
    for st in ml.STATES:
        cur[st] = eb.read_frame(CURRENT / f"left_{st}.txt")
        trial[st] = ml.compose_frame(st)
    for label, frames in (("今の絵", {st: uri(png(cur[st])) for st in ml.STATES}),
                          ("試作", {st: uri(png(trial[st][0])) for st in ml.STATES})):
        html.append(f"<figure><img class=anim data-frames='{'|'.join(frames[s] for s in LOOP)}' src='{frames['base']}'>"
                    f"<figcaption>{label}</figcaption></figure>")
    for st in ml.STATES:
        frame, labels = trial[st]
        layers = ml.build_layers(st)
        stack = []
        for i, n in enumerate(names):
            if n == ADDED:
                f = [[frame[y][x] if labels[y][x] == ADDED else None for x in range(32)] for y in range(32)]
            else:
                f = layers[n].frame
            stack.append(f"<img data-layer='{i}' src='{uri(png(f, bg=(0, 0, 0, 0)))}'>")
        html.append(f"<h2>left_{st}</h2>")
        html.append(f"<figure><img src='{uri(png(cur[st]))}'><figcaption>今の絵</figcaption></figure>")
        html.append(f"<figure><img src='{uri(png(frame, marks=differences(cur[st], frame)))}'>"
                    f"<figcaption>試作（変わった画素 {len(differences(cur[st], frame))}）</figcaption></figure>")
        html.append(f"<figure><div class=stack>{''.join(stack)}</div><figcaption>層で重ねたもの</figcaption></figure>")
    html.append("<script>document.querySelectorAll('input[data-layer]').forEach(c=>c.onchange=()=>"
                "document.querySelectorAll(`.stack img[data-layer='${c.dataset.layer}']`).forEach(i=>i.style.display=c.checked?'':'none'));"
                "let t=0;setInterval(()=>{t++;document.querySelectorAll('img.anim').forEach(i=>{const f=i.dataset.frames.split('|');i.src=f[t%f.length]})},500)</script>")
    Path(out).write_text("\n".join(html), encoding="utf-8")
    print("ok", out)


if __name__ == "__main__":
    main(sys.argv[1])
```

- [ ] **Step 2: ページを作り、ヘッドレスブラウザで撮って崩れていないか確かめる**

Run: `.venv/bin/python cand/gen/layer_page.py build/layer_trial.html`
撮影: `~/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell --no-sandbox --screenshot=<scratchpad>/layer_trial.png --window-size=1400,2000 file://$PWD/build/layer_trial.html`
Expected: 6状態ぶん3枚ずつ並び、層で重ねた絵が試作と同じに見える

- [ ] **Step 3: 道具をコミット**

```bash
git add pixel-asset-forge/cand/gen/layer_page.py
git commit -m "feat: 層で組んだ試作を今の絵と並べる layer_page.py を足す（試作）"
```

---

### Task 4: 検査と自分の目での確認、依頼者に見せて止まる

**Files:** なし（実行と確認だけ）

- [ ] **Step 1: weapon_check を、試作と今の絵の両方に同じ指定で掛ける**

```sh
C="--blade stone_hi,stone_base --weapon wood_base,wood_shadow --hand skin_rose_hi,skin_rose_base,skin_rose_shadow --arm cloak_dark_hi,cloak_dark_base,cloak_dark_shadow"
F="--far left --cover hair_slate_hi,hair_slate_base,hair_slate_shadow --far-shade skin_rose_shadow"
.venv/bin/python tools/weapon_check.py cand/layer-trial/spear-thug-a-f $C --ref cand/layer-trial/spear-thug-a-f/noweapon $F --hidden left_atk_hit,left_atk_wind
.venv/bin/python tools/weapon_check.py cand/enemy-frames/spear-thug-a-f $C --ref cand/enemy-frames/spear-thug-a-f/noweapon $F --hidden left_atk_hit,left_atk_wind 2>&1 | grep "left"
```

Expected: 「奥の手が手前に出ている」系の失敗は試作で 0 件。
正しい重なり順のせいで拳や槍が髪に隠れ、「手が無い」「手が細い」「武器が見えない」などで落ちるコマが出てもよい。
**落ちたコマは `--hidden` に足して通さず、そのまま一覧にして依頼者に見せる**（見えにくくなるときは勝手にずらさず聞く、2026-10-09 の方針）

- [ ] **Step 2: 自分の目で確かめる（SPEC の自己チェック②）**

撮った PNG を開き、各コマで次を確かめてメモにする:
奥の拳と槍が髪（背中）と胴の後ろに入っているか／手前の手が今の絵と同じか／槍の握る位置が拳の真ん中か／
奥の部品が髪や体の上に出ていないか／今の絵と変わった画素がどこか（重なり順で説明できない変化があれば原因を調べる）

- [ ] **Step 3: 全体のテスト**

Run: `.venv/bin/python -m unittest discover -s tests`
Expected: OK（今の 341 件 ＋ Task 1 の 10 件）

- [ ] **Step 4: 台帳に書いて、依頼者に見せて止まる**

台帳（`.superpowers/sdd/2026-10-06-enemy-variants/progress.md`）に結果を1〜3行で書く。
依頼者に `pixel-asset-forge/build/layer_trial.html` のパスと、weapon_check の結果（試作と今の絵の差）、変わった画素の説明を渡す。
**承認を得るまでコミットしない・次へ進まない**

---

### Task 5: 承認後の後片付け（依頼者の承認の後だけ）

**Files:**
- Commit: `pixel-asset-forge/cand/layer-trial/spear-thug-a-f/`
- Create: `docs/superpowers/specs/2026-10-09-unit-layer-parts-results.md`

- [ ] **Step 1: 結果を書く**

`docs/superpowers/specs/2026-10-09-unit-layer-parts-results.md` に、成功の条件（設計書 2.）の3項目それぞれが満たせたか、
weapon_check の結果、変わった画素、依頼者の判断、採用するかの判断材料（よかった点・残った手作業）を書く

- [ ] **Step 2: コミット**

```bash
git add pixel-asset-forge/cand/layer-trial/spear-thug-a-f docs/superpowers/specs/2026-10-09-unit-layer-parts-results.md
git commit -m "feat: 槍の女性 a の left を層で組んだ試作のコマと結果を残す"
```

- [ ] **Step 3: 採用するか（パーツ方式を広げるか）を依頼者に聞く**
