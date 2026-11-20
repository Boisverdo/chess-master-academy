import { describe, expect, it } from 'vitest';
import { ALL_LESSONS } from '../learning/lessons';
import type { Attempt, LessonProgress, Profile } from '../storage/db';
import { DAY_MS, dailyId } from './challenges';
import { homeView, type HomeInput } from './home';

const T0 = new Date(2026, 10, 19, 12, 0, 0).getTime(); // jeudi 19 novembre 2026, midi
const att = (over: Partial<Attempt>): Attempt => ({ kind: 'puzzle', refId: 'x', themes: ['fourchette'], success: true, hints: 0, at: T0, ...over });
const profile: Profile = { id: 'me', createdAt: T0 - 10 * DAY_MS, level: 'debutant', experience: '', goals: [], tactics: { rating: 1040, count: 12 } };
const input = (over: Partial<HomeInput> = {}): HomeInput => ({ lessons: new Map(), openings: [], attempts: [], games: [], stats: [], habits: [], drillsDue: 0, now: T0, ...over });
const lesson = (id: string, over: Partial<LessonProgress> = {}): [string, LessonProgress] => [id, { lessonId: id, status: 'in-progress', step: 2, correct: 1, total: 1, updatedAt: T0, ...over }];

describe('accueil : tableau de bord', () => {
  it('premier lancement : rien d’enregistré, on présente les premiers pas', () => {
    expect(homeView(input()).isNew).toBe(true);
    // Une partie commencée sur l'échiquier suffit pour afficher le tableau de bord (et la reprendre).
    const v = homeView(input({ boardGame: { plies: 3, over: false } }));
    expect(v.isNew).toBe(false);
    expect(v.resume).toEqual({ title: 'Ta partie sur l’échiquier', detail: '2 coups joués, partie en cours', link: '/echiquier' });
  });

  it('sans profil, la séance commence par l’évaluation initiale', () => {
    const v = homeView(input({ attempts: [att({})] }));
    expect(v.isNew).toBe(false);
    expect(v.session[0]!.link).toBe('/evaluation');
    expect(v.rating).toBeUndefined();
  });

  it('reprendre : la leçon commencée la plus récente, sans la répéter dans la séance', () => {
    const [a, b] = [ALL_LESSONS[0]!, ALL_LESSONS[1]!];
    const v = homeView(input({ profile, lessons: new Map([lesson(a.id, { updatedAt: T0 - DAY_MS }), lesson(b.id, { step: 0 })]), boardGame: { plies: 10, over: false } }));
    expect(v.resume).toEqual({ title: `Leçon : ${b.title}`, detail: `Étape 1 sur ${b.steps.length}`, link: `/lecons/${b.id}` });
    expect(v.session.some((r) => r.link === v.resume!.link)).toBe(false);
    expect(v.session.length).toBeLessThanOrEqual(3);
  });

  it('une partie terminée sur l’échiquier n’est pas proposée', () => {
    expect(homeView(input({ profile, boardGame: { plies: 20, over: true } })).resume).toBeUndefined();
  });

  it('défi du jour : à faire, réussi ou manqué (seulement aujourd’hui)', () => {
    expect(homeView(input({ profile })).daily).toBe('a-faire');
    expect(homeView(input({ profile, attempts: [att({ kind: 'challenge', refId: dailyId(T0) })] })).daily).toBe('reussi');
    expect(homeView(input({ profile, attempts: [att({ kind: 'challenge', refId: dailyId(T0), success: false })] })).daily).toBe('manque');
    expect(homeView(input({ profile, attempts: [att({ kind: 'challenge', refId: dailyId(T0 - DAY_MS), at: T0 - DAY_MS })] })).daily).toBe('a-faire');
  });

  it('série, activité du jour, leçons et cote réelles', () => {
    const done = lesson(ALL_LESSONS[0]!.id, { status: 'done', completedAt: T0 });
    const v = homeView(input({ profile, lessons: new Map([done]), attempts: [att({ at: T0 - DAY_MS }), att({ at: T0 - 2 * DAY_MS })] }));
    expect(v).toMatchObject({ streak: 3, activeToday: true, lessonsDone: 1, lessonsTotal: ALL_LESSONS.length, rating: 1040, ratingCount: 12 });
    const yesterday = homeView(input({ profile, attempts: [att({ at: T0 - DAY_MS })] }));
    expect(yesterday).toMatchObject({ streak: 1, activeToday: false });
  });

  it('objectifs de la semaine comptés sur la semaine en cours', () => {
    const v = homeView(input({ profile, attempts: [att({}), att({}), att({ at: T0 - 7 * DAY_MS })] }));
    expect(v.objectives.find((o) => o.id === 'exercices')).toMatchObject({ done: 2, target: 30 });
  });
});
