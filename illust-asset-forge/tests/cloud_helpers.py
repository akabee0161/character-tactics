"""Task 4 のテストが共有する、候補の作り方（FakePipe で作った絵に、頭が切れた版を足す）。"""

from pathlib import Path

from PIL import Image, ImageDraw

from artgen.forge import Forge
from artgen.local import local_dirs
from artgen.pnginfo import read_params, save_png
from test_forge import ENV, FakePipe


def make_forge(root: Path) -> Forge:
    dirs = local_dirs(root)
    return Forge(FakePipe(color=(255, 255, 255)), root, dirs.runs, lambda s: s, dict(ENV))


def cut_head(path: Path) -> None:
    """白地の絵の上の辺に暗い頭をかけて、「頭が切れている」絵にする（条件はそのまま）。"""
    params = read_params(path)
    with Image.open(path) as im:
        image = im.convert("RGB")
    w, _ = image.size
    ImageDraw.Draw(image).ellipse((w // 4, -80, 3 * w // 4, 400), fill=(40, 30, 30))
    save_png(image, path, params)


def make_candidates(root: Path) -> list[Path]:
    """c1 の顔（頭は中、シード 1）・顔（頭が切れている、シード 2）・全身（シード 3）の 3 枚。"""
    forge = make_forge(root)
    ok = forge.generate("c1", "face", seeds=[1])[0]
    cut = forge.generate("c1", "face", seeds=[2])[0]
    cut_head(cut)
    full = forge.generate("c1", "fullbody", seeds=[3])[0]
    return [ok, cut, full]
