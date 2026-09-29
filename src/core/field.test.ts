import { describe, expect, it } from 'vitest';
import {
  DIAG_COST,
  ORTHO_COST,
  cellCenter,
  cellIndexAt,
  computeFlowField,
  distance,
  distanceToSegment,
  fitInCell,
  fitsAt,
  flowDirection,
  hasClearPath,
  hasLineOfSight,
  isFullSpeedLine,
  isWalkableAt,
  makeGrid,
  resolveMoveDest,
  slideStep,
  speedAt,
  stepCost,
} from './field';

// '.' = 歩ける / '#' = 歩けない
const MAP = [
  '.....',
  '.###.',
  '.....',
];

describe('makeGrid', () => {
  it('ASCII マップから列数・行数・歩行可否を作る', () => {
    const g = makeGrid(32, MAP);
    expect(g.cols).toBe(5);
    expect(g.rows).toBe(3);
    expect(g.cell).toBe(32);
    expect(g.walkable[0]).toBe(true);
    expect(g.walkable[1 * 5 + 1]).toBe(false);
  });

  it('legend を渡すと、その walkable で歩行可否を決める', () => {
    const g = makeGrid(32, ['.T', 'V.'], {
      '.': { tile: null, walkable: true },
      T: { tile: null, walkable: false },
      V: { tile: null, walkable: false },
    });
    expect(g.walkable).toEqual([true, false, false, true]);
  });

  it('legend が無ければ 全マスの speed は 1', () => {
    const g = makeGrid(32, MAP);
    expect(g.speed).toEqual(new Array(15).fill(1));
  });

  it('legend の speed を マスに入れる。省略した項目は 1', () => {
    const g = makeGrid(32, ['.F', 'T.'], {
      '.': { tile: null, walkable: true },
      F: { tile: null, walkable: true, speed: 0.5 },
      T: { tile: null, walkable: false },
    });
    expect(g.speed).toEqual([1, 0.5, 1, 1]);
  });
});

describe('cellIndexAt / cellCenter', () => {
  it('座標からセル番号を求める', () => {
    const g = makeGrid(32, MAP);
    expect(cellIndexAt(g, { x: 0, y: 0 })).toBe(0);
    expect(cellIndexAt(g, { x: 33, y: 33 })).toBe(1 * 5 + 1);
  });

  it('マップ外は -1 を返す', () => {
    const g = makeGrid(32, MAP);
    expect(cellIndexAt(g, { x: -1, y: 0 })).toBe(-1);
    expect(cellIndexAt(g, { x: 0, y: 999 })).toBe(-1);
  });

  it('セル番号から中心座標を求める', () => {
    const g = makeGrid(32, MAP);
    expect(cellCenter(g, 0)).toEqual({ x: 16, y: 16 });
    expect(cellCenter(g, 6)).toEqual({ x: 48, y: 48 });
  });
});

describe('isWalkableAt', () => {
  it('壁の上では false、床の上では true', () => {
    const g = makeGrid(32, MAP);
    expect(isWalkableAt(g, { x: 48, y: 48 })).toBe(false);
    expect(isWalkableAt(g, { x: 16, y: 16 })).toBe(true);
  });

  it('マップ外は false', () => {
    const g = makeGrid(32, MAP);
    expect(isWalkableAt(g, { x: -5, y: -5 })).toBe(false);
  });
});

describe('speedAt', () => {
  const g = makeGrid(32, ['.F', '..'], {
    '.': { tile: null, walkable: true },
    F: { tile: null, walkable: true, speed: 0.5 },
  });

  it('足元の点のマスの倍率を返す', () => {
    expect(speedAt(g, { x: 48, y: 16 })).toBe(0.5);
    expect(speedAt(g, { x: 16, y: 16 })).toBe(1);
  });

  it('境界ちょうどは cellIndexAt と同じく右のマス', () => {
    expect(speedAt(g, { x: 32, y: 16 })).toBe(0.5);
    expect(speedAt(g, { x: 31.99, y: 16 })).toBe(1);
  });

  it('マップの外は 1', () => {
    expect(speedAt(g, { x: -5, y: 16 })).toBe(1);
  });
});

describe('stepCost', () => {
  it('半分ずつ出るマスと入るマスの倍率で割る', () => {
    expect(stepCost(ORTHO_COST, 1, 1)).toBe(10);
    expect(stepCost(ORTHO_COST, 1, 0.5)).toBe(15);
    expect(stepCost(ORTHO_COST, 0.5, 1)).toBe(15);
    expect(stepCost(ORTHO_COST, 0.5, 0.5)).toBe(20);
    expect(stepCost(DIAG_COST, 1, 1)).toBe(14);
    expect(stepCost(DIAG_COST, 1, 0.5)).toBe(21);
    expect(stepCost(DIAG_COST, 0.5, 0.5)).toBe(28);
  });

  it('割り切れない倍率でも整数で、向きで値が変わらない', () => {
    const a = stepCost(ORTHO_COST, 1, 0.3);
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBe(stepCost(ORTHO_COST, 0.3, 1));
    expect(a).toBe(22); // 5 + 16.67 を丸める
  });
});

describe('computeFlowField', () => {
  const FOREST = {
    '.': { tile: null, walkable: true },
    F: { tile: null, walkable: true, speed: 0.5 },
  };

  it('森に入るマスと森の中のマスはコストが上がる', () => {
    const g = makeGrid(32, ['.FF'], FOREST);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(f.dist[1]).toBe(15);
    expect(f.dist[2]).toBe(35);
  });

  it('森を横切るより回る方が安ければ、回る向きを出す', () => {
    // 列 3〜6 の行 0〜2 が森。(16,16) から (304,16) は横切ると 140、行3 を回ると 114
    const g = makeGrid(32, [
      '...FFFF...',
      '...FFFF...',
      '...FFFF...',
      '..........',
    ], FOREST);
    const f = computeFlowField(g, { x: 304, y: 16 });
    expect(f.dist[0]).toBe(114);
    const dir = flowDirection(g, f, { x: 16, y: 16 });
    expect(dir).not.toBeNull();
    expect(dir!.y).toBeGreaterThan(0); // 下（行3）へ向かう
  });

  it('森の中のゴールにも距離が入る', () => {
    const g = makeGrid(32, ['..F'], FOREST);
    const f = computeFlowField(g, { x: 80, y: 16 });
    expect(f.dist[2]).toBe(0);
    expect(f.dist[1]).toBe(15);
    expect(f.dist[0]).toBe(25);
  });

  it('ゴールからのコストを 8 近傍で埋める', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 }); // セル 0
    expect(f.dist[0]).toBe(0);
    expect(f.dist[1]).toBe(ORTHO_COST);
    expect(f.dist[5]).toBe(ORTHO_COST);
  });

  it('壁は -1 のまま', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(f.dist[1 * 5 + 1]).toBe(-1);
  });

  it('開けたマップでは斜めが直交2回より安い', () => {
    const g = makeGrid(32, ['.....', '.....', '.....']);
    const f = computeFlowField(g, { x: 16, y: 16 }); // 左上
    expect(f.dist[1 * 5 + 1]).toBe(DIAG_COST);
    expect(f.dist[1 * 5 + 1]).toBeLessThan(ORTHO_COST * 2);
  });

  it('壁の角はすり抜けない（コーナーカット禁止）', () => {
    // セル(1,1) が壁。(0,0) から (2,2) へ斜めに 2 回では行けない
    // 迂回は直交移動のみ 4 回（右→右→下→下 など）で ORTHO_COST * 4 = 40 になる
    const g = makeGrid(32, ['...', '.#.', '...']);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(f.dist[2 * 3 + 2]).toBe(ORTHO_COST * 4);
  });

  it('壁の内側をゴールにしたら全部 -1', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 48, y: 48 });
    expect(Array.from(f.dist).every((d) => d === -1)).toBe(true);
  });
});

describe('flowDirection', () => {
  it('コストが下がる隣へ向かう', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    const dir = flowDirection(g, f, { x: 144, y: 16 })!; // 右上から左へ
    expect(dir.x).toBeLessThan(0);
  });

  it('開けたマップでは斜めを返す', () => {
    const g = makeGrid(32, ['.....', '.....', '.....']);
    const f = computeFlowField(g, { x: 16, y: 16 }); // 左上
    const dir = flowDirection(g, f, { x: 80, y: 80 })!; // セル(2,2)
    expect(dir.x).toBeLessThan(0);
    expect(dir.y).toBeLessThan(0);
  });

  it('ゴールのセルにいたら null', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(flowDirection(g, f, { x: 16, y: 16 })).toBeNull();
  });

  it('到達できないセルからは null', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(flowDirection(g, f, { x: 48, y: 48 })).toBeNull();
  });
});

describe('distance / distanceToSegment', () => {
  it('2点間の距離', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('線分の途中がいちばん近いとき', () => {
    expect(distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
  });

  it('線分の端の外側にあるとき', () => {
    expect(distanceToSegment({ x: -4, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(4);
  });

  it('線分が点に潰れているとき', () => {
    expect(distanceToSegment({ x: 0, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });
});

describe('hasLineOfSight', () => {
  it('開けたマップでは通る', () => {
    const g = makeGrid(32, ['.....', '.....', '.....']);
    expect(hasLineOfSight(g, { x: 16, y: 16 }, { x: 144, y: 80 })).toBe(true);
  });

  it('壁をまたぐと通らない', () => {
    const g = makeGrid(32, MAP); // 中段の (1,1)-(3,1) が壁
    expect(hasLineOfSight(g, { x: 48, y: 16 }, { x: 48, y: 80 })).toBe(false);
  });

  it('同じ点なら、その場所が歩けるかどうかを返す', () => {
    const g = makeGrid(32, MAP);
    expect(hasLineOfSight(g, { x: 16, y: 16 }, { x: 16, y: 16 })).toBe(true);
    expect(hasLineOfSight(g, { x: 48, y: 48 }, { x: 48, y: 48 })).toBe(false);
  });

  it('壁の角をかすめる対角線はコーナーカットとして拒否する', () => {
    // (0,1)→(1,0) の対角移動で、間にある直交セルの一方 (1,1) が壁。
    // 経路は壁セル (1,1) の内部を通らず格子点 (32,32) をかすめるだけなので、
    // 点サンプリング（8pxごと）だとこの一点をまたいで「通れる」と誤判定していた。
    const g = makeGrid(32, MAP);
    expect(hasLineOfSight(g, { x: 16, y: 48 }, { x: 50, y: 14 })).toBe(false);
  });
});

describe('isFullSpeedLine', () => {
  const g = makeGrid(32, ['.....', '..F..', '.....'], {
    '.': { tile: null, walkable: true },
    F: { tile: null, walkable: true, speed: 0.5 },
  });

  it('森を通らない線は true', () => {
    expect(isFullSpeedLine(g, { x: 16, y: 16 }, { x: 144, y: 16 })).toBe(true);
  });

  it('森を通る線は false', () => {
    expect(isFullSpeedLine(g, { x: 16, y: 48 }, { x: 144, y: 48 })).toBe(false);
  });

  it('端点が森のマスでも false', () => {
    expect(isFullSpeedLine(g, { x: 16, y: 48 }, { x: 80, y: 48 })).toBe(false);
  });

  it('森の角をかすめる斜めの線も false（hasLineOfSight と同じく両隣を見る）', () => {
    // (16,16)→(48,48) は格子点 (32,32) を通る。端点の (0,0)・(1,1) は草だが、
    // 斜めに移る瞬間に両隣 (1,0)・(0,1) も見るので、(1,0) の森で false になる
    const g2 = makeGrid(32, ['.F', '..'], {
      '.': { tile: null, walkable: true },
      F: { tile: null, walkable: true, speed: 0.5 },
    });
    expect(isFullSpeedLine(g2, { x: 16, y: 16 }, { x: 48, y: 48 })).toBe(false);
  });

  it('森が無いマップの hasLineOfSight は今までどおり', () => {
    expect(hasLineOfSight(g, { x: 16, y: 48 }, { x: 144, y: 48 })).toBe(true);
  });
});

describe('resolveMoveDest', () => {
  it('歩ける場所ならそのまま返す', () => {
    const g = makeGrid(32, MAP);
    expect(resolveMoveDest(g, { x: 16, y: 16 }, { x: 20, y: 70 })).toEqual({ x: 20, y: 70 });
  });

  it('歩けない場所なら、たどり着けるマスのうち最も近いマスの中心を返す。同じ近さならたどり着きやすい方', () => {
    // (80,48) は '#'。上 (80,16) と下 (80,80) はどちらも 32px。(16,16) から近いのは上
    const g = makeGrid(32, MAP);
    expect(resolveMoveDest(g, { x: 16, y: 16 }, { x: 80, y: 48 })).toEqual({ x: 80, y: 16 });
  });

  it('閉じた区画のマスは、より近くても選ばない', () => {
    const g = makeGrid(32, [
      '......',
      '.####.',
      '.#..#.',
      '.####.',
      '......',
    ]);
    // (80,60) は '#'。いちばん近いのは閉じた区画の (80,80)（20px）だが、たどり着けない
    expect(resolveMoveDest(g, { x: 16, y: 16 }, { x: 80, y: 60 })).toEqual({ x: 80, y: 16 });
  });

  it('マップの外なら、最も近い歩けるマス', () => {
    const g = makeGrid(32, MAP);
    expect(resolveMoveDest(g, { x: 80, y: 16 }, { x: -50, y: 16 })).toEqual({ x: 16, y: 16 });
  });

  it('出発点が歩けない場所なら null', () => {
    const g = makeGrid(32, MAP);
    expect(resolveMoveDest(g, { x: 48, y: 48 }, { x: 80, y: 48 })).toBeNull();
  });

  it('歩けるマスでも、足元の箱が壁にかかる位置なら内側へ寄せる', () => {
    // (30,48) は歩けるマス (0,1)。右隣 (1,1) が '#' なので x=26 まで寄せる
    const g = makeGrid(32, RING);
    expect(resolveMoveDest(g, { x: 16, y: 16 }, { x: 30, y: 48 })).toEqual({ x: 26, y: 48 });
  });
});

// 3×3 マスの真ん中だけ歩けない。マスは 32px
const RING = [
  '...',
  '.#.',
  '...',
];

describe('fitsAt', () => {
  it('マスの中心には収まる', () => {
    expect(fitsAt(makeGrid(32, RING), { x: 16, y: 16 })).toBe(true);
  });

  it('右隣が通れないマスで、足元から 6px 以内なら収まらない', () => {
    // (0,1) の右隣 (1,1) が '#'。x=27 なら箱の右端は 33 で、境界 32 を越える
    const g = makeGrid(32, RING);
    expect(fitsAt(g, { x: 26, y: 48 })).toBe(true);
    expect(fitsAt(g, { x: 27, y: 48 })).toBe(false);
  });

  it('左隣が通れないマスで、足元から 6px 以内なら収まらない', () => {
    const g = makeGrid(32, RING);
    expect(fitsAt(g, { x: 70, y: 48 })).toBe(true);
    expect(fitsAt(g, { x: 69, y: 48 })).toBe(false);
  });

  it('下が通れないマスなら、足先の 2px がかかる位置には立てない', () => {
    // (1,0) の下 (1,1) が '#'
    const g = makeGrid(32, RING);
    expect(fitsAt(g, { x: 48, y: 30 })).toBe(true);
    expect(fitsAt(g, { x: 48, y: 31 })).toBe(false);
  });

  it('上が通れないマスでも、頭のぶんは広げない（下から近づいたら境界まで立てる）', () => {
    // (1,2) の上 (1,1) が '#'
    expect(fitsAt(makeGrid(32, RING), { x: 48, y: 64 })).toBe(true);
  });

  it('マップの外は通れない扱い。端から 6px 以内には立てない', () => {
    const g = makeGrid(32, RING);
    expect(fitsAt(g, { x: 6, y: 16 })).toBe(true);
    expect(fitsAt(g, { x: 5, y: 16 })).toBe(false);
  });
});

describe('fitInCell', () => {
  it('収まる位置はそのまま返す', () => {
    expect(fitInCell(makeGrid(32, RING), { x: 20, y: 20 })).toEqual({ x: 20, y: 20 });
  });

  it('右隣が壁なら、箱が収まるところまで左へ寄せる', () => {
    expect(fitInCell(makeGrid(32, RING), { x: 30, y: 48 })).toEqual({ x: 26, y: 48 });
  });

  it('下が壁なら、足先が収まるところまで上へ寄せる', () => {
    expect(fitInCell(makeGrid(32, RING), { x: 48, y: 31 })).toEqual({ x: 48, y: 30 });
  });

  it('マップの端なら内側へ寄せる', () => {
    expect(fitInCell(makeGrid(32, RING), { x: 2, y: 16 })).toEqual({ x: 6, y: 16 });
  });

  it('通れないマスなら null', () => {
    expect(fitInCell(makeGrid(32, RING), { x: 48, y: 48 })).toBeNull();
  });
});

describe('hasClearPath', () => {
  it('壁から離れた直線なら通れる', () => {
    expect(hasClearPath(makeGrid(32, RING), { x: 16, y: 16 }, { x: 80, y: 16 })).toBe(true);
  });

  it('足元の点は壁の外を通っても、箱の端が壁にかかる直線は通れない', () => {
    // x=28 で縦に下りる。点は (0,1) を通るが、箱の右端 34 は '#' の (1,1) にかかる
    const g = makeGrid(32, RING);
    expect(hasLineOfSight(g, { x: 28, y: 16 }, { x: 28, y: 80 })).toBe(true);
    expect(hasClearPath(g, { x: 28, y: 16 }, { x: 28, y: 80 })).toBe(false);
  });
});

describe('slideStep', () => {
  it('箱が収まるならそのまま進む', () => {
    expect(slideStep(makeGrid(32, RING), { x: 16, y: 16 }, { x: 18, y: 18 })).toEqual({ x: 18, y: 18 });
  });

  it('斜めに壁へ寄るときは、箱が収まる範囲で行き先に最も近いところまで進む（壁に沿ってすべる）', () => {
    // (22,30) から右下 (28,40) へ。x=28 は右の壁に箱がかかる。x=26 まで寄せれば収まる
    expect(slideStep(makeGrid(32, RING), { x: 22, y: 30 }, { x: 28, y: 40 })).toEqual({ x: 26, y: 40 });
  });

  it('足元が境界からわずかに下にあって横へ進めないときも、寄せて進む', () => {
    // 左下 (0,1) だけが壁の地図で、(38,30.004) から左の (37,30.004) へ。
    // 箱の下端 32.004 が下の段にかかるので x だけの移動は収まらない。y=30 に寄せれば収まる。
    // 斜めに寄せると途中で箱の左下が壁の角をかすめるが、縦に上がってから横へ動けば壁にかからない
    const g = makeGrid(32, ['....', '#...']);
    expect(slideStep(g, { x: 38, y: 30.004 }, { x: 37, y: 30.004 })).toEqual({ x: 37, y: 30 });
  });

  it('途中が壁にかかっても、壁を避けた縦→横の2段の道筋があれば進む', () => {
    // (38,30.004) から (37,30) へは両端とも収まるが、まっすぐ動くと途中の (37.5,30.002) で箱の左下が
    // (0,1) の壁に入る。(38,30) を経由すれば壁にかからない
    const g = makeGrid(32, ['....', '#...']);
    expect(slideStep(g, { x: 38, y: 30.004 }, { x: 37, y: 30 })).toEqual({ x: 37, y: 30 });
  });

  it('寄せた点へ、まっすぐでも縦→横の2段でも壁にかかるなら、その点は選ばない', () => {
    // (30,29) から (35,33) へ。(35,33) は箱の左端 29 が (0,1) の壁にかかるので、同じマスの (38,33) へ寄せる。
    // (38,33) がいちばん近い候補だが、まっすぐだと箱の左下が壁を横切り、先に縦に下りても (30,33) で箱が壁に入る。
    // 残る候補は x だけ動く (35,29)
    const g = makeGrid(32, ['....', '#...']);
    expect(slideStep(g, { x: 30, y: 29 }, { x: 35, y: 33 })).toEqual({ x: 35, y: 29 });
  });

  it('どの向きにも進めなければ動かない', () => {
    // 右の壁に張り付いた位置からさらに右へ
    expect(slideStep(makeGrid(32, RING), { x: 26, y: 48 }, { x: 28, y: 48 })).toEqual({ x: 26, y: 48 });
  });

  it('出発点に箱が収まらないときは、足元の1点で判定して抜け出せる', () => {
    // (28,48) は箱が壁にかかっている。左へ動くなら点は歩けるので進む
    expect(slideStep(makeGrid(32, RING), { x: 28, y: 48 }, { x: 27, y: 48 })).toEqual({ x: 27, y: 48 });
  });
});
