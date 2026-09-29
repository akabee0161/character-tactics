#!/usr/bin/env python3
"""Ask whether two colours will be tellable apart, before anything is drawn.

    tools/probe_colors.py grass_base leaf_hi
    tools/probe_colors.py --pairs planned.txt
    tools/probe_colors.py --candidate '#2e8055' --against grass_base grass_hi grass_shadow

This is the same arithmetic `check_colors.py` runs, pointed at colours instead
of at a finished grid. It exists because that check, used the way it was
designed - after the art is drawn - almost never says anything: measured
against this repo's own assets it caught 0 of the 11 defects the eye found.
Used the other way round it earns its keep. Picking the grassland's leaf_hi,
the first choice measured dE 5.9 against grass_base, which is a hard failure;
finding that before drawing saved redrawing the tree, the conifer and the
forest.

It was written twice as a throwaway before it was put here. Nothing in it was
ever specific to the session - only the list of pairs was, and a list of pairs
is an argument.

This is not a check. It reads no assets and passes no judgement on them, so
the rule about counting false positives before adding a check does not apply.
It exits non-zero only when a pair it was asked about would be flagged, so it
can be used as a gate on purpose.

A colour is either a name in palette/master.json or a literal '#rrggbb'.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import HEX_RE, GridError, hex_to_rgb, load_palette

from check_colors import (
    OTHER_HARD,
    OTHER_WARN,
    OUTLINE_HARD,
    OUTLINE_WARN,
    OUTLINE_NAMES,
    delta_e,
    has_lightness_edge,
    rgb_to_lab,
)

VERDICTS = ("OK(lightness)", "OK(dE)", "WARN", "HARD")


def resolve(colour: str, palette: dict[str, tuple[int, int, int]]) -> tuple[int, int, int]:
    """A palette key, or a literal '#rrggbb' for a colour not added yet."""
    if HEX_RE.match(colour):
        return hex_to_rgb(colour)
    if colour in palette:
        return palette[colour]
    raise GridError(f"{colour!r} is neither a palette name nor a '#rrggbb' literal")


def verdict(one: str, two: str, palette: dict[str, tuple[int, int, int]]) -> tuple[str, float]:
    """Return what check_colors.py would say about this pair, and the distance.

    The thresholds follow the same two-axis rule: a lightness edge alone makes a
    pair readable, and only without one does the chroma distance decide.
    """
    lab_one, lab_two = rgb_to_lab(resolve(one, palette)), rgb_to_lab(resolve(two, palette))
    distance = delta_e(lab_one, lab_two)
    if has_lightness_edge(lab_one, lab_two):
        return "OK(lightness)", distance

    is_outline = bool({one, two} & OUTLINE_NAMES)
    hard, warn = (OUTLINE_HARD, OUTLINE_WARN) if is_outline else (OTHER_HARD, OTHER_WARN)
    if distance >= warn:
        return "OK(dE)", distance
    return ("WARN" if distance >= hard else "HARD"), distance


def read_pairs(path: Path) -> list[tuple[str, str]]:
    """One pair per line, whitespace separated. '#' starts a comment."""
    pairs: list[tuple[str, str]] = []
    for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = line.split("#", 1)[0].strip() if not line.lstrip().startswith("#") else ""
        if not line:
            continue
        parts = line.split()
        if len(parts) != 2:
            raise GridError(f"{path}:{lineno}: expected two colours, got {len(parts)}")
        pairs.append((parts[0], parts[1]))
    return pairs


def report(pairs: list[tuple[str, str]], palette, quiet: bool) -> int:
    flagged = 0
    for one, two in pairs:
        label, distance = verdict(one, two, palette)
        if label in ("WARN", "HARD"):
            flagged += 1
        elif quiet:
            continue
        lab_one = rgb_to_lab(resolve(one, palette))
        lab_two = rgb_to_lab(resolve(two, palette))
        print(
            f"{label:14s} {one:16s} {two:16s} "
            f"dE={distance:5.1f} L={lab_one[0]:5.1f}/{lab_two[0]:5.1f}"
        )
    print(f"\n{len(pairs)} pair(s): {flagged} would be flagged")
    return flagged


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("colours", nargs="*", help="two colours to compare")
    parser.add_argument("--pairs", type=Path, help="file of pairs, one per line")
    parser.add_argument(
        "--candidate", help="a colour to try, usually a '#rrggbb' not in the palette yet"
    )
    parser.add_argument(
        "--against", nargs="+", default=[], help="colours the candidate has to stay clear of"
    )
    parser.add_argument("-q", "--quiet", action="store_true", help="only print flagged pairs")
    args = parser.parse_args(argv)

    try:
        palette = load_palette()
    except GridError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 2

    if args.candidate:
        if not args.against:
            parser.error("--candidate needs --against")
        pairs = [(args.candidate, other) for other in args.against]
    elif args.pairs:
        pairs = read_pairs(args.pairs)
    elif len(args.colours) == 2:
        pairs = [(args.colours[0], args.colours[1])]
    else:
        parser.error("give two colours, or --pairs, or --candidate with --against")

    try:
        return 1 if report(pairs, palette, args.quiet) else 0
    except GridError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
