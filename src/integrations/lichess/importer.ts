/** Conversion des parties Lichess en parties Chess Master Academy (filtres, doublons, camp du joueur). */
import { parsePgn } from '../../core/pgn';
import type { GameRecord, IntegrationRecord } from '../../storage/db';
import { emptySummary, type ImportSummary } from '../chesscom/importer';
import { gameUrl, type LichessClient, type LichessGame, type LichessPlayer } from './client';

export const SPEEDS = ['bullet', 'blitz', 'rapid', 'classical', 'correspondence'] as const;
export const SPEED_LABELS: Record<string, string> = { ultraBullet: 'Ultrabullet', bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapide', classical: 'Classique', correspondence: 'Par correspondance' };

export interface LichessFilters {
  speeds: ReadonlySet<string>;
  ratedOnly: boolean;
}

const UNFINISHED = new Set(['created', 'started', 'aborted', 'unknownFinish', 'noStart']);

function playerName(p: LichessPlayer): string {
  if (p.user) return p.rating ? `${p.user.name} (${p.rating})` : p.user.name;
  return p.aiLevel ? `Ordinateur Lichess niveau ${p.aiLevel}` : 'Anonyme';
}

type Verdict = { record: Omit<GameRecord, 'id'> } | { skip: keyof Omit<ImportSummary, 'imported'> };

export function toRecord(g: LichessGame, username: string, filters: LichessFilters, existing: ReadonlySet<string>): Verdict {
  const url = gameUrl(g.id);
  if (existing.has(url)) return { skip: 'duplicates' };
  if (g.variant !== 'standard') return { skip: 'variants' };
  if (!filters.speeds.has(g.speed) || (filters.ratedOnly && !g.rated)) return { skip: 'filtered' };
  if (!g.pgn || UNFINISHED.has(g.status)) return { skip: 'invalid' };
  let result: string;
  try {
    result = parsePgn(g.pgn).status().result;
  } catch {
    return { skip: 'invalid' };
  }
  const me = username.toLowerCase();
  const userColor = g.players.white.user?.id === me ? 'w' : g.players.black.user?.id === me ? 'b' : undefined;
  return {
    record: {
      source: 'lichess',
      createdAt: g.lastMoveAt ?? g.createdAt,
      pgn: g.pgn,
      white: playerName(g.players.white),
      black: playerName(g.players.black),
      result,
      userColor,
      externalId: url,
      timeClass: g.speed,
    },
  };
}

export interface LichessImportDeps {
  existing: Set<string>;
  save: (r: Omit<GameRecord, 'id'>) => Promise<unknown>;
}

/** Une seule requête : les `max` dernières parties (depuis `since` si donné), filtrées côté Lichess puis ici. */
export async function importLichess(client: LichessClient, username: string, q: { max: number; since?: number }, filters: LichessFilters, deps: LichessImportDeps): Promise<ImportSummary> {
  const summary = emptySummary();
  const games = await client.games(username, { max: q.max, since: q.since, speeds: [...filters.speeds], ratedOnly: filters.ratedOnly });
  // Du plus ancien au plus récent : l'ordre d'enregistrement suit l'ordre des parties.
  for (const g of games.reverse()) {
    const v = toRecord(g, username, filters, deps.existing);
    if ('skip' in v) {
      summary[v.skip]++;
      continue;
    }
    await deps.save(v.record);
    deps.existing.add(v.record.externalId!);
    summary.imported++;
  }
  return summary;
}

export const AUTO_INTERVAL_MS = 6 * 3600_000;
export const AUTO_MAX_GAMES = 100;

export type LichessAutoResult = { ran: false; reason: 'disabled' | 'recent' } | { ran: true; summary: ImportSummary };

export function lichessAutoDue(i: IntegrationRecord | undefined, now: number): boolean {
  if (!i?.autoImport?.enabled) return false;
  return !i.lastAutoCheckAt || now - i.lastAutoCheckAt >= AUTO_INTERVAL_MS || i.lastAutoCheckAt > now;
}

/** Import automatique : les parties jouées depuis la dernière vérification (100 au plus), une requête toutes les 6 heures au plus. */
export async function runLichessAuto(
  client: LichessClient,
  i: IntegrationRecord,
  deps: { existing: () => Promise<Set<string>>; save: (r: Omit<GameRecord, 'id'>) => Promise<unknown>; saveIntegration: (r: IntegrationRecord) => Promise<void>; now: number; force?: boolean },
): Promise<LichessAutoResult> {
  const auto = i.autoImport;
  if (!auto?.enabled) return { ran: false, reason: 'disabled' };
  if (!deps.force && !lichessAutoDue(i, deps.now)) return { ran: false, reason: 'recent' };
  const since = Math.min(i.lastAutoCheckAt ?? auto.updatedAt, deps.now);
  await deps.saveIntegration({ ...i, lastAutoCheckAt: deps.now });
  const summary = await importLichess(client, i.username, { max: AUTO_MAX_GAMES, since }, { speeds: new Set(auto.timeClasses), ratedOnly: auto.ratedOnly }, { existing: await deps.existing(), save: deps.save });
  await deps.saveIntegration({ ...i, lastAutoCheckAt: deps.now, ...(summary.imported ? { lastImportAt: deps.now } : {}) });
  return { ran: true, summary };
}
