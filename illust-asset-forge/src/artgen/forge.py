"""Colab 側の入口。パイプラインを外から受け取る作りで、GPU なしでもテストできる。

torch・diffusers・IPython は `load_pipeline()`・`attach()`・`show()` の中でだけ import する。
"""

from __future__ import annotations

import gc
import random
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from PIL import Image

from artgen.config import (
    ConfigError, Style, inline_style, load_character, load_style, load_template,
)
from artgen.mask import check_box, check_feather, feather_composite, make_mask
from artgen.pnginfo import MissingParamsError, read_params, save_png
from artgen.prompt import Overrides, build_prompt
from artgen.export import _accepted_names
from artgen.selection import (
    SelectionStore, _check_char_id, file_sha256, find_candidate, run_dir, run_kind, selected_name,
)

MODEL_NAME = "cagliostrolab/animagine-xl-4.0"
SAMPLER_NAME = "Euler a"
DEFAULT_BASE_DIR = "/content/drive/MyDrive/illust-asset-forge"
MAX_SEED = 2**32 - 1


class Forge:
    def __init__(
        self,
        pipe,
        root: Path,
        out_dir: Path,
        make_generator: Callable[[int], Any],
        env: dict[str, str],
        *,
        cleanup: Callable[[], None] = lambda: None,
        selected_dir: Path | None = None,
        packs_dir: Path | None = None,
    ):
        self.pipe = pipe
        self.root = Path(root)
        self.out_dir = Path(out_dir)
        self.make_generator = make_generator
        self.env = env
        self.cleanup = cleanup
        self.selected = SelectionStore(
            Path(selected_dir) if selected_dir is not None else self.out_dir.parent / "selected",
            Path(packs_dir) if packs_dir is not None else self.out_dir.parent / "packs",
        )

    # --- 共通 ---------------------------------------------------------

    @staticmethod
    def _seeds(n: int, seeds: list[int] | None) -> list[int]:
        if seeds is None:
            if isinstance(n, bool) or not isinstance(n, int) or n < 1:
                raise ConfigError(f"n: 1 以上の整数でない: {n!r}")
            rng = random.SystemRandom()
            return [rng.randint(0, MAX_SEED) for _ in range(n)]
        seeds = list(seeds)
        if not seeds:
            raise ConfigError("seeds: 空の一覧")
        for s in seeds:
            if isinstance(s, bool) or not isinstance(s, int) or not 0 <= s <= MAX_SEED:
                raise ConfigError(f"seeds: 0〜{MAX_SEED} の整数でない: {s!r}")
        return seeds

    @staticmethod
    def _check_sampling(guidance: float, steps: int, strength: float | None = None) -> None:
        if isinstance(guidance, bool) or not isinstance(guidance, (int, float)) or guidance <= 0:
            raise ConfigError(f"guidance: 0 より大きい数でない: {guidance!r}")
        if isinstance(steps, bool) or not isinstance(steps, int) or steps < 1:
            raise ConfigError(f"steps: 1 以上の整数でない: {steps!r}")
        if strength is not None and (
            isinstance(strength, bool) or not isinstance(strength, (int, float)) or not 0 < strength <= 1
        ):
            raise ConfigError(f"strength: 0 より大きく 1 以下の数でない: {strength!r}")

    @staticmethod
    def _recorded_overrides(overrides: Overrides, **values) -> dict:
        """タグの上書きに、引数で変えた数値（None でないもの）を足して記録する。"""
        return {**overrides.to_dict(), **{k: v for k, v in values.items() if v is not None}}

    def _recorded_style_overrides(
        self, overrides: Overrides, style_ref: str | Style, style: Style, character, **values,
    ) -> dict:
        """_recorded_overrides に画風を足す。その場の定義（Style）は、設定の画風と同じ名前でも
        定義ごと記録する（styles/<name>.yaml にするため）。名前だけの画風は設定と違うときだけ名前を記録する。"""
        recorded = self._recorded_overrides(overrides, **values)
        if isinstance(style_ref, Style):
            recorded["style"] = style.name
            recorded["style_definition"] = {"prompt": list(style.prompt), "negative": list(style.negative)}
        elif style.name != character.style:
            recorded["style"] = style.name
        return recorded

    def _base_params(self, *, prompt, template, style, character, expression, overrides, seed,
                     guidance, steps, run_id) -> dict:
        return {
            "prompt": prompt.positive,
            "negative_prompt": prompt.negative,
            "seed": seed,
            "guidance_scale": guidance,
            "num_inference_steps": steps,
            "sampler": SAMPLER_NAME,
            "model": MODEL_NAME,
            "width": template.width,
            "height": template.height,
            "run_id": run_id,
            "character": character.id,
            "template": template.name,
            "style": style.name,
            "expression": expression,
            "overrides": overrides,
            **self.env,
        }

    def _run(self, jobs, out_dir: Path, build, on_image) -> list[Path]:
        """ジョブ（シード、または (キャラクター, シード) など）ごとに生成して保存する。
        1 枚保存するたびに on_image を呼ぶ。

        ■ で止められたら、保存済みの分を返す（Drive にも残っている）。
        on_image が KeyboardInterrupt を投げた場合も、その 1 枚は保存済みとして含める。
        """
        paths: list[Path] = []
        try:
            for job in jobs:
                image, params, path = build(job)
                save_png(image, path, params)
                paths.append(path)
                self._finish_one()
                if on_image is not None:
                    on_image(path)
        except KeyboardInterrupt:
            print(f"中断: {len(paths)} 枚が {out_dir} の下に保存済み")
        return paths

    def _finish_one(self) -> None:
        gc.collect()
        self.cleanup()

    # --- 生成 ---------------------------------------------------------

    def resolve_style(
        self, char_id: str, style: str | dict | None, inherit: bool,
    ) -> tuple[str | Style, str]:
        """使う画風と、その出どころ（"引数" | "引数（その場の定義）" | "採用した顔" | "設定"）を返す。

        画風は、styles/ にある名前なら名前（str）、その場の定義なら Style で返す。
        その場の定義は、同じ名前の styles/<name>.yaml があっても定義のほうが優先する。
        採用した顔の条件に定義が残っていれば、それを使う（styles/ には無いので）。
        """
        if isinstance(style, dict):
            return inline_style(style), "引数（その場の定義）"
        if style is not None:
            return style, "引数"
        if inherit:
            try:
                adopted = self.selected.face_style(char_id)
                definition = self.selected.face_style_definition(char_id)
            except MissingParamsError as e:
                raise ConfigError(
                    f"{char_id}: 採用した顔 {self.selected.face_path(char_id).name} に生成の条件が無く、画風が分からない"
                    f"（{e}）。顔を候補からもう一度採用し直す"
                ) from e
            if adopted is not None:
                print(f"{char_id}: 画風 {adopted}（採用した顔に合わせた）")
                if definition is not None:
                    try:
                        return inline_style({"name": adopted, **definition}), "採用した顔"
                    except ConfigError as e:
                        raise ConfigError(
                            f"{char_id}: 採用した顔の条件にある画風の定義が使えない: {e}。"
                            "顔を候補からもう一度採用し直す"
                        ) from e
                if not (self.root / "styles" / f"{adopted}.yaml").is_file():
                    raise ConfigError(
                        f"{char_id}: 採用した顔の画風 {adopted!r} は styles/{adopted}.yaml が無く、"
                        "条件にも定義（overrides.style_definition）が無い。"
                        "style= で画風を渡すか、styles/ に追加してから作る"
                    )
                return adopted, "採用した顔"
        return load_character(self.root, char_id).style, "設定"

    def _style_obj(self, style: str | Style) -> Style:
        return style if isinstance(style, Style) else load_style(self.root, style)

    def _text2img_batch(
        self, entries, template, seed_list, overrides, guidance, steps, file_name, on_image,
        *, compare: bool = False,
    ) -> list[Path]:
        """entries（(キャラクター, 画風) の一覧。画風は名前か、その場の定義の Style）を順に、それぞれ seed_list の全シードで生成する。

        GPU を回す前に、全 entries の設定・画風・プロンプトを組み立てて検証する。
        """
        tpl = load_template(self.root, template)
        guidance_used = tpl.guidance if guidance is None else guidance
        steps_used = tpl.steps if steps is None else steps
        self._check_sampling(guidance_used, steps_used)
        run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        kind = run_kind(template, compare=compare)
        plans = {}
        names = []
        for char_id, style_ref in entries:
            character = load_character(self.root, char_id)
            style = self._style_obj(style_ref)
            prompt = build_prompt(style, tpl, character, overrides=overrides)
            recorded = self._recorded_style_overrides(
                overrides, style_ref, style, character, guidance=guidance, steps=steps,
            )
            plans[(char_id, style.name)] = (
                character, style, prompt, recorded, run_dir(self.out_dir, char_id, kind, run_id),
            )
            names.append((char_id, style.name))

        def build(job):
            entry, seed = job
            character, style, prompt, recorded, entry_dir = plans[entry]
            image = self.pipe.text2img(
                prompt=prompt.positive,
                negative_prompt=prompt.negative,
                width=tpl.width,
                height=tpl.height,
                guidance_scale=guidance_used,
                num_inference_steps=steps_used,
                generator=self.make_generator(seed),
                output_type="pil",
            ).images[0]
            params = self._base_params(
                prompt=prompt, template=tpl, style=style, character=character,
                expression=character.default_expression, overrides=recorded, seed=seed,
                guidance=guidance_used, steps=steps_used, run_id=run_id,
            )
            return image, params, entry_dir / file_name(*entry, seed)

        jobs = [(entry, seed) for entry in names for seed in seed_list]
        return self._run(jobs, self.out_dir, build, on_image)

    def generate(
        self,
        char_ids: str | list[str],
        template: str,
        n: int = 4,
        seeds: list[int] | None = None,
        extra: str = "",
        remove: str = "",
        extra_negative: str = "",
        remove_negative: str = "",
        guidance: float | None = None,
        steps: int | None = None,
        style: str | dict | None = None,
        on_image: Callable[[Path], None] | None = None,
    ) -> list[Path]:
        """style は styles/ の画風名か、その場の定義 {"name", "prompt", "negative"}。"""
        if isinstance(char_ids, str):
            char_ids = [char_ids]
        char_ids = list(char_ids)
        if not char_ids:
            raise ConfigError("char_ids: 空の一覧")
        _check_unique(char_ids, "char_ids")
        overrides = Overrides.from_args(extra, remove, extra_negative, remove_negative)
        entries = [
            (c, self.resolve_style(c, style, template != "face")[0]) for c in char_ids
        ]
        seed_list = self._seeds(n, seeds)
        return self._text2img_batch(
            entries, template, seed_list, overrides, guidance, steps,
            lambda c, _style, seed: f"{c}_{template}_{seed}.png", on_image,
        )

    def compare_styles(
        self,
        char_id: str,
        template: str = "face",
        styles: list[str | dict] | None = None,
        seeds: list[int] | None = None,
        n: int = 2,
        on_image: Callable[[Path], None] | None = None,
    ) -> list[Path]:
        """同じシードで画風だけを変えて並べる。styles が None なら styles/ の全部（名前順）。
        styles の要素は styles/ の画風名か、その場の定義の辞書（混ぜてよい）。"""
        if styles is None:
            styles = sorted(p.stem for p in (self.root / "styles").glob("*.yaml"))
        styles = list(styles)
        if not styles:
            raise ConfigError("styles: 画風が 1 つも無い")
        styles = [inline_style(x) if isinstance(x, dict) else x for x in styles]
        _check_unique([x.name if isinstance(x, Style) else x for x in styles], "styles")
        seed_list = self._seeds(n, seeds)
        return self._text2img_batch(
            [(char_id, s) for s in styles], template, seed_list,
            Overrides.from_args("", "", "", ""), None, None,
            lambda c, s, seed: f"{c}_{template}_{s}_{seed}.png", on_image,
            compare=True,
        )

    # --- 表情（inpaint） -----------------------------------------------

    def resolve_box(self, char_id: str) -> tuple[tuple[int, int, int, int], str]:
        """inpaint の範囲と出どころ（"selection.json" | "character.yaml" | "型の既定"）を返す。"""
        box = self.selected.read_box(char_id)
        if box is not None:
            return box, "selection.json"
        character = load_character(self.root, char_id)
        if character.inpaint_box is not None:
            return character.inpaint_box, "character.yaml"
        tpl = load_template(self.root, "face")
        if tpl.inpaint_box is not None:
            return tpl.inpaint_box, "型の既定"
        raise ConfigError(
            f"{char_id}: inpaint_box: 範囲がどこにも無い。範囲のセルで決めて selection.json に保存するか、"
            f"characters/{char_id}/character.yaml の inpaint_box か templates/face.yaml の inpaint.box に書く"
        )

    def adopt(
        self, candidate: str | int | Path, flip: bool = False, run_id: str | None = None,
    ) -> Path:
        """候補を採用する。Path で存在すればそれを、そうでなければ、ファイル名は全部の run から（新しい順）、シードは最新の run（run_id 指定可）から探す。"""
        if isinstance(candidate, Path):
            if not candidate.is_file():
                raise ConfigError(f"ファイルが無い: {candidate}")
            path = candidate
        else:
            path = find_candidate(self.out_dir, candidate, run_id)
        self._check_expression_is_configured(path)
        return self.selected.adopt(path, flip=flip)

    def _check_expression_is_configured(self, path: Path) -> None:
        """表情の候補は、今の設定に載っている表情だけ採用できる。載っていない絵を採用すると、あとの取り込みで拒否される。"""
        try:
            params = read_params(path)
        except (MissingParamsError, OSError):
            return  # 条件が読めない候補は、採用の側（selected.adopt）が理由を言って止める
        name = selected_name(params)
        if name in ("face.png", "fullbody.png"):
            return
        char_id = _check_char_id(params.get("character"), path.name)
        if name not in _accepted_names(list(load_character(self.root, char_id).expressions)):
            raise ConfigError(
                f"{path.name}: 表情 {params.get('expression')!r} は今の設定"
                f"（characters/{char_id}/character.yaml の expressions）に無い。設定に足してから採用する"
            )

    def pack(self, char_ids: list[str] | None = None) -> Path:
        return self.selected.pack(char_ids)

    def inpaint(
        self,
        char_id: str,
        expression: str,
        source: str | Path | None = None,
        n: int = 4,
        seeds: list[int] | None = None,
        extra: str = "",
        remove: str = "",
        extra_negative: str = "",
        remove_negative: str = "",
        strength: float | None = None,
        guidance: float | None = None,
        steps: int | None = None,
        style: str | dict | None = None,
        on_image: Callable[[Path], None] | None = None,
    ) -> list[Path]:
        character = load_character(self.root, char_id)
        style_ref, _ = self.resolve_style(char_id, style, inherit=True)
        style_obj = self._style_obj(style_ref)
        tpl = load_template(self.root, "face")
        overrides = Overrides.from_args(extra, remove, extra_negative, remove_negative)
        prompt = build_prompt(style_obj, tpl, character, expression=expression, overrides=overrides)
        run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        result_dir = run_dir(self.out_dir, char_id, run_kind("face", expression), run_id)

        # GPU を回す前に、入力の誤りをすべて止める
        box, box_from = self.resolve_box(char_id)
        if tpl.inpaint_strength is None or tpl.inpaint_feather is None:
            raise ConfigError("templates/face.yaml: inpaint: strength と feather が無い")
        if source is None:
            source = self.selected.face_path(char_id)
            if not source.is_file():
                raise ConfigError(
                    f"source: {char_id} の顔を採用していない。顔のセルで採用するか、source= にパスを渡す"
                )
        source = Path(source)
        if not source.is_file():
            raise ConfigError(f"source: ファイルが無い: {source}")
        source_sha256 = file_sha256(source)
        with Image.open(source) as im:
            original = im.convert("RGB")
        if original.size != (tpl.width, tpl.height):
            raise ConfigError(
                f"source: 画像の大きさが型 face と違う: {original.size[0]}x{original.size[1]}"
                f"（必要: {tpl.width}x{tpl.height}）"
            )
        box_file = {
            "selection.json": f"selected/{char_id}/selection.json",
            "character.yaml": f"characters/{char_id}/character.yaml",
            "型の既定": "templates/face.yaml",
        }[box_from]
        try:
            check_box(box, original.size)
            check_feather(box, tpl.inpaint_feather)
        except ConfigError as e:
            raise ConfigError(f"{box_file}: {e}") from e
        print(f"{char_id}: inpaint の範囲 {tuple(box)}（{box_from}）")
        mask = make_mask(original.size, box)

        recorded = self._recorded_style_overrides(
            overrides, style_ref, style_obj, character,
            strength=strength, guidance=guidance, steps=steps,
        )
        strength = tpl.inpaint_strength if strength is None else strength
        guidance = tpl.guidance if guidance is None else guidance
        steps = tpl.steps if steps is None else steps
        self._check_sampling(guidance, steps, strength)
        seed_list = self._seeds(n, seeds)

        def build(seed: int):
            generated = self.pipe.inpaint(
                prompt=prompt.positive,
                negative_prompt=prompt.negative,
                image=original,
                mask_image=mask,
                width=tpl.width,
                height=tpl.height,
                strength=strength,
                guidance_scale=guidance,
                num_inference_steps=steps,
                generator=self.make_generator(seed),
                output_type="pil",
            ).images[0]
            result = feather_composite(original, generated, box, tpl.inpaint_feather)
            params = self._base_params(
                prompt=prompt, template=tpl, style=style_obj, character=character,
                expression=expression, overrides=recorded, seed=seed,
                guidance=guidance, steps=steps, run_id=run_id,
            )
            params.update(
                source=source.name,
                source_sha256=source_sha256,
                inpaint_box=list(box),
                strength=strength,
                feather=tpl.inpaint_feather,
            )
            return result, params, result_dir / f"{char_id}_face_{expression}_{seed}.png"

        return self._run(seed_list, self.out_dir, build, on_image)


def _check_unique(values: list[str], label: str) -> None:
    seen: set[str] = set()
    for v in values:
        if v in seen:
            raise ConfigError(f"{label}: 同じものが重複している: {v}")
        seen.add(v)


def _git_commit(root: Path) -> str:
    try:
        out = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, check=True, timeout=10,
        )
        return out.stdout.strip() or "unknown"
    except (OSError, subprocess.SubprocessError):
        return "unknown"


def load_pipeline(low_memory: bool = False) -> Any:
    """Colab でモデルを読み込む。GPU が要る（サーバーでは動かさない）。

    low_memory=True にすると、メモリ節約の設定（attention slicing・VAE の分割）を入れる。
    遅くなるので、メモリ不足で止まったときだけ使う。
    """
    import diffusers
    import torch
    from diffusers import EulerAncestralDiscreteScheduler, StableDiffusionXLPipeline

    pipe = StableDiffusionXLPipeline.from_pretrained(
        MODEL_NAME,
        torch_dtype=torch.float16,
        custom_pipeline="lpw_stable_diffusion_xl",
        # PyPI の版名で渡す（diffusers が自分で "v" を付ける。"v0.42.1" だと存在しないと止まる）
        custom_revision=diffusers.__version__,
        use_safetensors=True,
        add_watermarker=False,
    )
    pipe.scheduler = EulerAncestralDiscreteScheduler.from_config(pipe.scheduler.config)
    pipe = pipe.to("cuda")
    if low_memory:
        pipe.enable_attention_slicing()
        # パイプラインの同名メソッドは廃止予定の警告が出るので vae 側を呼ぶ
        pipe.vae.enable_slicing()
        pipe.vae.enable_tiling()
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
    return pipe


def attach(pipe: Any, root: str | Path = ".", base_dir: str | Path = DEFAULT_BASE_DIR) -> Forge:
    """読み込み済みのパイプラインに Forge をつなぐ。版と commit は呼ぶたびに読み直す
    （pull した後の commit を記録するため）。"""
    import diffusers
    import torch
    import transformers

    root = Path(root).resolve()
    out_dir = Path(base_dir) / "runs"
    out_dir.mkdir(parents=True, exist_ok=True)
    env = {
        "commit": _git_commit(root),
        "diffusers": diffusers.__version__,
        "transformers": transformers.__version__,
        "torch": torch.__version__,
        "gpu": torch.cuda.get_device_name(0),
    }
    return Forge(
        pipe,
        root,
        out_dir,
        make_generator=lambda s: torch.Generator().manual_seed(s),
        env=env,
        cleanup=torch.cuda.empty_cache,
    )


def show_one(path: Path, thumb: int = 512) -> None:
    """1 枚を縮小して表示し、ファイル名とシードを出す。generate の on_image に渡す。"""
    from IPython.display import display

    path = Path(path)
    with Image.open(path) as im:
        im = im.convert("RGB")
        im.thumbnail((thumb, thumb), Image.Resampling.LANCZOS)
    display(im)
    try:
        seed = read_params(path).get("seed")
    except (MissingParamsError, OSError):
        seed = "不明"
    print(f"{path.name}  seed={seed}")


def show(paths: list[Path], cols: int = 4, thumb: int = 256) -> None:
    """縮小した一覧を 1 枚にして表示し、各ファイル名とシードを出す。"""
    from IPython.display import display

    paths = [Path(p) for p in paths]
    if not paths:
        print("表示する画像が無い")
        return
    rows = -(-len(paths) // cols)
    sheet = Image.new("RGB", (min(cols, len(paths)) * thumb, rows * thumb), (255, 255, 255))
    for i, path in enumerate(paths):
        with Image.open(path) as im:
            im = im.convert("RGB")
            im.thumbnail((thumb, thumb), Image.Resampling.LANCZOS)
            sheet.paste(im, ((i % cols) * thumb, (i // cols) * thumb))
    display(sheet)
    for i, path in enumerate(paths, 1):
        try:
            seed = read_params(path).get("seed")
        except (MissingParamsError, OSError):
            seed = "不明"
        print(f"{i}. {path.name}  seed={seed}")
