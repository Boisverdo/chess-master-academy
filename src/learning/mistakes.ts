/**
 * Revue de mes erreurs : rassemble ce que le joueur a manqué, à partir de ses données réelles uniquement.
 * - Exercices tactiques manqués (série normale ou course contre la montre), tant qu'ils ne sont pas repris avec succès.
 * - Positions à retravailler issues de ses parties analysées (moments critiques).
 */
import type { Attempt, Drill } from '../storage/db';

export interface MissedPuzzle {
  id: string;
  /** Dernier échec. */
  at: number;
  from: 'tactiques' | 'course';
}

/** Exercices dont le dernier essai est un échec (une reprise réussie les retire de la liste). */
export function missedPuzzles(attempts: readonly Attempt[]): MissedPuzzle[] {
  const last = new Map<string, { at: number; success: boolean; from: MissedPuzzle['from'] }>();
  const see = (id: string, at: number, success: boolean, from: MissedPuzzle['from']) => {
    const prev = last.get(id);
    if (!prev || at >= prev.at) last.set(id, { at, success, from });
  };
  for (const a of attempts) {
    if (a.kind === 'puzzle' || a.kind === 'puzzle-review') see(a.refId, a.at, a.success, 'tactiques');
    else if (a.kind === 'rush') for (const id of a.missed ?? []) see(id, a.at, false, 'course');
  }
  return [...last.entries()]
    .filter(([, v]) => !v.success)
    .map(([id, v]) => ({ id, at: v.at, from: v.from }))
    .sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}

/** Positions à retravailler : jamais réussies d'abord, puis les plus anciennement revues. Filtre facultatif par étiquette. */
export function drillQueue(drills: readonly Drill[], tag?: string): Drill[] {
  return drills
    .filter((d) => !tag || d.tags.includes(tag))
    .sort((a, b) => Number(a.lastSuccess === true) - Number(b.lastSuccess === true) || a.due - b.due || a.id.localeCompare(b.id));
}

/** Nombre de positions par étiquette d'erreur (pour filtrer). */
export function drillTags(drills: readonly Drill[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of drills) for (const t of new Set(d.tags)) out.set(t, (out.get(t) ?? 0) + 1);
  return out;
}
