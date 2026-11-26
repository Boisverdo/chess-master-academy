/** Format des leçons. Les textes acceptent **gras** ; aucune autre mise en forme. */

export type Brush = 'green' | 'red' | 'blue' | 'yellow';

export interface Shape {
  orig: string;
  dest?: string;
  brush?: Brush;
}

export interface BoardSpec {
  fen: string;
  orientation?: 'white' | 'black';
  shapes?: Shape[];
}

/**
 * Objectif d'un exercice « joue un coup ». Tous sont vérifiés par calcul, jamais supposés :
 * - mate : le coup donne échec et mat ;
 * - check : le coup donne échec ;
 * - castle / en-passant / promotion : le coup est de ce type ;
 * - prevent-mate : après le coup, l'adversaire n'a plus de mat en un ;
 * - exact : le coup figure dans `accept`.
 * Si `accept` est fourni avec un autre objectif, le coup doit aussi en faire partie.
 */
export type MoveGoal = 'mate' | 'check' | 'castle' | 'en-passant' | 'promotion' | 'prevent-mate' | 'exact';

export interface ExplainStep {
  kind: 'explain';
  title?: string;
  text: string;
  board?: BoardSpec;
}

export interface DemoStep {
  kind: 'demo';
  title?: string;
  text: string;
  fen: string;
  orientation?: 'white' | 'black';
  /** Coups en notation SAN anglaise (validés par les tests) avec un commentaire chacun. */
  moves: { san: string; comment: string }[];
}

export interface MoveStep {
  kind: 'move';
  prompt: string;
  fen: string;
  orientation?: 'white' | 'black';
  goal: MoveGoal;
  /** Coups acceptés en notation UCI (ex. « e2e4 », « e7e8n »). */
  accept?: string[];
  /** Coups explicitement refusés malgré l'objectif atteint, avec explication. */
  reject?: Record<string, string>;
  /** Explications pour des erreurs fréquentes (clé : coup UCI). */
  wrong?: Record<string, string>;
  hint: string;
  success: string;
  shapes?: Shape[];
}

export interface SquareStep {
  kind: 'square';
  prompt: string;
  fen?: string;
  orientation?: 'white' | 'black';
  answer: string[];
  hint: string;
  success: string;
}

export interface ChoiceStep {
  kind: 'choice';
  prompt: string;
  board?: BoardSpec;
  options: { label: string; correct: boolean; feedback: string }[];
  /**
   * Résultat théorique de la position (camp au trait, meilleur jeu des deux côtés),
   * vérifié par Stockfish dans les tests : la bonne réponse ne peut pas être fausse.
   */
  verify?: { fen?: string; result: 'win' | 'draw' | 'loss' };
  /**
   * Solution expliquée (questions sur une position) : une ligne de meilleur jeu depuis `board.fen`,
   * coups des deux camps en SAN anglaise, commentaires de l'entraîneur facultatifs. Validée par les tests
   * (légalité) et par Stockfish (chaque coup garde le résultat annoncé par `verify`).
   */
  solution?: { san: string; comment?: string }[];
  /** Conclusion lue à la fin de la solution. */
  solutionOutro?: string;
}

/**
 * Jouer une position contre le moteur (pleine force). Objectifs :
 * - mate : mater en au plus `maxMoves` coups ;
 * - promote : promouvoir un pion en au plus `maxMoves` coups ;
 * - draw : tenir la nulle (nulle obtenue, ou `maxMoves` coups sans promotion adverse ni perte de matériel).
 * La jouabilité de chaque position est vérifiée par Stockfish dans les tests.
 */
export interface PlayStep {
  kind: 'play';
  prompt: string;
  fen: string;
  orientation?: 'white' | 'black';
  goal: 'mate' | 'promote' | 'draw';
  maxMoves: number;
  hint: string;
  success: string;
  /**
   * Solution expliquée : une ligne gagnante (ou tenable) depuis `fen`, coups des deux camps en SAN anglaise,
   * avec le commentaire de l'entraîneur sur chacun de tes coups. Validée par les tests (légalité, objectif
   * atteint, et Stockfish confirme que chacun de tes coups garde le résultat).
   */
  solution?: { san: string; comment?: string }[];
  /** Conclusion lue à la fin de la solution. */
  solutionOutro?: string;
}

export type Step = ExplainStep | DemoStep | MoveStep | SquareStep | ChoiceStep | PlayStep;
export type ExerciseStep = MoveStep | SquareStep | ChoiceStep | PlayStep;

export interface Lesson {
  id: string;
  course: 'regles' | 'principes' | 'strategie' | 'finales';
  title: string;
  summary: string;
  minutes: number;
  /** Compétences travaillées (servent au suivi du profil). */
  skills: string[];
  steps: Step[];
}

export interface Course {
  id: Lesson['course'];
  title: string;
  module: string;
  description: string;
  lessons: Lesson[];
}

export const isExercise = (s: Step): s is ExerciseStep => s.kind === 'move' || s.kind === 'square' || s.kind === 'choice' || s.kind === 'play';
