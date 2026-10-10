"""ロラン（assets/unit/roran、部品を持たない完成した絵）を層に切り出し、重なり順の表で確かめる（試作、2026-10-09）。

4方向×6コマ。隠れて絵に無い所（盾の陰の腕、拳の中の柄など）はまだ描いていない（芯や部品の穴になる）。
部品を動かして新しいコマを作るときに、要る所だけ描く（2026-10-09 依頼者と決めた）。

    .venv/bin/python cand/gen/roran_layers.py build/table_roran.html
"""
import sys
from pathlib import Path

sys.path.insert(0, "tools")
sys.path.insert(0, str(Path(__file__).resolve().parent))
import enemy_build as eb  # noqa: E402
from cut_layers import CORE, Part, cut, torn  # noqa: E402
from layer_page import png, uri  # noqa: E402
from layers import blank, compose, differences  # noqa: E402

SRC = Path("assets/unit/roran")
DIRS = ["down", "up", "left", "right"]
SWORD = {"stone_hi", "stone_base", "stone_shadow", "wood_hi", "wood_base", "wood_shadow", "roof_base"}  # 刃・鍔・柄頭
SHIELD = {"metal_hi", "metal_base", "metal_shadow"}
SKIN = {"skin_rose_hi", "skin_rose_base", "skin_rose_shadow"}
CLOAK = {"cloak_dark_hi", "cloak_dark_base", "cloak_dark_shadow"}
STATES = ["base", "idle2", "walk_a", "walk_b", "atk_wind", "atk_hit"]
NONE = (0, 0, 0, 0)  # 部品が見えないコマの箱（左上の1画素。どのコマでも空いている）
# 部品の箱（x0, y0, x1, y1、両端を含む）。鍔とベルトが同じ wood_base なので、剣は箱で分ける。歩きは立ちと同じ
SWORD_BOX = {
    ("down", "base"): (6, 5, 10, 21), ("down", "idle2"): (6, 3, 10, 19),
    ("down", "atk_wind"): (6, 0, 10, 16), ("down", "atk_hit"): (9, 17, 13, 27),
    ("up", "base"): (20, 5, 25, 21), ("up", "idle2"): (20, 3, 25, 19),
    ("up", "atk_wind"): (21, 0, 26, 16), ("up", "atk_hit"): NONE,  # 剣は体に隠れる
    ("left", "base"): (19, 5, 23, 21), ("left", "idle2"): (19, 3, 23, 19),
    ("left", "atk_wind"): (21, 0, 26, 16), ("left", "atk_hit"): (0, 9, 10, 18),
    ("right", "base"): (8, 5, 13, 21), ("right", "idle2"): (8, 3, 13, 19),
    ("right", "atk_wind"): (6, 0, 11, 16), ("right", "atk_hit"): (18, 9, 31, 20),
}
HAND_BOX = {  # 剣を持つ拳（up の当たりは、前へ下ろした腕の肘が脇からのぞく所。服の色）
    ("down", "base"): (7, 18, 11, 19), ("down", "idle2"): (7, 16, 11, 17),
    ("down", "atk_wind"): (7, 13, 11, 14), ("down", "atk_hit"): (10, 18, 14, 19),
    ("up", "base"): (20, 18, 24, 19), ("up", "idle2"): (20, 16, 24, 17),
    ("up", "atk_wind"): (21, 13, 25, 14), ("up", "atk_hit"): (20, 17, 21, 19),
    ("left", "base"): (20, 18, 23, 19), ("left", "idle2"): (20, 16, 23, 17),
    ("left", "atk_wind"): (21, 13, 25, 14), ("left", "atk_hit"): NONE,  # 拳は体に隠れる
    ("right", "base"): (9, 18, 13, 19), ("right", "idle2"): (9, 16, 13, 17),
    ("right", "atk_wind"): (7, 13, 11, 14), ("right", "atk_hit"): (19, 18, 22, 19),
}
SHIELD_BOX = {"down": (20, 16, 24, 25), "up": (7, 16, 11, 25), "left": (9, 16, 11, 25), "right": (20, 16, 23, 24)}
SHIELD_HAND_BOX = {"up": (8, 20, 10, 21), "left": (10, 20, 12, 21)}  # down・right は盾や体の陰で見えない
SWORD_HAND = {"down": "剣を持つ腕・拳", "up": "剣を持つ腕・拳", "left": "奥の腕・拳", "right": "剣を持つ腕・拳"}
SHIELD_HAND = {"up": "盾を持つ腕・拳", "left": "手前の腕・拳"}


def parts(d, st):
    key = (d, "base" if st.startswith("walk") else st)
    hand_colors = CLOAK if key == ("up", "atk_hit") else SKIN
    out = [Part("剣", SWORD_BOX[key], SWORD), Part(SWORD_HAND[d], HAND_BOX[key], hand_colors),
           Part("盾", SHIELD_BOX[d], SHIELD)]
    if d in SHIELD_HAND:
        out.append(Part(SHIELD_HAND[d], SHIELD_HAND_BOX[d], SKIN))
    return out


# 重なり順（奥→手前）。向きごとに6コマとも同じ（立ちの表は 2026-10-09 依頼者承認。up は盾が一番奥、2026-10-10 依頼者の指摘）
ORDERS = {
    "down": [CORE, "盾", "剣", "剣を持つ腕・拳"],
    "up": ["盾", "剣", CORE, "剣を持つ腕・拳", "盾を持つ腕・拳"],
    "left": ["剣", "奥の腕・拳", CORE, "手前の腕・拳", "盾"],
    "right": ["盾", CORE, "剣", "剣を持つ腕・拳"],
}
HOLE = (230, 60, 200, 255)


def layers_of(d, st="base"):
    return cut(eb.read_frame(SRC / f"{d}_{st}.txt"), parts(d, st))


def holes(layers):
    """芯の穴（部品の色の画素があって、芯に画素が無い所）。"""
    core = layers[CORE].frame
    return [(x, y) for y in range(32) for x in range(32)
            if core[y][x] is None and any(layers[n].frame[y][x] not in (None, "outline") for n in layers if n != CORE)]


def small(frame, marks=(), fill=()):
    im = png(frame, bg=(240, 240, 240, 255), marks=marks)
    for x, y in fill:
        for yy in range(y * 8, y * 8 + 8):
            for xx in range(x * 8, x * 8 + 8):
                im.putpixel((xx, yy), HOLE)
    return uri(im.resize((128, 128)))


def main(out):
    html = ["<!doctype html><meta charset=utf-8><title>重なり順の表 ロラン</title>",
            "<style>body{background:#bbb;font-family:sans-serif;max-width:1500px}"
            "figure{display:inline-block;margin:2px 6px 2px 2px;text-align:center;vertical-align:middle}"
            "figcaption{font-size:12px;max-width:128px;white-space:normal}img{image-rendering:pixelated}"
            ".row{margin:6px 0 14px}.op{display:inline-block;font-size:22px;"
            "vertical-align:middle;margin:0 4px}.res{outline:3px solid #446}</style>",
            "<h1>重なり順の表: ロラン（4方向）</h1>",
            "<p>4倍。各行は左から、層を<b>奥→手前</b>の順に並べた絵、合成した絵、今の絵。"
            "最後の「芯（穴を桃色）」は、芯の絵のうち部品に隠れて絵に無い所を桃色で塗ったもの（印なしの芯は行の中にある）。"
            "穴はまだ描いていない（部品を動かして新しいコマを作るときに、要る所だけ描く）。"
            "歩きは脚だけが立ちと違い、立ちと同じ切り方なので並べていない（合成が今の絵と同じことは確かめてある）。</p>"]
    for d in DIRS:
        html.append(f"<h2>{d}</h2><p>重なり順（奥→手前、6コマ共通）: {' → '.join(ORDERS[d])}</p>")
        walk = []
        for st in STATES:
            art = eb.read_frame(SRC / f"{d}_{st}.txt")
            layers = layers_of(d, st)
            frame, labels = compose(layers, ORDERS[d])
            diff = len(differences(art, frame))
            broken = torn(layers, labels, parts(d, st), ORDERS[d])
            for (x, y), back, front in broken:
                print(f"破れ {d}_{st} ({x},{y}): 奥の「{back}」が手前の「{front}」の上に出ている")
            if st.startswith("walk"):
                walk.append(f"{d}_{st}（今の絵と違う画素 {diff}）")
                continue
            cells = [f"<figure><img src='{small(layers[n].frame)}'><figcaption>{n}</figcaption></figure>"
                     for n in ORDERS[d] if any(v is not None for row in layers[n].frame for v in row)]
            row = "<span class=op>→</span>".join(cells)
            row += (f"<span class=op>＝</span><figure class=res><img src='{small(frame)}'>"
                    f"<figcaption>合成（今の絵と違う画素 {diff}）</figcaption></figure>"
                    f"<figure><img src='{small(art)}'><figcaption>今の絵</figcaption></figure>"
                    f"<figure><img src='{small(layers[CORE].frame, fill=holes(layers))}'>"
                    f"<figcaption>芯（穴を桃色）</figcaption></figure>")
            if broken:
                where = "・".join(f"({x},{y}) 奥の{b}が{f}の上" for (x, y), b, f in broken)
                row += (f"<figure><img src='{small(frame, marks=[p for p, _, _ in broken])}'>"
                        f"<figcaption>破れ（赤枠）: {where}</figcaption></figure>")
            html.append(f"<h3>{d}_{st}</h3><div class=row>{row}</div>")
        html.append(f"<p>並べていない: {'・'.join(walk)}</p>")
    Path(out).write_text("\n".join(html), encoding="utf-8")
    print("ok", out)


if __name__ == "__main__":
    main(sys.argv[1])
