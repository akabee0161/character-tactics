#!/usr/bin/env python3
"""Lay every asset out on one sheet, grouped by type.

    tools/contact_sheet.py

The point is to catch drift *between* assets — a face lit from the wrong side,
an item whose outline is a different weight — which is invisible when you review
one PNG at a time. Writes ``build/contact_sheet.png``.
"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import REPO_ROOT, Grid, GridError, check, display, load_palette, parse
from render import to_image
from validate import collect, default_targets

PAD = 12
LABEL_H = 14
HEADER_H = 22
SHEET_BG = (32, 32, 38)
CHECKER = (48, 48, 56)
LABEL_FG = (196, 200, 210)
HEADER_FG = (240, 240, 245)


def checkerboard(size: tuple[int, int], square: int) -> Image.Image:
    """Backdrop so transparent pixels are distinguishable from dark ones."""
    tile = Image.new("RGB", size, SHEET_BG)
    draw = ImageDraw.Draw(tile)
    for y in range(0, size[1], square):
        for x in range(0, size[0], square):
            if (x // square + y // square) % 2:
                draw.rectangle([x, y, x + square - 1, y + square - 1], fill=CHECKER)
    return tile


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("targets", nargs="*", type=Path, help="grid files or directories (default: assets/, references and bases)")
    parser.add_argument("--scale", type=int, default=4, help="enlargement factor per tile (default: 4)")
    parser.add_argument("--columns", type=int, default=6, help="tiles per row (default: 6)")
    parser.add_argument("-o", "--output", type=Path, default=REPO_ROOT / "build" / "contact_sheet.png")
    args = parser.parse_args(argv)

    if args.scale < 1 or args.columns < 1:
        raise SystemExit("error: --scale and --columns must be 1 or greater")

    try:
        palette = load_palette()
    except GridError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 2

    groups: dict[str, list[tuple[Grid, Image.Image]]] = defaultdict(list)
    failed = 0
    for path in collect(args.targets or default_targets()):
        rel = display(path)
        try:
            grid = parse(path)
        except GridError as exc:
            print(f"skip {rel}: {exc}", file=sys.stderr)
            failed += 1
            continue
        errors = check(grid, palette)
        if errors:
            print(f"skip {rel}: {errors[0]}", file=sys.stderr)
            failed += 1
            continue
        groups[grid.type].append((grid, to_image(grid, palette, args.scale)))

    if not groups:
        print("no renderable grids found", file=sys.stderr)
        return 1

    tiles = [image for entries in groups.values() for _, image in entries]
    cell_w = max(image.width for image in tiles)
    cell_h = max(image.height for image in tiles) + LABEL_H

    width = PAD + args.columns * (cell_w + PAD)
    height = PAD
    for entries in groups.values():
        rows = -(-len(entries) // args.columns)
        height += HEADER_H + rows * (cell_h + PAD)

    sheet = Image.new("RGB", (width, height), SHEET_BG)
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    y = PAD
    for type_name in sorted(groups):
        entries = sorted(groups[type_name], key=lambda entry: entry[0].name)
        draw.text((PAD, y), f"{type_name}  ({len(entries)})", fill=HEADER_FG, font=font)
        y += HEADER_H
        for index, (grid, image) in enumerate(entries):
            column, row = index % args.columns, index // args.columns
            x = PAD + column * (cell_w + PAD)
            top = y + row * (cell_h + PAD)
            sheet.paste(checkerboard(image.size, max(4, args.scale * 2)), (x, top))
            sheet.paste(image, (x, top), image if image.mode == "RGBA" else None)
            draw.text((x, top + image.height + 2), grid.name[:cell_w // 6], fill=LABEL_FG, font=font)
        y += -(-len(entries) // args.columns) * (cell_h + PAD)

    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)
    total = sum(len(entries) for entries in groups.values())
    print(f"ok   {total} asset(s) -> {display(output)}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
