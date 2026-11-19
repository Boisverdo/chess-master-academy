/**
 * Contrôle automatique de TOUT le contenu des leçons : positions valides, coups de démonstration
 * légaux, exercices solubles, réponses déclarées réellement correctes.
 */
import { describe, expect, it } from 'vitest';
import { ChessGame, type PromotionPiece, type Square } from '../../core/game';
import { checkMove, solutions } from './check';
import { ALL_LESSONS } from './index';
import { isExercise, type MoveStep } from './types';

const SQUARE = /^[a-h][1-8]$/;
const play = (step: MoveStep, uci: string) => checkMove(step, uci.slice(0, 2) as Square, uci.slice(2, 4) as Square, (uci[4] as PromotionPiece) || undefined);

describe('contenu des leçons', () => {
  it('identifiants uniques', () => {
    const ids = ALL_LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const lesson of ALL_LESSONS) {
    describe(lesson.title, () => {
      it('a au moins un exercice', () => {
        expect(lesson.steps.some(isExercise)).toBe(true);
      });
      lesson.steps.forEach((step, i) => {
        it(`étape ${i + 1} (${step.kind}) est valide`, () => {
          // Un échiquier vide sert uniquement d'illustration (aucun coup n'y est joué).
          if (step.kind === 'explain' && step.board && !step.board.fen.startsWith('8/8/8/8/8/8/8/8 ')) ChessGame.create(step.board.fen);
          if (step.kind === 'explain' || step.kind === 'choice') {
            for (const sh of (step.kind === 'explain' ? step.board?.shapes : step.board?.shapes) ?? []) {
              expect(sh.orig).toMatch(SQUARE);
              if (sh.dest) expect(sh.dest).toMatch(SQUARE);
            }
          }
          if (step.kind === 'choice') {
            if (step.board) ChessGame.create(step.board.fen);
            expect(step.options.filter((o) => o.correct).length).toBe(1);
          }
          if (step.kind === 'square') {
            step.answer.forEach((a) => expect(a).toMatch(SQUARE));
            if (step.fen) ChessGame.create(step.fen);
          }
          if (step.kind === 'demo') {
            expect(() => ChessGame.fromSan(step.moves.map((m) => m.san), step.fen)).not.toThrow();
            step.moves.forEach((m) => expect(m.comment.length).toBeGreaterThan(5));
          }
          if (step.kind === 'play') {
            const g = ChessGame.create(step.fen);
            expect(g.status().over).toBe(false);
            expect(step.maxMoves).toBeGreaterThan(0);
            if (step.orientation) expect(step.orientation).toBe(g.turn === 'w' ? 'white' : 'black');
          }
          if (step.kind === 'move') {
            const game = ChessGame.create(step.fen);
            expect(game.status().over).toBe(false);
            const sols = solutions(step);
            expect(sols.length, 'au moins une solution').toBeGreaterThan(0);
            for (const a of step.accept ?? []) expect(play(step, a).ok, `coup accepté ${a}`).toBe(true);
            for (const r of Object.keys(step.reject ?? {})) expect(play(step, r).ok, `coup refusé ${r}`).toBe(false);
            for (const w of Object.keys(step.wrong ?? {})) expect(play(step, w).ok, `coup faux ${w}`).toBe(false);
          }
        });
      });
    });
  }
});

describe('vérification des coups', () => {
  const mate: MoveStep = { kind: 'move', prompt: '', fen: '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', goal: 'mate', hint: '', success: 'ok' };
  it('accepte le mat', () => expect(play(mate, 'g1g7').ok).toBe(true));
  it('explique le pat', () => expect(play(mate, 'g1g6').message).toMatch(/^Pat/));
  it('explique l’échec qui n’est pas mat', () => expect(play(mate, 'g1g8').message).toMatch(/Échec, mais pas mat : l’adversaire peut répondre Rxg8/));
  it('explique l’absence d’échec', () => expect(play(mate, 'f6e6').message).toMatch(/ne met pas le roi adverse en échec/));
  it('signale un coup illégal', () => expect(play(mate, 'g1a2').message).toBe('Ce coup est illégal.'));
  it('prevent-mate nomme le mat restant', () => {
    const step: MoveStep = { kind: 'move', prompt: '', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', goal: 'prevent-mate', hint: '', success: 'ok' };
    expect(play(step, 'a7a6').message).toMatch(/fait mat avec Dxf7#/);
    expect(play(step, 'g7g6').ok).toBe(true);
  });
});
