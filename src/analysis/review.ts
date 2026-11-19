/**
 * Revue d'une partie à partir des évaluations RÉELLES du moteur (une par position).
 * Aucune valeur n'est inventée : sans évaluation, pas de classification.
 *
 * Seuils (perte de probabilité de gain, en points sur 100), équivalents à ceux publiés par Lichess
 * (0,1 / 0,2 / 0,3 en « chances de gain ») : imprécision ≥ 5, erreur ≥ 10, gaffe ≥ 15.
 */
import { ChessGame, type Color } from '../core/game';
import { winPercent, type Score } from '../engine/uci';

export interface PositionEval {
  fen: string;
  /** Score du point de vue du camp au trait. */
  score: Score;
  best: string | null;
  pv: string[];
  depth: number;
  /** Position finale : mat (le camp au trait est maté) ou nulle. */
  terminal?: 'checkmate' | 'draw';
}

export type MoveClass = 'theorie' | 'meilleur' | 'bon' | 'imprecision' | 'erreur' | 'gaffe';

export const CLASS_LABELS: Record<MoveClass, string> = {
  theorie: 'Théorie',
  meilleur: 'Meilleur coup',
  bon: 'Bon coup',
  imprecision: 'Imprécision',
  erreur: 'Erreur',
  gaffe: 'Gaffe',
};

/** Annotations conventionnelles (notation échiquéenne standard). */
export const CLASS_GLYPHS: Partial<Record<MoveClass, string>> = { imprecision: '?!', erreur: '?', gaffe: '??' };

export interface MoveReview {
  ply: number;
  color: Color;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  /** Probabilité de gain du joueur qui a joué, avant et après son coup (0–100). */
  winBefore: number;
  winAfter: number;
  loss: number;
  cls: MoveClass;
  /** L'adversaire venait de se tromper et le joueur n'en a pas profité. */
  missed: boolean;
  accuracy: number;
  bestUci: string | null;
  bestSan: string | null;
}

export interface GameReview {
  moves: MoveReview[];
  accuracy: Record<Color, number>;
  counts: Record<Color, Record<MoveClass, number>>;
  /** Probabilité de gain des Blancs après chaque demi-coup (index 0 = position de départ). */
  whiteWin: number[];
}

/** Probabilité de gain (0–100) du camp AU TRAIT dans une position évaluée. */
export function sideToMoveWin(e: PositionEval): number {
  if (e.terminal === 'checkmate') return 0;
  if (e.terminal === 'draw') return 50;
  return winPercent(e.score);
}

/** Précision d'un coup selon la perte de probabilité de gain (formule ouverte publiée par Lichess). */
export function moveAccuracy(loss: number): number {
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));
}

export function classify(loss: number): MoveClass {
  if (loss >= 15) return 'gaffe';
  if (loss >= 10) return 'erreur';
  if (loss >= 5) return 'imprecision';
  return loss < 2 ? 'meilleur' : 'bon';
}

const fenKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

function uciToSan(fen: string, uci: string | null): string | null {
  if (!uci) return null;
  return ChessGame.create(fen).playUci(uci)?.plies.at(-1)?.san ?? null;
}

export function reviewGame(game: ChessGame, evals: readonly PositionEval[], book: ReadonlySet<string> = new Set()): GameReview {
  if (evals.length !== game.length + 1) throw new Error(`Il faut une évaluation par position (${game.length + 1}), reçu ${evals.length}.`);
  const moves: MoveReview[] = [];
  const empty = (): Record<MoveClass, number> => ({ theorie: 0, meilleur: 0, bon: 0, imprecision: 0, erreur: 0, gaffe: 0 });
  const counts = { w: empty(), b: empty() };
  const whiteWin: number[] = [];

  evals.forEach((e) => {
    const turn = ChessGame.create(e.fen).turn;
    const w = sideToMoveWin(e);
    whiteWin.push(turn === 'w' ? w : 100 - w);
  });

  game.plies.forEach((p, i) => {
    const before = evals[i]!;
    const after = evals[i + 1]!;
    const winBefore = sideToMoveWin(before);
    const winAfter = 100 - sideToMoveWin(after);
    const uci = `${p.from}${p.to}${p.promotion ?? ''}`;
    let loss = Math.max(0, winBefore - winAfter);
    if (before.best === uci) loss = 0;
    let cls = classify(loss);
    if (cls !== 'imprecision' && cls !== 'erreur' && cls !== 'gaffe' && i < 30 && book.has(fenKey(p.fenAfter))) cls = 'theorie';
    const prev = moves[i - 1];
    const missed = loss >= 10 && winBefore >= 60 && !!prev && prev.loss >= 10;
    moves.push({
      ply: p.ply,
      color: p.color,
      san: p.san,
      uci,
      fenBefore: p.fenBefore,
      fenAfter: p.fenAfter,
      winBefore,
      winAfter,
      loss,
      cls,
      missed,
      accuracy: moveAccuracy(loss),
      bestUci: before.best,
      bestSan: uciToSan(p.fenBefore, before.best),
    });
    counts[p.color][cls]++;
  });

  const acc = (c: Color) => {
    const list = moves.filter((m) => m.color === c);
    return list.length ? Math.round((list.reduce((s, m) => s + m.accuracy, 0) / list.length) * 10) / 10 : 0;
  };
  return { moves, accuracy: { w: acc('w'), b: acc('b') }, counts, whiteWin };
}

/** Moments critiques d'un camp : ses erreurs et gaffes les plus coûteuses (3 au plus), dans l'ordre de la partie. */
export function criticalMoments(review: GameReview, color: Color, max = 3): MoveReview[] {
  return review.moves
    .filter((m) => m.color === color && (m.loss >= 10 || m.missed))
    .sort((a, b) => b.loss - a.loss)
    .slice(0, max)
    .sort((a, b) => a.ply - b.ply);
}

/** Positions connues de la bibliothèque d'ouvertures (pour reconnaître les coups de théorie). */
export function buildBook(lines: readonly string[][]): Set<string> {
  const book = new Set<string>();
  for (const sans of lines) {
    try {
      for (const p of ChessGame.fromSan(sans).plies) book.add(fenKey(p.fenAfter));
    } catch {
      /* ligne invalide ignorée (les tests garantissent qu'il n'y en a pas) */
    }
  }
  return book;
}
