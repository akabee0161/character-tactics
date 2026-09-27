import { distance } from './field';
import type { Vec2 } from './types';

const EPS = 1e-6;

/**
 * from から to への1ステップを、others のどれにも minDist より近づかないように補正する。
 * 内側に入りそうな相手ごとに、移動先をその相手を中心とする円周上へ押し戻す。
 * 近づく向きの成分だけが消えて横向きの成分は残るので、相手の横をすべるように回り込む。
 * すでに minDist より内側にいる相手については、今の距離より近づかないことだけを求める。
 * 押し戻したあとも条件を満たせなければ from を返す（その tick は動かない）
 */
export function separatedStep(from: Vec2, to: Vec2, others: readonly Vec2[], minDist: number): Vec2 {
  let p = { ...to };
  for (const o of others) {
    const limit = Math.min(minDist, distance(from, o));
    const d = distance(p, o);
    if (d >= limit - EPS) continue;
    if (d < EPS) return { ...from };
    p = { x: o.x + ((p.x - o.x) / d) * limit, y: o.y + ((p.y - o.y) / d) * limit };
  }
  for (const o of others) {
    if (distance(p, o) < Math.min(minDist, distance(from, o)) - EPS) return { ...from };
  }
  return p;
}
