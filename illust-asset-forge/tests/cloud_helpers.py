"""Task 4 のテストが共有する、候補の作り方（FakePipe の白い絵）。"""

from pathlib import Path

from artgen.forge import Forge
from artgen.local import local_dirs
from test_forge import ENV, FakePipe


def make_forge(root: Path) -> Forge:
    dirs = local_dirs(root)
    return Forge(FakePipe(color=(255, 255, 255)), root, dirs.runs, lambda s: s, dict(ENV))


def make_candidates(root: Path) -> list[Path]:
    """c1 の顔（シード 1）・顔（シード 2）・全身（シード 3）の 3 枚。"""
    forge = make_forge(root)
    first = forge.generate("c1", "face", seeds=[1])[0]
    second = forge.generate("c1", "face", seeds=[2])[0]
    full = forge.generate("c1", "fullbody", seeds=[3])[0]
    return [first, second, full]


def paint_left_half_red(path: Path) -> None:
    """左右が非対称の絵にする（反転したかどうかを見分けるため）。条件はそのまま。"""
    from PIL import Image, ImageDraw

    from artgen.pnginfo import read_params, save_png

    params = read_params(path)
    with Image.open(path) as im:
        image = im.convert("RGB")
    w, h = image.size
    ImageDraw.Draw(image).rectangle((0, 0, w // 2, h), fill=(200, 0, 0))
    save_png(image, path, params)
