#!/usr/bin/env python3
"""芯以外の部品が、同じコマの芯と同じ文字を使っていないかを確かめる（2026-10-16。方針の確認 9）。

    .venv/bin/python tools/part_chars.py checks/roran.json

持ち物の部品には専用の文字を割り当てる（types/unit/SPEC.md「立ち絵4方向の規約」）。同じ文字だと、
# map: 行で片方だけ色を変えられない。輪郭 o と、fist の部品の手の肌（compose の hand_colours）の文字は除く。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import UnitConfig, run_check  # noqa: E402

SHARED_OK = {"o"}


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    for name, frame in cfg.frames.items():
        core = frame.core.used_chars()
        for key, part in frame.parts.items():
            shared = (part.grid.used_chars() & core) - SHARED_OK
            if cfg.role(key, "fist"):
                shared = {ch for ch in shared if part.grid.charmap[ch] not in cfg.hand}
            if shared:
                failures.append((name, f"{key} が芯と同じ文字 {''.join(sorted(shared))} を使う"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "部品の文字: ok")


if __name__ == "__main__":
    raise SystemExit(main())
