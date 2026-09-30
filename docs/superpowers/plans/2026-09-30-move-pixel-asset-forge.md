# pixel-asset-forge をゲームリポジトリへ移す 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** forge を character-tactics の `pixel-asset-forge/` へ丸ごとコピーし、対応表と書き出しのスクリプトで `assets/images/` の PNG を作れるようにする。同じコピーを ankardo の `new-game` スキルから半自動で行えるようにする。

**Architecture:** ankardo の `scripts/copy-forge.sh` が GitHub の forge の main を一時フォルダに取得し、`git archive` でゲームの `pixel-asset-forge/` へ書き出して `UPSTREAM.md` を書く。character-tactics では、コピーした forge に `tools/export.py` を足す。これが forge のビルド（`render.py`・`sets.py`・`sheet.py`）を行い、ゲームのルートの `sprites.json`（対応表）どおりに `assets/images/` へコピーする。

**Tech Stack:** bash・git（ankardo のスクリプト）、Python 3 + Pillow・`unittest`（forge）、Node 22・Vite・Vitest（character-tactics の確認のみ）

**Spec:** `docs/superpowers/specs/2026-09-30-move-pixel-asset-forge-design.md`

## Global Constraints

- コピー元は forge の main（今は `00ef131`）。git 管理下のファイルだけを丸ごとコピーし、何も削らない
- コピー先はゲームリポジトリ最上位の `pixel-asset-forge/`
- forge は凍結しない。forge 本体のコードとドキュメントはこの作業では変えない（#8 へのコメントとクローズのみ）
- Python は手元だけで使う。CI とデプロイ（`npm run build`）に Python を持ち込まない
- 対応表はゲームのルートの `sprites.json`、書き出し先はスクリプトの引数で渡す（character-tactics では `assets/images`）
- ゲームのコード（`src/`）は変えない
- コミットは Conventional Commits、本文は日本語（各リポジトリの既存の書き方どおり）
- PR は依頼者の指示で作る。push も依頼者の指示を待つ
- **計画に不備が見つかったら、直す前に止めて報告する**（HANDOVER の進め方）

## Review Focus

1. 対応表の2つの組が同じ書き出し先の名前を指す → 片方が黙って上書きされず、エラーで止まって何もコピーしない（Task 4 のテスト）
2. `copy-forge.sh` が途中で失敗する（取得できない URL など）→ 中途半端な `pixel-asset-forge/` が残らない（Task 1 のテスト）
3. 書き出し先のフォルダが無い → フォルダを勝手に作らず、エラーで止まる（Task 4 のテスト）
4. `pixel-asset-forge/.venv/`（Pillow 入り）がゲームのフォルダにある状態で `npm run dev` を起動する → Vite の監視が重くならず、普段どおり起動する（Task 5 の確認）
5. `pixel-asset-forge/` を足したあとの `npm test`・`npm run build` → forge の中身を拾わず、今までどおり通る（Task 5 の確認）

---

## ファイルの一覧

**ankardo**（ブランチ `feat/copy-forge-script` を main から作る）
- Create: `scripts/copy-forge.sh` — forge をゲームへコピーし `UPSTREAM.md` を書く
- Create: `scripts/copy-forge.test.sh` — 上のスクリプトの確認（ネットワークを使わない）
- Modify: `.claude/skills/new-game/SKILL.md` — 「ドット絵を使うなら」の手順

**character-tactics**（ブランチ `feat/move-pixel-asset-forge`。spec と計画はコミット済み）
- Create: `pixel-asset-forge/`（`copy-forge.sh` で作る）
- Create: `pixel-asset-forge/tools/export.py` — ビルドして対応表どおりにコピーする
- Create: `pixel-asset-forge/tests/test_export.py`
- Modify: `pixel-asset-forge/UPSTREAM.md` — 「forge に戻す候補」の1件目
- Create: `sprites.json` — 対応表
- Modify: `README.md`・`assets/images/README.txt`・`HANDOVER.md`

---

### Task 1: ankardo の `copy-forge.sh`

**Files:**
- Create: `ankardo/scripts/copy-forge.sh`
- Test: `ankardo/scripts/copy-forge.test.sh`

**Interfaces:**
- Produces: `./scripts/copy-forge.sh <ゲームリポジトリのパス>`。成功で終了コード 0、`<パス>/pixel-asset-forge/` と `<パス>/pixel-asset-forge/UPSTREAM.md` ができる。引数の誤りは 2、それ以外の失敗は 1。環境変数 `FORGE_URL` でコピー元を差し替えられる（既定は `https://github.com/akabee0161/pixel-asset-forge.git`。テスト用）

- [ ] **Step 1: ブランチを作る**

```bash
cd /home/shunsuke/development/ankardo
git switch main && git pull --ff-only && git switch -c feat/copy-forge-script
```

- [ ] **Step 2: 失敗するテストを書く**

`scripts/copy-forge.test.sh`:

```bash
#!/usr/bin/env bash
# copy-forge.sh の確認。ネットワークは使わず、手元に作った forge の代わりのリポジトリからコピーする。
#   ./scripts/copy-forge.test.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
fail() { echo "FAIL $*" >&2; exit 1; }
snapshot() { (cd "$1" && find . -type f -exec md5sum {} + | sort); }

# forge の代わり: 管理下のファイル2つと、管理外の build/
src="$work/forge"
git init -q -b main "$src"
mkdir -p "$src/tools"
printf 'print("hi")\n' > "$src/tools/render.py"
printf 'build/\n' > "$src/.gitignore"
git -C "$src" add .
git -C "$src" -c user.name=test -c user.email=test@example.com commit -q -m init
mkdir -p "$src/build"
printf 'x' > "$src/build/junk.png"
commit="$(git -C "$src" rev-parse HEAD)"

game="$work/game"
mkdir "$game"
export FORGE_URL="file://$src"

# 1. 管理下のファイルだけが、そのままの中身で入る
"$here/copy-forge.sh" "$game" > /dev/null
dest="$game/pixel-asset-forge"
expected="$(git -C "$src" ls-files | sort)"
actual="$(cd "$dest" && find . -type f ! -name UPSTREAM.md | sed 's|^\./||' | sort)"
[ "$expected" = "$actual" ] || fail "file list differs: $actual"
cmp -s "$src/tools/render.py" "$dest/tools/render.py" || fail "tools/render.py differs"
[ ! -e "$dest/build" ] || fail "build/ was copied"
[ ! -e "$dest/.git" ] || fail ".git was copied"

# 2. UPSTREAM.md にコピー元と commit が入る
grep -q "$commit" "$dest/UPSTREAM.md" || fail "UPSTREAM.md lacks the commit"
grep -q "$FORGE_URL" "$dest/UPSTREAM.md" || fail "UPSTREAM.md lacks the source"
grep -q "## forge に戻す候補" "$dest/UPSTREAM.md" || fail "UPSTREAM.md lacks the candidate section"

# 3. 既にあるときは止まり、中身が変わらない
before="$(snapshot "$dest")"
if "$here/copy-forge.sh" "$game" 2> /dev/null; then fail "second run succeeded"; fi
[ "$before" = "$(snapshot "$dest")" ] || fail "second run changed files"

# 4. 取得に失敗したときは、pixel-asset-forge/ を残さない
other="$work/other"
mkdir "$other"
if FORGE_URL="file://$work/nope" "$here/copy-forge.sh" "$other" 2> /dev/null; then fail "bad source accepted"; fi
[ ! -e "$other/pixel-asset-forge" ] || fail "left pixel-asset-forge/ behind after a failure"

# 5. 引数が無い・フォルダが無いときは止まる
if "$here/copy-forge.sh" 2> /dev/null; then fail "no argument accepted"; fi
if "$here/copy-forge.sh" "$work/missing" 2> /dev/null; then fail "missing folder accepted"; fi

echo "ok"
```

```bash
chmod +x scripts/copy-forge.test.sh
```

- [ ] **Step 3: テストが失敗することを確かめる**

Run: `./scripts/copy-forge.test.sh`
Expected: `copy-forge.sh` が無いため `No such file or directory` で失敗する（終了コードが 0 でない）

- [ ] **Step 4: スクリプトを書く**

`scripts/copy-forge.sh`:

```bash
#!/usr/bin/env bash
# pixel-asset-forge の main の最新 commit を、ゲームリポジトリの pixel-asset-forge/ へ丸ごとコピーする。
#   ./scripts/copy-forge.sh <ゲームリポジトリのパス>
# 手順と経緯は .claude/skills/new-game/SKILL.md の「ドット絵を使うなら」。
set -euo pipefail

FORGE_URL="${FORGE_URL:-https://github.com/akabee0161/pixel-asset-forge.git}"

if [ $# -ne 1 ]; then
  echo "使い方: $0 <ゲームリポジトリのパス>" >&2
  exit 2
fi
game="$1"
if [ ! -d "$game" ]; then
  echo "エラー: $game が無い" >&2
  exit 1
fi
dest="$game/pixel-asset-forge"
if [ -e "$dest" ]; then
  echo "エラー: $dest は既にある（上書きしない）" >&2
  exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# 一時フォルダで組み立ててから移すので、途中で失敗しても $dest は残らない
git clone --quiet --depth 1 --branch main "$FORGE_URL" "$work/forge"
commit="$(git -C "$work/forge" rev-parse HEAD)"
mkdir "$work/out"
git -C "$work/forge" archive --format=tar HEAD | tar -x -C "$work/out"

cat > "$work/out/UPSTREAM.md" << EOF
# UPSTREAM

このフォルダは pixel-asset-forge のコピーで、このゲーム専用に自由に直してよい。

- コピー元: $FORGE_URL
- commit: $commit
- コピーした日: $(date +%F)

forge 本体も並行して開発が続く。forge の改善をこちらへ取り込む仕組みは無く、要るものはその都度手で持ってくる。

## forge に戻す候補

ここでエンジン・規約・道具を直したら、何を・なぜ直したかを1行足す。

## ゲームの開発が終わったら

上の候補と、このフォルダを足したコミットからの差分を材料に、forge の issue を出す。
差分は \`git diff \$(git log --format=%H --diff-filter=A -1 -- pixel-asset-forge/UPSTREAM.md) -- pixel-asset-forge/\` で見られる。
取り込むときに、そのまま採用するか、抽象化してから入れるかを1件ずつ決める。
EOF

mv "$work/out" "$dest"
echo "コピーした: $dest（$FORGE_URL の $commit）"
```

```bash
chmod +x scripts/copy-forge.sh
```

- [ ] **Step 5: テストが通ることを確かめる**

Run: `./scripts/copy-forge.test.sh`
Expected: `ok`

- [ ] **Step 6: コミットする**

```bash
git add scripts/copy-forge.sh scripts/copy-forge.test.sh
git commit -m "feat: pixel-asset-forge をゲームリポジトリへコピーするスクリプトを足す"
```

---

### Task 2: ankardo の `new-game` スキルに手順を足す

**Files:**
- Modify: `ankardo/.claude/skills/new-game/SKILL.md`（末尾に節を足す）

**Interfaces:**
- Consumes: Task 1 の `./scripts/copy-forge.sh <ゲームリポジトリのパス>`、Task 4 の `pixel-asset-forge/tools/export.py <対応表> <書き出し先>`

- [ ] **Step 1: 末尾に節を足す**

`SKILL.md` の最後（「### 7. 手動確認事項」の箇条書きの後）に次を足す:

````markdown

## ドット絵を使うなら（pixel-asset-forge）

ドット絵のアセットは pixel-asset-forge（以下 forge）で作る。forge をゲームリポジトリの `pixel-asset-forge/` へ丸ごとコピーし、ゲームの中でエンジンを直しながらアセットを作る。

### コピーする

```bash
./scripts/copy-forge.sh <ゲームリポジトリのパス>
```

forge の main の最新 commit の中身が `<ゲームリポジトリ>/pixel-asset-forge/` に入り、コピー元の commit を書いた `UPSTREAM.md` ができる。`pixel-asset-forge/` が既にあるときは何もせずに止まる。コミットはしないので、ゲーム側で中身を見てから、ゲーム側の変更とは分けて1つのコミットにする。

### コピーした後にゲーム側で行うこと

1. `pixel-asset-forge/` で venv を作る: `python3 -m venv pixel-asset-forge/.venv && pixel-asset-forge/.venv/bin/pip install -r pixel-asset-forge/requirements.txt`
2. ゲームのルートに対応表 `sprites.json` を書く。forge の `build/` からの相対パスを、書き出し先のファイル名に対応させる: `{ "tile/forest.png": "tile-forest.png" }`
3. 書き出す: `pixel-asset-forge/.venv/bin/python pixel-asset-forge/tools/export.py sprites.json <ゲームが PNG を読むフォルダ>`
4. 書き出した PNG をコミットする。デプロイでは Python を使わない

### forge とゲーム側のコピーの関係

- ゲーム側のコピーは、そのゲームに合わせて自由に直してよい。forge も並行して開発が続く
- ゲーム側でエンジン・規約・道具を直したら、`UPSTREAM.md` の「forge に戻す候補」に1行足す
- ゲームの開発が終わったら、候補を forge の issue にまとめる。取り込むときに、そのまま採用するか、抽象化してから入れるかを1件ずつ決める
- forge の改善をゲーム側へ取り込む仕組みは無い。要るものはその都度手で持ってくる

### 経緯

- 設計: [character-tactics の spec](https://github.com/akabee0161/character-tactics/blob/main/docs/superpowers/specs/2026-09-30-move-pixel-asset-forge-design.md)
- リポジトリを分けておく意味の見直し: #17
````

（character-tactics の PR へのリンクは、PR ができた後に Task 7 で足す。）

- [ ] **Step 2: 表示を確かめる**

Run: `sed -n '/## ドット絵を使うなら/,$p' .claude/skills/new-game/SKILL.md`
Expected: 上の節がそのまま出る。コードブロックの閉じ忘れがない

- [ ] **Step 3: コミットする**

```bash
git add .claude/skills/new-game/SKILL.md
git commit -m "docs: new-game スキルに pixel-asset-forge をコピーする手順を足す"
```

---

### Task 3: character-tactics へ forge をコピーする

**Files:**
- Create: `character-tactics/pixel-asset-forge/`（スクリプトで作る）

**Interfaces:**
- Consumes: Task 1 の `copy-forge.sh`
- Produces: `pixel-asset-forge/`（forge `00ef131` の中身と `UPSTREAM.md`）、`pixel-asset-forge/.venv/`（git 管理外）

- [ ] **Step 1: コピーする**

```bash
cd /home/shunsuke/development/character-tactics
git branch --show-current   # feat/move-pixel-asset-forge であること
/home/shunsuke/development/ankardo/scripts/copy-forge.sh .
```

Expected: `コピーした: ./pixel-asset-forge（https://github.com/akabee0161/pixel-asset-forge.git の 00ef131...）`。commit が `00ef131` で始まらなければ、forge の main が進んでいる。止めて報告する

- [ ] **Step 2: 中身が forge と一致することを確かめる**

```bash
diff -r --exclude=.git --exclude=build --exclude=.venv --exclude=__pycache__ --exclude=UPSTREAM.md \
  /home/shunsuke/development/pixel-asset-forge pixel-asset-forge
```

Expected: 出力なし（手元の forge が main の `00ef131` で、作業ツリーがきれいな場合）

- [ ] **Step 3: venv を作り、forge のテストが通ることを確かめる**

```bash
cd pixel-asset-forge
python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt
.venv/bin/python -m unittest discover -s tests
cd ..
git status --short | head
```

Expected: テストはすべて `OK`。`git status` に出るのは `pixel-asset-forge/` だけで、`.venv/`・`build/` は出ない（forge の `.gitignore` が効いている）

- [ ] **Step 4: コミットする**

```bash
git add pixel-asset-forge
git commit -m "chore: pixel-asset-forge の 00ef131 を pixel-asset-forge/ へコピーする"
```

（コミットメッセージの commit は Step 1 の出力に合わせる。）

---

### Task 4: 書き出しのスクリプト `export.py`

**Files:**
- Create: `character-tactics/pixel-asset-forge/tools/export.py`
- Test: `character-tactics/pixel-asset-forge/tests/test_export.py`
- Modify: `character-tactics/pixel-asset-forge/UPSTREAM.md`

**Interfaces:**
- Consumes: forge の `render.main(argv)`・`sets.main(argv)`・`sheet.main(argv)`（どれも `list[str]` を取り `int` を返す）、`gridfile.REPO_ROOT`・`gridfile.display`
- Produces:
  - `export.ExportError(Exception)`
  - `export.load_mapping(path: Path) -> dict[str, str]`
  - `export.plan(mapping: dict[str, str], build_dir: Path, dest_dir: Path) -> list[tuple[Path, Path]]`
  - `export.export(mapping_path: Path, dest_dir: Path, build_dir: Path = BUILD_DIR) -> list[Path]`
  - `export.build() -> int`
  - コマンド: `tools/export.py <対応表> <書き出し先>`。成功で 0、ビルドの失敗はビルドの終了コード、対応表の誤りは 1

以下の作業はすべて `character-tactics/pixel-asset-forge/` で行う。

- [ ] **Step 1: 失敗するテストを書く**

`tests/test_export.py`:

```python
"""Checks for the export tool.

    .venv/bin/python -m unittest discover -s tests
"""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

import export  # noqa: E402


class ExportTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.build = root / "build"
        self.dest = root / "images"
        (self.build / "tile").mkdir(parents=True)
        (self.build / "sets").mkdir()
        self.dest.mkdir()
        (self.build / "tile" / "forest.png").write_bytes(b"forest")
        (self.build / "sets" / "village.png").write_bytes(b"village")
        self.mapping = root / "sprites.json"

    def tearDown(self):
        self.tmp.cleanup()

    def write_mapping(self, data) -> Path:
        self.mapping.write_text(json.dumps(data), encoding="utf-8")
        return self.mapping

    def run_export(self, data):
        return export.export(self.write_mapping(data), self.dest, self.build)

    def assert_nothing_copied(self):
        self.assertEqual(list(self.dest.iterdir()), [])

    def test_copies_each_entry_under_its_new_name(self):
        written = self.run_export({"tile/forest.png": "tile-forest.png", "sets/village.png": "tile-village.png"})
        self.assertEqual((self.dest / "tile-forest.png").read_bytes(), b"forest")
        self.assertEqual((self.dest / "tile-village.png").read_bytes(), b"village")
        self.assertEqual(sorted(p.name for p in written), ["tile-forest.png", "tile-village.png"])

    def test_overwrites_an_older_copy(self):
        (self.dest / "tile-forest.png").write_bytes(b"old")
        self.run_export({"tile/forest.png": "tile-forest.png"})
        self.assertEqual((self.dest / "tile-forest.png").read_bytes(), b"forest")

    def test_a_missing_build_output_stops_everything(self):
        with self.assertRaisesRegex(export.ExportError, "tile/nope.png"):
            self.run_export({"tile/forest.png": "tile-forest.png", "tile/nope.png": "tile-nope.png"})
        self.assert_nothing_copied()

    def test_a_source_outside_build_is_rejected(self):
        (self.build.parent / "secret.png").write_bytes(b"x")
        with self.assertRaisesRegex(export.ExportError, r"\.\./secret\.png.*outside build/"):
            self.run_export({"../secret.png": "secret.png"})
        self.assert_nothing_copied()

    def test_a_destination_with_a_path_is_rejected(self):
        for name in ("sub/tile-forest.png", "../tile-forest.png", "..", ""):
            with self.subTest(name=name):
                with self.assertRaisesRegex(export.ExportError, "not a plain file name"):
                    self.run_export({"tile/forest.png": name})
                self.assert_nothing_copied()

    def test_two_entries_with_the_same_destination_are_rejected(self):
        with self.assertRaisesRegex(export.ExportError, "tile-forest.png.*also"):
            self.run_export({"tile/forest.png": "tile-forest.png", "sets/village.png": "tile-forest.png"})
        self.assert_nothing_copied()

    def test_a_mapping_that_is_not_json_is_rejected(self):
        self.mapping.write_text("{", encoding="utf-8")
        with self.assertRaisesRegex(export.ExportError, "not valid JSON"):
            export.export(self.mapping, self.dest, self.build)

    def test_a_mapping_that_is_not_an_object_is_rejected(self):
        for data in ([], {}, "tile/forest.png"):
            with self.subTest(data=data):
                with self.assertRaisesRegex(export.ExportError, "non-empty JSON object"):
                    self.run_export(data)

    def test_a_destination_that_is_not_a_string_is_rejected(self):
        with self.assertRaisesRegex(export.ExportError, "tile/forest.png.*file name string"):
            self.run_export({"tile/forest.png": 3})

    def test_a_missing_mapping_file_is_named(self):
        with self.assertRaisesRegex(export.ExportError, "nope.json.*not found"):
            export.export(self.mapping.parent / "nope.json", self.dest, self.build)

    def test_a_missing_destination_folder_is_not_created(self):
        missing = self.dest.parent / "missing"
        with self.assertRaisesRegex(export.ExportError, "missing.*not a folder"):
            export.export(self.write_mapping({"tile/forest.png": "tile-forest.png"}), missing, self.build)
        self.assertFalse(missing.exists())


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `.venv/bin/python -m unittest discover -s tests -p test_export.py`
Expected: `ModuleNotFoundError: No module named 'export'` で失敗

- [ ] **Step 3: スクリプトを書く**

`tools/export.py`:

```python
#!/usr/bin/env python3
"""Build the PNGs a game uses and copy them where the game reads them.

    tools/export.py ../sprites.json ../assets/images

The mapping is a JSON object from a path under ``build/`` to a file name in
the destination folder:

    {"tile/forest.png": "tile-forest.png", "sets/village.png": "tile-village.png"}

It lives in the game repository, not here, because which PNG a game uses and
what it calls it belong to the game. Every entry is checked before anything
is copied, so a bad mapping leaves the destination untouched.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import render  # noqa: E402
import sets  # noqa: E402
import sheet  # noqa: E402
from gridfile import REPO_ROOT, display  # noqa: E402

BUILD_DIR = REPO_ROOT / "build"
SHEET_DIR = REPO_ROOT / "sheets"


class ExportError(Exception):
    pass


def load_mapping(path: Path) -> dict[str, str]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ExportError(f"{path}: not found") from None
    except json.JSONDecodeError as exc:
        raise ExportError(f"{path}: not valid JSON ({exc})") from None
    if not isinstance(data, dict) or not data:
        raise ExportError(f"{path}: must be a non-empty JSON object")
    for source, name in data.items():
        if not isinstance(name, str):
            raise ExportError(f"{path}: {source} must map to a file name string")
    return data


def _problem(source: str, name: str, build_root: Path, seen: dict[str, str]) -> str | None:
    if not (build_root / source).resolve().is_relative_to(build_root):
        return f"{source}: outside build/"
    if name in ("", ".", "..") or "/" in name or "\\" in name:
        return f"{source}: {name!r} is not a plain file name"
    if name in seen:
        return f"{source}: {name} is also the destination of {seen[name]}"
    if not (build_root / source).is_file():
        return f"{source}: not in build/ (run the build, or check the name)"
    return None


def plan(mapping: dict[str, str], build_dir: Path, dest_dir: Path) -> list[tuple[Path, Path]]:
    """Pair every build output with its destination, or raise with every problem found."""
    build_root = build_dir.resolve()
    seen: dict[str, str] = {}
    problems: list[str] = []
    for source, name in mapping.items():
        problem = _problem(source, name, build_root, seen)
        if problem:
            problems.append(problem)
        seen.setdefault(name, source)
    if problems:
        raise ExportError("\n".join(problems))
    return [(build_root / source, dest_dir / name) for source, name in mapping.items()]


def export(mapping_path: Path, dest_dir: Path, build_dir: Path = BUILD_DIR) -> list[Path]:
    if not dest_dir.is_dir():
        raise ExportError(f"{dest_dir}: not a folder")
    pairs = plan(load_mapping(mapping_path), build_dir, dest_dir)
    for source, destination in pairs:
        shutil.copyfile(source, destination)
    return [destination for _, destination in pairs]


def build() -> int:
    """Render every asset, assemble every set and every sheet into build/."""
    steps = (
        lambda: render.main([str(REPO_ROOT / "assets")]),
        lambda: sets.main([]),
        *(lambda p=p: sheet.main([str(p)]) for p in sorted(SHEET_DIR.glob("*.txt"))),
    )
    for step in steps:
        code = step()
        if code:
            return code
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mapping", type=Path, help="JSON object from build/ paths to file names")
    parser.add_argument("destination", type=Path, help="folder the game reads its PNGs from")
    args = parser.parse_args(argv)

    code = build()
    if code:
        print("FAIL build", file=sys.stderr)
        return code
    try:
        written = export(args.mapping, args.destination)
    except ExportError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 1
    for path in written:
        print(f"wrote {display(path.resolve())}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

```bash
chmod +x tools/export.py
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `.venv/bin/python -m unittest discover -s tests -p test_export.py -v`
Expected: 11件すべて `ok`

- [ ] **Step 5: forge のテスト全体が通ることを確かめる**

Run: `.venv/bin/python -m unittest discover -s tests`
Expected: `OK`

- [ ] **Step 6: `UPSTREAM.md` に候補の1件目を書く**

`UPSTREAM.md` の「## forge に戻す候補」の説明の行の後に足す:

```markdown

- `tools/export.py`（と `tests/test_export.py`）: ビルドして、ゲーム側の対応表どおりに PNG をコピーする。どのゲームでも使える。forge の README のツアーにも足す必要がある
```

- [ ] **Step 7: コミットする**

```bash
git add tools/export.py tests/test_export.py UPSTREAM.md
git commit -m "feat: forge の生成物を対応表どおりにゲームへ書き出す export.py を足す"
```

---

### Task 5: 対応表を書き、6枚が変わらないことを確かめる

**Files:**
- Create: `character-tactics/sprites.json`

**Interfaces:**
- Consumes: Task 4 の `tools/export.py <対応表> <書き出し先>`

以下は `character-tactics/` のルートで行う。

- [ ] **Step 1: 対応表を書く**

`sprites.json`:

```json
{
  "tile/plain.png": "tile-plain.png",
  "tile/forest.png": "tile-forest.png",
  "sets/village.png": "tile-village.png",
  "sets/rock.png": "tile-rock.png",
  "sets/tree.png": "tile-tree.png",
  "sheets/roran.png": "roran-map.png"
}
```

- [ ] **Step 2: 書き出す**

Run: `pixel-asset-forge/.venv/bin/python pixel-asset-forge/tools/export.py sprites.json assets/images`
Expected: 最後に `wrote` の行が6行出て、終了コードが 0

- [ ] **Step 3: 6枚に差分がないことを確かめる**

Run: `git status --short assets/images`
Expected: 出力なし

**差分が出たら、ここで止めて依頼者に報告する。** 報告には、どのファイルか、画素が違うのか符号化だけが違うのかを添える。確かめ方:

```bash
pixel-asset-forge/.venv/bin/python - << 'EOF'
import subprocess
from io import BytesIO
from PIL import Image, ImageChops
names = subprocess.run(["git", "diff", "--name-only", "assets/images"], capture_output=True, text=True).stdout.split()
for name in names:
    old = Image.open(BytesIO(subprocess.run(["git", "show", f"HEAD:{name}"], capture_output=True).stdout)).convert("RGBA")
    new = Image.open(name).convert("RGBA")
    same = old.size == new.size and ImageChops.difference(old, new).getbbox() is None
    print(name, old.size, new.size, "画素は同じ" if same else "画素が違う")
EOF
```

`roran-map.png` の画素が違うのは想定内（forge の #5 で描き直す前にコピーした可能性）。新しい絵にするかを依頼者に決めてもらう。それまで次の Step に進まない

- [ ] **Step 4: ゲームのテストとビルドが通ることを確かめる**

Run: `npm test && npm run build`
Expected: どちらも成功。`npm test` が `pixel-asset-forge/` の中のファイルを拾っていない（テストの件数が作業前と同じ）

作業前の件数は `git stash` を使わずに、`git switch main && npm test 2>&1 | tail -5 && git switch -` で見る（作業中の変更はすべてコミット済みであること）。

- [ ] **Step 5: 開発サーバーが普段どおり起動することを確かめる**

Run: `timeout 20 npx vite --port 5199 2>&1 | head -20`
Expected: 数秒で `Local:` の行が出る。`ENOSPC`（監視できるファイル数の上限）などのエラーが出ない

エラーが出たり起動が目に見えて遅くなったりしたら、止めて報告する（`pixel-asset-forge/.venv/` を Vite の監視から外す設定が要るかを依頼者と決める）。

- [ ] **Step 6: コミットする**

```bash
git add sprites.json
git commit -m "feat: forge の生成物をゲームへ書き出す対応表 sprites.json を足す"
```

（Step 3 で依頼者が新しい絵を選んだ場合は、その PNG も同じコミットに入れ、メッセージに書く。）

---

### Task 6: character-tactics のドキュメントを直す

**Files:**
- Modify: `character-tactics/README.md`（「まだ規約に追いついていないもの」の最後の行、「コンテンツの足しかた」のステージの項の最後の文、ユニットの絵の項の `pixel-asset-forge の unit 規約` の言及）
- Modify: `character-tactics/assets/images/README.txt`
- Modify: `character-tactics/HANDOVER.md`

- [ ] **Step 1: README の「まだ規約に追いついていないもの」を直す**

置き換え前:

```markdown
絵は pixel-asset-forge で作り、PNG をここへコピーしている（アセットのテキストとビルドをこのリポジトリへ移す予定）。
```

置き換え後:

~~~markdown

## ドット絵の作りかた

ドット絵は `pixel-asset-forge/` で作る。pixel-asset-forge（forge）をこのリポジトリへ丸ごとコピーしたもので、このゲームに合わせて自由に直してよい。コピー元の commit と、forge に戻す候補は `pixel-asset-forge/UPSTREAM.md` にある。絵の描き方と規約は `pixel-asset-forge/README.md` と `pixel-asset-forge/types/*/SPEC.md`。

forge の生成物のうちゲームで使うものは、ルートの `sprites.json`（forge の `build/` からの相対パス → `assets/images/` のファイル名）に書き、次のコマンドで `assets/images/` へ書き出す。書き出した PNG はコミットする（デプロイでは Python を使わない）。

```sh
python3 -m venv pixel-asset-forge/.venv   # 初回だけ
pixel-asset-forge/.venv/bin/pip install -r pixel-asset-forge/requirements.txt   # 初回だけ
pixel-asset-forge/.venv/bin/python pixel-asset-forge/tools/export.py sprites.json assets/images
```

エンジン・規約・道具を直したら、`pixel-asset-forge/.venv/bin/python -m unittest discover -s pixel-asset-forge/tests` を通し、`UPSTREAM.md` の「forge に戻す候補」に1行足す。
~~~

- [ ] **Step 2: README のステージの項の、タイルのコピー元の文を直す**

置き換え前（ステージの項の最後の文）:

```markdown
タイルは pixel-asset-forge から `tile-<名前>.png` としてコピーする。地面（16px）は `build/tile/<名前>.png`、物（村・岩・木など、32px）は `build/sets/<名前>.png` から取る（forge の `build/tile/` にも同じ名前の 16px の旧版 `village` `rock` `tree` があるが、そちらを使うと1マスに4つ並ぶ。16px も 32px も `npm test` は通るので、検査では気付けない）
```

置き換え後:

```markdown
タイルは `sprites.json` に書いて `tile-<名前>.png` として書き出す（「ドット絵の作りかた」）。地面（16px）は `tile/<名前>.png`、物（村・岩・木など、32px）は `sets/<名前>.png` を指す（forge の `build/tile/` にも同じ名前の 16px の旧版 `village` `rock` `tree` があるが、そちらを指すと1マスに4つ並ぶ。16px も 32px も `npm test` は通るので、検査では気付けない）
```

- [ ] **Step 3: README のユニットの絵の項を確かめる**

Run: `grep -n "pixel-asset-forge" README.md`
Expected: Step 1・2 で書いた箇所のほかは、ユニットの絵の項の「（pixel-asset-forge の `unit` 規約と同じ）」だけ。この言及はそのままでよい（規約は `pixel-asset-forge/types/unit/SPEC.md` にあり、今もこのリポジトリの中で正しい）。ほかに「コピーしている」「移す予定」などの古い記述が見つかったら、止めて報告する

- [ ] **Step 4: `assets/images/README.txt` に1行足す**

`仮の絵は tools/gen-placeholder-sprites.mjs で作っている。` の行の前に足す:

```text
tile-*.png と roran-map.png は pixel-asset-forge/ から書き出している（ルートの sprites.json と README.md「ドット絵の作りかた」）。
```

- [ ] **Step 5: HANDOVER を直す**

- 「Current State」の Branch を `feat/move-pixel-asset-forge`（⑥用）に、forge の PR #7 はマージ済み（2026-09-30）に、`feat/forest-slow-tile` は PR #21 でマージ済みに書き換える
- 「What Remains」の⑥にチェックを付け、「→ ブランチ `feat/move-pixel-asset-forge`（未 push）。ankardo は `feat/copy-forge-script`」と書く
- 「issue #6 への対応の順番」の5を「**済み**（PR #21 でマージ）」、6を「**済み**（このブランチ）」にする
- 「## アセットのテキストとビルドの移設（方針決定済み・着手は後）」の節を、次で置き換える:

```markdown
## ⑥ pixel-asset-forge の移設で決めたこと（2026-09-30）

設計は `docs/superpowers/specs/2026-09-30-move-pixel-asset-forge-design.md`、計画は `docs/superpowers/plans/2026-09-30-move-pixel-asset-forge.md`。

- forge を `pixel-asset-forge/` へ丸ごとコピーした（ankardo の `scripts/copy-forge.sh`）。forge は凍結せず並行して開発する
- ゲーム側で直したものは `pixel-asset-forge/UPSTREAM.md` の「forge に戻す候補」に書き溜め、ゲームの開発が終わったら forge の issue にまとめる
- PNG は `sprites.json` と `pixel-asset-forge/tools/export.py` で書き出す（README「ドット絵の作りかた」）
- 残り: PR を作る（依頼者の指示で）→ ankardo の `new-game` スキルに character-tactics の PR へのリンクを足してから ankardo の PR をマージ → forge #8 に結果を書いて閉じる
```

- 「Context Files」の forge の行（`forge の ISSUES.md` と forge の④の spec と計画）を、`pixel-asset-forge/ISSUES.md`・`pixel-asset-forge/docs/` のパスに直す

- [ ] **Step 6: コミットする**

```bash
git add README.md assets/images/README.txt HANDOVER.md
git commit -m "docs: ドット絵を pixel-asset-forge/ から書き出す手順を README と HANDOVER に書く"
```

---

### Task 7: PR ができた後の仕上げ（依頼者の指示を待ってから）

このタスクは、依頼者が character-tactics と ankardo の PR を作るよう指示し、PR ができた後に行う。

**Files:**
- Modify: `ankardo/.claude/skills/new-game/SKILL.md`（「### 経緯」）

- [ ] **Step 1: ankardo のスキルに PR へのリンクを足す**

「### 経緯」の「- 設計:」の行の次に足す（`<番号>` は character-tactics の PR の番号）:

```markdown
- 移設の PR: [character-tactics #<番号>](https://github.com/akabee0161/character-tactics/pull/<番号>)
```

```bash
cd /home/shunsuke/development/ankardo
git add .claude/skills/new-game/SKILL.md
git commit -m "docs: new-game スキルから character-tactics の移設の PR へリンクする"
```

push は依頼者の指示を待つ。ankardo の PR は、このコミットが入るまでマージしない

- [ ] **Step 2: forge #8 に結果を書いて閉じる**

依頼者に文面を見せて承認を得てから実行する:

```bash
gh issue close 8 --repo akabee0161/pixel-asset-forge --comment "<結果>"
```

`<結果>` に書くこと: ゲーム側の置き場所（character-tactics の `pixel-asset-forge/`）、コピー元の commit、`UPSTREAM.md` で「forge に戻す候補」を書き溜めること、character-tactics と ankardo の PR へのリンク
