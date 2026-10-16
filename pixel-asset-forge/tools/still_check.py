#!/usr/bin/env python3
"""待機の2コマ目・歩き・すべてのコマで、動かしてはいけない所が base から動いていないかを確かめる
（2026-10-16。方針の確認 3 と 4）。

    .venv/bin/python tools/still_check.py checks/roran.json

同じ向きの <向き>_base と比べる（types/unit/SPEC.md「アニメの規約」）:

- idle2: 芯が base と違う画素のうち、base の拳（fist の部品）の手の肌の位置に無いもの
  （拳がどいて見えるようになった胴を埋めた所は通す）。moves でない部品が base と違うもの
- walk_*: 芯の y<=27 が base と違う画素（脚 y=28〜30 だけを動かす）。部品が base と違うもの（上半身と剣は base のまま）
- すべてのコマ: fixed の部品（盾）が base と違うもの（盾はどのコマでも base の位置から動かさない）

部品は色名と位置（dx・dy でずらした後）で比べる。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import UnitConfig, points, run_check  # noqa: E402

LEG_TOP = 28


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    for name, frame in cfg.frames.items():
        base = cfg.frames.get(f"{frame.direction}_base")
        if base is None:
            failures.append((name, f"比べる {frame.direction}_base が無い"))
            continue
        if frame is base:
            continue
        mine, theirs = frame.core_pixels(), base.core_pixels()
        moved = {p for p in mine.keys() | theirs.keys() if mine.get(p) != theirs.get(p)}
        walk = frame.state.startswith("walk")
        if frame.state == "idle2":
            freed = {p for key, part in base.parts.items() if cfg.role(key, "fist")
                     for p, colour in part.pixels().items() if colour in cfg.hand}
            bad = moved - freed
            if bad:
                failures.append((name, f"芯が base と違う画素 {len(bad)} 件: {points(bad)}"))
        elif walk:
            bad = {p for p in moved if p[1] < LEG_TOP}
            if bad:
                failures.append((name, f"芯の y<{LEG_TOP} が base と違う画素 {len(bad)} 件: {points(bad)}"))
        for key, part in frame.parts.items():
            fixed = cfg.role(key, "fixed")
            if not (fixed or walk or (frame.state == "idle2" and not cfg.role(key, "moves"))):
                continue
            if key not in base.parts:
                failures.append((name, f"{key} が {base.name} に無い"))
            elif part.pixels() != base.parts[key].pixels():
                rule = "どのコマでも動かさない" if fixed else "このコマでは動かさない"
                failures.append((name, f"{key} が base と違う（{rule}部品）"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "動かない所: ok")


if __name__ == "__main__":
    raise SystemExit(main())
