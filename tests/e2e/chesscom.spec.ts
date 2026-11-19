import { expect, test, type Page } from '@playwright/test';

/**
 * Intégration Chess.com avec une API SIMULÉE : aucune requête n'atteint le vrai service pendant les tests.
 * (L'accès réel a été vérifié séparément, voir docs/08-phase5-rapport.md.)
 */
test.describe.configure({ timeout: 120_000 });

const API = 'https://api.chess.com/pub/player/testeur-cma';

const pgn = (n: number, moves: string, result: string) => `[Event "Live Chess"]
[Site "Chess.com"]
[White "Testeur-CMA"]
[Black "Adversaire${n}"]
[Result "${result}"]
[Link "https://www.chess.com/game/live/${n}"]

${moves} ${result}
`;

const game = (n: number, over: Record<string, unknown> = {}) => ({
  url: `https://www.chess.com/game/live/${n}`,
  pgn: pgn(n, '1. e4 {[%clk 0:09:58]} 1... e5 {[%clk 0:09:57]} 2. Qh5 {[%clk 0:09:50]} 2... Nc6 3. Bc4 Nf6 4. Qxf7#', '1-0'),
  time_class: 'rapid',
  time_control: '600',
  end_time: 1_790_000_000 + n,
  rated: true,
  rules: 'chess',
  white: { username: 'Testeur-CMA', rating: 1100, result: 'win' },
  black: { username: `Adversaire${n}`, rating: 1150, result: 'checkmated' },
  ...over,
});

async function mockChessCom(page: Page, opts: { offline?: boolean } = {}) {
  const calls: string[] = [];
  await page.route('https://api.chess.com/**', async (route) => {
    const url = route.request().url();
    calls.push(url);
    if (opts.offline) return route.abort();
    const body: Record<string, unknown> = {
      [API]: { username: 'testeur-cma', name: 'Testeur', url: 'https://www.chess.com/member/testeur-cma', joined: 1_600_000_000 },
      [`${API}/stats`]: { chess_rapid: { last: { rating: 1100, date: 1 }, best: { rating: 1180, date: 1 }, record: { win: 10, loss: 8, draw: 2 } } },
      [`${API}/games/archives`]: { archives: [`${API}/games/2026/10`, `${API}/games/2026/11`] },
      [`${API}/games/2026/10`]: { games: [game(1), game(2, { rules: 'chess960' })] },
      [`${API}/games/2026/11`]: { games: [game(3, { pgn: pgn(3, '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6', '*').replace('[Result "*"]', '[Result "0-1"]') })] },
    };
    const b = body[url];
    await route.fulfill(b ? { status: 200, contentType: 'application/json', body: JSON.stringify(b), headers: { 'access-control-allow-origin': '*' } } : { status: 404, contentType: 'application/json', body: '{"message":"not found"}', headers: { 'access-control-allow-origin': '*' } });
  });
  return calls;
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('chess-master-academy');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  });
});

test('aucune requête sans consentement ; liaison, import, analyse groupée, entraîneur, déliaison', async ({ page }) => {
  const calls = await mockChessCom(page);
  await page.goto('./#/chesscom');
  await page.getByTestId('chesscom-username').fill('Testeur-CMA');
  await expect(page.getByTestId('chesscom-search')).toBeDisabled();
  expect(calls).toHaveLength(0);
  await page.getByTestId('chesscom-consent').check();
  await page.getByTestId('chesscom-search').click();
  await expect(page.getByTestId('chesscom-found')).toContainText('testeur-cma');
  await page.getByTestId('chesscom-confirm').click();
  await expect(page.getByTestId('chesscom-profile')).toContainText('1180');

  await page.getByTestId('chesscom-archives').click();
  await expect(page.getByText('octobre 2026')).toBeVisible();
  await page.getByTestId('chesscom-import').click();
  await expect(page.getByTestId('chesscom-summary')).toContainText('2 parties importées');
  await expect(page.getByTestId('chesscom-summary')).toContainText('1 variante ignorée');
  // Second import : aucun doublon ; le mois terminé (octobre) n'est pas redemandé.
  const before = calls.filter((u) => u.endsWith('/2026/10')).length;
  await page.getByTestId('chesscom-import').click();
  await expect(page.getByTestId('chesscom-summary')).toContainText('0 partie importée');
  await expect(page.getByTestId('chesscom-summary')).toContainText('2 déjà présentes');
  expect(calls.filter((u) => u.endsWith('/2026/10')).length).toBe(before);

  await page.getByTestId('batch-analyse').click();
  await expect(page.getByTestId('batch-done')).toContainText('2 parties analysées', { timeout: 90_000 });

  await page.goto('./#/analyse');
  await expect(page.getByText('Chess.com', { exact: false }).first()).toBeVisible();

  await page.goto('./#/chesscom');
  await page.getByRole('button', { name: 'Délier ce compte' }).click();
  await page.getByRole('dialog').getByRole('checkbox').check();
  await page.getByTestId('chesscom-disconnect').click();
  await expect(page.getByTestId('chesscom-username')).toBeVisible();
  await page.goto('./#/analyse');
  await expect(page.getByText('Aucune partie pour l’instant')).toBeVisible();
  expect(calls.every((u) => u.startsWith('https://api.chess.com/pub/player/testeur-cma'))).toBe(true);
});

test('pseudo inconnu et service injoignable : messages clairs', async ({ page }) => {
  await mockChessCom(page);
  await page.goto('./#/chesscom');
  await page.getByTestId('chesscom-username').fill('inconnu-total');
  await page.getByTestId('chesscom-consent').check();
  await page.getByTestId('chesscom-search').click();
  await expect(page.getByRole('alert')).toContainText('n’existe pas sur Chess.com');
  await page.getByTestId('chesscom-username').fill('a!');
  await page.getByTestId('chesscom-search').click();
  await expect(page.getByRole('alert')).toContainText('Pseudo invalide');
});

test('Chess.com hors ligne : le reste de l’application fonctionne', async ({ page }) => {
  await mockChessCom(page, { offline: true });
  await page.goto('./#/chesscom');
  await page.getByTestId('chesscom-username').fill('testeur-cma');
  await page.getByTestId('chesscom-consent').check();
  await page.getByTestId('chesscom-search').click();
  await expect(page.getByRole('alert')).toContainText('injoignable');
  await page.getByRole('link', { name: 'Leçons' }).click();
  await expect(page.getByRole('heading', { name: 'Leçons' })).toBeVisible();
});
