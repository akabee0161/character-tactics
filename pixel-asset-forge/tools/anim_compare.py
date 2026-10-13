#!/usr/bin/env python3
"""今のシートと案のシートを、状態×向きで並べて再生するページを作る（2026-10-12、イネスの作業で4回使ったものを移した）。

    tools/anim_compare.py build/sheets/ines.png build/cand_ines.png build/ines_anim.html \\
        --anim ../assets/units/ines.json --dirs down --title "イネスの下向き"

シートの並びは sheets/<ユニット>.txt と同じ（行 = 状態×4 + 向き、向きは down, up, left, right）。
コマ数と fps は、ゲームのユニット設定（--anim、assets/units/<ユニット>.json の sprites.map）から読む。
"""
import argparse
import base64
import html
import json
import sys
from pathlib import Path

from PIL import Image

DIRS = ["down", "up", "left", "right"]
DIR_JA = {"down": "下（正面）", "up": "上（背面）", "left": "左", "right": "右"}
STATE_JA = {"idle": "待機", "walk": "歩き", "attack": "攻撃"}


class AnimError(Exception):
    """ゲームのユニット設定・シート・向きの指定が合わない。"""


def load_states(path: Path) -> list[tuple[str, str, int, float]]:
    """(状態, 日本語名, コマ数, fps) を idle・walk・attack の順に。"""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise AnimError(f"{path}: 読めない: {exc}") from None
    except json.JSONDecodeError as exc:
        raise AnimError(f"{path}: JSON として読めない: {exc}") from None
    sprites = data.get("sprites") if isinstance(data, dict) else None
    anim = sprites.get("map") if isinstance(sprites, dict) else None
    if not isinstance(anim, dict):
        raise AnimError(f"{path}: sprites.map が無い（ゲームのユニット設定 assets/units/<ユニット>.json を渡す）")
    out = []
    for key, ja in STATE_JA.items():
        spec = anim.get(key)
        frames = spec.get("frames") if isinstance(spec, dict) else None
        fps = spec.get("fps") if isinstance(spec, dict) else None
        ok_frames = isinstance(frames, int) and not isinstance(frames, bool) and frames >= 1
        ok_fps = isinstance(fps, (int, float)) and not isinstance(fps, bool) and fps > 0
        if not (ok_frames and ok_fps):
            raise AnimError(f"{path}: sprites.map.{key} に frames（1以上の整数）と fps（正の数）が要る")
        out.append((key, ja, frames, fps))
    return out


PAGE = """<!doctype html>
<meta charset="utf-8">
<title>{title}</title>
<style>
:root {{
  --bg: #eef1ea; --panel: #f9faf6; --ink: #22261f; --muted: #5d6656; --line: #cfd6c6;
  --now: #7a6a3a; --cand: #2f6f5a; --ground: #b9c9a3;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    color-scheme: dark;
    --bg: #1b1f19; --panel: #232821; --ink: #e6eadf; --muted: #a3ad98; --line: #3a4236;
    --now: #d4bf86; --cand: #7fcfb2; --ground: #4b5a3c;
  }}
}}
:root[data-theme="dark"] {{
  color-scheme: dark;
  --bg: #1b1f19; --panel: #232821; --ink: #e6eadf; --muted: #a3ad98; --line: #3a4236;
  --now: #d4bf86; --cand: #7fcfb2; --ground: #4b5a3c;
}}
body {{ background: var(--bg); color: var(--ink); font-family: "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;
  padding-inline: 16px; padding-block: 20px 40px; line-height: 1.6; }}
main {{ max-width: 980px; margin: 0 auto; display: grid; gap: 22px; }}
h1 {{ font-size: 20px; margin: 0; text-wrap: balance; }}
p.note {{ margin: 0; color: var(--muted); max-width: 65ch; }}
section {{ display: grid; gap: 10px; }}
h2 {{ font-size: 15px; margin: 0; letter-spacing: .04em; }}
.row {{ display: flex; flex-wrap: wrap; gap: 14px; }}
figure {{ margin: 0; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 8px;
  display: grid; gap: 6px; justify-items: center; }}
figcaption {{ font-size: 12px; color: var(--muted); }}
.pair {{ display: flex; gap: 8px; }}
.pair div {{ display: grid; gap: 2px; justify-items: center; font-size: 11px; font-weight: 600; }}
.now {{ color: var(--now); }} .cand {{ color: var(--cand); }}
canvas {{ width: 128px; height: 128px; image-rendering: pixelated; background: var(--ground); border-radius: 3px; max-width: 100%; }}
.controls {{ display: flex; gap: 10px; align-items: center; font-size: 13px; }}
button {{ font: inherit; padding: 4px 12px; border-radius: 4px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); cursor: pointer; }}
button:focus-visible {{ outline: 2px solid var(--cand); outline-offset: 2px; }}
</style>
<main>
  <h1>{title}</h1>
  <p class="note">{note}</p>
  <div class="controls"><button id="toggle" type="button">一時停止</button><span id="speed-label">ゲームと同じ速さ</span>
    <button id="slow" type="button">1/3 の速さ</button></div>
  {sections}
</main>
<script>
const SHEETS = {{ now: "{now}", cand: "{cand}" }};
const imgs = {{}};
let playing = true, slow = 1, start = performance.now();
const cells = [...document.querySelectorAll("canvas")];
function draw(t) {{
  for (const c of cells) {{
    const img = imgs[c.dataset.sheet]; if (!img) continue;
    const n = +c.dataset.frames, fps = +c.dataset.fps / slow;
    const i = Math.floor((t - start) / 1000 * fps) % n;
    const ctx = c.getContext("2d"); ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 32, 32);
    ctx.drawImage(img, i * 32, +c.dataset.row * 32, 32, 32, 0, 0, 32, 32);
  }}
  if (playing) requestAnimationFrame(draw);
}}
let left = 2;
for (const k of ["now", "cand"]) {{
  const im = new Image(); im.onload = () => {{ imgs[k] = im; if (--left === 0) requestAnimationFrame(draw); }}; im.src = SHEETS[k];
}}
document.getElementById("toggle").onclick = (e) => {{
  playing = !playing; e.target.textContent = playing ? "一時停止" : "再生";
  if (playing) requestAnimationFrame(draw);
}};
document.getElementById("slow").onclick = (e) => {{
  slow = slow === 1 ? 3 : 1; start = performance.now();
  e.target.textContent = slow === 1 ? "1/3 の速さ" : "ゲームと同じ速さ";
  document.getElementById("speed-label").textContent = slow === 1 ? "ゲームと同じ速さ" : "1/3 の速さ";
}};
</script>
"""


def uri(path: Path) -> str:
    try:
        return "data:image/png;base64," + base64.b64encode(Path(path).read_bytes()).decode()
    except OSError as exc:
        raise AnimError(f"{path}: 読めない: {exc}") from None


def _check_sheet(path: Path, states) -> None:
    """シートに、状態×4方向の行と、一番長い状態のコマが入っているか（入っていないと空のセルが黙って再生される）。"""
    try:
        with Image.open(path) as im:
            width, height = im.size
            im.load()  # 画素まで読む（寸法だけ読めて画素が壊れた PNG を通さない）
    except OSError as exc:
        raise AnimError(f"{path}: 読めない: {exc}") from None
    need_w, need_h = max(frames for _k, _ja, frames, _fps in states) * 32, len(states) * len(DIRS) * 32
    if width < need_w or height < need_h:
        raise AnimError(f"{path}: シートが {width}x{height} で、ゲームのユニット設定の {need_w}x{need_h} に足りない"
                        "（別のユニットのシートか、--anim の取り違え）")


def build_page(now: Path, cand: Path, states, dirs: list[str], title: str, note: str, labels: list[str]) -> str:
    unknown = [d for d in dirs if d not in DIRS]
    if unknown:
        raise AnimError(f"向きは {', '.join(DIRS)} から選ぶ（{', '.join(unknown)} だった）")
    if len(labels) != 2:
        raise AnimError(f"見出し（--labels）は 左,右 の2つにする（{len(labels)} つだった）")
    for sheet in (now, cand):
        _check_sheet(sheet, states)
    labels = [html.escape(s) for s in labels]
    sections = []
    for si, (_key, ja, frames, fps) in enumerate(states):
        figs = []
        for d in dirs:
            row = si * 4 + DIRS.index(d)
            pair = "".join(
                f'<div class="{k}"><canvas width="32" height="32" data-sheet="{k}" data-row="{row}" '
                f'data-frames="{frames}" data-fps="{fps}"></canvas>{label}</div>'
                for k, label in zip(("now", "cand"), labels))
            figs.append(f'<figure><div class="pair">{pair}</div><figcaption>{DIR_JA[d]}</figcaption></figure>')
        sections.append(f'<section><h2>{ja}（{frames}コマ・{fps}fps）</h2><div class="row">{"".join(figs)}</div></section>')
    return PAGE.format(title=html.escape(title), note=html.escape(note), sections="".join(sections),
                       now=uri(now), cand=uri(cand))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("now", type=Path)
    ap.add_argument("cand", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--anim", type=Path, required=True, help="ゲームのユニット設定（assets/units/<ユニット>.json）")
    ap.add_argument("--dirs", default="down,up,left,right")
    ap.add_argument("--title", default="動きの比較")
    ap.add_argument("--note", default="")
    ap.add_argument("--labels", default="今,新しい案", help="左,右 の見出し")
    a = ap.parse_args(argv)
    try:
        page = build_page(a.now, a.cand, load_states(a.anim), a.dirs.split(","), a.title, a.note, a.labels.split(","))
    except AnimError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(page, encoding="utf-8")
    print("書いた", a.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
