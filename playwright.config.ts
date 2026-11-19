import { defineConfig, devices } from '@playwright/test';

/**
 * Par défaut : tests sur le serveur de développement.
 * CMA_PROD=1 : tests sur la VERSION DE PRODUCTION (compilée, avec CSP et service hors ligne),
 * celle qui est livrée (voir « npm run test:prod »).
 */
const prod = !!process.env.CMA_PROD;
const baseURL = prod ? 'http://localhost:4173/' : 'http://localhost:5173/';

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
    ? { command: 'npm run build && npx vite preview', url: baseURL, reuseExistingServer: false, timeout: 180_000 }
    : { command: 'npm run dev', url: baseURL, reuseExistingServer: true, timeout: 60_000 },
});
