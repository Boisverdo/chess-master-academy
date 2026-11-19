/** « Retente ta chance » : juge un coup proposé dans une position, par calcul du moteur. */
import { ChessGame } from '../core/game';
import type { Engine } from '../engine/engine';
import { evaluatePosition } from '../analysis/runner';
import { classify, moveAccuracy, sideToMoveWin, type MoveReview, type PositionEval } from '../analysis/review';
import { explainMove, type Explanation, type Fmt } from './explain';

export interface RetryVerdict {
  ok: boolean;
  loss: number;
  explanation: Explanation;
}

/** Un coup est accepté s'il est le meilleur ou s'il perd moins de 5 points de probabilité de gain. */
export async function judgeMove(engine: Engine, before: PositionEval, uci: string, fmt: Fmt, depth = 12): Promise<RetryVerdict | null> {
  const g = ChessGame.create(before.fen);
  const next = g.playUci(uci);
  if (!next) return null;
  const after = await evaluatePosition(engine, next.fen, { depth });
  const p = next.plies.at(-1)!;
  const winBefore = sideToMoveWin(before);
  const winAfter = 100 - sideToMoveWin(after);
  const loss = before.best === uci ? 0 : Math.max(0, winBefore - winAfter);
  const review: MoveReview = {
    ply: g.length + 1,
    color: p.color,
    san: p.san,
    uci,
    fenBefore: before.fen,
    fenAfter: next.fen,
    winBefore,
    winAfter,
    loss,
    cls: classify(loss),
    missed: false,
    accuracy: moveAccuracy(loss),
    bestUci: before.best,
    bestSan: before.best ? (g.playUci(before.best)?.plies.at(-1)?.san ?? null) : null,
  };
  return { ok: loss < 5, loss, explanation: explainMove(review, before, after, fmt) };
}
