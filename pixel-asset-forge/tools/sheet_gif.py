#!/usr/bin/env python3
"""Turn a unit sheet definition into animated GIFs, one per state.

    tools/sheet_gif.py sheets/roran.txt                 # idle, walk and attack
    tools/sheet_gif.py sheets/roran.txt --state attack  # one state
    tools/sheet_gif.py sheets/roran.txt --fps attack=12 --scale 6

It reads the same definition as `sheet.py` (`sheets/<unit>.txt`, frames from
`assets/unit/<unit>/`) and writes `build/sheets/<unit>_<state>.gif`. Each GIF
shows the four directions side by side (down, up, left, right), enlarged on
the sheet preview's backdrop, with the same four at 1x on grass underneath -
the size they are drawn at in the game.

The speed defaults are the ones character-tactics plays roran at
(`assets/units/roran.json`: idle 4fps, walk 8fps, attack 6fps). This tool does
not read that JSON, the same way `sheet.py` does not; pass `--fps` when a unit
differs. GIF stores frame times in hundredths of a second, so the time is
rounded to 10ms: 6fps (167ms) plays as 170ms, 8fps (125ms) as 130ms.

The point is to judge motion, which a still sheet cannot show: a sword that
reads in one frame can still look wrong when the three attack frames play.
"""
from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import GridError, display, load_palette

import sheet

DEFAULT_FPS = {"idle": 4.0, "walk": 8.0, "attack": 6.0}
BACKDROP = sheet.BACKDROP
GRASS_KEY = "grass_base"
PAD = 8


def parse_fps(specs: list[str]) -> dict[str, float]:
    """`state=fps` overrides on top of the game's defaults."""
    fps = dict(DEFAULT_FPS)
    for spec in specs:
        state, sep, value = spec.partition("=")
        if not sep or state not in fps:
            raise SystemExit(f"error: --fps {spec!r}: expected one of {', '.join(fps)} as state=fps")
        try:
            number = float(value)
        except ValueError:
            raise SystemExit(f"error: --fps {spec!r}: {value!r} is not a number") from None
        # nan は表示時間の計算で ValueError、inf は 0ms になる
        if not math.isfinite(number) or number <= 0:
            raise SystemExit(f"error: --fps {spec!r}: fps must be a finite number greater than 0")
        fps[state] = number
    return fps


def duration_ms(fps: float) -> int:
    """One frame's time, rounded to the 10ms steps GIF can store (Pillow would
    otherwise truncate: 6fps = 167ms would be written as 160ms)."""
    # round() は偶数への丸め（12.5 -> 12）なので使わない
    return int(1000 / fps / 10 + 0.5) * 10


def cell_origin(direction: int, scale: int, frame: int) -> tuple[int, int]:
    """Top-left of the enlarged cell for a direction (0=down .. 3=right).
    `frame` is required: with a default of 0 every direction landed on direction 0."""
    cell = frame * scale
    return PAD + direction * (cell + PAD), PAD


def _grass() -> tuple[int, int, int, int]:
    palette = load_palette()
    return (*palette.get(GRASS_KEY, (79, 140, 54)), 255)


def animation(
    rows: list[list[str | None]],
    frames: dict[str, Image.Image],
    state: str,
    scale: int,
) -> list[Image.Image]:
    """One image per column the state uses; each shows that column for all four directions."""
    if state not in sheet.STATES:
        raise GridError(f"unknown state {state!r}")
    frame = sheet.frame_size(frames)
    count = sheet.columns_per_state(rows)[state]
    if count == 0:
        raise GridError(f"state {state!r} has no frames in the definition")
    block = rows[sheet.STATES.index(state) * 4 : sheet.STATES.index(state) * 4 + 4]
    cell = frame * scale
    width = PAD + 4 * (cell + PAD)
    height = PAD + cell + PAD + frame + PAD
    grass = _grass()
    images = []
    for column in range(count):
        canvas = Image.new("RGBA", (width, height), BACKDROP)
        canvas.paste(grass, (0, PAD + cell + PAD // 2, width, height))
        for direction, row in enumerate(block):
            name = row[column] if column < len(row) else None
            if not name:
                continue
            image = frames[name]
            x, y = cell_origin(direction, scale, frame)
            canvas.alpha_composite(image.resize((cell, cell), Image.NEAREST), (x, y))
            canvas.alpha_composite(image, (x + (cell - frame) // 2, PAD + cell + PAD))
        images.append(canvas.convert("RGB"))
    return images


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("definition", type=Path, help="sheet definition file")
    parser.add_argument("--state", choices=(*sheet.STATES, "all"), default="all")
    parser.add_argument("--fps", action="append", default=[], metavar="STATE=FPS",
                        help="override a state's speed (default: idle=4 walk=8 attack=6)")
    parser.add_argument("--scale", type=int, default=4, help="enlargement (default: 4)")
    parser.add_argument("-o", "--outdir", type=Path, default=sheet.OUTPUT_DIR)
    parser.add_argument(
        "--unitdir", type=Path, default=None,
        help="where the frame grids are (default: assets/unit/<definition name>)",
    )
    args = parser.parse_args(argv)

    if args.scale < 1:
        raise SystemExit("error: --scale must be 1 or greater")
    fps = parse_fps(args.fps)

    try:
        palette = load_palette()
    except GridError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 2

    rows = sheet.read_sheet(args.definition)
    name = args.definition.stem
    unit_dir = args.unitdir if args.unitdir is not None else sheet.UNIT_DIR / name
    try:
        frames = sheet.load_frames(rows, palette, unit_dir)
    except GridError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 1

    states = sheet.STATES if args.state == "all" else (args.state,)
    args.outdir.mkdir(parents=True, exist_ok=True)
    for state in states:
        try:
            images = animation(rows, frames, state, args.scale)
        except GridError as exc:
            print(f"FAIL {exc}", file=sys.stderr)
            return 1
        destination = args.outdir / f"{name}_{state}.gif"
        ms = duration_ms(fps[state])
        images[0].save(destination, save_all=True, append_images=images[1:], duration=ms, loop=0)
        print(f"ok   {display(destination)}  {len(images)} frame(s) at {fps[state]:g}fps ({ms}ms)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
