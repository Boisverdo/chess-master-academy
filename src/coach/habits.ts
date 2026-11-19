/**
 * Habitudes du joueur : un même type d'erreur dans au moins 3 des 10 dernières parties analysées
 * est une habitude ; sinon, c'est une erreur ponctuelle.
 */
export const HABIT_LABELS: Record<string, string> = {
  'piece-en-prise': 'Pièces laissées sans protection',
  'mat-subi': 'Menaces de mat non vues',
  'fourchette-subie': 'Fourchettes subies',
  'attaque-double-subie': 'Attaques doubles subies',
  'echange-defavorable': 'Échanges défavorables',
  'occasion-manquee': 'Erreurs adverses non exploitées',
  'gain-manque': 'Gains de matériel manqués',
  'erreur-de-calcul': 'Suites forcées mal calculées (prises, échecs)',
  ouverture: 'Erreurs dans l’ouverture',
  finale: 'Difficultés en finale',
  'dame-precoce': 'Sortie prématurée de la dame',
  'developpement-lent': 'Développement trop lent',
};

export interface GameTags {
  gameId: number;
  date: number;
  tags: string[];
}

export interface Habit {
  tag: string;
  label: string;
  games: number;
  window: number;
  recurrent: boolean;
  lastSeen: number;
}

export function detectHabits(games: readonly GameTags[], window = 10, threshold = 3): Habit[] {
  const recent = [...games].sort((a, b) => b.date - a.date).slice(0, window);
  const counts = new Map<string, { n: number; last: number }>();
  for (const g of recent) {
    for (const t of new Set(g.tags)) {
      const c = counts.get(t) ?? { n: 0, last: 0 };
      counts.set(t, { n: c.n + 1, last: Math.max(c.last, g.date) });
    }
  }
  return [...counts.entries()]
    .filter(([t]) => t in HABIT_LABELS)
    .map(([tag, c]) => ({ tag, label: HABIT_LABELS[tag]!, games: c.n, window: recent.length, recurrent: c.n >= threshold, lastSeen: c.last }))
    .sort((a, b) => Number(b.recurrent) - Number(a.recurrent) || b.games - a.games);
}
