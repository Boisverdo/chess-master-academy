import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173/', trace: 'retain-on-failure' },
  projects: [
    { name: 'bureau', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 820 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: { command: 'npm run dev', url: 'http://localhost:5173/', reuseExistingServer: true, timeout: 60_000 },
});
