#!/usr/bin/env python3
"""案を並べて見せる画像を作る。

    tools/present.py OUT.png cand/hood_A.txt cand/hood_B.txt --ref face32.png

上の段: 参考の画像（--ref、任意）と各グリッドを --scale 倍（既定 8）で横に並べ、上に名前を書く。
下の段: 同じ並びの等倍を草の色（grass_base）の上に置く（ゲームでの大きさの見え方）。
ロランとイネスの作業で2回作った使い捨てを、参考の画像を引数にしてまとめた。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import GridError, check, load_palette, parse  # noqa: E402
from render import to_image  # noqa: E402

PAD, LABEL = 16, 18
BACKDROP = (200, 200, 200, 255)


def build_sheet(items: list[tuple[str, Image.Image]], grass: tuple[int, int, int], scale: int = 8) -> Image.Image:
    small = [(name, image.convert("RGBA")) for name, image in items]
    big = [image.resize((image.width * scale, image.height * scale), Image.NEAREST) for _, image in small]
    width = PAD + sum(image.width + PAD for image in big)
    top = max(image.height for image in big)
    actual = max(image.height for _, image in small)
    height = LABEL + top + PAD + actual + PAD * 2
    sheet = Image.new("RGBA", (width, height), BACKDROP)
    draw = ImageDraw.Draw(sheet)
    draw.rectangle([0, LABEL + top + PAD, width, height], fill=(*grass, 255))
    x = PAD
    for (name, image), enlarged in zip(small, big):
        draw.text((x, 2), name, fill=(0, 0, 0, 255))
        sheet.alpha_composite(enlarged, (x, LABEL))
        sheet.alpha_composite(image, (x, LABEL + top + PAD * 2))
        x += enlarged.width + PAD
    return sheet


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("out", type=Path)
    parser.add_argument("grids", nargs="+", type=Path)
    parser.add_argument("--ref", type=Path, help="左端に置く参考の画像（顔を戻したものなど）")
    parser.add_argument("--scale", type=int, default=8)
    args = parser.parse_args(argv)

    palette = load_palette()
    items: list[tuple[str, Image.Image]] = []
    try:
        if args.ref:
            items.append((args.ref.stem, Image.open(args.ref)))
        for path in args.grids:
            grid = parse(path)
            errors = check(grid, palette)
            if errors:
                raise GridError(f"{path}: {errors[0]}")
            items.append((f"{path.parent.name}/{path.stem}", to_image(grid, palette, 1)))
    except (GridError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    build_sheet(items, palette["grass_base"], args.scale).save(args.out)
    print(args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
