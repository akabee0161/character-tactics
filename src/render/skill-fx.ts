import type { Vec2 } from '../core/types';
import type { SkillFx } from './effects';

/**
 * 技ごとの見た目。技の ID ごとに描き方を 1 つずつ持つ。後でドット絵に替えるときは、その技の描き方だけを替える。
 * 座標は論理座標（draw.ts が atBody を通した後の値）。t は 0→1 の進み。
 * 図形（線・輪・粒）だけで描き、戦闘の計算には触らない
 */

/** 技 ID → 演出の秒数（画面の時間）。滑る技は、滑り終わった後の土煙などまで含む */
export const SKILL_FX_DURATION: Record<string, number> = {
  funbaru: 0.5,
  neraiuchi: 0.5,
  omajinai: 0.7,
  kakenukeru: 0.8,
  hikitsukeru: 0.7,
  hinoame: 1.0,
  tsuki: 0.4,
  hagemasu: 0.7,
  tatakiwari: 0.6,
  kekkai: 0.8,
  kyuukouka: 0.9,
};

/** 本体を行き先へ滑らせる技と、その長さ（秒）。計算では一瞬で着く */
export const DASH_DURATION: Record<string, number> = { kakenukeru: 0.6, kyuukouka: 0.6 };

/** 滑りの間に本体を持ち上げる高さの頂点（px）。飛ぶ技だけ */
export const DASH_LIFT: Record<string, number> = { kyuukouka: 40 };

export type SkillFxDraw = (ctx: CanvasRenderingContext2D, fx: SkillFx, t: number) => void;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, s: number): number => a + (b - a) * s;
const lerpPos = (a: Vec2, b: Vec2, s: number): Vec2 => ({ x: lerp(a.x, b.x, s), y: lerp(a.y, b.y, s) });

/** 0〜1 の決まった疑似乱数（粒の位置用。毎フレーム同じ値になる） */
function rnd(i: number, k: number): number {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function ring(ctx: CanvasRenderingContext2D, p: Vec2, r: number, rgb: string, alpha: number, width: number): void {
  if (alpha <= 0 || r <= 0) return;
  ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function disc(ctx: CanvasRenderingContext2D, p: Vec2, r: number, rgb: string, alpha: number): void {
  if (alpha <= 0 || r <= 0) return;
  ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
}

function glow(ctx: CanvasRenderingContext2D, p: Vec2, r: number, rgb: string, alpha: number): void {
  if (alpha <= 0 || r <= 0) return;
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
  g.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
}

function line(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, rgb: string, alpha: number, width: number): void {
  if (alpha <= 0) return;
  ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** 放射状の火花。当たった所に重ねる。ほかの描画（会心の当たり）からも使う */
export function drawSpark(
  ctx: CanvasRenderingContext2D, p: Vec2, size: number, rgb: string, alpha: number, rays = 8,
): void {
  if (alpha <= 0) return;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + 0.3;
    const near = size * 0.35;
    line(ctx, { x: p.x + Math.cos(a) * near, y: p.y + Math.sin(a) * near },
      { x: p.x + Math.cos(a) * size, y: p.y + Math.sin(a) * size }, rgb, alpha, 2);
  }
}

/** 線分 a→b への p の射影の割合（0〜1 に丸める） */
function along(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  return clamp01(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2);
}

function dashFraction(fx: SkillFx): number {
  return clamp01((DASH_DURATION[fx.skillId] ?? 0) / fx.duration);
}

/** 滑りの進み s（0〜1）での本体の位置。飛ぶ技は弧を描いて持ち上がる */
export function dashPoint(fx: SkillFx, s: number): Vec2 {
  const p = lerpPos(fx.from, fx.to, s);
  const lift = DASH_LIFT[fx.skillId] ?? 0;
  return { x: p.x, y: p.y - 4 * lift * s * (1 - s) };
}

/** 滑りの間の本体の薄い丸（残像）を 3 つ */
function afterimages(ctx: CanvasRenderingContext2D, fx: SkillFx, s: number, fade: number): void {
  if (s <= 0 || fade <= 0) return;
  for (let k = 1; k <= 3; k++) {
    const sk = clamp01(s - k * 0.09);
    disc(ctx, dashPoint(fx, sk), 11 - k, '255, 255, 255', (0.34 - k * 0.09) * fade);
  }
}

const FX_FUNBARU: SkillFxDraw = (ctx, fx, t) => {
  ring(ctx, fx.from, 6 + t * 30, '255, 226, 122', 1 - t, 4);
  ring(ctx, fx.from, 3 + t * 20, '255, 244, 190', (1 - t) * 0.7, 2);
};

const FX_NERAIUCHI: SkillFxDraw = (ctx, fx, t) => {
  const a = 1 - t;
  const s = 10 + t * 8;
  const p = fx.from;
  line(ctx, { x: p.x - s, y: p.y }, { x: p.x + s, y: p.y }, '255, 255, 255', a, 2);
  line(ctx, { x: p.x, y: p.y - s }, { x: p.x, y: p.y + s }, '255, 255, 255', a, 2);
  ring(ctx, p, 4 + t * 10, '255, 255, 255', a * 0.6, 2);
};

const FX_OMAJINAI: SkillFxDraw = (ctx, fx, t) => {
  glow(ctx, fx.from, 22, '170, 255, 200', (1 - t) * 0.5);
  for (const target of fx.affected) {
    for (let i = 0; i < 6; i++) {
      const delay = i * 0.07;
      const s = clamp01((t - delay) / 0.5);
      if (s <= 0 || s >= 1) continue;
      const base = lerpPos(fx.from, target, s);
      const wobble = Math.sin(s * Math.PI * 2 + i) * 8 * (1 - s);
      const p = { x: base.x + wobble, y: base.y - Math.sin(s * Math.PI) * 14 };
      glow(ctx, p, 8, '190, 255, 210', 0.9);
      disc(ctx, p, 2.5, '255, 255, 255', 1);
    }
  }
};

const FX_KAKENUKERU: SkillFxDraw = (ctx, fx, t) => {
  const dash = dashFraction(fx);
  const s = clamp01(t / dash);
  const fade = t < dash ? 1 : 1 - clamp01((t - dash) / (1 - dash));
  const head = lerpPos(fx.from, fx.to, s);
  line(ctx, fx.from, head, '120, 220, 255', 0.35 * fade, 11);
  line(ctx, fx.from, head, '255, 255, 255', 0.9 * fade, 4);
  afterimages(ctx, fx, s, t < dash ? 1 : fade);
  for (const a of fx.affected) {
    const local = (t - along(a, fx.from, fx.to) * dash) / 0.25;
    if (local < 0 || local > 1) continue;
    drawSpark(ctx, a, 10 + local * 14, '255, 240, 160', 1 - local, 8);
  }
};

const FX_HIKITSUKERU: SkillFxDraw = (ctx, fx, t) => {
  const reach = clamp01(t / 0.35);
  const fade = 1 - clamp01((t - 0.5) / 0.5);
  ring(ctx, fx.from, 8 + t * 24, '255, 90, 80', fade * 0.8, 3);
  for (const e of fx.affected) {
    line(ctx, fx.from, lerpPos(fx.from, e, reach), '255, 80, 70', 0.75 * fade, 3);
    if (reach >= 1) {
      const grow = clamp01((t - 0.35) / 0.4);
      ctx.save();
      ctx.translate(e.x, e.y + 12);
      ctx.scale(1, 0.45);
      ring(ctx, { x: 0, y: 0 }, 8 + grow * 18, '255, 80, 70', fade, 3);
      ctx.restore();
    }
  }
};

const FX_HINOAME: SkillFxDraw = (ctx, fx, t) => {
  const c = fx.aim ?? fx.to;
  // 範囲の目印（降り始めに薄い円）
  ring(ctx, c, 48, '255, 120, 60', clamp01(1 - t * 2) * 0.5, 2);
  const N = 18;
  for (let i = 0; i < N; i++) {
    const ang = rnd(i, 1) * Math.PI * 2;
    const dist = Math.sqrt(rnd(i, 2)) * 44;
    const ground = { x: c.x + Math.cos(ang) * dist, y: c.y + Math.sin(ang) * dist * 0.7 };
    const start = rnd(i, 3) * 0.45;
    const fall = 0.28;
    const s = (t - start) / fall;
    if (s >= 0 && s < 1) {
      const y = ground.y - 110 * (1 - s);
      line(ctx, { x: ground.x, y: y - 14 }, { x: ground.x, y }, '255, 190, 80', 0.9, 3);
      disc(ctx, { x: ground.x, y }, 3.5, '255, 120, 40', 1);
    } else if (s >= 1) {
      const burst = clamp01((s - 1) / 0.6);
      glow(ctx, ground, 10 + burst * 10, '255, 150, 60', (1 - burst) * 0.9);
    }
  }
  // 着いた所が赤く光る
  const lit = clamp01((t - 0.25) / 0.25) * (1 - clamp01((t - 0.55) / 0.45));
  glow(ctx, c, 56, '255, 70, 40', lit * 0.65);
  for (const e of fx.affected) glow(ctx, e, 16, '255, 200, 120', lit * 0.8);
};

const FX_TSUKI: SkillFxDraw = (ctx, fx, t) => {
  const tip = fx.aim ?? fx.to;
  const ext = clamp01(t / 0.4);
  const fade = 1 - clamp01((t - 0.4) / 0.6);
  const head = lerpPos(fx.from, tip, ext);
  const dx = head.x - fx.from.x;
  const dy = head.y - fx.from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * 7;
  const ny = (dx / len) * 7;
  ctx.fillStyle = `rgba(190, 235, 255, ${0.75 * fade})`;
  ctx.beginPath();
  ctx.moveTo(fx.from.x + nx, fx.from.y + ny);
  ctx.lineTo(head.x, head.y);
  ctx.lineTo(fx.from.x - nx, fx.from.y - ny);
  ctx.closePath();
  ctx.fill();
  line(ctx, fx.from, head, '255, 255, 255', fade, 3);
  for (const a of fx.affected) {
    const local = (t - 0.2) / 0.3;
    if (local >= 0 && local <= 1) drawSpark(ctx, a, 8 + local * 10, '255, 255, 255', 1 - local, 6);
  }
};

const FX_HAGEMASU: SkillFxDraw = (ctx, fx, t) => {
  const grow = clamp01(t / 0.6);
  ring(ctx, fx.from, 10 + grow * 110, '255, 170, 60', (1 - grow) * 0.9, 4);
  const flash = clamp01(1 - Math.abs(t - 0.35) / 0.35);
  for (const a of fx.affected) {
    glow(ctx, a, 26, '255, 190, 80', flash * 0.8);
    ring(ctx, a, 22 - flash * 6, '255, 170, 60', flash, 3);
  }
};

const FX_TATAKIWARI: SkillFxDraw = (ctx, fx, t) => {
  const c = fx.aim ?? fx.to;
  const fall = clamp01(t / 0.12);
  if (t < 0.25) {
    // 斧の線が上から振り下ろされる
    const top = { x: c.x - 10, y: c.y - 60 };
    line(ctx, top, lerpPos(top, { x: c.x, y: c.y + 4 }, fall), '255, 255, 255', 1 - clamp01((t - 0.12) / 0.13), 6);
  }
  if (t >= 0.1) {
    const k = clamp01((t - 0.1) / 0.5);
    const a = 1 - k;
    // 割れ目: 中心から 5 本のギザギザの線
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI / 2 + (i - 2) * 0.9 + (rnd(i, 4) - 0.5) * 0.4;
      let p = c;
      for (let j = 1; j <= 3; j++) {
        const step = (10 + rnd(i, 5 + j) * 10) * clamp01(k * 3 - (j - 1) * 0.5 + 0.3);
        const wob = (rnd(i, 9 + j) - 0.5) * 1.2;
        const nxt = { x: p.x + Math.cos(ang + wob) * step, y: p.y + Math.sin(ang + wob) * step * 0.8 };
        line(ctx, p, nxt, '40, 30, 20', a, 4);
        line(ctx, p, nxt, '255, 230, 170', a * 0.9, 2);
        p = nxt;
      }
    }
    ring(ctx, c, 6 + k * 36, '255, 235, 190', a * 0.8, 4);
    drawSpark(ctx, c, 14 + k * 22, '255, 255, 255', a, 10);
  }
};

const FX_KEKKAI: SkillFxDraw = (ctx, fx, t) => {
  const grow = clamp01(t / 0.55);
  ring(ctx, fx.from, 10 + grow * 110, '110, 210, 255', (1 - grow) * 0.9, 4);
  const fade = 1 - clamp01((t - 0.3) / 0.7);
  const pop = clamp01(t / 0.2);
  for (const a of fx.affected) {
    disc(ctx, a, 12 + pop * 12, '120, 215, 255', 0.28 * fade);
    ring(ctx, a, 12 + pop * 12, '190, 240, 255', 0.9 * fade, 2);
  }
};

const FX_KYUUKOUKA: SkillFxDraw = (ctx, fx, t) => {
  const dash = dashFraction(fx);
  const s = clamp01(t / dash);
  const ground = (p: Vec2): Vec2 => ({ x: p.x, y: p.y + 14 });
  if (t < dash + 0.1) {
    // 弧の軌跡
    const fade = t < dash ? 1 : 1 - (t - dash) / 0.1;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 * fade})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const p = dashPoint(fx, (i / 16) * s);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    afterimages(ctx, fx, s, fade);
  }
  if (t >= dash) {
    // 着いた所の土煙の輪（範囲 32）
    const u = clamp01((t - dash) / (1 - dash));
    ctx.save();
    ctx.translate(fx.to.x, ground(fx.to).y);
    ctx.scale(1, 0.55);
    ring(ctx, { x: 0, y: 0 }, 6 + u * 28, '230, 215, 180', (1 - u) * 0.95, 5);
    ring(ctx, { x: 0, y: 0 }, 3 + u * 16, '255, 255, 255', (1 - u) * 0.6, 3);
    ctx.restore();
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + rnd(i, 7);
      const r = 8 + u * 26;
      const p = { x: fx.to.x + Math.cos(ang) * r, y: ground(fx.to).y + Math.sin(ang) * r * 0.55 - u * 8 };
      disc(ctx, p, 3 + u * 4, '220, 205, 170', (1 - u) * 0.7);
    }
    for (const a of fx.affected) drawSpark(ctx, a, 10 + u * 14, '255, 240, 160', (1 - u) * 0.9, 8);
  }
};

export const SKILL_FX: Record<string, SkillFxDraw> = {
  funbaru: FX_FUNBARU,
  neraiuchi: FX_NERAIUCHI,
  omajinai: FX_OMAJINAI,
  kakenukeru: FX_KAKENUKERU,
  hikitsukeru: FX_HIKITSUKERU,
  hinoame: FX_HINOAME,
  tsuki: FX_TSUKI,
  hagemasu: FX_HAGEMASU,
  tatakiwari: FX_TATAKIWARI,
  kekkai: FX_KEKKAI,
  kyuukouka: FX_KYUUKOUKA,
};

/** たたき割りの強い揺れ。画面全体をずらす量（論理座標の px） */
export function shakeOffset(skillId: string, t: number): Vec2 {
  if (skillId !== 'tatakiwari' || t < 0.1 || t > 0.5) return { x: 0, y: 0 };
  const k = 1 - (t - 0.1) / 0.4;
  return { x: Math.sin(t * 140) * 5 * k, y: Math.cos(t * 170) * 4 * k };
}
