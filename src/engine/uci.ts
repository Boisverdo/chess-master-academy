/** Lecture du protocole UCI (fonctions pures, testées). */

/** Score du point de vue du camp AU TRAIT (convention UCI). */
export type Score = { cp: number; mate?: undefined } | { mate: number; cp?: undefined };

export interface PvLine {
  multipv: number;
  depth: number;
  score: Score;
  /** Variante principale en notation UCI. */
  pv: string[];
}

export function parseInfo(line: string): PvLine | null {
  if (!line.startsWith('info ') || !line.includes(' pv ') || !line.includes(' score ')) return null;
  const tokens = line.split(/\s+/);
  const get = (key: string) => {
    const i = tokens.indexOf(key);
    return i >= 0 ? tokens[i + 1] : undefined;
  };
  const depth = Number(get('depth'));
  const multipv = Number(get('multipv') ?? 1);
  const si = tokens.indexOf('score');
  const kind = tokens[si + 1];
  const value = Number(tokens[si + 2]);
  // Les bornes (lowerbound / upperbound) sont des résultats partiels : on les ignore.
  if (tokens[si + 3] === 'lowerbound' || tokens[si + 3] === 'upperbound') return null;
  if (!Number.isFinite(depth) || !Number.isFinite(value)) return null;
  const score: Score = kind === 'mate' ? { mate: value } : { cp: value };
  const pv = tokens.slice(tokens.indexOf('pv') + 1).filter((t) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(t));
  if (pv.length === 0) return null;
  return { multipv, depth, score, pv };
}

export function parseBestMove(line: string): string | null | undefined {
  if (!line.startsWith('bestmove')) return undefined;
  const mv = line.split(/\s+/)[1];
  return mv && mv !== '(none)' ? mv : null;
}

/** Inverse le point de vue d'un score (côté au trait ↔ adversaire). */
export function flip(s: Score): Score {
  return s.mate !== undefined ? { mate: -s.mate } : { cp: -s.cp };
}

/** Score du point de vue des Blancs, à partir du score du camp au trait. */
export function toWhite(s: Score, turn: 'w' | 'b'): Score {
  return turn === 'w' ? s : flip(s);
}

/**
 * Probabilité de gain (0–100) d'après l'évaluation, formule publiée par Lichess.
 * Un mat est traduit en 100 (pour le camp qui mate) ou 0.
 */
export function winPercent(s: Score): number {
  if (s.mate !== undefined) return s.mate > 0 ? 100 : s.mate < 0 ? 0 : 50;
  const cp = Math.max(-1000, Math.min(1000, s.cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Affichage d'un score du point de vue des Blancs : « +1,4 », « −0,3 », « M3 », « −M2 ». */
export function formatScore(white: Score): string {
  if (white.mate !== undefined) return `${white.mate < 0 ? '−' : ''}M${Math.abs(white.mate)}`;
  const v = white.cp / 100;
  const txt = Math.abs(v).toFixed(1).replace('.', ',');
  return `${v > 0.05 ? '+' : v < -0.05 ? '−' : ''}${txt}`;
}
