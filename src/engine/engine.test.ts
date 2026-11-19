import { afterAll, describe, expect, it } from 'vitest';
import { ChessGame } from '../core/game';
import { createNodeEngine } from './node-engine';
import { formatScore, parseBestMove, parseInfo, toWhite, winPercent } from './uci';

describe('lecture UCI', () => {
  it('ligne info complète', () => {
    expect(parseInfo('info depth 12 seldepth 15 multipv 2 score cp -36 nodes 1 nps 1 time 81 pv d8e7 d2d3')).toEqual({ depth: 12, multipv: 2, score: { cp: -36 }, pv: ['d8e7', 'd2d3'] });
    expect(parseInfo('info depth 5 multipv 1 score mate 3 pv h5f7 e8e7 f7e6')?.score).toEqual({ mate: 3 });
  });
  it('ignore les bornes et les lignes sans variante', () => {
    expect(parseInfo('info depth 12 score cp 30 lowerbound pv e2e4')).toBeNull();
    expect(parseInfo('info string NNUE evaluation')).toBeNull();
  });
  it('bestmove', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toBe('e2e4');
    expect(parseBestMove('bestmove (none)')).toBeNull();
    expect(parseBestMove('info depth 1')).toBeUndefined();
  });
  it('points de vue, probabilité de gain et affichage', () => {
    expect(toWhite({ cp: 50 }, 'b')).toEqual({ cp: -50 });
    expect(winPercent({ cp: 0 })).toBe(50);
    expect(winPercent({ mate: 2 })).toBe(100);
    expect(winPercent({ mate: -1 })).toBe(0);
    expect(Math.round(winPercent({ cp: 100 }))).toBe(59);
    expect(formatScore({ cp: 140 })).toBe('+1,4');
    expect(formatScore({ cp: -30 })).toBe('−0,3');
    expect(formatScore({ mate: -2 })).toBe('−M2');
  });
});

describe('Stockfish (calcul réel)', () => {
  const engine = createNodeEngine();
  afterAll(() => engine.terminate());

  it('démarre et s’identifie', async () => {
    await engine.init();
    expect(engine.name).toMatch(/Stockfish 19/);
  });
  it('trouve le mat en un', async () => {
    const r = await engine.search('6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1', { depth: 8 });
    expect(r.bestmove).toBe('d1d8');
    expect(r.lines[0]?.score).toEqual({ mate: 1 });
  });
  it('voit qu’une position est perdue pour le camp au trait', async () => {
    const r = await engine.search('k7/8/8/8/8/8/5QQ1/7K b - - 0 1', { depth: 8 });
    expect(r.lines[0]!.score.mate ?? -r.lines[0]!.score.cp!).toBeLessThan(0);
  });
  it('plusieurs variantes, toutes légales', async () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3';
    const r = await engine.search(fen, { depth: 10, multipv: 3 });
    expect(r.lines).toHaveLength(3);
    for (const l of r.lines) expect(ChessGame.fromUci(l.pv, fen).length).toBe(l.pv.length);
  });
  it('traite les demandes dans l’ordre', async () => {
    const [a, b] = await Promise.all([
      engine.search('6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1', { depth: 6 }),
      engine.search('7k/8/6K1/8/8/8/8/1Q6 w - - 0 1', { depth: 6 }),
    ]);
    expect(a.bestmove).toBe('d1d8');
    expect(b.bestmove).toBe('b1b8');
  });
});
