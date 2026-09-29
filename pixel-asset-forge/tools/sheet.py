#!/usr/bin/env python3
"""Assemble a unit sprite sheet from grid files.

    tools/sheet.py sheets/roran.txt

A sheet definition is whitespace-separated frame names, one sheet row per line,
exactly 12 rows (3 states x 4 directions). `.` leaves a cell transparent. It is
the same shape as a `layouts/*.txt` file on purpose, and lives outside
`assets/` for the same reason: the frames it names are read from
`assets/unit/<definition name>/`.

    down_base  down_breathe  .  .
    up_base    up_breathe    .  .

Rows 0-3 are idle, 4-7 walk, 8-11 attack; within each block the order is
down, up, left, right. The consumer (character-tactics) reads the sheet by
`row = state_index * 4 + direction_index`, so the order is not ours to change.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import REPO_ROOT, GridError, check, display, load_palette, parse

from render import to_image
from tilemap import read_layout

# A definition lives in `sheets/<unit>.txt` and its frames in
# `assets/unit/<unit>/`, the same split `layouts/` and `assets/tile/` use. The
# definition has to sit outside `assets/` because `validate.py` and `render.py`
# rglob every `*.txt` under it and would try to parse the definition as a grid.
UNIT_DIR = REPO_ROOT / "assets" / "unit"
OUTPUT_DIR = REPO_ROOT / "build" / "sheets"

ROWS = 12
STATES = ("idle", "walk", "attack")
DIRECTIONS = ("down", "up", "left", "right")

# The frame row the feet are supposed to sit on. Declared in
# docs/2026-09-20-unit-sprite-sheet-spec.md section 3.
FOOT_Y = 30


def read_sheet(path: Path) -> list[list[str | None]]:
    rows = read_layout(path)
    if len(rows) != ROWS:
        raise SystemExit(
            f"error: {path}: {len(rows)} rows, expected {ROWS} "
            f"({len(STATES)} states x {len(DIRECTIONS)} directions)"
        )
    return rows


def load_frame(path: Path, palette: dict[str, tuple[int, int, int]]) -> Image.Image:
    grid = parse(path)
    errors = check(grid, palette)
    if errors:
        raise GridError(f"{display(path)}: {errors[0]}")
    if grid.width != grid.height:
        raise GridError(f"{display(path)}: {grid.width}x{grid.height} is not square")
    if not grid.background.has_alpha:
        raise GridError(f"{display(path)}: a sheet frame needs 'bg: transparent'")
    return to_image(grid, palette)


def load_frames(
    rows: list[list[str | None]],
    palette: dict[str, tuple[int, int, int]],
    unit_dir: Path,
) -> dict[str, Image.Image]:
    """Every distinct frame the definition names, read once and checked."""
    frames = {
        name: load_frame(unit_dir / f"{name}.txt", palette)
        for row in rows
        for name in row
        if name
    }
    if not frames:
        raise GridError("the sheet definition has no frames in it")
    sizes = {image.size for image in frames.values()}
    if len(sizes) != 1:
        raise GridError(f"frames have mixed sizes: {sorted(sizes)}")
    return frames


def frame_size(frames: dict[str, Image.Image]) -> int:
    return next(iter(frames.values())).width


def compose_sheet(
    rows: list[list[str | None]], frames: dict[str, Image.Image]
) -> Image.Image:
    if not frames:
        raise GridError("the sheet definition has no frames in it")
    frame = frame_size(frames)
    canvas = Image.new("RGBA", (len(rows[0]) * frame, len(rows) * frame))
    for y, row in enumerate(rows):
        for x, name in enumerate(row):
            if name:
                canvas.paste(frames[name], (x * frame, y * frame))
    return canvas


def columns_per_state(rows: list[list[str | None]]) -> dict[str, int]:
    """How many columns each state actually uses, for eyeballing against the
    consumer's JSON. This tool deliberately does not read that JSON."""
    counts: dict[str, int] = {}
    for index, state in enumerate(STATES):
        block = rows[index * len(DIRECTIONS) : (index + 1) * len(DIRECTIONS)]
        used = [x for x in range(len(rows[0])) if any(row[x] for row in block)]
        counts[state] = max(used) + 1 if used else 0
    return counts


BACKDROP = (48, 48, 64, 255)
BORDER = (255, 255, 255, 60)
FOOT_LINE = (255, 90, 90, 150)
CENTER_LINE = (90, 170, 255, 110)


def measure(image: Image.Image) -> tuple[int | None, float | None]:
    """The lowest opaque row and the horizontal midpoint of the opaque pixels."""
    box = image.getchannel("A").getbbox()
    if box is None:
        return None, None
    left, _, right, bottom = box
    return bottom - 1, (left + right - 1) / 2


def preview(canvas: Image.Image, frame: int, scale: int = 4) -> Image.Image:
    """The sheet on a flat backdrop with cell borders, the foot line and the
    centre line drawn over it.

    The defect this is for is a frame whose feet or centre sit a pixel off its
    neighbours', which makes the animation jitter. Looking at one enlarged frame
    cannot show it - the same way one tile cannot show a seam.
    """
    base = Image.new("RGBA", canvas.size, BACKDROP)
    base.alpha_composite(canvas)
    out = base.resize((canvas.width * scale, canvas.height * scale), Image.NEAREST)

    overlay = Image.new("RGBA", out.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for x in range(0, canvas.width + 1, frame):
        draw.line([(x * scale, 0), (x * scale, out.height)], fill=BORDER)
    for y in range(0, canvas.height + 1, frame):
        draw.line([(0, y * scale), (out.width, y * scale)], fill=BORDER)
    for top in range(0, canvas.height, frame):
        y = (top + FOOT_Y) * scale
        draw.line([(0, y), (out.width, y)], fill=FOOT_LINE)
    for left in range(0, canvas.width, frame):
        x = int((left + (frame - 1) / 2) * scale)
        draw.line([(x, 0), (x, out.height)], fill=CENTER_LINE)
    return Image.alpha_composite(out, overlay)


def report(frames: dict[str, Image.Image], frame: int) -> None:
    """Print where the feet and the centre actually are.

    Advice only - this never changes the exit code. `attack` frames step
    forward, so the feet are supposed to move there. Three earlier machine
    checks in this repo were withdrawn or downgraded once they were measured
    against every existing asset; see docs/2026-09-23-findings.md.
    """
    expected_center = (frame - 1) / 2
    print(f"     {'frame':<18}{'foot_y':>7}{'center_x':>10}   "
          f"(expected foot_y={FOOT_Y}, center_x={expected_center})")
    for name in sorted(frames):
        foot, center = measure(frames[name])
        flag = ""
        if foot != FOOT_Y or center is None or abs(center - expected_center) > 1:
            flag = "  <-- off"
        print(f"     {name:<18}{str(foot):>7}{str(center):>10}{flag}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("definition", type=Path, help="sheet definition file")
    parser.add_argument("--scale", type=int, default=4, help="preview enlargement (default: 4)")
    parser.add_argument("-o", "--outdir", type=Path, default=OUTPUT_DIR)
    parser.add_argument(
        "--unitdir", type=Path, default=None,
        help="where the frame grids are (default: assets/unit/<definition name>)",
    )
    args = parser.parse_args(argv)

    if args.scale < 1:
        raise SystemExit("error: --scale must be 1 or greater")

    try:
        palette = load_palette()
    except GridError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 2

    rows = read_sheet(args.definition)
    name = args.definition.stem
    unit_dir = args.unitdir if args.unitdir is not None else UNIT_DIR / name
    try:
        frames = load_frames(rows, palette, unit_dir)
    except GridError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 1
    canvas = compose_sheet(rows, frames)

    args.outdir.mkdir(parents=True, exist_ok=True)
    destination = args.outdir / f"{name}.png"
    canvas.save(destination)
    print(f"ok   {display(destination)}  {canvas.width}x{canvas.height}")
    for state, count in columns_per_state(rows).items():
        print(f"     {state:<7} {count} frame(s)")
    frame = frame_size(frames)
    if args.scale != 1:
        large = args.outdir / f"{name}_preview.png"
        preview(canvas, frame, args.scale).save(large)
        print(f"ok   {display(large)}")
    report(frames, frame)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
