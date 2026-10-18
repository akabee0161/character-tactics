#!/usr/bin/env python3
"""承認された重なり順と、compose の設定の重なり順が同じかを確かめる（2026-10-16。方針の確認 1）。

    .venv/bin/python tools/order_check.py checks/gau.json

各コマの重なり順（compose.py の stack_order で奥→手前に並べた部品の名前。芯は CORE）が、
設定ファイルの orders のその向きの並びと違えば落とす。承認された重なり順を作業する側が変えない
（types/unit/SPEC.md「部品で組む規約」）。順を変えるときは、依頼者の承認を得てから orders も書き換える。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import UnitConfig, run_check  # noqa: E402


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    for name, frame in cfg.frames.items():
        approved = cfg.orders[frame.direction]
        if frame.order != approved:
            failures.append((name, f"重なり順が承認と違う（今 {','.join(frame.order)}、承認 {','.join(approved)}）"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "重なり順: ok")


if __name__ == "__main__":
    raise SystemExit(main())
