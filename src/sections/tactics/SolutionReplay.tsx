import { useMemo } from 'react';
import { PlayableBoard } from '../../board/PlayableBoard';
import { PuzzleRun, type Puzzle } from '../../learning/puzzles/puzzle';
import { useWalkthrough, WalkthroughPanel } from './SolutionWalkthrough';

/** Solution expliquée d'un exercice qu'on ne rejoue pas (ex. défi du jour manqué) : démarre sur la position de départ. */
export function SolutionReplay({ puzzle }: { puzzle: Puzzle }) {
  const run = useMemo(() => {
    const r = new PuzzleRun(puzzle);
    r.start();
    r.revealAll();
    return r;
  }, [puzzle]);
  const walk = useWalkthrough(run, true, 'start');
  if (!walk) return null;
  return (
    <div className="daily-solution" data-testid="daily-solution">
      <div className="lesson-board">
        <PlayableBoard fen={walk.step.fen} orientation={run.player === 'w' ? 'white' : 'black'} shapes={walk.step.shapes} lastMove={walk.step.lastMove} ariaLabel="Échiquier de la solution" />
      </div>
      <WalkthroughPanel walk={walk} />
    </div>
  );
}
