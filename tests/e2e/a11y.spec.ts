import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** Audit d'accessibilité (axe-core, règles WCAG 2.1 A et AA) des écrans principaux, en clair et en sombre. */
const PAGES: [string, string][] = [
  ['Accueil', './'],
  ['Échiquier', './#/echiquier'],
  ['Leçons', './#/lecons'],
  ['Leçon', './#/lecons/regles-roque'],
  ['Exercices', './#/tactiques'],
  ['Ouvertures', './#/ouvertures/italienne'],
  ['Jouer', './#/jouer'],
  ['Analyse', './#/analyse'],
  ['Chess.com', './#/chesscom'],
  ['Entraîneur', './#/entraineur'],
  ['Progression', './#/progression'],
  ['Paramètres', './#/parametres'],
  ['Évaluation', './#/evaluation'],
];

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accessibilité (${scheme === 'light' ? 'clair' : 'sombre'})`, () => {
    test.use({ colorScheme: scheme });
    for (const [name, url] of PAGES) {
      test(name, async ({ page }) => {
        await page.goto(url);
        await page.waitForTimeout(800);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          // L'échiquier (Chessground) est une zone graphique interactive ; il porte un libellé
          // et la partie est lisible dans la feuille de coups. Ses éléments internes sont exclus.
          .exclude('cg-container')
          .analyze();
        const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        const report = serious.map((v) => `${v.id} (${v.impact}) : ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
        expect(report, report.join('\n')).toEqual([]);
      });
    }
  });
}
