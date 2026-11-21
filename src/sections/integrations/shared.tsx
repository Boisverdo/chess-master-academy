/** Panneaux communs aux liaisons Chess.com et Lichess : import automatique et analyse groupée. */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { analyseBatch, type BatchProgress } from '../../analysis/batch';
import { getEngine } from '../../engine/browser';
import type { ImportSummary } from '../../integrations/chesscom/importer';
import { db, type GameSource, type IntegrationRecord } from '../../storage/db';
import { saveIntegration } from '../../storage/repo';
import { useData } from '../../ui/useData';

export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const fmtDate = (t: number) => new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export function toggle(set: Set<string>, v: string): Set<string> {
  const n = new Set(set);
  if (n.has(v)) n.delete(v);
  else n.add(v);
  return n;
}

export function SummaryLine({ summary, testId }: { summary: ImportSummary; testId: string }) {
  return (
    <div className="feedback ok" role="status" data-testid={testId}>
      {summary.imported} partie{summary.imported > 1 ? 's' : ''} importée{summary.imported > 1 ? 's' : ''}
      {summary.duplicates ? ` · ${summary.duplicates} déjà présente${summary.duplicates > 1 ? 's' : ''}` : ''}
      {summary.variants ? ` · ${summary.variants} variante${summary.variants > 1 ? 's' : ''} ignorée${summary.variants > 1 ? 's' : ''}` : ''}
      {summary.filtered ? ` · ${summary.filtered} hors filtres` : ''}
      {summary.invalid ? ` · ${summary.invalid} illisible${summary.invalid > 1 ? 's' : ''}` : ''}.
    </div>
  );
}

export interface AutoPanelProps {
  integration: IntegrationRecord;
  /** Préfixe des identifiants de test (« chesscom » ou « lichess »). */
  prefix: string;
  service: string;
  scope: string;
  classes: readonly string[];
  labels: Record<string, string>;
  defaults: string[];
  run: (force: boolean) => Promise<{ ran: false } | { ran: true; summary: ImportSummary }>;
}

/** Import automatique : choix distinct de la liaison, désactivé par défaut, modifiable à tout moment. */
export function AutoImportPanel({ integration, prefix, service, scope, classes: all, labels, defaults, run }: AutoPanelProps) {
  const auto = integration.autoImport;
  // État affiché immédiatement (la base est mise à jour juste après).
  const [enabled, setEnabled] = useState(!!auto?.enabled);
  useEffect(() => setEnabled(!!auto?.enabled), [auto?.enabled]);
  const [classes, setClasses] = useState<Set<string>>(new Set(auto?.timeClasses ?? defaults));
  const [ratedOnly, setRatedOnly] = useState(auto?.ratedOnly ?? false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
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
      const r = await run(true);
      if (r.ran) setResult(r.summary);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleClass = (c: string) => {
    const n = toggle(classes, c);
    setClasses(n);
    if (enabled && n.size) void save({ enabled: true, timeClasses: n });
  };

  return (
    <section className="panel" data-testid={`${prefix}-auto`}>
      <h2 className="panel-title">Import automatique des nouvelles parties</h2>
      <label className="check consent">
        <input type="checkbox" checked={enabled} disabled={!classes.size} onChange={(e) => void save({ enabled: e.target.checked })} data-testid={`${prefix}-auto-toggle`} />
        <span>
          À l’ouverture de l’application, vérifier si j’ai joué de nouvelles parties sur {service} et les importer sur cet appareil (lecture seule, au plus une vérification toutes les 6 heures, {scope}).
        </span>
      </label>
      <p className="small"><strong>Cadences importées :</strong></p>
      <div className="chips">
        {all.map((c) => (
          <button key={c} type="button" className={`chip${classes.has(c) ? ' active' : ''}`} aria-pressed={classes.has(c)} onClick={() => toggleClass(c)}>{labels[c]}</button>
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={ratedOnly} onChange={(e) => { setRatedOnly(e.target.checked); if (enabled) void save({ enabled: true, ratedOnly: e.target.checked }); }} />
        <span>Parties classées seulement</span>
      </label>
      {enabled && (
        <>
          <p className="muted small" data-testid={`${prefix}-auto-status`}>
            {integration.lastAutoCheckAt ? `Dernière vérification : ${fmtDate(integration.lastAutoCheckAt)}.` : 'Première vérification à la prochaine ouverture de l’application.'}
          </p>
          <button type="button" className="btn btn-small" onClick={checkNow} disabled={busy} data-testid={`${prefix}-auto-now`}>{busy ? 'Vérification…' : 'Vérifier maintenant'}</button>
        </>
      )}
      {result && (
        <p className="feedback ok" role="status" data-testid={`${prefix}-auto-result`}>
          {result.imported ? `${result.imported} nouvelle${result.imported > 1 ? 's' : ''} partie${result.imported > 1 ? 's' : ''} importée${result.imported > 1 ? 's' : ''}.` : 'Aucune nouvelle partie.'}
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <p className="muted small">L’analyse des parties reste à lancer toi-même (ci-dessous) : elle utilise beaucoup le processeur.</p>
    </section>
  );
}

/** Analyse groupée des parties importées d'une source, des plus récentes aux plus anciennes. */
export function BatchAnalysisPanel({ source, label }: { source: GameSource; label: string }) {
  const [batch, setBatch] = useState<BatchProgress | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [count, setCount] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const { data: pending } = useData(() => db.games.where('source').equals(source).filter((g) => !g.analyzedAt).toArray().then((l) => l.sort((a, b) => b.createdAt - a.createdAt)), [source]);
  const { data: imported } = useData(() => db.games.where('source').equals(source).count(), [source]);

  const runBatch = async () => {
    if (!pending?.length) return;
    setError(null);
    setDone(null);
    abort.current = new AbortController();
    try {
      const engine = await getEngine();
      setDone(await analyseBatch(pending.slice(0, count), engine, { signal: abort.current.signal, onProgress: setBatch }));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBatch(null);
    }
  };

  const n = imported ?? 0;
  const p = pending?.length ?? 0;
  return (
    <section className="panel">
      <h2 className="panel-title">Analyser mes parties pour détecter mes erreurs récurrentes</h2>
      <p>
        {n} partie{n > 1 ? 's' : ''} {label} importée{n > 1 ? 's' : ''}, dont <strong>{p}</strong> pas encore analysée{p > 1 ? 's' : ''}.
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
              {[5, 10, 20, 50].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            plus récentes
          </label>
          <button type="button" className="btn btn-primary" disabled={!p} onClick={runBatch} data-testid="batch-analyse">Analyser</button>
        </div>
      )}
      {done !== null && (
        <p className="feedback ok" role="status" data-testid="batch-done">
          {done} partie{done > 1 ? 's' : ''} analysée{done > 1 ? 's' : ''}. Tes habitudes et tes positions à retravailler sont à jour dans <Link to="/entraineur">Mon entraîneur IA</Link>.
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
