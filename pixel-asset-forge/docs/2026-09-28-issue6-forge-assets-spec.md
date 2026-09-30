# issue #6 の forge 側の対応: 待機アニメ・村/岩/木の 32px セット（仕様）

作成: 2026-09-28。**このファイルは作成時点のログ**。運用の最新は `README.md` と `CLAUDE.md` と
`types/*/SPEC.md` を見ること。

## 背景

GitHub #6（https://github.com/akabee0161/pixel-asset-forge/issues/6）の対応方針（2026-09-28 決定）の
4番目「forge 側: 待機アニメ・物の描き直し・森」。先に character-tactics 側で次の2つが済んでいる。

- アセットの大きさの規約（character-tactics の README「アセットの大きさの規約」、PR #19）。
  1マス 32px、地面は 16px タイルを1マスに 2×2、物は 16px の部品を組んだセット（1マスぶんは 2×2 = 32px）で、
  地面（草）を背景に含めて描く
- タイルを元の大きさで描く（PR #20）。16×16 か 32×32 の正方形の画像を、拡大せずに1マスへ敷く
  （16px なら 2×2、32px なら1枚）

今は次のとおりである。

- ロランの待機（`idle` = `[base, breathe]`）の2コマ目は頭を1px下げるだけで、剣も腕も動かない。
  依頼者の指摘は「顔が動いているだけ。顔よりも手足を動かしたい。ロランの場合は剣を動かすのがよい」
- 村・岩・木は 16px の1枚もので、ゲームでは1マスに 2×2 で敷かれて4つ並んで見え、人より小さく見える
- 森は `assets/tile/forest.txt`（16px、上下左右に継ぎ目なくつながる樹冠）がある

## 目的と終わった状態

- 待機の2コマ目で、頭ではなく剣を持つ腕が動く
- 村・岩・木が、1マス（32px）に1組の絵としてゲームに出る
- **終わった状態:** character-tactics（ブランチ `feat/foot-box-and-tile-size`）に新しい PNG が入って
  `npm test` が通り、stage1 のマップと待機アニメを依頼者が画像で確認している

## 依頼者の決定（2026-09-28）

| 項目 | 決定 |
|---|---|
| forge のブランチ | `docs/issue6-asset-policy` にそのまま積む（ISSUES.md の2コミットと同じ PR にする） |
| `face` の 64px 化・役割アイコン | 今回はやらない |
| character-tactics へのコピー | 今回に含める。ブランチ `feat/foot-box-and-tile-size`（#20）に積む。#20 はこの作業の後にマージする |
| 森 | 今の `forest.txt` をそのまま使う。森の端が四角く切れる弱点は、後で別に解消する |
| 32px のセットの持ち方 | 16px の部品グリッド4枚＋組み方の定義＋組む道具（下記） |
| 今の 16px の `village` `rock` `tree` | 残す。新しい部品を別の名前で足す |
| 待機の2コマ目の頭 | 動かさない。剣を持つ腕だけを動かす |
| 腕の動かし方 | 剣を持つ拳を剣ごと上げる（下げる案・刃を傾ける案は採らない。傾けると刃が折れて見えた） |
| 上げる幅 | まず 1px で描き、ゲームで動かして物足りなければ 2px にする |
| 村の中身 | 小さな家2〜3軒の集まり（大きな家1軒ではない） |

## 1. 部品を組む道具

### ファイル

| 置き場所 | 中身 |
|---|---|
| `assets/tile/<物>_{nw,ne,sw,se}.txt` | 部品。16×16 の普通の `tile`（城の `castle_*` と同じ形） |
| `sets/<物>.txt` | 組み方の定義。`layouts/`・`sheets/` と同じ空白区切りの形 |
| `tools/sets.py` | 定義を読んで PNG に組む道具 |
| `build/sets/<物>.png` / `<物>_x8.png` | 組んだ PNG（等倍と8倍） |

定義は `assets/` の外に置く。`validate.py` と `render.py` が `assets/` 以下の `*.txt` をグリッドとして
読んで落ちるためで、`layouts/` と `sheets/` がトップレベルにあるのと同じ理由である。

```
# sets/village.txt
village_nw  village_ne
village_sw  village_se
```

### `tools/sets.py`

- `tools/sets.py sets/village.txt` で `build/sets/village.png` と `village_x8.png` を出す。引数なしなら
  `sets/*.txt` の全部
- 組む処理は `tilemap.py` の `read_layout` と `compose`（scale=1）を使う。新しく書くのは入口と検査だけ
- 検査（どれかに違反したら、どの定義のどの部品が何でだめかを出して、0以外で終わる）
  - 定義にある部品が `assets/tile/` に全部あり、`validate.py` と同じ検査を通る
  - `.`（空き）が無い
  - 部品がすべて 16×16
- 列×行は 2×2 に固定しない（城の 2×2マス = 64px のような物にも使えるように）。今回作るのは 2×2 だけ
- テストは `tests/test_sets.py`。部品は `tests/fixtures/` に固定し、`assets/` の現役の絵を読まない

## 2. 村・岩・木の 32px セット

### 共通

- 1マスに物を1組。背景は草で、物の外周の草は `plain` と同じ色（`grass_base` / `grass_hi` / `grass_shadow`）・
  同じ密度の房にする。四辺は `plain` と隣り合っても継ぎ目が見えないこと（ゲームでは周りに `plain` が敷かれる）
- 光は左上から。物のシルエットにだけ `outline` を回し、地面に落ちる影は物の右下に `grass_shadow` で置く
  （今の `rock` / `tree` と同じ流儀）
- 色は今のパレットの中で描く。足す必要が出たら、描く前に `probe_colors.py` で測ってから依頼者に相談する
- 大きさはユニット（背丈24〜26px）と並べて見劣りしないこと

| 物 | 部品 | 中身 | 大きさの目安 |
|---|---|---|---|
| 村 | `village_{nw,ne,sw,se}` | 小さな家2〜3軒の集まり。屋根は今の家と同じ `roof_*`、壁は `stone_*`、戸は `wood_*` | 1軒あたり今の家くらい（幅12〜14px） |
| 岩 | `rock_{nw,ne,sw,se}` | 大きな岩1つ（小石を1〜2個添えてよい） | 幅24〜28px・高さ20px前後 |
| 木 | `tree_{nw,ne,sw,se}` | 大きな広葉樹1本。樹冠は `leaf_*`、幹は `wood_*` | 高さ28〜30px |

部品は光と影の向きがあるので、ミラーの派生にしない。

### 確かめ方

- `layouts/objects.txt` を新しく作る。`plain` の中に3つのセットを置き、`forest` も並べる
- `tilemap.py --repeat` で、同じセットを隣り合わせたときの継ぎ目を見る
- ユニットとの見比べは、組んだ PNG とロランのコマを並べた画像で行う（layout にはユニットを置けない）
- `contact_sheet.py` を更新する
- 目視の締めは `tilemap.py --layout layouts/objects.txt` のマップで、別の物に見えないかを見る

## 3. 待機アニメ（`*_breathe` の描き直し）

### 絵

- 4方向の `*_breathe.txt` を描き直す。頭・胴・脚・盾は `*_base` と1pxも変えない
- 剣を持つ拳を剣ごと（刃・鍔・柄頭）1px 上げる。拳が上がって空いたところは、袖と腕を描き足してつなげる
- `up` と `left` は剣が体の奥にある。同じく1px上げ、体に重なる部分は描かない（立ち絵の規約）
- 刃の長さは変えない（11px）

### 規約（`types/unit/SPEC.md` の「アニメの規約」の `breathe` を置き換える）

- `breathe`: 頭と体は `base` のまま、剣を持つ拳を剣ごと1px上げる
- 待機の2コマ目に限り、切っ先が頭頂（y=5）より1px上に出てよい
- 今の「頭を1px下げて首を1行つぶす」と、うなじの輪郭（`hair_dark` と `cloth_shadow` の境）の決まりは削る
  （使うコマが無くなるため）
- ファイル名は `breathe` のままにする（`sheets/roran.txt` を変えずに済む）

ゲームで見て 2px にすると依頼者が判断したら、4方向の `breathe` を描き直し、規約の「1px」を「2px」に、
切っ先の例外を「2px上」に直す。

### 確かめ方

- `sheet.py` のプレビューで、2コマの間で足元（y=30）と体の中心がずれていないこと
- 4方向の `breathe` を `contact_sheet.py --columns 4` で並べる
- ゲームで待機させて、1px で動きが見えるかを依頼者が判断する

## 4. ゲームへの反映・文書

### character-tactics（ブランチ `feat/foot-box-and-tile-size`）

| forge の出力 | コピー先（`assets/images/`） |
|---|---|
| `build/sheets/roran.png` | `roran-map.png` |
| `build/sets/village.png` | `tile-village.png`（16px → 32px） |
| `build/sets/rock.png` | `tile-rock.png`（同上） |
| `build/sets/tree.png` | `tile-tree.png`（同上） |

- `npm test` を通す（タイルの実寸とシートの寸法の検査がある）
- README の CDP の手順で stage1 を撮り、マップ上の村・岩・木と、待機の2コマを依頼者に見せる
- README「アセットの大きさの規約」の「まだ規約に追いついていないもの」から、物が 16px の1枚だという記述を消す。
  HANDOVER の ④ の状態を更新する
- 森の PNG はコピーしない。ゲームで使うのは⑤からなので、⑤でコピーする

### forge の文書

- `types/tile/SPEC.md`: 32px のセット（部品の名前・`sets/`・外周の草の決まり）の節を足し、セット構成に3つを加える
- `types/unit/SPEC.md`: 3 の規約
- `README.md`・`CLAUDE.md`: `tools/sets.py` のコマンド、ファイルの地図、アセットの点数、目視の手順
- `ISSUES.md`: 作業中に見つけて直さなかったことを足す
- `CLAUDE.md` の「ゲーム側で倍率を直す予定」という記述は触らない（直すなら依頼者に先に確認する）

## 今回やらないこと

- `face` の 64px 化、役割アイコンの型と絵
- 森の描き直しと森の縁タイル
- 城（`castle_*`）をセットの形に移すこと、今の 16px の `village` `rock` `tree` を消すこと
- 複数マスを占める物をゲームのマップに置く仕組み（character-tactics 側）
- PR の作成
