import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadCoachData, type CoachData } from '../../coach/coachData';
import { ALL_LESSONS } from '../../learning/lessons';
import { HABIT_ACTIONS, recommend } from '../../learning/recommend';
import { useData } from '../../ui/useData';
import { DrillTrainer } from './DrillTrainer';

export function CoachPage() {
  const { data } = useData(() => loadCoachData());
  // La position en cours reste affichée après la réponse, jusqu'au clic sur « Position suivante ».
  const [drillId, setDrillId] = useState<string | null>(null);
  useEffect(() => {
    if (data && drillId === null && data.drillsDue[0]) setDrillId(data.drillsDue[0].id);
  }, [data, drillId]);
  if (!data) return <div className="page"><h1>Mon entraîneur</h1><p className="muted">Chargement…</p></div>;
  const recs = data.profile
    ? recommend({ level: data.profile.level, lessons: data.lessons, openings: data.openings, themeStats: data.stats, now: Date.now(), habits: data.habits, drillsDue: data.drillsDue.length })
    : [];

  return (
    <div className="page page-wide">
      <h1>Mon entraîneur</h1>
      <p className="lead">Ton entraîneur suit tes leçons, tes exercices et tes parties analysées. Il ne conclut à une habitude qu’après l’avoir vue dans au moins 3 de tes 10 dernières parties.</p>
      {!data.profile && (
        <p className="notice">Commence par l’<Link to="/evaluation">évaluation initiale</Link> : ton programme sera adapté à ton niveau.</p>
      )}

      {(() => {
        const drill = data.drills.find((d) => d.id === drillId);
        if (!drill) return null;
        const next = data.drillsDue.find((d) => d.id !== drill.id);
        return <DrillTrainer key={drill.id} drill={drill} remaining={data.drillsDue.length} source={data.games.find((g) => g.id === drill.gameId)} onNext={next ? () => setDrillId(next.id) : undefined} />;
      })()}

      <div className="two-cols">
        <section className="panel">
          <h2 className="panel-title">Programme personnalisé</h2>
          {recs.length ? (
            <ol className="recs" data-testid="coach-program">
              {recs.map((r) => (
                <li key={r.title}>
                  <Link to={r.link} className="rec"><strong>{r.title}</strong><span className="muted small">{r.reason}</span></Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Ton programme apparaîtra après l’évaluation initiale.</p>
          )}
        </section>
        <section className="panel" data-testid="habits">
          <h2 className="panel-title">Habitudes observées</h2>
          {data.analysed.length === 0 ? (
            <p className="muted">
              Aucune partie analysée pour l’instant. <Link to="/jouer">Joue contre l’ordinateur</Link> ou <Link to="/analyse">importe une partie</Link>, puis lance l’analyse en indiquant ton camp.
            </p>
          ) : data.habits.length === 0 ? (
            <p>Aucune erreur récurrente dans tes {data.analysed.length} partie{data.analysed.length > 1 ? 's' : ''} analysée{data.analysed.length > 1 ? 's' : ''}. Continue ainsi !</p>
          ) : (
            <ul className="habit-list">
              {data.habits.map((h) => (
                <li key={h.tag} className={h.recurrent ? 'recurrent' : ''}>
                  <span className="badge">{h.recurrent ? 'Habitude' : 'Ponctuel'}</span>{' '}
                  <strong>{h.label}</strong> <span className="muted small">— {h.games} partie{h.games > 1 ? 's' : ''} sur {h.window}</span>
                  {h.recurrent && HABIT_ACTIONS[h.tag] && (
                    <> · <Link to={HABIT_ACTIONS[h.tag]!.link}>{HABIT_ACTIONS[h.tag]!.title}</Link></>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <Journal data={data} />
    </div>
  );
}

function Journal({ data }: { data: CoachData }) {
  const events: { at: number; text: string }[] = [];
  if (data.profile?.assessment) events.push({ at: data.profile.assessment.completedAt, text: 'Évaluation initiale terminée.' });
  for (const l of data.lessons.values()) {
    if (l.completedAt) events.push({ at: l.completedAt, text: `Leçon terminée : ${ALL_LESSONS.find((x) => x.id === l.lessonId)?.title ?? l.lessonId} (${l.correct}/${l.total} du premier coup).` });
  }
  for (const g of data.analysed) {
    events.push({ at: g.analyzedAt!, text: `Partie analysée : ${g.white} – ${g.black} (${g.result}), précision ${g.accuracy?.[g.userColor!]?.toLocaleString('fr-FR') ?? '?'} %.` });
  }
  const puzzles = data.puzzleAttempts.length;
  events.sort((a, b) => b.at - a.at);
  return (
    <section className="panel">
      <h2 className="panel-title">Carnet de l’entraîneur</h2>
      <p className="muted small">{puzzles} exercice{puzzles > 1 ? 's' : ''} tactique{puzzles > 1 ? 's' : ''} joué{puzzles > 1 ? 's' : ''} au total.</p>
      {events.length ? (
        <ul className="journal">
          {events.slice(0, 12).map((e, i) => (
            <li key={i}><span className="muted small">{new Date(e.at).toLocaleDateString('fr-FR')}</span> {e.text}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">Le carnet se remplira au fil de tes leçons et de tes parties.</p>
      )}
    </section>
  );
}

