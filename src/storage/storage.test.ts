import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { CmaDatabase } from './db';
import { DAY, reviewQuality, scheduleReview, themeStats, updateRating, weakThemes } from './learning';
import { exportBackup, getProfile, importBackup, newProfile, recordOpeningReview, recordPuzzle, resetAll, saveProfile } from './repo';

let d: CmaDatabase;
let n = 0;
beforeEach(() => {
  d = new CmaDatabase(`test-${n++}`);
});

describe('cote d’exercices', () => {
  it('monte après un succès, baisse après un échec', () => {
    expect(updateRating(1000, 0, 1000, true, 0)).toBe(1020);
    expect(updateRating(1000, 0, 1000, false, 0)).toBe(980);
  });
  it('un succès avec indices rapporte moins', () => {
    expect(updateRating(1000, 0, 1000, true, 2)).toBeLessThan(updateRating(1000, 0, 1000, true, 0));
  });
  it('varie moins avec l’expérience', () => {
    expect(updateRating(1000, 200, 1000, true, 0)).toBe(1008);
  });
});

describe('répétition espacée', () => {
  it('allonge les intervalles en cas de réussite', () => {
    const a = scheduleReview(undefined, 5, 0);
    expect(a.intervalDays).toBe(1);
    const b = scheduleReview(a, 5, 0);
    expect(b.intervalDays).toBe(3);
    const c = scheduleReview(b, 5, 0);
    expect(c.intervalDays).toBeGreaterThan(3);
    expect(c.due).toBe(c.intervalDays * DAY);
  });
  it('recommence après un échec', () => {
    const c = scheduleReview({ reps: 4, ease: 2.5, intervalDays: 20 }, reviewQuality(false, 3), 0);
    expect(c).toMatchObject({ reps: 0, intervalDays: 1 });
    expect(c.ease).toBeLessThan(2.5);
  });
});

describe('statistiques par thème', () => {
  it('repère les thèmes faibles', () => {
    const mk = (theme: string, success: boolean, i: number) => ({ kind: 'puzzle' as const, refId: String(i), themes: [theme], success, hints: 0, at: i });
    const attempts = [
      ...Array.from({ length: 6 }, (_, i) => mk('fork', i < 2, i)),
      ...Array.from({ length: 6 }, (_, i) => mk('pin', i < 5, 10 + i)),
      mk('skewer', false, 30),
    ];
    const stats = themeStats(attempts);
    expect(stats[0]?.theme).toBe('skewer');
    expect(weakThemes(stats).map((s) => s.theme)).toEqual(['fork']);
  });
});

describe('base de données', () => {
  it('profil, exercice et cote', async () => {
    expect(await getProfile(d)).toBeUndefined();
    await saveProfile(newProfile('debutant', 'occasionnel', ['tactique'], 1), d);
    const after = await recordPuzzle({ id: 'p1', rating: 900, themes: ['fork'] }, true, 0, 5000, d);
    expect(after).toBe(920);
    expect((await getProfile(d))?.tactics).toEqual({ rating: 920, count: 1 });
    expect(await d.attempts.count()).toBe(1);
  });
  it('révision d’ouverture planifiée', async () => {
    const p = await recordOpeningReview('italienne', true, 0, 1000, d);
    expect(p).toMatchObject({ reps: 1, intervalDays: 1, due: 1000 + DAY, attempts: 1 });
  });
  it('sauvegarde puis restauration à l’identique', async () => {
    await saveProfile(newProfile('avance', 'club', [], 1), d);
    await recordPuzzle({ id: 'p1', rating: 1500, themes: ['pin'] }, false, 1, 100, d);
    await recordOpeningReview('slave', false, 2, 5, d);
    const backup = JSON.parse(JSON.stringify(await exportBackup(d)));
    await resetAll(d);
    expect(await getProfile(d)).toBeUndefined();
    await importBackup(backup, d);
    expect((await getProfile(d))?.level).toBe('avance');
    expect(await d.attempts.count()).toBe(2);
    expect(await d.openings.get('slave')).toBeDefined();
  });
  it('refuse une sauvegarde invalide sans rien effacer', async () => {
    await saveProfile(newProfile('debutant', 'x', [], 1), d);
    await expect(importBackup({ format: 'autre' }, d)).rejects.toThrow(/pas une sauvegarde/);
    await expect(importBackup({ format: 'chess-master-academy-backup', version: 99, profile: [], lessons: [], attempts: [], openings: [] }, d)).rejects.toThrow(/plus récente/);
    expect(await getProfile(d)).toBeDefined();
  });
});
