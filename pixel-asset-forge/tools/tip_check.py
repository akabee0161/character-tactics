#!/usr/bin/env python3
"""刃・鏃の先端を、輪郭に囲まれた1画素で描いていないかを、部品ごとの形で確かめる（2026-10-16。方針の確認 6）。

    .venv/bin/python tools/tip_check.py checks/ines.json

設定ファイルの parts で blade（刃・鏃の文字）を書いた部品について、部品のファイルを単品で見て、
blade の画素のうち上下左右がすべて輪郭のものを落とす（types/item/SPEC.md「尖った先端を、輪郭に囲まれた1画素で表さない」、
types/unit/SPEC.md「自己チェック」②）。部品の外（透明・コマの外）は輪郭とみなさない。同じ部品のファイルは1回だけ見る。
名前は部品のファイル名（拡張子なし）で出す。

- 見るのを刃・鏃の文字に絞ったのは、鍔の端・斜めに描いた矢や弦の1画素・足先も同じ形になるが、先端ではなく
  剣や物の形をよく表しているため（2026-10-16 依頼者の判断）
- 組んだコマでなく部品で見るのは、部品では2画素の先端が手前の部品に隠れて1画素に見えるのは、
  本来1画素ではないため（イネスの up の待機2。2026-10-17 依頼者の判断）

何を先端とみなし、どう描くかはドット絵全体の課題として ISSUES.md に残してある（弓の端のように刃の文字でない先端は見ない）。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import OUTLINE, UnitConfig, points, run_check  # noqa: E402

N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    seen = set()
    for frame in cfg.frames.values():
        for key, part in frame.parts.items():
            blade = set(cfg.role(key, "blade") or "")
            if not blade or part.layer.part in seen:
                continue
            seen.add(part.layer.part)
            grid = part.grid

            def colour(x: int, y: int) -> str | None:
                if not (0 <= y < grid.height and 0 <= x < grid.width):
                    return None
                return grid.charmap.get(grid.rows[y][x])

            found = {(x, y) for y, row in enumerate(grid.rows) for x, ch in enumerate(row)
                     if ch in blade and all(colour(x + dx, y + dy) == OUTLINE for dx, dy in N4)}
            if found:
                failures.append((part.layer.part.stem,
                                 f"{key} の刃の先が輪郭に囲まれた1画素 {len(found)} 件: {points(found)}"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "1画素の先端: ok")


if __name__ == "__main__":
    raise SystemExit(main())
