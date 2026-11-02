import { test, expect, type Page } from './fixtures';
import { SWEEP, contrast, setColours, ensureScheme, contrastFailures } from './helpers/palette-helpers';

const KEY = 'startpage.v1';

// Run these under the real CSP (site.ts bypasses it only for the shared style-freezing helper).
test.use({ bypassCSP: false });

// Every test gets a fresh browser context (empty storage), so one navigation is enough; the old
// goto + clear + reload doubled page loads per test and blew the 30s budget under CPU load.
test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
});

const stored = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const edit = async (page: Page) => { await page.locator('#sp-edit').click(); };
const desktopOnly = (name: string) => name !== 'desktop';

test('renders the default links in groups', async ({ page }) => {
  await expect(page.locator('.tree a')).toHaveCount(21);
  await expect(page.locator('.sp-group')).toHaveCount(2);
});

test('window drag moves it, clamps to the viewport and is remembered across reload', async ({ page }, info) => {
  test.skip(desktopOnly(info.project.name), 'drag is disabled on mobile');
  const win = page.locator('#sp-window');
  const before = (await win.boundingBox())!;
  const bar = (await page.locator('#sp-bar').boundingBox())!;
  await page.mouse.move(bar.x + 40, bar.y + 10);
  await page.mouse.down();
  await page.mouse.move(bar.x + 240, bar.y + 130, { steps: 6 });
  await page.mouse.up();
  const after = (await win.boundingBox())!;
  expect(Math.round(after.x - before.x)).toBe(200);
  expect(Math.round(after.y - before.y)).toBe(120);
  await page.reload();
  const again = (await win.boundingBox())!;
  expect(Math.round(again.x)).toBe(Math.round(after.x));
  expect(Math.round(again.y)).toBe(Math.round(after.y));
  // dragging far off-screen never loses the window
  const b2 = (await page.locator('#sp-bar').boundingBox())!;
  await page.mouse.move(b2.x + 20, b2.y + 10);
  await page.mouse.down();
  await page.mouse.move(-500, -500, { steps: 4 });
  await page.mouse.up();
  const clamped = (await win.boundingBox())!;
  expect(clamped.x).toBeGreaterThanOrEqual(0);
  expect(clamped.y).toBeGreaterThanOrEqual(0);
});

test('add, edit, reorder and delete a link', async ({ page }) => {
  await edit(page);
  const work = page.locator('.sp-group').first();
  await work.locator('.sp-group-add').click();
  await page.locator('.sp-form input[name=name]').fill('example');
  await page.locator('.sp-form input[name=url]').fill('https://example.com');
  await page.locator('.sp-form button[type=submit]').click();
  await expect(page.locator('.tree a')).toHaveCount(22);
  await expect(page.getByRole('link', { name: 'example', exact: true })).toHaveAttribute('href', 'https://example.com');

  const item = page.locator('.sp-link', { has: page.getByRole('link', { name: 'example', exact: true }) });
  await item.locator('.sp-edit-link').click();
  await page.locator('.sp-form input[name=name]').fill('example two');
  await page.locator('.sp-form button[type=submit]').click();
  await expect(page.getByRole('link', { name: 'example two' })).toBeVisible();

  const links = work.locator('.sp-link a');
  const last = (await links.count()) - 1;
  const lastName = await links.nth(last).textContent();
  expect(lastName).toBe('example two');
  await page.locator('.sp-link', { has: page.getByRole('link', { name: 'example two' }) }).locator('.sp-up').click();
  expect(await work.locator('.sp-link a').nth(last - 1).textContent()).toBe('example two');

  await page.reload();
  await expect(page.getByRole('link', { name: 'example two' })).toBeVisible();
  await edit(page);
  await page.locator('.sp-link', { has: page.getByRole('link', { name: 'example two' }) }).locator('.sp-del-link').click();
  await expect(page.locator('.tree a')).toHaveCount(21);
});

test('rejects a javascript: url with a message and changes nothing', async ({ page }) => {
  await edit(page);
  await page.locator('#sp-add-link').click();
  await page.locator('.sp-form input[name=name]').fill('bad');
  await page.locator('.sp-form input[name=url]').fill('javascript:alert(1)');
  await page.locator('.sp-form button[type=submit]').click();
  await expect(page.locator('#sp-status')).toContainText('not a valid');
  await expect(page.locator('.tree a')).toHaveCount(21);
});

test('add, rename, reorder and delete a group', async ({ page }) => {
  await edit(page);
  await page.locator('.sp-add-group').click();
  await page.locator('.sp-form input[name=name]').fill('games');
  await page.locator('.sp-form button[type=submit]').click();
  const groups = page.locator('.sp-group');
  await expect(groups).toHaveCount(3);
  await expect(groups.nth(2).locator('h1').first()).toHaveText('games');
  await groups.nth(2).locator('.sp-up').first().click();
  await expect(page.locator('.sp-group').nth(1).locator('h1').first()).toHaveText('games');
  await page.locator('.sp-group').nth(1).locator('.sp-rename').click();
  await page.locator('.sp-form input[name=name]').fill('play');
  await page.locator('.sp-form button[type=submit]').click();
  await expect(page.locator('.sp-group').nth(1).locator('h1').first()).toHaveText('play');
  await page.locator('.sp-group').nth(1).locator('.sp-del-group').click();
  await expect(page.locator('.sp-group')).toHaveCount(2);
});

test('notes: add, type, recolour, drag, persist, delete', async ({ page }, info) => {
  await page.locator('#sp-add-note').click();
  const note = page.locator('.sp-note');
  await expect(note).toHaveCount(1);
  await note.locator('textarea').fill('remember the milk');
  await note.locator('.sp-colour[data-slot="4"]').click();
  await expect(note).toHaveClass(/sp-slot-4/);

  if (info.project.name === 'desktop') {
    const bar = note.locator('.sp-note-bar');
    await bar.hover(); // actionability waits for the note to stop moving before the box is measured.
    const b = (await bar.boundingBox())!;
    const pos = () => note.evaluate((e) => [e.offsetLeft, e.offsetTop]);
    const n0 = await pos();
    await page.mouse.move(b.x + 120, b.y + 8);
    await page.mouse.down();
    await page.mouse.move(b.x + 160, b.y + 78, { steps: 5 });
    await page.mouse.up();
    const n1 = await pos();
    expect(n1[0] - n0[0]).toBe(40);
    expect(n1[1] - n0[1]).toBe(70);
  }

  await page.reload();
  const again = page.locator('.sp-note');
  await expect(again).toHaveCount(1);
  await expect(again.locator('textarea')).toHaveValue('remember the milk');
  await expect(again).toHaveClass(/sp-slot-4/);
  await again.locator('.sp-note-del').click();
  await expect(page.locator('.sp-note')).toHaveCount(0);
  expect((await stored(page)).notes).toHaveLength(0);
});

test('export then import round-trips the whole document', async ({ page }) => {
  await edit(page);
  await page.locator('.sp-add-group').click();
  await page.locator('.sp-form input[name=name]').fill('roundtrip');
  await page.locator('.sp-form button[type=submit]').click();
  await page.locator('#sp-add-note').click();
  await page.locator('.sp-note textarea').fill('keep me');
  const saved = await stored(page);

  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#sp-export').click()]);
  expect(dl.suggestedFilename()).toBe('startpage.json');
  const path = await dl.path();
  expect(path).toBeTruthy();

  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await page.reload();
  await expect(page.locator('.sp-group')).toHaveCount(2);
  await page.locator('#sp-import').setInputFiles(path!);
  await expect(page.locator('#sp-status')).toContainText('imported');
  await expect(page.locator('.sp-group')).toHaveCount(3);
  await expect(page.locator('.sp-note textarea')).toHaveValue('keep me');
  expect(await stored(page)).toEqual(saved);
});

test('invalid import is rejected and leaves the data untouched', async ({ page }) => {
  await page.locator('#sp-import').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":') });
  await expect(page.locator('#sp-status')).toContainText('import failed');
  await expect(page.locator('.tree a')).toHaveCount(21);
});

test('keyboard can move the window and a note (alternative to dragging)', async ({ page }, info) => {
  test.skip(desktopOnly(info.project.name), 'move is disabled on mobile');
  const win = page.locator('#sp-window');
  const before = (await win.boundingBox())!;
  await page.locator('#sp-bar').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  const after = (await win.boundingBox())!;
  expect(Math.round(after.x - before.x)).toBe(16);
  expect(Math.round(after.y - before.y)).toBe(64);
  await page.locator('#sp-add-note').click();
  const note = page.locator('.sp-note').first();
  const nb = (await note.boundingBox())!;
  await note.locator('.sp-note-bar').focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  const na = (await note.boundingBox())!;
  expect(Math.abs(na.y - nb.y - 16)).toBeLessThanOrEqual(2); // the tilt straightens on focus, so allow a pixel or so
  expect(Math.round(na.x - nb.x)).toBeLessThanOrEqual(0);
});

test('imported javascript:/data: links are dropped, not rendered', async ({ page }) => {
  const doc = { version: 1, window: null, notes: [], groups: [{ id: 'g1', name: 'x', links: [
    { id: 'a', name: 'bad', url: 'javascript:alert(1)' }, { id: 'b', name: 'bad2', url: 'data:text/html,<b>' },
    { id: 'c', name: 'ok', url: 'https://example.com/' }] }] };
  await page.locator('#sp-import').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('#sp-status')).toContainText('imported');
  await expect(page.locator('.tree a')).toHaveCount(1);
  expect(await page.locator('.tree a').getAttribute('href')).toBe('https://example.com/');
});

test('the Content-Security-Policy blocks nothing the page needs', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  await page.reload();
  await page.locator('#sp-add-note').click();
  await page.locator('#scheme-toggle').click();
  await page.locator('#sp-edit').click();
  expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').count()).toBe(1);
  expect(problems).toEqual([]);
});

test('imported text is never parsed as HTML', async ({ page }) => {
  const doc = { version: 1, groups: [{ id: 'g1', name: '<img src=x onerror="window.__x=1">', links: [] }], window: null, notes: [] };
  await page.locator('#sp-import').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('#sp-status')).toContainText('imported');
  await expect(page.locator('.sp-group h1').first()).toHaveText('<img src=x onerror="window.__x=1">');
  expect(await page.evaluate(() => (window as any).__x)).toBeUndefined();
});

test('layout fits the viewport without horizontal overflow', async ({ page }) => {
  await page.locator('#sp-add-note').click();
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(o).toBeLessThanOrEqual(0);
  const box = (await page.locator('#sp-window').boundingBox())!;
  const vw = page.viewportSize()!.width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vw + 1);
});

test('mobile: window and notes stack in flow', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'mobile only');
  await page.locator('#sp-add-note').click();
  const w = (await page.locator('#sp-window').boundingBox())!;
  const n = (await page.locator('.sp-note').boundingBox())!;
  expect(n.y).toBeGreaterThanOrEqual(w.y + w.height - 1);
});

test('screenshots: edit mode with notes', async ({ page }) => {
  // tilt comes from the random note id: pin it so the baseline is stable
  await page.addInitScript(() => {
    let s = 7;
    Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  });
  await page.reload();
  const texts = ['buy milk', 'ship the start page', 'call mum'];
  for (const t of texts) {
    await page.locator('#sp-add-note').click();
    await page.locator('.sp-note textarea').last().fill(t);
  }
  await edit(page);
  await page.mouse.move(3, 3);
  await expect(page).toHaveScreenshot('manage.png');
});

const rgb = (css: string) => (css.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const desktopOnlyTest = (info: { project: { name: string } }) => test.skip(info.project.name !== 'desktop', 'pointer resize is desktop only');
const rect = async (page: Page, sel = '#sp-window') => {
  const b = (await page.locator(sel).boundingBox())!;
  return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
};
const grip = async (page: Page, dir: string, dx: number, dy: number) => {
  const b = (await page.locator(`[data-grip=${dir}]`).boundingBox())!;
  const [x, y] = [b.x + b.width / 2, b.y + b.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
};

test.describe('terminal window', () => {
  test('is dark in day and night, with the arch prompt, neofetch facts and status bar', async ({ page }) => {
    // computed colours can be oklch(), so let a canvas convert to rgb
    const lum = () => page.locator('#sp-window').evaluate((e) => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
      ctx.fillStyle = getComputedStyle(e).backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
      return Math.max(...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
    });
    await ensureScheme(page, 'light');
    const light = await lum();
    await ensureScheme(page, 'dark');
    const dark = await lum();
    expect(light).toBeLessThan(70);
    expect(dark).toBeLessThan(70);
    await expect(page.locator('#sp-neo-win .prompt').first()).toContainText('[jcleal@archlinux ~]$ neofetch');
    await expect(page.locator('.logo')).toBeAttached();
    await expect(page.locator('#sp-facts')).toContainText('Links21');
    await expect(page.locator('#sp-facts')).toContainText('Groups2');
    await expect(page.locator('#sp-facts')).toContainText('Notes0');
    await expect(page.locator('.sp-statusbar')).toContainText('[start]');
    await expect(page.locator('#sp-clock')).toContainText('10:30');
    expect(await page.locator('#sp-window').evaluate((e) => getComputedStyle(e).fontFamily)).toContain('JetBrains Mono');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY)).toBe('none');
    await page.locator('#sp-add-note').click();
    await expect(page.locator('#sp-facts')).toContainText('Notes1');
  });

  test('content scrolls inside the window, the page does not', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'mobile stacks in the page flow');
    const m = await page.locator('#sp-terminal').evaluate((e) => ({ s: e.scrollHeight, c: e.clientHeight }));
    expect(m.s).toBeGreaterThan(m.c);
    await page.locator('#sp-terminal').focus();
    await expect(page.locator('#sp-terminal')).toBeFocused();
    await page.keyboard.press('End');
    // keyboard scrolling can be animated, so poll instead of reading once
    await expect.poll(() => page.locator('#sp-terminal').evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollTop)).toBe(0);
  });

  test('has 8 labelled resize handles', async ({ page }) => {
    const g = page.locator('.sp-grip');
    await expect(g).toHaveCount(8);
    const dirs = await g.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.grip).sort());
    expect(dirs).toEqual(['e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w']);
    for (const l of await g.all()) {
      expect(await l.getAttribute('aria-label')).toMatch(/^Resize window from/);
      expect(await l.getAttribute('tabindex')).toBe('0');
    }
  });

  test('resizes from edges and corners (pointer), persists across reload', async ({ page }, info) => {
    desktopOnlyTest(info);
    const start = await rect(page);
    expect(start).toMatchObject({ x: 24, y: 24, w: 880, h: 600 });
    await grip(page, 'se', 100, 60);
    expect(await rect(page)).toMatchObject({ x: 24, y: 24, w: 980, h: 660 });
    await grip(page, 'nw', 50, 40);
    expect(await rect(page)).toMatchObject({ x: 74, y: 64, w: 930, h: 620 });
    await grip(page, 'w', -30, 0);
    await grip(page, 'n', 0, -20);
    await grip(page, 'e', -50, 0);
    await grip(page, 'ne', 0, 0);
    const after = await rect(page);
    expect(after).toMatchObject({ x: 44, y: 44, w: 910, h: 640 });
    const s = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).window, KEY);
    expect(s).toMatchObject({ x: 44, y: 44, w: 910, h: 640 });
    await page.reload();
    expect(await rect(page)).toEqual(after);
  });

  test('keeps a minimum size and stays inside the viewport', async ({ page }, info) => {
    desktopOnlyTest(info);
    await grip(page, 'e', -2000, 0);
    await grip(page, 's', 0, -2000);
    const min = await rect(page);
    expect(min.w).toBe(320);
    expect(min.h).toBe(200);
    await grip(page, 'se', 3000, 3000);
    const big = await rect(page);
    expect(big.x + big.w).toBeLessThanOrEqual(1280);
    expect(big.y + big.h).toBeLessThanOrEqual(800);
    await grip(page, 'nw', -3000, -3000);
    const full = await rect(page);
    expect(full.x).toBe(0);
    expect(full.y).toBe(0);
    // a stored frame from a bigger screen is clamped on load
    await page.evaluate((k) => {
      const d = JSON.parse(localStorage.getItem(k)!);
      d.window = { x: 900, y: 700, w: 2000, h: 1500 };
      localStorage.setItem(k, JSON.stringify(d));
    }, KEY);
    await page.reload();
    const c = await rect(page);
    expect(c).toMatchObject({ x: 0, y: 0, w: 1280, h: 800 });
  });

  test('handles resize with the keyboard', async ({ page }, info) => {
    desktopOnlyTest(info);
    await page.locator('[data-grip=e]').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    expect((await rect(page)).w).toBe(880 + 32 + 64);
    await page.locator('[data-grip=n]').focus();
    await page.keyboard.press('ArrowUp');
    expect(await rect(page)).toMatchObject({ y: 8, h: 616 });
    await page.locator('[data-grip=se]').focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    expect(await rect(page)).toMatchObject({ w: 976 - 16, h: 616 - 16 });
    await page.reload();
    expect(await rect(page)).toMatchObject({ w: 960, h: 600 });
  });

  test('maximise / restore via the button and a title bar double-click', async ({ page }, info) => {
    desktopOnlyTest(info);
    await page.locator('[data-grip=se]').focus();
    await page.keyboard.press('Shift+ArrowRight');
    const before = await rect(page);
    await page.locator('#sp-max').click();
    expect(await rect(page)).toEqual({ x: 0, y: 0, w: 1280, h: 800 });
    await expect(page.locator('#sp-max')).toHaveAttribute('aria-label', 'Restore window size');
    await page.reload();
    expect(await rect(page)).toEqual({ x: 0, y: 0, w: 1280, h: 800 });
    await page.locator('#sp-bar .sp-title').dblclick();
    expect(await rect(page)).toEqual(before);
    await page.locator('#sp-bar .sp-title').dblclick();
    expect((await rect(page)).w).toBe(1280);
    await page.locator('#sp-max').click();
    expect(await rect(page)).toEqual(before);
  });

  test('minimise collapses to the title bar and close leaves a restore chip', async ({ page }, info) => {
    desktopOnlyTest(info);
    await page.locator('#sp-min').click();
    expect((await rect(page)).h).toBeLessThan(60);
    await page.locator('#sp-min').click();
    expect((await rect(page)).h).toBe(600);
    await page.locator('#sp-close').click();
    await expect(page.locator('#sp-window')).toBeHidden();
    await page.locator('#sp-chip').click();
    await expect(page.locator('#sp-window')).toBeVisible();
  });

  test('Reset layout restores the default frame', async ({ page }, info) => {
    desktopOnlyTest(info);
    await grip(page, 'se', 100, 60);
    await page.locator('#sp-reset-layout').click();
    expect(await rect(page)).toMatchObject({ x: 24, y: 24, w: 880, h: 600 });
    expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).window, KEY)).toBeNull();
  });
});

test.describe('buttons', () => {
  const unnamed = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll('button')).filter((b) => b.offsetParent !== null || getComputedStyle(b).position === 'fixed')
    .filter((b) => !(b.getAttribute('aria-label') || b.textContent || '').trim()).map((b) => b.id || b.className));

  test('every button has an accessible name, in view and edit mode and with notes', async ({ page }) => {
    await page.locator('#sp-add-note').click();
    expect(await unnamed(page)).toEqual([]);
    await edit(page);
    expect(await unnamed(page)).toEqual([]);
    await page.locator('#sp-add-link').click();
    expect(await unnamed(page)).toEqual([]);
  });

  test('toolbar actions are real, bordered buttons with icons and distinct hover/focus states', async ({ page }) => {
    for (const id of ['sp-edit', 'sp-add-link', 'sp-add-group', 'sp-add-note', 'sp-export', 'sp-import-btn', 'sp-reset-layout', 'scheme-toggle', 'palette-trigger']) {
      const b = page.locator('#' + id);
      expect(await b.evaluate((e) => e.tagName)).toBe('BUTTON');
      expect(await b.evaluate((e) => parseFloat(getComputedStyle(e).borderTopWidth))).toBeGreaterThanOrEqual(1);
      await expect(b.locator('svg')).toHaveCount(1);
    }
    const b = page.locator('#sp-export');
    const idle = await b.evaluate((e) => getComputedStyle(e).backgroundColor);
    await b.hover();
    await expect.poll(() => b.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe(idle); // background transitions over 120ms.
    await b.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    expect(await b.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe('none');
  });

  test('edit mode shows icon buttons with names and tooltips on each row', async ({ page }) => {
    await expect(page.locator('.sp-ib')).toHaveCount(0);
    await edit(page);
    await expect(page.locator('#sp-edit')).toHaveAttribute('aria-pressed', 'true');
    const row = page.locator('.sp-link').first();
    for (const [cls, name] of [['sp-up', 'Move mail up'], ['sp-down', 'Move mail down'], ['sp-edit-link', 'Edit mail'], ['sp-del-link', 'Delete mail']]) {
      const b = row.locator('.' + cls);
      await expect(b).toHaveAttribute('aria-label', name);
      await expect(b).toHaveAttribute('title', name);
      await expect(b.locator('svg')).toHaveCount(1);
    }
    await row.locator('.sp-edit-link').click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('mail');
    await expect(page.getByLabel('URL')).toBeVisible();
  });
});

test.describe('post-it notes', () => {
  const bgOf = (page: Page, i = 0) => page.locator('.sp-note').nth(i).evaluate((e) => getComputedStyle(e).backgroundColor);
  const slotOf = (page: Page, i = 0) => page.evaluate(([k, i]) => JSON.parse(localStorage.getItem(k as string)!).notes[i as number].slot, [KEY, i]);

  test('colours are derived from the picker and day/night, stored as a slot, and follow both after reload', async ({ page }) => {
    await page.locator('#sp-add-note').click();
    await page.locator('.sp-note .sp-colour[data-slot="3"]').click();
    expect(await slotOf(page)).toBe(3);
    const raw = await page.evaluate((k) => localStorage.getItem(k)!, KEY);
    expect(JSON.stringify(JSON.parse(raw).notes)).not.toMatch(/#[0-9a-f]{3,6}|colour/i);

    const first = await bgOf(page);
    await setColours(page, '#118833', '#aa22cc');
    const picked = await bgOf(page);
    expect(picked).not.toBe(first);
    await ensureScheme(page, 'dark');
    const night = await bgOf(page);
    expect(night).not.toBe(picked);

    await page.reload();
    expect(await bgOf(page)).toBe(night);
    expect(await slotOf(page)).toBe(3);
    await expect(page.locator('.sp-note')).toHaveClass(/sp-slot-3/);
    await ensureScheme(page, 'light');
    expect(await bgOf(page)).toBe(picked);

    // each of the six dots is a different tint
    const dots = await page.locator('.sp-note .sp-colour').evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
    expect(new Set(dots).size).toBe(6);
    await page.locator('.sp-note .sp-colour[data-slot="1"]').click();
    expect(await bgOf(page)).not.toBe(picked);
    await expect(page.locator('.sp-note .sp-colour[data-slot="1"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('every slot keeps AA text contrast, light and dark, for default, teal/pink, near-white and extreme picks', async ({ page }) => {
    const slots = [0, 1, 2, 3, 4, 5].map((slot, i) => ({ id: 'n' + i, x: 940, y: 40 + i * 20, text: 'note ' + i, slot }));
    await page.evaluate(([k, notes]) => {
      const d = JSON.parse(localStorage.getItem(k as string)!) || {};
      localStorage.setItem(k as string, JSON.stringify({ version: 1, window: null, groups: [], notes, ...(d.groups ? { groups: d.groups } : {}) }));
    }, [KEY, slots]);
    await page.reload();
    for (const scheme of ['light', 'dark'] as const) {
      await ensureScheme(page, scheme);
      for (const [p, s] of SWEEP) {
        await setColours(page, p, s);
        const notes = await page.locator('.sp-note').evaluateAll((els) => els.map((e) => {
          const cs = (x: Element) => getComputedStyle(x);
          return { bg: cs(e).backgroundColor, ink: cs(e.querySelector('textarea')!).color, bar: cs(e.querySelector('.sp-note-bar')!).backgroundColor };
        }));
        expect(notes).toHaveLength(6);
        notes.forEach((n, i) => {
          expect(contrast(rgb(n.ink), rgb(n.bg)), `${p}/${s} ${scheme} slot ${i} paper`).toBeGreaterThanOrEqual(4.5);
          expect(contrast(rgb(n.ink), rgb(n.bar)), `${p}/${s} ${scheme} slot ${i} bar`).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  });

  test('terminal and controls keep AA contrast in edit mode with a custom palette, light and dark', async ({ page }) => {
    await edit(page);
    for (const scheme of ['light', 'dark'] as const) {
      await ensureScheme(page, scheme);
      for (const [p, s] of [SWEEP[1], SWEEP[2], ['#118833', '#aa22cc'] as [string, string]]) {
        await setColours(page, p, s);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300); // let colour transitions settle
        const bad = await contrastFailures(page, 4.5);
        expect(bad, `${p}/${s} ${scheme}: ${JSON.stringify(bad.slice(0, 4))}`).toEqual([]);
      }
    }
  });

  test('migrates a stored note that still has a colour name or hex', async ({ page }) => {
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ version: 1, window: null, groups: [], notes: [
      { id: 'a', x: 10, y: 10, text: 'old pink', colour: 'pink' }, { id: 'b', x: 30, y: 30, text: 'old hex', colour: '#7bd88f' }] })), KEY);
    await page.reload();
    await expect(page.locator('.sp-note')).toHaveCount(2);
    await expect(page.locator('.sp-note').nth(0)).toHaveClass(/sp-slot-4/);
    await expect(page.locator('.sp-note').nth(1)).toHaveClass(/sp-slot-3/);
    await page.locator('.sp-note textarea').first().fill('touched');
    expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).notes.map((n: any) => [n.slot, 'colour' in n]), KEY)).toEqual([[3, false], [4, false]]); // the touched note is raised to the end
  });

  test('a note has a size, a corner resize handle (pointer + keyboard) and the size persists', async ({ page }, info) => {
    desktopOnlyTest(info);
    await page.locator('#sp-add-note').click();
    const n = page.locator('.sp-note');
    const size = () => n.evaluate((e) => [e.offsetWidth, e.offsetHeight]);
    expect(await size()).toEqual([210, 170]);
    const g = (await page.locator('.sp-note-grip').boundingBox())!;
    await page.mouse.move(g.x + 8, g.y + 8);
    await page.mouse.down();
    await page.mouse.move(g.x + 68, g.y + 48, { steps: 5 });
    await page.mouse.up();
    expect(await size()).toEqual([270, 210]);
    await page.locator('.sp-note-grip').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    expect(await size()).toEqual([286, 226]);
    await page.reload();
    expect(await size()).toEqual([286, 226]);
    expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).notes[0], KEY)).toMatchObject({ w: 286, h: 226 });
    // never below the minimum
    await page.locator('.sp-note-grip').focus();
    for (let i = 0; i < 15; i++) await page.keyboard.press('Shift+ArrowLeft');
    expect(await size()).toEqual([120, 226]);
  });

  test('focusing or clicking a note raises it above the others and the order persists', async ({ page }) => {
    for (const t of ['one', 'two']) {
      await page.locator('#sp-add-note').click();
      await page.locator('.sp-note textarea').last().fill(t);
    }
    const z = (i: number) => page.locator('.sp-note').nth(i).evaluate((e) => Number(getComputedStyle(e).zIndex));
    expect(await z(1)).toBeGreaterThan(await z(0));
    await page.locator('.sp-note').nth(0).locator('.sp-note-bar').click({ position: { x: 150, y: 4 } });
    expect(await z(0)).toBeGreaterThan(await z(1));
    await page.reload();
    expect(await page.locator('.sp-note textarea').last().inputValue()).toBe('one');
    expect(await z(1)).toBeGreaterThan(await z(0));
  });

  test('looks like paper: tiny tilt that straightens on hover, soft shadow', async ({ page }, info) => {
    await page.locator('#sp-add-note').click();
    const n = page.locator('.sp-note');
    const tilt = await n.evaluate((e) => parseFloat(getComputedStyle(e).getPropertyValue('--tilt')));
    expect(Math.abs(tilt)).toBeLessThanOrEqual(2.1);
    expect(await n.evaluate((e) => getComputedStyle(e).boxShadow)).not.toBe('none');
    if (info.project.name === 'desktop') {
      await page.locator('#sp-add-note').focus();
      await page.mouse.move(2, 2);
      await n.hover();
      await expect.poll(() => n.evaluate((e) => getComputedStyle(e).transform)).toBe('none');
    }
  });
});

test.describe('mobile layout', () => {
  test('is full width, in flow, with all tools reachable and no horizontal scroll', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'mobile only');
    await page.locator('#sp-add-note').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    const w = await rect(page);
    expect(w.x).toBeLessThanOrEqual(12);
    expect(w.x + w.w).toBeGreaterThanOrEqual(390 - 12);
    await expect(page.locator('.sp-grip').first()).toBeHidden();
    for (const id of ['sp-edit', 'sp-add-link', 'sp-add-group', 'sp-add-note', 'sp-export', 'sp-import-btn', 'sp-reset-layout']) {
      const b = (await page.locator('#' + id).boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(390);
      expect(b.height).toBeGreaterThanOrEqual(28);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const nb = (await page.locator('.sp-note').boundingBox())!;
    expect(nb.x).toBeGreaterThanOrEqual(0);
    expect(nb.x + nb.width).toBeLessThanOrEqual(390);
    const c = (await page.locator('.sp-colour').first().boundingBox())!;
    expect(c.width).toBeGreaterThanOrEqual(20);
    await edit(page);
    await page.locator('.sp-link').first().locator('.sp-edit-link').click();
    const f = (await page.locator('.sp-form input[name=url]').boundingBox())!;
    expect(f.x + f.width).toBeLessThanOrEqual(390);
  });
});
