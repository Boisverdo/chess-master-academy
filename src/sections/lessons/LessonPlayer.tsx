import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlayableBoard } from '../../board/PlayableBoard';
import { ChessGame, type PromotionPiece, type Square } from '../../core/game';
import { formatSan } from '../../core/notation';
import { checkMove, solutions } from '../../learning/lessons/check';
import { isExercise, type ChoiceStep, type DemoStep, type Lesson, type MoveStep, type SquareStep } from '../../learning/lessons/types';
import { recordAttempt, saveLessonProgress } from '../../storage/repo';
import { RichText } from '../../ui/RichText';
import { useSettings } from '../../ui/settings';

type Feedback = { tone: 'ok' | 'bad' | 'info'; text: string } | null;

interface ExerciseState {
  solved: boolean;
  firstTry: boolean;
  tries: number;
  hint: boolean;
  revealed: boolean;
}

const freshState = (): ExerciseState => ({ solved: false, firstTry: true, tries: 0, hint: false, revealed: false });

export function LessonPlayer({ lesson, startStep = 0, next }: { lesson: Lesson; startStep?: number; next?: Lesson }) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(Math.min(startStep, lesson.steps.length - 1));
  const [state, setState] = useState<ExerciseState>(freshState);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [done, setDone] = useState(false);
  const results = useRef(new Map<number, boolean>());
  const startedAt = useRef(Date.now());

  const step = lesson.steps[index]!;
  const exercises = lesson.steps.filter(isExercise).length;
  const canContinue = !isExercise(step) || state.solved;

  useEffect(() => {
    setState(freshState());
    setFeedback(null);
  }, [index]);

  const persist = async (stepIndex: number, finished: boolean) => {
    const correct = [...results.current.values()].filter(Boolean).length;
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
    const correct = [...results.current.values()].filter(Boolean).length;
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    return (
      <div className="lesson-done panel" data-testid="lesson-done">
        <h2>Leçon terminée : {lesson.title}</h2>
        <p className="lead">
          {correct} exercice{correct > 1 ? 's' : ''} réussi{correct > 1 ? 's' : ''} du premier coup sur {exercises} · environ {minutes} min.
        </p>
        <p>{correct === exercises ? 'Excellent : notion maîtrisée.' : 'Les exercices manqués seront proposés à nouveau lors de tes révisions. Tu peux aussi refaire la leçon maintenant.'}</p>
        <div className="row">
          {next && (
            <button type="button" className="btn btn-primary" onClick={() => navigate(`/lecons/${next.id}`)}>
              Leçon suivante : {next.title}
            </button>
          )}
          <button type="button" className="btn" onClick={() => { results.current.clear(); setDone(false); setIndex(0); }}>
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
      <div className="lesson-grid">
        <div className="lesson-board">
          <StepBoard key={index} step={step} state={state} onSolve={solve} onFail={fail} setState={setState} />
        </div>
        <div className="lesson-text">
          <p className="eyebrow">
            Étape {index + 1} / {lesson.steps.length}
          </p>
          {'title' in step && step.title && <h2>{step.title}</h2>}
          <StepText key={index} step={step} state={state} onSolve={solve} onFail={fail} />
          {feedback && (
            <div className={`feedback ${feedback.tone}`} role="status" data-testid="feedback">
              <RichText text={feedback.text} />
            </div>
          )}
          {isExercise(step) && !state.solved && step.kind !== 'choice' && (
            <div className="row">
              {!state.hint && (
                <button type="button" className="btn btn-small" onClick={() => { setState((s) => ({ ...s, hint: true, firstTry: false })); setFeedback({ tone: 'info', text: step.hint }); }}>
                  Indice
                </button>
              )}
              {state.tries >= 2 && !state.revealed && (
                <button type="button" className="btn btn-small" onClick={() => setState((s) => ({ ...s, revealed: true, firstTry: false }))}>
                  Voir la solution
                </button>
              )}
            </div>
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
  }
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
    return step.shapes ?? [];
  }, [state.revealed, solution, step.shapes]);

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
