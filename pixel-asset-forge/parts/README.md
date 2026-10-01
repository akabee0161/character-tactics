# 顔の部品（parts/）

顔を「土台（素の頭）＋髪・目・眉・口・服などの部品＋目や口の位置（バランス）」に分けて持ち、組み合わせて1枚の顔にする試作。
組み合わせるのは `tools/compose_face.py`。部品は普通のグリッドファイル（`.txt`）で、置き方は各フォルダの `parts.json` に書く。

今あるのは `roran_32/`（32px のロラン。character-tactics の issue #23）だけ。

## 1. 組み合わせをページで見る

forge のフォルダで次を実行し、書き出された HTML をブラウザで開く（ファイルをダブルクリックでよい。サーバーは要らない）。

```sh
.venv/bin/python tools/compose_face.py parts/roran_32 --html build/compose/roran_32.html --ref ../assets/images/roran-face.png
```

- `--ref` は横に並べる見本の画像（省略できる）。上の例はゲームリポジトリの元絵
- ページは部品のデータを中に埋め込んだ1つのファイル。部品を直したら、このコマンドをもう一度実行して開き直す
- `build/` の下は生成物なのでコミットしない

ページでできること:

- **部品を選ぶ**: 右の各要素（髪・目…）の案を押すと、左の顔が変わる。案のボタンの小さな顔は「今の組み合わせのうち、その要素だけを差し替えた顔」
- **見え方**: 左上が8倍、その下がゲームの2つの枠（64px の枠に2倍、32px の枠に等倍）
- **記号**: 選んだ組み合わせは `H1-E19-B2-M4-P4-C5` のような記号で表示される（「記号をコピー」）。人に伝えるときや、`--pick` に渡すときに使う（記号の `-` を `,` に替える）
- **候補だけ表示**: `parts.json` の `picker.shortlist` に書いた案だけを出す。外すと全部の案が出る
- **一覧**: ページの下に、3つの要素（`picker.matrix`）の全部の組み合わせを表で並べる。ほかの要素は上で選んだもの。表の顔を押すと、その組み合わせが上に入る
- **注意の表示**: 前髪が目や眉を隠す組み合わせは、黄色の注意（一覧では点線の枠）が出る

## 2. ほかの見方

```sh
.venv/bin/python tools/compose_face.py parts/roran_32 --pick H1,E19,B2,M4,P4,C5 --scale 8   # 1枚の PNG（build/compose/）
.venv/bin/python tools/compose_face.py parts/roran_32 --sheet build/compose/                 # 要素ごとに案を横に並べた PNG
.venv/bin/python tools/validate.py parts/roran_32                                           # 部品のグリッドの検査
```

`--pick` で書かなかった要素は `parts.json` の `default` になる。

## 3. フォルダの中身（roran_32/）

| ファイル | 中身 |
|---|---|
| `parts.json` | 部品の一覧・重ねる順番・バランス・ページの設定 |
| `base.txt` | 土台（素の頭: 輪郭・顎・耳・首と肌の陰影）。いつも一番下に描く |
| `hair/hN.txt` | 髪（32×32 の層）。`hN_shade.txt` は前髪の下の影（髪の案に連動する） |
| `eyes/eN_near.txt`・`eN_far.txt` | 目。近い目（画面の右）と遠い目（左）を別の小さなグリッドにする |
| `brows/bN_near.txt`・`bN_far.txt` | 眉。目と同じく近い・遠いで分ける |
| `mouth/mN.txt` | 口 |
| `nose/n1.txt` | 鼻（1案で固定） |
| `clothes/cN.txt` | 服（32×32 の層） |

グリッドの書き方は forge の README「2.1 グリッドファイルを読む」と同じ。`.` は「描かない」（下の層が見える）。

## 4. parts.json の書き方

```json
{
  "size": [32, 32],
  "base": "base.txt",
  "clip_keys": ["skin_rose_hi", "skin_rose_base", "skin_rose_shadow"],
  "order": ["hair_shade", "nose", "mouth", "eyes", "brows", "hair", "clothes"],
  "default": {"hair": "H1", "eyes": "E19", "balance": "P4"},
  "balance": {
    "P1": {"label": "目と眉を下げた位置", "anchors": {"eye_near": [13, 16], "mouth": [11, 23]}}
  },
  "elements": {
    "eyes": {"label": "目", "clip": true, "variants": {
      "E6": {"label": "元絵ロラン式", "parts": {"eye_near": "eyes/e6_near.txt", "eye_far": "eyes/e6_far.txt"}},
      "E11": {"label": "くぼみに影", "parts": {"eye_near": {"file": "eyes/e11_near.txt", "dx": 0, "dy": -1}}}
    }},
    "hair": {"label": "髪", "clip": false, "variants": {
      "H1": {"label": "元絵の髪", "parts": {"origin": "hair/h1.txt"}}
    }},
    "hair_shade": {"label": "前髪の下の影", "clip": true, "follow": "hair", "variants": {
      "H1": {"label": "元絵の髪", "parts": {"origin": "hair/h1_shade.txt"}}
    }}
  },
  "picker": {
    "title": "ロランの顔の組み合わせ",
    "pick_order": ["hair", "eyes", "brows", "mouth", "balance", "clothes"],
    "matrix": {"groups": "balance", "rows": "eyes", "cols": "brows"},
    "shortlist": {"eyes": ["E6", "E12", "E19"]}
  }
}
```

| キー | 意味 |
|---|---|
| `order` | 土台の上に重ねる順番（下から上）。後の要素が前の要素を隠す |
| `clip` | `true` の要素は、土台の `clip_keys` の色（肌）の上にだけ描く。目や口がバランスで動いても輪郭や髪にはみ出さない |
| `parts` | 案を作る部品の一覧。キーは置き場所の名前（錨）。部品のグリッドの左上を、選んだバランスの錨の位置に置く。`origin` は常に (0,0) で、32×32 の層に使う |
| `{"file", "dx", "dy"}` | 錨からずらして置く。上まぶたの上にくぼみの影の行がある目を、ほかの目と同じ高さにそろえるときなどに使う |
| `balance` | バランスの案。`anchors` に錨の名前と位置（x, y）を書く。すべての案が、部品で使う錨をすべて持つこと |
| `follow` | ほかの要素の選択に連動する層（前髪の下の影は目や眉より下に描きたいが、髪と一緒に変わってほしい）。連動元のすべての案と同じ名前の案が要る |
| `default` | `--pick` で書かなかった要素の案と、ページを開いたときの組み合わせ |
| `picker.title` | ページの題名 |
| `picker.pick_order` | 記号の並び順とページの要素の並び。無ければ、案が2つ以上ある要素の順にバランスを足す |
| `picker.matrix` | ページ下の一覧に使う3つの要素（`groups` ごとに表を分け、行 `rows`・列 `cols`）。無ければ一覧を出さない |
| `picker.shortlist` | 要素ごとの候補。ページの「候補だけ表示」で、これだけを出す |

書き間違い（無い案の名前、錨の無いバランス、`follow` の案の不足など）は、`compose_face.py` を実行したときにエラーで止まる。

## 5. 部品を足す

例: 目の案 `E41` を足す。

1. `eyes/e41_near.txt` と `eyes/e41_far.txt` を書く。近い目は左の列が目頭、右の列が目じり。1行目が上まぶた。遠い目は左が目じり。**両目の瞳を同じ側に寄せる**（逆にすると寄り目になる）
2. `parts.json` の `elements.eyes.variants` に `"E41": {"label": "…", "parts": {"eye_near": "eyes/e41_near.txt", "eye_far": "eyes/e41_far.txt"}}` を足す
3. `tools/validate.py parts/roran_32` を通し、`--html` でページを作り直して見る

髪や服のような大きな部品は、32×32 の層として描き、`"parts": {"origin": "hair/h16.txt"}` にする。描かない升は `.` にする。
髪を足すときは、`hair_shade`（前髪の下の影）にも同じ名前の案を足す（影が要らなければ、`.` だけの層でよい）。

## 6. 1枚の顔にしてから直す

部品の組み合わせが決まったら、1枚のグリッドにして手で直す（ロランは `assets/face/roran_32.txt`）。
1枚にした後は、そのグリッドが正。部品を直しても1枚のグリッドには反映されない。

**組み合わせを1枚のグリッドに書き出す道具は、まだ forge に無い。** ロランの1枚は、作業中の下書きスクリプトで書き出した（`--pick` の PNG と1画素ずつ同じことを確かめた）。

## 7. 今の限界

- 部品は顔の向き（左を向いた 3/4）ごとに要る。ほかの向きの顔には使えない
- 部品どうしは合わせて描いていないので、組み合わせによっては破綻する（前髪と眉が重なるなど）
- `roran_32` の部品の多くは、手順（領域を塗る → 縁を輪郭にする → 光の向きで陰影）で下書きしてから書き出した。案によって仕上がりに差がある
