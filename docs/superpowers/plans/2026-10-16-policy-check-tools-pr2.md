# 方針を確かめる道具 PR 2（ユニットの確認・設定ファイル・入口） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ユニットの方針の確認（1 重なり順・2 切っ先の高さ・3/4 動かない所と盾・5 背丈・6 1画素の先端・9 部品の文字・12 目・33 部品が閉じている・81 拳の大きさと握り）を forge の小さな道具にし、ユニットごとの設定ファイル `checks/<ユニット>.json` と入口 `tools/unit_rules.py` でまとめて走らせる。ロラン・イネス・ガウの3体の設定ファイルを置き、既存の絵に掛けた結果を依頼者に決めてもらう。

**Architecture:** 設定ファイルの読み込みと、コマ・部品のモデル（芯・部品・重なり順・組んだコマ）は `tools/unit_config.py` に1つだけ置く。確認は1つずつ `tools/` の小さな道具（`check(cfg) -> [(名前, 文言)]` と、共通の `run_check` を使う `main(argv)`）にする。入口 `tools/unit_rules.py` は今ある道具（validate・compose・body_check・hand_mirror・unit_check・weapon_check）と新しい確認の `main(argv)` を順に呼び、出力の失敗の行を設定ファイルの `exceptions` と突き合わせる。77 は 2026-10-16 の依頼者の判断で「`--arm` を今後使わない」に変わったので、コードは変えず文書から外す。

**Tech Stack:** Python 3.14（`pixel-asset-forge/.venv`）、Pillow（一覧の画像だけ）、unittest。

**Spec:** `docs/superpowers/specs/2026-10-16-policy-check-tools-design.md`（この計画は PR 2。PR 1 は `docs/superpowers/plans/2026-10-16-policy-check-tools-pr1.md`、PR #36 でマージ済み）

## Global Constraints

- コマンドは `pixel-asset-forge/` で実行する。Python は `.venv/bin/python`。テストは `.venv/bin/python -m unittest discover -s tests`（計画を書いた時点で 542 件。この計画の道具とテストを足した写しで数えた）
- ブランチは `chore/unit-rules`（character-tactics のリポジトリ。forge はその中の `pixel-asset-forge/`）。main（261ee74）から切る
- **絵はこの作業では直さない**（`assets/**/*.txt` と `compose/*.json` を書き換えない）。依頼者が「直す」と決めた絵は ISSUES に1行立て、E（全ユニット再検証）で直す
- 既存の絵で落ちたものは、全部の道具を作ってから**まとめて1回**、一覧（スマホ用の画像つき）で依頼者に見せ、1件ずつ決めてもらう（例外にする＝設定ファイルの `exceptions` に理由と日付・絵を直す＝ISSUES に立てる・道具の判定を直す・道具にしない）。PR 1 と同じ進め方。道具のコードは判断を待たずにコミットし、判断で決まる例外・判定の直し・ISSUES は別のコミットにする
- テストの絵は一時フォルダに置き、`assets/` の絵を読ませない（`tests/test_no_live_assets.py` が落とす）。一時フォルダは `tests/unit_fixture.py` の `UnitFixture`（`Workspace` の `TemporaryDirectory`）と `addCleanup` で消す
- 今ある道具（validate・compose・body_check・hand_mirror・unit_check・weapon_check）のコードは書き換えない。`weapon_check.py` も docstring と `--arm` の help だけを直す（77 の判断）
- **77（2026-10-16 依頼者の判断）:** `weapon_check.py --arm` は体＋拳の方針と合わないので、今後どのユニットにも使わない。設計の「`--arm` を逆にする」は採らない。理由: 体＋拳では拳が胴に直に接し、袖と胴が同じ `cloak_dark` なので、逆にすると今の絵でロラン 22/22・ガウ 20/21 のコマが落ちる（計画を書く前に測った）。D の敵も芯・武器・拳の部品で組むので腕は残らず、芯に残る袖の名残は `body_check.py` の「胴からはみ出した画素」が拾う
- 設計からの変更（計画で決めた。理由つき）:
  - 設定ファイルの `colours` は `face` だけにする。手の肌は compose の `hand_colours` を使う（同じ色を2か所に書いて食い違わないように）
  - `weapon_check` の指定はカンマ区切りの文字列でなく配列にする（色名とコマ名を1つずつ確かめるため）。`--arm` のキーは持たない
  - `parts` には compose にあるすべての部品を書く（役割が無ければ `{}`）。書き忘れた部品がどの確認にも掛からないまま通らないように
  - 例外の `check` は道具のモジュール名（`validate` `compose` `body_check` `hand_mirror` `unit_check` `weapon_check` `order_check` `blade_height` `still_check` `height_check` `tip_check` `part_chars` `eye_check` `part_outline` `fist_check`）
  - 3 の歩きは、芯の y<28 に加えて部品が `base` と違うものも落とす（SPEC「`walk`: 上半身と剣は `base` のまま」）
- 依頼者はスマホで見る。一覧の画像は PNG を作り、Read で開いて見せる。画像を出すときは、どれを見ればいいかを最初に1行で言う。Artifact・SendUserFile はこのセッションの形では届かない
- コミットは Conventional Commits ＋ 日本語の要約。`git add` はファイルを指定する。push と PR は依頼者の指示があったときだけ。PR は `.github/pull_request_template.md` の5項目
- 進捗台帳は `.superpowers/sdd/2026-10-16-policy-check-tools-pr2/progress.md`（character-tactics の直下）。依頼者の判断と計画からの変更は `Ruling:` 行で書く。計画を終えたら `docs/superpowers/ledgers/2026-10-16-policy-check-tools-pr2.md` に写す
- `rm -rf` はこの環境で拒否される。一時の出力は `/tmp` に新しいフォルダを作って置く
- レビューの Minor も PR の前に直す。最終レビューは Opus のサブエージェントでよい

## Review Focus

- compose にある部品を設定ファイルの `parts` に書き忘れる → その部品がどの確認にも掛からずに黙って通る。止めて終了コード 2（Task 1 の `test_a_part_in_compose_must_be_listed`）
- 例外が、同じ文言の別のコマの失敗まで通す（`left_base` の例外が `left_idle2` を通す、`down:` の行の中の `left_base=` を拾う）→ 行の「:」より前にあるコマの名前だけで突き合わせる（Task 7 の `CoveredByTest`）
- 今ある道具が終了コード 1 を返したのに、入口が「FAIL」の行を見つけられない（出力の形が違う）→ ok と出さず、落ちた1件として出す（Task 7 の `test_exit_1_without_failure_lines_still_fails`）
- compose.py の「差あり」（組み立て結果と違う、手で直したコマ）は「FAIL」で始まらない → 失敗として数える（Task 7 の `test_compose_differences_count_as_failures`）
- 部品を体に隠して何も描かないコマ（ロランの `up_atk_hit` の剣と剣の拳など）→ 拳の大きさ・握りで落とさない（Task 6 の `test_an_empty_part_is_not_checked`）

## 計画を書いた時点の試算

この計画の道具と下の設定ファイルを forge の写し（`/tmp/pr2plan/forge`）で動かした結果。Task 8 で実際に走らせて同じになるかを確かめる（違えば台帳に `Finding:` で書く）。

| 確認 | ロラン | イネス | ガウ |
|---|---|---|---|
| validate・compose・hand_mirror・order_check・blade_height | ok | ok | ok |
| body_check | ok | 32（肩の下の髪。ISSUES に既にある） | 54（頭巾の垂れ・輪郭の切れ目。ISSUES に既にある） |
| unit_check | ok | 1（down の脚の中心。ISSUES に既にある） | ok |
| weapon_check | ok（例外 4） | 走らせない | ok（例外 4） |
| still_check | 2（`left_idle2` (19,5)・`right_idle2` (12,5)） | 5（歩きの y=27 の4コマ・`left_idle2` (12,25)） | ok |
| height_check | ok | ok | 24（背丈 27px。芯の上端 y=4 の頭巾） |
| tip_check | 7 | 23（弦・矢の1画素の線が多い） | ok |
| part_chars | 22（剣の鍔 `H` `J` が芯のベルトと同じ文字） | ok | ok |
| eye_check | 18 | 24 | 12（顔の縁の輪郭を目とみなす。設計で予想した誤検出） |
| part_outline | 8（盾の下の角 1画素） | ok | 1（`dagger_left_atk_wind` (18,19)） |
| fist_check | ok | 2（`up_atk_wind`・`up_atk_draw` の矢の拳が矢に接しない） | ok |

---

### Task 1: 設定ファイルの読み込み `tools/unit_config.py` と試験用の小さなユニット

**Files:**
- Create: `pixel-asset-forge/tools/unit_config.py`
- Create: `pixel-asset-forge/tests/unit_fixture.py`（テストの部品。`test` で始まらないので unittest は読み込まない）
- Test: `pixel-asset-forge/tests/test_unit_config.py`

**Interfaces:**
- Consumes: `compose.load_config(path, root) -> (unit, {名前: FrameSpec})`・`compose.stack_order(layers) -> [int]`（素体は -1）・`compose.compose_frame(body, [(Grid, Layer)]) -> (rows, groups)`・`compose.Layer`（`part`・`z`・`dx`・`dy`・`keep`・`hand`）・`ComposeError`、`gridfile.parse`・`load_palette`・`Grid`（`rows`・`charmap`・`used_chars()`・`path`・`width`・`height`）・`BACKGROUND`・`REPO_ROOT`・`GridError`、テストは `test_compose.Workspace`・`grid_text`
- Produces:
  - `UnitConfigError`、定数 `CORE = "CORE"`・`OUTLINE = "outline"`・`CHECKS`（例外に書ける確認の名前）
  - `load_unit_config(path: Path, root: Path = REPO_ROOT) -> UnitConfig`
  - `UnitConfig`: `unit`・`compose: Path`・`hand: frozenset[str]`（compose の hand_colours）・`face: frozenset[str]`・`items: str`・`parts: dict[str, dict]`・`orders: dict[向き, list[str]]`・`eyes: dict[向き, (上, 下) | None]`・`weapon_check: dict[str, list[str]] | None`・`exceptions: list[dict]`・`frames: dict[str, Frame]`・`root: Path`・`unit_dir`（`root/assets/unit/<unit>`）・`role(部品, キー)`（無ければ None）
  - `Frame`: `name`・`direction`・`state`・`core: Grid`・`parts: dict[部品の名前, Part]`（compose に書いた順）・`order: list[str]`（奥→手前、芯は CORE）・`rows`・`charmap`（組んだコマ）・`core_pixels() -> {(x,y): 色名}`・`composed() -> {(x,y): 色名}`
  - `Part`: `name`・`layer: Layer`・`grid: Grid`・`pixels() -> {(x,y): 色名}`・`chars() -> {(x,y): 文字}`（どちらも dx・dy でずらした後）
  - `part_name(path, direction) -> str`、`points(iterable) -> "(x,y) (x,y)"`（y→x の順）
  - `run_check(argv, description, check, ok_message) -> int`（確認の道具の共通の main。`check(cfg) -> [(名前, 文言)]`。`FAIL 名前: 文言` を stdout に1行ずつ、あれば 1、無ければ ok_message と 0、設定の誤りは `error: …` を stderr と 2。引数は `config` と `--root`）
  - テスト: `unit_fixture.UnitFixture`（`frames`・`checks`・`maps` を書き換えて `write(build=True) -> 設定のパス`、`run(main, *extra) -> (終了コード, 出力)`、`root`、`close()`）、`box`・`core(top=5)`・`sword(dy=0)`・`sword_hand(dy=0)`・`shield()`・`mirror(pixels)`・`MAPS`・`HAND_COLOURS`

- [ ] **Step 1: 試験用の小さなユニットを書く**

`pixel-asset-forge/tests/unit_fixture.py`:

```python
"""ユニットの確認（tools/unit_config.py・unit_rules.py と各確認の道具）のテストで使う、小さなユニット。

既定のユニット t は down と up（up は down の左右反転）の4状態（base・idle2・walk_a・atk_hit）で、
芯（箱）・剣（刃と柄）・剣の拳（3x2）・盾を持ち、どの確認も通る。テストは frames や config を書き換えてから write() する。
グリッドは一時フォルダに置く（assets/ の絵を読まない。CLAUDE.md「回帰テストに現役のアートを参照させない」）。
"""
from __future__ import annotations

import contextlib
import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from compose import main as compose_main  # noqa: E402
from test_compose import Workspace, grid_text  # noqa: E402

MAPS = {
    "core": "o=outline b=skin_base c=cloak_dark_base",
    "sword": "o=outline i=stone_hi k=wood_base",
    "sword_hand": "o=outline a=skin_hi",
    "shield": "o=outline m=metal_hi",
}
HAND_COLOURS = ["skin_hi"]


def box(x0: int, y0: int, x1: int, y1: int, fill: str) -> dict[tuple[int, int], str]:
    """輪郭 o で囲った箱。中を fill で塗る。"""
    return {(x, y): "o" if x in (x0, x1) or y in (y0, y1) else fill
            for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)}


def core(top: int = 5) -> dict:
    return box(12, top, 19, 30, "c")


def sword(dy: int = 0) -> dict:
    pixels = box(21, 5 + dy, 23, 16 + dy, "k")
    for y in range(6 + dy, 13 + dy):
        pixels[(22, y)] = "i"  # 刃は y=6〜12、柄は y=13〜15
    return pixels


def sword_hand(dy: int = 0) -> dict:
    return box(20, 13 + dy, 24, 16 + dy, "a")  # 手の肌は x=21〜23・y=14〜15 の 3x2


def shield() -> dict:
    return box(7, 18, 10, 23, "m")


def mirror(pixels: dict) -> dict:
    return {(31 - x, y): ch for (x, y), ch in pixels.items()}


def default_frames() -> dict[str, dict]:
    walk = core()
    walk[(13, 29)] = "b"  # 脚だけ動かす
    down = {
        "down_base": {"core": core(), "sword": sword(), "sword_hand": sword_hand(), "shield": shield()},
        "down_idle2": {"core": core(), "sword": sword(-2), "sword_hand": sword_hand(-2), "shield": shield()},
        "down_walk_a": {"core": walk, "sword": sword(), "sword_hand": sword_hand(), "shield": shield()},
        "down_atk_hit": {"core": core(), "sword": sword(-4), "sword_hand": sword_hand(-4), "shield": shield()},
    }
    up = {name.replace("down_", "up_"): {key: mirror(pixels) for key, pixels in layers.items()}
          for name, layers in down.items()}
    return {**down, **up}


def default_checks() -> dict:
    order = ["CORE", "sword", "sword_hand", "shield"]
    return {
        "unit": "t",
        "compose": "compose/t.json",
        "colours": {"face": []},
        "items": "ikm",
        "parts": {
            "sword": {"weapon": True, "blade": "i", "moves": True},
            "sword_hand": {"fist": True, "grips": "sword", "fist_sizes": ["3x2"], "moves": True},
            "shield": {"fixed": True},
        },
        "orders": {"down": list(order), "up": list(order)},
        "eyes": {"down": None, "up": None},
        "weapon_check": None,
        "exceptions": [],
    }


class UnitFixture:
    """frames: コマの名前 → {"core": 画素, 部品の名前: 画素}（部品は書いた順に front で重ねる）。"""

    def __init__(self) -> None:
        self.ws = Workspace()
        self.root = self.ws.root
        self.frames = default_frames()
        self.checks = default_checks()
        self.maps = dict(MAPS)

    def close(self) -> None:
        self.ws.close()

    def write(self, build: bool = True) -> Path:
        """グリッド・compose/t.json・checks/t.json を書き、build なら assets/unit/t/ にコマを組む。設定のパスを返す。"""
        frames = {}
        for name, layers in self.frames.items():
            direction, state = name.split("_", 1)
            body = self.ws.write(f"assets/part/body/t/core_{name}.txt", grid_text(layers["core"], self.maps["core"]))
            parts = []
            for key, pixels in layers.items():
                if key == "core":
                    continue
                path = self.ws.write(f"assets/part/x/{key}_{direction}_{state}.txt",
                                     grid_text(pixels, self.maps[key]))
                layer = {"part": str(path), "z": "front"}
                if key.endswith("_hand"):
                    layer["hand"] = True
                parts.append(layer)
            frames[name] = {"body": str(body), "layers": parts}
        compose_path = self.ws.write("compose/t.json", json.dumps(
            {"unit": "t", "hand_colours": HAND_COLOURS, "frames": frames}))
        if build:
            with contextlib.redirect_stdout(io.StringIO()):
                code = compose_main([str(compose_path), "--out", str(self.root / "assets/unit/t"), "--force"])
            assert code == 0, "既定のユニットが組めない"
        return self.ws.write("checks/t.json", json.dumps(self.checks, ensure_ascii=False))

    def run(self, main, *extra: str) -> tuple[int, str]:
        """道具の main を設定のパスで呼び、(終了コード, stdout と stderr) を返す。"""
        path = self.write()
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            code = main([str(path), "--root", str(self.root), *extra])
        return code, out.getvalue()
```

- [ ] **Step 2: 失敗するテストを書く**

`pixel-asset-forge/tests/test_unit_config.py`:

```python
"""Checks for tools/unit_config.py (ユニットの確認の設定ファイル checks/<ユニット>.json)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import UnitConfigError, load_unit_config, run_check  # noqa: E402
from unit_fixture import UnitFixture  # noqa: E402


class LoadTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def load(self):
        return load_unit_config(self.fx.write(build=False), self.fx.root)

    def assertConfigError(self, text: str):
        with self.assertRaises(UnitConfigError) as caught:
            self.load()
        self.assertIn(text, str(caught.exception))

    def test_the_default_unit_loads_frames_parts_and_orders(self):
        cfg = self.load()
        self.assertEqual(sorted(cfg.frames), ["down_atk_hit", "down_base", "down_idle2", "down_walk_a",
                                              "up_atk_hit", "up_base", "up_idle2", "up_walk_a"])
        frame = cfg.frames["down_idle2"]
        self.assertEqual((frame.direction, frame.state), ("down", "idle2"))
        self.assertEqual(list(frame.parts), ["sword", "sword_hand", "shield"])
        self.assertEqual(cfg.hand, frozenset({"skin_hi"}))  # compose の hand_colours
        self.assertEqual(cfg.unit_dir, self.fx.root / "assets" / "unit" / "t")

    def test_the_stack_order_names_parts_by_the_file_name_before_the_direction(self):
        cfg = self.load()
        self.assertEqual(cfg.frames["down_base"].order, ["CORE", "sword", "sword_hand", "shield"])

    def test_unknown_top_level_key(self):
        self.fx.checks["colour"] = {}
        self.assertConfigError("知らないキー colour")

    def test_missing_top_level_key(self):
        del self.fx.checks["eyes"]
        self.assertConfigError("キーが無い eyes")

    def test_unit_must_match_compose(self):
        self.fx.checks["unit"] = "u"
        self.assertConfigError("'u'")

    def test_unknown_part(self):
        self.fx.checks["parts"]["spear"] = {}
        self.assertConfigError("知らないキー spear")

    def test_a_part_in_compose_must_be_listed(self):
        del self.fx.checks["parts"]["shield"]
        self.assertConfigError("shield が無い")

    def test_unknown_role_key(self):
        self.fx.checks["parts"]["shield"] = {"fixd": True}
        self.assertConfigError("知らないキー fixd")

    def test_blade_char_not_in_the_part_files(self):
        self.fx.checks["parts"]["sword"]["blade"] = "iz"
        self.assertConfigError("部品のファイルに無い文字 z")

    def test_weapon_needs_a_blade(self):
        del self.fx.checks["parts"]["sword"]["blade"]
        self.assertConfigError("blade")

    def test_grips_must_name_a_part(self):
        self.fx.checks["parts"]["sword_hand"]["grips"] = "spear"
        self.assertConfigError("無い部品 'spear'")

    def test_fist_size_must_look_like_3x2(self):
        self.fx.checks["parts"]["sword_hand"]["fist_sizes"] = ["3*2"]
        self.assertConfigError("3x2 の形でない")

    def test_order_with_an_unknown_part(self):
        self.fx.checks["orders"]["down"] = ["CORE", "spear"]
        self.assertConfigError("無い部品 spear")

    def test_order_for_a_direction_without_frames(self):
        self.fx.checks["orders"]["left"] = ["CORE"]
        self.assertConfigError("知らないキー left")

    def test_order_missing_for_a_direction(self):
        del self.fx.checks["orders"]["up"]
        self.assertConfigError("orders.up")

    def test_colour_not_in_the_palette(self):
        self.fx.checks["colours"]["face"] = ["skin_bse"]
        self.assertConfigError("パレットに無い色名 skin_bse")

    def test_eyes_need_face_colours(self):
        self.fx.checks["eyes"]["down"] = [11, 12]
        self.assertConfigError("colours.face")

    def test_eyes_must_be_two_rows(self):
        self.fx.checks["colours"]["face"] = ["skin_base"]
        self.fx.checks["eyes"]["down"] = [12, 11]
        self.assertConfigError("eyes.down")

    def test_weapon_check_colour_and_frame_names_are_checked(self):
        base = {"blade": ["stone_hi"], "hand": ["skin_hi"]}
        for extra, text in (({"weapon": ["wood_bse"]}, "wood_bse"), ({"hidden": ["down_atk_wind"]}, "down_atk_wind"),
                            ({"depth": ["side"]}, "side")):
            with self.subTest(text):
                self.fx.checks["weapon_check"] = {**base, **extra}
                self.assertConfigError(text)

    def test_exception_with_an_unknown_check(self):
        self.fx.checks["exceptions"] = [{"check": "order", "frames": ["down_base"], "what": "x", "why": "y",
                                         "approved": "2026-10-16 依頼者"}]
        self.assertConfigError("知らない確認 'order'")

    def test_exception_needs_why_and_approved(self):
        self.fx.checks["exceptions"] = [{"check": "order_check", "frames": ["down_base"], "what": "x"}]
        self.assertConfigError("キーが無い")



class RunCheckTest(unittest.TestCase):
    """確認の道具の共通の main（run_check）。"""

    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def run_check(self, check) -> tuple[int, str]:
        return self.fx.run(lambda argv: run_check(argv, "テスト", check, "テスト: ok"))

    def test_no_failures_exit_0(self):
        code, out = self.run_check(lambda cfg: [])
        self.assertEqual((code, out), (0, "テスト: ok\n"))

    def test_failures_are_printed_one_per_line_and_exit_1(self):
        code, out = self.run_check(lambda cfg: [("down_base", "a"), ("up_base", "b")])
        self.assertEqual((code, out), (1, "FAIL down_base: a\nFAIL up_base: b\n"))

    def test_a_config_error_exits_2(self):
        self.fx.checks["colour"] = {}
        code, out = self.run_check(lambda cfg: [])
        self.assertEqual(code, 2)
        self.assertIn("error: ", out)
        self.assertIn("知らないキー colour", out)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: テストが落ちることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_unit_config 2>&1 | tail -3`
Expected: `ModuleNotFoundError: No module named 'unit_config'`

- [ ] **Step 4: 読み込みを書く**

`pixel-asset-forge/tools/unit_config.py`:

```python
"""ユニットの確認の設定ファイル checks/<ユニット>.json を読む（2026-10-16）。

設定ファイルは確認の道具（tools/order_check.py ほか）と入口 tools/unit_rules.py が読む。形は
docs/superpowers/specs/2026-10-16-policy-check-tools-design.md の「ユニットごとの設定ファイル」。

    {
      "unit": "gau",
      "compose": "compose/gau.json",
      "colours": {"face": ["skin_rose_hi", ...]},
      "items": "stlmn",
      "parts": {"dagger": {"weapon": true, "blade": "st", "moves": true}, ...},
      "orders": {"down": ["CORE", "dagger", ...], ...},
      "eyes": {"down": [11, 12], "up": null, ...},
      "weapon_check": {"blade": [...], "weapon": [...], "hand": [...], "hidden": [...], "depth": [...], "partial": [...]},
      "exceptions": [{"check": "...", "frames": [...], "what": "...", "why": "...", "approved": "2026-10-16 依頼者"}]
    }

手の肌の色は compose の設定の hand_colours を使う（同じ色を2か所に書かない）。
知らないキー・無い部品・compose にあるのに parts に無い部品・無いコマ・パレットに無い色名・部品のファイルに無い文字は
UnitConfigError（道具は終了コード 2）。parts の役割:

- weapon: 刃のある武器（blade に刃の文字）。2 切っ先の高さ
- fist: 拳。grips（握る部品）・fist_sizes（手の肌の外接矩形「横x縦」）は 81
- moves: 待機の2コマ目に base から動いてよい。fixed: どのコマでも動かない。3・4
- open_chars: 体の上で輪郭を付けない文字（弓の弦）。33

部品の名前は、部品のファイル名の「_<向き>_」より前（dagger_hand_down_base.txt → dagger_hand）。芯は CORE。
exceptions の check は CHECKS の名前（道具のモジュール名）。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from compose import ComposeError, FrameSpec, Layer, compose_frame, load_config, stack_order  # noqa: E402
from gridfile import BACKGROUND, REPO_ROOT, Grid, GridError, load_palette, parse  # noqa: E402

CORE = "CORE"
OUTLINE = "outline"
DIRECTIONS = ("down", "up", "left", "right")
CHECKS = ("validate", "compose", "body_check", "hand_mirror", "unit_check", "weapon_check",
          "order_check", "blade_height", "still_check", "height_check", "tip_check", "part_chars", "eye_check",
          "part_outline", "fist_check")
CONFIG_KEYS = {"unit", "compose", "colours", "items", "parts", "orders", "eyes", "weapon_check", "exceptions"}
COLOUR_KEYS = {"face"}
PART_KEYS = {"weapon", "blade", "fist", "grips", "fist_sizes", "moves", "fixed", "open_chars"}
WEAPON_CHECK_KEYS = {"blade", "weapon", "hand", "hidden", "depth", "partial"}
EXCEPTION_KEYS = {"check", "frames", "what", "why", "approved"}
SIZE_RE = re.compile(r"^(\d+)x(\d+)$")

Point = tuple[int, int]


class UnitConfigError(Exception):
    """設定ファイルの誤り（終了コード 2）。"""


@dataclass
class Part:
    name: str
    layer: Layer
    grid: Grid

    def pixels(self) -> dict[Point, str]:
        """コマの上の位置（dx・dy でずらした後）→ 色名。"""
        return {(x + self.layer.dx, y + self.layer.dy): self.grid.charmap[ch]
                for y, row in enumerate(self.grid.rows) for x, ch in enumerate(row) if ch != BACKGROUND}

    def chars(self) -> dict[Point, str]:
        """コマの上の位置 → 文字。"""
        return {(x + self.layer.dx, y + self.layer.dy): ch
                for y, row in enumerate(self.grid.rows) for x, ch in enumerate(row) if ch != BACKGROUND}


@dataclass
class Frame:
    name: str
    direction: str
    state: str
    core: Grid
    parts: dict[str, Part]          # 部品の名前 → 部品（設定に書いた順）
    order: list[str]                # 奥→手前の部品の名前（芯は CORE）
    rows: list[str]                 # 組んだコマ
    charmap: dict[str, str]         # 組んだコマの文字 → 色名

    def core_pixels(self) -> dict[Point, str]:
        return {(x, y): self.core.charmap[ch] for y, row in enumerate(self.core.rows)
                for x, ch in enumerate(row) if ch != BACKGROUND}

    def composed(self) -> dict[Point, str]:
        return {(x, y): self.charmap[ch] for y, row in enumerate(self.rows)
                for x, ch in enumerate(row) if ch != BACKGROUND}


@dataclass
class UnitConfig:
    path: Path
    unit: str
    compose: Path
    hand: frozenset[str]
    face: frozenset[str]
    items: str
    parts: dict[str, dict]
    orders: dict[str, list[str]]
    eyes: dict[str, tuple[int, int] | None]
    weapon_check: dict[str, list[str]] | None
    exceptions: list[dict]
    frames: dict[str, Frame]
    root: Path

    @property
    def unit_dir(self) -> Path:
        return self.root / "assets" / "unit" / self.unit

    def role(self, part: str, key: str):
        return self.parts.get(part, {}).get(key)


def part_name(path: Path, direction: str) -> str:
    marker = f"_{direction}_"
    if marker not in path.stem:
        raise UnitConfigError(f"{path.name}: ファイル名に「{marker}」が無いので部品の名前が分からない")
    return path.stem.split(marker)[0]


def _keys(data, allowed: set[str], where: str) -> None:
    if not isinstance(data, dict):
        raise UnitConfigError(f"{where}: オブジェクトでない")
    unknown = sorted(set(data) - allowed)
    if unknown:
        raise UnitConfigError(f"{where}: 知らないキー {', '.join(unknown)}（使えるのは {', '.join(sorted(allowed))}）")


def _names(value, where: str) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(v, str) and v for v in value):
        raise UnitConfigError(f"{where}: 文字列の配列でない: {value!r}")
    return value


def _colours(value, palette, where: str) -> frozenset[str]:
    names = _names(value, where)
    missing = [n for n in names if n not in palette]
    if missing:
        raise UnitConfigError(f"{where}: パレットに無い色名 {', '.join(missing)}")
    return frozenset(names)


def build_frame(name: str, spec: FrameSpec) -> Frame:
    direction, _, state = name.partition("_")
    if direction not in DIRECTIONS or not state:
        raise UnitConfigError(f"{name}: コマの名前が <向き>_<状態> でない")
    core = parse(spec.body)
    parts: dict[str, Part] = {}
    for layer in spec.layers:
        key = part_name(layer.part, direction)
        if key == CORE or key in parts:
            raise UnitConfigError(f"{name}: 部品の名前 {key} が2回ある（または CORE）")
        parts[key] = Part(key, layer, parse(layer.part))
    names = list(parts)
    order = [CORE if i < 0 else names[i] for i in stack_order(spec.layers)]
    rows, groups = compose_frame(core, [(p.grid, p.layer) for p in parts.values()])
    charmap = {ch: colour for group in groups for ch, colour in group}
    return Frame(name, direction, state, core, parts, order, rows, charmap)


def load_unit_config(path: Path, root: Path = REPO_ROOT) -> UnitConfig:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise UnitConfigError(f"{path}: 読めない: {exc}") from None
    except json.JSONDecodeError as exc:
        raise UnitConfigError(f"{path}: JSON として読めない: {exc}") from None
    _keys(data, CONFIG_KEYS, str(path))
    missing = sorted(CONFIG_KEYS - set(data))
    if missing:
        raise UnitConfigError(f"{path}: キーが無い {', '.join(missing)}")
    if not isinstance(data["unit"], str) or not isinstance(data["compose"], str):
        raise UnitConfigError(f"{path}: unit と compose は文字列")

    try:
        palette = load_palette()
        compose_path = root / data["compose"]
        unit, specs = load_config(compose_path, root)
        if unit != data["unit"]:
            raise UnitConfigError(f"{path}: unit {data['unit']!r} が {data['compose']} の {unit!r} と違う")
        frames = {name: build_frame(name, spec) for name, spec in specs.items()}
    except (ComposeError, GridError) as exc:
        raise UnitConfigError(str(exc)) from None
    hand = next(iter(specs.values())).hand_colours

    _keys(data["colours"], COLOUR_KEYS, f"{path.name} の colours")
    face = _colours(data["colours"].get("face", []), palette, f"{path.name} の colours.face")
    if not isinstance(data["items"], str):
        raise UnitConfigError(f"{path.name} の items: 文字列でない")

    known = {key for frame in frames.values() for key in frame.parts}
    _keys(data["parts"], known, f"{path.name} の parts（部品の名前）")
    unlisted = sorted(known - set(data["parts"]))
    if unlisted:  # 書き忘れた部品が、どの確認にも掛からないまま通らないように
        raise UnitConfigError(f"{path.name} の parts: compose にある部品 {', '.join(unlisted)} が無い（役割が無ければ {{}}）")
    chars_of = {key: set() for key in known}
    for frame in frames.values():
        for key, part in frame.parts.items():
            chars_of[key] |= part.grid.used_chars()
    for key, role in data["parts"].items():
        where = f"{path.name} の parts.{key}"
        _keys(role, PART_KEYS, where)
        for flag in ("weapon", "fist", "moves", "fixed"):
            if not isinstance(role.get(flag, False), bool):
                raise UnitConfigError(f"{where}.{flag}: true か false")
        for text_key in ("blade", "open_chars"):
            text = role.get(text_key, "")
            if not isinstance(text, str):
                raise UnitConfigError(f"{where}.{text_key}: 文字列でない")
            absent = sorted(set(text) - chars_of[key])
            if absent:
                raise UnitConfigError(f"{where}.{text_key}: 部品のファイルに無い文字 {''.join(absent)}")
        if role.get("weapon") and not role.get("blade"):
            raise UnitConfigError(f"{where}: weapon には blade（刃の文字）が要る")
        if "grips" in role and role["grips"] not in known:
            raise UnitConfigError(f"{where}.grips: 無い部品 {role['grips']!r}")
        for size in _names(role.get("fist_sizes", []), f"{where}.fist_sizes"):
            if not SIZE_RE.match(size):
                raise UnitConfigError(f"{where}.fist_sizes: 3x2 の形でない: {size!r}")
        if ("grips" in role or "fist_sizes" in role) and not role.get("fist"):
            raise UnitConfigError(f"{where}: grips・fist_sizes は fist の部品にだけ書ける")

    directions = {frame.direction for frame in frames.values()}
    _keys(data["orders"], set(directions), f"{path.name} の orders")
    orders = {}
    for direction in sorted(directions):
        order = _names(data["orders"].get(direction), f"{path.name} の orders.{direction}")
        absent = sorted(set(order) - known - {CORE})
        if absent:
            raise UnitConfigError(f"{path.name} の orders.{direction}: 無い部品 {', '.join(absent)}")
        orders[direction] = order

    _keys(data["eyes"], set(directions), f"{path.name} の eyes")
    eyes = {}
    for direction in sorted(directions):
        value = data["eyes"].get(direction)
        if value is not None and not (isinstance(value, list) and len(value) == 2
                                      and all(isinstance(v, int) and not isinstance(v, bool) for v in value)
                                      and 0 <= value[0] <= value[1] < 32):
            raise UnitConfigError(f"{path.name} の eyes.{direction}: [上の行, 下の行] か null: {value!r}")
        eyes[direction] = tuple(value) if value is not None else None
    if any(eyes.values()) and not face:
        raise UnitConfigError(f"{path.name}: eyes があるのに colours.face（顔の肌の色名）が無い")

    weapon_check = data["weapon_check"]
    if weapon_check is not None:
        where = f"{path.name} の weapon_check"
        _keys(weapon_check, WEAPON_CHECK_KEYS, where)
        weapon_check = {key: _names(value, f"{where}.{key}") for key, value in weapon_check.items()}
        for key in ("blade", "weapon", "hand"):
            _colours(weapon_check.get(key, []), palette, f"{where}.{key}")
        for key in ("blade", "hand"):
            if not weapon_check.get(key):
                raise UnitConfigError(f"{where}.{key}: 空にできない")
        for key in ("hidden", "partial"):
            absent = sorted(set(weapon_check.get(key, [])) - set(frames))
            if absent:
                raise UnitConfigError(f"{where}.{key}: 無いコマ {', '.join(absent)}")
        absent = sorted(set(weapon_check.get("depth", [])) - set(DIRECTIONS))
        if absent:
            raise UnitConfigError(f"{where}.depth: 向きでない {', '.join(absent)}")

    if not isinstance(data["exceptions"], list):
        raise UnitConfigError(f"{path.name} の exceptions: 配列でない")
    for i, exception in enumerate(data["exceptions"]):
        where = f"{path.name} の exceptions[{i}]"
        _keys(exception, EXCEPTION_KEYS, where)
        if sorted(EXCEPTION_KEYS - set(exception)):
            raise UnitConfigError(f"{where}: キーが無い {', '.join(sorted(EXCEPTION_KEYS - set(exception)))}")
        if exception["check"] not in CHECKS:
            raise UnitConfigError(f"{where}.check: 知らない確認 {exception['check']!r}（{', '.join(CHECKS)}）")
        _names(exception["frames"], f"{where}.frames")
        for key in ("what", "why", "approved"):
            if not isinstance(exception[key], str) or not exception[key]:
                raise UnitConfigError(f"{where}.{key}: 空でない文字列")

    return UnitConfig(path, data["unit"], compose_path, hand, face, data["items"], data["parts"], orders, eyes,
                      weapon_check, data["exceptions"], frames, root)


def run_check(argv: list[str] | None, description: str, check, ok_message: str) -> int:
    """確認の道具の共通の main。check(cfg) -> [(名前, 文言)]。FAIL を1行ずつ出し、あれば終了コード 1。"""
    parser =argparse.ArgumentParser(description=description, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("config", type=Path, help="checks/<ユニット>.json")
    parser.add_argument("--root", type=Path, default=REPO_ROOT, help="設定のパスの基準（既定はリポジトリの直下）")
    args = parser.parse_args(argv)
    try:
        cfg = load_unit_config(args.config, args.root)
        failures = check(cfg)
    except UnitConfigError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    for name, message in failures:
        print(f"FAIL {name}: {message}")
    if failures:
        return 1
    print(ok_message)
    return 0


def points(found) -> str:
    return " ".join(f"({x},{y})" for x, y in sorted(found, key=lambda p: (p[1], p[0])))
```

- [ ] **Step 5: テストが通ることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_unit_config 2>&1 | tail -3`
Expected: `Ran 24 tests` と `OK`

- [ ] **Step 6: Commit**

```bash
git add pixel-asset-forge/tools/unit_config.py pixel-asset-forge/tests/unit_fixture.py pixel-asset-forge/tests/test_unit_config.py
git commit -m "feat: ユニットの確認の設定ファイル checks/<ユニット>.json を読む unit_config.py を足す"
```

### Task 2: 1 重なり順・2 切っ先の高さ・5 背丈（`order_check.py`・`blade_height.py`・`height_check.py`）

3つとも「コマごとに1つの値を測って、設定の値と比べる」だけの小さな道具。

**Files:**
- Create: `pixel-asset-forge/tools/order_check.py`・`pixel-asset-forge/tools/blade_height.py`・`pixel-asset-forge/tools/height_check.py`
- Test: `pixel-asset-forge/tests/test_order_check.py`・`test_blade_height.py`・`test_height_check.py`

**Interfaces:**
- Consumes: Task 1 の `UnitConfig`（`frames`・`orders`・`role`）・`Frame`（`order`・`direction`・`state`・`parts`・`core_pixels()`）・`Part.chars()`・`run_check`、テストは `UnitFixture`・`core`・`sword`・`mirror`
- Produces: 各モジュールの `check(cfg) -> list[tuple[str, str]]` と `main(argv) -> int`。文言:
  - `order_check`: `重なり順が承認と違う（今 a,b、承認 c,d）`、ok は `重なり順: ok`
  - `blade_height`: `<部品> の切っ先が y=<y>（y=<上限> より上に出さない）`、ok は `切っ先の高さ: ok`
  - `height_check`: `背丈 <h>px（芯の上端 y=<y>。24〜26px にする）`、ok は `背丈: ok`

- [ ] **Step 1: 失敗するテストを書く**

`pixel-asset-forge/tests/test_order_check.py`:

```python
"""Checks for tools/order_check.py (1 承認された重なり順)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from order_check import main  # noqa: E402
from unit_fixture import UnitFixture  # noqa: E402


class OrderCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_the_approved_order_passes(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("重なり順: ok", out)

    def test_a_changed_order_fails_every_frame_of_that_direction(self):
        self.fx.checks["orders"]["up"] = ["CORE", "shield", "sword", "sword_hand"]
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertEqual(out.count("FAIL up_"), 4)
        self.assertNotIn("FAIL down_", out)
        self.assertIn("FAIL up_base: 重なり順が承認と違う（今 CORE,sword,sword_hand,shield、"
                      "承認 CORE,shield,sword,sword_hand）", out)


if __name__ == "__main__":
    unittest.main()
```

`pixel-asset-forge/tests/test_blade_height.py`:

```python
"""Checks for tools/blade_height.py (2 切っ先の高さ)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from blade_height import main  # noqa: E402
from unit_fixture import UnitFixture, mirror, sword  # noqa: E402


class BladeHeightTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_blade_at_y5_and_idle2_at_y3_pass(self):
        self.fx.frames["down_base"]["sword"] = sword(-1)   # 刃の上端 y=5（その上の輪郭 y=4 は刃でない）
        self.fx.frames["down_idle2"]["sword"] = sword(-3)  # 刃の上端 y=3
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("切っ先の高さ: ok", out)

    def test_blade_above_y5_fails(self):
        self.fx.frames["down_base"]["sword"] = sword(-2)  # 刃の上端 y=4
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: sword の切っ先が y=4（y=5 より上に出さない）", out)

    def test_idle2_above_y3_fails(self):
        self.fx.frames["up_idle2"]["sword"] = mirror(sword(-4))  # 刃の上端 y=2
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL up_idle2: sword の切っ先が y=2（y=3 より上に出さない）", out)

    def test_attack_frames_are_not_checked(self):
        self.fx.frames["down_atk_hit"]["sword"] = sword(-5)  # 刃の上端 y=1
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
```

`pixel-asset-forge/tests/test_height_check.py`:

```python
"""Checks for tools/height_check.py (5 背丈 24〜26px)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from height_check import main  # noqa: E402
from unit_fixture import UnitFixture, core  # noqa: E402


class HeightCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_24_to_26_pass(self):
        for top in (5, 6, 7):  # 26・25・24px
            with self.subTest(top=top):
                self.fx.frames["down_base"]["core"] = core(top)
                code, out = self.fx.run(main)
                self.assertEqual(code, 0, out)

    def test_27_and_23_fail(self):
        for top, height in ((4, 27), (8, 23)):
            with self.subTest(top=top):
                self.fx.frames["down_walk_a"]["core"] = core(top)
                code, out = self.fx.run(main)
                self.assertEqual(code, 1)
                self.assertIn(f"FAIL down_walk_a: 背丈 {height}px（芯の上端 y={top}。24〜26px にする）", out)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_order_check tests.test_blade_height tests.test_height_check 2>&1 | tail -3`
Expected: `ModuleNotFoundError`（`order_check`・`blade_height`・`height_check`）で3件とも ERROR

- [ ] **Step 3: 道具を書く**

`pixel-asset-forge/tools/order_check.py`:

```python
#!/usr/bin/env python3
"""承認された重なり順と、compose の設定の重なり順が同じかを確かめる（2026-10-16。方針の確認 1）。

    .venv/bin/python tools/order_check.py checks/gau.json

各コマの重なり順（compose.py の stack_order で奥→手前に並べた部品の名前。芯は CORE）が、
設定ファイルの orders のその向きの並びと違えば落とす。承認された重なり順を作業する側が変えない
（types/unit/SPEC.md「部品で組む規約」）。順を変えるときは、依頼者の承認を得てから orders も書き換える。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import UnitConfig, run_check  # noqa: E402


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    for name, frame in cfg.frames.items():
        approved = cfg.orders[frame.direction]
        if frame.order != approved:
            failures.append((name, f"重なり順が承認と違う（今 {','.join(frame.order)}、承認 {','.join(approved)}）"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "重なり順: ok")


if __name__ == "__main__":
    raise SystemExit(main())
```

`pixel-asset-forge/tools/blade_height.py`:

```python
#!/usr/bin/env python3
"""攻撃以外のコマで、切っ先が頭頂より上に出ていないかを確かめる（2026-10-16。方針の確認 2）。

    .venv/bin/python tools/blade_height.py checks/roran.json

設定ファイルの parts で weapon の部品の、blade の文字の画素（部品のファイルで測る。体に隠れる所も含む）の
一番上が、y=5 より上（idle2 は y=3 より上）にあれば落とす。攻撃（atk_*）のコマは y=0 まで出てよいので見ない
（types/unit/SPEC.md「立ち絵4方向の規約」「アニメの規約」）。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import UnitConfig, run_check  # noqa: E402

TOP = 5
IDLE2_TOP = 3


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    for name, frame in cfg.frames.items():
        if frame.state.startswith("atk"):
            continue
        limit = IDLE2_TOP if frame.state == "idle2" else TOP
        for key, part in frame.parts.items():
            if not cfg.role(key, "weapon"):
                continue
            blade = set(cfg.role(key, "blade"))
            ys = [y for (_x, y), ch in part.chars().items() if ch in blade]
            if ys and min(ys) < limit:
                failures.append((name, f"{key} の切っ先が y={min(ys)}（y={limit} より上に出さない）"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "切っ先の高さ: ok")


if __name__ == "__main__":
    raise SystemExit(main())
```

`pixel-asset-forge/tools/height_check.py`:

```python
#!/usr/bin/env python3
"""芯（体）の背丈が 24〜26px かを確かめる（2026-10-16。方針の確認 5）。

    .venv/bin/python tools/height_check.py checks/gau.json

芯の部品の一番上の画素の行から、足元 y=30 までの行数（30 − 上端 + 1）が 24〜26 でないコマを落とす
（types/unit/SPEC.md「確定している規約」）。足元が y=30 にあるかは sheet.py のプレビューが測る。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import UnitConfig, run_check  # noqa: E402

FOOT = 30
MIN_HEIGHT, MAX_HEIGHT = 24, 26


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    for name, frame in cfg.frames.items():
        ys = [y for _x, y in frame.core_pixels()]
        if not ys:
            failures.append((name, "芯に画素が無い"))
            continue
        height = FOOT - min(ys) + 1
        if not MIN_HEIGHT <= height <= MAX_HEIGHT:
            failures.append((name, f"背丈 {height}px（芯の上端 y={min(ys)}。{MIN_HEIGHT}〜{MAX_HEIGHT}px にする）"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "背丈: ok")


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_order_check tests.test_blade_height tests.test_height_check 2>&1 | tail -3`
Expected: `Ran 8 tests` と `OK`

- [ ] **Step 5: Commit**

```bash
git add pixel-asset-forge/tools/order_check.py pixel-asset-forge/tools/blade_height.py pixel-asset-forge/tools/height_check.py \
    pixel-asset-forge/tests/test_order_check.py pixel-asset-forge/tests/test_blade_height.py pixel-asset-forge/tests/test_height_check.py
git commit -m "feat: 重なり順・切っ先の高さ・背丈を確かめる道具を足す"
```

### Task 3: 3 待機・歩きで動かない所、4 盾（`still_check.py`）

**Files:**
- Create: `pixel-asset-forge/tools/still_check.py`
- Test: `pixel-asset-forge/tests/test_still_check.py`

**Interfaces:**
- Consumes: Task 1 の `UnitConfig`（`frames`・`hand`・`role`）・`Frame`（`core_pixels()`・`parts`・`direction`・`state`）・`Part.pixels()`・`points`・`run_check`、テストは `UnitFixture`・`box`・`shield`・`sword_hand`
- Produces: `check(cfg)`・`main(argv)`。文言 `芯が base と違う画素 <n> 件: …`（idle2）・`芯の y<28 が base と違う画素 <n> 件: …`（walk）・`<部品> が base と違う（どのコマでも動かさない部品）`（fixed）・`<部品> が base と違う（このコマでは動かさない部品）`（idle2 の moves でない部品・walk の部品）・`比べる <向き>_base が無い`・`<部品> が <向き>_base に無い`。ok は `動かない所: ok`

- [ ] **Step 1: 失敗するテストを書く**

`pixel-asset-forge/tests/test_still_check.py`:

```python
"""Checks for tools/still_check.py (3 待機・歩きで動かない所、4 盾)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from still_check import main  # noqa: E402
from unit_fixture import UnitFixture, box, shield, sword_hand  # noqa: E402


class StillCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_the_default_unit_passes(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("動かない所: ok", out)

    def test_idle2_core_change_fails(self):
        self.fx.frames["down_idle2"]["core"][(15, 10)] = "b"
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_idle2: 芯が base と違う画素 1 件: (15,10)", out)

    def test_idle2_may_fill_where_the_base_fist_skin_was(self):
        # base の拳の手の肌（x=21〜23, y=14〜15）の位置は、拳がどいた胴を埋めてよい
        self.fx.frames["down_idle2"]["core"][(21, 14)] = "c"
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_idle2_part_that_does_not_move_fails(self):
        self.fx.checks["parts"]["sword_hand"]["moves"] = False
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_idle2: sword_hand が base と違う（このコマでは動かさない部品）", out)

    def test_walk_upper_body_change_fails_but_legs_pass(self):
        self.fx.frames["down_walk_a"]["core"][(13, 27)] = "b"
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_walk_a: 芯の y<28 が base と違う画素 1 件: (13,27)", out)
        self.assertNotIn("(13,29)", out)  # 既定の脚の動き

    def test_walk_part_change_fails(self):
        self.fx.frames["down_walk_a"]["sword_hand"] = sword_hand(-1)
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_walk_a: sword_hand が base と違う（このコマでは動かさない部品）", out)

    def test_fixed_part_moved_in_an_attack_fails(self):
        self.fx.frames["down_atk_hit"]["shield"] = box(7, 17, 10, 22, "m")
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_atk_hit: shield が base と違う（どのコマでも動かさない部品）", out)

    def test_attack_parts_that_are_not_fixed_may_move(self):
        self.fx.frames["down_atk_hit"]["shield"] = box(7, 17, 10, 22, "m")
        self.fx.checks["parts"]["shield"] = {}
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_a_direction_without_base_fails(self):
        for name in ("up_base", "up_idle2", "up_walk_a"):
            del self.fx.frames[name]
        self.fx.frames["up_atk_hit"]["shield"] = shield()
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL up_atk_hit: 比べる up_base が無い", out)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_still_check 2>&1 | tail -3`
Expected: `ModuleNotFoundError: No module named 'still_check'`

- [ ] **Step 3: 道具を書く**

`pixel-asset-forge/tools/still_check.py`:

```python
#!/usr/bin/env python3
"""待機の2コマ目・歩き・すべてのコマで、動かしてはいけない所が base から動いていないかを確かめる
（2026-10-16。方針の確認 3 と 4）。

    .venv/bin/python tools/still_check.py checks/roran.json

同じ向きの <向き>_base と比べる（types/unit/SPEC.md「アニメの規約」）:

- idle2: 芯が base と違う画素のうち、base の拳（fist の部品）の手の肌の位置に無いもの
  （拳がどいて見えるようになった胴を埋めた所は通す）。moves でない部品が base と違うもの
- walk_*: 芯の y<=27 が base と違う画素（脚 y=28〜30 だけを動かす）。部品が base と違うもの（上半身と剣は base のまま）
- すべてのコマ: fixed の部品（盾）が base と違うもの（盾はどのコマでも base の位置から動かさない）

部品は色名と位置（dx・dy でずらした後）で比べる。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import UnitConfig, points, run_check  # noqa: E402

LEG_TOP = 28


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    for name, frame in cfg.frames.items():
        base = cfg.frames.get(f"{frame.direction}_base")
        if base is None:
            failures.append((name, f"比べる {frame.direction}_base が無い"))
            continue
        if frame is base:
            continue
        mine, theirs = frame.core_pixels(), base.core_pixels()
        moved = {p for p in mine.keys() | theirs.keys() if mine.get(p) != theirs.get(p)}
        walk = frame.state.startswith("walk")
        if frame.state == "idle2":
            freed = {p for key, part in base.parts.items() if cfg.role(key, "fist")
                     for p, colour in part.pixels().items() if colour in cfg.hand}
            bad = moved - freed
            if bad:
                failures.append((name, f"芯が base と違う画素 {len(bad)} 件: {points(bad)}"))
        elif walk:
            bad = {p for p in moved if p[1] < LEG_TOP}
            if bad:
                failures.append((name, f"芯の y<{LEG_TOP} が base と違う画素 {len(bad)} 件: {points(bad)}"))
        for key, part in frame.parts.items():
            fixed = cfg.role(key, "fixed")
            if not (fixed or walk or (frame.state == "idle2" and not cfg.role(key, "moves"))):
                continue
            if key not in base.parts:
                failures.append((name, f"{key} が {base.name} に無い"))
            elif part.pixels() != base.parts[key].pixels():
                rule = "どのコマでも動かさない" if fixed else "このコマでは動かさない"
                failures.append((name, f"{key} が base と違う（{rule}部品）"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "動かない所: ok")


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_still_check 2>&1 | tail -3`
Expected: `Ran 9 tests` と `OK`

- [ ] **Step 5: Commit**

```bash
git add pixel-asset-forge/tools/still_check.py pixel-asset-forge/tests/test_still_check.py
git commit -m "feat: 待機・歩きで動かない所と盾が base から動いていないかを確かめる道具を足す"
```

### Task 4: 6 1画素の先端・9 部品の文字（`tip_check.py`・`part_chars.py`）

**Files:**
- Create: `pixel-asset-forge/tools/tip_check.py`・`pixel-asset-forge/tools/part_chars.py`
- Test: `pixel-asset-forge/tests/test_tip_check.py`・`test_part_chars.py`

**Interfaces:**
- Consumes: Task 1 の `UnitConfig`・`Frame.composed()`・`Frame.core`（`used_chars()`）・`Part.grid`・`OUTLINE`・`points`・`run_check`、テストは `UnitFixture`
- Produces: `check(cfg)`・`main(argv)`。文言 `輪郭に囲まれた1画素 <n> 件: …`（ok は `1画素の先端: ok`）、`<部品> が芯と同じ文字 <文字> を使う`（ok は `部品の文字: ok`）

compose.py は「同じ文字に別の色」を止めるので、9 が拾うのは「同じ文字・同じ色」（ロランの鍔とベルトの `H`・`J` の形）。

- [ ] **Step 1: 失敗するテストを書く**

`pixel-asset-forge/tests/test_tip_check.py`:

```python
"""Checks for tools/tip_check.py (6 輪郭に囲まれた1画素)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from tip_check import main  # noqa: E402
from unit_fixture import UnitFixture  # noqa: E402


class TipCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_the_default_unit_passes(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_a_pixel_with_outline_on_all_four_sides_fails(self):
        # 盾の上に1画素の先端: (8,16) の上下左右を輪郭にする
        self.fx.frames["down_base"]["shield"].update(
            {(8, 16): "m", (8, 15): "o", (7, 16): "o", (9, 16): "o", (8, 17): "o"})
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: 輪郭に囲まれた1画素 1 件: (8,16)", out)

    def test_the_frame_edge_is_not_outline(self):
        self.fx.frames["down_base"]["shield"].update({(0, 16): "m", (0, 15): "o", (1, 16): "o", (0, 17): "o"})
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_it_looks_at_the_composed_frame(self):
        # 部品の上では3方向だけ輪郭でも、手前の部品の輪郭で4方向目がふさがれば落ちる
        self.fx.frames["down_base"]["shield"].update({(8, 16): "m", (8, 15): "o", (7, 16): "o", (8, 17): "o"})
        self.fx.frames["down_base"]["sword_hand"][(9, 16)] = "o"
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("(8,16)", out)


if __name__ == "__main__":
    unittest.main()
```

`pixel-asset-forge/tests/test_part_chars.py`:

```python
"""Checks for tools/part_chars.py (9 部品の文字が芯と重ならない)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from part_chars import main  # noqa: E402
from unit_fixture import UnitFixture  # noqa: E402


class PartCharsTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_the_default_unit_passes(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_a_part_using_a_core_char_fails(self):
        # 芯のベルトと剣の柄が同じ文字 k（同じ wood_base）。ロランの鍔とベルトの H・J と同じ形
        self.fx.maps["core"] = "o=outline b=skin_base c=cloak_dark_base k=wood_base"
        for layers in self.fx.frames.values():
            layers["core"][(13, 24)] = "k"
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: sword が芯と同じ文字 k を使う", out)
        self.assertEqual(out.count("FAIL"), 8)

    def test_the_fist_skin_may_share_the_core_char(self):
        # 拳の手の肌（hand_colours）は芯の肌と同じ文字でよい
        self.fx.maps["core"] = "o=outline b=skin_base c=cloak_dark_base a=skin_hi"
        self.fx.frames["down_base"]["core"][(13, 20)] = "a"
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_the_fist_with_a_non_skin_core_char_fails(self):
        self.fx.maps["sword_hand"] = "o=outline a=skin_hi c=cloak_dark_base"
        self.fx.frames["down_base"]["sword_hand"][(26, 14)] = "c"  # 拳の外の袖の名残
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: sword_hand が芯と同じ文字 c を使う", out)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_tip_check tests.test_part_chars 2>&1 | tail -3`
Expected: `ModuleNotFoundError`（`tip_check`・`part_chars`）

- [ ] **Step 3: 道具を書く**

`pixel-asset-forge/tools/tip_check.py`:

```python
#!/usr/bin/env python3
"""組んだコマで、輪郭に囲まれた1画素（尖った先端を1画素で表したもの）を出す（2026-10-16。方針の確認 6）。

    .venv/bin/python tools/tip_check.py checks/ines.json

組んだコマ（compose の結果）で、輪郭でない色の画素のうち、上下左右がすべて輪郭のものを落とす
（types/unit/SPEC.md「自己チェック」②「尖った先端を、輪郭に囲まれた1画素で表していないか」）。
コマの外は輪郭とみなさない。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import OUTLINE, UnitConfig, points, run_check  # noqa: E402

N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    for name, frame in cfg.frames.items():
        pixels = frame.composed()
        found = {p for p, colour in pixels.items() if colour != OUTLINE
                 and all(pixels.get((p[0] + dx, p[1] + dy)) == OUTLINE for dx, dy in N4)}
        if found:
            failures.append((name, f"輪郭に囲まれた1画素 {len(found)} 件: {points(found)}"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "1画素の先端: ok")


if __name__ == "__main__":
    raise SystemExit(main())
```

`pixel-asset-forge/tools/part_chars.py`:

```python
#!/usr/bin/env python3
"""芯以外の部品が、同じコマの芯と同じ文字を使っていないかを確かめる（2026-10-16。方針の確認 9）。

    .venv/bin/python tools/part_chars.py checks/roran.json

持ち物の部品には専用の文字を割り当てる（types/unit/SPEC.md「立ち絵4方向の規約」）。同じ文字だと、
# map: 行で片方だけ色を変えられない。輪郭 o と、fist の部品の手の肌（compose の hand_colours）の文字は除く。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import UnitConfig, run_check  # noqa: E402

SHARED_OK = {"o"}


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    for name, frame in cfg.frames.items():
        core = frame.core.used_chars()
        for key, part in frame.parts.items():
            shared = (part.grid.used_chars() & core) - SHARED_OK
            if cfg.role(key, "fist"):
                shared = {ch for ch in shared if part.grid.charmap[ch] not in cfg.hand}
            if shared:
                failures.append((name, f"{key} が芯と同じ文字 {''.join(sorted(shared))} を使う"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "部品の文字: ok")


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_tip_check tests.test_part_chars 2>&1 | tail -3`
Expected: `Ran 8 tests` と `OK`

- [ ] **Step 5: Commit**

```bash
git add pixel-asset-forge/tools/tip_check.py pixel-asset-forge/tools/part_chars.py \
    pixel-asset-forge/tests/test_tip_check.py pixel-asset-forge/tests/test_part_chars.py
git commit -m "feat: 輪郭に囲まれた1画素と、芯と同じ文字を使う部品を出す道具を足す"
```

### Task 5: 12 目（`eye_check.py`）

設計の解釈どおり、目の行で「片側だけ顔の肌の輪郭」を目とみなす。顔の左右の縁の輪郭も目とみなされる誤検出は、試算でロラン 18・イネス 24・ガウ 12 件。数えて依頼者に見せ、多ければ ISSUES に「道具にしない」と理由を書いて閉じる（設計「依頼者に確かめた解釈」）。道具の側で縁を見分ける工夫はこの Task ではしない。

**Files:**
- Create: `pixel-asset-forge/tools/eye_check.py`
- Test: `pixel-asset-forge/tests/test_eye_check.py`

**Interfaces:**
- Consumes: Task 1 の `UnitConfig`（`eyes`・`face`）・`Frame.core_pixels()`・`OUTLINE`・`points`・`run_check`、テストは `UnitFixture`
- Produces: `check(cfg)`・`main(argv)`。文言 `目の左右の片方が顔の肌でない <n> 件: …`・`目が見つからない（y=<上>〜<下>）`・状態の名前で `目の上端の行が向きでそろわない: down=10 up=11`。ok は `目: ok`

- [ ] **Step 1: 失敗するテストを書く**

`pixel-asset-forge/tests/test_eye_check.py`:

```python
"""Checks for tools/eye_check.py (12 目)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from eye_check import main  # noqa: E402
from unit_fixture import UnitFixture  # noqa: E402


def face(core: dict, eyes: list[int], top: int = 10) -> dict:
    """芯の y=top〜top+1 の x=13〜18 を顔の肌 b にし、eyes の列に目（輪郭）を2行描く。
    顔の左右（x=12・19）は髪の代わりに服の色 c にする（顔の縁の輪郭を目とみなさないように）。"""
    for y in (top, top + 1):
        core[(12, y)] = core[(19, y)] = "c"
        for x in range(13, 19):
            core[(x, y)] = "o" if x in eyes else "b"
    return core


class EyeCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)
        self.fx.checks["colours"]["face"] = ["skin_base"]
        self.fx.checks["eyes"]["down"] = [10, 11]
        for name, layers in self.fx.frames.items():
            if name.startswith("down_"):
                face(layers["core"], [14, 17])

    def test_eyes_between_face_skin_pass(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("目: ok", out)

    def test_an_eye_touching_something_else_fails(self):
        self.fx.frames["down_base"]["core"][(18, 10)] = "c"  # 右目の右が服
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: 目の左右の片方が顔の肌でない 1 件: (17,10)", out)

    def test_no_eye_in_a_direction_with_eyes_fails(self):
        face(self.fx.frames["down_idle2"]["core"], [])
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_idle2: 目が見つからない（y=10〜11）", out)

    def test_eye_top_rows_must_match_across_directions(self):
        self.fx.checks["eyes"]["up"] = [10, 12]
        for name, layers in self.fx.frames.items():
            if name.startswith("up_"):
                face(layers["core"], [14, 17], top=11)
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL base: 目の上端の行が向きでそろわない: down=10 up=11", out)

    def test_directions_without_eyes_are_skipped(self):
        self.fx.checks["eyes"]["down"] = None
        self.fx.frames["down_base"]["core"][(18, 10)] = "c"
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_eye_check 2>&1 | tail -3`
Expected: `ModuleNotFoundError: No module named 'eye_check'`

- [ ] **Step 3: 道具を書く**

`pixel-asset-forge/tools/eye_check.py`:

```python
#!/usr/bin/env python3
"""芯の目の置き方を確かめる（2026-10-16。方針の確認 12）。

    .venv/bin/python tools/eye_check.py checks/gau.json

目と輪郭は同じ outline の色なので、設定ファイルの eyes に向きごとの目の行（[上の行, 下の行]、目の無い向きは null）を書く。
その行の輪郭の画素のうち、左右のどちらかが顔の肌（colours.face）のものを目とみなし、

- もう片方の隣が顔の肌でない目（髪・かぶり物・顔の輪郭に横で接する。types/unit/SPEC.md「自己チェック」②）
- 目の上端の行が、同じ状態のコマの間で向きによってそろわないもの（「立ち絵4方向の規約」の顔）
- 目のある向きなのに目が見つからないコマ

を落とす。顔の左右の縁の輪郭も「片側だけ肌の輪郭」なので目とみなされる（設計で予想した誤検出。数えて採否を決める）。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import OUTLINE, UnitConfig, points, run_check  # noqa: E402


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    tops: dict[str, dict[str, int]] = {}
    for name, frame in cfg.frames.items():
        rows = cfg.eyes[frame.direction]
        if rows is None:
            continue
        pixels = frame.core_pixels()
        eyes, bad = set(), set()
        for (x, y), colour in pixels.items():
            if colour != OUTLINE or not rows[0] <= y <= rows[1]:
                continue
            left, right = pixels.get((x - 1, y)) in cfg.face, pixels.get((x + 1, y)) in cfg.face
            if left or right:
                eyes.add((x, y))
                if not (left and right):
                    bad.add((x, y))
        if not eyes:
            failures.append((name, f"目が見つからない（y={rows[0]}〜{rows[1]}）"))
            continue
        if bad:
            failures.append((name, f"目の左右の片方が顔の肌でない {len(bad)} 件: {points(bad)}"))
        tops.setdefault(frame.state, {})[frame.direction] = min(y for _x, y in eyes)
    for state, by_direction in tops.items():
        if len(set(by_direction.values())) > 1:
            detail = " ".join(f"{d}={y}" for d, y in by_direction.items())
            failures.append((state, f"目の上端の行が向きでそろわない: {detail}"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "目: ok")


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_eye_check 2>&1 | tail -3`
Expected: `Ran 5 tests` と `OK`

- [ ] **Step 5: Commit**

```bash
git add pixel-asset-forge/tools/eye_check.py pixel-asset-forge/tests/test_eye_check.py
git commit -m "feat: 目の左右の隣と目の上端の行を確かめる道具を足す"
```

### Task 6: 33 部品が閉じている・81 拳の大きさと握り（`part_outline.py`・`fist_check.py`）

**Files:**
- Create: `pixel-asset-forge/tools/part_outline.py`・`pixel-asset-forge/tools/fist_check.py`
- Test: `pixel-asset-forge/tests/test_part_outline.py`・`test_fist_check.py`

**Interfaces:**
- Consumes: Task 1 の `UnitConfig`（`role`・`hand`）・`Part`（`grid`・`layer.part`・`pixels()`）・`OUTLINE`・`points`・`run_check`、`gridfile.BACKGROUND`、テストは `UnitFixture`・`box`
- Produces: `check(cfg)`・`main(argv)`。
  - `part_outline`: 名前は部品のファイル名（拡張子なし。例 `shield_down_base`）、文言 `輪郭で閉じていない画素 <n> 件: …`。同じファイルを使い回すコマ（歩き）は1回だけ出す。ok は `部品が閉じている: ok`
  - `fist_check`: `<拳> の大きさ <横x縦>（<許す大きさ> のどれでもない）`・`<拳> が <部品> に接していない`・`<拳> が握る <部品> がこのコマに無い`。ok は `拳の大きさと握り: ok`

- [ ] **Step 1: 失敗するテストを書く**

`pixel-asset-forge/tests/test_part_outline.py`:

```python
"""Checks for tools/part_outline.py (33 拳以外の部品が輪郭で閉じている)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from part_outline import main  # noqa: E402
from unit_fixture import UnitFixture  # noqa: E402


class PartOutlineTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_closed_parts_pass(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_an_open_pixel_fails_once_per_file(self):
        del self.fx.frames["down_base"]["shield"][(7, 20)]  # 盾の左の輪郭に穴: (8,20) が透明に接する
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL shield_down_base: 輪郭で閉じていない画素 1 件: (8,20)", out)
        self.assertEqual(out.count("FAIL"), 1)

    def test_the_frame_edge_counts_as_open(self):
        self.fx.frames["down_base"]["shield"][(0, 5)] = "m"
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("(0,5)", out)

    def test_open_chars_are_not_checked(self):
        del self.fx.frames["down_base"]["sword"][(23, 8)]  # 刃の右の輪郭を外す
        self.fx.checks["parts"]["sword"]["open_chars"] = "i"
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_fists_are_left_to_compose(self):
        self.fx.checks["parts"]["sword_hand"]["fist"] = True
        self.fx.frames["down_base"]["sword_hand"][(30, 30)] = "o"  # 拳は見ない（compose.py が見る）
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
```

`pixel-asset-forge/tests/test_fist_check.py`:

```python
"""Checks for tools/fist_check.py (81 拳の大きさと握り)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fist_check import main  # noqa: E402
from unit_fixture import UnitFixture, box  # noqa: E402


class FistCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_the_default_unit_passes(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("拳の大きさと握り: ok", out)

    def test_a_fist_of_another_size_fails(self):
        self.fx.frames["down_base"]["sword_hand"] = box(20, 13, 23, 16, "a")  # 2x2
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: sword_hand の大きさ 2x2（3x2 のどれでもない）", out)

    def test_any_listed_size_passes(self):
        self.fx.frames["down_base"]["sword_hand"] = box(20, 13, 23, 16, "a")
        self.fx.checks["parts"]["sword_hand"]["fist_sizes"] = ["3x2", "2x2"]
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_a_fist_away_from_what_it_grips_fails(self):
        self.fx.frames["down_base"]["sword_hand"] = box(24, 20, 28, 23, "a")  # 剣（x=21〜23）から1列あく
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: sword_hand が sword に接していない", out)

    def test_a_diagonal_touch_is_a_touch(self):
        self.fx.frames["down_base"]["sword_hand"] = box(24, 17, 28, 20, "a")  # (24,17) が剣の角 (23,16) の斜め
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_an_empty_part_is_not_checked(self):
        self.fx.frames["down_atk_hit"]["sword"] = {}
        self.fx.frames["down_atk_hit"]["sword_hand"] = {}
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_part_outline tests.test_fist_check 2>&1 | tail -3`
Expected: `ModuleNotFoundError`（`part_outline`・`fist_check`）

- [ ] **Step 3: 道具を書く**

`pixel-asset-forge/tools/part_outline.py`:

```python
#!/usr/bin/env python3
"""拳と芯以外の部品（武器・弓・矢・盾）を単品で見て、輪郭で閉じているかを確かめる（2026-10-16。確認 33）。

    .venv/bin/python tools/part_outline.py checks/ines.json

部品は単品として完全に描く（types/unit/SPEC.md「部品で組む規約」）。部品のファイルごとに、
輪郭でない色の画素のうち、上下左右のどれかが透明かコマの外のものを落とす。
体の上で輪郭を付けない文字（弓の弦など）は、設定ファイルの parts の open_chars に書いて外す。
拳は compose.py の hand: true が、芯は body_check.py が見る。名前は部品のファイル名（拡張子なし）で出す。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import BACKGROUND  # noqa: E402
from unit_config import OUTLINE, UnitConfig, points, run_check  # noqa: E402

N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    seen = set()
    for frame in cfg.frames.values():
        for key, part in frame.parts.items():
            if cfg.role(key, "fist") or part.layer.part in seen:
                continue
            seen.add(part.layer.part)
            grid = part.grid
            skip = set(cfg.role(key, "open_chars") or "")

            def at(x: int, y: int) -> str:
                return grid.rows[y][x] if 0 <= x < grid.width and 0 <= y < grid.height else BACKGROUND

            found = {(x, y) for y, row in enumerate(grid.rows) for x, ch in enumerate(row)
                     if ch != BACKGROUND and ch not in skip and grid.charmap[ch] != OUTLINE
                     and any(at(x + dx, y + dy) == BACKGROUND for dx, dy in N4)}
            if found:
                failures.append((part.layer.part.stem, f"輪郭で閉じていない画素 {len(found)} 件: {points(found)}"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "部品が閉じている: ok")


if __name__ == "__main__":
    raise SystemExit(main())
```

`pixel-asset-forge/tools/fist_check.py`:

```python
#!/usr/bin/env python3
"""拳の部品の大きさと、握る部品に接しているかを確かめる（2026-10-16。確認 81）。

    .venv/bin/python tools/fist_check.py checks/gau.json

設定ファイルの parts で fist の部品について（types/unit/SPEC.md「武器を握る手は、他の手と同じ大きさ」「持ち物を持つ手を描く」）:

- 手の肌（compose の hand_colours）の画素の外接矩形「横x縦」が fist_sizes のどれでもないもの
- grips のある拳が、握る部品の画素と、重なりも上下左右・斜めの隣り合いもしていないもの
  （どちらかが空の部品のコマは見ない。体に隠れて何も描かないコマ）

拳の手の肌が無い（空の部品の）コマは、大きさを見ない。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import UnitConfig, run_check  # noqa: E402

TOUCH = tuple((dx, dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1))


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    failures = []
    for name, frame in cfg.frames.items():
        for key, part in frame.parts.items():
            if not cfg.role(key, "fist"):
                continue
            pixels = part.pixels()
            skin = [p for p, colour in pixels.items() if colour in cfg.hand]
            sizes = cfg.role(key, "fist_sizes")
            if skin and sizes:
                xs, ys = [x for x, _ in skin], [y for _, y in skin]
                size = f"{max(xs) - min(xs) + 1}x{max(ys) - min(ys) + 1}"
                if size not in sizes:
                    failures.append((name, f"{key} の大きさ {size}（{', '.join(sizes)} のどれでもない）"))
            grips = cfg.role(key, "grips")
            if grips:
                held = frame.parts.get(grips)
                if held is None:
                    failures.append((name, f"{key} が握る {grips} がこのコマに無い"))
                    continue
                theirs = held.pixels()
                if pixels and theirs and not any((x + dx, y + dy) in theirs for x, y in pixels for dx, dy in TOUCH):
                    failures.append((name, f"{key} が {grips} に接していない"))
    return failures


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "拳の大きさと握り: ok")


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_part_outline tests.test_fist_check 2>&1 | tail -3`
Expected: `Ran 11 tests` と `OK`

- [ ] **Step 5: Commit**

```bash
git add pixel-asset-forge/tools/part_outline.py pixel-asset-forge/tools/fist_check.py \
    pixel-asset-forge/tests/test_part_outline.py pixel-asset-forge/tests/test_fist_check.py
git commit -m "feat: 拳以外の部品が輪郭で閉じているかと、拳の大きさと握りを確かめる道具を足す"
```

### Task 7: まとめて走らせる入口 `tools/unit_rules.py`

**Files:**
- Create: `pixel-asset-forge/tools/unit_rules.py`
- Test: `pixel-asset-forge/tests/test_unit_rules.py`

**Interfaces:**
- Consumes: Task 1 の `load_unit_config`・`UnitConfigError`・`UnitConfig`（`frames`・`compose`・`unit_dir`・`items`・`weapon_check`・`exceptions`）、Task 2〜6 の各道具の `main(argv)`、今ある道具の `main(argv)`: `validate`（`-q` と対象）・`compose`（`CONFIG --check --out DIR`）・`body_check`（芯の置き場）・`hand_mirror`（`CONFIG --root ROOT`）・`unit_check`（`DIR --items`）・`weapon_check`（`DIR --blade … --weapon … --hand … --hidden … --depth … --partial …`）
- Produces: `main(argv) -> int`（0・1・2）、`plan(cfg, config, root) -> [(確認の名前, argv | None)]`、`failure_lines(name, text) -> [行]`（`FAIL ` で始まる行。compose は `差あり ` で始まる行）、`covered_by(line, exception) -> bool`、`run(name, argv) -> (終了コード, 出力)`、定数 `NEW_CHECKS`。Task 8 の画像の道具がこの4つを使う

compose.py は `--root` を持たず、部品のパスを forge の直下から読む。入口は `--out` にコマの置き場を渡すだけにして、compose.py は書き換えない（テストのユニットは compose の設定に絶対パスを書くので、どこからでも読める）。

- [ ] **Step 1: 失敗するテストを書く**

`pixel-asset-forge/tests/test_unit_rules.py`:

```python
"""Checks for tools/unit_rules.py (ユニットの方針の確認をまとめて走らせる入口)."""
from __future__ import annotations

import contextlib
import io
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import unit_rules  # noqa: E402
from unit_config import load_unit_config  # noqa: E402
from unit_fixture import UnitFixture, core  # noqa: E402
from unit_rules import covered_by, main, plan  # noqa: E402

TALL = 4  # 芯の上端 y=4 → 背丈 27px（height_check が全コマで落ちる）


def exception(check="height_check", frames=("down_base",), what="背丈 27px"):
    return {"check": check, "frames": list(frames), "what": what, "why": "テスト", "approved": "2026-10-16 依頼者"}


class UnitRulesTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def make_tall(self):
        for layers in self.fx.frames.values():  # 脚（y>=28）は今のまま、上端だけ y=4 へ
            layers["core"] = core(TALL) | {p: ch for p, ch in layers["core"].items() if p[1] >= 28}

    def run_written(self, cfg_path: Path) -> tuple[int, str]:
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            code = main([str(cfg_path), "--root", str(self.fx.root)])
        return code, out.getvalue()

    def test_the_default_unit_passes_every_check(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        for name in ("validate", "compose", "body_check", "hand_mirror", "unit_check", "order_check",
                     "blade_height", "still_check", "height_check", "tip_check", "part_chars", "eye_check",
                     "part_outline", "fist_check"):
            self.assertIn(f"ok   {name}", out)
        self.assertIn("--   weapon_check: 設定に無いので走らせない", out)

    def test_failures_not_in_exceptions_exit_1_and_are_listed(self):
        self.make_tall()
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("NG   height_check: 落ちた 8 件", out)
        self.assertIn("       FAIL down_base: 背丈 27px", out)

    def test_exceptions_pass_matching_lines_and_are_counted(self):
        self.make_tall()
        self.fx.checks["exceptions"] = [exception(frames=[n for n in self.fx.frames])]
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("ok   height_check（例外で通した 8 件）", out)

    def test_a_partial_exception_leaves_the_rest(self):
        self.make_tall()
        self.fx.checks["exceptions"] = [exception(frames=["down_base", "up_base"])]
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("NG   height_check: 落ちた 6 件（例外で通した 2 件）", out)

    def test_an_exception_for_another_check_does_not_apply(self):
        self.make_tall()
        self.fx.checks["exceptions"] = [exception(check="tip_check", frames=list(self.fx.frames))]
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("使われなかった例外: tip_check", out)

    def test_an_unused_exception_is_reported_but_does_not_fail(self):
        self.fx.checks["exceptions"] = [exception()]
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("使われなかった例外: height_check down_base 「背丈 27px」", out)

    def test_compose_differences_count_as_failures(self):
        self.fx.write()
        frame = self.fx.root / "assets/unit/t/down_base.txt"
        frame.write_text(frame.read_text(encoding="utf-8").replace("# map:", "# 手で直した\n# map:", 1),
                         encoding="utf-8")
        code, out = self.run_written(self.fx.root / "checks/t.json")
        self.assertEqual(code, 1)
        self.assertIn("NG   compose: 落ちた 1 件", out)
        self.assertIn("差あり down_base", out)

    def test_exit_1_without_failure_lines_still_fails(self):
        real = unit_rules.run

        def fake(name, argv):
            return (1, "何かがおかしい\n") if name == "tip_check" else real(name, argv)

        with mock.patch.object(unit_rules, "run", fake):
            code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("（tip_check が終了コード 1 を返したが、失敗の行が無い）", out)

    def test_a_tool_stopping_on_bad_input_exits_2(self):
        with mock.patch.object(unit_rules, "run", lambda name, argv: (2, "error: 読めない\n")):
            code, out = self.fx.run(main)
        self.assertEqual(code, 2)
        self.assertIn("error validate: 終了コード 2", out)

    def test_a_config_error_exits_2(self):
        self.fx.checks["parts"]["spear"] = {}
        code, out = self.fx.run(main)
        self.assertEqual(code, 2)
        self.assertIn("知らないキー spear", out)

    def test_weapon_check_arguments_come_from_the_config(self):
        self.fx.checks["weapon_check"] = {"blade": ["stone_hi"], "weapon": ["wood_base"], "hand": ["skin_hi"],
                                          "hidden": ["down_atk_hit", "up_atk_hit"], "depth": ["down"]}
        path = self.fx.write()
        steps = dict(plan(load_unit_config(path, self.fx.root), path, self.fx.root))
        self.assertEqual(steps["weapon_check"], [
            str(self.fx.root / "assets/unit/t"), "--blade", "stone_hi", "--weapon", "wood_base", "--hand", "skin_hi",
            "--hidden", "down_atk_hit,up_atk_hit", "--depth", "down"])


class CoveredByTest(unittest.TestCase):
    def test_the_frame_name_must_be_before_the_colon(self):
        e = exception(check="weapon_check", frames=["left_base"], what="手が細い")
        self.assertTrue(covered_by("FAIL left_base: 手が細い（1x2px、(21,18) から）", e))
        self.assertFalse(covered_by("FAIL left_idle2: 手が細い（1x2px、(21,16) から）", e))
        self.assertFalse(covered_by("FAIL down: 握る位置がずれる: left_base=3.0", e))

    def test_the_what_must_be_in_the_line(self):
        e = exception(check="weapon_check", frames=["left_base"], what="手が細い（1x2px")
        self.assertFalse(covered_by("FAIL left_base: 手が細い（1x3px、(21,18) から）", e))

    def test_lines_without_a_colon_use_the_whole_line(self):
        e = exception(check="compose", frames=["down_base"], what="差あり")
        self.assertTrue(covered_by("差あり down_base（/x/assets/unit/t/down_base.txt）", e))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_unit_rules 2>&1 | tail -3`
Expected: `ModuleNotFoundError: No module named 'unit_rules'`

- [ ] **Step 3: 入口を書く**

`pixel-asset-forge/tools/unit_rules.py`:

```python
#!/usr/bin/env python3
"""ユニットの方針の確認をまとめて走らせる入口（2026-10-16。types/unit/SPEC.md「自己チェック①」）。

    .venv/bin/python tools/unit_rules.py checks/gau.json

設定ファイル checks/<ユニット>.json（tools/unit_config.py）から引数を組み立て、次の順に各道具の main(argv) を呼ぶ:

1. validate.py（コマ・芯・部品のグリッド）  2. compose.py --check（部品から再現できるか）
3. body_check.py（芯）・hand_mirror.py・unit_check.py・weapon_check.py（設定の weapon_check が null なら走らせない）
4. order_check・blade_height・still_check・height_check・tip_check・part_chars・eye_check・part_outline・fist_check

確認ごとに1行「ok／NG 落ちた件数（例外で通した件数）」を出し、例外で通らなかった失敗の行を続ける。
失敗の行は、道具が出す「FAIL 」（compose.py は「差あり 」）で始まる行。設定ファイルの exceptions の1件は、
check が同じで、行の「:」より前の部分に frames のどれかの名前があり、行に what を含むとき、その行を通す
（what を長く書くほど狭く通す）。使われなかった例外は「使われなかった例外」と出す（終了コードは変えない）。

終了コード: 0 すべて ok か例外で通した、1 例外で通らない失敗がある、2 設定の誤りか、道具が入力の誤りで止まった。
"""
from __future__ import annotations

import argparse
import contextlib
import importlib
import io
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import REPO_ROOT  # noqa: E402
from unit_config import UnitConfig, UnitConfigError, load_unit_config  # noqa: E402

NEW_CHECKS = ("order_check", "blade_height", "still_check", "height_check", "tip_check", "part_chars",
              "eye_check", "part_outline", "fist_check")
NAME_RE = re.compile(r"[A-Za-z0-9_]+")


def plan(cfg: UnitConfig, config: Path, root: Path) -> list[tuple[str, list[str] | None]]:
    """(確認の名前 = 道具のモジュール名, main に渡す引数。None なら走らせない) の並び。"""
    grids = sorted({str(frame.core.path) for frame in cfg.frames.values()}
                   | {str(part.grid.path) for frame in cfg.frames.values() for part in frame.parts.values()})
    cores = {frame.core.path.parent for frame in cfg.frames.values()}
    if len(cores) != 1:
        raise UnitConfigError(f"芯の部品の置き場が1つでない: {', '.join(sorted(map(str, cores)))}")
    steps: list[tuple[str, list[str] | None]] = [
        ("validate", ["-q", str(cfg.unit_dir), *grids]),
        ("compose", [str(cfg.compose), "--check", "--out", str(cfg.unit_dir)]),
        ("body_check", [str(cores.pop())]),
        ("hand_mirror", [str(cfg.compose), "--root", str(root)]),
        ("unit_check", [str(cfg.unit_dir), "--items", cfg.items]),
    ]
    wc = cfg.weapon_check
    if wc is None:
        steps.append(("weapon_check", None))
    else:
        args = [str(cfg.unit_dir)]
        for key in ("blade", "weapon", "hand", "hidden", "depth", "partial"):
            if wc.get(key):
                args += [f"--{key}", ",".join(wc[key])]
        steps.append(("weapon_check", args))
    steps += [(name, [str(config), "--root", str(root)]) for name in NEW_CHECKS]
    return steps


def failure_lines(name: str, text: str) -> list[str]:
    prefix = "差あり " if name == "compose" else "FAIL "
    return [line for line in text.splitlines() if line.startswith(prefix)]


def covered_by(line: str, exception: dict) -> bool:
    head = line.split(":", 1)[0]
    return bool(set(NAME_RE.findall(head)) & set(exception["frames"])) and exception["what"] in line


def run(name: str, argv: list[str]) -> tuple[int, str]:
    module = importlib.import_module(name)
    out = io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
        try:
            code = module.main(argv)
        except SystemExit as exc:  # argparse の誤りや、validate の「ファイルが無い」
            code = exc.code if isinstance(exc.code, int) else 2
    return code, out.getvalue()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("config", type=Path, help="checks/<ユニット>.json")
    parser.add_argument("--root", type=Path, default=REPO_ROOT, help="設定のパスの基準（既定はリポジトリの直下）")
    args = parser.parse_args(argv)
    try:
        cfg = load_unit_config(args.config, args.root)
        steps = plan(cfg, args.config, args.root)
    except UnitConfigError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    used = [0] * len(cfg.exceptions)
    worst = 0
    for name, tool_argv in steps:
        if tool_argv is None:
            print(f"--   {name}: 設定に無いので走らせない")
            continue
        code, text = run(name, tool_argv)
        if code not in (0, 1):
            print(f"error {name}: 終了コード {code}\n{text.rstrip()}", file=sys.stderr)
            worst = 2
            continue
        lines = failure_lines(name, text)
        if code == 1 and not lines:
            lines = [f"（{name} が終了コード 1 を返したが、失敗の行が無い）"]
        left, passed = [], 0
        for line in lines:
            hit = [i for i, e in enumerate(cfg.exceptions) if e["check"] == name and covered_by(line, e)]
            for i in hit:
                used[i] += 1
            if hit:
                passed += 1
            else:
                left.append(line)
        note = f"（例外で通した {passed} 件）" if passed else ""
        if left:
            print(f"NG   {name}: 落ちた {len(left)} 件{note}")
            for line in left:
                print(f"       {line}")
            worst = max(worst, 1)
        else:
            print(f"ok   {name}{note}")
    for i, exception in enumerate(cfg.exceptions):
        if not used[i]:
            print(f"使われなかった例外: {exception['check']} {','.join(exception['frames'])} 「{exception['what']}」")
    return worst


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_unit_rules 2>&1 | tail -3`
Expected: `Ran 14 tests` と `OK`

- [ ] **Step 5: 全体のテストを通す**

Run: `.venv/bin/python -m unittest discover -s tests 2>&1 | grep -E '^(Ran|OK|FAILED)'`
Expected: `Ran 542 tests` と `OK`（`test_no_live_assets` が、新しいテストが `assets/` を読まないことも確かめる）

- [ ] **Step 6: Commit**

```bash
git add pixel-asset-forge/tools/unit_rules.py pixel-asset-forge/tests/test_unit_rules.py
git commit -m "feat: ユニットの方針の確認をまとめて走らせる入口 unit_rules.py を足す"
```

### Task 8: 3体の設定ファイル、全件に掛けて依頼者に決めてもらう

**Files:**
- Create: `pixel-asset-forge/checks/roran.json`・`checks/ines.json`・`checks/gau.json`
- Modify（依頼者の判断しだい）: `checks/*.json` の `exceptions`、`pixel-asset-forge/ISSUES.md`、判定を直す道具とそのテスト、「道具にしない」と決めた道具（ファイルを消し、`unit_rules.NEW_CHECKS` と `unit_config.CHECKS` から外す）
- 作業用（コミットしない）: `/tmp/pr2plan-review/review_png.py`

**Interfaces:**
- Consumes: Task 7 の `plan`・`run`・`failure_lines`・`covered_by`、Task 1 の `load_unit_config`、`phone_sheet.tile(size, pixels, palette, marks)`・`phone_sheet.sheet(rows)`、`gridfile.load_palette`
- Produces: 3体の設定ファイル（D の後に敵の設定ファイルを足すときの手本）

設定ファイルの値は、計画を書くときに実際のファイルから数えた（2026-10-16）:

- `orders`: `compose/<ユニット>.json` の各コマを `stack_order` で並べた順。どのユニットも、同じ向きの全コマで同じ並びだった。ロランとガウは SPEC「部品で組む規約」「短剣の持ち方」の重なり順、イネスは「弓の持ち方」の重なり順と一致する
- `parts`: 部品の名前はファイル名の「_<向き>_」より前。`moves` は、待機の2コマ目の部品が `base` と違う部品（ロラン `sword`・`sword_hand`、イネス `bow`・`arrow`・`arrow_hand`、ガウ `dagger`・`dagger_hand`）。イネスの弓は弦（`stone_hi` とその輪郭）だけが違う（SPEC「弦は矢の尾の行で折れる」）。`fixed` はロランの `shield`（どのコマでも `base` と同じ。盾の拳 `shield_hand` は攻撃で動くので `fixed` にしない）
- `fist_sizes`: 拳の部品の手の肌の外接矩形をコマごとに数えた。ロランは剣の拳・盾の拳とも 22・24 コマが 3x2（剣の拳の2コマは空）、イネスは両手とも 32 コマが 2x2、ガウは短剣の拳が 3x2 20 コマ・2x2 3 コマ（`down_atk_wind`・`left_atk_hit`・`right_atk_hit`。SPEC「`down` の構えと横向きの突きは 2×2」）・空 1、空き手の拳が 2x2 24 コマ
- `blade`: ロランの刃 `i`・`j`（`stone_hi`・`stone_base`）、ガウの刃 `s`・`t`。イネスは刃のある武器を持たない（`weapon` 無し）
- `open_chars`: イネスの弓の弦 `s`（SPEC「弦は体の上を通るところに輪郭を付けない」）
- `eyes`: 芯の `base` で目のある行を見た。ロランは down・left・right が y=11〜12（SPEC「ロランは y = 11」、縦2px）、イネスも down・left・right が y=11〜12、ガウは down・left が y=11〜12、right は目を描かない（SPEC「横顔で前髪が目の列にかかるときは、目を描かずに前髪だけ」）。up はどのユニットも目が無い
- `colours.face`: ロラン・ガウは `skin_rose_hi`・`skin_rose_base`・`skin_rose_shadow`、イネスは `skin_hi`・`skin_base`・`skin_shadow`（芯の顔の色）
- `items`: SPEC「自己チェック①」の実測（ロラン `GHJRkmns`、イネス `klmstuw`、ガウ `stlmn`）
- `weapon_check`: SPEC「自己チェック①」の指定から `--arm` を外したもの。イネスは弓なので `null`（SPEC「弓（イネス）は対象外」）
- `exceptions`: 依頼者がすでに承認したものだけを最初から入れる。ロラン・ガウの `left_{base,idle2,walk_a,walk_b}` の「手が細い（1x2px」（2026-10-15 依頼者承認。ISSUES「ロラン・ガウの left の武器の拳が…」）

- [ ] **Step 1: 設定ファイルを書く**

`pixel-asset-forge/checks/roran.json`:

```json
{
  "unit": "roran",
  "compose": "compose/roran.json",
  "colours": {"face": ["skin_rose_hi", "skin_rose_base", "skin_rose_shadow"]},
  "items": "GHJRkmns",
  "parts": {
    "sword": {"weapon": true, "blade": "ij", "moves": true},
    "sword_hand": {"fist": true, "grips": "sword", "fist_sizes": ["3x2"], "moves": true},
    "shield": {"fixed": true},
    "shield_hand": {"fist": true, "grips": "shield", "fist_sizes": ["3x2"]}
  },
  "orders": {
    "down": ["CORE", "shield_hand", "shield", "sword", "sword_hand"],
    "up": ["sword", "shield", "sword_hand", "shield_hand", "CORE"],
    "left": ["sword", "sword_hand", "CORE", "shield_hand", "shield"],
    "right": ["shield_hand", "shield", "CORE", "sword", "sword_hand"]
  },
  "eyes": {"down": [11, 12], "up": null, "left": [11, 12], "right": [11, 12]},
  "weapon_check": {
    "blade": ["stone_hi", "stone_base"],
    "weapon": ["wood_hi", "wood_base", "wood_shadow", "roof_base"],
    "hand": ["skin_rose_hi", "skin_rose_base", "skin_rose_shadow", "skin_rose_deep"],
    "hidden": ["left_atk_hit", "up_atk_hit"],
    "depth": ["down"]
  },
  "exceptions": [
    {"check": "weapon_check", "frames": ["left_base", "left_idle2", "left_walk_a", "left_walk_b"], "what": "手が細い（1x2px",
     "why": "剣の拳は体の奥で、体の縁から幅1px だけ見える（拳の位置を上下左右で合わせた。ISSUES「ロラン・ガウの left の武器の拳が…」）",
     "approved": "2026-10-15 依頼者"}
  ]
}
```

`pixel-asset-forge/checks/ines.json`:

```json
{
  "unit": "ines",
  "compose": "compose/ines.json",
  "colours": {"face": ["skin_hi", "skin_base", "skin_shadow"]},
  "items": "klmstuw",
  "parts": {
    "bow": {"moves": true, "open_chars": "s"},
    "arrow": {"moves": true},
    "bow_hand": {"fist": true, "grips": "bow", "fist_sizes": ["2x2"]},
    "arrow_hand": {"fist": true, "grips": "arrow", "fist_sizes": ["2x2"], "moves": true}
  },
  "orders": {
    "down": ["CORE", "bow", "arrow", "bow_hand", "arrow_hand"],
    "up": ["arrow", "arrow_hand", "bow", "bow_hand", "CORE"],
    "left": ["bow", "arrow", "arrow_hand", "CORE", "bow_hand"],
    "right": ["CORE", "bow", "bow_hand", "arrow", "arrow_hand"]
  },
  "eyes": {"down": [11, 12], "up": null, "left": [11, 12], "right": [11, 12]},
  "weapon_check": null,
  "exceptions": []
}
```

`pixel-asset-forge/checks/gau.json`:

```json
{
  "unit": "gau",
  "compose": "compose/gau.json",
  "colours": {"face": ["skin_rose_hi", "skin_rose_base", "skin_rose_shadow"]},
  "items": "stlmn",
  "parts": {
    "dagger": {"weapon": true, "blade": "st", "moves": true},
    "dagger_hand": {"fist": true, "grips": "dagger", "fist_sizes": ["3x2", "2x2"], "moves": true},
    "free_hand": {"fist": true, "fist_sizes": ["2x2"]}
  },
  "orders": {
    "down": ["CORE", "dagger", "dagger_hand", "free_hand"],
    "up": ["dagger", "dagger_hand", "free_hand", "CORE"],
    "left": ["dagger", "dagger_hand", "CORE", "free_hand"],
    "right": ["free_hand", "CORE", "dagger", "dagger_hand"]
  },
  "eyes": {"down": [11, 12], "up": null, "left": [11, 12], "right": null},
  "weapon_check": {
    "blade": ["stone_hi", "stone_base"],
    "weapon": ["wood_hi", "wood_base", "wood_shadow"],
    "hand": ["skin_rose_hi", "skin_rose_base", "skin_rose_shadow"],
    "hidden": ["left_atk_wind", "up_atk_wind", "up_atk_hit"],
    "depth": ["down"]
  },
  "exceptions": [
    {"check": "weapon_check", "frames": ["left_base", "left_idle2", "left_walk_a", "left_walk_b"], "what": "手が細い（1x2px",
     "why": "短剣の拳は体の奥で、体の縁から幅1px だけ見える（拳の位置を上下左右で合わせた。ISSUES「ロラン・ガウの left の武器の拳が…」）",
     "approved": "2026-10-15 依頼者"}
  ]
}
```

- [ ] **Step 2: 3体に掛けて、試算と同じかを確かめる**

```bash
mkdir -p /tmp/pr2plan-review
for u in roran ines gau; do .venv/bin/python tools/unit_rules.py checks/$u.json > /tmp/pr2plan-review/rules_$u.txt 2>&1; echo "$u exit $?"; done
grep -hE '^(ok|NG|--|使われ)' /tmp/pr2plan-review/rules_*.txt
```

Expected: 3体とも `exit 1`（設定の誤りの 2 ではない）。`ok`／`NG` の件数が冒頭の「計画を書いた時点の試算」の表と同じ。違えば台帳に `Finding:` で書き、違いの理由を確かめてから進む。

- [ ] **Step 3: 一覧の画像を作る**

`/tmp/pr2plan-review/review_png.py`（作業用。コミットしない）:

```python
"""PR 2 の一覧を依頼者に見せる画像（作業用。コミットしない）。

    .venv/bin/python /tmp/pr2plan-review/review_png.py checks/<ユニット>.json OUTDIR   # forge の直下で

unit_rules.py と同じ順で各道具を走らせ、例外で通らなかった FAIL の行ごとに1行の画像を作る
（左が印なし、右が行の (x,y) の赤枠。決まり「赤枠の絵は印なしも並べる」）。確認ごとに1枚
OUTDIR/<ユニット>_<確認>.png。芯を見る確認（body_check・still_check・height_check・eye_check）は芯、
part_outline は部品のファイル、ほかは組んだコマを描く。名前がコマでも部品でもない行（eye_check の状態など）は文字だけ。
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

FORGE = Path.cwd()
sys.path.insert(0, str(FORGE / "tools"))

from gridfile import BACKGROUND, REPO_ROOT, load_palette  # noqa: E402
from phone_sheet import sheet, tile  # noqa: E402
from unit_config import load_unit_config  # noqa: E402
from unit_rules import covered_by, failure_lines, plan, run  # noqa: E402

CORE_CHECKS = {"body_check", "still_check", "height_check", "eye_check"}
POINT = re.compile(r"\((\d+),(\d+)\)")


def grid_pixels(grid):
    return {(x, y): grid.charmap[ch] for y, row in enumerate(grid.rows) for x, ch in enumerate(row) if ch != BACKGROUND}


def source(cfg, check, name):
    frame_name = name[5:] if name.startswith("core_") else name
    if frame_name in cfg.frames:
        frame = cfg.frames[frame_name]
        return frame.core_pixels() if check in CORE_CHECKS else frame.composed()
    for frame in cfg.frames.values():
        for part in frame.parts.values():
            if part.layer.part.stem == name:
                return grid_pixels(part.grid)
    return None


def main(config: str, outdir: str) -> None:
    cfg = load_unit_config(Path(config), REPO_ROOT)
    palette = load_palette()
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    for check, argv in plan(cfg, Path(config), REPO_ROOT):
        if argv is None:
            continue
        _code, text = run(check, argv)
        left = [line for line in failure_lines(check, text)
                if not any(e["check"] == check and covered_by(line, e) for e in cfg.exceptions)]
        rows = []
        for line in left:
            name = line.split(" ", 1)[1].split(":", 1)[0].split("（")[0].strip()
            pixels = source(cfg, check, name)
            print(f"{cfg.unit} {check}: {line}")
            if pixels is None:
                continue
            marks = [(int(x), int(y)) for x, y in POINT.findall(line.split(":", 1)[-1])]
            rows.append((name, [("plain", tile((32, 32), pixels, palette)),
                                ("marked", tile((32, 32), pixels, palette, marks))]))
        if rows:
            path = out / f"{cfg.unit}_{check}.png"
            sheet(rows).save(path)
            print(f"書いた {path}")


if __name__ == "__main__":
    main(*sys.argv[1:])
```

```bash
for u in roran ines gau; do .venv/bin/python /tmp/pr2plan-review/review_png.py checks/$u.json /tmp/pr2plan-review/png; done
```

確認ごと・ユニットごとに1枚（`/tmp/pr2plan-review/png/<ユニット>_<確認>.png`）。各行が1件で、左が印なし、右が赤枠。

- [ ] **Step 4: 依頼者に一覧を見せて止まる**

確認ごとに、まとめて1回のメッセージで見せる（PR 1 と同じ）。1件ごとに書くこと:

- どのユニットのどのコマで、何が落ちたか（行のまま）
- 私の見立て（方針どおりの絵で道具の判定が合わない＝誤検出か、方針から外れた絵か）と、その根拠（SPEC の該当の規約・ISSUES の既存の行）
- 選択肢: 例外にする（設定ファイルに理由と日付）・絵を直す（ISSUES に立てる）・道具の判定を直す・道具にしない

同じ原因でまとめられるもの（例: ロランの `part_chars` 22 件は鍔とベルトの `H`・`J` の1件、`eye_check` の顔の縁の輪郭）は1件として聞く。
既に ISSUES に行がある失敗（イネス・ガウの `body_check`、イネスの `unit_check`）は、その行を示して「例外にしてその行に任せる」かを聞く。
画像は Read で開き、どれを見ればいいかを最初に1行で言う。**依頼者が決めるまで Step 5 へ進まない。**

- [ ] **Step 5: 決まったことを入れる**

依頼者の判断ごとに:

- 例外にする: その設定ファイルの `exceptions` に1件ずつ足す。`what` は、ほかの失敗を通さない長さにする（座標まで書けるなら書く）。`why` は依頼者の言葉と出どころ、`approved` は「<依頼者が決めた日> 依頼者」（例「2026-10-17 依頼者」）
- 絵を直す: `ISSUES.md` の「絵」の節に1行足し、例外にも入れる（`why` に「ISSUES の行で E に直す」）。絵は直さない
- 道具の判定を直す: その道具のテストに、依頼者が示した絵の形を小さくしたテストを先に足し（落ちることを確かめる）、道具を直して通す
- 道具にしない: その道具とテストのファイルを `git rm` し、`unit_rules.NEW_CHECKS`・`unit_config.CHECKS` と `test_unit_rules.test_the_default_unit_passes_every_check` の並びから外す。`ISSUES.md` に「道具にしない」と理由の行を足す

台帳に1件ずつ `Ruling:` 行で書く。

- [ ] **Step 6: 3体が通ることを確かめる**

```bash
for u in roran ines gau; do .venv/bin/python tools/unit_rules.py checks/$u.json | grep -vE '^(ok|--) '; echo "$u exit ${PIPESTATUS[0]}"; done
.venv/bin/python -m unittest discover -s tests 2>&1 | grep -E '^(Ran|OK|FAILED)'
```

Expected: 3体とも `exit 0`（依頼者が全部決めた後）。`使われなかった例外` が出ないこと。全体のテストが `OK`

- [ ] **Step 7: Commit**

道具の判定の直し・道具を外す変更は、それぞれ1つのコミットにする（`fix: <道具> の判定を…`・`chore: <道具> を道具にしない…`）。
最後に、判断を入れた設定ファイルと ISSUES を1つのコミットにする。

```bash
git add pixel-asset-forge/checks/roran.json pixel-asset-forge/checks/ines.json pixel-asset-forge/checks/gau.json pixel-asset-forge/ISSUES.md
git commit -m "feat: ロラン・イネス・ガウの方針の確認の設定ファイルを足す（既存の絵で落ちたものは依頼者の判断どおり）"
```

### Task 9: 77 `--arm` を使わない・文書・台帳

**Files:**
- Modify: `pixel-asset-forge/tools/weapon_check.py`（docstring と `--arm` の help だけ。コードの動きは変えない）
- Modify: `pixel-asset-forge/types/unit/SPEC.md`・`pixel-asset-forge/README.md`・`pixel-asset-forge/CLAUDE.md`・`pixel-asset-forge/ISSUES.md`
- Create: `docs/superpowers/ledgers/2026-10-16-policy-check-tools-pr2.md`（台帳の写し）

**Interfaces:**
- Consumes: Task 1〜8 の道具の名前と使い方、Task 8 の依頼者の判断（「道具にしない」と決めた確認は、下の文書に書かない）
- Produces: なし（文書）

- [ ] **Step 1: `weapon_check.py` の docstring と help**

docstring の「8. 手が浮かない（--arm を指定したとき）…」の行を次に置き換える:

```
8. 手が浮かない（--arm を指定したとき）: 握る手が、腕の色（袖・腕の肌）と、直にか輪郭1画素を挟んで（斜めも含む）つながる。
   **使わない（2026-10-16 依頼者の判断）。** 体＋拳の方針（2026-10-11）では、拳が体から浮くのも胴に直に接するのも正しく、
   袖と胴が同じ色なので逆にしても使えない（ロラン 22/22・ガウ 20/21 のコマが落ちた）。芯に残る袖の名残は body_check.py の
   「胴からはみ出した画素」が拾う。古いコマを当時の決まりで確かめ直すときのためにコードは残す
```

「ユニットごとの指定は types/unit/SPEC.md の自己チェック①。」を「ロラン・ガウの指定は checks/<ユニット>.json の weapon_check（tools/unit_rules.py が渡す）、敵の指定は types/unit/SPEC.md の自己チェック①。」に置き換える。

`--arm` の help を `"使わない（2026-10-16）。腕の色名（袖・腕の肌）。握る手がこれとつながっているかを確かめる"` にする。

Run: `.venv/bin/python -m unittest tests.test_weapon_check 2>&1 | tail -2`
Expected: `OK`（コードは変えていない）

- [ ] **Step 2: `types/unit/SPEC.md`**

1. 「武器を描くときの決まり」の「振りかぶりで手を上げたら、体と手の間に腕（袖）を描く（空白にしない）。**ロランは 体 + 拳だけの方針（立ち絵の規約）で袖を描かない**」を次に置き換える:
   「振りかぶりで手を上げても、腕（袖）は描かない（体＋拳の方針、2026-10-11。2026-10-07 には体と手の間に袖を描く決まりだった）」
2. 「立ち絵4方向の規約」の「振りかぶりの手と体の間に袖を描き足す規約（下の武器の節）より、こちらが新しい。」を消す（1. で武器の節を直したので、食い違いが無くなる）
3. 「自己チェック」の「**① 道具で測る（見せる前に毎回）**」の段落（`tools/unit_check.py …` から、ガウ・ロランの `weapon_check.py` の sh のブロックまで）を次に置き換える:

   ```markdown
   **① 道具で測る（見せる前に毎回）**: `tools/unit_rules.py checks/<unit>.json`（2026-10-16）。
   設定ファイル `checks/<unit>.json`（`tools/unit_config.py` の docstring に形）を読み、次をまとめて走らせる。例外に書いていない失敗が1つでもあれば終了コード 1、設定の誤りは 2。

   - 構造（`validate.py`）、部品から再現できるか（`compose.py --check`）、芯を単品で見た当たり前（`body_check.py`）、拳の位置の左右反転（`hand_mirror.py`）、
     脚の中心と増えた輪郭の切れ目（`unit_check.py`。切れ目は報告だけで、1件ずつ目で確かめる）、武器と握る手（`weapon_check.py`。片手で握る武器のユニットだけ）
   - 方針の確認: 承認された重なり順（`order_check.py`）、切っ先の高さ（`blade_height.py`）、待機・歩きで動かない所と盾（`still_check.py`）、背丈（`height_check.py`）、
     輪郭に囲まれた1画素（`tip_check.py`）、部品の文字（`part_chars.py`）、目（`eye_check.py`）、拳以外の部品が輪郭で閉じている（`part_outline.py`）、拳の大きさと握り（`fist_check.py`）。
     どれも `tools/<道具>.py checks/<unit>.json` で単独でも走らせられる

   例外（`exceptions`）は、依頼者が絵を見て決めたものだけを、理由と承認した日を付けて1件ずつ書く。重なり順を変えるときは、依頼者の承認を得てから `orders` も書き換える。
   新しいユニットは、部品の名前と役割を数えて設定ファイルを足す（手本は `checks/roran.json`・`ines.json`・`gau.json`）。色を足すときは `tools/probe_colors.py`。

   片手で握る武器（短剣・剣・斧・槍）の `weapon_check.py` は、手が消える・手の輪郭の切れ目・1px 幅の手・攻撃で穂先が向きと逆・枠の端で切れる・握る位置のずれ・武器の長さのずれ・
   拳が柄の真ん中に無い（柄から離れている）・手の輪郭が背景に接している、を落とす。**`--arm`（手が腕とつながっているか）は使わない**
   （2026-10-16 依頼者の判断。体＋拳の方針では拳が体から浮くのも胴に接するのも正しい。芯に残る袖の名残は `body_check.py` の「胴からはみ出した画素」が拾う）。
   部品で組んだユニットの拳の輪郭は `compose.py` の `hand: true` が確かめる（直すのは拳の部品に対する `tools/hand_outline.py`）。
   `--far`・`--ref`（武器を持たせる前のコマ）を付けると、奥の手・腕・武器が体や髪の手前に出ていないか（`--cover` の色は全コマ、
   体と頭は立ち・待機2・歩き）と、奥の拳が影の色か（`--far-shade`）も確かめる（2026-10-08〜09。どれも依頼者に指摘された欠陥、2026-10-07）
   ```

4. 敵の指定の `C="… --arm cloak_dark_hi,cloak_dark_base,cloak_dark_shadow"` から `--arm …` を消す
5. 「`spear-thug-a-f`・`b-f` は2コマが落ちる。`up_atk_hit` は「手が体から浮いている」（…）。`left_idle2` は「手が細い」（…）。」を、`--arm` を外して測り直した結果で書き直す。計画を書いた時点の結果（2026-10-16）: 斧・槍の男性4体と女性の斧5体・槍 c は全部 ok、`spear-thug-a-f`・`b-f` は `left_idle2` の「手が細い（1x2px、(20,16) から）」だけ。次で同じかを確かめてから書く:

   ```bash
   C="--blade stone_hi,stone_base --weapon wood_base,wood_shadow --hand skin_rose_hi,skin_rose_base,skin_rose_shadow"
   F="--far left --cover hair_slate_hi,hair_slate_base,hair_slate_shadow --far-shade skin_rose_shadow"
   UP=up_base,up_idle2,up_walk_a,up_walk_b; LEFT=left_base,left_idle2,left_walk_a,left_walk_b
   P="--partial left_base,left_idle2,left_walk_a,left_walk_b,left_atk_wind"
   for u in spear-thug-a-f spear-thug-b-f; do .venv/bin/python tools/weapon_check.py assets/unit/$u $C --ref assets/unit/$u/noweapon $F --hidden left_atk_hit,left_atk_wind,up_atk_hit,$UP 2>&1 | grep -E 'FAIL|ok$'; done
   ```

   書き直す文: 「`spear-thug-a-f`・`b-f` は `left_idle2` の1コマが「手が細い」で落ちる（奥の拳が長い髪に半分隠れ、1px 幅だけのぞく）。ほかの女性6体は全項目を通る。」
6. 「弓（イネス）は対象外。ガウ・ロランは全項目を通っていた（2026-10-07）。」の後ろの段落はそのまま（ロラン・ガウの「手が細い」は `checks/` の例外に移した、と1文足す）
7. 自己チェック②の「部品の画素が部品の文字で塗られているか」「目（`outline`）の左右の隣が…」「尖った先端を、輪郭に囲まれた1画素で表していないか」の3行の末尾に、それぞれ「（① の `part_chars`・`eye_check`・`tip_check` が候補を出す）」を足す（Task 8 で道具にしないと決めた確認は足さない）

- [ ] **Step 3: `README.md`**

「見せる前に、`tools/unit_check.py` で機械的に確かめられることを確かめる。」から「攻撃 → 構えで、…（`--depth` の向きは奥行きの表現として除く）」までを次に置き換える:

````markdown
見せる前に、`tools/unit_rules.py` で機械的に確かめられることをまとめて確かめる（`types/unit/SPEC.md` の自己チェック①）。

```sh
.venv/bin/python tools/unit_rules.py checks/gau.json
```

- 設定ファイル `checks/<ユニット>.json` に、承認された重なり順・部品の役割（武器・拳・動いてよい部品・動かない盾）・目の行・`weapon_check.py` の指定・例外を書く（形は `tools/unit_config.py` の docstring）
- 今ある道具（`validate.py`・`compose.py --check`・`body_check.py`・`hand_mirror.py`・`unit_check.py`・`weapon_check.py`）と、方針の確認（重なり順・切っ先の高さ・動かない所と盾・背丈・1画素の先端・部品の文字・目・部品が閉じている・拳の大きさと握り）を順に走らせ、確認ごとに1行「ok／NG」を出す
- 例外に書いていない失敗が1つでもあれば終了コード 1、設定の誤り（知らないキー・無い部品・無いコマ・パレットに無い色名）は 2
- `unit_check.py` の「増えた切れ目」は報告だけ（歩きの足先のようにわざと切れているものもあるので、1件ずつ目で確かめる）。`weapon_check.py` の `--arm` は使わない（体＋拳の方針、2026-10-16）
````

Task 8 で道具にしないと決めた確認は、上の並びから外す。

- [ ] **Step 4: `CLAUDE.md`（forge）**

「コマンド」の `unit_check.py` の行の前に足す:

```sh
.venv/bin/python tools/unit_rules.py checks/gau.json  # unit の方針の確認をまとめて走らせる（自己チェック①。設定は checks/<ユニット>.json、例外に無い失敗で終了 1）
.venv/bin/python tools/order_check.py checks/gau.json  # 承認された重なり順（ほかに blade_height・still_check・height_check・tip_check・part_chars・eye_check・part_outline・fist_check。どれも同じ引数）
```

`unit_check.py` と `weapon_check.py` の行の注記「（自己チェック①。…）」を「（unit_rules.py が設定ファイルから走らせる）」に直す。`weapon_check.py` の行の例は今のまま（`--arm` は書いていない）。
Task 8 で道具にしないと決めた確認は、括弧の並びから外す。

- [ ] **Step 5: `ISSUES.md`**

- 「方針を確かめる道具が無いもの」の節の8行（重なり順・切っ先の高さ・待機・歩き・盾・背丈・1画素の先端・部品の文字・目）を消す。行が無くなれば節ごと消す（Task 8 で「道具にしない」と決めたものは、その理由の行を同じ節に残す）
- 「ツールの不具合」の「拳以外の部品（武器・弓・矢・盾）が輪郭で閉じているかを確かめる道具が無い」を消す（`part_outline.py`）
- 「絵」の「`weapon_check.py` が部品の取り付けの大きさと位置を見ない」を消す（`fist_check.py`）
- 「ツールの改善」の「CLAUDE.md・README のガウの `weapon_check` の例に `--arm` が無い」を消す（`--arm` は使わないと決めたので、例に無いのが正しい）
- 「絵」の「敵を 体 + 拳 の方針で組み直す」の「SPEC の「1px の袖口は残す」と `weapon_check.py` の「手の輪郭」「`--arm`」も、この方針に合わせて見直す」を
  「`weapon_check.py` の「手の輪郭」も、この方針に合わせて見直す（`--arm` は 2026-10-16 に使わないと決めた）。敵の設定ファイル `checks/<敵>.json` を足す」に直す
- 「ツールの不具合」の「`weapon_check.py` が色名とコマ名を検査しない」の詳細の末尾に「入口の `unit_rules.py` は設定ファイルで色名とコマ名を確かめてから渡す（2026-10-16）。単独で走らせるときの穴は残る」を足す

- [ ] **Step 6: 全体を確かめる**

```bash
.venv/bin/python -m unittest discover -s tests 2>&1 | grep -E '^(Ran|OK|FAILED)'
for u in roran ines gau; do .venv/bin/python tools/unit_rules.py checks/$u.json > /dev/null; echo "$u exit $?"; done
.venv/bin/python tools/validate.py -q; echo "validate exit $?"
git diff --stat main -- pixel-asset-forge/assets pixel-asset-forge/compose
```

Expected: テスト `OK`、3体とも `exit 0`、validate `exit 0`、`assets`・`compose` の差分が無い（絵を直していない）

- [ ] **Step 7: Commit**

```bash
git add pixel-asset-forge/tools/weapon_check.py pixel-asset-forge/types/unit/SPEC.md pixel-asset-forge/README.md \
    pixel-asset-forge/CLAUDE.md pixel-asset-forge/ISSUES.md
git commit -m "docs: 自己チェック①を unit_rules.py に書き換え、weapon_check の --arm を使わないことにする"
```

- [ ] **Step 8: 最終レビューの後に台帳を写す**

最終レビュー（Opus のサブエージェント）で出た Minor も直してから、台帳を写す（PR 1 と同じく、最終レビューの行も写しに残すため）。

```bash
cp .superpowers/sdd/2026-10-16-policy-check-tools-pr2/progress.md docs/superpowers/ledgers/2026-10-16-policy-check-tools-pr2.md
git add docs/superpowers/ledgers/2026-10-16-policy-check-tools-pr2.md
git commit -m "docs: 方針を確かめる道具 PR 2 の台帳を写す"
```

- [ ] **Step 9: 保留にした課題の棚卸しと、直すタイミングを依頼者に尋ねる**（2026-10-17 依頼者の指示で足した）

この作業で「絵を直す（ISSUES に立てる）」「後で検討する」「後で見直す」と決めて保留にした課題を、私（Claude）から依頼者に一覧で見せ、
いつ直すか（D の前・D の中・E・それ以降）を尋ねる。依頼者が決めるまで、PR の作成へ進まない。

一覧に入れるもの（台帳の `Ruling:` 行と ISSUES.md の、この作業で足した行から集める）:

- 絵を直すと決めたもの（イネスの腰の後ろ・ガウの輪郭の切れ目・矢の軸・盾の下端・短剣の鍔の下・鍔とベルトの同じ文字・ロランの idle2 の頭・イネスの歩きの y=27・ガウの背丈・up の鏃・ロランの left と right の髪の形 など）
- 確かめると決めたもの（イネスの攻撃のコマだけバンダナの垂れの形が違う）
- 後で検討すると決めたもの（尖った先端の描き方・女性の体の線の確かめ方・ロランとガウの left の「手が細い」の例外の見直し・`body_check.py` の「はみ出し」を D の後にやめること）

台帳に `Ruling:` 行で依頼者の答えを書き、ISSUES.md の該当の行に時期を書き足す。
