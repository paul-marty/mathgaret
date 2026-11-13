import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const SUBPATH_PORT = 4174;

/**
 * Tests dans un vrai navigateur, sur le build de production (service worker compris).
 * Les parcours utilisent le rendu Canvas (?renderer=canvas) : rapide même sans GPU (CI).
 * Un test dédié vérifie le rendu WebGL (celui de la Shield).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}/`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      // Même jeu servi sous /mathgaret/, comme sur GitHub Pages (dépôt « projet »).
      command: `npx vite build --outDir dist-subpath --emptyOutDir && npx vite preview --outDir dist-subpath --port ${SUBPATH_PORT} --strictPort`,
      env: { BASE_PATH: '/mathgaret/' },
      url: `http://localhost:${SUBPATH_PORT}/mathgaret/`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      testIgnore: /subpath/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, baseURL: `http://localhost:${PORT}/` },
    },
    {
      name: 'subpath',
      testMatch: /subpath/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, baseURL: `http://localhost:${SUBPATH_PORT}/mathgaret/` },
    },
  ],
});
