/** Outils complémentaires de l'analyse : menace adverse, PGN annoté. */
import { ChessGame, type Color } from '../core/game';
import { moveFacts, pieceName, pvToSan } from '../coach/facts';
import type { Fmt } from '../coach/explain';
import type { Engine } from '../engine/engine';
import { CLASS_GLYPHS, type GameReview } from './review';

/** Même position, mais avec l'adversaire au trait (« si je passais mon tour »). */
export function nullMoveFen(fen: string): string | null {
  const g = ChessGame.create(fen);
  if (g.status().inCheck) return null;
  const parts = fen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[3] = '-';
  const flipped = parts.join(' ');
  try {
    const f = ChessGame.create(flipped);
    return f.status().inCheck ? null : flipped; // position impossible : le roi adverse serait en prise
  } catch {
    return null;
  }
}

/** « Que menaçait mon adversaire ? » — calculé par le moteur sur la position où l'adversaire jouerait. */
export async function describeThreat(engine: Engine, fen: string, me: Color, fmt: Fmt): Promise<string> {
  const g = ChessGame.create(fen);
  if (g.status().inCheck) return 'Tu étais en échec : la priorité absolue était de parer l’échec.';
  const nf = nullMoveFen(fen);
  if (!nf) return 'Impossible de calculer la menace dans cette position.';
  const r = await engine.search(nf, { depth: 12 });
  const line = r.lines[0];
  if (!r.bestmove || !line) return 'L’adversaire n’avait pas de coup dangereux.';
  const opp: Color = me === 'w' ? 'b' : 'w';
  const facts = moveFacts(nf, r.bestmove);
  if (!facts) return 'Impossible de calculer la menace.';
  const san = fmt(facts.san, opp);
  if (line.score.mate !== undefined && line.score.mate > 0) {
    const seq = pvToSan(nf, line.pv, line.score.mate * 2 - 1);
    return `Ton adversaire menaçait de mater en ${line.score.mate} : ${seq.map((s, i) => fmt(s, i % 2 === 0 ? opp : me)).join(' ')}.`;
  }
  if (facts.captured && facts.captured !== 'p') return `Ton adversaire menaçait ${san}, qui prendrait ${pieceName(facts.captured)}.`;
  if (facts.check) return `Ton adversaire menaçait ${san}, avec échec.`;
  if (facts.targets.length >= 2) return `Ton adversaire menaçait ${san}, qui attaquerait ${facts.targets.map((t) => pieceName(t)).join(' et ')} en même temps.`;
  if (line.score.cp !== undefined && line.score.cp < 80) return `Pas de menace concrète : la meilleure idée de l’adversaire était ${san}, sans gain immédiat.`;
  return `L’idée principale de l’adversaire était ${san}.`;
}

/** PGN annoté : symboles conventionnels (?!, ?, ??) et commentaires de l'entraîneur. */
export function annotatedPgn(baseHeaders: Record<string, string>, game: ChessGame, review: GameReview, comment: (ply: number) => string | undefined): string {
  const headers = { ...baseHeaders, Annotator: 'Chess Master Academy (Stockfish)' };
  const head = Object.entries(headers)
    .map(([k, v]) => `[${k} "${v.replace(/"/g, "'")}"]`)
    .join('\n');
  const startNo = Number(game.startFen.split(' ')[5] ?? 1) || 1;
  const blackFirst = game.startFen.split(' ')[1] === 'b';
  const tokens: string[] = [];
  game.plies.forEach((p, i) => {
    const moveNo = startNo + Math.floor((i + (blackFirst ? 1 : 0)) / 2);
    if (p.color === 'w') tokens.push(`${moveNo}.`);
    else if (i === 0) tokens.push(`${moveNo}...`);
    const m = review.moves[i]!;
    tokens.push(p.san + (CLASS_GLYPHS[m.cls] ?? ''));
    const c = comment(p.ply);
    if (c) tokens.push(`{${c.replace(/[{}]/g, '')}}`);
  });
  tokens.push(game.status().result);
  return `${head}\n\n${tokens.join(' ')}\n`;
}
