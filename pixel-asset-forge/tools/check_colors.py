#!/usr/bin/env python3
"""Check that colours which touch each other are actually tellable apart.

    tools/check_colors.py                  # assets/, every types/*/reference/ and types/*/base/
    tools/check_colors.py assets/tile

This is advisory, not a gate. `validate.py` decides whether a grid is well
formed; this one reports colour pairs that will read as one blob. It exits
non-zero only for a hard failure, meaning a pair close enough to be the same
colour; everything else is a warning for the author to judge.

Thresholds and the two-axis rule come from pixellint
(https://github.com/Li-Mingshuang/pixellint), whose own documented lesson is
that a checker tuned too strictly ends up dictating composition. So everything
except a dissolved outline is a warning for the author to judge.

Only painted cells take part. Background cells are skipped, so a sprite sitting
on a gradient is not checked against its backdrop.

Not implemented, and deliberately: a "lone pixel shouting against its
neighbours" check. It was tried and flagged every diagonal outline, because a
diagonal outline pixel differs from all four of its neighbours by definition.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import BACKGROUND, GridError, check, display, load_palette, parse

from validate import collect, default_targets

# A lightness edge alone makes a pair readable, by either measure.
LIGHTNESS_STEP = 0.22   # absolute, on L* scaled to 0..1
LIGHTNESS_RATIO = 1.7   # perception follows Weber's law, so the ratio matters too

# Chroma floors, by the role of the pair.
OUTLINE_HARD, OUTLINE_WARN = 24.0, 30.0   # an outline exists to be an edge
# pixellint warns below dE 22 for ordinary pairs. Measured against this repo's
# assets that fires on every shading ramp step (dE 12..22), which is what a ramp
# step is supposed to be. Lowered until the converged assets are clean, so the
# check only speaks up for pairs approaching "literally the same colour".
OTHER_HARD, OTHER_WARN = 6.0, 10.0

OUTLINE_NAMES = {"outline"}


def _linear(channel: int) -> float:
    c = channel / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb_to_lab(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    """sRGB to CIE L*a*b* under D65."""
    r, g, b = (_linear(c) for c in rgb)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883

    def f(t: float) -> float:
        return t ** (1 / 3) if t > 216 / 24389 else (841 / 108) * t + 4 / 29

    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def delta_e(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    """CIE76. Coarse, but the thresholds here are coarse too."""
    return sum((p - q) ** 2 for p, q in zip(a, b)) ** 0.5


def has_lightness_edge(a: tuple[float, float, float], b: tuple[float, float, float]) -> bool:
    hi, lo = max(a[0], b[0]), min(a[0], b[0])
    if abs(hi - lo) / 100 >= LIGHTNESS_STEP:
        return True
    return lo > 0 and hi / lo >= LIGHTNESS_RATIO


def adjacent_pairs(cell_names: list[list[str | None]]) -> dict[tuple[str, str], tuple[int, tuple[int, int]]]:
    """Every unordered pair of differing colours that shares an edge.

    Returns pair -> (how many pixel edges, where they first touch).
    """
    found: dict[tuple[str, str], tuple[int, tuple[int, int]]] = {}
    height, width = len(cell_names), len(cell_names[0]) if cell_names else 0
    for y in range(height):
        for x in range(width):
            here = cell_names[y][x]
            if here is None:
                continue
            for dx, dy in ((1, 0), (0, 1)):
                nx, ny = x + dx, y + dy
                if nx >= width or ny >= height:
                    continue
                there = cell_names[ny][nx]
                if there is None or there == here:
                    continue
                key = tuple(sorted((here, there)))  # type: ignore[assignment]
                count, first = found.get(key, (0, (x, y)))
                found[key] = (count + 1, first)
    return found


def cell_name_grid(grid) -> list[list[str | None]]:
    return [
        [None if ch == BACKGROUND else grid.charmap[ch] for ch in row]
        for row in grid.rows
    ]


def inspect(grid, palette: dict[str, tuple[int, int, int]]):
    """Return (hard failures, warnings) as message lists."""
    labs = {name: rgb_to_lab(rgb) for name, rgb in palette.items()}
    cells = cell_name_grid(grid)

    hard: list[str] = []
    warn: list[str] = []
    for (one, two), (count, (x, y)) in sorted(adjacent_pairs(cells).items()):
        lab_one, lab_two = labs[one], labs[two]
        if has_lightness_edge(lab_one, lab_two):
            continue
        distance = delta_e(lab_one, lab_two)
        is_outline = bool({one, two} & OUTLINE_NAMES)
        hard_floor, warn_floor = (OUTLINE_HARD, OUTLINE_WARN) if is_outline else (OTHER_HARD, OTHER_WARN)
        if distance >= warn_floor:
            continue
        where = f"{count}px, first at ({x},{y})"
        message = f"{one} / {two}: no lightness edge, dE {distance:.1f} (floor {warn_floor:.0f}) [{where}]"
        (hard if distance < hard_floor else warn).append(message)

    return hard, warn


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("targets", nargs="*", type=Path, help="grid files or directories (default: assets/, references and bases)")
    parser.add_argument("-q", "--quiet", action="store_true", help="only report grids with something to say")
    args = parser.parse_args(argv)

    try:
        palette = load_palette()
    except GridError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 2

    grids = collect(args.targets or default_targets())
    failed = 0
    flagged = 0
    for path in grids:
        rel = display(path)
        try:
            grid = parse(path)
        except GridError as exc:
            print(f"FAIL {rel}\n       {exc}", file=sys.stderr)
            failed += 1
            continue
        if check(grid, palette):
            print(f"skip {rel}: does not pass validate.py yet", file=sys.stderr)
            continue

        hard, warn = inspect(grid, palette)
        if hard:
            failed += 1
            print(f"FAIL {rel}", file=sys.stderr)
            for message in hard:
                print(f"       {message}", file=sys.stderr)
            for message in warn:
                print(f"  warn {message}", file=sys.stderr)
        elif warn:
            flagged += 1
            print(f"warn {rel}")
            for message in warn:
                print(f"       {message}")
        elif not args.quiet:
            print(f"ok   {rel}")

    print(f"\n{len(grids)} grid(s): {failed} failed, {flagged} with warnings")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
