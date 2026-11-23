"""顔の候補を、画素を数えて決まりで外す道具。GPU は要らない。顔のテンプレートの絵にだけ使う。

外す理由は 2 つ。
- 頭が切れている: 上の辺から TOP_BAND 行の画素のうち、背景でないものが TOP_LIMIT を超える
- 背景が白・クリーム色でない: 上の左右の角（CORNER_SIZE 角）の画素のうち、背景でないものが CORNER_LIMIT を超える

背景は、白（全チャンネル 240 以上）と飾りのクリーム色（最小値 214 以上で r−g ≤ 14 かつ g−b ≤ 16）。
背景を透明にする手順（外につながる背景色を四辺から塗りつぶす）が使えるかを見るので、辺全体でなく
上の角だけを見る。顔のテンプレートでは、兜の飾り・肩の鎧・服が左右の辺や下の辺にかかるのが普通で、
辺全体を数えると騎士・魔法使い・ボルグが背景のせいで外れてしまう（計画の「四辺」からの変更）。

実測（1024 角の元画像。上の帯 = 上から 4 行の背景でない割合、角 = 上の左右 16 角の背景でない割合）:

| 絵 | 上の帯 | 左上の角 | 右上の角 |
|---|---|---|---|
| ally05（ボルグ） | 0.712 | 0.0 | 0.0 |
| knight | 0.759 | 0.0 | 0.0 |
| mage | 0.729 | 0.0 | 0.0 |
| schoolboy | 0.353 | 0.0 | 0.0 |
| schoolgirl | 0.0 | 0.0 | 0.0 |
| 灰色の地（合成） | — | 1.0 | 1.0 |

schoolboy は、髪が上の辺に触れている（目で見ても髪の上が切れている）ので、頭が切れている側に入る。
外れる絵（0.35 以上）と残る絵（0.0）の間に余裕を取って TOP_LIMIT を決めた。
"""

from __future__ import annotations

from PIL import Image

REASON_HEAD_CUT = "頭が切れている"
REASON_BACKGROUND = "背景が白・クリーム色でない"

TOP_BAND = 4
TOP_LIMIT = 0.02
CORNER_SIZE = 16
CORNER_LIMIT = 0.2


def is_background(rgb: tuple[int, int, int]) -> bool:
    """白（全チャンネル 240 以上）か、飾りのクリーム色（最小値 214 以上で r−g ≤ 14 かつ g−b ≤ 16）。"""
    r, g, b = rgb[:3]
    lowest = min(r, g, b)
    if lowest >= 240:
        return True
    return lowest >= 214 and r - g <= 14 and g - b <= 16


def _non_background_fraction(image: Image.Image, box: tuple[int, int, int, int]) -> float:
    pixels = list(image.crop(box).get_flattened_data())
    if not pixels:
        return 0.0
    return sum(1 for p in pixels if not is_background(p)) / len(pixels)


def measure(image: Image.Image) -> tuple[float, float]:
    """(上の帯の背景でない割合, 上の左右の角の背景でない割合の大きいほう) を返す。"""
    rgb = image.convert("RGB")
    w, _ = rgb.size
    top = _non_background_fraction(rgb, (0, 0, w, TOP_BAND))
    left = _non_background_fraction(rgb, (0, 0, CORNER_SIZE, CORNER_SIZE))
    right = _non_background_fraction(rgb, (w - CORNER_SIZE, 0, w, CORNER_SIZE))
    return top, max(left, right)


def screen_face(image: Image.Image) -> list[str]:
    """外す理由の一覧（空なら残す）。"""
    top, corner = measure(image)
    reasons = []
    if top > TOP_LIMIT:
        reasons.append(REASON_HEAD_CUT)
    if corner > CORNER_LIMIT:
        reasons.append(REASON_BACKGROUND)
    return reasons
