#!/usr/bin/env python3
"""素体と部品（髪・かぶり物・武器）を重ねて、unit のコマを組み立てる。

    tools/compose.py compose/gau.json                     # assets/unit/gau/ に書く
    tools/compose.py compose/gau.json --frames down_base --out /tmp/cand
    tools/compose.py compose/gau.json --check             # 書いてあるコマと同じか

部品は素体抜きで描いた 32x32 の unit グリッド（ユニットだけの部品は assets/unit/<ユニット>/parts/、
使い回す武器は assets/part/）。どこが隠れてどこが見えるかは、部品ごとの前後で決める:

- front: 部品の透明でない画素をすべて上に描く
- back : その時点で透明な画素にだけ描く（体や、先に描いた部品に隠れる）

部品は設定ファイルに書いた順に重ねる。部品が自分の輪郭を持っていれば、体に接するところも輪郭で閉じる。
設定ファイルの形は docs/superpowers/specs/2026-10-04-unit-drawing-workflow-design.md と
types/unit/SPEC.md の「描く手順」を参照。パスは forge の直下からの相対。

組み立てたコマを手で直したら、`--check` は差ありと出る。直したコマは組み立て直さない（上書きされる）。
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
CONFIG_KEYS = {"unit", "frames"}
FRAME_KEYS = {"body", "layers"}
LAYER_KEYS = {"part", "z", "dx", "dy"}
COPIED_HEADERS = ("type", "size", "light", "bg")


class ComposeError(Exception):
    """設定や部品が組み立ての前提に合わない。"""


@dataclass
class Layer:
    part: Path
    z: str
    dx: int = 0
    dy: int = 0


@dataclass
class FrameSpec:
    body: Path
    layers: list[Layer] = field(default_factory=list)


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
            layers.append(Layer(root / layer["part"], z,
                                _int(layer.get("dx", 0), lwhere), _int(layer.get("dy", 0), lwhere)))
        frames[name] = FrameSpec(root / spec["body"], layers)
    return unit, frames


def compose_frame(body: Grid, layers: list[tuple[Grid, Layer]]) -> tuple[list[str], list[list[tuple[str, str]]]]:
    canvas = [list(row) for row in body.rows]
    charmap = dict(body.charmap)
    groups: list[list[tuple[str, str]]] = [list(body.charmap.items())]

    for part, layer in layers:
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

        for y, row in enumerate(part.rows):
            for x, ch in enumerate(row):
                if ch == BACKGROUND:
                    continue
                nx, ny = x + layer.dx, y + layer.dy
                if not (0 <= nx < body.width and 0 <= ny < body.height):
                    raise ComposeError(f"{name}: ({x},{y}) をずらすと ({nx},{ny}) でコマの外に出る")
                if layer.z == "front" or canvas[ny][nx] == BACKGROUND:
                    canvas[ny][nx] = ch

    rows = ["".join(row) for row in canvas]
    used = {ch for row in rows for ch in row} - {BACKGROUND}
    kept = [[(ch, colour) for ch, colour in group if ch in used] for group in groups]
    return rows, [group for group in kept if group]


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
    args = parser.parse_args(argv)

    try:
        unit, frames = load_config(args.config)
        names = args.frames or list(frames)
        unknown = [name for name in names if name not in frames]
        if unknown:
            raise ComposeError(f"{args.config.name} に無いコマ: {', '.join(unknown)}")
        out = args.out or REPO_ROOT / "assets" / "unit" / unit
        differ = 0
        for name in names:
            spec = frames[name]
            body = parse(spec.body)
            parts = [(parse(layer.part), layer) for layer in spec.layers]
            rows, groups = compose_frame(body, parts)
            text = render_text(body, rows, groups, f"{args.config.name} の {name} から compose.py で組み立てた")
            target = out / f"{name}.txt"
            if args.check:
                current = target.read_text(encoding="utf-8") if target.exists() else None
                if current != text:
                    print(f"差あり {name}（{target}）")
                    differ += 1
            else:
                out.mkdir(parents=True, exist_ok=True)
                target.write_text(text, encoding="utf-8")
                print(f"書いた {target}")
    except (ComposeError, GridError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 1 if differ else 0


if __name__ == "__main__":
    raise SystemExit(main())
