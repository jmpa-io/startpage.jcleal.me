// MASTER COPY - mirror, do not edit per-repo. Master lives in jmpa-io/jcleal.me/e2e; sync with e2e/sync-master.sh.
// Behaviour of the shared colour-theme modal (palette.js mountPanel), identical on every site. Selectors come from ./site.ts.
import { test, expect } from './fixtures';
import { contrastFailures, DEFAULT_PAIR, ensureScheme, isDark, openPopup, setColours, storedScheme } from './helpers/palette-helpers';
import { site } from './site';

const windowed = !!(site as { windowed?: boolean }).windowed; // portfolio shows the panel inside a window instead of a popup.
const card = (page: import('@playwright/test').Page, s: 'light' | 'dark') => page.locator(`.pm-card[data-scheme="${s}"]`);

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
  await page.goto('/');
});

test('modal is a dialog with Day/Night preview cards, two colour rows with hex text, a preview and Reset', async ({ page }) => {
  await openPopup(page);
  if (!windowed) await expect(page.locator(site.sel.popup)).toHaveAttribute('role', 'dialog');
  await expect(page.locator('.pm-card')).toHaveCount(2);
  await expect(card(page, 'light')).toHaveAccessibleName('Day');
  await expect(card(page, 'dark')).toHaveAccessibleName('Night');
  await expect(page.locator(site.sel.primary)).toHaveAttribute('type', 'color');
  await expect(page.locator(`${site.sel.primary}-hex`)).toHaveText(DEFAULT_PAIR[0]);
  await expect(page.locator(`${site.sel.secondary}-hex`)).toHaveText(DEFAULT_PAIR[1]);
  await expect(page.locator('.pm-preview')).toBeVisible();
  await expect(page.locator(site.sel.reset)).toBeVisible();
});

test('clicking a card sets the scheme, persists it and marks only that card pressed', async ({ page }) => {
  await openPopup(page);
  for (const s of ['light', 'dark', 'light'] as const) {
    await card(page, s).click();
    await expect.poll(() => isDark(page)).toBe(s === 'dark');
    expect(await storedScheme(page)).toBe(s);
    await expect(card(page, s)).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page, s === 'dark' ? 'light' : 'dark')).toHaveAttribute('aria-pressed', 'false');
  }
});

test('preview cards render in their own scheme with the current colours', async ({ page }) => {
  await openPopup(page);
  await setColours(page, '#118833', '#aa22cc');
  const bg = (s: 'light' | 'dark') => card(page, s).locator('.pm-mini').evaluate((e) => getComputedStyle(e).backgroundColor);
  const link = (s: 'light' | 'dark') => card(page, s).locator('.pm-mini-a').evaluate((e) => getComputedStyle(e).color);
  expect(await bg('light')).not.toBe(await bg('dark'));
  expect(await link('light')).not.toBe(await link('dark'));
  const before = await link('light');
  await setColours(page, '#cc2200', '#aa22cc');
  expect(await link('light')).not.toBe(before);
});

test('hex text and the live preview follow the colour pickers, and Reset restores the defaults', async ({ page }) => {
  await openPopup(page);
  const pv = (sel: string) => page.locator(sel).evaluate((e) => getComputedStyle(e).color);
  const [a0, b0] = [await pv('.pm-pv-a'), await pv('.pm-pv-b')];
  await setColours(page, '#118833', '#aa22cc');
  await expect(page.locator(`${site.sel.primary}-hex`)).toHaveText('#118833');
  await expect(page.locator(`${site.sel.secondary}-hex`)).toHaveText('#aa22cc');
  expect(await pv('.pm-pv-a')).not.toBe(a0);
  expect(await page.locator('.pm-pv-b').evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe(b0);
  await page.locator(site.sel.reset).click();
  await expect(page.locator(`${site.sel.primary}-hex`)).toHaveText(DEFAULT_PAIR[0]);
  await expect(page.locator(site.sel.primary)).toHaveValue(DEFAULT_PAIR[0]);
});

test('modal text keeps WCAG AA in both schemes', async ({ page }) => {
  await openPopup(page);
  for (const s of ['light', 'dark'] as const) {
    await ensureScheme(page, s);
    const bad = await contrastFailures(page, 4.5, '.pm');
    expect(bad, JSON.stringify(bad.slice(0, 5))).toEqual([]);
  }
});

test('Escape closes the popup and returns focus to the trigger; opening focuses inside it', async ({ page }) => {
  test.skip(windowed, 'the panel lives in a window, not a popup');
  await openPopup(page);
  expect(await page.evaluate((sel) => document.querySelector(sel)!.contains(document.activeElement), site.sel.popup)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator(site.sel.popup)).not.toHaveClass(/open/);
  await expect(page.locator(site.sel.trigger)).toBeFocused();
  await expect(page.locator(site.sel.trigger)).toHaveAttribute('aria-expanded', 'false');
});

test('clicking outside closes the popup, clicking inside does not', async ({ page }) => {
  test.skip(windowed, 'the panel lives in a window, not a popup');
  await openPopup(page);
  await page.locator('.pm-title').click();
  await expect(page.locator(site.sel.popup)).toHaveClass(/open/);
  const vp = page.viewportSize()!;
  await page.mouse.click(2, vp.height - 2);
  await expect(page.locator(site.sel.popup)).not.toHaveClass(/open/);
});

test('modal fits a 390px viewport with no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await openPopup(page);
  const box = (await page.locator('.pm').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + 80).toBeLessThan(844); // the open modal starts on screen, not below the fold
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.pm').evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`screenshot: open modal (${scheme})`, async ({ page }) => {
    await ensureScheme(page, scheme);
    await page.evaluate(() => document.fonts.ready);
    await openPopup(page);
    await expect(page.locator('.pm')).toHaveScreenshot(`modal-${scheme}.png`);
  });
}
