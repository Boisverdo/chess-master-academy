/** Conversion des parties Chess.com en parties Chess Master Academy (filtres, doublons, camp du joueur). */
import { parsePgn } from '../../core/pgn';
import type { GameRecord } from '../../storage/db';
import { archiveLabel, type ChessComClient, type ChessComGame } from './client';

export type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'daily';
export const TIME_CLASS_LABELS: Record<TimeClass, string> = { bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapide', daily: 'Par jour' };

export interface ImportFilters {
  timeClasses: ReadonlySet<string>;
  ratedOnly: boolean;
}

export interface ImportSummary {
  imported: number;
  duplicates: number;
  /** Variantes non classiques (Chess960, etc.). */
  variants: number;
  /** Écartées par les filtres de cadence ou « parties classées seulement ». */
  filtered: number;
  /** PGN absent ou illisible. */
  invalid: number;
}

export const emptySummary = (): ImportSummary => ({ imported: 0, duplicates: 0, variants: 0, filtered: 0, invalid: 0 });

type Verdict = { record: Omit<GameRecord, 'id'> } | { skip: keyof Omit<ImportSummary, 'imported'> };

export function toRecord(g: ChessComGame, username: string, filters: ImportFilters, existing: ReadonlySet<string>, now = Date.now()): Verdict {
  if (existing.has(g.url)) return { skip: 'duplicates' };
  if (g.rules !== 'chess') return { skip: 'variants' };
  if (!filters.timeClasses.has(g.time_class) || (filters.ratedOnly && !g.rated)) return { skip: 'filtered' };
  if (!g.pgn) return { skip: 'invalid' };
  let result: string;
  try {
    result = parsePgn(g.pgn).status().result;
  } catch {
    return { skip: 'invalid' };
  }
  const me = username.toLowerCase();
  const userColor = g.white.username.toLowerCase() === me ? 'w' : g.black.username.toLowerCase() === me ? 'b' : undefined;
  return {
    record: {
      source: 'chesscom',
      createdAt: g.end_time ? g.end_time * 1000 : now,
      pgn: g.pgn,
      white: `${g.white.username} (${g.white.rating})`,
      black: `${g.black.username} (${g.black.rating})`,
      result,
      userColor,
      externalId: g.url,
      timeClass: g.time_class,
    },
  };
}

export interface ImportDeps {
  existing: Set<string>;
  save: (r: Omit<GameRecord, 'id'>) => Promise<unknown>;
  onProgress?: (p: { month: string; done: number; total: number; summary: ImportSummary }) => void;
  signal?: AbortSignal;
}

/** Importe les mois choisis, un par un (requêtes en série). */
export async function importMonths(client: ChessComClient, username: string, archiveUrls: readonly string[], filters: ImportFilters, deps: ImportDeps): Promise<ImportSummary> {
  const summary = emptySummary();
  for (const [i, url] of archiveUrls.entries()) {
    if (deps.signal?.aborted) break;
    const games = await client.month(url);
    for (const g of games) {
      const v = toRecord(g, username, filters, deps.existing);
      if ('skip' in v) {
        summary[v.skip]++;
        continue;
      }
      await deps.save(v.record);
      deps.existing.add(g.url);
      summary.imported++;
    }
    deps.onProgress?.({ month: archiveLabel(url).label, done: i + 1, total: archiveUrls.length, summary: { ...summary } });
  }
  return summary;
}
