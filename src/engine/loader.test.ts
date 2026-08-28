import { describe, expect, it } from 'vitest';
import { assetFiles, loadRegistry } from './loader';

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
