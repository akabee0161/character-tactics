import type { StageDef } from '../engine/schema';

/** 明かり1つ。マップ座標（マスの中心）と、輪の半径 px */
export type LightSource = { x: number; y: number; radius: number };

/** legend に light のある文字のマスごとに1つ、左上から走査した順に返す */
export function lightSources(stage: StageDef): LightSource[] {
  const legend = stage.legend;
  if (legend === undefined) return [];
  const out: LightSource[] = [];
  stage.mapRows.forEach((row, cy) => {
    for (let cx = 0; cx < row.length; cx++) {
      const radius = legend[row[cx]!]?.light;
      if (radius === undefined) continue;
      out.push({ x: cx * stage.cell + stage.cell / 2, y: cy * stage.cell + stage.cell / 2, radius });
    }
  });
  return out;
}

const RADIUS_SWING = 0.06;
const ALPHA_MIN = 0.85;

/**
 * 明かりの輪のゆらぎ。radius は元の ±6%、alpha（中心の抜け具合）は 0.85〜1。
 * 周期は 1.2〜1.8 秒で、seed（マスの番号）ごとに周期と位相をずらし、明かりが揃って瞬かないようにする。
 * 時刻だけで決まる（乱数を使わない）ので、同じ引数なら同じ値
 */
export function flicker(radius: number, nowMs: number, seed: number): { radius: number; alpha: number } {
  const period = 1200 + ((seed * 37) % 7) * 100;
  const phase = seed * 1.7;
  const t = (nowMs / period) * Math.PI * 2 + phase;
  // 2つの波を重ねて単調な往復に見せない。重みの和が 1 なので [-1, 1] に収まる
  const wave = 0.7 * Math.sin(t) + 0.3 * Math.sin(t * 2.3 + 1);
  const wave2 = 0.7 * Math.sin(t * 1.3 + 2) + 0.3 * Math.sin(t * 3.1);
  return {
    radius: radius * (1 + RADIUS_SWING * wave),
    alpha: ALPHA_MIN + (1 - ALPHA_MIN) * (0.5 + 0.5 * wave2),
  };
}
