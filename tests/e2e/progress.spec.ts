import { expect, test } from '@playwright/test';
import { Chess } from 'chess.js';
import data from '../../src/data/puzzles.json' with { type: 'json' };
import { dailyChallenge } from '../../src/progress/challenges';
import type { Puzzle } from '../../src/learning/puzzles/puzzle';
import { clickMove } from './helpers';

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

test('finale jouée contre le moteur : réponse de l’ordinateur, compteur, recommencer', async ({ page }) => {
  await page.goto('./#/lecons/finales-carre');
  await page.getByTestId('lesson-next').click();
  await page.getByRole('button', { name: 'Non : le pion va à dame' }).click();
  await page.getByTestId('lesson-next').click();
  await expect(page.getByTestId('play-count')).toHaveText('Coups joués : 0 / 8');
  await clickMove(page, 'e4d5');
  await expect(page.getByTestId('play-count')).toHaveText('Coups joués : 1 / 8', { timeout: 30_000 });
  await expect(page.locator('[data-testid="board"] piece')).toHaveCount(4);
  await page.getByTestId('play-restart').click();
  await expect(page.getByTestId('play-count')).toHaveText('Coups joués : 0 / 8');
});

test('tableau de bord, défi du jour, examen des règles et historique', async ({ page }) => {
  await page.goto('./#/progression');
  await expect(page.getByTestId('dashboard')).toContainText('Fourchette Elo indicative');
  await expect(page.getByTestId('dashboard')).toContainText('Disponible après 20 exercices');

  await page.getByRole('tab', { name: 'Défis et objectifs' }).click();
  await expect(page.getByTestId('daily')).toContainText('un seul essai', { timeout: 30_000 });
  await expect(page.getByTestId('objectives')).toContainText('Résoudre 30 exercices tactiques');
  await expect(page.getByTestId('streak')).toContainText('0 jour');

  await page.getByRole('tab', { name: 'Examens et badges' }).click();
  await expect(page.getByTestId('badges')).toContainText('Maîtrise : Fourchette');
  await page.getByTestId('exam-examen-regles').click();
  for (let i = 0; i < 10; i++) {
    await expect(page.getByText(`Question ${i + 1} / 10`)).toBeVisible();
    await page.getByTestId('exam-choices').getByRole('button').first().click();
  }
  await expect(page.getByTestId('exam-result')).toContainText('/ 10');
  await page.getByRole('link', { name: 'Retour aux examens' }).click();
  await expect(page.getByTestId('exam-examen-regles')).toContainText(/Réussi|1 essai/);

  await page.getByRole('tab', { name: 'Historique' }).click();
  await expect(page.getByTestId('history')).toContainText('1 examen');
});

test('défi du jour manqué : solution expliquée, aussi après un rechargement', async ({ page }) => {
  const puzzle = dailyChallenge(data.puzzles as Puzzle[], 1000, Date.now())!;
  const [first, answer] = puzzle.moves.split(' ');
  const pos = new Chess(puzzle.fen);
  pos.move({ from: first!.slice(0, 2), to: first!.slice(2, 4), promotion: first![4] });
  const wrong = pos.moves({ verbose: true }).find((m) => !m.promotion && m.from + m.to !== answer!.slice(0, 4))!;
  await page.goto('./#/progression?onglet=defis');
  await expect(page.getByTestId('quick-puzzle-prompt')).toContainText('Un seul essai', { timeout: 30_000 });
  await clickMove(page, wrong.from + wrong.to);
  const daily = page.getByTestId('daily');
  await expect(daily).toContainText('Défi du jour manqué');
  await expect(page.getByTestId('walk-count')).toHaveText(`Étape 1 / ${puzzle.moves.split(' ').length}`);
  await expect(page.getByTestId('walk-text')).toContainText('position de départ');
  await page.getByTestId('walk-next').click();
  await expect(page.getByTestId('walk-text')).toContainText('Premier coup');
  await expect(page.locator('svg.cg-shapes line[stroke="#15781B"]')).toHaveCount(1);
  // Après un rechargement, la même solution reste disponible, et l'accueil y mène.
  await page.goto('./');
  await page.getByTestId('home-daily-solution').click();
  await expect(page.getByTestId('daily-solution')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('walk-count')).toHaveText(`Étape 1 / ${puzzle.moves.split(' ').length}`);
});

test('examen des ouvertures : coups affichés selon la notation choisie', async ({ page }) => {
  await page.goto('./#/progression/examen/examen-ouvertures');
  await expect(page.getByText('Question 1 / 10')).toBeVisible();
  await expect(page.getByTestId('exam-choices').getByRole('button')).toHaveCount(3);
  for (let i = 0; i < 10; i++) await page.getByTestId('exam-choices').getByRole('button').last().click();
  await expect(page.getByTestId('exam-result')).toBeVisible();
});
