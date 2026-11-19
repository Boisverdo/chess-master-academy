import { useEffect, useRef } from 'react';
import type { Ply } from '../../core/game';
import { formatSan, type NotationStyle } from '../../core/notation';

interface Props {
  plies: readonly Ply[];
  /** Fen de départ : si les Noirs commencent, la première ligne affiche « 1... ». */
  startsWithBlack: boolean;
  firstMoveNumber: number;
  currentPly: number;
  notation: NotationStyle;
  onSelect: (ply: number) => void;
}

interface Row {
  n: number;
  white?: Ply;
  black?: Ply;
}

function rows(plies: readonly Ply[], startsWithBlack: boolean, first: number): Row[] {
  const out: Row[] = [];
  let i = 0;
  let n = first;
  if (startsWithBlack && plies[0]) {
    out.push({ n, black: plies[0] });
    i = 1;
    n++;
  }
  for (; i < plies.length; i += 2, n++) out.push({ n, white: plies[i], black: plies[i + 1] });
  return out;
}

/** Feuille de partie cliquable en notation algébrique. */
export function MoveList({ plies, startsWithBlack, firstMoveNumber, currentPly, notation, onSelect }: Props) {
  const box = useRef<HTMLOListElement>(null);

  useEffect(() => {
    // Fait défiler seulement la liste (jamais la page) pour garder le coup courant visible.
    const list = box.current;
    const row = list?.querySelector<HTMLElement>('.move.current')?.closest('li');
    if (!list || !row) return;
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
  }, [currentPly]);

  if (plies.length === 0) return <p className="muted moves-empty">Aucun coup joué pour l'instant.</p>;

  const cell = (p?: Ply) =>
    p ? (
      <button
        type="button"
        className={`move${p.ply === currentPly ? ' current' : ''}`}
        aria-current={p.ply === currentPly ? 'step' : undefined}
        data-ply={p.ply}
        onClick={() => onSelect(p.ply)}
      >
        {formatSan(p.san, p.color, notation)}
      </button>
    ) : (
      <span className="move empty">{startsWithBlack ? '…' : ''}</span>
    );

  return (
    <ol ref={box} className="moves" aria-label="Feuille de partie" data-testid="move-list">
      {rows(plies, startsWithBlack, firstMoveNumber).map((r) => (
        <li key={r.n} className="move-row">
          <span className="move-number">{r.n}.</span>
          {cell(r.white)}
          {r.black ? cell(r.black) : <span className="move empty" />}
        </li>
      ))}
    </ol>
  );
}
