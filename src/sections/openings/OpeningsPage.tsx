import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { findOpening, OPENINGS, sanList } from '../../learning/openings';
import type { Opening } from '../../learning/openings/types';
import { db, type OpeningProgress } from '../../storage/db';
import { useData } from '../../ui/useData';
import { LineViewer } from './LineViewer';
import { OpeningTrainer } from './OpeningTrainer';

const loadProgress = async () => new Map((await db.openings.toArray()).map((p) => [p.openingId, p]));

function reviewLabel(p: OpeningProgress | undefined): { text: string; due: boolean } {
  if (!p) return { text: 'Jamais pratiquée', due: false };
  const days = Math.ceil((p.due - Date.now()) / 86_400_000);
  if (days <= 0) return { text: 'À réviser', due: true };
  return { text: `Révision dans ${days} j`, due: false };
}

export function OpeningsPage() {
  const { data: progress } = useData(loadProgress);
  const group = (side: Opening['side'], title: string) => (
    <section className="panel">
      <h2 className="panel-title">{title}</h2>
      <div className="card-grid">
        {OPENINGS.filter((o) => o.side === side).map((o) => {
          const r = reviewLabel(progress?.get(o.id));
          return (
            <Link key={o.id} to={`/ouvertures/${o.id}`} className="card">
              <span className="card-title">{o.name}</span>
              <span className="muted small">{o.eco}</span>
              <span className="small">{o.summary}</span>
              <span className={`badge${r.due ? ' badge-due' : ''}`}>{r.text}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
  return (
    <div className="page page-wide">
      <h1>Ouvertures</h1>
      <p className="lead">Comprendre les idées avant de mémoriser les coups. Chaque ouverture se révise selon une répétition espacée.</p>
      {group('white', 'Pour les Blancs')}
      {group('black', 'Pour les Noirs')}
    </div>
  );
}

type Tab = 'presentation' | 'ligne' | 'variantes' | 'pieges' | 'entrainement';

export function OpeningDetail() {
  const { id = '' } = useParams();
  const opening = findOpening(id);
  const [tab, setTab] = useState<Tab>('presentation');
  const [variation, setVariation] = useState(0);
  const [trap, setTrap] = useState(0);
  if (!opening) {
    return (
      <div className="page">
        <h1>Ouverture introuvable</h1>
        <Link to="/ouvertures">Retour</Link>
      </div>
    );
  }
  const tabs: [Tab, string][] = [
    ['presentation', 'Idées et plans'],
    ['ligne', 'Ligne principale'],
    ['variantes', 'Variantes'],
    ['pieges', 'Pièges et erreurs'],
    ['entrainement', 'S’entraîner'],
  ];
  const v = opening.variations[variation];
  const t = opening.traps[trap];
  return (
    <div className="page page-wide">
      <p className="breadcrumb">
        <Link to="/ouvertures">Ouvertures</Link> › {opening.name}
      </p>
      <h1>
        {opening.name} <span className="muted small">{opening.eco}</span>
      </h1>
      <p className="lead">{opening.summary}</p>
      <div className="tabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'presentation' && (
        <div className="two-cols">
          <section className="panel">
            <h2 className="panel-title">Idées clés</h2>
            <ul>{opening.ideas.map((i) => <li key={i}>{i}</li>)}</ul>
          </section>
          <section className="panel">
            <h2 className="panel-title">Plans typiques</h2>
            <p><strong>Blancs</strong></p>
            <ul>{opening.plans.white.map((i) => <li key={i}>{i}</li>)}</ul>
            <p><strong>Noirs</strong></p>
            <ul>{opening.plans.black.map((i) => <li key={i}>{i}</li>)}</ul>
          </section>
        </div>
      )}

      {tab === 'ligne' && <LineViewer key="main" moves={opening.mainLine.map(([s]) => s)} comments={opening.mainLine.map(([, w]) => w)} orientation={opening.side} />}

      {tab === 'variantes' && v && (
        <>
          <div className="chips">
            {opening.variations.map((x, i) => (
              <button key={x.name} type="button" className={`chip${i === variation ? ' active' : ''}`} onClick={() => setVariation(i)}>{x.name}</button>
            ))}
          </div>
          <p>{v.idea}</p>
          <LineViewer key={v.name} moves={sanList(v.moves)} orientation={opening.side} startAtEnd />
        </>
      )}

      {tab === 'pieges' && (
        <>
          {t ? (
            <>
              <div className="chips">
                {opening.traps.map((x, i) => (
                  <button key={x.name} type="button" className={`chip${i === trap ? ' active' : ''}`} onClick={() => setTrap(i)}>{x.name}</button>
                ))}
              </div>
              <LineViewer key={t.name} moves={sanList(t.moves)} orientation={opening.side} conclusion={t.explanation} />
            </>
          ) : (
            <p className="muted">Pas de piège classique retenu pour cette ouverture : concentre-toi sur les erreurs typiques ci-dessous.</p>
          )}
          <section className="panel">
            <h2 className="panel-title">Erreurs typiques</h2>
            <ul>{opening.mistakes.map((m) => <li key={m}>{m}</li>)}</ul>
          </section>
        </>
      )}

      {tab === 'entrainement' && <OpeningTrainer key={opening.id} opening={opening} />}
    </div>
  );
}
