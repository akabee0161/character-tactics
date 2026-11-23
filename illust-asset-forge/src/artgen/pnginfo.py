"""生成の条件を PNG の tEXt（`parameters`）に JSON で書き込み・読み出す。"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, PngImagePlugin

PARAM_KEY = "parameters"


class MissingParamsError(Exception):
    """PNG に生成の条件が無い、または読めない。"""


def save_png(image: Image.Image, path: Path, params: dict) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    info = PngImagePlugin.PngInfo()
    info.add_text(PARAM_KEY, json.dumps(params, ensure_ascii=False))
    image.save(path, format="PNG", pnginfo=info)


def read_params(path: Path) -> dict:
    path = Path(path)
    with Image.open(path) as im:
        text = getattr(im, "text", {}).get(PARAM_KEY)
    hint = "生成の条件が無い。添付やダウンロードで消えた可能性がある"
    if text is None:
        raise MissingParamsError(f"{path.name}: {hint}")
    try:
        params = json.loads(text)
    except json.JSONDecodeError as e:
        raise MissingParamsError(f"{path.name}: {hint}（JSON として読めない: {e}）") from e
    if not isinstance(params, dict):
        raise MissingParamsError(f"{path.name}: {hint}（JSON のオブジェクトでない）")
    return params


def _format(params: dict) -> str:
    # overrides は設定に戻す対象なので先頭に出す
    ordered = {}
    if "overrides" in params:
        ordered["overrides"] = params["overrides"]
    ordered.update({k: v for k, v in params.items() if k != "overrides"})
    return json.dumps(ordered, ensure_ascii=False, indent=2)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m artgen.pnginfo", description="PNG の生成の条件を表示する")
    parser.add_argument("png", nargs="+", type=Path)
    args = parser.parse_args(argv)

    status = 0
    for path in args.png:
        try:
            params = read_params(path)
        except (MissingParamsError, OSError) as e:
            print(f"{path.name}: 条件を読めない: {e}")
            status = 1
            continue
        print(f"== {path.name}")
        print(_format(params))
    return status


if __name__ == "__main__":
    raise SystemExit(main())
