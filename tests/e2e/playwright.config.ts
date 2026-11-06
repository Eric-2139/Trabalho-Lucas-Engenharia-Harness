/**
 * Suíte Playwright (fases 5-6). Roda no contêiner de infra/e2e, contra os builds de produção.
 * Equivalência e não funcionais: Chromium. Fluxo criar → publicar → jogar: os três navegadores do RNF-01 (ADR-006).
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testIgnore: ['node_modules/**', 'resultado/**'],
  fullyParallel: false,
  workers: 2,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: 'resultados.json' }], ['html', { open: 'never' }]],
  use: {
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    locale: 'pt-BR',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
    { name: 'msedge', testMatch: /(fluxo-completo|desempenho)\.spec\.ts/, use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 1280, height: 720 } } },
    { name: 'firefox', testMatch: /(fluxo-completo|desempenho)\.spec\.ts/, use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 720 } } },
  ],
});
