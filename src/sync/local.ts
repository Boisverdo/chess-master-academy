/** Passage entre la base locale (IndexedDB) et l'instantané portable de synchronisation. */
import { db, type CmaDatabase, type GameRecord } from '../storage/db';
import { notifyDataChange } from '../storage/events';
import { gameUid } from '../storage/ids';
import { emptySnapshot, mergeSnapshots, snapshotHash, SYNC_FORMAT, SYNC_VERSION, type SyncSnapshot } from './snapshot';

const TABLES = (d: CmaDatabase) => [d.profile, d.lessons, d.attempts, d.openings, d.games, d.drills, d.integrations, d.tombstones];

/** Lit les données de cet appareil sous forme portable (sans les numéros locaux). */
export async function exportSnapshot(d: CmaDatabase = db): Promise<SyncSnapshot> {
  return d.transaction('r', TABLES(d), () => readSnapshot(d));
}

async function readSnapshot(d: CmaDatabase): Promise<SyncSnapshot> {
  const [profile, lessons, attempts, openings, games, drills, integrations, tombstones] = await Promise.all([
    d.profile.get('me'),
    d.lessons.toArray(),
    d.attempts.toArray(),
    d.openings.toArray(),
    d.games.toArray(),
    d.drills.toArray(),
    d.integrations.toArray(),
    d.tombstones.toArray(),
  ]);
  const uidById = new Map(games.map((g) => [g.id!, gameUid(g)]));
  return {
    format: SYNC_FORMAT,
    version: SYNC_VERSION,
    profile: profile ?? null,
    lessons,
    attempts: attempts.map(({ id: _id, ...a }) => a),
    openings,
    games: games.map(({ id: _id, ...g }) => ({ ...g, uid: gameUid(g) })),
    drills: drills
      .filter((x) => uidById.has(x.gameId))
      .map(({ id: _id, gameId, ...x }) => ({ ...x, gameUid: uidById.get(gameId)! })),
    integrations,
    tombstones,
  };
}

/**
 * Fusionne un instantané reçu avec les données actuelles de l'appareil, dans une seule transaction (une action
 * faite pendant la synchronisation n'est pas perdue). Les parties déjà présentes gardent leur numéro local.
 * Renvoie l'instantané fusionné et indique si les données locales ont changé.
 */
export async function mergeIntoLocal(incoming: SyncSnapshot, d: CmaDatabase = db): Promise<{ merged: SyncSnapshot; changed: boolean }> {
  const result = await d.transaction('rw', TABLES(d), async () => {
    // La fusion avec un instantané vide met les données locales dans la forme canonique (listes triées).
    const local = mergeSnapshots(await readSnapshot(d), emptySnapshot());
    const merged = mergeSnapshots(local, incoming);
    if (snapshotHash(merged) === snapshotHash(local)) return { merged, changed: false };

    const existing = await d.games.toArray();
    const idByUid = new Map(existing.map((g) => [gameUid(g), g.id!]));
    const keep = new Set(merged.games.map((g) => g.uid));
    await d.games.bulkDelete(existing.filter((g) => !keep.has(gameUid(g))).map((g) => g.id!));
    for (const g of merged.games) {
      const id = idByUid.get(g.uid);
      const rec: GameRecord = id === undefined ? { ...g } : { ...g, id };
      idByUid.set(g.uid, await d.games.put(rec));
    }

    await Promise.all([d.drills.clear(), d.attempts.clear(), d.lessons.clear(), d.openings.clear(), d.integrations.clear(), d.profile.clear()]);
    await d.drills.bulkPut(
      merged.drills.map(({ gameUid: uid, ...x }) => {
        const gameId = idByUid.get(uid)!;
        return { ...x, gameId, id: `${gameId}-${x.ply}` };
      }),
    );
    await d.attempts.bulkAdd(merged.attempts.map((a) => ({ ...a })));
    await d.lessons.bulkPut(merged.lessons);
    await d.openings.bulkPut(merged.openings);
    await d.integrations.bulkPut(merged.integrations);
    if (merged.profile) await d.profile.put(merged.profile);
    await d.tombstones.bulkPut(merged.tombstones);
    return { merged, changed: true };
  });
  if (result.changed) notifyDataChange();
  return result;
}
