/** Import automatique Lichess avec les vraies dépendances (base locale, client Lichess). */
import { existingExternalIds, getLichessIntegration, saveGameRecord, saveIntegration } from '../../storage/repo';
import { LichessClient } from './client';
import { runLichessAuto, type LichessAutoResult } from './importer';

let client: LichessClient | null = null;
export const lichessClient = (): LichessClient => (client ??= new LichessClient());

let running: Promise<LichessAutoResult> | null = null;

export function lichessAutoNow(force = false): Promise<LichessAutoResult> {
  running ??= (async () => {
    const i = await getLichessIntegration();
    if (!i) return { ran: false, reason: 'disabled' } as const;
    return runLichessAuto(lichessClient(), i, { existing: existingExternalIds, save: saveGameRecord, saveIntegration, now: Date.now(), force });
  })().finally(() => {
    running = null;
  });
  return running;
}
