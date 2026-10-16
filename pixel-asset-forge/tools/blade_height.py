#!/usr/bin/env python3
"""攻撃以外のコマで、切っ先が頭頂より上に出ていないかを確かめる（2026-10-16。方針の確認 2）。

    .venv/bin/python tools/blade_height.py checks/roran.json

設定ファイルの parts で weapon の部品の、blade の文字の画素（部品のファイルで測る。体に隠れる所も含む）の
一番上が、y=5 より上（idle2 は y=3 より上）にあれば落とす。攻撃（atk_*）のコマは y=0 まで出てよいので見ない
（types/unit/SPEC.md「立ち絵4方向の規約」「アニメの規約」）。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import UnitConfig, run_check  # noqa: E402

TOP = 5
IDLE2_TOP = 3


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    for name, frame in cfg.frames.items():
        if frame.state.startswith("atk"):
            continue
        limit = IDLE2_TOP if frame.state == "idle2" else TOP
        for key, part in frame.parts.items():
            if not cfg.role(key, "weapon"):
                continue
            blade = set(cfg.role(key, "blade"))
            ys = [y for (_x, y), ch in part.chars().items() if ch in blade]
            if ys and min(ys) < limit:
                failures.append((name, f"{key} の切っ先が y={min(ys)}（y={limit} より上に出さない）"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "切っ先の高さ: ok")


if __name__ == "__main__":
    raise SystemExit(main())
