import { expect, test } from '@playwright/test';
import { freshBoard, squareCenter } from './helpers';

test('téléphone : menu, échiquier tactile et pas de défilement horizontal', async ({ page }) => {
  await freshBoard(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  const a = await squareCenter(page, 'e2');
  const b = await squareCenter(page, 'e4');
  await page.touchscreen.tap(a.x, a.y);
  await page.touchscreen.tap(b.x, b.y);
  await expect(page.locator('[data-ply]')).toHaveCount(1);
  await expect(page.locator('[data-ply]')).toHaveText(['e4']);

  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('link', { name: 'Paramètres' }).click();
  await expect(page.getByRole('heading', { name: 'Paramètres' })).toBeVisible();
});

// Chaque écran doit tenir dans la largeur du téléphone (défaut trouvé sur « Jouer » après publication).
const SCREENS = ['./', './#/echiquier', './#/lecons', './#/lecons/regles-roque', './#/tactiques', './#/ouvertures',
  './#/ouvertures/italienne', './#/jouer', './#/analyse', './#/chesscom', './#/entraineur', './#/progression',
  './#/parametres', './#/evaluation', './#/apprentissage'];
test('téléphone : aucun écran ne déborde horizontalement', async ({ page }) => {
  const wide: string[] = [];
  for (const url of SCREENS) {
    await page.goto(url);
    await page.locator('main').waitFor();
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) wide.push(`${url} (+${overflow} px)`);
  }
  expect(wide).toEqual([]);
});
