import { expect, type Page } from '@playwright/test';

/** Centre d'une case à l'écran, selon l'orientation de l'échiquier. */
export async function squareCenter(page: Page, square: string): Promise<{ x: number; y: number }> {
  const board = page.getByTestId('board');
  // L'échiquier peut être remplacé pendant un changement d'étape : on attend celui qui reste affiché.
  let found: { box: { x: number; y: number; width: number }; black: boolean } | null = null;
  await expect
    .poll(async () => {
      await board.waitFor({ state: 'visible' });
      const box = await board.boundingBox();
      const black = await board.evaluate((el) => el.classList.contains('orientation-black')).catch(() => null);
      found = box && black !== null ? { box, black } : null;
      return found !== null;
    }, { message: 'échiquier introuvable' })
    .toBe(true);
  const { box, black } = found!;
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const col = black ? 7 - file : file;
  const row = black ? rank : 7 - rank;
  const size = box.width / 8;
  return { x: box.x + (col + 0.5) * size, y: box.y + (row + 0.5) * size };
}

/** Joue un coup par clic-clic (ex. « e2e4 »). */
export async function clickMove(page: Page, uci: string): Promise<void> {
  const a = await squareCenter(page, uci.slice(0, 2));
  const b = await squareCenter(page, uci.slice(2, 4));
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);
}

/** Joue un coup par glisser-déposer. */
export async function dragMove(page: Page, uci: string): Promise<void> {
  const a = await squareCenter(page, uci.slice(0, 2));
  const b = await squareCenter(page, uci.slice(2, 4));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
}

export async function playMoves(page: Page, moves: string[]): Promise<void> {
  for (const [i, m] of moves.entries()) {
    await clickMove(page, m);
    await expect(page.locator('[data-ply]')).toHaveCount(i + 1);
  }
}

/** Ouvre une page d'échiquier vierge (stockage local effacé). */
export async function freshBoard(page: Page): Promise<void> {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.goto('./#/echiquier');
  await expect(page.getByTestId('status')).toHaveText('Trait aux Blancs');
}

export async function importPgn(page: Page, pgn: string): Promise<void> {
  await page.getByRole('button', { name: 'Importer un PGN' }).click();
  await page.getByTestId('import-text').fill(pgn);
  await page.getByTestId('import-confirm').click();
}
