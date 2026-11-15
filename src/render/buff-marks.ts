import type { Unit } from '../core/types';

/** はげます（攻撃力 +）と結界（魔法防御 +）の印の色。形は同じ上三角で、色で見分ける */
export const BUFF_COLOR = { cheer: '#ff9a3c', ward: '#5fd4ff' } as const;

export type ActiveBuffs = { cheer: boolean; ward: boolean };

/** 時刻 time に効いているバフ。期限（…Until）の時刻ちょうどで切れる */
export function activeBuffs(unit: Pick<Unit, 'cheerUntil' | 'wardUntil'>, time: number): ActiveBuffs {
  return { cheer: time < unit.cheerUntil, ward: time < unit.wardUntil };
}

/** 上三角（頂点が上）。中心 x、底辺 y で、幅 w・高さ h。暗い縁を付けて地面の上でも読めるようにする */
export function drawUpTriangle(
  ctx: CanvasRenderingContext2D, cx: number, baseY: number, w: number, h: number, color: string,
): void {
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, baseY);
  ctx.lineTo(cx + w / 2, baseY);
  ctx.lineTo(cx, baseY - h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#101820';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fill();
}

/** マップ上のユニットの印。HP バーの上に、効いているものを左（はげます）・右（結界）の順に並べる */
export function drawBuffMarks(
  ctx: CanvasRenderingContext2D, cx: number, baseY: number, buffs: ActiveBuffs,
): void {
  const kinds = (['cheer', 'ward'] as const).filter((k) => buffs[k]);
  const gap = 12;
  kinds.forEach((k, i) => {
    drawUpTriangle(ctx, cx + (i - (kinds.length - 1) / 2) * gap, baseY, 10, 9, BUFF_COLOR[k]);
  });
}
