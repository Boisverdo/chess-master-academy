import { describe, expect, it } from 'vitest';
import { chooseMove, levelById, LEVELS, scoreValue } from './levels';
import type { PvLine } from './uci';

const line = (mv: string, cp: number, multipv: number): PvLine => ({ multipv, depth: 5, score: { cp }, pv: [mv] });
const lines = [line('a', 50, 1), line('b', 40, 2), line('c', -300, 3), line('d', -900, 4)];

function freq(levelId: number, n = 4000) {
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const counts: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const m = chooseMove(lines, levelById(levelId), rnd)!;
    counts[m] = (counts[m] ?? 0) + 1;
  }
  return counts;
}

describe('niveaux de l’adversaire', () => {
  it('6 niveaux', () => expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6]));
  it('les niveaux forts jouent toujours le meilleur coup du moteur', () => {
    expect(chooseMove(lines, levelById(5))).toBe('a');
    expect(chooseMove(lines, levelById(6))).toBe('a');
  });
  it('plus le niveau monte, plus les gros écarts deviennent rares', () => {
    const blunders = [1, 2, 3, 4].map((id) => (freq(id)['d'] ?? 0) + (freq(id)['c'] ?? 0));
    for (let i = 1; i < blunders.length; i++) expect(blunders[i]!).toBeLessThan(blunders[i - 1]!);
    expect(blunders[3]).toBe(0);
  });
  it('le débutant se trompe vraiment, mais pas toujours', () => {
    const f = freq(1);
    expect((f['c'] ?? 0) + (f['d'] ?? 0)).toBeGreaterThan(400);
    expect((f['a'] ?? 0) + (f['b'] ?? 0)).toBeGreaterThan(2000);
  });
  it('un mat en un n’est jamais manqué à partir du niveau 2', () => {
    const mate: PvLine[] = [{ multipv: 1, depth: 3, score: { mate: 1 }, pv: ['m'] }, line('x', 0, 2), line('y', -10, 3)];
    for (let i = 0; i < 200; i++) expect(chooseMove(mate, levelById(2))).toBe('m');
  });
  it('ordre des scores avec mats', () => {
    expect(scoreValue({ mate: 1 })).toBeGreaterThan(scoreValue({ mate: 3 }));
    expect(scoreValue({ mate: 3 })).toBeGreaterThan(scoreValue({ cp: 2000 }));
    expect(scoreValue({ mate: -1 })).toBeLessThan(scoreValue({ mate: -4 }));
  });
  it('aucun candidat → aucun coup', () => expect(chooseMove([], levelById(3))).toBeNull());
});
