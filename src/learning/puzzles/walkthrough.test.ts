import { describe, expect, it } from 'vitest';
import data from '../../data/puzzles.json';
import { PuzzleRun, type Puzzle } from './puzzle';
import { solutionSteps } from './walkthrough';

const puzzles = (data as { puzzles: Puzzle[] }).puzzles;
const solved = (p: Puzzle) => {
  const run = new PuzzleRun(p);
  run.start();
  run.revealAll();
  return run;
};

describe('solution expliquée pas à pas', () => {
  it('exercice 0lYNX (mat en 4) : sacrifice de dame, coups forcés, mat', () => {
    const p = puzzles.find((x) => x.id === '0lYNX')!;
    const steps = solutionSteps(solved(p));
    if (process.env.SHOW_STEPS) for (const s of steps) console.log(s.ply?.san ?? '—', '|', s.text);
    expect(steps).toHaveLength(p.moves.split(' ').length);
    expect(steps[0]!.text).toMatch(/position de départ/);
    expect(steps[1]!.text).toMatch(/^Premier coup : ta dame va de .+ à g5 et prend le pion\. Échec !/);
    expect(steps[1]!.text).toMatch(/sacrifice/);
    expect(steps[1]!.shapes).toContainEqual({ orig: 'g5', brush: 'yellow' });
    expect(steps[2]!.text).toMatch(/L’adversaire répond : son pion va de h6 à g5 et prend ta dame.*accepte le sacrifice/);
    expect(steps.at(-1)!.text).toMatch(/Échec et mat/);
    for (const s of steps.slice(1)) expect(s.shapes[0]).toEqual({ orig: s.ply!.from, dest: s.ply!.to, brush: s.mine ? 'green' : 'blue' });
  });

  it('1500 exercices de la base produisent une étape par coup, sans symbole illisible à voix haute', () => {
    for (const p of puzzles.slice(0, 1500)) {
      const steps = solutionSteps(solved(p));
      expect(steps.length, p.id).toBe(p.moves.split(' ').length);
      for (const s of steps) {
        expect(s.text, p.id).not.toMatch(/undefined|NaN|[+#=]/);
        expect(s.text.length, p.id).toBeGreaterThan(10);
      }
    }
  });

  it('« seul coup légal » n’est affirmé que lorsque c’est vrai', async () => {
    const { Chess } = await import('chess.js');
    for (const p of puzzles.slice(0, 800)) {
      const run = solved(p);
      for (const s of solutionSteps(run)) {
        if (s.mine && s.text.includes('un seul coup légal')) expect(new Chess(s.fen).moves().length, p.id).toBe(1);
        if (!s.mine && s.ply && s.text.includes('seul coup légal')) expect(new Chess(s.ply.fenBefore).moves().length, p.id).toBe(1);
      }
    }
  });
});
