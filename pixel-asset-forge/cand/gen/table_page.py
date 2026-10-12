"""重なり順の表を、層（パーツ）の絵を奥→手前に並べて確かめるページ（2026-10-09）。

表の認識合わせは文字の表だけでなく、このページを見ながら行う（依頼者の要望、2026-10-09）。
向きごとに、立ちと、今の絵から変わるコマについて「層を奥→手前に並べた絵 → 合成した試作 → 今の絵」を1行に並べる。

    .venv/bin/python cand/gen/table_page.py axe-horn build/table_axe-horn.html
"""
import sys
from pathlib import Path

sys.path.insert(0, "tools")
sys.path.insert(0, str(Path(__file__).resolve().parent))
import enemy_build as eb  # noqa: E402
import mklayers as ml  # noqa: E402
from layer_page import png, uri  # noqa: E402
from layers import ADDED, differences  # noqa: E402

LAYER_BG = (240, 240, 240, 255)
CHECK_BG = (225, 225, 225, 255)


def shown_states(diffs):
    """並べる状態: 立ちは必ず、ほかは今の絵から変わる状態だけ。"""
    return [st for st in ml.STATES if st == "base" or diffs[st]]


def visible_layers(layers, order):
    """表の順（奥→手前）のうち、画素のある層だけ。"""
    return [n for n in order if any(n2 is not None for row in layers[n].frame for n2 in row)]


def small(frame, marks=(), bg=CHECK_BG):
    return uri(png(frame, bg=bg, marks=marks).resize((128, 128)))


def main(eid, out):
    u = ml.unit(eid)
    current = Path("cand/enemy-frames") / eid
    html = [f"<!doctype html><meta charset=utf-8><title>重なり順の表 {eid}</title>",
            "<style>body{background:#bbb;font-family:sans-serif;max-width:1500px}"
            "figure{display:inline-block;margin:2px 6px 2px 2px;text-align:center;vertical-align:middle}"
            "figcaption{font-size:12px;max-width:128px;white-space:normal}img{image-rendering:pixelated}"
            ".row{margin:6px 0 14px;white-space:nowrap;overflow-x:auto}.op{display:inline-block;font-size:22px;"
            "vertical-align:middle;margin:0 4px}.res{outline:3px solid #446}</style>",
            f"<h1>重なり順の表: {eid}（{u['name']}）</h1>",
            "<p>4倍。各行は左から、層を<b>奥→手前</b>の順に並べた絵、合成した試作、同じ試作に今の絵と変わった画素を赤い枠で示したもの、今の絵。"
            "層は単体の絵で、隠れる部分も含む。画素の無い層は並べない。"
            "各向きで立ちは必ず並べ、ほかの状態は今の絵から変わるものだけ並べる。</p>"]
    for d in ml.DIRS:
        rows, same = [], []
        diffs, built = {}, {}
        for st in ml.STATES:
            cur = eb.read_frame(current / f"{d}_{st}.txt")
            frame, labels = ml.compose_frame(eid, d, st)
            built[st] = (cur, frame, labels)
            diffs[st] = len(differences(cur, frame))
        for st in ml.STATES:
            if st not in shown_states(diffs):
                same.append(st)
        html.append(f"<h2>{d}</h2>")
        for st in shown_states(diffs):
            cur, frame, labels = built[st]
            layers = ml.build_layers(eid, d, st)
            cells = []
            for n in visible_layers(layers, ml.ORDERS[d]):
                cells.append(f"<figure><img src='{small(layers[n].frame, bg=LAYER_BG)}'><figcaption>{n}</figcaption></figure>")
            added = sum(1 for row in labels for n in row if n == ADDED)
            note = f"（後から足した手の輪郭 {added}）" if added else ""
            row = "<span class=op>→</span>".join(cells)
            row += (f"<span class=op>＝</span><figure class=res><img src='{small(frame)}'>"
                    f"<figcaption>試作{note}</figcaption></figure>"
                    f"<figure><img src='{small(frame, differences(cur, frame))}'>"
                    f"<figcaption>試作・赤枠つき（変わった画素 {diffs[st]}）</figcaption></figure>"
                    f"<figure><img src='{small(cur)}'><figcaption>今の絵</figcaption></figure>")
            html.append(f"<h3>{d}_{st}</h3><div class=row>{row}</div>")
        if same:
            html.append(f"<p>今の絵と同じ（並べていない）: {'・'.join(same)}</p>")
    Path(out).write_text("\n".join(html), encoding="utf-8")
    print("ok", out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
