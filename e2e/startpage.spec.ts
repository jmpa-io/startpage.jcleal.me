import { test, expect, external } from './fixtures';
import { site } from './site';
import {
  SWEEP, NAMED, contrastFailures, setColours, openPopup, resetColours, toggleScheme, ensureScheme, isDark,
  emulateScheme, storedColours, storedScheme, seedColours, recordEarly, settleStyles,
} from './helpers/palette-helpers';

const S = site.sel;

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
  await settleStyles(page);
  await page.goto('/index.html');
  await page.evaluate(() => document.fonts.ready);
});

test.describe('page', () => {
  test('renders the tree, has no search box and makes no external requests', async ({ page }) => {
    await expect(page.locator('.tree a')).toHaveCount(21);
    await expect(page.locator('input[name=q], form.sp-search')).toHaveCount(0);
    expect(external(page)).toEqual([]);
  });

  test('links are clickable and the page does not scroll', async ({ page }) => {
    await expect(page.locator('.tree a', { hasText: 'github (jmpa)' })).toHaveAttribute('href', 'https://github.com/jmpa-oss');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

test.describe('colour picker', () => {
  test('two inputs + reset, no presets; Escape and outside click close it', async ({ page }) => {
    await openPopup(page);
    await expect(page.locator('.palette-btn')).toHaveCount(0);
    await expect(page.locator(S.primary)).toHaveValue('#fc59a6');
    await expect(page.locator(S.secondary)).toHaveValue('#5c9fff');
    await page.keyboard.press('Escape');
    await expect(page.locator(S.popup)).not.toHaveClass(/open/);
    await openPopup(page);
    await page.mouse.click(20, 600);
    await expect(page.locator(S.popup)).not.toHaveClass(/open/);
  });

  test('colours drive background, text, links and the prompt user, in both schemes', async ({ page }) => {
    const css = (sel: string, p: string) => page.locator(sel).first().evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), p);
    for (const scheme of ['light', 'dark'] as const) {
      await page.evaluate(() => localStorage.removeItem('palette-custom'));
      await page.reload();
      await ensureScheme(page, scheme);
      const read = async () => [await css('html', 'background-image'), await css('.prompt', 'color'), await css('.user', 'color'), await css('h1', 'color')];
      const before = await read();
      await setColours(page, '#118833', '#aa22cc');
      const after = await read();
      after.forEach((v, i) => expect(v, `${scheme} #${i}`).not.toBe(before[i]));
    }
  });

  test('persists, applied before DOMContentLoaded, inputs reflect it', async ({ page }) => {
    await setColours(page, '#118833', '#aa22cc');
    expect(JSON.parse((await storedColours(page))!)).toEqual({ primary: '#118833', secondary: '#aa22cc' });
    await recordEarly(page, 'colour');
    await page.reload();
    expect(await page.evaluate(() => (window as any).__early)).toBe('#118833');
    await expect(page.locator(S.primary)).toHaveValue('#118833');
  });

  test('old `palette` preset key migrates once and is deleted', async ({ page }) => {
    await page.evaluate(() => { localStorage.setItem('palette', 'teal'); localStorage.removeItem('palette-custom'); });
    await page.reload();
    expect(JSON.parse((await storedColours(page))!)).toEqual({ primary: '#007c6e', secondary: '#cf386b' });
    expect(await page.evaluate(() => localStorage.getItem('palette'))).toBeNull();
  });

  test('Reset restores defaults and clears storage', async ({ page }) => {
    await setColours(page, '#118833', '#aa22cc');
    await resetColours(page);
    expect(await storedColours(page)).toBeNull();
    await expect(page.locator(S.primary)).toHaveValue('#fc59a6');
  });

  for (const bad of ['{"primary":"red;}"}', '{"primary":"#12345","secondary":"#aa22cc"}', 'not json']) {
    test(`corrupt storage ignored: ${bad}`, async ({ page }) => {
      await page.evaluate((v) => localStorage.setItem('palette-custom', v), bad);
      await page.reload();
      await expect(page.locator(S.primary)).toHaveValue('#fc59a6');
      expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--pal-primary'))).toBe('#fc59a6');
    });
  }

  test('note appears only when a pick had to be adjusted', async ({ page }) => {
    await setColours(page, '#fffde0', '#fffde0');
    await expect(page.locator(S.note)).not.toBeEmpty();
    await setColours(page, '#8a3a20', '#2a6590');
    await expect(page.locator(S.note)).toBeEmpty();
  });

  test('popup fits the viewport at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await openPopup(page);
    const box = (await page.locator(S.popup).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  });
});

test.describe('contrast AA across picks', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const [p, s] of SWEEP) {
      test(`${p}/${s} (${scheme})`, async ({ page }) => {
        await ensureScheme(page, scheme);
        await setColours(page, p, s);
        const bad = await contrastFailures(page, 4.5);
        expect(bad, JSON.stringify(bad.slice(0, 5))).toEqual([]);
        expect(await page.evaluate(() => (window as any).__auditCount)).toBeGreaterThan(10);
      });
    }
  }
});

test.describe('day/night scheme', () => {
  for (const os of ['light', 'dark'] as const) {
    test(`defaults to the OS (${os}) with no stored choice`, async ({ page }) => {
      await emulateScheme(page, os);
      await page.evaluate(() => localStorage.removeItem('scheme'));
      await page.reload();
      expect(await isDark(page)).toBe(os === 'dark');
    });
  }

  test('applied before first paint', async ({ page }) => {
    await emulateScheme(page, 'dark');
    await recordEarly(page, 'dark');
    await page.reload();
    expect(await page.evaluate(() => (window as any).__early)).toBe(true);
  });

  test('toggle persists under `scheme` across reload', async ({ page }) => {
    await emulateScheme(page, 'light');
    await page.reload();
    await toggleScheme(page);
    expect(await storedScheme(page)).toBe('dark');
    await page.reload();
    expect(await isDark(page)).toBe(true);
  });

  test('OS change live-updates only while there is no explicit choice', async ({ page }) => {
    await emulateScheme(page, 'light');
    await page.evaluate(() => localStorage.removeItem('scheme'));
    await page.reload();
    await emulateScheme(page, 'dark');
    await expect.poll(() => isDark(page)).toBe(true);
    await toggleScheme(page);
    await emulateScheme(page, 'light');
    await emulateScheme(page, 'dark');
    await page.waitForTimeout(200);
    expect(await isDark(page)).toBe(false);
  });
});

test.describe('screenshots', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`default ${scheme}`, async ({ page }) => {
      await emulateScheme(page, scheme);
      await page.reload();
      await expect(page).toHaveScreenshot(`default-${scheme}.png`);
    });

    for (const [name, [p, s]] of Object.entries(NAMED)) {
      test(`${name} ${scheme}`, async ({ page }) => {
        await emulateScheme(page, scheme);
        await seedColours(page, p, s);
        await page.evaluate(() => document.fonts.ready);
        await expect(page).toHaveScreenshot(`colours-${name}-${scheme}.png`);
      });
    }
  }

  test('popup open (teal/pink dark)', async ({ page }) => {
    await emulateScheme(page, 'dark');
    await page.reload();
    await setColours(page, '#008080', '#ff69b4');
    await expect(page).toHaveScreenshot('popup-teal-pink-dark.png');
  });
});
