/**
 * Base de données locale (IndexedDB via Dexie, licence Apache-2.0).
 * Toutes les données du joueur restent sur son appareil.
 * Toute évolution du schéma DOIT ajouter une nouvelle `version()` (jamais modifier une version publiée).
 */
import Dexie, { type Table } from 'dexie';
import type { PositionEval } from '../analysis/review';

export type Level = 'debutant-absolu' | 'debutant' | 'intermediaire' | 'avance';

export const LEVEL_LABELS: Record<Level, string> = {
  'debutant-absolu': 'Débutant absolu',
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
};

export interface AssessmentResult {
  completedAt: number;
  /** Scores de 0 à 1 par domaine. */
  scores: { rules: number; tactics: number; strategy: number; experience: number };
  level: Level;
  /** Fourchette indicative issue des exercices résolus — jamais un classement officiel. */
  estimate?: { low: number; high: number };
}

export interface Profile {
  id: 'me';
  createdAt: number;
  level: Level;
  experience: string;
  goals: string[];
  assessment?: AssessmentResult;
  /** Cote d'exercices tactiques, interne à l'application (estimation). */
  tactics: { rating: number; count: number };
}

export interface LessonProgress {
  lessonId: string;
  status: 'in-progress' | 'done';
  step: number;
  correct: number;
  total: number;
  updatedAt: number;
  completedAt?: number;
}

export type AttemptKind = 'puzzle' | 'lesson' | 'opening' | 'assessment' | 'drill';

export interface Attempt {
  id?: number;
  kind: AttemptKind;
  refId: string;
  themes: string[];
  success: boolean;
  hints: number;
  at: number;
  ms?: number;
  ratingBefore?: number;
  ratingAfter?: number;
}

export interface OpeningProgress {
  openingId: string;
  reps: number;
  ease: number;
  intervalDays: number;
  due: number;
  lastSuccess: boolean;
  attempts: number;
  updatedAt: number;
}

export type GameSource = 'ia' | 'import' | 'echiquier' | 'chesscom';

export interface GameRecord {
  id?: number;
  source: GameSource;
  createdAt: number;
  pgn: string;
  white: string;
  black: string;
  result: string;
  /** Camp du joueur (sert aux moments critiques et aux habitudes). */
  userColor?: 'w' | 'b';
  /** Niveau de l'ordinateur pour les parties contre l'IA. */
  level?: number;
  evals?: PositionEval[];
  analyzedAt?: number;
  accuracy?: { w: number; b: number };
  /** Étiquettes d'erreurs du joueur dans cette partie (habitudes). */
  tags?: string[];
}

/** Position à retravailler, issue d'un moment critique d'une partie du joueur. */
export interface Drill {
  id: string;
  gameId: number;
  ply: number;
  fen: string;
  best: string;
  played: string;
  tags: string[];
  reps: number;
  ease: number;
  intervalDays: number;
  due: number;
  attempts: number;
  lastSuccess?: boolean;
  createdAt: number;
}

export class CmaDatabase extends Dexie {
  profile!: Table<Profile, 'me'>;
  lessons!: Table<LessonProgress, string>;
  attempts!: Table<Attempt, number>;
  openings!: Table<OpeningProgress, string>;
  games!: Table<GameRecord, number>;
  drills!: Table<Drill, string>;

  constructor(name = 'chess-master-academy') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      lessons: 'lessonId, status',
      attempts: '++id, kind, refId, at, success',
      openings: 'openingId, due',
    });
    // Version 2 (Phase 4) : parties analysées et positions à retravailler.
    this.version(2).stores({
      games: '++id, createdAt, source',
      drills: 'id, due, gameId',
    });
  }
}

export const db = new CmaDatabase();
