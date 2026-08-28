import { STAGES } from './content/stages';
import { loadRegistry } from './engine/loader';
import { pickDialogue, pickWaveIntro } from './core/dialogue';
import { SKILL_EFFECT_IDS } from './core/skills';
import { createBattleState, placeAlly, startWave } from './core/state';
import { step } from './core/sim';
import type { SimCommand } from './core/sim';
import { drawBattle, drawDragPreview } from './render/draw';
import { isWalkableAt } from './core/field';
import { makeEffectState, spawnHitEffects, tickEffects } from './render/effects';
import { LOGICAL_H, LOGICAL_W, computeViewport, logicalToMap, mapToLogical, screenToLogical } from './render/viewport';
import { advanceBubble, currentBubble, enqueue, isBlocking, makeBubbleQueue } from './ui/bubbles';
import { applyStageClear, isStageUnlocked } from './ui/flow';
import { hitRect, pickAlly } from './ui/hit';
import { resolveMapGesture } from './ui/input';
import type { PointerStart } from './ui/input';
import { BTN, STAGE_BTN, portraitSlot, skillButtonAt } from './ui/layout';
import {
  drawBottomBar, drawBubble, drawDefeat, drawPlacement, drawResult,
  drawSkillButton, drawStageSelect, drawTitle, drawWaveCleared,
} from './ui/screens';
import { loadSave, newSave, writeSave } from './save/save';
import type { SaveData } from './save/save';
import type { XpGain } from './ui/flow';
import type { BattleState, Vec2 } from './core/types';

const FIXED_DT = 1 / 60;

type Phase = 'title' | 'select' | 'placement' | 'battle' | 'waveCleared' | 'result' | 'defeat';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const regResult = loadRegistry(SKILL_EFFECT_IDS);
if (!regResult.ok) {
  throw new Error(
    'assets の よみこみに しっぱい:\n' +
      regResult.errors.map((e) => `  ${e.file} ${e.path}: ${e.reason}`).join('\n'),
  );
}
const registry = regResult.value;

const loaded = loadSave(window.localStorage);
let save: SaveData = loaded ?? newSave();
let hasSave = loaded !== null;
let phase: Phase = 'title';
let stageIndex = 0;
let battle: BattleState | null = null;
let selected: string | null = null;
let pointerStart: PointerStart | null = null;
/** ドラッグ中の指の位置（マップ座標）。プレビュー描画が読む */
let dragMap: Vec2 | null = null;
let pendingSkill: string | null = null;
let result: { gains: XpGain[]; newTitles: string[] } | null = null;
const bubbles = makeBubbleQueue();
const effects = makeEffectState();
const commands: SimCommand[] = [];
let accumulator = 0;
let lastTime = performance.now();

function resize(): void {
  const scale = Math.min(window.innerWidth / LOGICAL_W, window.innerHeight / LOGICAL_H);
  canvas.width = Math.floor(LOGICAL_W * scale * window.devicePixelRatio);
  canvas.height = Math.floor(LOGICAL_H * scale * window.devicePixelRatio);
  canvas.style.width = `${Math.floor(LOGICAL_W * scale)}px`;
  canvas.style.height = `${Math.floor(LOGICAL_H * scale)}px`;
}
window.addEventListener('resize', resize);
resize();

function toLogical(ev: PointerEvent): Vec2 {
  const rect = canvas.getBoundingClientRect();
  const vp = computeViewport(rect.width, rect.height);
  return screenToLogical(vp, ev.clientX - rect.left, ev.clientY - rect.top);
}

function beginStage(index: number): void {
  stageIndex = index;
  battle = createBattleState(registry, STAGES[index]!, save.chars, Date.now() % 100000);
  selected = null;
  pendingSkill = null;
  bubbles.items.length = 0;
  effects.items.length = 0;
  pointerStart = null;
  dragMap = null;
  commands.length = 0;
  accumulator = 0;
  phase = 'placement';
}

function onPointerDown(ev: PointerEvent): void {
  const p = toLogical(ev);

  if (isBlocking(bubbles)) {
    advanceBubble(bubbles);
    return;
  }

  switch (phase) {
    case 'title':
      if (hitRect(BTN.titleNew, p)) {
        save = newSave();
        hasSave = writeSave(window.localStorage, save) || hasSave;
        phase = 'select';
      } else if (hasSave && hitRect(BTN.titleContinue, p)) {
        phase = 'select';
      }
      return;

    case 'select':
      for (let i = 0; i < STAGE_BTN.length; i++) {
        if (hitRect(STAGE_BTN[i]!, p) && isStageUnlocked(save, i)) beginStage(i);
      }
      return;

    case 'placement': {
      if (!battle) return;
      if (hitRect(BTN.start, p)) {
        pointerStart = null;
        writeSave(window.localStorage, save); // ステージ開始時点を保存する
        startWave(battle);
        enqueue(bubbles, pickWaveIntro(battle.reg, battle.stage, battle.waveIndex));
        phase = 'battle';
        return;
      }
      beginMapPointer(battle, p, ev);
      return;
    }

    case 'battle': {
      if (!battle) return;
      if (pendingSkill) {
        pointerStart = null;
        commands.push({ type: 'skill', allyId: pendingSkill, dest: logicalToMap(p) });
        pendingSkill = null;
        return;
      }
      if (selected) {
        const ally = battle.allies.find((a) => a.id === selected)!;
        const canTap = !ally.retired && !ally.skillUsed;
        if (canTap && hitRect(skillButtonAt(mapToLogical(ally.pos)), p)) {
          pointerStart = null;
          if (ally.skill === 'kakenukeru') pendingSkill = selected;
          else commands.push({ type: 'skill', allyId: selected });
          return;
        }
      }
      beginMapPointer(battle, p, ev);
      return;
    }

    case 'waveCleared': {
      if (!battle) return;
      if (hitRect(BTN.next, p)) {
        pointerStart = null;
        battle.waveIndex += 1;
        effects.items.length = 0;
        startWave(battle);
        enqueue(bubbles, pickWaveIntro(battle.reg, battle.stage, battle.waveIndex));
        phase = 'battle';
        return;
      }
      // しゅうげきの あいだは 再配置できる
      beginMapPointer(battle, p, ev);
      return;
    }

    case 'result':
      if (hitRect(BTN.next, p)) phase = 'select';
      return;

    case 'defeat':
      if (hitRect(BTN.retry, p)) beginStage(stageIndex);
      else if (hitRect(BTN.toSelect, p)) phase = 'select';
      return;
  }
}

function beginMapPointer(state: BattleState, p: Vec2, ev: PointerEvent): void {
  if (pointerStart !== null) return; // 別の指のジェスチャが進行中は新しいジェスチャを始めない
  for (let i = 0; i < 4; i++) {
    if (hitRect(portraitSlot(i), p)) {
      const id = state.allies[i]!.id;
      selected = selected === id ? null : id;
      pointerStart = null;
      return;
    }
  }
  const startMap = logicalToMap(p);
  const charId = pickAlly(state.allies, startMap);
  pointerStart = {
    charId,
    startMap,
    wasSelected: charId !== null && selected === charId,
    pointerId: ev.pointerId,
  };
  dragMap = startMap;
  canvas.setPointerCapture(ev.pointerId);
  if (charId !== null) {
    selected = charId; // 掴んだ時点で見た目に反映する。解除は pointerup で判定する
  }
}

function onPointerMove(ev: PointerEvent): void {
  if (!pointerStart || ev.pointerId !== pointerStart.pointerId) return;
  dragMap = logicalToMap(toLogical(ev));
}

function onPointerUp(ev: PointerEvent): void {
  if (!pointerStart || ev.pointerId !== pointerStart.pointerId) return;
  const start = pointerStart;
  pointerStart = null;
  dragMap = null;
  if (!battle) return;
  if (phase !== 'placement' && phase !== 'battle' && phase !== 'waveCleared') return;

  const endMap = logicalToMap(toLogical(ev));
  const g = resolveMapGesture(start, endMap, selected);
  switch (g.type) {
    case 'select':
      selected = g.charId;
      return;
    case 'deselect':
      selected = null;
      return;
    case 'moveChar':
      if (phase === 'battle') commands.push({ type: 'move', allyId: g.charId, dest: g.dest });
      else placeAlly(battle, g.charId, g.dest);
      return;
    case 'none':
      return;
  }
}

function onPointerCancel(ev: PointerEvent): void {
  if (!pointerStart || ev.pointerId !== pointerStart.pointerId) return;
  pointerStart = null;
  dragMap = null;
}

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerup', onPointerUp);
canvas.addEventListener('pointercancel', onPointerCancel);

function update(dt: number): void {
  tickEffects(effects, dt);
  if (phase !== 'battle' || !battle) return;
  if (isBlocking(bubbles)) return; // 吹き出し中は時間が止まる

  accumulator += dt;
  while (accumulator >= FIXED_DT) {
    accumulator -= FIXED_DT;
    const batch = commands.splice(0, commands.length);
    step(battle, batch, FIXED_DT);
    spawnHitEffects(effects, battle.events);
    enqueue(bubbles, pickDialogue(battle.reg, battle.events));
    if (isBlocking(bubbles)) break;
  }

  if (battle.phase === 'defeat') {
    phase = 'defeat';
  } else if (battle.phase === 'waveCleared') {
    phase = 'waveCleared';
  } else if (battle.phase === 'stageCleared') {
    const r = applyStageClear(save, stageIndex, battle.stats);
    save = r.save;
    hasSave = writeSave(window.localStorage, save) || hasSave;
    result = { gains: r.gains, newTitles: r.newTitles };
    phase = 'result';
  }
}

function render(): void {
  const vp = computeViewport(canvas.width, canvas.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(vp.scale, 0, 0, vp.scale, vp.offsetX, vp.offsetY);

  switch (phase) {
    case 'title':
      drawTitle(ctx, hasSave);
      break;
    case 'select':
      drawStageSelect(ctx, save);
      break;
    case 'placement':
      if (battle) {
        drawBattle(ctx, battle, selected, effects);
        drawPlacement(ctx, battle);
        drawBottomBar(ctx, battle, selected);
      }
      break;
    case 'battle':
      if (battle) {
        drawBattle(ctx, battle, selected, effects);
        drawBottomBar(ctx, battle, selected);
        if (selected) drawSkillButton(ctx, battle, selected);
      }
      break;
    case 'waveCleared':
      if (battle) {
        drawBattle(ctx, battle, selected, effects);
        drawBottomBar(ctx, battle, selected);
        drawWaveCleared(ctx, battle);
      }
      break;
    case 'result':
      if (battle && result) drawResult(ctx, battle, result.gains, result.newTitles);
      break;
    case 'defeat':
      drawDefeat(ctx);
      break;
  }

  const dragChar = pointerStart?.charId ?? null;
  const dragPhaseOk = phase === 'placement' || phase === 'battle' || phase === 'waveCleared';
  if (battle && dragPhaseOk && dragChar !== null && dragMap !== null) {
    const ally = battle.allies.find((a) => a.id === dragChar)!;
    const blocked = !isWalkableAt(battle.grid, dragMap);
    drawDragPreview(ctx, ally.pos, dragMap, dragChar, blocked);
  }

  const bubble = currentBubble(bubbles);
  if (bubble) drawBubble(ctx, bubble);
}

function loop(now: number): void {
  const dt = Math.min(0.25, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
