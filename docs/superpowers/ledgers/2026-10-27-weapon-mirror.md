# SDD ledger — plan: docs/superpowers/plans/2026-10-27-weapon-mirror.md

Spec: docs/superpowers/specs/2026-10-27-weapon-mirror-design.md
Executor: native (executing-plans). Branch chore/weapon-mirror（596006e イネスの left の重なり順は計画の前の別件）。
Task 2・3 は依頼者の絵の承認で止まる（依頼者の決まり「絵を直したら見せて承認を得てからコミット」が skill の連続実行より優先）。

Pre-flight: Task 1 produces weapon_mirror（unit_rules の NEW_CHECKS）→ Task 2・3 consume it as the check（期待: roran 2件・gau 2件）。Task 4 consumes 2・3 の絵。衝突なし。
Task 1: complete (commits 6ecaee2..4c82cc5, tests: sh -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests' → ok   /tmp/tmpug9505yy/tmp4fz2fkby_attack.gif  1 frame(s) at 6fps (170ms))
Task 1: note — suite 621 tests OK（task-done の結果欄は最後の行を拾っただけ）
Task 2: 案 = right_atk_hit の剣・拳を反転の位置、刃の i/j を入れ替え（10-11 より前の絵と同じく明るい面を左）、鍔の G は上の端のまま。部品2枚は作業ツリーに書いた（未コミット）。ページ https://claude.ai/artifact/Jp5fTT5iSfVmZDTWWys4Ym 。依頼者の承認待ち
Task 2: Ruling: 計画は checks/roran.json の weapon_check.hidden から left_atk_hit を外すとしていたが、外すと weapon_check の確認1が「武器が見えない（刃と柄がつながった塊が無い）」で落ちる。hidden の定義は「手や武器が体に隠れるコマ」（weapon_check.py の --hidden の help）で、承認された絵は拳と柄が体と盾に隠れるので定義どおり。hidden に残す。剣が無いことは weapon_mirror が拾う — 誤りなら: 確認1が left_atk_hit の手の消失を見ない（手は承認された重なり順で隠れる）
Task 2: complete (commits 4c82cc5..6f30209, tests: sh -c 'cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests 2>&1 | grep -E '^Ran|^OK'' → OK)
Task 3: 案 A（left を right の反転に）・案 B（right を left の反転に）を scratchpad の t3/ に作った（task3_cands.py）。どちらも weapon_mirror・fist_check ok。ページ https://claude.ai/artifact/EoKAETjPzHBMVYzLakZc8B 。依頼者の選択待ち
Task 3: Ruling: 依頼者の指摘で、ロランの left・right の攻撃の盾の拳4枚を立ちと同じ上端 y=18 にそろえる直しを Task 3 に足した（up・down はスコープ外と依頼者）。拳は weapon_mirror の対象外なので道具の結果は変わらない — 誤りなら: 1コミットに別件が混ざる
Task 3: 依頼者が案 A（right を正として left を動かす）を選んだ。盾の拳の案 https://claude.ai/artifact/4eSk3QNmpD5JMb78DXwonh も承認
Task 3: complete (commits 6f30209..287d78a, tests: sh -c 'cd pixel-asset-forge && for u in roran ines gau; do .venv/bin/python tools/unit_rules.py checks/$u.json >/dev/null || exit 1; done && echo unit_rules-3-ok' → unit_rules-3-ok)
Task 4: complete (commits 287d78a..4d70676, tests: sh -c 'npm test 2>&1 | grep -E 'Tests '' →       Tests  776 passed (776))
Final review: Opus（general-purpose, model opus）。Critical 0・Important 0・Minor 2。マージ可
Final: fixed Minor 1 grips の書き忘れで黙って ok — test_a_weapon_no_fist_grips_is_noted RED→GREEN, suite 623/623（依頼者の決まりで Minor も PR 前に直す）
Final: fixed Minor 2 SPEC の hand: true の行が hidden の文に続いて読める — 文の並べ替え（文書のみ）
Final: Ruling: 部品が left・right の両方に無いときは比べない（レビュアーが判断を保留）— 設計書は片方にしか無いときだけ落とすと決めており、層の欠けは compose/order_check の範囲 — 誤りなら: 両向きで層を書き忘れた武器を見逃す
