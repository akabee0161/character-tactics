import { bondSupporters } from '../core/bonds';
import { isFunbaruActive } from '../core/combat';
import { playerUnits } from '../core/sim';
import { lookupDef } from '../engine/registry';
import type { Registry } from '../engine/registry';
import type { StageDef } from '../engine/schema';
import type { ImageCache } from './images';
import { alertMarks } from './objectives-view';
import { STILL, frameFor } from './anim';
import type { AnimStore } from './anim';
import { drawHalf, drawMapUnit } from './sprites';
import type { SpriteDef } from './sprites';
import { LOGICAL_H, LOGICAL_W, MAP_ORIGIN, mapToLogical } from './viewport';
import {
  BOND_PULSE_DURATION, DAMAGE_TEXT_DURATION, DEFEAT_DURATION,
  HEAL_BEAM_DURATION, HEAL_RING_DURATION, HEAL_TEXT_DURATION, HIT_EFFECT_DURATION,
  KNOCKBACK_DURATION, SKILL_CAST_DURATION, TRAIL_DURATION,
} from './effects';
import type { EffectState } from './effects';
import type { BattleState, Vec2 } from '../core/types';

const COLORS = {
  sea: '#12303f',
  ground: '#3f5d3a',
  rock: '#2b3a44',
  bar: '#101820',
  text: '#f2efe4',
  hpBack: '#000000',
  hpAlly: '#5ad06a',
  hpEnemy: '#d05a5a',
  bond: 'rgba(255, 190, 220, 0.55)',
  goal: '#ffd479',
  alert: '#ff5a5a',
  escort: '#ffd479',
};

const UNIT_R = 11;

// drawEffects 専用。絵入り味方(32px = half 16)に合わせた半径。
// ガルムなど大きいスプライトには追随しない簡易対応。本格対応は Effect に half を持たせる形で別途行う
const EFFECT_R = 16;

const FALLBACK_DEF = { name: '', color: '#888888', role: '', sprites: { role: null, face: null, map: null } };

function defOf(reg: Registry, defId: string): { name: string; color: string } & SpriteDef {
  return lookupDef(reg, defId) ?? { ...FALLBACK_DEF, name: defId };
}

/** EnemyDef.maxHp から見た目の半径を導く。ID を直書きしない */
function enemyRadius(maxHp: number): number {
  return maxHp >= 40 ? UNIT_R + 3 : UNIT_R;
}

export function drawBattle(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  state: BattleState,
  selected: string | null,
  effects: EffectState,
  escorts: Set<string>,
  images: ImageCache,
  anim: AnimStore,
): void {
  ctx.save();
  ctx.fillStyle = COLORS.sea;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  drawTerrain(ctx, state);
  drawVictoryMarker(ctx, state.stage);
  drawGoalMarkers(ctx, reg, state, selected);
  drawBonds(ctx, state);
  drawUnits(ctx, reg, state, selected, effects, images, anim);
  drawAlertMarks(ctx, reg, state);
  drawProjectiles(ctx, state);
  drawEscortMarks(ctx, state, escorts);
  drawEffects(ctx, effects);
  drawTopBar(ctx, state);
  ctx.restore();
}

function drawTerrain(ctx: CanvasRenderingContext2D, state: BattleState): void {
  const { grid } = state;
  for (let i = 0; i < grid.walkable.length; i++) {
    const cx = i % grid.cols;
    const cy = Math.floor(i / grid.cols);
    const p = mapToLogical({ x: cx * grid.cell, y: cy * grid.cell });
    ctx.fillStyle = grid.walkable[i] ? COLORS.ground : COLORS.rock;
    ctx.fillRect(p.x, p.y, grid.cell, grid.cell);
  }
}

/** 気づかれた敵の頭上に「！」を出す。索敵範囲そのものは見せない */
function drawAlertMarks(ctx: CanvasRenderingContext2D, reg: Registry, state: BattleState): void {
  ctx.fillStyle = COLORS.alert;
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  for (const m of alertMarks(state.units)) {
    const p = mapToLogical(m.pos);
    const half = drawHalf(defOf(reg, m.defId), UNIT_R);
    ctx.fillText('！', p.x, p.y - half - 10);
  }
  ctx.textAlign = 'left';
}

function drawVictoryMarker(ctx: CanvasRenderingContext2D, stage: StageDef): void {
  const p = mapToLogical(stage.victory.pos);
  ctx.strokeStyle = COLORS.goal;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y, stage.victory.radius, 0, Math.PI * 2);
  ctx.stroke();

  // 旗。ここがゴールだとひと目でわかるように
  ctx.fillStyle = COLORS.goal;
  ctx.fillRect(p.x - 2, p.y - 26, 4, 26);
  ctx.beginPath();
  ctx.moveTo(p.x + 2, p.y - 26);
  ctx.lineTo(p.x + 22, p.y - 19);
  ctx.lineTo(p.x + 2, p.y - 12);
  ctx.closePath();
  ctx.fill();
}

/** 飛んでいる矢と魔法。位置はシムが持っているので、ここは見た目だけ */
function drawProjectiles(ctx: CanvasRenderingContext2D, state: BattleState): void {
  for (const pj of state.projectiles) {
    const p = mapToLogical(pj.pos);
    if (pj.kind === 'bow') {
      const from = mapToLogical(pj.source.pos);
      const dx = p.x - from.x;
      const dy = p.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      ctx.strokeStyle = '#e8e2d0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - (dx / len) * 12, p.y - (dy / len) * 12);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#c07ae0';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(192, 122, 224, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/** 護衛対象の頭上に印を出す。倒れたら即敗北するのがどれかを盤面で示す */
function drawEscortMarks(ctx: CanvasRenderingContext2D, state: BattleState, escorts: Set<string>): void {
  ctx.fillStyle = COLORS.escort;
  for (const u of state.units) {
    if (u.retired || u.side !== 'player' || !escorts.has(u.defId)) continue;
    const p = mapToLogical(u.pos);
    const half = drawHalf(defOf(state.reg, u.defId), UNIT_R);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - half - 14);
    ctx.lineTo(p.x - 6, p.y - half - 24);
    ctx.lineTo(p.x + 6, p.y - half - 24);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBonds(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.bond;
  const units = playerUnits(state);
  const supportersList = units.map((u) => ({ id: u.defId, pos: u.pos, retired: u.retired, uid: u.uid }));
  for (const unit of units) {
    if (unit.engagedWith === null) continue;
    for (const s of bondSupporters(state.reg, unit.uid, unit.defId, unit.pos, supportersList)) {
      const other = units.find((u) => u.uid === s.uid);
      if (!other) continue;
      const a = mapToLogical(unit.pos);
      const b = mapToLogical(other.pos);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      drawHeart(ctx, mapToLogical({ x: other.pos.x, y: other.pos.y - 20 }));
    }
  }
}

function drawHeart(ctx: CanvasRenderingContext2D, p: Vec2): void {
  ctx.fillStyle = '#ff9ec4';
  ctx.beginPath();
  ctx.arc(p.x - 3, p.y, 3.5, 0, Math.PI * 2);
  ctx.arc(p.x + 3, p.y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(p.x - 6.2, p.y + 1);
  ctx.lineTo(p.x, p.y + 8);
  ctx.lineTo(p.x + 6.2, p.y + 1);
  ctx.fill();
}

function drawHpBar(
  ctx: CanvasRenderingContext2D, p: Vec2, half: number, ratio: number, color: string,
): void {
  const w = 26;
  ctx.fillStyle = COLORS.hpBack;
  ctx.fillRect(p.x - w / 2, p.y - half - 9, w, 4);
  ctx.fillStyle = color;
  ctx.fillRect(p.x - w / 2, p.y - half - 9, w * Math.max(0, Math.min(1, ratio)), 4);
}

function drawUnits(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  state: BattleState,
  selected: string | null,
  effects: EffectState,
  images: ImageCache,
  anim: AnimStore,
): void {
  for (const unit of state.units) {
    if (unit.retired) continue;
    const isAlly = unit.side === 'player';
    const kb = effects.knockback.get(unit.uid);
    const kbOffset = kb
      ? { x: kb.dir.x * (kb.ttl / KNOCKBACK_DURATION) * 6, y: kb.dir.y * (kb.ttl / KNOCKBACK_DURATION) * 6 }
      : { x: 0, y: 0 };
    const p = mapToLogical({ x: unit.pos.x + kbOffset.x, y: unit.pos.y + kbOffset.y });
    const def = defOf(reg, unit.defId);
    const radius = isAlly ? UNIT_R : enemyRadius(unit.maxHp);
    const sheet = def.sprites.map;
    const frame = sheet === null ? STILL : frameFor(anim, unit.uid, sheet, state.time);
    drawMapUnit(ctx, p, radius, def, images, frame);
    // 絵が入ると 22px から 32px になる。HPバーやリングはこの half を基準にする
    const half = drawHalf(def, radius);

    if (unit.bowDamageCap !== null) {
      ctx.fillStyle = '#c8ccd4';
      ctx.fillRect(p.x - 14, p.y - 8, 5, 16);
    }

    if (isAlly) {
      // 旗(キャラだとわかるように)
      ctx.fillStyle = COLORS.text;
      ctx.fillRect(p.x + half - 2, p.y - half - 6, 2, 10);
      ctx.fillRect(p.x + half, p.y - half - 6, 7, 5);

      if (unit.uid === selected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, half + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (isFunbaruActive(unit, state.time)) {
      ctx.strokeStyle = '#ffe27a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, half + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (unit.neraiuchiArmed) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, half + 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    const displayedHp = effects.displayedHp.get(unit.uid) ?? unit.hp;
    drawHpBar(ctx, p, half, displayedHp / unit.maxHp, isAlly ? COLORS.hpAlly : COLORS.hpEnemy);
  }
}

function drawEffects(ctx: CanvasRenderingContext2D, effects: EffectState): void {
  for (const e of effects.items) {
    switch (e.kind) {
      case 'hit': {
        const p = mapToLogical(e.pos);
        const ratio = Math.max(0, e.ttl / HIT_EFFECT_DURATION);
        ctx.strokeStyle = e.critical ? `rgba(255, 120, 60, ${ratio})` : `rgba(255, 235, 150, ${ratio})`;
        ctx.lineWidth = e.critical ? 4 : 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, EFFECT_R + (1 - ratio) * (e.critical ? 20 : 14), 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'damageText': {
        const p = mapToLogical(e.pos);
        const ratio = Math.max(0, e.ttl / DAMAGE_TEXT_DURATION);
        const rise = (1 - ratio) * 20;
        ctx.globalAlpha = ratio;
        ctx.fillStyle = e.critical ? '#ff8a3c' : '#ffffff';
        ctx.font = e.critical ? 'bold 18px sans-serif' : '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${e.amount}`, p.x, p.y - EFFECT_R - 14 - rise);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
        break;
      }
      case 'healText': {
        const p = mapToLogical(e.pos);
        const ratio = Math.max(0, e.ttl / HEAL_TEXT_DURATION);
        const rise = (1 - ratio) * 20;
        ctx.globalAlpha = ratio;
        ctx.fillStyle = '#8fffb0';
        ctx.font = '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`+${e.amount}`, p.x, p.y - EFFECT_R - 14 - rise);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
        break;
      }
      case 'heal': {
        const p = mapToLogical(e.pos);
        const ratio = Math.max(0, e.ttl / HEAL_RING_DURATION);
        ctx.strokeStyle = `rgba(150, 255, 180, ${ratio})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, EFFECT_R + (1 - ratio) * 16, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'healBeam': {
        const a = mapToLogical(e.from);
        const b = mapToLogical(e.to);
        const ratio = Math.max(0, e.ttl / HEAL_BEAM_DURATION);
        ctx.strokeStyle = `rgba(180, 255, 200, ${ratio})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        break;
      }
      case 'skillCast': {
        const p = mapToLogical(e.pos);
        const ratio = Math.max(0, e.ttl / SKILL_CAST_DURATION);
        if (e.skillId === 'funbaru') {
          ctx.strokeStyle = `rgba(255, 226, 122, ${ratio})`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, (1 - ratio) * 34, 0, Math.PI * 2);
          ctx.stroke();
        } else if (e.skillId === 'neraiuchi') {
          ctx.strokeStyle = `rgba(255, 255, 255, ${ratio})`;
          ctx.lineWidth = 2;
          const s = 10 + (1 - ratio) * 6;
          ctx.beginPath();
          ctx.moveTo(p.x - s, p.y);
          ctx.lineTo(p.x + s, p.y);
          ctx.moveTo(p.x, p.y - s);
          ctx.lineTo(p.x, p.y + s);
          ctx.stroke();
        }
        break;
      }
      case 'trail': {
        const a = mapToLogical(e.from);
        const b = mapToLogical(e.to);
        const ratio = Math.max(0, e.ttl / TRAIL_DURATION);
        ctx.strokeStyle = `rgba(255, 255, 255, ${ratio})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        break;
      }
      case 'defeat': {
        const p = mapToLogical(e.pos);
        const ratio = Math.max(0, e.ttl / DEFEAT_DURATION);
        ctx.globalAlpha = ratio;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, EFFECT_R + (1 - ratio) * 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case 'bondPulse': {
        const p = mapToLogical(e.pos);
        const ratio = Math.max(0, e.ttl / BOND_PULSE_DURATION);
        ctx.strokeStyle = `rgba(255, 158, 196, ${ratio})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, EFFECT_R + (1 - ratio) * 18, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      default: {
        const _exhaustive: never = e;
        void _exhaustive;
        break;
      }
    }
  }
}

function drawTopBar(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.fillStyle = COLORS.bar;
  ctx.fillRect(0, 0, LOGICAL_W, MAP_ORIGIN.y);
  ctx.fillStyle = COLORS.text;
  ctx.font = '20px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.stage.name, 16, MAP_ORIGIN.y / 2);
}

/** 4人ぶんの移動先を常に出す。誰がどこへ向かっているかを盤面だけで読めるようにする */
export function drawGoalMarkers(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  state: BattleState,
  selected: string | null,
): void {
  for (const unit of state.units) {
    if (unit.side !== 'player' || unit.retired || !unit.goalPos) continue;
    const a = mapToLogical(unit.pos);
    const g = mapToLogical(unit.goalPos);
    const color = defOf(reg, unit.defId).color;
    const isSelected = unit.uid === selected;

    ctx.strokeStyle = color;

    if (isSelected) {
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(g.x, g.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.beginPath();
    ctx.arc(g.x, g.y, isSelected ? 11 : 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** ドラッグ中に、離したらどうなるかを先に見せる */
export function drawDragPreview(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  fromMap: Vec2,
  toMap: Vec2,
  defId: string,
  blocked: boolean,
  images: ImageCache,
): void {
  const a = mapToLogical(fromMap);
  const b = mapToLogical(toMap);
  const def = defOf(reg, defId);
  const color = blocked ? COLORS.hpEnemy : def.color;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalAlpha = 0.5;
  drawMapUnit(ctx, b, UNIT_R, def, images, STILL);
  ctx.globalAlpha = 1;

  if (blocked) {
    const half = drawHalf(def, UNIT_R);
    ctx.strokeStyle = COLORS.hpEnemy;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, half + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}
