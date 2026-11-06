# ガルムのマップ用ユニット Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ガルム（48px のボス。角の飾りの付いた暗い兜・全身の鎧・赤と青・大きな剣と盾・叩きつける攻撃）の24コマを単品の部品から `compose/garum.json` で組み、`unit_rules.py` を例外0件で通して、ゲームの `garum-map.png`（192×576）を差し替える。

**Architecture:** 絵はグリッド（`assets/part/**`）だけを描き、`tools/compose.py` で `assets/unit/garum/` のコマを組む。確認は `checks/garum.json` を `tools/unit_rules.py` にかける（道具は第1段階で 48px に対応済み。値は `tools/unit_scale.py`）。シートは `sheets/garum.txt` を `tools/sheet.py`、ゲームへは `tools/export.py ../sprites.json ../assets/images`。依頼者に見せて止まるのは設計書の確認1〜4の4か所だけ。

**Tech Stack:** Python 3.14（forge の `.venv`）、unittest、forge の `compose.py`・`unit_rules.py`・`validate.py`・`probe_colors.py`・`check_colors.py`・`compose_page.py`・`phone_sheet.py`・`anim_compare.py`・`sheet.py`・`export.py`・`contact_sheet.py`。ゲームは Vite + Vitest（`npm test`・`npm run build`）。

**Spec:** `docs/superpowers/specs/2026-11-06-garum-unit-design.md`（第2段階。character-tactics の直下）

コマンドは断りが無ければ `pixel-asset-forge/` で実行する。進捗台帳は `.superpowers/sdd/2026-11-06-garum-unit/progress.md`（character-tactics の直下）。ブランチは第1段階と同じ `feat/garum-unit`（依頼者の指示で PR を作らずに続ける。2026-11-06）。

## Global Constraints

- コマは 48x48（`# size: 48x48`）。足元 y=46、背丈 36〜39px（芯で測る）、そのほかの値は `types/unit/SPEC.md`「48px のコマの比率」
- 部品の置き場と名前（部品の名前はファイル名の `_<向き>_` より前）。状態は `base`・`idle2`・`atk_wind`・`atk_hit`、歩きは `base` の部品を使う:
  - 芯: `assets/part/body/garum/core_<dir>_<状態>.txt`（24。歩きの `walk_a`・`walk_b` も芯は持つ）
  - 兜: `assets/part/head/garum/head_garum_<dir>_base.txt`（種類 `headgear`。角の飾りを含む）
  - 目: `assets/part/eye/garum/eye_garum_<dir>_base.txt`（兜のすき間の暗い所。既存の E0〜E5 は 32px なので使えない）
  - 鎧: `assets/part/cloth/garum/cloth_garum_<dir>_<状態>.txt`（種類 `cloth`）
  - 剣: `assets/part/equip/garum/sword_<dir>_<状態>.txt`、盾: `assets/part/equip/garum/shield_<dir>_base.txt`（武器・盾の種類と輪郭だけで塗る。武器専用の色）
  - 拳: `assets/part/fist/garum/sword_hand_<dir>_<状態>.txt`・`shield_hand_<dir>_<状態>.txt`（種類 `skin`。設計書の Claude の判断）
- 芯は `types/unit/base/male_<dir>.txt` を 1.5倍に拡大した下書きから描き直す（Claude の判断。設計書で作る人に任せた点）。輪郭は1px に戻し、足元 y=46・背丈 36〜39px に合わせる。攻撃・歩きの芯はロランの芯（`body/roran/core_*`）の動きを手本にする
- 持ち方と重なり順はロラン（`checks/roran.json` の `orders`、盾は `fixed`、剣と剣の拳は `moves`）を手本にし、確認2で合わせる
- 待機2: 剣と剣の拳を `base` から y に −3 ずらす（32px の −2 の 1.5倍。Claude の判断）
- 攻撃: `atk_wind` で剣を頭の上（入らなければ頭の後ろ）へ振り上げ、`atk_hit` で前の地面へ叩きつける。攻撃は `[atk_wind, atk_hit, base]`
- 剣の大きさは 48px の決まりの中（待機・歩きの切っ先 y≥8、待機2 は y≥5。`blade_height`）。刃の幅の決まり（`tip_rule.MAX_WIDTH = 4`。刃の中身が5画素以上だと決まりの外）を超える太さにしたくなったら、描く前に依頼者に相談する（設計書「新しい道具が要ると分かったら作る前に相談」）
- 色: 顔グラ（`../assets/images/garum-face.png`）の暗い兜・赤と青の鎧に合わせる。既存の色見本を優先し、足すときは描く前に `probe_colors.py` で隣り合う予定の相手と測り、`swatches.json` と `palette/uses/unit.json`（種類と説明つき）に足す
- 正典の決まり（`types/unit/SPEC.md`）: 部品は単品として完全、腕と袖は描かない、拳は全向き・全コマ両手の層を持ち四方を輪郭で閉じる、体の奥で武器を握る拳は影の肌の色だけ、拳は down/up・left/right で左右反転（攻撃を除く）、剣・盾は left/right で左右反転（攻撃も）、被り物は髪より大きく、柄を包んで握る物は拳を手前
- 攻撃の火花・矢の大きさと位置（ゲームの `draw.ts`）は直さない（設計書の範囲外）
- 道具で落ちたら道具に従って絵を直す。道具の判定を変えない、例外（`exceptions`・`open_chars`）で通さない、新しい機械チェックを作らない
- 承認された重なり順を Claude が変えない。絵を変えたら、コミットや次の段階の前に見せる
- 依頼者に見せるのは Artifact のページ（スマホで見る、PNG を data URI で埋め込む）。赤枠の印は印なしと対で並べる。動きは状態×4方向の再生ページ
- テストは `assets/` を読まない。一時の出力は scratchpad。PR は作らない（依頼者の指示）

## Review Focus

- **大きく見えない**: 体が 48px のコマを使い切らず、ロランと並べても大きさの差が分からない → 確認1と確認4のページで、ロランを同じ倍率で横に並べる（`unit_picker` は大きさの違う手本を並べられないので、ページは PNG を並べて作る）
- **兜と角**: 角の飾りがコマの上端（y=0）で切れる、兜の縁の下から何かが横にはみ出す → Task 2 の `validate.py` と確認1のページ、Task 3 以降の `head_cover_check`
- **奥の拳の色**: left/right で体の奥の拳が影の色でない → `far_fist_check`（Task 3〜5 の `unit_rules`）
- **振り上げの剣**: `atk_wind` で剣が上端を出る・兜と重なって読めない → Task 5 の `weapon_check`（コマの端）と確認3のページで `atk_wind` を拡大
- **書き出しの取り違え**: `sprites.json` に `sheets/garum.png` が無いとゲームは仮の絵のまま → Task 6 Step 5 で `garum-map.png` が 192x576 で、仮の絵と画素が違うことを確かめる

---

### Task 0: 台帳を作り、計画をコミットする

- [ ] **Step 1:** `.superpowers/sdd/2026-11-06-garum-unit/progress.md` を作る（設計書・計画のパス、確認1〜4の状態の欄）
- [ ] **Step 2: Commit** `git add docs/superpowers/plans/2026-11-06-garum-unit.md && git commit -m "docs: ガルムのマップ用ユニットの実装計画を書く"`

### Task 1: 芯と色

**Files:** Create `assets/part/body/garum/core_<dir>_<状態>.txt`（24）、Modify `palette/swatches.json`・`palette/uses/unit.json`（要るときだけ）

**Interfaces:** Produces 芯24ファイルと、兜・鎧（赤・青）・剣・盾の用途の色の名前（Task 2 以降の `# map:` に使う。台帳に一覧を書く）

- [ ] **Step 1:** `male_<dir>.txt` を 1.5倍の下書きにして（scratchpad の使い捨てスクリプト）、芯の `base` 4向きを描く。`height_check`・`body_check` の値（足元 y=46・背丈 36〜39・頭 5-22・胴 23-37・脚 38-47 の中心）に合わせる
- [ ] **Step 2:** `idle2`・`walk_a`・`walk_b`・`atk_wind`・`atk_hit` の芯を、ロランの芯の動き（歩きは脚 y=43〜46 だけ、輪郭は y=42 だけ）に合わせて描く
- [ ] **Step 3:** 色の候補を `probe_colors.py --candidate '#rrggbb' --against contour skin_fair_base ...` で測り、通った値だけを足す
- [ ] **Step 4:** `validate.py` 0 failed、`check_colors.py -q` 終了 0、`python -m unittest discover -s tests` OK
- [ ] **Step 5: Commit** `feat: ガルムの芯と色を足す`

### Task 2: 単品の物を向きごとに描く（確認1で止まる）

**Files:** Create 兜・目・鎧・剣・盾の `<dir>_base`（Global Constraints の置き場）

- [ ] **Step 1:** 兜（角の飾り）、目（兜のすき間）、鎧（袖なし。腕は描かない）、剣（ロランより長く太く、決まりの中）、盾を、単品として完全に down/up/left/right で描く
- [ ] **Step 2:** `validate.py` 0 failed、`tip_check` が剣の刃先を通す（`--items` ではなく、Task 3 の `unit_rules` で確かめるまでは `tip_rule` の決まりを読んで描く）
- [ ] **Step 3:** 物ごとに4向きを並べたページ（芯に1つずつ重ねた絵と単品の絵の対）と、`base` を組んだ仮の姿をロランの `base` と同じ倍率で並べた段を Artifact で出す
- [ ] **Step 4: 止まる（確認1）。** 依頼者の指摘を直して見せ直し、承認を台帳に書く（拳を籠手の色にしたいと言われたら、道具の直しが要るので作る前に相談する）
- [ ] **Step 5: Commit** `feat: ガルムの兜・目・鎧・剣・盾の部品を描く`

### Task 3: 重なり順（確認2で止まる）

**Files:** Create `compose/garum.json`（`base` の4コマだけ）、`checks/garum.json`、拳の `<dir>_base`

- [ ] **Step 1:** 拳（剣の拳・盾の拳）の `base` を描き、`checks/garum.json` を書く: `body: "male"`、`parts` は `sword: {weapon: true, blade: "<刃の文字>", moves: true}`、`sword_hand: {fist: true, grips: "sword", fist_sizes: [...], moves: true}`、`shield: {fixed: true}`、`shield_hand: {fist: true, grips: "shield", fist_sizes: [...]}`、目 `{eye: true}`、兜 `{head: true}`、鎧 `{}`、`weapon_check: {"depth": ["down"]}`、`exceptions: []`。`orders` の案はロランの `orders` の芯の直後に 目・鎧・兜 を入れた形から始める
- [ ] **Step 2:** `compose.py compose/garum.json --out assets/unit/garum --force` で組み、`unit_rules.py checks/garum.json` を base の4コマで例外0件にする（落ちたら絵を直す）
- [ ] **Step 3:** `compose_page.py`（または `phone_sheet.py order`）で、向きごとに層を奥→手前に並べたページを Artifact で出す（剣と体・拳、盾と拳、兜と鎧）
- [ ] **Step 4: 止まる（確認2）。** 合意した順を `orders` に書き、台帳に書く
- [ ] **Step 5: Commit** `feat: ガルムの拳と重なり順を決める`

### Task 4: 待機と歩き

**Files:** Modify `compose/garum.json`（`idle2`・`walk_a`・`walk_b` の12コマ）、Create 剣・拳の `idle2`

- [ ] **Step 1:** 剣と剣の拳の `idle2` を `base` の y−3 で描き、`compose/garum.json` に待機2と歩きのコマを足す
- [ ] **Step 2:** `unit_rules.py checks/garum.json` 例外0件、`compose.py compose/garum.json --check` 終了0
- [ ] **Step 3: Commit** `feat: ガルムの待機と歩きのコマを組む`

### Task 5: 攻撃（確認3で止まる）

**Files:** Create 剣・拳の `atk_wind`・`atk_hit`、Modify `compose/garum.json`（攻撃の8コマ）

- [ ] **Step 1:** 振り上げ（`atk_wind`）と叩きつけ（`atk_hit`）を4向き描く。剣が上に収まらなければ頭の後ろへ寝かせる
- [ ] **Step 2:** `unit_rules.py` 例外0件・`compose.py --check` 終了0
- [ ] **Step 3:** `sheets/garum.txt`（`sheets/roran.txt` の写し、コメントをガルムに）で `sheet.py` を通し、`anim_compare.py 今の garum-map.png build/sheets/garum.png OUT --anim ../assets/enemies/garum.json` で攻撃を4向き、今の仮の絵と並べて再生するページを Artifact で出す
- [ ] **Step 4: 止まる（確認3）。** 指摘を直して見せ直し、台帳に書く
- [ ] **Step 5: Commit** `feat: ガルムの攻撃のコマを組む`

### Task 6: シートと書き出し（確認4で止まる）

**Files:** Create/Modify `sheets/garum.txt`、Modify `../sprites.json`（`"sheets/garum.png": "garum-map.png"`）、`../assets/images/garum-map.png`、forge の `CLAUDE.md`（`compose.py compose/garum.json --check` の行）・`README.md`（手本・アセットの一覧）、`build/contact_sheet.png`

- [ ] **Step 1:** `sheet.py sheets/garum.txt` の足元ライン（y=46）の実測表で、攻撃以外のコマの足元と中心がそろっていることを確かめる
- [ ] **Step 2:** 全24コマで `unit_rules.py checks/garum.json` 例外0件、`compose.py compose/garum.json --check` 終了0、`validate.py`、`check_colors.py -q` 終了0、unittest OK
- [ ] **Step 3:** 状態×4方向の再生ページ（今の仮の絵と並べる）と、ロランと同じ倍率で並べた段を Artifact で出す
- [ ] **Step 4: 止まる（確認4）。**
- [ ] **Step 5:** `export.py ../sprites.json ../assets/images` で書き出し、`garum-map.png` が 192x576 で仮の絵と違うことを確かめる。ゲームの直下で `npm test` と `npm run build` が通る
- [ ] **Step 6:** forge の `CLAUDE.md` のコマンド一覧に `compose.py compose/garum.json --check` を、README の手本・アセットの一覧にガルム（48px）を足し、`contact_sheet.py` を更新する
- [ ] **Step 7: Commit** `feat: ガルムのシートをゲームへ書き出す`

### Task 7: 後片付け

- [ ] **Step 1:** forge の `ISSUES.md`「残りの `unit` は `garum`」の行を、エフェクトの件だけを残す形に直す。作業中に見つけて直していないものを足す
- [ ] **Step 2:** 台帳を `docs/superpowers/ledgers/2026-11-06-garum-unit.md` に写す
- [ ] **Step 3: Commit** `docs: ガルムの台帳を写し、課題一覧を直す`
