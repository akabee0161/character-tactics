#!/usr/bin/env python3
"""拳と芯以外の部品（武器・弓・矢・盾）を単品で見て、輪郭で閉じているかを確かめる（2026-10-16。確認 33）。

    .venv/bin/python tools/part_outline.py checks/ines.json

部品は単品として完全に描く（types/unit/SPEC.md「部品で組む規約」）。部品のファイルごとに、
輪郭でない色の画素のうち、上下左右のどれかが透明かコマの外のものを落とす。
体の上で輪郭を付けない文字（弓の弦など）は、設定ファイルの parts の open_chars に書いて外す。
髪（hair）と装飾品（ornament）の色の画素は、透明に接する所が、その部品の絵を使うすべてのコマで芯の上
（芯が透明でない）なら輪郭なしで通す（体の上の縁。open_chars に書かない）。ひとつでも芯の外のコマが
あれば落とす。かぶり物（headgear。兜・鼻当て・バンダナ・頭巾）は体の上でも全周を輪郭で閉じる（2026-10-30 依頼者）。
拳は compose.py の hand: true が、芯は body_check.py が見る。名前は部品のファイル名（拡張子なし）で出す。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import palette  # noqa: E402
from gridfile import BACKGROUND  # noqa: E402
from unit_config import OUTLINE, UnitConfig, kind_of_use, points, run_check  # noqa: E402

N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


EDGE_KINDS = ("hair", "ornament")  # 体の上なら輪郭なしの縁を許す種類


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    uses = {}  # 部品のファイル → その絵を使うコマでの (key, 部品, 芯)
    for frame in cfg.frames.values():
        for key, part in frame.parts.items():
            if not cfg.role(key, "fist"):
                uses.setdefault(part.layer.part, []).append((part, frame))
    pal = palette.load()
    failures = []
    for entries in uses.values():
        part = entries[0][0]
        grid = part.grid
        skip = set(cfg.role(part.name, "open_chars") or "")
        edge_ok = {ch for ch, use in grid.charmap.items() if kind_of_use(pal, use, part.layer.part) in EDGE_KINDS}
        cores = [(p.layer.dx, p.layer.dy, frame.core) for p, frame in entries]

        def at(x: int, y: int) -> str:
            return grid.rows[y][x] if 0 <= x < grid.width and 0 <= y < grid.height else BACKGROUND

        def over_core(x: int, y: int) -> bool:
            """(x, y) の透明な所が、この絵を使うすべてのコマで芯の上か。"""
            for dx, dy, core in cores:
                cx, cy = x + dx, y + dy
                if not (0 <= cx < core.width and 0 <= cy < core.height) or core.rows[cy][cx] == BACKGROUND:
                    return False
            return True

        found = set()
        for y, row in enumerate(grid.rows):
            for x, ch in enumerate(row):
                if ch == BACKGROUND or ch in skip or grid.charmap[ch] == OUTLINE:
                    continue
                gaps = [(x + dx, y + dy) for dx, dy in N4 if at(x + dx, y + dy) == BACKGROUND]
                if gaps and not (ch in edge_ok and all(over_core(gx, gy) for gx, gy in gaps)):
                    found.add((x, y))
        if found:
            failures.append((part.layer.part.stem, f"輪郭で閉じていない画素 {len(found)} 件: {points(found)}"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "部品が閉じている: ok")


if __name__ == "__main__":
    raise SystemExit(main())
