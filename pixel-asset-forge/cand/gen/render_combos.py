import sys
from pathlib import Path

sys.path.insert(0, "tools")
from PIL import Image

from compose import Layer, compose_frame
from gridfile import load_palette, parse

PAL = load_palette()
DIRS = ["down", "up", "left", "right"]
ZD = {"up": "back", "left": "back"}


def hexc(n):
    r, g, b = PAL[n][:3]
    return (r, g, b, 255)


def comp(head, eye, cloth, d):
    body = parse(Path(f"cand/enemy/gau_body_{d}.txt"))
    parts = [(f"cand/enemy/eye_{eye}_{d}.txt", "front"), (f"cand/enemy/head_{head}_{d}.txt", "front")]
    for c in cloth:
        parts.append((f"cand/enemy/cloth_{c}_{d}.txt", "front"))
    parts.append((f"assets/part/dagger/dagger_{d}.txt", ZD.get(d, "front")))
    layers = [(parse(Path(p)), Layer(Path(p), z)) for p, z in parts]
    rows, _ = compose_frame(body, layers)
    return rows, None


def to_img(path_or_rows, cm=None):
    if isinstance(path_or_rows, Path):
        g = parse(path_or_rows)
        rows, cm = g.rows, g.charmap
    else:
        rows = path_or_rows
    return rows, cm


def img_from_rows(rows, cm, scale):
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".":
                im.putpixel((x, y), hexc(cm[ch]))
    return im.resize((32 * scale, 32 * scale), Image.NEAREST)


def build(head, eye, cloth, d):
    body = parse(Path(f"cand/enemy/gau_body_{d}.txt"))
    parts = [(f"cand/enemy/eye_{eye}_{d}.txt", "front"), (f"cand/enemy/head_{head}_{d}.txt", "front")]
    for c in cloth:
        parts.append((f"cand/enemy/cloth_{c}_{d}.txt", "front"))
    parts.append((f"assets/part/dagger/dagger_{d}.txt", ZD.get(d, "front")))
    layers = [(parse(Path(p)), Layer(Path(p), z)) for p, z in parts]
    rows, groups = compose_frame(body, layers)
    cm = {}
    for grp in groups:
        for ch, colour in grp:
            cm[ch] = colour
    return rows, cm


def sheet(combos, out, scale=6):
    W = 4 * 32 * scale
    H = len(combos) * 32 * scale
    sh = Image.new("RGBA", (W, H), (72, 72, 79, 255))
    for r, (head, eye, cloth) in enumerate(combos):
        for i, d in enumerate(DIRS):
            rows, cm = build(head, eye, cloth, d)
            sh.alpha_composite(img_from_rows(rows, cm, scale), (i * 32 * scale, r * 32 * scale))
    sh.save(out)


which = sys.argv[1]
if which == "heads":
    sheet([("bare", "E0", ["none"]), ("bandana", "E0", ["none"]), ("horn", "E0", ["none"]), ("full", "E0", ["none"])],
          "/tmp/heads.png")
elif which == "eyes":
    sheet([("bare", e, ["none"]) for e in ["E0", "E1", "E2", "E3", "E4", "E5"]], "/tmp/eyes.png", 5)
elif which == "clothes":
    sheet([("bare", "E0", c) for c in (["none"], ["belt"], ["tatter"], ["belt", "tatter"])], "/tmp/clothes.png")
