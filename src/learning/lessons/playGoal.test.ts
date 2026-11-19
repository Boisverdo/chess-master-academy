import { describe, expect, it } from 'vitest';
import { ChessGame } from '../../core/game';
import { judgePlay } from './playGoal';
import type { PlayStep } from './types';

const step = (goal: PlayStep['goal'], fen: string, maxMoves = 5): PlayStep => ({ kind: 'play', prompt: '', fen, goal, maxMoves, hint: '', success: '' });

describe('arbitrage des exercices joués contre le moteur', () => {
  it('mat : réussite, pat refusé, limite de coups', () => {
    const s = step('mate', '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', 1);
    expect(judgePlay(s, ChessGame.create(s.fen).play('g1', 'g7')!, 'w')).toEqual({ state: 'success' });
    const pat = judgePlay(s, ChessGame.create(s.fen).play('g1', 'g6')!, 'w');
    expect(pat).toMatchObject({ state: 'fail' });
    expect(pat.state === 'fail' && pat.reason).toMatch(/Pat/);
    expect(judgePlay(s, ChessGame.create(s.fen).play('g1', 'g2')!, 'w')).toMatchObject({ state: 'fail' });
  });
  it('promotion : réussite et pion perdu', () => {
    const s = step('promote', '4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(judgePlay(s, ChessGame.create(s.fen).play('a7', 'a8', 'q')!, 'w')).toEqual({ state: 'success' });
    const lost = ChessGame.create('8/1P6/2k5/8/8/8/8/4K3 b - - 0 1').play('c6', 'b7')!;
    expect(judgePlay(step('promote', '8/1P6/2k5/8/8/8/8/4K3 b - - 0 1'), lost, 'w')).toMatchObject({ state: 'fail' });
  });
  it('nulle : pion rattrapé, position tenue, matériel perdu', () => {
    const s = step('draw', '8/8/8/8/8/1k6/P7/7K b - - 0 1');
    expect(judgePlay(s, ChessGame.create(s.fen).play('b3', 'a2')!, 'b')).toEqual({ state: 'success' });

    const rook = step('draw', '4k3/8/8/8/8/8/3r4/R5K1 b - - 0 1', 2);
    const one = ChessGame.create(rook.fen).play('d2', 'd3')!;
    expect(judgePlay(rook, one, 'b')).toEqual({ state: 'continue' });
    const held = one.play('a1', 'a2')!.play('d3', 'd4')!;
    expect(judgePlay(rook, held, 'b')).toEqual({ state: 'success' });

    // …Td1+ ? Txd1 : après le coup noir suivant, la tour est perdue.
    const lost = ChessGame.create(rook.fen).play('d2', 'd1')!.play('a1', 'd1')!.play('e8', 'e7')!;
    expect(judgePlay(step('draw', rook.fen, 5), lost, 'b')).toMatchObject({ state: 'fail', reason: 'Tu as perdu du matériel.' });
  });
});
