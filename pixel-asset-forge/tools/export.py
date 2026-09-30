#!/usr/bin/env python3
"""Build the PNGs a game uses and copy them where the game reads them.

    tools/export.py ../sprites.json ../assets/images

The mapping is a JSON object from a path under ``build/`` to a file name in
the destination folder:

    {"tile/forest.png": "tile-forest.png", "sets/village.png": "tile-village.png"}

It lives in the game repository, not here, because which PNG a game uses and
what it calls it belong to the game. Every entry is checked before anything
is copied, so a bad mapping leaves the destination untouched.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import render  # noqa: E402
import sets  # noqa: E402
import sheet  # noqa: E402
from gridfile import REPO_ROOT, display  # noqa: E402

BUILD_DIR = REPO_ROOT / "build"
SHEET_DIR = REPO_ROOT / "sheets"


class ExportError(Exception):
    pass


def _reject_repeated_keys(pairs: list[tuple[str, object]]) -> dict[str, object]:
    # json.loads keeps the last of two equal keys, so a source written twice
    # would silently lose its first destination.
    keys = [key for key, _ in pairs]
    repeated = sorted({key for key in keys if keys.count(key) > 1})
    if repeated:
        raise ExportError(f"{', '.join(repeated)}: written more than once")
    return dict(pairs)


def load_mapping(path: Path) -> dict[str, str]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=_reject_repeated_keys)
    except FileNotFoundError:
        raise ExportError(f"{path}: not found") from None
    except json.JSONDecodeError as exc:
        raise ExportError(f"{path}: not valid JSON ({exc})") from None
    except ExportError as exc:
        raise ExportError(f"{path}: {exc}") from None
    if not isinstance(data, dict) or not data:
        raise ExportError(f"{path}: must be a non-empty JSON object")
    for source, name in data.items():
        if not isinstance(name, str):
            raise ExportError(f"{path}: {source} must map to a file name string")
    return data


def _problem(source: str, name: str, build_root: Path, dest_dir: Path, seen: dict[str, str]) -> str | None:
    if not (build_root / source).resolve().is_relative_to(build_root):
        return f"{source}: outside build/"
    if name in ("", ".", "..") or "/" in name or "\\" in name:
        return f"{source}: {name!r} is not a plain file name"
    if name in seen:
        return f"{source}: {name} is also the destination of {seen[name]}"
    if not (build_root / source).is_file():
        return f"{source}: not in build/ (run the build, or check the name)"
    destination = dest_dir / name
    if destination.exists() and not destination.is_file():
        return f"{source}: {name} is in the destination but is not a file"
    return None


def plan(mapping: dict[str, str], build_dir: Path, dest_dir: Path) -> list[tuple[Path, Path]]:
    """Pair every build output with its destination, or raise with every problem found."""
    build_root = build_dir.resolve()
    seen: dict[str, str] = {}
    problems: list[str] = []
    for source, name in mapping.items():
        problem = _problem(source, name, build_root, dest_dir, seen)
        if problem:
            problems.append(problem)
        seen.setdefault(name, source)
    if problems:
        raise ExportError("\n".join(problems))
    return [(build_root / source, dest_dir / name) for source, name in mapping.items()]


def export(mapping_path: Path, dest_dir: Path, build_dir: Path | None = None) -> list[Path]:
    if not dest_dir.is_dir():
        raise ExportError(f"{dest_dir}: not a folder")
    pairs = plan(load_mapping(mapping_path), build_dir or BUILD_DIR, dest_dir)
    for source, destination in pairs:
        # Checked up front, but the copy itself can still fail (a full disk, a
        # read-only file). The destination is under git, so a partial copy is
        # undone with git checkout; report it cleanly rather than stage it.
        try:
            shutil.copyfile(source, destination)
        except OSError as exc:
            raise ExportError(f"{destination.name}: copy failed ({exc})") from None
    return [destination for _, destination in pairs]


def build() -> int:
    """Render every asset, assemble every set and every sheet into a fresh build/.

    build/ is emptied first: a PNG left over from a grid that has since been
    renamed or deleted would otherwise pass for current output.
    """
    shutil.rmtree(BUILD_DIR, ignore_errors=True)
    steps = (
        lambda: render.main([str(REPO_ROOT / "assets")]),
        lambda: sets.main([]),
        *(lambda p=p: sheet.main([str(p)]) for p in sorted(SHEET_DIR.glob("*.txt"))),
    )
    for step in steps:
        code = step()
        if code:
            return code
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mapping", type=Path, help="JSON object from build/ paths to file names")
    parser.add_argument("destination", type=Path, help="folder the game reads its PNGs from")
    args = parser.parse_args(argv)

    code = build()
    if code:
        print("FAIL build", file=sys.stderr)
        return code
    try:
        written = export(args.mapping, args.destination)
    except ExportError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 1
    for path in written:
        print(f"wrote {display(path.resolve())}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
