#!/usr/bin/env python3
"""被り物が頭を覆っている高さで、髪が被り物の外に出ていないかを確かめる（2026-11-04 依頼者。試し）。

    .venv/bin/python tools/head_cover_check.py checks/axe-bandit-a-f.json

同じコマに、被り物（headgear の色の部品）と髪（hair の色の部品）の両方を置くとき、部品の形で（組んだコマの
隠れ方に左右されずに）見る。被り物の「縁」は、被り物（輪郭を含む）が芯の頭の横幅（その行の芯の左端〜右端）を
覆っている一番下の行。縁から上の行で、髪の画素（輪郭を含む）が、その行の被り物の左端より左・右端より右にあるか、
被り物の無い行にあれば落とす。縁より下は、被り物の下から出た髪が広がってよい。
バンダナの結び目のように、頭より細く下がる所は縁に数えない。被り物が頭の横幅を一度も覆わない組み合わせは見ない。
弱点: 行の左端と右端だけを見るので、角のように頭から離れた飾りがある行では、その間の髪のはみ出しを見ない。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import palette  # noqa: E402
from unit_config import OUTLINE, UnitConfig, kind_of_use, points, run_check  # noqa: E402


def _kinds(pal, part) -> set[str]:
    return {kind_of_use(pal, name, part.layer.part) for name in part.pixels().values() if name != OUTLINE}


def _rows(pixels) -> dict[int, tuple[int, int]]:
    rows: dict[int, list[int]] = {}
    for x, y in pixels:
        rows.setdefault(y, []).append(x)
    return {y: (min(xs), max(xs)) for y, xs in rows.items()}


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    pal = palette.load()
    found: dict[tuple[str, str], tuple[int, set]] = {}
    for frame in cfg.frames.values():
        heads = [p for p in frame.parts.values() if "headgear" in _kinds(pal, p)]
        hairs = [p for p in frame.parts.values() if "hair" in _kinds(pal, p)]
        if not heads or not hairs:
            continue
        core = _rows(frame.core_pixels())
        for head in heads:
            cover = _rows(head.pixels())
            rims = [y for y, (lo, hi) in cover.items() if y in core and lo <= core[y][0] and hi >= core[y][1]]
            if not rims:
                continue
            rim = max(rims)
            for hair in hairs:
                out = {(x, y) for x, y in hair.pixels() if y <= rim
                       and (y not in cover or x < cover[y][0] or x > cover[y][1])}
                key = (hair.layer.part.stem, head.layer.part.stem)
                prev = found.get(key, (rim, set()))
                found[key] = (prev[0], prev[1] | out)
    return [(f"{h} と {g}", f"被り物の縁 y={rim} より上で、髪が被り物の外に出る {len(px)} 件: {points(px)}")
            for (h, g), (rim, px) in sorted(found.items()) if px]


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "髪が被り物の内側: ok")


if __name__ == "__main__":
    raise SystemExit(main())
