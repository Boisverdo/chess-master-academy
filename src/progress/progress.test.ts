import { describe, expect, it } from 'vitest';
import type { Attempt, GameRecord } from '../storage/db';
import { badges, dailyChallenge, DAY_MS, streak, weekStart, weeklyObjectives } from './challenges';
import { eloEstimate, estimatedLearningMinutes, estimatedLevel, exerciseCounts, gameSummary, history, tacticsSeries } from './stats';

const T0 = new Date(2026, 10, 19, 12, 0, 0).getTime(); // jeudi 19 novembre 2026, midi
const att = (over: Partial<Attempt>): Attempt => ({ kind: 'puzzle', refId: 'x', themes: ['fourchette'], success: true, hints: 0, at: T0, ...over });
const g = (over: Partial<GameRecord>): GameRecord => ({ source: 'ia', createdAt: T0, pgn: '', white: 'a', black: 'b', result: '1-0', userColor: 'w', ...over });

describe('statistiques', () => {
  it('cote d’exercices dans l’ordre chronologique', () => {
    expect(tacticsSeries([att({ at: 2, ratingAfter: 1020 }), att({ at: 1, ratingAfter: 1000 }), att({ kind: 'lesson' })]).map((p) => p.value)).toEqual([1000, 1020]);
  });
  it('victoires, nulles, défaites du point de vue du joueur', () => {
    const s = gameSummary([g({}), g({ result: '0-1' }), g({ result: '0-1', userColor: 'b' }), g({ result: '1/2-1/2' }), g({ userColor: undefined }), g({ result: '*' })]);
    expect(s).toMatchObject({ games: 4, wins: 2, draws: 1, losses: 1, pct: { win: 50, draw: 25, loss: 25 } });
  });
  it('précision des parties analysées seulement', () => {
    expect(gameSummary([g({ accuracy: { w: 81.5, b: 70 } }), g({})]).accuracy.map((p) => p.value)).toEqual([81.5]);
  });
  it('temps d’apprentissage estimé par séances', () => {
    const m = 60_000;
    expect(estimatedLearningMinutes([])).toBe(0);
    expect(estimatedLearningMinutes([0, 5 * m, 8 * m])).toBe(10); // une séance de 8 min + 2
    expect(estimatedLearningMinutes([0, 60 * m])).toBe(4); // deux séances isolées
  });
  it('compteurs d’exercices', () => {
    expect(exerciseCounts([att({}), att({ success: false }), att({ kind: 'lesson' })])).toEqual({ puzzles: { solved: 1, failed: 1 }, lessonExercises: { firstTry: 1, other: 0 } });
  });
  it('niveau et fourchette estimés seulement avec assez de données', () => {
    expect(estimatedLevel(1600, 10, 'debutant')).toEqual({ level: 'debutant', estimated: false });
    expect(estimatedLevel(1600, 30, 'debutant')).toEqual({ level: 'avance', estimated: true });
    expect(eloEstimate(1210, 5)).toBeNull();
    expect(eloEstimate(1210, 25)).toEqual({ low: 1000, high: 1400 });
  });
  it('historique groupé par jour', () => {
    const h = history([att({}), att({ success: false }), att({ at: T0 - DAY_MS, kind: 'opening' })], [{ lessonId: 'l', status: 'done', step: 0, correct: 1, total: 1, updatedAt: T0, completedAt: T0 }], [g({ analyzedAt: T0 })], () => 'Le pat');
    expect(h[0]).toMatchObject({ puzzles: 2, puzzlesSolved: 1, lessons: ['Le pat'], games: 1 });
    expect(h[1]).toMatchObject({ openings: 1 });
  });
});

describe('défis', () => {
  const puzzles = Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, fen: '', moves: '', rating: 800 + i * 20, themes: [] }));
  it('défi du jour stable dans la journée, proche de la cote', () => {
    const a = dailyChallenge(puzzles, 1000, T0)!;
    expect(dailyChallenge(puzzles, 1000, T0 + 3_600_000)!.id).toBe(a.id);
    expect(Math.abs(a.rating - 1000)).toBeLessThanOrEqual(150);
  });
  it('série de jours consécutifs', () => {
    expect(streak([T0, T0 - DAY_MS, T0 - 2 * DAY_MS, T0 - 4 * DAY_MS], T0)).toBe(3);
    expect(streak([T0 - DAY_MS], T0)).toBe(1);
    expect(streak([T0 - 3 * DAY_MS], T0)).toBe(0);
  });
  it('objectifs de la semaine, dont le point faible', () => {
    const monday = weekStart(T0);
    expect(new Date(monday).getDay()).toBe(1);
    const o = weeklyObjectives({ attempts: [att({}), att({ at: monday - 1 })], lessons: [], games: [], weakTheme: { theme: 'fourchette', attempts: 8, successes: 2, rate: 0.25 }, now: T0 });
    expect(o.find((x) => x.id === 'exercices')?.done).toBe(1);
    expect(o.find((x) => x.id === 'theme-fourchette')).toMatchObject({ done: 1, target: 10 });
  });
  it('badges de maîtrise, pas de volume', () => {
    const many = Array.from({ length: 20 }, (_, i) => att({ at: i, success: i < 17 }));
    const b = badges({ attempts: [...many, att({ kind: 'exam', refId: 'examen-regles' })], lessons: new Map(), openings: [], games: [], strategyIds: ['s1'], streakDays: 2 });
    expect(b.find((x) => x.id === 'regles')?.earned).toBe(true);
    expect(b.find((x) => x.id === 'theme-fourchette')?.earned).toBe(true);
    expect(b.find((x) => x.id === 'theme-clouage')?.earned).toBe(false);
    expect(b.find((x) => x.id === 'regularite')?.progress).toBeCloseTo(2 / 7);
  });
});
