#!/usr/bin/env python3
"""芯の目が、左右の隣の色に溶けて見分けられなくなっていないかを確かめる（2026-10-16。方針の確認 12）。

    .venv/bin/python tools/eye_check.py checks/gau.json

目と輪郭は同じ outline の色なので、設定ファイルの eyes に向きごとの目の画素（x の列と [上の行, 下の行]、目の無い向きは null）を書く。

- 目の画素の左右の隣（目の画素どうしは除く）が、probe_colors.py の判定で目（outline）と見分けられない色
  （WARN・HARD。check_colors.py と同じ基準）のもの
- 設定の目の画素が outline でないもの（絵の目を動かしたのに設定を直し忘れた）
- 目の上端の行が、同じ状態のコマの間で向きによってそろわないもの（types/unit/SPEC.md「立ち絵4方向の規約」の顔）

を落とす。上下と斜めは見ない（「真上が前髪や頭巾の縁の輪郭なのはよい」、SPEC「自己チェック」②）。
左右の隣が髪・かぶり物でも、輪郭と見分けられる色なら目は読めるので通す（2026-10-16 依頼者の判断。
設計の「顔の肌でない隣を落とす」は顔の縁の輪郭を目と取り違え、ロランの目の横の髪のように問題ない絵も落とした）。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import load_palette  # noqa: E402
from probe_colors import verdict  # noqa: E402
from unit_config import OUTLINE, UnitConfig, points, run_check  # noqa: E402


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    palette = load_palette()
    failures = []
    tops: dict[str, dict[str, int]] = {}
    for name, frame in cfg.frames.items():
        eyes = cfg.eyes[frame.direction]
        if eyes is None:
            continue
        pixels = frame.core_pixels()
        missing = {p for p in eyes if pixels.get(p) != OUTLINE}
        if missing:
            failures.append((name, f"目の画素が輪郭の色でない {len(missing)} 件: {points(missing)}"))
        blurred = {(x + dx, y) for x, y in eyes - missing for dx in (-1, 1)
                   if (x + dx, y) not in eyes and (x + dx, y) in pixels
                   and not verdict(OUTLINE, pixels[(x + dx, y)], palette)[0].startswith("OK")}
        if blurred:
            failures.append((name, f"目の左右の隣が目と見分けられない色 {len(blurred)} 件: {points(blurred)}"))
        tops.setdefault(frame.state, {})[frame.direction] = min(y for _x, y in eyes)
    for state, by_direction in tops.items():
        if len(set(by_direction.values())) > 1:
            detail = " ".join(f"{d}={y}" for d, y in by_direction.items())
            failures.append((state, f"目の上端の行が向きでそろわない: {detail}"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "目: ok")


if __name__ == "__main__":
    raise SystemExit(main())
