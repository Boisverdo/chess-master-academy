import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayableBoard } from '../../board/PlayableBoard';
import type { PromotionPiece, Square } from '../../core/game';
import { HABIT_LABELS } from '../../coach/habits';
import { drillQueue, drillTags, missedPuzzles } from '../../learning/mistakes';
import { explainSolution, PuzzleRun, type Puzzle } from '../../learning/puzzles/puzzle';
import { loadPuzzles } from '../../learning/puzzles/select';
import { THEME_BY_KEY } from '../../learning/puzzles/themes';
import { db } from '../../storage/db';
import { recordAttempt } from '../../storage/repo';
import { scrollToTop } from '../../ui/scroll';
import { useData } from '../../ui/useData';
import { DrillTrainer } from '../coach/DrillTrainer';
import { useWalkthrough, WalkthroughPanel } from '../tactics/SolutionWalkthrough';

async function loadMistakes() {
  const [attempts, drills, games] = await Promise.all([db.attempts.toArray(), db.drills.toArray(), db.games.toArray()]);
  return { missed: missedPuzzles(attempts), drills, games };
}

type Session = { kind: 'puzzles'; ids: string[]; index: number } | { kind: 'drills'; ids: string[]; index: number; tag?: string };

/** Revue de mes erreurs : reprendre calmement les exercices manqués et les positions ratées dans mes parties. */
export function MistakesReview() {
  const { data } = useData(loadMistakes);
  const [tag, setTag] = useState('');
  // La liste de la séance est figée au départ : une réussite ne fait pas sauter l'exercice affiché.
  const [session, setSession] = useState<Session | null>(null);

  if (!data) return <p className="muted">Chargement…</p>;
  const tags = drillTags(data.drills);
  const queue = drillQueue(data.drills, tag || undefined);

  if (session) {
    const total = session.ids.length;
    const id = session.ids[session.index];
    const nextFn = session.index + 1 < total ? () => setSession({ ...session, index: session.index + 1 }) : undefined;
    const stop = (
      <button type="button" className="btn btn-small" onClick={() => setSession(null)} data-testid="review-back">Terminer la séance</button>
    );
    if (session.kind === 'puzzles') {
      return (
        <>
          <PuzzleReplay key={id} id={id!} position={`${session.index + 1} / ${total}`} onNext={nextFn} />
          {stop}
        </>
      );
    }
    const drill = data.drills.find((d) => d.id === id);
    return (
      <>
        {drill ? (
          <DrillTrainer key={drill.id} drill={drill} remaining={total} title={`Position ${session.index + 1} / ${total} tirée de tes parties`} source={data.games.find((g) => g.id === drill.gameId)} onNext={nextFn} />
        ) : (
          <p className="muted">Cette position a été supprimée.</p>
        )}
        {stop}
      </>
    );
  }

  return (
    <>
      <section className="panel" data-testid="review-puzzles">
        <h2 className="panel-title">Exercices tactiques manqués</h2>
        {data.missed.length ? (
          <>
            <p>
              <strong>{data.missed.length}</strong> exercice{data.missed.length > 1 ? 's' : ''} manqué{data.missed.length > 1 ? 's' : ''} (exercices tactiques et courses contre la montre). Chacun quitte la liste dès que tu le résous.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setSession({ kind: 'puzzles', ids: data.missed.map((m) => m.id), index: 0 })} data-testid="review-puzzles-start">
              Reprendre {data.missed.length > 1 ? `les ${Math.min(data.missed.length, 999)} exercices` : 'l’exercice'}
            </button>
            <p className="muted small">Ces reprises ne changent pas ta cote d’exercices : tu as déjà vu la position.</p>
          </>
        ) : (
          <p className="muted">Aucun exercice manqué en attente. Les exercices ratés dans <Link to="/tactiques">Exercices tactiques</Link> ou pendant une course contre la montre apparaîtront ici.</p>
        )}
      </section>

      <section className="panel" data-testid="review-drills">
        <h2 className="panel-title">Positions ratées dans mes parties</h2>
        {data.drills.length ? (
          <>
            <p>
              Moments critiques de tes parties analysées, où tu avais joué un coup nettement moins bon. Tu peux tous les revoir maintenant, sans attendre leur date de révision.
            </p>
            {tags.size > 0 && (
              <div className="chips" role="group" aria-label="Type d’erreur">
                <button type="button" className={`chip${tag === '' ? ' active' : ''}`} aria-pressed={tag === ''} onClick={() => setTag('')}>Toutes ({data.drills.length})</button>
                {[...tags.entries()].filter(([t]) => t in HABIT_LABELS).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                  <button key={t} type="button" className={`chip${tag === t ? ' active' : ''}`} aria-pressed={tag === t} onClick={() => setTag(t)}>{HABIT_LABELS[t]} ({n})</button>
                ))}
              </div>
            )}
            <button type="button" className="btn btn-primary" disabled={!queue.length} onClick={() => setSession({ kind: 'drills', ids: queue.map((d) => d.id), index: 0, tag })} data-testid="review-drills-start">
              Revoir {queue.length} position{queue.length > 1 ? 's' : ''}
            </button>
            <p className="muted small">Les positions jamais réussies passent en premier. Chaque résultat met à jour la répétition espacée de <Link to="/entraineur">Mon entraîneur IA</Link>.</p>
          </>
        ) : (
          <p className="muted">
            Aucune position pour l’instant. <Link to="/analyse">Analyse une partie</Link> (contre l’ordinateur, importée, Chess.com ou Lichess) en indiquant ton camp : ses moments critiques viendront ici.
          </p>
        )}
      </section>
    </>
  );
}

type Phase = 'opponent' | 'thinking' | 'solved' | 'failed';

/** Reprise d'un exercice manqué, sans pression : erreurs permises, solution à la demande. */
function PuzzleReplay({ id, position, onNext }: { id: string; position: string; onNext?: () => void }) {
  const [puzzle, setPuzzle] = useState<Puzzle | null | undefined>(undefined);
  const [run, setRun] = useState<PuzzleRun | null>(null);
  const [fen, setFen] = useState('');
  const [last, setLast] = useState<[string, string] | undefined>();
  const [phase, setPhase] = useState<Phase>('opponent');
  const [sync, setSync] = useState(0);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad' | 'info'; text: string } | null>(null);
  const failed = useRef(false);

  useEffect(() => {
    let alive = true;
    loadPuzzles().then((all) => {
      if (!alive) return;
      const p = all.find((x) => x.id === id) ?? null;
      setPuzzle(p);
      if (!p) return;
      const r = new PuzzleRun(p);
      setRun(r);
      setFen(r.game.fen);
      window.setTimeout(() => {
        if (!alive) return;
        r.start();
        const ply = r.game.plies.at(-1)!;
        setFen(r.game.fen);
        setLast([ply.from, ply.to]);
        setPhase('thinking');
      }, 600);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const record = (success: boolean) => void recordAttempt({ kind: 'puzzle-review', refId: id, themes: [], success, hints: 0, at: Date.now() });

  const onMove = (from: Square, to: Square, promotion?: PromotionPiece) => {
    if (!run || phase !== 'thinking') return;
    const outcome = run.play(`${from}${to}${promotion ?? ''}`);
    if (outcome === 'illegal' || outcome === 'wrong') {
      setSync((k) => k + 1);
      if (!failed.current) {
        failed.current = true;
        record(false);
      }
      const info = THEME_BY_KEY.get(run.puzzle.themes[0] ?? '');
      setMessage({ tone: 'bad', text: `Pas encore. ${info ? info.question : 'Cherche les échecs, les prises et les menaces.'}` });
      return;
    }
    const mine = run.game.plies[run.cursor - (outcome === 'solved' ? 1 : 2)];
    setLast(mine ? [mine.from, mine.to] : undefined);
    if (outcome === 'solved') {
      setFen(run.game.fen);
      setPhase('solved');
      setMessage({ tone: 'ok', text: failed.current ? 'Résolu, après une erreur : il reste dans ta liste pour une prochaine reprise.' : 'Résolu du premier coup : il quitte ta liste d’erreurs.' });
      if (!failed.current) record(true);
      return;
    }
    setFen(run.game.fenAt(run.game.length - 1));
    setPhase('opponent');
    setMessage({ tone: 'ok', text: 'Bon coup ! Continue…' });
    window.setTimeout(() => {
      const reply = run.game.plies.at(-1)!;
      setFen(run.game.fen);
      setLast([reply.from, reply.to]);
      setPhase('thinking');
    }, 450);
  };

  const reveal = () => {
    if (!run) return;
    if (!failed.current) {
      failed.current = true;
      record(false);
    }
    run.revealAll();
    const ply = run.game.plies.at(-1)!;
    setFen(run.game.fen);
    setLast([ply.from, ply.to]);
    setPhase('failed');
    setMessage({ tone: 'info', text: 'Voici la solution. L’exercice reste dans ta liste : tu le reverras.' });
  };

  const walk = useWalkthrough(run, phase === 'solved' || phase === 'failed');
  const facts = useMemo(() => (run && (phase === 'solved' || phase === 'failed') ? explainSolution(run) : []), [run, phase]);

  if (puzzle === null) return <p className="muted">Exercice {id} introuvable dans la base actuelle.</p>;
  if (!run) return <p className="muted">Chargement…</p>;
  const info = run.puzzle.themes.map((t) => THEME_BY_KEY.get(t)).filter(Boolean);
  const done = phase === 'solved' || phase === 'failed';
  return (
    <section className="panel" data-testid="puzzle-replay" data-puzzle-id={id} data-ready={phase === 'thinking'} data-cursor={run.cursor}>
      <h2 className="panel-title">Exercice manqué {position}</h2>
      <div className={`lesson-grid${walk ? ' walking' : ''}`}>
        <div className="lesson-board">
          <PlayableBoard fen={walk ? walk.step.fen : fen} orientation={run.player === 'w' ? 'white' : 'black'} interactive={phase === 'thinking'} shapes={walk?.step.shapes} lastMove={walk ? walk.step.lastMove : last} syncKey={sync} onMove={onMove} />
        </div>
        <div className="lesson-text">
          <p className="eyebrow">Exercice {id} · difficulté {run.puzzle.rating}</p>
          <h2>{phase === 'opponent' && run.cursor <= 1 && !last ? 'L’adversaire joue…' : `Trait aux ${run.player === 'w' ? 'Blancs' : 'Noirs'}`}</h2>
          <p className="muted">Prends ton temps : ici, pas de pendule.</p>
          {message && <div className={`feedback ${message.tone}`} role="status" data-testid="review-feedback">{message.text}</div>}
          {!done && <button type="button" className="btn btn-small" onClick={reveal} disabled={phase !== 'thinking'}>Voir la solution</button>}
          {done && (
            <div className="explain-box">
              {walk && <WalkthroughPanel key={id} walk={walk} />}
              {info.map((i) => <p key={i!.key}><strong>{i!.label} :</strong> {i!.idea}</p>)}
              {facts.map((f) => <p key={f}>{f}</p>)}
              {onNext ? <button type="button" className="btn btn-primary" onClick={() => { onNext(); scrollToTop(); }} data-testid="review-next">Exercice suivant</button> : <p className="muted">C’était le dernier exercice de la séance.</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
