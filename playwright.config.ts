import { defineConfig, devices } from '@playwright/test'

const PORT = 3100

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // scripts/dev.mjs spawns `next dev` as a detached group and cleans it up on
    // SIGTERM; without this Playwright kills only the npm child and the group
    // survives, hanging teardown.
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    // Force local mode regardless of the developer's shell.
    env: { CLERK_SECRET_KEY: '', BLOB_READ_WRITE_TOKEN: '', AI_GATEWAY_API_KEY: '', VERCEL_OIDC_TOKEN: '' },
  },
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
