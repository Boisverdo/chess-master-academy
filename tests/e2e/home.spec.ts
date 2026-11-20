import { expect, test } from '@playwright/test';

/** Accueil : premiers pas au premier lancement, puis tableau de bord fondé sur les données réelles. */
test('accueil : premiers pas, puis « Reprendre » la leçon commencée', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('./');
  await expect(page.getByTestId('home-start')).toContainText('Évaluation initiale');
  await expect(page.getByTestId('home-resume')).toHaveCount(0);

  // Une leçon commencée (sans être terminée) apparaît dans « Reprendre ».
  await page.goto('./#/lecons/regles-pat');
  await page.getByTestId('lesson-next').click();
  await page.goto('./');
  const resume = page.getByTestId('home-resume');
  await expect(resume).toContainText('Leçon : Le pat');
  await expect(resume).toContainText('Étape 2 sur');
  await expect(page.getByTestId('home-streak')).toHaveText('1 jour');
  await expect(page.getByTestId('home-session')).toContainText('Évaluation initiale'); // pas encore de profil
  await expect(page.getByTestId('home-daily')).toContainText('Relever le défi');

  await resume.getByRole('link').click();
  await expect(page).toHaveURL(/#\/lecons\/regles-pat$/);
  expect(errors).toEqual([]);
});
