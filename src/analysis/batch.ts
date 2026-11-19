/** Analyse de plusieurs parties à la suite (pour alimenter les habitudes du joueur). */
import type { Engine } from '../engine/engine';
import type { GameRecord } from '../storage/db';
import { analyseRecord } from './service';

export interface BatchProgress {
  game: number;
  games: number;
  position: number;
  positions: number;
}

export async function analyseBatch(
  records: readonly GameRecord[],
  engine: Engine,
  opts: { onProgress?: (p: BatchProgress) => void; signal?: AbortSignal; depth?: number; movetime?: number } = {},
): Promise<number> {
  let done = 0;
  for (const [i, r] of records.entries()) {
    if (opts.signal?.aborted) break;
    await analyseRecord(r, engine, {
      depth: opts.depth ?? 12,
      movetime: opts.movetime ?? 700,
      signal: opts.signal,
      onProgress: (position, positions) => opts.onProgress?.({ game: i + 1, games: records.length, position, positions }),
    });
    done++;
  }
  return done;
}
