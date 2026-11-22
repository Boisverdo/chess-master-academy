/**
 * Course contre la montre : enchaîner des exercices tactiques de difficulté croissante.
 * Trois erreurs (ou la fin du temps) terminent la série. Le score est le nombre d'exercices résolus.
 * Ces séries ne modifient pas la cote d'exercices : sous la pression du temps, elles mesurent autre chose.
 */
import type { Attempt } from '../storage/db';
import type { Puzzle } from './puzzles/puzzle';

export type RushMode = '3min' | '5min' | 'survie';

export const RUSH_MODES: Record<RushMode, { label: string; seconds: number | null; detail: string }> = {
  '3min': { label: '3 minutes', seconds: 180, detail: 'Le plus d’exercices possible en 3 minutes.' },
  '5min': { label: '5 minutes', seconds: 300, detail: 'Le plus d’exercices possible en 5 minutes.' },
  survie: { label: 'Survie', seconds: null, detail: 'Sans limite de temps : la série s’arrête à la 3e erreur.' },
};

export const RUSH_MAX_ERRORS = 3;
/** Au plus 3 coups à trouver : la série doit garder du rythme. */
export const RUSH_MAX_PLIES = 6;

/** Difficulté de départ : nettement sous la cote du joueur, pour se mettre en route. */
export function rushStart(rating: number): number {
  return Math.min(1600, Math.max(400, Math.round(rating - 400)));
}

/** Difficulté visée pour le n-ième exercice (0 = premier) : elle monte de 60 points par exercice résolu. */
export function rushTarget(start: number, solved: number): number {
  return Math.min(2500, start + 60 * solved);
}

/** Exercice le plus proche de la difficulté visée, jamais deux fois dans la même série. */
export function pickRushPuzzle(all: readonly Puzzle[], target: number, used: ReadonlySet<string>, random: () => number = Math.random): Puzzle | undefined {
  const pool = all.filter((p) => !used.has(p.id) && p.moves.trim().split(/\s+/).length <= RUSH_MAX_PLIES);
  for (const width of [40, 80, 150, 300, 600, 3000]) {
    const near = pool.filter((p) => Math.abs(p.rating - target) <= width);
    if (near.length) return near[Math.floor(random() * near.length)];
  }
  return undefined;
}

/** Meilleur score et nombre de séries pour chaque mode. */
export function rushRecords(attempts: readonly Attempt[]): Record<RushMode, { best: number; runs: number; last?: number }> {
  const out = { '3min': { best: 0, runs: 0 }, '5min': { best: 0, runs: 0 }, survie: { best: 0, runs: 0 } } as Record<RushMode, { best: number; runs: number; last?: number }>;
  for (const a of [...attempts].sort((x, y) => x.at - y.at)) {
    if (a.kind !== 'rush' || !(a.refId in out)) continue;
    const r = out[a.refId as RushMode];
    r.best = Math.max(r.best, a.score ?? 0);
    r.runs++;
    r.last = a.score ?? 0;
  }
  return out;
}
