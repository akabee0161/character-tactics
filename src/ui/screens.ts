import { lookupDef, skillParam } from '../engine/registry';
import { MAX_PARTY } from '../core/constants';
import { partyIds } from '../core/party';
import { DEFAULT_SKILL_COOLDOWN } from '../core/skills';
import type { ImageCache } from '../render/images';
import { drawFace, drawRoleBadge } from '../render/sprites';
import { BUFF_COLOR, activeBuffs, drawUpTriangle } from '../render/buff-marks';
import { readyGlowAlpha } from '../render/effects';
import { LOGICAL_H, LOGICAL_W, mapToLogical } from '../render/viewport';
import {
  BOTTOM_PANEL_Y, BTN, FACE_PX, MESSAGE_BAR, SPEECH_BODY_X, SPEECH_FONT_PX, SPEECH_LINE_H,
  SPEECH_MAX_LINES, STAGE_LIST_VIEW, TALK_BODY_X, TALK_FONT, TALK_LINE_H, TALK_PAD, TALK_WINDOW,
  enemyBtnIn, hpBarIn, portraitSlot, resultSlot, roleBadgeIn, rosterSlot, speechLines, stageListContentH, stageSlot,
} from './layout';
import { currentSpeaker, pageCount, visibleLines } from './talk';
import { isStageUnlocked } from './flow';
import { maxScroll } from './scroll';
import { resultLine } from './result-text';
import { KIND_COLOR, KIND_LABEL } from './stat-card';
import type { Speech } from './speech';
import type { TalkState } from './talk';
import type { XpGain } from './flow';
import type { Registry } from '../engine/registry';
import type { ValidationError } from '../engine/schema';
import type { SaveData } from '../save/save';
import type { BattleState } from '../core/types';
import type { Rect } from './hit';

const INK = '#f2efe4';
const PANEL = 'rgba(16, 24, 32, 0.88)';
const FALLBACK_DEF = { name: '', color: '#888888', role: '', sprites: { role: null, face: null, map: null } };

export function panel(ctx: CanvasRenderingContext2D, r: Rect, fill = PANEL): void {
  ctx.fillStyle = fill;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
}

/**
 * primary は主要な導線のボタン。有効な暗い紺（#2c4a63）と無効な暗い灰（#2a2f35）は
 * 並べないと区別がつかず、「押せないボタン」に見えてしまうため、押してほしいボタンは
 * アクセント色で塗る
 */
export function button(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  label: string,
  enabled = true,
  primary = false,
): void {
  const fill = !enabled ? '#2a2f35' : primary ? '#ffd479' : '#2c4a63';
  panel(ctx, r, fill);
  ctx.fillStyle = !enabled ? '#78808a' : primary ? '#1a1a1a' : INK;
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function clear(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#101820';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
}

export function drawTitle(ctx: CanvasRenderingContext2D, hasSave: boolean): void {
  clear(ctx);
  ctx.fillStyle = INK;
  ctx.font = '40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('砦の 仲間たち', LOGICAL_W / 2, 260);
  ctx.font = '22px sans-serif';
  ctx.fillText('仲間と ともに', LOGICAL_W / 2, 320);
  ctx.fillText('敵の 本拠地へ 攻めこもう', LOGICAL_W / 2, 352);
  ctx.textAlign = 'left';
  button(ctx, BTN.titleNew, '最初から', true, true);
  button(ctx, BTN.titleContinue, '続きから', hasSave);
}

export function drawStageSelect(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  save: SaveData,
  images: ImageCache,
  scrollY: number,
): void {
  clear(ctx);
  ctx.fillStyle = INK;
  ctx.font = '30px sans-serif';
  ctx.fillText('どの ステージに 行く？', 40, 100);

  const v = STAGE_LIST_VIEW;
  ctx.save();
  ctx.beginPath();
  ctx.rect(v.x, v.y, v.w, v.h);
  ctx.clip();
  ctx.translate(0, -scrollY);

  reg.stages.forEach((stage, i) => {
    const r = stageSlot(i);
    const unlocked = isStageUnlocked(reg, save, i);
    panel(ctx, r, unlocked ? '#2c4a63' : '#2a2f35');
    ctx.fillStyle = unlocked ? INK : '#78808a';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(unlocked ? stage.name : 'まだ 行けない', r.x + r.w / 2, unlocked ? r.y + 46 : r.y + 70, r.w - 16);
    if (unlocked) {
      if (save.clearedStageIds.includes(stage.id)) {
        ctx.fillStyle = '#ffd479';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('クリア済み', r.x + r.w - 10, r.y + 20);
        ctx.textAlign = 'center';
      }
      const b = enemyBtnIn(r);
      panel(ctx, b, '#1c3144');
      ctx.fillStyle = INK;
      ctx.font = '18px sans-serif';
      ctx.fillText('敵を 見る', b.x + b.w / 2, b.y + 24);
    }
    ctx.textAlign = 'left';
  });

  ctx.restore();
  drawScrollBar(ctx, reg.stages.length, scrollY);
  drawRoster(ctx, reg, save, images);
}

/**
 * まだ下に続きがあることを見せる。出さないと、画面に収まっている数が
 * 全部だと思われる。収まりきっているときは出さない
 */
function drawScrollBar(ctx: CanvasRenderingContext2D, count: number, scrollY: number): void {
  const v = STAGE_LIST_VIEW;
  const max = maxScroll(stageListContentH(count), v.h);
  if (max <= 0) return;

  const trackX = v.x + v.w - 10;
  const thumbH = Math.max(40, (v.h * v.h) / stageListContentH(count));
  const thumbY = v.y + (v.h - thumbH) * (scrollY / max);
  ctx.fillStyle = 'rgba(242, 239, 228, 0.18)';
  ctx.fillRect(trackX, v.y, 4, v.h);
  ctx.fillStyle = 'rgba(242, 239, 228, 0.55)';
  ctx.fillRect(trackX, thumbY, 4, thumbH);
}

function drawRoster(
  ctx: CanvasRenderingContext2D, reg: Registry, save: SaveData, images: ImageCache,
): void {
  const ids = partyIds(reg, save.members);
  ctx.fillStyle = INK;
  ctx.font = '18px sans-serif';
  ctx.fillText(`仲間 ${ids.length}人（押すと 強さが 見られる）`, 14, rosterSlot(0).y - 10);
  ids.forEach((id, i) => {
    const r = rosterSlot(i);
    panel(ctx, r, '#18222c');
    const def = reg.units.get(id)!;
    drawFace(ctx, { x: r.x + 24, y: r.y + r.h / 2 }, FACE_PX.small / 2, def, images);
    ctx.fillStyle = INK;
    ctx.font = '16px sans-serif';
    // 列が狭いので、はみ出す分は maxWidth で縮める
    ctx.fillText(def.name, r.x + 46, r.y + 22, r.w - 46 - 40);
    ctx.fillStyle = '#9fb3c4';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Lv${save.units[id]!.level}`, r.x + 46, r.y + 42);
    // 攻撃の種類の印（枠で囲んだ小さな文字）
    const kind = KIND_LABEL[def.attack];
    ctx.font = '12px sans-serif';
    const tag = { x: r.x + r.w - 38, y: r.y + 8, w: 30, h: 16 };
    ctx.strokeStyle = KIND_COLOR[def.attack];
    ctx.lineWidth = 1;
    ctx.strokeRect(tag.x + 0.5, tag.y + 0.5, tag.w - 1, tag.h - 1);
    ctx.fillStyle = KIND_COLOR[def.attack];
    ctx.textAlign = 'center';
    ctx.fillText(kind, tag.x + tag.w / 2, tag.y + 12);
    ctx.textAlign = 'left';
  });
}

export function drawPlacement(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.fillStyle = 'rgba(16, 24, 32, 0.35)';
  ctx.fillRect(0, 0, LOGICAL_W, BOTTOM_PANEL_Y);

  // 置ける範囲を見せる。境界の線より下が置ける側
  const edgeY = mapToLogical({ x: 0, y: state.stage.placement.minY }).y;
  ctx.fillStyle = 'rgba(255, 212, 121, 0.12)';
  ctx.fillRect(0, edgeY, LOGICAL_W, BOTTOM_PANEL_Y - edgeY);
  ctx.strokeStyle = '#ffd479';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, edgeY);
  ctx.lineTo(LOGICAL_W, edgeY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = INK;
  ctx.font = '20px sans-serif';
  ctx.fillText('黄色い 線より 下に 仲間を 置こう', 24, 734);
  ctx.fillText('下の 顔や 敵を 押すと 強さが 見られる', 24, 762);
  button(ctx, MESSAGE_BAR, '始める', true, true);
}

export function drawBottomBar(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  state: BattleState,
  selected: string | null,
  escorts: Set<string>,
  images: ImageCache,
): void {
  ctx.fillStyle = 'rgba(16, 24, 32, 0.92)';
  ctx.fillRect(0, BOTTOM_PANEL_Y, LOGICAL_W, LOGICAL_H - BOTTOM_PANEL_Y);

  state.units
    .filter((u) => u.side === 'player')
    .slice(0, MAX_PARTY)
    .forEach((unit, i) => {
      const r = portraitSlot(i);
      panel(ctx, r, selected === unit.uid ? '#3a5f7d' : '#18222c');

      const def = lookupDef(reg, unit.defId) ?? FALLBACK_DEF;
      ctx.globalAlpha = unit.retired ? 0.4 : 1;
      const fh = FACE_PX.panel / 2;
      drawFace(ctx, { x: r.x + 4 + fh, y: r.y + 6 + fh }, fh, def, images);

      drawRoleBadge(ctx, roleBadgeIn(r), def, images);

      if (!unit.retired) {
        // 効いているバフの印。役割アイコンの下に、はげます・結界の順に縦に並べる
        const buffs = activeBuffs(unit, state.time);
        let by = r.y + 34;
        for (const k of ['cheer', 'ward'] as const) {
          if (!buffs[k]) continue;
          drawUpTriangle(ctx, r.x + r.w - 12, by, 10, 9, BUFF_COLOR[k]);
          by += 12;
        }
      }

      const bar = hpBarIn(r);
      ctx.fillStyle = '#000';
      ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
      ctx.fillStyle = unit.retired ? '#666' : '#5ad06a';
      ctx.fillRect(bar.x, bar.y, bar.w * Math.max(0, unit.hp / unit.maxHp), bar.h);

      ctx.globalAlpha = 1;

      if (unit.skillId !== null && !unit.retired) {
        const total = skillParam(reg, unit.skillId, 'cooldown', DEFAULT_SKILL_COOLDOWN);
        const remaining = Math.max(0, unit.skillCooldownUntil - state.time);
        const ratio = total > 0 ? 1 - remaining / total : 1;
        ctx.fillStyle = '#000';
        const gy = bar.y + bar.h + 1;
        ctx.fillRect(bar.x, gy, bar.w, 5);
        ctx.fillStyle = '#ffd479';
        ctx.fillRect(bar.x, gy, bar.w * Math.max(0, Math.min(1, ratio)), 5);

        // 押せば技が出る状態を縁で示す。押せない理由を文字で出す代わり
        // 配置フェーズは全員 time===0 かつクールダウン未消化で「発動可能」に見えてしまうため、戦闘フェーズ限定にする
        if (state.phase === 'battle' && remaining <= 0) {
          ctx.save();
          ctx.globalAlpha = readyGlowAlpha(state.time);
          ctx.strokeStyle = '#ffd479';
          ctx.lineWidth = 4;
          ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
          ctx.restore();
        }
      }

      if (unit.retired) {
        ctx.fillStyle = '#ff9a9a';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('倒れた', r.x + r.w / 2, r.y + r.h - 3);
        ctx.textAlign = 'left';
      }

      if (escorts.has(unit.defId)) {
        ctx.fillStyle = '#ffd479';
        ctx.beginPath();
        // 顔（左上 40px）・クラス（右上）・HP バー（下）に重ならない、顔の右横に置く
        ctx.moveTo(r.x + 53, r.y + 30);
        ctx.lineTo(r.x + 47, r.y + 42);
        ctx.lineTo(r.x + 59, r.y + 42);
        ctx.closePath();
        ctx.fill();
      }
    });
}

/** 戦闘中のセリフ。下パネルの上段に出し、時間は止めない */
export function drawSpeechBar(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  speech: Speech,
  images: ImageCache,
): void {
  const r = MESSAGE_BAR;
  panel(ctx, r, '#f7f3e6');

  const def = lookupDef(reg, speech.defId) ?? FALLBACK_DEF;
  drawFace(ctx, { x: r.x + 36, y: r.y + r.h / 2 }, FACE_PX.large / 2, def, images);

  ctx.fillStyle = '#1a1a1a';
  ctx.font = `${SPEECH_FONT_PX}px sans-serif`;
  const lines = speechLines(speech.text).slice(0, SPEECH_MAX_LINES);
  // 行数によらず縦中央に来るように、上端からの余白を行数から出す
  const top = r.y + (r.h - lines.length * SPEECH_LINE_H) / 2 + SPEECH_FONT_PX * 0.875;
  lines.forEach((line, i) => {
    ctx.fillText(line, r.x + SPEECH_BODY_X, top + i * SPEECH_LINE_H);
  });
}

/** 会話フェーズのウィンドウ。背景のマップは呼び出し側が先に描いておく */
export function drawTalk(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  state: TalkState,
  canSkip: boolean,
  images: ImageCache,
): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  if (canSkip) button(ctx, BTN.skip, '飛ばす');

  const r = TALK_WINDOW;
  panel(ctx, r, '#f7f3e6');

  const speaker = currentSpeaker(state);
  // 地の文は顔の丸も名前も出さず、本文を左端から描く
  const bodyX = r.x + (speaker === null ? TALK_PAD : TALK_BODY_X);

  if (speaker !== null) {
    const info = lookupDef(reg, speaker) ?? { ...FALLBACK_DEF, name: speaker };
    drawFace(ctx, { x: r.x + 54, y: r.y + 60 }, FACE_PX.large / 2, info, images);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '20px sans-serif';
    ctx.fillText(info.name, bodyX, r.y + 34);
  }

  ctx.fillStyle = '#1a1a1a';
  ctx.font = TALK_FONT;
  visibleLines(state).forEach((line, i) => {
    ctx.fillText(line, bodyX, r.y + 74 + i * TALK_LINE_H);
  });

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'right';
  if (pageCount(state) > 1) {
    ctx.fillText(`${state.page + 1} / ${pageCount(state)}`, r.x + r.w - 20, r.y + r.h - 18);
  } else {
    ctx.fillText('タップで 次へ', r.x + r.w - 20, r.y + r.h - 18);
  }
  ctx.textAlign = 'left';
}

export function drawResult(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  gains: XpGain[],
  images: ImageCache,
): void {
  clear(ctx);
  ctx.fillStyle = INK;
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('敵の 本拠地に 到達！', LOGICAL_W / 2, 100);
  ctx.textAlign = 'left';

  ctx.font = '19px sans-serif';
  gains.slice(0, MAX_PARTY).forEach((g, i) => {
    const r = resultSlot(i);
    const def = lookupDef(reg, g.id) ?? { ...FALLBACK_DEF, name: g.id };
    drawFace(ctx, { x: r.x + 20, y: r.y + r.h / 2 }, FACE_PX.small / 2, def, images);
    ctx.fillStyle = INK;
    ctx.font = '19px sans-serif';
    ctx.fillText(def.name, r.x + 44, r.y + 24, r.w - 48);
    ctx.fillStyle = g.joined || g.leveledUp ? '#ffd479' : '#9fb3c4';
    ctx.font = '16px sans-serif';
    // 枠は 240px。長い行は maxWidth で縮めて枠からはみ出さない
    ctx.fillText(resultLine(reg, g), r.x + 44, r.y + 46, r.w - 48 - (g.leveledUp && !g.joined ? 14 : 0));
    if (g.leveledUp && !g.joined) {
      // 押すと札が開く行の印
      ctx.textAlign = 'right';
      ctx.fillText('›', r.x + r.w - 8, r.y + 46);
      ctx.textAlign = 'left';
    }
  });


  button(ctx, BTN.next, '次へ', true, true);
}

export function drawDefeat(ctx: CanvasRenderingContext2D): void {
  clear(ctx);
  ctx.fillStyle = INK;
  ctx.font = '32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('仲間を 守れなかった', LOGICAL_W / 2, 320);
  ctx.textAlign = 'left';
  button(ctx, BTN.retry, 'もう一度', true, true);
  button(ctx, BTN.toSelect, 'ステージを 選ぶ');
}

export function drawLoadErrors(ctx: CanvasRenderingContext2D, errors: ValidationError[]): void {
  clear(ctx);
  ctx.fillStyle = '#ff9a9a';
  ctx.font = '28px sans-serif';
  ctx.fillText('データの 読み込みに 失敗しました', 40, 80);
  ctx.fillStyle = INK;
  ctx.font = '13px monospace';
  errors.slice(0, 20).forEach((e, i) => {
    ctx.fillText(`${e.file} ${e.path}: ${e.reason}`, 40, 130 + i * 20);
  });
  if (errors.length > 20) {
    ctx.fillText(`ほか ${errors.length - 20} 件`, 40, 130 + 20 * 20);
  }
}
