import { test as base, expect, type Page } from '@playwright/test';

const attempts = new WeakMap<Page, string[]>();

// Non-local requests attempted by the page so far (all of them are aborted).
export const external = (page: Page) => attempts.get(page) ?? [];

// Blocks every non-local request (so tests pass offline) and freezes the clock.
export const test = base.extend({
  page: async ({ page }, use) => {
    const seen: string[] = [];
    attempts.set(page, seen);
    await page.context().route('**/*', (route) => {
      const url = route.request().url();
      if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url)) return route.continue();
      seen.push(url);
      return route.abort();
    });
    await page.clock.setFixedTime(new Date('2026-01-15T10:30:00+11:00'));
    await use(page);
  },
});

export { expect };
