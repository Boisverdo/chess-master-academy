import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ENDGAME_BY_ID, ENDGAME_GROUPS, ENDGAMES, endgameStatus, type EndgameGroup, type EndgameStatus } from '../../learning/endgames';
import { db } from '../../storage/db';
import { recordAttempt } from '../../storage/repo';
import { freshState, PlayExercise, type ExerciseState } from '../lessons/LessonPlayer';
import { RichText } from '../../ui/RichText';
import { useData } from '../../ui/useData';

const LEVELS = { 1: 'Incontournable', 2: 'Important', 3: 'Difficile' } as const;

function badge(s?: EndgameStatus): { text: string; cls: string } {
  if (!s) return { text: 'À découvrir', cls: '' };
  if (s.mastered) return { text: 'Maîtrisée', cls: ' badge-ok' };
  if (s.successes) return { text: 'Réussie avec aide', cls: ' badge-due' };
  return { text: `${s.tries} essai${s.tries > 1 ? 's' : ''}, à retenter`, cls: ' badge-due' };
}

/** Finales essentielles : jouer chaque position type contre Stockfish jusqu'à l'objectif. */
export function EndgameTrainer() {
  const { data: status } = useData(() => db.attempts.where('kind').equals('endgame').toArray().then(endgameStatus));
  const [current, setCurrent] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [state, setState] = useState<ExerciseState>(freshState);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  if (!status) return <p className="muted">Chargement…</p>;
  const mastered = ENDGAMES.filter((e) => status.get(e.id)?.mastered).length;

  const open = (id: string) => {
    setCurrent(id);
    setRound((r) => r + 1);
    setState(freshState());
    setMessage(null);
    window.scrollTo?.({ top: 0 });
  };

  const e = current ? ENDGAME_BY_ID.get(current) : undefined;
  if (e) {
    const idx = ENDGAMES.indexOf(e);
    const following = ENDGAMES[idx + 1];
    return (
      <section className="panel" data-testid="endgame">
        <p className="eyebrow">{ENDGAME_GROUPS[e.group]} · {LEVELS[e.level]}</p>
        <h2 className="panel-title">{e.title}</h2>
        <div className="lesson-grid">
          <div className="lesson-board">
            <PlayExercise
              key={`${e.id}-${round}`}
              step={e.step}
              state={state}
              onSolve={(firstTry, text) => {
                setState((s) => ({ ...s, solved: true }));
                setMessage({ tone: 'ok', text: firstTry ? text : `${text} (avec un coup conseillé : rejoue-la sans aide pour la maîtriser.)` });
                void recordAttempt({ kind: 'endgame', refId: e.id, themes: [], success: true, hints: firstTry ? 0 : 1, at: Date.now() });
              }}
              onFail={(text) => {
                setMessage({ tone: 'bad', text: `${text} Appuie sur « Recommencer » pour réessayer.` });
                void recordAttempt({ kind: 'endgame', refId: e.id, themes: [], success: false, hints: 0, at: Date.now() });
              }}
            />
          </div>
          <div className="lesson-text">
            <p><strong>L’idée :</strong> {e.idea}</p>
            <div className="prompt"><RichText text={e.step.prompt} /></div>
            <details>
              <summary>Indice</summary>
              <p>{e.step.hint}</p>
            </details>
            {message && <div className={`feedback ${message.tone}`} role="status" data-testid="endgame-feedback">{message.text}</div>}
            <p className="muted small">L’ordinateur défend avec toute la force de Stockfish. {e.lesson && <>La technique est expliquée pas à pas dans la <Link to={`/lecons/${e.lesson}`}>leçon correspondante</Link>.</>}</p>
            <div className="row">
              {state.solved && <button type="button" className="btn btn-small" onClick={() => open(e.id)}>Rejouer</button>}
              {following && <button type="button" className={`btn btn-small${state.solved ? ' btn-primary' : ''}`} onClick={() => open(following.id)} data-testid="endgame-next">Finale suivante</button>}
              <button type="button" className="btn btn-small" onClick={() => setCurrent(null)} data-testid="endgame-back">Toutes les finales</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <p>
        {ENDGAMES.length} finales que tout joueur doit savoir gagner (ou tenir) sans réfléchir. Tu joues contre l’ordinateur jusqu’à l’objectif.{' '}
        <strong data-testid="endgame-mastered">{mastered} / {ENDGAMES.length}</strong> maîtrisée{mastered > 1 ? 's' : ''} (réussie sans coup conseillé).
      </p>
      {(Object.keys(ENDGAME_GROUPS) as EndgameGroup[]).map((g) => (
        <section key={g} className="panel">
          <h2 className="panel-title">{ENDGAME_GROUPS[g]}</h2>
          <div className="card-grid">
            {ENDGAMES.filter((x) => x.group === g).map((x) => {
              const b = badge(status.get(x.id));
              return (
                <button key={x.id} type="button" className="card" onClick={() => open(x.id)} data-testid={`endgame-${x.id}`}>
                  <span className="card-title">{x.title}</span>
                  <span className="muted small">{LEVELS[x.level]} · {x.step.goal === 'draw' ? 'tenir la nulle' : x.step.goal === 'promote' ? 'promouvoir' : 'mater'}</span>
                  <span className={`badge${b.cls}`}>{b.text}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
