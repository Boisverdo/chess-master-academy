import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { CURRENT_PHASE, SECTIONS } from './ui/sections';
import { SettingsProvider } from './ui/settings';
import { HomePage } from './sections/HomePage';
import { PlannedPage, SettingsPage } from './sections/Pages';
import { SyncBanner } from './sync/SyncBanner';
import { AutoImportBanner } from './integrations/chesscom/AutoImportBanner';

/** Chaque écran est chargé à la demande : le démarrage reste léger. */
const LessonRoute = lazy(() => import('./sections/lessons/LessonsPage').then((m) => ({ default: m.LessonRoute })));
const LessonsPage = lazy(() => import('./sections/lessons/LessonsPage').then((m) => ({ default: m.LessonsPage })));
const TacticsPage = lazy(() => import('./sections/tactics/TacticsPage').then((m) => ({ default: m.TacticsPage })));
const OpeningDetail = lazy(() => import('./sections/openings/OpeningsPage').then((m) => ({ default: m.OpeningDetail })));
const OpeningsPage = lazy(() => import('./sections/openings/OpeningsPage').then((m) => ({ default: m.OpeningsPage })));
const AssessmentPage = lazy(() => import('./sections/learning/AssessmentPage').then((m) => ({ default: m.AssessmentPage })));
const MyLearningPage = lazy(() => import('./sections/learning/MyLearningPage').then((m) => ({ default: m.MyLearningPage })));
const PlayPage = lazy(() => import('./sections/play/PlayPage').then((m) => ({ default: m.PlayPage })));
const AnalysisListPage = lazy(() => import('./sections/analysis/AnalysisListPage').then((m) => ({ default: m.AnalysisListPage })));
const AnalysisView = lazy(() => import('./sections/analysis/AnalysisView').then((m) => ({ default: m.AnalysisView })));
const CoachPage = lazy(() => import('./sections/coach/CoachPage').then((m) => ({ default: m.CoachPage })));
const ChessComPage = lazy(() => import('./sections/chesscom/ChessComPage').then((m) => ({ default: m.ChessComPage })));
const ProgressPage = lazy(() => import('./sections/progress/ProgressPage').then((m) => ({ default: m.ProgressPage })));
const ExamPage = lazy(() => import('./sections/progress/ExamPage').then((m) => ({ default: m.ExamPage })));
const BoardPage = lazy(() => import('./sections/board/BoardPage').then((m) => ({ default: m.BoardPage })));

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMenuOpen(false), [location.pathname]);
  const current = SECTIONS.find((s) => s.path !== '/' && (location.pathname === s.path || location.pathname.startsWith(`${s.path}/`)));

  useEffect(() => {
    document.title = current ? `${current.label} · Chess Master Academy` : 'Chess Master Academy';
  }, [current]);

  return (
    <div className={`shell${menuOpen ? ' menu-open' : ''}`}>
      <header className="topbar">
        <button type="button" className="btn btn-icon menu-btn" aria-label="Ouvrir le menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
          ☰
        </button>
        <span className="brand-mini">Chess Master Academy</span>
      </header>
      <nav className="sidebar" aria-label="Navigation principale">
        <div className="brand">
          <img src="./favicon.svg" alt="" width={36} height={36} />
          <div>
            <strong>Chess Master</strong>
            <span>Academy</span>
          </div>
        </div>
        <ul>
          {SECTIONS.map((s) => (
            <li key={s.path}>
              <NavLink to={s.path} end={s.path === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <span className="nav-icon" aria-hidden="true">{s.icon}</span>
                <span className="nav-label">{s.label}</span>
                {s.phase > CURRENT_PHASE && <span className="nav-soon" title={`Prévu en Phase ${s.phase}`}>P{s.phase}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
        <p className="version">Version {__APP_VERSION__} · Phase {CURRENT_PHASE}</p>
      </nav>
      <div className="scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <main className="content" id="contenu">
        <SyncBanner />
        <AutoImportBanner />
        <Suspense fallback={<p className="muted" role="status">Chargement…</p>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/echiquier" element={<BoardPage />} />
          <Route path="/parametres" element={<SettingsPage />} />
          <Route path="/apprentissage" element={<MyLearningPage />} />
          <Route path="/evaluation" element={<AssessmentPage />} />
          <Route path="/lecons" element={<LessonsPage />} />
          <Route path="/lecons/:id" element={<LessonRoute />} />
          <Route path="/tactiques" element={<TacticsPage />} />
          <Route path="/ouvertures" element={<OpeningsPage />} />
          <Route path="/ouvertures/:id" element={<OpeningDetail />} />
          <Route path="/jouer" element={<PlayPage />} />
          <Route path="/analyse" element={<AnalysisListPage />} />
          <Route path="/analyse/:id" element={<AnalysisView />} />
          <Route path="/entraineur" element={<CoachPage />} />
          <Route path="/chesscom" element={<ChessComPage />} />
          <Route path="/progression" element={<ProgressPage />} />
          <Route path="/progression/examen/:id" element={<ExamPage />} />
          {SECTIONS.filter((s) => s.phase > CURRENT_PHASE).map((s) => (
            <Route key={s.path} path={s.path} element={<PlannedPage section={s} />} />
          ))}
          <Route path="*" element={<HomePage />} />
        </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export function App() {
  return (
    <SettingsProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </SettingsProvider>
  );
}
