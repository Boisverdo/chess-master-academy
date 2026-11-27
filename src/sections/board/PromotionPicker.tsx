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

/**
 * Choix de la pièce de promotion : fenêtre modale native (<dialog> + showModal) — le navigateur
 * garde le focus dans la fenêtre, rend la page inerte et gère Échap.
 */
export function PromotionPicker({ color, onPick, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="promotion-dialog"
      aria-labelledby="promotion-title"
      onCancel={(e) => {
        // Échap (ou geste « retour ») : on laisse React retirer la fenêtre.
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        // Clic sur le fond : on teste la position du pointeur, pas la cible (la fenêtre est aussi la cible de son propre bord).
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onCancel();
      }}
    >
      <div className="promotion-box cg-wrap">
        <h1 id="promotion-title" className="promotion-title">Promotion du pion</h1>
        <div className="promotion-choices">
          {CHOICES.map((c, i) => (
            <button
              key={c.p}
              autoFocus={i === 0}
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
    </dialog>
  );
}
