# ボルグを新しい画風で作り直す Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ボルグ（ally05）の顔（ふつう）と全身絵をデフォルトの画風で作って取り込み、ゲームの顔とマップの絵を差し替える。

**Architecture:** 生成（GPU）は依頼者が Colab で行い、Claude は貼って実行するセル（タグの足し引き）を渡す。採用した絵は Drive のコネクターで取り、`illust-asset-forge/` に取り込んで書き戻す。ゲームの顔は元画像から切り出し、マップの絵は pixel-asset-forge の「設定シート」の流れで、差のある部品だけを直す。

**Tech Stack:** illust-asset-forge（Python 3.12+、diffusers は Colab のみ）、pixel-asset-forge（Python 3.14）、TypeScript/Vitest（ゲーム）、Artifact（見せるページ）

**Spec:** `docs/superpowers/specs/2026-11-23-borg-restyle-design.md`

## Global Constraints

- 画風はデフォルト（thick-line-flat、`illust-asset-forge/defaults.yaml`）。`characters/ally05/character.yaml` に `style` を書かない
- 絵は Drive の `MyDrive/character-tactics/illust-asset-forge/selected/ally05/` だけから取る（forge 本体の `MyDrive/illust-asset-forge/` と取り違えない。親フォルダをたどって確かめる）
- 作るのは顔（`normal`）と全身だけ。表情（`hurt`・`shout`）は作らない。`FACE_PX` は変えない
- 見本の騎士（`characters/knight/`）は変えない
- 顔は左向きで採用する（右向きなら「左右反転して採用」）
- 依頼者に頼む画面操作は、貼るセル・押すボタンの名前まで書く（開く URL があれば載せる）
- 絵は HTML のページにして Artifact で見せる。承認前にコミット・書き出しへ進まない
- ドット絵の確認の道具で落ちたら、道具に従って絵を直して通す（CLAUDE.md）。承認済みの重なり順（`pixel-asset-forge/checks/borg.json`）と動きは変えない
- push と PR は依頼者が頼んだときだけ。push の前に HANDOVER.md の `## 進捗` を直す
- `illust-asset-forge/` のエンジン・道具を直したら `illust-asset-forge/UPSTREAM.md` に 1 行（この計画では直す予定は無い）

## Review Focus

1. 背景を透明にするとき、白に近い鎧の明るい所が外の白とつながっていると、鎧に穴が開く → Task 5 で、透明にした画素の図を出して確かめる
2. 32px の欄で顔が小さすぎて潰れる（前のボルグは白い背景が残って顔が小さかった） → Task 5 の見え方のページに 32px を必ず入れる
3. 顔と全身絵で髪の色・鎧の色が食い違う → Task 6 の最初に一覧にして依頼者に一度に聞く（SPEC の決まり）
4. 新しい鎧の色が剣の刃 `blade_base` と区別できない（前のボルグで ΔE 5.8 だった） → Task 6 で `probe_colors.py` を刃・盾・金と測る
5. Drive で同じ名前の古い絵を取る → Task 4 で取った 2 枚の条件の `character`・`run_id`・`commit` を見る（`commit` が工程 1 のマージ後のもの、`run_id` が Task 2・3 の日時）

---

### Task 1: 参考のページと、顔の 1 回り目のセル

**Files:**
- Create: `<scratchpad>/borg-ref/index.html`（Artifact。リポジトリに入れない）

**Interfaces:**
- Produces: 依頼者に渡す顔のセル（下）。結果は台帳 `.superpowers/sdd/2026-11-23-borg-restyle/progress.md` に「案の名前・extra・remove・依頼者の感想」で書く

- [ ] **Step 1: 参考のページを作って Artifact で公開する**

中身: 今のマップの絵（`assets/images/ally05-map.png` の各方向の `base` のコマを 8 倍、4 方向）、今のゲームの顔（`assets/images/ally05-face.png`）、騎士の見本の顔（`illust-asset-forge/characters/knight/source/face.png`）、設計書の「顔と今のドット絵」の表（髪 赤茶・鎧 中くらいの灰色・金 少し・服 紺）。

- [ ] **Step 2: 1 回り目のセルを依頼者に渡す**

依頼者への手順: Colab で `https://colab.research.google.com/github/akabee0161/character-tactics/blob/develop/illust-asset-forge/notebooks/run.ipynb` を開く → ランタイムを T4 にする → 「1. 準備」「2. モデルの読み込み」のセルの ▶ → 「＋ コード」で下を貼って ▶ → 出た画面で、参考のページに近い顔の「採用」（右向きなら「左右反転して採用」）を押す。気に入るものが無ければ押さずに、近いもの・違う所を伝える。

```python
CHAR = "ally05"
VARIANTS = {
    "1 鎧を暗く・金を細く": dict(extra="(dark grey armor:1.3), thin gold trim, navy blue clothes", remove="gold trim"),
    "2 鋼の灰色": dict(extra="grey armor, steel armor, thin gold trim, navy blue tunic", remove="dark grey armor, gold trim"),
    "3 案1＋赤茶の髪": dict(extra="(dark grey armor:1.3), thin gold trim, navy blue clothes, (auburn hair:1.2)", remove="gold trim, dark reddish brown hair"),
}
paths = []
for name, kw in VARIANTS.items():
    print("==", name)
    paths += forge.generate([CHAR], "face", seeds=[3034254740], on_image=F.show_one, **kw)
    paths += forge.generate([CHAR], "face", n=3, on_image=F.show_one, **kw)
P.pick(forge, paths)
```

（12 枚、T4 で約 4 分＋モデルの読み込み。騎士のシード 3034254740 を各案に 1 枚入れるのは設計書どおり）

- [ ] **Step 3: 台帳に 1 回り目の案を書く**

### Task 2: 顔を採用するまで回す

**Interfaces:**
- Consumes: Task 1 のセルの形（`VARIANTS` を書き換えるだけ）
- Produces: Drive の `selected/ally05/face.png`（依頼者が採用）

- [ ] **Step 1: 依頼者の結果（採用した、またはスクリーンショット・言葉）を受け取る**
- [ ] **Step 2: 採用していなければ、依頼者の言葉と参考のページの差から、次の `VARIANTS` を作って渡す**（1 回り 12 枚まで。足すタグは `extra`、設定のタグを消すのは `remove`。`remove` は設定のタグにだけ効く）
- [ ] **Step 3: 回りごとに台帳に書く。採用したら、採用した案の extra・remove を台帳に書く**

### Task 3: 全身絵

**Interfaces:**
- Consumes: Task 2 で採用した案の `extra`・`remove`
- Produces: Drive の `selected/ally05/fullbody.png`

- [ ] **Step 1: 全身のセルを渡す**

採用した案の `extra` に、剣を右手に持たせるタグ（`holding sword, sword in right hand, shield in left hand`）を足す。`remove` は採用した案のまま。シードは固定しない、`n=8`。

```python
kw = dict(extra="<採用した案の extra>, holding sword, sword in right hand, shield in left hand", remove="<採用した案の remove>")
paths = forge.generate(["ally05"], "fullbody", n=8, on_image=F.show_one, **kw)
P.pick(forge, paths)
```

依頼者が見るのは、服の種類・色・持ち物、髪の色・髪型が顔と合っているか。採用しなければ Task 2 と同じく回す。

- [ ] **Step 2: 台帳に書く**

### Task 4: 取り込み・書き戻し・書き出し

**Files:**
- Modify: `illust-asset-forge/characters/ally05/character.yaml`
- Create: `illust-asset-forge/characters/ally05/source/face.png`・`source/fullbody.png`・`face.png`・`fullbody.png`・`params.json`（`artgen.export` が作る）

- [ ] **Step 1: Drive のコネクターで 2 枚を取る**

`search_files` で `face.png`・`fullbody.png` を探し、`get_file_metadata` で親フォルダをたどって `MyDrive/character-tactics/illust-asset-forge/selected/ally05/` の下のものだけを `download_file_content` で取る。`<scratchpad>/selected/ally05/` に置く。`selection.json` は表情を作らないので要らない。

- [ ] **Step 2: 条件を確かめる**

Run: `cd illust-asset-forge && .venv/bin/python -m artgen.pnginfo <scratchpad>/selected/ally05/*.png`
Expected: 2 枚とも `character: ally05`・`style: thick-line-flat`、`template` が `face`・`fullbody`、`run_id` が Task 2・3 の日時。顔は `flipped` が左向きになる値

- [ ] **Step 3: `install_selection` で取り込む**（`illust-asset-forge/CLAUDE.md`「受け取った画像の扱い」。出力の「消した」に意図しないものが無いこと）

- [ ] **Step 4: 書き戻しの一覧を `character.yaml` に戻す**

鎧・服の色は `outfit`、髪は `appearance`、剣は `items`（`use_items` が `true` の全身だけに効く）。`remove` のタグは該当の欄から消す。並び順が絵の条件と変わるのは設計書どおり（エンジンは直さない）。

- [ ] **Step 5: タグの集合が同じことを確かめる**

`artgen.prompt.build_prompt` で、顔は `face`・全身は `fullbody` のテンプレートで上書きなしに組み立て、`set(positive.split(", "))` と PNG の `prompt` の集合が同じこと。ネガティブも同じく。
Expected: 2 枚とも差が空

- [ ] **Step 6: 書き出しとテスト**

Run: `cd illust-asset-forge && .venv/bin/python -m artgen.export ally05 && .venv/bin/pytest`
Expected: export が通る、pytest が全部通る

- [ ] **Step 7: Commit**

```bash
git add illust-asset-forge/characters/ally05
git commit -m "feat: ボルグの顔と全身絵を新しい画風で取り込む"
```

### Task 5: ゲームの顔の差し替え

**Files:**
- Modify: `assets/images/ally05-face.png`、`README.md`（「顔グラの例外」）
- Create: `<scratchpad>/borg-face/`（切り出しのスクリプトと見え方のページ。リポジトリに入れない）

- [ ] **Step 1: 切り出す範囲を決める**

`illust-asset-forge/characters/ally05/source/face.png`（1024px）で、顔（髪の上端〜あご、左右の耳）が正方形の中央に来る範囲を決める。前の範囲は 640px 角（(300,0)〜(940,640)）。

- [ ] **Step 2: 切り出し・透明化・縮小のスクリプトを書いて実行する**

外につながる白（四辺から塗りつぶしで届く、ほぼ白の画素）だけを透明にし、256px に縮める（LANCZOS）。透明にした画素を赤で塗った図も出す（Review Focus 1）。

- [ ] **Step 3: 見え方のページを Artifact で見せる**

256px の元、`FACE_PX` の 64・40・32px（ゲームと同じく縮めて描いたもの）、前の顔との並び、透明化の図。依頼者の承認を待つ。

- [ ] **Step 4: 承認されたら `assets/images/ally05-face.png` を置き換え、README「顔グラの例外」を直す**

元画像の場所をこのリポジトリの `illust-asset-forge/characters/ally05/source/face.png`、切り出した範囲を Step 1 の値にする。画風が thick-line-flat になったことを書く。

- [ ] **Step 5: テストとビルド**

Run: `npm test && npm run build`
Expected: どちらも通る

- [ ] **Step 6: Commit**

```bash
git add assets/images/ally05-face.png README.md
git commit -m "feat: ボルグのゲームの顔を新しい画風の絵に差し替える"
```

### Task 6: マップの絵の直し

**Files:**
- Modify: `pixel-asset-forge/assets/part/hair/borg/`・`cloth/borg/`・`equip/shield/borg/`・`body/borg/` のうち差のあるもの、色見本（必要なら）、`assets/images/ally05-map.png`（書き出し）、`pixel-asset-forge/types/unit/SPEC.md`（ボルグの節）

`pixel-asset-forge/types/unit/SPEC.md` の「描く手順」と「入力がイラストのときの設定シート」に従う。ここでは、その流れの中でこの計画が決めることだけを書く。

- [ ] **Step 1: 顔と全身絵の食い違いの一覧を依頼者に出す**（無ければ飛ばす。基本は「顔に写っている所は顔を正」）
- [ ] **Step 2: 差の一覧を作る**

今の部品・色見本（SPEC のボルグの節）と新しい顔・全身絵を、髪（色・形）・鎧（色・金の量・形）・服・盾・肌で比べ、「変える／変えない」を表にする。色は顔の元画像から点で取り、既存の色見本で近いものを探す。新しい色は `tools/probe_colors.py` で輪郭・肌・服・刃・盾・金と測る。

- [ ] **Step 3: 設定シート（CP0）を Artifact で見せ、承認を待つ**（差の表を中心に。動きの方針は今のまま）
- [ ] **Step 4: 変える部品の案を作り、`tools/unit_picker.py` の組み合わせを選ぶページで見せる（CP1）**
- [ ] **Step 5: 部品を直して組み、自己チェック（SPEC「自己チェック」）を通し、CP2・CP3（正面・4 方向の `base`）を見せる**
- [ ] **Step 6: アニメの全コマを組み、ゲームと同じ fps の再生ページで CP4 を見せる**
- [ ] **Step 7: 書き出してテスト**

Run: `sprites.json` の書き出しのコマンド（README「ドット絵の作りかた」）→ `npm test && npm run build`
Expected: `assets/images/ally05-map.png` が変わり、どちらも通る

- [ ] **Step 8: ブラウザで戦闘の中の顔とマップの絵を見る**（README の CDP 手順）
- [ ] **Step 9: SPEC のボルグの節（変えた部品・色）を直して Commit**

```bash
git add pixel-asset-forge assets/images/ally05-map.png
git commit -m "feat: ボルグのマップの絵を新しい顔に合わせて直す"
```

### Task 7: 引き継ぎと台帳

**Files:**
- Modify: `HANDOVER.md`
- Create: `docs/superpowers/ledgers/2026-11-23-borg-restyle.md`（台帳の写し）

- [ ] **Step 1: HANDOVER.md に工程 2 の結果を書く**

採用した案のタグ、回りの数、プロンプトの寄せ方で効いたこと・効かなかったこと（工程 4 で使う）、確かめていないこと。`## 進捗` を工程 3 の手前（`段階: 完了` ではなく、工程 2 を `（完了）`、工程 3 を ` ← 今ここ`、`段階: 設計の相談`）にする。

- [ ] **Step 2: 台帳を写して Commit**

```bash
git add HANDOVER.md docs/superpowers/ledgers/2026-11-23-borg-restyle.md
git commit -m "docs: 工程 2（ボルグの作り直し）の結果と台帳"
```
