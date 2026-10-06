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
# 足元の行。forge の unit の規約で決まっているのは 32px のコマの y=30 だけ（ほかの大きさは未確定）
FOOT_Y = 30


def data_uri(path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    unit_path, out_path = Path(sys.argv[1]), Path(sys.argv[2])
    try:
        unit = json.loads(unit_path.read_text(encoding="utf-8"))
    except OSError as e:
        print(f"{unit_path}: 読めない: {e}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as e:
        print(f"{unit_path}: JSON として読めない: {e}", file=sys.stderr)
        return 1
    try:
        name = unit["name"]
        m = unit["sprites"]["map"]
        frame, sheet_name = m["frame"], m["sheet"]
        states = [{"key": k, "label": label, "frames": m[k]["frames"], "fps": m[k]["fps"]} for k, label in STATES]
    except (KeyError, TypeError) as e:
        print(f"{unit_path}: name・sprites.map の frame・sheet・各状態の frames と fps のどれかが無い（{e}）", file=sys.stderr)
        return 1
    # JSON の値の型は信用できないので、パスの結合や HTML に入れる前に確かめる（bool は int の仲間なので除く）
    if not isinstance(sheet_name, str) or not sheet_name:
        print(f"{unit_path}: sprites.map.sheet は空でない文字列にする（{sheet_name!r} だった）", file=sys.stderr)
        return 1
    if isinstance(frame, bool) or not isinstance(frame, int) or frame < 1:
        print(f"{unit_path}: sprites.map.frame は1以上の整数にする（{frame!r} だった）", file=sys.stderr)
        return 1
    sheet = (IMAGES / sheet_name).resolve()
    if not sheet.is_relative_to(IMAGES.resolve()):
        print(f"{unit_path}: sprites.map.sheet {sheet_name!r} は {IMAGES}/ の中のファイルにする", file=sys.stderr)
        return 1
    for path in (sheet, IMAGES / "tile-plain.png"):
        if not path.is_file():
            print(f"{path} が無い（リポジトリの直下で実行する）", file=sys.stderr)
            return 1
    config = {
        "name": name,
        "frame": frame,
        "footY": FOOT_Y if frame == 32 else None,
        "states": states,
        "dirs": DIRS,
        "sheet": data_uri(sheet),
        "grass": data_uri(IMAGES / "tile-plain.png"),
        "sheetName": sheet_name,
    }
    # 値に "</script>" があっても script 要素が途中で閉じないよう、"<" をエスケープして埋め込む
    payload = json.dumps(config, ensure_ascii=False).replace("<", "\\u003c")
    html = TEMPLATE.read_text(encoding="utf-8").replace("/*CONFIG*/null", payload)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")
    print(out_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
