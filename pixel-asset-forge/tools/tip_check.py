#!/usr/bin/env python3
"""刃・鏃の先端を、輪郭に囲まれた1画素で描いていないかを確かめる（2026-10-16。方針の確認 6）。

    .venv/bin/python tools/tip_check.py checks/ines.json

設定ファイルの parts で blade（刃・鏃の文字）を書いた部品について、組んだコマ（compose の結果）で見えている
blade の画素のうち、上下左右がすべて輪郭のものを落とす（types/item/SPEC.md「尖った先端を、輪郭に囲まれた1画素で表さない」、
types/unit/SPEC.md「自己チェック」②）。コマの外は輪郭とみなさない。手前の部品に隠れた刃の画素は見ない。

見るのを刃・鏃の文字に絞ったのは、鍔の端・斜めに描いた矢や弦の1画素・足先も同じ形になるが、先端ではなく
剣や物の形をよく表しているため（2026-10-16 依頼者の判断）。何を先端とみなし、どう描くかはドット絵全体の課題として
ISSUES.md に残してある（弓の端のように刃の文字でない先端は見ない）。
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
        for key, part in frame.parts.items():
            blade = set(cfg.role(key, "blade") or "")
            found = {(x, y) for (x, y), ch in part.chars().items()
                     if ch in blade and 0 <= y < len(frame.rows) and 0 <= x < len(frame.rows[y])
                     and frame.rows[y][x] == ch
                     and all(pixels.get((x + dx, y + dy)) == OUTLINE for dx, dy in N4)}
            if found:
                failures.append((name, f"{key} の刃の先が輪郭に囲まれた1画素 {len(found)} 件: {points(found)}"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "1画素の先端: ok")


if __name__ == "__main__":
    raise SystemExit(main())
