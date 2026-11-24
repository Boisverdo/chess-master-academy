import fs from 'node:fs';
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

test('mise à jour : seuls les fichiers modifiés sont téléchargés, et la nouvelle version attend « Recharger »', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30_000 }).toBe(true);
  const before = await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('cma-')));
  expect(before).toHaveLength(1);

  // Nouvelle version simulée (fichier servi à côté, sans toucher sw.js) : autre numéro de cache,
  // et un seul fichier dont le contenu « change ».
  const original = fs.readFileSync('dist/sw.js', 'utf8');
  const updated = original.replace(/const CACHE = 'cma-[^']+'/, "const CACHE = 'cma-test-maj'").replace(/("favicon\.svg",\s*")[0-9a-f]+"/, '$1changé"');
  expect(updated).toContain('cma-test-maj');
  expect(updated).toContain('"changé"');
  fs.writeFileSync('dist/sw-maj.js', updated);
  const downloaded: string[] = [];
  context.on('request', (r) => r.serviceWorker() && downloaded.push(new URL(r.url()).pathname.split('/').pop() || './'));
  try {
    await page.evaluate(() => navigator.serviceWorker.register('./sw-maj.js'));
    await expect(page.getByTestId('update-banner')).toContainText('Nouvelle version', { timeout: 30_000 });
    // Le cache de la version précédente a fourni tout le reste (moteur et exercices compris).
    expect(downloaded.filter((f) => !f.startsWith('sw'))).toEqual(['favicon.svg']);
    // La version en cours reste active tant qu'on ne recharge pas.
    expect(await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('cma-')).length)).toBe(2);

    await Promise.all([page.waitForEvent('load'), page.getByTestId('update-reload').click()]);
    // Après « Recharger », la page est servie par la nouvelle version. (L'application réenregistre
    // ensuite sw.js, propre à ce test : on ne vérifie donc pas la disparition du bandeau.)
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? '').catch(() => ''), { timeout: 30_000 }).toMatch(/sw-maj\.js$/);
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
  } finally {
    fs.rmSync('dist/sw-maj.js', { force: true });
  }
});
