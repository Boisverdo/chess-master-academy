import { useState } from 'react';
import { Link } from 'react-router-dom';
import { normalizeLichessUsername, safeLichessUrl, type LichessSpeed, type LichessUser } from '../../integrations/lichess/client';
import { lichessAutoNow, lichessClient } from '../../integrations/lichess/autoRunner';
import { AUTO_MAX_GAMES, importLichess, SPEED_LABELS, SPEEDS } from '../../integrations/lichess/importer';
import type { ImportSummary } from '../../integrations/chesscom/importer';
import type { IntegrationRecord } from '../../storage/db';
import { disconnectIntegration, existingExternalIds, getLichessIntegration, saveGameRecord, saveIntegration } from '../../storage/repo';
import { Modal } from '../../ui/Modal';
import { useData } from '../../ui/useData';
import { AutoImportPanel, BatchAnalysisPanel, errText, SummaryLine, toggle } from '../integrations/shared';

export function LichessPage() {
  const { data: integration } = useData(() => getLichessIntegration().then((i) => i ?? null));
  return (
    <div className="page page-wide">
      <h1>Lichess et mes parties</h1>
      <p className="lead">Importe tes parties publiques Lichess pour que ton entraîneur les analyse. Cette liaison est facultative : tout le reste de l’application fonctionne sans elle.</p>
      {integration === undefined ? <p className="muted">Chargement…</p> : integration === null ? <Connect /> : <Connected integration={integration} />}
    </div>
  );
}

function Connect() {
  const [username, setUsername] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<LichessUser | null>(null);

  const search = async () => {
    setError(null);
    setFound(null);
    setBusy(true);
    try {
      setFound(await lichessClient().user(normalizeLichessUsername(username)));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="two-cols">
      <section className="panel">
        <h2 className="panel-title">Lier mon pseudo Lichess</h2>
        <label className="field">
          <span>Ton pseudo Lichess</span>
          <input className="text-input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" spellCheck={false} placeholder="ex. MonPseudo" data-testid="lichess-username" />
        </label>
        <label className="check consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="lichess-consent" />
          <span>J’accepte que l’application interroge l’API publique de Lichess pour ce pseudo (profil, cotes et parties publiques, en lecture seule) et enregistre ces données sur cet appareil.</span>
        </label>
        <button type="button" className="btn btn-primary" disabled={!consent || !username.trim() || busy} onClick={search} data-testid="lichess-search">
          {busy ? 'Recherche…' : 'Rechercher mon profil'}
        </button>
        {error && <p className="error" role="alert">{error}</p>}
        {found && (
          <div className="found" data-testid="lichess-found">
            <p>
              Profil trouvé : <strong>{found.username}</strong>
              {found.title ? ` (${found.title})` : ''}
              {found.createdAt ? `, membre depuis ${new Date(found.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}` : ''}
              {found.count?.all !== undefined ? `, ${found.count.all.toLocaleString('fr-FR')} parties` : ''}.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              data-testid="lichess-confirm"
              onClick={() => saveIntegration({ id: 'lichess', username: found.id, consentAt: Date.now(), profile: found, refreshedAt: Date.now() })}
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
          <li><strong>Lecture seule</strong> : l’application ne lit que tes données publiques ; elle ne peut rien faire sur ton compte.</li>
          <li><strong>Aucun mot de passe, aucune connexion à ton compte</strong> : ton pseudo suffit, car tes parties sont publiques sur Lichess.</li>
          <li><strong>Données stockées sur cet appareil</strong>, jamais ailleurs. Tu peux tout supprimer à tout moment.</li>
          <li><strong>Une requête à la fois</strong>, conformément aux règles de Lichess (et une minute de pause si Lichess le demande).</li>
        </ul>
        <p className="muted small">Autre possibilité, sans aucune requête : télécharge tes parties au format PGN depuis ton profil Lichess, puis importe le fichier dans <Link to="/analyse">Analyse des parties</Link>.</p>
      </section>
    </div>
  );
}

const PERF_ORDER: LichessSpeed[] = ['bullet', 'blitz', 'rapid', 'classical', 'correspondence'];
const COUNTS = [20, 50, 100, 200];

function Connected({ integration }: { integration: IntegrationRecord }) {
  const profile = integration.profile as LichessUser | undefined;
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [count, setCount] = useState(50);
  const [speeds, setSpeeds] = useState<Set<string>>(new Set(['blitz', 'rapid', 'classical', 'correspondence']));
  const [ratedOnly, setRatedOnly] = useState(false);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [deleteGames, setDeleteGames] = useState(false);

  const refresh = async () => {
    setError(null);
    setRefreshing(true);
    try {
      const u = await lichessClient().user(integration.username);
      await saveIntegration({ ...integration, profile: u, refreshedAt: Date.now() });
    } catch (e) {
      setError(errText(e));
    } finally {
      setRefreshing(false);
    }
  };

  const runImport = async () => {
    setError(null);
    setSummary(null);
    setImporting(true);
    try {
      const s = await importLichess(lichessClient(), integration.username, { max: count }, { speeds, ratedOnly }, { existing: await existingExternalIds(), save: (r) => saveGameRecord(r) });
      setSummary(s);
      await saveIntegration({ ...integration, lastImportAt: Date.now() });
    } catch (e) {
      setError(errText(e));
    } finally {
      setImporting(false);
    }
  };

  const link = safeLichessUrl(profile?.url ?? `https://lichess.org/@/${integration.username}`);
  return (
    <>
      <div className="two-cols">
        <section className="panel" data-testid="lichess-profile">
          <h2 className="panel-title">Profil lié</h2>
          <p>
            <strong>{profile?.username ?? integration.username}</strong>
            {profile?.title ? ` · ${profile.title}` : ''}
            {link && <> · <a href={link} target="_blank" rel="noopener noreferrer">voir sur Lichess</a></>}
          </p>
          <table className="summary-table">
            <thead>
              <tr><th>Cadence</th><th>Cote</th><th>Parties</th></tr>
            </thead>
            <tbody>
              {PERF_ORDER.map((k) => {
                const p = profile?.perfs?.[k];
                if (!p || !p.games) return null;
                return (
                  <tr key={k}>
                    <th>{SPEED_LABELS[k]}</th>
                    <td>{p.rating}{p.prov ? ' ?' : ''}</td>
                    <td>{p.games.toLocaleString('fr-FR')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small">
            Cotes officielles de Lichess (données publiques), relevées le {integration.refreshedAt ? new Date(integration.refreshedAt).toLocaleDateString('fr-FR') : '—'}. « ? » : cote provisoire. Elles ne se comparent directement ni aux cotes Chess.com ni à ta cote d’exercices dans cette application.
          </p>
          <div className="row">
            <button type="button" className="btn btn-small" onClick={refresh} disabled={refreshing}>{refreshing ? 'Actualisation…' : 'Actualiser'}</button>
            <button type="button" className="btn btn-small" onClick={() => setConfirm(true)}>Délier ce compte</button>
          </div>
        </section>

        <section className="panel">
          <h2 className="panel-title">Importer mes parties</h2>
          <label className="field">
            <span>Nombre de parties (les plus récentes)</span>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} data-testid="lichess-count">
              {COUNTS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <p className="small"><strong>Cadences :</strong></p>
          <div className="chips">
            {SPEEDS.map((c) => (
              <button key={c} type="button" className={`chip${speeds.has(c) ? ' active' : ''}`} aria-pressed={speeds.has(c)} onClick={() => setSpeeds(toggle(speeds, c))}>{SPEED_LABELS[c]}</button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={ratedOnly} onChange={(e) => setRatedOnly(e.target.checked)} />
            <span>Parties classées seulement</span>
          </label>
          <button type="button" className="btn btn-primary" disabled={!speeds.size || importing} onClick={runImport} data-testid="lichess-import">
            {importing ? 'Import en cours…' : `Importer mes ${count} dernières parties`}
          </button>
          <p className="muted small">Les variantes (Chess960, etc.) sont ignorées. Les parties déjà importées ne sont pas dupliquées. Lichess envoie environ 20 parties par seconde.</p>
          {summary && <SummaryLine summary={summary} testId="lichess-summary" />}
        </section>
      </div>

      <AutoImportPanel
        integration={integration}
        prefix="lichess"
        service="Lichess"
        scope={`${AUTO_MAX_GAMES} parties au plus par vérification`}
        classes={SPEEDS}
        labels={SPEED_LABELS}
        defaults={['blitz', 'rapid', 'classical', 'correspondence']}
        run={(force) => lichessAutoNow(force)}
      />

      <BatchAnalysisPanel source="lichess" label="Lichess" />
      {error && <p className="error" role="alert">{error}</p>}

      <Modal
        open={confirm}
        title="Délier le compte Lichess"
        onClose={() => setConfirm(false)}
        actions={
          <>
            <button type="button" className="btn" onClick={() => setConfirm(false)}>Annuler</button>
            <button type="button" className="btn btn-primary" data-testid="lichess-disconnect" onClick={async () => { setConfirm(false); await disconnectIntegration(deleteGames, undefined, 'lichess'); }}>Délier</button>
          </>
        }
      >
        <p>Le pseudo « {integration.username} » et ses cotes seront supprimés de cet appareil.</p>
        <label className="check">
          <input type="checkbox" checked={deleteGames} onChange={(e) => setDeleteGames(e.target.checked)} />
          <span>Supprimer aussi les parties importées et leurs analyses</span>
        </label>
      </Modal>
    </>
  );
}
