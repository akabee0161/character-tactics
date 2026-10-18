#!/usr/bin/env python3
"""拳と芯以外の部品（武器・弓・矢・盾）を単品で見て、輪郭で閉じているかを確かめる（2026-10-16。確認 33）。

    .venv/bin/python tools/part_outline.py checks/ines.json

部品は単品として完全に描く（types/unit/SPEC.md「部品で組む規約」）。部品のファイルごとに、
輪郭でない色の画素のうち、上下左右のどれかが透明かコマの外のものを落とす。
体の上で輪郭を付けない文字（弓の弦など）は、設定ファイルの parts の open_chars に書いて外す。
拳は compose.py の hand: true が、芯は body_check.py が見る。名前は部品のファイル名（拡張子なし）で出す。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import BACKGROUND  # noqa: E402
from unit_config import OUTLINE, UnitConfig, points, run_check  # noqa: E402

N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    seen = set()
    for frame in cfg.frames.values():
        for key, part in frame.parts.items():
            if cfg.role(key, "fist") or part.layer.part in seen:
                continue
            seen.add(part.layer.part)
            grid = part.grid
            skip = set(cfg.role(key, "open_chars") or "")

            def at(x: int, y: int) -> str:
                return grid.rows[y][x] if 0 <= x < grid.width and 0 <= y < grid.height else BACKGROUND

            found = {(x, y) for y, row in enumerate(grid.rows) for x, ch in enumerate(row)
                     if ch != BACKGROUND and ch not in skip and grid.charmap[ch] != OUTLINE
                     and any(at(x + dx, y + dy) == BACKGROUND for dx, dy in N4)}
            if found:
                failures.append((part.layer.part.stem, f"輪郭で閉じていない画素 {len(found)} 件: {points(found)}"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "部品が閉じている: ok")


if __name__ == "__main__":
    raise SystemExit(main())
