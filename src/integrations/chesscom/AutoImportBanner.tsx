import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Au lancement (et au retour sur l'application), importe les nouvelles parties Chess.com
 * si le joueur a activé l'import automatique. Signale discrètement les parties ajoutées.
 */
export function AutoImportBanner() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const check = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      import('./autoRunner')
        .then(({ autoImportNow }) => autoImportNow())
        .then((r) => {
          if (alive && r.ran && r.summary.imported) setCount((c) => c + r.summary.imported);
        })
        // Échec silencieux : Chess.com injoignable ne doit jamais gêner le reste de l'application.
        .catch(() => undefined);
    };
    check();
    document.addEventListener('visibilitychange', check);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  if (!count) return null;
  return (
    <div className="sync-banner" role="status" data-testid="chesscom-auto-banner">
      <span>{count} nouvelle{count > 1 ? 's' : ''} partie{count > 1 ? 's' : ''} Chess.com importée{count > 1 ? 's' : ''}.</span>
      <Link to="/chesscom" className="btn btn-small btn-primary" onClick={() => setCount(0)}>Les analyser</Link>
      <button type="button" className="btn btn-small" onClick={() => setCount(0)}>OK</button>
    </div>
  );
}
