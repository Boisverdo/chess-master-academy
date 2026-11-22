import { useSearchParams } from 'react-router-dom';
import { EndgameTrainer } from './EndgameTrainer';
import { MistakesReview } from './MistakesReview';
import { RushTrainer } from './RushTrainer';

type Tab = 'course' | 'finales' | 'erreurs';
const TABS: [Tab, string][] = [['course', 'Course contre la montre'], ['finales', 'Finales essentielles'], ['erreurs', 'Revue de mes erreurs']];

export function TrainingPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('mode');
  const tab: Tab = TABS.some(([k]) => k === raw) ? (raw as Tab) : 'course';
  return (
    <div className="page page-wide">
      <h1>Entraînement ciblé</h1>
      <p className="lead">Trois façons de t’entraîner en plus des leçons : la vitesse tactique, les finales à connaître par cœur, et tes propres erreurs.</p>
      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setParams({ mode: k }, { replace: true })} data-testid={`training-tab-${k}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'course' && <RushTrainer />}
      {tab === 'finales' && <EndgameTrainer />}
      {tab === 'erreurs' && <MistakesReview />}
    </div>
  );
}
