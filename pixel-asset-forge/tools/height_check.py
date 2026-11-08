#!/usr/bin/env python3
"""芯（体）の背丈が決まりの範囲かを確かめる（2026-10-16。方針の確認 5。2026-11-06 に 48px に対応）。

    .venv/bin/python tools/height_check.py checks/gau.json

芯の部品の一番上の画素の行から足元までの行数（足元 − 上端 + 1）が、決まりの範囲でないコマを落とす
（types/unit/SPEC.md「確定している規約」）。32px のコマは足元 y=30・24〜26px、48px のコマは足元 y=46・36〜39px
（tools/unit_scale.py）。足元がその行にあるかは sheet.py のプレビューが測る。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import UnitConfig, run_check  # noqa: E402


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    s = cfg.scale
    failures = []
    for name, frame in cfg.frames.items():
        ys = [y for _x, y in frame.core_pixels()]
        if not ys:
            failures.append((name, "芯に画素が無い"))
            continue
        height = s.foot - min(ys) + 1
        if not s.min_height <= height <= s.max_height:
            failures.append((name, f"背丈 {height}px（芯の上端 y={min(ys)}。{s.min_height}〜{s.max_height}px にする）"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "背丈: ok")


if __name__ == "__main__":
    raise SystemExit(main())
