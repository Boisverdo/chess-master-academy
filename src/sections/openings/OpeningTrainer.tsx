import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayableBoard } from '../../board/PlayableBoard';
import { ChessGame, type PromotionPiece, type Square } from '../../core/game';
import { formatSan } from '../../core/notation';
import type { Opening } from '../../learning/openings/types';
import { DAY } from '../../storage/learning';
import { recordOpeningReview } from '../../storage/repo';
import { useSettings } from '../../ui/settings';

/**
 * Entraînement de mémorisation : le joueur joue les coups de son camp, l'application joue l'autre camp.
 * À chaque écart, l'explication du coup attendu est donnée : on apprend l'idée, pas seulement le coup.
 */
export function OpeningTrainer({ opening }: { opening: Opening }) {
  const { settings } = useSettings();
  const line = useMemo(() => opening.mainLine.map(([san]) => san), [opening]);
  const full = useMemo(() => ChessGame.fromSan(line), [line]);
  const myColor = opening.side === 'white' ? 'w' : 'b';
  const [ply, setPly] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [showArrow, setShowArrow] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad' | 'info'; text: string } | null>(null);
  const [finished, setFinished] = useState<{ nextDays: number } | null>(null);
  const [sync, setSync] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const recorded = useRef(false);

  const isMyTurn = ply < line.length && full.plies[ply]!.color === myColor;

  // L'application joue les coups du camp adverse.
  useEffect(() => {
    if (finished) return;
    if (ply >= line.length) {
      if (recorded.current) return; // une seule révision enregistrée par passage
      recorded.current = true;
      const success = mistakes < 3;
      void recordOpeningReview(opening.id, success, mistakes).then((p) => setFinished({ nextDays: Math.round((p.due - Date.now()) / DAY) }));
      return;
    }
    if (!isMyTurn) {
      timer.current = window.setTimeout(() => setPly((p) => p + 1), 450);
      return () => window.clearTimeout(timer.current);
    }
  }, [ply, isMyTurn, line.length, finished, mistakes, opening.id]);

  const onMove = (from: Square, to: Square, promotion?: PromotionPiece) => {
    const expected = full.plies[ply]!;
    if (expected.from === from && expected.to === to && (expected.promotion ?? undefined) === promotion) {
      setShowArrow(false);
      setMessage({ tone: 'ok', text: `${formatSan(expected.san, expected.color, settings.notation)} — ${opening.mainLine[ply]![1]}` });
      setPly(ply + 1);
      return;
    }
    const game = ChessGame.create(full.fenAt(ply));
    const tried = game.play(from, to, promotion);
    setMistakes((m) => m + 1);
    setShowArrow(true);
    setSync((k) => k + 1);
    const triedSan = tried ? formatSan(tried.plies.at(-1)!.san, myColor, settings.notation) : '';
    setMessage({
      tone: 'bad',
      text: `${triedSan ? `${triedSan} n’est pas le coup de la ligne étudiée. ` : ''}Le coup attendu est ${formatSan(expected.san, expected.color, settings.notation)} : ${opening.mainLine[ply]![1]} Joue-le pour continuer.`,
    });
  };

  const restart = () => {
    recorded.current = false;
    setPly(0);
    setMistakes(0);
    setShowArrow(false);
    setMessage(null);
    setFinished(null);
  };

  const expected = full.plies[ply];
  const prev = full.plies[ply - 1];
  return (
    <div className="lesson-grid">
      <div className="lesson-board">
        <PlayableBoard
          fen={full.fenAt(ply)}
          orientation={opening.side}
          interactive={isMyTurn && !finished}
          lastMove={prev ? [prev.from, prev.to] : undefined}
          shapes={showArrow && expected ? [{ orig: expected.from, dest: expected.to, brush: 'green' }] : []}
          syncKey={sync}
          onMove={onMove}
        />
      </div>
      <div className="lesson-text">
        <p className="eyebrow">Entraînement · ligne principale ({Math.ceil(line.length / 2)} coups)</p>
        <h2>{finished ? 'Ligne terminée' : isMyTurn ? 'À toi de jouer' : 'L’adversaire joue…'}</h2>
        <p className="muted">Tu joues les {opening.side === 'white' ? 'Blancs' : 'Noirs'}. Coup {Math.min(ply + 1, line.length)} / {line.length} · erreurs : {mistakes}</p>
        {message && <div className={`feedback ${message.tone}`} role="status" data-testid="feedback">{message.text}</div>}
        {finished && (
          <div className="explain-box" data-testid="trainer-done">
            <p>
              {mistakes === 0 ? 'Parfait, aucune erreur !' : `${mistakes} erreur${mistakes > 1 ? 's' : ''}.`} Prochaine révision conseillée dans {finished.nextDays} jour{finished.nextDays > 1 ? 's' : ''}.
            </p>
            <button type="button" className="btn btn-primary" onClick={restart}>Recommencer</button>
          </div>
        )}
        <p className="small"><Link to={`/jouer?ouverture=${opening.id}`}>Jouer la suite de cette ouverture contre l’ordinateur →</Link></p>
      </div>
    </div>
  );
}
