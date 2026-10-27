# 左右の向きで武器の位置をそろえる道具（PR ウ）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** left と right の同じ状態のコマで、拳が握る部品の画素の位置が左右反転で一致するかを確かめる道具 `tools/weapon_mirror.py` を作り、`unit_rules.py` に入れ、落ちた4件の絵を直す。

**Architecture:** 既存の確認の道具（`fist_check.py` など）と同じく `checks/<ユニット>.json` を受けて `unit_config.run_check` で動く1ファイルの道具にし、`unit_rules.py` の `NEW_CHECKS` に足す。絵の直しは部品のグリッド（`assets/part/**`）だけを変え、`compose.py --force` で組み直し、ゲームのシートを書き出す。

**Tech Stack:** Python 3.14（forge の `.venv`）、unittest、forge の `compose.py`・`unit_config.py`。

**Spec:** `docs/superpowers/specs/2026-10-27-weapon-mirror-design.md`

コマンドは断りが無ければ `pixel-asset-forge/` で実行する。

## Global Constraints

- 比べるのは left と right だけ。down と up は比べない（依頼者）
- 比べる部品は、拳の `grips` に書かれた部品だけ（髪・かぶり物・役割の無い部品は比べない）
- 比べるのは空でない画素の位置（dx・dy を足したコマ上の位置）。right を x → 31 − x で反転し、集合として一致するか。色は比べない。隠れる画素も比べる
- 両方の部品が空なら一致。片方だけ空・片方にしか無い・`left_<状態>` と `right_<状態>` の片方しか無いは落とす
- 失敗の行は `FAIL <left のコマの名前>: ...`（`unit_rules.py` の例外の照合が「:」より前を見る）
- `hand_mirror.py` は変えない（攻撃のコマの拳は比べないまま）
- 例外（`exceptions`）で通さない。正しい絵が落ちたら判定を直す
- 絵を直したら、前と後を並べたページ（静止と動き）を Artifact で見せ、依頼者の承認を得てからコミットする。どれを見ればいいかを最初に1行で言う
- テストは `assets/` を読まない（`tests/test_no_live_assets.py`）
- push・PR は依頼者の指示があったときだけ。一時の出力は scratchpad か /tmp の新しいフォルダ（rm -rf は使えない）

## Review Focus

- **left にだけある状態（right_<状態> が無い）**: 片方しか無いことを落とす → Task 1 `test_a_state_only_on_one_side_fails`（left だけ・right だけの両方）
- **grips の無いユニット（拳の部品が無い・grips を書いていない）**: 比べる部品が無く ok になる → Task 1 `test_no_gripped_parts_passes`
- **部品の層がコマに無い（片方の向きでだけ層が無い）**: 「片方にしか無い」で落とす → Task 1 `test_a_part_missing_on_one_side_fails`
- **出力の位置の並び**: 失敗の行の座標が y→x の順で安定する（`unit_config.points` を使う）→ Task 1 の 1画素ずれのテストで文字列ごと確かめる
- **unit_rules の例外の照合**: 失敗の行の「:」より前が left のコマの名前 → Task 1 `test_failure_line_starts_with_the_left_frame`

---

### Task 1: 道具 `weapon_mirror.py` と `unit_rules.py` への組み込み

**Files:**
- Create: `pixel-asset-forge/tools/weapon_mirror.py`
- Create: `pixel-asset-forge/tests/test_weapon_mirror.py`
- Modify: `pixel-asset-forge/tools/unit_rules.py`（`NEW_CHECKS` に `"weapon_mirror"` を `fist_check` の後に足す。docstring の 4. の並びにも足す）
- Modify: `pixel-asset-forge/tools/unit_config.py:54`（`CHECKS` に `"weapon_mirror"`）
- Modify: `pixel-asset-forge/tests/test_unit_rules.py:44-46`（既定のユニットが通る確認の名前に `"weapon_mirror"`）
- Modify: `pixel-asset-forge/README.md`（253行の確認の並び、276行付近のコマンド例に1行）、`pixel-asset-forge/CLAUDE.md`（コマンド一覧の `hand_mirror.py` の次に1行）
- Modify: `pixel-asset-forge/types/unit/SPEC.md`「部品で組む規約」の「拳の位置は上下左右で合わせる」の項の次に、武器の項を足す（下の Step 7）

**Interfaces:**
- Produces: `check(cfg: UnitConfig) -> list[tuple[str, str]]`（名前は left のコマ、または片方しか無いときはあるほうのコマ）、`main(argv: list[str] | None = None) -> int`（`run_check(argv, __doc__, check, "武器の位置（left と right）: ok")`）
- Consumes: `unit_config.UnitConfig`・`Frame.parts`・`Part.pixels()`・`cfg.role(key, "fist")`・`cfg.role(key, "grips")`・`unit_config.points`・`run_check`

テストは `tests/unit_fixture.py` の `UnitFixture` を使う。既定のユニットは down と up しか無いので、`setUp` で left と right を作る:
`self.fx.frames` を、既定の down の4コマを `left_<状態>`、その左右反転（`unit_fixture.mirror`）を `right_<状態>` にした辞書に置き換え、
`self.fx.checks["orders"]` と `["eyes"]` のキーを `left`・`right` にする（値は既定と同じ）。この形で既定のユニットは全確認を通る想定。通らなければ setUp を直す（道具の判定は変えない）。

- [ ] **Step 1: 失敗するテストを書く**（`tests/test_weapon_mirror.py`、クラス `WeaponMirrorTest`）

```python
def test_mirrored_parts_pass(self):
    code, out = self.fx.run(main)
    self.assertEqual(code, 0, out)
    self.assertIn("武器の位置（left と right）: ok", out)

def test_a_one_pixel_shift_fails_with_the_positions(self):
    self.fx.frames["left_base"]["sword"] = sword_shifted(dx=-1)  # 既定の剣を1列左へ
    code, out = self.fx.run(main)
    self.assertEqual(code, 1)
    self.assertIn("FAIL left_base: sword の位置が right の反転と合わない", out)
    self.assertIn("left だけ (21,5) (20,6) (20,7)", out)  # 座標は y→x の順（unit_config.points）

def test_an_empty_part_on_one_side_fails(self):
    self.fx.frames["left_atk_hit"]["sword"] = {}
    code, out = self.fx.run(main)
    self.assertEqual(code, 1)
    self.assertIn("FAIL left_atk_hit: sword が left では空", out)

def test_both_empty_pass(self):
    self.fx.frames["left_atk_hit"]["sword"] = {}
    self.fx.frames["right_atk_hit"]["sword"] = {}
    self.fx.frames["left_atk_hit"]["sword_hand"] = {}
    self.fx.frames["right_atk_hit"]["sword_hand"] = {}
    code, out = self.fx.run(main)
    self.assertEqual(code, 0, out)

def test_a_part_missing_on_one_side_fails(self):
    del self.fx.frames["right_base"]["sword"]
    code, out = self.fx.run(main)
    self.assertEqual(code, 1)
    self.assertIn("FAIL left_base: sword が right_base に無い", out)

def test_a_state_only_on_one_side_fails(self):
    del self.fx.frames["right_idle2"]
    code, out = self.fx.run(main)
    self.assertIn("FAIL left_idle2: 組になる right_idle2 が無い", out)
    # right にだけある状態も、right のコマの名前で落とす
    ...  # left_walk_a を消して "FAIL right_walk_a: 組になる left_walk_a が無い"

def test_attack_frames_are_compared(self):
    self.fx.frames["left_atk_hit"]["sword"] = sword_shifted(dx=-1, dy=-4)
    code, out = self.fx.run(main)
    self.assertIn("FAIL left_atk_hit:", out)

def test_parts_not_gripped_are_not_compared(self):
    self.fx.frames["left_base"]["shield"] = box(6, 18, 9, 23, "m")  # 盾を1列左へ。盾を握る拳は無い
    code, out = self.fx.run(main)
    self.assertEqual(code, 0, out)

def test_no_gripped_parts_passes(self):
    self.fx.checks["parts"]["sword_hand"].pop("grips")
    code, out = self.fx.run(main)
    self.assertEqual(code, 0, out)

def test_down_and_up_are_not_compared(self):
    # setUp の left・right に、既定の down を足し、up は down を反転しないまま置く（ずれた組）
    ...
    code, out = self.fx.run(main)
    self.assertNotIn("down_", out)

def test_failure_line_starts_with_the_left_frame(self):
    self.fx.frames["left_base"]["sword"] = sword_shifted(dx=-1)
    code, out = self.fx.run(main)
    line = next(l for l in out.splitlines() if l.startswith("FAIL "))
    self.assertEqual(line[len("FAIL "):].split(":", 1)[0], "left_base")
```

`sword_shifted(dx, dy=0)` はテストのファイルの中の小さな関数（`unit_fixture.sword(dy)` の画素を dx だけずらす）。
「…」の2つは書き手が上の形に合わせて埋める（消すコマと期待する行は書いたとおり）。
down と up を足すテストでは、`checks` の `orders`・`eyes` にも `down`・`up` のキーを足す（設定は compose にある向きをすべて求める）。

- [ ] **Step 2: 失敗を確かめる**

Run: `.venv/bin/python -m unittest tests.test_weapon_mirror -v`
Expected: `ModuleNotFoundError: No module named 'weapon_mirror'`

- [ ] **Step 3: `tools/weapon_mirror.py` を書く**

docstring に、使い方（`.venv/bin/python tools/weapon_mirror.py checks/roran.json`）・比べるもの（Global Constraints の1〜4行目）・10-12 の判断との関係（拳は `hand_mirror.py` が攻撃以外で比べ、武器はこの道具が攻撃も比べる。2026-10-27 依頼者）を書く。

- 比べる部品: `{role["grips"] for role in cfg.parts.values() if role.get("fist") and role.get("grips")}`
- 組: `cfg.frames` の名前を `<向き>_<状態>` に分け、left と right の状態の和集合ごとに見る。片方しか無ければ、あるほうのコマの名前で `組になる <相手> が無い`
- 部品ごと: どちらのコマにも層が無ければ見ない。片方に無ければ `<部品> が <相手のコマ> に無い`。
  `mine = set(left.parts[k].pixels())`、`theirs = {(31 - x, y) for x, y in right.parts[k].pixels()}`。
  両方空なら一致。片方だけ空なら `<部品> が left では空`（または `right では空`）。
  集合が違えば `<部品> の位置が right の反転と合わない（left だけ <points(mine - theirs)>、right 反転だけ <points(theirs - mine)>）`。空の側は「なし」と書く
- 失敗の並びはコマの名前順、部品の名前順

- [ ] **Step 4: テストが通るのを確かめる**

Run: `.venv/bin/python -m unittest tests.test_weapon_mirror -v`
Expected: すべて OK

- [ ] **Step 5: `unit_rules.py`・`unit_config.py`・`test_unit_rules.py` に足し、全テストを走らせる**

Run: `.venv/bin/python -m unittest discover -s tests 2>&1 | grep -E "^Ran|^OK|FAILED"`
Expected: `OK`（609 + 足したテストの数）

- [ ] **Step 6: 今の3体にかけて、設計書の実測と同じ4件だけが落ちるのを確かめる**

Run: `for u in roran ines gau; do .venv/bin/python tools/weapon_mirror.py checks/$u.json; done`
Expected:
- roran: `FAIL left_atk_hit: sword が left では空`、`FAIL left_atk_hit: sword_hand` は出ない（拳は grips の側でないので比べない）、`FAIL left_atk_wind: sword の位置が…`
- ines: `武器の位置（left と right）: ok`
- gau: `FAIL left_atk_hit: dagger の位置が…`、`FAIL left_atk_wind: dagger の位置が…`

これ以外が落ちたら、判定の誤りとして直す（絵を変えない）。`unit_rules.py checks/roran.json` と `checks/gau.json` は `NG   weapon_mirror 2` で終了 1 になる（Task 2〜3 で 0 にする）。

- [ ] **Step 7: 文書を足す**

SPEC「部品で組む規約」に足す項（文言）:

```
- **武器の位置は left と right で合わせる（2026-10-27 依頼者の判断）。** 拳が握る部品（剣・盾・短剣・弓・矢）は、left と right の同じ状態のコマで、
  画素の位置を左右反転で一致させる（体に隠れる画素も。色は比べない）。攻撃のコマも含む（拳と違い、今の絵で武器のずれた3件はどれも直すべきずれだった）。down と up は比べない。
  検査は `tools/weapon_mirror.py checks/<unit>.json`（`unit_rules.py` からも走る）
```

README・CLAUDE.md のコマンド行: `.venv/bin/python tools/weapon_mirror.py checks/roran.json  # left と right で、拳が握る部品の位置が左右反転で合っているか（攻撃のコマも）`

- [ ] **Step 8: コミット**

```bash
git add pixel-asset-forge/tools/weapon_mirror.py pixel-asset-forge/tests/test_weapon_mirror.py pixel-asset-forge/tools/unit_rules.py pixel-asset-forge/tools/unit_config.py pixel-asset-forge/tests/test_unit_rules.py pixel-asset-forge/README.md pixel-asset-forge/CLAUDE.md pixel-asset-forge/types/unit/SPEC.md
git commit -m "feat: left と right で武器の位置が左右反転で合っているかを確かめる weapon_mirror を足す"
```

---

### Task 2: ロランの `left_atk_hit` の剣を描く（依頼者の承認で止まる）

**Files:**
- Modify: `pixel-asset-forge/assets/part/equip/sword/sword_left_atk_hit.txt`、`pixel-asset-forge/assets/part/fist/roran/sword_hand_left_atk_hit.txt`（今は空）
- Modify: `pixel-asset-forge/checks/roran.json`（`weapon_check.hidden` から `left_atk_hit` を外す）
- Modify: `pixel-asset-forge/types/unit/SPEC.md`（「剣ごと体に隠れるコマ（ロランの `up_atk_hit`・`left_atk_hit`）」から `left_atk_hit` を外す。柄頭の項にも `left_atk_hit` があれば合わせる）
- Modify: `pixel-asset-forge/assets/unit/roran/left_atk_hit.txt`（`compose.py --force --frames left_atk_hit` で組み直す）

- [ ] **Step 1: 案を作る**

剣の部品は `sword_right_atk_hit.txt` の画素の位置を左右反転した位置に、同じ形で描く。色は光源（左上）に合わせて付け直す（`mirror` の派生ファイルは使えない。SPEC「弓の持ち方」の right と同じ扱い）。
拳の部品は、握る剣に接するように置く（`fist_check` の「接している」と大きさ 3x2）。拳の位置は攻撃のコマなので右と合わせなくてよいが、まず right の反転の位置で試す。
重なり順は今の left のまま（剣・剣の拳・芯・盾の拳・盾）。案は `--out` で scratchpad に組む（`compose.py compose/roran.json --frames left_atk_hit --out <scratchpad>/cand`）。

- [ ] **Step 2: 前と後のページを Artifact で見せて止まる**

静止（今・案・赤枠つきの今と案）と動き（left の攻撃3コマを今と案で、ゲームの fps で）を並べる。`right_atk_hit` を反転した絵も並べる。
依頼者が直しを求めたら Step 1 に戻る。**承認されるまで次へ進まない。**

- [ ] **Step 3: 承認された案を部品に書き、コマを組み直し、設定と SPEC を直す**

Run: `.venv/bin/python tools/compose.py compose/roran.json --force --frames left_atk_hit && .venv/bin/python tools/weapon_mirror.py checks/roran.json`
Expected: `left_atk_hit` の行が消え、`left_atk_wind` の1行だけ残る

Run: `.venv/bin/python tools/unit_rules.py checks/roran.json`
Expected: `weapon_mirror` 以外はすべて `ok`（`weapon_check` も hidden を外した状態で ok）。他の確認が落ちたら絵を見直す

- [ ] **Step 4: コミット**

```bash
git add pixel-asset-forge/assets/part pixel-asset-forge/assets/unit/roran pixel-asset-forge/checks/roran.json pixel-asset-forge/types/unit/SPEC.md
git commit -m "fix: ロランの left_atk_hit に振り下ろした剣を描く（right_atk_hit の反転の位置）"
```

---

### Task 3: 1画素のずれと形の違い3件を直す（依頼者の選択と承認で止まる）

**Files:**
- Modify（選んだ側だけ）: `pixel-asset-forge/assets/part/equip/sword/sword_{left,right}_atk_wind.txt`、`pixel-asset-forge/assets/part/fist/roran/sword_hand_{left,right}_atk_wind.txt`、
  `pixel-asset-forge/assets/part/equip/dagger/dagger_{left,right}_atk_{hit,wind}.txt`、`pixel-asset-forge/assets/part/fist/gau/dagger_hand_{left,right}_atk_{hit,wind}.txt`
- Modify: 組み直した `pixel-asset-forge/assets/unit/{roran,gau}/{left,right}_atk_*.txt`

対象（設計書の実測）: ロラン `atk_wind` の剣（横1画素）、ガウ `atk_hit` の短剣（横1画素）、ガウ `atk_wind` の短剣（形が違う）。

- [ ] **Step 1: 案を作る**

3件それぞれに「left を right の反転に合わせる案」と「right を left の反転に合わせる案」を作る。
ずらして直すものは、握る拳の部品も同じだけずらす（握りの関係を保つ。`fist_check` が通ること）。形が違うもの（ガウ `atk_wind`）は、合わせる側の形を反転した位置に描き、色は光源に合わせて付け直す。
案は scratchpad に組む（`compose.py ... --out`）。

- [ ] **Step 2: 3件の2案を並べたページを Artifact で見せて止まる**

件ごとに、今・left に合わせた案・right に合わせた案を、静止（赤枠つきと印なし）と動き（その向きの攻撃）で並べる。依頼者が件ごとに選ぶ。**選ばれ、承認されるまで次へ進まない。**

- [ ] **Step 3: 選ばれた案を部品に書き、組み直し、確かめる**

Run: `.venv/bin/python tools/compose.py compose/roran.json --force --frames <直したコマ>`（ガウも同じ）
Run: `for u in roran ines gau; do .venv/bin/python tools/unit_rules.py checks/$u.json; done`
Expected: 3体とも全確認 `ok`、終了 0

- [ ] **Step 4: コミット**

```bash
git add pixel-asset-forge/assets/part pixel-asset-forge/assets/unit
git commit -m "fix: ロランの振りかぶりの剣とガウの攻撃の短剣を、left と right で左右反転にそろえる"
```

---

### Task 4: 書き出し・課題の片付け・最終確認

**Files:**
- Modify: `assets/images/roran-map.png`・`assets/images/gau-map.png`（書き出し）
- Modify: `pixel-asset-forge/ISSUES.md`（「左右の向きで武器の位置がそろっているかを確かめる道具が無い」と「ロランの `left_atk_hit` で、振り下ろした剣が描かれていない」の2行を消す）

- [ ] **Step 1: ゲームのシートを書き出す**（リポジトリの直下で）

Run: `pixel-asset-forge/.venv/bin/python pixel-asset-forge/tools/export.py sprites.json assets/images && git status --short assets/images`
Expected: `roran-map.png` と `gau-map.png` だけが変わる

- [ ] **Step 2: 動きのページを出し直す**

`python3 tools/anim-page.py assets/units/<unit>.json <scratchpad>/<unit>.html` で作り、HANDOVER.md にある同じ URL（ロラン https://claude.ai/artifact/QADTgozjh3h7dWko1xXdsZ 、ガウ https://claude.ai/artifact/G3Xer2uJFMmte2LoQ4ZMwy ）へ出し直す（先に Artifact の read をする）。

- [ ] **Step 3: ISSUES の2行を消す**

- [ ] **Step 4: 全部の確認を走らせる**

Run（`pixel-asset-forge/` で）: `.venv/bin/python tools/validate.py && .venv/bin/python -m unittest discover -s tests 2>&1 | grep -E "^Ran|^OK|FAILED" && for u in roran ines gau; do .venv/bin/python tools/unit_rules.py checks/$u.json >/dev/null; echo "$u $?"; done && .venv/bin/python tools/tip_check.py --items checks/items.json`
Expected: validate 0、unittest OK、3体とも 0、tip_check ok

Run（リポジトリの直下で）: `npm test && npm run build`
Expected: 776 passed、build 成功

- [ ] **Step 5: コミット**

```bash
git add assets/images pixel-asset-forge/ISSUES.md
git commit -m "chore: ロラン・ガウのシートを書き出し、武器の左右の位置の課題を ISSUES から消す"
```
