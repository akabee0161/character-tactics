#!/usr/bin/env python3
"""ユニットのコマを、見せる前に機械で確かめる（自己チェック①）。

    tools/unit_check.py assets/unit/ines --items klmstuw
    tools/unit_check.py assets/unit/roran --items GHJRkmns

1. 脚の中心: 向きごとに、全コマの脚（y>=24 の画素から、輪郭 `o` と --items の文字を除く）の
   左右の中心がそろっているか。そろっていなければ失敗（終了コード 1）。
   持ち物が体の横へはみ出すユニット（弓）では `sheet.py` の中心の判定が使えないので、こちらで確かめる。
2. 増えた輪郭の切れ目: 輪郭でない画素で、上下左右のどれかが透明かコマの外のもののうち、
   同じ向きの `<向き>_base` に無いもの。報告だけで、終了コードには影響しない。
   歩きの足先のようにわざと切れているものもあるので、1件ずつ目で確かめる。

完成済みのロラン・イネスで測った偽陽性（2026-10-04）: 脚の中心 0件、増えた切れ目 7件
（歩きの足先5、攻撃2）。輪郭の切れ目をそのまま数えると 140か所、孤立した1画素は 824か所で、
どちらも検査に使えなかった（docs/superpowers/specs/2026-10-04-unit-drawing-workflow-design.md）。

DIR の直下の `<向き>_<名前>.txt` だけを読む（`parts/` などの下は読まない）。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import BACKGROUND, GridError, parse  # noqa: E402

DIRECTIONS = ("down", "up", "left", "right")
OUTLINE = "o"
LEG_TOP = 24
NEIGHBOURS = ((1, 0), (-1, 0), (0, 1), (0, -1))


class UnitCheckError(Exception):
    """入力がこの検査の前提に合わない。"""


def _direction(name: str) -> str:
    return name.split("_", 1)[0]


def leg_center(rows: list[str], items: set[str]) -> float:
    xs = [
        x
        for y, row in enumerate(rows)
        if y >= LEG_TOP
        for x, ch in enumerate(row)
        if ch not in items and ch not in (BACKGROUND, OUTLINE)
    ]
    if not xs:
        raise UnitCheckError(f"脚の画素が無い（y>={LEG_TOP} に輪郭と持ち物以外の画素が無い）")
    return (min(xs) + max(xs)) / 2


def open_edges(rows: list[str]) -> set[tuple[int, int]]:
    height = len(rows)
    found: set[tuple[int, int]] = set()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in (BACKGROUND, OUTLINE):
                continue
            for dx, dy in NEIGHBOURS:
                nx, ny = x + dx, y + dy
                if not (0 <= ny < height and 0 <= nx < len(rows[ny])) or rows[ny][nx] == BACKGROUND:
                    found.add((x, y))
                    break
    return found


def load_frames(directory: Path) -> dict[str, list[str]]:
    frames: dict[str, list[str]] = {}
    for path in sorted(directory.glob("*.txt")):
        if _direction(path.stem) not in DIRECTIONS:
            continue
        frames[path.stem] = parse(path).rows
    if not frames:
        raise UnitCheckError(f"{directory}: <向き>_<名前>.txt が1つも無い")
    return frames


def check_legs(frames: dict[str, list[str]], items: set[str]) -> list[str]:
    by_direction: dict[str, dict[str, float]] = {}
    for name, rows in frames.items():
        try:
            center = leg_center(rows, items)
        except UnitCheckError as exc:
            raise UnitCheckError(f"{name}: {exc}") from None
        by_direction.setdefault(_direction(name), {})[name] = center

    failures = []
    for direction in DIRECTIONS:
        centers = by_direction.get(direction)
        if centers and len(set(centers.values())) > 1:
            detail = " ".join(f"{name}={center:g}" for name, center in sorted(centers.items()))
            failures.append(f"{direction}: 脚の中心がそろっていない: {detail}")
    return failures


def new_edges(frames: dict[str, list[str]]) -> dict[str, list[tuple[int, int]]]:
    result: dict[str, list[tuple[int, int]]] = {}
    for name, rows in frames.items():
        base = f"{_direction(name)}_base"
        if name == base:
            continue
        if base not in frames:
            raise UnitCheckError(f"{name}: 比べる {base} が無い")
        extra = open_edges(rows) - open_edges(frames[base])
        if extra:
            result[name] = sorted(extra, key=lambda p: (p[1], p[0]))
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("directory", type=Path, help="assets/unit/<ユニット>")
    parser.add_argument("--items", default="", help="持ち物の文字。脚の中心から除く（例: klmstuw）")
    args = parser.parse_args(argv)

    if not args.directory.is_dir():
        print(f"error: ディレクトリが無い: {args.directory}", file=sys.stderr)
        return 2
    try:
        frames = load_frames(args.directory)
        failures = check_legs(frames, set(args.items))
        edges = new_edges(frames)
    except (GridError, UnitCheckError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    for name, points in edges.items():
        print(f"切れ目（{name}、base から増えた分）: " + " ".join(f"({x},{y})" for x, y in points))
    total = sum(len(points) for points in edges.values())
    print(f"増えた切れ目: {total} 件（報告だけ。1件ずつ目で確かめる）")

    for failure in failures:
        print(f"FAIL {failure}", file=sys.stderr)
    if failures:
        return 1
    print("脚の中心: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
