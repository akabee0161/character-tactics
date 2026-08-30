import {
  validateBondsFile, validateEnemyDef, validateLinesFile, validateSkillsFile,
  validateStageDef, validateTitlesFile, validateUnitDef,
} from './schema';
import type {
  BondDef, EnemyDef, SkillDef, StageDef, TitleDef, UnitDef, Validated, ValidationError,
} from './schema';

export type Registry = {
  units: Map<string, UnitDef>;
  enemies: Map<string, EnemyDef>;
  /** 順序を持つのでこれだけ配列。パスの辞書順 */
  stages: StageDef[];
  skills: Map<string, SkillDef>;
  titles: TitleDef[];
  bonds: BondDef[];
  lines: Map<string, string>;
};

/** 'assets/units/<id>.json' → '<id>' */
function baseName(path: string): string {
  const last = path.split('/').pop() ?? '';
  return last.replace(/\.json$/, '');
}

function inDir(path: string, dir: string): boolean {
  return path.includes(`/${dir}/`);
}

export function buildRegistry(
  files: Record<string, unknown>,
  knownSkillIds: readonly string[],
): Validated<Registry> {
  const errors: ValidationError[] = [];
  const reg: Registry = {
    units: new Map(), enemies: new Map(), stages: [],
    skills: new Map(), titles: [], bonds: [], lines: new Map(),
  };

  const take = <T>(result: Validated<T>, use: (value: T) => void): void => {
    if (result.ok) use(result.value);
    else errors.push(...result.errors);
  };

  // 1) ファイルごとの形を見る
  for (const path of Object.keys(files).sort()) {
    const raw = files[path];
    if (inDir(path, 'units')) {
      take(validateUnitDef(path, raw), (d) => reg.units.set(d.id, d));
    } else if (inDir(path, 'enemies')) {
      take(validateEnemyDef(path, raw), (d) => reg.enemies.set(d.id, d));
    } else if (inDir(path, 'stages')) {
      take(validateStageDef(path, raw), (d) => {
        if (d.id !== baseName(path)) {
          errors.push({ file: path, path: 'id', reason: `ファイルめいと id が ちがう: ${d.id}` });
        }
        reg.stages.push(d);
      });
    } else if (inDir(path, 'lines')) {
      take(validateLinesFile(path, raw), (d) => {
        for (const [k, v] of Object.entries(d)) reg.lines.set(k, v);
      });
    } else if (baseName(path) === 'skills') {
      take(validateSkillsFile(path, raw), (d) => {
        for (const s of d) reg.skills.set(s.id, s);
      });
    } else if (baseName(path) === 'bonds') {
      take(validateBondsFile(path, raw), (d) => reg.bonds.push(...d));
    } else if (baseName(path) === 'titles') {
      take(validateTitlesFile(path, raw), (d) => reg.titles.push(...d));
    } else {
      errors.push({ file: path, path: '', reason: 'どの しゅるいの アセットか わからない' });
    }
  }

  // 形が崩れているうちに相互参照を見ても、正しくない指摘が大量に出るだけなので打ち切る
  if (errors.length > 0) return { ok: false, errors };
  if (reg.stages.length === 0) {
    return { ok: false, errors: [{ file: 'assets/stages/', path: '', reason: 'ステージが 1つも ない' }] };
  }

  // 2) 相互参照を見る
  const known = new Set(knownSkillIds);
  for (const id of reg.skills.keys()) {
    if (!known.has(id)) {
      errors.push({ file: 'assets/skills.json', path: id, reason: `こうかの じっそうが ない: ${id}` });
    }
  }

  const checkSkillId = (file: string, path: string, skillId: string | null): void => {
    if (skillId !== null && !reg.skills.has(skillId)) {
      errors.push({ file, path, reason: `skills.json に ない id: ${skillId}` });
    }
  };
  for (const [id, def] of reg.units) checkSkillId(`assets/units/${id}.json`, 'skillId', def.skillId);
  for (const [id, def] of reg.enemies) checkSkillId(`assets/enemies/${id}.json`, 'skillId', def.skillId);

  for (const stage of reg.stages) {
    const file = `assets/stages/${stage.id}.json`;
    const roster = new Set(stage.roster);
    stage.roster.forEach((defId, i) => {
      if (!reg.units.has(defId)) {
        errors.push({ file, path: `roster[${i}]`, reason: `units に ない id: ${defId}` });
      }
    });
    stage.enemies.forEach((e, i) => {
      if (!reg.enemies.has(e.defId)) {
        errors.push({ file, path: `enemies[${i}].defId`, reason: `enemies に ない id: ${e.defId}` });
      }
    });
    if (stage.victory.by !== 'any' && !roster.has(stage.victory.by)) {
      errors.push({ file, path: 'victory.by', reason: `roster に ない id: ${stage.victory.by}` });
    }
    stage.defeat.forEach((cond, i) => {
      if (cond.type !== 'unitLost') return;
      cond.defIds.forEach((defId, j) => {
        if (!roster.has(defId)) {
          errors.push({ file, path: `defeat[${i}].defIds[${j}]`, reason: `roster に ない id: ${defId}` });
        }
      });
    });
    stage.intro?.forEach((line, i) => {
      if (lookupDef(reg, line.speaker) === null) {
        errors.push({ file, path: `intro[${i}].speaker`, reason: `しらない はなして: ${line.speaker}` });
      }
      if (!reg.lines.has(line.lineId)) {
        errors.push({ file, path: `intro[${i}].lineId`, reason: `lines に ない id: ${line.lineId}` });
      }
    });
  }

  reg.titles.forEach((t, i) => {
    if (t.owner !== null && !reg.units.has(t.owner)) {
      errors.push({ file: 'assets/titles.json', path: `[${i}].owner`, reason: `units に ない id: ${t.owner}` });
    }
  });

  reg.bonds.forEach((b, i) => {
    if (!reg.units.has(b.a)) {
      errors.push({ file: 'assets/bonds.json', path: `[${i}].a`, reason: `units に ない id: ${b.a}` });
    }
    if (!reg.units.has(b.b)) {
      errors.push({ file: 'assets/bonds.json', path: `[${i}].b`, reason: `units に ない id: ${b.b}` });
    }
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: reg };
}

/** 味方・敵のどちらでも名前と色を引けるようにする。吹き出しと描画が使う */
export function lookupDef(reg: Registry, defId: string): UnitDef | EnemyDef | null {
  return reg.units.get(defId) ?? reg.enemies.get(defId) ?? null;
}

export function skillParam(
  reg: Registry,
  skillId: string,
  key: string,
  fallback: number,
): number {
  return reg.skills.get(skillId)?.params[key] ?? fallback;
}
