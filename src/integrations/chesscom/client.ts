/**
 * Client de l'API publique de Chess.com (PubAPI) — lecture seule, données publiques.
 * Documentation : https://www.chess.com/news/view/published-data-api
 *
 * Règles respectées :
 * - une seule requête à la fois (jamais en parallèle), avec une courte pause entre deux requêtes ;
 * - reprise progressive après « 429 Too Many Requests » (en respectant Retry-After) ;
 * - les mois terminés ne changent plus : ils sont gardés en cache local et jamais retéléchargés ;
 * - aucune authentification, aucun mot de passe, aucune action sur le compte.
 *
 * Note : un navigateur ne permet pas de modifier l'en-tête User-Agent ; il envoie le sien.
 * L'API accepte ces requêtes (vérifié le 19/11/2026).
 */

export const API_ROOT = 'https://api.chess.com/pub';

export class ChessComError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ChessComError';
  }
}

export interface ChessComProfile {
  username: string;
  name?: string;
  url: string;
  avatar?: string;
  country?: string;
  joined?: number;
  last_online?: number;
  title?: string;
}

export interface RatingBlock {
  last?: { rating: number; date: number };
  best?: { rating: number; date: number };
  record?: { win: number; loss: number; draw: number };
}

export type ChessComStats = Partial<Record<'chess_rapid' | 'chess_blitz' | 'chess_bullet' | 'chess_daily', RatingBlock>> & {
  tactics?: { highest?: { rating: number } };
};

export interface ChessComPlayerRef {
  username: string;
  rating: number;
  result: string;
}

export interface ChessComGame {
  url: string;
  pgn?: string;
  time_class: 'bullet' | 'blitz' | 'rapid' | 'daily' | string;
  time_control: string;
  end_time: number;
  rated: boolean;
  rules: string;
  white: ChessComPlayerRef;
  black: ChessComPlayerRef;
}

export interface MonthCache {
  get(url: string): Promise<unknown | undefined>;
  set(url: string, value: unknown): Promise<void>;
}

export interface ClientOptions {
  fetchImpl?: typeof fetch;
  cache?: MonthCache;
  /** Pause entre deux requêtes (ms). */
  spacingMs?: number;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

/** Pseudos Chess.com : 3 à 25 caractères, lettres, chiffres, tiret et souligné. */
export function normalizeUsername(input: string): string {
  const u = input.trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9_-]{3,25}$/.test(u)) throw new ChessComError('Pseudo invalide : 3 à 25 caractères (lettres, chiffres, « - » ou « _ »).');
  return u.toLowerCase();
}

export class ChessComClient {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private chain: Promise<unknown> = Promise.resolve();
  private last = 0;
  /** Nombre de requêtes réseau réellement envoyées (transparence et tests). */
  requests = 0;

  constructor(private readonly opts: ClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? ((...a) => fetch(...a));
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Requêtes en série : la suivante attend la fin de la précédente. */
  private get<T>(url: string): Promise<T> {
    const run = this.chain.then(() => this.request<T>(url));
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async request<T>(url: string, attempt = 0): Promise<T> {
    const spacing = this.opts.spacingMs ?? 300;
    const wait = this.last + spacing - Date.now();
    if (wait > 0) await this.sleep(wait);
    let res: Response;
    try {
      this.requests++;
      res = await this.fetchImpl(url, { headers: { Accept: 'application/json' } });
    } catch {
      throw new ChessComError('Chess.com est injoignable (connexion Internet ?). Le reste de l’application fonctionne normalement.');
    } finally {
      this.last = Date.now();
    }
    if (res.status === 429) {
      if (attempt >= (this.opts.maxRetries ?? 3)) throw new ChessComError('Chess.com limite temporairement les requêtes. Réessaie dans quelques minutes.', 429);
      const retryAfter = Number(res.headers.get('Retry-After'));
      await this.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt);
      return this.request<T>(url, attempt + 1);
    }
    if (res.status === 404) throw new ChessComError('Ce pseudo n’existe pas sur Chess.com.', 404);
    if (res.status === 410) throw new ChessComError('Ces données ne sont plus disponibles sur Chess.com.', 410);
    if (res.status === 403) throw new ChessComError('Chess.com a refusé la requête (403).', 403);
    if (!res.ok) throw new ChessComError(`Réponse inattendue de Chess.com (${res.status}).`, res.status);
    try {
      return (await res.json()) as T;
    } catch {
      throw new ChessComError('Réponse illisible de Chess.com.');
    }
  }

  profile(username: string): Promise<ChessComProfile> {
    return this.get(`${API_ROOT}/player/${encodeURIComponent(normalizeUsername(username))}`);
  }

  stats(username: string): Promise<ChessComStats> {
    return this.get(`${API_ROOT}/player/${encodeURIComponent(normalizeUsername(username))}/stats`);
  }

  async archives(username: string): Promise<string[]> {
    const r = await this.get<{ archives?: string[] }>(`${API_ROOT}/player/${encodeURIComponent(normalizeUsername(username))}/games/archives`);
    const prefix = `${API_ROOT}/player/`;
    // On ne suit que des adresses de l'API elle-même (jamais une URL arbitraire reçue).
    return (r.archives ?? []).filter((u) => u.startsWith(prefix) && /\/games\/\d{4}\/\d{2}$/.test(u));
  }

  /** Parties d'un mois. Un mois terminé est mis en cache et n'est plus jamais redemandé. */
  async month(archiveUrl: string): Promise<ChessComGame[]> {
    if (!archiveUrl.startsWith(`${API_ROOT}/player/`)) throw new ChessComError('Adresse d’archive invalide.');
    const cached = (await this.opts.cache?.get(archiveUrl)) as ChessComGame[] | undefined;
    if (cached) return cached;
    const r = await this.get<{ games?: ChessComGame[] }>(archiveUrl);
    const games = r.games ?? [];
    if (isPastMonth(archiveUrl, (this.opts.now ?? (() => new Date()))())) await this.opts.cache?.set(archiveUrl, games);
    return games;
  }
}

/**
 * Adresse de profil sûre à afficher comme lien : uniquement https://www.chess.com/…
 * (une donnée reçue d'un service externe ne doit jamais devenir un lien « javascript: »).
 */
export function safeChessComUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'www.chess.com' || u.hostname === 'chess.com') ? u.href : null;
  } catch {
    return null;
  }
}

export function archiveLabel(url: string): { year: number; month: number; label: string } {
  const m = url.match(/(\d{4})\/(\d{2})$/);
  const year = Number(m?.[1]);
  const month = Number(m?.[2]);
  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { year, month, label };
}

export function isPastMonth(url: string, now: Date): boolean {
  const { year, month } = archiveLabel(url);
  return year < now.getUTCFullYear() || (year === now.getUTCFullYear() && month < now.getUTCMonth() + 1);
}
