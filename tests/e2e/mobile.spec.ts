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
