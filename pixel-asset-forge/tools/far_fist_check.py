#!/usr/bin/env python3
"""体の奥で武器・盾を握る拳を、影の肌の色だけで描いているかを確かめる（2026-11-04 依頼者）。

    .venv/bin/python tools/far_fist_check.py checks/roran.json

設定ファイルの parts で fist かつ grips（握る部品）のある拳の部品について、そのコマの重なり順で芯（CORE）より奥にあり、
向きが up（背面）でないとき、手の肌（パレットの種類 skin）の画素がすべて影の色（用途の色の名前が _shadow で終わる）か
を見る。体の奥の手は影の色だけで描く（2026-10-08 に斧・槍の敵で依頼者が指摘した決まりを、2026-11-04 に全ユニットへ）。
背面は拳がみな体の向こうにあるので見ない。部品の形で見るので、組んだコマで拳が体に隠れているかは関係しない。
武器を握らない空き手は見ない。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import palette  # noqa: E402
from unit_config import CORE, UnitConfig, kind_of_use, run_check  # noqa: E402


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    pal = palette.load()
    found: dict[str, set[str]] = {}
    for frame in cfg.frames.values():
        if frame.direction == "up" or CORE not in frame.order:
            continue
        for key, part in frame.parts.items():
            if not (cfg.role(key, "fist") and cfg.role(key, "grips")) or key not in frame.order:
                continue
            if frame.order.index(key) > frame.order.index(CORE):
                continue
            bright = {n for n in part.pixels().values()
                      if kind_of_use(pal, n, part.layer.part) == "skin" and not n.endswith("_shadow")}
            if bright:
                found.setdefault(part.layer.part.stem, set()).update(bright)
    return [(stem, f"体の奥の拳に明るい肌の色 {', '.join(sorted(names))}（影の色だけで描く）")
            for stem, names in sorted(found.items())]


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "体の奥の拳は影の色: ok")


if __name__ == "__main__":
    raise SystemExit(main())
