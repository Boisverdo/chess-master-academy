import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PlayableBoard } from '../../board/PlayableBoard';
import { ChessGame, type Color, type PromotionPiece, type Square } from '../../core/game';
import { formatSan } from '../../core/notation';
import { parsePgn } from '../../core/pgn';
import { annotatedPgn, describeThreat } from '../../analysis/extras';
import { EvalBar, EvalGraph } from '../../analysis/EvalViews';
import { CLASS_GLYPHS, CLASS_LABELS, criticalMoments, reviewGame, type MoveClass } from '../../analysis/review';
import { analyseRecord, openingBook } from '../../analysis/service';
import { explainMove, type Fmt } from '../../coach/explain';
import { judgeMove } from '../../coach/retry';
import { getEngine } from '../../engine/browser';
import { formatScore, toWhite } from '../../engine/uci';
import { db, type GameRecord } from '../../storage/db';
import { deleteGameRecord, updateGameRecord } from '../../storage/repo';
import { ConfirmModal } from '../../ui/Modal';
import { useSettings } from '../../ui/settings';
import { useData } from '../../ui/useData';

type Preview = { kind: 'best' | 'refutation'; fen: string; moves: string[]; step: number } | null;

export function AnalysisView() {
  const { id = '' } = useParams();
  const gameId = Number(id);
  const { data: record, error } = useData(() => db.games.get(gameId).then((r) => r ?? null), [gameId]);
  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (record === undefined) return <div className="page"><p className="muted">Chargement…</p></div>;
  if (record === null) return <div className="page"><h1>Partie introuvable</h1><Link to="/analyse">Retour</Link></div>;
  return <AnalysisContent key={record.id} record={record} />;
}

function AnalysisContent({ record }: { record: GameRecord }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { settings } = useSettings();
  const fmt: Fmt = (san, c) => formatSan(san, c, settings.notation);
  const game = useMemo(() => parsePgn(record.pgn), [record.pgn]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const start = async () => {
    setFailure(null);
    abort.current = new AbortController();
    setProgress({ done: 0, total: game.length + 1 });
    try {
      const engine = await getEngine();
      await analyseRecord(record, engine, { depth: 14, movetime: 1500, signal: abort.current.signal, onProgress: (done, total) => setProgress({ done, total }) });
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  };

  useEffect(() => {
    if (!record.evals && params.get('auto') === '1' && record.userColor) void start();
    return () => abort.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const header = (
    <>
      <p className="breadcrumb"><Link to="/analyse">Analyse</Link> › {record.white} – {record.black}</p>
      <h1>{record.white} – {record.black} <span className="muted small">{record.result}</span></h1>
    </>
  );

  if (!record.evals) {
    return (
      <div className="page page-wide">
        {header}
        <section className="panel setup">
          <h2 className="panel-title">Quel camp jouais-tu ?</h2>
          <div className="chips">
            {([['w', 'Les Blancs'], ['b', 'Les Noirs'], [undefined, 'Aucun (partie d’autres joueurs)']] as const).map(([c, label]) => (
              <button key={label} type="button" className={`chip${record.userColor === c ? ' active' : ''}`} onClick={() => updateGameRecord(record.id!, { userColor: c })}>{label}</button>
            ))}
          </div>
          <p className="muted small">Ton camp sert à repérer tes moments critiques et tes habitudes. L’analyse évalue {game.length + 1} positions avec Stockfish ({game.length > 60 ? 'environ une minute' : 'quelques dizaines de secondes'}).</p>
          {progress ? (
            <div>
              <div className="lesson-progress" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total} aria-label="Progression de l’analyse"><div style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
              <p className="muted" data-testid="analysis-progress">Analyse : {progress.done} / {progress.total} positions</p>
              <button type="button" className="btn" onClick={() => abort.current?.abort()}>Interrompre</button>
            </div>
          ) : (
            <button type="button" className="btn btn-primary btn-large" onClick={start} data-testid="start-analysis">Lancer l’analyse</button>
          )}
          {failure && <p className="error" role="alert">{failure}</p>}
        </section>
      </div>
    );
  }

  return (
    <div className="page page-wide">
      {header}
      <AnalysisBoard record={record} game={game} fmt={fmt} onDelete={() => setConfirmDelete(true)} onReanalyse={async () => { await updateGameRecord(record.id!, { evals: undefined, analyzedAt: undefined }); }} />
      <ConfirmModal
        open={confirmDelete}
        title="Supprimer la partie"
        message="La partie, son analyse et ses positions à retravailler seront supprimées de cet appareil."
        confirmLabel="Supprimer"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => { await deleteGameRecord(record.id!); navigate('/analyse'); }}
      />
    </div>
  );
}

const CLASS_ORDER: MoveClass[] = ['theorie', 'meilleur', 'bon', 'imprecision', 'erreur', 'gaffe'];

function AnalysisBoard({ record, game, fmt, onDelete, onReanalyse }: { record: GameRecord; game: ChessGame; fmt: Fmt; onDelete: () => void; onReanalyse: () => void }) {
  const evals = record.evals!;
  const review = useMemo(() => reviewGame(game, evals, openingBook()), [game, evals]);
  const me = record.userColor;
  const [ply, setPly] = useState(() => (me ? (criticalMoments(review, me)[0]?.ply ?? 0) : 0));
  const [preview, setPreview] = useState<Preview>(null);
  const [panel, setPanel] = useState<'explain' | 'understand'>('explain');
  const [threat, setThreat] = useState<string | null>(null);
  const [retry, setRetry] = useState<{ tone: 'ok' | 'bad' | 'info'; text: string } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [sync, setSync] = useState(0);

  const move = ply > 0 ? review.moves[ply - 1] : undefined;
  const explanation = useMemo(() => (move ? explainMove(move, evals[ply - 1]!, evals[ply]!, fmt, move.color === me) : null), [move, evals, ply, fmt, me]);
  const orientation = (me ?? 'w') === 'w' ? 'white' : 'black';

  useEffect(() => {
    setPreview(null);
    setThreat(null);
    setRetry(null);
    setRetrying(false);
  }, [ply]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, dialog[open]')) return;
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(0, p - 1));
      else if (e.key === 'ArrowRight') setPly((p) => Math.min(game.length, p + 1));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game.length]);

  // Position affichée : partie, suite recommandée/réfutation, ou position à rejouer.
  let boardFen = game.fenAt(ply);
  let lastMove: [string, string] | undefined = move ? [move.uci.slice(0, 2), move.uci.slice(2, 4)] : undefined;
  if (retrying && move) {
    boardFen = move.fenBefore;
    lastMove = undefined;
  } else if (preview) {
    const g = ChessGame.fromSan(preview.moves.slice(0, preview.step), preview.fen);
    boardFen = g.fen;
    const p = g.plies.at(-1);
    lastMove = p ? [p.from, p.to] : undefined;
  }
  const shapes = !preview && !retrying && move?.bestUci && move.cls !== 'meilleur' && move.cls !== 'theorie' && move.cls !== 'bon'
    ? [{ orig: move.bestUci.slice(0, 2), dest: move.bestUci.slice(2, 4), brush: 'green' }]
    : [];

  const evalHere = evals[ply]!;
  const turnHere = ChessGame.create(evalHere.fen).turn;
  const scoreLabel = evalHere.terminal === 'checkmate' ? '#' : evalHere.terminal === 'draw' ? '½' : formatScore(toWhite(evalHere.score, turnHere));

  const askThreat = async () => {
    if (!move) return;
    setThreat('Calcul en cours…');
    try {
      setThreat(await describeThreat(await getEngine(), move.fenBefore, move.color, fmt));
    } catch (e) {
      setThreat(e instanceof Error ? e.message : String(e));
    }
  };

  const onRetryMove = async (from: Square, to: Square, promotion?: PromotionPiece) => {
    if (!move) return;
    setRetry({ tone: 'info', text: 'Le moteur évalue ton coup…' });
    try {
      const v = await judgeMove(await getEngine(), evals[ply - 1]!, `${from}${to}${promotion ?? ''}`, fmt);
      setSync((k) => k + 1);
      if (!v) setRetry({ tone: 'bad', text: 'Coup illégal.' });
      else if (v.ok) {
        setRetry({ tone: 'ok', text: `Bien joué ! ${v.explanation.verdict}` });
        setRetrying(false);
      } else setRetry({ tone: 'bad', text: `${v.explanation.verdict} ${v.explanation.sentences[0] ?? ''} Essaie encore.` });
    } catch (e) {
      setRetry({ tone: 'bad', text: e instanceof Error ? e.message : String(e) });
    }
  };

  const download = () => {
    const comment = (p: number) => {
      const m = review.moves[p - 1]!;
      if (m.loss < 5) return undefined;
      const ex = explainMove(m, evals[p - 1]!, evals[p]!, (s) => s, false);
      return [ex.verdict, ...ex.sentences].join(' ');
    };
    const text = annotatedPgn(game.headers as Record<string, string>, game, review, comment);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/x-chess-pgn' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `analyse-${record.id}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const critical = me ? criticalMoments(review, me) : [];
  const sideName = (c: Color) => (c === 'w' ? record.white : record.black);

  return (
    <>
      <div className="analysis-grid">
        <div className="analysis-board">
          <EvalBar whiteWin={review.whiteWin[ply]!} label={scoreLabel} flipped={orientation === 'black'} />
          <PlayableBoard fen={boardFen} orientation={orientation} interactive={retrying} shapes={shapes} lastMove={lastMove} syncKey={sync} onMove={onRetryMove} />
          <div className="demo-controls">
            <button type="button" className="btn btn-icon" onClick={() => setPly(0)} disabled={ply === 0} aria-label="Début">⏮</button>
            <button type="button" className="btn btn-icon" onClick={() => setPly(ply - 1)} disabled={ply === 0} aria-label="Coup précédent">◀</button>
            <button type="button" className="btn btn-icon" onClick={() => setPly(ply + 1)} disabled={ply === game.length} aria-label="Coup suivant">▶</button>
            <button type="button" className="btn btn-icon" onClick={() => setPly(game.length)} disabled={ply === game.length} aria-label="Fin">⏭</button>
          </div>
        </div>

        <div className="analysis-side">
          {move && explanation ? (
            <section className="panel" data-testid="move-explanation">
              <div className="tabs" role="tablist">
                <button type="button" role="tab" aria-selected={panel === 'explain'} className={`tab${panel === 'explain' ? ' active' : ''}`} onClick={() => setPanel('explain')}>Explication</button>
                <button type="button" role="tab" aria-selected={panel === 'understand'} className={`tab${panel === 'understand' ? ' active' : ''}`} onClick={() => setPanel('understand')}>Comprendre mon erreur</button>
              </div>
              <p className={`verdict cls-${move.cls}`}><strong>{explanation.verdict}</strong></p>
              {panel === 'explain' && (
                <>
                  {explanation.sentences.map((s) => <p key={s}>{s}</p>)}
                  {explanation.lesson && move.loss >= 5 && (
                    <p className="feedback info">
                      <strong>À retenir :</strong> {explanation.lesson.text} <Link to={explanation.lesson.link}>{explanation.lesson.label}</Link>
                    </p>
                  )}
                  <div className="row">
                    {explanation.bestLine.length > 0 && move.cls !== 'meilleur' && move.cls !== 'theorie' && (
                      <button type="button" className="btn btn-small" onClick={() => setPreview({ kind: 'best', fen: move.fenBefore, moves: explanation.bestLine, step: 1 })}>Voir la meilleure suite</button>
                    )}
                    {explanation.refutation.length > 0 && move.loss >= 5 && (
                      <button type="button" className="btn btn-small" onClick={() => setPreview({ kind: 'refutation', fen: move.fenAfter, moves: explanation.refutation, step: 1 })}>Ce qui se passe après mon coup</button>
                    )}
                  </div>
                </>
              )}
              {panel === 'understand' && (
                <div className="understand" data-testid="understand">
                  <button type="button" className="btn btn-small" onClick={askThreat}>Que menaçait mon adversaire ?</button>
                  {threat && <p>{threat}</p>}
                  {move.loss >= 5 && (
                    <>
                      <button type="button" className="btn btn-small" onClick={() => setPreview({ kind: 'refutation', fen: move.fenAfter, moves: explanation.refutation, step: 1 })} disabled={!explanation.refutation.length}>Que se passe-t-il après mon coup ?</button>
                      <button type="button" className="btn btn-small" onClick={() => setPreview({ kind: 'best', fen: move.fenBefore, moves: explanation.bestLine, step: 1 })} disabled={!explanation.bestLine.length}>Pourquoi le coup recommandé est-il meilleur ?</button>
                      {explanation.lesson && <p><strong>Quelle leçon retenir ?</strong> {explanation.lesson.text} <Link to={explanation.lesson.link}>{explanation.lesson.label}</Link></p>}
                      <button type="button" className="btn btn-small btn-primary" onClick={() => { setPreview(null); setRetrying(true); setRetry({ tone: 'info', text: 'Rejoue la position : trouve un meilleur coup.' }); }} data-testid="retry">Retente ta chance</button>
                    </>
                  )}
                  {retry && <div className={`feedback ${retry.tone}`} role="status" data-testid="retry-feedback">{retry.text}</div>}
                </div>
              )}
              {preview && (
                <div className="preview-bar">
                  <span className="small">{preview.kind === 'best' ? 'Meilleure suite' : 'Suite après ton coup'} : {preview.step} / {preview.moves.length}</span>
                  <button type="button" className="btn btn-small" disabled={preview.step <= 1} onClick={() => setPreview({ ...preview, step: preview.step - 1 })}>◀</button>
                  <button type="button" className="btn btn-small" disabled={preview.step >= preview.moves.length} onClick={() => setPreview({ ...preview, step: preview.step + 1 })}>▶</button>
                  <button type="button" className="btn btn-small" onClick={() => setPreview(null)}>Revenir à la partie</button>
                </div>
              )}
            </section>
          ) : (
            <section className="panel"><p className="muted">Choisis un coup dans la liste ou utilise ▶ pour parcourir la partie.</p></section>
          )}

          <section className="panel">
            <h2 className="panel-title">Coups</h2>
            <ol className="line-moves analysis-moves" data-testid="analysis-moves">
              {review.moves.map((m) => (
                <li key={m.ply}>
                  {m.color === 'w' && <span className="move-number">{Math.ceil(m.ply / 2)}.</span>}
                  <button type="button" className={`move cls-${m.cls}${ply === m.ply ? ' current' : ''}`} onClick={() => setPly(m.ply)} title={CLASS_LABELS[m.cls]}>
                    {fmt(m.san, m.color)}{CLASS_GLYPHS[m.cls] ?? ''}
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <section className="panel">
        <h2 className="panel-title">Évaluation au fil de la partie (Stockfish, profondeur ≤ 14)</h2>
        <EvalGraph whiteWin={review.whiteWin} classes={review.moves.map((m) => m.cls)} current={ply} onSelect={setPly} />
      </section>

      <div className="two-cols">
        <section className="panel">
          <h2 className="panel-title">Bilan</h2>
          <table className="summary-table" data-testid="summary">
            <thead>
              <tr><th /><th>{sideName('w')}</th><th>{sideName('b')}</th></tr>
            </thead>
            <tbody>
              <tr><th>Précision</th><td>{review.accuracy.w.toLocaleString('fr-FR')} %</td><td>{review.accuracy.b.toLocaleString('fr-FR')} %</td></tr>
              {CLASS_ORDER.map((c) => (
                <tr key={c}><th>{CLASS_LABELS[c]}</th><td>{review.counts.w[c]}</td><td>{review.counts.b[c]}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Précision : moyenne, coup par coup, de la perte de probabilité de gain (formule ouverte). Ce n’est pas un classement.</p>
        </section>
        <section className="panel">
          <h2 className="panel-title">Moments critiques</h2>
          {!me ? (
            <p className="muted">Indique ton camp pour voir tes moments critiques.</p>
          ) : critical.length === 0 ? (
            <p>Aucune erreur importante de ta part dans cette partie. Bravo !</p>
          ) : (
            <ol className="recs" data-testid="critical">
              {critical.map((m) => (
                <li key={m.ply}>
                  <button type="button" className="rec rec-button" onClick={() => setPly(m.ply)}>
                    <strong>Coup {Math.ceil(m.ply / 2)} : {fmt(m.san, m.color)} ({CLASS_LABELS[m.cls].toLowerCase()})</strong>
                    <span className="muted small">{m.bestSan ? `Meilleur : ${fmt(m.bestSan, m.color)} · ` : ''}probabilité de gain {Math.round(m.winBefore)} % → {Math.round(m.winAfter)} %</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="row">
            <button type="button" className="btn btn-small" onClick={download}>Télécharger le PGN annoté</button>
            <button type="button" className="btn btn-small" onClick={onReanalyse}>Relancer l’analyse</button>
            <button type="button" className="btn btn-small" onClick={onDelete}>Supprimer</button>
          </div>
        </section>
      </div>
    </>
  );
}
