ユニットの え を PNG で ここに おく。

map は スプライトシート。れつ = コマ、ぎょう = 12（3じょうたい × 4ほうこう）。
  ぎょう 0-3   idle   : down, up, left, right
  ぎょう 4-7   walk   : down, up, left, right
  ぎょう 8-11  attack : down, up, left, right
ぎょうばんごう = じょうたいindex × 4 + ほうこうindex。コマは せいほうけい。
れつすうは シートぜんたいで さいだいコマすうに そろえ、あまりは とうめいの まま。

face は 128×128、role は 64×64 の せいほうけい。

units/*.json ・ enemies/*.json の sprites.role / sprites.face に ファイルめいを かくと つかわれる。
sprites.map には sheet と アニメーションていぎ を もつ オブジェクトを かく（ファイルめいの もじれつ ではない）。
かりの え は tools/gen-placeholder-sprites.mjs で つくっている。
ほんばんの え が そろったら、その ファイルごと けしてよい。
