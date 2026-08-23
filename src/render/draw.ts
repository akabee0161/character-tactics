import { CHARACTERS } from '../content/characters';
import { ENEMIES } from '../content/enemies';
import { bondSupporters } from '../core/bonds';
import { isFunbaruActive } from '../core/skills';
import { FORT_MAX_HP } from '../core/types';
import { LOGICAL_H, LOGICAL_W, mapToLogical } from './viewport';
import { HIT_EFFECT_DURATION } from './effects';
import type { EffectState } from './effects';
import type { BattleState, CharId, Vec2 } from '../core/types';

const COLORS = {
  sea: '#12303f',
  ground: '#3f5d3a',
  rock: '#2b3a44',
  fort: '#d8c98a',
  bar: '#101820',
  text: '#f2efe4',
  hpBack: '#000000',
  hpAlly: '#5ad06a',
  hpEnemy: '#d05a5a',
  bond: 'rgba(255, 190, 220, 0.55)',
};

const UNIT_R = 11;

export function drawBattle(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  selected: CharId | null,
  effects: EffectState,
): void {
  ctx.save();
  ctx.fillStyle = COLORS.sea;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  drawTerrain(ctx, state);
  drawFort(ctx, state);
  drawBonds(ctx, state);
  drawEnemies(ctx, state);
  drawAllies(ctx, state, selected);
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

function drawFort(ctx: CanvasRenderingContext2D, state: BattleState): void {
  const p = mapToLogical(state.stage.fort);
  ctx.fillStyle = COLORS.fort;
  ctx.fillRect(p.x - 18, p.y - 18, 36, 36);
  ctx.fillStyle = COLORS.bar;
  ctx.fillRect(p.x - 4, p.y - 10, 8, 20);
}

function drawBonds(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.bond;
  for (const ally of state.allies) {
    if (ally.retired || ally.engagedWith === null) continue;
    for (const s of bondSupporters(ally.id, ally.pos, state.allies)) {
      const other = state.allies.find((a) => a.id === s.id);
      if (!other) continue;
      const a = mapToLogical(ally.pos);
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

function drawHpBar(ctx: CanvasRenderingContext2D, p: Vec2, ratio: number, color: string): void {
  const w = 26;
  ctx.fillStyle = COLORS.hpBack;
  ctx.fillRect(p.x - w / 2, p.y - UNIT_R - 9, w, 4);
  ctx.fillStyle = color;
  ctx.fillRect(p.x - w / 2, p.y - UNIT_R - 9, w * Math.max(0, Math.min(1, ratio)), 4);
}

function drawEnemies(ctx: CanvasRenderingContext2D, state: BattleState): void {
  for (const enemy of state.enemies) {
    const p = mapToLogical(enemy.pos);
    const def = ENEMIES[enemy.kind];
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, enemy.kind === 'garum' ? UNIT_R + 3 : UNIT_R, 0, Math.PI * 2);
    ctx.fill();
    if (enemy.kind === 'tatemochi') {
      ctx.fillStyle = '#c8ccd4';
      ctx.fillRect(p.x - 14, p.y - 8, 5, 16);
    }
    drawHpBar(ctx, p, enemy.hp / enemy.maxHp, COLORS.hpEnemy);
  }
}

function drawAllies(ctx: CanvasRenderingContext2D, state: BattleState, selected: CharId | null): void {
  for (const ally of state.allies) {
    if (ally.retired) continue;
    const p = mapToLogical(ally.pos);
    ctx.fillStyle = CHARACTERS[ally.id].color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, UNIT_R, 0, Math.PI * 2);
    ctx.fill();

    // はた（キャラだとわかるように）
    ctx.fillStyle = COLORS.text;
    ctx.fillRect(p.x + UNIT_R - 2, p.y - UNIT_R - 6, 2, 10);
    ctx.fillRect(p.x + UNIT_R, p.y - UNIT_R - 6, 7, 5);

    if (ally.id === selected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, UNIT_R + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (isFunbaruActive(ally, state.time)) {
      ctx.strokeStyle = '#ffe27a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, UNIT_R + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (ally.neraiuchiArmed) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, UNIT_R + 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawHpBar(ctx, p, ally.hp / ally.maxHp, COLORS.hpAlly);
  }
}

function drawEffects(ctx: CanvasRenderingContext2D, effects: EffectState): void {
  for (const e of effects.items) {
    const p = mapToLogical(e.pos);
    const ratio = Math.max(0, e.ttl / HIT_EFFECT_DURATION);
    ctx.strokeStyle = `rgba(255, 235, 150, ${ratio})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, UNIT_R + (1 - ratio) * 14, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawTopBar(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.fillStyle = COLORS.bar;
  ctx.fillRect(0, 0, LOGICAL_W, 46);
  ctx.fillStyle = COLORS.text;
  ctx.font = '20px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(`とりで ${state.fortHp} / ${FORT_MAX_HP}`, 16, 23);
  ctx.fillText(`なみ ${state.waveIndex + 1} / ${state.stage.waves.length}`, 280, 23);
  ctx.fillText(state.stage.name, 500, 23);
}
