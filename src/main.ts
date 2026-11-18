import { imageUrls, loadRegistry } from './engine/loader';
import { makeImageCache } from './render/images';
import { lookupDef, skillParam } from './engine/registry';
import { completeRecruit } from './core/events';
import { MAX_PARTY } from './core/constants';
import { pickDialogue, pickRecruitTalk, pickStageIntro, pickStageOutro } from './core/dialogue';
import { SKILL_EFFECT_IDS } from './core/skills';
import { beginBattle, canPlaceAt, createBattleState, placeUnit, rebuildForSortie, statsForLevel } from './core/state';
import { canChooseSortie, initialSortie, sortieCandidates, sortieProgress } from './core/sortie';
import { playerUnits, step } from './core/sim';
import type { SimCommand } from './core/sim';
import { UNIT_R, drawBattle, drawDebugOverlay, drawDragPreview } from './render/draw';
import { bodyCenter } from './render/sprites';
import { escortDefIds } from './render/objectives-view';
import { resolveMoveDest } from './core/field';
import {
  cancelDash, makeEffectState, resetEffects, spawnEffects, syncDisplayedHp, tickEffects,
} from './render/effects';
import { makeAnimStore, noteAttacks, resetAnim, updateMotion } from './render/anim';
import { LOGICAL_H, LOGICAL_W, computeViewport, fitCanvas, logicalToMap, screenToLogical } from './render/viewport';
import { debugKey, debugLabel, isDebugMode, makeDebugClock, simDt } from './ui/debug';
import { clearSpeech, makeSpeechState, pushSpeech, tickSpeech } from './ui/speech';
import {
  clearFallen, currentBanner, makeFallenState, noteFallen, tickFallen, timeScale,
} from './ui/fallen';
import { applyStageClear, canSkipIntro, markIntroRead } from './ui/flow';
import { hitRect, pickUnit } from './ui/hit';
import { resolveMapGesture } from './ui/input';
import type { PointerStart } from './ui/input';
import {
  BOTTOM_PANEL_Y, BTN, MESSAGE_BAR, SORTIE_BTN, START_BTN, STAGE_LIST_VIEW, TALK_BODY_X, TALK_FONT, TALK_MAX_LINES,
  TALK_PAD, TALK_WINDOW, portraitSlot, resultSlot, rosterSlot, stageListContentH,
} from './ui/layout';
import { clampScroll, isTap, maxScroll } from './ui/scroll';
import { drawEnemyList, drawSortieList, drawStatCard } from './ui/card-view';
import { applySortieToggle, closeOverlay, overlayTap } from './ui/overlay';
import type { Overlay, SortieOverlay } from './ui/overlay';
import { stageTapTarget } from './ui/select-tap';
import { allyCardFromSave, cardFromDef, cardFromGain, cardFromUnit, enemyCard, stageEnemies } from './ui/stat-card';
import type { StatCard } from './ui/stat-card';
import type { StageDef } from './engine/schema';
import { levelUpCard, mergeLevelUps } from './ui/levelup';
import type { LevelUpEvent } from './ui/levelup';
import { partyIds } from './core/party';
import {
  drawBottomBar, drawDefeat, drawLoadErrors, drawPlacement, drawResult,
  drawFallenBanner, drawSpeechBar, drawStageSelect, drawTalk, drawTitle,
} from './ui/screens';
import { advanceTalk, makeTalkState, skipTalk, tickTalk } from './ui/talk';
import type { Measure, TalkState } from './ui/talk';
import { loadSave, newSave, writeSave } from './save/save';
import type { SaveData } from './save/save';
import type { XpGain } from './ui/flow';
import type { BattleState, Unit, Vec2 } from './core/types';

const FIXED_DT = 1 / 60;

type Phase =
  | 'title' | 'select' | 'talk' | 'placement' | 'battle' | 'levelup' | 'event' | 'outro' | 'result' | 'defeat';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const stageBox = document.getElementById('stage') as HTMLElement;
const ctx = canvas.getContext('2d')!;

function resize(): void {
  const box = stageBox.getBoundingClientRect();
  const fit = fitCanvas(box.width, box.height, window.devicePixelRatio);
  canvas.style.width = `${fit.cssW}px`;
  canvas.style.height = `${fit.cssH}px`;
  // 当てたあとの実寸から backing store を決める。CSS が何らかの制約を効かせても、
  // 描画と入力が同じ実寸を見ているかぎりクリック位置はずれない
  const actual = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(actual.width * window.devicePixelRatio));
  canvas.height = Math.max(1, Math.round(actual.height * window.devicePixelRatio));
  // width への代入でコンテキストの状態が全部リセットされるので、ここで毎回入れ直す
  ctx.imageSmoothingEnabled = false;
}
// window の resize ではブラウザズームによる devicePixelRatio の変化を拾えない
new ResizeObserver(resize).observe(stageBox);

/**
 * 要素のサイズが変わらずに devicePixelRatio だけが変わった場合は ResizeObserver が発火しない。
 * resolution のメディアクエリは今の dpr にしか一致しないので、変わるたびに新しい dpr で張り直す
 */
function watchDpr(): void {
  const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  mq.addEventListener('change', () => {
    resize();
    watchDpr();
  }, { once: true });
}
watchDpr();
resize();

const loadResult = loadRegistry(SKILL_EFFECT_IDS);
if (!loadResult.ok) {
  // 部分的に読めたぶんで続行しない。アセットを足したその場で事故に気づけることを優先する
  const vp = computeViewport(canvas.width, canvas.height);
  ctx.setTransform(vp.scale, 0, 0, vp.scale, vp.offsetX, vp.offsetY);
  drawLoadErrors(ctx, loadResult.errors);
  throw new Error(`assets の 読み込みに 失敗: ${loadResult.errors.length} 件`);
}
const registry = loadResult.value;

const loaded = loadSave(window.localStorage, registry);
let save: SaveData = loaded ?? newSave(registry);
let hasSave = loaded !== null;
let phase: Phase = 'title';
let stageIndex = 0;
let stageId = registry.stages[0]!.id;
let battle: BattleState | null = null;
let selected: string | null = null;
let pointerStart: PointerStart | null = null;
/** ドラッグ中の指の位置（マップ座標）。プレビュー描画が読む */
let dragMap: Vec2 | null = null;
/**
 * ステージ選択の縦スクロール。盤面のドラッグ（pointerStart / dragMap）とは
 * 別系統で持つ。1つに混ぜると、フェーズごとに意味の違う値が同じ変数に入って読めなくなる
 */
let stageScrollY = 0;
let stageDrag: { pointerId: number; startY: number; startScrollY: number } | null = null;

function stageScrollMax(): number {
  return maxScroll(stageListContentH(registry.stages.length), STAGE_LIST_VIEW.h);
}

/** 札や敵の一覧を重ねているとき。重ねている間は、下の画面に入力が届かない */
let overlay: Overlay | null = null;
/** 戦闘を止めて札を出す順番待ちのレベルアップ。先頭から 1 人ずつ出す */
let levelUps: LevelUpEvent[] = [];

/**
 * 重ねる物を開く。開いたとき、進行中のドラッグ（ステージ一覧のスクロール・マップの操作）は終える。
 * 終えないと、別の指で押した下で、最初の指のドラッグが動き続ける。重ねる物を開くところはすべてここを通す
 */
function openOverlay(o: Overlay): void {
  overlay = o;
  stageDrag = null;
  pointerStart = null;
  dragMap = null;
}

/** 出撃の一覧の枠に出す名前。定義が無い id は id のまま */
function unitName(id: string): string {
  return lookupDef(registry, id)?.name ?? id;
}

/** 出撃の一覧の「強さ」で開くカード。出撃の候補の今の進行（レベル・能力の加算）から出す */
function sortieCard(stage: StageDef, id: string): StatCard {
  const def = registry.units.get(id)!;
  const p = sortieProgress(stage, save, id);
  return { ...cardFromDef(registry, id, statsForLevel(def, p.level, p.bonus)), level: p.level };
}

/** 「決める」。選んだ内容が今の場と同じなら閉じるだけ。違えば、選んだ内容で戦いの状態を作り直す */
function decideSortie(o: SortieOverlay): void {
  if (!battle) return;
  const onField = battle.units.filter((u) => u.side === 'player');
  const same = onField.length === o.chosen.length && onField.every((u) => o.chosen.includes(u.defId));
  if (!same) {
    const kept = new Map<string, Vec2>(onField.map((u) => [u.defId, { ...u.pos }]));
    battle = rebuildForSortie(registry, o.stage, save, stageSeed, o.chosen, kept);
    selected = null;
  }
  overlay = null;
}

/** 重ねている物の上を押したときの処理 */
function tapOverlay(p: Vec2): void {
  if (!overlay) return;
  const t = overlayTap(overlay, p);
  if (t.type === 'close') overlay = closeOverlay(overlay);
  else if (t.type === 'open') openOverlay({ kind: 'card', card: t.card, back: overlay });
  else if (overlay.kind === 'sortie') {
    if (t.type === 'toggle') overlay = applySortieToggle(overlay, t.id, unitName);
    else if (t.type === 'strength') openOverlay({ kind: 'card', card: sortieCard(overlay.stage, t.id), back: overlay });
    else if (t.type === 'decide') decideSortie(overlay);
  }
}

function drawOverlay(): void {
  if (!overlay) return;
  if (overlay.kind === 'card') drawStatCard(ctx, registry, overlay.card, images, '閉じる');
  else if (overlay.kind === 'sortie') {
    const stage = overlay.stage;
    drawSortieList(ctx, registry, overlay, (id) => sortieProgress(stage, save, id).level, images);
  } else drawEnemyList(ctx, registry, overlay, images);
}

/** 選択画面に入るたびに一番上へ戻す */
function toStageSelect(): void {
  stageScrollY = 0;
  overlay = null;
  stageDrag = null;
  phase = 'select';
}

let pendingSkill: string | null = null;
let result: { gains: XpGain[] } | null = null;
/** 護衛対象の defId。beginStage で1度だけ作る */
let escorts: Set<string> = new Set();
const speech = makeSpeechState();
let talk: TalkState | null = null;
/** 会話の文字幅測定。ctx を閉じ込めるので talk.ts 側は Canvas を知らない */
const talkMeasure: Measure = (t) => {
  ctx.save();
  ctx.font = TALK_FONT;
  const w = ctx.measureText(t).width;
  ctx.restore();
  return w;
};
const talkMaxWidth = TALK_WINDOW.w - TALK_BODY_X - TALK_PAD;
const effects = makeEffectState();
const fallen = makeFallenState();
const anim = makeAnimStore();

/** 攻撃モーションの長さ。シートを持たないユニットは null */
function attackDuration(defId: string): number | null {
  const def = lookupDef(registry, defId);
  const sheet = def?.sprites.map;
  if (!sheet) return null;
  return sheet.attack.frames / sheet.attack.fps;
}
/** タップの判定に使う絵の中心（マップ座標）。足元より下の何も無い所で掴めないようにする */
function unitBody(u: Unit): Vec2 {
  const def = lookupDef(registry, u.defId);
  return def ? bodyCenter(u.pos, def, UNIT_R) : u.pos;
}
const images = makeImageCache(imageUrls());
const commands: SimCommand[] = [];
let accumulator = 0;
let lastTime = performance.now();

/** ?debug のときだけ、戦闘中の一時停止・コマ送り・スロー再生を効かせる（攻撃コマの確認用） */
const debugMode = isDebugMode(window.location.search);
const debugClock = makeDebugClock();
if (debugMode) {
  window.addEventListener('keydown', (ev) => {
    if (debugKey(debugClock, ev.key, ev.repeat)) ev.preventDefault();
  });
}

function toLogical(ev: PointerEvent): Vec2 {
  const rect = canvas.getBoundingClientRect();
  const vp = computeViewport(rect.width, rect.height);
  return screenToLogical(vp, ev.clientX - rect.left, ev.clientY - rect.top);
}

/** beginStage で決めた乱数の種。出撃を選び直して状態を作り直すときに使い直す */
let stageSeed = 0;
/** 「始める」を押したときの出撃と置き場所。負けて挑み直すとき、同じ出撃・同じ置き場所で始める */
let retryStart: { stageId: string; sortie: string[]; positions: Map<string, Vec2> } | null = null;

function beginStage(index: number, retry: boolean): void {
  const stage = registry.stages[index]!;
  stageIndex = index;
  stageId = stage.id;
  stageSeed = Date.now() % 100000;
  battle = retry && retryStart !== null && retryStart.stageId === stage.id
    ? rebuildForSortie(registry, stage, save, stageSeed, retryStart.sortie, retryStart.positions)
    : createBattleState(registry, stage, save, stageSeed, initialSortie(registry, stage, save.members, save.sortie));
  escorts = new Set(escortDefIds(battle.stage));
  levelUps = [];
  overlay = null;
  selected = null;
  pendingSkill = null;
  clearSpeech(speech);
  resetEffects(effects);
  clearFallen(fallen);
  resetAnim(anim);
  pointerStart = null;
  dragMap = null;
  commands.length = 0;
  accumulator = 0;
  talk = makeTalkState(
    pickStageIntro(registry, battle.stage, save.members), talkMeasure, talkMaxWidth, TALK_MAX_LINES,
  );
  phase = talk.done ? 'placement' : 'talk';
}

/** 会話フェーズを終える。読み切った記録を残してから配置へ移る */
function endTalk(): void {
  const next = markIntroRead(save, stageId);
  if (next !== save) {
    save = next;
    hasSave = writeSave(window.localStorage, save) || hasSave;
  }
  phase = 'placement';
}

/** 加入の会話を終える。仲間を足して戦闘へ戻る */
function endRecruitTalk(state: BattleState): void {
  completeRecruit(state);
  talk = null;
  phase = 'battle';
}

/** 勝利の後始末。会話があってもなくても、必ずここを1度だけ通す */
function finishStage(state: BattleState): void {
  const r = applyStageClear(registry, save, stageId, state);
  save = r.save;
  hasSave = writeSave(window.localStorage, save) || hasSave;
  result = { gains: r.gains };
  phase = 'result';
}

function onPointerDown(ev: PointerEvent): void {
  const p = toLogical(ev);

  switch (phase) {
    case 'title':
      if (hitRect(BTN.titleNew, p)) {
        save = newSave(registry);
        hasSave = writeSave(window.localStorage, save) || hasSave;
        toStageSelect();
      } else if (hasSave && hitRect(BTN.titleContinue, p)) {
        toStageSelect();
      }
      return;

    case 'select': {
      if (overlay) {
        tapOverlay(p);
        return;
      }
      const ids = partyIds(registry, save.members);
      for (let i = 0; i < ids.length; i++) {
        if (hitRect(rosterSlot(i), p)) {
          openOverlay({ kind: 'card', card: allyCardFromSave(registry, save, ids[i]!), back: null });
          return;
        }
      }
      if (hitRect(STAGE_LIST_VIEW, p)) {
        stageDrag = { pointerId: ev.pointerId, startY: p.y, startScrollY: stageScrollY };
        canvas.setPointerCapture(ev.pointerId);
      }
      return;
    }

    case 'talk': {
      if (!talk) return;
      if (battle && canSkipIntro(save, battle.stage) && hitRect(BTN.skip, p)) skipTalk(talk);
      else advanceTalk(talk, talkMeasure, talkMaxWidth, TALK_MAX_LINES);
      if (talk.done) endTalk();
      return;
    }

    case 'levelup':
      // どこを押しても札を 1 枚閉じる。全部閉じたら戦闘に戻る（加入の会話・勝利の会話は次の update で判定する）
      levelUps.shift();
      if (levelUps.length === 0) phase = 'battle';
      return;

    case 'event': {
      // 加入の会話。「飛ばす」は無く、タップは必ず 1 行進むだけ
      if (!talk || !battle) return;
      advanceTalk(talk, talkMeasure, talkMaxWidth, TALK_MAX_LINES);
      if (talk.done) endRecruitTalk(battle);
      return;
    }

    case 'outro': {
      if (!talk || !battle) return;
      // クリア済みのステージ（2周目以降）だけ「とばす」を出す
      if (save.clearedStageIds.includes(stageId) && hitRect(BTN.skip, p)) skipTalk(talk);
      else advanceTalk(talk, talkMeasure, talkMaxWidth, TALK_MAX_LINES);
      if (talk.done) finishStage(battle);
      return;
    }

    case 'placement': {
      if (!battle) return;
      if (overlay) {
        tapOverlay(p);
        return;
      }
      const candidates = sortieCandidates(registry, battle.stage, save.members);
      const canChoose = canChooseSortie(candidates);
      if (canChoose && hitRect(SORTIE_BTN, p)) {
        const chosen = battle.units.filter((u) => u.side === 'player').map((u) => u.defId);
        openOverlay({ kind: 'sortie', stage: battle.stage, candidates, chosen, message: null });
        return;
      }
      if (hitRect(canChoose ? START_BTN : MESSAGE_BAR, p)) {
        pointerStart = null;
        // 今の出撃を前回の出撃としてセーブに残し、挑み直しのために出撃と置き場所も覚える
        const players = battle.units.filter((u) => u.side === 'player');
        const sortie = players.map((u) => u.defId);
        save = { ...save, sortie };
        retryStart = { stageId, sortie, positions: new Map(players.map((u) => [u.defId, { ...u.pos }])) };
        writeSave(window.localStorage, save); // ステージ開始時点を保存する
        beginBattle(battle);
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
        commands.push({ type: 'skill', uid: pendingSkill, dest: logicalToMap(p) });
        pendingSkill = null;
        return;
      }
      beginMapPointer(battle, p, ev);
      return;
    }

    case 'result': {
      if (overlay) {
        tapOverlay(p);
        return;
      }
      if (hitRect(BTN.next, p)) {
        toStageSelect();
        return;
      }
      // レベルアップした行を押すと、上がった能力の札が開く
      const gains = result?.gains.slice(0, MAX_PARTY) ?? [];
      for (let i = 0; i < gains.length; i++) {
        const g = gains[i]!;
        if (g.leveledUp && !g.joined && hitRect(resultSlot(i), p)) {
          openOverlay({ kind: 'card', card: cardFromGain(registry, g), back: null });
          return;
        }
      }
      return;
    }

    case 'defeat':
      if (hitRect(BTN.retry, p)) beginStage(stageIndex, true);
      else if (hitRect(BTN.toSelect, p)) toStageSelect();
      return;
  }
}

function beginMapPointer(state: BattleState, p: Vec2, ev: PointerEvent): void {
  if (pointerStart !== null) return; // 別の指のジェスチャが進行中は新しいジェスチャを始めない
  // drawBottomBar と同じ無フィルタ配列でインデックスを解決する。playerUnits() は retired を
  // 除外して再インデックスするため、これと混ぜるとポートレートの見た目とタップ対象がずれる
  const portraitUnits = state.units.filter((u) => u.side === 'player').slice(0, MAX_PARTY);
  for (let i = 0; i < MAX_PARTY; i++) {
    if (!hitRect(portraitSlot(i), p)) continue;
    pointerStart = null;
    const unit = portraitUnits[i];
    if (!unit || unit.retired) return;
    if (phase === 'placement') {
      // 配置の場面の顔の枠は、強さを見る札を開く（選ぶ・動かすのはマップ上の仲間を押す）
      openOverlay({ kind: 'card', card: cardFromUnit(registry, unit, null), back: null });
      return;
    }
    // ポートレートのタップは「選択して必殺技を出す」。選択の解除はマップ上の再タップで行う
    selected = unit.uid;
    if (phase !== 'battle') return;
    if (unit.skillId === null || state.time < unit.skillCooldownUntil) return;
    if (skillParam(state.reg, unit.skillId, 'needsDest', 0) === 1) pendingSkill = unit.uid;
    else commands.push({ type: 'skill', uid: unit.uid });
    return;
  }
  // 下パネルのタップはマップ操作に落とさない。マップの外を移動先に解釈させない
  if (p.y >= BOTTOM_PANEL_Y) {
    pointerStart = null;
    return;
  }
  const startMap = logicalToMap(p);
  const uid = pickUnit(playerUnits(state), startMap, undefined, unitBody);
  if (uid === null && phase === 'placement') {
    // 仲間に当たらず敵に当たったら、その敵の札を開く（敵は置ける範囲の外にいるので、移動の操作とぶつからない）
    const enemyUid = pickUnit(state.units.filter((e) => e.side === 'enemy'), startMap, undefined, unitBody);
    const enemy = state.units.find((u) => u.uid === enemyUid);
    if (enemy) {
      const name = lookupDef(registry, enemy.defId)?.name;
      const count = stageEnemies(registry, state.stage).find((e) => e.name === name)?.count ?? 1;
      openOverlay({ kind: 'card', card: cardFromUnit(registry, enemy, count), back: null });
      return;
    }
  }
  pointerStart = {
    uid,
    startMap,
    wasSelected: uid !== null && selected === uid,
    pointerId: ev.pointerId,
  };
  dragMap = startMap;
  canvas.setPointerCapture(ev.pointerId);
  if (uid !== null) {
    selected = uid; // 掴んだ時点で見た目に反映する。解除は pointerup で判定する
  }
}

function onPointerMove(ev: PointerEvent): void {
  if (stageDrag && ev.pointerId === stageDrag.pointerId) {
    const dy = toLogical(ev).y - stageDrag.startY;
    stageScrollY = clampScroll(stageDrag.startScrollY - dy, stageScrollMax());
    return;
  }
  if (!pointerStart || ev.pointerId !== pointerStart.pointerId) return;
  dragMap = logicalToMap(toLogical(ev));
}

function onPointerUp(ev: PointerEvent): void {
  if (stageDrag && ev.pointerId === stageDrag.pointerId) {
    const start = stageDrag;
    stageDrag = null;
    const p = toLogical(ev);
    // 指がほとんど動いていなければ選んだとみなす。動いていればスクロールだった
    if (phase === 'select' && !overlay && isTap(p.y - start.startY)) {
      const target = stageTapTarget(registry, save, { x: p.x, y: p.y + stageScrollY });
      if (target.type === 'stage') {
        beginStage(target.index, false);
      } else if (target.type === 'enemies') {
        const stage = registry.stages[target.index]!;
        const enemies = stageEnemies(registry, stage);
        openOverlay({
          kind: 'enemies', title: stage.name, enemies,
          cards: enemies.map((e) => enemyCard(registry, e.defId, e.count, stage.enemyLevel)),
        });
      }
    }
    return;
  }
  if (!pointerStart || ev.pointerId !== pointerStart.pointerId) return;
  const start = pointerStart;
  pointerStart = null;
  dragMap = null;
  if (!battle) return;
  if (phase !== 'placement' && phase !== 'battle') return;

  const endMap = logicalToMap(toLogical(ev));
  const g = resolveMapGesture(start, endMap, selected);
  switch (g.type) {
    case 'select':
      selected = g.uid;
      return;
    case 'deselect':
      selected = null;
      return;
    case 'moveUnit':
      if (phase === 'battle') {
        commands.push({ type: 'move', uid: g.uid, dest: g.dest });
        cancelDash(effects, g.uid);
      }
      else placeUnit(battle, g.uid, g.dest);
      return;
    case 'none':
      return;
  }
}

function onPointerCancel(ev: PointerEvent): void {
  if (stageDrag && ev.pointerId === stageDrag.pointerId) {
    stageDrag = null;
    return;
  }
  if (!pointerStart || ev.pointerId !== pointerStart.pointerId) return;
  pointerStart = null;
  dragMap = null;
}

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerup', onPointerUp);
canvas.addEventListener('pointercancel', onPointerCancel);

function update(realDt: number): void {
  // 一時停止とスロー再生は戦闘中だけ。会話や画面遷移まで止めると操作できなくなる
  const base = debugMode && phase === 'battle' ? simDt(debugClock, realDt, FIXED_DT) : realDt;
  // 仲間が倒れた間は画面の時間をゆっくりにする（帯の長さは実時間で数える）
  const dt = phase === 'battle' ? base * timeScale(fallen) : base;
  tickEffects(effects, dt);
  if ((phase === 'talk' || phase === 'outro' || phase === 'event') && talk) {
    tickTalk(talk, dt);
    return;
  }
  if (phase !== 'battle' || !battle) return;
  syncDisplayedHp(effects, battle.units, dt);
  tickSpeech(speech, dt);
  tickFallen(fallen, realDt);

  accumulator += dt;
  while (accumulator >= FIXED_DT) {
    accumulator -= FIXED_DT;
    const batch = commands.splice(0, commands.length);
    step(battle, batch, FIXED_DT);
    spawnEffects(effects, battle.events);
    noteFallen(fallen, battle.reg, battle.events);
    noteAttacks(anim, battle.events, battle.time, attackDuration);
    pushSpeech(speech, pickDialogue(battle.reg, battle.events));
    levelUps = mergeLevelUps(levelUps, battle.events);
    if (levelUps.length > 0) break; // レベルアップの札を出す間は戦闘を止める
    if (battle.pendingRecruit !== null) break; // 加入の会話の間は戦闘を止める
  }
  if (levelUps.length > 0) {
    // 札を出し終えてから、加入の会話・勝利の会話に入る（battle の状態は止まったまま残る）
    accumulator = 0;
    pendingSkill = null; // 札のあとに、前のタップで構えた必殺技が勝手に出ないようにする
    pointerStart = null;
    dragMap = null;
    clearSpeech(speech);
    resetAnim(anim);
    phase = 'levelup';
    return;
  }
  if (battle.pendingRecruit !== null) {
    accumulator = 0;
    pendingSkill = null; // 会話のあとに、前のタップで構えた必殺技が勝手に出ないようにする
    clearSpeech(speech);
    resetAnim(anim);
    talk = makeTalkState(
      pickRecruitTalk(registry, battle.pendingRecruit.recruit), talkMeasure, talkMaxWidth, TALK_MAX_LINES,
    );
    if (talk.done) endRecruitTalk(battle);
    else phase = 'event';
    return;
  }
  updateMotion(anim, battle.units, battle.time);

  if (battle.phase === 'defeat') {
    phase = 'defeat';
  } else if (battle.phase === 'victory') {
    clearSpeech(speech);   // 会話の邪魔になるので消す。時間は止まっている
    talk = makeTalkState(
      pickStageOutro(registry, battle.stage), talkMeasure, talkMaxWidth, TALK_MAX_LINES,
    );
    if (talk.done) finishStage(battle);
    else {
      // battle.time は勝利で止まる。anim を持ち越すと最後の攻撃者が
      // 攻撃コマのまま固まって見えるので、アウトロ開始時にクリアする
      resetAnim(anim);
      phase = 'outro';
    }
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
      drawStageSelect(ctx, registry, save, images, stageScrollY);
      drawOverlay();
      break;
    case 'talk':
      if (battle && talk) {
        drawBattle(ctx, registry, battle, null, effects, escorts, images, anim);
        drawTalk(ctx, registry, talk, canSkipIntro(save, battle.stage), images);
      }
      break;
    case 'outro':
      if (battle && talk) {
        drawBattle(ctx, registry, battle, null, effects, escorts, images, anim);
        drawTalk(ctx, registry, talk, save.clearedStageIds.includes(stageId), images);
      }
      break;
    case 'event':
      if (battle && talk) {
        drawBattle(ctx, registry, battle, null, effects, escorts, images, anim);
        drawTalk(ctx, registry, talk, false, images);
      }
      break;
    case 'placement':
      if (battle) {
        drawBattle(ctx, registry, battle, selected, effects, escorts, images, anim);
        drawBottomBar(ctx, registry, battle, selected, escorts, images);
        drawPlacement(ctx, battle, canChooseSortie(sortieCandidates(registry, battle.stage, save.members)));
        drawOverlay();
      }
      break;
    case 'levelup':
      if (battle && levelUps[0]) {
        drawBattle(ctx, registry, battle, null, effects, escorts, images, anim);
        drawBottomBar(ctx, registry, battle, null, escorts, images);
        drawStatCard(ctx, registry, levelUpCard(registry, levelUps[0]), images, '戦闘に 戻る');
      }
      break;
    case 'battle':
      if (battle) {
        drawBattle(ctx, registry, battle, selected, effects, escorts, images, anim);
        drawBottomBar(ctx, registry, battle, selected, escorts, images);
        if (debugMode) drawDebugOverlay(ctx, registry, battle, anim, debugLabel(debugClock));
        if (speech.current !== null) drawSpeechBar(ctx, registry, speech.current, images);
        const banner = currentBanner(fallen);
        if (banner !== null) drawFallenBanner(ctx, registry, banner, images);
      }
      break;
    case 'result':
      if (result) drawResult(ctx, registry, result.gains, images);
      drawOverlay();
      break;
    case 'defeat':
      drawDefeat(ctx);
      break;
  }

  const dragUid = pointerStart?.uid ?? null;
  const dragPhaseOk = phase === 'placement' || phase === 'battle';
  if (battle && dragPhaseOk && dragUid !== null && dragMap !== null) {
    const unit = battle.units.find((u) => u.uid === dragUid)!;
    if (phase === 'placement') {
      const blocked = !canPlaceAt(battle.stage, battle.grid, dragMap);
      drawDragPreview(ctx, registry, unit.pos, dragMap, unit.defId, blocked, images);
    } else {
      // 戦闘中は、歩けない場所でも最寄りの歩けるマスへ置き換えて進む。離したときの行き先を見せる
      const dest = resolveMoveDest(battle.grid, unit.pos, dragMap);
      drawDragPreview(ctx, registry, unit.pos, dest ?? dragMap, unit.defId, dest === null, images);
    }
  }
}

function loop(now: number): void {
  const dt = Math.min(0.25, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
