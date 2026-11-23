import ast
import json
from pathlib import Path

NOTEBOOK = Path(__file__).resolve().parent.parent / "notebooks" / "run.ipynb"


def code_cells():
    nb = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
    return nb, ["".join(c["source"]) for c in nb["cells"] if c["cell_type"] == "code"]


def test_notebook_cells_parse():
    _, cells = code_cells()
    assert len(cells) >= 4
    for source in cells:
        lines = [ln for ln in source.splitlines() if not ln.lstrip().startswith(("!", "%"))]
        ast.parse("\n".join(lines))


def test_notebook_uses_new_api():
    _, cells = code_cells()
    code = "\n".join(cells)
    for needle in ("F.load_pipeline(", "F.attach(", "forge.generate(CHARS", "P.pick(forge", "P.edit_box(forge",
                   "forge.inpaint(CHAR, ", "forge.compare_styles(", "P.show_styles(", "forge.pack("):
        assert needle in code
    assert "/content/drive/MyDrive/illust-asset-forge/runs/<" not in code  # パスを書き換える場面が無い


def test_notebook_has_no_outputs():
    nb, _ = code_cells()
    for c in nb["cells"]:
        if c["cell_type"] == "code":
            assert c["outputs"] == []
            assert c["execution_count"] is None


def test_notebook_makes_package_importable_in_running_kernel():
    # pip install -e は動いているカーネルの import に効かないので、src を sys.path に足す
    _, cells = code_cells()
    setup = next(c for c in cells if "from artgen import forge" in c)
    assert "sys.path.insert" in setup
    assert setup.index("sys.path.insert") < setup.index("from artgen import forge")


def test_setup_cell_rebuilds_forge_from_kept_pipeline():
    _, cells = code_cells()
    setup = next(c for c in cells if "from artgen import forge" in c)
    assert "F.load_pipeline(" not in setup  # 設定を pull し直すだけのときにモデルを読み込まない
    assert 'if "pipe" in globals()' in setup and "F.attach(pipe" in setup
    load = next(c for c in cells if "F.load_pipeline(" in c)
    assert 'if "pipe" not in globals()' in load and "F.attach(pipe" in load


def test_notebook_purges_cached_artgen_modules_before_import():
    # 実行し直しても古いコードのままになるのを防ぐ。import より前に sys.modules から消す
    _, cells = code_cells()
    setup = next(c for c in cells if "from artgen import forge" in c)
    assert "sys.modules" in setup
    assert setup.index("sys.modules") < setup.index("from artgen import forge")


def test_fullbody_cell_defines_its_own_chars():
    # 再起動の後に、このセルだけを実行しても動く
    _, cells = code_cells()
    fullbody = next(c for c in cells if '"fullbody"' in c and "forge.generate(" in c)
    assert fullbody.lstrip().startswith("CHARS = [")


def test_notebook_headings_are_numbered_in_order():
    import re

    nb, _ = code_cells()
    numbers = []
    for c in nb["cells"]:
        if c["cell_type"] == "markdown":
            m = re.match(r"## (\w+)\.", "".join(c["source"]))
            if m:
                numbers.append(m.group(1))
    assert numbers == [str(i) for i in range(1, len(numbers) + 1)]


def test_notebook_reopen_cell_filters_by_char_and_kind():
    nb, _ = code_cells()
    cells = nb["cells"]
    idx = next(i for i, c in enumerate(cells) if c["cell_type"] == "markdown" and "".join(c["source"]).startswith("## 5. 候補を開き直す"))
    src = "".join(cells[idx + 1]["source"])
    assert src.startswith("CHAR = ") and "P.pick(forge, char=CHAR, kind=KIND)" in src


def prepare_assigns():
    """準備のセル（最初のコードのセル）の、モジュール直下の「名前 = リテラル」を辞書にする。"""
    src = code_cells()[1][0]
    lines = [ln for ln in src.splitlines() if not ln.lstrip().startswith(("!", "%"))]
    out = {}
    for node in ast.parse("\n".join(lines)).body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            try:
                out[node.targets[0].id] = ast.literal_eval(node.value)
            except ValueError:
                pass
    return out


def test_prepare_cell_has_source_variables_for_this_game():
    a = prepare_assigns()
    assert a["REPO_URL"] == "https://github.com/akabee0161/character-tactics.git"
    assert a["REPO_BRANCH"] == "develop"
    assert a["SUBDIR"] == "illust-asset-forge"
    assert a["DRIVE_DIR"] == "/content/drive/MyDrive/character-tactics/illust-asset-forge"


def test_notebook_passes_drive_dir_to_attach():
    _, cells = code_cells()
    code = "\n".join(cells)
    assert code.count("F.attach(") == code.count("base_dir=DRIVE_DIR")
    assert "character-tactics.git" not in "\n".join(cells[1:])  # URL は準備のセルの変数だけ


def test_prepare_cell_switches_branch_before_pull():
    src = code_cells()[1][0]
    assert "REPO_BRANCH" in src
    assert src.index("checkout") < src.index("pull")  # 切り替えてから pull


def test_prepare_cell_refuses_other_repo_clone():
    src = code_cells()[1][0]
    assert "remote" in src and "get-url" in src and "raise" in src


def test_prepare_cell_uses_forge_root_everywhere():
    src = code_cells()[1][0]
    assert "os.chdir(ROOT)" in src
    assert "{ROOT}/requirements-colab.txt" in src and "{ROOT}" in src
    assert 'os.path.join(ROOT, "src")' in src


def test_prepare_cell_quotes_root_in_shell_commands():
    # SUBDIR に空白があっても、パスが 1 つの引数として pip に渡る
    src = code_cells()[1][0]
    assert '-r "{ROOT}/requirements-colab.txt"' in src
    assert '-e "{ROOT}"' in src


def test_prepare_cell_moves_current_src_to_front_of_sys_path():
    import os
    import types

    src = code_cells()[1][0]
    text = "\n".join(ln for ln in src.splitlines() if not ln.lstrip().startswith(("!", "%")))
    nodes = [n for n in ast.parse(text).body if "SRC" in ast.get_source_segment(text, n)]
    assert nodes
    # 同じカーネルで ROOT を A → B → A と変えた後でも、A の src が先頭になる
    fake_sys = types.SimpleNamespace(path=["/b/src", "/a/src", "/other"])
    exec("\n".join(ast.get_source_segment(text, n) for n in nodes), {"os": os, "sys": fake_sys, "ROOT": "/a"})
    assert fake_sys.path == ["/a/src", "/b/src", "/other"]


def test_docs_name_this_games_drive_dir():
    # Drive から絵を取るとき、forge 本体の置き場（MyDrive/illust-asset-forge）の絵と取り違えないように、
    # 文書がこのゲームの置き場を書いている
    relative = prepare_assigns()["DRIVE_DIR"].removeprefix("/content/drive/")
    root = NOTEBOOK.parent.parent
    readme = (root / "README.md").read_text(encoding="utf-8")
    claude = (root / "CLAUDE.md").read_text(encoding="utf-8")
    assert relative in readme and relative in claude
    assert "（既定は Drive の `illust-asset-forge/`）" not in readme
