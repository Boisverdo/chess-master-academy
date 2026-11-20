/** Lancement de l'import automatique avec les vraies dépendances (base locale, client Chess.com). */
import { existingExternalIds, getIntegration, saveGameRecord, saveIntegration } from '../../storage/repo';
import { runAutoImport, type AutoResult } from './auto';
import { chessComClient } from './service';

let running: Promise<AutoResult> | null = null;

export function autoImportNow(force = false): Promise<AutoResult> {
  running ??= (async () => {
    const i = await getIntegration();
    if (!i) return { ran: false, reason: 'disabled' } as const;
    return runAutoImport(chessComClient(), i, { existing: existingExternalIds, save: saveGameRecord, saveIntegration, now: Date.now(), force });
  })().finally(() => {
    running = null;
  });
  return running;
}
