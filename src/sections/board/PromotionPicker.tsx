import { useEffect, useRef } from 'react';
import type { PromotionPiece } from '../../core/game';

const CHOICES: { p: PromotionPiece; name: string; css: string }[] = [
  { p: 'q', name: 'Dame', css: 'queen' },
  { p: 'r', name: 'Tour', css: 'rook' },
  { p: 'b', name: 'Fou', css: 'bishop' },
  { p: 'n', name: 'Cavalier', css: 'knight' },
];

/** Affiche une pièce avec les images de Chessground (élément <piece>, créé hors de React). */
function PieceIcon({ className }: { className: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const el = document.createElement('piece');
    el.className = className;
    host.replaceChildren(el);
  }, [className]);
  return <span ref={ref} className="piece-icon" aria-hidden="true" />;
}

interface Props {
  color: 'white' | 'black';
  onPick: (p: PromotionPiece) => void;
  onCancel: () => void;
}

/** Choix de la pièce de promotion, affiché par-dessus l'échiquier. */
export function PromotionPicker({ color, onPick, onCancel }: Props) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);

  return (
    <div
      className="promotion-overlay"
      role="dialog"
      aria-label="Choisir la pièce de promotion"
      onClick={onCancel}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div className="promotion-box cg-wrap" onClick={(e) => e.stopPropagation()}>
        <p className="promotion-title">Promotion du pion</p>
        <div className="promotion-choices">
          {CHOICES.map((c, i) => (
            <button
              key={c.p}
              ref={i === 0 ? first : undefined}
              type="button"
              className="promotion-choice"
              aria-label={c.name}
              title={c.name}
              data-testid={`promote-${c.p}`}
              onClick={() => onPick(c.p)}
            >
              <PieceIcon className={`${c.css} ${color}`} />
              <span>{c.name}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Annuler la promotion
        </button>
      </div>
    </div>
  );
}
