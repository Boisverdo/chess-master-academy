/**
 * Vérification du contenu pédagogique PAR STOCKFISH :
 * - un coup « accepté » doit être réellement bon (perte < 8 points de probabilité de gain) ;
 * - un résultat annoncé (« gain », « nulle ») doit correspondre à l'évaluation du moteur ;
 * - une position à jouer doit être gagnable (ou tenable) contre le meilleur jeu.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { ChessGame } from '../../core/game';
import { createNodeEngine } from '../../engine/node-engine';
import { winPercent, type Score } from '../../engine/uci';
import { ALL_LESSONS } from './index';

const engine = createNodeEngine();
afterAll(() => engine.terminate());

async function evalFen(fen: string, depth: number): Promise<Score> {
  const g = ChessGame.create(fen);
  if (g.status().termination === 'checkmate') return { mate: -0.5 } as Score;
  if (g.status().over) return { cp: 0 };
  return (await engine.search(fen, { depth })).lines[0]!.score;
}

/** Score du point de vue du camp au trait → catégorie. */
function outcome(s: Score): 'win' | 'draw' | 'loss' | 'unclear' {
  if (s.mate !== undefined) return s.mate > 0 ? 'win' : 'loss';
  if (s.cp >= 250) return 'win';
  if (s.cp <= -250) return 'loss';
  if (Math.abs(s.cp) <= 100) return 'draw';
  return 'unclear';
}

const COURSES_TO_CHECK = new Set(['principes', 'strategie', 'finales']);

describe('contenu vérifié par Stockfish', { timeout: 120_000 }, () => {
  for (const lesson of ALL_LESSONS.filter((l) => COURSES_TO_CHECK.has(l.course))) {
    lesson.steps.forEach((step, i) => {
      if (step.kind === 'move' && step.accept) {
        it(`${lesson.id} — étape ${i + 1} : les coups acceptés sont bons`, async () => {
          const before = winPercent(await evalFen(step.fen, 16));
          for (const uci of step.accept!) {
            const next = ChessGame.create(step.fen).playUci(uci)!;
            const afterWin = 100 - winPercent(await evalFen(next.fen, 16));
            expect(before - afterWin, `${uci} perd ${(before - afterWin).toFixed(1)} points`).toBeLessThan(8);
          }
        });
      }
      if (step.kind === 'choice' && step.verify) {
        it(`${lesson.id} — étape ${i + 1} : résultat annoncé « ${step.verify.result} »`, async () => {
          const fen = step.verify!.fen ?? step.board!.fen;
          expect(outcome(await evalFen(fen, 26))).toBe(step.verify!.result);
        });
      }
      if (step.kind === 'play') {
        it(`${lesson.id} — étape ${i + 1} : position ${step.goal === 'draw' ? 'tenable' : 'gagnable'}`, async () => {
          const o = outcome(await evalFen(step.fen, 24));
          if (step.goal === 'draw') expect(['draw', 'win']).toContain(o);
          else expect(o).toBe('win');
        });
      }
      if (step.kind === 'play' && step.solution) {
        it(`${lesson.id} — étape ${i + 1} : chaque coup de la solution garde le résultat`, async () => {
          const game = ChessGame.fromSan(step.solution!.map((m) => m.san), step.fen);
          const me = ChessGame.create(step.fen).turn;
          for (const p of game.plies.filter((x) => x.color === me)) {
            // Évaluation du point de vue de l'adversaire, juste après ton coup.
            const o = outcome(await evalFen(p.fenAfter, 18));
            if (step.goal === 'draw') expect(['draw', 'loss'], `${p.san} ne doit pas perdre`).toContain(o);
            else expect(o, `${p.san} doit garder le gain`).toBe('loss');
          }
        });
      }
    });
  }
});
