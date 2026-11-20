import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { loadCoachData } from '../../coach/coachData';
import { ALL_LESSONS, COURSES } from '../../learning/lessons';
import { OPENINGS } from '../../learning/openings';
import type { Puzzle } from '../../learning/puzzles/puzzle';
import { loadPuzzles } from '../../learning/puzzles/select';
import { themeLabel } from '../../learning/puzzles/themes';
import { activityTimes, badges, dailyChallenge, dailyId, streak, weeklyObjectives } from '../../progress/challenges';
import { EXAMS } from '../../progress/exams';
import { LineChart } from '../../progress/LineChart';
import { eloEstimate, endgameProgress, estimatedLearningMinutes, estimatedLevel, exerciseCounts, gameSummary, history as buildHistory, openingMastery, tacticsSeries } from '../../progress/stats';
import { LEVEL_LABELS } from '../../storage/db';
import { START_RATING, weakThemes } from '../../storage/learning';
import { getIntegration, recordAttempt } from '../../storage/repo';
import type { ChessComStats } from '../../integrations/chesscom/client';
import { useData } from '../../ui/useData';
import { QuickPuzzle } from '../learning/QuickPuzzle';

type Tab = 'tableau' | 'defis' | 'examens' | 'historique';

async function load() {
  const [coach, integration] = await Promise.all([loadCoachData(), getIntegration()]);
  return { ...coach, integration };
}

export function ProgressPage() {
  const { data } = useData(load);
  const [params, setParams] = useSearchParams();
  const asked = params.get('onglet');
  // L'onglet suit l'adresse : un lien vers « ?onglet=examens » ouvre bien cet onglet.
  const tab: Tab = asked === 'defis' || asked === 'examens' || asked === 'historique' ? asked : 'tableau';
  const setTab = (t: Tab) => setParams(t === 'tableau' ? {} : { onglet: t }, { replace: true });
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null);
  useEffect(() => void loadPuzzles().then(setPuzzles), []);
  if (!data) return <div className="page"><h1>Ma progression</h1><p className="muted">Chargement…</p></div>;

  const tabs: [Tab, string][] = [['tableau', 'Tableau de bord'], ['defis', 'Défis et objectifs'], ['examens', 'Examens et badges'], ['historique', 'Historique']];
  return (
    <div className="page page-wide">
      <h1>Ma progression</h1>
      <div className="tabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === 'tableau' && <Dashboard data={data} />}
      {tab === 'defis' && <Challenges data={data} puzzles={puzzles} />}
      {tab === 'examens' && <ExamsAndBadges data={data} />}
      {tab === 'historique' && <History data={data} />}
    </div>
  );
}

type Data = Awaited<ReturnType<typeof load>>;

function Dashboard({ data }: { data: Data }) {
  const p = data.profile;
  const rating = p?.tactics.rating;
  const count = p?.tactics.count ?? 0;
  const lvl = p ? estimatedLevel(rating!, count, p.level) : null;
  const elo = rating !== undefined ? eloEstimate(rating, count) : null;
  const games = gameSummary(data.games);
  const ex = exerciseCounts(data.attempts);
  const minutes = estimatedLearningMinutes([...data.attempts.map((a) => a.at), ...[...data.lessons.values()].map((l) => l.updatedAt)]);
  const op = openingMastery(data.openings, OPENINGS.length);
  const endgames = endgameProgress(data.lessons, COURSES.find((c) => c.id === 'finales')!.lessons.map((l) => l.id));
  const weak = weakThemes(data.stats);
  const ccStats = data.integration?.stats as ChessComStats | undefined;
  const lessonsDone = ALL_LESSONS.filter((l) => data.lessons.get(l.id)?.status === 'done').length;

  return (
    <>
      {!p && <p className="notice">Passe l’<Link to="/evaluation">évaluation initiale</Link> pour activer ton niveau et ta cote d’exercices.</p>}
      <div className="summary-grid" data-testid="dashboard">
        <div className="stat-card">
          <span className="muted small">Niveau actuel</span>
          <strong>{lvl ? LEVEL_LABELS[lvl.level] : '—'}</strong>
          <span className="muted small">{lvl?.estimated ? 'estimé d’après tes 20 derniers exercices et plus' : 'issu de l’évaluation initiale'}</span>
        </div>
        <div className="stat-card">
          <span className="muted small">Fourchette Elo indicative</span>
          <strong>{elo ? `${elo.low} – ${elo.high}` : '—'}</strong>
          <span className="muted small">{elo ? 'Estimation tirée de tes exercices, pas un classement officiel' : 'Disponible après 20 exercices'}</span>
        </div>
        <div className="stat-card">
          <span className="muted small">Parties jouées (ton camp connu)</span>
          <strong>{games.games}</strong>
          <span className="muted small">{games.games ? `${games.pct.win.toLocaleString('fr-FR')} % gagnées · ${games.pct.draw.toLocaleString('fr-FR')} % nulles · ${games.pct.loss.toLocaleString('fr-FR')} % perdues` : 'Aucune partie pour l’instant'}</span>
        </div>
        <div className="stat-card">
          <span className="muted small">Temps d’apprentissage</span>
          <strong>{minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`}</strong>
          <span className="muted small">Estimation à partir de tes activités enregistrées</span>
        </div>
        <div className="stat-card">
          <span className="muted small">Exercices tactiques</span>
          <strong>{ex.puzzles.solved} réussis</strong>
          <span className="muted small">{ex.puzzles.failed} manqués · cote d’exercices {rating ?? '—'}</span>
        </div>
        <div className="stat-card">
          <span className="muted small">Leçons</span>
          <strong>{lessonsDone} / {ALL_LESSONS.length}</strong>
          <span className="muted small">{ex.lessonExercises.firstTry} exercices réussis du premier coup</span>
        </div>
        <div className="stat-card">
          <span className="muted small">Ouvertures</span>
          <strong>{op.solid} solides / {op.total}</strong>
          <span className="muted small">{op.practiced} pratiquée{op.practiced > 1 ? 's' : ''} (solide = 3 révisions réussies d’affilée)</span>
        </div>
        <div className="stat-card">
          <span className="muted small">Finales</span>
          <strong>{endgames.done} / {endgames.total} leçons</strong>
          <span className="muted small"><Link to="/lecons">Cours de finales</Link></span>
        </div>
      </div>

      <div className="two-cols">
        <section className="panel">
          <LineChart title="Cote d’exercices (estimation interne)" points={tacticsSeries(data.attempts)} />
        </section>
        <section className="panel">
          <LineChart title="Précision dans tes parties analysées (%)" points={games.accuracy} format={(v) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} unit=" %" domain={[0, 100]} />
        </section>
      </div>

      <div className="two-cols">
        <section className="panel">
          <h2 className="panel-title">Progression tactique par thème</h2>
          {data.stats.length ? (
            <ul className="stat-list">
              {data.stats.slice().sort((a, b) => b.rate - a.rate).map((s) => (
                <li key={s.theme}>
                  <span>{themeLabel(s.theme)}</span>
                  <span className="bar" aria-hidden="true"><span style={{ width: `${Math.round(s.rate * 100)}%` }} /></span>
                  <span className="muted small">{Math.round(s.rate * 100)} % · {s.attempts}</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Fais quelques <Link to="/tactiques">exercices</Link> pour voir ta progression par thème.</p>}
        </section>
        <section className="panel">
          <h2 className="panel-title">Faiblesses détectées</h2>
          {weak.length === 0 && !data.habits.some((h) => h.recurrent) ? (
            <p className="muted">Aucune faiblesse confirmée pour l’instant (il faut des données répétées pour conclure).</p>
          ) : (
            <ul>
              {weak.map((w) => <li key={w.theme}>Tactique : {themeLabel(w.theme)} ({Math.round(w.rate * 100)} % sans indice)</li>)}
              {data.habits.filter((h) => h.recurrent).map((h) => <li key={h.tag}>En partie : {h.label} ({h.games} parties sur {h.window})</li>)}
            </ul>
          )}
          {ccStats && (
            <>
              <h2 className="panel-title">Cotes Chess.com (officielles)</h2>
              <p className="small">
                {(['chess_rapid', 'chess_blitz', 'chess_bullet', 'chess_daily'] as const).filter((k) => ccStats[k]?.last).map((k) => `${({ chess_rapid: 'Rapide', chess_blitz: 'Blitz', chess_bullet: 'Bullet', chess_daily: 'Par jour' })[k]} ${ccStats[k]!.last!.rating}`).join(' · ') || '—'}
              </p>
            </>
          )}

        </section>
      </div>
    </>
  );
}

function Challenges({ data, puzzles }: { data: Data; puzzles: Puzzle[] | null }) {
  const now = Date.now();
  const rating = data.profile?.tactics.rating ?? 1000;
  const daily = puzzles ? dailyChallenge(puzzles, rating, now) : undefined;
  const doneToday = data.attempts.find((a) => a.kind === 'challenge' && a.refId === dailyId(now));
  const [result, setResult] = useState<boolean | null>(null);
  const objectives = weeklyObjectives({ attempts: data.attempts, lessons: [...data.lessons.values()], games: data.games, weakTheme: weakThemes(data.stats)[0], now });
  const days = streak(activityTimes(data), now);

  return (
    <div className="two-cols">
      <section className="panel" data-testid="daily">
        <h2 className="panel-title">Défi du jour</h2>
        {doneToday || result !== null ? (
          <p className={`feedback ${(doneToday?.success ?? result) ? 'ok' : 'info'}`}>
            {(doneToday?.success ?? result) ? 'Défi du jour réussi. Rendez-vous demain !' : 'Défi du jour manqué. Un nouveau défi t’attend demain.'}
          </p>
        ) : daily ? (
          <>
            <p className="muted small">Un exercice à ta mesure (difficulté {daily.rating}), un seul essai.</p>
            <QuickPuzzle
              key={daily.id}
              puzzle={daily}
              onDone={(success) => {
                setResult(success);
                void recordAttempt({ kind: 'challenge', refId: dailyId(now), themes: daily.themes, success, hints: 0, at: Date.now() });
              }}
            />
          </>
        ) : (
          <p className="muted">Chargement…</p>
        )}
        <p className="streak" data-testid="streak">Série en cours : <strong>{days} jour{days > 1 ? 's' : ''}</strong> d’entraînement consécutif{days > 1 ? 's' : ''}.</p>
      </section>
      <section className="panel" data-testid="objectives">
        <h2 className="panel-title">Objectifs de la semaine</h2>
        <ul className="stat-list">
          {objectives.map((o) => (
            <li key={o.id}>
              <Link to={o.link}>{o.label}</Link>
              <span className="bar" aria-hidden="true"><span style={{ width: `${(o.done / o.target) * 100}%` }} /></span>
              <span className="muted small">{o.done} / {o.target}{o.done >= o.target ? ' ✓' : ''}</span>
            </li>
          ))}
        </ul>
        <p className="muted small">Les objectifs se renouvellent chaque lundi et s’adaptent à ton point faible du moment.</p>
      </section>
    </div>
  );
}

function ExamsAndBadges({ data }: { data: Data }) {
  const now = Date.now();
  const days = streak(activityTimes(data), now);
  const p = data.profile;
  const list = badges({
    attempts: data.attempts,
    lessons: data.lessons,
    openings: data.openings,
    games: data.games,
    strategyIds: COURSES.find((c) => c.id === 'strategie')!.lessons.map((l) => l.id),
    startRating: p ? START_RATING[p.assessment?.level ?? p.level] : undefined,
    rating: p?.tactics.rating,
    streakDays: days,
  });
  const earned = list.filter((b) => b.earned);
  const best = (id: string) => {
    const tries = data.attempts.filter((a) => a.kind === 'exam' && a.refId === id);
    return { tries: tries.length, passed: tries.some((a) => a.success) };
  };
  return (
    <>
      <section className="panel">
        <h2 className="panel-title">Examens</h2>
        <div className="card-grid">
          {EXAMS.map((e) => {
            const b = best(e.id);
            return (
              <Link key={e.id} to={`/progression/examen/${e.id}`} className="card" data-testid={`exam-${e.id}`}>
                <span className="card-title">{e.title}</span>
                <span className="small">{e.description}</span>
                <span className={`badge${b.passed ? ' badge-ok' : ''}`}>{b.passed ? 'Réussi' : b.tries ? `${b.tries} essai${b.tries > 1 ? 's' : ''}` : 'À passer'}</span>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="panel" data-testid="badges">
        <h2 className="panel-title">Badges de maîtrise ({earned.length} / {list.length})</h2>
        <p className="muted small">Chaque badge récompense une compétence démontrée, jamais le simple nombre de parties ou d’exercices.</p>
        <ul className="badge-list">
          {list.map((b) => (
            <li key={b.id} className={b.earned ? 'earned' : ''}>
              <span className="badge-icon" aria-hidden="true">{b.earned ? '★' : '☆'}</span>
              <span>
                <strong>{b.title}</strong>
                <span className="muted small">{b.description}</span>
                {!b.earned && <span className="bar" aria-label={`Progression ${Math.round(b.progress * 100)} %`}><span style={{ width: `${Math.round(b.progress * 100)}%` }} /></span>}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function History({ data }: { data: Data }) {
  const title = (id: string) => ALL_LESSONS.find((l) => l.id === id)?.title ?? id;
  const days = buildHistory(data.attempts, [...data.lessons.values()], data.games, title);
  if (!days.length) return <p className="muted">Ton historique apparaîtra au fil de tes entraînements.</p>;
  return (
    <section className="panel">
      <ol className="history" data-testid="history">
        {days.slice(0, 60).map((d) => (
          <li key={d.day}>
            <strong>{new Date(d.at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
            <span className="small">
              {[
                d.puzzles ? `${d.puzzles} exercice${d.puzzles > 1 ? 's' : ''} (${d.puzzlesSolved} réussi${d.puzzlesSolved > 1 ? 's' : ''})` : '',
                d.lessons.length ? `leçon${d.lessons.length > 1 ? 's' : ''} : ${d.lessons.join(', ')}` : '',
                d.openings ? `${d.openings} révision${d.openings > 1 ? 's' : ''} d’ouverture` : '',
                d.games ? `${d.games} partie${d.games > 1 ? 's' : ''}` : '',
                d.exams ? `${d.exams} examen${d.exams > 1 ? 's' : ''}` : '',
              ].filter(Boolean).join(' · ')}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
