#!/usr/bin/env python3
"""Lay tiles out next to each other, because one tile on its own hides things.

    tools/tilemap.py                          # every tile asset, repeated 3x3
    tools/tilemap.py --repeat river_v --grid 4x4
    tools/tilemap.py --layout layouts/example.txt

A layout file is whitespace-separated tile names, one map row per line. `.`
leaves a cell empty. Lines starting with `#` are comments.

    plain  plain  river_v   plain
    plain  plain  bridge_h  plain
    plain  plain  river_ne  river_h

This exists because the first river tile looked correct on its own and drew a
dark band across every seam once it was stacked. `validate.py` and
`check_colors.py` both pass that tile, and so does looking at its `_x8.png`.

There is no automatic seam check here. One was written and measured against
`tests/fixtures/river_v_seam_bug.txt`, and it could not tell that tile apart
from the castle quadrants and river bends, which change sharply at their edges
because they are not meant to repeat. See
`docs/2026-09-19-tiling-tools-spec.md`. Look at the picture instead.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import REPO_ROOT, GridError, check, display, find_grids, load_palette, parse

from render import to_image

TILE_DIR = REPO_ROOT / "assets" / "tile"
OUTPUT_DIR = REPO_ROOT / "build" / "tilemap"


def load_tile(name: str | Path, palette, tile_dir: Path = TILE_DIR) -> Image.Image:
    path = name if isinstance(name, Path) else tile_dir / f"{name}.txt"
    grid = parse(path)
    errors = check(grid, palette)
    if errors:
        raise GridError(f"{display(path)}: {errors[0]}")
    return to_image(grid, palette)


def compose(
    layout: list[list[str | None]], palette, scale: int, tile_dir: Path = TILE_DIR
) -> Image.Image:
    images = {name: load_tile(name, palette, tile_dir) for row in layout for name in row if name}
    if not images:
        raise GridError("layout has no tiles in it")
    cell_w = max(image.width for image in images.values())
    cell_h = max(image.height for image in images.values())
    canvas = Image.new("RGBA", (len(layout[0]) * cell_w, len(layout) * cell_h))
    for y, row in enumerate(layout):
        for x, name in enumerate(row):
            if name:
                canvas.paste(images[name], (x * cell_w, y * cell_h))
    if scale != 1:
        canvas = canvas.resize((canvas.width * scale, canvas.height * scale), Image.NEAREST)
    return canvas


def read_layout(path: Path) -> list[list[str | None]]:
    rows: list[list[str | None]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        rows.append([None if cell == "." else cell for cell in line.split()])
    if not rows:
        raise SystemExit(f"error: {path} has no layout rows")
    width = len(rows[0])
    for index, row in enumerate(rows):
        if len(row) != width:
            raise SystemExit(f"error: {path}: row {index} has {len(row)} cells, expected {width}")
    return rows


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repeat", help="tile name to lay out on its own")
    parser.add_argument("--layout", type=Path, help="layout file")
    parser.add_argument("--grid", default="3x3", help="columns x rows for --repeat (default: 3x3)")
    parser.add_argument("--scale", type=int, default=4, help="enlargement factor (default: 4)")
    parser.add_argument("-o", "--outdir", type=Path, default=OUTPUT_DIR)
    args = parser.parse_args(argv)

    if args.repeat and args.layout:
        raise SystemExit("error: use --repeat or --layout, not both")
    if args.scale < 1:
        raise SystemExit("error: --scale must be 1 or greater")

    try:
        palette = load_palette()
    except GridError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 2

    if args.layout:
        jobs = [(args.layout.stem, read_layout(args.layout))]
    else:
        try:
            columns, rows = (int(part) for part in args.grid.lower().split("x"))
        except ValueError:
            raise SystemExit(f"error: --grid {args.grid!r} is not 'CxR'") from None
        if columns < 1 or rows < 1:
            raise SystemExit("error: --grid must be positive")
        names = [args.repeat] if args.repeat else [p.stem for p in find_grids(TILE_DIR)]
        jobs = [(name, [[name] * columns for _ in range(rows)]) for name in names]

    args.outdir.mkdir(parents=True, exist_ok=True)
    for name, layout in jobs:
        try:
            sheet = compose(layout, palette, args.scale)
        except GridError as exc:
            print(f"FAIL {exc}", file=sys.stderr)
            return 1
        destination = args.outdir / f"{name}_tiled.png"
        sheet.save(destination)
        print(f"ok   {name} -> {display(destination)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
