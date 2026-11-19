import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlayableBoard } from '../../board/PlayableBoard';
import { formatSan } from '../../core/notation';
import type { ChoiceStep } from '../../learning/lessons/types';
import type { Puzzle } from '../../learning/puzzles/puzzle';
import { loadPuzzles } from '../../learning/puzzles/select';
import { endgameExam, EXAMS, openingExam, rulesExam, tacticsExam } from '../../progress/exams';
import { getProfile, recordAttempt } from '../../storage/repo';
import { RichText } from '../../ui/RichText';
import { useSettings } from '../../ui/settings';
import { QuickPuzzle } from '../learning/QuickPuzzle';
import { freshState, PlayExercise } from '../lessons/LessonPlayer';

export function ExamPage() {
  const { id = '' } = useParams();
  const exam = EXAMS.find((e) => e.id === id);
  const [seed] = useState(() => Date.now() % 100000);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);
  if (!exam) return <div className="page"><h1>Examen introuvable</h1><Link to="/progression">Retour</Link></div>;

  const finish = (all: boolean[]) => {
    const score = all.filter(Boolean).length / all.length;
    const success = score >= exam.pass;
    void recordAttempt({ kind: 'exam', refId: exam.id, themes: [exam.id], success, hints: 0, at: Date.now() });
    setResults(all);
    setFinished(true);
  };

  return (
    <div className="page page-wide">
      <p className="breadcrumb"><Link to="/progression?onglet=examens">Ma progression</Link> › {exam.title}</p>
      <h1>{exam.title}</h1>
      <p className="lead">{exam.description}</p>
      {finished ? (
        <section className="panel" data-testid="exam-result">
          <h2>{results.filter(Boolean).length} / {results.length} — {results.filter(Boolean).length / results.length >= exam.pass ? 'Examen réussi !' : 'Pas encore : continue à t’entraîner, puis retente l’examen.'}</h2>
          <div className="row">
            <Link to="/progression?onglet=examens" className="btn btn-primary">Retour aux examens</Link>
            <button type="button" className="btn" onClick={() => window.location.reload()}>Repasser l’examen</button>
          </div>
        </section>
      ) : exam.id === 'examen-regles' ? (
        <ChoiceExam questions={rulesExam(seed)} onDone={finish} />
      ) : exam.id === 'examen-ouvertures' ? (
        <ChoiceExam questions={openingExam(seed)} sanOptions onDone={finish} />
      ) : exam.id === 'examen-tactique' ? (
        <TacticsExam seed={seed} onDone={finish} />
      ) : (
        <EndgameExam onDone={finish} />
      )}
    </div>
  );
}

function ChoiceExam({ questions, sanOptions = false, onDone }: { questions: ChoiceStep[]; sanOptions?: boolean; onDone: (r: boolean[]) => void }) {
  const { settings } = useSettings();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const q = questions[i]!;
  const turn = q.board?.fen.split(' ')[1] === 'b' ? 'b' : 'w';
  const answer = (ok: boolean) => {
    const next = [...answers, ok];
    if (i === questions.length - 1) onDone(next);
    else {
      setAnswers(next);
      setI(i + 1);
    }
  };
  return (
    <div className="lesson-grid">
      <div className="lesson-board">
        {q.board ? <PlayableBoard key={i} fen={q.board.fen} orientation={q.board.orientation} /> : <div className="board-placeholder" aria-hidden="true">?</div>}
      </div>
      <div className="lesson-text">
        <p className="eyebrow">Question {i + 1} / {questions.length}</p>
        <div className="prompt"><RichText text={q.prompt} /></div>
        <div className="choices" data-testid="exam-choices">
          {q.options.map((o) => (
            <button key={o.label} type="button" className="choice" onClick={() => answer(o.correct)}>
              {sanOptions ? formatSan(o.label, turn, settings.notation) : o.label}
            </button>
          ))}
        </div>
        <p className="muted small">Aucune correction pendant l’examen : le résultat s’affiche à la fin.</p>
      </div>
    </div>
  );
}

function TacticsExam({ seed, onDone }: { seed: number; onDone: (r: boolean[]) => void }) {
  const [list, setList] = useState<Puzzle[] | null>(null);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [current, setCurrent] = useState<boolean | null>(null);
  useEffect(() => {
    void Promise.all([loadPuzzles(), getProfile()]).then(([all, p]) => setList(tacticsExam(all, p?.tactics.rating ?? 1000, seed)));
  }, [seed]);
  if (!list) return <p className="muted">Préparation de l’examen…</p>;
  const p = list[i]!;
  const record = (ok: boolean) => {
    if (current !== null) return;
    setCurrent(ok);
    setResults((r) => [...r, ok]);
  };
  const next = () => {
    if (i === list.length - 1) onDone(results);
    else {
      setI(i + 1);
      setCurrent(null);
    }
  };
  return (
    <div className="lesson-grid">
      <div className="lesson-board"><QuickPuzzle key={p.id} puzzle={p} onDone={record} locked={current !== null} /></div>
      <div className="lesson-text">
        <p className="eyebrow">Exercice {i + 1} / {list.length}</p>
        {current === null ? (
          <button type="button" className="btn" onClick={() => record(false)}>Passer</button>
        ) : (
          <>
            <div className={`feedback ${current ? 'ok' : 'info'}`}>{current ? 'Réussi.' : 'Manqué.'}</div>
            <button type="button" className="btn btn-primary" onClick={next} data-testid="exam-next">{i === list.length - 1 ? 'Voir le résultat' : 'Exercice suivant'}</button>
          </>
        )}
      </div>
    </div>
  );
}

function EndgameExam({ onDone }: { onDone: (r: boolean[]) => void }) {
  const steps = useMemo(endgameExam, []);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [state, setState] = useState(freshState);
  const [msg, setMsg] = useState<string | null>(null);
  const step = steps[i]!;
  const advance = (ok: boolean) => {
    const all = [...results, ok];
    setResults(all);
    if (i === steps.length - 1) onDone(all);
    else {
      setI(i + 1);
      setState(freshState());
      setMsg(null);
    }
  };
  return (
    <div className="lesson-grid">
      <div className="lesson-board">
        <PlayExercise
          key={i}
          step={step}
          state={state}
          onSolve={() => {
            setState((s) => ({ ...s, solved: true }));
            setMsg(step.success);
          }}
          onFail={(m) => {
            setState((s) => ({ ...s, tries: s.tries + 1, firstTry: false }));
            setMsg(m);
          }}
        />
      </div>
      <div className="lesson-text">
        <p className="eyebrow">Position {i + 1} / {steps.length}</p>
        <div className="prompt"><RichText text={step.prompt} /></div>
        {msg && <div className={`feedback ${state.solved ? 'ok' : 'bad'}`}>{msg}</div>}
        {state.solved ? (
          <button type="button" className="btn btn-primary" onClick={() => advance(state.tries === 0)}>Continuer</button>
        ) : (
          state.tries > 0 && <button type="button" className="btn" onClick={() => advance(false)}>Abandonner cette position</button>
        )}
        <p className="muted small">Pour réussir l’examen, chaque position doit être résolue du premier coup (tu peux recommencer, mais la position comptera comme manquée).</p>
      </div>
    </div>
  );
}
