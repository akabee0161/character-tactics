# 侵攻型への転換とデータ駆動エンジン化

作成日: 2026-08-28

## 1. 目的

このゲームを防衛型から侵攻型に転換する。同時に、ステージ・ユニット・敵を JSON アセットで
定義できるようにし、コードを書き換えずにコンテンツを追加できる土台を作る。

現状は、砦の HP がゼロになるまで耐えるタワーディフェンスである。敵はウェーブごとに
時間差で湧き、全員が砦をゴールとする共有フローフィールドを降りてくるだけで、AI と呼べる
判断を持たない。ステージ・キャラ・敵の定義は `src/content/` に TS リテラルとして分離
されているが、ID が `CharId` / `EnemyKind` / `SkillId` という閉じたユニオン型に焼き込まれて
いるため、コンテンツを1つ足すだけでも型定義と `index.ts` の書き換えが要る。

転換後はこうなる。プレイヤーは仲間を率いてマップを進み、敵の本拠地に到達すれば勝利する。
守るべきキャラクターが倒れれば敗北する。敵はその場に配置されていて、それぞれ固有の
行動パターンに従う。

## 2. 確定した前提

事前の検討で以下を決めた。設計はすべてこれを前提にしている。

- **リアルタイムを維持する。** ターン制には移行しない。`step(state, commands, dt)` の
  構造をそのまま使う
- **護衛対象はステージ定義で指定する。** 操作できる仲間でも、戦わない同行 NPC でもよい。
  ユニット定義を1本に統合してどちらも同じ配列で扱う
- **定義は JSON アセット + 起動時バリデーション。** ID をレジストリ照合に開き、
  ユニオン型を全廃する
- **ウェーブ制は廃止する。** 1ステージ = 1マップ。敵は最初から配置済み
- **レベル進行・絆・スキル・会話は持ち越す。** ただし経験値はステージ中に獲得し、
  ステージ中にレベルアップする
- **移行は段階改造で行う。** `src/engine/` を新設したうえで `src/core/` を順に改造し、
  各ステップの終わりでテストが緑に戻る状態を保つ
- **倒れた味方はステージ単位でリセットする。** 永久ロストは採用しない
- **旧セーブは破棄する。** マイグレーションは書かない

## 3. 設計の中心原則

**データはパラメータ、振る舞いはコード。**

JSON には数値と ID 参照だけを置く。条件分岐やスクリプトを JSON に書けるようにはしない。
AI パターンとスキル効果はコード側のレジストリに ID で登録し、JSON はその ID を指すだけに
する。

この線引きが「JSON を1本置くだけでステージが増える」と「型と検証が効く」を両立させる。
JSON にロジックを持ち込んだ瞬間、検証できない自前の言語処理系を抱えることになる。

## 4. 全体構成

```
assets/
  units/*.json        味方・同行 NPC の定義
  enemies/*.json      敵の定義
  stages/*.json       マップ・配置・勝敗条件
  skills.json         スキルのパラメータ（効果本体はコード）
  bonds.json          絆の組と補正値
  titles.json         称号の条件
  lines/*.json        セリフ

src/engine/
  schema.ts           定義の型と検証
  loader.ts           アセットの読み込み
  registry.ts         ロード済み定義の索引 + 振る舞いの登録

src/core/             ルール。assets を直接知らず registry 経由で読む
src/render/           描画
src/ui/               画面遷移・入力
src/save/             localStorage
```

依存の向きは `ui → core → engine` の一方向を保つ。`engine` は `core` を知らない。
`core/**` と `engine/**` が `window` / `document` / `localStorage` を参照しない、という
既存の制約は維持する。

`src/content/` は役目を終えて消える。中身は `assets/` の JSON へ移す。

## 5. エンジン層

### 5.1 スキーマと検証

`engine/schema.ts` に定義の型と検証関数を置く。検証は `save/save.ts` が既に採用している
手書きバリデータの流儀に揃える。zod のような外部依存は入れない。定義の種類は6つ程度で、
専用ライブラリを引き込むほどの規模ではないうえ、既存コードとの一貫性が崩れる。

ただし定義の項目数は多いので、`requireNumber(obj, path, field)` のような小さなヘルパを
用意し、エラーには**どのファイルのどのフィールドが、なぜ不正か**を必ず含める。

```ts
type ValidationError = { file: string; path: string; reason: string };
type Validated<T> = { ok: true; value: T } | { ok: false; errors: ValidationError[] };
```

### 5.2 起動時バリデーション

読み込みに失敗したら握り潰さず、エラー一覧を画面に出して停止する。アセットを追加した
その場で事故に気づけることが目的なので、部分的に読めたぶんで続行してはいけない。

### 5.3 ローダ

`import.meta.glob('/assets/**/*.json', { eager: true })` でビルド時にバンドルへ同梱する。
非同期ロードとローディング画面を作らずに済み、Cloudflare Workers Static Assets 上でも
パス解決の問題が起きない。

将来アセットを外部ファイルとして実行時に読みたくなったら、差し替えるのは `loader.ts`
1本で済む。`registry` から先はロード方式を知らない。

### 5.4 レジストリ

```ts
type Registry = {
  units:   Map<string, UnitDef>;
  enemies: Map<string, EnemyDef>;
  stages:  StageDef[];        // 順序を持つのでこれだけ配列
  skills:  Map<string, SkillDef>;
  titles:  TitleDef[];
  bonds:   BondDef[];
  lines:   Map<string, string>;
};
```

振る舞いはコード側で登録する。

```ts
const AI_BEHAVIORS: Record<string, AiBehavior>;
const SKILL_EFFECTS: Record<string, SkillEffect>;
```

検証時に「JSON が指す `ai.kind` / `skillId` が実在するか」をこのテーブルと照合する。
存在しない ID を書いたら起動時に落ちる。

### 5.5 ユニオン型の全廃

`CharId` / `EnemyKind` / `SkillId` / `TitleId` を `string` に開く。「実在するか」は
コンパイル時の型ではなくレジストリ照合で保証する。

影響が大きいのは次の2箇所で、どちらも設計変更を伴う。

- `save/save.ts` — 固定4キー前提の検証をやめる（5.6 と 9 節）
- `core/progress.ts` — `TITLE_OWNER` が `CharId` 固定で、`accumulateCounters` が
  `stats.roran` / `stats.ines` のように特定キャラを直接参照している。称号をデータ化して
  この結びつきを切る（6.8）

### 5.6 定義の形

```ts
type UnitDef = {
  id: string; name: string; role: string;
  combat: boolean;              // false なら攻撃しない。狙われはする
  maxHp: number; power: number; guard: number;
  attack: 'melee' | 'bow'; range: number;
  attackInterval: number; speed: number;
  skillId: string | null;
  color: string;
};

type EnemyDef = UnitDef & {
  xpReward: number;             // 撃破時に与える経験値
  bowDamageCap: number | null;
  fleeAtHpRatio: number | null; // これを下回ると撤退。null なら撤退しない
};

type StageDef = {
  id: string;                   // ファイル名と一致させる。セーブのキーになる
  name: string;
  cell: number;
  mapRows: string[];            // '.' 歩ける / '#' 歩けない
  placementZone: { pos: Vec2 }[];   // 開始前に味方を置ける地点
  roster: string[];             // このステージに出る味方の UnitDef id
  enemies: { defId: string; pos: Vec2; ai: AiDef }[];
  victory: VictoryCond;
  defeat: DefeatCond[];
  intro?: { speaker: string; lineId: string }[];
};
```

`StageDef.id` を数値インデックスではなく文字列にするのは、ステージが JSON になると
並べ替え・途中挿入・削除が起きるためである。クリア進捗を配列インデックスで持つと、
`stages/` に1本足した瞬間に記録が別のステージを指す。

## 6. ルール層

### 6.1 ユニット型の統合

現在 `AllyUnit` と `EnemyUnit` は別型で、`sim.ts` の交戦・移動・攻撃の各ループが2本ずつ
書かれている。ここに戦わない同行 NPC を第3の型として足すと3本になる。1本に統合する。

```ts
type Unit = {
  uid: string;
  defId: string;
  side: 'player' | 'enemy';
  controller: 'player' | 'ai';
  combat: boolean;

  pos: Vec2;
  hp: number; maxHp: number;
  power: number; guard: number;
  attack: AttackKind; range: number;
  attackInterval: number; speed: number;
  bowDamageCap: number | null;
  skillId: string | null;

  level: number; xp: number;

  goalPos: Vec2 | null;
  goalField: FlowField | null;
  engagedWith: string | null;     // 相手の uid
  attackCooldown: number;
  retired: boolean;

  ai: AiState | null;             // controller === 'ai' のときだけ

  skillUsed: boolean;
  funbaruUntil: number;
  neraiuchiArmed: boolean;
  pinchShown: boolean;
  seenDefIds: string[];
  lastHitBy: string | null;
  lastHitNeraiuchi: boolean;
};
```

`BattleState.allies` と `BattleState.enemies` は `BattleState.units: Unit[]` に統合する。
交戦の相互参照はすべて `uid` ベースになる。敵対判定は `a.side !== b.side` の一行になる。

既存の「敵1体につき交戦できる味方は1人」というルールは、「1ユニットにつき交戦相手は
1体」に一般化してそのまま維持する。

同行 NPC は `side: 'player'`, `combat: false` で表す。`controller` は `'player'` にすれば
移動を指示でき、`'ai'` にすれば自律行動する。専用の型も専用のループも要らない。

### 6.2 勝敗条件

```ts
type VictoryCond = { type: 'reach'; pos: Vec2; radius: number; by: 'any' | string };

type DefeatCond =
  | { type: 'unitLost'; defIds: string[] }
  | { type: 'allPlayerUnitsLost' };
```

`step` の最後に `updateObjectives(state)` で評価する。`fortHp` / `FORT_MAX_HP` /
`SimEvent.fortDamaged` は削除する。

`phase` は `'placement' | 'battle' | 'victory' | 'defeat'` の4値になる。
`'wave'` / `'waveCleared'` / `'stageCleared'` は消える。

### 6.3 敵 AI

```ts
type AiDef =
  | { kind: 'sentry';     sightRange: number }
  | { kind: 'aggressive' }
  | { kind: 'guard';      post: Vec2; leash: number; sightRange: number };

type AiState = {
  def: AiDef;
  mode: 'idle' | 'chase' | 'return';
  targetUid: string | null;
  home: Vec2;               // 初期位置。sentry の帰還先
};
```

振る舞いは「どこへ行きたいか / 誰を狙うか」だけを返す純関数として登録する。実際の移動と
攻撃は既存のループが行う。AI が状態を直接書き換えないので、単体でテストできる。

```ts
type AiContext  = { self: Unit; hostiles: Unit[]; grid: Grid };
type AiDecision = { mode: AiState['mode']; targetUid: string | null; goal: Vec2 | null };
type AiBehavior = (ctx: AiContext) => AiDecision;
```

**sentry** — `home` で待機する。索敵範囲に敵対ユニットが入ったら `chase` に移り、最寄りを
追う。見失ったら `return` で `home` へ戻り、着いたら `idle` に戻る。

**aggressive** — 索敵範囲を無視して常に最寄りの敵対ユニットを追う。`home` も `return` も
使わない。

**guard** — `post` を守る。索敵範囲に敵対ユニットが入れば追うが、自分と `post` の距離が
`leash` を超えた時点で追跡を打ち切り、`post` へ戻る。`post` は `home` と別に持てるので、
初期位置と守る地点をずらした配置ができる。

索敵範囲を `UnitDef` ではなく `AiDef` に置いているのは、これが敵の能力ではなく配置ごとの
設定だからである。同じ敵種を、狭い索敵で通路に置く場合と広い索敵で開けた場所に置く場合が
あり、ステージ側で決められる必要がある。`aggressive` は索敵範囲を持たない。

索敵は**距離と視線の両方**で判定する。既存の `field.ts:hasLineOfSight` を使い、壁越しには
気づかないようにする。距離だけで判定すると、壁の向こうの見えない敵が反応してプレイヤーに
理不尽に映る。

パターンを増やすときは `AI_BEHAVIORS` に1本足し、`AiDef` に variant を1つ足す。`sim.ts`
は触らない。

### 6.4 経路探索とフィールドのキャッシュ

現在は砦をゴールとするフローフィールド1枚を全敵で共有している。侵攻型では敵ごとに
目的地が変わるため、素朴に実装すると毎ティック敵の数だけ BFS を回すことになる。

ゴールを2種類に分けて対処する。

- **静的なゴール**（敵本拠地、`guard` の `post`）— ステージ開始時に1枚ずつ計算して保持する。
  再計算は起きない
- **動的なゴール**（追跡対象のユニット位置）— プレイヤーユニットごとに1枚持ち、その
  ユニットが別のセルに移ったときだけ再計算する

```ts
type FieldCache = {
  byUnit:  Map<string, { cell: number; field: FlowField }>;
  static:  Map<number, FlowField>;   // キーはセル index
};
```

BFS の実行回数は「プレイヤーユニットのセル移動時のみ」＋「ステージ開始時に拠点数ぶん」に
収まる。保持する枚数もプレイヤーユニット数と静的ゴール数の和で固定され、増え続けない。

プレイヤーの移動指示（`goalPos`）は従来どおり指示のたびに計算してよい。ユーザー操作の
頻度でしか起きない。

### 6.5 ステージ中の成長

撃破時に `lastHitBy` のユニットへ即座に経験値を渡す。経験値の量は `EnemyDef.xpReward` で
データとして持つ。

`progress.ts:applyXp` はそのまま使える。レベルが上がったら `statsForLevel` で `maxHp` と
`power` を再計算し、**増えた最大 HP のぶんだけ現在 HP も増やす**。全回復にはしない。
`SimEvent` に `{ type: 'levelUp'; uid; level }` を追加し、吹き出しと描画に繋ぐ。

`statsForLevel` は現在 `CHARACTERS` を直接見ているので、レジストリの `UnitDef` を見るように
変える。

`ui/flow.ts:applyStageClear` の役割が変わる。今は「ステージクリア時に統計から経験値を
計算して配る」だが、経験値はステージ中に確定済みになるので、「確定した進行をセーブへ
書き戻す」だけになる。

### 6.6 倒れたユニットの扱い

HP がゼロになったユニットは `retired` になり、**そのステージ中は復帰しない**。永久ロストは
採用しない。ステージをやり直せば全員が全快した状態で始まり、クリアすれば次のステージ開始時に
全快する。

これは既存の「ウェーブ開始時に復活・回復する」（`state.ts:startWave`）を置き換えるもので、
`startWave` 自体は削除される。回復処理はステージ開始時の初期化に移る。

護衛対象が `retired` になった時点で `defeat` 条件が成立するので、護衛対象については
「ステージ中に復帰しない」という規則が実際に効く場面はない。規則が意味を持つのは、
護衛対象ではない仲間が倒れて、残りで攻略を続ける場合である。

### 6.7 スキル・絆・会話の再配線

**スキル** — 効果本体は `SKILL_EFFECTS` レジストリに移し、`skills.json` は数値
（`FUNBARU_DURATION` などの定数）だけを持つ。`skills.ts` の `switch (ally.skill)` は
レジストリ引きに変わる。4種の効果自体は変えない。

`canUseSkill` の `state.phase !== 'wave'` は `!== 'battle'` になる。1ステージ1回使用という
制約は、ウェーブ廃止に伴い「1ステージ1回」の意味に自然に変わる。

**絆** — `BONDS` の配列を `bonds.json` へ出す。`bondSupporters` のロジックは変えない。
参照する ID が `CharId` から `string` になるだけ。

**会話** — `lines.ts` を `assets/lines/*.json` へ出す。ステージ固有のセリフはステージ JSON
に同梱できるようにする。`dialogue.ts` のトリガ（初遭遇・ピンチ・スキル使用）はそのまま。
`levelUp` を新しいトリガとして追加する。

### 6.8 称号のデータ化

現在の `progress.ts` は、称号の所有者を `TITLE_OWNER` にハードコードし、条件カウンタを
`accumulateCounters` の中で `stats.roran.skillUses` のようにキャラ名で直接参照している。
これがユニオン型廃止の最大の障害になる。

カウンタのキーを規約で決め、称号定義をデータに出す。

```
counters のキー: "skill:<skillId>:uses"
                 "kill:neraiuchi"
                 "skill:kakenukeru:hits"
                 "bond:supports"
```

```ts
type TitleDef = {
  id: string; label: string;
  owner: string | null;      // 持ち主の UnitDef id。null は全員共通
  counter: string;           // 上のキー
  threshold: number;
};
```

`counters` は `Record<string, number>` になり、加算は `SimEvent` を見て行う。
`earnedTitles` は `titles.json` を回して閾値を比べるだけになり、特定キャラへの参照が消える。

## 7. UI と描画への影響

**配置フェーズは開始前の1回だけ**になる。ウェーブごとの再配置がなくなるので、画面遷移は
「はいち → たたかい → けっか」の一本道になる。`ui/screens.ts` の `waveCleared` 画面は削除する。

**目標の可視化を追加する。** 侵攻型では以下がプレイヤーに見えていないとゲームが成立しない。

- 敵本拠地の位置（勝利条件そのもの）
- 護衛対象の識別表示（倒れたら即敗北するユニットがどれか）
- **`sentry` と `guard` の索敵範囲**

索敵範囲の表示は装飾ではない。範囲が見えなければ `sentry` と `aggressive` の区別が
プレイヤーに伝わらず、「近づかずに迂回する」という判断そのものが成立しない。この3つは
本設計の必須要素として扱う。

**レベルアップの表示**を追加する。既存の吹き出しキュー（`ui/bubbles.ts`）に乗せる。

移動指示のドラッグ操作、選択表示、目的地マーカー、経路プレビューは現行のまま流用する。
`ui/input.ts` / `ui/hit.ts` / `render/viewport.ts` は座標系が変わらないので影響を受けない。

## 8. 削除されるもの

| 対象 | 場所 |
|---|---|
| `FORT_MAX_HP` / `fortHp` / `FORT_RADIUS` / `resolveFort` | `types.ts` / `sim.ts` |
| `SpawnEntry` / `WaveDef` / `waveIndex` / `pending` / `spawnDueEnemies` / `startWave` | `types.ts` / `sim.ts` / `state.ts` |
| `phase` の `'wave'` / `'waveCleared'` / `'stageCleared'` | `types.ts` |
| `SimEvent` の `fortDamaged` | `types.ts` |
| `StageDef.garumFlees` / `landings` | `types.ts` |
| `CharId` / `EnemyKind` / `SkillId` / `TitleId` / `CHAR_IDS` | `types.ts` / `progress.ts` |
| `AllyUnit` / `EnemyUnit` | `types.ts` |
| `src/content/` 一式 | — |

`SimEvent.garumRepelled` は残すが、特定の敵に紐づく名前をやめて
`{ type: 'unitFled'; uid; defId; byUid }` に一般化する。撤退という挙動自体は
`EnemyDef.fleeAtHpRatio` でデータとして表現できるので、侵攻型でも意味を持つ。
`StageDef.garumFlees` というステージ側のフラグは、敵の性質をステージが上書きする構造で
筋が悪いので廃止する。

## 9. セーブ

バージョンを 2 に上げ、旧セーブは読み捨てて新規開始扱いにする。マイグレーションは書かない。

```ts
type SaveData = {
  version: 2;
  clearedStageIds: string[];
  units:    Record<string, CharProgress>;
  counters: Record<string, number>;
  titles:   string[];
};
```

検証の考え方を変える。現在は「4キーがすべて揃っているか」を要求し、1つでも欠けると
セーブ全体を捨てている。これはユニットを1体追加するたびに全プレイヤーのセーブが無効に
なることを意味する。新しい検証は次のようにする。

- レジストリに存在しない ID のエントリは**無視する**（削除されたコンテンツ）
- レジストリにあってセーブにない ID は**既定値で補う**（レベル1、経験値0）
- 型が壊れているエントリだけを捨て、セーブ全体は捨てない

これにより、コンテンツを追加・削除してもプレイヤーの進行が失われない。

## 10. テスト方針

**ほぼそのまま残るもの** — `field.test.ts` / `combat.test.ts` / `rng.test.ts` /
`viewport.test.ts` / `hit.test.ts` / `effects.test.ts` / `input.test.ts`。座標系も
ダメージ計算も変わらない。

**書き換えるもの** — `sim.test.ts` / `sim-combat.test.ts` は、ウェーブとユニット型統合の
影響で大半が書き直しになる。`bonds.test.ts` / `skills.test.ts` は ID 型の変更ぶんだけ修正。
`save.test.ts` は新しい検証方針に合わせて書き換え。`progress.test.ts` は称号のデータ化に
合わせて書き換え。

**新規に書くもの**

- `engine/schema.test.ts` — 不正な定義がエラーの場所と理由つきで弾かれること
- `engine/registry.test.ts` — 存在しない `ai.kind` / `skillId` を指す定義が起動時に落ちること
- `core/ai.test.ts` — 3パターンそれぞれの状態遷移。特に `sentry` の見失い→帰還と、
  `guard` の `leash` 超過による追跡打ち切り
- `core/objectives.test.ts` — 到達勝利と、護衛対象ロストによる敗北
- `core/growth.test.ts` — 撃破による即時経験値付与とステージ中のレベルアップ、
  最大 HP 増加ぶんの現在 HP 反映
- `core/fields.test.ts` — キャッシュがセル移動時にだけ再計算されること

AI と勝敗条件は純関数として切り出すので、シミュレーション全体を回さずにテストできる。

## 11. 実装の順序

段階改造で進める。各ステップの終わりでテストが緑に戻ることを条件とする。

1. **エンジン層の新設** — `schema` / `loader` / `registry` を追加し、既存の `src/content/`
   の内容をそのまま JSON に写して読めることを確認する。この時点ではまだ誰も使わない
2. **ユニオン型の全廃** — `core` / `save` / `progress` の ID を string に開き、称号を
   データ化する。ゲームの挙動は変わらない
3. **ウェーブの削除** — 1ステージ1マップに変え、敵をステージ定義から直接配置する。
   この時点では敵はまだ全員が本拠地（旧・砦）へ直進する
4. **ユニット型の統合** — `AllyUnit` / `EnemyUnit` を `Unit` に統合し、`sim.ts` の
   重複ループを1本化する
5. **勝敗条件の差し替え** — `fortHp` を削除し、到達勝利と護衛対象ロスト敗北に置き換える
6. **敵 AI** — フィールドキャッシュを入れ、3パターンを実装する
7. **ステージ中の成長** — 即時経験値とレベルアップを入れる
8. **UI** — 配置フェーズの一本道化、目標・護衛対象・索敵範囲の描画、勝敗画面、
   レベルアップ吹き出し
9. **新ステージの作成** — 侵攻型のステージを JSON で作る

順序の根拠は、1・2 が既存の挙動を変えない準備作業であること、3 でウェーブという
時間軸の構造を先に落としてから 4 で型を統合すると、統合時に考慮すべき状態が減ることに
ある。AI（6）は勝敗条件（5）が入ってからでないと、追跡の是非を判断する意味が生まれない。

## 12. 将来の拡張（今回は作らない）

以下は設計上の受け口だけ用意し、実装しない。

- **増援** — ステージ定義に時間トリガ・到達トリガで敵が湧く仕組み。`StageDef` に
  フィールドを足せば足りる形にしておく
- **勝敗条件の追加** — 全滅勝利、制限時間、複数拠点の制圧。`VictoryCond` / `DefeatCond` が
  すでに判別可能ユニオンなので variant 追加で足りる
- **AI パターンの追加** — 逃走、回復役、遠距離特化。`AI_BEHAVIORS` への登録で足りる
- **外部アセットの実行時ロード** — `loader.ts` の差し替えのみ
- **地形効果** — 現在の `walkable: boolean[]` を地形 ID の配列に置き換える必要があり、
  `field.ts` の BFS にコストの概念を入れることになる。今回のスコープ外
