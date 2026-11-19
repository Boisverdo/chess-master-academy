import type { MoveClass } from './review';

/** Barre verticale : part des Blancs = probabilité de gain des Blancs. */
export function EvalBar({ whiteWin, label, flipped }: { whiteWin: number; label: string; flipped: boolean }) {
  const w = Math.max(2, Math.min(98, whiteWin));
  return (
    <div className={`eval-bar${flipped ? ' flipped' : ''}`} role="img" aria-label={`Évaluation : ${label}`}>
      <div className="eval-white" style={{ height: `${w}%` }} />
      <span className="eval-label">{label}</span>
    </div>
  );
}

const MARK_COLORS: Partial<Record<MoveClass, string>> = { imprecision: 'var(--c-inacc)', erreur: 'var(--c-mistake)', gaffe: 'var(--c-blunder)' };

/** Graphique de la probabilité de gain des Blancs au fil de la partie (cliquable). */
export function EvalGraph({ whiteWin, classes, current, onSelect }: { whiteWin: number[]; classes: MoveClass[]; current: number; onSelect: (ply: number) => void }) {
  const W = 600;
  const H = 120;
  const n = Math.max(1, whiteWin.length - 1);
  const x = (i: number) => (i / n) * W;
  const y = (v: number) => H - (v / 100) * H;
  const pts = whiteWin.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg
      className="eval-graph"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Graphique de l’évaluation au fil de la partie"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onSelect(Math.round(((e.clientX - r.left) / r.width) * n));
      }}
    >
      <polygon points={`0,${H} ${pts} ${W},${H}`} className="eval-area" />
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="eval-mid" />
      <polyline points={pts} className="eval-line" />
      {classes.map((c, i) =>
        MARK_COLORS[c] ? <circle key={i} cx={x(i + 1)} cy={y(whiteWin[i + 1]!)} r="4" fill={MARK_COLORS[c]} /> : null,
      )}
      <line x1={x(current)} x2={x(current)} y1="0" y2={H} className="eval-cursor" />
    </svg>
  );
}
