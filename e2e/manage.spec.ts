import { test, expect, type Page } from './fixtures';

const KEY = 'startpage.v1';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await page.reload();
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
  await work.locator('.sp-add-link').click();
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
  await page.locator('.sp-add-link').first().click();
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
  await note.locator('.sp-colour[data-colour=pink]').click();
  await expect(note).toHaveClass(/sp-note-pink/);

  if (info.project.name === 'desktop') {
    const b = (await note.locator('.sp-note-bar').boundingBox())!;
    const n0 = (await note.boundingBox())!;
    await page.mouse.move(b.x + 120, b.y + 8);
    await page.mouse.down();
    await page.mouse.move(b.x + 160, b.y + 78, { steps: 5 });
    await page.mouse.up();
    const n1 = (await note.boundingBox())!;
    expect(Math.round(n1.x - n0.x)).toBe(40);
    expect(Math.round(n1.y - n0.y)).toBe(70);
  }

  await page.reload();
  const again = page.locator('.sp-note');
  await expect(again).toHaveCount(1);
  await expect(again.locator('textarea')).toHaveValue('remember the milk');
  await expect(again).toHaveClass(/sp-note-pink/);
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

test('screenshots: edit mode with a note', async ({ page }) => {
  await page.locator('#sp-add-note').click();
  await page.locator('.sp-note textarea').fill('buy milk');
  await edit(page);
  await expect(page).toHaveScreenshot('manage.png');
});
