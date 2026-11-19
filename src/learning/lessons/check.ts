/**
 * Vérification des coups des exercices de leçon. Tout est calculé avec le noyau de règles :
 * aucun retour n'est inventé.
 */
import { ChessGame, type PromotionPiece, type Square } from '../../core/game';
import { formatSan } from '../../core/notation';
import type { MoveStep } from './types';

export interface MoveVerdict {
  ok: boolean;
  /** Message pédagogique expliquant le résultat. */
  message: string;
  /** Partie après le coup (si le coup est légal). */
  after?: ChessGame;
}

export const uciOf = (from: string, to: string, promotion?: string) => `${from}${to}${promotion ?? ''}`;

function opponentMateInOne(game: ChessGame): string | null {
  for (const [from, tos] of game.legalDests()) {
    for (const to of tos) {
      const promos: (PromotionPiece | undefined)[] = game.isPromotion(from, to) ? ['q', 'r', 'b', 'n'] : [undefined];
      for (const p of promos) {
        const next = game.play(from, to, p);
        if (next?.status().termination === 'checkmate') return next.plies.at(-1)!.san;
      }
    }
  }
  return null;
}

function meetsGoal(step: MoveStep, after: ChessGame): boolean {
  const ply = after.plies.at(-1)!;
  const s = after.status();
  switch (step.goal) {
    case 'mate':
      return s.termination === 'checkmate';
    case 'check':
      return s.inCheck;
    case 'castle':
      return ply.isCastle;
    case 'en-passant':
      return ply.isEnPassant;
    case 'promotion':
      return ply.promotion !== undefined;
    case 'prevent-mate':
      return opponentMateInOne(after) === null;
    case 'exact':
      return true;
  }
}

/** Explique pourquoi un coup légal n'atteint pas l'objectif, à partir de la position réelle. */
function explainMiss(step: MoveStep, after: ChessGame): string {
  const s = after.status();
  const fmt = (san: string, color: 'w' | 'b') => formatSan(san, color, 'french');
  if (step.goal === 'mate') {
    if (s.termination === 'stalemate') return 'Pat ! Le roi adverse n’est pas en échec mais n’a plus aucun coup légal : la partie est nulle. Laisse-lui une case… ou trouve le mat.';
    if (!s.inCheck) return 'Ce coup ne met pas le roi adverse en échec, donc ce ne peut pas être un mat.';
    const reply = after.plies.length ? firstLegalReply(after) : null;
    return reply ? `Échec, mais pas mat : l’adversaire peut répondre ${fmt(reply, after.turn)}.` : 'Échec, mais pas mat.';
  }
  if (step.goal === 'check') return 'Ce coup ne donne pas échec au roi adverse.';
  if (step.goal === 'castle') return 'Ce coup n’est pas un roque. Pour roquer, déplace le roi de deux cases vers la tour.';
  if (step.goal === 'en-passant') return 'Ce n’est pas une prise en passant : le pion doit prendre en diagonale, sur la case que le pion adverse vient de franchir.';
  if (step.goal === 'promotion') return 'Ce coup ne fait pas de promotion : amène un pion sur la dernière rangée.';
  if (step.goal === 'prevent-mate') {
    const mate = opponentMateInOne(after);
    return mate ? `Après ce coup, l’adversaire fait mat avec ${fmt(mate, after.turn)}.` : '';
  }
  return 'Ce n’est pas le coup attendu dans cet exercice.';
}

function firstLegalReply(game: ChessGame): string | null {
  for (const [from, tos] of game.legalDests()) {
    const to = tos[0];
    if (to) return game.play(from, to, game.isPromotion(from, to) ? 'q' : undefined)?.plies.at(-1)?.san ?? null;
  }
  return null;
}

export function checkMove(step: MoveStep, from: Square, to: Square, promotion?: PromotionPiece): MoveVerdict {
  const game = ChessGame.create(step.fen);
  const after = game.play(from, to, promotion);
  if (!after) return { ok: false, message: 'Ce coup est illégal.' };
  const uci = uciOf(from, to, promotion);
  if (step.reject?.[uci]) return { ok: false, message: step.reject[uci]!, after };
  if (step.accept && !step.accept.includes(uci)) {
    return { ok: false, message: step.wrong?.[uci] ?? (meetsGoal(step, after) || step.goal === 'exact' ? 'Ce n’est pas le coup attendu dans cet exercice.' : explainMiss(step, after)), after };
  }
  if (!meetsGoal(step, after)) return { ok: false, message: step.wrong?.[uci] ?? explainMiss(step, after), after };
  return { ok: true, message: step.success, after };
}

/** Tous les coups qui résolvent l'exercice (pour « Voir la solution » et pour les tests). */
export function solutions(step: MoveStep): string[] {
  const game = ChessGame.create(step.fen);
  const out: string[] = [];
  for (const [from, tos] of game.legalDests()) {
    for (const to of tos) {
      const promos: (PromotionPiece | undefined)[] = game.isPromotion(from, to) ? ['q', 'r', 'b', 'n'] : [undefined];
      for (const p of promos) if (checkMove(step, from, to, p).ok) out.push(uciOf(from, to, p));
    }
  }
  return out;
}
