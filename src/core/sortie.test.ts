import { describe, expect, it } from 'vitest';
import { canChooseSortie, initialSortie, lockedIds, sortieCandidates, sortieProgress, toggleSortie } from './sortie';
import { testRegistry } from './testing';

const reg = testRegistry();
const stage = (id: string) => reg.stages.find((s) => s.id === id)!;
// s9 の時点で加わっている 8 人（並びは加わった順の例）
const M9 = ['ally05', 'ally07', 'ally09', 'ally12', 'ally10', 'ally06', 'ally11', 'ally13'];

describe('出撃の決め方', () => {
  it('外せない仲間は負けの条件の unitLost の仲間', () => {
    expect(lockedIds(stage('stage9'))).toEqual(['roran']);
    expect(reg.stages.some((s) => lockedIds(s).join() === 'roran,mist')).toBe(true);
  });
  it('候補は roster → 加わった順 → 開始時の加入', () => {
    expect(sortieCandidates(reg, stage('stage9'), M9)).toEqual(
      ['roran', 'ines', 'mist', 'gau', ...M9, 'ally14']);
  });
  it('前回の出撃が無いときは今の自動の 8 人（並びは候補の順）', () => {
    expect(initialSortie(reg, stage('stage9'), M9, [])).toEqual(
      ['roran', 'ines', 'mist', 'gau', 'ally05', 'ally07', 'ally09', 'ally14']);
  });
  it('前回の出撃を引き継ぎ、外せない仲間と開始時の加入を先に入れ、あふれた分は前回の後ろから外れる', () => {
    const prev = ['roran', 'ally12', 'ally10', 'ally06', 'ally11', 'ally13', 'ines', 'mist'];
    expect(initialSortie(reg, stage('stage9'), M9, prev)).toEqual(
      ['roran', 'ines', 'ally12', 'ally10', 'ally06', 'ally11', 'ally13', 'ally14']);
  });
  it('前回の出撃のうち候補にいない ID・重複は飛ばし、足りない分を自動の順で埋める', () => {
    expect(initialSortie(reg, stage('stage9'), M9, ['ghost', 'ally13', 'ally13', 'ally08'])).toEqual(
      ['roran', 'ines', 'mist', 'gau', 'ally05', 'ally07', 'ally13', 'ally14']);
  });
  it('入れる・外す・外せない・8 人', () => {
    const s = stage('stage9');
    const c = sortieCandidates(reg, s, M9);
    const full = initialSortie(reg, s, M9, []);
    expect(toggleSortie(s, full, 'roran', c)).toEqual({ chosen: full, refusal: 'locked' });
    expect(toggleSortie(s, full, 'ally12', c)).toEqual({ chosen: full, refusal: 'full' });
    const seven = toggleSortie(s, full, 'gau', c);
    expect(seven).toEqual({ chosen: full.filter((id) => id !== 'gau'), refusal: null });
    expect(toggleSortie(s, seven.chosen, 'ally12', c).chosen).toEqual(
      ['roran', 'ines', 'mist', 'ally05', 'ally07', 'ally09', 'ally12', 'ally14']);
    expect(toggleSortie(s, full, 'ghost', c)).toEqual({ chosen: full, refusal: null });
  });
  it('候補が 8 人を超えるときだけ選べる', () => {
    expect(canChooseSortie(sortieCandidates(reg, stage('stage1'), []))).toBe(false);
    expect(canChooseSortie(sortieCandidates(reg, stage('stage9'), M9))).toBe(true);
  });
  it('開始時の加入の進行は加わるときのレベル、それ以外はセーブの値', () => {
    const party = { units: { ines: { level: 6, xp: 3 } }, members: M9, claimed: [] };
    expect(sortieProgress(stage('stage9'), party, 'ally14')).toEqual({ level: stage('stage9').joins[0]!.level, xp: 0 });
    expect(sortieProgress(stage('stage9'), party, 'ines')).toEqual({ level: 6, xp: 3 });
  });
});
