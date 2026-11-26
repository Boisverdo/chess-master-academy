/** Solutions expliquées des exercices joués contre l'ordinateur : légales, complètes, lisibles à voix haute. */
import { describe, expect, it } from 'vitest';
import { ChessGame } from '../../core/game';
import { lineSteps } from '../puzzles/walkthrough';
import { judgePlay } from './playGoal';
import { ALL_LESSONS } from './index';

const plays = ALL_LESSONS.flatMap((l) => l.steps.map((s, i) => ({ lesson: l.id, i, step: s }))).flatMap((x) => (x.step.kind === 'play' ? [{ ...x, step: x.step }] : []));

describe('solutions expliquées des leçons', () => {
  it('chaque exercice joué d’une leçon a une solution', () => {
    expect(plays.length).toBeGreaterThan(0);
    for (const p of plays) expect(p.step.solution?.length, `${p.lesson} étape ${p.i + 1}`).toBeGreaterThan(0);
  });

  for (const { lesson, i, step } of plays) {
    it(`${lesson} — étape ${i + 1} : ligne légale qui atteint l’objectif`, () => {
      const line = step.solution!;
      const game = ChessGame.fromSan(line.map((m) => m.san), step.fen);
      expect(game.length).toBe(line.length);
      const me = ChessGame.create(step.fen).turn;
      // L'objectif n'est atteint qu'au dernier coup, jamais avant.
      for (let n = 1; n < line.length; n++) expect(judgePlay(step, ChessGame.fromSan(line.slice(0, n).map((m) => m.san), step.fen), me).state).toBe('continue');
      expect(judgePlay(step, game, me).state).toBe('success');
      // Chacun de tes coups est commenté par l'entraîneur.
      game.plies.forEach((p, k) => {
        if (p.color === me) expect(line[k]!.comment, `coup ${p.san}`).toBeTruthy();
      });
      const steps = lineSteps(step.fen, line, 'Intro.', step.solutionOutro);
      expect(steps).toHaveLength(line.length + 1);
      for (const s of steps) expect(s.text).not.toMatch(/[♔-♟]|undefined|\[object/);
    });
  }
});
