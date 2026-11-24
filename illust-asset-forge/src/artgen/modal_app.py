"""Modal の入口。`cloud generate` が `run()` を呼ぶと、Modal の T4 で今の `Forge.generate` が動く。

modal はこのモジュールの中でだけ import する。torch・diffusers は `generate_remote` の中（`forge` 経由）でだけ使う。
GPU は T4 に固定する。別の GPU への切り替えは書かない（同じシードでも GPU が違うと絵が変わるため）。
イメージの版は requirements-colab.txt と、PNG の条件に残っている版に合わせる。
"""

from __future__ import annotations

from dataclasses import asdict
from pathlib import Path

import modal

from artgen.jobs import GenerateJob

APP_NAME = "character-tactics-illust"
VOLUME_NAME = "character-tactics-illust-models"  # Hugging Face のキャッシュ（モデル約 7GB）
GPU = "T4"
FORGE_DIR = Path(__file__).resolve().parents[2]

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("torch==2.14.1", index_url="https://download.pytorch.org/whl/cu130")
    .pip_install(
        "diffusers==0.42.1", "transformers==5.22.2", "accelerate==1.15.0",
        "safetensors==0.8.0", "PyYAML", "Pillow",
    )
    .env({"HF_HOME": "/cache/hf"})
    .add_local_python_source("artgen")
    .add_local_dir(
        FORGE_DIR, "/root/forge",
        ignore=[
            "local", ".venv", "src", "**/__pycache__", "**/*.egg-info", ".pytest_cache", "tests", "notebooks",
            "characters/*/source", "characters/*/*.png", "characters/*/params.json", "characters/*/matte",
        ],
    )
)
app = modal.App(APP_NAME, image=image)
volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)


@app.function(gpu=GPU, volumes={"/cache": volume}, timeout=3600)
def generate_remote(jobs: list[dict], commit: str, faces: dict[str, bytes]) -> list[tuple[str, bytes]]:
    from artgen import forge as F
    from artgen.jobs import run_jobs

    pipe = F.load_pipeline()
    volume.commit()  # 初回にモデルを取ったら、次から取り直さないよう保存する
    forge = F.attach(pipe, "/root/forge", base_dir="/tmp/work")
    return run_jobs(forge, [GenerateJob(**j) for j in jobs], commit, faces)


def run(jobs: list[GenerateJob], commit: str, faces: dict[str, bytes]) -> list[tuple[str, bytes]]:
    with modal.enable_output(), app.run():
        return generate_remote.remote([asdict(j) for j in jobs], commit, faces)


# 背景のマスク（`cloud matte`）。GPU は要らないので CPU で動かす。推論の途中結果に 2〜3GB 使うので、
# メモリの少ないサーバーでは動かさず、ここで動かす
matte_image = (
    modal.Image.debian_slim(python_version="3.12")
    # 版を固定する（マスクを作り直したときに同じになるように）。PyYAML は artgen.config が使う
    .pip_install("onnxruntime==1.32.0", "numpy==2.5.5", "Pillow==13.0.0", "huggingface_hub==2.4.0", "PyYAML==6.0.4")
    .env({"HF_HOME": "/cache/hf"})
    .add_local_python_source("artgen")
)


@app.function(image=matte_image, cpu=2, memory=4096, volumes={"/cache": volume}, timeout=1800)
def matte_remote(images: dict[str, bytes]) -> tuple[str, dict[str, bytes]]:
    import hashlib
    import io

    import onnxruntime as ort
    from huggingface_hub import hf_hub_download
    from PIL import Image

    from artgen.matte import MODEL_FILE, MODEL_REPO, MODEL_SHA256, isnet_mask

    path = hf_hub_download(MODEL_REPO, MODEL_FILE)
    volume.commit()
    model_sha = hashlib.sha256(Path(path).read_bytes()).hexdigest()
    if model_sha != MODEL_SHA256:  # 取得元のモデルが差し替わっていたら、マスクを作らない
        return model_sha, {}
    session = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
    out = {}
    for key, data in images.items():
        with Image.open(io.BytesIO(data)) as im:
            mask = isnet_mask(session, im)
        buf = io.BytesIO()
        mask.save(buf, format="PNG")
        out[key] = buf.getvalue()
    return model_sha, out


def run_matte(images: dict[str, bytes]) -> tuple[str, dict[str, bytes]]:
    with modal.enable_output(), app.run():
        return matte_remote.remote(images)
