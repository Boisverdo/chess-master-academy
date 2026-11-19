import { expect, test } from '@playwright/test';
import { clickMove, dragMove, freshBoard, importPgn, playMoves } from './helpers';

const consoleErrors = new WeakMap<object, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  consoleErrors.set(page, errors);
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await freshBoard(page);
});

test.afterEach(async ({ page }) => {
  expect(consoleErrors.get(page), 'aucune erreur dans la console').toEqual([]);
});

test('partie complète jusqu’au mat (mat du berger) puis échiquier bloqué', async ({ page }) => {
  await playMoves(page, ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7']);
  await expect(page.getByTestId('status')).toHaveText('Échec et mat — les Blancs gagnent');
  await expect(page.locator('[data-ply]')).toHaveText(['e4', 'e5', '♗c4', '♞c6', '♕h5', '♞f6', '♕xf7#']);
  await clickMove(page, 'a7a6');
  await expect(page.locator('[data-ply]')).toHaveCount(7);
});

test('glisser-déposer', async ({ page }) => {
  await dragMove(page, 'g1f3');
  await expect(page.locator('[data-ply]')).toHaveCount(1);
  await expect(page.locator('[data-ply]')).toHaveText(['♘f3']);
});

test('un coup illégal est refusé', async ({ page }) => {
  await clickMove(page, 'e2e5');
  await clickMove(page, 'e7e5'); // pièce adverse : pas le trait
  await expect(page.locator('[data-ply]')).toHaveCount(0);
  await expect(page.getByTestId('status')).toHaveText('Trait aux Blancs');
});

test('petit roque', async ({ page }) => {
  await playMoves(page, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'e1g1']);
  await expect(page.locator('[data-ply]').last()).toHaveText('O-O');
});

test('prise en passant', async ({ page }) => {
  await playMoves(page, ['e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6']);
  await expect(page.locator('[data-ply]').last()).toHaveText('exd6');
});

test('échec signalé', async ({ page }) => {
  await playMoves(page, ['e2e4', 'f7f6', 'd1h5']);
  await expect(page.getByTestId('status')).toHaveText('Trait aux Noirs — échec !');
});

test('promotion : choix de la pièce et annulation', async ({ page }) => {
  await importPgn(page, '[SetUp "1"]\n[FEN "1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1"]\n\n*');
  await clickMove(page, 'a7a8');
  await page.getByRole('dialog', { name: 'Choisir la pièce de promotion' }).getByRole('button', { name: 'Annuler la promotion' }).click();
  await expect(page.locator('.promotion-overlay')).toHaveCount(0);
  await expect(page.locator('[data-ply]')).toHaveCount(0);
  await clickMove(page, 'a7b8');
  await page.getByTestId('promote-n').click();
  await expect(page.locator('[data-ply]')).toHaveText(['axb8=♘']);
});

test('navigation dans l’historique, reprise et annulation', async ({ page }) => {
  await playMoves(page, ['e2e4', 'e7e5', 'g1f3']);
  await page.getByRole('button', { name: 'Coup précédent' }).click();
  await expect(page.getByText('Vous consultez la position après le demi-coup 2 sur 3.')).toBeVisible();
  await clickMove(page, 'b1c3'); // échiquier en lecture seule pendant la consultation
  await expect(page.locator('[data-ply]')).toHaveCount(3);
  await page.keyboard.press('Home');
  await expect(page.getByText('après le demi-coup 0 sur 3')).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.locator('.view-banner')).toHaveCount(0);
  await page.locator('[data-ply="1"]').click();
  await page.getByRole('button', { name: "Reprendre d'ici" }).click();
  await page.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.locator('[data-ply]')).toHaveCount(1);
  await page.getByTestId('undo').click();
  await expect(page.locator('[data-ply]')).toHaveCount(0);
});

test('la partie est conservée après rechargement', async ({ page }) => {
  await playMoves(page, ['d2d4', 'd7d5']);
  await page.reload();
  await expect(page.locator('[data-ply]')).toHaveText(['d4', 'd5']);
});

test('abandon et nulle par accord', async ({ page }) => {
  await playMoves(page, ['e2e4']);
  await page.getByRole('button', { name: 'Abandonner' }).click();
  await page.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.getByTestId('status')).toHaveText('Les Noirs abandonnent — les Blancs gagnent');
  await page.getByTestId('undo').click();
  await page.getByRole('button', { name: 'Nulle par accord' }).click();
  await page.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.getByTestId('status')).toHaveText('Nulle par accord mutuel');
});

test('import PGN : pat, triple répétition et erreur claire', async ({ page }) => {
  await importPgn(page, '[SetUp "1"]\n[FEN "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"]\n\n*');
  await expect(page.getByTestId('status')).toHaveText('Pat — partie nulle');
  await importPgn(page, '1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8 *');
  await expect(page.getByTestId('status')).toHaveText('Nulle par triple répétition de la position');
  await importPgn(page, '1. e4 e5 2. Ke3 *');
  await expect(page.getByRole('alert')).toContainText('coup illégal');
});

test('notation française dans les paramètres', async ({ page }) => {
  await playMoves(page, ['g1f3']);
  await page.getByRole('link', { name: 'Paramètres' }).click();
  await page.getByTestId('setting-notation').selectOption('french');
  await page.getByRole('link', { name: 'Échiquier interactif' }).click();
  await expect(page.locator('[data-ply]')).toHaveText(['Cf3']);
});

test('les 12 sections sont accessibles', async ({ page }) => {
  const labels = ['Accueil', 'Mon apprentissage', 'Leçons', 'Échiquier interactif', 'Exercices tactiques', 'Ouvertures', "Jouer contre l'IA", 'Analyse des parties', 'Chess.com et mes parties', 'Mon entraîneur IA', 'Ma progression', 'Paramètres'];
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  for (const label of labels) {
    await nav.getByRole('link', { name: label }).click();
    await expect(page.locator('main h1, main [data-testid="board"]').first()).toBeVisible();
  }
});
