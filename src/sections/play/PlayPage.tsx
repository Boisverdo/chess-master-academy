import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { findOpening, OPENINGS } from '../../learning/openings';
import { PlayableBoard } from '../../board/PlayableBoard';
import { ChessGame, START_FEN, type Color, type PromotionPiece, type Square } from '../../core/game';
import { formatSan } from '../../core/notation';
import { exportPgn } from '../../core/pgn';
import { evaluatePosition } from '../../analysis/runner';
import { judgeMove } from '../../coach/retry';
import { getEngine } from '../../engine/browser';
import { chooseMove, levelById, LEVELS, type LevelId } from '../../engine/levels';
import { saveGameRecord } from '../../storage/repo';
import { useSettings } from '../../ui/settings';
import { MoveList } from '../board/MoveList';
import { describeStatus } from '../board/gameText';

type Commentary = 'off' | 'each' | 'end';
interface Setup {
  color: Color | 'random';
  level: LevelId;
  time: { base: number; inc: number } | null;
  commentary: Commentary;
  training: boolean;
  /** Partie commencée après la ligne principale d'une ouverture de la bibliothèque. */
  opening?: string;
}

const TIMES: { label: string; value: Setup['time'] }[] = [
  { label: 'Sans limite', value: null },
  { label: '5 min', value: { base: 5, inc: 0 } },
  { label: '10 min', value: { base: 10, inc: 0 } },
  { label: '15 min + 10 s', value: { base: 15, inc: 10 } },
];

const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function PlayPage() {
  const [params] = useSearchParams();
  const preset = findOpening(params.get('ouverture') ?? '');
  const [setup, setSetup] = useState<Setup>({ color: preset?.side === 'black' ? 'b' : 'w', level: 2, time: null, commentary: 'each', training: true, opening: preset?.id });
  const [running, setRunning] = useState<{ setup: Setup; userColor: Color } | null>(null);

  if (!running) {
    return (
      <div className="page">
        <h1>Jouer contre l’ordinateur</h1>
        <p className="lead">L’ordinateur utilise le moteur Stockfish, réglé selon le niveau choisi. Il ne joue que des coups légaux.</p>
        <section className="panel setup">
          <h2 className="panel-title">Position de départ</h2>
          <label className="field">
            <select aria-label="Position de départ" value={setup.opening ?? ''} onChange={(e) => { const o = findOpening(e.target.value); setSetup({ ...setup, opening: o?.id, color: o ? (o.side === 'white' ? 'w' : 'b') : setup.color }); }} data-testid="opening-select">
              <option value="">Position initiale</option>
              {OPENINGS.map((o) => <option key={o.id} value={o.id}>Après la ligne principale : {o.name} ({o.side === 'white' ? 'avec les Blancs' : 'avec les Noirs'})</option>)}
            </select>
          </label>
          <h2 className="panel-title">Ton camp</h2>
          <div className="chips">
            {([['w', 'Blancs'], ['b', 'Noirs'], ['random', 'Au hasard']] as const).map(([v, l]) => (
              <button key={v} type="button" disabled={!!setup.opening} className={`chip${setup.color === v ? ' active' : ''}`} aria-pressed={setup.color === v} onClick={() => setSetup({ ...setup, color: v })}>{l}</button>
            ))}
          </div>
          {setup.opening && <p className="muted small">Tu joues le camp étudié dans cette ouverture ; la partie reprend après sa ligne principale.</p>}
          <h2 className="panel-title">Niveau</h2>
          <div className="level-grid">
            {LEVELS.map((l) => (
              <button key={l.id} type="button" className={`choice${setup.level === l.id ? ' selected' : ''}`} aria-pressed={setup.level === l.id} onClick={() => setSetup({ ...setup, level: l.id })}>
                <strong>{l.id}. {l.name}</strong>
                <span className="muted small">{l.description}</span>
              </button>
            ))}
          </div>
          <h2 className="panel-title">Cadence</h2>
          <div className="chips">
            {TIMES.map((t) => (
              <button key={t.label} type="button" className={`chip${JSON.stringify(setup.time) === JSON.stringify(t.value) ? ' active' : ''}`} onClick={() => setSetup({ ...setup, time: t.value })}>{t.label}</button>
            ))}
          </div>
          <h2 className="panel-title">Commentaires de l’entraîneur</h2>
          <div className="chips">
            {([['each', 'Après chacun de mes coups'], ['end', 'À la fin de la partie'], ['off', 'Aucun']] as const).map(([v, l]) => (
              <button key={v} type="button" className={`chip${setup.commentary === v ? ' active' : ''}`} onClick={() => setSetup({ ...setup, commentary: v })}>{l}</button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={setup.training} onChange={(e) => setSetup({ ...setup, training: e.target.checked })} />
            <span>Partie d’entraînement : annulation de coup et indices autorisés</span>
          </label>
          <button
            type="button"
            className="btn btn-primary btn-large"
            data-testid="start-game"
            onClick={() => setRunning({ setup, userColor: setup.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : setup.color })}
          >
            Commencer la partie
          </button>
        </section>
      </div>
    );
  }
  return <AiGame key={JSON.stringify(running) + Date.now()} setup={running.setup} userColor={running.userColor} onExit={() => setRunning(null)} onRematch={() => setRunning({ ...running })} />;
}

function AiGame({ setup, userColor, onExit, onRematch }: { setup: Setup; userColor: Color; onExit: () => void; onRematch: () => void }) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const level = levelById(setup.level);
  const opening = findOpening(setup.opening ?? '');
  const openingPlies = opening?.mainLine.length ?? 0;
  const [game, setGame] = useState(() => {
    const headers = {
      Event: opening ? `Entraînement : ${opening.name}` : 'Partie contre l’ordinateur',
      White: userColor === 'w' ? 'Moi' : `Ordinateur (niveau ${level.id} – ${level.name})`,
      Black: userColor === 'b' ? 'Moi' : `Ordinateur (niveau ${level.id} – ${level.name})`,
    };
    // Les coups de l'ouverture font partie de la partie : l'analyse les reconnaîtra comme « théorie ».
    return opening ? ChessGame.fromSan(opening.mainLine.map(([san]) => san)).withHeaders(headers) : ChessGame.create(START_FEN, headers);
  });
  const [thinking, setThinking] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [coach, setCoach] = useState<{ tone: 'ok' | 'bad' | 'info'; text: string } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [hints, setHints] = useState(0);
  const [takebacks, setTakebacks] = useState(0);
  const [clocks, setClocks] = useState(() => (setup.time ? { w: setup.time.base * 60000, b: setup.time.base * 60000 } : null));
  const [savedId, setSavedId] = useState<number | null>(null);
  const [sync, setSync] = useState(0);
  const generation = useRef(0);
  const status = game.status();
  const aiColor: Color = userColor === 'w' ? 'b' : 'w';
  const userTurn = game.turn === userColor && !status.over;

  // Pendule : décompte du camp au trait.
  useEffect(() => {
    if (!clocks || status.over) return;
    let last = performance.now();
    const t = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      setClocks((c) => (c ? { ...c, [game.turn]: c[game.turn] - dt } : c));
    }, 100);
    return () => window.clearInterval(t);
  }, [game, status.over, clocks === null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (clocks && !status.over && clocks[game.turn] <= 0) {
      generation.current++; // un coup de l'ordinateur encore en calcul est abandonné
      setThinking(false);
      setGame((g) => g.timeout(g.turn));
    }
  }, [clocks, game.turn, status.over]);

  const addIncrement = useCallback((color: Color) => {
    if (setup.time?.inc) setClocks((c) => (c ? { ...c, [color]: c[color] + setup.time!.inc * 1000 } : c));
  }, [setup.time]);

  // Coup de l'ordinateur.
  useEffect(() => {
    if (status.over || game.turn !== aiColor) return;
    const gen = ++generation.current;
    setThinking(true);
    const started = performance.now();
    (async () => {
      try {
        const engine = await getEngine();
        if (gen === generation.current && game.length === openingPlies) await engine.newGame();
        const r = await engine.search(game.fen, level.search);
        let uci = chooseMove(r.lines, level) ?? r.bestmove;
        let next = uci ? game.playUci(uci) : null;
        if (!next) {
          // Sécurité : ne jamais jouer un coup illégal. On prend le meilleur coup du moteur, sinon un coup légal.
          uci = r.bestmove;
          next = uci ? game.playUci(uci) : null;
          if (!next) throw new Error('aucun coup légal reçu du moteur');
        }
        const wait = Math.max(0, 350 - (performance.now() - started));
        await new Promise((res) => setTimeout(res, wait));
        if (gen !== generation.current) return;
        setGame(next);
        addIncrement(aiColor);
      } catch (e) {
        if (gen === generation.current) setEngineError(e instanceof Error ? e.message : String(e));
      } finally {
        if (gen === generation.current) setThinking(false);
      }
    })();
  }, [game, aiColor, level, status.over, addIncrement]);

  // Enregistrement automatique en fin de partie.
  useEffect(() => {
    if (!status.over || savedId !== null || game.length <= openingPlies) return;
    const pgn = exportPgn(game);
    void saveGameRecord({
      source: 'ia',
      createdAt: Date.now(),
      pgn,
      white: game.headers['White'] ?? '',
      black: game.headers['Black'] ?? '',
      result: status.result,
      userColor,
      level: level.id,
    }).then(setSavedId);
  }, [status.over, savedId, game, status.result, userColor, level.id]);

  const onMove = async (from: Square, to: Square, promotion?: PromotionPiece) => {
    if (!userTurn || thinking) return;
    const before = game;
    const next = game.play(from, to, promotion);
    if (!next) {
      setSync((k) => k + 1);
      return;
    }
    setHint(null);
    addIncrement(userColor);
    if (setup.commentary === 'each' && !next.status().over) {
      setCoach({ tone: 'info', text: 'L’entraîneur regarde ton coup…' });
      setGame(next); // l'IA attend la fin du commentaire grâce à la file du moteur
      try {
        const engine = await getEngine();
        const evalBefore = await evaluatePosition(engine, before.fen, { depth: 10 });
        const v = await judgeMove(engine, evalBefore, `${from}${to}${promotion ?? ''}`, (s, c) => formatSan(s, c, settings.notation), 10);
        if (v) setCoach(v.ok ? { tone: 'ok', text: v.explanation.verdict } : { tone: 'bad', text: [v.explanation.verdict, ...v.explanation.sentences].join(' ') });
      } catch {
        setCoach(null);
      }
      return;
    }
    setCoach(null);
    setGame(next);
  };

  /** Dernier coup du joueur après l'ouverture imposée (annuler revient juste avant lui). */
  const lastUserPly = [...game.plies].reverse().find((p) => p.color === userColor && p.ply > openingPlies);

  const takeback = () => {
    if (!setup.training || thinking || !lastUserPly) return;
    generation.current++;
    setGame(game.truncate(lastUserPly.ply - 1));
    setTakebacks((t) => t + 1);
    setCoach(null);
    setHint(null);
  };

  const showHint = async () => {
    if (!setup.training || !userTurn) return;
    try {
      const engine = await getEngine();
      const r = await engine.search(game.fen, { depth: 12 });
      setHint(r.bestmove);
      setHints((h) => h + 1);
    } catch (e) {
      setEngineError(e instanceof Error ? e.message : String(e));
    }
  };

  const last = game.plies.at(-1);
  const shapes = useMemo(() => (hint ? [{ orig: hint.slice(0, 2), dest: hint.slice(2, 4), brush: 'blue' }] : []), [hint]);
  const clockBox = (c: Color) =>
    clocks ? (
      <div className={`clock${game.turn === c && !status.over ? ' running' : ''}${clocks[c] < 20000 ? ' low' : ''}`} data-testid={`clock-${c}`}>
        {c === userColor ? 'Toi' : `Ordinateur (${level.name})`} · {fmtClock(clocks[c])}
      </div>
    ) : (
      <div className="clock">{c === userColor ? 'Toi' : `Ordinateur (${level.name})`}</div>
    );

  return (
    <div className="page page-wide">
      <h1>Partie contre l’ordinateur</h1>
      <div className="board-page play-page">
        <div className="board-column">
          {clockBox(aiColor)}
          <PlayableBoard fen={game.fen} orientation={userColor === 'w' ? 'white' : 'black'} interactive={userTurn && !thinking} lastMove={last ? [last.from, last.to] : undefined} shapes={shapes} syncKey={sync} onMove={onMove} />
          {clockBox(userColor)}
        </div>
        <aside className="side-panel">
          <div className={`status-card${status.over ? ' over' : ''}`} role="status" data-testid="status">
            {status.over ? describeStatus(status) : thinking ? 'L’ordinateur réfléchit…' : userTurn ? 'À toi de jouer' : describeStatus(status)}
          </div>
          {engineError && <p className="error" role="alert">{engineError}</p>}
          {coach && <div className={`feedback ${coach.tone}`} data-testid="coach">{coach.text}</div>}
          <section className="panel">
            <h2 className="panel-title">Coups joués</h2>
            <MoveList plies={game.plies} startsWithBlack={false} firstMoveNumber={1} currentPly={game.length} notation={settings.notation} onSelect={() => undefined} />
          </section>
          <section className="panel actions">
            {setup.training && !status.over && (
              <>
                <button type="button" className="btn" onClick={takeback} disabled={thinking || !lastUserPly} data-testid="takeback">Annuler mon coup</button>
                <button type="button" className="btn" onClick={showHint} disabled={!userTurn || thinking}>Indice</button>
              </>
            )}
            {!status.over && (
              <button type="button" className="btn" onClick={() => { generation.current++; setThinking(false); setGame(game.resign(userColor)); }}>Abandonner</button>
            )}
            {status.over && (
              <>
                <button type="button" className="btn btn-primary" disabled={savedId === null} onClick={() => navigate(`/analyse/${savedId}?auto=1`)} data-testid="analyse-game">Analyser la partie</button>
                <button type="button" className="btn" onClick={onRematch}>Revanche</button>
              </>
            )}
            <button type="button" className="btn" onClick={onExit}>Nouvelle partie</button>
          </section>
          {setup.training && (takebacks > 0 || hints > 0) && (
            <p className="muted small">Partie d’entraînement : {takebacks} annulation{takebacks > 1 ? 's' : ''}, {hints} indice{hints > 1 ? 's' : ''}.</p>
          )}
          {status.over && setup.commentary !== 'off' && <p className="muted small">L’analyse détaillée de la partie t’attend : chaque coup expliqué, moments critiques, « Comprendre mon erreur ».</p>}
        </aside>
      </div>
    </div>
  );
}

