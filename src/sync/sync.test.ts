import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DriveApi, DriveFile } from '../integrations/google/drive';
import { DriveError } from '../integrations/google/drive';
import { CmaDatabase, type Drill, type GameRecord, type Profile } from '../storage/db';
import { gameUid } from '../storage/ids';
import { deleteGameRecord, disconnectIntegration, recordPuzzle, saveGameRecord, saveIntegration, saveLessonProgress, saveProfile, newProfile, recordOpeningReview, resetAll } from '../storage/repo';
import { exportSnapshot, mergeIntoLocal } from './local';
import { SyncManager, type SyncDeps } from './manager';
import { emptySnapshot, mergeSnapshots, snapshotHash, stableJson, SyncFormatError, validateSnapshot, type SyncSnapshot } from './snapshot';

let n = 0;
const fresh = () => new CmaDatabase(`sync-${n++}`);

const PGN = (moves: string) => `[White "A"]\n[Black "B"]\n[Result "*"]\n\n${moves} *`;
function game(createdAt: number, moves = '1. e4 e5', extra: Partial<GameRecord> = {}): Omit<GameRecord, 'id'> {
  return { source: 'ia', createdAt, pgn: PGN(moves), white: 'A', black: 'B', result: '*', userColor: 'w', ...extra };
}
function profile(extra: Partial<Profile> = {}): Profile {
  return { id: 'me', createdAt: 1000, level: 'debutant', experience: 'x', goals: [], tactics: { rating: 800, count: 0 }, ...extra };
}

// ---------------------------------------------------------------- Fusion (fonction pure)

describe('fusion de deux instantanés', () => {
  const base = (): SyncSnapshot => emptySnapshot();

  it('réunit les essais des deux appareils sans doublon', () => {
    const a = base();
    const b = base();
    const shared = { kind: 'puzzle' as const, refId: 'p1', themes: ['fork'], success: true, hints: 0, at: 100 };
    a.attempts = [shared, { ...shared, refId: 'p2', at: 200 }];
    b.attempts = [shared, { ...shared, refId: 'p3', at: 150 }];
    const m = mergeSnapshots(a, b);
    expect(m.attempts.map((x) => x.refId)).toEqual(['p1', 'p3', 'p2']);
  });

  it('est commutative, idempotente et associative sur le contenu', () => {
    const a = base();
    const b = base();
    const c = base();
    a.lessons = [{ lessonId: 'l1', status: 'in-progress', step: 2, correct: 1, total: 2, updatedAt: 10 }];
    b.lessons = [{ lessonId: 'l1', status: 'done', step: 5, correct: 5, total: 5, updatedAt: 5, completedAt: 5 }];
    c.lessons = [{ lessonId: 'l2', status: 'in-progress', step: 1, correct: 0, total: 1, updatedAt: 3 }];
    a.games = [{ ...game(1), uid: 'g1' }];
    b.games = [{ ...game(1), uid: 'g1', analyzedAt: 50, evals: [] }];
    c.tombstones = [{ key: 'game:g9', at: 1 }];
    const ab = mergeSnapshots(a, b);
    expect(stableJson(ab)).toBe(stableJson(mergeSnapshots(b, a)));
    expect(stableJson(mergeSnapshots(ab, b))).toBe(stableJson(ab));
    expect(stableJson(mergeSnapshots(mergeSnapshots(a, b), c))).toBe(stableJson(mergeSnapshots(a, mergeSnapshots(b, c))));
  });

  it('une leçon terminée sur un appareil reste terminée', () => {
    const a = base();
    const b = base();
    a.lessons = [{ lessonId: 'l1', status: 'in-progress', step: 1, correct: 0, total: 1, updatedAt: 999 }];
    b.lessons = [{ lessonId: 'l1', status: 'done', step: 4, correct: 4, total: 4, updatedAt: 10, completedAt: 10 }];
    expect(mergeSnapshots(a, b).lessons[0]!.status).toBe('done');
  });

  it('garde la révision d’ouverture la plus récente', () => {
    const a = base();
    const b = base();
    const o = { openingId: 'italienne', reps: 1, ease: 2.5, intervalDays: 1, due: 0, lastSuccess: true, attempts: 1, updatedAt: 10 };
    a.openings = [o];
    b.openings = [{ ...o, reps: 2, intervalDays: 6, attempts: 2, updatedAt: 20 }];
    expect(mergeSnapshots(a, b).openings[0]!.intervalDays).toBe(6);
  });

  it('préfère la version analysée d’une partie', () => {
    const a = base();
    const b = base();
    a.games = [{ ...game(1), uid: 'g1' }];
    b.games = [{ ...game(1), uid: 'g1', analyzedAt: 99, accuracy: { w: 90, b: 80 } }];
    expect(mergeSnapshots(a, b).games[0]!.accuracy).toEqual({ w: 90, b: 80 });
  });

  it('une partie supprimée ne réapparaît pas, et ses positions disparaissent', () => {
    const a = base();
    const b = base();
    const drill = { gameUid: 'g1', ply: 7, fen: 'x', best: 'e4', played: 'a3', tags: [], reps: 0, ease: 2.5, intervalDays: 0, due: 0, attempts: 0, createdAt: 1 } as SyncSnapshot['drills'][number];
    a.games = [{ ...game(1), uid: 'g1' }];
    a.drills = [drill];
    b.tombstones = [{ key: 'game:g1', at: 50 }];
    const m = mergeSnapshots(a, b);
    expect(m.games).toEqual([]);
    expect(m.drills).toEqual([]);
    expect(m.tombstones).toEqual([{ key: 'game:g1', at: 50 }]);
  });

  it('une partie analysée après sa suppression sur l’autre appareil est conservée', () => {
    const a = base();
    const b = base();
    a.games = [{ ...game(1), uid: 'g1', analyzedAt: 80 }];
    b.tombstones = [{ key: 'game:g1', at: 50 }];
    expect(mergeSnapshots(a, b).games).toHaveLength(1);
  });

  it('Chess.com délié sur un appareil reste délié, sauf nouvelle liaison plus récente', () => {
    const a = base();
    const b = base();
    a.integrations = [{ id: 'chesscom', username: 'moi', consentAt: 10 }];
    b.tombstones = [{ key: 'integration:chesscom', at: 20 }];
    expect(mergeSnapshots(a, b).integrations).toEqual([]);
    a.integrations = [{ id: 'chesscom', username: 'moi', consentAt: 30 }];
    expect(mergeSnapshots(a, b).integrations).toHaveLength(1);
  });

  it('profil : l’évaluation la plus récente fait foi ; la cote suit le dernier exercice ; les exercices s’additionnent', () => {
    const a = base();
    const b = base();
    a.profile = profile({ level: 'debutant', tactics: { rating: 860, count: 2 }, assessment: { completedAt: 10, level: 'debutant', scores: { rules: 1, tactics: 0, strategy: 0, experience: 0 } } });
    b.profile = profile({ createdAt: 500, level: 'intermediaire', tactics: { rating: 830, count: 1 }, assessment: { completedAt: 20, level: 'intermediaire', scores: { rules: 1, tactics: 1, strategy: 1, experience: 1 } } });
    const p = { kind: 'puzzle' as const, themes: [], success: true, hints: 0 };
    a.attempts = [
      { ...p, refId: 'p1', at: 100, ratingBefore: 800, ratingAfter: 830 },
      { ...p, refId: 'p2', at: 300, ratingBefore: 830, ratingAfter: 860 },
    ];
    b.attempts = [{ ...p, refId: 'p3', at: 400, ratingBefore: 800, ratingAfter: 830 }];
    const m = mergeSnapshots(a, b).profile!;
    expect(m.level).toBe('intermediaire');
    expect(m.createdAt).toBe(500);
    expect(m.tactics).toEqual({ rating: 830, count: 3 });
  });

  it('refuse un fichier étranger, endommagé ou plus récent', () => {
    expect(() => validateSnapshot({ format: 'autre' })).toThrow(SyncFormatError);
    expect(() => validateSnapshot({ ...emptySnapshot(), version: 99 })).toThrow(/plus récente/);
    expect(() => validateSnapshot({ ...emptySnapshot(), games: [{ uid: 3 }] })).toThrow(SyncFormatError);
    expect(() => validateSnapshot({ ...emptySnapshot(), attempts: 'x' })).toThrow(SyncFormatError);
    expect(validateSnapshot(JSON.parse(JSON.stringify(emptySnapshot())))).toEqual(emptySnapshot());
  });

  it('l’empreinte ne dépend pas de l’ordre des propriétés', () => {
    const a = { ...emptySnapshot(), profile: profile() };
    const b = JSON.parse(JSON.stringify(a, Object.keys(a).reverse())) as SyncSnapshot;
    b.profile = { ...profile(), id: 'me' };
    expect(snapshotHash(a)).toBe(snapshotHash(b));
  });
});

// ---------------------------------------------------------------- Base locale

describe('base locale et instantané', () => {
  let d: CmaDatabase;
  beforeEach(() => {
    d = fresh();
  });

  it('chaque partie reçoit un identifiant stable (identique pour une partie Chess.com)', async () => {
    await saveGameRecord(game(5), d);
    await saveGameRecord(game(6, '1. d4', { source: 'chesscom', externalId: 'https://www.chess.com/game/live/1' }), d);
    const games = await d.games.toArray();
    expect(games.map((g) => g.uid)).toEqual([gameUid(game(5)), 'chesscom:https://www.chess.com/game/live/1']);
  });

  it('les anciennes parties reçoivent un identifiant à la mise à niveau de la base', async () => {
    const { default: Dexie } = await import('dexie');
    const name = `sync-upgrade-${n++}`;
    const old = new Dexie(name);
    old.version(3).stores({ profile: 'id', lessons: 'lessonId, status', attempts: '++id, kind, refId, at, success', openings: 'openingId, due', games: '++id, createdAt, source, externalId', drills: 'id, due, gameId', integrations: 'id', monthCache: 'url' });
    await old.table('games').add(game(7));
    old.close();
    const upgraded = new CmaDatabase(name);
    const [g] = await upgraded.games.toArray();
    expect(g!.uid).toBe(gameUid(game(7)));
  });

  it('supprimer une partie laisse une trace ; délier Chess.com aussi', async () => {
    const id = await saveGameRecord(game(5), d);
    await deleteGameRecord(id, d);
    await saveIntegration({ id: 'chesscom', username: 'moi', consentAt: 1 }, d);
    await disconnectIntegration(false, d);
    const keys = (await d.tombstones.toArray()).map((t) => t.key).sort();
    expect(keys).toEqual([`game:${gameUid(game(5))}`, 'integration:chesscom']);
  });

  it('fusionner un instantané garde les numéros locaux et renumérote les positions', async () => {
    const id = await saveGameRecord(game(5), d);
    await d.drills.put({ id: `${id}-3`, gameId: id, ply: 3, fen: 'f', best: 'e4', played: 'a3', tags: [], reps: 0, ease: 2.5, intervalDays: 0, due: 0, attempts: 0, createdAt: 1 } as Drill);
    const remote = emptySnapshot();
    remote.games = [{ ...game(9, '1. c4'), uid: 'autre' }];
    remote.drills = [{ gameUid: 'autre', ply: 4, fen: 'g', best: 'd4', played: 'h3', tags: [], reps: 0, ease: 2.5, intervalDays: 0, due: 0, attempts: 0, createdAt: 2 }];
    const { changed } = await mergeIntoLocal(remote, d);
    expect(changed).toBe(true);
    const games = await d.games.toArray();
    expect(games.find((g) => g.createdAt === 5)!.id).toBe(id);
    const other = games.find((g) => g.uid === 'autre')!;
    const drills = await d.drills.toArray();
    expect(drills.map((x) => x.id).sort()).toEqual([`${id}-3`, `${other.id}-4`].sort());
    expect(drills.find((x) => x.ply === 4)!.gameId).toBe(other.id);
    // Une deuxième fusion identique ne change rien.
    expect((await mergeIntoLocal(remote, d)).changed).toBe(false);
  });

  it('l’instantané d’une base vide est vide', async () => {
    expect(await exportSnapshot(d)).toEqual(emptySnapshot());
  });
});

// ---------------------------------------------------------------- Deux appareils et un Google Drive simulé

class FakeDrive {
  file: { id: string; content: string } | null = null;
  calls: string[] = [];
  failNext: DriveError | null = null;
  api(): DriveApi {
    const check = () => {
      if (this.failNext) {
        const e = this.failNext;
        this.failNext = null;
        throw e;
      }
    };
    return {
      find: async () => (check(), this.calls.push('find'), this.file ? ({ id: this.file.id } as DriveFile) : null),
      download: async (id) => {
        check();
        this.calls.push('download');
        if (this.file?.id !== id) throw new DriveError('absent', 'missing');
        return JSON.parse(this.file.content) as unknown;
      },
      create: async (c) => (check(), this.calls.push('create'), (this.file = { id: 'f1', content: JSON.stringify(c) }), { id: 'f1' }),
      update: async (id, c) => {
        check();
        this.calls.push('update');
        if (this.file?.id !== id) throw new DriveError('absent', 'missing');
        this.file = { id, content: JSON.stringify(c) };
        return { id };
      },
      remove: async () => (check(), this.calls.push('remove'), void (this.file = null)),
    };
  }
}

function device(drive: FakeDrive, clock: { t: number }, opts: Partial<SyncDeps> = {}) {
  const d = fresh();
  const revoked: string[] = [];
  const m = new SyncManager({
    db: d,
    clientId: () => 'client-test',
    requestToken: async () => ({ token: `jeton-${clock.t}`, expiresAt: clock.t + 3_600_000 }),
    revokeToken: async (t) => void revoked.push(t),
    drive: () => drive.api(),
    now: () => clock.t,
    debounceMs: 1,
    ...opts,
  });
  return { d, m, revoked };
}

describe('synchronisation entre deux appareils', () => {
  let drive: FakeDrive;
  const clock = { t: 1_000_000 };
  beforeEach(() => {
    drive = new FakeDrive();
    clock.t = 1_000_000;
  });

  it('sans identifiant Google, la synchronisation est « non configurée »', async () => {
    const { m } = device(drive, clock, { clientId: () => '' });
    await m.refresh();
    expect(m.state.status).toBe('unconfigured');
  });

  it('le téléphone reçoit la progression du PC, puis le PC celle du téléphone', async () => {
    const pc = device(drive, clock);
    await saveProfile(newProfile('debutant', 'x', []), pc.d);
    await recordPuzzle({ id: 'p1', rating: 900, themes: ['fork'] }, true, 0, 1000, pc.d);
    await saveLessonProgress({ lessonId: 'regles-roque', status: 'done', step: 5, correct: 5, total: 5, updatedAt: 1, completedAt: 1 }, pc.d);
    await pc.m.connect();
    expect(pc.m.state.status).toBe('idle');
    expect(drive.calls).toEqual(['find', 'create']);

    const phone = device(drive, clock);
    await recordOpeningReview('italienne', true, 0, 5, phone.d);
    await phone.m.connect();
    expect(await phone.d.lessons.get('regles-roque')).toBeDefined();
    expect((await phone.d.attempts.toArray()).map((a) => a.kind).sort()).toEqual(['opening', 'puzzle']);
    expect((await phone.d.profile.get('me'))!.tactics.count).toBe(1);

    await pc.m.syncNow();
    expect(await pc.d.openings.get('italienne')).toBeDefined();
    expect(stableJson(await exportSnapshot(pc.d))).toBe(stableJson(await exportSnapshot(phone.d)));
  });

  it('des exercices faits hors ligne sur les deux appareils sont tous conservés', async () => {
    const pc = device(drive, clock);
    const phone = device(drive, clock);
    await pc.m.connect();
    await phone.m.connect();
    for (let i = 0; i < 3; i++) {
      clock.t += 1000;
      await recordPuzzle({ id: `pc${i}`, rating: 900, themes: [] }, true, 0, 1, pc.d);
      clock.t += 1000;
      await recordPuzzle({ id: `tel${i}`, rating: 900, themes: [] }, false, 1, 1, phone.d);
    }
    await pc.m.syncNow();
    await phone.m.syncNow();
    await pc.m.syncNow();
    const refs = (d: CmaDatabase) => d.attempts.toArray().then((x) => x.map((a) => a.refId).sort());
    expect(await refs(pc.d)).toEqual(['pc0', 'pc1', 'pc2', 'tel0', 'tel1', 'tel2']);
    expect(await refs(phone.d)).toEqual(await refs(pc.d));
  });

  it('une partie supprimée sur un appareil disparaît de l’autre', async () => {
    const pc = device(drive, clock);
    const phone = device(drive, clock);
    const id = await saveGameRecord(game(5), pc.d);
    await pc.m.connect();
    await phone.m.connect();
    expect(await phone.d.games.count()).toBe(1);
    clock.t += 1000;
    await deleteGameRecord(id, pc.d);
    await pc.m.syncNow();
    await phone.m.syncNow();
    expect(await phone.d.games.count()).toBe(0);
  });

  it('un changement local déclenche la synchronisation automatiquement', async () => {
    const pc = device(drive, clock);
    await pc.m.start();
    await pc.m.connect();
    const before = drive.calls.length;
    await recordPuzzle({ id: 'auto', rating: 900, themes: [] }, true, 0, 1, pc.d);
    await new Promise((r) => setTimeout(r, 50));
    await pc.m.syncNow();
    expect(drive.calls.length).toBeGreaterThan(before);
    expect(drive.file!.content).toContain('"auto"');
  });

  it('autorisation expirée : pause, puis reprise en un geste', async () => {
    const pc = device(drive, clock);
    await pc.m.connect();
    clock.t += 3_700_000;
    await recordPuzzle({ id: 'apres', rating: 900, themes: [] }, true, 0, 1, pc.d);
    await pc.m.syncNow();
    expect(pc.m.state.status).toBe('needs-auth');
    await pc.m.resume();
    expect(pc.m.state.status).toBe('idle');
    expect(drive.file!.content).toContain('"apres"');
  });

  it('jeton refusé par Google (401) : pause sans perte', async () => {
    const pc = device(drive, clock);
    await pc.m.connect();
    drive.failNext = new DriveError('expiré', 'auth');
    await pc.m.syncNow();
    expect(pc.m.state.status).toBe('needs-auth');
    expect((await pc.d.sync.get('google'))!.token).toBeUndefined();
  });

  it('hors ligne : rien n’est perdu, la synchronisation reprend ensuite', async () => {
    const pc = device(drive, clock);
    await pc.m.connect();
    await recordPuzzle({ id: 'horsligne', rating: 900, themes: [] }, true, 0, 1, pc.d);
    drive.failNext = new DriveError('Pas de connexion Internet', 'offline');
    await pc.m.syncNow();
    expect(pc.m.state.status).toBe('offline');
    expect(pc.m.state.pending).toBe(true);
    await pc.m.syncNow();
    expect(pc.m.state.status).toBe('idle');
    expect(drive.file!.content).toContain('"horsligne"');
  });

  it('un fichier distant d’une version plus récente n’est jamais écrasé', async () => {
    const pc = device(drive, clock);
    drive.file = { id: 'f1', content: JSON.stringify({ ...emptySnapshot(), version: 99 }) };
    await recordPuzzle({ id: 'x', rating: 900, themes: [] }, true, 0, 1, pc.d);
    await pc.m.connect();
    expect(pc.m.state.status).toBe('error');
    expect(pc.m.state.message).toMatch(/plus récente/);
    expect(JSON.parse(drive.file.content).version).toBe(99);
    expect(drive.calls).not.toContain('update');
  });

  it('si le fichier a été supprimé de Drive, il est recréé', async () => {
    const pc = device(drive, clock);
    await pc.m.connect();
    drive.file = null;
    await pc.m.syncNow();
    expect(pc.m.state.status).toBe('idle');
    expect(drive.file).not.toBeNull();
  });

  it('refus dans la fenêtre de Google : rien n’est lié', async () => {
    const pc = device(drive, clock, {
      requestToken: async () => {
        const { GoogleAuthError } = await import('../integrations/google/auth');
        throw new GoogleAuthError('Autorisation refusée.', 'denied');
      },
    });
    await pc.m.connect();
    expect(pc.m.state).toMatchObject({ status: 'off', message: 'Autorisation refusée.' });
    expect(await pc.d.sync.count()).toBe(0);
    expect(drive.calls).toEqual([]);
  });

  it('délier : garde ou supprime la copie sur Drive, et retire l’autorisation', async () => {
    const pc = device(drive, clock);
    await pc.m.connect();
    await pc.m.disconnect(false);
    expect(drive.file).not.toBeNull();
    expect(pc.revoked).toHaveLength(1);
    expect(pc.m.state.status).toBe('off');
    await pc.m.connect();
    await pc.m.disconnect(true);
    expect(drive.file).toBeNull();
    expect(await pc.d.sync.count()).toBe(0);
  });

  it('« Tout effacer » délie aussi la synchronisation sur cet appareil', async () => {
    const pc = device(drive, clock);
    await pc.m.connect();
    await resetAll(pc.d);
    await pc.m.refresh();
    expect(pc.m.state.status).toBe('off');
  });

  it('deux synchronisations demandées en même temps ne se chevauchent pas', async () => {
    const pc = device(drive, clock);
    await pc.m.connect();
    drive.calls = [];
    await Promise.all([pc.m.syncNow(), pc.m.syncNow(), pc.m.syncNow()]);
    expect(drive.calls.filter((c) => c === 'download').length).toBeLessThanOrEqual(2);
    expect(pc.m.state.status).toBe('idle');
  });
});
