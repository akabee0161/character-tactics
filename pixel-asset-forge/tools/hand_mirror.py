#!/usr/bin/env python3
"""向きの組（down と up、left と right）で、拳の位置が左右反転で合っているかを確かめる（2026-10-12）。

    .venv/bin/python tools/hand_mirror.py compose/ines.json

拳は compose の設定で "hand": true の部品。部品のファイル名の「_<向き>_<状態>」より前（bow_hand など）で
同じ手を見分け、その部品の手の肌（設定の hand_colours）の画素の位置を比べる。色は比べない（光源が左上に固定
なので、反転した拳は陰の付き方が変わる）。体に隠れて見えない拳も比べる。

決まり（2026-10-12 依頼者の判断）: 原則、上下左右で拳の位置を合わせる。攻撃のコマ（atk_*）は、
動きの表現で位置がずれることが多いので比べない。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from compose import ComposeError, load_config  # noqa: E402
from gridfile import REPO_ROOT, GridError, parse  # noqa: E402

PAIRS = {"down": "up", "up": "down", "left": "right", "right": "left"}
SKIP_PREFIX = "atk"


def hands(spec, direction: str) -> dict[str, set[tuple[int, int]]]:
    """手の名前（部品のファイル名の「_<向き>_」より前）→ 手の肌の画素の位置。
    歩きは立ちの部品のファイル（..._base）を使い回すので、状態の部分は見ない。"""
    out = {}
    for layer in spec.layers:
        if not layer.hand:
            continue
        grid = parse(layer.part)
        key = layer.part.stem.split(f"_{direction}_")[0]
        out[key] = {(x + layer.dx, y + layer.dy) for y, row in enumerate(grid.rows) for x, ch in enumerate(row)
                    if grid.charmap.get(ch) in spec.hand_colours}
    return out


def check(frames: dict) -> list[str]:
    failures = []
    for name in sorted(frames):
        direction, _, state = name.partition("_")
        if direction not in ("down", "left") or state.startswith(SKIP_PREFIX):
            continue  # 組の片側（down・left）から見る
        partner = f"{PAIRS[direction]}_{state}"
        if partner not in frames:
            failures.append(f"{name} と組になる {partner} が無い")
            continue
        mine = hands(frames[name], direction)
        theirs = hands(frames[partner], PAIRS[direction])
        for key in sorted(set(mine) | set(theirs)):
            if key not in mine or key not in theirs:
                failures.append(f"{name} と {partner}: {key} が片方にしか無い")
                continue
            mirrored = {(31 - x, y) for x, y in mine[key]}
            if mirrored != theirs[key]:
                failures.append(f"{name} と {partner}: {key} の位置が左右反転で合わない"
                                f"（{name} を反転すると {sorted(mirrored)}、{partner} は {sorted(theirs[key])}）")
    for name in sorted(frames):  # up・right にだけあるコマ
        direction, _, state = name.partition("_")
        if direction in ("up", "right") and not state.startswith(SKIP_PREFIX) \
                and f"{PAIRS[direction]}_{state}" not in frames:
            failures.append(f"{name} と組になる {PAIRS[direction]}_{state} が無い")
    return failures


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("config", type=Path, help="compose/<ユニット>.json")
    parser.add_argument("--root", type=Path, default=REPO_ROOT, help="設定のパスの基準（既定はリポジトリの直下）")
    args = parser.parse_args(argv)
    try:
        _unit, frames = load_config(args.config, args.root)
        failures = check(frames)
    except (ComposeError, GridError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    for line in failures:
        print(f"FAIL {line}")
    if failures:
        return 1
    print("拳の位置（攻撃以外、down と up・left と right）: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
