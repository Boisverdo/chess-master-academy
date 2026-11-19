import { useState } from 'react';
import { exportBackup, importBackup, resetAll } from '../storage/repo';
import { ConfirmModal } from '../ui/Modal';

/** Sauvegarde, restauration et effacement des données du joueur. */
export function DataSettings() {
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const doExport = async () => {
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chess-master-academy-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ tone: 'ok', text: `Sauvegarde créée (${data.attempts.length} exercices, ${data.lessons.length} leçons).` });
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 20_000_000) throw new Error('Fichier trop volumineux.');
      await importBackup(JSON.parse(await file.text()));
      setMessage({ tone: 'ok', text: 'Sauvegarde restaurée.' });
    } catch (e) {
      setMessage({ tone: 'bad', text: e instanceof SyntaxError ? 'Ce fichier n’est pas un JSON valide.' : e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <section className="panel settings">
      <h2 className="panel-title">Mes données</h2>
      <p className="muted small">Ton profil, tes leçons et tes exercices sont enregistrés sur cet appareil (et dans ton Google Drive si la synchronisation est activée). Sans synchronisation, fais une sauvegarde de temps en temps : vider les données du navigateur les effacerait.</p>
      <div className="row">
        <button type="button" className="btn" onClick={doExport}>Télécharger une sauvegarde</button>
        <label className="btn">
          Restaurer une sauvegarde
          <input type="file" accept="application/json,.json" hidden onChange={(e) => void doImport(e.target.files?.[0])} data-testid="restore-input" />
        </label>
        <button type="button" className="btn" onClick={() => setConfirmReset(true)}>Tout effacer</button>
      </div>
      {message && <p className={message.tone === 'ok' ? 'ok-text' : 'error'} role="status">{message.text}</p>}
      <ConfirmModal
        open={confirmReset}
        title="Effacer toutes les données"
        message="Ton profil, tes leçons, tes exercices et tes révisions seront définitivement supprimés de cet appareil, qui sera aussi délié de la synchronisation (la copie sur Google Drive et tes autres appareils ne sont pas touchés). Pense à télécharger une sauvegarde avant."
        confirmLabel="Tout effacer"
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          setConfirmReset(false);
          await resetAll();
          await import('../sync/manager').then((m) => m.getSyncManager().refresh());
          setMessage({ tone: 'ok', text: 'Toutes les données ont été effacées.' });
        }}
      />
    </section>
  );
}
