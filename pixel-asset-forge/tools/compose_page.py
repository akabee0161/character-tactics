#!/usr/bin/env python3
"""部品の確認ページ。素体と部品を奥→手前に並べ、組み立てた絵を今の絵と比べる（2026-10-10）。

    tools/compose_page.py compose/roran.json build/roran_parts.html [--dirs down,up] [--against DIR]

コマごとに2行。1行目は印なし、2行目は同じ並びに赤枠の印を付ける。
- 部品（奥→手前）: 2行目は、手前の部品に隠れている画素と、拳の部品の閉じていない画素に赤枠
- 組み立てた絵と今の絵: 2行目は、2つが違う画素に赤枠
--against を省くと assets/unit/<ユニット>/ の絵と比べる。ページの先頭に、全コマの差と閉じていない拳の一覧を出す。
閉じていない拳があっても、ページは作る（compose.py は止まる）。
"""
from __future__ import annotations

import argparse
import base64
import html
import io
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))

from compose import ComposeError, compose_frame, compose_labels, load_config, open_hand_pixels, stack_order  # noqa: E402
from gridfile import BACKGROUND, REPO_ROOT, Grid, GridError, load_palette, parse  # noqa: E402

SCALE = 6
GROUND = (225, 225, 225, 255)
RED = (230, 0, 0, 255)

Pixels = dict[tuple[int, int], str]


def _pixels(grid: Grid, dx: int = 0, dy: int = 0) -> Pixels:
    return {(x + dx, y + dy): grid.charmap[ch] for y, row in enumerate(grid.rows) for x, ch in enumerate(row)
            if ch != BACKGROUND}


def png_uri(size: tuple[int, int], pixels: Pixels, palette, marks=()) -> str:
    im = Image.new("RGBA", size, GROUND)
    for (x, y), colour in pixels.items():
        im.putpixel((x, y), tuple(palette[colour][:3]) + (255,))
    im = im.resize((size[0] * SCALE, size[1] * SCALE), Image.NEAREST)
    draw = ImageDraw.Draw(im)
    for x, y in marks:
        draw.rectangle([x * SCALE, y * SCALE, x * SCALE + SCALE - 1, y * SCALE + SCALE - 1], outline=RED, width=2)
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _coords(points) -> str:
    return " ".join(f"({x},{y})" for x, y in points)


def analyse_frame(spec, against: Path, name: str) -> dict:
    body = parse(spec.body)
    parts = [(parse(layer.part), layer) for layer in spec.layers]
    rows, groups = compose_frame(body, parts)
    labels = compose_labels(body, parts)
    charmap = {ch: colour for group in groups for ch, colour in group}
    composed = {(x, y): charmap[ch] for y, row in enumerate(rows) for x, ch in enumerate(row) if ch != BACKGROUND}

    items = []
    for index in stack_order([layer for _, layer in parts]):  # 奥→手前
        if index == -1:
            grid, dx, dy, hand = body, 0, 0, False
        else:
            grid, layer = parts[index]
            dx, dy, hand = layer.dx, layer.dy, layer.hand
        pixels = _pixels(grid, dx, dy)
        file = grid.path.name
        hidden = sorted(p for p in pixels if labels[p[1]][p[0]] != file)
        open_px = [(x + dx, y + dy) for x, y in open_hand_pixels(grid, spec.hand_colours)] if hand else []
        items.append({"file": file, "pixels": pixels, "hidden": hidden, "open": sorted(open_px), "hand": hand})

    path = against / f"{name}.txt"
    current = _pixels(parse(path)) if path.is_file() else None
    diff = sorted(p for p in set(composed) | set(current) if composed.get(p) != current.get(p)) \
        if current is not None else []
    return {"name": name, "size": (body.width, body.height), "items": items, "composed": composed,
            "current": current, "diff": diff}


def render(frames: list[dict], palette, unit: str) -> str:
    out = ["<!doctype html><meta charset=utf-8><title>部品の確認ページ</title>",
           "<style>body{background:#bbb;font-family:sans-serif;max-width:1400px}"
           "figure{display:inline-block;margin:4px 10px 4px 4px;text-align:center;vertical-align:top}"
           "img{image-rendering:pixelated}table{border-collapse:collapse;background:#eee}"
           "td,th{border:1px solid #888;padding:2px 8px}.bad{color:#c00;font-weight:bold}"
           "figcaption{font-size:12px;max-width:200px}</style>",
           f"<h1>{html.escape(unit)} の部品の確認</h1>",
           "<p>各コマ2行。1行目は印なし、2行目は同じ並びに赤枠の印を付けたもの。部品は奥→手前の順（左が一番奥）。"
           "赤枠は、部品では「手前の部品に隠れている画素」と「閉じていない拳」、組み立てた絵と今の絵では「違う画素」。</p>",
           "<table><tr><th>コマ</th><th>今の絵と違う画素</th><th>閉じていない拳</th></tr>"]
    for f in frames:
        opened = sum(len(i["open"]) for i in f["items"])
        diff = "今の絵なし" if f["current"] is None else f"今の絵と違う画素 {len(f['diff'])}"
        out.append(f"<tr><td>{html.escape(f['name'])}</td><td{' class=bad' if f['diff'] else ''}>{diff}</td>"
                   f"<td{' class=bad' if opened else ''}>閉じていない拳 {opened}</td></tr>")
    out.append("</table>")

    current_dir = None
    for f in frames:
        direction = f["name"].split("_")[0]
        if direction != current_dir:
            current_dir = direction
            out.append(f"<h2>{html.escape(direction)}</h2>")
        out.append(f"<h3>{html.escape(f['name'])}</h3>")
        size = f["size"]
        for marked in (False, True):
            out.append("<div>")
            for item in f["items"]:
                marks = sorted(set(item["hidden"]) | set(item["open"])) if marked else ()
                caption = html.escape(item["file"])
                if marked:
                    caption += f"<br>隠れている画素 {len(item['hidden'])}"
                    if item["hand"]:
                        caption += f"<br>閉じていない拳 {len(item['open'])}"
                        if item["open"]:
                            caption += " " + _coords(item["open"])
                out.append(f"<figure><img src='{png_uri(size, item['pixels'], palette, marks)}'>"
                           f"<figcaption>{caption}</figcaption></figure>")
            marks = f["diff"] if marked else ()
            out.append(f"<figure><img src='{png_uri(size, f['composed'], palette, marks)}'>"
                       "<figcaption>組み立てた絵</figcaption></figure>")
            if f["current"] is not None:
                caption = "今の絵"
                if marked:
                    caption += f"<br>今の絵と違う画素 {len(f['diff'])} {_coords(f['diff'])}"
                out.append(f"<figure><img src='{png_uri(size, f['current'], palette, marks)}'>"
                           f"<figcaption>{caption}</figcaption></figure>")
            out.append("</div>")
    return "\n".join(out) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("config", type=Path, help="compose/<ユニット>.json")
    parser.add_argument("out", type=Path, help="書き出す HTML")
    parser.add_argument("--dirs", help="見せる向き（カンマ区切り。省略時はすべて）")
    parser.add_argument("--against", type=Path, help="比べる今の絵の置き場（省略時は assets/unit/<ユニット>/）")
    args = parser.parse_args(argv)

    try:
        unit, specs = load_config(args.config)
        dirs = {d.strip() for d in args.dirs.split(",") if d.strip()} if args.dirs else None
        names = [n for n in specs if dirs is None or n.split("_")[0] in dirs]
        if not names:
            raise ComposeError(f"{args.config.name} に、向き {args.dirs} のコマが無い")
        against = args.against or REPO_ROOT / "assets" / "unit" / unit
        palette = load_palette()
        frames = [analyse_frame(specs[n], against, n) for n in names]
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(render(frames, palette, unit), encoding="utf-8")
    except (ComposeError, GridError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    differ = sum(1 for f in frames if f["diff"])
    opened = sum(len(i["open"]) for f in frames for i in f["items"])
    print(f"書いた {args.out}: {len(frames)} コマ、今の絵と違うコマ {differ}、閉じていない拳の画素 {opened}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
