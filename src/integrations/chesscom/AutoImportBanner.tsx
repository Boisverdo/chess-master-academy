import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Au lancement (et au retour sur l'application), importe les nouvelles parties Chess.com
 * et Lichess si le joueur a activé l'import automatique. Signale discrètement les parties ajoutées.
 */
export function AutoImportBanner() {
  const [found, setFound] = useState<{ chesscom: number; lichess: number }>({ chesscom: 0, lichess: 0 });
  const count = found.chesscom + found.lichess;
  const clear = () => setFound({ chesscom: 0, lichess: 0 });

  useEffect(() => {
    let alive = true;
    const check = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      // Chess.com puis Lichess, l'un après l'autre. Échec silencieux : un service injoignable ne gêne jamais le reste.
      const add = (k: 'chesscom' | 'lichess') => (r: { ran: boolean; summary?: { imported: number } }) => {
        if (alive && r.ran && r.summary?.imported) setFound((f) => ({ ...f, [k]: f[k] + r.summary!.imported }));
      };
      void import('./autoRunner')
        .then(({ autoImportNow }) => autoImportNow())
        .then(add('chesscom'), () => undefined)
        .then(() => import('../lichess/autoRunner'))
        .then(({ lichessAutoNow }) => lichessAutoNow())
        .then(add('lichess'))
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
  const s = count > 1 ? 's' : '';
  const service = found.lichess === 0 ? ' Chess.com' : found.chesscom === 0 ? ' Lichess' : '';
  const to = found.lichess === 0 ? '/chesscom' : found.chesscom === 0 ? '/lichess' : '/analyse';
  return (
    <div className="sync-banner" role="status" data-testid="chesscom-auto-banner">
      <span>{count} nouvelle{s} partie{s}{service} importée{s}.</span>
      <Link to={to} className="btn btn-small btn-primary" onClick={clear}>Les analyser</Link>
      <button type="button" className="btn btn-small" onClick={clear}>OK</button>
    </div>
  );
}
