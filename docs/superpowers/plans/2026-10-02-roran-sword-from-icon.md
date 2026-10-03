# アイコンの剣の特徴をロランの剣へ反映する Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ロランのユニット（forge の `assets/unit/roran/` の24コマ）の剣の鍔を木（`wood_*`）、柄頭を赤い宝石（`roof_*`）にして、アイコンの剣（`assets/item/sword.txt`）と同じ剣に見えるようにする。尖った切っ先は試しに描いて採否を決める（issue #23 の4番目）。

**Architecture:** 鍔と柄頭の画素に専用の文字（`G` `H` `J` = 鍔、`R` = 柄頭）を割り当てる。最初は今の金の色のまま付け替えて PNG が1画素も変わらないことを確かめ、次に `# map:` 行の割り当てだけを木と赤に変えて、23コマの色をまとめて切り替える。機械の検査は forge の `validate.py` / `check_colors.py` と、この計画で作る使い捨てのスクリプト（`.superpowers/sdd/2026-10-02-roran-sword-from-icon/`、git 管理外。`tools/` には足さない）。

**Tech Stack:** pixel-asset-forge（Python 3.14 の `pixel-asset-forge/.venv`、Pillow）、テキストのグリッド、Vitest（`npm test`）、Vite（`npm run build`）、headless Chromium（CDP）

**Spec:** `docs/superpowers/specs/2026-10-02-roran-sword-from-icon-design.md`

## Global Constraints

- 揃える特徴は A（鍔を木 `wood_*`）と B（柄頭を赤 `roof_*`）。C（尖った切っ先）は試して見せ、採否は依頼者が決める。D（刃に `stone_shadow` の陰影）と弓は含めない
- 色は `palette/master.json` の既存色だけ。**色を足さない**（`feat/roran-face` と `master.json` がぶつかるため。足りなければ止めて依頼者に確認）
- 盾は金（`metal_*`、文字 `m n s`）のまま。盾の画素を変えない
- 画素の位置は変えない（C を採った場合の切っ先だけが例外）。足元 y=30・左右中央・背丈24〜26px は今のまま
- 触らないもの: `pixel-asset-forge/palette/master.json`、`feat/roran-face`、ゲームのコード、`pixel-asset-forge/tools/`（触らないので unittest は不要）、`sprites.json`、役割アイコン
- 絵は段階ごとに Read で見せて止まる。案は何案か並べ、拡大と等倍を添える。「一旦進めましょう」は次へ進んでよいという意味で、合格ではない
- 計画に不備が見つかったら、直す前に止めて依頼者に報告する
- push と PR は依頼者の指示があるまでしない。コミットは Conventional Commits + 日本語の要約
- forge のコマンドは `pixel-asset-forge/` で `.venv/bin/python ...`。**git コマンドはリポジトリの直下（`/home/ubuntu/workspace/character-tactics`）から流す**（forge のディレクトリから `git diff -- pixel-asset-forge/...` を流すと差分が空に見える）
- bash の標準入力の heredoc（`python3 - <<EOF`）と、コマンドの中の変数（`$VAR`）を使ったパスは安全フックに止められる。スクリプトは Write でファイルにし、パスはそのまま書く
- `check_colors.py` は既存の `types/face/reference/knight.txt` で1件失敗する（範囲外の既知の失敗）

## Review Focus

spec が暗に求めているが、目視だけでは見落としやすいもの（起きやすい順）。どれも Task 1 で作るスクリプトで機械的に確かめる。

1. **盾の金の画素を、鍔や柄頭と取り違えて付け替える**（盾も同じ文字 `m n s`）→ 期待: 付け替えは座標の表どおりで、元の文字が表と違えば止まる（`relabel.py` の assert）。付け替えた後の色の切り替えで変わる画素は `G H J R` の位置だけ（`diff_pixels.py`）
2. **鍔や柄頭の付け替え漏れ**（1コマだけ金のまま）→ 期待: `m n s` で描かれた金の塊は盾だけで、どれも5画素以上（`check_parts.py`）。`G H J R` の数がコマごとに表どおり
3. **1コマだけ `# map:` 行の書き換えが漏れて色が違う** → 期待: `apply_map.py` が23コマすべての行を書き換えたことを数で確かめる（`up_atk_hit` は剣が見えないので対象外）
4. **画素の位置がずれて足元や中心が動く** → 期待: Task 1 の付け替えでは PNG が完全に同じ、Task 3 の切り替えでは `G H J R` の位置以外は同じ（`diff_pixels.py`）。`sheet.py` のプレビューでも確かめる
5. **木の鍔が拳の肌や服に溶けて、剣の一部に見えない**（特に横向きの2px の鍔）→ 機械検査なし（`probe_colors.py` では23組とも区別できた）。Task 2・3 の案の比較と Task 5 のゲームの画面で確かめる

---

## 鍔と柄頭の座標（2026-10-02 実測）

金の画素を4近傍の塊に分けて測った。盾の塊は5画素以上（正面 28、背面 18、横向き 7、`right_atk_hit` は 5）、鍔は2〜4画素、柄頭は1画素。

| コマ | 鍔（座標と今の文字） | 柄頭 |
|---|---|---|
| `down_base`・`down_walk_a`・`down_walk_b` | `(7,17)m (8,17)n (9,17)n (10,17)s` | `(9,20)n` |
| `down_breathe` | `(7,15)m (8,15)n (9,15)n (10,15)s` | `(9,18)n` |
| `down_atk_wind` | `(7,12)m (8,12)n (9,12)n (10,12)s` | `(9,15)n` |
| `down_atk_hit` | `(10,20)m (11,20)n (12,20)n (13,20)s` | `(12,17)n`（刃が下向きなので拳の上） |
| `up_base`・`up_walk_a`・`up_walk_b` | `(21,17)m (22,17)n (23,17)n (24,17)s` | `(22,20)n` |
| `up_breathe` | `(21,15)m (22,15)n (23,15)n (24,15)s` | `(22,18)n` |
| `up_atk_wind` | `(21,12)m (22,12)n (23,12)n (24,12)s` | `(22,15)n` |
| `up_atk_hit` | なし（剣は体に隠れる） | なし |
| `left_base`・`left_walk_a`・`left_walk_b` | `(21,17)m (22,17)n` | `(21,20)n` |
| `left_breathe` | `(21,15)m (22,15)n` | `(21,18)n` |
| `left_atk_wind` | `(21,12)m (22,12)n (23,12)n (24,12)s` | `(22,15)n` |
| `left_atk_hit` | `(10,16)m (8,18)s`（45°の刃に直角） | なし（盾の陰） |
| `right_base`・`right_walk_a`・`right_walk_b` | `(9,17)m (10,17)n (11,17)n (12,17)s` | `(10,20)n` |
| `right_breathe` | `(9,15)m (10,15)n (11,15)n (12,15)s` | `(10,18)n` |
| `right_atk_wind` | `(7,12)m (8,12)n (9,12)n (10,12)s` | `(9,15)n` |
| `right_atk_hit` | `(21,16)m (22,17)n (23,18)s`（45°の刃に直角） | `(19,20)n` |

付け替えの規則: 鍔は `m→G`、`n→H`、`s→J`。柄頭は `n→R`。

---

### Task 1: 鍔と柄頭を専用の文字に付け替える（色は金のまま）

**Files:**
- Create: `.superpowers/sdd/2026-10-02-roran-sword-from-icon/relabel.py`・`diff_pixels.py`・`check_parts.py`（git 管理外）
- Modify: `pixel-asset-forge/assets/unit/roran/*.txt` のうち `up_atk_hit.txt` を除く23コマ

**Interfaces:**
- Produces:
  - 23コマのグリッドに `G H J R` の文字と、その割り当ての `# map:` 行（`relabel.py` が既存の最後の `# map:` 行の直後に1行足す。例 `# map: G=metal_hi H=metal_base J=metal_shadow R=metal_base`。そのコマで使う文字だけを書く）。Task 3 の `apply_map.py` はこの行を探して書き換える
  - `diff_pixels.py REV [--expect-none]`: 24コマを `REV` の版と比べ、描いた色が変わった画素を数える。`G H J R` 以外の位置が変わっていたら終了コード 1。`--expect-none` なら1画素でも変われば 1
  - `check_parts.py`: `m n s` の金の塊がどれも5画素以上か（鍔・柄頭が残っていないか）を確かめ、コマごとの `G H J R` の数を出す。5画素未満の塊があれば終了コード 1

- [ ] **Step 1: 付け替えのスクリプトを書く**

`/home/ubuntu/workspace/character-tactics/.superpowers/sdd/2026-10-02-roran-sword-from-icon/relabel.py`:

```python
#!/usr/bin/env python3
"""ロランの鍔と柄頭の画素を専用の文字に付け替える（使い捨て。issue #23 の4番目 Task 1）。

pixel-asset-forge/ で実行する。割り当てる色は今の金のままなので、PNG は変わらない。
"""
from pathlib import Path

UNIT = Path("assets/unit/roran")
GUARD = {"m": "G", "n": "H", "s": "J"}
POMMEL = {"n": "R"}
GOLD = {"G": "metal_hi", "H": "metal_base", "J": "metal_shadow", "R": "metal_base"}


def across(x0, y, chars):
    """横に並んだ鍔。"""
    return [(x0 + i, y, ch) for i, ch in enumerate(chars)]


# コマ -> (鍔 [(x, y, 今の文字)], 柄頭 [(x, y, 今の文字)])
PARTS = {
    "down_base": (across(7, 17, "mnns"), [(9, 20, "n")]),
    "down_walk_a": (across(7, 17, "mnns"), [(9, 20, "n")]),
    "down_walk_b": (across(7, 17, "mnns"), [(9, 20, "n")]),
    "down_breathe": (across(7, 15, "mnns"), [(9, 18, "n")]),
    "down_atk_wind": (across(7, 12, "mnns"), [(9, 15, "n")]),
    "down_atk_hit": (across(10, 20, "mnns"), [(12, 17, "n")]),
    "up_base": (across(21, 17, "mnns"), [(22, 20, "n")]),
    "up_walk_a": (across(21, 17, "mnns"), [(22, 20, "n")]),
    "up_walk_b": (across(21, 17, "mnns"), [(22, 20, "n")]),
    "up_breathe": (across(21, 15, "mnns"), [(22, 18, "n")]),
    "up_atk_wind": (across(21, 12, "mnns"), [(22, 15, "n")]),
    "left_base": (across(21, 17, "mn"), [(21, 20, "n")]),
    "left_walk_a": (across(21, 17, "mn"), [(21, 20, "n")]),
    "left_walk_b": (across(21, 17, "mn"), [(21, 20, "n")]),
    "left_breathe": (across(21, 15, "mn"), [(21, 18, "n")]),
    "left_atk_wind": (across(21, 12, "mnns"), [(22, 15, "n")]),
    "left_atk_hit": ([(10, 16, "m"), (8, 18, "s")], []),
    "right_base": (across(9, 17, "mnns"), [(10, 20, "n")]),
    "right_walk_a": (across(9, 17, "mnns"), [(10, 20, "n")]),
    "right_walk_b": (across(9, 17, "mnns"), [(10, 20, "n")]),
    "right_breathe": (across(9, 15, "mnns"), [(10, 18, "n")]),
    "right_atk_wind": (across(7, 12, "mnns"), [(9, 15, "n")]),
    "right_atk_hit": ([(21, 16, "m"), (22, 17, "n"), (23, 18, "s")], [(19, 20, "n")]),
}


def relabel(path: Path, guard, pommel) -> None:
    lines = path.read_text(encoding="utf-8").splitlines()
    assert not any(line.startswith("# map:") and any(f" {ch}=" in line for ch in "GHJR") for line in lines), \
        f"{path.name}: 付け替え済み"
    grid_at = [i for i, line in enumerate(lines) if not line.startswith("#")]
    used = set()
    for points, table in ((guard, GUARD), (pommel, POMMEL)):
        for x, y, old in points:
            i = grid_at[y]
            row = lines[i]
            assert row[x] == old, f"{path.name} ({x},{y}): {old!r} のはずが {row[x]!r}"
            new = table[old]
            lines[i] = row[:x] + new + row[x + 1:]
            used.add(new)
    last_map = max(i for i, line in enumerate(lines) if line.startswith("# map:"))
    entry = " ".join(f"{ch}={GOLD[ch]}" for ch in "GHJR" if ch in used)
    lines.insert(last_map + 1, f"# map: {entry}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    frames = {p.stem for p in UNIT.glob("*.txt")}
    assert frames - set(PARTS) == {"up_atk_hit"}, sorted(frames - set(PARTS))
    for name, (guard, pommel) in PARTS.items():
        relabel(UNIT / f"{name}.txt", guard, pommel)
        print(f"{name}: 鍔 {len(guard)} 柄頭 {len(pommel)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 比べるスクリプトと、塊を数えるスクリプトを書く**

`/home/ubuntu/workspace/character-tactics/.superpowers/sdd/2026-10-02-roran-sword-from-icon/diff_pixels.py`:

```python
#!/usr/bin/env python3
"""ロランの24コマを git の版と比べ、描いた色が変わった画素を数える（使い捨て）。

pixel-asset-forge/ で実行する。
    diff_pixels.py HEAD --expect-none   # 1画素でも変われば失敗
    diff_pixels.py HEAD                 # G H J R の位置以外が変われば失敗
"""
import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, "tools")
from gridfile import load_palette, parse  # noqa: E402
from render import to_image  # noqa: E402

UNIT = Path("assets/unit/roran")
PARTS = set("GHJR")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("rev")
    ap.add_argument("--expect-none", action="store_true")
    args = ap.parse_args()
    palette = load_palette()
    failed = False
    with tempfile.TemporaryDirectory() as tmp:
        for path in sorted(UNIT.glob("*.txt")):
            old_text = subprocess.run(
                ["git", "show", f"{args.rev}:./{path.as_posix()}"],
                capture_output=True, text=True, check=True,
            ).stdout
            old_path = Path(tmp) / path.name
            old_path.write_text(old_text, encoding="utf-8")
            old, new = parse(old_path), parse(path)
            a, b = to_image(old, palette).load(), to_image(new, palette).load()
            changed = {(x, y) for y in range(new.height) for x in range(new.width) if a[x, y] != b[x, y]}
            outside = {(x, y) for x, y in changed if new.rows[y][x] not in PARTS}
            print(f"{path.stem:16} changed {len(changed):2}  outside {len(outside)}")
            if outside or (args.expect_none and changed):
                failed = True
    print("FAIL" if failed else "OK")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
```

`/home/ubuntu/workspace/character-tactics/.superpowers/sdd/2026-10-02-roran-sword-from-icon/check_parts.py`:

```python
#!/usr/bin/env python3
"""金の文字 m n s の塊が盾だけ（どれも5画素以上）かを確かめ、G H J R の数を出す（使い捨て）。

pixel-asset-forge/ で実行する。
"""
import sys
from pathlib import Path

sys.path.insert(0, "tools")
from gridfile import parse  # noqa: E402

UNIT = Path("assets/unit/roran")


def blobs(points):
    points = set(points)
    while points:
        stack, size = [points.pop()], 0
        while stack:
            x, y = stack.pop()
            size += 1
            for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if n in points:
                    points.remove(n)
                    stack.append(n)
        yield size


def main() -> int:
    failed = False
    for path in sorted(UNIT.glob("*.txt")):
        g = parse(path)
        gold = [(x, y) for y, row in enumerate(g.rows) for x, ch in enumerate(row) if ch in "mns"]
        sizes = sorted(blobs(gold))
        parts = sum(row.count(ch) for row in g.rows for ch in "GHJR")
        small = [s for s in sizes if s < 5]
        print(f"{path.stem:16} gold {sizes}  GHJR {parts}" + ("  <- 5画素未満の金の塊" if small else ""))
        failed |= bool(small)
    print("FAIL" if failed else "OK")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: 付け替える前に、塊の検査が今の状態で落ちることを確かめる**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python ../.superpowers/sdd/2026-10-02-roran-sword-from-icon/check_parts.py
```

Expected: `FAIL`（`up_atk_hit` 以外の23コマで、鍔と柄頭が5画素未満の金の塊として出る）

- [ ] **Step 4: 付け替える**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python ../.superpowers/sdd/2026-10-02-roran-sword-from-icon/relabel.py
```

Expected: 23行が出る。assert で止まったら、座標の表と今の画素が食い違っている。**直す前に止めて報告する**

- [ ] **Step 5: 機械で確かめる**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python ../.superpowers/sdd/2026-10-02-roran-sword-from-icon/check_parts.py
.venv/bin/python ../.superpowers/sdd/2026-10-02-roran-sword-from-icon/diff_pixels.py HEAD --expect-none
.venv/bin/python tools/validate.py
```

Expected:
- `check_parts.py`: `OK`。`GHJR` の数は、正面・背面・振りかぶり・右向きの `base`/`walk`/`breathe` が5、左向きの `base`/`walk`/`breathe` が3、`left_atk_hit` が2、`right_atk_hit` が4、`up_atk_hit` が0
- `diff_pixels.py`: 24行すべて `changed  0`、最後に `OK`
- `validate.py`: 失敗なし

- [ ] **Step 6: 差分を見てコミットする**

```sh
cd /home/ubuntu/workspace/character-tactics
git diff --stat -- pixel-asset-forge/assets/unit/roran
git add pixel-asset-forge/assets/unit/roran
git commit -m "refactor: ロランの鍔と柄頭を専用の文字に付け替える（色は金のまま）"
```

Expected: 23ファイルが変わる（`up_atk_hit.txt` は変わらない）。

絵は変わらないので見せる絵はない。数字（23コマ、`changed 0`）を報告して Task 2 へ進む。

---

### Task 2: 色の置き方の案を並べて見せる

**Files:**
- Create: `.superpowers/sdd/2026-10-02-roran-sword-from-icon/variants.py`（git 管理外）
- 出力: `.superpowers/sdd/2026-10-02-roran-sword-from-icon/colors.png`

**Interfaces:**
- Consumes: Task 1 の `G H J R` の文字
- Produces: `variants.py colors` と `variants.py tips`（Task 4 が使う）。依頼者が選んだ割り当て（Task 3 の `apply_map.py` に渡す4つの `文字=色`）

- [ ] **Step 1: 案を並べるスクリプトを書く**

`/home/ubuntu/workspace/character-tactics/.superpowers/sdd/2026-10-02-roran-sword-from-icon/variants.py`:

```python
#!/usr/bin/env python3
"""ロランの down_base・right_base の案を並べる（使い捨て）。グリッドのファイルは書き換えない。

pixel-asset-forge/ で実行する。
    variants.py colors   # 鍔と柄頭の色の案 -> colors.png
    variants.py tips     # 切っ先の形の案   -> tips.png
"""
import dataclasses
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, "tools")
from gridfile import load_palette, parse  # noqa: E402
from render import to_image  # noqa: E402

UNIT = Path("assets/unit/roran")
OUT = Path("../.superpowers/sdd/2026-10-02-roran-sword-from-icon")
FRAMES = ["down_base", "right_base"]
BG = (60, 90, 60, 255)

# 色の案: (名前, G H J R の割り当て)。None は今のまま
COLORS = [
    ("C0 now (gold)", None),
    ("V1 guard hi/base/shadow, pommel roof_base",
     {"G": "wood_hi", "H": "wood_base", "J": "wood_shadow", "R": "roof_base"}),
    ("V2 guard hi/base/shadow, pommel roof_hi",
     {"G": "wood_hi", "H": "wood_base", "J": "wood_shadow", "R": "roof_hi"}),
    ("V3 guard base/base/shadow, pommel roof_base",
     {"G": "wood_base", "H": "wood_base", "J": "wood_shadow", "R": "roof_base"}),
]

# 切っ先の案: (名前, コマ -> [(x, y, 新しい文字)])
TIPS = [
    ("T0 now (flat)", {}),
    ("T1 keep left column", {
        "down_base": [(9, 5, "."), (9, 6, "o")],
        "right_base": [(11, 5, "."), (11, 6, "o")],
    }),
    ("T2 keep right column", {
        "down_base": [(8, 5, "."), (8, 6, "o")],
        "right_base": [(10, 5, "."), (10, 6, "o")],
    }),
]


def edited(grid, edits):
    rows = list(grid.rows)
    for x, y, ch in edits:
        rows[y] = rows[y][:x] + ch + rows[y][x + 1:]
    return dataclasses.replace(grid, rows=rows)


def cell(img):
    """8倍の絵の右に、等倍と2倍を縦に並べる。"""
    out = Image.new("RGBA", (32 * 8 + 8 + 64, 32 * 8), BG)
    out.alpha_composite(img.resize((256, 256), Image.NEAREST), (0, 0))
    out.alpha_composite(img, (264, 0))
    out.alpha_composite(img.resize((64, 64), Image.NEAREST), (264, 40))
    return out


def sheet(rows, path):
    palette = load_palette()
    grids = {name: parse(UNIT / f"{name}.txt") for name in FRAMES}
    cw, ch, label = 32 * 8 + 8 + 64, 32 * 8, 16
    icon = to_image(parse(Path("assets/item/sword.txt")), palette)
    left = 16 * 8 + 16
    out = Image.new("RGBA", (left + len(FRAMES) * (cw + 16), len(rows) * (ch + label + 16)), BG)
    draw = ImageDraw.Draw(out)
    out.alpha_composite(icon.resize((128, 128), Image.NEAREST), (8, label))
    draw.text((8, 0), "item/sword", fill="white")
    for r, (name, change) in enumerate(rows):
        y = r * (ch + label + 16)
        draw.text((left, y), name, fill="white")
        for c, frame in enumerate(FRAMES):
            g = change(grids[frame], frame)
            out.alpha_composite(cell(to_image(g, palette)), (left + c * (cw + 16), y + label))
    out.save(path)
    print(path)


def main() -> None:
    mode = sys.argv[1]
    if mode == "colors":
        rows = [(name, (lambda g, f, m=m: g if m is None else dataclasses.replace(g, charmap={**g.charmap, **m})))
                for name, m in COLORS]
        sheet(rows, OUT / "colors.png")
    elif mode == "tips":
        rows = [(name, (lambda g, f, e=e: edited(g, e.get(f, [])))) for name, e in TIPS]
        sheet(rows, OUT / "tips.png")
    else:
        raise SystemExit(f"unknown mode {mode!r}")


if __name__ == "__main__":
    main()
```

（`colors` の案は `# map:` の割り当てだけを変えた案なので、選んだ割り当ては Task 3 でほかのコマにもそのまま効く。ここで並べるのは `down_base`・`right_base` の4px の鍔だけで、左向きの2px の鍔（`G` と `H`）は Task 3 の4方向の並びで見る）

- [ ] **Step 2: 案を描いて見せる**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python ../.superpowers/sdd/2026-10-02-roran-sword-from-icon/variants.py colors
```

`/home/ubuntu/workspace/character-tactics/.superpowers/sdd/2026-10-02-roran-sword-from-icon/colors.png` を Read で見せる。各案（C0 = 今の金、V1〜V3）の違いを1行ずつ書き添える:
- V1: 鍔の濃淡は今の金の置き方（左端 `wood_hi`、中2画素 `wood_base`、右端 `wood_shadow`）を木に移す。柄頭 `roof_base`
- V2: V1 の柄頭を明るい `roof_hi` にする
- V3: 鍔の左端も `wood_base` にして明るい画素を無くす（アイコンの鍔は輪郭の内側が `wood_shadow` で暗い）。柄頭 `roof_base`

**止まる。** 依頼者が選んだ割り当て（または別の割り当て）を記録して Task 3 へ。画素を直す必要がある案が選ばれたら、計画に無い作業なので**止めて報告する**

---

### Task 3: 選ばれた色を23コマに当てはめ、forge で確かめる

**Files:**
- Create: `.superpowers/sdd/2026-10-02-roran-sword-from-icon/apply_map.py`（git 管理外）
- Modify: `pixel-asset-forge/assets/unit/roran/*.txt` の23コマの `G H J R` の `# map:` 行

**Interfaces:**
- Consumes: Task 1 の `# map:` 行、Task 2 で選ばれた割り当て
- Produces: 木の鍔と赤い柄頭の23コマ

- [ ] **Step 1: 割り当てを書き換えるスクリプトを書く**

`/home/ubuntu/workspace/character-tactics/.superpowers/sdd/2026-10-02-roran-sword-from-icon/apply_map.py`:

```python
#!/usr/bin/env python3
"""ロランの G H J R の # map: 行を、渡した割り当てに書き換える（使い捨て）。

pixel-asset-forge/ で実行する。
    apply_map.py G=wood_hi H=wood_base J=wood_shadow R=roof_base
"""
import re
import sys
from pathlib import Path

UNIT = Path("assets/unit/roran")
LINE = re.compile(r"^# map:(?: [GHJR]=\w+)+$")


def main() -> None:
    choice = dict(arg.split("=", 1) for arg in sys.argv[1:])
    assert set(choice) == set("GHJR"), f"G H J R の4つを渡す: {sorted(choice)}"
    changed = 0
    for path in sorted(UNIT.glob("*.txt")):
        lines = path.read_text(encoding="utf-8").splitlines()
        hits = [i for i, line in enumerate(lines) if LINE.match(line)]
        if not hits:
            continue
        assert len(hits) == 1, f"{path.name}: G H J R の行が {len(hits)} 本"
        i = hits[0]
        chars = re.findall(r" ([GHJR])=", lines[i])
        lines[i] = "# map: " + " ".join(f"{ch}={choice[ch]}" for ch in chars)
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        changed += 1
    print(f"{changed} frames")
    assert changed == 23, changed


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 当てはめる**

Task 2 で選ばれた割り当てを渡す。V1 が選ばれた場合:

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python ../.superpowers/sdd/2026-10-02-roran-sword-from-icon/apply_map.py G=wood_hi H=wood_base J=wood_shadow R=roof_base
```

Expected: `23 frames`

- [ ] **Step 3: 機械で確かめる**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python ../.superpowers/sdd/2026-10-02-roran-sword-from-icon/diff_pixels.py HEAD
.venv/bin/python ../.superpowers/sdd/2026-10-02-roran-sword-from-icon/check_parts.py
.venv/bin/python tools/validate.py
.venv/bin/python tools/check_colors.py
```

Expected:
- `diff_pixels.py`: 全行 `outside 0`、`OK`。`changed` は、選んだ割り当てで金と色が変わる画素の数（V1 なら Task 1 の `GHJR` の数と同じ）
- `check_parts.py`: `OK`
- `validate.py`: 失敗なし
- `check_colors.py`: 失敗は既知の `types/face/reference/knight.txt` の1件だけ。ロランのコマで新しい指摘が出たら、内容を添えて**止めて報告する**

- [ ] **Step 4: 4方向・プレビュー・動きを見せる**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python tools/render.py assets/unit/roran
.venv/bin/python tools/contact_sheet.py --columns 4 -o build/roran_base4.png assets/unit/roran/down_base.txt assets/unit/roran/left_base.txt assets/unit/roran/right_base.txt assets/unit/roran/up_base.txt
.venv/bin/python tools/sheet.py sheets/roran.txt
.venv/bin/python tools/sheet_gif.py sheets/roran.txt
```

Read で見せる:
- `build/roran_base4.png`（4方向の `base`）
- `build/sheets/roran_preview.png`（赤い足元ライン・青い中心線。足元と中心が付け替えの前と同じこと）
- `build/sheets/roran_idle.gif`・`roran_walk.gif`・`roran_attack.gif`（Read で GIF が見えなければ、そのことを伝え、`build/unit/roran/*_atk_*_x8.png` を見せる）

あわせて `sheet.py` が出す足元・中心の実測表で、`off` が出るのが横向きの `atk_hit`・`atk_wind` だけであることを確かめる（`types/unit/SPEC.md` の「目視の手順」）。

**止まる。** 依頼者の確認を待つ

- [ ] **Step 5: コミット**

```sh
cd /home/ubuntu/workspace/character-tactics
git diff --stat -- pixel-asset-forge/assets/unit/roran
git add pixel-asset-forge/assets/unit/roran
git commit -m "feat: ロランの剣の鍔を木、柄頭を赤い宝石にする（アイコンの剣に揃える）"
```

Expected: 23ファイル、各1行の変更

---

### Task 4: 尖った切っ先を試して見せる

**Files:**
- 出力: `.superpowers/sdd/2026-10-02-roran-sword-from-icon/tips.png`（グリッドのファイルは書き換えない）

**Interfaces:**
- Consumes: Task 2 の `variants.py tips`、Task 3 までの23コマ
- Produces: 依頼者の採否

案（今の切っ先は、刃2列の上を輪郭2画素の平らな蓋で閉じている）:
- **T1（左の列を残す）:** 右の列（`stone_base`）の先端1画素を輪郭にし、蓋の右の画素を消す。光の来る左上へ先が寄る。`down_base` は `(9,5)` を `.`、`(9,6)` を `o`。`right_base` は `(11,5)` を `.`、`(11,6)` を `o`
- **T2（右の列を残す）:** 左の列（`stone_hi`）の先端1画素を輪郭にし、蓋の左の画素を消す。`down_base` は `(8,5)` を `.`、`(8,6)` を `o`。`right_base` は `(10,5)` を `.`、`(10,6)` を `o`

どちらも、残った先端の画素は真下の刃と辺でつながるので、`item/SPEC.md` の「輪郭に囲まれた1画素を、本体と斜めの角だけでつなげる形」には当たらない。2px幅の刃では、アイコンの「3画素の角」（左右の対称な尖り）は作れない。切っ先は y=5 より上に出ない（立ち絵の規約）。

- [ ] **Step 1: 案を描いて見せる**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python ../.superpowers/sdd/2026-10-02-roran-sword-from-icon/variants.py tips
```

`/home/ubuntu/workspace/character-tactics/.superpowers/sdd/2026-10-02-roran-sword-from-icon/tips.png` を Read で見せる。上の案の説明と、2px幅では左右対称に尖らせられないことを書き添える。

**止まる。** 依頼者が採否を決める
- 採らない: Task 5 へ
- 採る: 刃のある全コマ（`breathe`・`atk_wind`・正面の `atk_hit` の下向きの刃・横向きの `atk_hit` の45°の刃を含む）へ当てはめる作業は、この計画に無い。**当てはめる前に止めて報告し**、コマごとの直し方を計画に足して承認を取る

---

### Task 5: ゲームへ書き出して動かす

**Files:**
- Modify: `assets/images/roran-map.png`（`export.py` で書き出す）

**Interfaces:**
- Consumes: Task 3（Task 4 で切っ先を採った場合はその当てはめ）までの24コマ
- Produces: ゲームで使うシート

- [ ] **Step 1: 書き出す**

```sh
cd /home/ubuntu/workspace/character-tactics
pixel-asset-forge/.venv/bin/python pixel-asset-forge/tools/export.py sprites.json assets/images
git status --short assets/images
```

Expected: `FAIL` が出ない。`assets/images/roran-map.png` だけが変わる（ほかの PNG が変わったら**止めて報告する**）

- [ ] **Step 2: テストとビルド**

```sh
cd /home/ubuntu/workspace/character-tactics
npm test
npm run build
```

Expected: どちらも成功（`src/engine/sheet-size.test.ts` はシートの実寸と JSON の一致を見る。シートの大きさは変わらない）

- [ ] **Step 3: 画面を撮る**

`vite preview` は Bash の `run_in_background` で立てる（`localhost` でだけ待ち受ける。`127.0.0.1` では繋がらない）:

```sh
cd /home/ubuntu/workspace/character-tactics
npx vite preview --port 4178
```

撮る:

```sh
cd /home/ubuntu/workspace/character-tactics
node .superpowers/sdd/2026-09-30-roran-face/cdp.mjs "http://localhost:4178/play/character-tactics/?debug" .superpowers/sdd/2026-10-02-roran-sword-from-icon/shots shot:title
```

`cdp.mjs` は `feat/roran-face` の作業で作った使い捨ての道具（git 管理外。手順 `shot:<名前>` `tap:<x>,<y>` `wait:<ミリ秒>` `key:<キー>`、論理座標）。撮った画面を見て、ステージ選択 → 会話を `とばす`／タップで送る → 配置 → `始める` の座標を1つずつ決め、配置の画面と戦闘中の画面（ロランが歩いているところ、`P` で止めて `.` で送り攻撃のコマ）を撮る。`.` は1回ごとに1フレーム待つ（`wait:50` を挟む）。Read で見せる。鍔と柄頭が、`?debug` の文字・選択の輪・HPバーに隠れていない画面を選ぶ。

**止まる。** 依頼者の確認を待つ。終わったら `vite preview` を止める

- [ ] **Step 4: コミット**

```sh
cd /home/ubuntu/workspace/character-tactics
git add assets/images/roran-map.png
git commit -m "feat: 鍔と柄頭を直したロランのシートを書き出す"
```

---

### Task 6: 規約と記録を直す

**Files:**
- Modify: `pixel-asset-forge/types/unit/SPEC.md`
- Modify: `pixel-asset-forge/UPSTREAM.md`
- Modify: `HANDOVER.md`

**Interfaces:**
- Consumes: Task 2〜5 で決まったこと

- [ ] **Step 1: 専用の文字を規約にするかを確かめる**

依頼者に1つだけ聞く: 「持ち物の部品（鍔・柄頭）に専用の文字を割り当て、`# map:` 行で色を切り替えられるようにする」を `unit` の規約に書くか（Yes/No）。答えを待つ

- [ ] **Step 2: unit の SPEC を直す**

`pixel-asset-forge/types/unit/SPEC.md` の「立ち絵4方向の規約」の箇条書きの末尾（「奥の装備や手に新しい色を当てるときは…」の次）に足す（選ばれた案に合わせて色の名前を直す。V1 の場合）:

```markdown
- **剣は item の剣（`assets/item/sword.txt`）に色を揃える。** 画素は写さず、素材の色を合わせる（issue #23 の4番目、2026-10-02 依頼者の判断）。
  刃は `stone_hi`/`stone_base` の2px幅、鍔は木（`wood_hi`/`wood_base`/`wood_shadow`。正面・背面4px、横向き2px）、
  柄頭は赤い宝石（`roof_base` の1画素）。盾は金（`metal_*`）のままなので、剣と盾の色は分かれる
```

Step 1 が Yes なら、続けて次を足す:

```markdown
- **持ち物の部品には専用の文字を割り当てる。** 同じ色の別の部品（例: 金の鍔と金の盾）と同じ文字にすると、`# map:` 行で片方だけ色を変えられない。
  ロランは鍔 `G`・`H`・`J`、柄頭 `R`
```

「未確定」の色数の行（`ロランは15〜19色`）を実測に直す:

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
for f in assets/unit/roran/*.txt; do echo "$f $(grep -v '^#' $f | grep -o '[^.]' | sort -u | wc -l)"; done | sort -k2 -n | sed -n '1p;$p'
```

（文字の種類を数えているので、同じ色に2文字を割り当てたコマ、たとえば `H` と `R` を同じ色にした場合は色数より多く出る。その場合は `render.py` の PNG の色を数える）

Task 4 で切っ先を採らなかった場合は、立ち絵の規約の「立てて構えた剣の刃は、横向きでも正面と同じ幅（ロランは2px）で読めた」の後ろに「切っ先は平らな蓋のまま（2px幅では左右対称に尖らせられない。issue #23 の4番目で試して採らなかった）」を足す。

- [ ] **Step 3: UPSTREAM に1行足す**

`pixel-asset-forge/UPSTREAM.md` の「forge に戻す候補」の末尾に:

```markdown
- `assets/unit/roran/`（23コマ）と `types/unit/SPEC.md`: ロランの剣の鍔を木、柄頭を赤い宝石にして item の剣（`assets/item/sword.txt`）に色を揃えた。鍔と柄頭に専用の文字（`G H J R`）を割り当て、`# map:` 行で色を切り替えた（character-tactics の issue #23 の4番目、2026-10-02）
```

- [ ] **Step 4: HANDOVER を直す**

`HANDOVER.md` を4番目の時点に書き直す:
- 冒頭の Generated を「issue #23 の4番目を実装した時点」に
- Current State: ブランチ `feat/roran-sword-from-icon`（main `4e89995` から分岐、push・PR なし）。3番目は PR #25 でマージ済み。設計・計画のパス
- What Remains: 最終レビュー → 指示で push・PR。5番目（イネスで弓を試す）。色の命名の整理は `feat/roran-face` のマージ後（この行は残す）
- 「issue #23 の4番目で決めたこと」の節を足す: spec の「決めたこと」、Task 2 で選ばれた案、Task 4 の採否、専用の文字の規約の判断
- 「Claude の気付き（具体的な不都合は未確認）」に、作業中の気付きを1行ずつ足す（日付・何を見て気付いたか・なぜ気になったか）。無ければ足さない

- [ ] **Step 5: 差分を見てコミット**

```sh
cd /home/ubuntu/workspace/character-tactics
git diff -- pixel-asset-forge/types/unit/SPEC.md pixel-asset-forge/UPSTREAM.md HANDOVER.md
git add pixel-asset-forge/types/unit/SPEC.md pixel-asset-forge/UPSTREAM.md HANDOVER.md
git commit -m "docs: ロランの剣の色の規約と HANDOVER を直す（issue #23 の4番目）"
```
