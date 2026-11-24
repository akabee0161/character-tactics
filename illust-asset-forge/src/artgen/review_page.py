"""候補のページ（1 枚の HTML）。Artifact で依頼者に見せる。GPU も Modal も要らない。

全部の候補を番号順に、キャラクターごとの見出しの下に並べる（依頼者が全部を目で見る。機械的には外さない）。
絵は長辺 THUMB の JPEG に縮めて data URI で埋め込む（200 枚でもページの上限 16MB に収める）。
"""

from __future__ import annotations

import base64
import html
import io
from pathlib import Path

from PIL import Image

from artgen.config import ConfigError, load_character
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
h2{font-size:1.1rem;margin:28px 0 10px;padding-bottom:4px;border-bottom:1px solid var(--line)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px}
figure img{width:100%;height:auto;display:block;border-radius:4px;background:#fff}
figcaption{margin-top:8px;font-size:.85rem;color:var(--muted);word-break:break-all}
figcaption b{color:var(--fg);font-size:1rem}
"""


def _thumb_uri(path: Path) -> str:
    with Image.open(path) as im:
        im = im.convert("RGB")
        im.thumbnail((THUMB, THUMB), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=80)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


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
    body = (
        f'<figure><img alt="{c.number} 番" src="{_thumb_uri(c.path)}">'
        f"<figcaption><b>{c.number} 番</b> シード {html.escape(str(params.get('seed', '不明')))}"
        f" / {html.escape(str(params.get('template', '')))}<br>"
        f"{html.escape(_tags_text(overrides))}<br>{html.escape(c.path.name)}</figcaption></figure>"
    )
    return body, str(params.get("character", ""))


def _heading(char: str, root: Path | None) -> str:
    """見出しは「名前（ID）」。root が無いか設定が読めなければ ID だけ。"""
    if root is not None and char:
        try:
            name = load_character(root, char).name
        except (ConfigError, OSError):
            name = ""
        if name:
            return html.escape(f"{name}（{char}）")
    return html.escape(char or "不明")


def build_page(round_: Round, out_path: Path, root: Path | None = None) -> Path:
    groups: dict[str, list[str]] = {}  # 最初に出た順で、キャラクターごとにまとめる
    for c in sorted(round_.candidates, key=lambda c: c.number):
        fig, char = _figure(c)
        groups.setdefault(char, []).append(fig)
    chars = [c for c in groups if c]
    sections = "".join(
        f'<h2>{_heading(char, root)}</h2><div class="grid">{"".join(figs)}</div>' for char, figs in groups.items()
    )
    title = f"候補 {'・'.join(chars) or '不明'} {round_.run_id}"
    page = (
        '<!doctype html><html lang="ja"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        f"<title>{html.escape(title)}</title><style>{_CSS}</style></head><body><main>"
        f"<h1>{html.escape(title)}</h1>"
        '<p class="lead">採用する候補を、番号で教えてください（「採用」か「左右反転して採用」）。</p>'
        f"{sections}</main></body></html>"
    )
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(page, encoding="utf-8")
    return out_path
