// MASTER COPY - mirror, do not edit per-repo. Master lives in jmpa-io/jcleal.me/e2e; sync with `make e2e-sync` (see README).
// Everything site-specific (port, projects, selectors, snapshot naming) is in ./site.ts.
import { defineConfig } from '@playwright/test';
import { site } from './site';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  snapshotPathTemplate: site.snapshotTemplate ?? '{testDir}/{testFileName}-snapshots/{arg}-{projectName}{ext}',
  fullyParallel: true,
  timeout: 60_000,
  workers: Number(process.env.E2E_WORKERS || 3), // capped: every worker is a full Chrome; override with E2E_WORKERS or --workers.
  // A subdirectory, so Playwright's per-run clean-up of outputDir leaves other files in test-results/ alone.
  outputDir: './test-results/pw',
  reporter: [['list'], ['html', { open: 'never' }]],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' } },
  use: {
    baseURL: `http://localhost:${site.port}`,
    channel: 'chrome', // system Chrome: no browser download needed.
    reducedMotion: 'reduce',
    timezoneId: 'Australia/Melbourne',
    locale: 'en-AU',
  },
  projects: site.projects,
  webServer: {
    // Serves the already-built output with a tiny static server; SITE_DIR overrides the directory.
    command: 'node server.mjs',
    env: { PORT: String(site.port), SITE_DIR: process.env.SITE_DIR || site.siteDir },
    url: `http://localhost:${site.port}/`,
    reuseExistingServer: false, // never test against a foreign server; set E2E_PORT (read in site.ts) to run beside another one.
  },
});
