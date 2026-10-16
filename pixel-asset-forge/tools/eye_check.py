#!/usr/bin/env python3
"""芯の目の置き方を確かめる（2026-10-16。方針の確認 12）。

    .venv/bin/python tools/eye_check.py checks/gau.json

目と輪郭は同じ outline の色なので、設定ファイルの eyes に向きごとの目の行（[上の行, 下の行]、目の無い向きは null）を書く。
その行の輪郭の画素のうち、左右のどちらかが顔の肌（colours.face）のものを目とみなし、

- もう片方の隣が顔の肌でない目（髪・かぶり物・顔の輪郭に横で接する。types/unit/SPEC.md「自己チェック」②）
- 目の上端の行が、同じ状態のコマの間で向きによってそろわないもの（「立ち絵4方向の規約」の顔）
- 目のある向きなのに目が見つからないコマ

を落とす。顔の左右の縁の輪郭も「片側だけ肌の輪郭」なので目とみなされる（設計で予想した誤検出。数えて採否を決める）。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import OUTLINE, UnitConfig, points, run_check  # noqa: E402


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    tops: dict[str, dict[str, int]] = {}
    for name, frame in cfg.frames.items():
        rows = cfg.eyes[frame.direction]
        if rows is None:
            continue
        pixels = frame.core_pixels()
        eyes, bad = set(), set()
        for (x, y), colour in pixels.items():
            if colour != OUTLINE or not rows[0] <= y <= rows[1]:
                continue
            left, right = pixels.get((x - 1, y)) in cfg.face, pixels.get((x + 1, y)) in cfg.face
            if left or right:
                eyes.add((x, y))
                if not (left and right):
                    bad.add((x, y))
        if not eyes:
            failures.append((name, f"目が見つからない（y={rows[0]}〜{rows[1]}）"))
            continue
        if bad:
            failures.append((name, f"目の左右の片方が顔の肌でない {len(bad)} 件: {points(bad)}"))
        tops.setdefault(frame.state, {})[frame.direction] = min(y for _x, y in eyes)
    for state, by_direction in tops.items():
        if len(set(by_direction.values())) > 1:
            detail = " ".join(f"{d}={y}" for d, y in by_direction.items())
            failures.append((state, f"目の上端の行が向きでそろわない: {detail}"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "目: ok")


if __name__ == "__main__":
    raise SystemExit(main())
