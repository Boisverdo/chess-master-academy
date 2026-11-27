import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlayableBoard } from '../../board/PlayableBoard';
import { ChessGame, type PromotionPiece, type Square } from '../../core/game';
import { formatSan } from '../../core/notation';
import { checkMove, solutions } from '../../learning/lessons/check';
import { isExercise, type ChoiceStep, type DemoStep, type Lesson, type MoveStep, type PlayStep, type SquareStep } from '../../learning/lessons/types';
import { judgePlay } from '../../learning/lessons/playGoal';
import { getEngine } from '../../engine/browser';
import { needsReview, reviewTarget } from '../../learning/recommend';
import { recordAttempt, saveLessonProgress } from '../../storage/repo';
import { RichText } from '../../ui/RichText';
import { useSettings } from '../../ui/settings';
import { speak, speechOk, stopSpeaking } from '../../ui/voice';
import { demoLineSteps, lineSteps, type WalkStep } from '../../learning/puzzles/walkthrough';
import { useWalkSteps, WalkthroughPanel } from '../tactics/SolutionWalkthrough';

type Feedback = { tone: 'ok' | 'bad' | 'info'; text: string } | null;

export interface ExerciseState {
  solved: boolean;
  firstTry: boolean;
  tries: number;
  hint: boolean;
  /** Deuxième indice : nombre de demandes « montre la pièce à jouer » (chaque demande vaut pour la position du moment). */
  pieceHint: number;
  revealed: boolean;
}

export const freshState = (): ExerciseState => ({ solved: false, firstTry: true, tries: 0, hint: false, pieceHint: 0, revealed: false });

const NO_STEPS: WalkStep[] = [];

/** Texte de l'entraîneur pour une étape (lu à voix haute quand la voix est activée). */
function stepSpeech(step: Lesson['steps'][number]): string {
  const title = 'title' in step && step.title ? `${step.title}. ` : '';
  switch (step.kind) {
    case 'explain':
    case 'demo':
      return title + step.text;
    case 'choice':
      return `${title}${step.prompt} ${step.options.map((o) => o.label).join(' ; ')}.`;
    default:
      return title + step.prompt;
  }
}

function choiceIntro(fen: string): string {
  const side = ChessGame.create(fen).turn === 'w' ? 'Blancs' : 'Noirs';
  return `Voici comment la partie peut se dérouler, avec le meilleur jeu des deux camps (vérifié par Stockfish). Les ${side} ont le trait. Les coups des ${side} sont en vert, les réponses en bleu.`;
}

function solutionIntro(step: PlayStep): string {
  const side = ChessGame.create(step.fen).turn === 'w' ? 'Blancs' : 'Noirs';
  const goal = step.goal === 'mate' ? `mater le roi adverse en ${step.maxMoves} coups au plus` : step.goal === 'promote' ? 'mener ton pion à dame' : 'tenir la nulle';
  return `Voici une façon de réussir. Tu joues les ${side} ; objectif : ${goal}. L’ordinateur peut répondre autrement : retiens surtout l’idée de chaque coup.`;
}

export function LessonPlayer({ lesson, startStep = 0, startCorrect = 0, next }: { lesson: Lesson; startStep?: number; startCorrect?: number; next?: Lesson }) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(Math.min(startStep, lesson.steps.length - 1));
  const [state, setState] = useState<ExerciseState>(freshState);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [done, setDone] = useState(false);
  const results = useRef(new Map<number, boolean>());
  // Exercices réussis du premier coup avant une reprise (étapes antérieures à startStep, déjà enregistrées).
  const priorCorrect = useRef(startCorrect);
  const correctCount = () => priorCorrect.current + [...results.current.values()].filter(Boolean).length;
  const startedAt = useRef(Date.now());

  const [attempt, setAttempt] = useState(0);
  const { settings, update } = useSettings();
  const voice = settings.coachVoice && speechOk();

  const step = lesson.steps[index]!;
  const exercises = lesson.steps.filter(isExercise).length;
  const canContinue = !isExercise(step) || state.solved;
  const solutionLine = (step.kind === 'play' || step.kind === 'choice') && state.revealed && step.solution ? step : null;
  const walkSteps = useMemo(() => {
    if (!solutionLine) return NO_STEPS;
    if (solutionLine.kind === 'play') return lineSteps(solutionLine.fen, solutionLine.solution!, solutionIntro(solutionLine), solutionLine.solutionOutro);
    const fen = solutionLine.board!.fen;
    return demoLineSteps(fen, solutionLine.solution!, choiceIntro(fen), solutionLine.solutionOutro);
  }, [solutionLine]);
  const walk = useWalkSteps(walkSteps, 'start');

  useEffect(() => {
    setState(freshState());
    setFeedback(null);
    setAttempt(0);
  }, [index]);

  // Voix de l'entraîneur : lit la consigne de chaque étape, puis chaque message (indice, erreur, réussite).
  useEffect(() => {
    if (voice && !done) speak(stepSpeech(step));
  }, [voice, step, done]);
  useEffect(() => {
    if (voice && feedback) speak(feedback.text);
  }, [voice, feedback]);
  useEffect(() => () => stopSpeaking(), []);

  const toggleVoice = () => {
    const on = !settings.coachVoice;
    update({ coachVoice: on });
    if (!on) stopSpeaking();
  };

  const showSolution = () => {
    setState((s) => ({ ...s, revealed: true, firstTry: false }));
    if (step.kind === 'move') {
      const uci = solutions(step)[0];
      const ply = uci ? ChessGame.create(step.fen).playUci(uci)?.plies.at(-1) : undefined;
      if (ply) setFeedback({ tone: 'info', text: `Solution : **${formatSan(ply.san, ply.color, settings.notation)}** (flèche verte). Joue ce coup pour continuer.` });
    } else if (step.kind === 'square') {
      setFeedback({ tone: 'info', text: `La bonne réponse est entourée en vert : ${step.answer.join(' ou ')}. Clique dessus pour continuer.` });
    } else setFeedback(null);
  };

  const retry = () => {
    setState((s) => ({ ...s, revealed: false }));
    setFeedback(null);
    setAttempt((a) => a + 1);
  };

  const persist = async (stepIndex: number, finished: boolean) => {
    const correct = correctCount();
    await saveLessonProgress({
      lessonId: lesson.id,
      status: finished ? 'done' : 'in-progress',
      step: stepIndex,
      correct,
      total: exercises,
      updatedAt: Date.now(),
      completedAt: finished ? Date.now() : undefined,
    });
  };

  const solve = (firstTry: boolean, message: string) => {
    setState((s) => ({ ...s, solved: true }));
    setFeedback({ tone: 'ok', text: message });
    if (!results.current.has(index)) {
      results.current.set(index, firstTry);
      void recordAttempt({ kind: 'lesson', refId: `${lesson.id}#${index}`, themes: lesson.skills, success: firstTry, hints: firstTry ? 0 : 1, at: Date.now() });
    }
  };

  const fail = (message: string) => {
    setState((s) => ({ ...s, tries: s.tries + 1, firstTry: false }));
    setFeedback({ tone: 'bad', text: message });
  };

  const goNext = async () => {
    if (index < lesson.steps.length - 1) {
      await persist(index + 1, false);
      setIndex(index + 1);
    } else {
      await persist(index, true);
      setDone(true);
    }
  };

  if (done) {
    const correct = correctCount();
    const review = needsReview({ status: 'done', correct, total: exercises });
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    return (
      <div className="lesson-done panel" data-testid="lesson-done">
        <h2>Leçon terminée : {lesson.title}</h2>
        <p className="lead">
          {correct} exercice{correct > 1 ? 's' : ''} réussi{correct > 1 ? 's' : ''} du premier coup sur {exercises} · environ {minutes} min.
        </p>
        <p>{correct === exercises ? 'Excellent : notion maîtrisée.' : 'Les exercices manqués seront proposés à nouveau lors de tes révisions. Tu peux aussi refaire la leçon maintenant.'}</p>
        {review && (
          <p data-testid="lesson-review-note">
            Cette leçon restera dans ta séance du jour (« Revoir ») jusqu’à ce que tu réussisses au moins {reviewTarget(exercises)} exercice{reviewTarget(exercises) > 1 ? 's' : ''} sur {exercises} du premier coup, sans indice ni aide de l’ordinateur.
          </p>
        )}
        <div className="row">
          {next && (
            <button type="button" className="btn btn-primary" onClick={() => navigate(`/lecons/${next.id}`)}>
              Leçon suivante : {next.title}
            </button>
          )}
          <button type="button" className="btn" onClick={() => { results.current.clear(); priorCorrect.current = 0; setDone(false); setIndex(0); }}>
            Refaire la leçon
          </button>
          <Link className="btn" to="/lecons">Toutes les leçons</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="lesson">
      <div className="lesson-progress" role="progressbar" aria-valuemin={1} aria-valuemax={lesson.steps.length} aria-valuenow={index + 1} aria-label="Progression dans la leçon">
        <div style={{ width: `${((index + 1) / lesson.steps.length) * 100}%` }} />
      </div>
      <div className={`lesson-grid${walk ? ' walking' : ''}`}>
        <div className="lesson-board">
          {walk && (step.kind === 'play' || step.kind === 'choice') ? (
            <PlayableBoard
              fen={walk.step.fen}
              orientation={step.kind === 'play' ? (step.orientation ?? (ChessGame.create(step.fen).turn === 'w' ? 'white' : 'black')) : (step.board?.orientation ?? 'white')} shapes={walk.step.shapes} lastMove={walk.step.lastMove} ariaLabel="Échiquier de la solution" />
          ) : (
            <StepBoard key={`${index}-${attempt}`} step={step} state={state} onSolve={solve} onFail={fail} setState={setState} />
          )}
        </div>
        <div className="lesson-text">
          <div className="lesson-head">
            <p className="eyebrow">
              Étape {index + 1} / {lesson.steps.length}
            </p>
            {speechOk() && (
              <button type="button" className={`btn btn-small${voice ? ' active' : ''}`} aria-pressed={voice} onClick={toggleVoice} data-testid="lesson-voice">
                {voice ? '🔊 Voix de l’entraîneur activée' : '🔇 Activer la voix de l’entraîneur'}
              </button>
            )}
          </div>
          {'title' in step && step.title && <h2>{step.title}</h2>}
          <StepText key={index} step={step} state={state} onSolve={solve} onFail={fail} />
          {feedback && (
            <div className={`feedback ${feedback.tone}`} role="status" data-testid="feedback">
              <RichText text={feedback.text} />
            </div>
          )}
          {isExercise(step) && !state.solved && step.kind !== 'choice' && !state.revealed && (
            <div className="row">
              {!state.hint ? (
                <button type="button" className="btn btn-small" data-testid="lesson-hint" onClick={() => { setState((s) => ({ ...s, hint: true, firstTry: false })); setFeedback({ tone: 'info', text: `Indice : ${step.hint}` }); }}>
                  Indice
                </button>
              ) : (
                (step.kind === 'move' || step.kind === 'play') && (
                  <button
                    type="button"
                    className="btn btn-small"
                    data-testid="lesson-piece-hint"
                    onClick={() => {
                      setState((s) => ({ ...s, pieceHint: s.pieceHint + 1, firstTry: false }));
                      setFeedback({ tone: 'info', text: 'Deuxième indice : la pièce à jouer est entourée en vert.' });
                    }}
                  >
                    Montre la pièce à jouer
                  </button>
                )
              )}
              {(step.kind === 'play' ? !!step.solution && (state.tries >= 1 || state.hint) : state.tries >= 2 || (state.hint && state.tries >= 1)) && (
                <button type="button" className="btn btn-small" data-testid="lesson-solution" onClick={showSolution}>
                  {step.kind === 'play' ? 'Voir la solution expliquée' : 'Voir la solution'}
                </button>
              )}
            </div>
          )}
          {step.kind === 'choice' && step.solution && !state.revealed && (state.tries >= 1 || state.solved) && (
            <div className="row">
              <button type="button" className="btn btn-small" data-testid="lesson-solution" onClick={() => setState((s) => ({ ...s, revealed: true }))}>
                Voir la solution expliquée
              </button>
            </div>
          )}
          {walk && (
            <>
              <WalkthroughPanel key={`${index}-${attempt}`} walk={walk} />
              <div className="row">
                <button type="button" className="btn btn-small" onClick={retry} data-testid="lesson-retry">
                  {step.kind === 'choice' ? 'Revenir à la position' : 'Réessayer l’exercice'}
                </button>
              </div>
            </>
          )}
          <div className="lesson-nav">
            <button type="button" className="btn" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              Étape précédente
            </button>
            <button type="button" className="btn btn-primary" disabled={!canContinue} onClick={goNext} data-testid="lesson-next">
              {index === lesson.steps.length - 1 ? 'Terminer' : 'Continuer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StepProps {
  step: Lesson['steps'][number];
  state: ExerciseState;
  onSolve: (firstTry: boolean, message: string) => void;
  onFail: (message: string) => void;
  setState?: React.Dispatch<React.SetStateAction<ExerciseState>>;
}

function StepText({ step, state, onSolve, onFail }: StepProps) {
  switch (step.kind) {
    case 'explain':
      return <RichText text={step.text} />;
    case 'demo':
      return <RichText text={step.text} />;
    case 'move':
    case 'square':
    case 'play':
      return (
        <div className="prompt">
          <RichText text={step.prompt} />
        </div>
      );
    case 'choice':
      return <ChoiceQuestion step={step} state={state} onSolve={onSolve} onFail={onFail} />;
  }
}

function ChoiceQuestion({ step, state, onSolve, onFail }: { step: ChoiceStep } & Omit<StepProps, 'step'>) {
  const [picked, setPicked] = useState<number[]>([]);
  return (
    <div>
      <div className="prompt">
        <RichText text={step.prompt} />
      </div>
      <div className="choices" role="group" aria-label="Réponses possibles">
        {step.options.map((o, i) => {
          const tried = picked.includes(i);
          return (
            <button
              key={o.label}
              type="button"
              className={`choice${tried ? (o.correct ? ' right' : ' wrong') : ''}`}
              disabled={state.solved || tried}
              onClick={() => {
                setPicked((p) => [...p, i]);
                if (o.correct) onSolve(picked.length === 0, o.feedback);
                else onFail(o.feedback);
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepBoard({ step, state, onSolve, onFail }: StepProps) {
  switch (step.kind) {
    case 'explain':
      return step.board ? <PlayableBoard fen={step.board.fen} orientation={step.board.orientation} shapes={step.board.shapes} /> : <div className="board-placeholder" aria-hidden="true">♞</div>;
    case 'choice':
      return step.board ? <PlayableBoard fen={step.board.fen} orientation={step.board.orientation} shapes={step.board.shapes} /> : <div className="board-placeholder" aria-hidden="true">?</div>;
    case 'demo':
      return <DemoBoard step={step} />;
    case 'move':
      return <MoveExercise step={step} state={state} onSolve={onSolve} onFail={onFail} />;
    case 'square':
      return <SquareExercise step={step} state={state} onSolve={onSolve} onFail={onFail} />;
    case 'play':
      return <PlayExercise step={step} state={state} onSolve={onSolve} onFail={onFail} />;
  }
}

/** Jouer une position contre Stockfish (pleine force) jusqu'à l'objectif. */
export function PlayExercise({ step, state, onSolve, onFail }: { step: PlayStep } & Omit<StepProps, 'step'>) {
  const [game, setGame] = useState(() => ChessGame.create(step.fen));
  const [thinking, setThinking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [arrow, setArrow] = useState<string | null>(null);
  const [assisted, setAssisted] = useState(false);
  const [sync, setSync] = useState(0);
  const [engineError, setEngineError] = useState<string | null>(null);
  const player = useMemo(() => ChessGame.create(step.fen).turn, [step.fen]);
  const run = useRef(0);
  const [pieceMark, setPieceMark] = useState<string | null>(null);

  // Deuxième indice : la pièce à jouer dans la position du moment. Tant que la partie suit la solution écrite,
  // on montre son coup ; sinon on demande le meilleur coup au moteur.
  useEffect(() => {
    if (!state.pieceHint) return;
    let live = true;
    const sans = game.plies.map((p) => p.san);
    const onLine = step.solution && sans.every((s, i) => step.solution![i]?.san === s) ? step.solution[sans.length] : undefined;
    const fromLine = onLine ? game.playSan(onLine.san) : null;
    void (async () => {
      let from: string | undefined = fromLine ? fromLine.plies.at(-1)?.from : undefined;
      if (!from) {
        try {
          from = (await (await getEngine()).search(game.fen, { depth: 18, movetime: 600 })).bestmove?.slice(0, 2);
        } catch (e) {
          setEngineError(e instanceof Error ? e.message : String(e));
        }
      }
      if (live && from) setPieceMark(from);
    })();
    return () => {
      live = false;
    };
    // Seulement à chaque nouvelle demande d'indice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pieceHint]);

  const verdict = (g: ChessGame) => {
    const v = judgePlay(step, g, player);
    if (v.state === 'success') onSolve(!assisted && state.firstTry && !state.hint, step.success);
    else if (v.state === 'fail') {
      setFailed(v.reason);
      onFail(v.reason);
    }
    return v.state;
  };

  const onMove = async (from: Square, to: Square, promotion?: PromotionPiece) => {
    if (thinking || failed || state.solved) return;
    const next = game.play(from, to, promotion);
    if (!next) return setSync((k) => k + 1);
    setArrow(null);
    setPieceMark(null);
    setGame(next);
    if (verdict(next) !== 'continue') return;
    const id = ++run.current;
    setThinking(true);
    try {
      const engine = await getEngine();
      const r = await engine.search(next.fen, { depth: 18, movetime: 600 });
      const reply = r.bestmove ? next.playUci(r.bestmove) : null;
      if (id !== run.current || !reply) return;
      setGame(reply);
      verdict(reply);
    } catch (e) {
      setEngineError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === run.current) setThinking(false);
    }
  };

  const restart = () => {
    run.current++;
    setGame(ChessGame.create(step.fen));
    setFailed(null);
    setArrow(null);
    setPieceMark(null);
    setThinking(false);
  };

  const suggest = async () => {
    try {
      const r = await (await getEngine()).search(game.fen, { depth: 18, movetime: 600 });
      setArrow(r.bestmove);
      setAssisted(true);
    } catch (e) {
      setEngineError(e instanceof Error ? e.message : String(e));
    }
  };

  const used = game.plies.filter((p) => p.color === player).length;
  const last = game.plies.at(-1);
  return (
    <div className="play-step" data-fen={game.fen}>
      <PlayableBoard
        fen={game.fen}
        orientation={step.orientation ?? (player === 'w' ? 'white' : 'black')}
        interactive={!thinking && !failed && !state.solved && game.turn === player}
        lastMove={last ? [last.from, last.to] : undefined}
        shapes={[...(arrow ? [{ orig: arrow.slice(0, 2), dest: arrow.slice(2, 4), brush: 'blue' }] : []), ...(pieceMark ? [{ orig: pieceMark, brush: 'green' }] : [])]}
        syncKey={sync}
        onMove={onMove}
      />
      <div className="demo-controls">
        <span className="muted small" data-testid="play-count">{thinking ? 'L’ordinateur réfléchit…' : `Coups joués : ${used} / ${step.maxMoves}`}</span>
        {!state.solved && <button type="button" className="btn btn-small" onClick={suggest} disabled={thinking || !!failed}>Coup conseillé</button>}
        {(failed || used > 0) && !state.solved && <button type="button" className="btn btn-small" onClick={restart} data-testid="play-restart">Recommencer</button>}
      </div>
      {engineError && <p className="error" role="alert">{engineError}</p>}
    </div>
  );
}

function DemoBoard({ step }: { step: DemoStep }) {
  const { settings } = useSettings();
  const game = useMemo(() => ChessGame.fromSan(step.moves.map((m) => m.san), step.fen), [step]);
  const [ply, setPly] = useState(0);
  const p = game.plies[ply - 1];
  return (
    <div className="demo">
      <PlayableBoard fen={game.fenAt(ply)} orientation={step.orientation} lastMove={p ? [p.from, p.to] : undefined} />
      <div className="demo-controls">
        <button type="button" className="btn btn-icon" onClick={() => setPly(0)} disabled={ply === 0} aria-label="Revenir au début">⏮</button>
        <button type="button" className="btn btn-icon" onClick={() => setPly(ply - 1)} disabled={ply === 0} aria-label="Coup précédent">◀</button>
        <button type="button" className="btn btn-primary" onClick={() => setPly(ply + 1)} disabled={ply === game.length} data-testid="demo-next">
          {ply === game.length ? 'Fin de la démonstration' : 'Coup suivant ▶'}
        </button>
      </div>
      <p className="demo-comment" aria-live="polite">
        {p ? (
          <>
            <strong>{formatSan(p.san, p.color, settings.notation)}</strong> — {step.moves[ply - 1]!.comment}
          </>
        ) : (
          'Appuie sur « Coup suivant » pour lancer la démonstration.'
        )}
      </p>
    </div>
  );
}

function MoveExercise({ step, state, onSolve, onFail }: { step: MoveStep } & Omit<StepProps, 'step'>) {
  const [fen, setFen] = useState(step.fen);
  const [last, setLast] = useState<[string, string] | undefined>();
  const [sync, setSync] = useState(0);
  const solution = useMemo(() => (state.revealed ? solutions(step)[0] : undefined), [state.revealed, step]);
  const hintShape = useMemo(() => {
    if (state.revealed && solution) return [{ orig: solution.slice(0, 2), dest: solution.slice(2, 4), brush: 'green' }];
    const piece = state.pieceHint ? solutions(step)[0]?.slice(0, 2) : undefined;
    return [...(step.shapes ?? []), ...(piece ? [{ orig: piece, brush: 'green' }] : [])];
  }, [state.revealed, state.pieceHint, solution, step]);

  const onMove = (from: Square, to: Square, promotion?: PromotionPiece) => {
    const v = checkMove(step, from, to, promotion);
    if (v.ok && v.after) {
      setFen(v.after.fen);
      setLast([from, to]);
      onSolve(state.firstTry && !state.hint && !state.revealed, v.message);
    } else {
      onFail(v.message);
      setSync((k) => k + 1); // la pièce revient à sa place
    }
  };

  return <PlayableBoard fen={fen} orientation={step.orientation} interactive={!state.solved} shapes={hintShape} lastMove={last} syncKey={sync} onMove={onMove} />;
}

function SquareExercise({ step, state, onSolve, onFail }: { step: SquareStep } & Omit<StepProps, 'step'>) {
  const [clicked, setClicked] = useState<string | null>(null);
  const shapes = useMemo(() => {
    if (state.revealed || state.solved) return step.answer.map((a) => ({ orig: a, brush: 'green' }));
    return clicked ? [{ orig: clicked, brush: 'red' }] : [];
  }, [state.revealed, state.solved, clicked, step.answer]);
  return (
    <PlayableBoard
      fen={step.fen ?? '8/8/8/8/8/8/8/8 w - - 0 1'}
      orientation={step.orientation}
      shapes={shapes}
      ariaLabel="Échiquier : clique sur une case"
      onSelect={(sq) => {
        if (state.solved) return;
        setClicked(sq);
        if (step.answer.includes(sq)) onSolve(state.firstTry && !state.hint, step.success);
        else onFail(`Tu as cliqué sur ${sq}. ${step.hint}`);
      }}
    />
  );
}
