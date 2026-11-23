"""採用した画像（source/）を受け渡しの形に書き出す。GPU は要らない。"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from PIL import Image

from artgen.config import ConfigError, load_character, load_template
from artgen.pnginfo import MissingParamsError, read_params


class ExportError(Exception):
    """書き出せない入力（名前・形・条件の不足）。"""


def _accepted_names(expressions: list[str]) -> list[str]:
    return ["face.png", *(f"face_{e}.png" for e in expressions), "fullbody.png"]


def _check_matches_name(src: Path, rel_source: str, params: dict, template_name: str, character) -> None:
    """ファイル名から決まる型・表情と、画像の中身・条件が合っているか。取り違えと縮小を止める。"""
    where = f"{rel_source}/{src.name}"
    stem = src.stem
    if stem == "fullbody":
        want_template, want_expression = "fullbody", None
    elif stem == "face":
        want_template, want_expression = "face", character.default_expression
    else:
        want_template, want_expression = "face", stem.removeprefix("face_")
    if template_name != want_template:
        raise ExportError(f"{where}: 条件の template が {template_name!r}。この名前には {want_template!r} の絵が要る")
    if want_expression is not None and params.get("expression", want_expression) != want_expression:
        raise ExportError(
            f"{where}: 条件の expression が {params['expression']!r}。この名前には {want_expression!r} の絵が要る"
        )
    if params.get("character", character.id) != character.id:
        raise ExportError(f"{where}: 条件の character が {params['character']!r}（{character.id!r} の絵でない）")
    w, h = params.get("width"), params.get("height")
    if isinstance(w, int) and isinstance(h, int):
        with Image.open(src) as im:
            if im.size != (w, h):
                raise ExportError(
                    f"{where}: 画像が {im.width}x{im.height} で、条件の {w}x{h} と違う。"
                    "添付で縮められた可能性がある"
                )


def export_character(root: Path, char_id: str) -> list[Path]:
    """`characters/<id>/source/*.png` を `characters/<id>/` に書き出し、params.json を作る。

    すべての入力を検査してから書き始めるので、途中で止まっても何も書かれない。
    """
    root = Path(root)
    if not char_id or Path(char_id).name != char_id or char_id in (".", ".."):
        raise ExportError(f"キャラクターの ID が不正: {char_id!r}")
    character = load_character(root, char_id)
    char_dir = root / "characters" / char_id
    source_dir = char_dir / "source"
    rel_source = f"characters/{char_id}/source"

    if not source_dir.is_dir():
        raise ExportError(f"{rel_source}: フォルダが無い")
    # 隠しファイル（.DS_Store など）は無視する。それ以外は名前を検査する（face.PNG・jpg も止める）
    sources = sorted(p for p in source_dir.iterdir() if p.is_file() and not p.name.startswith("."))
    if not sources:
        raise ExportError(f"{rel_source}: PNG が無い")

    accepted = _accepted_names(list(character.expressions))
    plans: list[tuple[Path, Path, int | None]] = []
    all_params: dict[str, dict] = {}
    for src in sources:
        if src.name not in accepted:
            raise ExportError(
                f"{rel_source}/{src.name}: 受け付けない名前（受け付ける名前: {', '.join(accepted)}）"
            )
        params = read_params(src)  # 無ければ MissingParamsError のまま上げる
        template_name = params.get("template")
        if not isinstance(template_name, str):
            raise ExportError(f"{rel_source}/{src.name}: 条件に template が無い")
        template = load_template(root, template_name)
        _check_matches_name(src, rel_source, params, template_name, character)

        if template.export_size is not None:
            with Image.open(src) as im:
                if im.width != im.height:
                    raise ExportError(
                        f"{rel_source}/{src.name}: 正方形でない（{im.width}x{im.height}）。"
                        "顔は正方形で生成する"
                    )
        plans.append((src, char_dir / src.name, template.export_size))
        all_params[src.name] = params

    # 今回の source に無い古い出力は、params.json と食い違うので消す
    current = {dest.name for _, dest, _ in plans}
    for name in accepted:
        if name not in current:
            (char_dir / name).unlink(missing_ok=True)

    written: list[Path] = []
    for src, dest, size in plans:
        if size is None:
            shutil.copyfile(src, dest)
        else:
            with Image.open(src) as im:
                im.convert("RGB").resize((size, size), Image.Resampling.LANCZOS).save(dest, format="PNG")
        written.append(dest)

    params_path = char_dir / "params.json"
    params_path.write_text(
        json.dumps(all_params, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    written.append(params_path)
    return written


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m artgen.export", description="採用した画像を書き出す")
    parser.add_argument("char_id")
    parser.add_argument("--root", type=Path, default=Path("."))
    args = parser.parse_args(argv)
    try:
        paths = export_character(args.root, args.char_id)
    except (ExportError, MissingParamsError, ConfigError) as e:
        print(f"書き出せない: {e}")
        return 1
    for p in paths:
        print(f"書き出した: {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
