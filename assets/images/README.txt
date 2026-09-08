ユニットの絵を PNG でここに置く。

map はスプライトシート。列 = コマ、行 = 12(3状態 × 4方向)。
  行 0-3   idle   : down, up, left, right
  行 4-7   walk   : down, up, left, right
  行 8-11  attack : down, up, left, right
行番号 = 状態index × 4 + 方向index。コマは正方形。
列数はシート全体で最大コマ数にそろえ、余りは透明のまま。

face は 128×128、role は 64×64 の正方形。

units/*.json・enemies/*.json の sprites.role / sprites.face にファイル名を書くと使われる。
sprites.map には sheet とアニメーション定義を持つオブジェクトを書く(ファイル名の文字列ではない)。
仮の絵は tools/gen-placeholder-sprites.mjs で作っている。
本番の絵がそろったら、そのファイルごと消してよい。
