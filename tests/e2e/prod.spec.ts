import { expect, test } from '@playwright/test';
import { clickMove } from './helpers';

/** Spécifique à la version de production : installable, hors ligne, politique de sécurité. */
test.describe.configure({ timeout: 120_000 });

test('manifeste et politique de sécurité présents', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /connect-src 'self' https:\/\/api\.chess\.com/);
  const manifest = await (await page.request.get('./manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Chess Master Academy', display: 'standalone', lang: 'fr' });
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).status()).toBe(200);
});

test('hors ligne : l’application, les leçons et le moteur fonctionnent sans réseau', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('./');
  // Attendre que le service soit actif, que tout soit en cache, puis qu'il contrôle la page.
  const ready = async () =>
    page.evaluate(async () => {
      for (let i = 0; i < 120; i++) {
        const keys = await caches.keys();
        const key = keys.find((k) => k.startsWith('cma-'));
        const n = key ? (await (await caches.open(key)).keys()).length : 0;
        if (navigator.serviceWorker.controller && n > 20) return n;
        await new Promise((r) => setTimeout(r, 500));
      }
      return 0;
    });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await ready()).toBeGreaterThan(20);
  // Hors ligne : toute requête réseau échoue (y compris celles du service de cache) ;
  // seul le cache local peut répondre. (La simulation « setOffline » de Playwright bloque
  // les navigations avant le service de cache : elle ne reproduit pas un vrai hors-ligne.)
  await context.route('**/*', (route) => route.abort('internetdisconnected'));
  await page.reload();
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('link', { name: 'Leçons' }).click();
  await expect(page.getByRole('heading', { name: 'Leçons' })).toBeVisible();
  await nav.getByRole('link', { name: 'Exercices tactiques' }).click();
  await expect(page.getByTestId('puzzle-prompt')).toBeVisible({ timeout: 30_000 });
  await nav.getByRole('link', { name: "Jouer contre l'IA" }).click();
  await page.getByTestId('start-game').click();
  await clickMove(page, 'e2e4');
  await expect(page.locator('[data-ply]')).toHaveCount(2, { timeout: 30_000 });
  await context.unrouteAll({ behavior: 'ignoreErrors' });
  expect(errors.filter((e) => !/Failed to load resource|net::ERR_/.test(e))).toEqual([]);
});
