/** Accès aux données du joueur : lecture, écriture, sauvegarde et restauration. */
import { db, type Attempt, type CmaDatabase, type LessonProgress, type Level, type OpeningProgress, type Profile } from './db';
import { notifyDataChange } from './events';
import { reviewQuality, scheduleReview, START_RATING, updateRating } from './learning';

export async function getProfile(d: CmaDatabase = db): Promise<Profile | undefined> {
  return d.profile.get('me');
}

export async function saveProfile(p: Omit<Profile, 'id'>, d: CmaDatabase = db): Promise<Profile> {
  const profile: Profile = { ...p, id: 'me' };
  await d.profile.put(profile);
  notifyDataChange();
  return profile;
}

export function newProfile(level: Level, experience: string, goals: string[], now = Date.now()): Omit<Profile, 'id'> {
  return { createdAt: now, level, experience, goals, tactics: { rating: START_RATING[level], count: 0 } };
}

export async function recordAttempt(a: Omit<Attempt, 'id'>, d: CmaDatabase = db): Promise<void> {
  await d.attempts.add(a);
  notifyDataChange();
}

/** Enregistre un exercice tactique et met à jour la cote d'exercices. Renvoie la nouvelle cote. */
export async function recordPuzzle(
  puzzle: { id: string; rating: number; themes: string[] },
  success: boolean,
  hints: number,
  ms: number,
  d: CmaDatabase = db,
): Promise<number | undefined> {
  return d.transaction('rw', d.profile, d.attempts, async () => {
    const profile = await d.profile.get('me');
    const before = profile?.tactics.rating;
    let after: number | undefined;
    if (profile) {
      after = updateRating(profile.tactics.rating, profile.tactics.count, puzzle.rating, success, hints);
      await d.profile.put({ ...profile, tactics: { rating: after, count: profile.tactics.count + 1 } });
    }
    await d.attempts.add({ kind: 'puzzle', refId: puzzle.id, themes: puzzle.themes, success, hints, at: Date.now(), ms, ratingBefore: before, ratingAfter: after });
    return after;
  }).finally(notifyDataChange);
}

export async function getLessonProgress(d: CmaDatabase = db): Promise<Map<string, LessonProgress>> {
  const all = await d.lessons.toArray();
  return new Map(all.map((l) => [l.lessonId, l]));
}

export async function saveLessonProgress(p: LessonProgress, d: CmaDatabase = db): Promise<void> {
  await d.lessons.put(p);
  notifyDataChange();
}

export async function recordOpeningReview(openingId: string, success: boolean, mistakes: number, now = Date.now(), d: CmaDatabase = db): Promise<OpeningProgress> {
  return d.transaction('rw', d.openings, d.attempts, async () => {
    const prev = await d.openings.get(openingId);
    const s = scheduleReview(prev, reviewQuality(success, mistakes), now);
    const next: OpeningProgress = { openingId, ...s, lastSuccess: success, attempts: (prev?.attempts ?? 0) + 1, updatedAt: now };
    await d.openings.put(next);
    await d.attempts.add({ kind: 'opening', refId: openingId, themes: ['ouverture'], success, hints: mistakes, at: now });
    return next;
  }).finally(notifyDataChange);
}

// ---------- Sauvegarde / restauration ----------

export const BACKUP_FORMAT = 'chess-master-academy-backup';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  profile: Profile[];
  lessons: LessonProgress[];
  attempts: Attempt[];
  openings: OpeningProgress[];
}

export async function exportBackup(d: CmaDatabase = db): Promise<Backup> {
  const [profile, lessons, attempts, openings] = await Promise.all([d.profile.toArray(), d.lessons.toArray(), d.attempts.toArray(), d.openings.toArray()]);
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), profile, lessons, attempts, openings };
}

export class BackupError extends Error {}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

/** Valide une sauvegarde avant toute écriture : rien n'est modifié si elle est invalide. */
export function validateBackup(data: unknown): Backup {
  if (!data || typeof data !== 'object') throw new BackupError("Ce fichier n'est pas une sauvegarde Chess Master Academy.");
  const b = data as Partial<Backup>;
  if (b.format !== BACKUP_FORMAT) throw new BackupError("Ce fichier n'est pas une sauvegarde Chess Master Academy.");
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) throw new BackupError('Cette sauvegarde provient d’une version plus récente de l’application.');
  if (!isArray(b.profile) || !isArray(b.lessons) || !isArray(b.attempts) || !isArray(b.openings)) throw new BackupError('Sauvegarde incomplète ou endommagée.');
  if (b.profile.some((p) => (p as Profile).id !== 'me')) throw new BackupError('Profil invalide dans la sauvegarde.');
  return b as Backup;
}

/** Remplace toutes les données par celles de la sauvegarde (opération atomique). */
export async function importBackup(data: unknown, d: CmaDatabase = db): Promise<void> {
  const b = validateBackup(data);
  await d.transaction('rw', [d.profile, d.lessons, d.attempts, d.openings], async () => {
    await Promise.all([d.profile.clear(), d.lessons.clear(), d.attempts.clear(), d.openings.clear()]);
    await d.profile.bulkPut(b.profile);
    await d.lessons.bulkPut(b.lessons);
    await d.attempts.bulkPut(b.attempts);
    await d.openings.bulkPut(b.openings);
  });
  notifyDataChange();
}

export async function resetAll(d: CmaDatabase = db): Promise<void> {
  await d.transaction('rw', [d.profile, d.lessons, d.attempts, d.openings], async () => {
    await Promise.all([d.profile.clear(), d.lessons.clear(), d.attempts.clear(), d.openings.clear()]);
  });
  notifyDataChange();
}
