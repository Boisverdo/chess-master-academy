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
  // Attendre l'étape « clique sur une case » avant de cliquer (l'échiquier précédent est remplacé).
  await expect(page.getByText('Clique sur la case')).toBeVisible();
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
  // Un exercice peut avoir plusieurs thèmes (ex. « Mat en 1, Sacrifice »).
  await expect(page.getByText(/Indice 1 — Motif : .*Mat en 1/)).toBeVisible();
  await clickMove(page, solution[1]!.slice(0, 4));
  await expect(page.getByTestId('feedback')).toContainText('Résolu avec indices');
  await expect(page.getByTestId('explanation')).toContainText('échec et mat');
  await expect(page.getByTestId('explanation')).not.toContainText('attaque le roi');
  // Solution expliquée pas à pas : démarre sur le mat (flèche verte du coup), recule jusqu'au départ.
  const walk = page.getByTestId('walkthrough');
  await expect(page.getByTestId('walk-count')).toHaveText('Étape 2 / 2');
  await expect(page.getByTestId('walk-text')).toContainText(/^Ton coup.*Premier coup : .*Échec et mat/);
  await expect(page.locator('svg.cg-shapes line[stroke="#15781B"]')).toHaveCount(1);
  await page.getByTestId('walk-prev').click();
  await expect(walk).toHaveAttribute('data-step', '0');
  await expect(page.getByTestId('walk-text')).toContainText('position de départ');
  await expect(page.getByTestId('walk-prev')).toBeDisabled();
  await expect(page.locator('svg.cg-shapes line[stroke="#003088"]')).toHaveCount(1);
  await page.getByTestId('walk-next').click();
  await expect(walk).toHaveAttribute('data-step', '1');
  // Sans évaluation initiale, aucune cote n'est suivie : l'application invite à la faire.
  await expect(page.locator('.notice')).toContainText('évaluation initiale');
  // Type d'exercices : un menu déroulant, qui n'affiche que le choix en cours.
  const select = page.getByTestId('theme-select');
  await expect(select).toHaveValue('mat-en-1');
  await expect(page.locator('.theme-picker .chip')).toHaveCount(0);
  await select.selectOption({ label: 'Mat en 2' });
  await expect(page.getByTestId('puzzle-prompt')).toContainText('font mat en 2');
  await select.selectOption('');
  await expect(page.getByTestId('puzzle-prompt')).toContainText(/jouent/);
});

test('leçon jouée contre l’ordinateur : indices, solution expliquée coup par coup, voix de l’entraîneur', async ({ page }) => {
  // La synthèse vocale est remplacée par un enregistreur : on vérifie ce que l'entraîneur dirait.
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    if ('speechSynthesis' in window) window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => void spoken.push(u.text);
  });
  const lastSpoken = () => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.at(-1) ?? '');
  await page.goto('./#/lecons/finales-carre');
  await page.reload(); // le changement d'ancre seul ne recharge pas la page (le script d'enregistrement doit s'installer)

  // Voix coupée par défaut ; un bouton l'active, et le réglage est repris dans les paramètres.
  const voice = page.getByTestId('lesson-voice');
  await expect(voice).toHaveAttribute('aria-pressed', 'false');
  await voice.click();
  await expect(voice).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(lastSpoken).toContain('Un calcul sans calcul. Trace un carré');
  await next(page);
  await page.getByRole('button', { name: 'Non : le pion va à dame' }).click();
  await next(page);
  await expect.poll(lastSpoken).toBe('Avec les Noirs, rattrape le pion blanc.');

  // Indice 1 (texte), indice 2 (pièce à jouer entourée), puis la solution expliquée.
  await page.getByTestId('lesson-hint').click();
  await expect(page.getByTestId('feedback')).toContainText('Indice : Va vers la case de promotion');
  await expect.poll(lastSpoken).toContain('Indice : Va vers la case de promotion');
  await page.getByTestId('lesson-piece-hint').click();
  await expect(page.locator('svg.cg-shapes circle')).toHaveCount(1);
  await page.getByTestId('lesson-solution').click();
  await expect(page.getByTestId('walk-count')).toHaveText('Étape 1 / 8');
  await expect(page.getByTestId('walk-text')).toContainText('Voici une façon de réussir. Tu joues les Noirs');
  await page.getByTestId('walk-next').click();
  await expect(page.getByTestId('walk-text')).toContainText('Premier coup : ton roi va de e4 à d5. Ton roi est déjà dans le carré');
  await expect.poll(lastSpoken).toContain('Premier coup : ton roi va de e4 à d5');
  await expect(page.locator('svg.cg-shapes line[stroke="#15781B"]')).toHaveCount(1);
  await page.getByTestId('walk-next').click();
  await expect(page.getByTestId('walk-text')).toContainText('L’adversaire répond : son pion va de a4 à a5.');
  for (let i = 0; i < 5; i++) await page.getByTestId('walk-next').click();
  await expect(page.getByTestId('walk-text')).toContainText('Tu prends le pion. Il ne reste pas assez de matériel pour mater : la partie est nulle. Retiens : si ton roi entre dans le carré');

  // Réessayer : la solution disparaît, l'exercice repart de zéro.
  await page.getByTestId('lesson-retry').click();
  await expect(page.getByTestId('walkthrough')).toHaveCount(0);
  await expect(page.getByTestId('play-count')).toHaveText('Coups joués : 0 / 8');
  await clickMove(page, 'e4d5');
  await expect(page.getByTestId('play-count')).toHaveText('Coups joués : 1 / 8', { timeout: 30_000 });

  await page.goto('./#/parametres');
  await expect(page.getByTestId('setting-voice')).toBeChecked();
});

test('question sur une position : après une erreur, solution expliquée coup par coup et lue à voix haute', async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    if ('speechSynthesis' in window) window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => void spoken.push(u.text);
  });
  const lastSpoken = () => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.at(-1) ?? '');
  await page.goto('./#/lecons/finales-dames');
  await page.reload();
  await next(page);
  await page.getByRole('button', { name: 'Les Blancs gagnent' }).click();
  await next(page);
  await expect(page.getByTestId('lesson-solution')).toHaveCount(0);
  await page.getByRole('button', { name: 'Les Blancs gagnent' }).click();
  await expect(page.getByTestId('feedback')).toContainText('défense de pat');

  await page.getByTestId('lesson-voice').click();
  await expect(page.getByTestId('lesson-voice')).toHaveText('🔊 Voix de l’entraîneur activée');
  await page.getByTestId('lesson-solution').click();
  await expect(page.getByTestId('walk-count')).toHaveText('Étape 1 / 14');
  await expect(page.getByTestId('walk-text')).toContainText('Les Blancs ont le trait');
  await page.getByTestId('walk-next').click();
  await expect(page.getByTestId('walk-text')).toContainText('Les Blancs jouent : la dame blanche va de h1 à h6. Échec !');
  await expect(page.locator('.walk-who')).toHaveText('Les Blancs');
  await expect.poll(lastSpoken).toContain('Les Blancs jouent : la dame blanche va de h1 à h6');
  await page.getByTestId('walk-next').click();
  await expect(page.getByTestId('walk-text')).toContainText('Les Noirs jouent : le roi noir va de d2 à d1 pour échapper à l’échec.');
  for (let i = 0; i < 11; i++) await page.getByTestId('walk-next').click();
  await expect(page.getByTestId('walk-text')).toContainText('prend le pion noir. La dame prend le pion… Pat');
  await expect(page.getByTestId('walk-text')).toContainText('Retiens : avec un pion de fou, le roi noir file dans le coin.');

  // Retour à la position : la bonne réponse permet de terminer la leçon.
  await page.getByTestId('lesson-retry').click();
  await expect(page.getByTestId('walkthrough')).toHaveCount(0);
  await page.getByRole('button', { name: 'Nulle' }).click();
  await expect(page.getByTestId('lesson-next')).toBeEnabled();
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
