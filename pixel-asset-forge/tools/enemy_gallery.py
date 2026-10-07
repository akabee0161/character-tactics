#!/usr/bin/env python3
"""敵のシートを1つの HTML に並べて、状態×4方向の動きを再生する（依頼者の確認用）。

    tools/enemy_build.py --all
    tools/enemy_gallery.py build/enemy_gallery.html --ref build/sheets/gau.png:ガウ（味方）

PNG は HTML の中に埋め込む（1ファイルで渡せる）。コマ数と fps はゲームの JSON と同じ
（idle 2 / 4fps、walk 4 / 8fps、attack 3 / 6fps）。
"""
from __future__ import annotations

import argparse
import base64
import html
import sys
from pathlib import Path
from string import Template

sys.path.insert(0, str(Path(__file__).resolve().parent))

from enemy_build import ENEMY_DIR, SHEET_DIR, EnemyError, load_recipe  # noqa: E402
from gridfile import GridError, load_palette  # noqa: E402

CARD = Template(
    '<section class="card" data-sheet="data:image/png;base64,$data">'
    '<canvas width="128" height="128"></canvas><p class="frame"></p>'
    '<h2>$name</h2><p class="id">$id</p>'
    '<div class="row">$states</div><div class="row">$dirs</div></section>'
)
STATE_BUTTONS = "".join(f'<button data-state="{s}">{s}</button>' for s in ("idle", "walk", "attack"))
DIR_BUTTONS = "".join(f'<button data-dir="{i}">{d}</button>' for i, d in enumerate(("down", "up", "left", "right")))

PAGE = Template("""<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>敵の一覧</title>
<style>
:root { --bg: #fafafa; --fg: #1c1c22; --card: #ffffff; --line: #d8d8e0; --mute: #666; --btn: #eceef6; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #14141a; --fg: #ececf2; --card: #1e1e28; --line: #34344a; --mute: #9a9ab0; --btn: #2a2a3a; } }
:root[data-theme="dark"] { --bg: #14141a; --fg: #ececf2; --card: #1e1e28; --line: #34344a; --mute: #9a9ab0; --btn: #2a2a3a; }
body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font-family: system-ui, sans-serif; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 8px; }
canvas { width: 100%; height: auto; aspect-ratio: 1; image-rendering: pixelated; background: #48484f; border-radius: 4px; }
h2 { font-size: 14px; margin: 6px 0 0; } .id { margin: 0 0 6px; font-size: 11px; color: var(--mute); }
.row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
button { font: inherit; font-size: 12px; background: var(--btn); color: var(--fg); border: 1px solid var(--line); border-radius: 4px; padding: 2px 6px; }
button[aria-pressed="true"] { border-color: var(--fg); font-weight: 600; }
.controls { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-bottom: 12px; font-size: 13px; }
.frame { font-size: 11px; color: var(--mute); }
</style></head><body>
<div class="controls">速さ:
<button data-speed="1" aria-pressed="true">ゲームと同じ</button><button data-speed="0.5">1/2</button><button data-speed="0.25">1/4</button>
<button id="pause">止める</button><button id="step">1コマ送り</button></div>
<div class="grid">$cards</div>
<script>
const STATES = { idle: { frames: 2, fps: 4, row: 0 }, walk: { frames: 4, fps: 8, row: 4 }, attack: { frames: 3, fps: 6, row: 8 } };
let speed = 1, paused = false;
const cards = [];
document.querySelectorAll("button[data-speed]").forEach(function (b) {
  b.onclick = function () {
    speed = Number(b.dataset.speed);
    document.querySelectorAll("button[data-speed]").forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
  };
});
const pauseButton = document.getElementById("pause");
function setPaused(p) { paused = p; pauseButton.textContent = p ? "再生" : "止める"; }
pauseButton.onclick = function () { setPaused(!paused); };
document.getElementById("step").onclick = function () {
  setPaused(true);
  cards.forEach(function (c) { c.frame += 1; c.acc = 0; });
};
document.querySelectorAll(".card").forEach(function (card) {
  const img = new Image();
  img.src = card.dataset.sheet;
  const canvas = card.querySelector("canvas");
  const label = card.querySelector(".frame");
  const ctx = canvas.getContext("2d");
  const c = { state: "idle", dir: 0, frame: 0, acc: 0 };
  cards.push(c);
  card.querySelectorAll("button[data-state]").forEach(function (b) { b.onclick = function () { c.state = b.dataset.state; c.frame = 0; c.acc = 0; }; });
  card.querySelectorAll("button[data-dir]").forEach(function (b) { b.onclick = function () { c.dir = Number(b.dataset.dir); }; });
  let last = null;
  function draw(t) {
    const s = STATES[c.state];
    if (last !== null && !paused) {
      c.acc += (t - last) * speed;
      const per = 1000 / s.fps;
      while (c.acc >= per) { c.acc -= per; c.frame += 1; }
    }
    last = t;
    const col = c.frame % s.frames;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, col * 32, (s.row + c.dir) * 32, 32, 32, 0, 0, canvas.width, canvas.height);
    label.textContent = "コマ " + (col + 1) + " / " + s.frames;
    requestAnimationFrame(draw);
  }
  img.onload = function () { requestAnimationFrame(draw); };
});
</script></body></html>
""")


def render_gallery(entries: list[tuple[str, str, Path]]) -> str:
    cards = [
        CARD.substitute(
            data=base64.b64encode(png.read_bytes()).decode("ascii"),
            name=html.escape(name),
            id=html.escape(id_),
            states=STATE_BUTTONS,
            dirs=DIR_BUTTONS,
        )
        for id_, name, png in entries
    ]
    return PAGE.substitute(cards="\n".join(cards))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("out", type=Path, help="書き出す HTML")
    parser.add_argument("--ref", action="append", default=[], metavar="PNG:名前", help="比較用に先頭へ足すシート（味方など）")
    args = parser.parse_args(argv)
    try:
        entries: list[tuple[str, str, Path]] = []
        for ref in args.ref:
            png, _, name = ref.rpartition(":")
            if not png or not Path(png).is_file():
                raise EnemyError(f"--ref {ref!r}: PNG:名前 の形で、PNG が存在すること")
            entries.append((Path(png).stem, name, Path(png)))
        palette = load_palette()
        for path in sorted(ENEMY_DIR.glob("*.json")):
            recipe = load_recipe(path, palette)
            png = SHEET_DIR / f"{recipe.id}.png"
            if not png.is_file():
                raise EnemyError(f"{png} が無い（先に tools/enemy_build.py --all）")
            entries.append((recipe.id, recipe.name, png))
        if not entries:
            raise EnemyError("並べるシートが無い")
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(render_gallery(entries), encoding="utf-8")
        print(f"ok   {args.out}  {len(entries)} 体")
    except (EnemyError, GridError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
