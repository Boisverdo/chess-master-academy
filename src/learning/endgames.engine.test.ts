/**
 * Finales essentielles vérifiées PAR STOCKFISH : chaque position annoncée gagnante l'est contre le meilleur jeu,
 * chaque position à défendre est tenable, et un mat annoncé tient dans le nombre de coups accordé.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { ChessGame } from '../core/game';
import { createNodeEngine } from '../engine/node-engine';
import { ENDGAMES } from './endgames';

const engine = createNodeEngine();
afterAll(() => engine.terminate());

describe('finales essentielles vérifiées par Stockfish', { timeout: 180_000 }, () => {
  for (const e of ENDGAMES) {
    it(`${e.id} : position ${e.step.goal === 'draw' ? 'tenable' : 'gagnable'}`, async () => {
      const g = ChessGame.create(e.step.fen);
      expect(g.status().over).toBe(false);
      const score = (await engine.search(e.step.fen, { depth: 26 })).lines[0]!.score;
      if (e.step.goal === 'draw') {
        // Le camp au trait (le joueur) ne doit pas être perdant.
        if (score.mate !== undefined) expect(score.mate).toBeGreaterThan(0);
        else expect(score.cp).toBeGreaterThan(-100);
      } else if (score.mate !== undefined) {
        expect(score.mate).toBeGreaterThan(0);
        if (e.step.goal === 'mate') expect(score.mate).toBeLessThanOrEqual(e.step.maxMoves);
      } else {
        expect(score.cp).toBeGreaterThanOrEqual(250);
      }
    });
  }
});
