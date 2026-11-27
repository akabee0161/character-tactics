# 全員分のユニットのドット絵（弓と杖の 2 人）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 弓のユナ（ally12・女）と杖のセラ（ally06・女）のマップの絵を、新しい顔と全身絵から部品で組む本番の絵にする。

**Architecture:** 斧の 2 人（`docs/superpowers/plans/2026-11-25-unit-art-all-2.md`）と同じ作り方。素体の複製の芯に、髪・被り物・服・武器・拳の部品を重ねる。ユナは弓の敵 `bow-bandit-a-f`（女・髪 A・頭巾）の重なり順に、イネスの 32 コマ（攻撃 6 コマ）の弓・矢・拳を載せる。セラはミスト（`compose/mist.json`）の構成に、セラの髪・フード・ローブを載せる。1 体ずつ CP0〜CP4 を進める。

**Tech Stack:** Python 3.14（`pixel-asset-forge/.venv`）、TypeScript のゲーム（`npm test`・`npm run build`・`npm run balance`）。

**Spec:** `docs/superpowers/specs/2026-11-24-unit-art-all-design.md`（設計書の PR 4。前の計画は `docs/superpowers/plans/2026-11-25-unit-art-all-2.md`）

## Global Constraints

- 部品・設定の名前にキャラクターの名前を使わず、ゲームの ID（`ally12`・`ally06`）を使う（`pixel-asset-forge/CLAUDE.md`）。コメント 1 行目にもキャラクターの名前を書かない
- 絵のイメージを変える直しは、描く前に、変える場所を赤枠で囲んだ絵（今の絵・赤枠・印なしを並べる）で Artifact に見せ、依頼者の指示を受けてから描く。描く前に確認の道具・書き出し・テストを流さない。描いた後は前後と差分を赤枠で見せ、変えた画素数を書く。「戻して」は `git revert`
- 新しいユニットを最初に描くところ（CP0〜CP4）は、依頼者の追加指示（2026-11-25「確認せずに進められるところを一気に進めてください。確認は、判断で進めた結果の提示で十分」）に従い、止まらずに進めて結果を Artifact で見せる。見せた後の直しは、上の赤枠の決まりに従う
- 確認の道具で落ちたら、道具に従って絵を直す（途中で聞かない）。例外（`exceptions`・`open_chars`）で落ちた絵を通さない。`pixel-asset-forge/ISSUES.md` に記録済みの原因なら絵を変えずに記録する。承認された重なり順は、依頼者が頼まない限り変えない。道具の判定が変わる決めごとは自分で決めない
- 部品は完全な単品で描く。体＋拳だけで描き、腕の部品は作らない。髪の前の部品（頭の髪）と後ろの部品（体の奥）は分ける
- 新しい色見本は描く前に `.venv/bin/python tools/probe_colors.py --candidate '#rrggbb' --against …` で輪郭・肌・隣の色・武器の色と測り、HARD 0 件にする。用途の色の名前は色見本と同じにしない。新しい素体と背丈の例外は作らない（芯は女性の素体の複製、背丈 24px）
- 髪を後ろで束ねる髪型は、耳の前に長い房（もみあげ）を垂らす（SPEC ミラの節。ポニーテールのユナも同じ。正面は目の外側に 1 本、横向きは耳の前に 1 画素幅）
- `illust-asset-forge/src/` と `UPSTREAM.md` は変えない。`python -m artgen.export` は顔を書き換えうるので実行しない
- ヘッドレスブラウザは自分のポート（9333）で `systemd-run --user --scope -p MemoryMax=…` を付けて起動する。127.0.0.1:9222 には触らない。このサーバーは 2 コア・メモリ 1.9GB。`npm test` は背景で流し、結果はファイルの末尾で読む
- 絵を直したら `assets/images` への書き出し（README の 3 段: `export.build()` → `enemy_build.py --all` → `export.export()`）までやる。そのあと `git status assets/images` で、変わった PNG が対象のユニットだけであること
- コミットは Conventional Commits + 日本語。push と PR は依頼者が頼んだときだけ。マージは依頼者が行う。PR は develop 向けで `.github/pull_request_template.md` の 5 項目。PR の前に CodeRabbit の対象（`.coderabbit.yaml` のフィルタ後）が 100 ファイル以下か数える
- 進捗台帳は `.superpowers/sdd/2026-11-26-unit-art-all-3/progress.md`（依頼者の判断は `Ruling:` 行）。終えたら `docs/superpowers/ledgers/2026-11-26-unit-art-all-3.md` に写す。push の前と区切りごとに HANDOVER.md の `## 進捗` を今の状態に直す

## 範囲外

- ロラン・イネス・ガウ・ミスト・ガルムの部品名・ID の付け替え（別の計画。順番とガルムの ID は PR の後で依頼者に聞く）
- PR 5・6（盾・旗と翼）
- ユナの矢筒（背中の茶の筒）は描かない（32px で見えず、イネスにも無い。Claude の判断。台帳に `Ruling:` で書き、結果の提示で言う）

## 決めてあること（Claude の判断。台帳に書く）

- ユナの芯は `body/mist` の複製（女性の素体・肌 `skin_fair`）の色替え。攻撃の 6 コマのうち `atk_draw`・`atk_release` の芯は `atk_hit` の芯の複製にする（敵の女性・ミストの芯は攻撃のコマも base と同じ形で、イネスの 32 コマの芯も体の形は同じ）
- 弓・矢・拳は新しく描かず、弓 `equip/bow/`・矢 `equip/arrow/`・拳 `fist/ines/`（`skin_fair` で芯と同じ肌）をそのまま使う。肌の色が顔と合わないときだけ `fist/ally12/` に写して替える
- ユナの攻撃は弓の決まり（SPEC「弓の持ち方」）。`assets/units/ally12.json` の `attack` を `{"frames": 6, "fps": 6}` にし、シートはイネスの `sheets/ines.txt` の写し
- セラの杖は `equip/staff/`（ミスト）をそのまま使う。杖の拳は `fist/mist/`（`skin_fair`）。攻撃は 3 コマ・6fps のまま（ミストと同じ）
- セラの `ally06-map.png` は説得の相手 `assets/enemies/ally06-foe.json` も読む。絵が替わるのは意図どおり（設計書。仲間と同じ絵のまま）

## Review Focus

1. ユナの攻撃が 3 コマから 6 コマになると、`windupOf`（`src/core/state.ts`）が 0.33 秒から 0.83 秒になり、戦闘の計算（`balance`）が動く。→ Task 2 の Step 7 で `npm run balance -- --check` を流し、HANDOVER 工程 4・6 の表の値（stage10 60.0・stage3 47.5 など）から外れた所を台帳に書く。外れて帯を割るなら、直し方は依頼者に聞く（絵の側で決めない）
2. ユナの頭巾・髪（前と後ろ）・弓の重なりで `head_cover_check`・`part_outline`・`weapon_check` が落ちる（髪と被り物の両方があるコマは `head_cover_check` の対象。`left` は弓が顔の前に重なる）。→ `bow-bandit-a-f` の `orders`（髪の後ろ・芯・目・服・髪・頭巾・弓…）を変えずに通し、例外を増やさない
3. セラのフード（被り物）が目・顔を覆うか、輪郭が閉じない（`head_cover_check`・`eye_check`・`part_outline`）。→ 顔の開口の目の行（x14・x17 の row 11〜12）を覆わず、縁をすべて輪郭で閉じる
4. セラのローブは足元までで、長い髪（後ろの部品）・外套と色が近いと見分けにくい。ミストの黒基調のローブとは別の紫・青なので、ユナの緑・ミラの橙の仲間と並べて見分けがつくか。→ Task 3 の Step 1 で `probe_colors.py` を、髪・ローブ・外套・杖の柄・肌の組で測り、並べたページで見せる
5. ユナ・セラの書き出しで、ほかのユニット（特にイネス・ミスト。部品を共有する）の PNG が 1 バイトでも変わる。→ Step 6 で `git status assets/images` が `ally12-map.png`（`ally06-map.png`）だけであること。`equip/bow`・`equip/arrow`・`equip/staff`・`fist/ines`・`fist/mist` の部品ファイルは書き換えない（`git diff --stat` で 0 件）

---

### Task 1: ブランチを切って準備する

**Files:** HANDOVER.md（進捗だけ）

**Interfaces:**
- Produces: ブランチ `feat/unit-art-bow-staff`（develop の c0e6f5f から）。台帳 `.superpowers/sdd/2026-11-26-unit-art-all-3/progress.md`

- [ ] **Step 1:** `git status --short` が空、`git switch -c feat/unit-art-bow-staff`（develop から）。台帳を作り、`Ruling:` に実行方法（Native か、依頼者の選択）と「作業は今のチェックアウト（worktree を作らない）」、「PR のマージは依頼者の合図を待つ」を書く
- [ ] **Step 2:** この計画のコミット `docs: 弓と杖の 2 人の計画を書く`。HANDOVER の `## 進捗` を、工程 3 の PR 4（弓と杖）の実装に進めて直す（`次にやること` に PR 5・6 と部品名の付け替え先の ID を残す）

### Task 2: ユナ（ally12、弓・女・頭巾・ポニーテール）のマップの絵

**Files:**
- Create: `pixel-asset-forge/assets/part/body/ally12/`（`body/mist/` の 24 コマの複製を、上着・ズボン・靴の色だけ替えた芯。さらに `atk_draw`・`atk_release` の 8 枚を `atk_hit` の複製で足す）、`hair/ally12/`（前の部品 `hair_ally12_<dir>_base.txt` と後ろの部品 `hair_ally12_back_<dir>_base.txt`。ポニーテールは後ろの部品）、`head/ally12/`（頭巾。`head/bandana_female/` の形を緑に替え、結び目の有無は CP1 で決める）、`cloth/ally12/`（緑のフード付きの外套の襟と、茶の革の斜めの紐・ベルト。1 つの部品。矢筒は描かない）、`compose/ally12.json`、`checks/ally12.json`、`sheets/ally12.txt`、`assets/unit/ally12/`（32 コマ）
- Modify: `assets/units/ally12.json`（`attack` を 6 コマ・6fps）、`sprites.json`（`"sheets/ally12.png": "ally12-map.png"`。ally09 の行に合わせる）、`assets/images/ally12-map.png`、`pixel-asset-forge/palette/`（新しい色見本と用途の色）、`pixel-asset-forge/types/unit/SPEC.md`（ユナの節。弓の持ち方の節の後ろのバルド・オルトの並びの次）、`pixel-asset-forge/CLAUDE.md`（コマンド一覧に `compose.py compose/ally12.json --check`）
- 手本: 重なり順は `checks/bow-bandit-a-f.json` の `orders`（目は E0 に、服は `cloth_ally12` に読み替え）、32 コマの構成と弓・矢・拳の層は `compose/ines.json`・`checks/ines.json`、作り方の流れと色の測り方は `compose/ally09.json`・SPEC のバルドの節

**Interfaces:**
- Produces: `compose/ally12.json`（32 コマ。`down_atk_wind`・`down_atk_draw`・`down_atk_hit`・`down_atk_release` など `compose/ines.json` と同じコマ名）、`checks/ally12.json`（部品名 `eye_E0`・`cloth_ally12`・`hair_ally12`・`hair_ally12_back`・`head_ally12`・`bow`・`arrow`・`bow_hand`・`arrow_hand`・`CORE`）

- [ ] **Step 1（CP0）:** 顔（`illust-asset-forge/characters/ally12/source/face.png`）と全身絵（`source/fullbody.png`）の食い違いを、顔を正にして決め、台帳に `Ruling:` で書く。分かっている食い違い: 顔は髪が茶・頭巾は黄緑・外套は深緑で、全身絵は上着が黄緑・タイツが茶・靴が緑（顔に写る髪・頭巾・外套は顔、ズボン・靴は全身絵）。顔は右に高いポニーテールで、全身絵は同じ。矢筒は描かない（上の範囲外）。設定シートの HTML（入力・決めたこと・部品の分解・色と測った相手・CP1 の軸・動きの方針）を作り、Artifact で見せる。新しい色見本（髪・頭巾・外套・上着・ズボン・靴・革）を描く前に `probe_colors.py` で測る（`palette/uses/unit.json` に用途の色、`palette/kinds.json` に種類。頭巾は種類 `headgear`、髪は `hair`、革の紐・ベルトは `ornament`）。動きの方針はイネスの動きのページ（`out/anim/ines.html`）を手本に添える
- [ ] **Step 2（CP1）:** 髪（前髪・ポニーテールの付け根と房）と頭巾（結び目の有無）の案を単品で 4 方向描き、`tools/unit_picker.py` の組み合わせを選ぶページで見せる。ポニーテールは後ろの部品で、体の奥。耳の前の房は上の決まりに従う。選ぶのは Claude の判断で、台帳に書く
- [ ] **Step 3（CP2）:** `compose/ally12.json`・`checks/ally12.json` を作り、`.venv/bin/python tools/compose.py compose/ally12.json --frames down_base --out <scratchpad>/cand` で正面を組む。`.venv/bin/python tools/unit_rules.py checks/ally12.json` が終了コード 0 になってから Artifact で見せる
- [ ] **Step 4（CP3）:** 残り 3 方向を組み、`tools/contact_sheet.py` でイネス・ミラと並べて見せる
- [ ] **Step 5（CP4）:** 待機・歩き・攻撃の 32 コマを組む。`sheets/ally12.txt`（イネスの写し）と `assets/units/ally12.json` を直す。次が全部通ること
  - `.venv/bin/python tools/validate.py` → 終了コード 0
  - `.venv/bin/python tools/check_colors.py` → hard failure は ISSUES 記録済みの杖の敵 2 体だけ
  - `.venv/bin/python tools/unit_rules.py checks/ally12.json` → 終了コード 0（例外は無い）
  - `.venv/bin/python tools/compose.py compose/ally12.json --check` → 終了コード 0
  - `.venv/bin/python tools/sheet.py sheets/ally12.txt` → 足元 y=30 がそろい、幅 192

  通ったら README の 3 段で `../assets/images` へ書き出し、リポジトリ直下で `python3 tools/anim-page.py assets/units/ally12.json out/anim/ally12.html` を流し、その HTML を Artifact で見せる
- [ ] **Step 6:** `git status --short assets/images` が `ally12-map.png` だけ、`git diff --stat -- pixel-asset-forge/assets/part/equip pixel-asset-forge/assets/part/fist/ines` が 0 件（Review Focus 5）
- [ ] **Step 7:** `npm test`（背景）・`npm run build`・`npm run balance -- --check`（Review Focus 1。結果を台帳に）。ユナが出る戦闘（`assets/stages/stage6.json`・`stage7.json`）か、出ないときは再生ページで代える（台帳に書く）
- [ ] **Step 8:** SPEC にユナの節（部品・重なり順・色・決めたこと・攻撃 6 コマ）を足し、CLAUDE.md のコマンドに 1 行足す。コミット `feat: ユナのマップの絵を部品で組む`

### Task 3: セラ（ally06、魔法の杖・女・フード・長い紫髪）のマップの絵

**Files（Task 2 と同じ形で `ally12` を `ally06` に読み替える）:**
- Create: `assets/part/body/ally06/`（`body/mist/` の複製。上着・靴の色だけ替える。ローブが足元まで覆うので、芯の服は見えにくい）、`hair/ally06/`（前の部品と後ろの部品。長い紫髪が顔の両側からフードの下へ流れる）、`head/ally06/`（フード。被り物の種類。顔の開口を残し、縁をすべて輪郭で閉じる。レースの縁は描かない）、`cloth/ally06/`（紫のローブ・肩の外套・金の飾り。1 つの部品。`cloth/robe/` の足元までの形を手本に色と襟を替える）、`compose/ally06.json`、`checks/ally06.json`、`sheets/ally06.txt`（ミストの写し）、`assets/unit/ally06/`（24 コマ）
- Modify: `sprites.json`（`ally06-map.png`）、`assets/images/ally06-map.png`、`palette/`、SPEC（セラの節）、CLAUDE.md（コマンド 1 行）
- 手本: `compose/mist.json`・`checks/mist.json`（部品の層と重なり順。魔法使いの帽子 `head_witch` をフード `head_ally06` に、`hair_mist` を `hair_ally06`・`hair_ally06_back` に、`cloth_robe` を `cloth_ally06` に読み替える。長い髪の後ろの部品は `bow-bandit-a-f` と同じく一番奥）

**Interfaces:**
- Consumes: Task 2 で決めた台帳の書き方と、`hair_ally12_back` の「後ろの部品を一番奥・背面は前の部品」の置き方（ミラの SPEC の例外 2 つ）。セラの `up` は髪が体の手前
- Produces: `checks/ally06.json`（部品名 `eye_E0`・`cloth_ally06`・`hair_ally06`・`hair_ally06_back`・`head_ally06`・`staff`・`staff_hand`・`free_hand`・`CORE`）

- [ ] **Step 1（CP0）:** 顔と全身絵の食い違いを、顔を正にして決める。分かっている食い違い: フードは顔・全身絵とも被っている（フードは被り物）。顔のローブは紫に白い縁、全身絵は紫のローブに青の下衣・金の飾り・白い袖口（顔に写る色は顔、写らない下衣・飾りは全身絵）。全身絵の杖は先に金の大きな輪の飾りがあるが、ミストの杖を使う（依頼者の指示。形は変えない）。サンダルの足先は全身絵（茶）。ユナの緑・ミラの橙・ミストの黒基調のローブと並べたページを Artifact で見せる（Review Focus 4）。新しい色見本は描く前に `probe_colors.py` で測る
- [ ] **Step 2〜8:** Task 2 の Step 2〜8 と同じ（`ally12` を `ally06`、32 コマを 24 コマ、`stage6.json`・`stage7.json` を、`ally06` が仲間で出るステージと説得の相手 `ally06-foe` が出るステージに読み替える。Step 3 の `orders` は `checks/mist.json`。Step 5 の幅は 128。Step 6 で変わる PNG は `ally06-map.png` だけ（ミストの PNG が変わらないこと）。Step 7 の `npm run balance -- --check` は、攻撃のコマ数が変わらないので、Task 2 の後と変わらないことの確認だけ）

### Task 4: 引き継ぎ・台帳・最終レビュー

**Files:**
- Modify: `HANDOVER.md`
- Create: `docs/superpowers/ledgers/2026-11-26-unit-art-all-3.md`

- [ ] **Step 1:** HANDOVER の `## 進捗` を直す（弓と杖の 2 人が済んだ。次は PR 5 の盾）。「工程 2・3 の結果」にユナ・セラの判断（食い違いの決め方・矢筒を描かないこと・ユナの攻撃 6 コマと `balance` の結果）を足す
- [ ] **Step 2:** 台帳を `docs/superpowers/ledgers/2026-11-26-unit-art-all-3.md` に写し、コミット `docs: 弓と杖の 2 人を終えた引き継ぎと台帳`
- [ ] **Step 3:** ブランチ全体（`develop..feat/unit-art-bow-staff`）を最終レビューに出す。Minor も PR 前に直す（絵が変わるものは、赤枠で見せてから）。依頼者が頼んだら、develop 向けに PR を作って URL を伝えて止まる（マージは依頼者）
