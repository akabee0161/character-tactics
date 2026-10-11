#!/usr/bin/env python3
"""体（core）の部品を、単品として見たときの「当たり前」を機械で確かめる。

    tools/body_check.py assets/unit/roran/parts                     # core_*.txt を全部
    tools/body_check.py assets/unit/roran/parts/core_down_base.txt --head 3-14 --trunk 15-24 --legs 25-31

見るもの（どれも1つでもあれば終了コード 1）:
1. 中心（down・up だけ）: 頭・胴・脚それぞれの左右の中心（その行の範囲の最小と最大の真ん中）が同じか。
2. はみ出し: 胴の行の左端・右端が、胴でいちばん多い端の位置と違う画素（腕の袖の名残など）。
3. 輪郭の切れ目: 輪郭でない画素の上下左右に透明がある（輪郭が閉じていない）。
4. 穴: 同じ行の左右に画素があるのに、間が透明の画素（脚の間の隙間も出るので、歩きの脚は目で確かめる）。

行の範囲は 32px の体の既定値（頭 3-14、胴 15-24、脚 25-31）。別の体は --head --trunk --legs で指定する。
`<向き>` は core_<向き>_<名前>.txt の名前から読む。左右向き（left・right）は中心の検査をしない。
"""
from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import BACKGROUND, GridError, parse  # noqa: E402

OUTLINE_NAME = "outline"
FRONT_BACK = ("down", "up")
NEIGHBOURS = ((1, 0), (-1, 0), (0, 1), (0, -1))
DEFAULT_BANDS = {"head": (3, 14), "trunk": (15, 24), "legs": (25, 31)}
BAND_LABEL = {"head": "頭", "trunk": "胴", "legs": "脚"}


def _filled(rows: list[str], y: int) -> list[int]:
    return [x for x, ch in enumerate(rows[y]) if ch != BACKGROUND]


def band_center(rows: list[str], band: tuple[int, int]) -> float | None:
    xs = [x for y in range(band[0], band[1] + 1) for x in _filled(rows, y)]
    return (min(xs) + max(xs)) / 2 if xs else None


def centre_failures(rows: list[str], bands: dict[str, tuple[int, int]]) -> list[str]:
    centres = {name: band_center(rows, band) for name, band in bands.items()}
    present = {name: c for name, c in centres.items() if c is not None}
    if len(set(present.values())) <= 1:
        return []
    detail = " ".join(f"{BAND_LABEL[name]}={c:g}" for name, c in present.items())
    return [f"中心がそろっていない: {detail}"]


def protrusions(rows: list[str], trunk: tuple[int, int]) -> list[tuple[int, int]]:
    spans = {}
    for y in range(trunk[0], trunk[1] + 1):
        xs = _filled(rows, y)
        if xs:
            spans[y] = (min(xs), max(xs))
    if not spans:
        return []
    left = Counter(s[0] for s in spans.values()).most_common(1)[0][0]
    right = Counter(s[1] for s in spans.values()).most_common(1)[0][0]
    found = []
    for y, (lo, hi) in spans.items():
        found += [(x, y) for x in range(lo, left)]
        found += [(x, y) for x in range(right + 1, hi + 1)]
    return found


def open_edges(rows: list[str], charmap: dict[str, str]) -> list[tuple[int, int]]:
    height = len(rows)
    found = []
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == BACKGROUND or charmap.get(ch) == OUTLINE_NAME:
                continue
            for dx, dy in NEIGHBOURS:
                nx, ny = x + dx, y + dy
                if not (0 <= ny < height and 0 <= nx < len(rows[ny])) or rows[ny][nx] == BACKGROUND:
                    found.append((x, y))
                    break
    return found


def holes(rows: list[str]) -> list[tuple[int, int]]:
    found = []
    for y in range(len(rows)):
        xs = _filled(rows, y)
        if xs:
            found += [(x, y) for x in range(min(xs), max(xs)) if rows[y][x] == BACKGROUND]
    return found


def _points(points: list[tuple[int, int]]) -> str:
    return " ".join(f"({x},{y})" for x, y in sorted(points, key=lambda p: (p[1], p[0])))


def check_file(path: Path, bands: dict[str, tuple[int, int]]) -> list[str]:
    parts = path.stem.split("_")
    direction = parts[1] if len(parts) > 1 else ""
    grid = parse(path)
    failures = []
    if direction in FRONT_BACK:
        failures += centre_failures(grid.rows, bands)
    if points := protrusions(grid.rows, bands["trunk"]):
        failures.append(f"胴からはみ出した画素 {len(points)} 件: {_points(points)}")
    if points := open_edges(grid.rows, grid.charmap):
        failures.append(f"輪郭の切れ目 {len(points)} 件: {_points(points)}")
    if points := holes(grid.rows):
        failures.append(f"穴 {len(points)} 件: {_points(points)}")
    return failures


def _band(text: str) -> tuple[int, int]:
    try:
        lo, hi = (int(v) for v in text.split("-"))
    except ValueError:
        raise argparse.ArgumentTypeError(f"行の範囲は 3-14 の形で書く: {text!r}") from None
    if lo > hi:
        raise argparse.ArgumentTypeError(f"行の範囲の順が逆: {text!r}")
    return lo, hi


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("target", type=Path, help="core_<向き>_<名前>.txt か、それらのあるディレクトリ")
    for name, (lo, hi) in DEFAULT_BANDS.items():
        parser.add_argument(f"--{name}", type=_band, default=(lo, hi), help=f"{BAND_LABEL[name]}の行の範囲（既定 {lo}-{hi}）")
    args = parser.parse_args(argv)
    bands = {name: getattr(args, name) for name in DEFAULT_BANDS}

    if args.target.is_dir():
        paths = sorted(args.target.glob("core_*.txt"))
        if not paths:
            print(f"error: {args.target} に core_*.txt が無い", file=sys.stderr)
            return 2
    elif args.target.is_file():
        paths = [args.target]
    else:
        print(f"error: 見つからない: {args.target}", file=sys.stderr)
        return 2

    bad = 0
    for path in paths:
        try:
            failures = check_file(path, bands)
        except GridError as exc:
            print(f"error: {path}: {exc}", file=sys.stderr)
            return 2
        for failure in failures:
            print(f"FAIL {path.stem}: {failure}")
        bad += bool(failures)
    print(f"{len(paths)} 件中 {bad} 件に問題あり")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
