import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { CmaDatabase } from '../../storage/db';
import { disconnectIntegration, existingExternalIds, saveGameRecord, saveIntegration } from '../../storage/repo';
import { API_ROOT, ChessComClient, ChessComError, isPastMonth, normalizeUsername, type ChessComGame } from './client';
import { importMonths, toRecord } from './importer';

/** PGN au format de Chess.com (en-têtes, temps de pendule en commentaires). */
const PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.10.02"]
[White "MonPseudo"]
[Black "Adversaire"]
[Result "0-1"]
[TimeControl "600"]
[Termination "Adversaire won by resignation"]
[Link "https://www.chess.com/game/live/1"]

1. e4 {[%clk 0:09:58]} 1... e5 {[%clk 0:09:57]} 2. Qh5 {[%clk 0:09:50]} 2... Nc6 {[%clk 0:09:40]} 3. Bc4 {[%clk 0:09:30]} 3... g6 {[%clk 0:09:20]} 0-1
`;

const game = (over: Partial<ChessComGame> = {}): ChessComGame => ({
  url: 'https://www.chess.com/game/live/1',
  pgn: PGN,
  time_class: 'rapid',
  time_control: '600',
  end_time: 1_790_000_000,
  rated: true,
  rules: 'chess',
  white: { username: 'MonPseudo', rating: 1200, result: 'resigned' },
  black: { username: 'Adversaire', rating: 1250, result: 'win' },
  ...over,
});

function fakeApi(routes: Record<string, () => Response>) {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const r = routes[url];
    return r ? r() : new Response(JSON.stringify({ message: 'not found' }), { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, calls };
}
const json = (v: unknown, status = 200, headers: Record<string, string> = {}) => () => new Response(JSON.stringify(v), { status, headers });
const noSleep = async () => undefined;

describe('pseudo', () => {
  it('normalise et valide', () => {
    expect(normalizeUsername('  @MonPseudo ')).toBe('monpseudo');
    expect(() => normalizeUsername('a')).toThrow(ChessComError);
    expect(() => normalizeUsername('../../etc')).toThrow(ChessComError);
  });
});

describe('client PubAPI', () => {
  it('profil, pseudo inconnu, erreur réseau', async () => {
    const { fetchImpl } = fakeApi({ [`${API_ROOT}/player/monpseudo`]: json({ username: 'monpseudo', url: 'u' }) });
    const c = new ChessComClient({ fetchImpl, sleep: noSleep });
    expect((await c.profile('MonPseudo')).username).toBe('monpseudo');
    await expect(c.profile('inconnu')).rejects.toThrow('n’existe pas');
    const down = new ChessComClient({ fetchImpl: (() => Promise.reject(new TypeError('offline'))) as typeof fetch, sleep: noSleep });
    await expect(down.profile('monpseudo')).rejects.toThrow('injoignable');
  });

  it('429 : attend puis réessaie, en respectant Retry-After', async () => {
    let n = 0;
    const waits: number[] = [];
    const fetchImpl = (async () => (++n < 3 ? new Response('', { status: 429, headers: { 'Retry-After': '5' } }) : new Response(JSON.stringify({ username: 'x', url: 'u' })))) as typeof fetch;
    const c = new ChessComClient({ fetchImpl, sleep: async (ms) => void waits.push(ms), spacingMs: 0 });
    expect((await c.profile('monpseudo')).username).toBe('x');
    expect(waits).toEqual([5000, 5000]);
    const always = new ChessComClient({ fetchImpl: (async () => new Response('', { status: 429 })) as typeof fetch, sleep: noSleep, maxRetries: 2 });
    await expect(always.profile('monpseudo')).rejects.toThrow('limite temporairement');
  });

  it('requêtes en série, jamais en parallèle', async () => {
    let active = 0;
    let maxActive = 0;
    const fetchImpl = (async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return new Response(JSON.stringify({ username: 'x', url: 'u' }));
    }) as typeof fetch;
    const c = new ChessComClient({ fetchImpl, spacingMs: 0 });
    await Promise.all([c.profile('aaa'), c.profile('bbb'), c.stats('ccc')]);
    expect(maxActive).toBe(1);
  });

  it('archives : n’accepte que des adresses de l’API', async () => {
    const { fetchImpl } = fakeApi({
      [`${API_ROOT}/player/monpseudo/games/archives`]: json({ archives: [`${API_ROOT}/player/monpseudo/games/2026/10`, 'https://evil.example/x/games/2026/10'] }),
    });
    expect(await new ChessComClient({ fetchImpl, sleep: noSleep }).archives('monpseudo')).toEqual([`${API_ROOT}/player/monpseudo/games/2026/10`]);
  });

  it('un mois terminé est mis en cache et n’est plus redemandé ; le mois en cours l’est', async () => {
    const past = `${API_ROOT}/player/monpseudo/games/2026/09`;
    const current = `${API_ROOT}/player/monpseudo/games/2026/11`;
    const { fetchImpl, calls } = fakeApi({ [past]: json({ games: [game()] }), [current]: json({ games: [] }) });
    const store = new Map<string, unknown>();
    const c = new ChessComClient({ fetchImpl, sleep: noSleep, now: () => new Date('2026-11-19T12:00:00Z'), cache: { get: async (u) => store.get(u), set: async (u, v) => void store.set(u, v) } });
    await c.month(past);
    await c.month(past);
    await c.month(current);
    await c.month(current);
    expect(calls.filter((u) => u === past)).toHaveLength(1);
    expect(calls.filter((u) => u === current)).toHaveLength(2);
    expect(isPastMonth(past, new Date('2026-11-19'))).toBe(true);
  });
});

describe('import des parties', () => {
  const filters = { timeClasses: new Set(['rapid', 'blitz']), ratedOnly: false };

  it('camp du joueur, résultat et identifiant', () => {
    const v = toRecord(game(), 'monpseudo', filters, new Set());
    expect('record' in v && v.record).toMatchObject({ source: 'chesscom', userColor: 'w', result: '0-1', externalId: 'https://www.chess.com/game/live/1', timeClass: 'rapid' });
  });
  it('écarte variantes, doublons, cadences filtrées et PGN illisibles', () => {
    expect(toRecord(game({ rules: 'chess960' }), 'monpseudo', filters, new Set())).toEqual({ skip: 'variants' });
    expect(toRecord(game(), 'monpseudo', filters, new Set(['https://www.chess.com/game/live/1']))).toEqual({ skip: 'duplicates' });
    expect(toRecord(game({ time_class: 'bullet' }), 'monpseudo', filters, new Set())).toEqual({ skip: 'filtered' });
    expect(toRecord(game({ rated: false }), 'monpseudo', { ...filters, ratedOnly: true }, new Set())).toEqual({ skip: 'filtered' });
    expect(toRecord(game({ pgn: '1. e4 e5 2. Ke3 *' }), 'monpseudo', filters, new Set())).toEqual({ skip: 'invalid' });
  });
  it('import complet puis second import sans doublon', async () => {
    const url = `${API_ROOT}/player/monpseudo/games/2026/10`;
    const { fetchImpl } = fakeApi({ [url]: json({ games: [game(), game({ url: 'https://www.chess.com/game/live/2', rules: 'chess960' }), game({ url: 'https://www.chess.com/game/live/3' })] }) });
    const c = new ChessComClient({ fetchImpl, sleep: noSleep });
    const saved: unknown[] = [];
    const deps = { existing: new Set<string>(), save: async (r: unknown) => void saved.push(r) };
    expect(await importMonths(c, 'monpseudo', [url], filters, deps)).toMatchObject({ imported: 2, variants: 1 });
    expect(await importMonths(c, 'monpseudo', [url], filters, deps)).toMatchObject({ imported: 0, duplicates: 2 });
    expect(saved).toHaveLength(2);
  });
});

describe('données locales de l’intégration', () => {
  it('déconnexion : oublie le pseudo, garde ou supprime les parties', async () => {
    const d = new CmaDatabase('chesscom-test');
    await saveIntegration({ id: 'chesscom', username: 'monpseudo', consentAt: 1 }, d);
    await saveGameRecord({ source: 'chesscom', createdAt: 1, pgn: PGN, white: 'a', black: 'b', result: '0-1', externalId: 'x' }, d);
    await saveGameRecord({ source: 'ia', createdAt: 1, pgn: PGN, white: 'a', black: 'b', result: '0-1' }, d);
    expect(await existingExternalIds(d)).toEqual(new Set(['x']));
    expect(await disconnectIntegration(true, d)).toBe(1);
    expect(await d.integrations.count()).toBe(0);
    expect(await d.games.count()).toBe(1);
  });
});
