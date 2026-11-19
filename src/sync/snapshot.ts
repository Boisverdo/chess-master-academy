/**
 * Instantané portable des données du joueur et fusion de deux instantanés (synchronisation entre appareils).
 *
 * Principe : la fusion est une **union** sans perte. Ce qui a été fait sur un appareil n'efface jamais ce qui a
 * été fait sur l'autre (exercices, leçons, révisions, parties). Les suppressions volontaires (partie effacée,
 * Chess.com délié) sont mémorisées par une trace datée pour ne pas réapparaître.
 * La fusion est déterministe, commutative sur le contenu et idempotente : synchroniser deux fois ne change rien.
 * Les identifiants locaux (numéros des parties) ne voyagent pas : chaque partie a un identifiant stable (uid).
 */
import type { Attempt, Drill, GameRecord, IntegrationRecord, LessonProgress, OpeningProgress, Profile, Tombstone } from '../storage/db';
import { attemptKey, fnv1a } from '../storage/ids';

export const SYNC_FORMAT = 'chess-master-academy-sync';
export const SYNC_VERSION = 1;

export type SyncGame = Omit<GameRecord, 'id'> & { uid: string };
export type SyncDrill = Omit<Drill, 'id' | 'gameId'> & { gameUid: string; ply: number };
export type SyncAttempt = Omit<Attempt, 'id'>;

export interface SyncSnapshot {
  format: typeof SYNC_FORMAT;
  version: number;
  profile: Profile | null;
  lessons: LessonProgress[];
  attempts: SyncAttempt[];
  openings: OpeningProgress[];
  games: SyncGame[];
  drills: SyncDrill[];
  integrations: IntegrationRecord[];
  tombstones: Tombstone[];
}

export function emptySnapshot(): SyncSnapshot {
  return { format: SYNC_FORMAT, version: SYNC_VERSION, profile: null, lessons: [], attempts: [], openings: [], games: [], drills: [], integrations: [], tombstones: [] };
}

export class SyncFormatError extends Error {}

/** Valide un instantané reçu de Google Drive avant de l'utiliser (rien n'est écrit s'il est invalide). */
export function validateSnapshot(data: unknown): SyncSnapshot {
  if (!data || typeof data !== 'object') throw new SyncFormatError('Le fichier de synchronisation est illisible.');
  const s = data as Partial<SyncSnapshot>;
  if (s.format !== SYNC_FORMAT) throw new SyncFormatError('Le fichier de synchronisation n’appartient pas à Chess Master Academy.');
  if (typeof s.version !== 'number' || s.version > SYNC_VERSION) throw new SyncFormatError('Le fichier de synchronisation vient d’une version plus récente de l’application : mets-la à jour sur cet appareil.');
  for (const k of ['lessons', 'attempts', 'openings', 'games', 'drills', 'integrations', 'tombstones'] as const) {
    if (!Array.isArray(s[k])) throw new SyncFormatError('Le fichier de synchronisation est incomplet ou endommagé.');
  }
  if (s.profile !== null && (typeof s.profile !== 'object' || s.profile?.id !== 'me')) throw new SyncFormatError('Profil invalide dans le fichier de synchronisation.');
  if (s.games!.some((g) => typeof g?.uid !== 'string' || typeof g.pgn !== 'string')) throw new SyncFormatError('Partie invalide dans le fichier de synchronisation.');
  if (s.drills!.some((d) => typeof d?.gameUid !== 'string' || typeof d.ply !== 'number')) throw new SyncFormatError('Position invalide dans le fichier de synchronisation.');
  if (s.attempts!.some((a) => typeof a?.kind !== 'string' || typeof a.refId !== 'string' || typeof a.at !== 'number')) throw new SyncFormatError('Essai invalide dans le fichier de synchronisation.');
  return s as SyncSnapshot;
}

/** Union par clé : pour chaque clé, `pick` choisit entre les deux versions. Résultat trié par clé (déterministe). */
function unionBy<T>(a: readonly T[], b: readonly T[], key: (x: T) => string, pick: (x: T, y: T) => T): T[] {
  const map = new Map<string, T>();
  for (const x of [...a, ...b]) {
    const k = key(x);
    const prev = map.get(k);
    map.set(k, prev === undefined ? x : pick(prev, x));
  }
  return [...map.entries()].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).map(([, v]) => v);
}

/** Choix stable entre deux versions : la plus avancée selon `score`, puis le contenu (jamais l'ordre des appareils). */
function better<T>(score: (x: T) => number[]): (x: T, y: T) => T {
  return (x, y) => {
    const sx = score(x);
    const sy = score(y);
    for (let i = 0; i < Math.max(sx.length, sy.length); i++) {
      const d = (sx[i] ?? 0) - (sy[i] ?? 0);
      if (d !== 0) return d > 0 ? x : y;
    }
    return stableJson(x) >= stableJson(y) ? x : y;
  };
}

/** JSON aux clés triées : deux contenus égaux donnent le même texte. */
export function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, val: unknown) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([p], [q]) => (p < q ? -1 : p > q ? 1 : 0)))
      : val,
  );
}

/** Empreinte du contenu (sert à savoir si quelque chose a changé). */
export function snapshotHash(s: SyncSnapshot): string {
  const text = stableJson(s);
  return `${text.length}-${fnv1a(text)}-${fnv1a(text.split('').reverse().join(''))}`;
}

const drillKey = (d: SyncDrill) => `${d.gameUid}#${d.ply}`;

export function mergeSnapshots(a: SyncSnapshot, b: SyncSnapshot): SyncSnapshot {
  const tombstones = unionBy(a.tombstones, b.tombstones, (t) => t.key, better((t) => [t.at]));
  const deletedAt = new Map(tombstones.map((t) => [t.key, t.at]));

  const attempts = unionBy(a.attempts, b.attempts, attemptKey, better(() => [])).sort((x, y) => x.at - y.at || (attemptKey(x) < attemptKey(y) ? -1 : 1));

  const lessons = unionBy(a.lessons, b.lessons, (l) => l.lessonId, better((l) => [l.status === 'done' ? 1 : 0, l.updatedAt, l.step]));
  const openings = unionBy(a.openings, b.openings, (o) => o.openingId, better((o) => [o.updatedAt, o.attempts]));

  // Une partie supprimée reste supprimée, sauf si elle a été modifiée (analysée) après la suppression.
  const games = unionBy(a.games, b.games, (g) => g.uid, better((g) => [g.analyzedAt ?? 0, g.evals?.length ?? 0])).filter(
    (g) => (deletedAt.get(`game:${g.uid}`) ?? -Infinity) < Math.max(g.createdAt, g.analyzedAt ?? 0),
  );
  const gameUids = new Set(games.map((g) => g.uid));
  const drills = unionBy(a.drills, b.drills, drillKey, better((d) => [d.attempts, d.due])).filter((d) => gameUids.has(d.gameUid));

  const integrations = unionBy(a.integrations, b.integrations, (i) => i.id, better((i) => [Math.max(i.consentAt, i.refreshedAt ?? 0, i.lastImportAt ?? 0)])).filter(
    (i) => (deletedAt.get(`integration:${i.id}`) ?? -Infinity) < i.consentAt,
  );

  return { format: SYNC_FORMAT, version: SYNC_VERSION, profile: mergeProfile(a.profile, b.profile, attempts), lessons, attempts, openings, games, drills, integrations, tombstones };
}

/**
 * Profil : l'évaluation la plus récente fait foi (niveau, objectifs). La cote d'exercices reprend celle du dernier
 * exercice résolu, quel que soit l'appareil ; le nombre d'exercices compte ceux des deux appareils.
 */
function mergeProfile(a: Profile | null, b: Profile | null, attempts: readonly SyncAttempt[]): Profile | null {
  if (!a || !b) return a ?? b;
  const base = better<Profile>((p) => [p.assessment?.completedAt ?? 0, p.tactics.count])(a, b);
  const rated = attempts.filter((x) => x.kind === 'puzzle' && typeof x.ratingAfter === 'number');
  const last = rated[rated.length - 1];
  const count = Math.max(a.tactics.count, b.tactics.count, rated.length);
  const rating = last?.ratingAfter ?? base.tactics.rating;
  return { ...base, createdAt: Math.min(a.createdAt, b.createdAt), tactics: { rating, count } };
}
