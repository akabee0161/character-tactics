#!/usr/bin/env python3
"""Render grid files to PNG.

    tools/render.py                   # assets/, every types/*/reference/ and types/*/base/
    tools/render.py assets/item       # a directory
    tools/render.py assets/face/knight.txt

Each grid produces a 1x PNG and an enlarged nearest-neighbour copy
(``<name>_x8.png``); the enlarged one is what you actually look at, because a
32x32 PNG is too small to review. Grids under ``assets/`` render into
``build/`` (git-ignored); grids under ``types/`` render beside the grid,
because reference and base PNGs are committed.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import BACKGROUND, REPO_ROOT, Grid, GridError, check, display, find_grids, load_palette, parse

from validate import collect, default_targets


def to_image(grid: Grid, palette: dict[str, tuple[int, int, int]], scale: int = 1) -> Image.Image:
    """Paint a validated grid. Call :func:`gridfile.check` first."""
    mode = "RGBA" if grid.background.has_alpha else "RGB"
    image = Image.new(mode, (grid.width, grid.height))
    pixels = image.load()
    for y, row in enumerate(grid.rows):
        for x, ch in enumerate(row):
            if ch == BACKGROUND:
                color = grid.background.color_at(y, grid.height)
                pixels[x, y] = color if mode == "RGBA" else color[:3]
            else:
                rgb = palette[grid.charmap[ch]]
                pixels[x, y] = (*rgb, 255) if mode == "RGBA" else rgb
    if scale != 1:
        image = image.resize((grid.width * scale, grid.height * scale), Image.NEAREST)
    return image


def output_dir(path: Path, override: Path | None) -> Path:
    """Where the PNGs for ``path`` belong."""
    if override is not None:
        return override.resolve()
    if path.is_relative_to(REPO_ROOT / "assets"):
        return REPO_ROOT / "build" / path.relative_to(REPO_ROOT / "assets").parent
    return path.parent


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("targets", nargs="*", type=Path, help="grid files or directories (default: assets/, references and bases)")
    parser.add_argument("--scale", type=int, default=8, help="enlargement factor for the review copy (default: 8)")
    parser.add_argument("-o", "--outdir", type=Path, default=None, help="write every PNG here instead of the default location")
    args = parser.parse_args(argv)

    if args.scale < 1:
        raise SystemExit("error: --scale must be 1 or greater")

    try:
        palette = load_palette()
    except GridError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 2

    grids = collect(args.targets or default_targets())
    if not grids:
        print("no grid files found", file=sys.stderr)
        return 0

    failed = 0
    for path in grids:
        rel = display(path)
        try:
            grid = parse(path)
        except GridError as exc:
            print(f"FAIL {rel}\n       {exc}", file=sys.stderr)
            failed += 1
            continue

        errors = check(grid, palette)
        if errors:
            print(f"FAIL {rel} (not rendered; fix these first)", file=sys.stderr)
            for error in errors:
                print(f"       {error}", file=sys.stderr)
            failed += 1
            continue

        destination = output_dir(path, args.outdir)
        destination.mkdir(parents=True, exist_ok=True)
        base = destination / grid.name
        to_image(grid, palette).save(base.with_suffix(".png"))
        if args.scale != 1:
            large = destination / f"{grid.name}_x{args.scale}.png"
            to_image(grid, palette, args.scale).save(large)
            print(f"ok   {rel} -> {display(large)}")
        else:
            print(f"ok   {rel} -> {display(base.with_suffix('.png'))}")

    if failed:
        print(f"\n{failed} of {len(grids)} grid(s) failed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
