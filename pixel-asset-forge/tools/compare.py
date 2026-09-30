#!/usr/bin/env python3
"""Put a grid next to the picture it is meant to match.

    tools/compare.py assets/face/roran.txt build/face/roran_free.png

The grid is enlarged by --scale (default 8) and the reference by whatever whole
number makes it the same height, so a 64px face at x8 sits beside a 128px
picture at x4. Both keep hard pixel edges; a reference whose height does not
divide evenly is refused rather than blurred. Writes build/compare/<name>.png
unless -o is given.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, UnidentifiedImageError

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import REPO_ROOT, GridError, check, display, load_palette, parse
from render import to_image

GAP = 16
SHEET_BG = (32, 32, 38)


class CompareError(Exception):
    """The two pictures cannot be put side by side at whole-number scales."""


def enlarge_to(image: Image.Image, height: int) -> Image.Image:
    """Enlarge ``image`` by the whole number that makes it ``height`` tall."""
    if height < image.height or height % image.height:
        raise CompareError(
            f"reference is {image.height}px tall; {height}px is not a whole multiple of it"
        )
    factor = height // image.height
    return image.resize((image.width * factor, image.height * factor), Image.NEAREST)


def side_by_side(left: Image.Image, right: Image.Image, gap: int = GAP) -> Image.Image:
    """Paste both onto one RGB sheet; transparent pixels show SHEET_BG."""
    sheet = Image.new("RGB", (left.width + gap + right.width, max(left.height, right.height)), SHEET_BG)
    for x, image in ((0, left), (left.width + gap, right)):
        rgba = image.convert("RGBA")
        sheet.paste(rgba, (x, 0), rgba)
    return sheet


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("grid", type=Path, help="grid file to draw on the left")
    parser.add_argument("reference", type=Path, help="PNG to draw on the right")
    parser.add_argument("--scale", type=int, default=8, help="enlargement factor for the grid (default: 8)")
    parser.add_argument("-o", "--output", type=Path, default=None, help="default: build/compare/<grid name>.png")
    args = parser.parse_args(argv)

    if args.scale < 1:
        raise SystemExit("error: --scale must be 1 or greater")

    try:
        palette = load_palette()
        grid = parse(args.grid)
    except GridError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 2

    errors = check(grid, palette)
    if errors:
        print(f"FAIL {display(args.grid)} (not compared; fix these first)", file=sys.stderr)
        for error in errors:
            print(f"       {error}", file=sys.stderr)
        return 1

    try:
        with Image.open(args.reference) as opened:
            reference = opened.convert("RGBA")
        left = to_image(grid, palette, args.scale)
        right = enlarge_to(reference, left.height)
    except (OSError, UnidentifiedImageError, CompareError) as exc:
        print(f"FAIL {args.reference}: {exc}", file=sys.stderr)
        return 2

    output = args.output or REPO_ROOT / "build" / "compare" / f"{grid.name}.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    side_by_side(left, right).save(output)
    print(f"ok   {display(args.grid)} + {args.reference} -> {display(output)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
