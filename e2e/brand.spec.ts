import { test, expect } from './fixtures';

const ASSETS = ['/favicon.ico', '/favicon-32x32.png', '/favicon-64x64.png', '/apple-touch-icon.png', '/img/logo-256.png', '/img/og-image.png'];

test('hoodie favicon, apple-touch-icon, neofetch logo and share image resolve as images', async ({ page, request }) => {
  for (const a of ASSETS) {
    const r = await request.get(a);
    expect(r.status(), a).toBe(200);
    expect(r.headers()['content-type'], a).toMatch(/^image\//);
  }
  await page.goto('/');
  for (const sel of ['link[rel="icon"][href="favicon.ico"]', 'link[rel="icon"][sizes="32x32"]', 'link[rel="apple-touch-icon"]']) {
    await expect(page.locator(sel)).toHaveCount(1);
  }
});

// The page carries its own CSP meta (img-src 'self'), so a blocked image shows up as a console violation.
test('neofetch shows the hoodie beside the facts: loads, crisp, no CSP errors, no overflow', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) problems.push(m.text()); });
  await page.goto('/');
  const logo = page.locator('.neofetch img.logo');
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('alt', 'jmpa hoodie logo');
  expect(await logo.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  expect(await logo.evaluate((i) => getComputedStyle(i).imageRendering)).toBe('pixelated');
  await expect(page.locator('.neofetch pre')).toHaveCount(0); // the ASCII Arch logo is gone
  const [l, f] = await Promise.all([logo.boundingBox(), page.locator('.neofetch .facts').boundingBox()]);
  expect(l!.x + l!.width).toBeLessThanOrEqual(f!.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(problems).toEqual([]);
});

test('hoodie scales down and nothing overflows at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const logo = page.locator('.neofetch img.logo');
  await expect(logo).toBeVisible();
  const box = (await logo.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(80);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('share image meta points at the real domain and an existing image', async ({ page, request }) => {
  await page.goto('/');
  for (const sel of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
    const url = await page.locator(sel).first().getAttribute('content');
    expect(url, sel).toBe('https://startpage.jcleal.me/img/og-image.png');
    const r = await request.get(new URL(url!).pathname);
    expect(r.status()).toBe(200);
    expect(r.headers()['content-type']).toMatch(/^image\//);
  }
});

test('clicking the neofetch hoodie cycles through the six themed tiles and remembers the choice', async ({ page }) => {
  await page.goto('/');
  const btn = page.locator('#sp-logo-btn');
  const logo = page.locator('.neofetch img.logo');
  const themes = ['dusk', 'night', 'autumn', 'mist', 'meadow-day', 'sunrise', 'dusk'];
  for (let i = 0; i < themes.length; i++) {
    await expect(btn).toHaveAttribute('data-theme', themes[i]);
    await expect(logo).toHaveAttribute('src', `img/logo-${themes[i]}.png`);
    await expect.poll(() => logo.evaluate((im: HTMLImageElement) => im.complete && im.naturalWidth > 0)).toBe(true);
    if (i < themes.length - 1) await btn.click();
  }
  await btn.click();
  await page.reload();
  await expect(btn).toHaveAttribute('data-theme', 'night');
  await btn.click({ button: 'right' });
  await expect(btn).toHaveAttribute('data-theme', 'dusk');
  await btn.click({ button: 'right' });
  await expect(btn).toHaveAttribute('data-theme', 'sunrise');
});
