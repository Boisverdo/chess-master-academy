import { afterAll, describe, expect, it } from 'vitest';
import { ChessGame } from '../core/game';
import { formatSan } from '../core/notation';
import { analyseGame } from '../analysis/runner';
import { buildBook, classify, criticalMoments, moveAccuracy, reviewGame } from '../analysis/review';
import { createNodeEngine } from '../engine/node-engine';
import { OPENINGS } from '../learning/openings';
import { explainMove, slowDevelopment } from './explain';
import { detectHabits } from './habits';
import { loosePieces, materialSwing } from './facts';

const fmt = (san: string, c: 'w' | 'b') => formatSan(san, c, 'french');

describe('classification et précision', () => {
  it('seuils', () => {
    expect(classify(0)).toBe('meilleur');
    expect(classify(3)).toBe('bon');
    expect(classify(6)).toBe('imprecision');
    expect(classify(12)).toBe('erreur');
    expect(classify(40)).toBe('gaffe');
  });
  it('précision décroissante', () => {
    expect(Math.round(moveAccuracy(0))).toBe(100);
    expect(moveAccuracy(10)).toBeGreaterThan(moveAccuracy(30));
  });
});

describe('faits calculés', () => {
  it('pièces mal protégées', () => {
    expect(loosePieces('4k3/8/8/3n4/8/8/8/3QK3 b - - 0 1', 'b')).toEqual([{ square: 'd5', piece: 'n' }]);
    expect(loosePieces('4k3/8/2p5/3n4/8/8/8/3QK3 b - - 0 1', 'b')).toEqual([]);
  });
  it('bilan matériel d’une variante', () => {
    expect(materialSwing('4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1', ['d1d5'], 'w')).toBe(3);
  });
  it('développement lent', () => {
    expect(slowDevelopment('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'w')).toBe(true);
    expect(slowDevelopment('rnbqkbnr/pppppppp/8/8/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 1', 'w')).toBe(false);
  });
});

describe('habitudes', () => {
  it('3 parties sur 10 = habitude ; moins = ponctuel', () => {
    const games = [
      { gameId: 1, date: 1, tags: ['piece-en-prise', 'finale'] },
      { gameId: 2, date: 2, tags: ['piece-en-prise'] },
      { gameId: 3, date: 3, tags: ['piece-en-prise', 'piece-en-prise'] },
      { gameId: 4, date: 4, tags: ['ouverture'] },
    ];
    const h = detectHabits(games);
    expect(h[0]).toMatchObject({ tag: 'piece-en-prise', games: 3, recurrent: true });
    expect(h.find((x) => x.tag === 'finale')).toMatchObject({ recurrent: false, games: 1 });
  });
});

describe('analyse réelle avec Stockfish', () => {
  const engine = createNodeEngine();
  afterAll(() => engine.terminate());
  const book = buildBook(OPENINGS.map((o) => o.mainLine.map(([s]) => s)));

  it('coup du berger : …Cf6 est une gaffe qui permet le mat, expliquée avec la vraie suite', async () => {
    const game = ChessGame.fromSan(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']);
    const evals = await analyseGame(engine, game, { depth: 10 });
    expect(evals.at(-1)?.terminal).toBe('checkmate');
    const review = reviewGame(game, evals, book);
    const nf6 = review.moves[5]!;
    expect(nf6.cls).toBe('gaffe');
    expect(review.moves[6]!.cls).toBe('meilleur');
    const ex = explainMove(nf6, evals[5]!, evals[6]!, fmt);
    expect(ex.sentences.join(' ')).toContain('forcer le mat en 1 : Dxf7#');
    expect(ex.tags).toContain('mat-subi');
    expect(ex.lesson?.link).toBe('/lecons/principes-verification');
    expect(criticalMoments(review, 'b').map((m) => m.san)).toEqual(['Nf6']);
    expect(review.accuracy.w).toBeGreaterThan(review.accuracy.b);
  });

  it('coup de théorie reconnu ; chaque coup reçoit une explication', async () => {
    const game = ChessGame.fromSan(['e4', 'e5', 'Nf3', 'Nc6', 'Qe2', 'Nd4', 'Qd3', 'd6', 'Qc4', 'Be6']);
    const evals = await analyseGame(engine, game, { depth: 10 });
    const review = reviewGame(game, evals, book);
    expect(review.moves[0]!.cls).toBe('theorie');
    for (const m of review.moves) {
      const ex = explainMove(m, evals[m.ply - 1]!, evals[m.ply]!, fmt);
      expect(ex.verdict.length).toBeGreaterThan(5);
    }
  });

  it('une dame laissée en prise est nommée', async () => {
    const game = ChessGame.fromSan(['e4', 'Nf6', 'Qg4']);
    const evals = await analyseGame(engine, game, { depth: 10 });
    const review = reviewGame(game, evals, book);
    const qg4 = review.moves[2]!;
    expect(qg4.cls).toBe('gaffe');
    const ex = explainMove(qg4, evals[2]!, evals[3]!, fmt);
    expect(ex.sentences.join(' ')).toContain('qui prend ta dame en g4');
    expect(ex.tags).toContain('piece-en-prise');
    expect(ex.tags).toContain('dame-precoce');
  });
});
