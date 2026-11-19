/**
 * Génère les icônes PNG de l'application installable à partir du logo SVG,
 * avec le navigateur de test (Playwright). Usage : node scripts/make-icons.mjs
 */
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const svg = fs.readFileSync('public/favicon.svg', 'utf8');
// Version « maskable » : logo réduit dans une zone sûre, fond plein (les systèmes peuvent rogner en cercle).
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#14213d"/><g transform="translate(12.8 12.8) scale(0.6)"><path d="M20 50h24v-5H20zM23 44h18l-3-14 5-4-4-10-7 4-6-2 4 6-8 10 4 2z" fill="#e9b949"/></g></svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, source, size] of [
  ['icon-192.png', svg, 192],
  ['icon-512.png', svg, 512],
  ['maskable-512.png', maskable, 512],
  ['apple-touch-icon.png', maskable, 180],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${source.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.locator('svg').screenshot({ path: `public/icons/${name}`, omitBackground: true });
  console.log(`public/icons/${name}`);
}
await browser.close();
