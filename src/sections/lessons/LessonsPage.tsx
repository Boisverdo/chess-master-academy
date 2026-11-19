import { Link, useParams } from 'react-router-dom';
import { ALL_LESSONS, COURSES, findLesson } from '../../learning/lessons';
import { getLessonProgress } from '../../storage/repo';
import { useData } from '../../ui/useData';
import { LessonPlayer } from './LessonPlayer';

export function LessonsPage() {
  const { data: progress } = useData(getLessonProgress);
  return (
    <div className="page page-wide">
      <h1>Leçons</h1>
      <p className="lead">Chaque leçon explique, démontre, puis te fait pratiquer. Une notion n’est validée que si tu réussis ses exercices.</p>
      {COURSES.map((course) => {
        const done = course.lessons.filter((l) => progress?.get(l.id)?.status === 'done').length;
        return (
          <section key={course.id} className="panel course">
            <div className="course-head">
              <div>
                <p className="eyebrow">{course.module}</p>
                <h2>{course.title}</h2>
                <p className="muted">{course.description}</p>
              </div>
              <span className="badge">
                {done} / {course.lessons.length} terminées
              </span>
            </div>
            <ol className="lesson-list">
              {course.lessons.map((l) => {
                const p = progress?.get(l.id);
                const status = p?.status === 'done' ? `Terminée · ${p.correct}/${p.total} du premier coup` : p ? 'En cours' : `${l.minutes} min`;
                return (
                  <li key={l.id}>
                    <Link to={`/lecons/${l.id}`} className={`lesson-link${p?.status === 'done' ? ' done' : ''}`}>
                      <span className="lesson-check" aria-hidden="true">{p?.status === 'done' ? '✓' : ''}</span>
                      <span className="lesson-title">
                        <strong>{l.title}</strong>
                        <span className="muted small">{l.summary}</span>
                      </span>
                      <span className="muted small lesson-status">{status}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

export function LessonRoute() {
  const { id = '' } = useParams();
  const lesson = findLesson(id);
  const { data: progress } = useData(getLessonProgress, [id]);
  if (!lesson) {
    return (
      <div className="page">
        <h1>Leçon introuvable</h1>
        <Link to="/lecons">Retour aux leçons</Link>
      </div>
    );
  }
  if (!progress) return <p className="muted">Chargement…</p>;
  const p = progress.get(lesson.id);
  const start = p && p.status === 'in-progress' ? p.step : 0;
  const idx = ALL_LESSONS.indexOf(lesson);
  return (
    <div className="page page-wide">
      <p className="breadcrumb">
        <Link to="/lecons">Leçons</Link> › {lesson.title}
      </p>
      <h1>{lesson.title}</h1>
      <LessonPlayer key={lesson.id} lesson={lesson} startStep={start} next={ALL_LESSONS[idx + 1]} />
    </div>
  );
}
