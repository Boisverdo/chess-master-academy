import { Link } from 'react-router-dom';
import { loadCoachData } from '../coach/coachData';
import { ALL_LESSONS } from '../learning/lessons';
import { homeView, type HomeView } from '../progress/home';
import { SECTIONS } from '../ui/sections';
import { useData } from '../ui/useData';

async function loadHome(): Promise<HomeView> {
  const now = Date.now();
  // La partie en cours sur l'échiquier est lue à la demande (évite d'alourdir le premier affichage).
  const [coach, board] = await Promise.all([
    loadCoachData(now),
    import('./board/savedGame').then(({ loadGame }) => {
      const { game } = loadGame();
      return { plies: game.plies.length, over: game.status().over };
    }),
  ]);
  return homeView({ ...coach, drillsDue: coach.drillsDue.length, boardGame: board, now });
}

export function HomePage() {
  const { data } = useData(loadHome);
  if (!data) {
    return (
      <div className="page page-wide">
        <p className="muted">Chargement…</p>
      </div>
    );
  }
  return data.isNew ? <Welcome /> : <Dashboard v={data} />;
}

/** Premier lancement : présentation et premiers pas. */
function Welcome() {
  const first = ALL_LESSONS[0]!;
  return (
    <div className="page page-wide">
      <section className="hero">
        <p className="eyebrow">Bienvenue</p>
        <h1>Apprendre à penser comme un joueur d'échecs expérimenté</h1>
        <p className="lead">
          Chess Master Academy réunit un échiquier, des leçons, des exercices et un entraîneur qui te fait réfléchir avant de te donner les réponses.
        </p>
      </section>
      <section className="panel" data-testid="home-start">
        <h2 className="panel-title">Pour bien commencer</h2>
        <ol className="recs">
          <li>
            <Link to="/evaluation" className="rec">
              <strong>1. Évaluation initiale (10 min)</strong>
              <span className="muted small">Quelques questions et exercices : ton entraînement s’adapte ensuite à ton niveau.</span>
            </Link>
          </li>
          <li>
            <Link to={`/lecons/${first.id}`} className="rec">
              <strong>2. Première leçon : {first.title}</strong>
              <span className="muted small">{first.summary}</span>
            </Link>
          </li>
          <li>
            <Link to="/jouer" className="rec">
              <strong>3. Une partie contre l’ordinateur</strong>
              <span className="muted small">Six niveaux, du débutant au très avancé, avec les commentaires de l’entraîneur.</span>
            </Link>
          </li>
        </ol>
        <div className="row home-actions">
          <Link to="/evaluation" className="btn btn-primary btn-large" data-testid="home-assessment">Commencer l’évaluation</Link>
          <Link to="/echiquier" className="btn btn-large">Ouvrir l’échiquier</Link>
        </div>
      </section>
      <Explore />
    </div>
  );
}

function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour';
}

/** Joueur qui a déjà commencé : où reprendre, quoi faire aujourd'hui, où il en est cette semaine. */
function Dashboard({ v }: { v: HomeView }) {
  const reached = v.objectives.filter((o) => o.done >= o.target).length;
  return (
    <div className="page page-wide">
      <p className="eyebrow">{greeting()}</p>
      <h1>Ton entraînement</h1>

      <div className="summary-grid" data-testid="home-stats">
        <div className="stat-card">
          <span className="muted small">Série</span>
          <strong data-testid="home-streak">{v.streak} jour{v.streak > 1 ? 's' : ''}</strong>
          <span className="muted small">{v.activeToday ? 'Entraînement fait aujourd’hui ✓' : v.streak ? 'Entraîne-toi aujourd’hui pour la prolonger' : 'Commence une série aujourd’hui'}</span>
        </div>
        <div className="stat-card">
          <span className="muted small">Cote d’exercices (estimation)</span>
          <strong>{v.rating ?? '—'}</strong>
          <span className="muted small">{v.rating === undefined ? <Link to="/evaluation">Passer l’évaluation</Link> : `${v.ratingCount} exercice${v.ratingCount > 1 ? 's' : ''} joué${v.ratingCount > 1 ? 's' : ''}`}</span>
        </div>
        <div className="stat-card">
          <span className="muted small">Leçons terminées</span>
          <strong>{v.lessonsDone} / {v.lessonsTotal}</strong>
          <span className="muted small"><Link to="/lecons">Voir les leçons</Link></span>
        </div>
        <div className="stat-card">
          <span className="muted small">Objectifs de la semaine</span>
          <strong>{reached} / {v.objectives.length}</strong>
          <span className="muted small">atteints (renouvelés chaque lundi)</span>
        </div>
      </div>

      {v.resume && (
        <section className="panel home-resume" data-testid="home-resume">
          <h2 className="panel-title">Reprendre</h2>
          <Link to={v.resume.link} className="rec rec-resume">
            <span>
              <strong>{v.resume.title}</strong>
              <span className="muted small">{v.resume.detail}</span>
            </span>
            <span className="btn btn-primary">Continuer</span>
          </Link>
        </section>
      )}

      <div className="two-cols home-cols">
        <section className="panel" data-testid="home-session">
          <h2 className="panel-title">Ta séance du jour</h2>
          <ol className="recs">
            {v.session.map((r) => (
              <li key={r.link + r.title}>
                <Link to={r.link} className="rec">
                  <strong>{r.title}</strong>
                  <span className="muted small">{r.reason}</span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="small home-more">
            <Link to="/apprentissage">{v.sessionMore ? `Voir toute la séance (${v.sessionMore} de plus)` : 'Voir mon apprentissage'}</Link>
          </p>
        </section>

        <div className="home-side">
          <section className="panel" data-testid="home-daily">
            <h2 className="panel-title">Défi du jour</h2>
            {v.daily === 'a-faire' ? (
              <>
                <p>Un exercice à ta mesure, un seul essai. Un nouveau chaque jour.</p>
                <Link to="/progression?onglet=defis" className="btn btn-primary">Relever le défi</Link>
              </>
            ) : (
              <p className={`feedback ${v.daily === 'reussi' ? 'ok' : 'info'}`}>
                {v.daily === 'reussi' ? 'Défi du jour réussi. Rendez-vous demain !' : 'Défi du jour manqué. Un nouveau défi t’attend demain.'}
              </p>
            )}
          </section>
          <section className="panel" data-testid="home-week">
            <h2 className="panel-title">Cette semaine</h2>
            <ul className="stat-list home-objectives">
              {v.objectives.map((o) => (
                <li key={o.id}>
                  <Link to={o.link}>{o.label}</Link>
                  <span className="bar" aria-hidden="true"><span style={{ width: `${(o.done / o.target) * 100}%` }} /></span>
                  <span className="muted small">{o.done} / {o.target}{o.done >= o.target ? ' ✓' : ''}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <Explore />
    </div>
  );
}

function Explore() {
  return (
    <section className="panel home-explore-panel">
      <h2 className="panel-title">Explorer</h2>
      <div className="card-grid home-explore">
        {SECTIONS.filter((s) => s.path !== '/').map((s) => (
          <Link key={s.path} to={s.path} className="card">
            <span className="card-title"><span className="home-icon" aria-hidden="true">{s.icon}</span> {s.label}</span>
            <span className="muted small">{s.summary}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
