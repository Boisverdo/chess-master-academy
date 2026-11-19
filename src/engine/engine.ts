/**
 * Service moteur : pilote Stockfish par le protocole UCI.
 * Indépendant du transport (Web Worker dans le navigateur, module Node dans les tests).
 * Les demandes sont traitées une à une, dans l'ordre.
 */
import { parseBestMove, parseInfo, type PvLine } from './uci';

export interface UciTransport {
  send(command: string): void;
  onLine(listener: (line: string) => void): void;
  terminate(): void;
}

export interface SearchOptions {
  depth?: number;
  movetime?: number;
  multipv?: number;
  /** Niveau de jeu interne de Stockfish (0–20). 20 = pleine force. */
  skill?: number;
}

export interface SearchResult {
  fen: string;
  bestmove: string | null;
  /** Une ligne par variante, triées par multipv (1 = meilleure). Score du point de vue du camp au trait. */
  lines: PvLine[];
  depth: number;
}

export class EngineError extends Error {}

export class Engine {
  private queue: Promise<unknown> = Promise.resolve();
  private listener: ((line: string) => void) | null = null;
  private ready: Promise<void> | null = null;
  name = 'Stockfish';

  constructor(private readonly transport: UciTransport) {
    transport.onLine((line) => this.listener?.(line));
  }

  private waitFor(predicate: (line: string) => boolean, send: string[], timeoutMs = 20000): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const lines: string[] = [];
      const timer = setTimeout(() => {
        this.listener = null;
        reject(new EngineError('Le moteur ne répond pas.'));
      }, timeoutMs);
      this.listener = (line) => {
        lines.push(line);
        if (predicate(line)) {
          clearTimeout(timer);
          this.listener = null;
          resolve(lines);
        }
      };
      for (const c of send) this.transport.send(c);
    });
  }

  /** Initialise le moteur (une seule fois). */
  init(): Promise<void> {
    this.ready ??= this.enqueue(async () => {
      const lines = await this.waitFor((l) => l === 'uciok', ['uci'], 30000);
      const id = lines.find((l) => l.startsWith('id name '));
      if (id) this.name = id.slice(8);
      await this.waitFor((l) => l === 'readyok', ['isready']);
    });
    return this.ready;
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Nouvelle partie : vide la table de hachage. */
  async newGame(): Promise<void> {
    await this.init();
    await this.enqueue(() => this.waitFor((l) => l === 'readyok', ['ucinewgame', 'isready']));
  }

  /** Analyse une position. */
  async search(fen: string, opts: SearchOptions = {}): Promise<SearchResult> {
    await this.init();
    return this.enqueue(async () => {
      const multipv = opts.multipv ?? 1;
      const go = ['go'];
      if (opts.depth) go.push('depth', String(opts.depth));
      if (opts.movetime) go.push('movetime', String(opts.movetime));
      if (go.length === 1) go.push('depth', '12');
      const lines = await this.waitFor((l) => l.startsWith('bestmove'), [
        `setoption name Skill Level value ${opts.skill ?? 20}`,
        `setoption name MultiPV value ${multipv}`,
        `position fen ${fen}`,
        go.join(' '),
      ], 60000);
      const best = new Map<number, PvLine>();
      for (const l of lines) {
        const info = parseInfo(l);
        if (info && info.multipv <= multipv) best.set(info.multipv, info);
      }
      const bestmove = parseBestMove(lines.at(-1)!) ?? null;
      const sorted = [...best.values()].sort((a, b) => a.multipv - b.multipv);
      return { fen, bestmove, lines: sorted, depth: sorted[0]?.depth ?? 0 };
    });
  }

  terminate(): void {
    this.transport.terminate();
  }
}
