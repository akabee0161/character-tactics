#!/usr/bin/env python3
"""item の長い持ち物の形が、軸 x+y=15 について左右対称かを確かめる（2026-10-16）。

    tools/item_check.py                        # assets/item のすべて（正面向きの物を除く）
    tools/item_check.py assets/item/sword.txt  # 指定したファイル（正面向きの物も見る）

types/item/SPEC.md「形は軸について左右対称にする。軸 x+y=15 で折り返して形（不透明な画素）が重なること」。
色は光源に従うので比べない（左上側が *_hi、右下側が *_shadow）。不透明かどうかだけを比べる。
16x16 なら画素 (x, y) を (15-y, 15-x) へ折り返す。折り返した先が透明な画素を出す。
正面向きの物（FRONT_FACING）は斜め置きでないので、既定の対象から外す（SPEC「未確定」: 長くない小物の向き）。
既定はそれ以外をすべて見るので、正面向きの item を足したら FRONT_FACING にも足す（足さないと FAIL で気付く）。
終了コード: 0 すべて対称、1 対称でない item がある、2 読めない・item でない・正方形でないファイルがある。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import BACKGROUND, REPO_ROOT, GridError, find_grids, parse  # noqa: E402

ITEM_DIR = REPO_ROOT / "assets" / "item"
FRONT_FACING = {"chest"}


class ItemCheckError(Exception):
    """この検査の前提（正方形の item）に合わない。"""


def asymmetric(grid) -> list[tuple[int, int]]:
    if grid.type != "item":
        raise ItemCheckError(f"{grid.path.name}: type が item でない（{grid.type}）")
    if grid.width != grid.height:
        raise ItemCheckError(f"{grid.path.name}: 正方形でない（{grid.width}x{grid.height}）")
    n = grid.width
    opaque = {(x, y) for y, row in enumerate(grid.rows) for x, ch in enumerate(row) if ch != BACKGROUND}
    return sorted(((x, y) for x, y in opaque if (n - 1 - y, n - 1 - x) not in opaque), key=lambda p: (p[1], p[0]))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("paths", nargs="*", type=Path, help="item のファイル（省くと assets/item の正面向き以外すべて）")
    args = parser.parse_args(argv)
    paths = args.paths or [p for p in find_grids(ITEM_DIR) if p.stem not in FRONT_FACING]

    bad = broken = 0
    for path in paths:  # 読めないファイルがあっても、残りの報告は出す
        try:
            found = asymmetric(parse(path))
        except (GridError, ItemCheckError) as exc:
            print(f"error: {exc}", file=sys.stderr)
            broken += 1
            continue
        if found:
            bad += 1
            print(f"FAIL {path.name}: 軸 x+y=15 で折り返した先が透明な画素 {len(found)}: "
                  + " ".join(f"({x},{y})" for x, y in found))
        else:
            print(f"ok   {path.name}")
    return 2 if broken else 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
