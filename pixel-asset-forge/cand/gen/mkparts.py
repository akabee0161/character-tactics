import json
import sys
from pathlib import Path

sys.path.insert(0, "tools")
import enemy_build as eb

OUT = Path("cand/enemy")
OUT.mkdir(parents=True, exist_ok=True)
DIRS = ["down", "up", "left", "right"]


def blank():
    return [[None] * 32 for _ in range(32)]


def put(g, y, x, s, m):
    for i, ch in enumerate(s):
        if ch == ".":
            continue
        assert 0 <= x + i < 32 and 0 <= y < 32, (y, x, s)
        g[y][x + i] = m[ch]


def draw(items, m):
    g = blank()
    for y, x, s in items:
        put(g, y, x, s, m)
    return g


def mirror(g, shade):
    out = []
    for row in g:
        r = row[::-1]
        idx = [i for i, n in enumerate(r) if n in shade]
        names = sorted((r[i] for i in idx), key=shade.index)
        r = list(r)
        for i, n in zip(idx, names):
            r[i] = n
        out.append(r)
    return out


GLOBAL = {
    "outline": "o", "skin_rose_hi": "A", "skin_rose_base": "B", "skin_rose_shadow": "C",
    "cloak_dark_hi": "f", "cloak_dark_base": "g", "cloak_dark_shadow": "h",
    "wood_hi": "l", "wood_base": "m", "wood_shadow": "n", "stone_hi": "s", "stone_base": "t",
    "stone_shadow": "u", "stone_dark": "v", "hair_slate_hi": "w", "hair_slate_base": "x",
    "hair_slate_shadow": "y", "carpet_hi": "D", "carpet_base": "E", "carpet_shadow": "F",
    "floor_hi": "G", "floor_base": "H", "metal_hi": "I",
}


def ser(g, note):
    names = []
    for row in g:
        for n in row:
            if n is not None and n not in names:
                names.append(n)
    if not names:
        names = ["outline"]
    lines = [f"# {note}", "# type: unit", "# size: 32x32", "# light: upper-left", "# bg: transparent"]
    entries = [f"{GLOBAL[n]}={n}" for n in names]
    for i in range(0, len(entries), 4):
        lines.append("# map: " + " ".join(entries[i:i + 4]))
    lines += ["".join(GLOBAL[n] if n else "." for n in row) for row in g]
    return "\n".join(lines) + "\n"


def write(name, d, g, note):
    (OUT / f"{name}_{d}.txt").write_text(ser(g, note), encoding="utf-8")


def emit(name, sets, m, shade, note):
    for d in ("down", "up", "left"):
        write(name, d, draw(sets[d], m), note)
    write(name, "right", mirror(draw(sets["left"], m), shade), note)


O = "outline"
HAIR = {"o": O, "a": "hair_slate_hi", "b": "hair_slate_base", "c": "hair_slate_shadow"}
HAIR_S = ["hair_slate_hi", "hair_slate_base", "hair_slate_shadow"]
BAND = {"o": O, "a": "carpet_hi", "b": "carpet_base", "c": "carpet_shadow"}
BAND_S = ["carpet_hi", "carpet_base", "carpet_shadow"]
STONE = {"o": O, "a": "stone_hi", "b": "stone_base", "c": "stone_shadow", "d": "stone_dark",
         "h": "floor_hi", "i": "floor_base"}
STONE_S = ["stone_hi", "stone_base", "stone_shadow"]
STONE.update({"D": "carpet_hi", "E": "carpet_base", "F": "carpet_shadow"})

# ---- 頭 ----
bare = {
    "down": [(3, 13, "o"), (3, 18, "o"), (4, 12, "oao"), (4, 17, "obo"), (5, 12, "oaabbbbo"),
             (6, 11, "oaaabbbbco"), (7, 10, "oaaabbbbbcco"), (8, 10, "oaabbbbbbcco"),
             (9, 10, "obbbb.bbbcco"), (10, 10, "ob"), (10, 20, "co"), (11, 11, "oc"), (11, 19, "co")],
    "up": [(3, 13, "o"), (3, 18, "o"), (4, 12, "oao"), (4, 17, "obo"), (5, 12, "oaabbbbo"),
           (6, 11, "oaaabbbbco"), (7, 10, "oaaabbbbbcco"), (8, 10, "oaabbbbbbcco"),
           (9, 10, "oabbbbbbbcco"), (10, 10, "oabbbbbbbcco"), (11, 11, "obbbbbbbco"),
           (12, 11, "obbbbbbcco")],
    "left": [(3, 13, "o"), (3, 17, "o"), (4, 12, "oao"), (4, 16, "obo"), (5, 12, "oaabbbo"),
             (6, 11, "oaaabbbco"), (7, 10, "oaaabbbbcco"), (8, 10, "oaabbbbbcco"),
             (9, 10, "obbbbbbbco"), (10, 10, "ob"), (10, 15, "bbbcco"), (11, 15, "bbbcco"),
             (12, 15, "bbcco"), (13, 15, "bcco")],
}
emit("head_bare", bare, HAIR, HAIR_S, "素の髪（短い荒れ髪）")

cap_d = [(5, 12, "oaaabbbo"), (6, 11, "oaaabbbbco"), (7, 10, "oaaabbbbbcco"), (8, 10, "oaabbbbbbcco")]
cap_l = [(5, 12, "oaabbbo"), (6, 11, "oaaabbbco"), (7, 10, "oaaabbbbcco"), (8, 10, "oaabbbbbcco")]
band = {
    "down": cap_d + [(9, 10, "o" + "c" * 10 + "o"), (9, 22, "obo"), (10, 22, "obo"), (11, 22, "oco"), (12, 23, "oo")],
    "up": cap_d + [(9, 10, "o" + "c" * 10 + "o"), (9, 14, "obbo"), (10, 13, "obcbo"), (11, 13, "oo.oo")],
    "left": cap_l + [(9, 10, "o" + "c" * 8 + "o"), (9, 20, "obbo"), (10, 21, "obo"), (11, 21, "oco"), (12, 22, "oo")],
}
emit("head_bandana", band, BAND, BAND_S, "バンダナ（赤）")

dome_d = [(4, 13, "oooooo"), (5, 12, "oaabbbco"), (6, 11, "oaaabbbbco"), (7, 10, "oaaabbbbbcco"),
          (8, 10, "oaabbbbbbcco")]
horns_d = [(2, 7, "o"), (3, 7, "oho"), (4, 8, "oho"), (5, 8, "oho"), (6, 8, "ohi"), (7, 8, "oi"),
           (2, 24, "o"), (3, 22, "oho"), (4, 21, "oho"), (5, 21, "oho"), (6, 21, "iho"), (7, 22, "io")]
horn = {
    "down": dome_d + [(9, 10, "o" + "c" * 10 + "o"), (10, 15, "bc"), (11, 15, "cc")] + horns_d,
    "up": dome_d + [(9, 10, "oabbbbbbbcco"), (10, 10, "oabbbbbbbcco")] + horns_d,
    "left": [(4, 13, "ooooo"), (5, 12, "oaabbbo"), (6, 11, "oaaabbbco"), (7, 10, "oaaabbbbcco"),
             (8, 10, "oaabbbbbcco"), (9, 10, "o" + "c" * 8 + "o"),
             (2, 21, "o"), (3, 20, "oho"), (4, 19, "oho"), (5, 18, "oho"), (6, 19, "oio")],
}
emit("head_horn", horn, STONE, STONE_S, "角付きの兜")

full_core_d = [(4, 13, "oooooo"), (5, 12, "oaaabbbo"), (6, 11, "oaaabbbbco"), (7, 10, "oaaabbbbbcco"),
               (8, 10, "oaabbbbbbcco"), (9, 10, "oabbbbbbbcco")]
crest_d = [(2, 15, "oo"), (3, 13, "oDDEEo")]
full = {
    "down": full_core_d + crest_d + [(10, 10, "o" * 12), (11, 11, "oabbbbbbco"), (12, 11, "obbdbbdbco"),
                           (13, 12, "obbbbbco"), (14, 13, "obbcco")],
    "up": full_core_d + crest_d + [(10, 10, "oabbbbbbbcco"), (11, 11, "oabbbbbbco"), (12, 11, "obbbbbbbco"),
                         (13, 12, "obbbbbco"), (14, 13, "obbcco")],
    "left": [(2, 14, "oo"), (3, 12, "oDDEEEo"), (4, 13, "ooooo"), (5, 12, "oaabbbo"), (6, 11, "oaaabbbco"),
             (7, 10, "oaaabbbbcco"),
             (8, 10, "oaabbbbbcco"), (9, 10, "obbbbbbbco"), (10, 10, "oooooobbcco"),
             (11, 10, "obbbbbbbcco"), (12, 10, "obbdbbbcco"), (13, 11, "obbbccco"), (14, 12, "obbcco")],
}
emit("head_full", full, STONE, STONE_S, "フルフェイスの兜")

# ---- 目 ----
EYE = {"o": O}
eyes = {
    "E0": ("ガウと同じ縦線", {"down": [(11, 14, "o"), (12, 14, "o"), (11, 17, "o"), (12, 17, "o")],
                              "left": [(11, 12, "o"), (12, 12, "o")], "up": []}),
    "E1": ("横線", {"down": [(12, 13, "oo"), (12, 17, "oo")], "left": [(12, 11, "oo")], "up": []}),
    "E2": ("つり目", {"down": [(11, 13, "o"), (12, 14, "o"), (11, 18, "o"), (12, 17, "o")],
                      "left": [(11, 13, "o"), (12, 12, "o")], "up": []}),
    "E3": ("たれ目", {"down": [(12, 13, "o"), (11, 14, "o"), (12, 18, "o"), (11, 17, "o")],
                      "left": [(11, 12, "o"), (12, 13, "o")], "up": []}),
    "E4": ("点", {"down": [(12, 14, "o"), (12, 17, "o")], "left": [(12, 12, "o")], "up": []}),
    "E5": ("眼帯", {"down": [(11, 13, "oo"), (12, 13, "oo"), (11, 17, "o"), (12, 17, "o")],
                    "left": [(11, 11, "oo"), (12, 11, "oo")], "up": []}),
}
for key, (label, sets) in eyes.items():
    emit(f"eye_{key}", sets, EYE, [], f"目 {label}")

# ---- 服（ガウの素体に合わせた色の素体を作る）----
MAPC = {"cloth_hi": "cloak_dark_hi", "cloth_base": "cloak_dark_base", "cloth_shadow": "cloak_dark_shadow",
        "skin_hi": "skin_rose_hi", "skin_base": "skin_rose_base", "skin_shadow": "skin_rose_shadow"}
bodies = {}
for d in DIRS:
    f = eb.read_frame(Path(f"types/unit/base/male_{d}.txt"))
    for y in range(25, 31):
        f[y] = ["wood_shadow" if n == "cloth_shadow" else n for n in f[y]]
    f = eb.recolor_frame(f, MAPC)
    bodies[d] = f
    write("gau_body", d, f, "ガウ色の素体（男性）")

CLOAK = {"cloak_dark_hi", "cloak_dark_base", "cloak_dark_shadow"}


def clip(body, pixels):
    """素体の服の画素の上だけに描く。"""
    g = blank()
    for y, x, name in pixels:
        if body[y][x] in CLOAK:
            g[y][x] = name
    return g


def belt(d):
    body = bodies[d]
    xs = [x for x in range(32) if body[22][x] in CLOAK]
    px = [(22, x, "wood_base") for x in xs]
    if d != "up":
        mid = {"down": [xs[len(xs) // 2 - 1], xs[len(xs) // 2]], "left": [xs[1], xs[2]],
               "right": [xs[-3], xs[-2]]}[d]
        px = [(y, x, "metal_hi" if x in mid else n) for y, x, n in px]
    return clip(body, px)


def tatter(d):
    body = bodies[d]
    xs = [x for x in range(32) if body[24][x] in CLOAK]
    px = [(24, x, "outline") for x in xs[::2]]
    px += [(17, 13, "outline"), (18, 14, "outline"), (20, 17, "outline"), (21, 18, "outline"),
           (21, 12, "outline"), (22, 13, "outline")]
    px += [(19, 16, "wood_hi"), (19, 17, "wood_hi"), (20, 15, "wood_hi"), (20, 16, "wood_base")]
    return clip(body, px)


for d in DIRS:
    write("cloth_belt", d, belt(d), "服 ベルト")
    write("cloth_tatter", d, tatter(d), "服 ボロ")
    write("cloth_none", d, blank(), "服 なし")
    write("eye_none", d, blank(), "目 なし") if False else None

# ---- 選ぶページの設定 ----
def lay(name, zs=None):
    return [{"part": f"cand/enemy/{name}_{{dir}}.txt", "z": "front"}]


cfg = {
    "unit": "enemy-parts",
    "title": "敵の部品（ガウの素体）",
    "body": "cand/enemy/gau_body_{dir}.txt",
    "elements": {
        "eyes": {"label": "目", "variants": {
            k: {"label": v[0], "layers": lay(f"eye_{k}")} for k, v in eyes.items()}},
        "head": {"label": "頭", "variants": {
            "H1": {"label": "素の髪", "layers": lay("head_bare")},
            "H2": {"label": "バンダナ", "layers": lay("head_bandana")},
            "H3": {"label": "角付きの兜", "layers": lay("head_horn")},
            "H4": {"label": "フルフェイス", "layers": lay("head_full")}}},
        "clothes": {"label": "服", "variants": {
            "C0": {"label": "ガウのまま", "layers": lay("cloth_none")},
            "C1": {"label": "ベルト", "layers": lay("cloth_belt")},
            "C2": {"label": "ボロ", "layers": lay("cloth_tatter")},
            "C3": {"label": "ベルト+ボロ", "layers": lay("cloth_belt") + lay("cloth_tatter")}}},
        "dagger": {"label": "武器", "variants": {
            "D1": {"label": "短剣", "layers": [
                {"part": "assets/part/dagger/dagger_{dir}.txt",
                 "z": {"up": "back", "left": "back"}}]}}},
    },
    "default": {"eyes": "E0", "head": "H1", "clothes": "C0", "dagger": "D1"},
    "matrix": {"rows": "head", "cols": "eyes"},
    "refs": {"ガウ（完成）": "assets/unit/gau/{dir}_base.txt"},
}
Path("cand/enemy/PICKER.json").write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
print("ok")
