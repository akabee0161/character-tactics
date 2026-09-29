#!/usr/bin/env python3
"""Assemble an object from 16x16 part tiles.

    tools/sets.py                     # every sets/*.txt
    tools/sets.py sets/village.txt

A set definition is whitespace-separated part names, one row of parts per
line - the same shape as a `layouts/*.txt` file, and outside `assets/` for the
same reason (`validate.py` and `render.py` would read it as a grid). The parts
are ordinary `tile` grids in `assets/tile/`.

    village_nw  village_ne
    village_sw  village_se

`build/sets/<name>.png` is what the game receives: character-tactics draws a
32x32 tile as one map cell, unscaled. The parts stay 16x16 so that
`tilemap.py --layout` can still place them beside every other tile.
`<name>_x8.png` is the copy to look at.

Unlike a layout, a set has no empty cells. The object is drawn on its own
grass, so a `.` would leave a hole in the ground.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import BACKGROUND, REPO_ROOT, GridError, check, display, load_palette, parse

from tilemap import TILE_DIR, compose, read_layout

SET_DIR = REPO_ROOT / "sets"
OUTPUT_DIR = REPO_ROOT / "build" / "sets"

# The ground tile size. A set is whole tiles of it, so it lines up with the
# 16px tiles laid around it.
PART = 16


def check_parts(layout: list[list[str | None]], palette, tile_dir: Path) -> None:
    """Raise :class:`GridError` naming the first cell or part that cannot go into a set."""
    for y, row in enumerate(layout):
        for x, name in enumerate(row):
            if name is None:
                raise GridError(f"row {y} column {x} is '.', but a set has no empty cells")
    for name in dict.fromkeys(name for row in layout for name in row):
        path = tile_dir / f"{name}.txt"
        if not path.is_file():
            raise GridError(f"{name}: no such part ({display(path)})")
        grid = parse(path)
        errors = check(grid, palette)
        if errors:
            raise GridError(f"{display(path)}: {errors[0]}")
        # check() accepts '.', but a tile without '# bg' draws it transparent: a hole in the ground
        for y, row in enumerate(grid.rows):
            if BACKGROUND in row:
                raise GridError(
                    f"{display(path)}: row {y} column {row.index(BACKGROUND)} is '.', but a part must fill every cell"
                )
        if (grid.width, grid.height) != (PART, PART):
            raise GridError(f"{display(path)}: {grid.width}x{grid.height}, a part must be {PART}x{PART}")


def assemble(layout: list[list[str | None]], palette, tile_dir: Path = TILE_DIR) -> Image.Image:
    check_parts(layout, palette, tile_dir)
    return compose(layout, palette, scale=1, tile_dir=tile_dir)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("definitions", nargs="*", type=Path, help="set definition files (default: sets/*.txt)")
    parser.add_argument("--scale", type=int, default=8, help="enlargement factor for the review copy (default: 8)")
    parser.add_argument("-o", "--outdir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--tiledir", type=Path, default=TILE_DIR, help="where the part grids are (default: assets/tile)")
    args = parser.parse_args(argv)

    if args.scale < 1:
        raise SystemExit("error: --scale must be 1 or greater")

    try:
        palette = load_palette()
    except GridError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 2

    definitions = args.definitions or sorted(SET_DIR.glob("*.txt"))
    if not definitions:
        print("no set definitions found", file=sys.stderr)
        return 0

    args.outdir.mkdir(parents=True, exist_ok=True)
    failed = 0
    for path in definitions:
        try:
            image = assemble(read_layout(path), palette, args.tiledir)
        # read_layout raises SystemExit on a malformed definition and OSError on a missing one.
        # Count either as this definition's failure so the others are still written
        except (GridError, OSError, SystemExit) as exc:
            print(f"FAIL {display(path)}\n       {exc}", file=sys.stderr)
            failed += 1
            continue
        destination = args.outdir / f"{path.stem}.png"
        image.save(destination)
        if args.scale != 1:
            large = args.outdir / f"{path.stem}_x{args.scale}.png"
            image.resize((image.width * args.scale, image.height * args.scale), Image.NEAREST).save(large)
        print(f"ok   {display(path)} -> {display(destination)}  {image.width}x{image.height}")

    if failed:
        print(f"\n{failed} of {len(definitions)} set(s) failed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
