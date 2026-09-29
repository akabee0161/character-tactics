"""Parsing and machine checks for text grid asset files.

The grid file is the source of truth. PNGs under ``build/`` are derived.

File format::

    # type: face
    # size: 32x32
    # light: upper-left
    # bg: gradient:#1c1834->#323256
    # map: o=outline e=hair_hi f=hair_base
    # map: a=skin_hi b=skin_base
    ................................
    .............oooooo.............
    (... one line per pixel row ...)

Header lines start with ``#`` and may be interleaved with blank lines, but must
all appear before the first grid row. ``map`` may be repeated. Every non-``.``
character in the grid must be bound by ``map`` to a key of
``palette/master.json``. ``.`` is background and is painted per ``bg``.

A ``#`` line with no colon in it is a comment. One *with* a colon has to be a
well formed header, so a typo in a key is an error rather than a silent no-op.

A file may instead derive itself from another::

    # from: river_ne.txt
    # transform: mirror_x

It then carries no rows of its own and inherits every header it does not state.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

BACKGROUND = "."
REPO_ROOT = Path(__file__).resolve().parent.parent
PALETTE_PATH = REPO_ROOT / "palette" / "master.json"

HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
SIZE_RE = re.compile(r"^(\d+)x(\d+)$")
GRADIENT_RE = re.compile(r"^gradient:(#[0-9a-fA-F]{6})->(#[0-9a-fA-F]{6})$")
HEADER_RE = re.compile(r"^#\s*([a-z_]+)\s*:\s*(.*)$")
MAP_ENTRY_RE = re.compile(r"^(.)=([A-Za-z0-9_]+)$")

REQUIRED_HEADERS = ("type", "size", "map")
MAX_DERIVATION_DEPTH = 8


class GridError(Exception):
    """Raised when a file cannot be parsed far enough to be checked."""


def _mirror_x(rows: list[str]) -> list[str]:
    return [row[::-1] for row in rows]


def _mirror_y(rows: list[str]) -> list[str]:
    return rows[::-1]


def _rotate_180(rows: list[str]) -> list[str]:
    return [row[::-1] for row in rows[::-1]]


def _rotate_cw(rows: list[str]) -> list[str]:
    height, width = len(rows), len(rows[0])
    return ["".join(rows[height - 1 - j][i] for j in range(height)) for i in range(width)]


def _rotate_ccw(rows: list[str]) -> list[str]:
    height, width = len(rows), len(rows[0])
    return ["".join(rows[j][width - 1 - i] for j in range(height)) for i in range(width)]


# Deterministic transforms, per HANDOFF 2.4: a mirrored asset is derived by code
# rather than kept as a second copy that has to be edited in step.
#
# All of these move the light with the image. They only suit assets whose
# shading is symmetric about the axis in question - a river channel, not a face.
TRANSFORMS = {
    "mirror_x": _mirror_x,
    "mirror_y": _mirror_y,
    "rotate_180": _rotate_180,
    "rotate_cw": _rotate_cw,
    "rotate_ccw": _rotate_ccw,
}
SWAPS_AXES = {"rotate_cw", "rotate_ccw"}


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    return tuple(int(value[i : i + 2], 16) for i in (1, 3, 5))  # type: ignore[return-value]


def load_palette(path: Path = PALETTE_PATH) -> dict[str, tuple[int, int, int]]:
    """Read ``palette/master.json`` into ``name -> (r, g, b)``."""
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise GridError(f"palette not found: {path}") from None
    except json.JSONDecodeError as exc:
        raise GridError(f"{path}: invalid JSON: {exc}") from None
    if not isinstance(raw, dict):
        raise GridError(f"{path}: expected an object of name -> hex colour")

    palette: dict[str, tuple[int, int, int]] = {}
    for name, value in raw.items():
        if not isinstance(value, str) or not HEX_RE.match(value):
            raise GridError(f"{path}: {name!r} is not a '#rrggbb' string (got {value!r})")
        palette[name] = hex_to_rgb(value)
    if not palette:
        raise GridError(f"{path}: palette is empty")
    return palette


@dataclass(frozen=True)
class Background:
    """How ``.`` cells are painted."""

    kind: str  # "transparent" | "solid" | "gradient"
    top: tuple[int, int, int] = (0, 0, 0)
    bottom: tuple[int, int, int] = (0, 0, 0)

    @property
    def has_alpha(self) -> bool:
        return self.kind == "transparent"

    def color_at(self, y: int, height: int) -> tuple[int, int, int, int]:
        if self.kind == "transparent":
            return (0, 0, 0, 0)
        if self.kind == "solid" or height < 2:
            return (*self.top, 255)
        t = y / (height - 1)
        return (*(int(a + (b - a) * t) for a, b in zip(self.top, self.bottom)), 255)  # type: ignore[return-value]


def parse_background(spec: str) -> Background:
    if spec == "transparent":
        return Background("transparent")
    if HEX_RE.match(spec):
        return Background("solid", hex_to_rgb(spec))
    gradient = GRADIENT_RE.match(spec)
    if gradient:
        return Background("gradient", hex_to_rgb(gradient.group(1)), hex_to_rgb(gradient.group(2)))
    raise GridError(
        f"unsupported bg {spec!r}; expected 'transparent', '#rrggbb', "
        "or 'gradient:#rrggbb->#rrggbb'"
    )


@dataclass
class Grid:
    path: Path
    type: str
    width: int
    height: int
    rows: list[str]
    charmap: dict[str, str]
    background: Background
    max_colors: int | None = None
    headers: dict[str, str] = field(default_factory=dict)

    @property
    def name(self) -> str:
        return self.path.stem

    def used_chars(self) -> set[str]:
        return {ch for row in self.rows for ch in row} - {BACKGROUND}

    def used_colors(self, palette: dict[str, tuple[int, int, int]]) -> set[tuple[int, int, int]]:
        """Distinct RGB values actually painted, background excluded."""
        return {
            palette[name]
            for ch in self.used_chars()
            if (name := self.charmap.get(ch)) in palette
        }


def parse(path: Path, stack: tuple[Path, ...] = ()) -> Grid:
    """Parse a grid file. Raises :class:`GridError` if the header is unusable.

    ``stack`` carries the chain of files already being resolved through ``from``,
    so a cycle is reported instead of recursing forever.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise GridError(f"{path}: cannot read: {exc}") from None

    headers, charmap, rows = _read(path, text)

    if "from" in headers:
        headers, charmap, rows = _derive(path, headers, charmap, rows, stack)

    missing = [key for key in REQUIRED_HEADERS if key not in headers]
    if missing:
        raise GridError(f"{path}: missing required header(s): {', '.join(missing)}")
    if not rows:
        raise GridError(f"{path}: no grid rows found")

    size = SIZE_RE.match(headers["size"])
    if not size:
        raise GridError(f"{path}: size {headers['size']!r} is not 'WxH'")
    width, height = int(size.group(1)), int(size.group(2))
    if width < 1 or height < 1:
        raise GridError(f"{path}: size must be positive, got {width}x{height}")

    max_colors = None
    if "max_colors" in headers:
        try:
            max_colors = int(headers["max_colors"])
        except ValueError:
            raise GridError(f"{path}: max_colors {headers['max_colors']!r} is not an integer") from None

    return Grid(
        path=path,
        type=headers["type"],
        width=width,
        height=height,
        rows=rows,
        charmap=charmap,
        background=parse_background(headers.get("bg", "transparent")),
        max_colors=max_colors,
        headers=headers,
    )


def _read(path: Path, text: str) -> tuple[dict[str, str], dict[str, str], list[str]]:
    """Split a file into headers, char map and grid rows. No semantics yet."""
    headers: dict[str, str] = {}
    charmap: dict[str, str] = {}
    rows: list[str] = []

    for lineno, line in enumerate(text.splitlines(), start=1):
        line = line.rstrip()
        if line.startswith("#"):
            if rows:
                raise GridError(f"{path}:{lineno}: header line after grid rows started")
            header = HEADER_RE.match(line)
            if not header:
                if ":" in line:
                    raise GridError(f"{path}:{lineno}: malformed header line {line!r}")
                continue  # a plain '#' line is a comment

            key, value = header.group(1), header.group(2).strip()
            if key == "map":
                headers.setdefault("map", "")
                for entry in value.split():
                    pair = MAP_ENTRY_RE.match(entry)
                    if not pair:
                        raise GridError(f"{path}:{lineno}: malformed map entry {entry!r}")
                    ch, color = pair.group(1), pair.group(2)
                    if ch == BACKGROUND:
                        raise GridError(f"{path}:{lineno}: '.' is background and cannot be mapped")
                    if ch in charmap and charmap[ch] != color:
                        raise GridError(
                            f"{path}:{lineno}: {ch!r} mapped twice "
                            f"({charmap[ch]!r} then {color!r})"
                        )
                    charmap[ch] = color
            else:
                headers[key] = value
            continue
        if not line:
            continue
        rows.append(line)

    return headers, charmap, rows


def _derive(
    path: Path,
    headers: dict[str, str],
    charmap: dict[str, str],
    rows: list[str],
    stack: tuple[Path, ...],
) -> tuple[dict[str, str], dict[str, str], list[str]]:
    """Build a grid from another one plus a transform.

    The derived file carries no rows of its own; everything it does not state is
    inherited from its source.
    """
    if rows:
        raise GridError(f"{path}: a file with 'from' must have no grid rows of its own")

    name = headers.get("transform")
    if name is None:
        raise GridError(f"{path}: 'from' needs a 'transform'")
    if name not in TRANSFORMS:
        raise GridError(f"{path}: unknown transform {name!r}; known: {', '.join(sorted(TRANSFORMS))}")

    source_path = (path.parent / headers["from"]).resolve()
    if source_path in stack:
        chain = " -> ".join(p.name for p in (*stack, source_path))
        raise GridError(f"{path}: 'from' forms a cycle: {chain}")
    if len(stack) >= MAX_DERIVATION_DEPTH:
        raise GridError(f"{path}: 'from' nested deeper than {MAX_DERIVATION_DEPTH}")

    source = parse(source_path, stack=(*stack, path.resolve()))

    inherited = dict(source.headers)
    inherited.pop("from", None)
    inherited.pop("transform", None)
    if name in SWAPS_AXES:
        inherited["size"] = f"{source.height}x{source.width}"
    merged = {**inherited, **headers}

    return merged, (charmap or dict(source.charmap)), TRANSFORMS[name](source.rows)


def check(grid: Grid, palette: dict[str, tuple[int, int, int]]) -> list[str]:
    """Return every problem found, so one run reports all of them."""
    errors: list[str] = []

    if len(grid.rows) != grid.height:
        errors.append(f"height {len(grid.rows)}, expected {grid.height}")
    for y, row in enumerate(grid.rows):
        if len(row) != grid.width:
            errors.append(f"row {y}: length {len(row)}, expected {grid.width}")

    for name in sorted(set(grid.charmap.values())):
        if name not in palette:
            errors.append(f"map references {name!r}, which is not in the master palette")

    unknown: dict[str, int] = {}
    for y, row in enumerate(grid.rows):
        for ch in set(row) - {BACKGROUND}:
            if ch not in grid.charmap:
                unknown.setdefault(ch, y)
    for ch, y in sorted(unknown.items()):
        errors.append(f"row {y}: character {ch!r} is not bound by 'map'")

    if grid.max_colors is not None and not errors:
        used = len(grid.used_colors(palette))
        if used > grid.max_colors:
            errors.append(f"uses {used} colours, over the declared max_colors {grid.max_colors}")

    return errors


def display(path: Path) -> Path:
    """Path as written in messages: repo-relative when it is inside the repo."""
    return path.relative_to(REPO_ROOT) if path.is_relative_to(REPO_ROOT) else path


def find_grids(root: Path) -> list[Path]:
    """All ``*.txt`` grids under ``root``, in stable order."""
    return sorted(p for p in root.rglob("*.txt") if p.is_file())
