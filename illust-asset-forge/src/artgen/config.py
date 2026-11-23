"""YAML の設定（画風・型・キャラクター）の読み込みと検証。"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


class ConfigError(Exception):
    """設定の誤り。メッセージは `<相対パス>: <キーの位置>: <何がおかしいか>`。"""


@dataclass(frozen=True)
class Style:
    name: str
    prompt: list[str]
    negative: list[str]


@dataclass(frozen=True)
class Template:
    name: str
    width: int
    height: int
    prompt: list[str]
    negative: list[str]
    export_size: int | None
    steps: int
    guidance: float
    use_items: bool
    inpaint_strength: float | None
    inpaint_feather: int | None
    inpaint_box: tuple[int, int, int, int] | None


@dataclass(frozen=True)
class ClearColor:
    """外につながる白のほかに透明にする色。全チャンネルの最小値が min 以上、
    かつ r-g <= max_rg、かつ g-b <= max_gb。"""

    min: int
    max_rg: int
    max_gb: int


@dataclass(frozen=True)
class FaceCrop:
    """顔の元画像から大きい顔・小さい顔を切り出す範囲（元画像の画素の座標。正方形）。"""

    large: tuple[int, int, int, int]
    small: tuple[int, int, int, int] | None
    clear_colors: tuple[ClearColor, ...]


@dataclass(frozen=True)
class Character:
    id: str
    name: str
    style: str
    subject: list[str]
    appearance: list[str]
    outfit: list[str]
    items: list[str]
    negative: list[str]
    default_expression: str
    expressions: dict[str, list[str]]
    inpaint_box: tuple[int, int, int, int] | None
    face_crop: "FaceCrop | None" = None


_MISSING = object()


def has_unbalanced_parens(tag: str) -> bool:
    """() と [] の対応が取れていないタグか。"""
    return tag.count("(") != tag.count(")") or tag.count("[") != tag.count("]")


def parse_tag_list(prefix: str, where: str, value: Any) -> list[str]:
    """タグの一覧（文字列のリストで、カッコの対応が取れている）を検査して返す。"""
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise ConfigError(f"{prefix}: {where}: タグの一覧でない")
    for tag in value:
        if has_unbalanced_parens(tag):
            raise ConfigError(
                f"{prefix}: {where}: タグ {tag!r} のカッコの対応が取れない。"
                "カンマを含むタグは引用符で囲む（例: '(a, b:1.1)'）"
            )
    return list(value)


def parse_box(rel: str, where: str, value: Any) -> tuple[int, int, int, int]:
    """[x0, y0, x1, y1] を検査して返す（0 以上の整数で x0<x1・y0<y1）。"""
    if not isinstance(value, list) or len(value) != 4:
        raise ConfigError(f"{rel}: {where}: [x0, y0, x1, y1] の 4 つの整数でない")
    if any(isinstance(v, bool) or not isinstance(v, int) for v in value):
        raise ConfigError(f"{rel}: {where}: 整数でない")
    x0, y0, x1, y1 = value
    if x0 < 0 or y0 < 0 or x0 >= x1 or y0 >= y1:
        raise ConfigError(f"{rel}: {where}: x0<x1・y0<y1 で 0 以上の四角でない: {value}")
    return (x0, y0, x1, y1)


class _Reader:
    """1 つの YAML の各キーを検査して取り出す。エラーにはファイルの相対パスを付ける。"""

    def __init__(self, root: Path, rel: str):
        self.rel = rel
        path = root / rel
        if not path.is_file():
            raise ConfigError(f"{rel}: ファイルが無い")
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
        except yaml.YAMLError as e:
            raise ConfigError(f"{rel}: YAML として読めない: {e}") from e
        if not isinstance(data, dict):
            raise ConfigError(f"{rel}: 先頭がキーと値の組でない")
        self.data = data

    def fail(self, where: str, problem: str) -> ConfigError:
        return ConfigError(f"{self.rel}: {where}: {problem}")

    def _get(self, key: str, default: Any) -> Any:
        if key in self.data:
            return self.data[key]
        if default is _MISSING:
            raise self.fail(key, "必須のキーが無い")
        return default

    def tags(self, key: str, default: Any = _MISSING) -> list[str]:
        return self.tag_list(key, self._get(key, default))

    def tag_list(self, where: str, value: Any) -> list[str]:
        return parse_tag_list(self.rel, where, value)

    def string(self, key: str) -> str:
        value = self._get(key, _MISSING)
        if not isinstance(value, str) or not value.strip():
            raise self.fail(key, "空でない文字列でない")
        return value

    def integer(self, key: str, default: Any = _MISSING, *, positive: bool = True) -> int:
        value = self._get(key, default)
        return self.as_int(key, value, positive=positive)

    def as_int(self, where: str, value: Any, *, positive: bool = True) -> int:
        if isinstance(value, bool) or not isinstance(value, int):
            raise self.fail(where, "整数でない")
        if positive and value <= 0:
            raise self.fail(where, "正の整数でない")
        return value

    def number(self, where: str, value: Any) -> float:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise self.fail(where, "数値でない")
        return value

    def box(self, where: str, value: Any) -> tuple[int, int, int, int]:
        return parse_box(self.rel, where, value)


def load_default_style(root: Path) -> str:
    """全キャラクター共通のデフォルトの画風名（defaults.yaml の style）。
    character.yaml に style が無いときに使う。"""
    return _Reader(root, "defaults.yaml").string("style")


def load_style(root: Path, name: str) -> Style:
    r = _Reader(root, f"styles/{name}.yaml")
    return Style(name=name, prompt=r.tags("prompt"), negative=r.tags("negative"))


_STYLE_NAME_RE = re.compile(r"[A-Za-z0-9_-]+")


def inline_style(value: Any) -> Style:
    """その場で書いた画風 {"name", "prompt", "negative"} を検査して Style にする。"""
    prefix = "style（その場の定義）"
    if not isinstance(value, dict):
        raise ConfigError(
            f"{prefix}: 画風名の文字列か、{{'name': ..., 'prompt': [...], 'negative': [...]}} の辞書でない: {value!r}"
        )
    unknown = sorted(str(k) for k in set(value) - {"name", "prompt", "negative"})
    if unknown:
        raise ConfigError(f"{prefix}: {', '.join(unknown)}: 使えないキー（name・prompt・negative だけ）")
    name = value.get("name")
    if not isinstance(name, str) or not _STYLE_NAME_RE.fullmatch(name):
        raise ConfigError(
            f"{prefix}: name: 半角英数字・_・- だけの空でない文字列にする（styles/<name>.yaml のファイル名になる）: {name!r}"
        )
    if "prompt" not in value:
        raise ConfigError(f"{prefix}: prompt: 必須のキーが無い")
    prompt = parse_tag_list(prefix, "prompt", value["prompt"])
    if not prompt or any(not t.strip() for t in prompt):
        raise ConfigError(f"{prefix}: prompt: 空でないタグを 1 つ以上並べる")
    negative = parse_tag_list(prefix, "negative", value.get("negative", []))
    return Style(name=name, prompt=prompt, negative=negative)


def load_template(root: Path, name: str) -> Template:
    r = _Reader(root, f"templates/{name}.yaml")

    export_size = r._get("export_size", None)
    if export_size is not None:
        export_size = r.as_int("export_size", export_size)

    use_items = r._get("use_items", False)
    if not isinstance(use_items, bool):
        raise r.fail("use_items", "true か false でない")

    strength = feather = inpaint_box = None
    inpaint = r._get("inpaint", None)
    if inpaint is not None:
        if not isinstance(inpaint, dict):
            raise r.fail("inpaint", "strength と feather の組でない")
        if "strength" not in inpaint:
            raise r.fail("inpaint.strength", "必須のキーが無い")
        if "feather" not in inpaint:
            raise r.fail("inpaint.feather", "必須のキーが無い")
        strength = float(r.number("inpaint.strength", inpaint["strength"]))
        if not 0 < strength <= 1:
            raise r.fail("inpaint.strength", "0 より大きく 1 以下の数でない")
        feather = r.as_int("inpaint.feather", inpaint["feather"], positive=False)
        if feather < 0:
            raise r.fail("inpaint.feather", "0 以上の整数でない")
        if inpaint.get("box") is not None:
            inpaint_box = r.box("inpaint.box", inpaint["box"])

    guidance = r.number("guidance", r._get("guidance", 5))
    return Template(
        name=name,
        width=r.integer("width"),
        height=r.integer("height"),
        prompt=r.tags("prompt"),
        negative=r.tags("negative"),
        export_size=export_size,
        steps=r.integer("steps", 28),
        guidance=guidance,
        use_items=use_items,
        inpaint_strength=strength,
        inpaint_feather=feather,
        inpaint_box=inpaint_box,
    )


def load_character(root: Path, char_id: str) -> Character:
    r = _Reader(root, f"characters/{char_id}/character.yaml")

    raw_expressions = r._get("expressions", _MISSING)
    if not isinstance(raw_expressions, dict) or not raw_expressions:
        raise r.fail("expressions", "表情名とタグの一覧の組でない")
    expressions = {
        str(key): r.tag_list(f"expressions.{key}", value) for key, value in raw_expressions.items()
    }

    default_expression = r.string("default_expression")
    if default_expression not in expressions:
        known = ", ".join(expressions)
        raise r.fail("default_expression", f"{default_expression!r} が expressions に無い（既知: {known}）")

    box = r._get("inpaint_box", None)
    if box is not None:
        box = r.box("inpaint_box", box)

    face_crop = _parse_face_crop(r, r._get("face_crop", None))

    return Character(
        id=char_id,
        name=r.string("name"),
        style=r.string("style") if "style" in r.data else load_default_style(root),
        subject=r.tags("subject"),
        appearance=r.tags("appearance"),
        outfit=r.tags("outfit"),
        items=r.tags("items", []),
        negative=r.tags("negative", []),
        default_expression=default_expression,
        expressions=expressions,
        inpaint_box=box,
        face_crop=face_crop,
    )


def _square_box(r: _Reader, where: str, value: Any) -> tuple[int, int, int, int]:
    box = r.box(where, value)
    if box[2] - box[0] != box[3] - box[1]:
        raise r.fail(where, f"正方形でない（x1-x0 と y1-y0 が違う）: {list(box)}")
    return box


def _parse_face_crop(r: _Reader, raw: Any) -> FaceCrop | None:
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise r.fail("face_crop", "キーと値の組でない")
    unknown = set(raw) - {"large", "small", "clear_colors"}
    if unknown:
        raise r.fail("face_crop", f"知らないキー: {', '.join(sorted(map(str, unknown)))}")
    if raw.get("large") is None:
        raise r.fail("face_crop.large", "必須のキーが無い（small は large が無いと書けない）")
    large = _square_box(r, "face_crop.large", raw["large"])
    small = _square_box(r, "face_crop.small", raw["small"]) if raw.get("small") is not None else None

    colors_raw = raw.get("clear_colors")
    if colors_raw is None:  # 省略と null だけを空とする（false・0・"" などは型の誤りとして下で止める）
        colors_raw = []
    if not isinstance(colors_raw, list):
        raise r.fail("face_crop.clear_colors", "一覧でない")
    colors = []
    for i, item in enumerate(colors_raw):
        where = f"face_crop.clear_colors[{i}]"
        if not isinstance(item, dict) or set(item) != {"min", "max_rg", "max_gb"}:
            raise r.fail(where, "min・max_rg・max_gb の 3 つの組でない")
        values = {}
        for key in ("min", "max_rg", "max_gb"):
            v = r.as_int(f"{where}.{key}", item[key], positive=False)
            if not 0 <= v <= 255:
                raise r.fail(f"{where}.{key}", f"0〜255 の整数でない: {v}")
            values[key] = v
        colors.append(ClearColor(**values))
    return FaceCrop(large=large, small=small, clear_colors=tuple(colors))
