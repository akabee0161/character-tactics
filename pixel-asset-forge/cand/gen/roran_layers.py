"""ロラン（assets/unit/roran、部品を持たない完成した絵）を層に切り出し、重なり順の表で確かめる（試作、2026-10-09）。

今は4方向の立ちだけ。隠れて絵に無い所（盾の陰の腕、拳の中の柄など）はまだ描いていない（芯や部品の穴になる）。
重なり順に依頼者と合意してから描く（順が変わると描き直しになるため）。

    .venv/bin/python cand/gen/roran_layers.py build/table_roran.html
"""
import sys
from pathlib import Path

sys.path.insert(0, "tools")
sys.path.insert(0, str(Path(__file__).resolve().parent))
import enemy_build as eb  # noqa: E402
from cut_layers import CORE, Part, cut  # noqa: E402
from layer_page import png, uri  # noqa: E402
from layers import blank, compose, differences  # noqa: E402

SRC = Path("assets/unit/roran")
DIRS = ["down", "up", "left", "right"]
SWORD = {"stone_hi", "stone_base", "stone_shadow", "wood_hi", "wood_base", "wood_shadow", "roof_base"}  # 刃・鍔・柄頭
SHIELD = {"metal_hi", "metal_base", "metal_shadow"}
SKIN = {"skin_rose_hi", "skin_rose_base", "skin_rose_shadow"}
# 部品の箱（x0, y0, x1, y1、両端を含む）。鍔とベルトが同じ wood_base なので、剣は箱で分ける
PARTS = {
    "down": [Part("剣", (6, 5, 10, 21), SWORD), Part("剣を持つ腕・拳", (7, 18, 11, 19), SKIN),
             Part("盾", (20, 16, 24, 25), SHIELD)],
    "up": [Part("剣", (20, 5, 25, 21), SWORD), Part("剣を持つ腕・拳", (20, 18, 24, 19), SKIN),
           Part("盾", (7, 16, 11, 25), SHIELD), Part("盾を持つ腕・拳", (8, 20, 10, 21), SKIN)],
    "left": [Part("剣", (19, 5, 23, 21), SWORD), Part("奥の腕・拳", (20, 18, 23, 19), SKIN),
             Part("盾", (9, 16, 11, 25), SHIELD), Part("手前の腕・拳", (10, 20, 12, 21), SKIN)],
    "right": [Part("剣", (8, 5, 13, 21), SWORD), Part("剣を持つ腕・拳", (9, 18, 13, 19), SKIN),
              Part("盾", (20, 16, 23, 24), SHIELD)],
}
# 重なり順の案（奥→手前）。依頼者の確認待ち
ORDERS = {
    "down": [CORE, "盾", "剣", "剣を持つ腕・拳"],
    "up": ["剣", "盾", CORE, "剣を持つ腕・拳", "盾を持つ腕・拳"],
    "left": ["剣", "奥の腕・拳", CORE, "手前の腕・拳", "盾"],
    "right": ["盾", CORE, "剣", "剣を持つ腕・拳"],
}
HOLE = (230, 60, 200, 255)


def layers_of(d, st="base"):
    return cut(eb.read_frame(SRC / f"{d}_{st}.txt"), PARTS[d])


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
            "<h1>重なり順の表: ロラン（立ち・4方向）</h1>",
            "<p>4倍。各行は左から、層を<b>奥→手前</b>の順に並べた絵、合成した絵、今の絵。"
            "最後の「芯（穴を桃色）」は、芯の絵のうち部品に隠れて絵に無い所を桃色で塗ったもの（印なしの芯は行の中にある）。"
            "穴はまだ描いていない。重なり順に合意してから描く。</p>"]
    for d in DIRS:
        art = eb.read_frame(SRC / f"{d}_base.txt")
        layers = layers_of(d)
        frame, _labels = compose(layers, ORDERS[d])
        cells = [f"<figure><img src='{small(layers[n].frame)}'><figcaption>{n}</figcaption></figure>"
                 for n in ORDERS[d] if any(v is not None for row in layers[n].frame for v in row)]
        row = "<span class=op>→</span>".join(cells)
        row += (f"<span class=op>＝</span><figure class=res><img src='{small(frame)}'>"
                f"<figcaption>合成（今の絵と違う画素 {len(differences(art, frame))}）</figcaption></figure>"
                f"<figure><img src='{small(art)}'><figcaption>今の絵</figcaption></figure>"
                f"<figure><img src='{small(layers[CORE].frame, fill=holes(layers))}'>"
                f"<figcaption>芯（穴を桃色）</figcaption></figure>")
        html.append(f"<h2>{d}</h2><p>重なり順（奥→手前）: {' → '.join(ORDERS[d])}</p><div class=row>{row}</div>")
    Path(out).write_text("\n".join(html), encoding="utf-8")
    print("ok", out)


if __name__ == "__main__":
    main(sys.argv[1])
