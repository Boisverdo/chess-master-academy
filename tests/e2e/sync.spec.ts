import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import data from '../../src/data/puzzles.json' with { type: 'json' };
import { clickMove } from './helpers';

/**
 * Synchronisation entre deux appareils (deux navigateurs isolés), avec Google simulé :
 * - la bibliothèque de connexion de Google est remplacée par une version de test qui accorde un jeton ;
 * - l'API Google Drive est remplacée par un faux Drive en mémoire, partagé par les deux « appareils ».
 * Le vrai service Google se teste avec ton compte, après publication.
 */
test.describe.configure({ timeout: 120_000 });

const puzzles: { id: string; moves: string }[] = data.puzzles;

class FakeDrive {
  file: { id: string; content: string } | null = null;
  tokens: string[] = [];
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS' };

async function makeDevice(context: BrowserContext, drive: FakeDrive, tokenSeconds = 3599): Promise<Page> {
  await context.addInitScript(() => {
    window.__CMA_TEST_GOOGLE_CLIENT_ID__ = 'client-test.apps.googleusercontent.com';
  });
  await context.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `window.google = { accounts: { oauth2: {
        initTokenClient: (cfg) => ({ requestAccessToken: () => setTimeout(() => cfg.callback({ access_token: 'jeton-' + Date.now(), expires_in: ${tokenSeconds}, scope: cfg.scope }), 20) }),
        hasGrantedAllScopes: () => true,
        revoke: (t, done) => done && done(),
      } } };`,
    }),
  );
  await context.route('https://www.googleapis.com/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const auth = req.headers()['authorization'] ?? '';
    if (!auth.startsWith('Bearer jeton-')) return route.fulfill({ status: 401, headers: CORS, body: '{}' });
    drive.tokens.push(auth);
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (req.method() === 'GET' && url.pathname === '/drive/v3/files') {
      expect(url.searchParams.get('spaces')).toBe('appDataFolder');
      return json({ files: drive.file ? [{ id: drive.file.id }] : [] });
    }
    if (req.method() === 'GET' && url.pathname.startsWith('/drive/v3/files/')) {
      if (!drive.file) return json({ error: 'notFound' }, 404);
      return route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: drive.file.content });
    }
    if (req.method() === 'POST' && url.pathname === '/upload/drive/v3/files') {
      const body = req.postData() ?? '';
      const parts = body.split(/--cma[a-z0-9]+/).filter((p) => p.includes('\r\n\r\n'));
      const meta = JSON.parse(parts[0]!.split('\r\n\r\n')[1]!) as { parents: string[] };
      expect(meta.parents).toEqual(['appDataFolder']);
      drive.file = { id: 'f1', content: parts[1]!.split('\r\n\r\n')[1]!.replace(/\r\n$/, '') };
      return json({ id: 'f1' });
    }
    if (req.method() === 'PATCH' && url.pathname.startsWith('/upload/drive/v3/files/')) {
      drive.file = { id: 'f1', content: req.postData() ?? '' };
      return json({ id: 'f1' });
    }
    if (req.method() === 'DELETE') {
      drive.file = null;
      return route.fulfill({ status: 204, headers: CORS });
    }
    return json({ error: 'inattendu' }, 400);
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  (page as Page & { errors: string[] }).errors = errors;
  await page.goto('./');
  return page;
}

async function connect(page: Page) {
  await page.goto('./#/parametres');
  const panel = page.getByTestId('sync-panel');
  await expect(panel).toContainText('aucun');
  await expect(page.getByTestId('sync-connect')).toBeDisabled();
  await page.getByTestId('sync-consent').check();
  await page.getByTestId('sync-connect').click();
  await expect(page.getByTestId('sync-status')).toContainText('Synchronisé');
}

async function finishPatLesson(page: Page) {
  await page.goto('./#/lecons/regles-pat');
  await page.getByTestId('lesson-next').click();
  await page.getByRole('button', { name: 'Pat : partie nulle' }).click();
  await page.getByTestId('lesson-next').click();
  await clickMove(page, 'g1g7');
  await expect(page.getByTestId('feedback')).toContainText('Mat');
  await page.getByRole('button', { name: 'Terminer' }).click();
  await expect(page.getByTestId('lesson-done')).toBeVisible();
}

const countAttempts = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open('chess-master-academy');
        req.onsuccess = () => {
          const c = req.result.transaction('attempts').objectStore('attempts').count();
          c.onsuccess = () => resolve(c.result);
        };
      }),
  );

test('deux appareils : la progression passe de l’un à l’autre, dans les deux sens', async ({ browser }) => {
  const drive = new FakeDrive();
  const pcContext = await browser.newContext();
  const phoneContext = await browser.newContext({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true });
  const pc = await makeDevice(pcContext, drive);
  const phone = await makeDevice(phoneContext, drive);

  // Le PC termine une leçon puis active la synchronisation.
  await finishPatLesson(pc);
  await connect(pc);
  expect(drive.file?.content).toContain('regles-pat');

  // Le téléphone active la synchronisation : il reçoit la leçon.
  await connect(phone);
  await phone.goto('./#/lecons');
  await expect(phone.getByRole('link', { name: /Le pat/ })).toContainText('Terminée');

  // Le téléphone résout un exercice : il est envoyé automatiquement (quelques secondes après).
  await phone.goto('./#/tactiques?theme=mat-en-1');
  await expect(phone.getByTestId('puzzle-prompt')).toContainText('mat en 1');
  await phone.getByTestId('board').scrollIntoViewIfNeeded();
  await phone.waitForTimeout(600); // le coup de l'adversaire est joué avec une animation
  const id = (await phone.locator('.eyebrow', { hasText: 'Exercice' }).textContent())!.match(/Exercice (\S+)/)![1]!;
  const solution = puzzles.find((p) => p.id === id)!.moves.split(' ');
  const before = await countAttempts(phone);
  await clickMove(phone, solution[1]!.slice(0, 4));
  await expect(phone.getByTestId('feedback')).toContainText(/résolu/i);
  await expect.poll(() => drive.file?.content.includes(`"${id}"`) ?? false, { timeout: 30_000 }).toBe(true);

  // Le PC le reçoit à sa synchronisation suivante.
  const pcBefore = await countAttempts(pc);
  await pc.getByTestId('sync-now').click();
  await expect(pc.getByTestId('sync-status')).toContainText('Synchronisé');
  await expect.poll(() => countAttempts(pc)).toBe(pcBefore + 1);
  expect(await countAttempts(phone)).toBe(before + 1);

  // Délier le téléphone en supprimant la copie sur Drive.
  await phone.goto('./#/parametres');
  await phone.getByTestId('sync-delete').click();
  await phone.getByRole('dialog').getByRole('button', { name: 'Supprimer la copie', exact: true }).click();
  await expect(phone.getByTestId('sync-message')).toContainText('copie sur Google Drive est supprimée');
  expect(drive.file).toBeNull();

  for (const p of [pc, phone]) expect((p as Page & { errors: string[] }).errors).toEqual([]);
  await pcContext.close();
  await phoneContext.close();
});

test('autorisation expirée : bandeau « Reprendre », puis envoi des changements', async ({ browser }) => {
  const drive = new FakeDrive();
  const context = await browser.newContext();
  // Jeton de test très court (61 s - 60 s de marge = 1 s) : l'autorisation expire presque aussitôt.
  const page = await makeDevice(context, drive, 61);
  await connect(page);
  await page.waitForTimeout(1500);
  await finishPatLesson(page);
  const banner = page.getByTestId('sync-banner');
  await expect(banner).toBeVisible({ timeout: 20_000 });
  await expect(banner).toContainText('en pause');
  expect(drive.file?.content).not.toContain('regles-pat');
  await page.getByTestId('sync-banner-resume').click();
  await expect.poll(() => drive.file?.content.includes('regles-pat') ?? false, { timeout: 15_000 }).toBe(true);
  expect((page as Page & { errors: string[] }).errors).toEqual([]);
  await context.close();
});

test('sans identifiant Google, la section l’indique et propose la sauvegarde manuelle', async ({ page }) => {
  await page.goto('./#/parametres');
  await expect(page.getByTestId('sync-panel')).toContainText('pas encore configurée');
});
