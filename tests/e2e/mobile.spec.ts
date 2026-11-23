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
  './#/ouvertures/italienne', './#/jouer', './#/analyse', './#/chesscom', './#/lichess', './#/entrainement', './#/entrainement?mode=finales', './#/entrainement?mode=erreurs', './#/entraineur', './#/progression',
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

// Navigation tactile : cibles d'au moins 40 px et champs à 16 px (sinon l'iPhone zoome pendant la saisie).
test('téléphone : boutons faciles à toucher et champs sans zoom automatique', async ({ page }) => {
  const problems: string[] = [];
  for (const url of ['./', './#/tactiques', './#/jouer', './#/analyse', './#/ouvertures/italienne', './#/parametres', './#/echiquier']) {
    await page.goto(url);
    await page.locator('main').waitFor();
    await page.waitForTimeout(300);
    problems.push(
      ...(await page.evaluate(() => {
        const out: string[] = [];
        const vw = document.documentElement.clientWidth;
        for (const el of document.querySelectorAll<HTMLElement>('main button, main a, main select, main input, main textarea')) {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || r.left >= vw || el.closest('cg-board, .cg-wrap')) continue;
          if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') continue;
          const name = `${location.hash || '/'} « ${(el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30)} »`;
          if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
            if ((el.closest('label') ?? el).getBoundingClientRect().height < 40) out.push(`case trop petite ${name}`);
            continue;
          }
          if (r.height < 40) out.push(`cible de ${Math.round(r.height)} px ${name}`);
          if (el.matches('select, textarea, input:not([type=file])') && parseFloat(getComputedStyle(el).fontSize) < 16) out.push(`champ < 16 px ${name}`);
        }
        return out;
      })),
    );
  }
  expect(problems).toEqual([]);
});

test('téléphone : vibration à chaque coup (réglable) et couleurs d’échiquier', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __vib: unknown[] }).__vib = [];
    Object.defineProperty(navigator, 'vibrate', { value: (p: unknown) => ((window as unknown as { __vib: unknown[] }).__vib.push(p), true) });
  });
  await freshBoard(page);
  const tap = async (sq: string) => { const c = await squareCenter(page, sq); await page.touchscreen.tap(c.x, c.y); };
  await tap('e2'); await tap('e4');
  await expect(page.locator('[data-ply]')).toHaveCount(1);
  expect(await page.evaluate(() => (window as unknown as { __vib: unknown[] }).__vib)).toEqual([12]);

  await page.goto('./#/parametres');
  await page.getByTestId('setting-vibration').uncheck();
  await page.getByTestId('setting-board-theme').selectOption('bois');
  await expect(page.getByTestId('board-swatch').locator('.dark').first()).toHaveCSS('background-color', 'rgb(169, 124, 86)');
  await page.goto('./#/echiquier');
  await expect(page.getByTestId('board').locator('cg-board')).toHaveCSS('background-color', 'rgb(236, 216, 180)');
  await tap('e7'); await tap('e5');
  await expect(page.locator('[data-ply]')).toHaveCount(2);
  expect(await page.evaluate(() => (window as unknown as { __vib: unknown[] }).__vib)).toHaveLength(1);
});

test('téléphone à l’horizontale : échiquier et coups côte à côte, sans débordement', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  for (const url of ['./#/echiquier', './#/jouer', './#/lecons/regles-roque', './#/tactiques', './#/ouvertures/italienne']) {
    await page.goto(url);
    await page.locator('main').waitFor();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), url).toBeLessThanOrEqual(0);
  }
  await page.goto('./#/echiquier');
  const board = await page.getByTestId('board').boundingBox();
  const moves = await page.locator('.side-panel').boundingBox();
  expect(board!.height).toBeLessThanOrEqual(390);
  expect(board!.height).toBeGreaterThan(250);
  expect(moves!.x).toBeGreaterThan(board!.x + board!.width - 1); // à droite de l'échiquier
});

test('téléphone : « Exercice suivant » remonte en haut du nouvel exercice', async ({ page }) => {
  await page.goto('./#/tactiques');
  await page.getByRole('button', { name: 'Voir la solution' }).click();
  const id = await page.locator('.eyebrow', { hasText: 'Exercice' }).textContent();
  await page.getByTestId('next-puzzle').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  await page.getByTestId('next-puzzle').tap();
  await expect(page.locator('.eyebrow', { hasText: 'Exercice' })).not.toHaveText(id!);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});
