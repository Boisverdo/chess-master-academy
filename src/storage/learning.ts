/**
 * Calculs pédagogiques purs (sans base de données) : cote d'exercices, répétition espacée,
 * statistiques par thème. Tout est déterministe et testé.
 */
import type { Attempt, Level, OpeningProgress } from './db';

export const DAY = 86_400_000;

/** Cote de départ des exercices selon le niveau évalué (échelle des puzzles Lichess). */
export const START_RATING: Record<Level, number> = {
  'debutant-absolu': 600,
  debutant: 900,
  intermediaire: 1300,
  avance: 1700,
};

/**
 * Mise à jour de type Elo après un exercice. K diminue avec l'expérience.
 * Un exercice réussi avec indices compte comme un demi-succès au plus.
 */
export function updateRating(rating: number, count: number, puzzleRating: number, success: boolean, hints: number): number {
  const k = count < 20 ? 40 : count < 100 ? 24 : 16;
  const expected = 1 / (1 + 10 ** ((puzzleRating - rating) / 400));
  const score = success ? (hints === 0 ? 1 : hints === 1 ? 0.6 : 0.4) : 0;
  return Math.round(Math.max(100, Math.min(3200, rating + k * (score - expected))));
}

/** Qualité d'une révision (0 à 5), façon SM-2. */
export function reviewQuality(success: boolean, mistakes: number): number {
  if (!success) return 1;
  if (mistakes === 0) return 5;
  return mistakes === 1 ? 4 : 3;
}

/** Algorithme SM-2 simplifié pour la révision des ouvertures et des notions. */
export function scheduleReview(prev: Pick<OpeningProgress, 'reps' | 'ease' | 'intervalDays'> | undefined, quality: number, now: number) {
  const ease0 = prev?.ease ?? 2.5;
  const ease = Math.max(1.3, ease0 + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  let reps = prev?.reps ?? 0;
  let intervalDays: number;
  if (quality < 3) {
    reps = 0;
    intervalDays = 1;
  } else {
    reps += 1;
    intervalDays = reps === 1 ? 1 : reps === 2 ? 3 : Math.round((prev?.intervalDays ?? 3) * ease);
  }
  return { reps, ease: Math.round(ease * 100) / 100, intervalDays, due: now + intervalDays * DAY };
}

export interface ThemeStat {
  theme: string;
  attempts: number;
  successes: number;
  rate: number;
}

/** Réussite par thème sur les `window` dernières tentatives de chaque thème. */
export function themeStats(attempts: readonly Attempt[], window = 30): ThemeStat[] {
  const byTheme = new Map<string, Attempt[]>();
  for (const a of attempts.toSorted((x, y) => y.at - x.at)) {
    for (const t of a.themes) {
      const list = byTheme.get(t) ?? [];
      if (list.length < window) list.push(a);
      byTheme.set(t, list);
    }
  }
  return [...byTheme.entries()]
    .map(([theme, list]) => {
      const successes = list.filter((a) => a.success && a.hints === 0).length;
      return { theme, attempts: list.length, successes, rate: list.length ? successes / list.length : 0 };
    })
    .sort((a, b) => a.rate - b.rate || b.attempts - a.attempts);
}

/** Un thème est une faiblesse s'il a au moins 5 essais et moins de 60 % de réussite sans indice. */
export function weakThemes(stats: readonly ThemeStat[]): ThemeStat[] {
  return stats.filter((s) => s.attempts >= 5 && s.rate < 0.6);
}
