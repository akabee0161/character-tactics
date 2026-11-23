"""ノートブックで候補を選び・範囲を決め・画風を見比べる画面。ipywidgets は使うときだけ import する。"""

from __future__ import annotations

import hashlib
import html
import io
from pathlib import Path

from PIL import Image

from artgen.config import ConfigError, load_template
from artgen.mask import check_box, check_feather, overlay_box
from artgen.pnginfo import MissingParamsError, read_params
from artgen.selection import run_paths

_HANDLED = (ConfigError, MissingParamsError, OSError)


def _env(widgets, display):
    if widgets is None:
        import ipywidgets as widgets
    if display is None:
        from IPython.display import display
    return widgets, display


def _show(widget, text: str) -> None:
    widget.value = html.escape(text)


def _png(image: Image.Image, thumb: int) -> bytes:
    small = image.convert("RGB")
    small.thumbnail((thumb, thumb))
    buf = io.BytesIO()
    small.save(buf, format="PNG")
    return buf.getvalue()


def _thumb_bytes(path: Path, thumb: int) -> bytes:
    with Image.open(path) as im:
        return _png(im, thumb)


def pick(forge, paths=None, run_id=None, *, char=None, kind=None, widgets=None, display=None,
         thumb: int = 320) -> None:
    """候補を縦に並べ、[採用]（顔の元絵だけ [左右反転して採用]）を付ける。

    paths を渡さないときは run_paths で探す。char・kind でキャラクター・種類を絞れる。"""
    widgets, display = _env(widgets, display)
    if paths is None:
        paths = run_paths(forge.out_dir, run_id, char=char, kind=kind)
    elif char is not None or kind is not None or run_id is not None:
        raise ConfigError("paths を渡したときは char・kind・run_id は使えない（どちらかだけにする）")
    paths = [Path(p) for p in paths]

    entries = []  # (char_id, path, params | None)
    for p in paths:
        try:
            params = read_params(p)
        except (MissingParamsError, OSError):
            params = None
        entries.append((str((params or {}).get("character", "（不明）")), p, params))

    last_char = None
    for char_id, path, params in entries:
        if char_id != last_char:
            display(widgets.HTML(value=f"<h3>{html.escape(char_id)}</h3>"))
            last_char = char_id
        seed = (params or {}).get("seed", "?")
        caption = widgets.HTML(value=f"{html.escape(path.name)}（シード {html.escape(str(seed))}）")
        try:
            data = _thumb_bytes(path, thumb)
            with Image.open(io.BytesIO(data)) as small:
                width, height = small.size
            # 大きさを渡さないと、Colab が出力欄の幅まで引き伸ばして表示する
            image = widgets.Image(value=data, format="png", width=width, height=height)
        except OSError as e:
            image = widgets.HTML(value=f"画像を開けない: {html.escape(str(e))}")
        result = widgets.HTML(value="")  # Label は折り返さないので HTML にする

        def adopt(flip, path=path, result=result):
            try:
                saved = forge.adopt(path, flip=flip)
            except _HANDLED as e:
                _show(result, f"採用できない: {e}")
            except Exception as e:  # ボタンの中の例外は画面に出ないので、ここで文字にする
                _show(result, f"採用できない: {type(e).__name__}: {e}")
            else:
                text = f"採用: {saved.parent.name}/{saved.name}"
                moved = forge.selected.last_moved
                if moved:
                    text += f"（{'・'.join(moved)} を replaced/{forge.selected.last_replaced}/ へ移した）"
                _show(result, text)

        adopt_btn = widgets.Button(description="採用")
        adopt_btn.on_click(lambda _b, adopt=adopt: adopt(False))
        buttons = [adopt_btn]
        is_plain_face = bool(params) and params.get("template") == "face" and not params.get("source")
        if is_plain_face:
            flip_btn = widgets.Button(description="左右反転して採用")
            flip_btn.on_click(lambda _b, adopt=adopt: adopt(True))
            buttons.append(flip_btn)
        display(widgets.VBox([caption, image, widgets.HBox(buttons), result]))


def edit_box(forge, char_id: str, *, widgets=None, display=None) -> None:
    """採用した顔に赤枠を重ね、スライダーで範囲を動かして selection.json に保存する。"""
    face = forge.selected.face_path(char_id)
    if not face.is_file():
        raise ConfigError(f"{char_id}: 顔を採用していない。顔を採用してから範囲を決める")
    box, _source = forge.resolve_box(char_id)
    feather = load_template(forge.root, "face").inpaint_feather
    widgets, display = _env(widgets, display)
    face_bytes = face.read_bytes()
    opened_sha = hashlib.sha256(face_bytes).hexdigest()  # 開いた時の顔。保存の時に同じか確かめる
    with Image.open(io.BytesIO(face_bytes)) as im:
        base = im.convert("RGB")

    limits = (base.width, base.height, base.width, base.height)
    sliders = [
        widgets.IntSlider(value=v, min=0, max=limit, step=8, description=name, continuous_update=False)
        for name, v, limit in zip(("x0", "y0", "x1", "y1"), box, limits)
    ]
    preview = widgets.Image(value=b"", format="png")
    result = widgets.HTML(value="")

    def current():
        return tuple(int(s.value) for s in sliders)

    def redraw(_change=None):
        result.value = ""  # 前の「決めた」「決められない」を残さない
        try:
            preview.value = _png(overlay_box(base, current()), 512)
        except Exception as e:  # 枠が逆転している間など。描けなくても画面は止めない
            _show(result, f"枠を描けない: {e}")

    def save(_b):
        b = current()
        try:
            if not face.is_file() or hashlib.sha256(face.read_bytes()).hexdigest() != opened_sha:
                _show(result, "決められない: 顔を採用し直したので、この画面を開き直す")
                return
            check_box(b, base.size)
            check_feather(b, feather)
            forge.selected.save_box(char_id, b)
        except _HANDLED as e:
            _show(result, f"決められない: {e}")
        except Exception as e:
            _show(result, f"決められない: {type(e).__name__}: {e}")
        else:
            _show(result, f"決めた: {b}")

    for s in sliders:
        s.observe(redraw, names="value")
    button = widgets.Button(description="この範囲で決める")
    button.on_click(save)
    redraw()
    display(widgets.VBox([preview, *sliders, button, result]))


def show_styles(paths, *, display=None, thumb: int = 256, widgets=None) -> None:
    """行＝画風・列＝シードの一覧を 1 枚の画像で出し、行ごとに画風名を添える。"""
    widgets, display = _env(widgets, display)
    cells: dict[tuple[str, int], Path] = {}
    styles: list[str] = []
    seeds: list[int] = []
    for p in paths:
        try:
            params = read_params(Path(p))
        except (MissingParamsError, OSError) as e:
            raise ConfigError(f"show_styles: {Path(p).name}: 条件を読めない: {e}") from e
        style = params.get("style") or "（画風不明）"
        seed = params.get("seed", "（シード不明）")
        if style not in styles:
            styles.append(style)
        if seed not in seeds:
            seeds.append(seed)
        cells[(style, seed)] = Path(p)
    if not cells:
        raise ConfigError("show_styles: 画像が 1 枚も無い")

    sheet = Image.new("RGB", (thumb * len(seeds), thumb * len(styles)), (255, 255, 255))
    for r, style in enumerate(styles):
        for c, seed in enumerate(seeds):
            path = cells.get((style, seed))
            if path is None:
                continue
            with Image.open(path) as im:
                small = im.convert("RGB")
            small.thumbnail((thumb, thumb))
            sheet.paste(small, (c * thumb, r * thumb))
    buf = io.BytesIO()
    sheet.save(buf, format="PNG")

    seed_text = "・".join(str(s) for s in seeds)
    display(widgets.HTML(value=f"列（左から）: シード {html.escape(seed_text)}"))
    display(widgets.Image(value=buf.getvalue(), format="png"))
    for r, style in enumerate(styles):
        display(widgets.HTML(value=f"{r + 1} 行目: <b>{html.escape(str(style))}</b>"))
