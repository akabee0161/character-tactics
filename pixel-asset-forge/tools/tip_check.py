#!/usr/bin/env python3
"""組んだコマで、輪郭に囲まれた1画素（尖った先端を1画素で表したもの）を出す（2026-10-16。方針の確認 6）。

    .venv/bin/python tools/tip_check.py checks/ines.json

組んだコマ（compose の結果）で、輪郭でない色の画素のうち、上下左右がすべて輪郭のものを落とす
（types/unit/SPEC.md「自己チェック」②「尖った先端を、輪郭に囲まれた1画素で表していないか」）。
コマの外は輪郭とみなさない。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import OUTLINE, UnitConfig, points, run_check  # noqa: E402

N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    for name, frame in cfg.frames.items():
        pixels = frame.composed()
        found = {p for p, colour in pixels.items() if colour != OUTLINE
                 and all(pixels.get((p[0] + dx, p[1] + dy)) == OUTLINE for dx, dy in N4)}
        if found:
            failures.append((name, f"輪郭に囲まれた1画素 {len(found)} 件: {points(found)}"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "1画素の先端: ok")


if __name__ == "__main__":
    raise SystemExit(main())
