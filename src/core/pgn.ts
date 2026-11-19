/**
 * Import / export PGN. L'analyse syntaxique est déléguée à chess.js ;
 * ce module ajoute : découpage multi-parties, messages d'erreur en français,
 * rejet des variantes non standard, en-têtes par défaut à l'export.
 */
import { Chess } from 'chess.js';
import { ChessGame, START_FEN, RulesError } from './game';

export class PgnError extends Error {
  constructor(
    message: string,
    readonly gameIndex?: number,
  ) {
    super(message);
    this.name = 'PgnError';
  }
}

/** Découpe un texte contenant une ou plusieurs parties PGN. */
export function splitPgn(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/^﻿/, '').trim();
  if (!normalized) return [];
  const games: string[] = [];
  let current: string[] = [];
  let inMoves = false;
  for (const line of normalized.split('\n')) {
    const isHeader = /^\s*\[\w+\s+".*"\]\s*$/.test(line);
    if (isHeader && inMoves) {
      games.push(current.join('\n').trim());
      current = [];
      inMoves = false;
    }
    if (!isHeader && line.trim() !== '') inMoves = true;
    current.push(line);
  }
  if (current.join('').trim()) games.push(current.join('\n').trim());
  return games;
}

const SUPPORTED_VARIANTS = new Set(['', 'standard', 'chess', 'normal']);

/** Analyse une seule partie PGN. Lève `PgnError` avec un message clair en cas de problème. */
export function parsePgn(pgn: string, gameIndex?: number): ChessGame {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new PgnError(`Partie illisible ou coup illégal dans le PGN (${detail}).`, gameIndex);
  }
  const headers = chess.getHeaders();
  const variant = (headers['Variant'] ?? '').trim().toLowerCase();
  if (!SUPPORTED_VARIANTS.has(variant)) {
    throw new PgnError(`Variante « ${headers['Variant']} » non prise en charge (échecs classiques seulement).`, gameIndex);
  }
  const startFen = headers['SetUp'] === '1' && headers['FEN'] ? headers['FEN'] : START_FEN;
  try {
    return ChessGame.fromChess(chess, startFen, headers);
  } catch (e) {
    if (e instanceof RulesError) throw new PgnError(e.message, gameIndex);
    throw e;
  }
}

export interface PgnImportReport {
  games: ChessGame[];
  errors: PgnError[];
}

/** Importe toutes les parties d'un texte PGN ; les parties invalides sont signalées, pas ignorées en silence. */
export function importPgn(text: string): PgnImportReport {
  const chunks = splitPgn(text);
  const report: PgnImportReport = { games: [], errors: [] };
  if (chunks.length === 0) {
    report.errors.push(new PgnError('Aucune partie trouvée : le texte est vide.'));
    return report;
  }
  chunks.forEach((chunk, i) => {
    try {
      report.games.push(parsePgn(chunk, i));
    } catch (e) {
      report.errors.push(e instanceof PgnError ? e : new PgnError(String(e), i));
    }
  });
  return report;
}

function pgnDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** Exporte une partie au format PGN standard (notation anglaise, compatible avec tous les logiciels). */
export function exportPgn(game: ChessGame, now: Date = new Date()): string {
  const status = game.status();
  const defaults: Record<string, string> = {
    Event: 'Partie Chess Master Academy',
    Site: 'Chess Master Academy',
    Date: pgnDate(now),
    Round: '-',
    White: 'Blancs',
    Black: 'Noirs',
  };
  const chess = game.clone();
  const headers: Record<string, string> = { ...defaults, ...game.headers, Result: status.result };
  if (status.termination === 'resignation') headers['Termination'] = 'Abandon';
  if (status.termination === 'agreement') headers['Termination'] = 'Nulle par accord mutuel';
  if (status.termination === 'timeout' || status.termination === 'timeout-draw') headers['Termination'] = 'Temps écoulé';
  for (const [k, v] of Object.entries(headers)) chess.setHeader(k, v);
  let text = chess.pgn({ maxWidth: 80 });
  // chess.js n'ajoute le résultat en fin de partie que s'il est connu de lui ; on garantit sa présence.
  if (!text.trimEnd().endsWith(status.result)) text = `${text.trimEnd()} ${status.result}`;
  return text.trimEnd() + '\n';
}
