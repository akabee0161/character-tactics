#!/usr/bin/env python3
"""刃・鏃の先端が決まり1〜5に合うかを、部品ごとの形で確かめる（2026-10-16。2026-10-22 に判定を決まり1〜5へ置き換えた。方針の確認 6）。

    .venv/bin/python tools/tip_check.py checks/ines.json

設定ファイルの parts で blade（刃・鏃の文字）を書いた部品について、部品のファイルを単品で見て、
tools/tip_rule.py の find_tips() で先端を判定する（決まりは types/item/SPEC.md と
character-tactics の docs/superpowers/specs/2026-10-22-tip-drawing-rule-design.md）。
決まりに反する先端を FAIL で出す。中身5画素以上・45°以外の斜め・根元の無い刃は落とさず NOTE で出す。
同じ部品のファイルは1回だけ見る。名前は部品のファイル名（拡張子なし）で出す。

- 刃は色でなく文字で見分ける（2026-10-22 依頼者）。鍔の端・弓の端・斜めの矢や弦・足先など、刃の文字でない先端は見ない
  （2026-10-16 依頼者の判断）
- 組んだコマでなく部品で見る（隠れて細く見えるのは、部品の形ではないため。2026-10-17 依頼者の判断）
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tip_rule import Tip, find_tips  # noqa: E402
from unit_config import OUTLINE, UnitConfig, run_check  # noqa: E402


def _tips(cfg: UnitConfig):
    """(部品のファイル名, 部品の役割, Tip) を、同じ部品のファイルは1回だけ並べる。"""
    seen = set()
    for frame in cfg.frames.values():
        for key, part in frame.parts.items():
            blade = cfg.role(key, "blade") or ""
            if not blade or part.layer.part in seen:
                continue
            seen.add(part.layer.part)
            grid = part.grid
            outline = frozenset(c for c, name in grid.charmap.items() if name == OUTLINE)
            for tip in find_tips(grid.rows, frozenset(blade), outline):
                yield part.layer.part.stem, key, tip


def describe(role: str, tip: Tip) -> str:
    x, y = tip.point
    if tip.skipped:
        return f"{role} の先端 ({x},{y}) は対象外: {tip.skipped}"
    return f"{role} の先端 {tip.direction} ({x},{y}): {'; '.join(tip.problems)}"


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    return [(name, describe(key, tip)) for name, key, tip in _tips(cfg) if tip.problems]


def skipped(cfg: UnitConfig) -> list[tuple[str, str]]:
    return [(name, describe(key, tip)) for name, key, tip in _tips(cfg) if tip.skipped]


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "先端: ok", notes=skipped)


if __name__ == "__main__":
    raise SystemExit(main())
