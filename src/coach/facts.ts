/** Faits échiquéens calculés sur une position réelle (aucune supposition). */
import { ChessGame, type Color, type PieceSymbol, type Square } from '../core/game';
import { PIECE_NAMES_FR } from '../core/notation';
import { attackedTargets, materialBalance, VALUES } from '../learning/puzzles/puzzle';

export function pieceName(p: PieceSymbol, withArticle = true): string {
  const name = PIECE_NAMES_FR[p]!.toLowerCase();
  if (!withArticle) return name;
  return p === 'q' || p === 'r' ? `ta ${name}` : `ton ${name}`;
}

export function theirPiece(p: PieceSymbol): string {
  const name = PIECE_NAMES_FR[p]!.toLowerCase();
  return p === 'q' || p === 'r' ? `la ${name}` : `le ${name}`;
}

export interface MoveFacts {
  san: string;
  piece: PieceSymbol;
  to: Square;
  captured?: PieceSymbol;
  check: boolean;
  mate: boolean;
  /** Pièces adverses de valeur (hors roi : l'échec est signalé à part) attaquées par la pièce jouée. */
  targets: PieceSymbol[];
}

export function moveFacts(fen: string, uci: string): MoveFacts | null {
  const g = ChessGame.create(fen).playUci(uci);
  if (!g) return null;
  const p = g.plies.at(-1)!;
  const s = g.status();
  return {
    san: p.san,
    piece: p.piece,
    to: p.to,
    captured: p.captured,
    check: s.inCheck,
    mate: s.termination === 'checkmate',
    targets: s.termination === 'checkmate' ? [] : attackedTargets(p.fenAfter, p.to, p.color).filter((t) => t !== 'k'),
  };
}

/** Variation principale convertie en SAN (s'arrête au premier coup invalide). */
export function pvToSan(fen: string, pv: readonly string[], max = 8): string[] {
  let g = ChessGame.create(fen);
  const out: string[] = [];
  for (const u of pv.slice(0, max)) {
    const n = g.playUci(u);
    if (!n) break;
    out.push(n.plies.at(-1)!.san);
    g = n;
  }
  return out;
}

/** Variation de matériel (points) pour `color` en jouant la variante `pv` depuis `fen`. */
export function materialSwing(fen: string, pv: readonly string[], color: Color, plies = 6): number {
  let g = ChessGame.create(fen);
  for (const u of pv.slice(0, plies)) {
    const n = g.playUci(u);
    if (!n) break;
    g = n;
  }
  return materialBalance(g.fen, color) - materialBalance(fen, color);
}

/**
 * Pièces de `color` (valeur ≥ 3) attaquées et insuffisamment défendues :
 * non défendues, ou attaquées par une pièce de moindre valeur.
 */
export function loosePieces(fen: string, color: Color): { square: Square; piece: PieceSymbol }[] {
  const g = ChessGame.create(fen);
  const enemy: Color = color === 'w' ? 'b' : 'w';
  const out: { square: Square; piece: PieceSymbol }[] = [];
  for (const f of 'abcdefgh') {
    for (let r = 1; r <= 8; r++) {
      const sq = `${f}${r}` as Square;
      const piece = g.pieceAt(sq);
      if (!piece || piece.color !== color || piece.type === 'k' || VALUES[piece.type] < 3) continue;
      const attackers = g.attackers(sq, enemy);
      if (!attackers.length) continue;
      const defenders = g.attackers(sq, color);
      const cheapest = Math.min(...attackers.map((a) => VALUES[g.pieceAt(a)!.type] || 100));
      if (defenders.length === 0 || cheapest < VALUES[piece.type]) out.push({ square: sq, piece: piece.type });
    }
  }
  return out;
}

/** Matériel hors pions et rois d'un camp (pour repérer les finales). */
export function pieceMaterial(fen: string, color: Color): number {
  let total = 0;
  for (const ch of fen.split(' ')[0]!) {
    const lower = ch.toLowerCase();
    if (!'nbrq'.includes(lower)) continue;
    if ((ch !== lower) === (color === 'w')) total += VALUES[lower as PieceSymbol];
  }
  return total;
}
