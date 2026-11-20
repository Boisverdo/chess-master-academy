/**
 * Tableau de bord de l'accueil : où reprendre, la séance du jour, le défi du jour, la série et la semaine.
 * Tout est calculé à partir des données réelles du joueur (rien n'est inventé) ; fonction pure, testée.
 */
import type { Habit } from '../coach/habits';
import { ALL_LESSONS, findLesson } from '../learning/lessons';
import { recommend, type Recommendation } from '../learning/recommend';
import type { Attempt, GameRecord, LessonProgress, OpeningProgress, Profile } from '../storage/db';
import { weakThemes, type ThemeStat } from '../storage/learning';
import { activityTimes, dailyId, dayKey, streak, weeklyObjectives, type Objective } from './challenges';

export interface HomeInput {
  profile?: Profile;
  lessons: ReadonlyMap<string, LessonProgress>;
  openings: readonly OpeningProgress[];
  attempts: readonly Attempt[];
  games: readonly GameRecord[];
  stats: readonly ThemeStat[];
  habits: readonly Habit[];
  drillsDue: number;
  /** Partie en cours sur l'échiquier interactif (coups joués, partie non terminée). */
  boardGame?: { plies: number; over: boolean };
  now: number;
}

export interface ResumeItem {
  title: string;
  detail: string;
  link: string;
}

export interface HomeView {
  /** Aucune activité enregistrée : on présente les premiers pas. */
  isNew: boolean;
  resume?: ResumeItem;
  /** Les 3 premières étapes de la séance du jour (sans répéter « Reprendre »). */
  session: Recommendation[];
  /** Nombre d'étapes supplémentaires visibles dans « Mon apprentissage ». */
  sessionMore: number;
  daily: 'a-faire' | 'reussi' | 'manque';
  streak: number;
  activeToday: boolean;
  objectives: Objective[];
  rating?: number;
  ratingCount: number;
  lessonsDone: number;
  lessonsTotal: number;
}

const ASSESSMENT: Recommendation = {
  kind: 'assessment',
  title: 'Évaluation initiale (10 min)',
  reason: 'Ton entraînement s’adaptera à ton niveau réel.',
  link: '/evaluation',
};

export function homeView(input: HomeInput): HomeView {
  const { profile, lessons, now } = input;
  const times = activityTimes(input);
  const isNew = !profile && times.length === 0 && !(input.boardGame && input.boardGame.plies > 0 && !input.boardGame.over);

  // Reprendre : la leçon commencée le plus récemment, sinon la partie en cours sur l'échiquier.
  let resume: ResumeItem | undefined;
  const started = [...lessons.values()].filter((l) => l.status === 'in-progress').sort((a, b) => b.updatedAt - a.updatedAt);
  for (const p of started) {
    const lesson = findLesson(p.lessonId);
    if (!lesson) continue;
    const steps = lesson.steps.length;
    resume = { title: `Leçon : ${lesson.title}`, detail: `Étape ${Math.min(p.step + 1, steps)} sur ${steps}`, link: `/lecons/${lesson.id}` };
    break;
  }
  if (!resume && input.boardGame && input.boardGame.plies > 0 && !input.boardGame.over) {
    const moves = Math.ceil(input.boardGame.plies / 2);
    resume = { title: 'Ta partie sur l’échiquier', detail: `${moves} coup${moves > 1 ? 's' : ''} joué${moves > 1 ? 's' : ''}, partie en cours`, link: '/echiquier' };
  }

  const recs = recommend({ level: profile?.level ?? 'debutant', lessons, openings: input.openings, themeStats: input.stats, now, habits: input.habits, drillsDue: input.drillsDue });
  const all = (profile ? recs : [ASSESSMENT, ...recs]).filter((r) => r.link !== resume?.link);

  const today = input.attempts.find((a) => a.kind === 'challenge' && a.refId === dailyId(now));
  return {
    isNew,
    resume,
    session: all.slice(0, 3),
    sessionMore: Math.max(0, all.length - 3),
    daily: today ? (today.success ? 'reussi' : 'manque') : 'a-faire',
    streak: streak(times, now),
    activeToday: times.some((t) => dayKey(t) === dayKey(now)),
    objectives: weeklyObjectives({ attempts: input.attempts, lessons: [...lessons.values()], games: input.games, weakTheme: weakThemes(input.stats)[0], now }),
    rating: profile?.tactics.rating,
    ratingCount: profile?.tactics.count ?? 0,
    lessonsDone: ALL_LESSONS.filter((l) => lessons.get(l.id)?.status === 'done').length,
    lessonsTotal: ALL_LESSONS.length,
  };
}
