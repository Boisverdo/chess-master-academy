import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { analyseBatch, type BatchProgress } from '../../analysis/batch';
import { getEngine } from '../../engine/browser';
import { archiveLabel, normalizeUsername, safeChessComUrl, type ChessComProfile, type ChessComStats } from '../../integrations/chesscom/client';
import { importMonths, TIME_CLASS_LABELS, type ImportSummary, type TimeClass } from '../../integrations/chesscom/importer';
import { AUTO_INTERVAL_MS, type AutoResult } from '../../integrations/chesscom/auto';
import { chessComClient } from '../../integrations/chesscom/service';
import { db, type IntegrationRecord } from '../../storage/db';
import { disconnectIntegration, existingExternalIds, getIntegration, saveGameRecord, saveIntegration } from '../../storage/repo';
import { Modal } from '../../ui/Modal';
import { useData } from '../../ui/useData';

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function ChessComPage() {
  const { data: integration } = useData(() => getIntegration().then((i) => i ?? null));
  return (
    <div className="page page-wide">
      <h1>Chess.com et mes parties</h1>
      <p className="lead">Importe tes parties publiques Chess.com pour que ton entraîneur les analyse. Cette liaison est facultative : tout le reste de l’application fonctionne sans elle.</p>
      {integration === undefined ? <p className="muted">Chargement…</p> : integration === null ? <Connect /> : <Connected integration={integration} />}
    </div>
  );
}

function Connect() {
  const [username, setUsername] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<{ profile: ChessComProfile; stats: ChessComStats } | null>(null);

  const search = async () => {
    setError(null);
    setFound(null);
    setBusy(true);
    try {
      const u = normalizeUsername(username);
      const profile = await chessComClient().profile(u);
      const stats = await chessComClient().stats(u);
      setFound({ profile, stats });
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="two-cols">
      <section className="panel">
        <h2 className="panel-title">Lier mon pseudo Chess.com</h2>
        <label className="field">
          <span>Ton pseudo Chess.com</span>
          <input className="text-input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" spellCheck={false} placeholder="ex. MonPseudo" data-testid="chesscom-username" />
        </label>
        <label className="check consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="chesscom-consent" />
          <span>J’accepte que l’application interroge l’API publique de Chess.com pour ce pseudo (profil, statistiques et parties publiques, en lecture seule) et enregistre ces données sur cet appareil.</span>
        </label>
        <button type="button" className="btn btn-primary" disabled={!consent || !username.trim() || busy} onClick={search} data-testid="chesscom-search">
          {busy ? 'Recherche…' : 'Rechercher mon profil'}
        </button>
        {error && <p className="error" role="alert">{error}</p>}
        {found && (
          <div className="found" data-testid="chesscom-found">
            <p>
              Profil trouvé : <strong>{found.profile.username}</strong>
              {found.profile.name ? ` (${found.profile.name})` : ''}
              {found.profile.joined ? `, membre depuis ${new Date(found.profile.joined * 1000).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}` : ''}.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              data-testid="chesscom-confirm"
              onClick={() => saveIntegration({ id: 'chesscom', username: found.profile.username.toLowerCase(), consentAt: Date.now(), profile: found.profile, stats: found.stats, refreshedAt: Date.now() })}
            >
              C’est bien moi
            </button>{' '}
            <button type="button" className="btn" onClick={() => setFound(null)}>Ce n’est pas moi</button>
          </div>
        )}
      </section>
      <section className="panel">
        <h2 className="panel-title">Ce que fait (et ne fait pas) cette liaison</h2>
        <ul>
          <li><strong>Lecture seule</strong> : l’API publique de Chess.com ne permet aucune action sur ton compte.</li>
          <li><strong>Aucun mot de passe</strong> : ni Chess.com, ni Google. Ton seul pseudo suffit, car les parties sont publiques.</li>
          <li><strong>Connexion avec Google</strong> : elle sert à ouvrir ta session sur le site Chess.com. Chess.com ne propose pas aux applications externes de l’utiliser, et ce n’est pas nécessaire ici.</li>
          <li><strong>Données stockées sur cet appareil</strong>, jamais ailleurs. Tu peux tout supprimer à tout moment.</li>
          <li><strong>Requêtes une par une</strong>, conformément aux règles de Chess.com ; les mois déjà téléchargés ne sont pas redemandés.</li>
        </ul>
        <p className="muted small">Autre possibilité, sans aucune requête : télécharge tes parties au format PGN depuis l’historique de Chess.com, puis importe le fichier dans <Link to="/analyse">Analyse des parties</Link>.</p>
      </section>
    </div>
  );
}

const CLASSES: TimeClass[] = ['rapid', 'blitz', 'bullet', 'daily'];

const fmtDate = (t: number) => new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** Import automatique : choix distinct de la liaison, désactivé par défaut, modifiable à tout moment. */
function AutoImportPanel({ integration }: { integration: IntegrationRecord }) {
  const auto = integration.autoImport;
  // État affiché immédiatement (la base est mise à jour juste après).
  const [enabled, setEnabled] = useState(!!auto?.enabled);
  useEffect(() => setEnabled(!!auto?.enabled), [auto?.enabled]);
  const [classes, setClasses] = useState<Set<string>>(new Set(auto?.timeClasses ?? ['rapid', 'blitz', 'daily']));
  const [ratedOnly, setRatedOnly] = useState(auto?.ratedOnly ?? false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AutoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = (next: { enabled: boolean; timeClasses?: Set<string>; ratedOnly?: boolean }) => {
    setEnabled(next.enabled);
    return saveIntegration({
      ...integration,
      autoImport: { enabled: next.enabled, updatedAt: Date.now(), timeClasses: [...(next.timeClasses ?? classes)], ratedOnly: next.ratedOnly ?? ratedOnly },
      // À l'activation, la première vérification part de maintenant (pas de rattrapage de tout l'historique).
      ...(next.enabled && !enabled ? { lastAutoCheckAt: undefined } : {}),
    });
  };

  const checkNow = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { autoImportNow } = await import('../../integrations/chesscom/autoRunner');
      setResult(await autoImportNow(true));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleClass = (c: string) => {
    const n = new Set(classes);
    if (n.has(c)) n.delete(c);
    else n.add(c);
    setClasses(n);
    if (enabled && n.size) void save({ enabled: true, timeClasses: n });
  };

  return (
    <section className="panel" data-testid="chesscom-auto">
      <h2 className="panel-title">Import automatique des nouvelles parties</h2>
      <label className="check consent">
        <input type="checkbox" checked={enabled} disabled={!classes.size} onChange={(e) => void save({ enabled: e.target.checked })} data-testid="chesscom-auto-toggle" />
        <span>
          À l’ouverture de l’application, vérifier si j’ai joué de nouvelles parties sur Chess.com et les importer sur cet appareil (lecture seule, au plus une vérification toutes les {AUTO_INTERVAL_MS / 3600_000} heures, seulement les mois récents).
        </span>
      </label>
      <p className="small"><strong>Cadences importées :</strong></p>
      <div className="chips">
        {CLASSES.map((c) => (
          <button key={c} type="button" className={`chip${classes.has(c) ? ' active' : ''}`} aria-pressed={classes.has(c)} onClick={() => toggleClass(c)}>{TIME_CLASS_LABELS[c]}</button>
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={ratedOnly} onChange={(e) => { setRatedOnly(e.target.checked); if (enabled) void save({ enabled: true, ratedOnly: e.target.checked }); }} />
        <span>Parties classées seulement</span>
      </label>
      {enabled && (
        <>
          <p className="muted small" data-testid="chesscom-auto-status">
            {integration.lastAutoCheckAt ? `Dernière vérification : ${fmtDate(integration.lastAutoCheckAt)}.` : 'Première vérification à la prochaine ouverture de l’application.'}
          </p>
          <button type="button" className="btn btn-small" onClick={checkNow} disabled={busy} data-testid="chesscom-auto-now">{busy ? 'Vérification…' : 'Vérifier maintenant'}</button>
        </>
      )}
      {result?.ran && (
        <p className="feedback ok" role="status" data-testid="chesscom-auto-result">
          {result.summary.imported ? `${result.summary.imported} nouvelle${result.summary.imported > 1 ? 's' : ''} partie${result.summary.imported > 1 ? 's' : ''} importée${result.summary.imported > 1 ? 's' : ''}.` : 'Aucune nouvelle partie.'}
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <p className="muted small">L’analyse des parties reste à lancer toi-même (ci-dessous) : elle utilise beaucoup le processeur.</p>
    </section>
  );
}

function Connected({ integration }: { integration: IntegrationRecord }) {
  const profile = integration.profile as ChessComProfile | undefined;
  const stats = (integration.stats ?? {}) as ChessComStats;
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [archives, setArchives] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [classes, setClasses] = useState<Set<string>>(new Set(['rapid', 'blitz', 'daily']));
  const [ratedOnly, setRatedOnly] = useState(false);
  const [importing, setImporting] = useState<{ month: string; done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [batch, setBatch] = useState<BatchProgress | null>(null);
  const [batchDone, setBatchDone] = useState<number | null>(null);
  const [count, setCount] = useState(10);
  const [confirm, setConfirm] = useState(false);
  const [deleteGames, setDeleteGames] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const { data: pending } = useData(() => db.games.where('source').equals('chesscom').filter((g) => !g.analyzedAt).toArray().then((l) => l.sort((a, b) => b.createdAt - a.createdAt)));
  const { data: importedCount } = useData(() => db.games.where('source').equals('chesscom').count());

  const refresh = async () => {
    setError(null);
    setRefreshing(true);
    try {
      const p = await chessComClient().profile(integration.username);
      const s = await chessComClient().stats(integration.username);
      await saveIntegration({ ...integration, profile: p, stats: s, refreshedAt: Date.now() });
    } catch (e) {
      setError(errText(e));
    } finally {
      setRefreshing(false);
    }
  };

  const loadArchives = async () => {
    setError(null);
    try {
      const list = (await chessComClient().archives(integration.username)).reverse();
      setArchives(list);
      setSelected(new Set(list.slice(0, 3)));
    } catch (e) {
      setError(errText(e));
    }
  };

  const runImport = async () => {
    setError(null);
    setSummary(null);
    abort.current = new AbortController();
    const urls = (archives ?? []).filter((u) => selected.has(u));
    setImporting({ month: '', done: 0, total: urls.length });
    try {
      const s = await importMonths(chessComClient(), integration.username, urls, { timeClasses: classes, ratedOnly }, {
        existing: await existingExternalIds(),
        save: (r) => saveGameRecord(r),
        signal: abort.current.signal,
        onProgress: (p) => setImporting({ month: p.month, done: p.done, total: p.total }),
      });
      setSummary(s);
      await saveIntegration({ ...integration, lastImportAt: Date.now() });
    } catch (e) {
      setError(errText(e));
    } finally {
      setImporting(null);
    }
  };

  const runBatch = async () => {
    if (!pending?.length) return;
    setError(null);
    setBatchDone(null);
    abort.current = new AbortController();
    try {
      const engine = await getEngine();
      const n = await analyseBatch(pending.slice(0, count), engine, { signal: abort.current.signal, onProgress: setBatch });
      setBatchDone(n);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBatch(null);
    }
  };

  const toggle = (set: Set<string>, v: string) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    return n;
  };

  return (
    <>
      <div className="two-cols">
        <section className="panel" data-testid="chesscom-profile">
          <h2 className="panel-title">Profil lié</h2>
          <p>
            <strong>{profile?.username ?? integration.username}</strong>
            {profile?.title ? ` · ${profile.title}` : ''}
            {safeChessComUrl(profile?.url) && (
              <> · <a href={safeChessComUrl(profile?.url)!} target="_blank" rel="noopener noreferrer">voir sur Chess.com</a></>
            )}
          </p>
          <table className="summary-table">
            <thead>
              <tr><th>Cadence</th><th>Cote actuelle</th><th>Meilleure</th><th>V / N / D</th></tr>
            </thead>
            <tbody>
              {(['chess_rapid', 'chess_blitz', 'chess_bullet', 'chess_daily'] as const).map((k) => {
                const b = stats[k];
                if (!b) return null;
                return (
                  <tr key={k}>
                    <th>{TIME_CLASS_LABELS[k.replace('chess_', '') as TimeClass]}</th>
                    <td>{b.last?.rating ?? '—'}</td>
                    <td>{b.best?.rating ?? '—'}</td>
                    <td>{b.record ? `${b.record.win} / ${b.record.draw} / ${b.record.loss}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small">Cotes officielles de Chess.com (données publiques), relevées le {integration.refreshedAt ? new Date(integration.refreshedAt).toLocaleDateString('fr-FR') : '—'}. Elles ne se comparent pas directement à ta cote d’exercices dans cette application.</p>
          <div className="row">
            <button type="button" className="btn btn-small" onClick={refresh} disabled={refreshing}>{refreshing ? 'Actualisation…' : 'Actualiser'}</button>
            <button type="button" className="btn btn-small" onClick={() => setConfirm(true)}>Délier ce compte</button>
          </div>
        </section>

        <section className="panel">
          <h2 className="panel-title">Importer mes parties</h2>
          {!archives ? (
            <button type="button" className="btn btn-primary" onClick={loadArchives} data-testid="chesscom-archives">Afficher les mois disponibles</button>
          ) : archives.length === 0 ? (
            <p className="muted">Aucune partie publique sur ce compte.</p>
          ) : (
            <>
              <div className="month-list" role="group" aria-label="Mois à importer">
                {archives.map((u) => (
                  <label key={u} className="check">
                    <input type="checkbox" checked={selected.has(u)} onChange={() => setSelected(toggle(selected, u))} />
                    <span>{archiveLabel(u).label}</span>
                  </label>
                ))}
              </div>
              <p className="small"><strong>Cadences :</strong></p>
              <div className="chips">
                {CLASSES.map((c) => (
                  <button key={c} type="button" className={`chip${classes.has(c) ? ' active' : ''}`} aria-pressed={classes.has(c)} onClick={() => setClasses(toggle(classes, c))}>{TIME_CLASS_LABELS[c]}</button>
                ))}
              </div>
              <label className="check">
                <input type="checkbox" checked={ratedOnly} onChange={(e) => setRatedOnly(e.target.checked)} />
                <span>Parties classées seulement</span>
              </label>
              {importing ? (
                <div>
                  <p className="muted" data-testid="chesscom-import-progress">Import : {importing.done} / {importing.total} mois {importing.month && `(${importing.month})`}</p>
                  <button type="button" className="btn btn-small" onClick={() => abort.current?.abort()}>Interrompre</button>
                </div>
              ) : (
                <button type="button" className="btn btn-primary" disabled={!selected.size || !classes.size} onClick={runImport} data-testid="chesscom-import">
                  Importer {selected.size} mois
                </button>
              )}
              <p className="muted small">Les parties en Chess960 ou autres variantes sont ignorées. Les parties déjà importées ne sont pas dupliquées.</p>
            </>
          )}
          {summary && (
            <div className="feedback ok" role="status" data-testid="chesscom-summary">
              {summary.imported} partie{summary.imported > 1 ? 's' : ''} importée{summary.imported > 1 ? 's' : ''}
              {summary.duplicates ? ` · ${summary.duplicates} déjà présente${summary.duplicates > 1 ? 's' : ''}` : ''}
              {summary.variants ? ` · ${summary.variants} variante${summary.variants > 1 ? 's' : ''} ignorée${summary.variants > 1 ? 's' : ''}` : ''}
              {summary.filtered ? ` · ${summary.filtered} hors filtres` : ''}
              {summary.invalid ? ` · ${summary.invalid} illisible${summary.invalid > 1 ? 's' : ''}` : ''}.
            </div>
          )}
        </section>
      </div>

      <AutoImportPanel integration={integration} />

      <section className="panel">
        <h2 className="panel-title">Analyser mes parties pour détecter mes erreurs récurrentes</h2>
        <p>
          {importedCount ?? 0} partie{(importedCount ?? 0) > 1 ? 's' : ''} Chess.com importée{(importedCount ?? 0) > 1 ? 's' : ''}, dont <strong>{pending?.length ?? 0}</strong> pas encore analysée{(pending?.length ?? 0) > 1 ? 's' : ''}.
          L’analyse prend quelques dizaines de secondes par partie ; tu peux l’interrompre à tout moment.
        </p>
        {batch ? (
          <div>
            <p className="muted" data-testid="batch-progress">Partie {batch.game} / {batch.games} · position {batch.position} / {batch.positions}</p>
            <button type="button" className="btn btn-small" onClick={() => abort.current?.abort()}>Interrompre</button>
          </div>
        ) : (
          <div className="row">
            <label className="inline-field">
              Les
              <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              plus récentes
            </label>
            <button type="button" className="btn btn-primary" disabled={!pending?.length} onClick={runBatch} data-testid="batch-analyse">Analyser</button>
          </div>
        )}
        {batchDone !== null && (
          <p className="feedback ok" role="status" data-testid="batch-done">
            {batchDone} partie{batchDone > 1 ? 's' : ''} analysée{batchDone > 1 ? 's' : ''}. Tes habitudes et tes positions à retravailler sont à jour dans <Link to="/entraineur">Mon entraîneur IA</Link>.
          </p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      <Modal
        open={confirm}
        title="Délier le compte Chess.com"
        onClose={() => setConfirm(false)}
        actions={
          <>
            <button type="button" className="btn" onClick={() => setConfirm(false)}>Annuler</button>
            <button type="button" className="btn btn-primary" data-testid="chesscom-disconnect" onClick={async () => { setConfirm(false); await disconnectIntegration(deleteGames); }}>Délier</button>
          </>
        }
      >
        <p>Le pseudo « {integration.username} », ses statistiques et le cache des mois téléchargés seront supprimés de cet appareil.</p>
        <label className="check">
          <input type="checkbox" checked={deleteGames} onChange={(e) => setDeleteGames(e.target.checked)} />
          <span>Supprimer aussi les parties importées et leurs analyses</span>
        </label>
      </Modal>
    </>
  );
}
