import { defineConfig, devices } from '@playwright/test';

/**
 * Par défaut : tests sur le serveur de développement.
 * CMA_PROD=1 : tests sur la VERSION DE PRODUCTION (compilée, avec CSP et service hors ligne),
 * celle qui est livrée (voir « npm run test:prod »).
 */
const prod = !!process.env.CMA_PROD;
// Rend visibles (et interceptables) les requêtes faites par le service hors ligne (test de mise à jour).
if (prod) process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
// Port distinct de « npm run app » (4173) : les tests de production ne gênent pas l'application installée.
const baseURL = prod ? 'http://localhost:4179/' : 'http://localhost:5173/';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'bureau', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 820 } }, testIgnore: [/mobile\.spec\.ts/, ...(prod ? [] : [/prod\.spec\.ts/])] },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: prod
    ? { command: 'npm run build && npx vite preview --port 4179', url: baseURL, reuseExistingServer: false, timeout: 180_000 }
    : { command: 'npm run dev', url: baseURL, reuseExistingServer: true, timeout: 60_000 },
});
