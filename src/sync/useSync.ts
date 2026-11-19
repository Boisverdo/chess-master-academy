import { useEffect, useState } from 'react';
import type { SyncManager, SyncView } from './manager';

/** État de la synchronisation pour les écrans (le module de synchronisation est chargé à la demande). */
export function useSync(): { view: SyncView | null; manager: SyncManager | null } {
  const [manager, setManager] = useState<SyncManager | null>(null);
  const [view, setView] = useState<SyncView | null>(null);
  useEffect(() => {
    let off: (() => void) | undefined;
    let alive = true;
    void import('./manager').then(({ getSyncManager }) => {
      if (!alive) return;
      const m = getSyncManager();
      setManager(m);
      off = m.subscribe(setView);
    });
    return () => {
      alive = false;
      off?.();
    };
  }, []);
  return { view, manager };
}

export function formatSyncTime(t: number | undefined): string {
  if (!t) return 'jamais';
  const min = Math.round((Date.now() - t) / 60_000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  return new Date(t).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' });
}
