import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests run against the production build (dist/) served by `vite preview`
 * at the GitHub Pages path /dailyboss/. Build first: `npm run test:e2e` does both.
 */
const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE_URL = `http://127.0.0.1:${PORT}/dailyboss/`;

/**
 * Headless Chromium has no GPU; these flags give it a real (software) WebGL implementation
 * via SwiftShader so the 3D scene genuinely renders. Fallback tests disable WebGL explicitly.
 */
export const WEBGL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Software WebGL (SwiftShader) is CPU-heavy: many parallel browsers starve each other and make
  // input events time out. Two workers keep runs deterministic; override with E2E_WORKERS.
  workers: Number(process.env.E2E_WORKERS ?? 2),
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        launchOptions: { args: WEBGL_ARGS },
      },
    },
  ],
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
