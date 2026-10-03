#!/usr/bin/env python3
"""ユニットのマップスプライトを、アニメーションで見るページ（HTML 1枚）にする。

使い方（リポジトリの直下で）:
    python3 tools/anim-page.py assets/units/roran.json out/anim/roran.html

ユニットの JSON の sprites.map（シート・1コマの大きさ・状態ごとのコマ数と fps）を読み、
シートと地面のタイル（assets/images/tile-plain.png）を data: URI で埋め込む。
外のファイルを読まないので、ブラウザで開くことも、Artifact として公開することもできる。
標準ライブラリだけで動く。
"""
import base64
import json
import sys
from pathlib import Path

IMAGES = Path("assets/images")
TEMPLATE = Path(__file__).with_name("anim-page.html")
STATES = (("idle", "待機"), ("walk", "歩き"), ("attack", "攻撃"))
DIRS = ["下（正面）", "上（背面）", "左", "右"]  # シートの行の順（state_index * 4 + direction_index）


def data_uri(path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    unit_path, out_path = Path(sys.argv[1]), Path(sys.argv[2])
    unit = json.loads(unit_path.read_text(encoding="utf-8"))
    try:
        m = unit["sprites"]["map"]
        states = [{"key": k, "label": label, "frames": m[k]["frames"], "fps": m[k]["fps"]} for k, label in STATES]
    except KeyError as e:
        print(f"{unit_path}: sprites.map に {e} が無い", file=sys.stderr)
        return 1
    sheet = IMAGES / m["sheet"]
    for path in (sheet, IMAGES / "tile-plain.png"):
        if not path.is_file():
            print(f"{path} が無い（リポジトリの直下で実行する）", file=sys.stderr)
            return 1
    config = {
        "name": unit["name"],
        "frame": m["frame"],
        "states": states,
        "dirs": DIRS,
        "sheet": data_uri(sheet),
        "grass": data_uri(IMAGES / "tile-plain.png"),
        "sheetName": m["sheet"],
    }
    html = TEMPLATE.read_text(encoding="utf-8").replace("/*CONFIG*/null", json.dumps(config, ensure_ascii=False))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")
    print(out_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
