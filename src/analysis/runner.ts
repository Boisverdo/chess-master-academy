/** Lance l'analyse d'une partie position par position avec le moteur. */
import { ChessGame } from '../core/game';
import type { Engine } from '../engine/engine';
import type { PositionEval } from './review';

export interface AnalyseOptions {
  depth?: number;
  movetime?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export class AnalysisAborted extends Error {}

/** Évalue une position ; les positions finales (mat, nulle) sont décidées par les règles, pas par le moteur. */
export async function evaluatePosition(engine: Engine, fen: string, opts: { depth?: number; movetime?: number } = {}): Promise<PositionEval> {
  const s = ChessGame.create(fen).status();
  if (s.termination === 'checkmate') return { fen, score: { mate: 0 }, best: null, pv: [], depth: 0, terminal: 'checkmate' };
  if (s.over) return { fen, score: { cp: 0 }, best: null, pv: [], depth: 0, terminal: 'draw' };
  const r = await engine.search(fen, { depth: opts.depth ?? 14, movetime: opts.movetime });
  const line = r.lines[0];
  if (!line) throw new Error(`Aucune évaluation du moteur pour ${fen}`);
  return { fen, score: line.score, best: r.bestmove, pv: line.pv.slice(0, 10), depth: line.depth };
}

export async function analyseGame(engine: Engine, game: ChessGame, opts: AnalyseOptions = {}): Promise<PositionEval[]> {
  const fens = [game.startFen, ...game.plies.map((p) => p.fenAfter)];
  const out: PositionEval[] = [];
  for (const [i, fen] of fens.entries()) {
    if (opts.signal?.aborted) throw new AnalysisAborted('Analyse interrompue');
    // Une position répétée ou une fin de partie n'appellent pas le moteur.
    const status = i === fens.length - 1 ? game.status() : null;
    if (status?.over && status.termination !== 'checkmate' && status.termination !== 'stalemate' && status.termination !== 'insufficient-material' && status.termination !== 'threefold-repetition' && status.termination !== 'fifty-move-rule') {
      out.push(await evaluatePosition(engine, fen, opts)); // abandon, temps… : la position reste jouable
    } else if (status?.over) {
      const g = ChessGame.create(fen);
      out.push(status.termination === 'checkmate' || g.status().termination === 'checkmate'
        ? { fen, score: { mate: 0 }, best: null, pv: [], depth: 0, terminal: 'checkmate' }
        : { fen, score: { cp: 0 }, best: null, pv: [], depth: 0, terminal: 'draw' });
    } else {
      out.push(await evaluatePosition(engine, fen, opts));
    }
    opts.onProgress?.(i + 1, fens.length);
  }
  return out;
}
