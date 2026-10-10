# ユニットの道具の整備（拳の輪郭の決まりを道具に入れ、層の道具を tools/ へ移す）Implementation Plan

> 中止（2026-10-10）: 部品を完全な形で描いて重ねるだけにする方針に変えたため、docs/superpowers/plans/2026-10-10-unit-parts-roran.md に置き換えた。Task 1 の途中まで実施（台帳 docs/superpowers/ledgers/2026-10-09-unit-tools-maintenance.md）。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「拳は四方とも黒で囲う」決まりと、層で組む作り方の道具をテスト付きで `pixel-asset-forge/tools/` に整え、あとの「全ユニットの層化」「最新の道具での再検証」がこの道具だけで進められるようにする。

**Architecture:** 手の輪郭の規則は `tools/hand_outline.py` の `close_hands` 1か所に持ち、`tools/weapon_check.py` の検査と層の合成（`layers.finish`）はそれを呼ぶ。層の汎用部分（`layers.py`・`cut_layers.py`・`table_page.py`・`layer_page.py`）は `cand/gen/` から `tools/` へ移す。ユニットごとの組み立て（`mklayers.py`・`roran_layers.py`）は、全ユニットの層化（次の計画）で形が決まるまで `cand/gen/` に置く。

**Tech Stack:** Python 3.14（`pixel-asset-forge/.venv`）、Pillow、unittest。

**Spec:** `docs/superpowers/specs/2026-10-09-unit-layer-parts-design.md`（層の設計）。拳の決まりは台帳 `.superpowers/sdd/2026-10-06-enemy-variants/progress.md` の「判断（2026-10-09 依頼者）」2行と、`pixel-asset-forge/ISSUES.md` の「拳を四方とも輪郭で囲う決まりに変える」の行。

## Global Constraints

- コマンドは `pixel-asset-forge/` で実行する。Python は `.venv/bin/python`。テストは `.venv/bin/python -m unittest discover -s tests`
- 拳（`--hand` の色の塊のうち HAND_MAX=12 画素以下）は、上下左右の隣が透明・服・髪・体のどれでも黒（`outline`）で囲う。袖口に接していても囲う（依頼者 2026-10-09）
- 握る武器の画素の上には拳の輪郭を描かない（柄が拳の上下で途切れる。依頼者が案1を選択、2026-10-09）
- 奥の拳（left の握る手）は影の色（依頼者 2026-10-09）
- **この計画では `cand/enemy-frames/`・`cand/enemy/`・`assets/unit/` の絵を作り直さない**。決まりを変えると作り直したときに絵が変わるが、それは次の次の計画（最新の道具での再検証）で依頼者に見せて承認を取る
- 層の数・層の名前を決め打ちしない
- push と PR は依頼者の指示があったときだけ
- コミットは Conventional Commits ＋ 日本語の要約。`git add` はファイルを指定する

## Review Focus

- 1px の袖口が拳の輪郭に置き換わり、腕が消えて拳が体から離れて見える（ガウの `left_atk_hit` が過去の例）→ Task 1 で `weapon_check` の「手が体から浮いている」が誤検出しないことをテストで確かめる
- 拳の輪郭が握る武器の柄を上書きして柄が途切れる → Task 1 のテスト
- 拳が画面の端（x=0・31、y=0・31）にあるとき、枠の外の隣を見て落ちない → Task 1 のテスト
- 武器の色名・コマ名を打ち間違えると黙って通る → Task 2 のテスト
- 移した道具が、移す前と同じ出力を出す（`--check` が `cand/layer-trial/` の3体で ok のまま）→ Task 3 の確認

---

### Task 1: 拳を常に黒で囲う（`hand_outline.py`・`weapon_check.py`）

**Files:**
- Modify: `pixel-asset-forge/tools/hand_outline.py`（`close_hands` と CLI。`--arm` を `--keep` に替える）
- Modify: `pixel-asset-forge/tools/weapon_check.py:304-310`（手の輪郭の検査。`close_hands` の新しい呼び方に合わせる）
- Modify: `pixel-asset-forge/cand/gen/layers.py`（`finish` の引数）、`pixel-asset-forge/cand/gen/mkweapons.py:343,347`（呼び出し。ただし**絵は作り直さない**）
- Test: `pixel-asset-forge/tests/test_hand_outline.py`、`pixel-asset-forge/tests/test_weapon_check.py`、`pixel-asset-forge/tests/test_layers.py`

**Interfaces:**
- Consumes: なし
- Produces:
  - `close_hands(frame, hand: set[str], keep: frozenset[str] | set[str] = frozenset()) -> (frame, changed: list[(x, y)])`。`hand` の小さい塊の上下左右の隣のうち、透明・`hand` 以外の色・`outline` 以外のものを `outline` にする。ただし `keep` の色の画素と、枠の外は触らない
  - `layers.finish(frame, labels, hand, keep=frozenset()) -> (frame, labels)`
  - CLI: `tools/hand_outline.py DIR --hand 色,色 [--keep 色,色] [--write]`

先に、ガウの `left_atk_hit` のような「1px の袖口」が実際にどう変わるかを見ておく。

- [ ] **Step 1: 今の絵で、新しい規則が変える所を数える**

作業用のスクリプトを `/tmp/claude-1000/-home-ubuntu-workspace/c35ca546-24bd-54be-82b5-b048943e1f35/scratchpad/count_changes.py` に書き、ガウ・ロラン・イネス・敵（`assets/unit/*`・`cand/enemy-frames/*`）の全コマに、新規則（隣の色が何であれ `outline` にする。`keep` は空）を当てて、コマごとの変わる画素数を出す。この数は Task 1 の結果としてコミットメッセージと台帳に書く（絵は直さない）。

Run: `.venv/bin/python <そのスクリプト>`
Expected: コマごとの画素数の一覧が出る。袖口が 1px の所（腕の画素が `outline` になる）の件数を別に数えて控える

- [ ] **Step 2: 失敗するテストを書く（`tests/test_hand_outline.py`）**

既存の `scene()`（体の右に接する手）に加えて次を足す。`HAND = {"skin_base", "skin_shadow"}`、`ARM = {"cloth_base"}` は既存のとおり。既存のテストのうち「1px の袖口は残す」を確かめているもの（`test_hand_outline.py:62` 付近）は、新しい決まりに合わせて**期待を書き換える**（残さず囲う）。

```python
    def test_sleeve_cuff_is_outlined_too(self):
        # 袖口（手の真上の服）も輪郭にする（依頼者 2026-10-09）
        f = scene()
        f[19][20] = "cloth_base"
        out, changed = close_hands(f, HAND)
        self.assertEqual(out[19][20], "outline")
        self.assertIn((20, 19), changed)

    def test_one_pixel_sleeve_becomes_outline(self):
        f = blank()
        f[17][11] = f[18][11] = "cloth_base"      # 横に伸びる 1px の袖
        f[17][12] = f[18][12] = "skin_base"       # 拳
        out, _ = close_hands(f, HAND)
        self.assertEqual(out[17][11], "outline")
        self.assertEqual(out[18][11], "outline")

    def test_keep_colours_are_not_overwritten(self):
        f = blank()
        for y in range(10, 20):
            f[y][15] = "wood_base"                # 縦の柄
        f[14][15] = f[15][15] = "skin_base"       # 柄の真ん中を握る拳
        out, _ = close_hands(f, HAND, keep={"wood_base"})
        self.assertEqual(out[13][15], "wood_base")
        self.assertEqual(out[16][15], "wood_base")

    def test_hand_at_frame_edge_does_not_crash(self):
        f = blank()
        f[0][0] = f[0][1] = "skin_base"
        f[31][31] = "skin_base"
        out, changed = close_hands(f, HAND)
        self.assertEqual(out[1][0], "outline")
        self.assertIn((2, 0), changed)

    def test_already_outlined_hand_is_left_alone(self):
        f = blank()
        f[10][10] = "skin_base"
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            f[10 + dy][10 + dx] = "outline"
        out, changed = close_hands(f, HAND)
        self.assertEqual(changed, [])
```

- [ ] **Step 3: テストが落ちることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_hand_outline -v`
Expected: FAIL（`close_hands() got an unexpected keyword 'keep'` など）

- [ ] **Step 4: `close_hands` を新しい決まりに書き換える**

`tools/hand_outline.py` の `close_hands` を次にする。`arm` は使わない。`beyond`（先が服か）の判定と、docstring の「上下で接するのは袖口なのでよい…残す」の説明を消し、新しい決まり（拳は四方とも囲う、握る武器の上には描かない）に書き換える。

```python
def close_hands(frame, hand: set[str], keep=frozenset()) -> tuple[list[list[str | None]], list[Point]]:
    """(直したコマ, 輪郭にした画素)。入力は変えない。keep の色（握る武器）の上には描かない。"""
    h, w = len(frame), len(frame[0])
    skin = {(x, y) for y in range(h) for x in range(w) if frame[y][x] in hand}
    out = [row[:] for row in frame]
    changed: list[Point] = []
    for comp in _components(skin):
        if len(comp) > HAND_MAX:
            continue
        for x, y in sorted(comp, key=lambda p: (p[1], p[0])):
            for dx, dy in N4:
                qx, qy = x + dx, y + dy
                if not (0 <= qx < w and 0 <= qy < h):
                    continue
                name = out[qy][qx]
                if name in hand or name == "outline" or name in keep or (qx, qy) in changed:
                    continue
                out[qy][qx] = "outline"
                changed.append((qx, qy))
    return out, changed
```

CLI は `--arm` を `--keep`（任意）に替え、`fix_file(path, hand, keep, write)` に合わせる。モジュールの docstring の例も直す。

- [ ] **Step 5: テストが通ることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_hand_outline -v`
Expected: PASS

- [ ] **Step 6: `weapon_check` の検査を合わせる（テスト → 実装）**

`tests/test_weapon_check.py` に、(a) 袖口に接する拳が「手の輪郭が閉じていない」で落ちる、(b) 輪郭で囲ってある拳は通る、(c) **1px の袖が輪郭に置き換わって腕が消えても「手が体から浮いている」で誤検出しない**（拳→輪郭→体の並び。`floating()` が `outline` を挟んだ体への接続を腕とみなすか確かめ、みなさないなら `floating` を直す）、(d) 握る武器（`--weapon` の柄の色）の上には輪郭を求めない、を足す。(c) が落ちるなら `weapon_check.py` の `floating` を直してから進む。

`weapon_check.py:307` を `close_hands(frame, a.hand_colours, weapon_colours)` にする（`weapon_colours` は `--weapon` で渡された柄・刃の色。コードの実際の変数名を確かめて使う）。検査の条件 `if arm:` は、`arm` が手の輪郭の検査に要らなくなるので外す（`arm` は `floating` のために残る）。

Run: `.venv/bin/python -m unittest tests.test_weapon_check -v`
Expected: PASS

- [ ] **Step 7: 呼び出し側を合わせ、全体を通す**

`cand/gen/layers.py` の `finish` を `finish(frame, labels, hand, keep=frozenset())` にし、`tests/test_layers.py` の呼び出しを直す。`cand/gen/mklayers.py`・`roran_layers.py`・`cand/gen/mkweapons.py:343,347` の呼び出しは `grep -rn "close_hands\|finish(" pixel-asset-forge` で洗い出し、`keep` に握る武器の色を渡す形に直す（`ARM` は `weapon_check` の `--arm`（`floating` 用）にだけ使う）。**`mkweapons.py` は実行しない**（絵が変わる）。

Run: `.venv/bin/python -m unittest discover -s tests 2>&1 | tail -5`
Expected: OK（全体）

- [ ] **Step 8: 見え方を依頼者に見せるページを作る**

Step 1 の数と、袖口が囲われて変わるコマの例（ガウ `left_atk_hit` ほか、変わる前と後を印なしの絵と並べる）を `build/hand_rule_preview.html` に出す（`build/` は git 管理外）。依頼者に見せる。**承認までコミットしない。** 袖が消えて拳が浮いて見えるなどの問題を指摘されたら、台帳に書いて規則を相談する。

- [ ] **Step 9: Commit（承認後）**

```bash
git add pixel-asset-forge/tools/hand_outline.py pixel-asset-forge/tools/weapon_check.py pixel-asset-forge/cand/gen/layers.py pixel-asset-forge/cand/gen/mkweapons.py pixel-asset-forge/cand/gen/mklayers.py pixel-asset-forge/cand/gen/roran_layers.py pixel-asset-forge/tests/test_hand_outline.py pixel-asset-forge/tests/test_weapon_check.py pixel-asset-forge/tests/test_layers.py
git commit -m "feat: 拳を四方とも黒で囲う決まりを hand_outline と weapon_check に入れる"
```

---

### Task 2: `weapon_check` の取りこぼしを直す（奥の拳・色名・コマ名）

**Files:**
- Modify: `pixel-asset-forge/tools/weapon_check.py`
- Test: `pixel-asset-forge/tests/test_weapon_check.py`
- Modify: `pixel-asset-forge/ISSUES.md`（直した行を消す）

**Interfaces:**
- Consumes: Task 1 の `close_hands`
- Produces: `weapon_check` が、(1) 明るい奥の拳を `--far-shade` で拾う、(2) 未知の色名・コマ名で `WeaponCheckError` を出す

- [ ] **Step 1: 明るい奥の拳が拾われない原因を再現する**

`axe-horn` の `left_atk_wind`（`cand/enemy-frames/axe-horn/`）に、SPEC の斧の指定（`types/unit/SPEC.md:231` の `--far left --far-shade skin_rose_shadow ... --partial ...left_atk_wind`）で `weapon_check` を実行して「ok」になることを確かめ、`--partial` を外すと落ちるか、`--far-shade` の判定が立ち・待機2・歩きだけを見ているかを、`weapon_check.py` の `--far-shade` の処理（`grep -n far_shade tools/weapon_check.py`）を読んで特定する。結果を ISSUES.md の該当行に1行で書く。

- [ ] **Step 2: 失敗するテストを書く**

原因に合わせ、「振りかぶりで奥の拳が明るい肌色のコマが `--far-shade` で落ちる」を `tests/test_weapon_check.py` に足す（小さい合成コマを作る既存の `put()` のやり方に合わせる）。

Run: `.venv/bin/python -m unittest tests.test_weapon_check -v`
Expected: 新しいテストだけ FAIL

- [ ] **Step 3: 直す**

原因の箇所を直す。男性・女性の承認済みの絵は直さないので、**今の `cand/enemy-frames/` に掛けると、明るい奥の拳の振りかぶりが落ちる**はず（これは正しい。次の次の計画で直す）。落ちるコマの一覧を台帳に書く。

- [ ] **Step 4: 色名・コマ名の検査（テスト → 実装）**

`--weapon`・`--hand`・`--arm`・`--cover`・`--far-shade` の色名が `load_palette()` に無ければ、`--hidden`・`--partial` のコマ名がディレクトリに無ければ、`WeaponCheckError("…が無い: <名前>")` で止まる。テストは、打ち間違えた色名とコマ名のそれぞれが `main()` の戻り値 2 とエラー表示になることを確かめる。

Run: `.venv/bin/python -m unittest discover -s tests 2>&1 | tail -5`
Expected: OK

- [ ] **Step 5: ISSUES.md の2行（`--far-shade` が拾わない／色名とコマ名を検査しない）を消し、Commit**

```bash
git add pixel-asset-forge/tools/weapon_check.py pixel-asset-forge/tests/test_weapon_check.py pixel-asset-forge/ISSUES.md
git commit -m "fix: weapon_check が明るい奥の拳と打ち間違えた色名・コマ名を見逃さないようにする"
```

---

### Task 3: 層の道具を `tools/` へ移す

**Files:**
- Move: `cand/gen/layers.py` → `tools/layers.py`、`cand/gen/cut_layers.py` → `tools/cut_layers.py`、`cand/gen/table_page.py` → `tools/table_page.py`、`cand/gen/layer_page.py` → `tools/layer_page.py`（`git mv`）
- Modify: `cand/gen/mklayers.py`・`cand/gen/roran_layers.py` の import、`tests/test_layers.py`・`test_cut_layers.py`・`test_table_page.py`・`test_layer_page.py` の import、`README.md`・`types/unit/SPEC.md` のパス
- Not moved: `cand/gen/mklayers.py`・`roran_layers.py`（ユニットごとの組み立て。全ユニットの層化の計画で形を決める）

**Interfaces:**
- Consumes: Task 1 の `finish(frame, labels, hand, keep)`
- Produces: `tools/layers.py` ほかが、`cand/gen/` を経由せず import できる

- [ ] **Step 1: 移す前の出力を控える**

Run: `.venv/bin/python cand/gen/mklayers.py --check` と、`cand/gen/roran_layers.py` の確認コマンド（ファイル先頭の使い方を読む）。結果（3体 ok）と全体テストの件数を控える。

- [ ] **Step 2: `git mv` と import の修正**

テストの `sys.path.insert` を `tools` だけにし、`cand/gen/` の2本は `sys.path` に `tools` を足す。`grep -rn "layers\|cut_layers\|table_page\|layer_page" pixel-asset-forge --include=*.py --include=*.md` で参照を洗い出して全部直す（`docs/superpowers/` のログと台帳は直さない）。

- [ ] **Step 3: 同じ出力を確かめる**

Run: `.venv/bin/python -m unittest discover -s tests 2>&1 | tail -5` と Step 1 の確認コマンド
Expected: テストの件数が Step 1 と同じで OK、`--check` が3体 ok。`build/` のページを作り直して Step 1 と同じに見える

- [ ] **Step 4: Commit**

```bash
git add -A pixel-asset-forge/tools pixel-asset-forge/cand/gen pixel-asset-forge/tests pixel-asset-forge/README.md pixel-asset-forge/types/unit/SPEC.md
git status --short   # 意図したファイルだけか確かめてから commit
git commit -m "refactor: 層の道具（layers・cut_layers・table_page・layer_page）を tools/ へ移す"
```

---

### Task 4: 先送りした minor 4件

**Files:**
- Modify: `tools/layers.py`（`attach`）、`cand/gen/mklayers.py`（`build_layers`・`--check`）、`cand/gen/mklayers.py` の芯（手前の手）
- Test: `tests/test_layers.py`、`tests/test_mklayers.py`

台帳 188〜191 行の4件を、それぞれ次のとおり扱う。各件で テスト → 実装 → 全体テスト OK → 1件ずつ commit。

- [ ] **Step 1: `attach` が持つ側の大きさ・取り付け点の枠内を確かめる**

テスト: 持つ側が 32x32 でない／取り付け点が枠外のとき `LayerError`。付ける側だけ・持つ側だけ取り付け点が無いときの `LayerError`（2通り）。`attach` は `_check_size` を両方に呼び、取り付け点が `0 <= x,y < SIZE` を外れたら止める。
Run: `.venv/bin/python -m unittest tests.test_layers -v` → FAIL → 実装 → PASS
Commit: `fix: attach が層の大きさと取り付け点の範囲を確かめる`

- [ ] **Step 2: `--check` が `noweapon/` と `labels.json` も確かめる**

テスト（`tests/test_mklayers.py`）: 書き出した `noweapon/` のコマや `labels.json` を1画素変えると `--check` が落ちる。実装は、`--check` が今コマにしている「表の順で合成し直して比べる」を `noweapon/` と `labels.json` にも掛ける。
Commit: `fix: mklayers --check が noweapon と labels.json も確かめる`

- [ ] **Step 3: `build_layers` が `mf.mp.bodies["left"]` を書き換えない**

テスト: `build_layers` を2回呼んで同じ結果になり、呼んだ後も `mf.mp.bodies["left"]` が呼ぶ前と同じ。実装は、書き換えず複製に対して作業する（または `tatter` に `sex` を渡す）。
Commit: `fix: build_layers が素体の部品を書き換えないようにする`

- [ ] **Step 4: 芯から手前の手を消す（設計 3.2 のとおり）**

テスト: 合成したコマから「手前の腕・拳」の層を外すと、手前の手の画素が消える（芯に手が残っていない）。実装は、`mklayers` で芯を作るとき手前の手の画素を除く。**これは絵が変わりうるので、`--check` と今の絵との差が 0 のままか確かめ、変わるなら依頼者に見せてから commit する。**
Commit: `fix: 芯から手前の手を除き、層を外すと手が消えるようにする`

---

### Task 5: 台帳と ISSUES.md・README・SPEC の更新

**Files:**
- Modify: `.superpowers/sdd/2026-10-06-enemy-variants/progress.md`（末尾に追記。経過のログなので過去の行は直さない）
- Modify: `pixel-asset-forge/ISSUES.md`（「拳を四方とも輪郭で囲う決まりに変える」の行を、道具は済み・絵は未と書き換える）、`README.md`・`types/unit/SPEC.md`（拳の決まりと `hand_outline.py --keep`、層の道具の場所）

- [ ] **Step 1: 更新する**

SPEC の「1px の袖口は残す」と `hand_outline.py` の `--arm` の説明を、新しい決まり（拳は常に囲う、握る武器の上には描かない、奥の拳は影の色）に替える。台帳には、Task 1〜4 の結果（変わる画素の数、直した検査、落ちるようになったコマの一覧）を書く。

- [ ] **Step 2: 全体テスト → Commit**

Run: `.venv/bin/python -m unittest discover -s tests 2>&1 | tail -5` → OK

```bash
git add pixel-asset-forge/ISSUES.md pixel-asset-forge/README.md pixel-asset-forge/types/unit/SPEC.md .superpowers/sdd/2026-10-06-enemy-variants/progress.md
git commit -m "docs: 拳の輪郭の決まりと層の道具の場所を SPEC・README・台帳に反映する"
```

---

## Self-Review

- 手順 1 の項目: 拳の決まり→Task 1、奥の拳が明るい件→Task 2、道具の移設→Task 3、minor 4件→Task 4、文書→Task 5。SPEC の「描く手順」への方針の反映（旧 4）は手順 3 の後にするので入れていない（Task 5 は拳の決まりとパスだけ）
- 決まりを変えても絵を作り直さないので、`mkweapons.py` は実行しない。落ちるようになる `weapon_check` の一覧は Task 2 Step 3 で台帳に残し、手順 3（再検証）の入力にする
- 型の整合: `close_hands(frame, hand, keep)` と `finish(frame, labels, hand, keep)` を Task 1・3 で同じ名前で使う
