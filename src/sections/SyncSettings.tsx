import { useEffect, useState } from 'react';
import { formatSyncTime, useSync } from '../sync/useSync';
import { ConfirmModal } from '../ui/Modal';

/**
 * Synchronisation entre appareils par Google Drive (facultative, avec consentement explicite).
 * Seule permission demandée : le dossier privé de l'application sur Drive. Aucun mot de passe ne transite par l'application.
 */
export function SyncSettings() {
  const { view, manager } = useSync();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | 'keep' | 'delete'>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const needsAuth = view?.status === 'needs-auth';
  useEffect(() => {
    if (consent || needsAuth) manager?.prepareAuth();
  }, [consent, needsAuth, manager]);

  if (!view || !manager) return null;
  const linked = view.status !== 'off' && view.status !== 'unconfigured';

  return (
    <section className="panel settings" data-testid="sync-panel">
      <h2 className="panel-title">Synchronisation entre appareils</h2>

      {view.status === 'unconfigured' && (
        <p className="muted small">La synchronisation par Google Drive n’est pas encore configurée pour cette installation de l’application. En attendant, utilise <em>Télécharger une sauvegarde</em> et <em>Restaurer une sauvegarde</em> ci-dessous.</p>
      )}

      {view.status === 'off' && (
        <>
          <p>Retrouve ta progression sur ton ordinateur et ton cellulaire : chaque appareil la dépose dans <strong>ton</strong> Google Drive et récupère celle des autres, automatiquement.</p>
          <ul className="muted small sync-facts">
            <li><strong>Ce qui est envoyé :</strong> ta progression (profil, leçons, exercices, révisions, parties et analyses, pseudo Chess.com public s’il est lié). Tes préférences d’affichage restent propres à chaque appareil.</li>
            <li><strong>Où :</strong> dans un dossier privé et caché de ton Google Drive, réservé à cette application. Elle n’a accès à <strong>aucun</strong> autre fichier de ton Drive.</li>
            <li><strong>Connexion :</strong> dans la fenêtre officielle de Google. L’application ne voit jamais ton mot de passe.</li>
            <li><strong>Durée :</strong> l’autorisation dure environ une heure ; ensuite, un toucher sur « Reprendre » suffit (Google ne redemande pas ton accord).</li>
            <li><strong>Annuler :</strong> « Délier cet appareil » ici, avec ou sans suppression de la copie sur Drive ; l’accès peut aussi être retiré depuis ton compte Google (Sécurité › Applications tierces).</li>
          </ul>
          <label className="check consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="sync-consent" />
            <span>J’accepte que ma progression soit copiée dans mon Google Drive.</span>
          </label>
          <button type="button" className="btn btn-primary" disabled={!consent || busy} onClick={() => void run(() => manager.connect())} data-testid="sync-connect">
            Connecter Google Drive
          </button>
        </>
      )}

      {linked && (
        <>
          <p role="status" data-testid="sync-status" className={view.status === 'error' ? 'error' : view.status === 'idle' ? 'ok-text' : undefined}>
            {view.status === 'syncing' && 'Synchronisation en cours…'}
            {view.status === 'idle' && (view.lastSyncAt ? `Synchronisé ${formatSyncTime(view.lastSyncAt)}.` : 'Prêt à synchroniser.')}
            {view.status === 'needs-auth' && 'Synchronisation en pause : l’autorisation de Google a expiré.'}
            {view.status === 'offline' && 'Hors ligne : tes changements partiront à la prochaine connexion.'}
            {view.status === 'error' && (view.message ?? 'La synchronisation a échoué.')}
          </p>
          {view.status !== 'error' && view.message && <p className="muted small">{view.message}</p>}
          <p className="muted small">Lié depuis le {new Date(view.connectedAt ?? 0).toLocaleDateString('fr-CA', { dateStyle: 'long' })}. Dernière synchronisation : {formatSyncTime(view.lastSyncAt)}.{view.pending ? ' Des changements de cet appareil attendent d’être envoyés.' : ''}</p>
          <div className="row">
            {view.status === 'needs-auth' ? (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run(() => manager.resume())} data-testid="sync-resume">Reprendre la synchronisation</button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={busy || view.status === 'syncing'} onClick={() => void run(() => manager.syncNow())} data-testid="sync-now">Synchroniser maintenant</button>
            )}
            <button type="button" className="btn" disabled={busy} onClick={() => setConfirm('keep')} data-testid="sync-disconnect">Délier cet appareil</button>
            <button type="button" className="btn" disabled={busy} onClick={() => setConfirm('delete')} data-testid="sync-delete">Supprimer la copie sur Drive</button>
          </div>
        </>
      )}

      {view.status === 'off' && view.message && <p className="muted small" role="status" data-testid="sync-message">{view.message}</p>}

      <ConfirmModal
        open={confirm !== null}
        title={confirm === 'delete' ? 'Supprimer la copie sur Google Drive' : 'Délier cet appareil'}
        message={
          confirm === 'delete'
            ? 'La copie de ta progression sur Google Drive sera supprimée et cet appareil sera délié. Tes données restent sur cet appareil et sur tes autres appareils ; si un autre appareil est encore lié, il recréera la copie à sa prochaine synchronisation.'
            : 'Cet appareil ne se synchronisera plus. Ses données restent sur l’appareil, et la copie sur Google Drive est conservée pour tes autres appareils.'
        }
        confirmLabel={confirm === 'delete' ? 'Supprimer la copie' : 'Délier'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const del = confirm === 'delete';
          setConfirm(null);
          void run(() => manager.disconnect(del));
        }}
      />
    </section>
  );
}
