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

import palette as palette_mod
from gridfile import REPO_ROOT, Grid, GridError, check, display, find_grids, load_palette, parse


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


WEAPON_KINDS = frozenset({"blade", "weapon"})
EQUIPMENT_KINDS = frozenset({"blade", "weapon", "shield"})


def palette_rules(path: Path, grid: Grid, pal: palette_mod.Palette) -> list[str]:
    """Rules on which use colours a grid may name. ``path`` is repo-relative.

    A derived file (``# from:``) has already inherited its origin's type in ``grid``.
    """
    errors: list[str] = []
    names = sorted({n for n in grid.charmap.values() if n in pal.uses})

    allowed = pal.allowed(grid.type)
    for n in names:
        if n not in allowed:
            errors.append(f"{n!r} is a {pal.uses[n].type} colour, but this grid's type is {grid.type!r}")

    parts = path.parts
    if parts[:3] == ("assets", "part", "equip") and len(parts) >= 5:
        permitted = {"outline", "shield"} if parts[3] == "shield" else {"outline", *WEAPON_KINDS}
        for n in names:
            if pal.kind_of(n) not in permitted:
                errors.append(
                    f"{n!r} (kind {pal.kind_of(n)}) is not allowed in equip/{parts[3]}: "
                    f"only {', '.join(sorted(permitted))}"
                )
    elif parts[:2] == ("assets", "part") or parts[:3] == ("types", "unit", "base"):
        for n in names:
            if pal.kind_of(n) in EQUIPMENT_KINDS:
                errors.append(f"{n!r} (kind {pal.kind_of(n)}) is equipment; a body part or base must not use blade/weapon/shield")
    return errors


def unused(pal: palette_mod.Palette, used: set[str]) -> tuple[set[str], set[str]]:
    """(use colours no grid names, swatches no use points at)."""
    pointed = {u.swatch for u in pal.uses.values()}
    return set(pal.uses) - used, set(pal.swatches) - pointed


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("targets", nargs="*", type=Path, help="grid files or directories (default: assets/, references and bases)")
    parser.add_argument("-q", "--quiet", action="store_true", help="only report failures")
    args = parser.parse_args(argv)

    try:
        palette = load_palette()
        pal = palette_mod.load()
    except GridError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 2

    grids = collect(args.targets or default_targets())
    if not grids:
        print("no grid files found", file=sys.stderr)
        return 0

    failed = 0
    used_names: set[str] = set()
    for path in grids:
        rel = display(path)
        try:
            grid = parse(path)
        except GridError as exc:
            print(f"FAIL {rel}\n       {exc}", file=sys.stderr)
            failed += 1
            continue

        errors = check(grid, palette) + palette_rules(display(path), grid, pal)
        used_names |= set(grid.charmap[c] for c in grid.used_chars() if c in grid.charmap)
        if errors:
            print(f"FAIL {rel}", file=sys.stderr)
            for error in errors:
                print(f"       {error}", file=sys.stderr)
            failed += 1
        elif not args.quiet:
            used = len(grid.used_colors(palette))
            limit = f"/{grid.max_colors}" if grid.max_colors is not None else ""
            print(f"ok   {rel}  {grid.width}x{grid.height}  {used}{limit} colours")

    if not args.targets:
        unused_uses, unused_swatches = unused(pal, used_names)
        for n in sorted(unused_uses):
            print(f"note: use colour {n!r} is not used by any grid")
        for n in sorted(unused_swatches):
            print(f"note: swatch {n!r} has no use pointing at it")

    if failed:
        print(f"\n{failed} of {len(grids)} grid(s) failed", file=sys.stderr)
        return 1
    if not args.quiet:
        print(f"\n{len(grids)} grid(s) ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
