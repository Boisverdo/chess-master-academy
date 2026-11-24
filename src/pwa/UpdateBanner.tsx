import { useEffect, useState } from 'react';
import { applyUpdate, onUpdateReady } from './update';

/** Bandeau « Nouvelle version disponible » : la mise à jour n'interrompt jamais une partie en cours. */
export function UpdateBanner() {
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => onUpdateReady(setReady), []);
  if (!ready || hidden) return null;
  return (
    <div className="sync-banner" role="status" data-testid="update-banner">
      <span>Nouvelle version de l’application disponible.</span>
      <button type="button" className="btn btn-small btn-primary" onClick={applyUpdate} data-testid="update-reload">Recharger</button>
      <button type="button" className="btn btn-small" onClick={() => setHidden(true)}>Plus tard</button>
    </div>
  );
}
