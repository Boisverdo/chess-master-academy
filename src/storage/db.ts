/**
 * Base de données locale (IndexedDB via Dexie, licence Apache-2.0).
 * Toutes les données du joueur restent sur son appareil.
 * Toute évolution du schéma DOIT ajouter une nouvelle `version()` (jamais modifier une version publiée).
 */
import Dexie, { type Table } from 'dexie';
import type { PositionEval } from '../analysis/review';
import { gameUid } from './ids';

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

export type AttemptKind = 'puzzle' | 'lesson' | 'opening' | 'assessment' | 'drill' | 'exam' | 'challenge';

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

export type GameSource = 'ia' | 'import' | 'echiquier' | 'chesscom' | 'lichess';

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
  /** Identifiant chez la source externe (ex. URL de la partie Chess.com) : évite les doublons. */
  externalId?: string;
  timeClass?: string;
  /** Identifiant stable, identique sur tous les appareils (synchronisation, version 4). */
  uid?: string;
}

/** Liaison facultative avec un service externe (Phase 5). Supprimable à tout moment. */
export type IntegrationId = 'chesscom' | 'lichess';

export interface IntegrationRecord {
  id: IntegrationId;
  username: string;
  consentAt: number;
  profile?: unknown;
  stats?: unknown;
  refreshedAt?: number;
  lastImportAt?: number;
  /** Import automatique des nouvelles parties au lancement (désactivé par défaut). */
  autoImport?: { enabled: boolean; updatedAt: number; timeClasses: string[]; ratedOnly: boolean };
  /** Dernière vérification automatique (au plus une toutes les 6 heures). */
  lastAutoCheckAt?: number;
}

/** Mois d'archives terminés, déjà téléchargés (ne changent plus). */
export interface MonthCacheRecord {
  url: string;
  games: unknown;
  savedAt: number;
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

/** Trace d'une suppression, pour qu'une synchronisation ne fasse pas réapparaître l'élément (version 4). */
export interface Tombstone {
  /** `game:<uid>` ou `integration:<id>`. */
  key: string;
  at: number;
}

/** État local de la synchronisation Google Drive (version 4). Propre à chaque appareil. */
export interface SyncState {
  id: 'google';
  connectedAt: number;
  /** Fichier de synchronisation dans le dossier privé de l'application sur Google Drive. */
  fileId?: string;
  lastSyncAt?: number;
  /** Jeton d'accès Google (valable environ une heure, limité au dossier privé de l'application). */
  token?: string;
  tokenExpiresAt?: number;
}

export class CmaDatabase extends Dexie {
  profile!: Table<Profile, 'me'>;
  lessons!: Table<LessonProgress, string>;
  attempts!: Table<Attempt, number>;
  openings!: Table<OpeningProgress, string>;
  games!: Table<GameRecord, number>;
  drills!: Table<Drill, string>;
  integrations!: Table<IntegrationRecord, string>;
  monthCache!: Table<MonthCacheRecord, string>;
  tombstones!: Table<Tombstone, string>;
  sync!: Table<SyncState, 'google'>;

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
    // Version 3 (Phase 5) : intégration Chess.com facultative.
    this.version(3).stores({
      games: '++id, createdAt, source, externalId',
      integrations: 'id',
      monthCache: 'url',
    });
    // Version 4 : synchronisation entre appareils (identifiant stable des parties, suppressions, état).
    this.version(4)
      .stores({
        games: '++id, createdAt, source, externalId, uid',
        tombstones: 'key',
        sync: 'id',
      })
      .upgrade((tx) =>
        tx
          .table('games')
          .toCollection()
          .modify((g: GameRecord) => {
            if (!g.uid) g.uid = gameUid(g);
          }),
      );
  }
}

export const db = new CmaDatabase();
