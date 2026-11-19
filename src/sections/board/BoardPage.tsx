import { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardView, type BoardColor } from '../../board/BoardView';
import { ChessGame, type PromotionPiece, type Square } from '../../core/game';
import { exportPgn, importPgn } from '../../core/pgn';
import { useNavigate } from 'react-router-dom';
import { saveGameRecord } from '../../storage/repo';
import { useSettings } from '../../ui/settings';
import { ConfirmModal, Modal } from '../../ui/Modal';
import { MoveList } from './MoveList';
import { PromotionPicker } from './PromotionPicker';
import { describeStatus } from './gameText';
import { loadGame, saveGame } from './savedGame';

type Pending = 'new' | 'resign' | 'draw' | 'branch' | null;
const toColor = (c: 'w' | 'b'): BoardColor => (c === 'w' ? 'white' : 'black');

export function BoardPage() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const initial = useMemo(loadGame, []);
  const [game, setGame] = useState<ChessGame>(initial.game);
  const [orientation, setOrientation] = useState<BoardColor>(initial.orientation);
  const [viewPly, setViewPly] = useState<number>(initial.game.length);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [syncKey, setSyncKey] = useState(0);
  const [pending, setPending] = useState<Pending>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const live = viewPly === game.length;
  const status = game.status();
  const fen = game.fenAt(viewPly);
  const shownPly = game.plies[viewPly - 1];
  const viewGame = useMemo(() => (live ? game : game.truncate(viewPly)), [game, live, viewPly]);
  const dests = useMemo(() => (live ? game.legalDests() : new Map<Square, Square[]>()), [game, live]);
  const lastMove = useMemo<[string, string] | undefined>(() => (shownPly ? [shownPly.from, shownPly.to] : undefined), [shownPly]);

  useEffect(() => saveGame(game, orientation), [game, orientation]);

  const commit = useCallback((next: ChessGame) => {
    setGame(next);
    setViewPly(next.length);
  }, []);

  const onMove = useCallback(
    (from: string, to: string) => {
      const f = from as Square;
      const t = to as Square;
      if (game.isPromotion(f, t)) {
        setPromotion({ from: f, to: t });
        return;
      }
      const next = game.play(f, t);
      if (next) commit(next);
      else setSyncKey((k) => k + 1); // sécurité : l'échiquier revient à la position légale
    },
    [game, commit],
  );

  const pickPromotion = (p: PromotionPiece) => {
    if (!promotion) return;
    const next = game.play(promotion.from, promotion.to, p);
    setPromotion(null);
    if (next) commit(next);
    else setSyncKey((k) => k + 1);
  };

  const cancelPromotion = () => {
    setPromotion(null);
    setSyncKey((k) => k + 1);
  };

  const go = useCallback((ply: number) => setViewPly(Math.max(0, Math.min(game.length, ply))), [game.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.closest('dialog[open]'))) return;
      if (e.key === 'ArrowLeft') go(viewPly - 1);
      else if (e.key === 'ArrowRight') go(viewPly + 1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(game.length);
      else if (e.key === 'f' && !e.ctrlKey && !e.metaKey) setOrientation((o) => (o === 'white' ? 'black' : 'white'));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, viewPly, game.length]);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((n) => (n === msg ? null : n)), 3500);
  };

  const pgnText = () => exportPgn(game);

  const copyPgn = async () => {
    try {
      await navigator.clipboard.writeText(pgnText());
      flash('PGN copié dans le presse-papiers.');
    } catch {
      flash('Copie impossible : utilisez « Télécharger le PGN ».');
    }
  };

  const downloadPgn = () => {
    const blob = new Blob([pgnText()], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partie-${new Date().toISOString().slice(0, 10)}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = () => {
    const report = importPgn(importText);
    const first = report.games[0];
    if (!first) {
      setImportMsg(report.errors[0]?.message ?? 'Aucune partie valide trouvée.');
      return;
    }
    commit(first);
    setImportOpen(false);
    setImportText('');
    setImportMsg(null);
    const extra = report.games.length + report.errors.length > 1 ? ` (première de ${report.games.length + report.errors.length} parties ; l'import multiple arrivera avec l'analyse)` : '';
    flash(`Partie importée : ${first.length} demi-coups${extra}.`);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5_000_000) {
      setImportMsg('Fichier trop volumineux (5 Mo maximum).');
      return;
    }
    setImportText(await file.text());
  };

  const confirmPending = () => {
    if (pending === 'new') commit(ChessGame.create());
    if (pending === 'resign') commit(game.resign(game.turn));
    if (pending === 'draw') commit(game.agreeDraw());
    if (pending === 'branch') commit(game.truncate(viewPly));
    setPending(null);
  };

  const moveNumber = Number(game.startFen.split(' ')[5] ?? '1') || 1;
  const sideName = game.turn === 'w' ? 'les Blancs' : 'les Noirs';

  return (
    <div className="board-page">
      <div className="board-column">
        <div className="board-holder">
          <BoardView
            fen={fen}
            orientation={orientation}
            turnColor={toColor(viewGame.turn)}
            movableColor={live && !status.over && !promotion ? toColor(game.turn) : undefined}
            dests={dests}
            lastMove={lastMove}
            check={viewGame.status().inCheck}
            showDests={settings.showLegalMoves}
            coordinates={settings.coordinates}
            syncKey={syncKey}
            onMove={onMove}
          />
          {promotion && <PromotionPicker color={toColor(game.turn)} onPick={pickPromotion} onCancel={cancelPromotion} />}
        </div>
        <div className="nav-bar" role="group" aria-label="Navigation dans la partie">
          <button type="button" className="btn btn-icon" onClick={() => go(0)} disabled={viewPly === 0} aria-label="Début de la partie" title="Début (Origine)">⏮</button>
          <button type="button" className="btn btn-icon" onClick={() => go(viewPly - 1)} disabled={viewPly === 0} aria-label="Coup précédent" title="Coup précédent (←)">◀</button>
          <button type="button" className="btn btn-icon" onClick={() => go(viewPly + 1)} disabled={live} aria-label="Coup suivant" title="Coup suivant (→)">▶</button>
          <button type="button" className="btn btn-icon" onClick={() => go(game.length)} disabled={live} aria-label="Position actuelle" title="Position actuelle (Fin)">⏭</button>
          <button type="button" className="btn btn-icon" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))} aria-label="Retourner l'échiquier" title="Retourner l'échiquier (F)">⇅</button>
        </div>
      </div>

      <aside className="side-panel">
        <div className={`status-card${status.over ? ' over' : ''}${status.inCheck && !status.over ? ' check' : ''}`} role="status" aria-live="polite" data-testid="status">
          {describeStatus(status)}
        </div>

        {!live && (
          <div className="view-banner">
            <span>Vous consultez la position après le demi-coup {viewPly} sur {game.length}.</span>
            <div className="row">
              <button type="button" className="btn btn-small" onClick={() => go(game.length)}>Revenir à la position actuelle</button>
              <button type="button" className="btn btn-small" onClick={() => setPending('branch')}>Reprendre d'ici</button>
            </div>
          </div>
        )}

        <section className="panel">
          <h2 className="panel-title">Coups joués</h2>
          <MoveList
            plies={game.plies}
            startsWithBlack={game.startFen.split(' ')[1] === 'b'}
            firstMoveNumber={moveNumber}
            currentPly={viewPly}
            notation={settings.notation}
            onSelect={go}
          />
        </section>

        <section className="panel actions">
          <button type="button" className="btn" onClick={() => commit(game.undo())} disabled={game.length === 0 && !status.over} data-testid="undo">
            Annuler le coup
          </button>
          <button type="button" className="btn" onClick={() => (game.length ? setPending('new') : commit(ChessGame.create()))}>
            Nouvelle partie
          </button>
          <button type="button" className="btn" onClick={() => setPending('resign')} disabled={status.over}>
            Abandonner
          </button>
          <button type="button" className="btn" onClick={() => setPending('draw')} disabled={status.over}>
            Nulle par accord
          </button>
          <button type="button" className="btn" onClick={() => { setImportMsg(null); setImportOpen(true); }}>
            Importer un PGN
          </button>
          <button type="button" className="btn" onClick={copyPgn}>
            Copier le PGN
          </button>
          <button type="button" className="btn" onClick={downloadPgn}>
            Télécharger le PGN
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={game.length === 0}
            data-testid="analyse-board-game"
            onClick={async () => {
              const id = await saveGameRecord({ source: 'echiquier', createdAt: Date.now(), pgn: pgnText(), white: game.headers['White'] ?? 'Blancs', black: game.headers['Black'] ?? 'Noirs', result: status.result });
              navigate(`/analyse/${id}`);
            }}
          >
            Analyser cette partie
          </button>
        </section>

        <p className="hint muted">
          Astuce : à la souris, clic droit sur une case pour un cercle, clic droit glissé pour une flèche. Clavier : ← → pour naviguer, F pour retourner l'échiquier.
        </p>
        {notice && <div className="toast" role="status">{notice}</div>}
      </aside>

      <ConfirmModal
        open={pending !== null}
        title={
          pending === 'new' ? 'Nouvelle partie' : pending === 'resign' ? 'Abandonner' : pending === 'draw' ? 'Nulle par accord' : "Reprendre d'ici"
        }
        message={
          pending === 'new'
            ? 'La partie en cours sera remplacée. Pensez à télécharger son PGN si vous voulez la garder.'
            : pending === 'resign'
              ? `Confirmer l'abandon pour ${sideName} (camp au trait) ?`
              : pending === 'draw'
                ? 'Les deux joueurs acceptent-ils la nulle ?'
                : `Les coups après le demi-coup ${viewPly} seront supprimés.`
        }
        confirmLabel={pending === 'new' ? 'Commencer' : 'Confirmer'}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />

      <Modal
        open={importOpen}
        title="Importer une partie (PGN)"
        onClose={() => setImportOpen(false)}
        actions={
          <>
            <button type="button" className="btn" onClick={() => setImportOpen(false)}>Annuler</button>
            <button type="button" className="btn btn-primary" onClick={doImport} disabled={!importText.trim()} data-testid="import-confirm">Importer</button>
          </>
        }
      >
        <label className="field">
          <span>Collez le texte PGN :</span>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={8} spellCheck={false} data-testid="import-text" placeholder={'[Event "…"]\n\n1. e4 e5 2. Nf3 …'} />
        </label>
        <label className="field">
          <span>… ou choisissez un fichier .pgn :</span>
          <input type="file" accept=".pgn,application/x-chess-pgn,text/plain" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <p className="muted small">Le PGN doit utiliser la notation anglaise standard (K, Q, R, B, N), comme tous les exports de logiciels d'échecs.</p>
        {importMsg && <p className="error" role="alert">{importMsg}</p>}
      </Modal>
    </div>
  );
}
