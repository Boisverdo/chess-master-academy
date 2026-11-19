import { Link } from 'react-router-dom';
import { ALL_LESSONS } from '../../learning/lessons';
import { recommend } from '../../learning/recommend';
import { themeLabel } from '../../learning/puzzles/themes';
import { db, LEVEL_LABELS } from '../../storage/db';
import { themeStats, weakThemes } from '../../storage/learning';
import { getLessonProgress, getProfile } from '../../storage/repo';
import { useData } from '../../ui/useData';

async function load() {
  const [profile, lessons, openings, attempts] = await Promise.all([getProfile(), getLessonProgress(), db.openings.toArray(), db.attempts.toArray()]);
  const puzzleAttempts = attempts.filter((a) => a.kind === 'puzzle');
  return { profile, lessons, openings, puzzleAttempts, stats: themeStats(puzzleAttempts) };
}

export function MyLearningPage() {
  const { data } = useData(load);
  if (!data) return <div className="page"><h1>Mon apprentissage</h1><p className="muted">Chargement…</p></div>;
  const { profile, lessons, openings, puzzleAttempts, stats } = data;

  if (!profile) {
    return (
      <div className="page">
        <h1>Mon apprentissage</h1>
        <section className="hero">
          <p className="lead">Commence par une courte évaluation : ton entraîneur saura par où commencer et adaptera les exercices à ton niveau.</p>
          <Link to="/evaluation" className="btn btn-primary btn-large" data-testid="start-assessment">Commencer l’évaluation (10 min)</Link>
        </section>
      </div>
    );
  }

  const recs = recommend({ level: profile.level, lessons, openings, themeStats: stats, now: Date.now() });
  const lessonsDone = ALL_LESSONS.filter((l) => lessons.get(l.id)?.status === 'done').length;
  const solved = puzzleAttempts.filter((a) => a.success).length;
  const weak = weakThemes(stats);
  const a = profile.assessment;

  return (
    <div className="page page-wide">
      <h1>Mon apprentissage</h1>
      <div className="summary-grid">
        <div className="stat-card">
          <span className="muted small">Niveau</span>
          <strong data-testid="profile-level">{LEVEL_LABELS[profile.level]}</strong>
          {a && <span className="muted small">Évalué le {new Date(a.completedAt).toLocaleDateString('fr-FR')}</span>}
        </div>
        <div className="stat-card">
          <span className="muted small">Cote d’exercices (estimation)</span>
          <strong>{profile.tactics.rating}</strong>
          <span className="muted small">{profile.tactics.count} exercice{profile.tactics.count > 1 ? 's' : ''} joué{profile.tactics.count > 1 ? 's' : ''}</span>
        </div>
        <div className="stat-card">
          <span className="muted small">Leçons terminées</span>
          <strong>{lessonsDone} / {ALL_LESSONS.length}</strong>
        </div>
        <div className="stat-card">
          <span className="muted small">Exercices réussis</span>
          <strong>{solved}</strong>
          <span className="muted small">Ouvertures pratiquées : {openings.length}</span>
        </div>
      </div>

      <section className="panel">
        <h2 className="panel-title">Ta séance du jour</h2>
        <ol className="recs" data-testid="recommendations">
          {recs.map((r) => (
            <li key={r.link + r.title}>
              <Link to={r.link} className="rec">
                <strong>{r.title}</strong>
                <span className="muted small">{r.reason}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div className="two-cols">
        <section className="panel">
          <h2 className="panel-title">Points à travailler</h2>
          {weak.length ? (
            <ul>
              {weak.map((w) => (
                <li key={w.theme}>
                  {themeLabel(w.theme)} : {Math.round(w.rate * 100)} % de réussite sans indice ({w.attempts} essais)
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Aucune faiblesse confirmée pour l’instant. Il faut au moins 5 essais sur un thème avant de conclure : une erreur isolée n’est pas une habitude.</p>
          )}
        </section>
        <section className="panel">
          <h2 className="panel-title">Ton profil</h2>
          {profile.goals.length > 0 && <p><strong>Objectifs :</strong> {profile.goals.join(' · ')}</p>}
          {a?.estimate && (
            <p>
              <strong>Fourchette indicative à l’évaluation :</strong> {a.estimate.low} – {a.estimate.high} <span className="muted small">(estimation, pas un Elo officiel)</span>
            </p>
          )}
          <Link to="/evaluation" className="btn btn-small">Refaire l’évaluation</Link>
        </section>
      </div>
    </div>
  );
}
