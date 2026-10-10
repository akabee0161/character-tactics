# SDD ledger — plan: docs/superpowers/plans/2026-10-09-unit-tools-maintenance.md
Pre-flight: Task 1 の close_hands(frame, hand, keep) / layers.finish を Task 3・4 が使う。名前は計画内で一致。
Task 1: 発見（2026-10-10 依頼者の指摘）: ロランの left は全6コマで、手前の拳(x11-12,y20-21)が盾の右の輪郭(x11)を覆って描かれ、盾より手前に見える。表(left: 剣→奥の腕・拳→芯→手前の腕・拳→盾)は盾が一番手前で正しいが、合成が今の絵と一致するかしか見ておらず、奥の層が手前の層の上に出ていることを検査できていない。さらに新しい close_hands は盾の metal_hi(x10,y20-21) を黒に塗る（盾が武器の色でないため keep に入らない）。Step 8 の報告「変わる画素は全部が服の色」は誤り（数えた台本の比べ方の誤り）。直し方は依頼者と相談中。
Task 1: 依頼者の承認（2026-10-10）で直した: (1) 拳の手前の物（盾）の上には囲いを描かない — weapon_check に --front を足し（Analysis(front=)・load(front=)）、hand_outline の --keep の説明に盾を加えた。(2) cut_layers.torn を足し、roran_layers のページと端末に「奥の層が手前の部品を破っている所」を出す。
Task 1: Ruling: 破れの検査は「部品の箱の中で、部品の画素に上下か左右から挟まれ、その間が奥の1つの層だけでできている所」にした — 「奥の層が手前の層に輪郭を挟まず接する」案はロラン・試作2体で帽子と額・髪と顔・柄と拳など数百か所を拾い、「挟まれた所」だけの案も柄と拳などを拾った。今の案はロラン24コマで left の盾の2画素（6コマ）だけを拾い、誤検出0 — 外れたら、混ざった層に破られた部品を見落とす。
Task 1: 注記: weapon_check の CLI の --front のテスト（test_front_option_keeps_the_shield）は実装の後に書いた（Analysis 側の test_front_colours_are_not_outlined_over は RED を見てから実装）。全体 381/381 通過。
Task 1: 依頼者の指摘（2026-10-10）: ロランの up は盾が一番奥。roran_layers.ORDERS[up] を [盾, 剣, 芯, 剣を持つ腕・拳, 盾を持つ腕・拳] に直した。torn に「奥の層の色が部品の面に直に接する」条件を足し（up 6コマの (8,20)(8,21) を拾う。right の base・idle2・歩きで鍔の右端が体に輪郭なしで接する所も拾う＝同じ種類の欠け）、weapon_check に --front-dirs（--front と必ず一緒、知らない向きは終了 2）を足した。全体 383/383。
Task 1: 発見（私の規則の誤り）: close_hands は「12画素以下の肌の塊」を拳とみなすため、うなじ（ロラン up の1画素）、横顔（ロラン left/right の4x5）、後ろ姿の首（spear-thug・dagger-thug の up の6x2）も囲い、髪や服を黒く塗る。全ユニットで塗る画素のうち頭の肌の周りがロラン 252/324、spear-thug 60/81、dagger-thug 60/83。プレビューは --hand に skin_rose_deep を入れていたため顔が首とつながって大きな塊になり、これが見えていなかった。拳の見分け方を依頼者に相談中。

## 中止（2026-10-10）
- 依頼者と話して方針を変えた: 拳は部品として完全な形（四方とも黒枠）で描き、重ねるだけにする。重ねた後に黒く塗る処理・--front・--front-dirs・weapon_check の重ねた後の手の輪郭の検査は外す。ロラン・イネス・ガウ・敵のすべてを部品から組む
- この計画は Task 1 の途中で中止し、docs/superpowers/plans/2026-10-10-unit-parts-roran.md に置き換えた。台帳は .superpowers/sdd/2026-10-10-unit-parts-roran/progress.md。まだコミットしていない変更の扱いは新しい計画の Task 1
