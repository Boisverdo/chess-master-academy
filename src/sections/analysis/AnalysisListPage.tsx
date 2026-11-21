import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { exportPgn, importPgn } from '../../core/pgn';
import type { GameRecord } from '../../storage/db';
import { listGames, saveGameRecord } from '../../storage/repo';
import { useData } from '../../ui/useData';

const SOURCE_LABELS: Record<GameRecord['source'], string> = { ia: 'Contre l’ordinateur', import: 'Importée', echiquier: 'Échiquier', chesscom: 'Chess.com', lichess: 'Lichess' };

export function AnalysisListPage() {
  const navigate = useNavigate();
  const { data: games } = useData(listGames);
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const doImport = async () => {
    const report = importPgn(text);
    if (!report.games.length) {
      setMessage(report.errors[0]?.message ?? 'Aucune partie valide trouvée.');
      return;
    }
    let firstId: number | null = null;
    for (const g of report.games) {
      const id = await saveGameRecord({
        source: 'import',
        createdAt: Date.now(),
        pgn: exportPgn(g),
        white: g.headers['White'] ?? '?',
        black: g.headers['Black'] ?? '?',
        result: g.status().result,
      });
      firstId ??= id;
    }
    setText('');
    setMessage(`${report.games.length} partie${report.games.length > 1 ? 's importées' : ' importée'}${report.errors.length ? `, ${report.errors.length} ignorée(s) : ${report.errors[0]!.message}` : ''}.`);
    if (report.games.length === 1 && firstId !== null) navigate(`/analyse/${firstId}`);
  };

  return (
    <div className="page page-wide">
      <h1>Analyse des parties</h1>
      <p className="lead">Chaque coup est évalué par Stockfish, puis expliqué par l’entraîneur dans un langage clair. Les chiffres viennent toujours d’un calcul réel.</p>
      <div className="two-cols">
        <section className="panel">
          <h2 className="panel-title">Importer une partie (PGN)</h2>
          <label className="field">
            <span>Colle une ou plusieurs parties au format PGN :</span>
            <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} data-testid="analysis-import" placeholder={'[White "…"]\n\n1. e4 e5 2. Nf3 …'} />
          </label>
          <label className="field">
            <span>… ou choisis un fichier .pgn :</span>
            <input type="file" accept=".pgn,application/x-chess-pgn,text/plain" onChange={async (e) => { const f = e.target.files?.[0]; if (f && f.size < 5_000_000) setText(await f.text()); }} />
          </label>
          <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={doImport} data-testid="analysis-import-confirm">Importer</button>
          {message && <p className="muted" role="status">{message}</p>}
        </section>
        <section className="panel">
          <h2 className="panel-title">Mes parties</h2>
          {!games?.length ? (
            <p className="muted">Aucune partie pour l’instant. Joue contre l’<Link to="/jouer">ordinateur</Link>, analyse une partie de l’<Link to="/echiquier">échiquier</Link> ou importe un PGN.</p>
          ) : (
            <ul className="game-list">
              {games.map((g) => (
                <li key={g.id}>
                  <Link to={`/analyse/${g.id}`} className="rec">
                    <strong>{g.white} – {g.black} · {g.result}</strong>
                    <span className="muted small">
                      {SOURCE_LABELS[g.source]} · {new Date(g.createdAt).toLocaleDateString('fr-FR')} · {g.analyzedAt ? `analysée${g.accuracy && g.userColor ? `, précision ${g.accuracy[g.userColor].toLocaleString('fr-FR')} %` : ''}` : 'non analysée'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
