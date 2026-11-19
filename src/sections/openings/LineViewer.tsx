import { useMemo, useState } from 'react';
import { PlayableBoard } from '../../board/PlayableBoard';
import { ChessGame } from '../../core/game';
import { formatSan } from '../../core/notation';
import { useSettings } from '../../ui/settings';

interface Props {
  moves: string[];
  comments?: string[];
  orientation: 'white' | 'black';
  /** Texte affiché à la fin de la ligne (ex. explication d'un piège). */
  conclusion?: string;
  startAtEnd?: boolean;
}

/** Rejoue une suite de coups sur l'échiquier, avec commentaire pour chaque coup. */
export function LineViewer({ moves, comments, orientation, conclusion, startAtEnd = false }: Props) {
  const { settings } = useSettings();
  const game = useMemo(() => ChessGame.fromSan(moves), [moves]);
  const [ply, setPly] = useState(startAtEnd ? game.length : 0);
  const current = game.plies[ply - 1];

  return (
    <div className="line-viewer">
      <div className="lesson-board">
        <PlayableBoard fen={game.fenAt(ply)} orientation={orientation} lastMove={current ? [current.from, current.to] : undefined} />
        <div className="demo-controls">
          <button type="button" className="btn btn-icon" onClick={() => setPly(0)} disabled={ply === 0} aria-label="Début">⏮</button>
          <button type="button" className="btn btn-icon" onClick={() => setPly(ply - 1)} disabled={ply === 0} aria-label="Coup précédent">◀</button>
          <button type="button" className="btn btn-icon" onClick={() => setPly(ply + 1)} disabled={ply === game.length} aria-label="Coup suivant">▶</button>
          <button type="button" className="btn btn-icon" onClick={() => setPly(game.length)} disabled={ply === game.length} aria-label="Fin">⏭</button>
        </div>
      </div>
      <div className="line-text">
        <ol className="line-moves">
          {game.plies.map((p, i) => (
            <li key={i} className={p.color === 'w' ? 'w' : 'b'}>
              {p.color === 'w' && <span className="move-number">{Math.floor(i / 2) + 1}.</span>}
              <button type="button" className={`move${ply === i + 1 ? ' current' : ''}`} onClick={() => setPly(i + 1)}>
                {formatSan(p.san, p.color, settings.notation)}
              </button>
            </li>
          ))}
        </ol>
        <p className="demo-comment" aria-live="polite">
          {current && comments?.[ply - 1] ? (
            <>
              <strong>{formatSan(current.san, current.color, settings.notation)}</strong> — {comments[ply - 1]}
            </>
          ) : ply === 0 ? (
            'Utilise ▶ ou clique sur un coup pour avancer.'
          ) : null}
        </p>
        {ply === game.length && conclusion && <div className="feedback info">{conclusion}</div>}
      </div>
    </div>
  );
}
