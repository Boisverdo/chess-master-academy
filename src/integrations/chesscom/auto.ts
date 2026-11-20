/**
 * Import automatique des nouvelles parties Chess.com au lancement de l'application.
 *
 * - Uniquement si le joueur l'a activé lui-même (consentement distinct de la liaison du pseudo).
 * - Au plus une vérification toutes les 6 heures (respect des limites de l'API publique).
 * - Seulement les mois depuis la dernière vérification (3 mois au maximum) ; les mois terminés
 *   déjà téléchargés viennent du cache local, sans requête.
 * - Lecture seule : aucune action sur le compte, aucun mot de passe.
 */
import type { GameRecord, IntegrationRecord } from '../../storage/db';
import { archiveLabel, type ChessComClient } from './client';
import { importMonths, type ImportSummary } from './importer';

export const AUTO_INTERVAL_MS = 6 * 3600_000;
export const AUTO_MAX_MONTHS = 3;

export interface AutoImportSettings {
  enabled: boolean;
  /** Date du choix (activation ou désactivation). */
  updatedAt: number;
  timeClasses: string[];
  ratedOnly: boolean;
}

export type AutoResult = { ran: false; reason: 'disabled' | 'recent' } | { ran: true; summary: ImportSummary; months: number };

/** La vérification est-elle due ? */
export function autoDue(i: IntegrationRecord | undefined, now: number): boolean {
  if (!i?.autoImport?.enabled) return false;
  return !i.lastAutoCheckAt || now - i.lastAutoCheckAt >= AUTO_INTERVAL_MS || i.lastAutoCheckAt > now;
}

/** Mois à vérifier : depuis la dernière vérification (ou l'activation), 3 au plus, du plus ancien au plus récent. */
export function monthsToCheck(archives: readonly string[], since: number): string[] {
  const d = new Date(since);
  const from = d.getUTCFullYear() * 12 + d.getUTCMonth();
  return archives
    .filter((u) => {
      const { year, month } = archiveLabel(u);
      return year * 12 + (month - 1) >= from;
    })
    .slice(-AUTO_MAX_MONTHS);
}

export interface AutoDeps {
  existing: () => Promise<Set<string>>;
  save: (r: Omit<GameRecord, 'id'>) => Promise<unknown>;
  saveIntegration: (r: IntegrationRecord) => Promise<void>;
  now: number;
  /** Ignore le délai de 6 heures (bouton « Vérifier maintenant »). */
  force?: boolean;
}

export async function runAutoImport(client: ChessComClient, i: IntegrationRecord, deps: AutoDeps): Promise<AutoResult> {
  const auto = i.autoImport;
  if (!auto?.enabled) return { ran: false, reason: 'disabled' };
  if (!deps.force && !autoDue(i, deps.now)) return { ran: false, reason: 'recent' };
  // Le délai est compté dès la tentative : une erreur ne provoque pas de nouvelles requêtes à chaque ouverture.
  const since = Math.min(i.lastAutoCheckAt ?? auto.updatedAt, deps.now);
  await deps.saveIntegration({ ...i, lastAutoCheckAt: deps.now });
  const months = monthsToCheck(await client.archives(i.username), since);
  const summary = await importMonths(client, i.username, months, { timeClasses: new Set(auto.timeClasses), ratedOnly: auto.ratedOnly }, { existing: await deps.existing(), save: deps.save });
  await deps.saveIntegration({ ...i, lastAutoCheckAt: deps.now, ...(summary.imported ? { lastImportAt: deps.now } : {}) });
  return { ran: true, summary, months: months.length };
}
