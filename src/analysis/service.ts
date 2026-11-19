/** Analyse complète d'une partie enregistrée : moteur → revue → étiquettes d'habitudes → positions à retravailler. */
import type { ChessGame, Color } from '../core/game';
import { parsePgn } from '../core/pgn';
import { explainMove, slowDevelopment, type Fmt } from '../coach/explain';
import type { Engine } from '../engine/engine';
import { OPENINGS, sanList } from '../learning/openings';
import { db, type Drill, type GameRecord } from '../storage/db';
import { saveDrills, updateGameRecord } from '../storage/repo';
import { buildBook, criticalMoments, reviewGame, type GameReview, type PositionEval } from './review';
import { analyseGame } from './runner';

let bookCache: Set<string> | null = null;
export function openingBook(): Set<string> {
  bookCache ??= buildBook(OPENINGS.flatMap((o) => [o.mainLine.map(([s]) => s), ...o.variations.map((v) => sanList(v.moves))]));
  return bookCache;
}

const plainFmt: Fmt = (san) => san;

/** Étiquettes d'erreurs d'un camp dans une partie analysée. */
export function gameTags(game: ChessGame, review: GameReview, evals: readonly PositionEval[], color: Color): string[] {
  const tags = new Set<string>();
  for (const m of review.moves) {
    if (m.color !== color || m.loss < 5) continue;
    for (const t of explainMove(m, evals[m.ply - 1]!, evals[m.ply]!, plainFmt).tags) tags.add(t);
  }
  const tenth = game.plies.filter((p) => p.color === color)[9];
  if (tenth && slowDevelopment(tenth.fenAfter, color)) tags.add('developpement-lent');
  return [...tags];
}

/** Moments critiques du joueur transformés en positions à retravailler (révision espacée). */
export function drillsFrom(gameId: number, review: GameReview, color: Color, evals: readonly PositionEval[], now = Date.now()): Drill[] {
  return criticalMoments(review, color)
    .filter((m) => m.bestUci)
    .map((m) => ({
      id: `${gameId}-${m.ply}`,
      gameId,
      ply: m.ply,
      fen: m.fenBefore,
      best: m.bestUci!,
      played: m.uci,
      tags: explainMove(m, evals[m.ply - 1]!, evals[m.ply]!, plainFmt).tags,
      reps: 0,
      ease: 2.5,
      intervalDays: 0,
      due: now,
      attempts: 0,
      createdAt: now,
    }));
}

export async function analyseRecord(
  record: GameRecord,
  engine: Engine,
  opts: { depth?: number; movetime?: number; onProgress?: (d: number, t: number) => void; signal?: AbortSignal } = {},
): Promise<{ evals: PositionEval[]; review: GameReview }> {
  const game = parsePgn(record.pgn);
  const evals = await analyseGame(engine, game, opts);
  const review = reviewGame(game, evals, openingBook());
  if (record.id !== undefined) {
    const patch: Partial<GameRecord> = { evals, analyzedAt: Date.now(), accuracy: review.accuracy };
    if (record.userColor) {
      patch.tags = gameTags(game, review, evals, record.userColor);
      await db.drills.where('gameId').equals(record.id).delete();
      await saveDrills(drillsFrom(record.id, review, record.userColor, evals));
    }
    await updateGameRecord(record.id, patch);
  }
  return { evals, review };
}
