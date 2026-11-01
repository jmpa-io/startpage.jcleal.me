import { test, expect } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
});

test('every github.com link carries the GitHub mark and is visible', async ({ page }) => {
  const links = page.locator('a[href*="github.com"]');
  const n = await links.count();
  expect(n).toBeGreaterThanOrEqual(3);
  for (let i = 0; i < n; i++) {
    const l = links.nth(i);
    await expect(l).toBeVisible();
    const mark = l.locator('svg[data-icon="github"]');
    await expect(mark).toBeVisible();
    await expect(mark).toHaveAttribute('aria-hidden', 'true');
    const box = (await mark.boundingBox())!;
    expect(Math.round(box.width)).toBe(16);
    expect(await l.getAttribute('aria-label')).toBeTruthy();
  }
});
