#!/usr/bin/env python3
"""拳が柄の真ん中を握っているかを、武器と拳の部品だけを重ねた絵で確かめる（2026-11-07 依頼者）。

    .venv/bin/python tools/grip_centre_check.py checks/garum.json

設定ファイルの parts で、fist の部品のうち grips が weapon の部品であるものについて、コマごとに
武器の部品の上に拳の部品を重ね（dx・dy でずらした位置。拳の輪郭は、compose の keep の種類の上には描かない）、
weapon_check.py の「拳が柄の真ん中に無い」（grip_off_centre）と同じ計算で測る。

組んだコマで測らないのは、体や髪が拳の一部を隠すと、見えている拳の中心がずれて見え、部品の上では柄の
真ん中を握っている拳まで落としていたため（ガルムの横向きで剣を体の後ろの縁に寄せたとき。2026-11-07）。
unit_rules.py は weapon_check.py に --no-grip-centre を渡し、この判定をこちらに任せる。
刃・柄の色はパレットの種類 blade・weapon、手の色は種類 skin（unit と common の用途の色）。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import palette as palette_mod  # noqa: E402
from unit_config import OUTLINE, Part, UnitConfig, run_check  # noqa: E402
from weapon_check import Analysis, grip_off_centre  # noqa: E402


def grip_frame(weapon: Part, fist: Part, size: int, kind_of) -> list[list[str | None]]:
    """武器の部品の上に拳の部品を重ねたコマ（色名。透明は None）。"""
    frame: list[list[str | None]] = [[None] * size for _ in range(size)]
    for (x, y), colour in weapon.pixels().items():
        if 0 <= x < size and 0 <= y < size:
            frame[y][x] = colour
    keep = set(fist.layer.keep or ())
    for (x, y), colour in fist.pixels().items():
        if not (0 <= x < size and 0 <= y < size):
            continue
        under = frame[y][x]
        if colour == OUTLINE and under is not None and kind_of(under) in keep:
            continue  # compose の keep と同じく、拳の輪郭は柄の上に描かない
        frame[y][x] = colour
    return frame


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    pal = palette_mod.load()
    blade = pal.names_of_kind("blade", type="unit")
    weapon = pal.names_of_kind("weapon", type="unit")

    def kind_of(name: str) -> str:
        return pal.uses[name].kind

    failures = []
    for name, frame in cfg.frames.items():
        for key, part in frame.parts.items():
            grips = cfg.role(key, "grips")
            if not (cfg.role(key, "fist") and grips and cfg.role(grips, "weapon") and grips in frame.parts):
                continue
            a = Analysis(grip_frame(frame.parts[grips], part, cfg.size, kind_of), blade, weapon, cfg.hand)
            message = grip_off_centre(a)
            if message:
                failures.append((name, f"{key}: {message}"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "拳が柄の真ん中: ok")


if __name__ == "__main__":
    raise SystemExit(main())
