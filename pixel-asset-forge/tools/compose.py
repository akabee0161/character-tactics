#!/usr/bin/env python3
"""素体と部品（髪・かぶり物・武器）を重ねて、unit のコマを組み立てる。

    tools/compose.py compose/gau.json                     # assets/unit/gau/ に書く（手で直したコマがあれば止まる）
    tools/compose.py compose/gau.json --frames down_base --out /tmp/cand
    tools/compose.py compose/gau.json --check             # 書いてあるコマと同じか

部品は素体抜きで描いた 32x32 の unit グリッド（ユニットだけの部品は assets/unit/<ユニット>/parts/、
使い回す武器は assets/part/）。どこが隠れてどこが見えるかは、部品ごとの前後で決める:

- front: 部品の透明でない画素をすべて上に描く
- back : その時点で透明な画素にだけ描く（体や、先に描いた部品に隠れる）

部品には次も書ける（2026-10-10 依頼者と決めた。部品は完全な形で描き、重ねるだけで組む）:

- "keep": ["wood_base", ...] この部品の輪郭（outline）の画素は、すぐ下の画素が keep の色なら、そちらを見せる。
  拳の輪郭を、握る柄の上には描かないために使う（柄が拳の上下で途切れるため。2026-10-09 依頼者が選択）。
  拳の肌や袖は柄の下に潜らせない。見るのは「その画素のすぐ下の1枚」だけ（間に別の部品が挟まると効かない）
- "hand": true 拳の部品。組み立てる前に、手の色（設定の最上位の "hand_colours": ["skin_rose_hi", ...]）の画素が
  四方とも輪郭で囲われているかを確かめ、閉じていなければ1枚も書かずに止まる

重なりは、奥→手前の積み上げで決める（stack_order）。素体の上に front は手前へ、back は一番奥へ積む。

部品は設定ファイルに書いた順に重ねる。部品が自分の輪郭を持っていれば、体に接するところも輪郭で閉じる。
設定ファイルの形は docs/superpowers/specs/2026-10-04-unit-drawing-workflow-design.md と
types/unit/SPEC.md の「描く手順」を参照。パスは forge の直下からの相対。

組み立てたコマを手で直したら、`--check` は差ありと出る。手で直したコマ（組み立て結果と違うコマ）があると、
1枚も書かずに止まる。上書きしてよいときだけ `--force` を付ける。
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import BACKGROUND, REPO_ROOT, Grid, GridError, parse  # noqa: E402

Z_ORDERS = ("front", "back")
CONFIG_KEYS = {"unit", "frames", "hand_colours"}
FRAME_KEYS = {"body", "layers"}
LAYER_KEYS = {"part", "z", "dx", "dy", "keep", "hand"}
COPIED_HEADERS = ("type", "size", "light", "bg")


class ComposeError(Exception):
    """設定や部品が組み立ての前提に合わない。"""


@dataclass
class Layer:
    part: Path
    z: str
    dx: int = 0
    dy: int = 0
    keep: frozenset[str] = frozenset()
    hand: bool = False


@dataclass
class FrameSpec:
    body: Path
    layers: list[Layer] = field(default_factory=list)
    hand_colours: frozenset[str] = frozenset()


def _int(value, where: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ComposeError(f"{where}: 整数でない: {value!r}")
    return value


def _keys(data, allowed: set[str], where: str) -> None:
    if not isinstance(data, dict):
        raise ComposeError(f"{where}: オブジェクトでない")
    unknown = sorted(set(data) - allowed)
    if unknown:
        raise ComposeError(f"{where}: 知らないキー {', '.join(unknown)}（使えるのは {', '.join(sorted(allowed))}）")


def load_config(path: Path, root: Path = REPO_ROOT) -> tuple[str, dict[str, FrameSpec]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise ComposeError(f"{path}: 読めない: {exc}") from None
    except json.JSONDecodeError as exc:
        raise ComposeError(f"{path}: JSON として読めない: {exc}") from None

    _keys(data, CONFIG_KEYS, str(path))
    unit = data.get("unit")
    if not isinstance(unit, str) or not unit:
        raise ComposeError(f"{path}: unit（ユニット名）が無い")
    frames_data = data.get("frames")
    if not isinstance(frames_data, dict) or not frames_data:
        raise ComposeError(f"{path}: frames が無いか空")

    hand_data = data.get("hand_colours", [])
    if not isinstance(hand_data, list) or not all(isinstance(c, str) for c in hand_data):
        raise ComposeError(f"{path}: hand_colours は色名の配列でなければならない: {hand_data!r}")
    hand_colours = frozenset(hand_data)

    frames: dict[str, FrameSpec] = {}
    for name, spec in frames_data.items():
        where = f"{path.name} の {name}"
        _keys(spec, FRAME_KEYS, where)
        if not isinstance(spec.get("body"), str):
            raise ComposeError(f"{where}: body（素体のパス）が無い")
        layers_data = spec.get("layers", [])
        if not isinstance(layers_data, list):
            raise ComposeError(f"{where}: layers が配列でない")
        layers = []
        for i, layer in enumerate(layers_data):
            lwhere = f"{where} の layers[{i}]"
            _keys(layer, LAYER_KEYS, lwhere)
            if not isinstance(layer.get("part"), str):
                raise ComposeError(f"{lwhere}: part（部品のパス）が無い")
            z = layer.get("z")
            if z not in Z_ORDERS:
                raise ComposeError(f"{lwhere}: z は front か back（{z!r} だった）")
            keep = layer.get("keep", [])
            if not isinstance(keep, list) or not all(isinstance(c, str) for c in keep):
                raise ComposeError(f"{lwhere}: keep は色名の配列でなければならない: {keep!r}")
            hand = layer.get("hand", False)
            if not isinstance(hand, bool):
                raise ComposeError(f"{lwhere}: hand は true か false: {hand!r}")
            if hand and not hand_colours:
                raise ComposeError(f"{lwhere}: hand の部品があるのに、設定の最上位に hand_colours（手の肌の色名）が無い")
            layers.append(Layer(root / layer["part"], z, _int(layer.get("dx", 0), lwhere),
                                _int(layer.get("dy", 0), lwhere), frozenset(keep), hand))
        frames[name] = FrameSpec(root / spec["body"], layers, hand_colours)
    return unit, frames


def stack_order(layers: list[Layer]) -> list[int]:
    """奥→手前の並び（素体は -1）。front はその時点の一番手前に、back はその時点の一番奥に置く
    （back は「その時点で透明な画素にだけ描く」なので、先に描いたすべての後ろに入る）。"""
    order = [-1]
    for i, layer in enumerate(layers):
        if layer.z == "front":
            order.append(i)
        else:
            order.insert(0, i)
    return order


def _compose(body: Grid, layers: list[tuple[Grid, Layer]]):
    """(rows, groups, labels)。部品ごとにずらした面を作り、手前から見て最初の透明でない文字を取る。"""
    charmap = dict(body.charmap)
    groups: list[list[tuple[str, str]]] = [list(body.charmap.items())]
    planes: dict[int, tuple[str, dict[tuple[int, int], str]]] = {
        -1: (body.path.name, {(x, y): ch for y, row in enumerate(body.rows) for x, ch in enumerate(row)
                              if ch != BACKGROUND})}

    for i, (part, layer) in enumerate(layers):
        name = part.path.name
        if (part.width, part.height) != (body.width, body.height):
            raise ComposeError(
                f"{name}: 大きさ {part.width}x{part.height} が素体 {body.width}x{body.height} と違う"
            )
        added = []
        for ch, colour in part.charmap.items():
            if ch not in charmap:
                charmap[ch] = colour
                added.append((ch, colour))
            elif charmap[ch] != colour:
                raise ComposeError(f"{name}: 文字 {ch!r} が先に {charmap[ch]}、この部品では {colour} に割り当てられている")
        groups.append(added)

        plane = {}
        for y, row in enumerate(part.rows):
            for x, ch in enumerate(row):
                if ch == BACKGROUND:
                    continue
                nx, ny = x + layer.dx, y + layer.dy
                if not (0 <= nx < body.width and 0 <= ny < body.height):
                    raise ComposeError(f"{name}: ({x},{y}) をずらすと ({nx},{ny}) でコマの外に出る")
                plane[(nx, ny)] = ch
        planes[i] = (name, plane)

    canvas = [[BACKGROUND] * body.width for _ in range(body.height)]
    labels: list[list[str | None]] = [[None] * body.width for _ in range(body.height)]
    stacks: dict[tuple[int, int], list[tuple[int, str]]] = {}  # 画素 → 手前から (部品の番号, 文字)
    for index in reversed(stack_order([layer for _, layer in layers])):
        for pos, ch in planes[index][1].items():
            stacks.setdefault(pos, []).append((index, ch))
    for (x, y), stack in stacks.items():
        pick = 0
        index, ch = stack[0]
        # keep: この部品の輪郭は、すぐ下が keep の色（握る武器）ならそちらを見せる
        if index >= 0 and layers[index][1].keep and charmap[ch] == "outline" and len(stack) > 1 \
                and charmap[stack[1][1]] in layers[index][1].keep:
            pick = 1
        index, ch = stack[pick]
        canvas[y][x] = ch
        labels[y][x] = planes[index][0]

    rows = ["".join(row) for row in canvas]
    used = {ch for row in rows for ch in row} - {BACKGROUND}
    kept = [[(ch, colour) for ch, colour in group if ch in used] for group in groups]
    return rows, [group for group in kept if group], labels


def compose_frame(body: Grid, layers: list[tuple[Grid, Layer]]) -> tuple[list[str], list[list[tuple[str, str]]]]:
    rows, groups, _ = _compose(body, layers)
    return rows, groups


def compose_labels(body: Grid, layers: list[tuple[Grid, Layer]]) -> list[list[str | None]]:
    """画素ごとに、見えている部品のファイル名（素体は素体のファイル名、透明は None）。"""
    return _compose(body, layers)[2]


def open_hand_pixels(part: Grid, hand_colours: set[str] | frozenset[str]) -> list[tuple[int, int]]:
    """拳の部品で、手の色の画素のうち、上下左右の隣が手の色・outline 以外（透明・袖など）か、コマの外であるもの
    （部品の座標。ずらす前）。拳は四方とも輪郭で囲う（2026-10-10 依頼者と決めた）。"""
    def colour(x: int, y: int) -> str | None:
        if not (0 <= x < part.width and 0 <= y < part.height):
            return None
        return part.charmap.get(part.rows[y][x])

    found = []
    for y in range(part.height):
        for x in range(part.width):
            if colour(x, y) not in hand_colours:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                near = colour(x + dx, y + dy)
                if near not in hand_colours and near != "outline":
                    found.append((x, y))
                    break
    return found


def render_text(body: Grid, rows: list[str], groups: list[list[tuple[str, str]]], note: str) -> str:
    if ":" in note:
        raise ComposeError(f"注記に半角コロンは書けない（ヘッダと読まれる）: {note!r}")
    lines = [f"# {note}"]
    lines += [f"# {key}: {body.headers[key]}" for key in COPIED_HEADERS if key in body.headers]
    lines += ["# map: " + " ".join(f"{ch}={colour}" for ch, colour in group) for group in groups]
    lines += rows
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("config", type=Path, help="compose/<ユニット>.json")
    parser.add_argument("--frames", nargs="+", help="組み立てるコマ（省略時はすべて）")
    parser.add_argument("--out", type=Path, help="書き出し先（省略時は assets/unit/<ユニット>/）")
    parser.add_argument("--check", action="store_true", help="書かずに、書いてあるコマと同じかだけ確かめる")
    parser.add_argument("--force", action="store_true", help="手で直したコマ（組み立て結果と違うコマ）も上書きする")
    args = parser.parse_args(argv)

    try:
        unit, frames = load_config(args.config)
        names = args.frames or list(frames)
        unknown = [name for name in names if name not in frames]
        if unknown:
            raise ComposeError(f"{args.config.name} に無いコマ: {', '.join(unknown)}")
        out = args.out or REPO_ROOT / "assets" / "unit" / unit
        checked = set()
        for name in names:  # 拳の部品が閉じているか（組み立てる前に確かめる）
            for layer in frames[name].layers:
                if layer.hand and layer.part not in checked:
                    checked.add(layer.part)
                    gaps = open_hand_pixels(parse(layer.part), frames[name].hand_colours)
                    if gaps:
                        raise ComposeError(f"{layer.part.name}: 拳が四方とも輪郭で閉じていない: "
                                           + " ".join(f"({x},{y})" for x, y in gaps))
        differ = 0
        texts = {}
        for name in names:
            spec = frames[name]
            body = parse(spec.body)
            parts = [(parse(layer.part), layer) for layer in spec.layers]
            rows, groups = compose_frame(body, parts)
            texts[name] = render_text(body, rows, groups, f"{args.config.name} の {name} から compose.py で組み立てた")
        changed = []
        for name, text in texts.items():
            target = out / f"{name}.txt"
            current = target.read_text(encoding="utf-8") if target.exists() else None
            if args.check:
                if current != text:
                    print(f"差あり {name}（{target}）")
                    differ += 1
            elif current is not None and current != text:
                changed.append(name)
        if changed and not args.force:
            # 組み立てた後に手で直したコマを黙って上書きしない（1枚も書かずに止める）
            raise ComposeError(f"{out} の {', '.join(changed)} は組み立て結果と違う（手で直したコマかもしれない）。"
                               "上書きするなら --force、確かめるだけなら --check、案を作るなら --out で別の場所へ")
        if not args.check:
            for name, text in texts.items():
                target = out / f"{name}.txt"
                out.mkdir(parents=True, exist_ok=True)
                target.write_text(text, encoding="utf-8")
                print(f"書いた {target}")
    except (ComposeError, GridError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 1 if differ else 0


if __name__ == "__main__":
    raise SystemExit(main())
