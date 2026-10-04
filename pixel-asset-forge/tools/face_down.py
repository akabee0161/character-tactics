#!/usr/bin/env python3
"""拡大されたドット絵の顔を、升の中央の画素を取って元の大きさに戻す。

    tools/face_down.py ../assets/images/gau-face.png 32 /tmp/gau

N 升に戻し、各成分の差 14 以下の色をまとめて、色の一覧と文字のグリッドを出す。
OUT_PREFIX_q.png（N px）と OUT_PREFIX_q_x8.png（灰色の上に8倍）を書く。
N が合っているかは、出力の「変わり目の多い位置」が升の幅おきに並ぶかで確かめる
（ロランの顔は 24px の約5.33倍、イネスは 32px の4倍だった）。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@$%^&*+=?<>~"
EDGE_THRESHOLD = 60


def transition_positions(img: Image.Image, axis: str, count: int) -> list[int]:
    size = img.width if axis == "x" else img.height
    other = img.height if axis == "x" else img.width
    hits = [0] * size
    for a in range(1, size):
        for b in range(other):
            p = img.getpixel((a, b) if axis == "x" else (b, a))
            q = img.getpixel((a - 1, b) if axis == "x" else (b, a - 1))
            if sum(abs(p[i] - q[i]) for i in range(3)) > EDGE_THRESHOLD:
                hits[a] += 1
    return sorted(sorted(range(size), key=lambda i: -hits[i])[:count])


def downsample(img: Image.Image, n: int) -> Image.Image:
    img = img.convert("RGBA")
    step = img.width / n
    small = Image.new("RGBA", (n, n))
    for y in range(n):
        for x in range(n):
            small.putpixel((x, y), img.getpixel((int((x + 0.5) * step), int((y + 0.5) * step))))
    return small


def cluster(img: Image.Image, tolerance: int = 14) -> tuple[list[str], list[tuple[str, int]]]:
    reps: list[list] = []  # [代表色, 画素数]

    def find(p):
        if p[3] < 128:
            return None
        for rep in reps:
            if all(abs(rep[0][i] - p[i]) <= tolerance for i in range(3)):
                rep[1] += 1
                return rep
        rep = [p, 1]
        reps.append(rep)
        return rep

    cells = [[find(img.getpixel((x, y))) for x in range(img.width)] for y in range(img.height)]
    order = sorted(range(len(reps)), key=lambda i: -reps[i][1])
    if len(order) > len(CHARS):
        raise ValueError(f"色が {len(order)} あり、文字が足りない（{len(CHARS)} まで）")
    char_of = {id(reps[i]): CHARS[k] for k, i in enumerate(order)}
    rows = ["".join("." if c is None else char_of[id(c)] for c in row) for row in cells]
    colours = [("#{:02x}{:02x}{:02x}".format(*reps[i][0][:3]), reps[i][1]) for i in order]
    return rows, colours


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("image", type=Path)
    parser.add_argument("n", type=int, help="元の升の数（例: 32）")
    parser.add_argument("out_prefix")
    args = parser.parse_args(argv)
    if args.n < 1:
        print("error: N は1以上", file=sys.stderr)
        return 2
    try:
        img = Image.open(args.image).convert("RGBA")
    except OSError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    for axis in ("x", "y"):
        print(axis, "変わり目の多い位置:", transition_positions(img, axis, args.n + 4))
    small = downsample(img, args.n)
    rows, colours = cluster(small)
    print("色数:", len(colours))
    for ch, (hexcode, count) in zip(CHARS, colours):
        print(f"  {ch} {hexcode} n={count}")
    print("   " + "".join(str(x % 10) for x in range(args.n)))
    for y, row in enumerate(rows):
        print(f"{y:2d} {row}")

    small.save(f"{args.out_prefix}_q.png")
    backdrop = Image.new("RGBA", small.size, (200, 200, 200, 255))
    backdrop.alpha_composite(small)
    backdrop.resize((args.n * 8, args.n * 8), Image.NEAREST).save(f"{args.out_prefix}_q_x8.png")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
