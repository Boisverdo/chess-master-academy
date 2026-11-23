import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlayableBoard } from '../../board/PlayableBoard';
import type { PromotionPiece, Square } from '../../core/game';
import { explainSolution, PuzzleRun, type Puzzle } from '../../learning/puzzles/puzzle';
import { loadPuzzles, selectPuzzle } from '../../learning/puzzles/select';
import { THEME_BY_KEY, THEMES, themeLabel } from '../../learning/puzzles/themes';
import { db } from '../../storage/db';
import { themeStats, weakThemes } from '../../storage/learning';
import { getProfile, recordPuzzle } from '../../storage/repo';
import { useData } from '../../ui/useData';
import { useWalkthrough, WalkthroughPanel } from './SolutionWalkthrough';

type Phase = 'thinking' | 'opponent' | 'solved' | 'failed';

async function loadContext() {
  const [profile, attempts] = await Promise.all([getProfile(), db.attempts.where('kind').equals('puzzle').toArray()]);
  const stats = themeStats(attempts);
  return { profile, attempts, stats, weak: weakThemes(stats).map((s) => s.theme) };
}

export function TacticsPage() {
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const [theme, setTheme] = useState<string>(() => (THEME_BY_KEY.has(params.get('theme') ?? '') ? params.get('theme')! : ''));
  const { data: ctx } = useData(loadContext);
  const [run, setRun] = useState<PuzzleRun | null>(null);
  const [fen, setFen] = useState('');
  const [last, setLast] = useState<[string, string] | undefined>();
  const [phase, setPhase] = useState<Phase>('thinking');
  const [hints, setHints] = useState(0);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad' | 'info'; text: string } | null>(null);
  const [sync, setSync] = useState(0);
  const [result, setResult] = useState<{ rating?: number; before?: number } | null>(null);
  const failed = useRef(false);
  const started = useRef(Date.now());
  const seenThisSession = useRef(new Set<string>());
  const activeRun = useRef<PuzzleRun | null>(null);

  useEffect(() => {
    loadPuzzles().then(setPuzzles, (e: unknown) => setLoadError(String(e)));
  }, []);

  const rating = ctx?.profile?.tactics.rating ?? 1000;
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const nextPuzzle = useCallback(() => {
    const ctx = ctxRef.current;
    if (!puzzles || !ctx) return;
    const seen = new Set([...ctx.attempts.slice(-500).map((a) => a.refId), ...seenThisSession.current]);
    const p = selectPuzzle(puzzles, { rating, theme: theme || undefined, weakThemes: ctx.weak, seen });
    if (!p) return;
    seenThisSession.current.add(p.id);
    const r = new PuzzleRun(p);
    activeRun.current = r;
    setRun(r);
    setFen(r.game.fen);
    setLast(undefined);
    setPhase('opponent');
    setHints(0);
    setResult(null);
    setMessage(null);
    failed.current = false;
    // Laisse voir la position, puis joue le coup adverse de départ.
    window.setTimeout(() => {
      if (activeRun.current !== r) return; // un autre exercice a été choisi entre-temps
      r.start();
      const ply = r.game.plies.at(-1)!;
      setFen(r.game.fen);
      setLast([ply.from, ply.to]);
      setPhase('thinking');
      started.current = Date.now();
    }, 700);
  }, [puzzles, theme, rating]);

  useEffect(() => {
    if (puzzles && ctx && !run) nextPuzzle();
  }, [puzzles, ctx, run, nextPuzzle]);

  const finish = async (success: boolean) => {
    if (!run) return;
    const before = ctx?.profile?.tactics.rating;
    const after = await recordPuzzle({ id: run.puzzle.id, rating: run.puzzle.rating, themes: run.puzzle.themes }, success, hints, Date.now() - started.current);
    setResult({ rating: after, before });
  };

  const onMove = (from: Square, to: Square, promotion?: PromotionPiece) => {
    if (!run || phase !== 'thinking') return;
    const uci = `${from}${to}${promotion ?? ''}`;
    const outcome = run.play(uci);
    if (outcome === 'illegal' || outcome === 'wrong') {
      setSync((k) => k + 1);
      if (!failed.current) {
        failed.current = true;
        void finish(false);
      }
      const info = THEME_BY_KEY.get(run.puzzle.themes[0] ?? '');
      setMessage({ tone: 'bad', text: `Ce n’est pas la solution. ${info ? info.question : 'Cherche les échecs, les prises et les menaces.'} Tu peux réessayer ou voir la solution.` });
      return;
    }
    const plies = run.game.plies;
    const mine = plies[run.cursor - (outcome === 'solved' ? 1 : 2)];
    if (outcome === 'solved') {
      setFen(run.game.fen);
      setLast(mine ? [mine.from, mine.to] : undefined);
      setPhase('solved');
      setMessage({ tone: 'ok', text: failed.current ? 'Résolu, après une erreur.' : hints ? 'Résolu avec indices. Bravo !' : 'Bravo, exercice résolu !' });
      if (!failed.current) void finish(true);
      return;
    }
    // Bon coup, l'adversaire répond.
    setFen(fenAfterPlayerMove(run));
    setLast(mine ? [mine.from, mine.to] : undefined);
    setPhase('opponent');
    setMessage({ tone: 'ok', text: 'Bon coup ! Continue…' });
    window.setTimeout(() => {
      if (activeRun.current !== run) return;
      const reply = run.game.plies.at(-1)!;
      setFen(run.game.fen);
      setLast([reply.from, reply.to]);
      setPhase('thinking');
    }, 500);
  };

  const reveal = () => {
    if (!run) return;
    if (!failed.current) {
      failed.current = true;
      void finish(false);
    }
    run.revealAll();
    const ply = run.game.plies.at(-1)!;
    setFen(run.game.fen);
    setLast([ply.from, ply.to]);
    setPhase('failed');
    setMessage({ tone: 'info', text: 'Voici la solution complète. Suis-la coup par coup avec l’entraîneur, puis rejoue-la dans ta tête : c’est ainsi que le motif se mémorise.' });
  };

  const walk = useWalkthrough(run, phase === 'solved' || phase === 'failed');

  const hintShapes = useMemo(() => {
    if (!run || phase !== 'thinking') return [];
    const exp = run.expected();
    if (!exp) return [];
    if (hints >= 3) return [{ orig: exp.slice(0, 2), dest: exp.slice(2, 4), brush: 'green' }];
    if (hints >= 2) return [{ orig: exp.slice(0, 2), brush: 'green' }];
    return [];
  }, [run, phase, hints]);

  if (loadError) return <div className="page"><h1>Exercices tactiques</h1><p className="error">Impossible de charger les exercices : {loadError}</p></div>;
  if (!puzzles || !ctx) return <div className="page"><h1>Exercices tactiques</h1><p className="muted">Chargement des exercices…</p></div>;

  const info = run ? run.puzzle.themes.map((t) => THEME_BY_KEY.get(t)).filter(Boolean) : [];
  const playerName = run?.player === 'w' ? 'Blancs' : 'Noirs';
  const isMate = run?.puzzle.themes.find((t) => t.startsWith('mat-en-'));

  return (
    <div className="page page-wide tactics-page">
      <div className="tactics-head">
        <h1>Exercices tactiques</h1>
        <div className="rating-chip" title="Cote interne calculée sur tes exercices. Ce n’est pas un classement Elo officiel.">
          Cote d’exercices : <strong data-testid="tactic-rating">{rating}</strong> <span className="muted small">(estimation)</span>
        </div>
      </div>
      {!ctx.profile && (
        <p className="notice">
          Astuce : passe l’<Link to="/evaluation">évaluation initiale</Link> pour que la difficulté démarre à ton niveau et que ta cote soit suivie.
        </p>
      )}
      <div className="theme-picker">
        <label htmlFor="theme-select">Type d’exercices</label>
        <select
          id="theme-select"
          data-testid="theme-select"
          value={theme}
          onChange={(e) => {
            setTheme(e.target.value);
            setRun(null);
          }}
        >
          <option value="">Entraînement adapté (tous les thèmes)</option>
          <optgroup label="Motifs tactiques">
            {THEMES.filter((t) => !t.key.startsWith('mat-en-')).map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </optgroup>
          <optgroup label="Mats">
            {THEMES.filter((t) => t.key.startsWith('mat-en-')).map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {run && (
        <div className={`lesson-grid${walk ? ' walking' : ''}`}>
          <div className="lesson-board">
            <PlayableBoard fen={walk ? walk.step.fen : fen} orientation={run.player === 'w' ? 'white' : 'black'} interactive={phase === 'thinking'} shapes={walk ? walk.step.shapes : hintShapes} lastMove={walk ? walk.step.lastMove : last} syncKey={sync} onMove={onMove} />
          </div>
          <div className="lesson-text">
            <p className="eyebrow">
              Exercice {run.puzzle.id} · difficulté {run.puzzle.rating}
            </p>
            <h2 data-testid="puzzle-prompt">
              {phase === 'opponent' && run.cursor === 0 ? 'L’adversaire joue…' : `Les ${playerName} jouent ${isMate ? `et font ${themeLabel(isMate).toLowerCase()}` : 'et gagnent'}`}
            </h2>
            {message && <div className={`feedback ${message.tone}`} role="status" data-testid="feedback">{message.text}</div>}

            {phase === 'thinking' && (
              <div className="hint-box">
                {hints === 0 && <p className="muted">Prends le temps de regarder : quelles pièces sont attaquées ? Quels échecs as-tu ?</p>}
                {hints >= 1 && info[0] && (
                  <p>
                    <strong>Indice 1 — Motif : {info.map((i) => i!.label).join(', ')}.</strong> {info[0].idea} <em>{info[0].question}</em>
                  </p>
                )}
                {hints >= 2 && <p><strong>Indice 2 :</strong> la pièce à jouer est surlignée.</p>}
                {hints >= 3 && <p><strong>Indice 3 :</strong> la flèche montre le coup.</p>}
                <div className="row">
                  {hints < 3 && (
                    <button type="button" className="btn btn-small" onClick={() => setHints((h) => h + 1)} data-testid="hint">
                      {hints === 0 ? 'Indice' : 'Indice suivant'}
                    </button>
                  )}
                  <button type="button" className="btn btn-small" onClick={reveal}>Voir la solution</button>
                </div>
              </div>
            )}

            {(phase === 'solved' || phase === 'failed') && (
              <div className="explain-box" data-testid="explanation">
                {walk && <WalkthroughPanel key={run.puzzle.id} walk={walk} />}
                {info.map((i) => (
                  <p key={i!.key}><strong>{i!.label} :</strong> {i!.idea}</p>
                ))}
                {explainSolution(run).map((f) => (
                  <p key={f}>{f}</p>
                ))}
                {result?.rating !== undefined && result.before !== undefined && (
                  <p className="muted">
                    Cote d’exercices : {result.before} → <strong>{result.rating}</strong>
                  </p>
                )}
                <button type="button" className="btn btn-primary" onClick={nextPuzzle} data-testid="next-puzzle">Exercice suivant</button>
              </div>
            )}
          </div>
        </div>
      )}

      <ThemeStatsPanel stats={ctx.stats} />
      <p className="muted small">Positions : base de puzzles Lichess, domaine public (CC0). Les solutions ont été vérifiées par le moteur de Lichess et revérifiées par Chess Master Academy.</p>
    </div>
  );
}

/** Position juste après le coup du joueur (avant la réponse adverse), pour l'animation. */
function fenAfterPlayerMove(run: PuzzleRun): string {
  return run.game.fenAt(run.game.length - 1);
}

function ThemeStatsPanel({ stats }: { stats: ReturnType<typeof themeStats> }) {
  if (!stats.length) return null;
  return (
    <section className="panel">
      <h2 className="panel-title">Tes résultats par thème (30 derniers essais, sans indice)</h2>
      <ul className="stat-list">
        {stats.map((s) => (
          <li key={s.theme}>
            <span>{themeLabel(s.theme)}</span>
            <span className="bar" aria-hidden="true"><span style={{ width: `${Math.round(s.rate * 100)}%` }} /></span>
            <span className="muted small">{Math.round(s.rate * 100)} % · {s.attempts} essai{s.attempts > 1 ? 's' : ''}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
