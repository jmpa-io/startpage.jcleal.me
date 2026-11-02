import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const out = 'test-results/shots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const sizes = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } };
const extra = process.argv[2] || '';
for (const [name, viewport] of Object.entries(sizes)) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport, colorScheme: scheme, isMobile: name === 'mobile', hasTouch: name === 'mobile', deviceScaleFactor: name === 'mobile' ? 2 : 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
    await page.goto('http://localhost:4175/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    for (let i = 0; i < 3; i++) await page.locator('#sp-add-note').click();
    const ta = page.locator('.sp-note textarea');
    await ta.nth(0).fill('buy milk\nrenew passport');
    await ta.nth(1).fill('ship the start page');
    await ta.nth(2).fill('call mum');
    if (extra === 'edit') await page.locator('#sp-edit').click();
    await page.mouse.move(5, 5);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${out}/${name}-${scheme}${extra ? '-' + extra : ''}.png`, fullPage: name === 'mobile' });
    await ctx.close();
  }
}
await browser.close();
