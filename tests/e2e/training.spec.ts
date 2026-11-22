import { expect, test, type Page } from '@playwright/test';
import { Chess } from 'chess.js';
import data from '../../src/data/puzzles.json' with { type: 'json' };
import { clickMove } from './helpers';

const puzzles = new Map((data.puzzles as { id: string; fen: string; moves: string }[]).map((p) => [p.id, p]));
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

/** Exercice affiché (identifiant) une fois le coup adverse de départ joué. */
async function currentPuzzle(page: Page, testId: string) {
  const box = page.getByTestId(testId);
  await expect(box).toHaveAttribute('data-ready', 'true');
  const id = (await box.getAttribute('data-puzzle-id'))!;
  return puzzles.get(id)!;
}

/** Joue toute la solution (coups du joueur : indices impairs). */
async function solve(page: Page, testId: string) {
  const p = await currentPuzzle(page, testId);
  const moves = p.moves.split(' ');
  for (let i = 1; i < moves.length; i += 2) {
    await expect(page.getByTestId(testId)).toHaveAttribute('data-cursor', String(i));
    await expect(page.getByTestId(testId)).toHaveAttribute('data-ready', 'true');
    await clickMove(page, moves[i]!);
    if (moves[i]!.length === 5) await page.getByTestId(`promote-${moves[i]![4]}`).click();
  }
  return p.id;
}

/** Joue un coup légal qui n'est pas la solution (et ne donne pas mat). */
async function blunder(page: Page, testId: string) {
  const p = await currentPuzzle(page, testId);
  const [first, expected] = p.moves.split(' ');
  const c = new Chess(p.fen);
  c.move({ from: first!.slice(0, 2), to: first!.slice(2, 4), promotion: first![4] });
  const wrong = c.moves({ verbose: true }).find((m) => m.from + m.to !== expected!.slice(0, 4) && !m.promotion && !m.san.includes('#'))!;
  await clickMove(page, wrong.from + wrong.to);
  return p.id;
}

test('course contre la montre : réussites, 3 erreurs, record, puis reprise dans la revue des erreurs', async ({ page }) => {
  await page.goto('./#/entrainement');
  await expect(page.getByTestId('rush-best-3min')).toHaveText('Pas encore de série');

  // Série de 3 minutes : 2 exercices résolus, puis arrêt.
  await page.getByTestId('rush-start-3min').click();
  await expect(page.getByTestId('rush-timer')).toHaveText(/^[23]:\d\d$/);
  await solve(page, 'rush-run');
  await expect(page.getByTestId('rush-score')).toHaveText('1');
  await solve(page, 'rush-run');
  await expect(page.getByTestId('rush-score')).toHaveText('2');
  await page.getByTestId('rush-stop').click();
  await expect(page.getByTestId('rush-final-score')).toHaveText('2');
  await expect(page.getByTestId('rush-over')).toContainText('Nouveau record');
  await expect(page.getByTestId('rush-best-3min')).toHaveText('Record : 2 · 1 série');

  // Survie : trois erreurs terminent la série.
  await page.getByTestId('rush-start-survie').click();
  const missed: string[] = [];
  for (let i = 0; i < 3; i++) {
    missed.push(await blunder(page, 'rush-run'));
    if (i < 2) await expect(page.getByTestId('rush-run')).not.toHaveAttribute('data-puzzle-id', missed[i]!);
  }
  await expect(page.getByTestId('rush-final-score')).toHaveText('0');
  await expect(page.getByTestId('rush-over')).toContainText('3 exercices manqués');

  // Revue : les 3 exercices manqués ; le premier résolu quitte la liste.
  await page.getByTestId('training-tab-erreurs').click();
  await expect(page.getByTestId('review-puzzles')).toContainText('3 exercices manqués');
  await page.getByTestId('review-puzzles-start').click();
  const solved = await solve(page, 'puzzle-replay');
  expect(missed).toContain(solved);
  await expect(page.getByTestId('review-feedback')).toContainText('quitte ta liste');
  await page.getByTestId('review-back').click();
  await expect(page.getByTestId('review-puzzles')).toContainText('2 exercices manqués');
  await expect(page.getByTestId('review-drills')).toContainText('Aucune position pour l’instant');

  // Les données survivent au rechargement.
  await page.reload();
  await expect(page.getByTestId('review-puzzles')).toContainText('2 exercices manqués');
});

/** Distance de roi (nombre de coups de roi) entre deux cases. */
const dist = (a: string, b: string) => Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(Number(a[1]) - Number(b[1])));

test('finales essentielles : règle du carré réussie contre Stockfish, pion de tour perdu puis noté à retenter', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('./#/entrainement?mode=finales');
  await expect(page.getByTestId('endgame-mastered')).toHaveText('0 / 12');

  // Règle du carré (Noirs) : le roi va vers la case de promotion et prend le pion dès qu'il le peut.
  await page.getByTestId('endgame-regle-du-carre').click();
  const step = page.locator('.play-step');
  for (let i = 0; i < 8; i++) {
    if (await page.getByTestId('endgame-feedback').isVisible()) break;
    await expect(page.getByTestId('play-count')).toContainText('Coups joués');
    const fen = (await step.getAttribute('data-fen'))!;
    const c = new Chess(fen);
    expect(c.turn()).toBe('b');
    const pawn = c.board().flat().find((s) => s?.type === 'p')?.square;
    const moves = c.moves({ verbose: true });
    const take = moves.find((m) => m.captured);
    const goal = pawn ? `${pawn[0]}8` : 'a8';
    const best = take ?? moves.sort((a, b) => dist(a.to, goal) - dist(b.to, goal) || dist(a.to, pawn ?? goal) - dist(b.to, pawn ?? goal))[0]!;
    await clickMove(page, best.from + best.to);
    await expect(step).not.toHaveAttribute('data-fen', fen);
  }
  await expect(page.getByTestId('endgame-feedback')).toContainText('Pion rattrapé');

  // Pion de tour : Rc8 ?? s'éloigne du coin, la promotion devient inévitable.
  await page.getByTestId('endgame-back').click();
  await expect(page.getByTestId('endgame-mastered')).toHaveText('1 / 12');
  await page.getByTestId('endgame-pion-de-tour').click();
  await clickMove(page, 'b8c8');
  for (let i = 0; i < 6 && !(await page.getByTestId('endgame-feedback').isVisible()); i++) {
    await expect.poll(async () => new Chess((await step.getAttribute('data-fen'))!).turn() === 'b' || (await page.getByTestId('endgame-feedback').isVisible()), { timeout: 20_000 }).toBe(true);
    if (await page.getByTestId('endgame-feedback').isVisible()) break;
    const m = new Chess((await step.getAttribute('data-fen'))!).moves({ verbose: true })[0]!;
    await clickMove(page, m.from + m.to);
  }
  await expect(page.getByTestId('endgame-feedback')).toContainText('promu');
  await page.getByTestId('endgame-back').click();
  await expect(page.getByTestId('endgame-pion-de-tour')).toContainText('1 essai, à retenter');
  await expect(page.getByTestId('endgame-regle-du-carre')).toContainText('Maîtrisée');
});
