#!/usr/bin/env python3
"""芯（体）の背丈が 24〜26px かを確かめる（2026-10-16。方針の確認 5）。

    .venv/bin/python tools/height_check.py checks/gau.json

芯の部品の一番上の画素の行から、足元 y=30 までの行数（30 − 上端 + 1）が 24〜26 でないコマを落とす
（types/unit/SPEC.md「確定している規約」）。足元が y=30 にあるかは sheet.py のプレビューが測る。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import UnitConfig, run_check  # noqa: E402

FOOT = 30
MIN_HEIGHT, MAX_HEIGHT = 24, 26


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    for name, frame in cfg.frames.items():
        ys = [y for _x, y in frame.core_pixels()]
        if not ys:
            failures.append((name, "芯に画素が無い"))
            continue
        height = FOOT - min(ys) + 1
        if not MIN_HEIGHT <= height <= MAX_HEIGHT:
            failures.append((name, f"背丈 {height}px（芯の上端 y={min(ys)}。{MIN_HEIGHT}〜{MAX_HEIGHT}px にする）"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "背丈: ok")


if __name__ == "__main__":
    raise SystemExit(main())
