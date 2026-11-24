"""顔の切り出し範囲を依頼者に承認してもらうための HTML ページを作る。

`python -m artgen.crop_review <id>` が `local/check/<id>/review.html` を作る。
`python -m artgen.crop_review <id> <id> ... [--out PATH]` は何人分かを 1 枚のページ
（既定は `local/check/reviews/<日時>.html`）にまとめる。全員を先に検査し、1 人でも書き出しが古ければ作らない。
画像は data URI で埋め込むので、1 ファイルのまま Artifact で公開できる。
何人分かのページでは、元画像と確認図を JPEG に縮める（17 人でも 16MB に収める）。ゲームでの見え方は書き出した PNG のまま。
先に `python -m artgen.export <id>` で書き出しておく。
"""

from __future__ import annotations

import argparse
import base64
import html
import io
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw

from artgen.config import Character, ConfigError, FaceCrop, load_character
from artgen.export import ExportError, face_crop_record, small_name

GAME_BACKGROUND = "#18222c"
PREVIEW_SOURCE_PX = 512
MANY_CHECK_PX = 320  # 何人分かのページの確認図の長辺
MANY_JPEG_QUALITY = 85


@dataclass
class _Parts:
    char_id: str
    character: Character
    crop: FaceCrop
    source: Image.Image
    large: Image.Image
    check_large: Image.Image
    small: Image.Image | None
    check_small: Image.Image | None


def _png_uri(image: Image.Image) -> str:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _jpeg_uri(image: Image.Image, longest: int | None = None) -> str:
    im = image.convert("RGBA")
    if longest is not None:
        im.thumbnail((longest, longest), Image.Resampling.LANCZOS)
    flat = Image.new("RGB", im.size, (255, 255, 255))  # JPEG は透明を持てない（確認図は透明部分が無い）
    flat.paste(im, mask=im.getchannel("A"))
    buf = io.BytesIO()
    flat.save(buf, format="JPEG", quality=MANY_JPEG_QUALITY)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _load(path: Path, what: str) -> Image.Image:
    if not path.is_file():
        raise ExportError(f"{path}: {what}が無い。先に python -m artgen.export を実行する")
    with Image.open(path) as im:
        im.load()
        return im.copy()


def _collect(root: Path, char_id: str) -> _Parts:
    """書き出しが今の設定・元画像と合うかを検査し、ページに載せる画像を読む。"""
    character = load_character(root, char_id)
    crop = character.face_crop
    if crop is None:
        raise ExportError(f"characters/{char_id}/character.yaml: face_crop が無い（承認するものが無い）")
    char_dir = root / "characters" / char_id
    check_dir = root / "local" / "check" / char_id

    # 範囲を直した・元画像を入れ替えたのに export を忘れると、古い画像に新しい枠を描いたページになり、承認が意味を失う。
    # 書き出しの記録（params.json の face_crop）が無い・今の設定や元画像と合わないときは作らない
    params_path = char_dir / "params.json"
    exported = None
    if params_path.is_file():
        exported = json.loads(params_path.read_text(encoding="utf-8")).get("face_crop")
    stale = exported is None or not isinstance(exported.get("source_sha256"), dict)
    if not stale:
        source_dir = char_dir / "source"
        if any(not (source_dir / n).is_file() for n in exported["source_sha256"]):
            stale = True
        else:
            stale = exported != face_crop_record(crop, source_dir, list(exported["source_sha256"]))
    if stale:
        raise ExportError(
            f"characters/{char_id}/params.json: 書き出しの記録が無いか、character.yaml の face_crop・元画像と違う。"
            "先に python -m artgen.export を実行する"
        )

    small = check_small = None
    if crop.small is not None:
        small = _load(char_dir / small_name("face.png"), "書き出した小さい顔（書き出し）")
        check_small = _load(check_dir / "face-small.png", "確認図（書き出し）")
    return _Parts(
        char_id=char_id,
        character=character,
        crop=crop,
        source=_load(char_dir / "source" / "face.png", "元画像").convert("RGB"),
        large=_load(char_dir / "face.png", "書き出した大きい顔（書き出し）"),
        check_large=_load(check_dir / "face-large.png", "確認図（書き出し）"),
        small=small,
        check_small=check_small,
    )


def _body(p: _Parts, many: bool) -> str:
    """1 人分の中身（範囲の座標・範囲と確認図・ゲームでの見え方）。"""
    scale = PREVIEW_SOURCE_PX / p.source.width
    plain = p.source.resize((PREVIEW_SOURCE_PX, round(p.source.height * scale)), Image.Resampling.LANCZOS)
    framed = plain.copy()
    draw = ImageDraw.Draw(framed)
    for box, color in ((p.crop.large, (255, 0, 0)), (p.crop.small, (0, 112, 255))):
        if box is not None:
            draw.rectangle([round(v * scale) for v in box], outline=color, width=3)

    def source_uri(im: Image.Image) -> str:
        return _jpeg_uri(im) if many else _png_uri(im)

    def check_uri(im: Image.Image) -> str:
        return _jpeg_uri(im, MANY_CHECK_PX) if many else _png_uri(im)

    figures = [
        ("元画像（赤＝大きい顔、青＝小さい顔の範囲）", source_uri(framed)),
        ("元画像（枠なし）", source_uri(plain)),
        ("確認図 大きい顔（赤＝透明にした画素）", check_uri(p.check_large)),
    ]
    if p.check_small is not None:
        figures.append(("確認図 小さい顔", check_uri(p.check_small)))
    figure_html = "".join(
        f'<figure><img src="{uri}" style="max-width:100%"><figcaption>{label}</figcaption></figure>'
        for label, uri in figures
    )
    small_or_large = p.small if p.small is not None else p.large
    sizes = [(64, p.large, "64px（会話・セリフ欄・カード）"),
             (40, small_or_large, "40px（下のバー）"),
             (32, small_or_large, "32px（仲間一覧・リザルト）")]
    game_html = "".join(
        f'<figure><img src="{_png_uri(im)}" width="{px}" height="{px}"><figcaption>{label}</figcaption></figure>'
        for px, im, label in sizes
    )
    tag = "h3" if many else "h2"
    block = "div" if many else "section"  # 何人分かのページでは、<section> は 1 人に 1 つ
    return (
        f"<p>大きい顔 {list(p.crop.large)}／小さい顔 {list(p.crop.small) if p.crop.small else 'なし'}（元画像の画素の座標）</p>\n"
        f'<{block} class="block"><{tag}>範囲と確認図</{tag}><div class="row">{figure_html}</div></{block}>\n'
        f'<{block} class="block"><{tag}>ゲームでの見え方</{tag}><div class="game">{game_html}</div></{block}>\n'
    )


def _page(title: str, content: str) -> str:
    # Artifact として公開できるよう、<html>・<head>・<body> を書かない形にする（公開時に枠が付く）
    return f"""<title>{html.escape(title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root {{ --bg: #f6f7f9; --fg: #1d232b; --muted: #5b6673; --line: #d5dae1; --game-bg: {GAME_BACKGROUND}; --game-fg: #e7ecf2;
  --check-a: #dfe3e8; --check-b: #ffffff; }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg: #12171d; --fg: #e7ecf2; --muted: #9aa6b4; --line: #2c3541;
  --check-a: #2a323c; --check-b: #1b2128; color-scheme: dark; }} }}
:root[data-theme="dark"] {{ --bg: #12171d; --fg: #e7ecf2; --muted: #9aa6b4; --line: #2c3541;
  --check-a: #2a323c; --check-b: #1b2128; color-scheme: dark; }}
body {{ background: var(--bg); color: var(--fg); font-family: Inter, "Hiragino Sans", "Noto Sans JP", sans-serif;
  padding-block: 20px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }}
h1 {{ font-size: 20px; margin: 0 0 4px; text-wrap: balance; }}
h2 {{ font-size: 15px; margin: 0 0 8px; }}
section.char > h2 {{ font-size: 18px; padding-bottom: 4px; border-bottom: 1px solid var(--line); }}
h3 {{ font-size: 14px; margin: 0 0 8px; }}
p {{ color: var(--muted); margin: 0 0 12px; }}
.block, section.char {{ margin-bottom: 28px; }}
.row {{ display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }}
figure {{ margin: 0; max-width: 100%; min-width: 0; }}
figure img {{ display: block; max-width: 100%; height: auto; border: 1px solid var(--line);
  background: repeating-conic-gradient(var(--check-a) 0 25%, var(--check-b) 0 50%) 0 0 / 16px 16px; }}
figcaption {{ font-size: 13px; color: var(--muted); margin-top: 4px; }}
.game {{ background: var(--game-bg); color: var(--game-fg); padding: 16px; display: flex; gap: 24px; align-items: flex-end; flex-wrap: wrap; }}
.game figure img {{ background: none; border: 0; }}
.game figcaption {{ color: var(--game-fg); }}
</style>
{content}"""


def build_review(root: Path, char_id: str) -> Path:
    root = Path(root)
    p = _collect(root, char_id)
    heading = html.escape(f"{p.character.name}（{char_id}）顔の切り出し")
    out = root / "local" / "check" / char_id / "review.html"
    out.write_text(_page(f"{p.character.name} 顔の切り出し", f"<h1>{heading}</h1>\n{_body(p, many=False)}"), encoding="utf-8")
    return out


def build_reviews(root: Path, char_ids: list[str], out: Path | None = None) -> Path:
    """何人分かの承認用のページを 1 枚にまとめる。全員の検査を先に済ませ、1 人でも通らなければ何も書かない。"""
    root = Path(root)
    parts = []
    for char_id in char_ids:
        try:
            parts.append(_collect(root, char_id))
        except (ExportError, ConfigError) as e:
            message = str(e) if char_id in str(e) else f"{char_id}: {e}"
            raise type(e)(message) from e
    sections = "".join(
        f'<section class="char"><h2>{html.escape(f"{p.character.name}（{p.char_id}）")}</h2>\n{_body(p, many=True)}</section>\n'
        for p in parts
    )
    if out is None:
        out = root / "local" / "check" / "reviews" / f"{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    title = f"顔の切り出し {len(parts)} 人"
    out.write_text(_page(title, f"<h1>{html.escape(title)}</h1>\n{sections}"), encoding="utf-8")
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m artgen.crop_review", description="切り出し範囲の承認用ページを作る")
    parser.add_argument("char_ids", nargs="+", metavar="char_id")
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--out", type=Path, default=None, help="何人分かのページの置き場（既定は local/check/reviews/<日時>.html）")
    args = parser.parse_args(argv)
    try:
        if len(args.char_ids) == 1 and args.out is None:
            path = build_review(args.root, args.char_ids[0])
        else:
            path = build_reviews(args.root, args.char_ids, args.out)
    except (ExportError, ConfigError) as e:
        print(f"作れない: {e}")
        return 1
    print(f"作った: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
