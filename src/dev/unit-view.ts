// 開発用のページ（unit-view.html）。全シートを、ゲームの描画関数で升に並べて描き、シートのコマと画素で照らし合わせる。
// 本番のビルドには入らない（vite build は index.html だけを入れる）。結果は window.__unitView に置く
import { imageUrls, loadRegistry } from '../engine/loader';
import { SKILL_EFFECT_IDS } from '../core/skills';
import { makeImageCache } from '../render/images';
import { FLYING_LIFT, UNIT_R, drawUnitFigure } from '../render/draw';
import { bodyCenter } from '../render/sprites';
import type { SpriteDef } from '../render/sprites';
import type { AnimState, Dir } from '../render/anim';
import { layoutUnitView, pickViewEntries, VIEW_BG, LABEL_H } from './unit-view-layout';
import { compareCell, countCovered, expectedTopLeft } from './unit-view-compare';
import type { Pixels } from './unit-view-compare';

export type UnitViewResult = {
  error: string | null;
  width: number;
  height: number;
  sections: {
    sheet: string;
    defId: string;
    mismatched: { state: AnimState; dir: Dir; col: number; pixels: number }[];
    maxCovered: number;
  }[];
};

declare global {
  interface Window { __unitView?: UnitViewResult }
}

const MAX_WIDTH = 2048;
const BG_CSS = `rgb(${VIEW_BG[0]}, ${VIEW_BG[1]}, ${VIEW_BG[2]})`;

function fail(message: string): UnitViewResult {
  return { error: message, width: 0, height: 0, sections: [] };
}

async function run(): Promise<UnitViewResult> {
  const loaded = loadRegistry(SKILL_EFFECT_IDS);
  if (!loaded.ok) {
    return fail('assets の読み込みに失敗: ' + loaded.errors.map((e) => `${e.file} ${e.path}: ${e.reason}`).join(' / '));
  }
  const reg = loaded.value;

  // 画像は全部読み終わるのを待つ（読み終わる前に描くと丸のプレースホルダが写る）
  const images = makeImageCache(imageUrls());
  for (const [name, img] of images.byName) {
    try {
      await img.decode();
    } catch {
      return fail(`画像を読めない: ${name}`);
    }
  }

  const entries = pickViewEntries(reg);
  const layout = layoutUnitView(entries, MAX_WIDTH);
  const view = document.getElementById('view') as HTMLCanvasElement;
  view.width = layout.width;
  view.height = layout.height;
  view.style.width = `${layout.width}px`;
  view.style.height = `${layout.height}px`;
  const bodies = document.createElement('canvas');
  bodies.width = layout.width;
  bodies.height = layout.height;
  const vctx = view.getContext('2d', { willReadFrequently: true });
  const bctx = bodies.getContext('2d', { willReadFrequently: true });
  if (vctx === null || bctx === null) return fail('canvas の 2d が取れない');
  for (const c of [vctx, bctx]) {
    c.imageSmoothingEnabled = false;
    c.fillStyle = BG_CSS;
    c.fillRect(0, 0, layout.width, layout.height);
  }

  for (const sec of layout.sections) {
    // 味方と敵に同じ ID があっても、区画の種別の側の定義を引く（敵のシートを味方の定義で描かない）
    const def = sec.entry.isAlly ? reg.units.get(sec.entry.defId) : reg.enemies.get(sec.entry.defId);
    if (def === undefined) return fail(`定義が見つからない: ${sec.entry.defId}`);
    const lift = sec.entry.flying ? FLYING_LIFT : 0;
    const marks = {
      isAlly: sec.entry.isAlly, selected: false, funbaru: false, neraiuchi: false,
      bowCap: sec.entry.bowCap, buffs: { cheer: false, ward: false }, hpRatio: 1,
    };
    for (const cell of sec.cells) {
      // frameOf は使わず、升の row・col を直接渡す（frameOf の検算にならないように）
      const frame = { row: cell.row, col: cell.col };
      const p = bodyCenter(cell.foot, def as SpriteDef, UNIT_R);
      p.y -= lift;
      drawUnitFigure(bctx, def as SpriteDef, { ...p }, UNIT_R, images, frame, marks, 'bodies');
      drawUnitFigure(vctx, def as SpriteDef, { ...p }, UNIT_R, images, frame, marks, 'all');
    }
    // 区画の名前（升の外。判定には入れない）
    vctx.fillStyle = '#000000';
    vctx.font = '10px monospace';
    vctx.textBaseline = 'alphabetic';
    vctx.fillText(`${sec.entry.sheet.sheet} ${sec.entry.defId}`, sec.label.x + 2, sec.label.y + LABEL_H - 3);
  }

  const bodyPx: Pixels = bctx.getImageData(0, 0, layout.width, layout.height);
  const viewPx: Pixels = vctx.getImageData(0, 0, layout.width, layout.height);

  const result: UnitViewResult = { error: null, width: layout.width, height: layout.height, sections: [] };
  const scratch = document.createElement('canvas');
  const sctx = scratch.getContext('2d', { willReadFrequently: true });
  if (sctx === null) return fail('canvas の 2d が取れない');
  for (const sec of layout.sections) {
    const sheet = sec.entry.sheet;
    const img = images.byName.get(sheet.sheet);
    if (img === undefined) return fail(`画像を読めない: ${sheet.sheet}`);
    scratch.width = img.naturalWidth;
    scratch.height = img.naturalHeight;
    sctx.clearRect(0, 0, scratch.width, scratch.height);
    sctx.drawImage(img, 0, 0);
    const sheetPx: Pixels = sctx.getImageData(0, 0, scratch.width, scratch.height);
    const lift = sec.entry.flying ? FLYING_LIFT : 0;
    const mismatched: UnitViewResult['sections'][number]['mismatched'] = [];
    let maxCovered = 0;
    for (const cell of sec.cells) {
      // 状態に無い余りの列（コマ数に満たない状態）は描かれないので見ない（空かどうかは sheet-frames.test.ts が見る）
      if (cell.col >= sheet[cell.state].frames) continue;
      const topLeft = expectedTopLeft(cell.foot, sheet.frame, lift);
      const src = { x: cell.col * sheet.frame, y: cell.row * sheet.frame };
      const bad = compareCell(bodyPx, topLeft, sheetPx, src, sheet.frame, VIEW_BG);
      if (bad > 0) mismatched.push({ state: cell.state, dir: cell.dir, col: cell.col, pixels: bad });
      maxCovered = Math.max(maxCovered, countCovered(bodyPx, viewPx, topLeft, sheet.frame, VIEW_BG));
    }
    result.sections.push({ sheet: sheet.sheet, defId: sec.entry.defId, mismatched, maxCovered });
  }
  return result;
}

run().then(
  (r) => { window.__unitView = r; },
  (e) => { window.__unitView = fail(e instanceof Error ? e.message : String(e)); },
);
