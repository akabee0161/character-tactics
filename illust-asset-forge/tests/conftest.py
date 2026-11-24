"""テスト全体の守り。テストから本物の Modal を呼ばない（呼ぶとお金がかかり、時間もかかる）。

`artgen.modal_app` を、呼ぶと落ちる偽物に置き換える。Modal を使う道を確かめるテストは、
`monkeypatch.setitem(sys.modules, "artgen.modal_app", ...)` で自分の偽物に置き換える。
"""

import sys
import types

import pytest


def _refuse(*args, **kwargs):
    raise AssertionError("テストが本物の Modal を呼ぼうとした。偽の artgen.modal_app を入れる")


@pytest.fixture(autouse=True)
def no_real_modal(monkeypatch):
    module = types.ModuleType("artgen.modal_app")
    module.run = _refuse
    module.run_matte = _refuse
    monkeypatch.setitem(sys.modules, "artgen.modal_app", module)
