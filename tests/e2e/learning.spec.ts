import { expect, test, type Page } from '@playwright/test';
import data from '../../src/data/puzzles.json' with { type: 'json' };
import { clickMove, squareCenter } from './helpers';

const puzzles: { id: string; moves: string }[] = data.puzzles;

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

const next = (page: Page) => page.getByTestId('lesson-next').click();

test('leçon complète : choix, erreur expliquée (pat), réussite et progression enregistrée', async ({ page }) => {
  await page.goto('./#/lecons/regles-pat');
  await next(page);
  await page.getByRole('button', { name: 'Pat : partie nulle' }).click();
  await expect(page.getByTestId('feedback')).toContainText('le roi n’est pas en échec');
  await next(page);
  await clickMove(page, 'g1g6');
  await expect(page.getByTestId('feedback')).toContainText('Pat !');
  await clickMove(page, 'g1g7');
  await expect(page.getByTestId('feedback')).toContainText('Mat');
  await page.getByRole('button', { name: 'Terminer' }).click();
  await expect(page.getByTestId('lesson-done')).toContainText('1 exercice réussi du premier coup sur 2');
  await page.getByRole('link', { name: 'Toutes les leçons' }).click();
  await expect(page.getByRole('link', { name: /Le pat/ })).toContainText('Terminée · 1/2 du premier coup');
});

test('exercice de coordonnées : clic sur une case', async ({ page }) => {
  await page.goto('./#/lecons/regles-echiquier');
  await next(page);
  await next(page);
  const d4 = await squareCenter(page, 'd4');
  await page.mouse.click(d4.x, d4.y);
  await expect(page.getByTestId('feedback')).toContainText('Tu as cliqué sur d4');
  await expect(page.getByTestId('lesson-next')).toBeDisabled();
  const e4 = await squareCenter(page, 'e4');
  await page.mouse.click(e4.x, e4.y);
  await expect(page.getByTestId('feedback')).toContainText('Exact : e4');
  await expect(page.getByTestId('lesson-next')).toBeEnabled();
});

test('exercice tactique : indice, résolution et explication factuelle', async ({ page }) => {
  await page.goto('./#/tactiques?theme=mat-en-1');
  await expect(page.getByTestId('puzzle-prompt')).toContainText('font mat en 1');
  const id = (await page.locator('.eyebrow', { hasText: 'Exercice' }).textContent())!.match(/Exercice (\S+)/)![1]!;
  const solution = puzzles.find((p) => p.id === id)!.moves.split(' ');
  await page.getByTestId('hint').click();
  await expect(page.getByText('Indice 1 — Motif : Mat en 1.')).toBeVisible();
  await clickMove(page, solution[1]!.slice(0, 4));
  await expect(page.getByTestId('feedback')).toContainText('Résolu avec indices');
  await expect(page.getByTestId('explanation')).toContainText('échec et mat');
  await expect(page.getByTestId('explanation')).not.toContainText('attaque le roi');
  // Sans évaluation initiale, aucune cote n'est suivie : l'application invite à la faire.
  await expect(page.locator('.notice')).toContainText('évaluation initiale');
});

test('entraînement d’ouverture : erreur expliquée, ligne terminée, révision planifiée', async ({ page }) => {
  await page.goto('./#/ouvertures/italienne');
  await page.getByRole('tab', { name: 'S’entraîner' }).click();
  await clickMove(page, 'e2e4');
  await expect(page.getByTestId('feedback')).toContainText('Occupe le centre');
  await expect(page.getByRole('heading', { name: 'À toi de jouer' })).toBeVisible();
  await clickMove(page, 'b1c3');
  await expect(page.getByTestId('feedback')).toContainText('Le coup attendu est');
  for (const [j, m] of ['g1f3', 'f1c4', 'c2c3', 'd2d3', 'e1g1'].entries()) {
    // Attendre que l'adversaire ait répondu : le coup blanc n° j+2 est le demi-coup 2j+3.
    await expect(page.getByText(`Coup ${2 * j + 3} / 12`)).toBeVisible();
    await clickMove(page, m);
  }
  await expect(page.getByTestId('trainer-done')).toContainText('1 erreur');
  await page.getByRole('link', { name: 'Ouvertures' }).first().click();
  await expect(page.getByRole('link', { name: /Partie italienne/ })).toContainText('Révision dans 1 j');
});

test('évaluation initiale complète puis parcours personnalisé', async ({ page }) => {
  await page.goto('./#/apprentissage');
  await page.getByTestId('start-assessment').click();
  await page.getByRole('button', { name: 'Commencer' }).click();
  await page.getByRole('button', { name: 'Je joue régulièrement (en ligne ou entre amis)' }).click();
  await page.getByRole('button', { name: 'Progresser en tactique' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  for (const answer of ['Pat : partie nulle', 'Non', 'Oui, en passant, en allant en d6', 'Nulle', 'Oui', 'Il devient une dame, une tour, un fou ou un cavalier']) {
    await page.getByRole('button', { name: answer, exact: true }).click();
  }
  for (let i = 0; i < 6; i++) {
    await page.getByTestId('skip-puzzle').click();
    await page.getByTestId('next-step').click();
  }
  for (const answer of ['Cf3 : développe en attaquant e5', 'Le cavalier a3', 'Le petit roque']) {
    await page.getByRole('button', { name: answer }).click();
  }
  await page.getByRole('button', { name: /Prendre la dame/ }).click();
  const result = page.getByTestId('assessment-result');
  await expect(result).toContainText('Débutant');
  await expect(result).toContainText('Fourchette indicative');
  await expect(result).toContainText('pas un classement Elo officiel');
  await page.getByRole('button', { name: 'Voir mon parcours' }).click();
  await expect(page.getByTestId('profile-level')).toHaveText('Débutant');
  await expect(page.getByTestId('recommendations')).toContainText('Leçon : L\'échiquier et ses coordonnées');
});

test('sauvegarde, effacement et restauration des données', async ({ page }) => {
  await page.goto('./#/lecons/regles-pat');
  await next(page);
  await page.getByRole('button', { name: 'Pat : partie nulle' }).click();
  await next(page);
  await clickMove(page, 'g1g7');
  await page.getByRole('button', { name: 'Terminer' }).click();
  await page.goto('./#/parametres');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger une sauvegarde' }).click();
  const file = await (await download).path();
  await page.getByRole('button', { name: 'Tout effacer' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Tout effacer' }).click();
  await expect(page.getByText('Toutes les données ont été effacées.')).toBeVisible();
  await page.goto('./#/lecons');
  await expect(page.getByRole('link', { name: /Le pat/ })).not.toContainText('Terminée');
  await page.goto('./#/parametres');
  await page.getByTestId('restore-input').setInputFiles(file);
  await expect(page.getByText('Sauvegarde restaurée.')).toBeVisible();
  await page.goto('./#/lecons');
  await expect(page.getByRole('link', { name: /Le pat/ })).toContainText('Terminée · 2/2 du premier coup');
});
