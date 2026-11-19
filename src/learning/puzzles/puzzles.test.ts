import { describe, expect, it } from 'vitest';
import data from '../../data/puzzles.json';
import { explainSolution, materialBalance, PuzzleRun, type Puzzle } from './puzzle';
import { selectPuzzle } from './select';
import { THEMES } from './themes';

const puzzles = (data as { puzzles: Puzzle[] }).puzzles;

describe('base d’exercices extraite', () => {
  it('contient des milliers d’exercices, chaque thème largement représenté', () => {
    expect(puzzles.length).toBeGreaterThan(3000);
    for (const t of THEMES) expect(puzzles.filter((p) => p.themes.includes(t.key)).length, t.key).toBeGreaterThanOrEqual(150);
  });
  it('identifiants uniques et thèmes connus', () => {
    expect(new Set(puzzles.map((p) => p.id)).size).toBe(puzzles.length);
    const known = new Set(THEMES.map((t) => t.key));
    for (const p of puzzles) for (const t of p.themes) expect(known.has(t), t).toBe(true);
  });
  it('chaque solution est légale ; les exercices de mat se terminent par un mat', () => {
    for (const p of puzzles) {
      const run = new PuzzleRun(p);
      run.start();
      run.revealAll();
      if (p.themes.some((t) => t.startsWith('mat-en-'))) expect(run.game.status().termination, p.id).toBe('checkmate');
    }
  });
  it('un mat en N demande N coups au joueur', () => {
    for (const p of puzzles.filter((x) => x.themes.includes('mat-en-2'))) expect(new PuzzleRun(p).playerMoves, p.id).toBe(2);
  });
});

describe('déroulement d’un exercice', () => {
  const p = puzzles.find((x) => x.themes.includes('mat-en-2'))!;
  it('joue la réponse adverse puis termine', () => {
    const run = new PuzzleRun(p);
    run.start();
    const sol = run.solution;
    expect(run.play(sol[1]!)).toBe('correct');
    expect(run.cursor).toBe(3);
    expect(run.play(sol[3]!)).toBe('solved');
    expect(run.game.status().termination).toBe('checkmate');
  });
  it('refuse un mauvais coup sans modifier la position', () => {
    const run = new PuzzleRun(p);
    run.start();
    const fen = run.game.fen;
    const legalWrong = [...run.game.legalDests()].flatMap(([f, ts]) => ts.map((t) => f + t)).find((u) => u !== run.expected()!.slice(0, 4));
    expect(run.play(legalWrong!)).toBe('wrong');
    expect(run.game.fen).toBe(fen);
    expect(run.play('a1a1')).toBe('illegal');
  });
  it('explique la solution à partir de la position réelle', () => {
    const run = new PuzzleRun(p);
    run.start();
    run.revealAll();
    expect(explainSolution(run).join(' ')).toMatch(/échec et mat/);
  });
});

describe('bilan matériel', () => {
  it('compte du point de vue de chaque camp', () => {
    expect(materialBalance('4k3/8/8/8/8/8/8/Q3K3 w - - 0 1', 'w')).toBe(9);
    expect(materialBalance('4k3/8/8/8/8/8/8/Q3K3 w - - 0 1', 'b')).toBe(-9);
  });
});

describe('sélection', () => {
  const fixed = () => 0;
  it('respecte le thème et la cote', () => {
    const p = selectPuzzle(puzzles, { rating: 1200, theme: 'clouage', random: fixed })!;
    expect(p.themes).toContain('clouage');
    expect(Math.abs(p.rating - 1200)).toBeLessThanOrEqual(100);
  });
  it('évite les exercices déjà vus', () => {
    const first = selectPuzzle(puzzles, { rating: 1200, theme: 'clouage', random: fixed })!;
    const second = selectPuzzle(puzzles, { rating: 1200, theme: 'clouage', random: fixed, seen: new Set([first.id]) })!;
    expect(second.id).not.toBe(first.id);
  });
  it('privilégie les faiblesses en mode adapté', () => {
    const p = selectPuzzle(puzzles, { rating: 1500, weakThemes: ['enfilade'], random: fixed })!;
    expect(p.themes).toContain('enfilade');
  });
});
