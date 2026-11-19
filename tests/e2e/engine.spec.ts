import { expect, test } from '@playwright/test';
import { clickMove } from './helpers';

/** Tests avec le vrai moteur Stockfish (WebAssembly) dans le navigateur. */
test.describe.configure({ timeout: 120_000 });

const consoleErrors = new WeakMap<object, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  consoleErrors.set(page, errors);
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('chess-master-academy');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  });
});

test.afterEach(async ({ page }) => {
  expect(consoleErrors.get(page), 'aucune erreur dans la console').toEqual([]);
});

const LEGAL = '[White "Légal"]\n[Black "Saint-Brie"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0';

test('partie contre l’ordinateur : réponse légale, commentaire, annulation, abandon puis analyse', async ({ page }) => {
  await page.goto('./#/jouer');
  await page.getByRole('button', { name: /1\. Débutant/ }).click();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('status')).toHaveText('À toi de jouer');
  await clickMove(page, 'e2e4');
  await expect(page.locator('[data-ply]')).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByTestId('coach')).toContainText('e4');
  await expect(page.getByTestId('status')).toHaveText('À toi de jouer');
  await page.getByTestId('takeback').click();
  await expect(page.locator('[data-ply]')).toHaveCount(0);
  await clickMove(page, 'd2d4');
  await expect(page.locator('[data-ply]')).toHaveCount(2, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Abandonner' }).click();
  await expect(page.getByTestId('status')).toContainText('Les Blancs abandonnent');
  await expect(page.getByTestId('analyse-game')).toBeEnabled();
  await page.getByTestId('analyse-game').click();
  await expect(page.getByTestId('summary')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('analysis-moves').locator('button')).toHaveCount(2);
});

test('analyse d’une partie importée : gaffe expliquée, menace, « Retente ta chance », entraîneur', async ({ page }) => {
  await page.goto('./#/analyse');
  await page.getByTestId('analysis-import').fill(LEGAL);
  await page.getByTestId('analysis-import-confirm').click();
  await page.getByRole('button', { name: 'Les Noirs', exact: true }).click();
  await page.getByTestId('start-analysis').click();
  await expect(page.getByTestId('critical')).toBeVisible({ timeout: 90_000 });
  await page.getByTestId('critical').getByRole('button', { name: /xd1/ }).click();
  const ex = page.getByTestId('move-explanation');
  await expect(ex).toContainText('Gaffe');
  await expect(ex).toContainText('forcer le mat en 2');
  await expect(ex).toContainText('Le coup recommandé était dxe5');

  await page.getByRole('tab', { name: 'Comprendre mon erreur' }).click();
  await page.getByRole('button', { name: 'Que menaçait mon adversaire ?' }).click();
  await expect(page.getByTestId('understand')).toContainText('menaçait', { timeout: 30_000 });
  await page.getByTestId('retry').click();
  await clickMove(page, 'd6e5');
  await expect(page.getByTestId('retry-feedback')).toContainText('Bien joué', { timeout: 30_000 });

  await page.getByRole('link', { name: 'Mon entraîneur IA' }).click();
  await expect(page.getByTestId('drill')).toBeVisible();
  await expect(page.getByTestId('habits')).toContainText('Menaces de mat non vues');
  await expect(page.getByTestId('habits')).toContainText('Ponctuel');
  await page.getByRole('button', { name: 'Voir la réponse' }).click();
  await expect(page.getByTestId('drill')).toContainText('Résultat enregistré');
});

test('échiquier : « Analyser cette partie » ouvre l’analyse', async ({ page }) => {
  await page.goto('./#/echiquier');
  await clickMove(page, 'e2e4');
  await clickMove(page, 'e7e5');
  await page.getByTestId('analyse-board-game').click();
  await expect(page.getByTestId('start-analysis')).toBeVisible();
});

test('pratiquer une ouverture contre l’ordinateur : la partie reprend après la ligne principale', async ({ page }) => {
  await page.goto('./#/ouvertures/sicilienne');
  await page.getByRole('tab', { name: 'S’entraîner' }).click();
  await page.getByRole('link', { name: /Jouer la suite de cette ouverture/ }).click();
  await expect(page.getByTestId('opening-select')).toHaveValue('sicilienne');
  await page.getByTestId('start-game').click();
  // 16 demi-coups de la ligne, puis l'ordinateur (Blancs) joue le 17e.
  await expect(page.locator('[data-ply]')).toHaveCount(17, { timeout: 30_000 });
  await expect(page.getByTestId('status')).toHaveText('À toi de jouer');
  await expect(page.getByTestId('takeback')).toBeDisabled();
});
