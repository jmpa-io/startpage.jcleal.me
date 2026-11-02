import { inflateSync } from 'node:zlib';
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

      // Default state: backdrop (sampled from rendered pixels, it is a gradient) and accent must be neutral grey too.
      const px = async (clip: { x: number; y: number }) => {
        const png = await page.screenshot({ clip: { ...clip, width: 1, height: 1 } });
        let off = 8;
        let data = Buffer.alloc(0);
        while (off < png.length) {
          const len = png.readUInt32BE(off);
          const type = png.toString('ascii', off + 4, off + 8);
          if (type === 'IDAT') data = Buffer.concat([data, png.subarray(off + 8, off + 8 + len)]);
          off += len + 12;
        }
        const raw = inflateSync(data); // 1px row: the filter byte never alters the first pixel
        const v = [raw[1], raw[2], raw[3]];
        return Math.max(...v) - Math.min(...v);
      };
      expect(await px({ x: 2, y: 2 })).toBeLessThanOrEqual(16);
      expect(await px({ x: size.width - 3, y: size.height - 3 })).toBeLessThanOrEqual(16);
      const accent = await page.evaluate(() => {
        const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
        const probe = document.createElement('span');
        document.body.append(probe);
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries({ accent: 'var(--tm-accent)', host: 'var(--tm-host)', border: getComputedStyle(document.querySelector('#sp-window')!).borderTopColor })) {
          probe.style.color = v;
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = '#000';
          ctx.fillStyle = getComputedStyle(probe).color;
          ctx.fillRect(0, 0, 1, 1);
          const d = Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
          out[k] = Math.max(...d) - Math.min(...d);
        }
        probe.remove();
        return out;
      });
      expect(accent.accent).toBeLessThanOrEqual(16);
      expect(accent.host).toBeLessThanOrEqual(16);
      expect(accent.border).toBeLessThanOrEqual(16);

      const path = `screenshots/${size.name}-${scheme}.png`;
      const buf = await page.screenshot({ path, fullPage: true });
      expect(buf.length).toBeGreaterThan(10_000); // not blank

      const distinct = await page.evaluate(() => document.body.innerText.trim().length);
      expect(distinct).toBeGreaterThan(50);
      expect(problems).toEqual([]);
    });
  }
}
