/**
 * Statistiques du tableau de bord (Module 13), calculées uniquement à partir des données enregistrées.
 * Toute estimation est nommée comme telle.
 */
import type { Attempt, GameRecord, LessonProgress, Level, OpeningProgress } from '../storage/db';

export interface Point {
  at: number;
  value: number;
  label?: string;
}

/** Évolution de la cote d'exercices (après chaque exercice). */
export function tacticsSeries(attempts: readonly Attempt[]): Point[] {
  return attempts
    .filter((a) => a.kind === 'puzzle' && a.ratingAfter !== undefined)
    .sort((a, b) => a.at - b.at)
    .map((a) => ({ at: a.at, value: a.ratingAfter! }));
}

export interface GameSummary {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  pct: { win: number; draw: number; loss: number };
  /** Précision du joueur dans ses parties analysées, dans l'ordre chronologique. */
  accuracy: Point[];
}

export function gameSummary(games: readonly GameRecord[]): GameSummary {
  const mine = games.filter((g) => g.userColor && ['1-0', '0-1', '1/2-1/2'].includes(g.result));
  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (const g of mine) {
    if (g.result === '1/2-1/2') draws++;
    else if ((g.result === '1-0') === (g.userColor === 'w')) wins++;
    else losses++;
  }
  const n = mine.length;
  const pct = (x: number) => (n ? Math.round((x / n) * 1000) / 10 : 0);
  const accuracy = games
    .filter((g) => g.userColor && g.accuracy)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((g) => ({ at: g.createdAt, value: g.accuracy![g.userColor!], label: `${g.white} – ${g.black}` }));
  return { games: n, wins, draws, losses, pct: { win: pct(wins), draw: pct(draws), loss: pct(losses) }, accuracy };
}

/**
 * Temps d'apprentissage ESTIMÉ : les activités enregistrées sont regroupées en séances
 * (moins de 10 minutes entre deux activités) ; chaque séance compte sa durée + 2 minutes.
 */
export function estimatedLearningMinutes(timestamps: readonly number[], gapMs = 10 * 60_000): number {
  const ts = [...timestamps].sort((a, b) => a - b);
  if (!ts.length) return 0;
  let total = 0;
  let start = ts[0]!;
  let prev = ts[0]!;
  for (const t of ts.slice(1)) {
    if (t - prev > gapMs) {
      total += prev - start + 2 * 60_000;
      start = t;
    }
    prev = t;
  }
  total += prev - start + 2 * 60_000;
  return Math.round(total / 60_000);
}

export interface ExerciseCounts {
  puzzles: { solved: number; failed: number };
  lessonExercises: { firstTry: number; other: number };
}

export function exerciseCounts(attempts: readonly Attempt[]): ExerciseCounts {
  const p = attempts.filter((a) => a.kind === 'puzzle');
  const l = attempts.filter((a) => a.kind === 'lesson');
  return {
    puzzles: { solved: p.filter((a) => a.success).length, failed: p.filter((a) => !a.success).length },
    lessonExercises: { firstTry: l.filter((a) => a.success).length, other: l.filter((a) => !a.success).length },
  };
}

/** Maîtrise des ouvertures : pratiquée, et « solide » si au moins 3 révisions réussies d'affilée. */
export function openingMastery(openings: readonly OpeningProgress[], total: number) {
  return { practiced: openings.length, solid: openings.filter((o) => o.reps >= 3 && o.lastSuccess).length, total };
}

/** Niveau en finales : leçons du cours de finales terminées. */
export function endgameProgress(lessons: ReadonlyMap<string, LessonProgress>, endgameIds: readonly string[]) {
  const done = endgameIds.filter((id) => lessons.get(id)?.status === 'done').length;
  return { done, total: endgameIds.length };
}

/**
 * Niveau actuel estimé d'après la cote d'exercices, seulement avec assez de données (≥ 20 exercices).
 * Sinon, on garde le niveau de l'évaluation initiale.
 */
export function estimatedLevel(rating: number, count: number, fallback: Level): { level: Level; estimated: boolean } {
  if (count < 20) return { level: fallback, estimated: false };
  const level: Level = rating < 750 ? 'debutant-absolu' : rating < 1100 ? 'debutant' : rating < 1500 ? 'intermediaire' : 'avance';
  return { level, estimated: true };
}

/**
 * Fourchette Elo INDICATIVE tirée de la cote d'exercices (± 200), seulement après 20 exercices.
 * Ce n'est pas un classement officiel et elle peut différer de la cote en partie.
 */
export function eloEstimate(rating: number, count: number): { low: number; high: number } | null {
  if (count < 20) return null;
  return { low: Math.max(400, Math.round((rating - 200) / 50) * 50), high: Math.round((rating + 200) / 50) * 50 };
}

export interface DayEntry {
  day: string;
  at: number;
  puzzles: number;
  puzzlesSolved: number;
  lessons: string[];
  openings: number;
  games: number;
  exams: number;
}

/** Historique jour par jour des entraînements et des parties. */
export function history(attempts: readonly Attempt[], lessons: readonly LessonProgress[], games: readonly GameRecord[], lessonTitle: (id: string) => string): DayEntry[] {
  const days = new Map<string, DayEntry>();
  const key = (t: number) => new Date(t).toLocaleDateString('fr-CA');
  const get = (t: number) => {
    const k = key(t);
    let d = days.get(k);
    if (!d) {
      d = { day: k, at: t, puzzles: 0, puzzlesSolved: 0, lessons: [], openings: 0, games: 0, exams: 0 };
      days.set(k, d);
    }
    d.at = Math.max(d.at, t);
    return d;
  };
  for (const a of attempts) {
    const d = get(a.at);
    if (a.kind === 'puzzle') {
      d.puzzles++;
      if (a.success) d.puzzlesSolved++;
    } else if (a.kind === 'opening') d.openings++;
    else if (a.kind === 'exam') d.exams++;
  }
  for (const l of lessons) if (l.completedAt) get(l.completedAt).lessons.push(lessonTitle(l.lessonId));
  for (const g of games) get(g.analyzedAt ?? g.createdAt).games++;
  return [...days.values()].sort((a, b) => b.at - a.at);
}
