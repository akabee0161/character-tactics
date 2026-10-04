#!/usr/bin/env python3
"""unit の部品の案を組み合わせて選ぶページを書き出す。

    tools/unit_picker.py PICKER.json --out build/picker/gau.html

髪・かぶり物・武器などの部品を一括で案を作ったとき、依頼者が組み合わせを頭の中で試さずに
選べるようにするページ（必須。types/unit/SPEC.md の「描く手順」の CP1）。
組み合わせは全部ここで tools/compose.py の compose_frame で組み立てておき、ページは並べて見せるだけ。
ページでは4方向を同時に、8倍とゲームの大きさ（等倍・2倍）で見せ、部品だけの絵、
見本のユニット（refs）との比較、全部の組み合わせの一覧を出す。選んだ組み合わせは記号（例 H1-R2-D3）で返してもらう。

設定ファイルの形（パスは --root（既定は forge の直下）からの相対。`{dir}` は向きに置き換わる）:

    {
      "unit": "gau",
      "title": "ガウの部品の組み合わせ",
      "body": "types/unit/base/male_{dir}.txt",
      "directions": ["down", "up", "left", "right"],          # 省略時はこの4つ
      "elements": {                                            # 書いた順に重ね、この順で記号に並べる
        "head": {"label": "頭", "variants": {
          "H1": {"label": "丸い頭巾", "layers": [{"part": "cand/hood_A_{dir}.txt", "z": "front"}]}}},
        "dagger": {"label": "短剣", "variants": {
          "D1": {"label": "4px", "layers": [{"part": "cand/dagger_A_{dir}.txt", "z": {"left": "back"}}]}}}
      },
      "default": {"head": "H1", "dagger": "D1"},               # 省略時は各要素の最初の案
      "matrix": {"rows": "head", "cols": "dagger"},            # 一覧の表の行と列（省略時は最初の2要素）
      "refs": {"ロラン": "assets/unit/roran/{dir}_base.txt"}  # 並べて比べる見本（任意）
    }

`z` は compose.py と同じ（front は上に描く、back は透明な画素にだけ描く）。向きごとに変えるときは
{"left": "back"} のように書き、書かなかった向きは front。案の記号は要素をまたいで重ならないようにする。
"""
from __future__ import annotations

import argparse
import itertools
import json
import sys
from dataclasses import dataclass, field
from html import escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from compose import ComposeError, Layer, compose_frame  # noqa: E402
from gridfile import BACKGROUND, REPO_ROOT, GridError, load_palette, parse  # noqa: E402

DIRECTIONS = ["down", "up", "left", "right"]
Z_ORDERS = ("front", "back")
MAX_COMBINATIONS = 512
ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!#$%&*+-=?@^_~"
TEMPLATE = Path(__file__).resolve().parent / "unit_picker.html"

CONFIG_KEYS = {"unit", "title", "body", "directions", "elements", "default", "matrix", "refs"}
ELEMENT_KEYS = {"label", "variants"}
VARIANT_KEYS = {"label", "layers"}
LAYER_KEYS = {"part", "z"}


class PickerError(Exception):
    """設定や部品が、組み合わせを作る前提に合わない。"""


@dataclass
class PartLayer:
    part: str          # `{dir}` を含んでよいパス
    z: dict[str, str]  # 向き -> front / back（無い向きは front）

    def z_for(self, direction: str) -> str:
        return self.z.get(direction, "front")


@dataclass
class Variant:
    label: str
    layers: list[PartLayer]


@dataclass
class Element:
    label: str
    variants: dict[str, Variant]


@dataclass
class Picker:
    unit: str
    title: str
    root: Path
    body: str
    directions: list[str]
    elements: dict[str, Element]
    default: dict[str, str]
    matrix: dict[str, str] = field(default_factory=dict)
    refs: dict[str, str] = field(default_factory=dict)

    def path(self, template: str, direction: str) -> Path:
        return self.root / template.replace("{dir}", direction)


def _keys(data, allowed: set[str], where: str) -> None:
    if not isinstance(data, dict):
        raise PickerError(f"{where}: オブジェクトでない")
    unknown = sorted(set(data) - allowed)
    if unknown:
        raise PickerError(f"{where}: 知らないキー {', '.join(unknown)}（使えるのは {', '.join(sorted(allowed))}）")


def _string(value, where: str) -> str:
    if not isinstance(value, str) or not value:
        raise PickerError(f"{where}: 文字列でない")
    return value


def _layer(data, where: str, directions: list[str]) -> PartLayer:
    _keys(data, LAYER_KEYS, where)
    part = _string(data.get("part"), f"{where} の part")
    z = data.get("z", "front")
    by_direction = {d: z for d in directions} if isinstance(z, str) else z
    if not isinstance(by_direction, dict):
        raise PickerError(f"{where}: z は front・back か、向きごとの指定")
    for d, value in by_direction.items():
        if d not in directions:
            raise PickerError(f"{where}: z に知らない向き {d!r}")
        if value not in Z_ORDERS:
            raise PickerError(f"{where}: z は front か back（{value!r} だった）")
    return PartLayer(part, dict(by_direction))


def load_picker(path: Path, root: Path = REPO_ROOT) -> Picker:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise PickerError(f"{path}: 読めない: {exc}") from None
    except json.JSONDecodeError as exc:
        raise PickerError(f"{path}: JSON として読めない: {exc}") from None

    _keys(data, CONFIG_KEYS, path.name)
    unit = _string(data.get("unit"), "unit")
    body = _string(data.get("body"), "body")
    directions = data.get("directions", DIRECTIONS)
    if not isinstance(directions, list) or not directions or any(d not in DIRECTIONS for d in directions):
        raise PickerError(f"directions は {', '.join(DIRECTIONS)} から選ぶ")

    elements_data = data.get("elements")
    if not isinstance(elements_data, dict) or not elements_data:
        raise PickerError("elements が無いか空")
    elements: dict[str, Element] = {}
    owner: dict[str, str] = {}
    for key, el in elements_data.items():
        where = f"elements の {key}"
        _keys(el, ELEMENT_KEYS, where)
        variants_data = el.get("variants")
        if not isinstance(variants_data, dict) or not variants_data:
            raise PickerError(f"{where}: variants が無いか空")
        variants = {}
        for vid, v in variants_data.items():
            vwhere = f"{where} の {vid}"
            if vid in owner:
                raise PickerError(f"{vwhere}: 案の記号 {vid!r} が {owner[vid]} と重なる")
            owner[vid] = key
            _keys(v, VARIANT_KEYS, vwhere)
            layers = v.get("layers", [])
            if not isinstance(layers, list):
                raise PickerError(f"{vwhere}: layers が配列でない")
            variants[vid] = Variant(str(v.get("label", "")),
                                    [_layer(layer, f"{vwhere} の layers[{i}]", directions)
                                     for i, layer in enumerate(layers)])
        elements[key] = Element(str(el.get("label", key)), variants)

    default = {key: next(iter(el.variants)) for key, el in elements.items()}
    given = data.get("default", {})
    _keys(given, set(elements), "default")
    for key, vid in given.items():
        if vid not in elements[key].variants:
            raise PickerError(f"default の {key}: 案 {vid!r} が無い")
        default[key] = vid

    keys = list(elements)
    matrix = data.get("matrix", {"rows": keys[0], "cols": keys[1]} if len(keys) > 1 else {})
    _keys(matrix, {"rows", "cols"}, "matrix")
    if matrix and set(matrix) != {"rows", "cols"}:
        raise PickerError("matrix には rows と cols の両方を書く")
    for role, key in matrix.items():
        if key not in elements:
            raise PickerError(f"matrix の {role}: 要素 {key!r} が無い")
    if matrix and matrix["rows"] == matrix["cols"]:
        raise PickerError(f"matrix の rows と cols が同じ要素 {matrix['rows']!r}（別々の要素にする）")

    refs = data.get("refs", {})
    _keys(refs, set(refs), "refs")
    return Picker(unit, str(data.get("title", f"{unit} の部品の組み合わせ")), root, body, list(directions),
                  elements, default, dict(matrix), {k: _string(v, f"refs の {k}") for k, v in refs.items()})


def combinations(picker: Picker) -> list[dict[str, str]]:
    keys = list(picker.elements)
    total = 1
    for el in picker.elements.values():
        total *= len(el.variants)
    if total > MAX_COMBINATIONS:
        raise PickerError(f"組み合わせが {total} 通りあり、{MAX_COMBINATIONS} を超える。案を絞ってから作る")
    return [dict(zip(keys, ids)) for ids in itertools.product(*(el.variants for el in picker.elements.values()))]


def code_of(pick: dict[str, str]) -> str:
    return "-".join(pick.values())


class _Encoder:
    """画素を、色の一覧の番号の文字にする（`.` は透明）。"""

    def __init__(self) -> None:
        self.palette = load_palette()
        self.colours: list[str] = []

    def encode(self, rows: list[str], charmap: dict[str, str]) -> str:
        out = []
        for row in rows:
            for ch in row:
                if ch == BACKGROUND:
                    out.append(".")
                    continue
                name = charmap.get(ch)
                if name not in self.palette:
                    raise PickerError(f"文字 {ch!r} の色 {name!r} がパレットに無い")
                hexcode = "#{:02x}{:02x}{:02x}".format(*self.palette[name])
                if hexcode not in self.colours:
                    if len(self.colours) == len(ALPHABET):
                        raise PickerError(f"色が {len(ALPHABET)} を超える")
                    self.colours.append(hexcode)
                out.append(ALPHABET[self.colours.index(hexcode)])
        return "".join(out)


def build_data(picker: Picker) -> dict:
    picks = combinations(picker)
    enc = _Encoder()
    grids: dict[Path, object] = {}

    def grid(path: Path):
        if path not in grids:
            try:
                grids[path] = parse(path)
            except GridError as exc:
                raise PickerError(str(exc)) from None
        return grids[path]

    frames, parts, refs = {}, {}, {}
    for d in picker.directions:
        body = grid(picker.path(picker.body, d))
        for pick in picks:
            layers = [(grid(picker.path(layer.part, d)), Layer(picker.path(layer.part, d), layer.z_for(d)))
                      for key, vid in pick.items()
                      for layer in picker.elements[key].variants[vid].layers]
            try:
                rows, groups = compose_frame(body, layers)
            except ComposeError as exc:
                raise PickerError(f"{code_of(pick)} の {d}: {exc}") from None
            frames[f"{code_of(pick)}|{d}"] = enc.encode(rows, {ch: c for g in groups for ch, c in g})
        for el in picker.elements.values():
            for vid, variant in el.variants.items():
                canvas = [[BACKGROUND] * body.width for _ in range(body.height)]
                charmap: dict[str, str] = {}
                for layer in variant.layers:
                    part = grid(picker.path(layer.part, d))
                    charmap.update(part.charmap)
                    for y, row in enumerate(part.rows):
                        for x, ch in enumerate(row):
                            if ch != BACKGROUND:
                                canvas[y][x] = ch
                parts[f"{vid}|{d}"] = enc.encode(["".join(r) for r in canvas], charmap)
        for name, template in picker.refs.items():
            ref = grid(picker.path(template, d))
            refs[f"{name}|{d}"] = enc.encode(ref.rows, ref.charmap)

    return {
        "unit": picker.unit,
        "size": [32, 32],
        "directions": picker.directions,
        "elements": {key: {"label": el.label, "variants": {vid: v.label for vid, v in el.variants.items()}}
                     for key, el in picker.elements.items()},
        "default": picker.default,
        "matrix": picker.matrix,
        "alphabet": ALPHABET,
        "colours": enc.colours,
        "frames": frames,
        "parts": parts,
        "refs": refs,
        "grass": "#{:02x}{:02x}{:02x}".format(*enc.palette["grass_base"]),
    }


def write_html(picker: Picker, out: Path) -> Path:
    data = json.dumps(build_data(picker), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    page = TEMPLATE.read_text(encoding="utf-8").replace("__TITLE__", escape(picker.title)).replace("__DATA__", data)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("config", type=Path, help="組み合わせの設定ファイル（JSON）")
    parser.add_argument("--out", type=Path, required=True, help="書き出すページ（.html）")
    parser.add_argument("--root", type=Path, default=REPO_ROOT, help="設定の中のパスの基準（既定は forge の直下）")
    args = parser.parse_args(argv)
    try:
        picker = load_picker(args.config, args.root)
        count = len(combinations(picker))
        out = write_html(picker, args.out)
    except PickerError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    print(f"{out}（{count} 通り × {len(picker.directions)} 方向）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
