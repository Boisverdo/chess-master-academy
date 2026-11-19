import fs from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * Mesures de performance (version de production : CMA_PROD=1). Les résultats sont écrits dans
 * docs/mesures-performances.json. Les seuils sont volontairement larges : ils détectent une régression,
 * pas une variation normale de la machine.
 */
test.describe.configure({ timeout: 240_000 });

// Partie de 40 demi-coups (Partie espagnole, ligne principale prolongée).
const PGN = '[White "A"]\n[Black "B"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 Bb7 12. Bc2 Re8 13. Nf1 Bf8 14. Ng3 g6 15. a4 c5 16. d5 c4 17. Bg5 h6 18. Be3 Nc5 19. Qd2 h5 20. Bg5 Be7 *';

test('chargement, moteur et analyse', async ({ page }) => {
  test.skip(!process.env.CMA_PROD, 'mesure réservée à la version de production');
  const t0 = Date.now();
  await page.goto('./#/echiquier');
  await page.getByTestId('board').waitFor();
  const boardReady = Date.now() - t0;
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) };
  });

  await page.goto('./#/analyse');
  await page.getByTestId('analysis-import').fill(PGN);
  await page.getByTestId('analysis-import-confirm').click();
  const t1 = Date.now();
  await page.getByTestId('start-analysis').click();
  await expect(page.getByTestId('summary')).toBeVisible({ timeout: 200_000 });
  const analysis = Date.now() - t1;

  const result = {
    date: new Date().toISOString().slice(0, 10),
    note: 'Mesures sur la machine de développement, version de production servie en local (vite preview), Chromium de test.',
    chargementPremierEcranMs: boardReady,
    domContentLoadedMs: nav.domContentLoaded,
    analyse41PositionsMs: analysis,
    analyseParPositionMs: Math.round(analysis / 41),
  };
  fs.writeFileSync('docs/mesures-performances.json', JSON.stringify(result, null, 1));
  expect(boardReady).toBeLessThan(5000);
  expect(analysis / 41).toBeLessThan(2500);
});
