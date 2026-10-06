# ユニット生成で出てきた課題の片付け 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ガウ（PR #28）までのユニット生成で出てきた課題のうち、大きな方針の決定が要らないものを、ユニットを新しく描かずにまとめて片付ける。

**Architecture:** forge（`pixel-asset-forge/`）の道具の不具合を TDD で直し、SPEC・README・ISSUES・HANDOVER を今の状態に合わせる。待機の2コマ目の名前を `breathe` から `idle2` に変える（書き出す PNG は1画素も変えない）。git の管理外にある台帳を `docs/superpowers/ledgers/` にログとしてコミットし、PR のテンプレートを作る。絵は変えない。

**Tech Stack:** Python 3.14（forge、unittest、Pillow）、TypeScript（ゲーム、Vitest）、素の HTML・JS（`unit_picker.html`・`anim-page.html`）

**Spec:** 依頼者との会話（2026-10-04〜05）。課題の出どころは `pixel-asset-forge/ISSUES.md`、`HANDOVER.md`、`.superpowers/sdd/2026-10-04-unit-workflow-gau/progress.md`。②12〜18 は依頼者が「すべて推し」で承認した（2026-10-05）

## 依頼者の決定（2026-10-05、すべて Claude の推しのまま）

- 12 PR テンプレートの項目は、PR #28 で使った5項目（概要・変更点・結果・リスク・確かめたこと）
- 13 `.superpowers/sdd/` から残すのは、依頼者の判断の記録（各フォルダの `progress.md`）と振り返り用メモだけ。置き場は `docs/superpowers/` のログ。候補の絵と作業の指示書は残さない
- 14 組み立て後の描き足し（`finish.py`・`anim.py` など）を forge の道具に移すのは、次の一体まで待つ。13 でスクリプトの置き場の記録は残す
- 15 `*_breathe` は `*_idle2` に名前を変える。シートの参照も一緒に変える
- 16 ガウの部品には完全な単品を描き足さない（使い回すときに描く）
- 17 足元アンカーは足元基準にする → **調べたところ、ゲーム側は 2026-09-28 に足元基準になっていた**（`src/render/sprites.ts` の `bodyCenter`・`FOOT_INSET`）。ISSUES の行が古いだけなので、確かめてから行を消す
- 18 `atk_hit` の確認にデバッグ表示を足す → **調べたところ、`?debug` の一時停止・コマ送り・コマ番号の表示は 2026-09-26 に入っていた**（README「`?debug`」）。残っているのは実際に確かめることだけなので、確かめて依頼者に見せ、行を消す

## Global Constraints

- コミットは Conventional Commits ＋日本語の要約（CLAUDE.md）。author は `akabee0161`
- **絵（`assets/**/*.txt` の画素）を変えない。** 書き出すシートの PNG（`assets/images/*-map.png`）は1バイトも変わらないこと
- `docs/superpowers/` の既存のログは遡って直さない。最新の状態は README.md・CLAUDE.md（forge では README.md・CLAUDE.md・`types/*/SPEC.md`・ISSUES.md）に書く
- forge の `tools/` を触ったら `.venv/bin/python -m unittest discover -s tests` を通す（開始時 230 件 OK）。ゲームは `npm test`（開始時 776 件 pass）と `npm run build`
- 直す前に、その課題がまだ残っているかを確かめる（ISSUES.md の決まり）。直したら ISSUES.md の行を消す
- PR は依頼者の指示があったときだけ作る。push も依頼者に確かめてから

## Review Focus

- `unit_picker` のラベルに `<`・`&`・`"` が入っていても、その文字のまま表示され、ページの JS が止まらないこと（Task 1。ブラウザで実際に開いて確かめる）
- 1つの案に部品が2つあり、同じ文字に別の色を当てていても、「部品だけ」の絵がそれぞれの部品の色で出ること（Task 1）
- `face_down.py` に正方形でない画像を渡しても、トレースバックでなく、下まで読んだ結果かエラーメッセージが出ること（Task 2）
- `# frames:` を書いていない古いシート定義は、今までどおり通ること（Task 3。sheet_gif.py の既存のテストが守る）
- 名前を `idle2` に変えた後も、シートの PNG が1バイトも変わらないこと（Task 4）

---

## ファイルの対応

| Task | 作る・変えるファイル |
|---|---|
| 1 | `pixel-asset-forge/tools/unit_picker.py`・`unit_picker.html`・`tests/test_unit_picker.py`・`ISSUES.md` |
| 2 | `pixel-asset-forge/tools/face_down.py`・`present.py`・`tests/test_present_face_down.py`・`ISSUES.md` |
| 3 | `pixel-asset-forge/tools/sheet.py`・`tests/test_sheet.py`・`sheets/{roran,ines,gau}.txt`・`README.md`・`ISSUES.md` |
| 4 | `pixel-asset-forge/assets/unit/{roran,ines,gau}/*_breathe.txt`（名前だけ）・`assets/unit/gau/parts/body_breathe_*.txt`（名前だけ）・`sheets/*.txt`・`compose/gau.json`・`tools/sheet.py`・`types/unit/SPEC.md`・`ISSUES.md` |
| 5 | `pixel-asset-forge/types/unit/SPEC.md`・`README.md`・`CLAUDE.md`・`ISSUES.md` |
| 6 | `tools/anim-page.py`・`tools/anim-page.html` |
| 7 | `.github/pull_request_template.md`（新規）・`CLAUDE.md` |
| 8 | `docs/superpowers/ledgers/`（新規）・`pixel-asset-forge/ISSUES.md` |
| 9 | `pixel-asset-forge/ISSUES.md` |
| 10 | `HANDOVER.md` |

---

### Task 1: `unit_picker` のラベルの埋め込み・部品だけの絵・`refs` の検査

**Files:**
- Modify: `pixel-asset-forge/tools/unit_picker.py`
- Modify: `pixel-asset-forge/tools/unit_picker.html`
- Test: `pixel-asset-forge/tests/test_unit_picker.py`
- Modify: `pixel-asset-forge/ISSUES.md`（「`unit_picker.html` がラベルを HTML として埋め込む」「`unit_picker.py` の「部品だけ」の絵と `refs` の検査が甘い」の2行を消す）

**Interfaces:**
- Produces: `_Encoder.encode_names(cells: list[list[str | None]]) -> str`（色の名前の升目を、色の一覧の番号の文字にする。`None` は透明）

- [ ] **Step 1: 失敗するテストを書く**

`tests/test_unit_picker.py` に足す（`import re` を先頭の import に足す）。

```python
class PartsAloneTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()

    def tearDown(self):
        self.ws.close()

    def test_two_parts_in_one_variant_keep_their_own_colours(self):
        for d in DIRS:
            self.ws.write(f"hood_{d}.txt", grid_text({(11, 10): "h"}, "h=leaf_base"))
            self.ws.write(f"ear_{d}.txt", grid_text({(12, 10): "h"}, "h=skin_base"))
        cfg = self.ws.config(elements={
            "head": {"label": "頭", "variants": {"H1": {"label": "頭巾と耳", "layers": [
                {"part": "hood_{dir}.txt"}, {"part": "ear_{dir}.txt", "z": "back"}]}}},
            "weapon": {"label": "短剣", "variants": {"D2": {"label": "なし", "layers": []}}}})
        data = build_data(load_picker(cfg, root=self.ws.root))
        alone = {"frames": data["parts"], "colours": data["colours"]}
        self.assertEqual(pixel(alone, "H1|down", 11, 10), "#1f5c40")  # leaf_base
        self.assertEqual(pixel(alone, "H1|down", 12, 10), "#f0c49a")  # skin_base


class RefsTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()

    def tearDown(self):
        self.ws.close()

    def test_ref_name_must_not_contain_the_key_separator(self):
        cfg = self.ws.config(refs={"ロラン|旧": "body_{dir}.txt"})
        with self.assertRaisesRegex(PickerError, r"\|"):
            load_picker(cfg, root=self.ws.root)

    def test_ref_name_must_not_be_empty(self):
        cfg = self.ws.config(refs={"": "body_{dir}.txt"})
        with self.assertRaisesRegex(PickerError, "refs"):
            load_picker(cfg, root=self.ws.root)

    def test_ref_path_must_be_a_string(self):
        cfg = self.ws.config(refs={"ロラン": 3})
        with self.assertRaisesRegex(PickerError, "ロラン"):
            load_picker(cfg, root=self.ws.root)


class TemplateTest(unittest.TestCase):
    """ラベルは設定から来るので、HTML として埋め込まず textContent で入れる。"""

    def setUp(self):
        self.text = (REPO_ROOT / "tools" / "unit_picker.html").read_text(encoding="utf-8")

    def test_no_insert_adjacent_html(self):
        self.assertNotIn("insertAdjacentHTML", self.text)

    def test_inner_html_is_only_cleared(self):
        assigned = re.findall(r"innerHTML\s*=\s*([^;]+);", self.text)
        self.assertEqual([a.strip() for a in assigned if a.strip() != '""'], [])
```

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_unit_picker -v 2>&1 | tail -20`
Expected: `test_two_parts_in_one_variant_keep_their_own_colours`（(11,10) が skin_base になる）、`test_ref_name_must_not_contain_the_key_separator`、`test_ref_name_must_not_be_empty`、`test_no_insert_adjacent_html`、`test_inner_html_is_only_cleared` が FAIL。`test_ref_path_must_be_a_string` は今の `_string` で通る（回帰を守るために残す）

- [ ] **Step 3: `unit_picker.py` を直す**

docstring の9行目の「8倍」を「4倍」に直す（ページの上の段は `canvas(4, ...)`）。

`_Encoder` を色の名前の升目から作るようにする:

```python
class _Encoder:
    """画素を、色の一覧の番号の文字にする（`.` は透明）。"""

    def __init__(self) -> None:
        self.palette = load_palette()
        self.colours: list[str] = []

    def encode(self, rows: list[str], charmap: dict[str, str]) -> str:
        cells = []
        for row in rows:
            out: list[str | None] = []
            for ch in row:
                if ch == BACKGROUND:
                    out.append(None)
                elif ch not in charmap:
                    raise PickerError(f"文字 {ch!r} が # map: に無い")
                else:
                    out.append(charmap[ch])
            cells.append(out)
        return self.encode_names(cells)

    def encode_names(self, cells: list[list[str | None]]) -> str:
        out = []
        for row in cells:
            for name in row:
                if name is None:
                    out.append(".")
                    continue
                if name not in self.palette:
                    raise PickerError(f"色 {name!r} がパレットに無い")
                hexcode = "#{:02x}{:02x}{:02x}".format(*self.palette[name])
                if hexcode not in self.colours:
                    if len(self.colours) == len(ALPHABET):
                        raise PickerError(f"色が {len(ALPHABET)} を超える")
                    self.colours.append(hexcode)
                out.append(ALPHABET[self.colours.index(hexcode)])
        return "".join(out)
```

`build_data` の「部品だけ」の絵を、文字でなく色の名前で重ねる:

```python
        for el in picker.elements.values():
            for vid, variant in el.variants.items():
                canvas: list[list[str | None]] = [[None] * body.width for _ in range(body.height)]
                for layer in variant.layers:
                    path = picker.path(layer.part, d)
                    part = grid(path)
                    for y, row in enumerate(part.rows):
                        for x, ch in enumerate(row):
                            if ch == BACKGROUND:
                                continue
                            if ch not in part.charmap:
                                raise PickerError(f"{path}: 文字 {ch!r} が # map: に無い")
                            canvas[y][x] = part.charmap[ch]
                parts[f"{vid}|{d}"] = enc.encode_names(canvas)
```

`load_picker` の `refs` を検査する（`_keys(refs, set(refs), "refs")` の行を置き換える）:

```python
    refs = data.get("refs", {})
    if not isinstance(refs, dict):
        raise PickerError("refs: オブジェクトでない")
    for name in refs:
        if not name or "|" in name:
            raise PickerError(f"refs の名前 {name!r}: 空にできず、| を含められない（ページで名前と向きを | でつなぐ）")
```

- [ ] **Step 4: `unit_picker.html` でラベルを `textContent` で入れる**

`function canvas(` の前に補助関数を足す:

```js
function span(cls, text) {
  const s = document.createElement("span");
  if (cls) s.className = cls;
  s.textContent = text;
  return s;
}
```

次のように置き換える（行番号は 2026-10-05 時点）:

| 行 | 今 | 直した後 |
|---|---|---|
| 195 | ``box.insertAdjacentHTML("beforeend", `<span class="cap">${DIR_LABEL[d]}</span>`);`` | `box.append(span("cap", DIR_LABEL[d]));` |
| 211 | ``row.insertAdjacentHTML("beforeend", `<span class="label">${name}</span>`);`` | `row.append(span("label", name));` |
| 217 | ``row.insertAdjacentHTML("beforeend", `<span class="label">${DATA.unit}</span>`);`` | `row.append(span("label", DATA.unit));` |
| 227 | ``sec.innerHTML = `<h2><span>${DATA.elements[el].label}</span><span class="now" id="now-${el}"></span></h2>`;`` | 下のコード A |
| 240 | ``b.insertAdjacentHTML("beforeend", `<span class="id">${id}</span><span class="lab">${label}</span>`);`` | `b.append(span("id", id), span("lab", label));` |
| 256 | ``row.insertAdjacentHTML("beforeend", `<span class="label">${DATA.elements[el].label} ${id}<br>${label}</span>`);`` | 下のコード B |
| 346 | ``li.innerHTML = `<b>${DATA.elements[el].label}</b>${state[el]}　${label}`;`` | 下のコード C |

```js
// A
  const h2 = document.createElement("h2");
  const now = span("now", "");
  now.id = `now-${el}`;
  h2.append(span("", DATA.elements[el].label), now);
  sec.append(h2);
```

```js
// B
    const lab = span("label", `${DATA.elements[el].label} ${id}`);
    lab.append(document.createElement("br"), label);
    row.append(lab);
```

```js
// C
    const name = document.createElement("b");
    name.textContent = DATA.elements[el].label;
    li.append(name, `${state[el]}　${label}`);
```

`table.innerHTML = ""` と `chosen.innerHTML = ""` は空にするだけなので残す。

- [ ] **Step 5: テストが通ることを確かめる**

Run: `cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | tail -3`
Expected: `OK`（236 件）

- [ ] **Step 6: ブラウザで開いて確かめる**

テストの `Workspace` と同じ形の設定をラベル `刃<4px & "長"` で作り、ページを書き出して Chromium（`/opt/pw-browsers` か `~/.cache/ms-playwright` の Chromium を CDP で）で開く。確かめること: コンソールにエラーがないこと、ボタンのラベルが `刃<4px & "長"` のまま表示されること、ボタンを押すと上の段と `#code` が変わること。スクリーンショットは作業フォルダに置き、コミットしない。

- [ ] **Step 7: ISSUES.md の2行を消してコミットする**

```bash
git add pixel-asset-forge/tools/unit_picker.py pixel-asset-forge/tools/unit_picker.html pixel-asset-forge/tests/test_unit_picker.py pixel-asset-forge/ISSUES.md
git commit -m "fix: unit_picker のラベルを textContent で入れ、部品だけの絵を部品ごとの色で重ね、refs の名前を検査する"
```

---

### Task 2: `face_down.py` の正方形でない画像と色数の超過、`present.py --scale`

**Files:**
- Modify: `pixel-asset-forge/tools/face_down.py`
- Modify: `pixel-asset-forge/tools/present.py`
- Test: `pixel-asset-forge/tests/test_present_face_down.py`
- Modify: `pixel-asset-forge/ISSUES.md`（「`face_down.py` が正方形の画像を前提にしている」「`present.py` の `--scale` が0以下でも通る」の2行を消す）

**Interfaces:**
- Produces: `downsample(img, n) -> Image`（幅を n 升に割り、升の大きさを `img.width / n` とする。高さは `round(img.height / 升の大きさ)` 升。結果は `n × rows`）

- [ ] **Step 1: 失敗するテストを書く**

`tests/test_present_face_down.py` の import を `from face_down import CHARS, cluster, downsample, main as face_down_main` と `from present import LABEL, PAD, build_sheet, main as present_main` に直し、`import contextlib`・`import io`・`import tempfile` を足す。次を足す:

```python
class FaceDownShapeTest(unittest.TestCase):
    def test_a_wide_image_keeps_every_row(self):
        cells = [[RED, BLUE, RED], [BLUE, RED, BLUE]]  # 3升 × 2升
        img = Image.new("RGBA", (12, 8))
        for y in range(8):
            for x in range(12):
                img.putpixel((x, y), cells[y // 4][x // 4])
        small = downsample(img, 3)
        self.assertEqual(small.size, (3, 2))
        self.assertEqual(small.getpixel((0, 1)), BLUE)

    def test_a_tall_image_reads_to_the_bottom(self):
        cells = [[RED, BLUE], [BLUE, RED], [RED, RED]]  # 2升 × 3升
        img = Image.new("RGBA", (8, 12))
        for y in range(12):
            for x in range(8):
                img.putpixel((x, y), cells[y // 4][x // 4])
        small = downsample(img, 2)
        self.assertEqual(small.size, (2, 3))
        self.assertEqual([small.getpixel((x, 2)) for x in range(2)], [RED, RED])


def run(main, argv: list[str]) -> tuple[int, str]:
    err = io.StringIO()
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(err):
        code = main(argv)
    return code, err.getvalue()


class MainErrorsTest(unittest.TestCase):
    def test_face_down_reports_too_many_colours(self):
        n = len(CHARS) + 1
        img = Image.new("RGBA", (n, 1))
        for x in range(n):
            img.putpixel((x, 0), (x * 3 % 256, (x * 50) % 256, (x * 90) % 256, 255))
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "many.png"
            img.save(path)
            code, err = run(face_down_main, [str(path), str(n), str(Path(tmp) / "out")])
        self.assertEqual(code, 2)
        self.assertIn("色が", err)

    def test_present_rejects_a_scale_below_one(self):
        with tempfile.TemporaryDirectory() as tmp:
            code, err = run(present_main, [str(Path(tmp) / "o.png"), "x.txt", "--scale", "0"])
        self.assertEqual(code, 2)
        self.assertIn("--scale", err)
```

色が多すぎるテストの色は、どの2色も各成分の差が 14 を超えるように作ること。上の式で足りない場合は、`x` ごとに R・G・B を `(x*37)%256, (x*91)%256, (x*151)%256` のように変えて、`cluster` が `len(CHARS)+1` 色を返すことを先に確かめる。

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_present_face_down -v 2>&1 | tail -15`
Expected: `test_a_wide_image_keeps_every_row`（(3,3) になる）・`test_a_tall_image_reads_to_the_bottom`（(2,2) になる）・`test_face_down_reports_too_many_colours`（ValueError のトレースバック）・`test_present_rejects_a_scale_below_one`（Pillow のエラー）が FAIL か ERROR

- [ ] **Step 3: 直す**

`face_down.py`:

```python
def downsample(img: Image.Image, n: int) -> Image.Image:
    """幅を n 升に割る。升は正方形とし、高さは升の大きさで割った数だけ読む。"""
    img = img.convert("RGBA")
    step = img.width / n
    rows = max(1, round(img.height / step))
    small = Image.new("RGBA", (n, rows))
    for y in range(rows):
        for x in range(n):
            sy = min(int((y + 0.5) * step), img.height - 1)
            small.putpixel((x, y), img.getpixel((int((x + 0.5) * step), sy)))
    return small
```

`main` の `rows, colours = cluster(small)` を囲む:

```python
    try:
        rows, colours = cluster(small)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
```

`main` の N の表示（`"   " + "".join(str(x % 10) for x in range(args.n))`）はそのままでよい。8倍の画像は `backdrop.resize((small.width * 8, small.height * 8), ...)` に直す（今は `args.n * 8` の正方形）。docstring の「N 升に戻し」を「横を N 升に戻し（升は正方形、縦は画像の高さから決まる）」に直す。

`present.py` の `args = parser.parse_args(argv)` の直後:

```python
    if args.scale < 1:
        print("error: --scale は1以上", file=sys.stderr)
        return 2
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | tail -3`
Expected: `OK`

- [ ] **Step 5: ISSUES.md の2行を消してコミットする**

```bash
git add pixel-asset-forge/tools/face_down.py pixel-asset-forge/tools/present.py pixel-asset-forge/tests/test_present_face_down.py pixel-asset-forge/ISSUES.md
git commit -m "fix: face_down.py を正方形でない画像と色数の超過に対応させ、present.py の --scale を検査する"
```

---

### Task 3: シート定義の `# frames:` の宣言と列数の検査

**Files:**
- Modify: `pixel-asset-forge/tools/sheet.py`
- Test: `pixel-asset-forge/tests/test_sheet.py`
- Modify: `pixel-asset-forge/sheets/roran.txt`・`ines.txt`・`gau.txt`（宣言の行を足す）
- Modify: `pixel-asset-forge/README.md`（シート定義の説明に `# frames:` を1文）
- Modify: `pixel-asset-forge/ISSUES.md`（「`sheet.py` が列数を検査しない」の行を消す）

**考え方:** ゲームはシートの横幅を「frame × 状態のコマ数の最大」と決めている（`src/engine/sheet-size.test.ts`）。sheet.py はゲームの JSON を読まない（docstring の方針）ので、シート定義の中にコマ数を宣言させ、定義と宣言が合っているかを見る。宣言の無い定義は今までどおり通し、検査しなかったことを表示する（`sheet_gif.py` と既存のテストの定義を壊さない）。

**Interfaces:**
- Produces: `sheet.read_frames_declaration(path: Path) -> dict[str, int] | None`、`sheet.check_columns(rows, declared: dict[str, int]) -> list[str]`（食い違いの説明。空なら合っている）

- [ ] **Step 1: 失敗するテストを書く**

`tests/test_sheet.py` に足す:

```python
GAU_LIKE = (["a b . ."] * 4) + (["a c a d"] * 4) + (["e f a ."] * 4)


class FramesDeclarationTest(unittest.TestCase):
    def test_declaration_is_read(self):
        path = definition(["# frames: idle=2 walk=4 attack=3"] + GAU_LIKE)
        self.assertEqual(sheet.read_frames_declaration(path), {"idle": 2, "walk": 4, "attack": 3})

    def test_no_declaration_is_none(self):
        self.assertIsNone(sheet.read_frames_declaration(definition(GAU_LIKE)))

    def test_declaration_needs_every_state(self):
        with self.assertRaises(SystemExit):
            sheet.read_frames_declaration(definition(["# frames: idle=2 walk=4"] + GAU_LIKE))

    def test_declaration_needs_positive_numbers(self):
        with self.assertRaises(SystemExit):
            sheet.read_frames_declaration(definition(["# frames: idle=2 walk=0 attack=3"] + GAU_LIKE))

    def test_matching_definition_has_no_problems(self):
        rows = sheet.read_sheet(definition(GAU_LIKE))
        self.assertEqual(sheet.check_columns(rows, {"idle": 2, "walk": 4, "attack": 3}), [])

    def test_a_state_using_fewer_columns_is_reported(self):
        rows = sheet.read_sheet(definition(GAU_LIKE))
        problems = sheet.check_columns(rows, {"idle": 2, "walk": 4, "attack": 4})
        self.assertEqual(len(problems), 1)
        self.assertIn("attack", problems[0])

    def test_a_definition_narrower_than_the_most_frames_is_reported(self):
        narrow = (["a b ."] * 4) + (["a c a"] * 4) + (["e f a"] * 4)
        rows = sheet.read_sheet(definition(narrow))
        problems = sheet.check_columns(rows, {"idle": 2, "walk": 4, "attack": 3})
        self.assertTrue(any("walk" in p for p in problems))
        self.assertTrue(any("4" in p and "3" in p for p in problems))
```

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_sheet -v 2>&1 | tail -12`
Expected: `AttributeError: module 'sheet' has no attribute 'read_frames_declaration'`（と `check_columns`）

- [ ] **Step 3: 実装する**

`sheet.py` に `import re` を足し、`read_sheet` の後に置く:

```python
FRAMES_HEADER = re.compile(r"^#\s*frames:\s*(.*)$")


def read_frames_declaration(path: Path) -> dict[str, int] | None:
    """`# frames: idle=2 walk=4 attack=3` を読む。無ければ None。

    ゲームの JSON（sprites.map の各状態の frames）と同じ数を書く。sheet.py は JSON を読まないので、
    定義の中に写しておき、定義の列と食い違えば止める。
    """
    for line in path.read_text(encoding="utf-8").splitlines():
        match = FRAMES_HEADER.match(line.strip())
        if not match:
            continue
        declared: dict[str, int] = {}
        for token in match.group(1).split():
            state, _, count = token.partition("=")
            if state not in STATES or not count.isdigit() or int(count) < 1:
                raise SystemExit(f"error: {path}: '# frames:' の {token!r} が読めない（例: idle=2 walk=4 attack=3）")
            declared[state] = int(count)
        missing = [s for s in STATES if s not in declared]
        if missing:
            raise SystemExit(f"error: {path}: '# frames:' に {', '.join(missing)} が無い")
        return declared
    return None


def check_columns(rows: list[list[str | None]], declared: dict[str, int]) -> list[str]:
    """定義の列が宣言どおりか。ゲームは横幅を frame × 最大コマ数と決めている。"""
    problems = []
    used = columns_per_state(rows)
    for state in STATES:
        if used[state] != declared[state]:
            problems.append(f"{state}: 宣言は {declared[state]} コマ、定義は {used[state]} 列を使っている")
    width, most = len(rows[0]), max(declared.values())
    if width != most:
        problems.append(f"定義の列数 {width} が、宣言の最大コマ数 {most} と違う（シートの横幅が合わなくなる）")
    return problems
```

`main` の `rows = read_sheet(args.definition)` の後に足す:

```python
    declared = read_frames_declaration(args.definition)
    if declared is None:
        print(f"note {display(args.definition)}: '# frames:' が無いので列数は検査していない")
    else:
        problems = check_columns(rows, declared)
        if problems:
            for problem in problems:
                print(f"FAIL {display(args.definition)}: {problem}", file=sys.stderr)
            return 1
```

docstring に1段落を足す:

```
An optional `# frames: idle=2 walk=4 attack=3` line declares how many frames
each state has (copy them from the game's JSON). When it is there, a state
that uses a different number of columns, or a definition whose width is not
the largest count, fails - the game sizes the sheet from those counts.
```

`display` は `gridfile` から import 済み。`display(path)` がリポジトリの外のパスで失敗しないか、テストの一時ファイルで1回 `main` を流して確かめる（失敗するなら `str(path)` にする）。

- [ ] **Step 4: 3体の定義に宣言を足す**

`assets/units/*.json` の `sprites.map` から写す（2026-10-05 時点: ロラン・ガウ `idle=2 walk=4 attack=3`、イネス `idle=2 walk=4 attack=6`）。各定義の、コメントの最後の行の後に1行:

```
# frames: idle=2 walk=4 attack=3
```

イネスは `attack=6`。

- [ ] **Step 5: テストと3体のシートを確かめる**

Run: `cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | tail -3 && for u in roran ines gau; do .venv/bin/python tools/sheet.py sheets/$u.txt --scale 1 -o /tmp/sheetcheck | head -2; done`
Expected: `OK`。3体とも `FAIL` が出ず、`ok ... 128x384`（イネスは `192x384`）

- [ ] **Step 6: README の一文、ISSUES の行、コミット**

README のシート定義の説明（`sheets/roran.txt` は … の定義である、の段落）の後に:「定義に `# frames: idle=2 walk=4 attack=3` の行を書くと、`sheet.py` が列数をゲームの JSON の宣言と照らし合わせる。ゲームの JSON の `sprites.map` と同じ数を書く。」

```bash
git add pixel-asset-forge/tools/sheet.py pixel-asset-forge/tests/test_sheet.py pixel-asset-forge/sheets pixel-asset-forge/README.md pixel-asset-forge/ISSUES.md
git commit -m "feat: シート定義に # frames: の宣言を書けるようにし、sheet.py が列数を検査する"
```

---

### Task 4: 待機の2コマ目の名前を `breathe` から `idle2` に変える

**Files:**
- Rename: `pixel-asset-forge/assets/unit/{roran,ines,gau}/{down,up,left,right}_breathe.txt` → `*_idle2.txt`（12本）
- Rename: `pixel-asset-forge/assets/unit/gau/parts/body_breathe_{down,up,left,right}.txt` → `body_idle2_*.txt`（4本）
- Modify: `pixel-asset-forge/sheets/{roran,ines,gau}.txt`・`compose/gau.json`・`tools/sheet.py`（docstring の例）・`types/unit/SPEC.md`・`ISSUES.md`（「`breathe` という名前と中身が合っていない」の行を消す）

- [ ] **Step 1: 変える前の出力を残す**

```bash
cd pixel-asset-forge
rm -rf /tmp/idle2-before && mkdir -p /tmp/idle2-before
for u in roran ines gau; do .venv/bin/python tools/sheet.py sheets/$u.txt --scale 1 -o /tmp/idle2-before >/dev/null; done
.venv/bin/python tools/compose.py compose/gau.json --check > /tmp/idle2-before/compose-check.txt 2>&1; echo "exit $?" >> /tmp/idle2-before/compose-check.txt
```

- [ ] **Step 2: 名前を変える**

```bash
cd pixel-asset-forge
for u in roran ines gau; do for d in down up left right; do git mv assets/unit/$u/${d}_breathe.txt assets/unit/$u/${d}_idle2.txt; done; done
for d in down up left right; do git mv assets/unit/gau/parts/body_breathe_$d.txt assets/unit/gau/parts/body_idle2_$d.txt; done
sed -i 's/_breathe\b/_idle2/g; s/body_breathe_/body_idle2_/g' sheets/roran.txt sheets/ines.txt sheets/gau.txt compose/gau.json tools/sheet.py
grep -rn "breathe" sheets compose tools assets/unit
```

最後の grep で残ったものを1件ずつ見る。グリッドのコメント（ガウの `*_idle2.txt` の1行目など）に `breathe` が残っていれば `idle2` に直す（画素の行は触らない）。

- [ ] **Step 3: 出力が変わらないことを確かめる**

```bash
cd pixel-asset-forge
rm -rf /tmp/idle2-after && mkdir -p /tmp/idle2-after
for u in roran ines gau; do .venv/bin/python tools/sheet.py sheets/$u.txt --scale 1 -o /tmp/idle2-after >/dev/null; done
for u in roran ines gau; do cmp /tmp/idle2-before/$u.png /tmp/idle2-after/$u.png && echo "$u same"; done
.venv/bin/python tools/compose.py compose/gau.json --check > /tmp/idle2-after/compose-check.txt 2>&1; echo "exit $?" >> /tmp/idle2-after/compose-check.txt
diff <(sed 's/breathe/idle2/g' /tmp/idle2-before/compose-check.txt) /tmp/idle2-after/compose-check.txt && echo "compose same"
.venv/bin/python tools/validate.py | tail -2
.venv/bin/python -m unittest discover -s tests 2>&1 | tail -3
```

Expected: `roran same`・`ines same`・`gau same`・`compose same`、validate が通る、unittest `OK`。ゲームへの書き出しも同じ: `.venv/bin/python tools/export.py` を README 2.10 の手順どおりに流し、`git status --short ../assets/images` が空であること

- [ ] **Step 4: SPEC と ISSUES を直す**

`types/unit/SPEC.md` の `breathe` を `idle2` に直す（「アニメの規約」の `breathe`（待機の2コマ目）、弓の持ち方の「待機の2コマ目（`breathe`）」、短剣の持ち方の `parts/body_breathe_<dir>.txt`）。「アニメの規約」の箇条に1行足す:「待機の2コマ目のファイル名は `*_idle2`（2026-10-05 に `*_breathe` から変えた。頭を下げる呼吸ではなく、持ち物を持つ手を動かす絵になったため。古いログには `breathe` の名前で出てくる）」。ISSUES.md の「`breathe` という名前と中身が合っていない」の行を消す。ISSUES の他の行の `breathe`（「SPEC の「胴は base のまま」が実際の breathe と数セル違う」）は Task 5 で行ごと消すので、ここでは触らない。

- [ ] **Step 5: コミット**

```bash
git add -A pixel-asset-forge/assets/unit pixel-asset-forge/sheets pixel-asset-forge/compose pixel-asset-forge/tools/sheet.py pixel-asset-forge/types/unit/SPEC.md pixel-asset-forge/ISSUES.md
git commit -m "refactor: 待機の2コマ目の名前を breathe から idle2 に変える（シートの PNG は変わらない）"
```

---

### Task 5: unit の SPEC と forge の README・CLAUDE.md を今の状態に合わせる

**Files:**
- Modify: `pixel-asset-forge/types/unit/SPEC.md`
- Modify: `pixel-asset-forge/README.md`
- Modify: `pixel-asset-forge/CLAUDE.md`
- Modify: `pixel-asset-forge/ISSUES.md`（「`unit` の SPEC の「胴は `base` のまま」が実際の `breathe` と数セル違う」の行を消す）

- [ ] **Step 1: 書く前に、実物を確かめる**

```bash
cd pixel-asset-forge
for d in down right up; do diff <(grep -v '^#' assets/unit/roran/${d}_base.txt) <(grep -v '^#' assets/unit/roran/${d}_idle2.txt); done | head -60
diff <(grep -v '^#' assets/unit/ines/up_atk_release.txt) <(grep -v '^#' assets/unit/ines/up_atk_hit.txt) && echo "ines up release == hit"
for f in assets/unit/roran/*.txt; do printf "%s %s\n" "$(grep -v '^#' $f | tr -cd R | wc -c)" "$f"; done | grep -v "^1 "
.venv/bin/python tools/unit_check.py assets/unit/gau --items stlmn
```

確かめること: ロランの待機の2コマ目で胴を埋めたセル（ISSUES の記述は `down` (11,17)、`right` (12,18)・(12,19)、`up` (21,18)・(21,19)）、袖を描き足していないこと。イネスの `up_atk_release` と `up_atk_hit` が同じこと。柄頭 `R` が無いのは `left_atk_hit` と `up_atk_hit` だけで、それぞれ盾・体に隠れていること（`up` は剣ごと見えない）。ガウの `unit_check` が ok になること。食い違ったら、書く内容を実物に合わせる。

- [ ] **Step 2: SPEC を直す**

- 「アニメの規約」の待機の2コマ目: 「頭・胴・脚・盾は `base` のまま、剣を持つ拳を剣ごと2px上げる。拳が上がって空いたところは袖と腕を描き足してつなげる」を、実物どおりに「頭・脚・盾は `base` のまま、剣を持つ拳を剣ごと2px上げる。拳がどいて見えるようになった胴のセルは、上下の行と同じ服の色・輪郭で埋める（袖は描き足さず、拳は胴に直接接する。ロランの `down` (11,17)、`right` (12,18)・(12,19)、`up` (21,18)・(21,19)。2026-09-29 依頼者が承認した絵）」に直す
- 弓の持ち方の `up` の箇条の最後に: 「放った後（`up_atk_release`）は引き絞る（`up_atk_hit`）と同じ絵（矢も鏃も見えず、右腕は1px 下げたまま）」
- 立ち絵の規約の柄頭（「柄頭は赤い宝石（`roof_base` の1画素）」）の後に: 「ただし `left_atk_hit` は柄頭が盾に隠れ、`up_atk_hit` は剣ごと体に隠れるので、どちらも柄頭を描かない」（Step 1 で確かめた隠れ方と違えば、実物に合わせて書く）
- 「自己チェック」①の持ち物の文字に「ガウ `stlmn`」を足す（Step 1 の `unit_check` が ok なら）

- [ ] **Step 3: forge の README と CLAUDE.md を直す**

`grep -n "roran\|ロラン\|24コマ\|手本" README.md` で出る行のうち、次の3か所を今の状態に直す（2026-10-05 時点の行番号）:

- 344行目 `（`unit` は `assets/unit/roran/` が手本）` → `（`unit` は `reference/` を持たない。手本は `assets/unit/roran/`（剣と盾）・`assets/unit/ines/`（弓）・`assets/unit/gau/`（短剣）、土台は `types/unit/base/` の素体）`
- 364行目 `1体24コマ（ロラン）＋素体4方向` → `3体（ロラン・イネス・ガウ）、1体24コマ（イネスは攻撃6コマで28コマ）＋素体 `male_*`・`female_*` 4方向ずつ`（コマ数は `ls assets/unit/<unit>/*.txt | wc -l` で数えてから書く）
- 407行目 `（`unit` は `assets/unit/roran/` と `types/unit/base/`）` → `（`unit` は手本の3体と `types/unit/base/`。描く順番は `types/unit/SPEC.md` の「描く手順」）`

399行目「ロランと同じ規約・同じシート構成で。」は依頼文の例なので残す。213〜237行目のツアー（`sheets/roran.txt` を例にした手順）も、例として正しいので残す。

`CLAUDE.md` の「`unit` は `reference/` を持たない。手本は `assets/unit/roran/`（剣と盾）と `assets/unit/ines/`（弓）」に「、`assets/unit/gau/`（短剣）」を足す。

- [ ] **Step 4: ISSUES の行を消してコミット**

```bash
git add pixel-asset-forge/types/unit/SPEC.md pixel-asset-forge/README.md pixel-asset-forge/CLAUDE.md pixel-asset-forge/ISSUES.md
git commit -m "docs: unit の SPEC を実物に合わせ、forge の README と CLAUDE.md の手本の記述を3体にする"
```

---

### Task 6: `anim-page.py` のエラー処理と足元の線

**Files:**
- Modify: `tools/anim-page.py`
- Modify: `tools/anim-page.html`

**考え方:** 足元の行は forge の規約で 32px のコマの y=30 だけが決まっている（48px のコマの足元は未確定。`garum` の再検討待ち）。そこで足元の線の位置を勝手に決めず、32px のときだけ y=30 に引き、それ以外のコマではチェックボックスを隠す。

- [ ] **Step 1: 今の壊れ方を確かめる**

```bash
cd /home/ubuntu/workspace/character-tactics
printf '{' > /tmp/bad.json; python3 tools/anim-page.py /tmp/bad.json /tmp/o.html; echo "exit $?"
python3 tools/anim-page.py /tmp/none.json /tmp/o.html; echo "exit $?"
printf '{"sprites":{"map":{"sheet":"roran-map.png","idle":{"frames":2,"fps":4},"walk":{"frames":4,"fps":8},"attack":{"frames":3,"fps":6}}}}' > /tmp/noname.json; python3 tools/anim-page.py /tmp/noname.json /tmp/o.html; echo "exit $?"
```

Expected（直す前）: 3つともトレースバック

- [ ] **Step 2: 直す**

`main` の読み込みと取り出しを次にする:

```python
    try:
        unit = json.loads(unit_path.read_text(encoding="utf-8"))
    except OSError as e:
        print(f"{unit_path}: 読めない: {e}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as e:
        print(f"{unit_path}: JSON として読めない: {e}", file=sys.stderr)
        return 1
    try:
        name = unit["name"]
        m = unit["sprites"]["map"]
        frame, sheet_name = m["frame"], m["sheet"]
        states = [{"key": k, "label": label, "frames": m[k]["frames"], "fps": m[k]["fps"]} for k, label in STATES]
    except (KeyError, TypeError) as e:
        print(f"{unit_path}: name・sprites.map の frame・sheet・各状態の frames と fps のどれかが無い（{e}）", file=sys.stderr)
        return 1
```

以降の `m["sheet"]`・`m["frame"]`・`unit["name"]` を `sheet_name`・`frame`・`name` に置き換える。`config` に `"footY": FOOT_Y if frame == 32 else None` を足し、モジュールの先頭に定数を置く:

```python
# 足元の行。forge の unit の規約で決まっているのは 32px のコマの y=30 だけ（ほかの大きさは未確定）
FOOT_Y = 30
```

`anim-page.html`:
- チェックボックスの文言 `足元の線（y=30）` の `30` を `<span id="foot-y">30</span>` にする
- 設定を読んだ後（`const F = CONFIG.frame` の近く）に:

```js
const FOOT_Y = CONFIG.footY;
if (FOOT_Y === null) document.getElementById("foot").closest("label").hidden = true;
else document.getElementById("foot-y").textContent = String(FOOT_Y);
```

- 描画の `ctx.fillRect(0, 31 * scale - 1, F * scale, 2);` を `ctx.fillRect(0, (FOOT_Y + 1) * scale - 1, F * scale, 2);` にする（今の 31 は y=30 の行の下端。式を変えても 32px では同じ位置）

`const F` の定義の名前が違えば、実際の名前に合わせる（`grep -n "CONFIG.frame" tools/anim-page.html`）。

- [ ] **Step 3: 確かめる**

```bash
cd /home/ubuntu/workspace/character-tactics
for f in /tmp/bad.json /tmp/none.json /tmp/noname.json; do python3 tools/anim-page.py $f /tmp/o.html; echo "exit $?"; done
python3 tools/anim-page.py assets/units/gau.json /tmp/anim-gau.html && echo ok
```

Expected: 3つとも1行のメッセージで `exit 1`、ガウのページが書ける。`/tmp/anim-gau.html` を Chromium で開き、コンソールにエラーが無いこと、「足元の線（y=30）」をオンにすると赤い線が足元の行（直す前と同じ位置）に出ることを確かめる。直す前のページ（`git stash` で一時的に戻して作る）と、線の位置の画素を比べる。

- [ ] **Step 4: コミット**

```bash
git add tools/anim-page.py tools/anim-page.html
git commit -m "fix: anim-page.py の読み込みエラーをメッセージで返し、足元の線を 32px のコマだけに出す"
```

---

### Task 7: PR のテンプレート

**Files:**
- Create: `.github/pull_request_template.md`
- Modify: `CLAUDE.md`（「プルリクエスト」）

- [ ] **Step 1: テンプレートを書く**

項目は PR #28 で使った5つ（依頼者の決定 12）。`gh pr view 28 --json body -q .body` で PR #28 の説明を読み、各項目に何を書いたかを短い説明にする。

```markdown
## 概要

<!-- 何のための変更か。関連する Issue（Closes #n）・設計と計画の文書 -->

## 変更点

<!-- 何を変えたか。ゲーム（src/・assets/）と forge（pixel-asset-forge/）に分けて書く -->

## 結果

<!-- 変更で分かったこと・依頼者の判断。絵を変えたときは見せたページの場所 -->

## リスク

<!-- 壊れるおそれのあるもの、後回しにしたもの（どこに記録したか） -->

## 確かめたこと

<!-- 実際に流したコマンドと結果（npm test・npm run build・forge の unittest など）、目視したもの -->
```

- [ ] **Step 2: CLAUDE.md を直す**

「プルリクエスト」の1つ目の箇条を次にする:

```markdown
- PR の説明は `.github/pull_request_template.md` の5項目（概要・変更点・結果・リスク・確かめたこと）で書く（2026-10-05 依頼者と決めた。PR #28 で使った項目）
```

「PR は依頼者の指示があったときだけ作る」は残す。

- [ ] **Step 3: コミット**

```bash
git add .github/pull_request_template.md CLAUDE.md
git commit -m "docs: PR のテンプレートを作る（概要・変更点・結果・リスク・確かめたこと）"
```

---

### Task 8: `.superpowers/sdd/` の台帳をログとしてコミットする（#29）

**Files:**
- Create: `docs/superpowers/ledgers/<フォルダ名>.md`（17本。各フォルダの `progress.md` の写し）
- Create: `docs/superpowers/ledgers/2026-10-04-unit-workflow-gau-setting.md`（ガウの設定シート `setting.md` の写し。CP0 で依頼者が承認したもの）
- Create: `docs/superpowers/ledgers/README.md`
- Modify: `CLAUDE.md`（「ドキュメントの扱い」に1行）
- Modify: `pixel-asset-forge/ISSUES.md`（「組み立てた後の描き足しが forge の道具になっていない」「ガウの部品は頭にかぶせて見える部分だけ」の行に、2026-10-05 の決定を足す）

**残さないもの（依頼者の決定 13）:** 候補の絵、作業の指示書（`task-*-brief.md`・`task-*-report.md`・`final-*-report.md`）、作業スクリプト（`.py`）、レビューの差分

- [ ] **Step 1: 写す前に、載せてはいけないものが無いか確かめる**

リポジトリは public。

```bash
cd /home/ubuntu/workspace/character-tactics
grep -n -i "/home/\|token\|secret\|password\|api[_-]key\|@gmail" .superpowers/sdd/*/progress.md .superpowers/sdd/2026-10-04-unit-workflow-gau/setting.md
```

Expected: 何も出ない。出たら、その行を写しで伏せる（何を伏せたかを README に書く）。Artifact の URL は HANDOVER.md に既にあるものと同じ種類（非公開のページ）なので残す。

- [ ] **Step 2: 写す**

```bash
mkdir -p docs/superpowers/ledgers
for d in .superpowers/sdd/*/; do n=$(basename $d); cp $d/progress.md docs/superpowers/ledgers/$n.md; done
cp .superpowers/sdd/2026-10-04-unit-workflow-gau/setting.md docs/superpowers/ledgers/2026-10-04-unit-workflow-gau-setting.md
ls docs/superpowers/ledgers | wc -l
```

Expected: 18。中身は書き換えない（作成時点のログ）。

- [ ] **Step 3: `docs/superpowers/ledgers/README.md` を書く**

```markdown
# 進捗台帳（作成時点のログ）

Claude が計画を実行したときの進捗台帳の写し。元は git 管理外の作業フォルダ
`.superpowers/sdd/<計画>/progress.md` にあり、作業していた端末にしか残っていなかった（#29）。
2026-10-05 に写した。中身は写したときのまま直さない。最新の状態は README.md と CLAUDE.md を見る。

- 1本が1つの計画の台帳。ファイル名は作業フォルダの名前（日付＋計画の名前）
- 依頼者の判断（`Ruling:` 行、確認ポイントごとの返答と種類 A・B・C）、計画からの変更、レビューの指摘と先送りが書いてある
- `2026-10-04-unit-workflow-gau.md` の末尾に、ガウの試行の「振り返り用メモ」がある。`2026-10-04-unit-workflow-gau-setting.md` は CP0 で依頼者が承認した設定シート

## 写さなかったもの

候補の絵、作業の指示書（`task-*-brief.md` など）、作業スクリプト（`.py`）、レビューの差分は写していない。
作業スクリプトはいまも作業フォルダにだけある。ユニットの組み立て後の描き足しに使ったもの
（`2026-10-04-unit-workflow-gau/` の `finish.py`・`bodies.py`・`make_compose.py`・`anim.py`・`cand_sheets.py` など）は、
次の一体で同じものが要ったら forge の道具に移す（`pixel-asset-forge/ISSUES.md`）。
```

- [ ] **Step 4: CLAUDE.md と ISSUES.md を直す**

CLAUDE.md「ドキュメントの扱い」の1つ目の箇条の後に:

```markdown
- `docs/superpowers/ledgers/` は進捗台帳（`.superpowers/sdd/<計画>/progress.md`）の写し。これもログ。計画を終えたら、その計画の台帳をここに写してコミットする
```

ISSUES.md「組み立てた後の描き足しが forge の道具になっていない」の詳細の末尾に:「台帳は `docs/superpowers/ledgers/` に写したが、スクリプトは作業フォルダにだけある（2026-10-05。移すのは次の一体で要ったとき、依頼者の判断）」。「ガウの部品は頭にかぶせて見える部分だけで、完全な単品が無い」の末尾に:「今は描き足さない（2026-10-05 依頼者の判断）」。

- [ ] **Step 5: コミット**

```bash
git add docs/superpowers/ledgers CLAUDE.md pixel-asset-forge/ISSUES.md
git commit -m "docs: git 管理外だった進捗台帳を docs/superpowers/ledgers/ にログとして写す"
```

PR を作るときは説明に `Closes #29` を書く。

---

### Task 9: 実装済みだった2件（足元アンカー・`atk_hit` の確認）を確かめて ISSUES から消す

**Files:**
- Modify: `pixel-asset-forge/ISSUES.md`（「`unit` とゲーム側」の表の2行）

- [ ] **Step 1: 足元アンカーを確かめる**

`src/render/draw.ts` のユニットの描画が `bodyCenter`（足元 `unit.pos` から絵の中心を求める）を通っていること、`src/render/sprites.test.ts` の `bodyCenter` のテストが通ることを確かめる。

```bash
grep -n "bodyCenter" src/render/draw.ts src/main.ts
npx vitest run src/render/sprites.test.ts 2>&1 | grep -E "Tests"
```

- [ ] **Step 2: `atk_hit` をゲームで捉える**

README の CDP の手順で、`npm run dev` のゲームを `?debug` 付きで開き、戦闘中に `P` で止め、`.` でコマ送りして、ロラン・イネス・ガウそれぞれの攻撃のコマ（足元の下の表示が `attack 2`。イネスは `attack 3`〜`attack 5` も）を撮る。3体が出るステージは `assets/stages/*.json` と編成から選ぶ。撮れたら、ユニットの周りを切り出して拡大した画像を1枚にまとめる（作業フォルダに置き、コミットしない）。

- [ ] **Step 3: 依頼者に見せる**

画像を依頼者に見せ（Read で表示）、`atk_hit` がゲームで見えていることを確かめてもらう。**返答を待つ。** 刃が見えない・崩れているなどの指摘が出たら、ISSUES の行は消さずに、指摘を行に書き足す。

- [ ] **Step 4: ISSUES の2行を消してコミット**

```bash
git add pixel-asset-forge/ISSUES.md
git commit -m "docs: 実装済みだった足元アンカーと atk_hit の確認を ISSUES から消す"
```

---

### Task 10: HANDOVER を今の状態にし、全体を確かめる

**Files:**
- Modify: `HANDOVER.md`

- [ ] **Step 1: HANDOVER を書き直す**

先頭の Current State と What Remains を、この作業の後の状態にする:
- Branch `chore/unit-workflow-followups`（main `4781cce` = PR #28 のマージから分岐）、この計画の Task 1〜10
- PR #28 はマージ済み（4781cce）。「PR #28 のレビューとマージ」「PR のテンプレートを作る」は What Remains から外す
- 残るもの: 次の一体（確認ポイントを減らす案は未合意。results の「次の一体で減らせそうな確認ポイント」と、2026-10-04 の振り返りで Claude が出した2案）、issue #23 の1番目（保留）と「目を大きく」の確認、色の命名の整理（`feat/roran-face` 待ち）、forge の ISSUES の大きな決定の行
- 「この作業の途中で決めたこと」に 2026-10-05 の決定（12〜18）を書く

古い節（「これより下は issue #23 のときの記録」以下）は残す。

- [ ] **Step 2: 全体を確かめる**

```bash
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python -m unittest discover -s tests 2>&1 | tail -3
.venv/bin/python tools/validate.py | tail -2
cd ..
npm test 2>&1 | grep -E "Tests|Test Files"
npm run build 2>&1 | tail -3
git status --short assets/images
git diff main --stat
```

Expected: unittest `OK`、validate が通る、`npm test` 776 pass、build ok、`assets/images` に変更なし。

- [ ] **Step 3: コミット**

```bash
git add HANDOVER.md
git commit -m "docs: HANDOVER を PR #28 のマージ後と課題の片付けの状態にする"
```

- [ ] **Step 4: ブランチ全体のレビュー**

レビューのエージェントを1つ起動し、`git diff main...HEAD` を見てもらう（依頼者の許可済み）。指摘は自分で確かめてから直し、直さないものは ISSUES.md に足す。

- [ ] **Step 5: 依頼者に報告する**

push と PR は依頼者の指示を待つ。
