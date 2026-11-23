"""候補のページ（1 枚の HTML）。Artifact で依頼者に見せる。GPU も Modal も要らない。

残す候補を番号順に上へ、決まりで外した候補は `<details>` にたたんで理由と一緒に下へ並べる。
絵は長辺 THUMB に縮めて data URI で埋め込む（ページの上限 16MB に収める）。
"""

from __future__ import annotations

import base64
import html
import io
from pathlib import Path

from PIL import Image

from artgen.pnginfo import MissingParamsError, read_params
from artgen.rounds import Candidate, Round

THUMB = 320

_CSS = """
:root{--bg:#faf8f4;--fg:#1f1d1a;--muted:#6b665e;--card:#fff;--line:#d9d3c8;--accent:#8a3b12}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#1a1917;--fg:#ece8e1;--muted:#a39d92;--card:#24221f;--line:#3a3732;--accent:#e8a070}}
:root[data-theme="dark"]{--bg:#1a1917;--fg:#ece8e1;--muted:#a39d92;--card:#24221f;--line:#3a3732;--accent:#e8a070}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif}
main{max-width:960px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:1.3rem;margin:0 0 4px}
p.lead{color:var(--muted);margin:0 0 20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px}
figure img{width:100%;height:auto;display:block;border-radius:4px;background:#fff}
figcaption{margin-top:8px;font-size:.85rem;color:var(--muted);word-break:break-all}
figcaption b{color:var(--fg);font-size:1rem}
.reason{color:var(--accent);font-weight:600}
details{margin-top:28px;border-top:1px solid var(--line);padding-top:12px}
summary{cursor:pointer;font-weight:600}
"""


def _thumb_uri(path: Path) -> str:
    with Image.open(path) as im:
        im = im.convert("RGB")
        im.thumbnail((THUMB, THUMB), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _tags_text(overrides: dict) -> str:
    labels = {"extra": "足す", "remove": "消す", "extra_negative": "ネガティブに足す", "remove_negative": "ネガティブから消す"}
    parts = []
    for key, label in labels.items():
        value = overrides.get(key)
        if value:
            parts.append(f"{label}: {', '.join(value) if isinstance(value, list) else value}")
    return " / ".join(parts) if parts else "足し引きなし"


def _figure(c: Candidate) -> tuple[str, str]:
    """(HTML, キャラクター名) を返す。"""
    try:
        params = read_params(c.path)
    except (MissingParamsError, OSError):
        params = {}
    overrides = params.get("overrides") if isinstance(params.get("overrides"), dict) else {}
    reasons = (
        f'<div class="reason">外した理由: {html.escape("、".join(c.reasons))}</div>' if c.reasons else ""
    )
    body = (
        f'<figure><img alt="{c.number} 番" src="{_thumb_uri(c.path)}">'
        f"<figcaption><b>{c.number} 番</b> シード {html.escape(str(params.get('seed', '不明')))}"
        f" / {html.escape(str(params.get('template', '')))}<br>"
        f"{html.escape(_tags_text(overrides))}<br>{html.escape(c.path.name)}{reasons}</figcaption></figure>"
    )
    return body, str(params.get("character", ""))


def build_page(round_: Round, out_path: Path) -> Path:
    kept, excluded, chars = [], [], []
    for c in sorted(round_.candidates, key=lambda c: c.number):
        fig, char = _figure(c)
        if char and char not in chars:
            chars.append(char)
        (excluded if c.reasons else kept).append(fig)
    title = f"候補 {'・'.join(chars) or '不明'} {round_.run_id}"
    folded = ""
    if excluded:
        folded = (
            f"<details><summary>道具が外した候補（{len(excluded)} 件）。外しすぎなら番号で教えてください</summary>"
            f'<div class="grid" style="margin-top:12px">{"".join(excluded)}</div></details>'
        )
    page = (
        '<!doctype html><html lang="ja"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        f"<title>{html.escape(title)}</title><style>{_CSS}</style></head><body><main>"
        f"<h1>{html.escape(title)}</h1>"
        '<p class="lead">採用する候補を、番号で教えてください（「採用」か「左右反転して採用」）。</p>'
        f'<div class="grid">{"".join(kept)}</div>{folded}</main></body></html>'
    )
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(page, encoding="utf-8")
    return out_path
