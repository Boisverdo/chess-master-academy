import { Link } from 'react-router-dom';
import type { SectionDef } from '../ui/sections';
import { DataSettings } from './DataSettings';
import { SyncSettings } from './SyncSettings';
import { useSettings, type ThemeChoice } from '../ui/settings';
import type { NotationStyle } from '../core/notation';

export function PlannedPage({ section }: { section: SectionDef }) {
  return (
    <div className="page">
      <h1>{section.label}</h1>
      <p className="lead">{section.summary}</p>
      <section className="panel">
        <p className="badge">Prévu en Phase {section.phase}</p>
        <p>Cette section n'est pas encore construite. Elle comprendra :</p>
        <ul>
          {section.planned.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="muted">
          En attendant, l'<Link to="/echiquier">échiquier interactif</Link> est entièrement fonctionnel.
        </p>
      </section>
    </div>
  );
}

export function SettingsPage() {
  const { settings, update } = useSettings();
  return (
    <div className="page">
      <h1>Paramètres</h1>
      <section className="panel settings">
        <label className="field">
          <span>Notation des coups</span>
          <select value={settings.notation} onChange={(e) => update({ notation: e.target.value as NotationStyle })} data-testid="setting-notation">
            <option value="figurine">Figurines (♘f3)</option>
            <option value="french">Française (Cf3)</option>
            <option value="english">Anglaise (Nf3)</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.showLegalMoves} onChange={(e) => update({ showLegalMoves: e.target.checked })} />
          <span>Afficher les coups légaux de la pièce sélectionnée</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.coordinates} onChange={(e) => update({ coordinates: e.target.checked })} />
          <span>Afficher les coordonnées de l'échiquier</span>
        </label>
        <label className="field">
          <span>Thème</span>
          <select value={settings.theme} onChange={(e) => update({ theme: e.target.value as ThemeChoice })}>
            <option value="system">Comme le système</option>
            <option value="light">Clair</option>
            <option value="dark">Sombre</option>
          </select>
        </label>
        <p className="muted small">Vos préférences sont enregistrées sur cet appareil uniquement.</p>
      </section>
      <SyncSettings />
      <DataSettings />
    </div>
  );
}
