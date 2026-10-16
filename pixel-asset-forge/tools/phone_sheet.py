#!/usr/bin/env python3
"""スマホで見るための確認の画像（PNG）を作る（2026-10-16）。

依頼者はスマホで見るので、HTML のページ（compose_page.py・anim_compare.py）の代わりに使う。

    tools/phone_sheet.py order compose/gau.json build/phone [--dirs down,up] [--states base,idle2] [--against DIR]
    tools/phone_sheet.py diff assets/unit/gau build/gau_cand down build/phone/gau_down_diff.png [--states ...]
    tools/phone_sheet.py cmp assets/unit/gau down build/phone/gau_down_cmp.png A=build/candA B=build/candB@right [--states ...]

- order: 向きごとに1枚（OUTDIR/<ユニット>_<向き>_order.png）。各行が1コマで、部品を奥→手前に並べ、最後に組んだ絵。
  --against は今の絵の置き場（省くと assets/unit/<ユニット>/。今の絵が無くても作る）
- diff : コマごとに「今の絵／案／案に今と違う画素の赤枠」を並べる（赤枠の絵は印なしの絵と並べる決まり）
- cmp  : コマごとに今の絵と案をいくつも並べる。案は ラベル=置き場。別の向きのコマと比べるときは ラベル=置き場@向き

--states を省くと、order は設定にあるその向きのコマすべて、diff・cmp は今の絵の置き場にあるその向きのコマすべて
（並びは base・idle2・walk_a・walk_b・atk_wind・atk_draw・atk_hit・atk_release、ほかは名前順で後ろ）。
ガウの描き直し（2026-10-15）で作業フォルダに作った phone_png・phone_diff・phone_cmp を1本にまとめた。
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))

from compose import ComposeError, load_config  # noqa: E402
from compose_page import GROUND, RED, _pixels, analyse_frame  # noqa: E402
from gridfile import REPO_ROOT, GridError, check, load_palette, parse  # noqa: E402

SCALE, PAD, LABEL = 6, 8, 16
SHEET_BG = (187, 187, 187, 255)
TEXT = (0, 0, 0, 255)
DIRECTIONS = ("down", "up", "left", "right")
STATE_ORDER = ("base", "idle2", "walk_a", "walk_b", "atk_wind", "atk_draw", "atk_hit", "atk_release")


class PhoneSheetError(Exception):
    """入力が足りない・書き間違い。"""


def _state_key(state: str) -> tuple[int, str]:
    return (STATE_ORDER.index(state), "") if state in STATE_ORDER else (len(STATE_ORDER), state)


def tile(size: tuple[int, int], pixels: dict, palette, marks=()) -> Image.Image:
    image = Image.new("RGBA", size, GROUND)
    for (x, y), colour in pixels.items():  # コマの外へずれる部品は compose.py が先に止める
        image.putpixel((x, y), tuple(palette[colour][:3]) + (255,))
    image = image.resize((size[0] * SCALE, size[1] * SCALE), Image.NEAREST)
    draw = ImageDraw.Draw(image)
    for x, y in marks:
        draw.rectangle([x * SCALE, y * SCALE, x * SCALE + SCALE - 1, y * SCALE + SCALE - 1], outline=RED, width=2)
    return image


def sheet(rows: list[tuple[str, list[tuple[str, Image.Image]]]]) -> Image.Image:
    """rows は (行の見出し, [(絵の下のラベル, 絵), ...]) の並び。"""
    cell_w = max(image.width for _, cells in rows for _, image in cells)
    cell_h = max(image.height for _, cells in rows for _, image in cells)
    cols = max(len(cells) for _, cells in rows)
    out = Image.new("RGBA", (PAD + cols * (cell_w + PAD), PAD + len(rows) * (cell_h + LABEL * 2 + PAD)), SHEET_BG)
    draw = ImageDraw.Draw(out)
    for i, (title, cells) in enumerate(rows):
        y = PAD + i * (cell_h + LABEL * 2 + PAD)
        draw.text((PAD, y), title, fill=TEXT)
        for j, (label, image) in enumerate(cells):
            x = PAD + j * (cell_w + PAD)
            out.paste(image, (x, y + LABEL))
            draw.text((x, y + LABEL + cell_h + 2), label, fill=TEXT)
    return out


def _states_in(folder: Path, direction: str) -> list[str]:
    states = [p.stem.split("_", 1)[1] for p in folder.glob(f"{direction}_*.txt")]
    if not states:
        raise PhoneSheetError(f"{folder} に向き {direction} のコマが無い")
    return sorted(states, key=_state_key)


def _frame(folder: Path, name: str, palette, size: tuple[int, int] | None = None):
    """コマを読む。案の置き場は検査を通していない作業中の絵なので、validate と同じ検査で止める。
    size を渡すと、その大きさでないコマも止める（今の絵と大きさの違う案を、今の大きさで切って見せない）。"""
    path = folder / f"{name}.txt"
    if not path.is_file():
        raise PhoneSheetError(f"{path} が無い")
    grid = parse(path)
    errors = check(grid, palette)
    if errors:
        raise PhoneSheetError(f"{path}: {errors[0]}")
    if size is not None and (grid.width, grid.height) != size:
        raise PhoneSheetError(f"{path}: 大きさ {grid.width}x{grid.height} が今の絵の {size[0]}x{size[1]} と違う")
    return (grid.width, grid.height), _pixels(grid)


def _split(text: str | None) -> list[str]:
    return [s.strip() for s in text.split(",") if s.strip()] if text else []


def run_order(config: Path, outdir: Path, dirs: list[str], states: list[str], against: Path | None) -> list[Path]:
    unknown = [d for d in dirs if d not in DIRECTIONS]
    if unknown:
        raise PhoneSheetError(f"向き {', '.join(unknown)} は {', '.join(DIRECTIONS)} のどれでもない")
    unit, specs = load_config(config)
    against = against or REPO_ROOT / "assets" / "unit" / unit
    palette = load_palette()
    outdir.mkdir(parents=True, exist_ok=True)
    written = []
    for d in dirs or DIRECTIONS:
        if states:
            names = [f"{d}_{s}" for s in states]
            missing = [n for n in names if n not in specs]
            if missing:
                raise PhoneSheetError(f"{config.name} に {', '.join(missing)} が無い")
        else:
            names = sorted((n for n in specs if n.startswith(f"{d}_")), key=lambda n: _state_key(n.split("_", 1)[1]))
        if not names:
            continue
        rows = []
        for name in names:
            frame = analyse_frame(specs[name], against, name)
            cells = [(re.sub(rf"_{d}(_.*)?$", "", Path(item["file"]).stem), tile(frame["size"], item["pixels"], palette))
                     for item in frame["items"]]
            cells.append(("COMPOSED", tile(frame["size"], frame["composed"], palette)))
            rows.append((f"{name}   (back -> front) -> composed", cells))
        path = outdir / f"{unit}_{d}_order.png"
        sheet(rows).save(path)
        written.append(path)
    if not written:
        raise PhoneSheetError(f"{config.name} に、向き {','.join(dirs)} のコマが無い")
    return written


def run_diff(now: Path, cand: Path, direction: str, out: Path, states: list[str]) -> list[str]:
    palette = load_palette()
    rows, lines = [], []
    for state in states or _states_in(now, direction):
        name = f"{direction}_{state}"
        size, before = _frame(now, name, palette)
        _, after = _frame(cand, name, palette, size)
        diff = sorted(p for p in set(before) | set(after) if before.get(p) != after.get(p))
        rows.append((f"{name}   diff {len(diff)} px", [("NOW", tile(size, before, palette)),
                                                       ("NEW", tile(size, after, palette)),
                                                       ("NEW + red = diff", tile(size, after, palette, diff))]))
        lines.append(f"{name} diff {len(diff)} px")
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet(rows).save(out)
    return lines


def _candidate(spec: str, direction: str) -> tuple[str, Path, str]:
    label, sep, rest = spec.partition("=")
    if not sep or not label or not rest:
        raise PhoneSheetError(f"案の指定は ラベル=置き場[@向き]: {spec!r}")
    folder, at, other = rest.partition("@")
    if not folder:
        raise PhoneSheetError(f"案の置き場が空: {spec!r}")
    if at and other not in DIRECTIONS:
        raise PhoneSheetError(f"案の向き {other!r} は {', '.join(DIRECTIONS)} のどれでもない: {spec!r}")
    return label, Path(folder), other if at else direction


def run_cmp(now: Path, direction: str, out: Path, specs: list[str], states: list[str]) -> None:
    candidates = [("NOW", now, direction)] + [_candidate(s, direction) for s in specs]
    palette = load_palette()
    rows = []
    for state in states or _states_in(now, direction):
        cells = []
        for label, folder, d in candidates:
            size, pixels = _frame(folder, f"{d}_{state}", palette)
            cells.append((f"{label} ({d}_{state})", tile(size, pixels, palette)))
        rows.append((f"{direction}_{state}", cells))
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet(rows).save(out)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="kind", required=True)
    order = sub.add_parser("order", help="部品を奥→手前に並べる（向きごとに1枚）")
    order.add_argument("config", type=Path, help="compose/<ユニット>.json")
    order.add_argument("outdir", type=Path)
    order.add_argument("--dirs", help="向き（カンマ区切り。省くと4方向）")
    order.add_argument("--states", help="状態（カンマ区切り。省くと設定にあるコマすべて）")
    order.add_argument("--against", type=Path, help="今の絵の置き場（省くと assets/unit/<ユニット>/）")
    diff = sub.add_parser("diff", help="今の絵／案／違う画素の赤枠")
    diff.add_argument("now", type=Path, help="今の絵の置き場")
    diff.add_argument("cand", type=Path, help="案の置き場")
    diff.add_argument("direction", choices=DIRECTIONS)
    diff.add_argument("out", type=Path)
    diff.add_argument("--states", help="状態（カンマ区切り）")
    cmp_ = sub.add_parser("cmp", help="今の絵と案をいくつも並べる")
    cmp_.add_argument("now", type=Path, help="今の絵の置き場")
    cmp_.add_argument("direction", choices=DIRECTIONS)
    cmp_.add_argument("out", type=Path)
    cmp_.add_argument("candidates", nargs="+", help="ラベル=置き場[@向き]")
    cmp_.add_argument("--states", help="状態（カンマ区切り）")
    args = parser.parse_args(argv)

    try:
        if args.kind == "order":
            for path in run_order(args.config, args.outdir, _split(args.dirs), _split(args.states), args.against):
                print(f"書いた {path}")
        elif args.kind == "diff":
            for line in run_diff(args.now, args.cand, args.direction, args.out, _split(args.states)):
                print(line)
            print(f"書いた {args.out}")
        else:
            run_cmp(args.now, args.direction, args.out, args.candidates, _split(args.states))
            print(f"書いた {args.out}")
    except (PhoneSheetError, ComposeError, GridError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
