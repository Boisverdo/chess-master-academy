import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayableBoard } from '../../board/PlayableBoard';
import type { PromotionPiece, Square } from '../../core/game';
import { PuzzleRun, type Puzzle } from '../../learning/puzzles/puzzle';
import { loadPuzzles } from '../../learning/puzzles/select';
import { pickRushPuzzle, RUSH_MAX_ERRORS, RUSH_MODES, rushRecords, rushStart, rushTarget, type RushMode } from '../../learning/rush';
import { db } from '../../storage/db';
import { getProfile, recordAttempt } from '../../storage/repo';
import { useData } from '../../ui/useData';

type Phase = 'menu' | 'running' | 'over';
const MODES = Object.keys(RUSH_MODES) as RushMode[];

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

async function loadRush() {
  const [profile, attempts] = await Promise.all([getProfile(), db.attempts.where('kind').equals('rush').toArray()]);
  return { rating: profile?.tactics.rating ?? 1000, records: rushRecords(attempts) };
}

/** Course contre la montre : exercices de plus en plus difficiles ; 3 erreurs ou la fin du temps arrêtent la série. */
export function RushTrainer() {
  const { data } = useData(loadRush);
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('menu');
  const [mode, setMode] = useState<RushMode>('3min');
  const [run, setRun] = useState<PuzzleRun | null>(null);
  const [fen, setFen] = useState('');
  const [last, setLast] = useState<[string, string] | undefined>();
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState(0);
  const [marks, setMarks] = useState<('ok' | 'ko')[]>([]);
  const [now, setNow] = useState(Date.now());
  const [summary, setSummary] = useState<{ score: number; errors: number; missed: string[]; record: boolean; best: number } | null>(null);
  const active = useRef<PuzzleRun | null>(null);
  const s = useRef({ solved: 0, errors: 0, missed: [] as string[], used: new Set<string>(), start: 600, startedAt: 0, endAt: null as number | null, best: 0, over: true, mode: '3min' as RushMode });

  useEffect(() => {
    loadPuzzles().then(setPuzzles, (e: unknown) => setLoadError(String(e)));
  }, []);

  const finish = () => {
    const st = s.current;
    if (st.over) return;
    st.over = true;
    active.current = null;
    setReady(false);
    setPhase('over');
    setSummary({ score: st.solved, errors: st.errors, missed: [...st.missed], record: st.solved > st.best, best: Math.max(st.best, st.solved) });
    void recordAttempt({ kind: 'rush', refId: st.mode, themes: [], success: true, hints: st.errors, at: Date.now(), ms: Date.now() - st.startedAt, score: st.solved, missed: [...st.missed] });
  };

  const next = () => {
    const st = s.current;
    if (st.over || !puzzles) return;
    const p = pickRushPuzzle(puzzles, rushTarget(st.start, st.solved), st.used);
    if (!p) return finish();
    st.used.add(p.id);
    const r = new PuzzleRun(p);
    active.current = r;
    setRun(r);
    setFen(r.game.fen);
    setLast(undefined);
    setReady(false);
    window.setTimeout(() => {
      if (active.current !== r) return;
      r.start();
      const ply = r.game.plies.at(-1)!;
      setFen(r.game.fen);
      setLast([ply.from, ply.to]);
      setReady(true);
    }, 350);
  };

  const start = (m: RushMode) => {
    if (!puzzles || !data) return;
    const seconds = RUSH_MODES[m].seconds;
    const t = Date.now();
    s.current = { solved: 0, errors: 0, missed: [], used: new Set(), start: rushStart(data.rating), startedAt: t, endAt: seconds ? t + seconds * 1000 : null, best: data.records[m].best, over: false, mode: m };
    setMode(m);
    setMarks([]);
    setSummary(null);
    setNow(t);
    setPhase('running');
    next();
  };

  // Pendule : la série s'arrête à zéro.
  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      const end = s.current.endAt;
      if (end !== null && t >= end) finish();
    }, 200);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const onMove = (from: Square, to: Square, promotion?: PromotionPiece) => {
    if (!run || !ready || active.current !== run) return;
    const st = s.current;
    const outcome = run.play(`${from}${to}${promotion ?? ''}`);
    if (outcome === 'illegal') return setSync((k) => k + 1);
    if (outcome === 'wrong') {
      st.errors++;
      st.missed.push(run.puzzle.id);
      setMarks((m) => [...m, 'ko']);
      setSync((k) => k + 1);
      if (st.errors >= RUSH_MAX_ERRORS) return finish();
      return next();
    }
    const mine = run.game.plies[run.cursor - (outcome === 'solved' ? 1 : 2)];
    setLast(mine ? [mine.from, mine.to] : undefined);
    setReady(false);
    if (outcome === 'solved') {
      st.solved++;
      setFen(run.game.fen);
      setMarks((m) => [...m, 'ok']);
      window.setTimeout(() => active.current === run && next(), 250);
      return;
    }
    // Bon coup : la réponse adverse suit.
    setFen(run.game.fenAt(run.game.length - 1));
    window.setTimeout(() => {
      if (active.current !== run) return;
      const reply = run.game.plies.at(-1)!;
      setFen(run.game.fen);
      setLast([reply.from, reply.to]);
      setReady(true);
    }, 250);
  };

  if (loadError) return <p className="error">Impossible de charger les exercices : {loadError}</p>;
  if (!puzzles || !data) return <p className="muted">Chargement des exercices…</p>;

  if (phase === 'running' && run) {
    const st = s.current;
    const remaining = st.endAt !== null ? st.endAt - now : null;
    return (
      <div className="lesson-grid rush" data-testid="rush-run" data-ready={ready} data-cursor={run.cursor} data-puzzle-id={run.puzzle.id}>
        <div className="lesson-board">
          <PlayableBoard fen={fen} orientation={run.player === 'w' ? 'white' : 'black'} interactive={ready} lastMove={last} syncKey={sync} onMove={onMove} />
        </div>
        <div className="lesson-text">
          <div className="rush-bar" role="status">
            <span className={`rush-clock${remaining !== null && remaining < 30_000 ? ' low' : ''}`} data-testid="rush-timer">{remaining !== null ? clock(remaining) : clock(now - st.startedAt)}</span>
            <span>Score : <strong data-testid="rush-score">{st.solved}</strong></span>
            <span aria-label={`${st.errors} erreur${st.errors > 1 ? 's' : ''} sur ${RUSH_MAX_ERRORS}`} data-testid="rush-errors">
              {Array.from({ length: RUSH_MAX_ERRORS }, (_, i) => <span key={i} className={`rush-life${i < st.errors ? ' lost' : ''}`} aria-hidden="true">●</span>)}
            </span>
          </div>
          <h2>{ready ? `Trait aux ${run.player === 'w' ? 'Blancs' : 'Noirs'} : trouve le meilleur coup` : 'L’adversaire joue…'}</h2>
          <p className="muted small">{RUSH_MODES[mode].label} · difficulté {run.puzzle.rating} · exercice {run.puzzle.id}</p>
          <div className="rush-marks" aria-hidden="true">
            {marks.map((m, i) => <span key={i} className={`rush-mark ${m}`}>{m === 'ok' ? '✓' : '✗'}</span>)}
          </div>
          <button type="button" className="btn btn-small" onClick={finish} data-testid="rush-stop">Arrêter la série</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {phase === 'over' && summary && (
        <section className="panel rush-over" data-testid="rush-over">
          <h2 className="panel-title">Série terminée — {RUSH_MODES[mode].label}</h2>
          <p className="rush-final">
            <strong data-testid="rush-final-score">{summary.score}</strong> exercice{summary.score > 1 ? 's' : ''} résolu{summary.score > 1 ? 's' : ''}
            {summary.record && summary.score > 0 ? <span className="badge badge-due"> Nouveau record !</span> : <span className="muted"> · record : {summary.best}</span>}
          </p>
          {summary.missed.length > 0 ? (
            <p>
              {summary.missed.length} exercice{summary.missed.length > 1 ? 's' : ''} manqué{summary.missed.length > 1 ? 's' : ''} : tu pourras les reprendre calmement dans <Link to="/entrainement?mode=erreurs">Revue de mes erreurs</Link>.
            </p>
          ) : (
            <p>Aucune erreur pendant cette série.</p>
          )}
          <button type="button" className="btn btn-primary" onClick={() => start(mode)} data-testid="rush-again">Recommencer</button>
        </section>
      )}
      <section className="panel">
        <h2 className="panel-title">Choisis ta course</h2>
        <p>
          Des exercices tactiques de plus en plus difficiles, à résoudre vite. Un mauvais coup compte comme une erreur et passe à l’exercice suivant ; à la {RUSH_MAX_ERRORS}e erreur, la série s’arrête.
        </p>
        <div className="card-grid">
          {MODES.map((m) => {
            const r = data.records[m];
            return (
              <div key={m} className="card">
                <span className="card-title">{RUSH_MODES[m].label}</span>
                <span className="small">{RUSH_MODES[m].detail}</span>
                <span className="muted small" data-testid={`rush-best-${m}`}>{r.runs ? `Record : ${r.best} · ${r.runs} série${r.runs > 1 ? 's' : ''}` : 'Pas encore de série'}</span>
                <button type="button" className="btn btn-primary btn-small" onClick={() => start(m)} data-testid={`rush-start-${m}`}>Commencer</button>
              </div>
            );
          })}
        </div>
        <p className="muted small">
          La difficulté démarre sous ta cote d’exercices ({data.rating}, estimation interne) puis monte à chaque réussite. Ces séries ne modifient pas ta cote : sous la pression du temps, elles mesurent ta vitesse, pas ta compréhension.
        </p>
      </section>
    </>
  );
}
