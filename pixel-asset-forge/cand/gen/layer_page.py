"""層で組んだ試作（槍の女性 a の left）を今の絵と並べ、層ごとに表示を切り替えるページ（2026-10-09）。

    .venv/bin/python cand/gen/layer_page.py build/layer_trial.html
"""
import base64
import io
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, "tools")
sys.path.insert(0, str(Path(__file__).resolve().parent))
import enemy_build as eb  # noqa: E402
import mklayers as ml  # noqa: E402
from gridfile import load_palette  # noqa: E402
from layers import ADDED, differences  # noqa: E402

pal = load_palette()
S = 8
BG = (225, 225, 225, 255)
CURRENT = Path("cand/enemy-frames") / ml.EID  # 今の絵（4aad550 で承認済み）
LOOP = ["base", "idle2", "base", "idle2", "walk_a", "base", "walk_b", "base", "atk_wind", "atk_hit"]


def png(frame, bg=BG, marks=()):
    im = Image.new("RGBA", (32, 32), bg)
    for y, row in enumerate(frame):
        for x, n in enumerate(row):
            if n:
                im.putpixel((x, y), tuple(pal[n][:3]) + (255,))
    im = im.resize((32 * S, 32 * S), Image.NEAREST)
    d = ImageDraw.Draw(im)
    for x, y in marks:
        d.rectangle([x * S, y * S, x * S + S - 1, y * S + S - 1], outline=(230, 0, 0), width=2)
    return im


def uri(im):
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def main(out):
    names = ml.ORDER_LEFT + [ADDED]
    html = ["<!doctype html><meta charset=utf-8><title>層で組んだ試作</title>",
            "<style>body{background:#bbb;font-family:sans-serif;max-width:1400px}"
            "figure{display:inline-block;margin:4px 10px 4px 4px;text-align:center;vertical-align:top}"
            "img{image-rendering:pixelated}.stack{position:relative;width:256px;height:256px;background:#e1e1e1}"
            ".stack img{position:absolute;left:0;top:0}label{margin-right:12px}</style>",
            "<h1>槍の女性 a の left: 今の絵と、層で組んだ試作</h1>",
            "<p>8倍。各状態は 左＝今の絵（4aad550）・中＝試作（赤い枠＝今の絵と変わった画素）・右＝試作を層で重ねたもの。"
            "右は下のチェックで層を消せる（手前の層を消すと、奥の層の隠れた部分が見える）。"
            "重なり順（奥→手前）: " + " → ".join(ml.ORDER_LEFT) + "。最後に手の輪郭を閉じた画素は「後から足した輪郭」。</p>",
            "<p>" + "".join(f"<label><input type=checkbox checked data-layer='{i}'>{n}</label>" for i, n in enumerate(names)) + "</p>",
            "<h2>再生（立ち・待機2・歩き・振りかぶり・当たり）</h2>"]
    cur, trial = {}, {}
    for st in ml.STATES:
        cur[st] = eb.read_frame(CURRENT / f"left_{st}.txt")
        trial[st] = ml.compose_frame(st)
    for label, frames in (("今の絵", {st: uri(png(cur[st])) for st in ml.STATES}),
                          ("試作", {st: uri(png(trial[st][0])) for st in ml.STATES})):
        html.append(f"<figure><img class=anim data-frames='{'|'.join(frames[s] for s in LOOP)}' src='{frames['base']}'>"
                    f"<figcaption>{label}</figcaption></figure>")
    for st in ml.STATES:
        frame, labels = trial[st]
        layers = ml.build_layers(st)
        stack = []
        for i, n in enumerate(names):
            if n == ADDED:
                f = [[frame[y][x] if labels[y][x] == ADDED else None for x in range(32)] for y in range(32)]
            else:
                f = layers[n].frame
            stack.append(f"<img data-layer='{i}' src='{uri(png(f, bg=(0, 0, 0, 0)))}'>")
        html.append(f"<h2>left_{st}</h2>")
        html.append(f"<figure><img src='{uri(png(cur[st]))}'><figcaption>今の絵</figcaption></figure>")
        html.append(f"<figure><img src='{uri(png(frame, marks=differences(cur[st], frame)))}'>"
                    f"<figcaption>試作（変わった画素 {len(differences(cur[st], frame))}）</figcaption></figure>")
        html.append(f"<figure><div class=stack>{''.join(stack)}</div><figcaption>層で重ねたもの</figcaption></figure>")
    html.append("<script>document.querySelectorAll('input[data-layer]').forEach(c=>c.onchange=()=>"
                "document.querySelectorAll(`.stack img[data-layer='${c.dataset.layer}']`).forEach(i=>i.style.display=c.checked?'':'none'));"
                "let t=0;setInterval(()=>{t++;document.querySelectorAll('img.anim').forEach(i=>{const f=i.dataset.frames.split('|');i.src=f[t%f.length]})},500)</script>")
    Path(out).write_text("\n".join(html), encoding="utf-8")
    print("ok", out)


if __name__ == "__main__":
    main(sys.argv[1])
