"""採用した画像（source/）を受け渡しの形に書き出す。GPU は要らない。"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw

from artgen.config import ConfigError, load_character, load_template
from artgen.face_crop import render_face, render_face_matte
from artgen.matte import harden, load_matte
from artgen.pnginfo import MissingParamsError, read_params

SMALL_EXPORT_SIZE = 128


class ExportError(Exception):
    """書き出せない入力（名前・形・条件の不足）。"""


def small_name(name: str) -> str:
    """`face.png` → `face-small.png`、`face_hurt.png` → `face_hurt-small.png`。"""
    stem, dot, ext = name.rpartition(".")
    return f"{stem}-small{dot}{ext}"


def face_crop_record(crop, source_dir: Path, names: list[str]) -> dict:
    """params.json の face_crop に書く記録。使った範囲と、切り出した元画像の SHA-256。
    承認用ページ（crop_review）が、書き出しが今の設定・今の元画像のものかを照合するのに使う。
    マスクで透明にしたときは、使ったマスクの SHA-256 も記録する（マスクを作り直したら古いと分かるように）。"""
    record = {
        "large": list(crop.large),
        "small": list(crop.small) if crop.small is not None else None,
        # min_rg は書いたときだけ記録する（書いていない人の今までの記録を古くしないため）
        "clear_colors": [
            {"min": c.min, "max_rg": c.max_rg, "max_gb": c.max_gb, **({"min_rg": c.min_rg} if c.min_rg is not None else {})}
            for c in crop.clear_colors
        ],
        "source_sha256": {n: hashlib.sha256((source_dir / n).read_bytes()).hexdigest() for n in sorted(names)},
    }
    if crop.matte:
        matte_dir = source_dir.parent / "matte"
        record["matte"] = True
        if crop.erase:
            record["erase"] = [[list(p) for p in poly] for poly in crop.erase]
        record["matte_sha256"] = {
            n: hashlib.sha256((matte_dir / n).read_bytes()).hexdigest() if (matte_dir / n).is_file() else None
            for n in sorted(names)
        }
    return record


def _check_name(stem: str, kind: str) -> str:
    return f"{stem}-{kind}.png"


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

    crop = character.face_crop
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
                if crop is not None:
                    for label, box in (("large", crop.large), ("small", crop.small)):
                        if box is not None and (box[2] > im.width or box[3] > im.height):
                            raise ConfigError(
                                f"characters/{char_id}/character.yaml: face_crop.{label}: "
                                f"範囲 {list(box)} が元画像 {src.name}（{im.width}x{im.height}）の外にはみ出す"
                            )
        plans.append((src, char_dir / src.name, template.export_size))
        all_params[src.name] = params

    check_dir = root / "local" / "check" / char_id
    # 書き出すファイルと確認図。これに無い古い出力は、params.json と食い違うので消す
    owners: dict[Path, str] = {}

    def claim(path: Path, owner: str) -> None:
        # 表情名が `normal` と `normal-small` のように、別の入力の出力が同じ名前になるときは、書く前に止める
        if owners.setdefault(path, owner) != owner:
            raise ExportError(f"{path.name}: {owners[path]} と {owner} の出力が同じ名前になる（表情名を変える）")

    for src, dest, size in plans:
        claim(dest, src.name)
        if size is not None and crop is not None:
            claim(check_dir / _check_name(src.stem, "large"), src.name)
            if crop.small is not None:
                claim(char_dir / small_name(src.name), src.name)
                claim(check_dir / _check_name(src.stem, "small"), src.name)
    # マスクも、今の出力を消したり書き換えたりする前に全部読んで検査する
    # （表情のマスクだけが古いときに、顔だけを書き換えてから止まると、出力と params.json が食い違う）
    masks: dict[str, Image.Image] = {}
    if crop is not None and crop.matte:
        for src, _, size in plans:
            if size is None:
                continue
            mask = harden(load_matte(root, char_id, src.name))
            draw = ImageDraw.Draw(mask)
            for polygon in crop.erase:
                draw.polygon(polygon, fill=0)
            masks[src.name] = mask

    wanted = set(owners)
    for name in accepted:
        stem = name.removesuffix(".png")
        for old in (
            char_dir / name,
            char_dir / small_name(name),
            check_dir / _check_name(stem, "large"),
            check_dir / _check_name(stem, "small"),
        ):
            if old not in wanted:
                old.unlink(missing_ok=True)

    written: list[Path] = []
    for src, dest, size in plans:
        if size is None:
            shutil.copyfile(src, dest)
        elif crop is None:
            with Image.open(src) as im:
                im.convert("RGB").resize((size, size), Image.Resampling.LANCZOS).save(dest, format="PNG")
        else:
            check_dir.mkdir(parents=True, exist_ok=True)
            with Image.open(src) as im:
                jobs = [("large", crop.large, size, dest)]
                if crop.small is not None:
                    jobs.append(("small", crop.small, SMALL_EXPORT_SIZE, char_dir / small_name(src.name)))
                mask = masks.get(src.name)
                for kind, box, out_size, out_path in jobs:
                    if mask is not None:
                        rendered, check = render_face_matte(im, mask, box, out_size)
                    else:
                        rendered, check = render_face(im, box, out_size, crop.clear_colors)
                    rendered.save(out_path, format="PNG")
                    check.save(check_dir / _check_name(src.stem, kind), format="PNG")
                    written.append(out_path)
            continue
        written.append(dest)

    if crop is not None:
        face_names = [src.name for src, _, size in plans if size is not None]
        all_params["face_crop"] = face_crop_record(crop, source_dir, face_names)
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
