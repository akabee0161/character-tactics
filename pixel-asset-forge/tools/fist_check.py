#!/usr/bin/env python3
"""拳の部品の大きさと、握る部品に接しているかを確かめる（2026-10-16。確認 81）。

    .venv/bin/python tools/fist_check.py checks/gau.json

設定ファイルの parts で fist の部品について（types/unit/SPEC.md「武器を握る手は、他の手と同じ大きさ」「持ち物を持つ手を描く」）:

- 手の肌（compose の hand_colours）の画素の外接矩形「横x縦」が fist_sizes のどれでもないもの
- grips のある拳が、握る部品の画素と、重なりも上下左右・斜めの隣り合いもしていないもの
  （どちらかが空の部品のコマは見ない。体に隠れて何も描かないコマ）

拳の手の肌が無い（空の部品の）コマは、大きさを見ない。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import UnitConfig, run_check  # noqa: E402

TOUCH = tuple((dx, dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1))


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    for name, frame in cfg.frames.items():
        for key, part in frame.parts.items():
            if not cfg.role(key, "fist"):
                continue
            pixels = part.pixels()
            skin = [p for p, colour in pixels.items() if colour in cfg.hand]
            sizes = cfg.role(key, "fist_sizes")
            if skin and sizes:
                xs, ys = [x for x, _ in skin], [y for _, y in skin]
                size = f"{max(xs) - min(xs) + 1}x{max(ys) - min(ys) + 1}"
                if size not in sizes:
                    failures.append((name, f"{key} の大きさ {size}（{', '.join(sizes)} のどれでもない）"))
            grips = cfg.role(key, "grips")
            if grips and pixels:  # 空の拳（体に隠れて何も描かないコマ）は握りを見ない
                held = frame.parts.get(grips)
                if held is None:
                    failures.append((name, f"{key} が握る {grips} がこのコマに無い"))
                    continue
                theirs = held.pixels()
                if pixels and theirs and not any((x + dx, y + dy) in theirs for x, y in pixels for dx, dy in TOUCH):
                    failures.append((name, f"{key} が {grips} に接していない"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "拳の大きさと握り: ok")


if __name__ == "__main__":
    raise SystemExit(main())
