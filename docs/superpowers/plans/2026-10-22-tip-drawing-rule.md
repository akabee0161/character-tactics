# 尖った先端の描き方と確かめ方 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 刃・鏃の先端の決まり1〜5を判定する道具を作って `tip_check.py` の判定を置き換え、今ある絵にかけて落ちた絵を依頼者と1件ずつ片付け、採った絵の直しと正典の更新までを行う。

**Architecture:** 判定の本体を純粋な関数 `tools/tip_rule.py` の `find_tips()` に置く（1枚のグリッドの行と、刃・輪郭の文字を受け取る）。`tools/tip_check.py` はユニットの部品（`checks/<ユニット>.json`）と item のアイコン（新しい `checks/items.json`）をこの関数にかける入口になる。刃は色でなく文字で見分ける。

**Tech Stack:** Python 3.14（`pixel-asset-forge/.venv`）、標準ライブラリの unittest。作業は `pixel-asset-forge/` で行う（コマンドはすべて `pixel-asset-forge/` から）。

**Spec:** `docs/superpowers/specs/2026-10-22-tip-drawing-rule-design.md`

## Global Constraints

- 刃・鏃は**色でなく文字**で見分ける（ユニットは `checks/<ユニット>.json` の `parts.<部品>.blade`、アイコンは `checks/items.json`）
- 部品ごとの形で見る（組んだコマでは見ない）。刃の文字でない先端（弓の端・鍔・弦・足先）は見ない
- 中身5画素以上・45°以外の斜め・根元の無いまとまりは落とさず「対象外」として出す
- 例外（`exceptions`）は作らない。落ちた絵は「絵を直す」か「判定を直す」かを依頼者が1件ずつ決める
- 絵を変えたら、直す前と後を並べた Artifact のページを見せ、依頼者の承認を得てからコミットする
- テストは現役のアセットを読まない（`tests/test_no_live_assets.py`）。グリッドはテストの中に書くか `tests/fixtures/` に置く
- `tools/` を触ったら `.venv/bin/python -m unittest discover -s tests` を通す（着手時 585 件）
- コミットは Conventional Commits ＋日本語の要約。push・PR は依頼者の指示があったときだけ

## Review Focus

- 刃の先がグリッドの端（y=0 など）に接する形: グリッドの外は背景とみなし、黒の蓋が無ければ決まり3で落ちる（攻撃コマの切っ先は y=0 まで出てよいが、そのときも蓋の黒が要る）→ Task 1 のテスト `test_tip_at_the_grid_edge_needs_a_cap`
- 1つの部品に刃のまとまりが2つ以上ある形（例: 刃が手前の部品で切れていない限り無いが、部品のファイルに2本描かれた場合）: まとまりごとに判定する → Task 1 `test_each_blade_cluster_is_judged`
- 下・左・右を向いた刃（ロランの down の攻撃は刃が下向き）: 向きに合わせて回して判定し、出す位置は元の座標 → Task 1 `test_rotated_tips_are_judged_in_their_direction`
- 刃の文字の画素が部品に1つも無い（剣が体に隠れるコマの空の部品）: 何も出さず合格 → Task 2 `test_an_empty_blade_part_passes`
- 同じ部品のファイルが複数のコマで使われる: 1回だけ判定する（今の `tip_check.py` と同じ）→ Task 2 の既存の重複の扱いを保つ

---

### Task 1: 決まり1〜5の判定 `tools/tip_rule.py`

**Files:**
- Create: `pixel-asset-forge/tools/tip_rule.py`
- Test: `pixel-asset-forge/tests/test_tip_rule.py`

**Interfaces:**
- Produces:

```python
@dataclass(frozen=True)
class Tip:
    point: tuple[int, int]      # 刃の色の一番先の画素（元のグリッドの座標）。縦横は行 T の刃の色の左端、斜めは (X, Y)
    direction: str              # "up" "down" "left" "right" "up_right" "up_left" "down_right" "down_left"
    width: int                  # 中身の幅（向きをそろえた後の、刃の色の一番広い横の1行の画素数）
    problems: tuple[str, ...]   # 破った決まり。各要素は "決まり1: …" の形（対称は "対称: …"）。空なら合格
    skipped: str | None = None  # 対象外の理由。None なら判定した

def find_tips(rows: list[str], blade: frozenset[str], outline: frozenset[str],
              background: str = ".") -> list[Tip]
```

- [ ] **Step 1: テストを書く**

テストの中で使う小さな関数（テストのファイルに置く）:

```python
def vertical(top: list[str], n: int, body: int = 4) -> list[str]:
    """上向きの縦の刃。top は先端の行（外形の幅 n+2 で中央そろえ）、その下に体の幅の行を body 行、根元に柄 h。"""
def diagonal(n: int, p: int, fill: bool = True) -> list[str]:
    """右上向き45°の刃（16x16）。設計の決まり5の形: 刃の色を縦の線 x<=13 と横の線 y>=2 で切り、
    上下左右に輪郭 o を回し、fill なら角 (14,1) も o。行 y の刃の色は x = 13-p+2-y+k（k=0..n-1, x<=13）。
    刃の色の一番下の行の左下に柄 h を1画素置く（根元）。"""
def rotate(rows, turns: int) -> list[str]   # 時計回りに 90°×turns
def mirror(rows) -> list[str]               # 左右反転
```

刃の文字は `ijk`、輪郭は `o`、柄 `h`。テスト（`tests/test_tip_rule.py`、`class TipRuleTest(unittest.TestCase)`）:

- `test_approved_vertical_shapes_pass`: 次の6つ（設計の例。上が先端）が、それぞれ Tip 1つ・`problems == ()`・`skipped is None`・`direction == "up"`・`width == n`

  ```
  n=1 [".o."]              n=2 [".oo."]
  n=3 ["..o..", ".ojo."]   n=3 [".ooo.", "oojoo"]
  n=4 ["..oo..", ".oijo."] n=4 [".oooo.", "ooijoo"]
  ```
  （体の行は n=1 `ojo`、n=2 `oijo`、n=3 `oijko`、n=4 `oijjko`）
- `test_rejected_vertical_shapes_fail_with_their_rule`（n=3、体 `oijko`）: 各形の `problems` に、その決まりの見出しで始まる要素がある
  - `[".ooo."]`（中身3の「案」）→ `"決まり2"`
  - `[".ooo.", ".ojo."]`（B2）→ `"決まり1"`
  - `["..o..", ".ooo.", ".ojo."]`（B2'）→ `"決まり3"`
  - `["..o..", ".ooo.", "oojoo"]`（B3'）→ `"決まり3"`
  - `["..o..", ".ojo.", "oojoo"]`（刃の色が細いまま続く）→ `"決まり4"`
  - `[".ooo.", "ojooo"]`（片側に寄った形）→ `"対称"`
- `test_rotated_tips_are_judged_in_their_direction`: n=3 `["..o..", ".ojo."]` を `rotate` で 1・2・3 回回すと、`direction` がそれぞれ `"right"`・`"down"`・`"left"`、`problems == ()`。`point` は回した後のグリッドでの刃の色の一番先の画素
- `test_approved_diagonal_shapes_pass`: `diagonal(n, p)` の (1,0)・(2,0)・(2,1)・(3,0)・(3,1)・(3,2)・(4,1)・(4,2) が合格・`direction == "up_right"`・`width == n`。`mirror(diagonal(1, 0))`（イネスの背面の矢と同じ向き）は `"up_left"` で合格
- `test_diagonal_without_the_corner_fails_rule5`: `diagonal(3, 1, fill=False)`（今の剣のアイコンの先端）→ `"決まり5"`
- `test_old_sword_icon_fails_rule5`: A（`0d3fd29` の前のアイコンの剣）の上の5行を写したグリッド（下に柄 h を足す）→ `"決まり5"`

  ```
  ................
  .............o..
  ...........ooio.
  ..........oijo..
  .........oijko..
  ```
- `test_wide_blades_are_skipped`: n=5（体 `oijjjko`、先端 `["..o..".center(7,"."), ...]` のどれでもよい）→ `skipped` が `"中身5画素"` を含み、`problems == ()`
- `test_a_cluster_without_a_root_is_skipped`: 柄 h の無い n=3 の刃 → `skipped` が `"根元"` を含む
- `test_the_root_end_is_not_judged`: 柄の側の端は先端として出さない（`vertical` の刃で Tip は1つだけ）
- `test_each_blade_cluster_is_judged`: 1枚に n=1 の合格の刃と B2 の刃を離して置く → Tip 2つ、片方だけ `"決まり1"`
- `test_tip_at_the_grid_edge_needs_a_cap`: n=2 の刃の刃の色が y=0 に届く（蓋が無い）→ `"決まり3"`。蓋の黒が y=0 にあり刃の色が y=1 からなら合格（グリッドの外は背景）
- `test_non_blade_characters_are_ignored`: 柄や輪郭だけの1画素の突起（例 `.o.`/`oho`）は Tip を出さない

- [ ] **Step 2: テストが落ちるのを確かめる**

Run: `.venv/bin/python -m unittest tests.test_tip_rule -v`
Expected: FAIL（`ModuleNotFoundError: No module named 'tip_rule'`）

- [ ] **Step 3: `find_tips()` を書く**

判定の手順（設計が作る人に任せた部分。この形で作る）:

1. 刃の文字の画素を8近傍でまとまりに分ける
2. 根元 = まとまりの画素のうち、8近傍に「刃の文字でも輪郭でも背景でもない」画素があるもの。無ければ `skipped="根元が無い"`
3. 向き = 根元の画素の重心から、まとまりの中で根元の重心から最も遠い画素への向きを8方位に丸める。最寄りの方位から 10° を超えてずれたら `skipped="45°以外の斜め"`
4. 向きが上（縦・横）か右上（斜め）になるようにグリッドを回す・反転する（グリッドの外は背景）。判定した位置は元の座標に戻す
5. `width` = 回した後のまとまりの、横の1行に並ぶ刃の色の最大数。5 以上なら `skipped="中身5画素以上"`
6. 上向き（縦）の判定。刃の色の一番上の行を T とし、T−1（蓋）から下へ、外形の幅が n+2 になり刃の色の幅が n になる行まで見る:
   - 決まり3: 行 T の刃の色の真上がすべて輪郭、そのさらに上がすべて背景。蓋の行に刃の色が無い
   - 決まり2: 行 T の刃の色の幅が、n が奇数なら 1、偶数なら 2
   - 決まり1: 外形（刃の色と、その行で刃の色に続く輪郭の並び。蓋の行は輪郭の並び）の左端・右端が、蓋の行から1行下るごとに 1 ずつ外へ広がる。幅 n+2 に届いた後は広がらない。蓋の行の外形の幅は n 以下（既定のユニットの `ooo` の蓋＝中身1で幅3 は落ちる）
   - 決まり4: 行 T より下で外形の幅が n+2 の行は、刃の色の幅が上の行より 2 広い（刃の色が n に届くまで）
   - 対称: どの行も、外形と刃の色の中心が同じ列にそろう
7. 右上向き（斜め）の判定（決まり5）。X = 刃の色の最大の x、Y = 最小の y:
   - 行 Y の刃の色は右端が X の1続き、列 X の刃の色は上端が Y の1続き
   - 行 Y の刃の色の真上は輪郭、その上は背景。列 X の刃の色の右は輪郭、その右は背景
   - 角 (X+1, Y−1) は輪郭で、(X+2, Y−1)・(X+1, Y−2)・(X+2, Y−2) は背景
   - 刃の色の幅が一定でない三角形の鏃（弓）も、この手順だけで見る（本体の幅は使わない）

- [ ] **Step 4: テストが通るのを確かめる**

Run: `.venv/bin/python -m unittest tests.test_tip_rule -v`
Expected: すべて OK

- [ ] **Step 5: コミット**

```bash
git add tools/tip_rule.py tests/test_tip_rule.py
git commit -m "feat: 刃・鏃の先端の決まり1〜5を判定する tip_rule.py を足す"
```

---

### Task 2: `tip_check.py` をユニットの部品で決まりの判定に置き換える

**Files:**
- Modify: `pixel-asset-forge/tools/tip_check.py`（`check()`・docstring）
- Modify: `pixel-asset-forge/tools/unit_config.py`（`run_check` に `notes` を足す）
- Modify: `pixel-asset-forge/tests/unit_fixture.py`（既定の剣の先端を決まりに合う形にする）
- Test: `pixel-asset-forge/tests/test_tip_check.py`（書き直す）

**Interfaces:**
- Consumes: `find_tips(rows, blade, outline) -> list[Tip]`（Task 1）
- Produces:
  - `run_check(argv, description, check, ok_message, notes=None) -> int` — `notes(cfg) -> list[tuple[str, str]]` を渡すと、FAIL の前に `NOTE 名前: 文言` を1行ずつ出す（終了コードは変えない）
  - `tip_check.check(cfg) -> list[tuple[str, str]]`、`tip_check.skipped(cfg) -> list[tuple[str, str]]`
  - FAIL の文言: `"{部品の役割} の先端 {direction} ({x},{y}): {problems を '; ' でつないだもの}"`、名前は部品のファイル名（拡張子なし）
  - NOTE の文言: `"{部品の役割} の先端 ({x},{y}) は対象外: {skipped}"`

- [ ] **Step 1: 既定のユニットを決まりに合わせる**

`tests/unit_fixture.py` の `sword()` は箱の角 (21,5+dy)・(23,5+dy) も輪郭なので、中身1の先端が `ooo`（決まり1に反する）。この2画素を背景（`"."` にせず、辞書から外す）にする。

Run: `.venv/bin/python -m unittest discover -s tests`
Expected: 585 件 OK（ほかの道具のテストが角の有無に依存していないこと。落ちたら、その道具のテストが何を見ているかを読んで報告する。角を戻して通すことはしない）

- [ ] **Step 2: テストを書き直す**

`tests/test_tip_check.py`（`UnitFixture` を使う）:

- `test_the_default_unit_passes`: 終了 0、出力に `"先端: ok"`
- `test_a_blade_tip_that_breaks_a_rule_fails`: down_base の剣の蓋を3画素（(21,5)・(22,5)・(23,5) を `o`）にする → 終了 1、`"FAIL sword_down_base: sword の先端 up (22,6): 決まり1"` を含む
- `test_other_parts_are_not_judged`: 盾に輪郭に囲まれた1画素を足しても終了 0
- `test_a_blade_hidden_by_a_nearer_part_is_still_judged`: 決まりに反する剣の先を手前の盾の画素で隠しても終了 1（部品ごとの形で見る）
- `test_an_empty_blade_part_passes`: down_atk_hit の剣を空の部品（刃の文字が無い）にしても終了 0
- `test_skipped_tips_are_noted_but_pass`: 剣の刃を中身5画素にする → 終了 0、出力に `"NOTE sword_down_base: sword の先端"` と `"対象外"`

- [ ] **Step 3: テストが落ちるのを確かめる**

Run: `.venv/bin/python -m unittest tests.test_tip_check -v`
Expected: FAIL（文言が古い）

- [ ] **Step 4: `check()`・`skipped()` を `find_tips()` で書き直し、`run_check` に `notes` を足す**

`outline` は部品のグリッドの `charmap` で `outline` に当たる文字。同じ部品のファイルは1回だけ見る（今の `seen` を保つ）。`main()` は `run_check(argv, __doc__, check, "先端: ok", notes=skipped)`。docstring を決まり1〜5と設計書への参照に書き換え、「輪郭に囲まれた1画素」の説明を消す。

- [ ] **Step 5: テストを通す**

Run: `.venv/bin/python -m unittest discover -s tests`
Expected: すべて OK

- [ ] **Step 6: コミット**

```bash
git add tools/tip_check.py tools/unit_config.py tests/unit_fixture.py tests/test_tip_check.py
git commit -m "feat: tip_check.py の判定を先端の決まり1〜5に置き換える"
```

---

### Task 3: item のアイコンを文字で判定にかける

**Files:**
- Create: `pixel-asset-forge/checks/items.json`
- Modify: `pixel-asset-forge/tools/tip_check.py`（`--items` を足す）
- Modify: `pixel-asset-forge/assets/item/bow.txt`（鏃の文字だけ付け替える）
- Create: `pixel-asset-forge/tests/fixtures/tip_item_ok.txt`・`tip_item_no_corner.txt`
- Test: `pixel-asset-forge/tests/test_tip_check.py`（item のテストを足す）

**Interfaces:**
- Consumes: `find_tips()`（Task 1）、`skipped`／NOTE の形（Task 2）
- Produces: `.venv/bin/python tools/tip_check.py --items checks/items.json`。`checks/items.json` の形:

```json
{"items": {"assets/item/sword.txt": {"blade": "ijk"}, "assets/item/bow.txt": {"blade": "abc"}}}
```
  パスはリポジトリの直下（`--root`）から。知らないキー・無いファイル・ファイルに無い文字は終了 2（`error:` を stderr）。FAIL・NOTE の名前はファイル名（拡張子なし）、文言はユニットと同じ形で役割の代わりに `刃`

- [ ] **Step 1: 弓のアイコンの鏃に専用の文字を割り当てる**

`assets/item/bow.txt` に `# map: a=stone_hi b=stone_base c=stone_shadow` を足し、鏃の6画素だけ文字を替える: (11,2) `i→a`・(12,2) `i→a`・(13,2) `j→b`・(12,3) `j→b`・(13,3) `k→c`・(13,4) `k→c`。弦の `j`（(3,3)〜(12,12)）は替えない。

Run: `.venv/bin/python tools/render.py assets/item/bow.txt` の前後で `build/item/bow.png` を比べる（`cmp` で同一）、`.venv/bin/python tools/validate.py`、`.venv/bin/python tools/check_colors.py`、`.venv/bin/python tools/item_check.py`
Expected: PNG は1バイトも変わらない、ほかは今と同じ結果

- [ ] **Step 2: テストを書く**

fixtures の2枚は 16x16 の item（`# type: item`）。`tip_item_ok.txt` は剣のアイコンの案＋1段の形（設計書の「直す絵」の上4行＋今の剣の5行目から下）、`tip_item_no_corner.txt` は今の剣のアイコンと同じ形。テストは一時フォルダに items.json を書き、`--root` を一時フォルダにする:

- `test_items_that_follow_the_rule_pass`: ok の1枚 → 終了 0、`"先端: ok"`
- `test_an_item_without_the_corner_fails`: no_corner → 終了 1、`"FAIL tip_item_no_corner: 刃 の先端 up_right (13,2): 決まり5"` を含む
- `test_characters_not_listed_as_blade_are_ignored`: no_corner の刃の文字を items.json に書かず、別の文字（例 `"h"`）だけを書く → 終了 0
- `test_an_unknown_character_is_a_config_error`: `blade` にファイルに無い文字 → 終了 2

- [ ] **Step 3: 落ちるのを確かめる → `--items` を書く → 通るのを確かめる**

Run: `.venv/bin/python -m unittest tests.test_tip_check -v` → FAIL、実装後 OK。続けて `.venv/bin/python -m unittest discover -s tests` → すべて OK

- [ ] **Step 4: コミット**

```bash
git add checks/items.json tools/tip_check.py assets/item/bow.txt tests/fixtures/tip_item_ok.txt tests/fixtures/tip_item_no_corner.txt tests/test_tip_check.py
git commit -m "feat: tip_check.py に item のアイコンを文字で判定する --items を足し、弓の鏃に専用の文字を割り当てる"
```

---

### Task 4: 今ある絵の全部にかけて数え、依頼者と1件ずつ決める（★止まる）

**Files:**
- 書き出しは `/tmp` に新しいフォルダを作って置く（git に入れない）。台帳 `.superpowers/sdd/2026-10-22-tip-drawing-rule/progress.md` に結果と判断を書く

- [ ] **Step 1: 数える**

Run:
```bash
for u in roran ines gau; do .venv/bin/python tools/tip_check.py checks/$u.json; done
.venv/bin/python tools/tip_check.py --items checks/items.json
```
FAIL と NOTE を部品ごとに数えて台帳に書く。見込み（設計書）: 弓のアイコンの鏃、ガウの短剣、ロランの横向きの攻撃の剣、イネスの背面の攻撃の矢2枚、剣のアイコン

- [ ] **Step 2: 一覧のページを出す**

落ちた部品と対象外の部品を、部品の絵（8倍、印なし）と、先端の画素に赤い枠を付けた絵を対にして並べ、破った決まりを添えた HTML を作り、Artifact で公開する。最初の1行で「どれを見ればよいか」を書く。

- [ ] **Step 3: 止まって、依頼者に1件ずつ「絵を直す」か「判定を直す」かを聞く**

設計書で依頼者が既に採った直し（剣のアイコン・イネスの背面の矢2枚）は聞かない（Task 5 で直す）。それ以外を1件ずつ聞き、答えを台帳に書く。「判定を直す」になったら Task 1 の判定とテストを直すタスクを、「絵を直す」になったら Task 5 と同じ手順のタスクを、この計画の Task 5 の後に足してから進む。

---

### Task 5: 採った形に絵を直す（剣のアイコン・イネスの背面の矢）

**Files:**
- Modify: `pixel-asset-forge/assets/item/sword.txt`（(14,1) を `o`）
- Modify: `pixel-asset-forge/assets/part/equip/arrow/arrow_up_atk_wind.txt`（(9,13) `t`、(8,13)・(9,12)・(8,12) `o`）
- Modify: `pixel-asset-forge/assets/part/equip/arrow/arrow_up_atk_draw.txt`（(9,14) `t`、(8,14)・(9,13)・(8,13) `o`）
- 組み直し: `pixel-asset-forge/assets/unit/ines/up_atk_wind.txt`・`up_atk_draw.txt`、書き出し: `assets/images/`（ゲーム側）

- [ ] **Step 1: 部品とアイコンを直す**（上の画素どおり）

- [ ] **Step 2: 組み直して確かめる**

Run:
```bash
.venv/bin/python tools/compose.py compose/ines.json --force
.venv/bin/python tools/compose.py compose/ines.json --check
.venv/bin/python tools/tip_check.py checks/ines.json
.venv/bin/python tools/tip_check.py --items checks/items.json
.venv/bin/python tools/unit_rules.py checks/ines.json
.venv/bin/python tools/validate.py
```
Expected: `--check` で全32コマが部品から再現できる、ines の tip_check は `先端: ok`、`--items` で剣は落ちない（弓は Task 4 の判断しだい）、`unit_rules.py checks/ines.json` は終了 0（今は tip_check で終了 1）

- [ ] **Step 3: 直す前と後を並べたページを出し、承認を得る（★止まる）**

剣のアイコン（前・後）、矢の部品2枚（前・後）、組んだ up_atk_wind・up_atk_draw（前・後）を並べた HTML を Artifact で公開する。依頼者の承認が出るまでコミットしない。

- [ ] **Step 4: ゲームへ書き出す**

Run: `.venv/bin/python tools/export.py ../sprites.json ../assets/images`、ゲーム側で `npm test`
Expected: 変わる PNG は `ines-map.png` と剣・弓のアイコンを使う画像だけ（`git status` で確かめる）。`npm test` OK

- [ ] **Step 5: コミット**

```bash
git add assets/item/sword.txt assets/part/equip/arrow/arrow_up_atk_wind.txt assets/part/equip/arrow/arrow_up_atk_draw.txt assets/unit/ines/up_atk_wind.txt assets/unit/ines/up_atk_draw.txt ../assets/images
git commit -m "fix: 剣のアイコンの先の角と、イネスの背面の攻撃の鏃を先端の決まりの形にする"
```

- [ ] **Step 6: イネスの動きのページを作り直し、同じ URL に出し直す**

Run（リポジトリの直下で）: `python3 tools/anim-page.py assets/units/ines.json /tmp/<新しいフォルダ>/ines.html` → Artifact で https://claude.ai/artifact/B6exAXtz8YTeLSww2e3YS7 に出し直す（`url` を渡す前に read する）

---

### Task 6: 正典を書き換える

**Files:**
- Modify: `pixel-asset-forge/types/item/SPEC.md`（「尖った先端を、輪郭に囲まれた1画素で表さない」の項）
- Modify: `pixel-asset-forge/types/unit/SPEC.md`（「切っ先は平らな蓋のまま」、自己チェックの `tip_check.py` の行、347行目あたりの「何を先端とみなすかは未定」）
- Modify: `pixel-asset-forge/ISSUES.md`（「尖った先端をどう描くか」の行を消す。Task 4 で残した課題があれば足す）
- Modify: `pixel-asset-forge/CLAUDE.md`（コマンド一覧に `tip_check.py --items checks/items.json` を足す）

- [ ] **Step 1: item の SPEC を書き換える**

項の見出しを「刃・鏃の先端は決まり1〜5で描く」にし、設計書の決まり1〜5・言葉の定義・当てはめる範囲（中身4画素まで、刃の文字でない先端は見ない）を写す。3画素の角の記述は「角も黒で埋める（決まり5）」に替え、剣・弓のアイコンの今の形（Task 5 の後）を例にする。経緯（2026-10-02 の判断と 2026-10-21〜22 の判断）を1〜2行で残す。

- [ ] **Step 2: unit の SPEC を書き換える**

「切っ先は平らな蓋のまま」に「中身2画素の先端の決まり（item の SPEC）の形」と書き添える。自己チェックの行を「刃・鏃の先端（`tip_check.py`、決まり1〜5）」に、347行目あたりを「刃・鏃の先端が決まり1〜5に合うか（① の `tip_check` が部品ごとの形で出す）」に替える。

- [ ] **Step 3: ISSUES・CLAUDE.md を直し、全体を通す**

Run:
```bash
.venv/bin/python -m unittest discover -s tests
.venv/bin/python tools/validate.py
for u in roran ines gau; do .venv/bin/python tools/unit_rules.py checks/$u.json; done
```
Expected: テストはすべて OK、validate OK、unit_rules は Task 4 の判断どおり（直さないと決めた絵が無ければ3体とも終了 0）

- [ ] **Step 4: コミット**

```bash
git add types/item/SPEC.md types/unit/SPEC.md ISSUES.md CLAUDE.md
git commit -m "docs: 刃・鏃の先端の決まり1〜5を SPEC に書き、ISSUES の「尖った先端をどう描くか」を消す"
```
