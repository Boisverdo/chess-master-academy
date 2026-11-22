/**
 * Solution expliquée pas à pas : une étape par demi-coup, avec une phrase de l'entraîneur
 * et les marques à dessiner sur l'échiquier. Tout est calculé sur la position réelle
 * (prises, échecs, nombre de coups légaux, pièces attaquées) : rien n'est inventé.
 */
import { Chess } from 'chess.js';
import { ChessGame, type Color, type PieceSymbol, type Ply, type Square } from '../../core/game';
import { PIECE_NAMES_FR } from '../../core/notation';
import { materialBalance, VALUES, type PuzzleRun } from './puzzle';

export interface WalkShape {
  orig: string;
  dest?: string;
  brush: 'green' | 'blue' | 'red' | 'yellow';
}

export interface WalkStep {
  /** Position affichée (après le coup de l'étape). */
  fen: string;
  lastMove?: [string, string];
  shapes: WalkShape[];
  /** Coup de l'étape (absent pour l'étape d'introduction). */
  ply?: Ply;
  mine: boolean;
  /** Phrase de l'entraîneur, lisible à voix haute (pas de symboles). */
  text: string;
}

const FEM = new Set<PieceSymbol>(['q', 'r']);
const name = (p: PieceSymbol) => PIECE_NAMES_FR[p]!.toLowerCase();
const the = (p: PieceSymbol) => `${FEM.has(p) ? 'la' : 'le'} ${name(p)}`;
const my = (p: PieceSymbol) => `${FEM.has(p) ? 'ta' : 'ton'} ${name(p)}`;
const his = (p: PieceSymbol) => `${FEM.has(p) ? 'sa' : 'son'} ${name(p)}`;
const side = (c: Color) => (c === 'w' ? 'Blancs' : 'Noirs');
const pts = (n: number) => `${n} point${n > 1 ? 's' : ''}`;

function legalCount(fen: string): number {
  return new Chess(fen).moves().length;
}

/** Cases des pièces adverses de valeur (≥ 3, ou le roi) attaquées par la pièce arrivée sur `square`. */
export function attackedSquares(fen: string, square: Square, color: Color): { square: Square; type: PieceSymbol }[] {
  const game = ChessGame.create(fen);
  const out: { square: Square; type: PieceSymbol }[] = [];
  for (let r = 1; r <= 8; r++) {
    for (const f of 'abcdefgh') {
      const sq = `${f}${r}` as Square;
      const piece = game.pieceAt(sq);
      if (!piece || piece.color === color || (VALUES[piece.type] < 3 && piece.type !== 'k')) continue;
      if (game.attackers(sq, color).includes(square)) out.push({ square: sq, type: piece.type });
    }
  }
  return out;
}

/** Description du déplacement : « ta dame va de h5 à g5 et prend le pion ». */
function describeMove(ply: Ply, mine: boolean): string {
  const owner = mine ? my : his;
  if (ply.isCastle) return `${mine ? 'tu roques' : 'il roque'} ${ply.to[0] === 'g' ? 'côté roi' : 'côté dame'}`;
  let s = `${owner(ply.piece)} va de ${ply.from} à ${ply.to}`;
  if (ply.isEnPassant) s += ' et prend le pion en passant';
  else if (ply.captured) s += ` et prend ${mine ? the(ply.captured) : my(ply.captured)}`;
  if (ply.promotion) s += ` : le pion devient ${FEM.has(ply.promotion) ? 'une' : 'un'} ${name(ply.promotion)}`;
  return s;
}

function kingSquare(game: ChessGame, color: Color): Square {
  for (let r = 1; r <= 8; r++) {
    for (const f of 'abcdefgh') {
      const p = game.pieceAt(`${f}${r}` as Square);
      if (p?.type === 'k' && p.color === color) return `${f}${r}` as Square;
    }
  }
  throw new Error('Roi introuvable');
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Étapes de la solution complète (l'exercice doit avoir été joué ou révélé jusqu'au bout). */
export function solutionSteps(run: PuzzleRun): WalkStep[] {
  const plies = run.game.plies;
  const steps: WalkStep[] = [];
  const first = plies[0];
  if (!first) return steps;
  const me = run.player;

  // Introduction : la position à résoudre, avec le coup adverse qui vient d'être joué.
  steps.push({
    fen: first.fenAfter,
    lastMove: [first.from, first.to],
    shapes: [{ orig: first.from, dest: first.to, brush: 'blue' }],
    mine: false,
    text: `Voici la position de départ. L’adversaire vient de jouer : ${describeMove(first, false)}. C’est aux ${side(me)} de jouer. Regardons la solution coup par coup.`,
  });

  for (let i = 1; i < plies.length; i++) {
    const ply = plies[i]!;
    const mine = ply.color === me;
    const next = plies[i + 1];
    const prev = plies[i - 1];
    const after = ChessGame.create(ply.fenAfter);
    const status = after.status();
    const mate = status.termination === 'checkmate';
    const shapes: WalkShape[] = [{ orig: ply.from, dest: ply.to, brush: mine ? 'green' : 'blue' }];
    const parts: string[] = [];

    if (mine) {
      parts.push(`${i === 1 ? 'Premier coup' : 'Tu joues'} : ${describeMove(ply, true)}.`);
      if (mate) {
        parts.push('Échec et mat ! Le roi adverse est attaqué et n’a aucun moyen d’y échapper.');
      } else {
        if (status.inCheck) parts.push('Échec !');
        // Sacrifice : la pièce jouée est prise au coup suivant de la solution et vaut plus que ce qu'elle a pris.
        const given = VALUES[ply.piece];
        const got = ply.captured ? VALUES[ply.captured] : 0;
        if (next && next.to === ply.to && next.captured && ply.piece !== 'k' && given > got) {
          shapes.push({ orig: ply.to, brush: 'yellow' });
          const taken = FEM.has(ply.piece) ? 'elle sera reprise' : 'il sera repris';
          parts.push(
            ply.captured
              ? `C’est un sacrifice : ${my(ply.piece)} vaut ${pts(given)}, ${the(ply.captured)} seulement ${pts(got)}, et ${taken} au coup suivant.`
              : `C’est un sacrifice : ${my(ply.piece)}, qui vaut ${pts(given)}, se laisse prendre.`,
          );
        }
        const targets = attackedSquares(ply.fenAfter, ply.to, ply.color).filter((t) => t.type !== 'k');
        for (const t of targets) shapes.push({ orig: t.square, brush: 'red' });
        if (targets.length >= 2) parts.push(`${cap(my(ply.piece))} attaque à la fois ${targets.map((t) => `${the(t.type)} en ${t.square}`).join(' et ')}.`);
        else if (targets.length === 1 && !status.inCheck) parts.push(`${cap(my(ply.piece))} menace ${the(targets[0]!.type)} en ${targets[0]!.square}.`);
        const replies = legalCount(ply.fenAfter);
        if (replies === 1) parts.push('L’adversaire n’a plus qu’un seul coup légal.');
        else if (status.inCheck && replies <= 3) parts.push(`L’adversaire n’a que ${replies} coups légaux pour parer l’échec.`);
      }
    } else {
      const before = ChessGame.create(ply.fenBefore);
      const checkers = before.status().inCheck ? before.attackers(kingSquare(before, ply.color), me) : [];
      const why = !checkers.length
        ? ''
        : ply.piece === 'k'
          ? ' pour échapper à l’échec'
          : checkers.includes(ply.to)
            ? ' : il élimine la pièce qui donnait échec'
            : ' pour bloquer l’échec';
      parts.push(`L’adversaire répond : ${describeMove(ply, false)}${why}.`);
      if (legalCount(ply.fenBefore) === 1) parts.push('C’était son seul coup légal : il était forcé.');
      if (prev && ply.captured && prev.to === ply.to && prev.color === me && VALUES[prev.piece] > (prev.captured ? VALUES[prev.captured] : 0)) {
        parts.push('Il accepte le sacrifice.');
      }
      if (status.inCheck) parts.push('Attention : c’est échec pour toi.');
    }

    if (i === plies.length - 1 && !mate) {
      const gain = materialBalance(ply.fenAfter, me) - materialBalance(run.startFen, me);
      parts.push(gain > 0 ? `Fin de la solution : tu as gagné l’équivalent de ${pts(gain)} de matériel.` : 'Fin de la solution.');
    }

    steps.push({ fen: ply.fenAfter, lastMove: [ply.from, ply.to], shapes, ply, mine, text: parts.join(' ') });
  }
  return steps;
}
