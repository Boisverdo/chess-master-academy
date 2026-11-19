import { useEffect, useState } from 'react';
import { useSync } from './useSync';

/**
 * Rappel discret quand la synchronisation attend un toucher (autorisation Google expirée).
 * Démarre aussi la synchronisation au lancement de l'application si elle est active sur cet appareil.
 */
export function SyncBanner() {
  const { view, manager } = useSync();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    void manager?.start();
  }, [manager]);
  useEffect(() => {
    if (view?.pending) setHidden(false);
  }, [view?.pending]);

  if (!manager || view?.status !== 'needs-auth' || hidden) return null;
  return (
    <div className="sync-banner" role="status" data-testid="sync-banner">
      <span>Synchronisation Google Drive en pause{view.pending ? ' : des changements attendent d’être envoyés' : ''}.</span>
      <button type="button" className="btn btn-small btn-primary" onClick={() => void manager.resume()} data-testid="sync-banner-resume">Reprendre</button>
      <button type="button" className="btn btn-small" onClick={() => setHidden(true)}>Plus tard</button>
    </div>
  );
}
