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
}

export type Step = ExplainStep | DemoStep | MoveStep | SquareStep | ChoiceStep;
export type ExerciseStep = MoveStep | SquareStep | ChoiceStep;

export interface Lesson {
  id: string;
  course: 'regles' | 'principes';
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

export const isExercise = (s: Step): s is ExerciseStep => s.kind === 'move' || s.kind === 'square' || s.kind === 'choice';
