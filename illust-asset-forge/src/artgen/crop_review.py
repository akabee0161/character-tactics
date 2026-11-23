"""顔の切り出し範囲を依頼者に承認してもらうための HTML ページを作る。

`python -m artgen.crop_review <id>` が `local/check/<id>/review.html` を作る。
PNG は data URI で埋め込むので、1 ファイルのまま Artifact で公開できる。
先に `python -m artgen.export <id>` で書き出しておく。
"""

from __future__ import annotations

import argparse
import base64
import io
from pathlib import Path

from PIL import Image, ImageDraw

from artgen.config import ConfigError, load_character
from artgen.export import ExportError, small_name

GAME_BACKGROUND = "#18222c"
PREVIEW_SOURCE_PX = 512


def _data_uri(image: Image.Image) -> str:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _load(path: Path, what: str) -> Image.Image:
    if not path.is_file():
        raise ExportError(f"{path}: {what}が無い。先に python -m artgen.export を実行する")
    with Image.open(path) as im:
        im.load()
        return im.copy()


def build_review(root: Path, char_id: str) -> Path:
    root = Path(root)
    character = load_character(root, char_id)
    crop = character.face_crop
    if crop is None:
        raise ExportError(f"characters/{char_id}/character.yaml: face_crop が無い（承認するものが無い）")
    char_dir = root / "characters" / char_id
    check_dir = root / "local" / "check" / char_id

    source = _load(char_dir / "source" / "face.png", "元画像").convert("RGB")
    large = _load(char_dir / "face.png", "書き出した大きい顔（書き出し）")
    check_large = _load(check_dir / "face-large.png", "確認図（書き出し）")
    small = check_small = None
    if crop.small is not None:
        small = _load(char_dir / small_name("face.png"), "書き出した小さい顔（書き出し）")
        check_small = _load(check_dir / "face-small.png", "確認図（書き出し）")

    scale = PREVIEW_SOURCE_PX / source.width
    plain = source.resize((PREVIEW_SOURCE_PX, round(source.height * scale)), Image.Resampling.LANCZOS)
    framed = plain.copy()
    draw = ImageDraw.Draw(framed)
    for box, color in ((crop.large, (255, 0, 0)), (crop.small, (0, 112, 255))):
        if box is not None:
            draw.rectangle([round(v * scale) for v in box], outline=color, width=3)

    small_or_large = small if small is not None else large
    figures = [
        ("元画像（赤＝大きい顔、青＝小さい顔の範囲）", framed, None),
        ("元画像（枠なし）", plain, None),
        ("確認図 大きい顔（赤＝透明にした画素）", check_large, None),
    ]
    if check_small is not None:
        figures.append(("確認図 小さい顔", check_small, None))
    figure_html = "".join(
        f'<figure><img src="{_data_uri(im)}" style="max-width:100%"><figcaption>{label}</figcaption></figure>'
        for label, im, _ in figures
    )
    sizes = [(64, large, "64px（会話・セリフ欄・カード）"),
             (40, small_or_large, "40px（下のバー）"),
             (32, small_or_large, "32px（仲間一覧・リザルト）")]
    game_html = "".join(
        f'<figure><img src="{_data_uri(im)}" width="{px}" height="{px}"><figcaption>{label}</figcaption></figure>'
        for px, im, label in sizes
    )
    html = f"""<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{character.name} 顔の切り出し</title>
<style>
body {{ font-family: sans-serif; margin: 16px; background: #fff; color: #222; }}
section {{ margin-bottom: 24px; }}
.row {{ display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }}
figure {{ margin: 0; max-width: 100%; }}
figure img {{ display: block; background: repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0 / 16px 16px; }}
figcaption {{ font-size: 13px; margin-top: 4px; }}
.game {{ background: {GAME_BACKGROUND}; color: #eee; padding: 16px; display: flex; gap: 24px; align-items: flex-end; flex-wrap: wrap; }}
.game figure img {{ background: none; }}
</style></head><body>
<h1>{character.name}（{char_id}）顔の切り出し</h1>
<section><h2>範囲</h2><p>大きい顔 {list(crop.large)}／小さい顔 {list(crop.small) if crop.small else 'なし'}</p>
<div class="row">{figure_html}</div></section>
<section><h2>ゲームでの見え方</h2><div class="game">{game_html}</div></section>
</body></html>
"""
    out = check_dir / "review.html"
    out.write_text(html, encoding="utf-8")
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m artgen.crop_review", description="切り出し範囲の承認用ページを作る")
    parser.add_argument("char_id")
    parser.add_argument("--root", type=Path, default=Path("."))
    args = parser.parse_args(argv)
    try:
        path = build_review(args.root, args.char_id)
    except (ExportError, ConfigError) as e:
        print(f"作れない: {e}")
        return 1
    print(f"作った: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
