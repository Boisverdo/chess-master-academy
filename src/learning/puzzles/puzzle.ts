/**
 * Déroulement d'un exercice tactique (format Lichess : le 1er coup est celui de l'adversaire,
 * le joueur doit ensuite trouver chaque coup de la solution).
 * Toutes les explications sont calculées sur l'échiquier réel.
 */
import { ChessGame, type Color, type PieceSymbol, type PromotionPiece, type Square } from '../../core/game';
import { PIECE_NAMES_FR } from '../../core/notation';

export interface Puzzle {
  id: string;
  fen: string;
  moves: string;
  rating: number;
  themes: string[];
}

export const VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const splitUci = (u: string) => ({ from: u.slice(0, 2) as Square, to: u.slice(2, 4) as Square, promotion: (u[4] as PromotionPiece | undefined) || undefined });

export type MoveOutcome = 'correct' | 'solved' | 'wrong' | 'illegal';

export class PuzzleRun {
  readonly solution: string[];
  /** Partie depuis la position initiale du puzzle (coup adverse de départ inclus après `start()`). */
  game: ChessGame;
  /** Index, dans `solution`, du prochain coup attendu. */
  cursor = 0;
  readonly player: Color;

  constructor(readonly puzzle: Puzzle) {
    this.solution = puzzle.moves.trim().split(/\s+/);
    this.game = ChessGame.create(puzzle.fen);
    // Le joueur est le camp qui NE joue PAS le premier coup.
    this.player = this.game.turn === 'w' ? 'b' : 'w';
  }

  /** Joue le coup adverse de départ. */
  start(): void {
    if (this.cursor !== 0) return;
    this.apply(this.solution[0]!);
    this.cursor = 1;
  }

  get done(): boolean {
    return this.cursor >= this.solution.length;
  }

  expected(): string | undefined {
    return this.solution[this.cursor];
  }

  /** Nombre de coups que le joueur doit trouver. */
  get playerMoves(): number {
    return Math.floor(this.solution.length / 2);
  }

  /** Position où le joueur commence à réfléchir (après le coup adverse de départ). */
  get startFen(): string {
    return this.game.fenAt(1);
  }

  private apply(uci: string): void {
    const { from, to, promotion } = splitUci(uci);
    const next = this.game.play(from, to, promotion);
    if (!next) throw new Error(`Coup de solution illégal : ${uci} (exercice ${this.puzzle.id})`);
    this.game = next;
  }

  /**
   * Coup du joueur. Comme sur Lichess, un autre coup qui donne mat au dernier coup est accepté.
   * Après un bon coup (non final), la réponse adverse est jouée automatiquement.
   */
  play(uci: string): MoveOutcome {
    const exp = this.expected();
    if (!exp) return 'illegal';
    const { from, to, promotion } = splitUci(uci);
    const after = this.game.play(from, to, promotion);
    if (!after) return 'illegal';
    const isLast = this.cursor === this.solution.length - 1;
    if (uci !== exp && !(isLast && after.status().termination === 'checkmate')) return 'wrong';
    this.game = after;
    this.cursor++;
    if (this.done) return 'solved';
    this.apply(this.solution[this.cursor]!);
    this.cursor++;
    return this.done ? 'solved' : 'correct';
  }

  /** Joue toute la suite restante (après abandon ou pour montrer la solution). */
  revealAll(): void {
    while (!this.done) {
      this.apply(this.solution[this.cursor]!);
      this.cursor++;
    }
  }
}

/** Bilan matériel (points) du point de vue de `color`. */
export function materialBalance(fen: string, color: Color): number {
  let total = 0;
  const placement = fen.split(' ')[0]!;
  for (const ch of placement) {
    const lower = ch.toLowerCase();
    if (!(lower in VALUES)) continue;
    const isWhite = ch !== lower;
    const v = VALUES[lower as PieceSymbol];
    total += (isWhite ? 1 : -1) * (color === 'w' ? 1 : -1) * v;
  }
  return total;
}

/** Explication factuelle du premier coup du joueur et des conséquences de la solution. */
export function explainSolution(run: PuzzleRun): string[] {
  const facts: string[] = [];
  const keyPly = run.game.plies[1];
  if (keyPly) {
    const after = ChessGame.create(keyPly.fenAfter);
    const parts: string[] = [];
    if (keyPly.captured) parts.push(`prend ${article(keyPly.captured)}`);
    if (after.status().termination === 'checkmate') parts.push('fait échec et mat');
    else if (after.status().inCheck) parts.push('donne échec');
    // Après un mat, inutile de lister les cibles ; un échec seul est déjà annoncé.
    const targets = after.status().termination === 'checkmate' ? [] : attackedTargets(keyPly.fenAfter, keyPly.to, keyPly.color);
    if (targets.length >= 2) parts.push(`attaque à la fois ${targets.map(article).join(' et ')}`);
    else if (targets.length === 1 && targets[0] !== 'k' && !keyPly.captured) parts.push(`attaque ${article(targets[0]!)}`);
    if (parts.length) facts.push(`Le coup clé ${parts.join(', ')}.`);
  }
  const end = run.game.status();
  if (end.termination === 'checkmate') facts.push('La suite se termine par un échec et mat.');
  else {
    const gain = materialBalance(run.game.fen, run.player) - materialBalance(run.startFen, run.player);
    if (gain > 0) facts.push(`Bilan de la suite : tu gagnes l’équivalent de ${gain} point${gain > 1 ? 's' : ''} de matériel.`);
  }
  return facts;
}

function article(p: PieceSymbol): string {
  const name = PIECE_NAMES_FR[p]!.toLowerCase();
  return p === 'q' || p === 'r' ? `la ${name}` : `le ${name}`;
}

/** Pièces adverses de valeur (≥ 3, ou le roi) attaquées par la pièce arrivée sur `square`. */
export function attackedTargets(fen: string, square: Square, color: Color): PieceSymbol[] {
  const game = ChessGame.create(fen);
  const out: PieceSymbol[] = [];
  const files = 'abcdefgh';
  for (let r = 1; r <= 8; r++) {
    for (const f of files) {
      const sq = `${f}${r}` as Square;
      const piece = game.pieceAt(sq);
      if (!piece || piece.color === color || (VALUES[piece.type] < 3 && piece.type !== 'k')) continue;
      if (game.attackers(sq, color).includes(square)) out.push(piece.type);
    }
  }
  return out;
}
