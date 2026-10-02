# 剣・弓のアイコン（item 型）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** forge で16pxの剣と弓を描き、item 型の規約（`types/item/SPEC.md`）を作る（issue #23 の3番目）。

**Architecture:** 絵は `pixel-asset-forge/assets/item/*.txt` のテキストグリッドが正で、PNG は生成物。剣・弓それぞれ「3案を描く → 見せて止まる → 選ばれた案を確定」の順に進め、絵が決まってから SPEC.md に実測値を書く。機械の検査は forge の `validate.py` / `check_colors.py` と、この計画で足す使い捨ての検査（`/tmp/item_check.py`、リポジトリには入れない）。

**Tech Stack:** pixel-asset-forge（Python 3.14 の `.venv`）、master パレット。

**Spec:** `docs/superpowers/specs/2026-10-02-item-icons-sword-bow-design.md`

## Global Constraints

- 解像度 `item` = 16x16、`# bg: transparent`、`# light: upper-left`、輪郭は `outline` を全周1px（`assets/item/chest.txt` と同じ）
- 色は `palette/master.json` の既存色だけ。**色を足さない**（`feat/roran-face` と `master.json` がぶつかるため。足りなければ止めて依頼者に確認）
- 使う色: 刃・鏃・弦 `stone_*`、鍔・柄・弓本体・矢の軸 `wood_*`、剣の宝石 `roof_*`、矢の羽根 `water_*`、輪郭 `outline`
- 向き: 剣は右上に切っ先を向けた45°の斜め置き。弓も矢も45°の斜め置きで、矢は弓の真ん中を通す
- 大きさ: 16px いっぱいに大きく描く（ユニットの剣の刃2px幅には合わせない）
- 剣の規約: 柄頭→拳（柄）→鍔→刃を1本の軸に並べ、鍔は刃に直角（`types/unit/SPEC.md` の攻撃の規約）
- 手本は `assets/images/role-tate.png`（剣）・`role-yumi.png`（弓）の**構図だけ**。色と画素は写さない
- 範囲は forge で `build/item/` に PNG を出すところまで。`sprites.json`・ゲーム側のコード・`tools/`・パレット・`feat/roran-face` は触らない
- 絵は段階ごとに Read で見せて止まる。案は何案か並べ、等倍の縮小（16px 等倍と32px 表示）を添える。「一旦進めましょう」は次へ進んでよいという意味で、合格ではない
- 計画に不備が見つかったら、直す前に止めて依頼者に報告する
- push と PR は依頼者の指示があるまでしない。コミットは Conventional Commits + 日本語の要約
- 作業ディレクトリは断りがなければ `pixel-asset-forge/`。コマンドは `.venv/bin/python tools/...`

## Review Focus

spec が暗に求めているが、各タスクの機械検査だけでは拾えないもの（最も起きやすい順）。それぞれ Task 1 で作る `/tmp/item_check.py` に検査を入れ、Task 2・4 の確定の前に通す。

1. 輪郭に穴がある（輪郭以外の画素の4近傍に透明がある）→ 背景が透けて形が崩れる。期待: 穴ゼロ
2. 16px の端に絵が接して切れる → 期待: 外接矩形が x・y とも 1〜14 に収まる（chest と同じ余白）
3. 剣の軸がずれる（柄頭・拳・鍔・刃が1本の線に乗らない）→ 期待: 軸の斜めの線 `(x, 15-x)` 上の指定範囲がすべて不透明（剣は x=2..13、弓の矢も同じ）
4. 光源が逆（右下が明るい）→ 期待: 各素材で `_hi` の平均 (x+y) が `_shadow` の平均より小さい
5. 暗い背景・明るい背景のどちらかで読めない → 期待: 目視で 16px 等倍と32px 表示の両方で剣・弓と分かる（機械検査なし。Task 1・3 の見せる段階で確かめる）

---

### Task 1: 検査スクリプトを作り、剣の3案を描いて見せる

**Files:**
- Create: `/tmp/item_check.py`（リポジトリに入れない）
- Create: `pixel-asset-forge/assets/item/sword_a.txt`, `sword_b.txt`, `sword_c.txt`（案。確定まで未コミット）

**Interfaces:**
- Produces: `/tmp/item_check.py <grid.txt> --axis X0 X1`（終了コード 0 = 合格。Task 2・3・4 が使う）

- [ ] **Step 1: 検査スクリプトを書く**

`/tmp/item_check.py`:

```python
#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

sys.path.insert(0, "tools")
from gridfile import parse  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("grid")
ap.add_argument("--axis", nargs=2, type=int, required=True, metavar=("X0", "X1"))
args = ap.parse_args()

g = parse(Path(args.grid))
rows = g.rows
h, w = len(rows), len(rows[0])
opaque = lambda x, y: 0 <= x < w and 0 <= y < h and rows[y][x] != "."
name = lambda x, y: g.charmap[rows[y][x]]
fails = []

holes = [
    (x, y)
    for y in range(h)
    for x in range(w)
    if opaque(x, y) and name(x, y) != "outline"
    and any(not opaque(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
]
if holes:
    fails.append(f"輪郭の穴 {len(holes)} 箇所: {holes[:8]}")

xs = [x for y in range(h) for x in range(w) if opaque(x, y)]
ys = [y for y in range(h) for x in range(w) if opaque(x, y)]
if min(xs) < 1 or max(xs) > 14 or min(ys) < 1 or max(ys) > 14:
    fails.append(f"外接矩形が 1..14 を出ている: x {min(xs)}..{max(xs)}, y {min(ys)}..{max(ys)}")

gaps = [(x, 15 - x) for x in range(args.axis[0], args.axis[1] + 1) if not opaque(x, 15 - x)]
if gaps:
    fails.append(f"軸 (x, 15-x) に透明: {gaps}")

by_material = {}
for y in range(h):
    for x in range(w):
        if opaque(x, y):
            n = name(x, y)
            if "_" in n:
                mat, tone = n.rsplit("_", 1)
                by_material.setdefault(mat, {}).setdefault(tone, []).append(x + y)
for mat, tones in by_material.items():
    if "hi" in tones and "shadow" in tones:
        mean = lambda v: sum(v) / len(v)
        if mean(tones["hi"]) >= mean(tones["shadow"]):
            fails.append(f"光源が逆: {mat}_hi の平均(x+y) {mean(tones['hi']):.1f} >= {mat}_shadow {mean(tones['shadow']):.1f}")

print("ok  ", args.grid) if not fails else [print("FAIL", args.grid, f) for f in fails]
sys.exit(1 if fails else 0)
```

- [ ] **Step 2: 検査スクリプトが chest で動くことを確かめる**

Run: `cd pixel-asset-forge && .venv/bin/python /tmp/item_check.py assets/item/chest.txt --axis 2 3`
Expected: スクリプト自体がエラーなく動く。chest は軸 `(2,13)`・`(3,12)` が不透明かは絵次第なので、結果が FAIL でもスクリプトのエラー（Traceback）でなければよい。Traceback が出たらスクリプトを直す。

- [ ] **Step 3: 剣の3案を書く**

3ファイルとも先頭は次のヘッダにする（16行の16文字のグリッドが続く）。

```
# type: item
# size: 16x16
# light: upper-left
# bg: transparent
# map: o=outline i=stone_hi j=stone_base k=stone_shadow l=stone_dark
# map: h=wood_hi w=wood_base s=wood_shadow d=wood_dark
# map: r=roof_hi q=roof_base t=roof_shadow
```

骨格（全案共通）: 軸は斜めの線 `(x, 15-x)`。柄頭（赤い宝石）は左下 `(2,13)` 付近、切っ先は右上 `(13,2)` 付近。鍔は軸に直角、つまり `(x, x)` 方向に並べる。刃は軸の両側へ幅を持たせ、左上側（光源側）を `stone_hi`、右下側を `stone_shadow`、中央を `stone_base`、全体を `outline` で囲む。柄は `wood_*`、鍔は `wood_*`、宝石は `roof_*`。

案ごとの違い:
- `sword_a.txt`: 刃は斜め幅3px。鍔は軸の左右に各2px（計5px）。`role-tate.png` に最も近い
- `sword_b.txt`: 刃は斜め幅2px（細身）で長め。鍔は各1px（計3px）
- `sword_c.txt`: 刃は斜め幅3px で中央に `stone_shadow` の細い溝を1本通す。鍔は各2px

書くときの確認: 各行の長さは16文字、行数は16、使う文字はすべて `map` にある。`.` が背景。

- [ ] **Step 4: 構造と色を検査する**

Run:
```
.venv/bin/python tools/validate.py assets/item
.venv/bin/python tools/check_colors.py assets/item
for f in a b c; do .venv/bin/python /tmp/item_check.py assets/item/sword_$f.txt --axis 2 13; done
```
Expected: `validate.py` は全件 ok、`check_colors.py` は `0 failed`、`item_check.py` は3案とも `ok`。FAIL が出た案は、軸・輪郭・余白・光源のどれかを直して再実行する（どれも絵の修正で直せる。パレットは触らない）。

- [ ] **Step 5: 並べて見せる**

Run:
```
.venv/bin/python tools/contact_sheet.py assets/item/sword_a.txt assets/item/sword_b.txt assets/item/sword_c.txt --scale 8 --columns 3 -o build/sword_x8.png
.venv/bin/python tools/contact_sheet.py assets/item/sword_a.txt assets/item/sword_b.txt assets/item/sword_c.txt --scale 2 --columns 3 -o build/sword_x2.png
.venv/bin/python tools/contact_sheet.py assets/item/sword_a.txt assets/item/sword_b.txt assets/item/sword_c.txt --scale 1 --columns 3 -o build/sword_x1.png
```
Read で `build/sword_x8.png`、`build/sword_x2.png`、`build/sword_x1.png` と、手本の `../assets/images/role-tate.png`（`pixel-asset-forge/` からの相対パス。PNG は grid ではないので contact_sheet には渡さない）を依頼者に見せる。

**ここで止まる。** 依頼者が案を選ぶか、直しを指示するまで Task 2 に進まない。Review Focus の5（読めるか）は、このときの依頼者の目視で確かめる。

### Task 2: 選ばれた剣を確定する

**Files:**
- Create: `pixel-asset-forge/assets/item/sword.txt`（選ばれた案をここに移す）
- Delete: `assets/item/sword_a.txt`, `sword_b.txt`, `sword_c.txt`（未コミットの案ファイル）

**Interfaces:**
- Consumes: Task 1 の `/tmp/item_check.py`、選ばれた案
- Produces: `assets/item/sword.txt`（Task 5 の SPEC.md が実測する）

- [ ] **Step 1: 依頼者が指示した直しを選ばれた案に入れる**

直しが無ければこの Step は何もしない。直したら Task 1 Step 4 の検査を `sword_<案>.txt` に対して再実行し、Task 1 Step 5 のコマンドで再度見せて止まる（再度の選択は不要。直しの確認だけ）。

- [ ] **Step 2: 確定してファイル名を揃える**

Run（`<案>` は a・b・c のうち選ばれたもの。ファイルはどれも未コミットなので `mv` と `rm` でよい）:
```
mv assets/item/sword_<案>.txt assets/item/sword.txt
rm assets/item/sword_*.txt
```

- [ ] **Step 3: 検査して PNG を出す**

Run:
```
.venv/bin/python tools/validate.py assets/item
.venv/bin/python tools/check_colors.py assets/item
.venv/bin/python /tmp/item_check.py assets/item/sword.txt --axis 2 13
.venv/bin/python tools/render.py assets/item/sword.txt
```
Expected: すべて ok / `0 failed`。`build/item/sword.png` と `sword_x8.png` が出る。

- [ ] **Step 4: Commit**

```
git add pixel-asset-forge/assets/item/sword.txt
git commit -m "feat: item 型の剣（16px、斜め置き）を描く"
```
（`git status` で、`sword.txt` 以外が入っていないことを確かめてから）

### Task 3: 弓の3案を描いて見せる

**Files:**
- Create: `pixel-asset-forge/assets/item/bow_a.txt`, `bow_b.txt`, `bow_c.txt`（案。確定まで未コミット）

**Interfaces:**
- Consumes: Task 1 の `/tmp/item_check.py`
- Produces: 案ファイル

- [ ] **Step 1: 弓の3案を書く**

3ファイルとも先頭は次のヘッダにする（16行の16文字のグリッドが続く）。

```
# type: item
# size: 16x16
# light: upper-left
# bg: transparent
# map: o=outline i=stone_hi j=stone_base k=stone_shadow
# map: h=wood_hi w=wood_base s=wood_shadow d=wood_dark
# map: u=water_hi v=water_base y=water_shadow
```

骨格（全案共通）: 矢は斜めの線 `(x, 15-x)` に沿って、左下の羽根（`water_*`）から右上の鏃（`stone_*`）まで通る。軸は `wood_*`。弓は矢の軸について対称で、弧が右上（鏃の側）へ膨らみ、両端は左上と右下に向かう（両端は線 `(x, x)` の方向）。弦は `stone_base` で弓の両端を結び、矢の羽根の根元（弓の真ん中）で矢と交わる。全体を `outline` で囲み、光源は左上（弓の弧の左上側を `wood_hi`、右下側を `wood_shadow`）。

案ごとの違い:
- `bow_a.txt`: 弧は深く、弦あり。矢は全長（左下の羽根から右上の鏃まで 12 セル）。`role-yumi.png` に最も近い
- `bow_b.txt`: 弧は浅く、弦あり。矢は全長
- `bow_c.txt`: 弧は深く、弦あり。矢は短め（鏃が弓の弧から少しだけ出る）

- [ ] **Step 2: 検査する**

Run:
```
.venv/bin/python tools/validate.py assets/item
.venv/bin/python tools/check_colors.py assets/item
for f in a b c; do .venv/bin/python /tmp/item_check.py assets/item/bow_$f.txt --axis 2 13; done
```
Expected: `validate.py` ok、`check_colors.py` は `0 failed`、`item_check.py` は3案とも `ok`。矢が短い `bow_c` は軸の範囲を実際の矢の長さに合わせる（例: `--axis 4 12`）。FAIL した案は絵を直して再実行する。パレットは触らない。

- [ ] **Step 3: 並べて見せる**

Run:
```
.venv/bin/python tools/contact_sheet.py assets/item/bow_a.txt assets/item/bow_b.txt assets/item/bow_c.txt --scale 8 --columns 3 -o build/bow_x8.png
.venv/bin/python tools/contact_sheet.py assets/item/bow_a.txt assets/item/bow_b.txt assets/item/bow_c.txt --scale 2 --columns 3 -o build/bow_x2.png
.venv/bin/python tools/contact_sheet.py assets/item/bow_a.txt assets/item/bow_b.txt assets/item/bow_c.txt --scale 1 --columns 3 -o build/bow_x1.png
```
Read で3枚と、手本の `assets/images/role-yumi.png`、確定した剣の `build/item/sword_x8.png` を依頼者に見せる（剣と並べたときの大きさ・太さの揃い具合を見るため）。

**ここで止まる。** 依頼者が案を選ぶか、直しを指示するまで Task 4 に進まない。

### Task 4: 選ばれた弓を確定する

**Files:**
- Create: `pixel-asset-forge/assets/item/bow.txt`
- Delete: `assets/item/bow_a.txt`, `bow_b.txt`, `bow_c.txt`

**Interfaces:**
- Consumes: Task 3 の選ばれた案、`/tmp/item_check.py`
- Produces: `assets/item/bow.txt`（Task 5 の SPEC.md が実測する）

- [ ] **Step 1: 依頼者が指示した直しを入れる**

Task 2 Step 1 と同じ。直した場合は Task 3 Step 2 の検査を再実行し、見せて止まる。

- [ ] **Step 2: 確定する**

Run（`<案>` は選ばれたもの）:
```
mv assets/item/bow_<案>.txt assets/item/bow.txt
rm assets/item/bow_*.txt
```

- [ ] **Step 3: 検査して PNG を出す**

Run:
```
.venv/bin/python tools/validate.py assets/item
.venv/bin/python tools/check_colors.py assets/item
.venv/bin/python /tmp/item_check.py assets/item/bow.txt --axis <矢の範囲>
.venv/bin/python tools/render.py assets/item/bow.txt
```
Expected: すべて ok / `0 failed`。`<矢の範囲>` は Task 3 で使った値。

- [ ] **Step 4: Commit**

```
git add pixel-asset-forge/assets/item/bow.txt
git commit -m "feat: item 型の弓（16px、矢つき・斜め置き）を描く"
```

### Task 5: item 型の SPEC.md を書く

**Files:**
- Create: `pixel-asset-forge/types/item/SPEC.md`
- Modify: `pixel-asset-forge/README.md`（「今あるアセット」の表の `item` の行）
- Modify: `pixel-asset-forge/ISSUES.md`（`item` の `SPEC.md` が無い課題の行）
- Modify: `pixel-asset-forge/UPSTREAM.md`（「forge に戻す候補」に1行）

**Interfaces:**
- Consumes: `assets/item/chest.txt`・`sword.txt`・`bow.txt`

- [ ] **Step 1: 3点を実測する**

Run:
```
.venv/bin/python tools/validate.py assets/item
for f in chest sword bow; do echo $f; .venv/bin/python tools/check_colors.py assets/item/$f.txt | tail -1; done
```
使う色名・色数・外接矩形・余白・輪郭の太さ・光源（`validate.py` の `N colours` と、グリッドを読んで数える）を表にまとめる。色数の上限は未確定のまま、実測値だけ書く（`# max_colors:` は書かない）。

- [ ] **Step 2: SPEC.md を書く**

`types/item/SPEC.md` を `types/unit/SPEC.md` と同じ形（表の「確定している規約」＋根拠の短い節）で書く。入れる内容:
- 解像度 16x16、背景 transparent、光源 upper-left、輪郭 `outline` を全周1px、外接矩形は x・y とも 1〜14（chest と剣・弓で実測した値）
- 素材ごとの色の割り当て（実測した表: 刃・金属 `stone_*`、木 `wood_*`、宝石 `roof_*`、羽根 `water_*`）。ISSUES.md の「剣が `stone_*`、盾が `metal_*` で命名と見た目が合っていない」に触れ、item では剣を `stone_*` としたことを書く（ユニット側の整理は4番目以降）
- 向き: 斜め置きは右上が先端の45°、軸は `(x, 15-x)`
- 剣の規約（柄頭→拳→鍔→刃を1本の軸、鍔は刃に直角）
- 弓の規約（矢は弓の真ん中を通り、弧は先端の側へ膨らむ）
- 役割アイコンとして 32px（2倍）で表示される前提
- 「未確定（勝手に決めない）」: アセットあたりの色数上限、`reference/` に何を置くか、宝箱など他の小物の向き
- 手本は構図だけを `role-tate.png`・`role-yumi.png` から取り、色と画素は写していないこと

- [ ] **Step 3: 関連文書を直す**

- `README.md` の表: `| \`item\`（小物） | 1点（\`chest\`） | 16x16 | まだ無い |` を `| \`item\`（小物） | 3点（\`chest\`・\`sword\`・\`bow\`） | 16x16 | [\`types/item/SPEC.md\`](types/item/SPEC.md) |` に直す
- `ISSUES.md` の「`item` の `SPEC.md` と、`tile` / `item` の `reference/` が無い」の行: item の SPEC は作ったので、`item` の SPEC.md の話を消し、`tile` の `reference/` が無いことと item の `reference/` が無いことだけを残す
- `UPSTREAM.md` の「forge に戻す候補」に1行足す: `types/item/SPEC.md`（新規）と `assets/item/sword.txt`・`bow.txt`、item 型の規約を作った理由（issue #23 の3番目、2026-10-02）

- [ ] **Step 4: 検査する**

Run: `.venv/bin/python tools/validate.py` （全件）、`.venv/bin/python -m unittest discover -s tests`（触っていないが、README の記述が壊れていないことの保険として全件）
Expected: `validate.py` は全件 ok。unittest は forge の既存の合格数のまま（Python 3.14 の venv で通る）。落ちたら、このタスクの変更が原因か既存かを `git stash` ではなく `git diff` で見て切り分け、既存なら報告して止まる。

- [ ] **Step 5: Commit**

```
git add pixel-asset-forge/types/item/SPEC.md pixel-asset-forge/README.md pixel-asset-forge/ISSUES.md pixel-asset-forge/UPSTREAM.md
git commit -m "docs: item 型の規約（SPEC.md）を作る"
```

### Task 6: 最終確認と引き継ぎ

**Files:**
- Modify: `HANDOVER.md`

- [ ] **Step 1: 全体を検査する**

Run:
```
.venv/bin/python tools/validate.py
.venv/bin/python tools/check_colors.py | tail -3
.venv/bin/python tools/contact_sheet.py assets/item --scale 8 --columns 3 -o build/item_sheet.png
git diff main --stat -- pixel-asset-forge/palette
```
Expected: `validate.py` 全件 ok。`check_colors.py` は既存の `knight` 1件の失敗のみ（ISSUES.md に記録済み）で、item の失敗なし。`palette` の差分は空。Read で `build/item_sheet.png` を見せる（chest・sword・bow を並べて輪郭の太さ・光源のずれを確かめる）。

- [ ] **Step 2: HANDOVER.md を更新する**

`HANDOVER.md` の先頭の「Current State」を、このブランチ（`feat/item-icons-sword-bow`、issue #23 の3番目）に書き換える。決めたこと（大きさ B・向き・手本の扱い・色は既存のみ・範囲）を短く書く。作業中に具体的な不都合を言えない気付きがあれば「Claude の気付き（具体的な不都合は未確認）」の欄に1行（日付・何を見て・なぜ気になったか）で足す。確認事項には混ぜない。

- [ ] **Step 3: Commit**

```
git add HANDOVER.md
git commit -m "docs: HANDOVER.md を issue #23 の3番目の時点に更新する"
```

- [ ] **Step 4: 報告して止まる**

`git log --oneline main..HEAD` と `git status -sb` を示す。**push と PR はしない。** 依頼者の指示を待つ。

---

## Self-Review（計画の作成時）

- **Spec coverage:** 大きさ B → Global Constraints と各案の幅。向き・手本の扱い → 骨格と Constraints。色は既存のみ → Global Constraints と Task 1・3 の map。範囲 → Constraints と「触らないもの」。作るもの（sword/bow/SPEC.md）→ Task 2・4・5。進め方 1〜5 → Task 1・3（見せて止まる）、Task 2・4（確定）、Task 5（SPEC）、Task 1〜5 の検査、「一旦進めましょう」→ Constraints。剣の規約を確かめる → 軸の検査（Review Focus 3）。
- **Placeholder:** グリッドの中身は創作なので計画には書かない。代わりに骨格・座標・案ごとの違い・合格条件（検査）を書いた。`<案>`・`<矢の範囲>` は実行時に決まる値で、決め方を本文に書いた。
- **Consistency:** `/tmp/item_check.py` の引数（`--axis X0 X1`）は Task 1〜4 で同じ。ファイル名 `sword.txt`・`bow.txt` は Task 2・4・5・6 で同じ。
