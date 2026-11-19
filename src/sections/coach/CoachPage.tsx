import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlayableBoard } from '../../board/PlayableBoard';
import { ChessGame, type PromotionPiece, type Square } from '../../core/game';
import { formatSan } from '../../core/notation';
import { describeThreat } from '../../analysis/extras';
import { evaluatePosition } from '../../analysis/runner';
import { loadCoachData, type CoachData } from '../../coach/coachData';
import type { Fmt } from '../../coach/explain';
import { judgeMove } from '../../coach/retry';
import { getEngine } from '../../engine/browser';
import { ALL_LESSONS } from '../../learning/lessons';
import { HABIT_ACTIONS, recommend } from '../../learning/recommend';
import type { Drill } from '../../storage/db';
import { recordDrill } from '../../storage/repo';
import { useSettings } from '../../ui/settings';
import { useData } from '../../ui/useData';

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
        return <DrillTrainer key={drill.id} drill={drill} remaining={data.drillsDue.length} data={data} onNext={next ? () => setDrillId(next.id) : undefined} />;
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

/** Rejouer un moment critique de ses propres parties, avec questions avant la réponse. */
function DrillTrainer({ drill, remaining, data, onNext }: { drill: Drill; remaining: number; data: CoachData; onNext?: () => void }) {
  const { settings } = useSettings();
  const fmt: Fmt = (s, c) => formatSan(s, c, settings.notation);
  const game = useMemo(() => ChessGame.create(drill.fen), [drill.fen]);
  const me = game.turn;
  const [mistakes, setMistakes] = useState(0);
  const [threat, setThreat] = useState<string | null>(null);
  const [forcing, setForcing] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad' | 'info'; text: string } | null>(null);
  const [done, setDone] = useState(false);
  const [showBest, setShowBest] = useState(false);
  const [sync, setSync] = useState(0);
  const source = data.games.find((g) => g.id === drill.gameId);

  const listForcing = () => {
    const out: string[] = [];
    for (const [from, tos] of game.legalDests()) {
      for (const to of tos) {
        const n = game.play(from, to, game.isPromotion(from, to) ? 'q' : undefined)!;
        const p = n.plies.at(-1)!;
        if (p.captured || n.status().inCheck) out.push(fmt(p.san, me));
      }
    }
    setForcing(out);
  };

  const finish = async (success: boolean) => {
    setDone(true);
    await recordDrill(drill.id, success, mistakes);
  };

  const onMove = async (from: Square, to: Square, promotion?: PromotionPiece) => {
    if (done) return;
    setMsg({ tone: 'info', text: 'Le moteur évalue ton coup…' });
    setSync((k) => k + 1);
    try {
      const engine = await getEngine();
      const before = await evaluatePosition(engine, drill.fen, { depth: 12 });
      const v = await judgeMove(engine, before, `${from}${to}${promotion ?? ''}`, fmt);
      if (!v) return setMsg({ tone: 'bad', text: 'Coup illégal.' });
      if (v.ok) {
        setMsg({ tone: 'ok', text: `Bravo ! ${v.explanation.verdict}` });
        void finish(mistakes === 0);
      } else {
        setMistakes((m) => m + 1);
        setMsg({ tone: 'bad', text: `${v.explanation.verdict} ${v.explanation.sentences[0] ?? ''} Réessaie.` });
      }
    } catch (e) {
      setMsg({ tone: 'bad', text: e instanceof Error ? e.message : String(e) });
    }
  };

  const reveal = async () => {
    setShowBest(true);
    try {
      const engine = await getEngine();
      const before = await evaluatePosition(engine, drill.fen, { depth: 12 });
      const v = await judgeMove(engine, before, drill.played, fmt);
      const best = game.playUci(drill.best)?.plies.at(-1)?.san;
      setMsg({ tone: 'info', text: `${best ? `Le coup recommandé est ${fmt(best, me)}. ` : ''}${v ? `Dans ta partie — ${[v.explanation.verdict, ...v.explanation.sentences].join(' ')}` : ''}` });
    } catch {
      /* l'affichage de la flèche suffit */
    }
    void finish(false);
  };

  return (
    <section className="panel drill" data-testid="drill">
      <h2 className="panel-title">Position à retravailler ({remaining} en attente)</h2>
      <div className="lesson-grid">
        <div className="lesson-board">
          <PlayableBoard fen={drill.fen} orientation={me === 'w' ? 'white' : 'black'} interactive={!done} syncKey={sync} onMove={onMove} shapes={showBest ? [{ orig: drill.best.slice(0, 2), dest: drill.best.slice(2, 4), brush: 'green' }] : []} />
        </div>
        <div className="lesson-text">
          <p>
            Cette position vient de ta partie {source ? `${source.white} – ${source.black}` : ''} (coup {Math.ceil(drill.ply / 2)}). Tu y avais commis une erreur. Les {me === 'w' ? 'Blancs' : 'Noirs'} jouent : trouve un meilleur coup.
          </p>
          <p className="muted">Avant de jouer, réponds à ces questions :</p>
          <div className="row">
            <button type="button" className="btn btn-small" onClick={async () => { setThreat('Calcul…'); try { setThreat(await describeThreat(await getEngine(), drill.fen, me, fmt)); } catch (e) { setThreat(String(e)); } }}>Que menace mon adversaire ?</button>
            <button type="button" className="btn btn-small" onClick={listForcing}>Quels sont mes échecs et mes prises ?</button>
          </div>
          {threat && <p>{threat}</p>}
          {forcing && <p>{forcing.length ? `Tes coups forcés : ${forcing.join(', ')}.` : 'Tu n’as ni échec ni prise : cherche un coup qui crée une menace ou améliore une pièce.'}</p>}
          {msg && <div className={`feedback ${msg.tone}`} role="status">{msg.text}</div>}
          {!done && <button type="button" className="btn btn-small" onClick={reveal}>Voir la réponse</button>}
          {done && (
            <>
              <p className="muted small">Résultat enregistré. Cette position reviendra selon la répétition espacée.</p>
              {onNext && <button type="button" className="btn btn-primary" onClick={onNext}>Position suivante</button>}
            </>
          )}
        </div>
      </div>
    </section>
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

