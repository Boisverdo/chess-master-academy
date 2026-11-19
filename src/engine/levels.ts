/**
 * Niveaux de l'adversaire. Les niveaux bas ne « jouent pas au hasard » : ils choisissent parmi
 * les meilleurs coups trouvés par une recherche courte, avec une probabilité qui diminue
 * quand le coup est moins bon (plus la « température » est élevée, plus les erreurs sont fréquentes).
 * L'ordre de force des niveaux est mesuré par tournoi automatique (scripts : voir docs).
 */
import type { SearchOptions } from './engine';
import type { PvLine, Score } from './uci';

export type LevelId = 1 | 2 | 3 | 4 | 5 | 6;

export interface LevelDef {
  id: LevelId;
  name: string;
  description: string;
  search: SearchOptions;
  /** Écart d'évaluation (centipions) qui divise la probabilité par e. Absent = meilleur coup du moteur. */
  temperature?: number;
  /** Probabilité de jouer un coup choisi uniformément parmi les candidats (erreur grossière). */
  blunderRate?: number;
}

export const LEVELS: LevelDef[] = [
  { id: 1, name: 'Débutant', description: 'Commet souvent des erreurs, idéal pour appliquer les règles et les premiers principes.', search: { depth: 1, multipv: 10 }, temperature: 300, blunderRate: 0.3 },
  { id: 2, name: 'Facile', description: 'Voit les prises simples mais laisse régulièrement des occasions.', search: { depth: 4, multipv: 8 }, temperature: 150, blunderRate: 0.1 },
  { id: 3, name: 'Intermédiaire', description: 'Joue des coups sensés, se trompe dans les positions compliquées.', search: { depth: 6, multipv: 5 }, temperature: 60 },
  { id: 4, name: 'Difficile', description: 'Rarement en défaut tactique : il faut un vrai plan pour gagner.', search: { depth: 9, multipv: 3 }, temperature: 20 },
  { id: 5, name: 'Expert', description: 'Moteur légèrement bridé : très solide.', search: { movetime: 300, skill: 15 } },
  { id: 6, name: 'Très avancé', description: 'Pleine force du moteur dans le temps imparti.', search: { movetime: 800, skill: 20 } },
];

export const levelById = (id: number) => LEVELS.find((l) => l.id === id) ?? LEVELS[0]!;

/** Valeur numérique d'un score pour comparer des coups (mat proche = très grande valeur). */
export function scoreValue(s: Score): number {
  if (s.mate !== undefined) return s.mate > 0 ? 100000 - s.mate * 100 : -100000 - s.mate * 100;
  return s.cp;
}

/**
 * Choisit le coup à jouer parmi les variantes (scores du point de vue du camp au trait).
 * Un mat en un est toujours joué à partir du niveau 2.
 */
export function chooseMove(lines: readonly PvLine[], level: LevelDef, rnd: () => number = Math.random): string | null {
  const candidates = lines.filter((l) => l.pv[0]);
  if (candidates.length === 0) return null;
  const best = candidates[0]!;
  if (level.temperature === undefined) return best.pv[0]!;
  if (level.id >= 2 && best.score.mate === 1) return best.pv[0]!;
  if (level.blunderRate && rnd() < level.blunderRate) return candidates[Math.floor(rnd() * candidates.length)]!.pv[0]!;
  const top = scoreValue(best.score);
  const weights = candidates.map((l) => Math.exp(-Math.min(5000, top - scoreValue(l.score)) / level.temperature!));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return candidates[i]!.pv[0]!;
  }
  return best.pv[0]!;
}
