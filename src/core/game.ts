/**
 * Noyau des règles de CHESS MASTER ACADEMY.
 *
 * Toute la logique de règles passe par chess.js (BSD-2-Clause). Ce module est la
 * seule porte d'entrée : l'interface ne manipule jamais chess.js directement.
 * Un `ChessGame` est immuable : chaque action renvoie une nouvelle instance.
 */
import { Chess, DEFAULT_POSITION, validateFen, type Color, type PieceSymbol, type Square } from 'chess.js';

export type { Color, PieceSymbol, Square };
export const START_FEN = DEFAULT_POSITION;

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export type Termination =
  | 'checkmate'
  | 'stalemate'
  | 'threefold-repetition'
  | 'fifty-move-rule'
  | 'insufficient-material'
  | 'resignation'
  | 'agreement'
  /** Temps écoulé à la pendule. */
  | 'timeout'
  /** Temps écoulé, mais l'adversaire n'a plus de quoi mater : nulle. */
  | 'timeout-draw'
  /** Partie importée qui se termine sans fin « sur l'échiquier » (abandon, temps…). */
  | 'recorded-result';

export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';

export interface GameStatus {
  over: boolean;
  result: GameResult;
  termination?: Termination;
  /** Camp au trait dans la position finale. */
  turn: Color;
  inCheck: boolean;
}

export interface Ply {
  /** 1 = premier demi-coup joué. */
  ply: number;
  color: Color;
  san: string;
  from: Square;
  to: Square;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  fenBefore: string;
  fenAfter: string;
  isCastle: boolean;
  isEnPassant: boolean;
}

interface ManualEnd {
  termination: 'resignation' | 'agreement' | 'recorded-result' | 'timeout' | 'timeout-draw';
  result: Exclude<GameResult, '*'>;
}

export class RulesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RulesError';
  }
}

const RESULTS: readonly GameResult[] = ['1-0', '0-1', '1/2-1/2', '*'];

function replay(startFen: string, plies: readonly { from: string; to: string; promotion?: string }[]): Chess {
  const chess = new Chess(startFen);
  for (const p of plies) chess.move({ from: p.from, to: p.to, promotion: p.promotion });
  return chess;
}

export class ChessGame {
  private readonly chess: Chess;
  readonly plies: readonly Ply[];

  private constructor(
    readonly startFen: string,
    chess: Chess,
    private readonly headerMap: Readonly<Record<string, string>>,
    private readonly manualEnd?: ManualEnd,
  ) {
    this.chess = chess;
    this.plies = chess.history({ verbose: true }).map((m, i) => ({
      ply: i + 1,
      color: m.color,
      san: m.san,
      from: m.from,
      to: m.to,
      piece: m.piece,
      captured: m.captured,
      promotion: m.promotion,
      fenBefore: m.before,
      fenAfter: m.after,
      isCastle: m.isKingsideCastle() || m.isQueensideCastle(),
      isEnPassant: m.isEnPassant(),
    }));
  }

  /** Nouvelle partie depuis la position initiale ou une position FEN valide. */
  static create(startFen: string = START_FEN, headers: Record<string, string> = {}): ChessGame {
    const check = validateFen(startFen);
    if (!check.ok) throw new RulesError(`Position FEN invalide : ${check.error ?? 'format incorrect'}`);
    const chess = new Chess(startFen);
    // Position impossible : le roi du camp qui N'a PAS le trait est en échec (il aurait été pris).
    const idle: Color = chess.turn() === 'w' ? 'b' : 'w';
    const king = chess.findPiece({ type: 'k', color: idle })[0];
    if (king && chess.isAttacked(king, chess.turn())) throw new RulesError('Position impossible : le roi du camp qui n’a pas le trait est en échec.');
    return new ChessGame(startFen, chess, { ...headers });
  }

  /** Reconstruit une partie à partir d'une suite de coups SAN (ex. ["e4", "e5", "Cf3"] en notation anglaise). */
  static fromSan(sans: readonly string[], startFen: string = START_FEN): ChessGame {
    let game = ChessGame.create(startFen);
    sans.forEach((san, i) => {
      const next = game.playSan(san);
      if (!next) throw new RulesError(`Coup illégal ou invalide au demi-coup ${i + 1} : « ${san} »`);
      game = next;
    });
    return game;
  }

  /** Reconstruit une partie à partir de coups UCI (ex. « e2e4 », « e7e8q »). */
  static fromUci(ucis: readonly string[], startFen: string = START_FEN): ChessGame {
    let game = ChessGame.create(startFen);
    ucis.forEach((u, i) => {
      const next = game.playUci(u);
      if (!next) throw new RulesError(`Coup UCI illégal au demi-coup ${i + 1} : « ${u} »`);
      game = next;
    });
    return game;
  }

  /** @internal utilisé par le module PGN. */
  static fromChess(chess: Chess, startFen: string, headers: Record<string, string>): ChessGame {
    const game = new ChessGame(startFen, replay(startFen, chess.history({ verbose: true })), headers);
    const recorded = headers['Result'] as GameResult | undefined;
    if (recorded && recorded !== '*' && RESULTS.includes(recorded) && !game.status().over) {
      return new ChessGame(startFen, game.chess, headers, { termination: 'recorded-result', result: recorded });
    }
    return game;
  }

  get headers(): Readonly<Record<string, string>> {
    return this.headerMap;
  }

  get length(): number {
    return this.plies.length;
  }

  get fen(): string {
    return this.chess.fen();
  }

  get turn(): Color {
    return this.chess.turn();
  }

  /** FEN après `ply` demi-coups (0 = position de départ). */
  fenAt(ply: number): string {
    if (ply <= 0) return this.startFen;
    const p = this.plies[Math.min(ply, this.plies.length) - 1];
    return p ? p.fenAfter : this.startFen;
  }

  /** Cases de destination légales, par case de départ, dans la position actuelle. */
  legalDests(): Map<Square, Square[]> {
    const dests = new Map<Square, Square[]>();
    if (this.status().over) return dests;
    for (const m of this.chess.moves({ verbose: true })) {
      const list = dests.get(m.from);
      if (list) {
        if (!list.includes(m.to)) list.push(m.to);
      } else dests.set(m.from, [m.to]);
    }
    return dests;
  }

  /** Vrai si le déplacement from→to est une promotion légale (il faudra choisir la pièce). */
  isPromotion(from: Square, to: Square): boolean {
    return this.chess.moves({ verbose: true, square: from }).some((m) => m.to === to && m.isPromotion());
  }

  isLegal(from: Square, to: Square, promotion?: PromotionPiece): boolean {
    return this.play(from, to, promotion) !== null;
  }

  /** Joue un coup. Renvoie `null` si le coup est illégal ou si la partie est terminée. */
  play(from: Square, to: Square, promotion?: PromotionPiece): ChessGame | null {
    if (this.status().over) return null;
    const needsPromo = this.isPromotion(from, to);
    if (needsPromo && !promotion) return null;
    if (!needsPromo && promotion) return null;
    const next = this.clone();
    try {
      next.move({ from, to, promotion });
    } catch {
      return null;
    }
    return new ChessGame(this.startFen, next, this.headerMap);
  }

  playSan(san: string): ChessGame | null {
    if (this.status().over) return null;
    const next = this.clone();
    try {
      next.move(san);
    } catch {
      return null;
    }
    return new ChessGame(this.startFen, next, this.headerMap);
  }

  /** Joue un coup en notation UCI. */
  playUci(uci: string): ChessGame | null {
    return this.play(uci.slice(0, 2) as Square, uci.slice(2, 4) as Square, (uci[4] as PromotionPiece | undefined) || undefined);
  }

  /**
   * Chute du drapeau. Simplification documentée de la règle FIDE : si l'adversaire n'a plus
   * qu'un roi, ou un roi et une seule pièce mineure sans pion, il ne peut pas mater : nulle.
   */
  timeout(loser: Color): ChessGame {
    if (this.status().over) return this;
    const winner = loser === 'w' ? 'b' : 'w';
    const pieces = this.chess
      .board()
      .flat()
      .filter((p): p is NonNullable<typeof p> => !!p && p.color === winner && p.type !== 'k');
    const cannotMate = pieces.length === 0 || (pieces.length === 1 && (pieces[0]!.type === 'n' || pieces[0]!.type === 'b'));
    return new ChessGame(this.startFen, this.clone(), this.headerMap, cannotMate
      ? { termination: 'timeout-draw', result: '1/2-1/2' }
      : { termination: 'timeout', result: loser === 'w' ? '0-1' : '1-0' });
  }

  /** Revient en arrière de `count` demi-coups (annule aussi un abandon ou une nulle). */
  undo(count = 1): ChessGame {
    const keep = Math.max(0, this.plies.length - count);
    return this.truncate(keep);
  }

  /** Conserve seulement les `ply` premiers demi-coups. */
  truncate(ply: number): ChessGame {
    const kept = this.plies.slice(0, Math.max(0, ply));
    return new ChessGame(this.startFen, replay(this.startFen, kept), this.headerMap);
  }

  resign(loser: Color): ChessGame {
    if (this.status().over) return this;
    return new ChessGame(this.startFen, this.clone(), this.headerMap, {
      termination: 'resignation',
      result: loser === 'w' ? '0-1' : '1-0',
    });
  }

  agreeDraw(): ChessGame {
    if (this.status().over) return this;
    return new ChessGame(this.startFen, this.clone(), this.headerMap, { termination: 'agreement', result: '1/2-1/2' });
  }

  withHeaders(headers: Record<string, string>): ChessGame {
    return new ChessGame(this.startFen, this.clone(), { ...this.headerMap, ...headers }, this.manualEnd);
  }

  /**
   * État de la partie. Ordre de priorité : fin manuelle, mat, pat, matériel
   * insuffisant, triple répétition, règle des 50 coups. (Le mat prime sur la règle
   * des 50 coups, conformément aux règles FIDE.)
   * Comme sur les plateformes en ligne, la triple répétition et les 50 coups
   * terminent la partie automatiquement (FIDE : nulle sur réclamation).
   */
  status(): GameStatus {
    const c = this.chess;
    const base = { turn: c.turn(), inCheck: c.inCheck() };
    if (this.manualEnd) return { ...base, over: true, result: this.manualEnd.result, termination: this.manualEnd.termination };
    if (c.isCheckmate()) return { ...base, over: true, result: c.turn() === 'w' ? '0-1' : '1-0', termination: 'checkmate' };
    if (c.isStalemate()) return { ...base, over: true, result: '1/2-1/2', termination: 'stalemate' };
    if (c.isInsufficientMaterial()) return { ...base, over: true, result: '1/2-1/2', termination: 'insufficient-material' };
    if (c.isThreefoldRepetition()) return { ...base, over: true, result: '1/2-1/2', termination: 'threefold-repetition' };
    if (c.isDrawByFiftyMoves()) return { ...base, over: true, result: '1/2-1/2', termination: 'fifty-move-rule' };
    return { ...base, over: false, result: '*' };
  }

  /** Pièce présente sur une case de la position actuelle. */
  pieceAt(square: Square): { color: Color; type: PieceSymbol } | undefined {
    return this.chess.get(square);
  }

  /** Cases des pièces de `color` qui attaquent `square` dans la position actuelle. */
  attackers(square: Square, color: Color): Square[] {
    return this.chess.attackers(square, color);
  }

  /** Copie de l'objet chess.js interne (pour le module PGN uniquement). */
  /** @internal */
  clone(): Chess {
    const copy = replay(this.startFen, this.plies);
    for (const [k, v] of Object.entries(this.headerMap)) copy.setHeader(k, v);
    return copy;
  }
}
