import { test, expect } from './fixtures';
import { ensureScheme, settleStyles, type Scheme } from './helpers/palette-helpers';

const sizes = [
  { name: 'desktop', width: 1300, height: 800 },
  { name: 'phone', width: 390, height: 844 },
];
const schemes: Scheme[] = ['light', 'dark'];

for (const size of sizes) {
  for (const scheme of schemes) {
    test(`screenshot ${size.name} ${scheme}`, async ({ page }) => {
      const problems: string[] = [];
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
      page.on('requestfailed', (r) => {
        if (/^https?:\/\/localhost/.test(r.url())) problems.push(`failed: ${r.url()}`);
      });
      page.on('response', (r) => {
        if (r.status() >= 400 && /^https?:\/\/localhost/.test(r.url())) problems.push(`${r.status()}: ${r.url()}`);
      });

      await page.setViewportSize({ width: size.width, height: size.height });
      await page.emulateMedia({ colorScheme: scheme });
      await settleStyles(page);
      await page.goto('/index.html');
      await page.evaluate(() => document.fonts.ready);
      await ensureScheme(page, scheme);

      const term = page.locator('#sp-window');
      await expect(term).toBeVisible();
      await expect(page.locator('.tree a')).toHaveCount(21);

      const bg = await term.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg.replace(/\s/g, '')).toBe('rgb(35,35,35)');

      // Terminal text/background colours must be near-grey, not blue.
      const sat = await page.evaluate(() => {
        const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
        const spread = (c: string) => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = '#000';
          ctx.fillStyle = c;
          ctx.fillRect(0, 0, 1, 1);
          const v = Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
          return Math.max(...v) - Math.min(...v);
        };
        const cs = getComputedStyle(document.querySelector('#sp-window') as HTMLElement);
        return { bg: spread(cs.backgroundColor), fg: spread(cs.color) };
      });
      expect(sat.bg).toBeLessThanOrEqual(8);
      expect(sat.fg).toBeLessThanOrEqual(40);

      const path = `screenshots/${size.name}-${scheme}.png`;
      const buf = await page.screenshot({ path, fullPage: true });
      expect(buf.length).toBeGreaterThan(10_000); // not blank

      const distinct = await page.evaluate(() => document.body.innerText.trim().length);
      expect(distinct).toBeGreaterThan(50);
      expect(problems).toEqual([]);
    });
  }
}
