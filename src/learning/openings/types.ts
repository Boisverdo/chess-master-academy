/** Format de la bibliothèque d'ouvertures (coups en SAN anglaise, validés par les tests). */
export interface Opening {
  id: string;
  name: string;
  eco: string;
  /** Camp que le joueur apprend à jouer. */
  side: 'white' | 'black';
  summary: string;
  ideas: string[];
  plans: { white: string[]; black: string[] };
  /** Ligne principale depuis la position initiale : [coup, pourquoi]. */
  mainLine: [string, string][];
  variations: { name: string; moves: string; idea: string }[];
  traps: { name: string; moves: string; explanation: string; mate?: boolean }[];
  mistakes: string[];
}
