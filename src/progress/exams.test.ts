import { describe, expect, it } from 'vitest';
import data from '../data/puzzles.json';
import { ChessGame } from '../core/game';
import type { Puzzle } from '../learning/puzzles/puzzle';
import { endgameExam, openingExam, rulesExam, tacticsExam } from './exams';

describe('examens', () => {
  it('règles : 10 questions, une seule bonne réponse, reproductible', () => {
    const a = rulesExam(42);
    expect(a).toHaveLength(10);
    for (const q of a) expect(q.options.filter((o) => o.correct)).toHaveLength(1);
    expect(rulesExam(42).map((q) => q.prompt)).toEqual(a.map((q) => q.prompt));
  });
  it('ouvertures : la bonne réponse et les distracteurs sont des coups légaux distincts', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const qs = openingExam(seed);
      expect(qs).toHaveLength(10);
      for (const q of qs) {
        const g = ChessGame.create(q.board!.fen);
        const labels = q.options.map((o) => o.label);
        expect(new Set(labels).size).toBe(3);
        for (const l of labels) expect(g.playSan(l), l).not.toBeNull();
        expect(q.options.filter((o) => o.correct)).toHaveLength(1);
      }
    }
  });
  it('tactique : 10 exercices proches de la cote', () => {
    const ex = tacticsExam((data as { puzzles: Puzzle[] }).puzzles, 1300, 7);
    expect(ex).toHaveLength(10);
    expect(new Set(ex.map((p) => p.id)).size).toBe(10);
    for (const p of ex) expect(Math.abs(p.rating - 1300)).toBeLessThanOrEqual(200);
  });
  it('finales : trois positions existantes', () => {
    expect(endgameExam().map((p) => p.goal)).toEqual(['mate', 'promote', 'draw']);
  });
});
