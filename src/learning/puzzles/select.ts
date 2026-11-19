/** Choix du prochain exercice : adapté à la cote du joueur et à ses faiblesses. */
import type { Puzzle } from './puzzle';

export interface SelectOptions {
  rating: number;
  /** Thème imposé ; sinon, entraînement adapté. */
  theme?: string;
  /** Thèmes faibles du joueur (priorité en mode adapté). */
  weakThemes?: string[];
  /** Exercices déjà vus récemment (exclus si possible). */
  seen?: ReadonlySet<string>;
  random?: () => number;
}

/** Fenêtre de cote : on élargit progressivement jusqu'à trouver des candidats. */
export function selectPuzzle(all: readonly Puzzle[], opts: SelectOptions): Puzzle | undefined {
  const rnd = opts.random ?? Math.random;
  let pool = opts.theme ? all.filter((p) => p.themes.includes(opts.theme!)) : all;
  if (!opts.theme && opts.weakThemes?.length && rnd() < 0.6) {
    const weak = pool.filter((p) => p.themes.some((t) => opts.weakThemes!.includes(t)));
    if (weak.length) pool = weak;
  }
  const unseen = pool.filter((p) => !opts.seen?.has(p.id));
  if (unseen.length) pool = unseen;
  for (const width of [100, 200, 350, 600, 3000]) {
    const near = pool.filter((p) => Math.abs(p.rating - opts.rating) <= width);
    if (near.length) return near[Math.floor(rnd() * near.length)];
  }
  return pool[0];
}

let cache: Promise<Puzzle[]> | null = null;

/** Chargement différé de la base d'exercices (≈ 540 Ko) pour ne pas alourdir le démarrage. */
export function loadPuzzles(): Promise<Puzzle[]> {
  cache ??= import('../../data/puzzles.json').then((m) => (m.default as { puzzles: Puzzle[] }).puzzles);
  return cache;
}
