# D 敵の組み直し 2回目（斧の敵7体）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 斧の敵7体（男性2体・女性5体）を、単品の部品（芯・目・服・頭・長い髪・斧・拳）から `compose/<敵>.json` で組み、`unit_rules.py` を例外0件で通す。

**Architecture:** 1回目と同じ。絵はグリッド（`assets/part/**`）だけを描き、`tools/compose.py` で `assets/unit/<敵>/` のコマを組む。色替えは今の `enemy/<敵>.json` と `tools/enemy_build.py`。確認は `checks/<敵>.json` を `tools/unit_rules.py` にかける。斧と拳の画素は、今の承認済みの形（`gen/enemy/mkweapons.py` の図形）を scratchpad のスクリプトに写して、単品の部品として書き出す。

**Tech Stack:** Python 3.14（forge の `.venv`）、unittest、forge の `compose.py`・`unit_rules.py`・`body_check.py`・`validate.py`・`render.py`・`enemy_build.py`・`enemy_gallery.py`・`anim_compare.py`・`contact_sheet.py`。

**Spec:** `docs/superpowers/specs/2026-11-03-enemy-rebuild-2-design.md`（2回目の追記）と、その元の `docs/superpowers/specs/2026-10-27-enemy-rebuild-design.md`。どちらも character-tactics の直下。

コマンドは断りが無ければ `pixel-asset-forge/` で実行する。進捗台帳は `.superpowers/sdd/2026-11-03-enemy-rebuild-2/progress.md`（character-tactics の直下）。1回目の台帳の写し `docs/superpowers/ledgers/2026-10-27-enemy-rebuild-1.md` に、1回目で踏んだこと（文字のぶつかり、色の移し方、眼帯）がある。

## Global Constraints

- 対象と組み合わせ（追記の設計書「対象」の表）:
  - `axe-bandit`（男性・E5・bandana・belt＋tatter）、`axe-horn`（男性・E2・horn・tatter）
  - `axe-bandit-{a,b,c}-f`（女性・E5・bandana・belt＋tatter の女性用・長い髪 A/B/C）、`axe-horn-{b,c}-f`（女性・E2・horn・tatter の女性用・長い髪 B/C）
- 目・被り物は1回目の部品をそのまま使う（`assets/part/eye/{E2,E5}/eye_<名前>_<dir>_base.txt`、`assets/part/head/{bandana,horn}/head_<名前>_<dir>_base.txt`）。男性の服・芯も1回目の物（`assets/part/cloth/{belt,tatter}/`、`assets/part/body/enemy_male/`）
- 部品の置き場と名前（部品の名前はファイル名の `_<向き>_` より前。`unit_config.part_name`）:
  - 斧: `assets/part/equip/axe/male/axe_<dir>_<状態>.txt`・`assets/part/equip/axe/female/axe_<dir>_<状態>.txt`（名前は男女とも `axe`）
  - 斧を握る拳: `assets/part/fist/enemy_male/axe_hand_<dir>_<状態>.txt`・`assets/part/fist/enemy_female/axe_hand_<dir>_<状態>.txt`
  - 空き手の拳: 男性はガウの `assets/part/fist/gau/free_hand_<dir>_<状態>.txt`（Task 1 で合わなければ `assets/part/fist/enemy_male/free_hand_*`）、女性は `assets/part/fist/enemy_female/free_hand_<dir>_<状態>.txt`
  - 女性の芯: `assets/part/body/enemy_female/core_<dir>_<状態>.txt`
  - 長い髪: `assets/part/hair/{A,B,C}/hair_<名前>_<dir>_base.txt`（前）・`hair_<名前>_back_<dir>_base.txt`（肩より下）
  - 女性用の服: `assets/part/cloth/{belt_female,tatter_female}/cloth_<名前>_<dir>_base.txt`
  - 状態は `base`・`idle2`・`atk_wind`・`atk_hit`（歩きは `base` の部品を使う。ガウ・1回目と同じ）
- 斧の色と文字は短剣の部品と同じ（`o=contour l=weapon_shaft_hi m=weapon_shaft_base n=weapon_shaft_shadow s=blade_hi t=blade_base`）。`checks` の `items` は `"stlmn"`、`blade` は `"st"`。拳は `o=contour a=skin_ruddy_hi b=skin_ruddy_base c=skin_ruddy_shadow`
- 今の図形からの色の対応（`mkweapons.py` の `COL`）: `S`→`blade_hi`、`T`→`blade_base`、`L`→`weapon_shaft_hi`、`M`→`weapon_shaft_base`、`N`→`weapon_shaft_shadow`、`o`・`x`→`contour`、`a`/`b`/`c`→`skin_ruddy_hi`/`base`/`shadow`。袖の色（`J`・`K`・`H`）は使わない
- 女性の芯・部品の色名は男性の芯と同じ（肌 `skin_ruddy_*`、服 `clothes_dark_*`、脚 y=25〜30 は `legwear_brown`、輪郭 `contour`）。女性の素体の `skin_fair_*`→`skin_ruddy_*`、`clothes_blue_*`→`clothes_dark_*`
- 重なり順（奥→手前）。男性はガウの `orders` の `dagger`→`axe`、`dagger_hand`→`axe_hand` と同じで、1回目と同じく芯の直後に 目・服・頭:
  - `down`: CORE・目・服・頭・axe・axe_hand・free_hand
  - `up`: axe・axe_hand・free_hand・CORE・目・服・頭
  - `left`: axe・axe_hand・CORE・目・服・頭・free_hand
  - `right`: free_hand・CORE・目・服・頭・axe・axe_hand
  - 女性は、目・服の後・頭の前に長い髪（前）を入れ、長い髪（`_back`）を次の位置に入れる: `down`・`right`・`up` は先頭（`up` は axe より奥）、`left` は axe・axe_hand の直後で CORE の前（斧は髪の陰）
- 部品を単品に分けて組むと今の絵と食い違うときは、今の絵の誤りとして扱い、聞かない。違った所はページに今と並べて載せる（追記の設計書「依頼者が決めたこと」）
- `left` の斧は1つの部品で芯の奥。斧を2つの部品に分けない
- `left_atk_wind` の斧を握る拳は、影の色（`skin_ruddy_shadow`）だけで描く（依頼者 2026-11-03）。`left_base`・`idle2` は今どおり影の色だけ（`FIST_FAR_L`）。`left_atk_hit` の拳は今の色のまま（この決定の範囲外）
- 腕と袖は描かない（`ARM_L`・`ARM_U` は写さない）。`SHAFT_L` は斧の部品の柄として描く（別の部品にしない）
- 部品は単品として完全に描く。斧と拳は輪郭で全周を閉じる。長い髪（種類 `hair`）と装飾品（ベルト・当て布）は体の上の縁に輪郭が無くてよい
- `gen/enemy/` は走らせない・import しない。図形の関数は scratchpad のスクリプトに写して使う
- 例外（`exceptions`・`open_chars`）で落ちた絵を通さない。正しい絵が落ちたら道具の判定を直す（失敗するテストを先に）。新しい機械チェックは作らない
- 絵を直したら、今と並べたページ（静止と動き）を Artifact で見せる。「致命的な問題が無ければ Claude が判断して進める」（2026-11-03 依頼者）なので、承認待ちで止まるのは計画で「止まる」と書いたステップだけ。それ以外の判断は台帳に Ruling として書き、次に止まるページに載せる
- テストは `assets/` を読まない（`tests/test_no_live_assets.py`）
- push・PR は依頼者の指示があったときだけ。一時の出力は scratchpad か新しいフォルダ（`rm -rf` は使えない）

## Review Focus

- **女性の `left` の長い髪の陰**: 斧の柄と奥の拳が髪の陰に入る（2026-10-08 依頼者の指摘）→ Task 6 Step 3 の `order_check.py` と、Task 6 Step 5 のページで `left_base`・`left_atk_wind` を拡大して見せる
- **レシピの色替え**: 女性の芯の色名がレシピの `recolor` の元（`clothes_dark_*`）と違うと、色替えが黙って効かない → Task 7 Step 2 で7体のシートに `clothes_dark_*` の色が0画素
- **文字のぶつかり**: `compose.py` は、同じ文字が部品ごとに別の色だと止まる（1回目で2件）→ 部品を書くときに Global Constraints の文字を使い、Task 2・6 の `compose.py --force` が止まらないこと。止まったら色を変えずに文字だけ付け替え、台帳に書く
- **待機2の 2px**: 斧と握る拳を 2px 上げる（ガウ・1回目と同じ）。女性用で忘れやすい → Task 5 Step 2 で `axe_<dir>_idle2` が `axe_<dir>_base` を y に −2 ずらした物と一致することを確かめる
- **古い `noweapon`**: `assets/unit/axe-*/noweapon/` は `gen/enemy/mkweapons.py` だけが書いた古いコマ → Task 2 Step 6・Task 6 Step 6 で `git rm`。消す前に Task 1 Step 1 で比べる用の写しを取る

---

### Task 0: ブランチを切り、設計と計画をコミットする

PR #42 がマージされるまで始めない（依頼者の指示）。

- [ ] **Step 1: ブランチを切る。** character-tactics の直下で `git fetch origin main` → `git checkout -b feat/enemy-rebuild-2 origin/main`。未追跡の `docs/superpowers/specs/2026-11-03-enemy-rebuild-2-design.md` とこの計画が付いてくることを `git status` で確かめる
- [ ] **Step 2: 今の斧の敵のコマを写す。** `assets/unit/axe-*/`（`noweapon/` を含む）を `pixel-asset-forge/build/main_frames/` に写す（比べる用。`build/` は git 管理外）
- [ ] **Step 3: コミット**

```bash
git add docs/superpowers/specs/2026-11-03-enemy-rebuild-2-design.md docs/superpowers/plans/2026-11-03-enemy-rebuild-2.md
git commit -m "docs: D 敵の組み直し 2回目（斧）の設計の追記と計画を足す"
```

---

### Task 1: 男性の斧と拳の部品（依頼者に見せて止まる）

**Files:**
- Create: `assets/part/equip/axe/male/axe_<dir>_<状態>.txt`（16枚）、`assets/part/fist/enemy_male/axe_hand_<dir>_<状態>.txt`（16枚）、合わなければ `assets/part/fist/enemy_male/free_hand_<dir>_<状態>.txt`

**Interfaces:**
- Produces: 斧と握る拳の部品。Task 2 の `compose` の層、Task 5 の女性用の元

- [ ] **Step 1: 図形を写したスクリプトを作る。** scratchpad に `mk_axe.py` を作り、`mkweapons.py` の `P`・`mirror`・`merge`・`relayer`・`AXE_FULL`・`AXE_GRIP`・`axe_cells`・`flip`・`place`・`fist_v`・`fist_sq`・`raster_axe`・`ringed`・`stick`・`FIST_FAR_L`・`HAND_CAPS` と `axe_stance`・`axe_wind`・`axe_hit` を写す（`ARM_L`・`ARM_U` は写さない。`SHAFT_L` は斧に入れる）。各パッチを「斧の画素」と「拳の画素」に分けて、32×32 の単品のグリッドに書く
  - 斧: 柄・斧頭の文字（`S` `T` `L` `M` `N`）と、その周りの `x`・`o` を `contour` にし、さらに斧の画素の上下左右の空きをすべて `contour` で閉じる（`ringed` と同じ）
  - 拳: `fist_v`・`fist_sq`・`FIST_FAR_L` の肌と輪郭。`up` は `HAND_CAPS` でなく、握りの位置（`mirror(place(AXE, 9, 18), 31)` の握り = (22, 18)）に `fist_v` の完全な拳を置く
  - `left_atk_wind` の拳の肌はすべて `c`（`skin_ruddy_shadow`）
  - `idle2` は `base` のパッチを y に −2 ずらす（`build_frame` の `dy=-2`）。`walk_*` の部品は作らない
- [ ] **Step 2: 空き手を比べる。** `build/main_frames/axe-{bandit,horn}/<dir>_<状態>.txt` の空き手の肌の塊（握る拳の外の `skin_ruddy_*`）の位置と形を、ガウの `free_hand_<dir>_<状態>` の肌と比べる。8コマ×2体すべてで一致すれば、ガウの部品を使う。違えば `enemy_male/free_hand_*` に今の位置で 2×2 の拳を描く。結果を台帳に書く
- [ ] **Step 3: 道具で確かめる。** Run: `.venv/bin/python tools/validate.py` → 終了コード 0
- [ ] **Step 4: 部品のページを Artifact で見せて止まる。** 斧だけ・拳だけを向き×状態で並べ、隣に今のコマ（`build/main_frames/axe-horn`）を置く。どれを見ればいいかを最初に1行で言う。依頼者の承認を台帳に書く
- [ ] **Step 5: コミット**

```bash
git add assets/part/equip/axe/male assets/part/fist/enemy_male
git commit -m "feat: 斧の敵の男性用の斧と拳を単品の部品にする"
```

---

### Task 2: 男性2体を組み、確認を通す（依頼者に見せて止まる）

**Files:**
- Create: `compose/axe-{bandit,horn}.json`、`checks/axe-{bandit,horn}.json`
- Modify: `assets/unit/axe-{bandit,horn}/<dir>_<状態>.txt`（24枚ずつ）
- Delete: `assets/unit/axe-{bandit,horn}/noweapon/`
- Modify（落ちたときだけ）: `tools/<道具>.py`、`tests/test_<道具>.py`

**Interfaces:**
- Consumes: Task 1 の部品、1回目の芯・目・服・頭
- Produces: 2体の `compose`・`checks`（Task 6 の女性の設定の元）

- [ ] **Step 1: 設定を書く。** `compose/dagger-{bandit,horn}.json` を元に、短剣と短剣の拳の層を Task 1 の斧と拳に替える（`z` は Global Constraints の順に合う物。`axe_hand` に `hand: true`・`keep: ["blade", "weapon"]`、`free_hand` に `hand: true`）。`checks/dagger-{bandit,horn}.json` を元に、`parts` の `dagger`→`axe`（`weapon: true`・`blade: "st"`・`moves: true`）、`dagger_hand`→`axe_hand`（`fist: true`・`grips: "axe"`・`fist_sizes` は Task 1 の拳の肌の大きさ・`moves: true`）、`orders` は Global Constraints。`exceptions: []`
- [ ] **Step 2: 組む。** Run: `.venv/bin/python tools/compose.py compose/axe-bandit.json --force`（2体とも）→ その後 `--check` が 0
- [ ] **Step 3: 確認を通す。** Run: `.venv/bin/python tools/unit_rules.py checks/axe-bandit.json`（2体とも）→ 終了コード 0、例外0件。`weapon_check.hidden` は、組んだコマで握る拳の肌が1画素も見えないコマだけを書く（台帳に理由）。落ちたら、絵の誤りか判定の誤りかを組んだ絵と部品で確かめる。判定の誤りなら、落ちた形を `tests/fixtures/` に写した失敗するテストを先に書き、道具を直し、`.venv/bin/python -m unittest discover -s tests` を通す。`weapon_check.py` の「手の輪郭」の偽陽性の件数を台帳に書く
- [ ] **Step 4: 今と比べる。** 組んだコマと `build/main_frames/axe-{bandit,horn}/` を画素で比べ、違う画素をコマごとに一覧にして台帳に書く。袖を消した所・`left_atk_wind` の奥の拳の色・`left` の斧が奥になった所・新しい頭と芯の所のどれにも当たらない違いは、Ruling として理由を書く
- [ ] **Step 5: ページを Artifact で見せて止まる。** 2体の今と組み直しを、静止（4方向×状態）と動き（1回目と同じく `build/main_recipes` の `*-main` レシピでシートを作り `tools/anim_compare.py`）で並べ、Step 4 の違いに印を付けた絵と印なしの絵を対で載せる。依頼者の承認を台帳に書く。直しが出たら Task 1 へ戻る
- [ ] **Step 6: 古い `noweapon` を消して、コミット**

```bash
git rm -r -q assets/unit/axe-bandit/noweapon assets/unit/axe-horn/noweapon
git add compose checks assets/unit tools tests
git commit -m "feat: 斧の敵の男性2体を部品から組み直す"
```

---

### Task 3: 敵の女性の芯

**Files:**
- Create: `assets/part/body/enemy_female/core_<dir>_<状態>.txt`（4方向 × `base`・`idle2`・`walk_a`・`walk_b`・`atk_wind`・`atk_hit` = 24枚）

**Interfaces:**
- Consumes: 女性の素体 `types/unit/base/female_<dir>.txt`、歩きの脚 `assets/part/body/female/female_walk_{a,b}_<dir>.txt`
- Produces: 芯24枚。Task 6 の `compose` の `body`

- [ ] **Step 1: 芯を作る。** 女性の素体を複製し、Global Constraints の女性の色名に置き換える（脚 y=25〜30 は全部 `legwear_brown`。1回目の Task 2 の Ruling と同じ）。`idle2`・`atk_wind`・`atk_hit` は `base` と同じ。`walk_a`・`walk_b` は y=28〜30 だけを `female_walk_{a,b}` の行で置き換える
- [ ] **Step 2: 道具で確かめる。** Run: `.venv/bin/python tools/body_check.py assets/part/body/enemy_female --no-protrusion` → 終了コード 0。Run: `.venv/bin/python tools/validate.py` → 0
- [ ] **Step 3: コミット**（素体の複製と脚の差し替えだけなので、見せるのは Task 6 でまとめる）

```bash
git add assets/part/body/enemy_female
git commit -m "feat: 敵の女性の芯を素体の複製から作る"
```

---

### Task 4: 長い髪と女性用の服（依頼者に見せて止まる）

**Files:**
- Create: `assets/part/hair/{A,B,C}/hair_<名前>_<dir>_base.txt`・`hair_<名前>_back_<dir>_base.txt`（24枚）、`assets/part/cloth/{belt_female,tatter_female}/cloth_<名前>_<dir>_base.txt`（8枚）

今の `hair_<名前>_<dir>.txt`・`cloth_<名前>_<dir>.txt` は消さない（3回目の槍の敵で比べ、後始末で消す）。

**Interfaces:**
- Consumes: 1回目の頭の部品、Task 3 の芯
- Produces: 32枚の部品。Task 6 の層

- [ ] **Step 1: 写す。** 今の部品の画素をそのまま `_base` の名前に写す（素の髪の進め方。2026-10-29）。色名は用途の色のまま
- [ ] **Step 2: 重ねて直す。** Task 3 の芯＋1回目の目・被り物に重ね、新しい頭（1px 小さい）とのすき間・重なりを直す。髪は単品として閉じる（体の上の縁は輪郭なしでよい）。服は女性の芯の胴の上で今と同じ見た目にする
- [ ] **Step 3: 道具で確かめる。** Run: `.venv/bin/python tools/validate.py` → 0
- [ ] **Step 4: ページを Artifact で見せて止まる。** 部品だけを向きごとに今と並べた絵と、芯＋目＋服＋髪＋被り物に重ねた絵（5体の組み合わせ×4方向）を今の女性の敵の `base` と並べる。承認を台帳に書く
- [ ] **Step 5: コミット**

```bash
git add assets/part/hair assets/part/cloth
git commit -m "feat: 斧の敵の女性の長い髪と服を新しい頭と芯に合わせて単品で描く"
```

---

### Task 5: 女性用の斧と拳

**Files:**
- Create: `assets/part/equip/axe/female/axe_<dir>_<状態>.txt`（16枚）、`assets/part/fist/enemy_female/{axe_hand,free_hand}_<dir>_<状態>.txt`（32枚）

**Interfaces:**
- Consumes: Task 1 の男性用の斧と拳、`build/main_frames/axe-*-f/`
- Produces: 女性用の部品。Task 6 の層

- [ ] **Step 1: 斧と握る拳をずらす。** 男性用の部品を x に `FEMALE_SHIFT` の量だけずらして書く: `base`・`idle2`・`atk_wind` は `down` +1・`up` −2・`left` −1・`right` +1、`atk_hit` は `down` 0・`up` −2・`left` −1（`FEMALE_SHIFT_WEAPON`）・`right` −1。形は変えない
- [ ] **Step 2: ずれを確かめる。** scratchpad のスクリプトで、女性用の各部品が男性用を上の量だけずらした物と一致すること、`axe_<dir>_idle2` が `axe_<dir>_base` を y に −2 ずらした物と一致することを確かめる（拳も同じ）
- [ ] **Step 3: 空き手を描く。** `build/main_frames/axe-bandit-a-f/<dir>_<状態>.txt` の空き手の肌の位置で、2×2 の肌を輪郭で閉じた拳を描く（色は今の拳と同じ明暗）。5体で空き手の位置が同じことを確かめ、違えば台帳に書いて Task 6 のページで見せる
- [ ] **Step 4: 道具で確かめる。** Run: `.venv/bin/python tools/validate.py` → 0
- [ ] **Step 5: コミット**（形は男性用で承認済み。組んだ見え方は Task 6 で見せる）

```bash
git add assets/part/equip/axe/female assets/part/fist/enemy_female
git commit -m "feat: 斧の敵の女性用の斧と拳を部品にする"
```

---

### Task 6: 女性5体を組み、確認を通す（依頼者に見せて止まる）

**Files:**
- Create: `compose/axe-{bandit-a,bandit-b,bandit-c,horn-b,horn-c}-f.json`、`checks/` の同じ名前
- Modify: `assets/unit/axe-*-f/<dir>_<状態>.txt`（24枚ずつ）
- Delete: `assets/unit/axe-*-f/noweapon/`
- Modify（落ちたときだけ）: `tools/<道具>.py`、`tests/test_<道具>.py`

**Interfaces:**
- Consumes: Task 2 の男性の設定、Task 3〜5 の部品

- [ ] **Step 1: 設定を書く。** Task 2 の設定を元に、`body` を `enemy_female` の芯、斧と拳を女性用、服を女性用にし、長い髪（前は `{"head": true}`、`_back` は `{}`）を Global Constraints の位置に足す。`checks` の `body` は `"female"`
- [ ] **Step 2: 組む。** Run: `.venv/bin/python tools/compose.py compose/axe-bandit-a-f.json --force`（5体とも）→ その後 `--check` が 0
- [ ] **Step 3: 確認を通す。** Run: `.venv/bin/python tools/unit_rules.py checks/axe-bandit-a-f.json`（5体とも）→ 終了コード 0、例外0件。落ちたときの扱いは Task 2 Step 3 と同じ
- [ ] **Step 4: 今と比べる。** Task 2 Step 4 と同じく、`build/main_frames/axe-*-f/` との違いを一覧にして台帳に書く
- [ ] **Step 5: ページを Artifact で見せて止まる。** 5体の今と組み直しを静止と動きで並べ、違いに印を付けた絵と印なしの絵を対で載せる。女性の `left`（髪の陰）を拡大して載せる。承認を台帳に書く。直しが出たら Task 4・5 へ戻る
- [ ] **Step 6: 古い `noweapon` を消して、コミット**

```bash
git rm -r -q assets/unit/axe-bandit-a-f/noweapon assets/unit/axe-bandit-b-f/noweapon assets/unit/axe-bandit-c-f/noweapon assets/unit/axe-horn-b-f/noweapon assets/unit/axe-horn-c-f/noweapon
git add compose checks assets/unit tools tests
git commit -m "feat: 斧の敵の女性5体を部品から組み直す"
```

---

### Task 7: 書き出し・文書・最終確認

**Files:**
- Modify: `types/unit/SPEC.md`（「武器を描くときの決まり（斧・槍の敵で合意）」の節）、`ISSUES.md`、`README.md`・`CLAUDE.md`（敵の確認コマンドの例があれば）
- Create: `docs/superpowers/ledgers/2026-11-03-enemy-rebuild-2.md`（character-tactics の直下。台帳の写し）

- [ ] **Step 1: 一覧と見本を更新する。** Run: `.venv/bin/python tools/enemy_gallery.py <scratchpad>/enemy_gallery.html --ref build/sheets/gau.png:ガウ（味方）` を、敵の一覧ページ https://claude.ai/artifact/6oELhX8j1eV8NSHeckYFBq の URL に出し直す。Run: `.venv/bin/python tools/contact_sheet.py` → ok
- [ ] **Step 2: シートの色を確かめる。** Run: `.venv/bin/python tools/enemy_build.py --all` → 16体とも ok。斧の7体のシート `build/sheets/axe-*.png` に `clothes_dark_*` の色が0画素
- [ ] **Step 3: 文書を直す。**
  - SPEC: 斧の節に、部品の置き場（`assets/part/equip/axe/{male,female}/`、拳の置き場）、重なり順（Global Constraints）、`left` の斧は1つの部品で芯の奥、`left_atk_wind` の奥の拳は影の色、女性用は男性用を平行移動した別の部品、を足す。「部品と食い違う古い絵は誤りとして扱う」（2026-11-03 依頼者）を「部品で組む規約」に足す
  - ISSUES: 「`weapon_check.py --far-shade` が…」の行から斧の絵の分を片付け、道具の件と槍の分を残す。「敵を 体 + 拳 の方針で組み直す」の行に2回目の進み具合。「敵の生成スクリプトの出力が…」の行に、斧の7体も組み直したことを足す
- [ ] **Step 4: 全部の確認を走らせる。**
  - `.venv/bin/python -m unittest discover -s tests` → OK
  - `.venv/bin/python tools/validate.py` → 0
  - `.venv/bin/python tools/unit_rules.py checks/<ユニット>.json`（ロラン・イネス・ガウ・短剣の4体・斧の7体）→ どれも 0
  - `.venv/bin/python tools/compose.py compose/<ユニット>.json --check`（同じ14体）→ どれも 0
  - character-tactics の直下で `npm test`・`npm run build` → 通る
- [ ] **Step 5: 台帳を写してコミット**

```bash
git add types/unit/SPEC.md ISSUES.md README.md CLAUDE.md ../docs/superpowers/ledgers/2026-11-03-enemy-rebuild-2.md
git commit -m "docs: 斧の敵の組み直しを SPEC・ISSUES に書き、台帳を写す"
```

- [ ] **Step 6: Opus のサブエージェントで最終レビューをし、Minor まで直す。** その後、保留の課題を一覧にして直す時期を依頼者に聞く（PR の前）
