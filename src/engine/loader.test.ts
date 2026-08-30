import { describe, expect, it } from 'vitest';
import { assetFiles, loadRegistry } from './loader';
import { makeGrid, computeFlowField, cellIndexAt, isWalkableAt } from '../core/field';

const KNOWN_SKILLS = ['funbaru', 'neraiuchi', 'omajinai', 'kakenukeru'];

describe('assetFiles', () => {
  it('assets/ の JSON を すべて 拾う', () => {
    const files = assetFiles();
    const paths = Object.keys(files);
    expect(paths).toContain('/assets/units/roran.json');
    expect(paths).toContain('/assets/skills.json');
    expect(paths.filter((p) => p.includes('/stages/')).length).toBeGreaterThanOrEqual(3);
  });
});

describe('loadRegistry', () => {
  it('じっさいの assets/ から レジストリを つくれる', () => {
    const r = loadRegistry(KNOWN_SKILLS);
    if (!r.ok) {
      throw new Error(r.errors.map((e) => `${e.file} ${e.path}: ${e.reason}`).join('\n'));
    }
    expect(r.value.units.size).toBe(4);
    expect(r.value.enemies.size).toBe(3);
    expect(r.value.stages.length).toBe(3);
    expect(r.value.skills.size).toBe(4);
    expect(r.value.titles.length).toBe(5);
    expect(r.value.bonds.length).toBe(3);
  });

  it('実装のない スキル ID を わたすと 落ちる', () => {
    const r = loadRegistry(['funbaru']);
    expect(r.ok).toBe(false);
  });

  it('すべての ステージの 配置地点・敵・勝利地点が 歩ける マスに ある', () => {
    const r = loadRegistry(KNOWN_SKILLS);
    if (!r.ok) throw new Error('レジストリの こうちくに しっぱい');
    for (const stage of r.value.stages) {
      const walkable = (p: { x: number; y: number }): boolean => {
        const cx = Math.floor(p.x / stage.cell);
        const cy = Math.floor(p.y / stage.cell);
        return stage.mapRows[cy]?.[cx] === '.';
      };
      for (const z of stage.placementZone) {
        expect(`${stage.id} placement ${z.pos.x},${z.pos.y} walkable=${walkable(z.pos)}`)
          .toContain('walkable=true');
      }
      for (const e of stage.enemies) {
        expect(`${stage.id} ${e.defId} ${e.pos.x},${e.pos.y} walkable=${walkable(e.pos)}`)
          .toContain('walkable=true');
      }
      expect(`${stage.id} victory walkable=${walkable(stage.victory.pos)}`)
        .toContain('walkable=true');
    }
  });

  it('ユニットが さんしょうする すべての セリフ キーが lines に ある', () => {
    const r = loadRegistry(KNOWN_SKILLS);
    if (!r.ok) throw new Error('レジストリの こうちくに しっぱい');
    for (const id of r.value.units.keys()) {
      for (const key of [`skill:${id}`, `pinch:${id}`, `retire:${id}`]) {
        expect(`${key} => ${r.value.lines.has(key)}`).toContain('true');
      }
    }
  });
});

describe('ステージの せっけい', () => {
  const reg = (() => {
    const r = loadRegistry(KNOWN_SKILLS);
    if (!r.ok) throw new Error(r.errors.map((e) => `${e.file} ${e.path}: ${e.reason}`).join('\n'));
    return r.value;
  })();

  it('3つの ステージが ある', () => {
    expect(reg.stages.map((s) => s.id)).toEqual(['stage1', 'stage2', 'stage3']);
  });

  it('どの ステージにも 敵が 1たい いじょう いる', () => {
    for (const s of reg.stages) {
      expect(`${s.id} => ${s.enemies.length > 0}`).toContain('true');
    }
  });

  it('しょうり ちてんは はいち ちてんから じゅうぶん はなれている', () => {
    for (const s of reg.stages) {
      for (const z of s.placementZone) {
        const d = Math.hypot(z.pos.x - s.victory.pos.x, z.pos.y - s.victory.pos.y);
        expect(`${s.id} きょり ${Math.round(d)} > 300 => ${d > 300}`).toContain('true');
      }
    }
  });

  it('しょうり ちてんは はいち ちてんから あるいて たどりつける', () => {
    for (const s of reg.stages) {
      const grid = makeGrid(s.cell, s.mapRows);
      const field = computeFlowField(grid, s.victory.pos);
      for (const z of s.placementZone) {
        const i = cellIndexAt(grid, z.pos);
        expect(`${s.id} とうたつかのう => ${i >= 0 && (field.dist[i] ?? -1) >= 0}`).toContain('true');
      }
    }
  });

  it('敵の はいちは しょうり ちてんから あるいて たどりつける ばしょに ある', () => {
    for (const s of reg.stages) {
      const grid = makeGrid(s.cell, s.mapRows);
      const field = computeFlowField(grid, s.victory.pos);
      for (const e of s.enemies) {
        const i = cellIndexAt(grid, e.pos);
        expect(`${s.id} ${e.defId} => ${i >= 0 && (field.dist[i] ?? -1) >= 0}`).toContain('true');
      }
    }
  });

  it('guard の post は あるける マスに ある', () => {
    for (const s of reg.stages) {
      const grid = makeGrid(s.cell, s.mapRows);
      for (const e of s.enemies) {
        if (e.ai.kind !== 'guard') continue;
        expect(`${s.id} post => ${isWalkableAt(grid, e.ai.post)}`).toContain('true');
      }
    }
  });

  it('ごえい たいしょうは かならず 1たい いじょう いる', () => {
    for (const s of reg.stages) {
      const escorts = s.defeat.flatMap((c) => (c.type === 'unitLost' ? c.defIds : []));
      expect(`${s.id} => ${escorts.length > 0}`).toContain('true');
    }
  });

  it('さくてき はんいを もつ 敵が stage2 いこうに いる（かいひの あそびが せいりつする）', () => {
    for (const id of ['stage2', 'stage3']) {
      const s = reg.stages.find((x) => x.id === id)!;
      const hasSight = s.enemies.some((e) => e.ai.kind === 'sentry' || e.ai.kind === 'guard');
      expect(`${id} => ${hasSight}`).toContain('true');
    }
  });
});
