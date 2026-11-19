/** Arbitrage des exercices « joue contre le moteur » (fonction pure, testée). */
import type { ChessGame, Color } from '../../core/game';
import { materialBalance } from '../puzzles/puzzle';
import type { PlayStep } from './types';

export type PlayVerdict = { state: 'continue' } | { state: 'success' } | { state: 'fail'; reason: string };

export function judgePlay(step: PlayStep, game: ChessGame, player: Color): PlayVerdict {
  const s = game.status();
  const mine = game.plies.filter((p) => p.color === player);
  const theirs = game.plies.filter((p) => p.color !== player);
  const used = mine.length;
  const winner: Color | null = s.result === '1-0' ? 'w' : s.result === '0-1' ? 'b' : null;

  if (s.over && winner && winner !== player) return { state: 'fail', reason: 'Tu as été maté.' };

  switch (step.goal) {
    case 'mate':
      if (s.termination === 'checkmate' && winner === player) return { state: 'success' };
      if (s.over) return { state: 'fail', reason: s.termination === 'stalemate' ? 'Pat : la partie est nulle. Laisse toujours une case au roi adverse.' : 'La partie est nulle.' };
      if (used >= step.maxMoves) return { state: 'fail', reason: `Pas de mat en ${step.maxMoves} coups. Rapproche ton roi et réduis l’espace du roi adverse.` };
      return { state: 'continue' };
    case 'promote':
      if (mine.some((p) => p.promotion)) return { state: 'success' };
      if (s.over) return { state: 'fail', reason: 'La partie est terminée sans promotion.' };
      if (theirs.some((p) => p.captured === 'p')) return { state: 'fail', reason: 'Ton pion a été pris.' };
      if (used >= step.maxMoves) return { state: 'fail', reason: `Pas de promotion en ${step.maxMoves} coups.` };
      return { state: 'continue' };
    case 'draw': {
      if (s.over && s.result === '1/2-1/2') return { state: 'success' };
      if (theirs.some((p) => p.promotion)) return { state: 'fail', reason: 'L’adversaire a promu son pion.' };
      const start = materialBalance(game.startFen, player);
      // Le matériel est jugé juste après TON coup : un échange en cours (prise puis reprise) n'est pas une perte.
      if (game.turn !== player && materialBalance(game.fen, player) < start) return { state: 'fail', reason: 'Tu as perdu du matériel.' };
      if (used >= step.maxMoves) return { state: 'success' };
      return { state: 'continue' };
    }
  }
}
