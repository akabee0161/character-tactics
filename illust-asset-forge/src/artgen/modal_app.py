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
            "characters/*/source", "characters/*/*.png", "characters/*/params.json",
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
