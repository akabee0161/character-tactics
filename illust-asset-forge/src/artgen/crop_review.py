"""顔の切り出し範囲を依頼者に承認してもらうための HTML ページを作る。

`python -m artgen.crop_review <id>` が `local/check/<id>/review.html` を作る。
PNG は data URI で埋め込むので、1 ファイルのまま Artifact で公開できる。
先に `python -m artgen.export <id>` で書き出しておく。
"""

from __future__ import annotations

import argparse
import base64
import io
import json
from pathlib import Path

from PIL import Image, ImageDraw

from artgen.config import ConfigError, load_character
from artgen.export import ExportError, face_crop_record, small_name

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
    # Artifact として公開できるよう、<html>・<head>・<body> を書かない形にする（公開時に枠が付く）
    html = f"""<title>{character.name} 顔の切り出し</title>
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
p {{ color: var(--muted); margin: 0 0 12px; }}
section {{ margin-bottom: 28px; }}
.row {{ display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }}
figure {{ margin: 0; max-width: 100%; min-width: 0; }}
figure img {{ display: block; max-width: 100%; height: auto; border: 1px solid var(--line);
  background: repeating-conic-gradient(var(--check-a) 0 25%, var(--check-b) 0 50%) 0 0 / 16px 16px; }}
figcaption {{ font-size: 13px; color: var(--muted); margin-top: 4px; }}
.game {{ background: var(--game-bg); color: var(--game-fg); padding: 16px; display: flex; gap: 24px; align-items: flex-end; flex-wrap: wrap; }}
.game figure img {{ background: none; border: 0; }}
.game figcaption {{ color: var(--game-fg); }}
</style>
<h1>{character.name}（{char_id}）顔の切り出し</h1>
<p>大きい顔 {list(crop.large)}／小さい顔 {list(crop.small) if crop.small else 'なし'}（元画像の画素の座標）</p>
<section><h2>範囲と確認図</h2><div class="row">{figure_html}</div></section>
<section><h2>ゲームでの見え方</h2><div class="game">{game_html}</div></section>
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
