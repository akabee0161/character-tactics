#!/usr/bin/env python3
"""芯（と髪・かぶり物の部品）の目が、左右の隣の色に溶けて見分けられなくなっていないかを確かめる（2026-10-16。方針の確認 12）。

    .venv/bin/python tools/eye_check.py checks/gau.json

目と輪郭は同じ outline の色なので、設定ファイルの eyes に向きごとの目の画素（x の列と [上の行, 下の行]、目の無い向きは null）を書く。

- 目の画素の左右の隣（目の画素どうしは除く）が、probe_colors.py の判定で目（outline）と見分けられない色
  （WARN・HARD。check_colors.py と同じ基準）のもの
- 設定の目の画素が outline でないもの（絵の目を動かしたのに設定を直し忘れた）
- 設定の目の上端の行が、目のある向きの間でそろわないもの（types/unit/SPEC.md「立ち絵4方向の規約」の顔。名前は eyes で1回だけ出す。
  絵の目が設定とずれたことは、上の「目の画素が outline でない」で分かる）

を落とす。見る画素は、芯に髪・かぶり物の部品（設定の parts で head）を重ね順どおりに重ねたもの（2026-10-18。ミストから
髪・かぶり物を芯と分けるので、目の横の髪も見る）。武器・拳・盾は重ねない（部品を単品として見る。弓を顔の前に構えるような、
動きの中で目の横を物が通るのは目の描き方の問題ではない。tip_check.py が部品の形で見るのと同じ考え）。
上下と斜めは見ない（「真上が前髪や頭巾の縁の輪郭なのはよい」、SPEC「自己チェック」②）。
左右の隣が髪・かぶり物でも、輪郭と見分けられる色なら目は読めるので通す（2026-10-16 依頼者の判断。
設計の「顔の肌でない隣を落とす」は顔の縁の輪郭を目と取り違え、ロランの目の横の髪のように問題ない絵も落とした）。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import load_palette  # noqa: E402
from probe_colors import verdict  # noqa: E402
from unit_config import CORE, OUTLINE, Frame, UnitConfig, points, run_check  # noqa: E402


def head_pixels(cfg: UnitConfig, frame: Frame) -> dict[tuple[int, int], str]:
    """芯に、髪・かぶり物の部品（parts の head）だけを重ね順どおりに重ねた画素。"""
    pixels: dict[tuple[int, int], str] = {}
    for key in frame.order:  # 奥→手前。手前の部品が上書きする
        if key == CORE:
            pixels.update(frame.core_pixels())
        elif cfg.role(key, "head"):
            pixels.update(frame.parts[key].pixels())
    return pixels


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    palette = load_palette()
    failures = []
    # 目の位置は設定に書くので、上端の行は設定どうしを1回だけ比べる（名前は設定のキー eyes）
    tops = {d: min(y for _x, y in eyes) for d, eyes in cfg.eyes.items() if eyes}
    if len(set(tops.values())) > 1:
        detail = " ".join(f"{d}={y}" for d, y in tops.items())
        failures.append(("eyes", f"目の上端の行が向きでそろわない: {detail}"))
    for name, frame in cfg.frames.items():
        eyes = cfg.eyes[frame.direction]
        if eyes is None:
            continue
        pixels = head_pixels(cfg, frame)
        missing = {p for p in eyes if pixels.get(p) != OUTLINE}
        if missing:
            failures.append((name, f"目の画素が輪郭の色でない {len(missing)} 件: {points(missing)}"))
        blurred = {(x + dx, y) for x, y in eyes - missing for dx in (-1, 1)
                   if (x + dx, y) not in eyes and (x + dx, y) in pixels
                   and not verdict(OUTLINE, pixels[(x + dx, y)], palette)[0].startswith("OK")}
        if blurred:
            failures.append((name, f"目の左右の隣が目と見分けられない色 {len(blurred)} 件: {points(blurred)}"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "目: ok")


if __name__ == "__main__":
    raise SystemExit(main())
