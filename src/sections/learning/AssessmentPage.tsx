import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlayableBoard } from '../../board/PlayableBoard';
import {
  ASSESSMENT_PUZZLE_RATINGS,
  computeAssessment,
  DEMO_GAME,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  RULES_QUESTIONS,
  STRATEGY_QUESTIONS,
  type AssessmentInput,
} from '../../learning/assessment';
import type { ChoiceStep } from '../../learning/lessons/types';
import { PuzzleRun, type Puzzle } from '../../learning/puzzles/puzzle';
import { loadPuzzles } from '../../learning/puzzles/select';
import { LEVEL_LABELS, type AssessmentResult } from '../../storage/db';
import { START_RATING } from '../../storage/learning';
import { getProfile, newProfile, recordAttempt, saveProfile } from '../../storage/repo';
import { LineViewer } from '../openings/LineViewer';
import { QuickPuzzle } from './QuickPuzzle';
import { RichText } from '../../ui/RichText';

type Stage = 'intro' | 'questionnaire' | 'rules' | 'tactics' | 'strategy' | 'demo' | 'result';
const STAGES: Stage[] = ['questionnaire', 'rules', 'tactics', 'strategy', 'demo', 'result'];
const BASIC_THEMES = ['mat-en-1', 'piece-en-prise', 'fourchette', 'mat-en-2', 'clouage', 'attaque-double'];

/** Exercices de l'évaluation : un par palier de difficulté, thèmes variés, solutions courtes. */
function pickAssessmentPuzzles(all: Puzzle[]): Puzzle[] {
  return ASSESSMENT_PUZZLE_RATINGS.map((target, i) => {
    const theme = BASIC_THEMES[i % BASIC_THEMES.length]!;
    const pool = all.filter((p) => p.themes.includes(theme) && new PuzzleRun(p).playerMoves <= 2);
    return pool.reduce((best, p) => (Math.abs(p.rating - target) < Math.abs(best.rating - target) ? p : best), pool[0]!);
  });
}

export function AssessmentPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('intro');
  const [experience, setExperience] = useState<AssessmentInput['experience'] | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [rulesAnswers, setRulesAnswers] = useState<boolean[]>([]);
  const [strategyAnswers, setStrategyAnswers] = useState<boolean[]>([]);
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null);
  const [puzzleResults, setPuzzleResults] = useState<{ rating: number; success: boolean }[]>([]);
  const [result, setResult] = useState<AssessmentResult | null>(null);

  useEffect(() => {
    loadPuzzles().then((all) => setPuzzles(pickAssessmentPuzzles(all)));
  }, []);

  const finish = async (demoCorrect: boolean) => {
    const strategy = [...strategyAnswers, demoCorrect];
    const r = computeAssessment({
      experience: experience ?? 'decouverte',
      rulesCorrect: rulesAnswers.filter(Boolean).length,
      rulesTotal: RULES_QUESTIONS.length,
      strategyCorrect: strategy.filter(Boolean).length,
      strategyTotal: strategy.length,
      puzzles: puzzleResults,
    });
    const previous = await getProfile();
    const base = newProfile(r.level, experience ?? 'decouverte', goals);
    const perf = r.estimate ? (r.estimate.low + r.estimate.high) / 2 : undefined;
    const rating = previous?.tactics.count ? previous.tactics.rating : Math.round(perf ? (START_RATING[r.level] + perf) / 2 : START_RATING[r.level]);
    await saveProfile({ ...base, createdAt: previous?.createdAt ?? base.createdAt, assessment: r, tactics: { rating, count: previous?.tactics.count ?? 0 } });
    await recordAttempt({ kind: 'assessment', refId: 'evaluation-initiale', themes: ['evaluation'], success: true, hints: 0, at: Date.now() });
    setResult(r);
    setStage('result');
  };

  const stepIndex = STAGES.indexOf(stage);

  return (
    <div className="page page-wide">
      <h1>Évaluation initiale</h1>
      {stage !== 'intro' && (
        <ol className="stepper" aria-label="Étapes de l’évaluation">
          {['Questionnaire', 'Règles', 'Tactique', 'Stratégie', 'Partie commentée', 'Résultat'].map((label, i) => (
            <li key={label} className={i === stepIndex ? 'current' : i < stepIndex ? 'done' : ''}>{label}</li>
          ))}
        </ol>
      )}

      {stage === 'intro' && (
        <section className="panel">
          <p className="lead">Une dizaine de minutes pour situer ton niveau et construire ton parcours. Il n’y a aucun piège : réponds « Je ne sais pas » plutôt que de deviner.</p>
          <ul>
            <li>Un court questionnaire sur ton expérience et tes objectifs ;</li>
            <li>six questions sur les règles ;</li>
            <li>six exercices tactiques de difficulté croissante (un seul essai chacun) ;</li>
            <li>trois positions à juger et une partie commentée.</li>
          </ul>
          <p className="muted small">Le résultat est un niveau de départ et, si possible, une fourchette indicative. Ce n’est jamais un classement Elo officiel.</p>
          <button type="button" className="btn btn-primary btn-large" onClick={() => setStage('questionnaire')}>Commencer</button>
        </section>
      )}

      {stage === 'questionnaire' && (
        <section className="panel">
          <h2>Ton expérience</h2>
          <div className="choices">
            {EXPERIENCE_OPTIONS.map((o) => (
              <button key={o.id} type="button" className={`choice${experience === o.id ? ' selected' : ''}`} aria-pressed={experience === o.id} onClick={() => setExperience(o.id)}>
                {o.label}
              </button>
            ))}
          </div>
          <h2>Tes objectifs (plusieurs choix possibles)</h2>
          <div className="chips">
            {GOAL_OPTIONS.map((g) => (
              <button key={g} type="button" className={`chip${goals.includes(g) ? ' active' : ''}`} aria-pressed={goals.includes(g)} onClick={() => setGoals((gs) => (gs.includes(g) ? gs.filter((x) => x !== g) : [...gs, g]))}>
                {g}
              </button>
            ))}
          </div>
          <div className="lesson-nav">
            <span />
            <button type="button" className="btn btn-primary" disabled={!experience} onClick={() => setStage('rules')}>Continuer</button>
          </div>
        </section>
      )}

      {stage === 'rules' && (
        <QuestionSeries key="rules" title="Les règles" questions={RULES_QUESTIONS} onDone={(a) => { setRulesAnswers(a); setStage('tactics'); }} />
      )}

      {stage === 'tactics' && (
        puzzles ? (
          <PuzzleSeries puzzles={puzzles} onDone={(r) => { setPuzzleResults(r); setStage('strategy'); }} />
        ) : (
          <p className="muted">Chargement des exercices…</p>
        )
      )}

      {stage === 'strategy' && (
        <QuestionSeries key="strategy" title="Juger une position" questions={STRATEGY_QUESTIONS} onDone={(a) => { setStrategyAnswers(a); setStage('demo'); }} />
      )}

      {stage === 'demo' && <DemoGame onDone={finish} />}

      {stage === 'result' && result && (
        <section className="panel" data-testid="assessment-result">
          <p className="eyebrow">Ton niveau de départ</p>
          <h2 className="level-title">{LEVEL_LABELS[result.level]}</h2>
          <ul className="stat-list">
            {([['Règles', result.scores.rules], ['Tactique', result.scores.tactics], ['Jugement de position', result.scores.strategy]] as const).map(([label, v]) => (
              <li key={label}>
                <span>{label}</span>
                <span className="bar" aria-hidden="true"><span style={{ width: `${Math.round(v * 100)}%` }} /></span>
                <span className="muted small">{Math.round(v * 100)} %</span>
              </li>
            ))}
          </ul>
          {result.estimate ? (
            <p>
              <strong>Fourchette indicative : {result.estimate.low} – {result.estimate.high}</strong>
              <br />
              <span className="muted small">Estimation calculée sur 6 exercices seulement, sur l’échelle des exercices tactiques. Ce n’est pas un classement Elo officiel ; elle s’affinera avec tes résultats.</span>
            </p>
          ) : (
            <p className="muted">Pas encore de fourchette : elle apparaîtra quand tu auras résolu des exercices.</p>
          )}
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/apprentissage')}>Voir mon parcours</button>
            <Link className="btn" to="/">Accueil</Link>
          </div>
        </section>
      )}
    </div>
  );
}

function QuestionSeries({ title, questions, onDone }: { title: string; questions: ChoiceStep[]; onDone: (answers: boolean[]) => void }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const q = questions[i]!;
  const answer = (correct: boolean) => {
    const next = [...answers, correct];
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
        <p className="eyebrow">{title} · question {i + 1} / {questions.length}</p>
        <div className="prompt"><RichText text={q.prompt} /></div>
        <div className="choices">
          {q.options.map((o) => (
            <button key={o.label} type="button" className="choice" onClick={() => answer(o.correct)}>{o.label}</button>
          ))}
        </div>
        <p className="muted small">Les corrections seront données dans les leçons : ici, on mesure seulement.</p>
      </div>
    </div>
  );
}

function PuzzleSeries({ puzzles, onDone }: { puzzles: Puzzle[]; onDone: (r: { rating: number; success: boolean }[]) => void }) {
  const [i, setI] = useState(0);
  const [results, setResults] = useState<{ rating: number; success: boolean }[]>([]);
  const [last, setLast] = useState<boolean | null>(null);
  const p = puzzles[i]!;
  const record = (success: boolean) => {
    if (last !== null) return; // un seul résultat par exercice
    setLast(success);
    setResults((r) => [...r, { rating: p.rating, success }]);
  };
  const next = () => {
    setLast(null);
    if (i === puzzles.length - 1) onDone(results);
    else setI(i + 1);
  };
  const theme = useMemo(() => p.themes, [p]);
  return (
    <div className="lesson-grid">
      <div className="lesson-board">
        <QuickPuzzle key={p.id} puzzle={p} onDone={record} locked={last !== null} />
      </div>
      <div className="lesson-text">
        <p className="eyebrow">Tactique · exercice {i + 1} / {puzzles.length}</p>
        <h2>Trouve le meilleur coup</h2>
        {last === null ? (
          <button type="button" className="btn" onClick={() => record(false)} data-testid="skip-puzzle">Je ne trouve pas, passer</button>
        ) : (
          <>
            <div className={`feedback ${last ? 'ok' : 'info'}`} role="status">{last ? 'Bien joué !' : 'Pas cette fois : ce motif fera partie de ton entraînement.'}</div>
            <button type="button" className="btn btn-primary" onClick={next} data-testid="next-step">Continuer</button>
          </>
        )}
        <p className="muted small" hidden={!theme.length}>Difficulté : {p.rating}</p>
      </div>
    </div>
  );
}

function DemoGame({ onDone }: { onDone: (correct: boolean) => void }) {
  const q = DEMO_GAME.question;
  return (
    <div>
      <p>Regarde cette courte partie (avance avec ▶), puis réponds à la question.</p>
      <LineViewer moves={DEMO_GAME.moves} orientation="white" />
      <section className="panel">
        <div className="prompt"><RichText text={q.prompt} /></div>
        <div className="choices">
          {q.options.map((o) => (
            <button key={o.label} type="button" className="choice" onClick={() => onDone(o.correct)}>{o.label}</button>
          ))}
        </div>
      </section>
    </div>
  );
}
