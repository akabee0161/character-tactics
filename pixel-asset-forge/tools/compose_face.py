#!/usr/bin/env python3
"""Compose a face from parts (base head + one variant per element + a balance).

    tools/compose_face.py parts/roran_32 --pick H1,E1,B1,M1,P1,C1 --out face.png
    tools/compose_face.py parts/roran_32 --sheet build/compose/   # each element's variants in a row
    tools/compose_face.py parts/roran_32 --json build/compose/parts.json  # placed layers for a picker
    tools/compose_face.py parts/roran_32 --html build/compose/roran_32.html --ref ref.png  # picker page

How to use it and how to add parts: parts/README.md. ``picker`` in parts.json (title, pick_order,
matrix, shortlist) only shapes the --html page.

A parts directory holds grid files and ``parts.json``::

    {
      "size": [32, 32],
      "base": "base.txt",                 # drawn first, never replaced
      "clip_keys": ["skin_rose_base"],    # palette keys of the base a clipped part may cover
      "order": ["mouth", "eyes", "hair"], # bottom to top, after the base
      "default": {"mouth": "M1", "eyes": "E1", "hair": "H1", "balance": "P1"},
      "balance": {"P1": {"label": "...", "anchors": {"eye_far": [9, 16], "mouth": [12, 23]}}},
      "elements": {
        "eyes": {"label": "...", "clip": true,
                 "variants": {"E1": {"label": "...", "parts": {"eye_far": "eyes/e1_far.txt"}}}},
        "hair": {"label": "...", "clip": false,
                 "variants": {"H1": {"label": "...", "parts": {"origin": "hair/h1.txt"}}}}
      }
    }

Each part is placed with its top-left at the named anchor of the chosen balance (``origin`` is
always 0,0, for full-size layers). A part written as ``{"file": "...", "dx": 0, "dy": -1}`` is
shifted from its anchor, e.g. an eye whose grid starts with a crease row above the lid. An element with ``"follow": "hair"`` is not chosen on its own:
it uses the variant chosen for ``hair`` (a forehead shadow under the eyes and brows, while the
hair itself is drawn over them), so it needs a variant of every name ``hair`` has. A clipped part is drawn only where the base has one of
``clip_keys``, so eyes and mouths stay on the skin whatever the balance. ``.`` never paints.
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
from dataclasses import dataclass, field
from html import escape as html_escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from PIL import Image, ImageDraw  # noqa: E402

from gridfile import BACKGROUND, GridError, check, load_palette, parse  # noqa: E402

Pixels = dict[tuple[int, int], str]  # (x, y) -> palette key


class ComposeError(Exception):
    """Raised when a parts set is inconsistent or a selection cannot be drawn."""


def load_grid(path: Path, palette: dict) -> Pixels:
    try:
        grid = parse(path)
    except GridError as exc:
        raise ComposeError(str(exc)) from None
    errors = check(grid, palette)
    if errors:
        raise ComposeError(f"{path}: " + "; ".join(errors))
    return {
        (x, y): grid.charmap[ch]
        for y, row in enumerate(grid.rows)
        for x, ch in enumerate(row)
        if ch != BACKGROUND
    }


def part_ref(ref) -> tuple[str, int, int]:
    """A part is ``"file.txt"`` or ``{"file": "file.txt", "dx": 0, "dy": -1}`` (shifted from its anchor)."""
    if isinstance(ref, str):
        return ref, 0, 0
    if isinstance(ref, dict) and isinstance(ref.get("file"), str):
        return ref["file"], int(ref.get("dx", 0)), int(ref.get("dy", 0))
    raise ComposeError(f"a part must be a file name or {{'file', 'dx', 'dy'}}, got {ref!r}")


@dataclass
class PartSet:
    root: Path
    width: int
    height: int
    base: Pixels
    mask: set[tuple[int, int]]
    order: list[str]
    default: dict[str, str]
    balance: dict[str, dict]
    elements: dict[str, dict]
    grids: dict[str, Pixels]  # relative path -> pixels
    picker: dict = field(default_factory=dict)  # settings for the picker page (--html)

    def _variant(self, element: str, name: str) -> dict:
        variants = self.elements[element]["variants"]
        if name not in variants:
            raise ComposeError(f"{element}: no variant {name!r} (have {', '.join(variants)})")
        return variants[name]

    def _balance(self, name: str) -> dict:
        if name not in self.balance:
            raise ComposeError(f"balance: no variant {name!r} (have {', '.join(self.balance)})")
        return self.balance[name]

    def layer(self, element: str, variant: str, balance: str) -> Pixels:
        """One element's pixels, placed for ``balance`` and clipped if the element asks for it."""
        spec = self.elements[element]
        anchors = self._balance(balance)["anchors"]
        out: Pixels = {}
        for anchor, ref in self._variant(element, variant)["parts"].items():
            rel, dx, dy = part_ref(ref)
            ax, ay = (0, 0) if anchor == "origin" else anchors[anchor]
            ax, ay = ax + dx, ay + dy
            for (x, y), key in self.grids[rel].items():
                pos = (x + ax, y + ay)
                if spec.get("clip"):
                    if pos in self.mask:
                        out[pos] = key
                elif 0 <= pos[0] < self.width and 0 <= pos[1] < self.height:
                    out[pos] = key
                else:
                    raise ComposeError(f"{element} {variant} ({rel}) at {balance}: {pos} is outside the canvas")
        return out

    def leader(self, element: str) -> str:
        """The element whose chosen variant this one uses (itself unless it has ``follow``)."""
        return self.elements[element].get("follow", element)

    def chosen(self) -> list[str]:
        """Elements a selection names, i.e. those that do not follow another."""
        return [e for e in self.elements if self.leader(e) == e]

    def compose(self, selection: dict[str, str]) -> Pixels:
        pick = {**self.default, **selection}
        pixels = dict(self.base)
        for element in self.order:
            pixels.update(self.layer(element, pick[self.leader(element)], pick["balance"]))
        return pixels

    def covered(self, lower: str, lower_variant: str, upper: str, upper_variant: str, balance: str) -> tuple[int, int]:
        """(pixels of ``lower`` hidden by ``upper``, all pixels of ``lower``) for this balance."""
        below = self.layer(lower, lower_variant, balance)
        above = self.layer(upper, upper_variant, balance)
        return len(below.keys() & above.keys()), len(below)

    def to_image(self, pixels: Pixels, palette: dict, scale: int = 1) -> Image.Image:
        image = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
        for (x, y), key in pixels.items():
            image.putpixel((x, y), (*palette[key], 255))
        if scale != 1:
            image = image.resize((self.width * scale, self.height * scale), Image.NEAREST)
        return image


def load_set(root: Path, palette: dict | None = None) -> PartSet:
    palette = palette or load_palette()
    try:
        spec = json.loads((root / "parts.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ComposeError(f"{root / 'parts.json'}: {exc}") from None
    width, height = spec["size"]
    base = load_grid(root / spec["base"], palette)
    clip_keys = set(spec["clip_keys"])
    mask = {pos for pos, key in base.items() if key in clip_keys}

    grids: dict[str, Pixels] = {}
    for element, espec in spec["elements"].items():
        if element not in spec["order"]:
            raise ComposeError(f"element {element!r} is not in 'order'")
        for vname, variant in espec["variants"].items():
            for anchor, ref in variant["parts"].items():
                rel, _, _ = part_ref(ref)
                for bname, bspec in spec["balance"].items():
                    if anchor != "origin" and anchor not in bspec["anchors"]:
                        raise ComposeError(f"balance {bname} has no anchor {anchor!r} ({element} {vname})")
                if rel not in grids:
                    grids[rel] = load_grid(root / rel, palette)
    for element in spec["order"]:
        if element not in spec["elements"]:
            raise ComposeError(f"'order' names {element!r} but 'elements' has no such entry")
    for element, espec in spec["elements"].items():
        leader = espec.get("follow")
        if leader is None:
            continue
        if leader not in spec["elements"] or "follow" in spec["elements"][leader]:
            raise ComposeError(f"{element} follows {leader!r}, which is not an element that is chosen")
        missing = set(spec["elements"][leader]["variants"]) - set(espec["variants"])
        if missing:
            raise ComposeError(f"{element} follows {leader} but has no variant {', '.join(sorted(missing))}")
    parts = PartSet(root, width, height, base, mask, spec["order"], spec["default"],
                    spec["balance"], spec["elements"], grids, spec.get("picker", {}))
    check_picker(parts)
    return parts


def check_picker(parts: PartSet) -> None:
    """``picker`` names only elements a selection can choose (or ``balance``) and their variants."""
    choosable = set(parts.chosen()) | {"balance"}

    def variants(element: str) -> dict:
        return parts.balance if element == "balance" else parts.elements[element]["variants"]

    picker = parts.picker
    for element in picker.get("pick_order", []):
        if element not in choosable:
            raise ComposeError(f"picker.pick_order: {element!r} is not an element a selection chooses")
    matrix = picker.get("matrix")
    if matrix:
        names = [matrix.get(k) for k in ("groups", "rows", "cols")]
        bad = [n for n in names if n not in choosable]
        if bad or len(set(names)) != 3:
            raise ComposeError(f"picker.matrix needs three different chosen elements, got {names} ({bad})")
    for element, names in picker.get("shortlist", {}).items():
        if element not in choosable:
            raise ComposeError(f"picker.shortlist: {element!r} is not an element a selection chooses")
        missing = [n for n in names if n not in variants(element)]
        if missing:
            raise ComposeError(f"picker.shortlist: {element} has no variant {', '.join(missing)}")


def parse_pick(parts: PartSet, text: str) -> dict[str, str]:
    """``H1,E2,P3`` -> {element: variant}, matched by variant name."""
    owner = {v: e for e in parts.chosen() for v in parts.elements[e]["variants"]}
    owner.update({b: "balance" for b in parts.balance})
    pick = {}
    for name in filter(None, (t.strip() for t in text.split(","))):
        if name not in owner:
            raise ComposeError(f"unknown variant {name!r}")
        pick[owner[name]] = name
    return pick


def write_sheet(parts: PartSet, palette: dict, out_dir: Path, scale: int = 4) -> list[Path]:
    """One PNG per element: its variants side by side, everything else at the default."""
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    rows = [(e, list(parts.elements[e]["variants"])) for e in parts.chosen() if len(parts.elements[e]["variants"]) > 1]
    rows.append(("balance", list(parts.balance)))
    for element, names in rows:
        w = parts.width * scale
        sheet = Image.new("RGB", ((w + 8) * len(names) + 8, w + 28), (240, 236, 224))
        draw = ImageDraw.Draw(sheet)
        for i, name in enumerate(names):
            face = parts.to_image(parts.compose({element: name}), palette, scale)
            sheet.paste(face, (8 + i * (w + 8), 20), face)
            draw.text((8 + i * (w + 8), 4), name, fill=(0, 0, 0))
        path = out_dir / f"{element}.png"
        sheet.save(path)
        written.append(path)
    return written


def export_json(parts: PartSet, palette: dict) -> dict:
    """Placed layers for every (element, variant, balance), with colours resolved, plus
    how much of the eyes and brows each hair variant hides. A picker only has to stack layers."""
    hexes = {key: "#%02x%02x%02x" % palette[key] for key in palette}

    def encode(pixels: Pixels) -> list:
        return [[x, y, hexes[key]] for (x, y), key in sorted(pixels.items())]

    layers = {}
    for element, espec in parts.elements.items():
        for vname in espec["variants"]:
            for bname in parts.balance:
                layers[f"{element}|{vname}|{bname}"] = encode(parts.layer(element, vname, bname))
    hidden = {}
    for upper in ("hair",):
        if upper not in parts.elements:
            continue
        for lower in ("eyes", "brows"):
            if lower not in parts.elements:
                continue
            for u in parts.elements[upper]["variants"]:
                for v in parts.elements[lower]["variants"]:
                    for b in parts.balance:
                        n, total = parts.covered(lower, v, upper, u, b)
                        if n:
                            hidden[f"{lower}|{v}|{u}|{b}"] = [n, total]
    return {
        "size": [parts.width, parts.height],
        "base": encode(parts.base),
        "order": parts.order,
        "default": parts.default,
        "elements": {e: {"label": parts.elements[e]["label"],
                         "variants": {v: d["label"] for v, d in parts.elements[e]["variants"].items()}}
                     for e in parts.chosen()},
        "follow": {e: parts.leader(e) for e in parts.elements if parts.leader(e) != e},
        "balance": {b: d["label"] for b, d in parts.balance.items()},
        "layers": layers,
        "hidden": hidden,
        "picker": parts.picker,
    }


TEMPLATE = Path(__file__).resolve().parent / "face_picker.html"


def write_html(parts: PartSet, palette: dict, out: Path, ref: Path | None = None) -> Path:
    """A self-contained picker page: choose a variant per element and see the face at 8x and in
    the game's frames, optionally beside a reference image. Open the file in a browser."""
    # "</" を "<\/" にして、ラベルに何が書かれても <script> を閉じないようにする
    data = json.dumps(export_json(parts, palette), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    ref_uri = ""
    if ref is not None:
        try:
            ref_uri = "data:image/png;base64," + base64.b64encode(ref.read_bytes()).decode()
        except OSError as exc:
            raise ComposeError(f"reference image: {exc}") from None
    title = html_escape(parts.picker.get("title", f"{parts.root.name} の顔の組み合わせ"))
    html = TEMPLATE.read_text(encoding="utf-8")
    html = html.replace("__TITLE__", title).replace("__REF__", ref_uri).replace("__DATA__", data)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("parts", type=Path, help="directory holding parts.json")
    parser.add_argument("--pick", help="comma separated variant names, e.g. H1,E2,P3 (the rest default)")
    parser.add_argument("--out", type=Path, help="PNG for --pick (default: build/compose/<pick>.png)")
    parser.add_argument("--scale", type=int, default=1)
    parser.add_argument("--sheet", type=Path, help="directory for one sheet per element")
    parser.add_argument("--json", type=Path, help="write placed layers for a picker page")
    parser.add_argument("--html", type=Path, help="write the picker page (open it in a browser)")
    parser.add_argument("--ref", type=Path, help="reference image shown beside the face on the --html page")
    args = parser.parse_args(argv)

    try:
        palette = load_palette()
        parts = load_set(args.parts, palette)
        if args.pick is not None:
            pick = parse_pick(parts, args.pick)
            out = args.out or Path("build/compose") / f"{args.pick.replace(',', '_') or 'default'}.png"
            out.parent.mkdir(parents=True, exist_ok=True)
            parts.to_image(parts.compose(pick), palette, args.scale).save(out)
            print(out)
        if args.sheet:
            for path in write_sheet(parts, palette, args.sheet):
                print(path)
        if args.json:
            args.json.parent.mkdir(parents=True, exist_ok=True)
            args.json.write_text(json.dumps(export_json(parts, palette), separators=(",", ":")), encoding="utf-8")
            print(args.json)
        if args.html:
            print(write_html(parts, palette, args.html, args.ref))
    except (ComposeError, GridError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
