# アイコンの剣の特徴をロランの剣へ反映する 設計（issue #23 の4番目）

作成: 2026-10-02

## 目的

issue #23（ロランのアセット修正）の4番目「剣や弓の単独のアセットを元に、ユニットの持ち物へ反映する」。
3番目で描いたアイコンの剣（forge の `assets/item/sword.txt`）の形と色の特徴を、ロランのユニット（`assets/unit/roran/` の24コマ）の剣へ揃える。

装備を差し替える仕組みではない。画素の写しでもない（アイコンは 16px いっぱいの別のアセットで、ユニットの刃は2px幅）。

## 測った違い（2026-10-02）

| 部分 | アイコン `item/sword.txt` | ユニット `unit/roran/*_base` |
|---|---|---|
| 刃 | 3列。`stone_hi`/`stone_base`/`stone_shadow` | 2px幅。`stone_hi`（左）と `stone_base`（右）。`stone_shadow` は使わない |
| 切っ先 | 3画素の角（`item/SPEC.md` の尖った先端の規約） | 平ら。輪郭2pxで蓋をする（`down_base` は y=5） |
| 鍔 | 木 `wood_*`。軸の左右に4画素ずつ、計9画素 | 金 `metal_*`。正面・背面・振りかぶりは4px（`m n n s`）、横向きは端から見て2〜3px |
| 握り | `wood_shadow` の1列 | 拳（肌）に隠れて見えない |
| 柄頭 | 赤い宝石 `roof_*`、2x2 | 金 `metal_base` の1画素（拳の下） |
| 盾 | なし | 金 `metal_*`。鍔・柄頭と同じ文字 `m n s` で描かれている |

剣が見えるのは24コマのうち23コマ（`up_atk_hit` は剣が体に隠れる）。

## 決めたこと（依頼者の判断）

- 揃える特徴:
  - **A. 鍔を金から木（`wood_*`）にする。** 盾は金のまま残るので、剣と盾の色は分かれる
  - **B. 柄頭を金の1画素から赤い宝石（`roof_*`）にする**
  - **C. 切っ先を尖らせる** は、試しに描いた結果を見て採否を決める
  - D（刃に `stone_shadow` の陰影を足す）は不要
- 弓は4番目に含めない。5番目でイネスを forge のユニットとして描くときに、イネスの持ち物として `item/bow.txt` を元に描けるかを試す
  （ロランは弓を持たず、`ines-map.png` は forge で描いたものではない）
- ISSUES.md の「剣が `stone_*`、盾が `metal_*` で命名と見た目が合っていない」の整理は4番目に含めない。
  `feat/roran-face`（顔グラ）のマージ後に、独立した作業として行う。5番目はこれを待たない。
  色の名前はグリッドの `# map:` 行にしか出てこないので、ユニットが増えても付け替えは機械的な置き換えで済む
- 色は master パレットの既存色だけを使い、足さない。描く前に `probe_colors.py` で測った結果、
  `wood_hi`/`wood_base`/`wood_shadow`・`roof_base`/`roof_hi` は、拳の肌（`skin_rose_*`）・`outline`・服（`cloak_dark_*`）・刃（`stone_*`）との23組すべてで区別できる
- 進め方は「鍔と柄頭に専用の文字を割り当て、`# map:` 行で色を切り替える」（下記）。23コマを1コマずつ手で塗り替える案は、塗り漏れや盾の塗り間違いを機械で見つけられないので採らない

## 進め方

段階ごとに Read で絵を見せて止まる。案は何案か並べ、拡大と等倍を添える。
「一旦進めましょう」は次の段階へ進んでよいという意味で、合格ではない。

1. **文字の付け替え:** 23コマの鍔と柄頭の画素を、そのコマで未使用の専用の文字に付け替える。割り当てる色は今の金（鍔は `metal_hi`/`metal_base`/`metal_shadow`、柄頭は `metal_base`）のままにする。
   24コマの PNG が付け替えの前と画素単位で同じであることを、使い捨てのスクリプト（scratchpad に置く。`tools/` には足さない）で確かめる
2. **色の置き方の案:** `down_base`・`right_base` で2〜3案を並べる（例: 鍔は今の `m n n s` の濃淡をそのまま木に移すか、ほかの置き方にするか。柄頭は `roof_hi` か `roof_base` か）。
   選ばれた案を `# map:` 行で全コマに当てはめる。画素を直す必要がある案が選ばれたら、そこは手で直す
3. **C の試し:** `down_base`・`right_base` で尖った切っ先を2〜3案描いて見せる。縦2px幅の刃ではアイコンの「3画素の角」をそのまま作れず、
   先端を1画素にすると `item/SPEC.md` の「尖った先端を、輪郭に囲まれた1画素で表さない」に当たることも含めて見てもらう。
   採ると決まったら刃のある全コマへ当てはめるが、作業が計画より増えるので、当てはめる前に止めて報告する
4. **確認:**
   - `tools/validate.py`、`tools/check_colors.py`（既存の `types/face/reference/knight.txt` の1件は範囲外の既知の失敗）
   - 4方向の `base` を `contact_sheet.py --columns 4` で並べる
   - `tools/sheet.py sheets/roran.txt` のプレビューで足元と中心を見る
   - `tools/sheet_gif.py sheets/roran.txt` で動きを見る
   - `tools/export.py` で `roran-map.png` を書き出し、ゲームで動かす（README「ドット絵の作りかた」、CDP の手順）

## 記録

- `pixel-asset-forge/ISSUES.md` の命名の行の時期を「顔グラのマージ後、独立した作業として行う（5番目は待たない）」に書き換える。
  `pixel-asset-forge/types/item/SPEC.md` の「ユニット側の整理は issue #23 の4番目以降」も同じ内容に直す（この2つは spec と一緒にコミットする）
- `pixel-asset-forge/types/unit/SPEC.md` に、決まった持ち物の色（鍔・柄頭）を書き足す。
  「持ち物に専用の文字を割り当てる」を規約にするかは、絵が決まった後で依頼者に確認する
- `HANDOVER.md` を更新する。「What Remains」に命名の整理を1行足す

## 触らないもの

`pixel-asset-forge/palette/master.json`、`feat/roran-face`、ゲームのコード、`pixel-asset-forge/tools/`（触らないので unittest は不要）、
`sprites.json`（`sheets/roran.png` → `roran-map.png` はすでに対応表にある）、役割アイコン（`role-tate.png`・`role-yumi.png`）。
push と PR は依頼者の指示があるまでしない。

## 範囲外

弓（5番目）、ほかのユニット（5番目）、色の命名の整理（顔グラのマージ後）、
持ち物の種類ごとのユニットのテンプレート（ISSUES.md の「手の描き方が持ち物で変わる」）。
