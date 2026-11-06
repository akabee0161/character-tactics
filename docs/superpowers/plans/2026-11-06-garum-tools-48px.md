# ガルムの前に道具を 48px でも動くようにする Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** forge の unit の確認の道具と見せる道具を、32px と 48px のどちらのコマでも動くようにする（32px の判定は1件も変えない）。

**Architecture:** 体の比率の値（足元・背丈・脚の行・頭頂・頭胴脚の行の範囲）を新しいモジュール `tools/unit_scale.py` の表に集め、
コマの大きさ（グリッドの `# size:`）から `scale_for(size)` で引く。32 の値は今の定数そのまま、48 の値は設計書の決まり
（足元からの距離を1.5倍、足元 y=46）で決めた下の表の値。大きさの決め打ち（31 − x、枠の端、ページの 32）はコマの大きさから計算する。
これはガルムの設計の第1段階だけの計画で、第2段階（ガルムを描く）の計画はこの PR のマージ後に別に書く。

**Tech Stack:** Python 3.14（`.venv/bin/python`）、unittest、Pillow

**Spec:** `docs/superpowers/specs/2026-11-06-garum-unit-design.md`（第1段階）

## Global Constraints

- 作業は `pixel-asset-forge/` の中で行う（コマンドはそこから）。テストは `.venv/bin/python -m unittest discover -s tests`
- **32px のユニット（味方4体・敵16体）の判定は1件も変わらない**（Task 1 で取る基準と、Task 6 で出力が1文字も違わない）
- 48px の比率は 32px の値を1.5倍（依頼者の判断）。行の値は足元からの距離を1.5倍、足元は y=46（ゲームの `FOOT_INSET = 2` を保つ）
- 対応するのは 32 と 48 だけ。ほかの大きさは `ScaleError`（黙って 32 の値を使わない）
- テストは `tests/` の一時フォルダのグリッドを使い、`assets/` の絵を読まない（`tests/test_no_live_assets.py`）
- コミットは Conventional Commits ＋日本語の要約。コメント・メッセージ・docstring は既存どおり日本語

### 48px の値（Claude が決めた。SPEC に書く）

| 名前 | 32px（今の定数） | 48px | 使う道具 |
|---|---|---|---|
| `foot` 足元の行 | 30 | 46 | `height_check`・`sheet.py` |
| `min_height`〜`max_height` 背丈 | 24〜26 | 36〜39 | `height_check` |
| `leg_top` 脚の中心を測る上端 | 24 | 37 | `unit_check` |
| `walk_leg_top` 歩きで動いてよい脚の上端 | 28 | 43 | `still_check` |
| `walk_outline_row` 上げた足の上の輪郭の行 | 27 | 42 | `still_check` |
| `blade_top` 待機・歩きの切っ先の上限 | 5 | 8 | `blade_height` |
| `idle2_blade_top` 待機2コマ目の上限 | 3 | 5 | `blade_height` |
| `bands` 頭・胴・脚の行 | (3,14) (15,24) (25,31) | (5,22) (23,37) (38,47) | `body_check`・`head_cover_check` |

丸め方: 足元からの距離 ×1.5 の端数は、体を測る範囲が狭くならない側へ。`blade_top` は `foot − max_height + 1`（背丈の上限の頭頂）、
`idle2_blade_top` は `blade_top − 3`（32px の2行 ×1.5）、`walk_outline_row` は `walk_leg_top − 1`。

### 直さないもの（理由）

- `layers.py`・`cut_layers.py`・`parts_export.py`: 古いコマを部品へ切り出すための道具。ガルムは部品を最初から描くので使わない
- `enemy_gallery.py`・`enemy_build.py`: 色替えの敵のレシピ用。ガルムはレシピを持たない
- `compose.py`: すでに素体の大きさで組む（docstring の「32x32」だけ直す）
- `weapon_check.py` の `GRIP_TOLERANCE`・`LENGTH_TOLERANCE`・`HAND_REACH`: コマ間のぶれの許し幅で、体の大きさに比例させる理由が無い

## Review Focus

- 48px と 32px が混ざったユニット（芯の一部だけ 48px）→ `UnitConfigError` で止まる（黙ってどちらかの値で測らない）。Task 1 のテスト
- 48 でも 32 でもない大きさ（例 40x40）→ どの道具も `ScaleError` を読める文言で出し終了コード 2。Task 1・Task 4 のテスト
- 正方形でないコマ（48x32）→ 同じく止まる。Task 1 のテスト
- `body_check` に `--head` などを明示したとき → 48px でも明示した値を使う（既定だけが大きさで変わる）。Task 4 のテスト
- `anim_compare` に 48px のユニット設定を渡したのに 32px のシートを渡した → 寸法が足りないと止まる。Task 5 のテスト

---

### Task 1: 比率の表と、ユニットのコマの大きさ

**Files:**
- Create: `pixel-asset-forge/tools/unit_scale.py`
- Modify: `pixel-asset-forge/tools/unit_config.py`（`UnitConfig` に `size`・`scale`、大きさの検査）
- Modify: `pixel-asset-forge/tests/unit_fixture.py`（`UnitFixture(size=48)`）
- Test: `pixel-asset-forge/tests/test_unit_scale.py`、`tests/test_unit_config.py`

**Interfaces:**
- Produces:
  - `unit_scale.Scale`（frozen dataclass）: `size: int`, `foot: int`, `min_height: int`, `max_height: int`, `leg_top: int`, `walk_leg_top: int`, `walk_outline_row: int`, `blade_top: int`, `idle2_blade_top: int`, `bands: dict[str, tuple[int, int]]`（キー `head`・`trunk`・`legs`）
  - `unit_scale.ScaleError(Exception)`、`unit_scale.scale_for(size: int) -> Scale`、`unit_scale.SIZES = (32, 48)`
  - `UnitConfig.size: int`（全コマの芯の幅）と `UnitConfig.scale: Scale`
  - `unit_fixture.UnitFixture(size: int = 32)`。`size=48` なら既定のコマを (dx=8, dy=16) ずらし、芯を `core48(top=8)` = `box(20, top, 27, 46, "c")` にする（背丈 39px）。`unit_fixture.core48(top: int = 8) -> dict`、`unit_fixture.mirror(pixels, size=32)`

- [ ] **Step 0: 32px の基準を取る（コードを触る前）**

```bash
mkdir -p ../.superpowers/sdd/2026-11-06-garum-tools-48px/baseline
for c in checks/*.json; do [ "$c" = checks/items.json ] && continue; n=$(basename $c .json); .venv/bin/python tools/unit_rules.py $c > ../.superpowers/sdd/2026-11-06-garum-tools-48px/baseline/rules_$n.txt 2>&1; echo "exit $?" >> ../.superpowers/sdd/2026-11-06-garum-tools-48px/baseline/rules_$n.txt; done
for c in compose/*.json; do n=$(basename $c .json); .venv/bin/python tools/compose.py $c --check > ../.superpowers/sdd/2026-11-06-garum-tools-48px/baseline/compose_$n.txt 2>&1; echo "exit $?" >> ../.superpowers/sdd/2026-11-06-garum-tools-48px/baseline/compose_$n.txt; done
for s in sheets/*.txt; do n=$(basename $s .txt); .venv/bin/python tools/sheet.py $s > ../.superpowers/sdd/2026-11-06-garum-tools-48px/baseline/sheet_$n.txt 2>&1; echo "exit $?" >> ../.superpowers/sdd/2026-11-06-garum-tools-48px/baseline/sheet_$n.txt; cp build/sheets/${n}_preview.png ../.superpowers/sdd/2026-11-06-garum-tools-48px/baseline/ 2>/dev/null; done
.venv/bin/python -m unittest discover -s tests 2>&1 | tail -3
```
Expected: 基準のファイルができ、unittest が OK（落ちていれば先に記録して止まる）。`.superpowers/` は git 管理外。

- [ ] **Step 1: 失敗するテストを書く** — `tests/test_unit_scale.py`

```python
def test_32_is_the_current_constants(self):
    s = scale_for(32)
    self.assertEqual((s.foot, s.min_height, s.max_height, s.leg_top, s.walk_leg_top, s.walk_outline_row,
                      s.blade_top, s.idle2_blade_top), (30, 24, 26, 24, 28, 27, 5, 3))
    self.assertEqual(s.bands, {"head": (3, 14), "trunk": (15, 24), "legs": (25, 31)})

def test_48_is_one_and_a_half_from_the_feet(self):
    s = scale_for(48)
    self.assertEqual((s.foot, s.min_height, s.max_height, s.leg_top, s.walk_leg_top, s.walk_outline_row,
                      s.blade_top, s.idle2_blade_top), (46, 36, 39, 37, 43, 42, 8, 5))
    self.assertEqual(s.bands, {"head": (5, 22), "trunk": (23, 37), "legs": (38, 47)})

def test_other_sizes_stop(self):
    with self.assertRaisesRegex(ScaleError, "40.*32 か 48"):
        scale_for(40)
```

`tests/test_unit_config.py` に足す:

```python
def test_size_and_scale_come_from_the_core(self):   # UnitFixture(size=48) → cfg.size == 48, cfg.scale.foot == 46
def test_mixed_sizes_stop(self):                    # 1コマの芯と部品だけ 32px（他は 48px）→ UnitConfigError「大きさ」を含む
def test_non_square_stops(self):                    # 芯を 48x32 → UnitConfigError
def test_unknown_size_stops(self):                  # 全コマ 40x40 → UnitConfigError（ScaleError の文言を含む）
def test_fixture_48_passes_unit_rules(self):        # UnitFixture(size=48) で unit_rules.main が終了 0（Task 2〜4 の後で通る。今は expectedFailure を付けずに書き、Task 4 の終わりで通ることを確かめる）
```

最後のテストは Task 4 まで落ちる。Task 1 では `@unittest.skip("Task 4 で外す")` を付けておき、Task 4 の Step で外す。

- [ ] **Step 2: 落ちることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_unit_scale tests.test_unit_config -v`
Expected: `ModuleNotFoundError: unit_scale` と、size の属性が無いエラー

- [ ] **Step 3: `unit_scale.py` と `UnitConfig.size`・`scale` を実装する**

`scale_for` は表を引くだけ（`SCALES = {32: Scale(...), 48: Scale(...)}`）。docstring に上の表の丸め方と設計書のパスを書く。
`load_unit_config` は `frames` を作った後、全コマの芯の `(width, height)` が1種類で正方形かを確かめ（でなければ `UnitConfigError(f"芯の大きさがそろっていない: …")`）、
`scale_for` の `ScaleError` を `UnitConfigError` に包む。部品と芯の大きさの違いは `compose.py` がすでに止める。
`unit_fixture` の `grid_text(..., size)` に `self.size` を渡し、`default_frames(size)` で 48 の既定のコマを作る。

- [ ] **Step 4: 通ることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_unit_scale tests.test_unit_config -v`
Expected: PASS（skip 1件）

- [ ] **Step 5: 全テスト**

Run: `.venv/bin/python -m unittest discover -s tests 2>&1 | tail -3`
Expected: OK

- [ ] **Step 6: Commit**

```bash
git add tools/unit_scale.py tools/unit_config.py tests/test_unit_scale.py tests/test_unit_config.py tests/unit_fixture.py
git commit -m "feat: unit の体の比率を 32px と 48px の表から引く"
```

### Task 2: 設定ファイルから走る比率の確認（背丈・切っ先・動かない所・被り物）

**Files:**
- Modify: `pixel-asset-forge/tools/height_check.py`、`blade_height.py`、`still_check.py`、`head_cover_check.py`
- Test: `tests/test_height_check.py`、`test_blade_height.py`、`test_still_check.py`、`test_head_cover_check.py`

**Interfaces:**
- Consumes: `UnitConfig.scale`（Task 1）、`UnitFixture(size=48)`、`core48`
- Produces: 4つの道具のモジュール定数（`FOOT`・`MIN_HEIGHT`・`MAX_HEIGHT`・`TOP`・`IDLE2_TOP`・`LEG_TOP`・`OUTLINE_ROW`・`HEAD_BOTTOM`）を消し、`cfg.scale` の値を使う。文言の数字も `cfg.scale` から出す

- [ ] **Step 1: 失敗するテストを書く**（各ファイルに 48px のテストを足す。32px の既存のテストはそのまま）

```python
# test_height_check.py
def test_48_36_to_39_pass(self):        # UnitFixture(size=48)、top 8・9・10（39・38・37px）と 11（36px）→ 終了 0
def test_48_40_and_35_fail(self):       # top 7 → "背丈 40px（芯の上端 y=7。36〜39px にする）"、top 12 → "背丈 35px（芯の上端 y=12。36〜39px にする）"
# test_blade_height.py
def test_48_limit_is_y8(self):          # 48 の既定の剣を dy で上へずらし、刃の上端 y=8 は通り、y=7 は "y=8 より上に出さない" で落ちる
def test_48_idle2_limit_is_y5(self):    # idle2 で刃の上端 y=5 は通り、y=4 は落ちる
# test_still_check.py
def test_48_walk_may_move_rows_43_to_46(self):   # down_walk_a の芯の (21,45) を変える → 通る
def test_48_walk_row_42_only_new_outline(self):  # (21,42) に輪郭を増やす（base で透明の所）→ 通る、(21,41) を変える → 落ちる
# test_head_cover_check.py
def test_48_head_bottom_is_22(self):    # 既存の「頭の高さ」のテストと同じ形を 48 で。被り物の行の判定が y=22 を境に変わること
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_height_check tests.test_blade_height tests.test_still_check tests.test_head_cover_check -v`
Expected: 48 のテストが FAIL（32 の値で測っている）

- [ ] **Step 3: 4つの道具を `cfg.scale` で測るように直す**（docstring の「y=30」「24〜26px」などは「32px では y=30、48px では y=46（tools/unit_scale.py）」の形に）

- [ ] **Step 4: 通ることを確かめる**（Step 2 と同じコマンドで PASS、続けて全テスト OK）

- [ ] **Step 5: Commit** — `git commit -m "feat: 背丈・切っ先・動かない所・被り物の確認を 48px のコマでも測る"`

### Task 3: 左右反転と座標の範囲

**Files:**
- Modify: `pixel-asset-forge/tools/weapon_mirror.py`、`hand_mirror.py`、`unit_config.py`（`_coord`）
- Test: `tests/test_weapon_mirror.py`、`test_hand_mirror.py`、`test_unit_config.py`

**Interfaces:**
- Consumes: `UnitConfig.size`（Task 1）
- Produces: `weapon_mirror` は `cfg.size - 1 - x`。`hand_mirror.hands(spec, direction)` は芯のグリッドの幅から `size - 1 - x`。`unit_config._coord(value, size)` は `0 <= value < size`、文言は「0〜{size-1}」

- [ ] **Step 1: 失敗するテストを書く**

```python
# test_weapon_mirror.py
def test_48_mirrored_left_right_pass(self):   # size=48、left と right を 47 − x で反転した剣 → 終了 0
def test_48_uses_47(self):                    # right を 31 − x で反転した剣（32 の計算）→ "位置が right の反転と合わない" で落ちる
# test_hand_mirror.py
def test_48_mirrored_hands_pass(self):        # 48px の compose で down と up の拳が 47 − x → 終了 0
# test_unit_config.py
def test_48_eyes_accept_up_to_47(self):       # eyes.down = {"x": [40], "y": [20, 21]} が 48 で通る、x=48 は "0〜47" で落ちる
```

- [ ] **Step 2: 落ちることを確かめる**（3ファイルを `-v` で。48 のテストが FAIL）
- [ ] **Step 3: 実装する**
- [ ] **Step 4: 通ることを確かめる**（3ファイル PASS、全テスト OK）
- [ ] **Step 5: Commit** — `git commit -m "feat: 左右反転と目の座標を 48px のコマの幅で計算する"`

### Task 4: コマのフォルダを読む確認（脚の中心・体・武器）

**Files:**
- Modify: `pixel-asset-forge/tools/unit_check.py`、`body_check.py`、`weapon_check.py`
- Test: `tests/test_unit_check.py`、`test_body_check.py`、`test_weapon_check.py`、`test_unit_config.py`（Task 1 の skip を外す）

**Interfaces:**
- Consumes: `unit_scale.scale_for`、`ScaleError`
- Produces:
  - `unit_check.leg_center(rows, items)` は `scale_for(len(rows)).leg_top` で測る。`LEG_TOP` を消す
  - `body_check`: `DEFAULT_BANDS` を消し、`--head`・`--trunk`・`--legs` の既定を `None` に。`check_file(path, bands: dict | None, ...)` は `None` の行の範囲をファイルの大きさの `scale_for(...).bands` で埋める。明示した値は大きさに関係なくそのまま使う
  - `head_cover_check` は Task 2 で `cfg.scale.bands["head"][1]` に移したので、`body_check.DEFAULT_BANDS` の import が無いことを確かめる
  - `weapon_check.Analysis` に `size: int`（コマの行数）を持たせ、`body_center` と「コマの端」の判定に使う。`SIZE` を消す
  - 3つとも `ScaleError` は読める文言で終了コード 2

- [ ] **Step 1: 失敗するテストを書く**

```python
# test_unit_check.py
def test_48_leg_center_from_row_37(self):      # 48px のコマで y=36 にだけ左へはみ出す画素 → 脚の中心は変わらない（y>=37 で測る）
# test_body_check.py
def test_48_default_bands(self):               # 48px の芯で、頭 y=5〜22・胴 23〜37・脚 38〜47 の中心がそろう体 → 通る。32 の既定なら落ちる形にする
def test_48_explicit_bands_win(self):          # --trunk 15-24 を渡すと 48px でもその範囲で測る
def test_40_stops(self):                       # 40x40 の芯 → 終了 2、"32 か 48"
# test_weapon_check.py
def test_48_edge_is_47(self):                  # 48px で武器が x=47 にかかる → "コマの端で切れている"、x=31 では落ちない
# test_unit_config.py
# test_fixture_48_passes_unit_rules の skip を外す
```

- [ ] **Step 2: 落ちることを確かめる**（4ファイルを `-v` で。48 のテストが FAIL）
- [ ] **Step 3: 実装する**
- [ ] **Step 4: 通ることを確かめる**（4ファイル PASS、全テスト OK。`test_fixture_48_passes_unit_rules` が通る＝全確認が 48px の正しいユニットを通す）
- [ ] **Step 5: Commit** — `git commit -m "feat: 脚の中心・体・武器の確認を 48px のコマでも測る"`

### Task 5: シートと見せるページ

**Files:**
- Modify: `pixel-asset-forge/tools/sheet.py`、`anim_compare.py`、`unit_picker.py`、`compose.py`（docstring の「32x32」だけ）
- Test: `tests/test_sheet.py`、`test_anim_compare.py`、`test_unit_picker.py`

**Interfaces:**
- Consumes: `unit_scale.scale_for`
- Produces:
  - `sheet.preview(canvas, frame, scale)` と `sheet.report(frames, frame)` の足元の行は `scale_for(frame).foot`。`FOOT_Y` を消す
  - `anim_compare.load_states(path)` は `(states, frame)` を返す。`frame` は `sprites.map.frame`（無ければ 32。1以上の整数でなければ `AnimError`）。`build_page(..., frame: int)` が canvas の大きさと `drawImage` のセル、`_check_sheet` の必要な寸法に使う
  - `unit_picker` のデータの `"size"` は部品のグリッドの大きさ（全グリッドで同じでなければ止まる）

- [ ] **Step 1: 失敗するテストを書く**

```python
# test_sheet.py
def test_48_report_expects_foot_46(self):      # 48px のコマ（足元 y=46）だけのシート → report に "expected foot_y=46" と "<-- off" が無い
def test_48_preview_draws_foot_line_at_46(self):  # preview の赤い線の y が (46 * scale)
# test_anim_compare.py
def test_48_page_uses_frame_from_settings(self):  # sprites.map.frame=48 の設定と 192x576 のシート → canvas width="48"、drawImage に 48
def test_48_settings_with_32_sheet_stop(self):    # frame=48 の設定に 128x384 のシート → AnimError「足りない」
def test_frame_not_integer_stops(self):           # frame "48" → AnimError
# test_unit_picker.py
def test_48_size(self):                           # 48px の部品のピッカー → data["size"] == [48, 48]
```

- [ ] **Step 2: 落ちることを確かめる**（3ファイルを `-v` で）
- [ ] **Step 3: 実装する**
- [ ] **Step 4: 通ることを確かめる**（3ファイル PASS、全テスト OK）
- [ ] **Step 5: Commit** — `git commit -m "feat: シートと動きの比較ページ・部品のピッカーを 48px のコマに合わせる"`

### Task 6: 32px の判定が変わらないことの確認と、正典

**Files:**
- Modify: `pixel-asset-forge/types/unit/SPEC.md`（「確定している規約」に 48px の行、「未確定」の「フレームサイズ」を消す、比率の表）
- Modify: `pixel-asset-forge/CLAUDE.md`（「確定済み」の unit の行に 48px）、`pixel-asset-forge/README.md`（道具の説明に 48px があれば）
- Modify: `pixel-asset-forge/ISSUES.md`（「残りの unit は garum」の行を「道具は 48px に対応済み（2026-11-06）。garum の絵が残り」に）
- Create: `docs/superpowers/ledgers/2026-11-06-garum-tools-48px.md`（台帳の写し）

- [ ] **Step 1: Task 1 の基準と比べる**

Step 0 と同じ3つのループを `.../after/` に出し、`diff -r baseline after` で比べる（プレビューの PNG は `cmp`）。
Expected: 差が無い。差があれば、どの道具のどの判定が変わったかを直してから進む（32px の判定は変えない）

- [ ] **Step 2: 全テストと validate**

Run: `.venv/bin/python -m unittest discover -s tests 2>&1 | tail -3 && .venv/bin/python tools/validate.py`
Expected: OK、validate は終了 0

- [ ] **Step 3: SPEC・CLAUDE.md・README・ISSUES を直す**

SPEC の「確定している規約」の表: 解像度の行を「32x32（ゲーム側 `frame = 32`）。ガルムは 48x48（`frame = 48`、2026-11-06 依頼者）」に、
構図の行に「48px は足元 y=46、背丈 36〜39px（32px の値を足元から1.5倍。値の表は `tools/unit_scale.py`）」を足す。上の「48px の値」の表と丸め方を SPEC に写す。
ゲーム側の `src/render/draw.ts` のエフェクトの簡易対応は今回の範囲外（設計書）なので、ISSUES に無ければ1行足す。

- [ ] **Step 4: 台帳を写して Commit**

```bash
cp ../.superpowers/sdd/2026-11-06-garum-tools-48px/progress.md ../docs/superpowers/ledgers/2026-11-06-garum-tools-48px.md
git add types/unit/SPEC.md CLAUDE.md README.md ISSUES.md ../docs/superpowers/ledgers/2026-11-06-garum-tools-48px.md
git commit -m "docs: unit の 48px の規約と比率の表を正典に書く"
```
