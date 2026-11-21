import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { CmaDatabase, type GameRecord, type IntegrationRecord } from '../../storage/db';
import { disconnectIntegration, saveGameRecord, saveIntegration } from '../../storage/repo';
import { LichessClient, LichessError, normalizeLichessUsername, parseNdjson, safeLichessUrl, type LichessGame } from './client';
import { AUTO_INTERVAL_MS, importLichess, lichessAutoDue, runLichessAuto, toRecord } from './importer';

const PGN = '[Event "rated blitz game"]\n[Site "https://lichess.org/abcd1234"]\n[White "MonPseudo"]\n[Black "Adv"]\n[Result "1-0"]\n\n1. e4 { [%clk 0:03:00] } e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0\n';
const game = (id: string, over: Partial<LichessGame> = {}): LichessGame => ({
  id, rated: true, variant: 'standard', speed: 'blitz', createdAt: 1_790_000_000_000, lastMoveAt: 1_790_000_100_000, status: 'mate', winner: 'white',
  players: { white: { user: { name: 'MonPseudo', id: 'monpseudo' }, rating: 1500 }, black: { user: { name: 'Adv', id: 'adv' }, rating: 1550 } }, pgn: PGN, ...over,
});
const NOW = Date.UTC(2026, 10, 21, 12);

function api(routes: (url: string) => Response) {
  const calls: string[] = [];
  const headers: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input));
    headers.push(new Headers(init?.headers).get('Accept') ?? '');
    return routes(String(input));
  }) as typeof fetch;
  return { calls, headers, fetchImpl };
}
const ndjson = (games: LichessGame[]) => new Response(games.map((g) => JSON.stringify(g)).join('\n') + '\n', { status: 200 });

describe('Lichess : client de l’API publique', () => {
  it('pseudo validé, aucune URL arbitraire', () => {
    expect(normalizeLichessUsername(' @MonPseudo ')).toBe('monpseudo');
    expect(normalizeLichessUsername('https://lichess.org/@/Thibault')).toBe('thibault');
    expect(() => normalizeLichessUsername('a')).toThrow(LichessError);
    expect(() => normalizeLichessUsername('../api')).toThrow(LichessError);
    expect(safeLichessUrl('https://lichess.org/@/x')).toBe('https://lichess.org/@/x');
    expect(safeLichessUrl('javascript:alert(1)')).toBeNull();
    expect(safeLichessUrl('https://lichess.org.evil.com/')).toBeNull();
  });

  it('export des parties : NDJSON, filtres transmis, lignes illisibles ignorées', async () => {
    const a = api(() => new Response(`${JSON.stringify(game('aaaa1111'))}\n{oups\n\n${JSON.stringify(game('bbbb2222'))}\n`, { status: 200 }));
    const c = new LichessClient({ fetchImpl: a.fetchImpl });
    const games = await c.games('MonPseudo', { max: 50, since: 123, speeds: ['blitz', 'rapid'], ratedOnly: true });
    expect(games.map((g) => g.id)).toEqual(['aaaa1111', 'bbbb2222']);
    const u = new URL(a.calls[0]!);
    expect(u.origin + u.pathname).toBe('https://lichess.org/api/games/user/monpseudo');
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ max: '50', since: '123', perfType: 'blitz,rapid', rated: 'true', pgnInJson: 'true', finished: 'true' });
    expect(a.headers[0]).toBe('application/x-ndjson');
    expect(parseNdjson('')).toEqual([]);
  });

  it('429 : une minute d’attente, puis une seule nouvelle tentative ; 404 et réseau : messages clairs', async () => {
    const waits: number[] = [];
    let n = 0;
    const a = api(() => (n++ === 0 ? new Response('', { status: 429 }) : new Response(JSON.stringify({ id: 'x', username: 'X' }), { status: 200 })));
    const c = new LichessClient({ fetchImpl: a.fetchImpl, sleep: async (ms) => void waits.push(ms) });
    await expect(c.user('xx')).resolves.toMatchObject({ username: 'X' });
    expect(waits).toEqual([60_000]);

    const always = new LichessClient({ fetchImpl: api(() => new Response('', { status: 429 })).fetchImpl, sleep: async () => undefined });
    await expect(always.user('xx')).rejects.toThrow('limite temporairement');
    await expect(new LichessClient({ fetchImpl: api(() => new Response('{}', { status: 404 })).fetchImpl }).user('xx')).rejects.toThrow('n’existe pas');
    await expect(new LichessClient({ fetchImpl: (async () => { throw new TypeError('x'); }) as typeof fetch }).user('xx')).rejects.toThrow('injoignable');
    await expect(new LichessClient({ fetchImpl: api(() => new Response(JSON.stringify({ id: 'x', username: 'X', disabled: true }))).fetchImpl }).user('xx')).rejects.toThrow('fermé');
  });

  it('requêtes en série, jamais en parallèle', async () => {
    let active = 0;
    let max = 0;
    const fetchImpl = (async () => {
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return ndjson([]);
    }) as typeof fetch;
    const c = new LichessClient({ fetchImpl });
    await Promise.all([c.games('aa', { max: 1 }), c.games('bb', { max: 1 }), c.games('cc', { max: 1 })]);
    expect(max).toBe(1);
  });
});

describe('Lichess : import des parties', () => {
  const filters = { speeds: new Set(['blitz', 'rapid']), ratedOnly: false };

  it('conversion : camp du joueur, résultat, adversaire ordinateur, variantes, parties non terminées', () => {
    const v = toRecord(game('abcd1234'), 'MonPseudo', filters, new Set());
    expect(v).toMatchObject({ record: { source: 'lichess', userColor: 'w', result: '1-0', white: 'MonPseudo (1500)', black: 'Adv (1550)', externalId: 'https://lichess.org/abcd1234', timeClass: 'blitz', createdAt: 1_790_000_100_000 } });
    const ai = toRecord(game('ai000001', { players: { white: { aiLevel: 3 }, black: { user: { name: 'MonPseudo', id: 'monpseudo' }, rating: 1500 } } }), 'monpseudo', filters, new Set());
    expect(ai).toMatchObject({ record: { userColor: 'b', white: 'Ordinateur Lichess niveau 3' } });
    expect(toRecord(game('v1', { variant: 'chess960' }), 'x', filters, new Set())).toEqual({ skip: 'variants' });
    expect(toRecord(game('b1', { speed: 'bullet' }), 'x', filters, new Set())).toEqual({ skip: 'filtered' });
    expect(toRecord(game('c1', { rated: false }), 'x', { ...filters, ratedOnly: true }, new Set())).toEqual({ skip: 'filtered' });
    expect(toRecord(game('s1', { status: 'started' }), 'x', filters, new Set())).toEqual({ skip: 'invalid' });
    expect(toRecord(game('p1', { pgn: undefined }), 'x', filters, new Set())).toEqual({ skip: 'invalid' });
    expect(toRecord(game('d1'), 'x', filters, new Set(['https://lichess.org/d1']))).toEqual({ skip: 'duplicates' });
  });

  it('import : une requête, sans doublon, du plus ancien au plus récent', async () => {
    const a = api(() => ndjson([game('new00002', { createdAt: 2 }), game('old00001', { createdAt: 1 }), game('var00003', { variant: 'atomic' })]));
    const saved: Omit<GameRecord, 'id'>[] = [];
    const existing = new Set<string>();
    const deps = { existing, save: async (r: Omit<GameRecord, 'id'>) => saved.push(r) };
    const s = await importLichess(new LichessClient({ fetchImpl: a.fetchImpl }), 'monpseudo', { max: 50 }, filters, deps);
    expect(s).toMatchObject({ imported: 2, variants: 1 });
    expect(saved.map((g) => g.externalId)).toEqual(['https://lichess.org/old00001', 'https://lichess.org/new00002']);
    expect((await importLichess(new LichessClient({ fetchImpl: a.fetchImpl }), 'monpseudo', { max: 50 }, filters, deps)).duplicates).toBe(2);
    expect(a.calls).toHaveLength(2);
  });

  it('import automatique : désactivé par défaut, 6 heures entre deux vérifications, depuis la dernière', async () => {
    const linked = (over: Partial<IntegrationRecord> = {}): IntegrationRecord => ({ id: 'lichess', username: 'monpseudo', consentAt: NOW - 86_400_000, autoImport: { enabled: true, updatedAt: NOW - 3 * 86_400_000, timeClasses: ['blitz'], ratedOnly: false }, ...over });
    const a = api(() => ndjson([game('auto0001')]));
    const records: IntegrationRecord[] = [];
    const deps = { existing: async () => new Set<string>(), save: async () => undefined, saveIntegration: async (r: IntegrationRecord) => void records.push(r), now: NOW };
    const client = new LichessClient({ fetchImpl: a.fetchImpl });
    expect(await runLichessAuto(client, linked({ autoImport: undefined }), deps)).toEqual({ ran: false, reason: 'disabled' });
    expect(await runLichessAuto(client, linked({ lastAutoCheckAt: NOW - 3600_000 }), deps)).toEqual({ ran: false, reason: 'recent' });
    expect(a.calls).toEqual([]);
    expect(lichessAutoDue(linked({ lastAutoCheckAt: NOW - AUTO_INTERVAL_MS }), NOW)).toBe(true);

    const r = await runLichessAuto(client, linked({ lastAutoCheckAt: NOW - 7 * 3600_000 }), deps);
    expect(r).toMatchObject({ ran: true, summary: { imported: 1 } });
    expect(new URL(a.calls[0]!).searchParams.get('since')).toBe(String(NOW - 7 * 3600_000));
    expect(new URL(a.calls[0]!).searchParams.get('max')).toBe('100');
    expect(records[0]).toMatchObject({ lastAutoCheckAt: NOW });
    expect(records.at(-1)).toMatchObject({ lastAutoCheckAt: NOW, lastImportAt: NOW });
  });

  it('délier Lichess ne touche ni Chess.com ni ses parties', async () => {
    const d = new CmaDatabase(`lichess-${Math.random()}`);
    await saveIntegration({ id: 'chesscom', username: 'a', consentAt: 1 }, d);
    await saveIntegration({ id: 'lichess', username: 'b', consentAt: 1 }, d);
    const base = { createdAt: 1, pgn: PGN, white: 'a', black: 'b', result: '1-0' };
    await saveGameRecord({ ...base, source: 'chesscom', externalId: 'https://www.chess.com/game/live/1' }, d);
    await saveGameRecord({ ...base, source: 'lichess', externalId: 'https://lichess.org/abcd1234' }, d);
    expect(await disconnectIntegration(true, d, 'lichess')).toBe(1);
    expect((await d.integrations.toArray()).map((i) => i.id)).toEqual(['chesscom']);
    expect((await d.games.toArray()).map((g) => g.source)).toEqual(['chesscom']);
    expect(await d.tombstones.get('integration:lichess')).toBeTruthy();
  });
});
