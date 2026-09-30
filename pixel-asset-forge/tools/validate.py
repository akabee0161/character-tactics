#!/usr/bin/env python3
"""Machine checks for grid files. Run this before looking at any PNG.

    tools/validate.py                 # assets/, every types/*/reference/ and types/*/base/
    tools/validate.py assets/item     # a directory
    tools/validate.py assets/face/knight.txt

Exits non-zero if any grid fails.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import REPO_ROOT, GridError, check, display, find_grids, load_palette, parse


def default_targets(root: Path = REPO_ROOT) -> list[Path]:
    targets = [root / "assets"]
    targets += sorted((root / "types").glob("*/reference"))
    targets += sorted((root / "types").glob("*/base"))
    return [t for t in targets if t.exists()]


def collect(targets: list[Path]) -> list[Path]:
    """Expand targets to absolute grid paths.

    Absolute, so callers can locate a grid relative to the repo root regardless
    of the working directory the command was typed from.
    """
    grids: list[Path] = []
    for target in targets:
        target = target.resolve()
        if target.is_dir():
            grids.extend(find_grids(target))
        elif target.is_file():
            grids.append(target)
        else:
            raise SystemExit(f"error: no such file or directory: {target}")
    return grids


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("targets", nargs="*", type=Path, help="grid files or directories (default: assets/, references and bases)")
    parser.add_argument("-q", "--quiet", action="store_true", help="only report failures")
    args = parser.parse_args(argv)

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
            print(f"FAIL {rel}", file=sys.stderr)
            for error in errors:
                print(f"       {error}", file=sys.stderr)
            failed += 1
        elif not args.quiet:
            used = len(grid.used_colors(palette))
            limit = f"/{grid.max_colors}" if grid.max_colors is not None else ""
            print(f"ok   {rel}  {grid.width}x{grid.height}  {used}{limit} colours")

    if failed:
        print(f"\n{failed} of {len(grids)} grid(s) failed", file=sys.stderr)
        return 1
    if not args.quiet:
        print(f"\n{len(grids)} grid(s) ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
