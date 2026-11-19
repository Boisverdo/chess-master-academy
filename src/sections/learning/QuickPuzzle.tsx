import { useEffect, useRef, useState } from 'react';
import { PlayableBoard } from '../../board/PlayableBoard';
import type { PromotionPiece, Square } from '../../core/game';
import { PuzzleRun, type Puzzle } from '../../learning/puzzles/puzzle';

/** Exercice en un seul essai (évaluation) : la première erreur termine l'exercice. */
export function QuickPuzzle({ puzzle, onDone, locked = false }: { puzzle: Puzzle; onDone: (success: boolean) => void; locked?: boolean }) {
  const run = useRef(new PuzzleRun(puzzle));
  const [fen, setFen] = useState(run.current.game.fen);
  const [last, setLast] = useState<[string, string] | undefined>();
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => {
      run.current.start();
      const p = run.current.game.plies.at(-1)!;
      setFen(run.current.game.fen);
      setLast([p.from, p.to]);
      setReady(true);
    }, 600);
    return () => window.clearTimeout(t);
  }, []);

  const onMove = (from: Square, to: Square, promotion?: PromotionPiece) => {
    const outcome = run.current.play(`${from}${to}${promotion ?? ''}`);
    if (outcome === 'wrong' || outcome === 'illegal') {
      setSync((k) => k + 1);
      setReady(false);
      onDone(false);
      return;
    }
    const p = run.current.game.plies.at(-1)!;
    setFen(run.current.game.fen);
    setLast([p.from, p.to]);
    if (outcome === 'solved') {
      setReady(false);
      onDone(true);
    }
  };

  return (
    <div>
      <p className="muted" data-testid="quick-puzzle-prompt">
        {ready ? `Les ${run.current.player === 'w' ? 'Blancs' : 'Noirs'} jouent et gagnent. Un seul essai.` : 'Observe le coup de l’adversaire…'}
      </p>
      <PlayableBoard fen={fen} orientation={run.current.player === 'w' ? 'white' : 'black'} interactive={ready && !locked} lastMove={last} syncKey={sync} onMove={onMove} />
    </div>
  );
}
