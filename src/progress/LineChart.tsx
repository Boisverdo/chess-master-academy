import { useId, useState } from 'react';
import type { Point } from './stats';

interface Props {
  title: string;
  points: readonly Point[];
  unit?: string;
  format?: (v: number) => string;
  /** Valeurs fixes de l'axe vertical (sinon : min/max des données). */
  domain?: [number, number];
}

const fmtDate = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/**
 * Courbe à une seule série : trait de 2 px, points ≥ 8 px avec anneau de la couleur du fond,
 * grille discrète, infobulle au survol et tableau de données accessible.
 */
export function LineChart({ title, points, unit = '', format = (v) => String(Math.round(v)), domain }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const id = useId();
  if (points.length === 0) return <p className="muted">Pas encore de données.</p>;
  const W = 600;
  const H = 180;
  const P = { l: 44, r: 16, t: 12, b: 26 };
  const vals = points.map((p) => p.value);
  let [lo, hi] = domain ?? [Math.min(...vals), Math.max(...vals)];
  if (hi - lo < 1) {
    lo -= 10;
    hi += 10;
  }
  const pad = (hi - lo) * 0.1;
  lo = domain ? lo : Math.floor((lo - pad) / 10) * 10;
  hi = domain ? hi : Math.ceil((hi + pad) / 10) * 10;
  const x = (i: number) => P.l + (points.length === 1 ? (W - P.l - P.r) / 2 : (i / (points.length - 1)) * (W - P.l - P.r));
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const ticks = [lo, (lo + hi) / 2, hi];
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const h = hover !== null ? points[hover] : undefined;
  const lastIdx = points.length - 1;

  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <span className="chart-title" id={id}>{title}</span>
        <button type="button" className="btn btn-small btn-ghost" onClick={() => setTable(!table)} aria-pressed={table}>
          {table ? 'Voir le graphique' : 'Voir les données'}
        </button>
      </figcaption>
      {table ? (
        <table className="summary-table chart-table" aria-labelledby={id}>
          <thead><tr><th>Date</th><th>Valeur</th></tr></thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}><th>{fmtDate(p.at)}{p.label ? ` · ${p.label}` : ''}</th><td>{format(p.value)}{unit}</td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="chart-wrap">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-labelledby={id}
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const px = ((e.clientX - r.left) / r.width) * W;
              const i = points.length === 1 ? 0 : Math.round(((px - P.l) / (W - P.l - P.r)) * (points.length - 1));
              setHover(Math.max(0, Math.min(points.length - 1, i)));
            }}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="chart-grid" />
                <text x={P.l - 6} y={y(t) + 4} textAnchor="end" className="chart-axis">{format(t)}</text>
              </g>
            ))}
            <text x={P.l} y={H - 6} className="chart-axis">{fmtDate(points[0]!.at)}</text>
            <text x={W - P.r} y={H - 6} textAnchor="end" className="chart-axis">{fmtDate(points[lastIdx]!.at)}</text>
            <path d={`${path} L${x(lastIdx)},${H - P.b} L${x(0)},${H - P.b} Z`} className="chart-area" />
            <path d={path} className="chart-line" />
            <circle cx={x(lastIdx)} cy={y(points[lastIdx]!.value)} r="4.5" className="chart-dot" />
            <text x={x(lastIdx) - 8} y={y(points[lastIdx]!.value) - 10} textAnchor="end" className="chart-value">{format(points[lastIdx]!.value)}{unit}</text>
            {h && (
              <g>
                <line x1={x(hover!)} x2={x(hover!)} y1={P.t} y2={H - P.b} className="chart-cross" />
                <circle cx={x(hover!)} cy={y(h.value)} r="5" className="chart-dot" />
              </g>
            )}
          </svg>
          {h && (
            <div className="chart-tip" style={{ left: `${(x(hover!) / W) * 100}%` }} role="status">
              <strong>{format(h.value)}{unit}</strong>
              <span>{fmtDate(h.at)}{h.label ? ` · ${h.label}` : ''}</span>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
