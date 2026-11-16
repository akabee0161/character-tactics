import type { Registry } from '../engine/registry';
import { lookupDef } from '../engine/registry';
import type { ImageCache } from '../render/images';
import { drawFace, drawRoleBadge } from '../render/sprites';
import { LOGICAL_H, LOGICAL_W } from '../render/viewport';
import { CARD_CLOSE_BTN, ENEMY_LIST, ENEMY_LIST_CLOSE_BTN, FACE_PX, STAT_CARD, enemyListRow } from './layout';
import type { Overlay } from './overlay';
import { button, panel } from './screens';
import {
  KIND_COLOR, KIND_LABEL, STAT_LABEL, STAT_ORDER, barRatio, statGains,
} from './stat-card';
import type { StatCard } from './stat-card';
import { wrapText } from './talk';

const INK = '#f2efe4';
const GOLD = '#ffd479';
const MUTED = '#9fb3c4';

function dim(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(8, 12, 16, 0.72)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
}

/** 能力の札。card.before があればレベルアップの札（上がった能力を金色にして 前→後 で書く） */
export function drawStatCard(
  ctx: CanvasRenderingContext2D, reg: Registry, card: StatCard, images: ImageCache, closeLabel: string,
): void {
  dim(ctx);
  const c = STAT_CARD;
  ctx.fillStyle = '#16202a';
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(c.x + 1.5, c.y + 1.5, c.w - 3, c.h - 3);

  const left = c.x + 24;
  const right = c.x + c.w - 24;
  ctx.textAlign = 'left';
  if (card.before) {
    ctx.fillStyle = GOLD;
    ctx.font = '24px sans-serif';
    ctx.fillText(`レベルアップ！ Lv${card.before.level} → Lv${card.level}`, left, c.y + 36, c.w - 48);
  }

  const top = c.y + 52;
  const def = lookupDef(reg, card.defId);
  if (def) {
    drawFace(ctx, { x: left + FACE_PX.large / 2, y: top + FACE_PX.large / 2 }, FACE_PX.large / 2, def, images);
    drawRoleBadge(ctx, { x: left + 80, y: top + 36, w: 32, h: 32 }, def, images);
  }
  ctx.fillStyle = INK;
  ctx.font = '30px sans-serif';
  ctx.fillText(card.name, left + 80, top + 28, 230);
  ctx.fillStyle = MUTED;
  ctx.font = '18px sans-serif';
  ctx.fillText(card.role, left + 120, top + 58, 140);
  ctx.fillStyle = GOLD;
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'right';
  if (card.level !== null) ctx.fillText(`Lv${card.level}`, right, top + 28);
  else if (card.count !== null) ctx.fillText(`×${card.count}`, right, top + 28);
  ctx.textAlign = 'left';

  ctx.fillStyle = KIND_COLOR[card.attack];
  ctx.font = '20px sans-serif';
  ctx.fillText(KIND_LABEL[card.attack], left, top + 94);
  ctx.fillStyle = INK;
  ctx.fillText(`届く 距離 ${card.range}`, left + 64, top + 94);
  ctx.fillStyle = MUTED;
  ctx.font = '18px sans-serif';
  ctx.fillText(card.note, left, top + 120, c.w - 48);

  // レベルアップのセリフ。改行は空白にして 1 行で出し、あとの段を 32px 下げる
  const lineShift = card.line === null ? 0 : 32;
  if (card.line !== null) {
    ctx.fillStyle = INK;
    ctx.font = '20px sans-serif';
    ctx.fillText(`「${card.line.replace(/\n/g, ' ')}」`, left, top + 148, c.w - 48);
  }

  const gained = new Set(card.before ? statGains(card.before.stats, card.stats).map((g) => g.key) : []);
  let y = top + 140 + lineShift;
  for (const key of STAT_ORDER) {
    const up = gained.has(key);
    ctx.fillStyle = up ? GOLD : INK;
    ctx.font = '20px sans-serif';
    ctx.fillText(STAT_LABEL[key], left, y + 22, 100);
    ctx.fillStyle = '#2a3642';
    ctx.fillRect(left + 108, y + 8, 200, 14);
    ctx.fillStyle = up ? GOLD : '#7fb3e0';
    ctx.fillRect(left + 108, y + 8, 200 * barRatio(key, card.stats[key]), 14);
    ctx.textAlign = 'right';
    ctx.fillStyle = up ? GOLD : INK;
    const value = card.before && up ? `${card.before.stats[key]} → ${card.stats[key]}` : `${card.stats[key]}`;
    ctx.fillText(value, right, y + 22, 130);
    ctx.textAlign = 'left';
    y += 40;
  }

  y += 14;
  if (card.skill) {
    ctx.fillStyle = INK;
    ctx.font = '20px sans-serif';
    ctx.fillText(`技: ${card.skill.label}`, left, y + 18, c.w - 48);
    ctx.fillStyle = MUTED;
    ctx.font = '17px sans-serif';
    const lines = wrapText(card.skill.summary, (t) => ctx.measureText(t).width, c.w - 48).slice(0, 2);
    lines.forEach((line, i) => ctx.fillText(line, left, y + 44 + i * 22, c.w - 48));
    y += 52 + lines.length * 22;
  }
  ctx.fillStyle = GOLD;
  ctx.font = '17px sans-serif';
  for (const t of card.traits) {
    ctx.fillText(t, left, y + 18, c.w - 48);
    y += 24;
  }

  button(ctx, CARD_CLOSE_BTN, closeLabel, true, true);
}

/** ステージに出る敵の一覧。行を押すとその敵の札が開く */
export function drawEnemyList(
  ctx: CanvasRenderingContext2D, reg: Registry, o: Extract<Overlay, { kind: 'enemies' }>, images: ImageCache,
): void {
  dim(ctx);
  panel(ctx, ENEMY_LIST, '#16202a');
  ctx.fillStyle = INK;
  ctx.font = '24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${o.title}に 出る 敵`, ENEMY_LIST.x + ENEMY_LIST.w / 2, ENEMY_LIST.y + 40, ENEMY_LIST.w - 40);
  ctx.textAlign = 'left';
  o.enemies.forEach((e, i) => {
    const r = enemyListRow(i);
    panel(ctx, r, '#18222c');
    const def = lookupDef(reg, e.defId);
    if (def) drawFace(ctx, { x: r.x + 30, y: r.y + r.h / 2 }, FACE_PX.small / 2, def, images);
    ctx.fillStyle = INK;
    ctx.font = '22px sans-serif';
    ctx.fillText(e.name, r.x + 60, r.y + 36, 160);
    ctx.fillStyle = GOLD;
    ctx.fillText(`×${e.count}`, r.x + 230, r.y + 36);
    ctx.fillStyle = MUTED;
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('押すと 札 ›', r.x + r.w - 14, r.y + 36);
    ctx.textAlign = 'left';
  });
  button(ctx, ENEMY_LIST_CLOSE_BTN, '閉じる', true, true);
}
