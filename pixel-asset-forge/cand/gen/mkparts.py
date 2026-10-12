import json
import sys
from pathlib import Path

sys.path.insert(0, "tools")
import enemy_build as eb

OUT = Path("cand/enemy")
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


cap_d = [(5, 12, "oaaabbbo"), (6, 11, "oaaabbbbco"), (7, 10, "oaaabbbbbcco"), (8, 10, "oaabbbbbbcco")]
cap_l = [(5, 12, "oaabbbo"), (6, 11, "oaaabbbco"), (7, 10, "oaaabbbbcco"), (8, 10, "oaabbbbbcco")]
band = {
    "down": cap_d + [(9, 10, "o" + "c" * 10 + "o"), (9, 22, "obo"), (10, 22, "obo"), (11, 22, "oco"), (12, 23, "oo")],
    "up": cap_d + [(9, 10, "o" + "c" * 10 + "o"), (9, 14, "obbo"), (10, 13, "obcbo"), (11, 13, "oo.oo")],
    "left": cap_l + [(9, 10, "o" + "c" * 8 + "o"), (9, 20, "obbo"), (10, 21, "obo"), (11, 21, "oco"), (12, 22, "oo")],
}


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

# ---- 女性の長い髪（被り物なしの基本パーツ。女性の敵の計画 Task 2b）----
# 頭頂から毛先まで髪全体を1つの部品にする。front は頭と顔の手前に重ね、back（肩より下の髪）は
# 体の後ろ＝空いている画素だけに描く（待機2コマ目で上げた拳や腕を隠さない）。right は left の反転。
_crown_d = [(4, 12, "oooooooo"), (5, 11, "oaaabbbbco"), (6, 10, "oaaabbbbbcco"),
            (7, 9, "oaaabbbbbbbcco"), (8, 9, "oaabbbbbbbbcco")]
_sides_d = [(11, 8, "oab"), (11, 21, "cco"), (12, 8, "oab"), (12, 21, "cco"), (13, 8, "oabb"), (13, 20, "bcco"),
            (14, 8, "oabbb"), (14, 19, "bbcco")]
_back_d = [(15, 8, "oabbo"), (16, 8, "oabbo"), (17, 8, "oabo"), (18, 8, "obo"), (19, 8, "oo"),
           (15, 19, "obbco"), (16, 19, "obbco"), (17, 20, "obco"), (18, 21, "obo"), (19, 22, "oo")]
_crown_l = [(4, 12, "oooooo"), (5, 11, "oaaabbbco"), (6, 10, "oaaabbbbcco"), (7, 9, "oaaabbbbbcco"),
            (8, 9, "oaabbbbbbcco")]
_nape_l = [(10, 15, "bbbbcco"), (11, 15, "bbbbcco"), (12, 15, "bbbbcco"), (13, 15, "bbbbcco")]
_back_l = [(14, 18, "bcco"), (15, 18, "bcco"), (16, 18, "bcco"), (17, 18, "bcco"), (18, 18, "oooo")]
_crown_u = [(4, 12, "oooooooo"), (5, 11, "oaaabbbbco"), (6, 10, "oaaabbbbbcco"), (7, 9, "oaaabbbbbbbcco"),
            (8, 9, "oaabbbbbbbbcco"), (9, 9, "oabbbbbbbbbcco"), (10, 9, "oabbbbbbbbbcco")]
_long_u = [(11, 9, "oabbbbbbbbbcco"), (12, 9, "oabbbcbbcbbcco"), (13, 10, "oabbcbbcbcco"),
           (14, 10, "oabbcbbcbcco"), (15, 11, "obbcbbcbco"), (16, 13, "obbcco"), (17, 13, "oooooo")]
LONG_HAIR = {
    "A": ("ロング・前髪あり", {
        "down": _crown_d + [(9, 9, "oabbbbbbbbbcco"), (10, 9, "oaboooooooocco")] + _sides_d,
        "up": _crown_u + _long_u,
        "left": _crown_l + [(9, 9, "oabbbbbbbcco"), (10, 9, "oo")] + _nape_l,
    }, {"down": _back_d, "up": [], "left": _back_l}),
    "B": ("ロング・前髪なし（額を出す）", {
        "down": _crown_d + [(9, 9, "oabbbo"), (9, 17, "obbcco"), (10, 9, "oabo"), (10, 19, "occo")] + _sides_d,
        "up": _crown_u + _long_u,
        "left": _crown_l + [(9, 9, "o"), (9, 14, "obbbcco")] + _nape_l,
    }, {"down": _back_d, "up": [], "left": _back_l}),
    "C": ("ポニーテール", {
        # 正面: 前髪と、耳の前から顎のあたりまで下りる細い房（おかっぱに見えないように。依頼者 2026-10-08）
        "down": _crown_d + [(9, 9, "oabbbbbbbbbcco"), (10, 9, "oaboooooooocco"),
                            (11, 9, "oa"), (12, 9, "ob"), (13, 10, "ob"), (14, 11, "o"),
                            (11, 21, "co"), (12, 21, "co"), (13, 20, "co"), (14, 20, "o")],
        # 結び目は頭の高い所（依頼者 2026-10-08）。しっぽは結び目から背中へ
        "up": _crown_u + [(11, 9, "oabbbbbbbbbcco"), (12, 10, "oabbbbbbbcco"), (13, 12, "oooooooo"),
                          (8, 14, "oDDo"), (9, 14, "obco"), (10, 14, "obco"), (11, 14, "obco"), (12, 14, "obco"),
                          (13, 14, "obco"), (14, 14, "obco"), (15, 14, "obco"), (16, 14, "obco"), (17, 15, "oo")],
        "left": _crown_l + [(9, 9, "oabbbbbbbcco"), (10, 9, "oo"), (10, 15, "bbbcco"), (11, 15, "bbbcco"),
                            (12, 15, "bbcco"), (6, 20, "oDo"), (7, 20, "obo"), (8, 20, "obco"), (9, 20, "obco"),
                            (10, 20, "obco"), (11, 20, "obco"), (12, 20, "obco"), (13, 20, "obco")],
    }, {"down": [], "up": [], "left": [(14, 20, "obco"), (15, 20, "obco"), (16, 20, "obco"), (17, 21, "oo")]}),
}
HAIR_TIE = dict(HAIR, D="carpet_base")  # ポニーテールの結び目


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

# ---- 服（ガウの素体に合わせた色の素体を作る）----
MAPC = {"cloth_hi": "cloak_dark_hi", "cloth_base": "cloak_dark_base", "cloth_shadow": "cloak_dark_shadow",
        "skin_hi": "skin_rose_hi", "skin_base": "skin_rose_base", "skin_shadow": "skin_rose_shadow"}


def color_body(sex, d):
    """素体を敵の色にする（服 cloak_dark_*、肌 skin_rose_*、y=25〜30 のズボン wood_shadow）。"""
    f = eb.read_frame(Path(f"types/unit/base/{sex}_{d}.txt"))
    for y in range(25, 31):
        f[y] = ["wood_shadow" if n == "cloth_shadow" else n for n in f[y]]
    return eb.recolor_frame(f, MAPC)


BODIES = {sex: {d: color_body(sex, d) for d in DIRS} for sex in ("male", "female")}
# mkframes が重ねる素体に差し替える（belt・tatter は、素体を指定しなければこの胴の幅で描く）
bodies = dict(BODIES["male"])

CLOAK = {"cloak_dark_hi", "cloak_dark_base", "cloak_dark_shadow"}


def clip(body, pixels):
    """素体の服の画素の上だけに描く。"""
    g = blank()
    for y, x, name in pixels:
        if body[y][x] in CLOAK:
            g[y][x] = name
    return g


def belt(d, sex=None):
    body = BODIES[sex][d] if sex else bodies[d]
    xs = [x for x in range(32) if body[22][x] in CLOAK]
    px = [(22, x, "wood_base") for x in xs]
    if d != "up":
        mid = {"down": [xs[len(xs) // 2 - 1], xs[len(xs) // 2]], "left": [xs[1], xs[2]],
               "right": [xs[-3], xs[-2]]}[d]
        px = [(y, x, "metal_hi" if x in mid else n) for y, x, n in px]
    return clip(body, px)


def tatter(d, sex=None):
    body = BODIES[sex][d] if sex else bodies[d]
    xs = [x for x in range(32) if body[24][x] in CLOAK]
    px = [(24, x, "outline") for x in xs[::2]]
    px += [(17, 13, "outline"), (18, 14, "outline"), (20, 17, "outline"), (21, 18, "outline"),
           (21, 12, "outline"), (22, 13, "outline")]
    px += [(19, 16, "wood_hi"), (19, 17, "wood_hi"), (20, 15, "wood_hi"), (20, 16, "wood_base")]
    return clip(body, px)


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

# 女性の敵の選ぶページ（女性の敵の計画 T2）。武器は斧・槍のパッチで組むので部品に無い。比較に男性の4体を添える
cfg_female = {
    "unit": "enemy-parts-female",
    "title": "敵の部品（女性の素体）",
    "body": "cand/enemy/female_gau_body_{dir}.txt",
    "elements": {
        "eyes": cfg["elements"]["eyes"],
        "hair": {"label": "長い髪", "variants": {  # 頭の部品より先に重ねる（頭の部品が上に来る）
            "N": {"label": "なし", "layers": lay("cloth_none")},
            **{k: {"label": v[0], "layers": lay(f"hair_{k}")
                   + [{"part": f"cand/enemy/hair_{k}_back_{{dir}}.txt", "z": "back"}]}
               for k, v in LONG_HAIR.items()}}},
        "head": {"label": "頭", "variants": {
            "H0": {"label": "被り物なし", "layers": lay("cloth_none")}, **cfg["elements"]["head"]["variants"]}},
        "clothes": {"label": "服", "variants": {
            "C0": {"label": "なし", "layers": lay("cloth_none")},
            "C1": {"label": "ベルト", "layers": lay("cloth_belt_female")},
            "C2": {"label": "ボロ", "layers": lay("cloth_tatter_female")},
            "C3": {"label": "ベルト+ボロ", "layers": lay("cloth_belt_female") + lay("cloth_tatter_female")}}},
    },
    "default": {"eyes": "E0", "hair": "A", "head": "H0", "clothes": "C0"},
    "matrix": {"rows": "head", "cols": "hair"},
    "refs": {
        "眼帯のバンダナ（斧・男）": "cand/enemy-frames/axe-bandit/{dir}_base.txt",
        "角付きの兜（斧・男）": "cand/enemy-frames/axe-horn/{dir}_base.txt",
        "フルフェイス（槍・男）": "cand/enemy-frames/spear-knight/{dir}_base.txt",
        "素の髪のごろつき（槍・男）": "cand/enemy-frames/spear-thug/{dir}_base.txt",
    },
}


def main():
    """部品と選ぶページの設定を cand/enemy/ に書き出す。import しただけでは書かない（mkframes・mkweapons が import する）。"""
    OUT.mkdir(parents=True, exist_ok=True)
    emit("head_bare", bare, HAIR, HAIR_S, "素の髪（短い荒れ髪）")
    emit("head_bandana", band, BAND, BAND_S, "バンダナ（赤）")
    emit("head_horn", horn, STONE, STONE_S, "角付きの兜")
    emit("head_full", full, STONE, STONE_S, "フルフェイスの兜")
    for key, (label, front, back) in LONG_HAIR.items():
        emit(f"hair_{key}", front, HAIR_TIE, HAIR_S, f"女性の長い髪 {key} {label}（頭と顔の手前）")
        emit(f"hair_{key}_back", back, HAIR, HAIR_S, f"女性の長い髪 {key} {label}（肩より下、体の後ろ）")
    for key, (label, sets) in eyes.items():
        emit(f"eye_{key}", sets, EYE, [], f"目 {label}")
    for d in DIRS:
        write("gau_body", d, bodies[d], "ガウ色の素体（男性）")
        write("cloth_belt", d, belt(d), "服 ベルト")
        write("cloth_tatter", d, tatter(d), "服 ボロ")
        write("cloth_none", d, blank(), "服 なし")
        write("female_gau_body", d, BODIES["female"][d], "ガウ色の素体（女性）")
        write("cloth_belt_female", d, belt(d, "female"), "服 ベルト（女性の胴）")
        write("cloth_tatter_female", d, tatter(d, "female"), "服 ボロ（女性の胴）")
    Path("cand/enemy/PICKER.json").write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    Path("cand/enemy/PICKER_female.json").write_text(json.dumps(cfg_female, ensure_ascii=False, indent=2),
                                                     encoding="utf-8")
    print("ok")


if __name__ == "__main__":
    main()
