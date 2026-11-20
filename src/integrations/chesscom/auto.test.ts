import { describe, expect, it } from 'vitest';
import type { GameRecord, IntegrationRecord } from '../../storage/db';
import { AUTO_INTERVAL_MS, autoDue, monthsToCheck, runAutoImport } from './auto';
import { API_ROOT, ChessComClient, type ChessComGame } from './client';

const P = `${API_ROOT}/player/monpseudo`;
const NOW = Date.UTC(2026, 10, 20, 12); // 20 novembre 2026
const PGN = '[White "MonPseudo"]\n[Black "Adv"]\n[Result "1-0"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0\n';
const game = (n: number, over: Partial<ChessComGame> = {}): ChessComGame => ({
  url: `https://www.chess.com/game/live/${n}`, pgn: PGN, time_class: 'rapid', time_control: '600', end_time: 1_790_000_000 + n, rated: true, rules: 'chess',
  white: { username: 'MonPseudo', rating: 1200, result: 'win' }, black: { username: 'Adv', rating: 1250, result: 'checkmated' }, ...over,
});

function setup(months: Record<string, ChessComGame[]>) {
  const calls: string[] = [];
  const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
  const client = new ChessComClient({
    spacingMs: 0,
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url === `${P}/games/archives`) return json({ archives: Object.keys(months).map((m) => `${P}/games/${m}`) });
      const m = url.slice(`${P}/games/`.length);
      return months[m] ? json({ games: months[m] }) : new Response('{}', { status: 404 });
    }) as typeof fetch,
  });
  const saved: Omit<GameRecord, 'id'>[] = [];
  const records: IntegrationRecord[] = [];
  const existing = new Set<string>();
  const deps = { existing: async () => new Set(existing), save: async (r: Omit<GameRecord, 'id'>) => saved.push(r), saveIntegration: async (r: IntegrationRecord) => void records.push(r), now: NOW };
  return { client, calls, saved, records, existing, deps };
}

const linked = (over: Partial<IntegrationRecord> = {}): IntegrationRecord => ({
  id: 'chesscom', username: 'monpseudo', consentAt: NOW - 90 * 86_400_000,
  autoImport: { enabled: true, updatedAt: NOW - 40 * 86_400_000, timeClasses: ['rapid', 'blitz'], ratedOnly: false }, ...over,
});

describe('import automatique Chess.com', () => {
  it('désactivé par défaut : aucune requête', async () => {
    const s = setup({});
    expect(await runAutoImport(s.client, linked({ autoImport: undefined }), s.deps)).toEqual({ ran: false, reason: 'disabled' });
    expect(await runAutoImport(s.client, linked({ autoImport: { enabled: false, updatedAt: NOW, timeClasses: ['rapid'], ratedOnly: false } }), s.deps)).toEqual({ ran: false, reason: 'disabled' });
    expect(s.calls).toEqual([]);
  });

  it('au plus une vérification toutes les 6 heures (sauf « Vérifier maintenant »)', async () => {
    expect(autoDue(linked({ lastAutoCheckAt: NOW - AUTO_INTERVAL_MS + 60_000 }), NOW)).toBe(false);
    expect(autoDue(linked({ lastAutoCheckAt: NOW - AUTO_INTERVAL_MS }), NOW)).toBe(true);
    expect(autoDue(linked(), NOW)).toBe(true);
    expect(autoDue(linked({ lastAutoCheckAt: NOW + 86_400_000 }), NOW)).toBe(true); // horloge reculée : on ne bloque pas indéfiniment
    const s = setup({ '2026/11': [] });
    expect(await runAutoImport(s.client, linked({ lastAutoCheckAt: NOW - 3600_000 }), s.deps)).toEqual({ ran: false, reason: 'recent' });
    expect(s.calls).toEqual([]);
    expect((await runAutoImport(s.client, linked({ lastAutoCheckAt: NOW - 3600_000 }), { ...s.deps, force: true })).ran).toBe(true);
  });

  it('seulement les mois depuis la dernière vérification, 3 au maximum', () => {
    const a = ['2026/06', '2026/07', '2026/08', '2026/09', '2026/10', '2026/11'].map((m) => `${P}/games/${m}`);
    expect(monthsToCheck(a, Date.UTC(2026, 9, 31, 23))).toEqual(a.slice(4));
    expect(monthsToCheck(a, Date.UTC(2026, 10, 1))).toEqual(a.slice(5));
    expect(monthsToCheck(a, Date.UTC(2025, 0, 1))).toEqual(a.slice(3));
  });

  it('importe les nouvelles parties selon les cadences choisies, sans doublon, et note la vérification', async () => {
    const s = setup({ '2026/09': [game(1)], '2026/10': [game(2), game(3, { time_class: 'bullet' })], '2026/11': [game(4), game(5, { rules: 'chess960' })] });
    s.existing.add(game(4).url);
    const r = await runAutoImport(s.client, linked({ lastAutoCheckAt: Date.UTC(2026, 9, 15) }), s.deps);
    expect(r).toMatchObject({ ran: true, months: 2, summary: { imported: 1, duplicates: 1, filtered: 1, variants: 1 } });
    expect(s.saved.map((g) => g.externalId)).toEqual([game(2).url]);
    expect(s.calls.some((u) => u.endsWith('/2026/09'))).toBe(false);
    // La vérification est notée avant les requêtes (une erreur ne relance pas tout à chaque ouverture), puis l'import.
    expect(s.records[0]).toMatchObject({ lastAutoCheckAt: NOW });
    expect(s.records.at(-1)).toMatchObject({ lastAutoCheckAt: NOW, lastImportAt: NOW });
    expect(s.calls.every((u) => u.startsWith(P))).toBe(true);
  });

  it('Chess.com injoignable : erreur remontée, mais la tentative est notée', async () => {
    const s = setup({});
    const client = new ChessComClient({ spacingMs: 0, fetchImpl: (async () => { throw new TypeError('offline'); }) as typeof fetch });
    await expect(runAutoImport(client, linked(), s.deps)).rejects.toThrow('injoignable');
    expect(s.records[0]).toMatchObject({ lastAutoCheckAt: NOW });
  });
});
