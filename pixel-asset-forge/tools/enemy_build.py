#!/usr/bin/env python3
"""味方の完成したコマを色替えして、敵のシートを作る。

    tools/enemy_build.py enemy/dagger-red-m.json
    tools/enemy_build.py --all

レシピ（enemy/<id>.json）の形と、設計の経緯は
docs/superpowers/specs/2026-10-06-enemy-variants-design.md と
docs/superpowers/plans/2026-10-06-enemy-variants.md を参照。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import BACKGROUND, GridError, parse  # noqa: E402

Frame = list[list["str | None"]]

# 'o' は輪郭に使うので割り当てから外す
LETTERS = "abcdefghijklmnpqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
MAP_ENTRIES_PER_LINE = 4


class EnemyError(Exception):
    """レシピや元のコマが、組み立ての前提に合わない。"""


def read_frame(path: Path) -> Frame:
    grid = parse(path)
    frame: Frame = []
    for row in grid.rows:
        cells: list[str | None] = []
        for ch in row:
            if ch == BACKGROUND:
                cells.append(None)
            elif ch in grid.charmap:
                cells.append(grid.charmap[ch])
            else:
                raise EnemyError(f"{path.name}: 文字 {ch!r} に色が割り当てられていない")
        frame.append(cells)
    return frame


def recolor_frame(frame: Frame, mapping: dict[str, str]) -> Frame:
    """色名を同時に置き換える（A→B と B→A を同時に書いても入れ替わるだけ）。"""
    return [[mapping.get(c, c) if c is not None else None for c in row] for row in frame]


def serialize_frame(frame: Frame, note: str) -> str:
    if ":" in note:
        raise EnemyError(f"注記に半角コロンは書けない（ヘッダと読まれる）: {note!r}")
    names: list[str] = []
    for row in frame:
        for c in row:
            if c is not None and c not in names:
                names.append(c)
    letters = iter(LETTERS)
    chars = {name: "o" if name == "outline" else next(letters) for name in names}
    entries = [f"{chars[name]}={name}" for name in names]
    lines = [
        f"# {note}",
        "# type: unit",
        f"# size: {len(frame[0])}x{len(frame)}",
        "# light: upper-left",
        "# bg: transparent",
    ]
    for i in range(0, len(entries), MAP_ENTRIES_PER_LINE):
        lines.append("# map: " + " ".join(entries[i : i + MAP_ENTRIES_PER_LINE]))
    lines += ["".join(chars[c] if c is not None else BACKGROUND for c in row) for row in frame]
    return "\n".join(lines) + "\n"
