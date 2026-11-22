import { useMemo, useState } from 'react';
import { PlayableBoard } from '../../board/PlayableBoard';
import { ChessGame, type PromotionPiece, type Square } from '../../core/game';
import { formatSan } from '../../core/notation';
import { describeThreat } from '../../analysis/extras';
import { evaluatePosition } from '../../analysis/runner';
import type { Fmt } from '../../coach/explain';
import { judgeMove } from '../../coach/retry';
import { getEngine } from '../../engine/browser';
import type { Drill, GameRecord } from '../../storage/db';
import { recordDrill } from '../../storage/repo';
import { useSettings } from '../../ui/settings';

/** Rejouer un moment critique de ses propres parties, avec questions avant la réponse. */
export function DrillTrainer({ drill, remaining, source, onNext, title }: { drill: Drill; remaining: number; source?: GameRecord; onNext?: () => void; title?: string }) {
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
      <h2 className="panel-title">{title ?? `Position à retravailler (${remaining} en attente)`}</h2>
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
