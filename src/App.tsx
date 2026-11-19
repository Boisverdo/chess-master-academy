import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { CURRENT_PHASE, SECTIONS } from './ui/sections';
import { SettingsProvider } from './ui/settings';
import { BoardPage } from './sections/board/BoardPage';
import { HomePage, PlannedPage, SettingsPage } from './sections/Pages';
import { LessonRoute, LessonsPage } from './sections/lessons/LessonsPage';
import { TacticsPage } from './sections/tactics/TacticsPage';
import { OpeningDetail, OpeningsPage } from './sections/openings/OpeningsPage';
import { AssessmentPage } from './sections/learning/AssessmentPage';
import { MyLearningPage } from './sections/learning/MyLearningPage';
import { PlayPage } from './sections/play/PlayPage';
import { AnalysisListPage } from './sections/analysis/AnalysisListPage';
import { AnalysisView } from './sections/analysis/AnalysisView';
import { CoachPage } from './sections/coach/CoachPage';
import { ChessComPage } from './sections/chesscom/ChessComPage';
import { ProgressPage } from './sections/progress/ProgressPage';
import { ExamPage } from './sections/progress/ExamPage';

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
