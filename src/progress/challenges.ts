/**
 * Défis, objectifs, séries et badges (Module 14).
 * Les badges récompensent la MAÎTRISE (résultats mesurés), jamais le simple volume.
 */
import type { Puzzle } from '../learning/puzzles/puzzle';
import type { ThemeStat } from '../storage/learning';
import type { Attempt, GameRecord, LessonProgress, OpeningProgress } from '../storage/db';
import { themeLabel, THEMES } from '../learning/puzzles/themes';

export const DAY_MS = 86_400_000;
export const dayKey = (t: number) => new Date(t).toLocaleDateString('fr-CA'); // AAAA-MM-JJ, heure locale

/** Hachage déterministe (FNV-1a) : le défi du jour est le même toute la journée. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function dailyChallenge(puzzles: readonly Puzzle[], rating: number, now: number): Puzzle | undefined {
  const near = puzzles.filter((p) => Math.abs(p.rating - rating) <= 150);
  const pool = near.length ? near : puzzles;
  return pool[hash(dayKey(now)) % pool.length];
}

export const dailyId = (now: number) => `defi-${dayKey(now)}`;

/** Série : jours consécutifs avec au moins une activité, jusqu'à aujourd'hui (ou hier, si rien encore aujourd'hui). */
export function streak(activityTimes: readonly number[], now: number): number {
  const days = new Set(activityTimes.map(dayKey));
  let d = now;
  if (!days.has(dayKey(d))) d -= DAY_MS;
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d -= DAY_MS;
  }
  return n;
}

/** Lundi 00:00 (heure locale) de la semaine en cours. */
export function weekStart(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const shift = (d.getDay() + 6) % 7;
  return d.getTime() - shift * DAY_MS;
}

export interface Objective {
  id: string;
  label: string;
  target: number;
  done: number;
  link: string;
}

/** Objectifs hebdomadaires adaptés aux faiblesses mesurées du joueur. */
export function weeklyObjectives(input: { attempts: readonly Attempt[]; lessons: readonly LessonProgress[]; games: readonly GameRecord[]; weakTheme?: ThemeStat; now: number }): Objective[] {
  const from = weekStart(input.now);
  const week = input.attempts.filter((a) => a.at >= from);
  const puzzles = week.filter((a) => a.kind === 'puzzle');
  const out: Objective[] = [
    { id: 'exercices', label: 'Résoudre 30 exercices tactiques', target: 30, done: puzzles.filter((a) => a.success).length, link: '/tactiques' },
    { id: 'lecons', label: 'Terminer 2 leçons', target: 2, done: input.lessons.filter((l) => l.completedAt && l.completedAt >= from).length, link: '/lecons' },
    { id: 'ouvertures', label: 'Réviser 2 ouvertures', target: 2, done: week.filter((a) => a.kind === 'opening').length, link: '/ouvertures' },
    { id: 'analyses', label: 'Analyser 2 de mes parties', target: 2, done: input.games.filter((g) => g.userColor && g.analyzedAt && g.analyzedAt >= from).length, link: '/analyse' },
  ];
  if (input.weakTheme) {
    const t = input.weakTheme.theme;
    out.splice(1, 0, { id: `theme-${t}`, label: `10 exercices réussis sur ton point faible : ${themeLabel(t).toLowerCase()}`, target: 10, done: puzzles.filter((a) => a.success && a.themes.includes(t)).length, link: `/tactiques?theme=${t}` });
  }
  return out.map((o) => ({ ...o, done: Math.min(o.done, o.target) }));
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  /** Progression vers le badge (0 à 1). */
  progress: number;
}

export function badges(input: {
  attempts: readonly Attempt[];
  lessons: ReadonlyMap<string, LessonProgress>;
  openings: readonly OpeningProgress[];
  games: readonly GameRecord[];
  strategyIds: readonly string[];
  startRating?: number;
  rating?: number;
  streakDays: number;
}): Badge[] {
  const passed = (exam: string) => input.attempts.some((a) => a.kind === 'exam' && a.refId === exam && a.success);
  const list: Badge[] = [
    { id: 'regles', title: 'Règles maîtrisées', description: 'Réussir l’examen des règles (80 %).', earned: passed('examen-regles'), progress: passed('examen-regles') ? 1 : 0 },
    { id: 'tactique', title: 'Œil tactique', description: 'Réussir l’examen tactique (7 exercices sur 10, sans indice).', earned: passed('examen-tactique'), progress: passed('examen-tactique') ? 1 : 0 },
    { id: 'ouvertures', title: 'Répertoire connu', description: 'Réussir l’examen des ouvertures (80 %).', earned: passed('examen-ouvertures'), progress: passed('examen-ouvertures') ? 1 : 0 },
    { id: 'finales', title: 'Finales de base', description: 'Réussir l’examen des finales (mat, Lucena, Philidor).', earned: passed('examen-finales'), progress: passed('examen-finales') ? 1 : 0 },
  ];
  const strat = input.strategyIds.filter((id) => {
    const l = input.lessons.get(id);
    return l?.status === 'done' && l.total > 0 && l.correct / l.total >= 0.7;
  }).length;
  list.push({ id: 'stratege', title: 'Stratège', description: 'Terminer toutes les leçons de stratégie avec au moins 70 % du premier coup.', earned: strat === input.strategyIds.length && strat > 0, progress: input.strategyIds.length ? strat / input.strategyIds.length : 0 });
  const solid = input.openings.filter((o) => o.reps >= 3 && o.lastSuccess).length;
  list.push({ id: 'repertoire', title: 'Répertoire solide', description: 'Trois ouvertures révisées au moins trois fois de suite sans échec.', earned: solid >= 3, progress: Math.min(1, solid / 3) });
  const analysed = input.games.filter((g) => g.userColor && g.analyzedAt).length;
  list.push({ id: 'analyste', title: 'Analyste', description: 'Analyser 10 de tes parties.', earned: analysed >= 10, progress: Math.min(1, analysed / 10) });
  if (input.startRating !== undefined && input.rating !== undefined) {
    const gain = input.rating - input.startRating;
    list.push({ id: 'progres', title: 'En progrès', description: 'Gagner 200 points de cote d’exercices depuis l’évaluation.', earned: gain >= 200, progress: Math.max(0, Math.min(1, gain / 200)) });
  }
  list.push({ id: 'regularite', title: 'Régularité', description: 'S’entraîner 7 jours d’affilée.', earned: input.streakDays >= 7, progress: Math.min(1, input.streakDays / 7) });
  // Maîtrise d'un thème tactique : au moins 20 essais, 80 % de réussite sans indice sur les 20 derniers.
  for (const t of THEMES) {
    const last = input.attempts.filter((a) => a.kind === 'puzzle' && a.themes.includes(t.key)).sort((a, b) => b.at - a.at).slice(0, 20);
    const ok = last.filter((a) => a.success && a.hints === 0).length;
    list.push({ id: `theme-${t.key}`, title: `Maîtrise : ${t.label}`, description: `80 % de réussite sans indice sur 20 exercices « ${t.label.toLowerCase()} ».`, earned: last.length >= 20 && ok >= 16, progress: Math.min(1, ok / 16) });
  }
  return list;
}
