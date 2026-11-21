import { expect, test, type Page } from '@playwright/test';

/** Intégration Lichess avec une API SIMULÉE : aucune requête n'atteint le vrai service pendant les tests. */
test.describe.configure({ timeout: 120_000 });

const pgn = (id: string) => `[Event "rated blitz game"]\n[Site "https://lichess.org/${id}"]\n[White "Testeur-CMA"]\n[Black "Adversaire"]\n[Result "1-0"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0\n`;
const game = (id: string, over: Record<string, unknown> = {}) => ({
  id, rated: true, variant: 'standard', speed: 'blitz', createdAt: 1_795_000_000_000, lastMoveAt: 1_795_000_100_000, status: 'mate', winner: 'white',
  players: { white: { user: { name: 'Testeur-CMA', id: 'testeur-cma' }, rating: 1500 }, black: { user: { name: 'Adversaire', id: 'adversaire' }, rating: 1520 } },
  pgn: pgn(id), ...over,
});

async function mockLichess(page: Page, games: () => unknown[]) {
  const calls: string[] = [];
  await page.route('https://lichess.org/**', async (route) => {
    const url = new URL(route.request().url());
    calls.push(url.href);
    const h = { 'access-control-allow-origin': '*' };
    if (url.pathname === '/api/user/testeur-cma') {
      return route.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify({ id: 'testeur-cma', username: 'Testeur-CMA', url: 'https://lichess.org/@/Testeur-CMA', createdAt: 1_600_000_000_000, count: { all: 321 }, perfs: { blitz: { games: 300, rating: 1512, prov: false }, rapid: { games: 21, rating: 1640, prov: true } } }) });
    }
    if (url.pathname === '/api/games/user/testeur-cma') {
      return route.fulfill({ status: 200, contentType: 'application/x-ndjson', headers: h, body: games().map((g) => JSON.stringify(g)).join('\n') + '\n' });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', headers: h, body: '{"error":"Not found"}' });
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

test('Lichess : aucune requête sans consentement ; liaison, import, analyse, import automatique, déliaison', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let list = [game('aaaa0001'), game('bbbb0002', { variant: 'chess960' }), game('cccc0003', { speed: 'bullet' })];
  const calls = await mockLichess(page, () => list);
  await page.goto('./#/lichess');
  await page.getByTestId('lichess-username').fill('Testeur-CMA');
  await expect(page.getByTestId('lichess-search')).toBeDisabled();
  await page.getByTestId('lichess-consent').check();
  await page.getByTestId('lichess-search').click();
  await expect(page.getByTestId('lichess-found')).toContainText('Testeur-CMA');
  await expect(page.getByTestId('lichess-found')).toContainText('321 parties');
  expect(calls).toHaveLength(1);
  await page.getByTestId('lichess-confirm').click();
  await expect(page.getByTestId('lichess-profile')).toContainText('1512');
  await expect(page.getByTestId('lichess-profile')).toContainText('1640 ?');

  await page.getByTestId('lichess-import').click();
  await expect(page.getByTestId('lichess-summary')).toContainText('1 partie importée');
  await expect(page.getByTestId('lichess-summary')).toContainText('1 variante ignorée');
  await expect(page.getByTestId('lichess-summary')).toContainText('1 hors filtres');
  await page.getByTestId('lichess-import').click();
  await expect(page.getByTestId('lichess-summary')).toContainText('1 déjà présente');

  await page.getByTestId('batch-analyse').click();
  await expect(page.getByTestId('batch-done')).toContainText('1 partie analysée', { timeout: 90_000 });
  await page.goto('./#/analyse');
  await expect(page.getByText('Lichess ·').first()).toBeVisible();

  // Import automatique : désactivé par défaut, puis activé ; une nouvelle partie apparaît à l'ouverture.
  await page.goto('./#/lichess');
  await expect(page.getByTestId('lichess-auto-toggle')).not.toBeChecked();
  await page.getByTestId('lichess-auto-toggle').check();
  list = [game('dddd0004'), ...list];
  await page.goto('./#/');
  await page.reload();
  await expect(page.getByTestId('chesscom-auto-banner')).toContainText('1 nouvelle partie Lichess importée');
  const since = new URL(calls.at(-1)!).searchParams.get('since');
  expect(Number(since)).toBeGreaterThan(1_700_000_000_000);
  await page.getByTestId('chesscom-auto-banner').getByRole('link', { name: 'Les analyser' }).click();
  await expect(page).toHaveURL(/#\/lichess$/);

  await page.getByRole('button', { name: 'Délier ce compte' }).click();
  await page.getByRole('dialog').getByRole('checkbox').check();
  await page.getByTestId('lichess-disconnect').click();
  await expect(page.getByTestId('lichess-username')).toBeVisible();
  await page.goto('./#/analyse');
  await expect(page.getByText('Aucune partie pour l’instant')).toBeVisible();
  expect(calls.every((u) => u.startsWith('https://lichess.org/api/'))).toBe(true);
  expect(errors).toEqual([]);
});

test('Lichess : pseudo inconnu et service injoignable, messages clairs', async ({ page }) => {
  await mockLichess(page, () => []);
  await page.goto('./#/lichess');
  await page.getByTestId('lichess-username').fill('inconnu-total');
  await page.getByTestId('lichess-consent').check();
  await page.getByTestId('lichess-search').click();
  await expect(page.getByRole('alert')).toContainText('n’existe pas sur Lichess');
  await page.unroute('https://lichess.org/**');
  await page.route('https://lichess.org/**', (r) => r.abort());
  await page.getByTestId('lichess-search').click();
  await expect(page.getByRole('alert')).toContainText('injoignable');
});
