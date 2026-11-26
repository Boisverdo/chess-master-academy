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
  /** Étiquette du camp (démonstrations sans « toi ») : remplace « Ton coup » / « Réponse de l'adversaire ». */
  who?: string;
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

/** Fin de partie atteinte dans la position (phrase factuelle), ou chaîne vide. */
function endingText(game: ChessGame, me: Color): string {
  const s = game.status();
  if (!s.over) return '';
  switch (s.termination) {
    case 'checkmate':
      return game.turn === me ? 'Échec et mat : tu as perdu.' : 'Échec et mat ! Le roi adverse est attaqué et n’a aucune case libre.';
    case 'stalemate':
      return 'Pat : le camp au trait n’a aucun coup légal sans être en échec. La partie est nulle.';
    case 'insufficient-material':
      return 'Il ne reste pas assez de matériel pour mater : la partie est nulle.';
    case 'threefold-repetition':
      return 'La même position est apparue trois fois : la partie est nulle par répétition.';
    default:
      return 'La partie est nulle.';
  }
}

/**
 * Solution d'un exercice de leçon joué contre l'ordinateur : une ligne écrite à l'avance
 * (coups en SAN anglaise, validés par les tests) avec le commentaire de l'entraîneur pour chacun de TES coups.
 * Les réponses adverses sont décrites automatiquement à partir de la position réelle.
 */
export function lineSteps(startFen: string, line: { san: string; comment?: string }[], intro: string, outro?: string): WalkStep[] {
  const game = ChessGame.fromSan(line.map((m) => m.san), startFen);
  const me = ChessGame.create(startFen).turn;
  const steps: WalkStep[] = [{ fen: startFen, shapes: [], mine: false, text: intro }];
  game.plies.forEach((ply, i) => {
    const mine = ply.color === me;
    const after = ChessGame.create(ply.fenAfter);
    const parts: string[] = [];
    if (mine) {
      parts.push(`${i === 0 ? 'Premier coup' : 'Tu joues'} : ${describeMove(ply, true)}.`);
      if (after.status().inCheck && after.status().termination !== 'checkmate') parts.push('Échec !');
      const comment = line[i]!.comment;
      if (comment) parts.push(comment);
    } else {
      const before = ChessGame.create(ply.fenBefore);
      const inCheck = before.status().inCheck;
      parts.push(`L’adversaire répond : ${describeMove(ply, false)}${inCheck && ply.piece === 'k' ? ' pour échapper à l’échec' : ''}.`);
      if (legalCount(ply.fenBefore) === 1) parts.push('C’était son seul coup légal.');
      if (after.status().inCheck && after.status().termination !== 'checkmate') parts.push('Attention : c’est échec pour toi.');
      if (line[i]!.comment) parts.push(line[i]!.comment!);
    }
    // La fin de partie se juge sur la partie entière (la répétition dépend de l'historique).
    const end = i === game.plies.length - 1 ? endingText(game, me) : '';
    if (end) parts.push(end);
    if (i === game.plies.length - 1 && outro) parts.push(outro);
    steps.push({ fen: ply.fenAfter, lastMove: [ply.from, ply.to], shapes: [{ orig: ply.from, dest: ply.to, brush: mine ? 'green' : 'blue' }], ply, mine, text: parts.join(' ') });
  });
  return steps;
}

const COLOR_ADJ: Record<Color, { m: string; f: string }> = { w: { m: 'blanc', f: 'blanche' }, b: { m: 'noir', f: 'noire' } };
/** « la dame blanche », « le pion noir ». */
const colored = (p: PieceSymbol, c: Color) => `${the(p)} ${FEM.has(p) ? COLOR_ADJ[c].f : COLOR_ADJ[c].m}`;

/** Description neutre : « le roi noir va de e2 à d1 », « la dame blanche va de h1 à c2 et prend le pion noir ». */
function describeNeutral(ply: Ply): string {
  if (ply.isCastle) return `ils roquent ${ply.to[0] === 'g' ? 'côté roi' : 'côté dame'}`;
  const other: Color = ply.color === 'w' ? 'b' : 'w';
  let s = `${colored(ply.piece, ply.color)} va de ${ply.from} à ${ply.to}`;
  if (ply.isEnPassant) s += ' et prend le pion en passant';
  else if (ply.captured) s += ` et prend ${colored(ply.captured, other)}`;
  if (ply.promotion) s += ` : le pion devient ${FEM.has(ply.promotion) ? 'une' : 'un'} ${name(ply.promotion)}`;
  return s;
}

/** Fin de partie, racontée sans « toi » ni « l'adversaire ». */
function neutralEnding(game: ChessGame): string {
  const s = game.status();
  if (!s.over) return '';
  if (s.termination === 'checkmate') return `Échec et mat : les ${side(game.turn === 'w' ? 'b' : 'w')} gagnent.`;
  return endingText(game, game.turn);
}

/**
 * Démonstration commentée d'une position de leçon (question « quel est le résultat ? ») : les deux camps
 * sont nommés par leur couleur, et chaque coup peut porter un commentaire de l'entraîneur.
 */
export function demoLineSteps(startFen: string, line: { san: string; comment?: string }[], intro: string, outro?: string): WalkStep[] {
  const game = ChessGame.fromSan(line.map((m) => m.san), startFen);
  const first = ChessGame.create(startFen).turn;
  const steps: WalkStep[] = [{ fen: startFen, shapes: [], mine: false, text: intro }];
  game.plies.forEach((ply, i) => {
    const after = ChessGame.create(ply.fenAfter);
    const before = ChessGame.create(ply.fenBefore);
    const parts = [`Les ${side(ply.color)} jouent : ${describeNeutral(ply)}${before.status().inCheck && ply.piece === 'k' ? ' pour échapper à l’échec' : ''}.`];
    if (after.status().inCheck && after.status().termination !== 'checkmate') parts.push('Échec !');
    if (legalCount(ply.fenBefore) === 1) parts.push('C’était le seul coup légal.');
    if (line[i]!.comment) parts.push(line[i]!.comment!);
    if (i === game.plies.length - 1) {
      const end = neutralEnding(game);
      if (end) parts.push(end);
      if (outro) parts.push(outro);
    }
    const mine = ply.color === first;
    steps.push({ fen: ply.fenAfter, lastMove: [ply.from, ply.to], shapes: [{ orig: ply.from, dest: ply.to, brush: mine ? 'green' : 'blue' }], ply, mine, text: parts.join(' '), who: `Les ${side(ply.color)}` });
  });
  return steps;
}
