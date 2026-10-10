#!/usr/bin/env python3
"""拳の部品のファイル（assets/unit/<ユニット>/parts/ の拳）で、手の輪郭が切れている所を閉じる。

    tools/hand_outline.py assets/unit/roran/parts/sword_hand_down_base.txt \\
        --hand skin_rose_hi,skin_rose_base,skin_rose_shadow           # 直す所を出すだけ
    tools/hand_outline.py ... --write                                # 書き換える

拳は部品として完全な形で描き、四方とも輪郭（黒）で囲う（2026-10-10 依頼者と決めた）。手（--hand の色の塊のうち、
HAND_MAX 画素以下の小さいもの）の上下左右の隣が、透明でも袖でも輪郭にする。--keep の色の上には描かない
（部品のファイルには普通いらない）。部品が閉じているかの検査は tools/compose.py（部品の "hand"）。
ファイルは文字だけを置き換える（注記や map の行はそのまま）。ディレクトリを渡すと直下の `<名前>_<名前>.txt` を読む。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from enemy_build import EnemyError, read_frame  # noqa: E402
from gridfile import GridError, parse  # noqa: E402

HAND_MAX = 12
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))

Point = tuple[int, int]


class HandOutlineError(Exception):
    """ファイルがこの道具の前提に合わない。"""


def _components(points: set[Point]) -> list[set[Point]]:
    left, found = set(points), []
    while left:
        stack = [left.pop()]
        comp = set(stack)
        while stack:
            x, y = stack.pop()
            for dx, dy in N4:
                q = (x + dx, y + dy)
                if q in left:
                    left.remove(q)
                    comp.add(q)
                    stack.append(q)
        found.append(comp)
    return found


def close_hands(frame, hand: set[str], keep=frozenset()) -> tuple[list[list[str | None]], list[Point]]:
    """(直したコマ, 輪郭にした画素)。入力は変えない。keep の色（握る武器、拳の手前の盾など）の上には描かない。"""
    h, w = len(frame), len(frame[0])
    skin = {(x, y) for y in range(h) for x in range(w) if frame[y][x] in hand}
    out = [row[:] for row in frame]
    changed: list[Point] = []
    for comp in _components(skin):
        if len(comp) > HAND_MAX:
            continue
        for x, y in sorted(comp, key=lambda p: (p[1], p[0])):
            for dx, dy in N4:
                qx, qy = x + dx, y + dy
                if not (0 <= qx < w and 0 <= qy < h):
                    continue
                name = out[qy][qx]
                if name in hand or name == "outline" or name in keep:
                    continue
                out[qy][qx] = "outline"
                changed.append((qx, qy))
    return out, changed


def fix_file(path: Path, hand: set[str], keep: set[str], write: bool) -> list[Point]:
    grid = parse(path)
    if not grid.rows or "# from:" in path.read_text(encoding="utf-8"):
        raise HandOutlineError(f"{path}: 派生ファイル（# from:）は直せない。由来元を直す")
    letters = [ch for ch, name in grid.charmap.items() if name == "outline"]
    if not letters:
        raise HandOutlineError(f"{path}: map に outline の文字が無い")
    fixed, changed = close_hands(read_frame(path), hand, keep)
    if write and changed:
        lines = path.read_text(encoding="utf-8").splitlines()
        rows = [i for i, line in enumerate(lines) if line and not line.startswith("#")]
        if len(rows) != len(fixed):
            raise HandOutlineError(f"{path}: グリッドの行数が {len(rows)}（{len(fixed)} のはず）")
        for x, y in changed:
            line = lines[rows[y]]
            lines[rows[y]] = line[:x] + letters[0] + line[x + 1:]
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return changed


def _names(text: str) -> set[str]:
    return {s.strip() for s in text.split(",") if s.strip()}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("paths", nargs="+", type=Path, help="拳の部品のファイル（かディレクトリ）")
    parser.add_argument("--hand", required=True, help="手の肌の色名（カンマ区切り）")
    parser.add_argument("--keep", default="", help="この色の上には輪郭を描かない色名（カンマ区切り）")
    parser.add_argument("--write", action="store_true", help="ファイルを書き換える（無ければ直す所を出すだけ）")
    args = parser.parse_args(argv)
    files: list[Path] = []
    for p in args.paths:
        if p.is_dir():
            files += sorted(q for q in p.glob("*_*.txt"))
        elif p.is_file():
            files.append(p)
        else:
            print(f"error: 無い: {p}", file=sys.stderr)
            return 2
    total = 0
    try:
        for path in files:
            changed = fix_file(path, _names(args.hand), _names(args.keep), args.write)
            if changed:
                total += len(changed)
                where = " ".join(f"({x},{y})" for x, y in changed)
                print(f"{'直した' if args.write else '直す'} {path}: {len(changed)} か所 {where}")
    except (GridError, EnemyError, HandOutlineError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    print(f"手の輪郭: {len(files)} コマ、{total} か所{'を直した' if args.write else '（--write で直す）'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
