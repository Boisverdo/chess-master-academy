/**
 * Client de l'API publique de Lichess — lecture seule, données publiques, sans connexion au compte.
 * Documentation officielle : https://lichess.org/api (spécification : github.com/lichess-org/api)
 *
 * Règles respectées (documentation Lichess) :
 * - une seule requête à la fois ;
 * - après « 429 Too Many Requests », attendre une minute entière avant de reprendre ;
 * - aucune authentification : les parties d'un joueur sont publiques (export anonyme documenté).
 *   Lichess propose aussi OAuth, inutile ici : on ne lit que des données publiques.
 *
 * Vérifié le 21/11/2026 depuis un navigateur : profil et export des parties répondent avec
 * « Access-Control-Allow-Origin: * » (les outils en ligne de commande sans en-tête navigateur reçoivent 404).
 */

export const LICHESS_ROOT = 'https://lichess.org';

export class LichessError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LichessError';
  }
}

export interface LichessPerf {
  games: number;
  rating: number;
  prov?: boolean;
}

export type LichessSpeed = 'ultraBullet' | 'bullet' | 'blitz' | 'rapid' | 'classical' | 'correspondence';

export interface LichessUser {
  id: string;
  username: string;
  title?: string;
  url?: string;
  createdAt?: number;
  disabled?: boolean;
  tosViolation?: boolean;
  perfs?: Partial<Record<LichessSpeed, LichessPerf>>;
  count?: { all?: number; win?: number; loss?: number; draw?: number };
}

export interface LichessPlayer {
  user?: { name: string; id: string; title?: string };
  rating?: number;
  aiLevel?: number;
}

export interface LichessGame {
  id: string;
  rated: boolean;
  variant: string;
  speed: string;
  perf?: string;
  createdAt: number;
  lastMoveAt?: number;
  status: string;
  players: { white: LichessPlayer; black: LichessPlayer };
  winner?: 'white' | 'black';
  pgn?: string;
}

export interface LichessClientOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Attente après un 429 (une minute, selon la documentation Lichess). */
  retryAfterMs?: number;
}

/** Pseudos Lichess : 2 à 30 caractères, lettres, chiffres, tiret et souligné. */
export function normalizeLichessUsername(input: string): string {
  const u = input.trim().replace(/^@/, '').replace(/^https?:\/\/lichess\.org\/@\//, '');
  if (!/^[A-Za-z0-9_-]{2,30}$/.test(u)) throw new LichessError('Pseudo invalide : 2 à 30 caractères (lettres, chiffres, « - » ou « _ »).');
  return u.toLowerCase();
}

export interface GamesQuery {
  /** Parties jouées depuis cette date (ms). */
  since?: number;
  max: number;
  speeds?: readonly string[];
  ratedOnly?: boolean;
}

export class LichessClient {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private chain: Promise<unknown> = Promise.resolve();
  /** Nombre de requêtes réseau réellement envoyées (transparence et tests). */
  requests = 0;

  constructor(private readonly opts: LichessClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? ((...a) => fetch(...a));
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Requêtes en série : la suivante attend la fin de la précédente. */
  private get(url: string, accept: string): Promise<string> {
    const run = this.chain.then(() => this.request(url, accept));
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async request(url: string, accept: string, retried = false): Promise<string> {
    let res: Response;
    try {
      this.requests++;
      res = await this.fetchImpl(url, { headers: { Accept: accept } });
    } catch {
      throw new LichessError('Lichess est injoignable (connexion Internet ?). Le reste de l’application fonctionne normalement.');
    }
    if (res.status === 429) {
      if (retried) throw new LichessError('Lichess limite temporairement les requêtes. Réessaie dans quelques minutes.', 429);
      await this.sleep(this.opts.retryAfterMs ?? 60_000);
      return this.request(url, accept, true);
    }
    if (res.status === 404) throw new LichessError('Ce pseudo n’existe pas sur Lichess.', 404);
    if (!res.ok) throw new LichessError(`Réponse inattendue de Lichess (${res.status}).`, res.status);
    return res.text();
  }

  async user(username: string): Promise<LichessUser> {
    const text = await this.get(`${LICHESS_ROOT}/api/user/${encodeURIComponent(normalizeLichessUsername(username))}`, 'application/json');
    let u: LichessUser;
    try {
      u = JSON.parse(text) as LichessUser;
    } catch {
      throw new LichessError('Réponse illisible de Lichess.');
    }
    if (u.disabled) throw new LichessError('Ce compte Lichess est fermé.');
    return u;
  }

  /** Parties terminées du joueur, de la plus récente à la plus ancienne (format NDJSON, PGN inclus). */
  async games(username: string, q: GamesQuery): Promise<LichessGame[]> {
    const p = new URLSearchParams({ max: String(q.max), pgnInJson: 'true', clocks: 'true', opening: 'true', finished: 'true' });
    if (q.since) p.set('since', String(q.since));
    if (q.speeds?.length) p.set('perfType', q.speeds.join(','));
    if (q.ratedOnly) p.set('rated', 'true');
    const text = await this.get(`${LICHESS_ROOT}/api/games/user/${encodeURIComponent(normalizeLichessUsername(username))}?${p}`, 'application/x-ndjson');
    // Lichess peut renvoyer un peu plus que « max » (constaté le 21/11/2026 : 60 pour 50) : on s'en tient au nombre demandé.
    return parseNdjson(text).slice(0, q.max);
  }
}

export function parseNdjson(text: string): LichessGame[] {
  const out: LichessGame[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const g = JSON.parse(line) as LichessGame;
      if (g && typeof g.id === 'string') out.push(g);
    } catch {
      // Ligne illisible : ignorée (comptée comme absente).
    }
  }
  return out;
}

/** Adresse sûre à afficher comme lien : uniquement https://lichess.org/… */
export function safeLichessUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'lichess.org' ? u.href : null;
  } catch {
    return null;
  }
}

/** Identifiant de partie Lichess : 8 caractères alphanumériques. */
export const gameUrl = (id: string): string => `${LICHESS_ROOT}/${id.replace(/[^A-Za-z0-9]/g, '').slice(0, 12)}`;
