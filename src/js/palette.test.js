import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const PALETTES = ['ocean', 'forest', 'sunset', 'violet', 'yellow', 'grey', 'purple', 'crimson', 'teal'];

// palette.js is a plain IIFE (no exports) that attaches to window.Palette as a
// side effect of being evaluated. Re-import it fresh per test (cache-busting
// query string + vi.resetModules) so no state leaks between tests.
async function loadPalette() {
  vi.resetModules();
  delete window.Palette;
  await import(/* @vite-ignore */ `./palette.js?t=${Date.now()}-${Math.random()}`);
  return window.Palette;
}

function fireDomContentLoaded() {
  document.dispatchEvent(new Event('DOMContentLoaded'));
}

// `document` itself is not recreated between tests, so listeners init()
// attaches directly to it (the DOMContentLoaded handler, and the
// click-outside-popup handler) would otherwise pile up test over test and
// double-fire. Track and strip them off after every test.
let documentListeners = [];

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = '';
  document.body.innerHTML = '';

  documentListeners = [];
  const realAddEventListener = document.addEventListener.bind(document);
  vi.spyOn(document, 'addEventListener').mockImplementation((type, handler, options) => {
    documentListeners.push({ type, handler, options });
    return realAddEventListener(type, handler, options);
  });
});

afterEach(() => {
  documentListeners.forEach(({ type, handler, options }) => {
    document.removeEventListener(type, handler, options);
  });
  vi.restoreAllMocks();
});

describe('Palette.init — initial palette application', () => {
  it('applies the stored palette class on init', async () => {
    window.localStorage.setItem('palette', 'ocean');
    const Palette = await loadPalette();

    Palette.init();

    expect(document.documentElement.classList.contains('ocean')).toBe(true);
    PALETTES.filter((p) => p !== 'ocean').forEach((p) => {
      expect(document.documentElement.classList.contains(p)).toBe(false);
    });
  });

  it('adds no palette class when nothing is stored', async () => {
    const Palette = await loadPalette();

    Palette.init();

    PALETTES.forEach((p) => {
      expect(document.documentElement.classList.contains(p)).toBe(false);
    });
  });

  it('adds no palette class when the stored value is not a recognized palette', async () => {
    window.localStorage.setItem('palette', 'nonsense');
    const Palette = await loadPalette();

    Palette.init();

    PALETTES.forEach((p) => {
      expect(document.documentElement.classList.contains(p)).toBe(false);
    });
  });

  it('marks the matching palette button as active on init', async () => {
    document.body.innerHTML = `
      <button class="palette-btn" data-palette="ocean"></button>
      <button class="palette-btn" data-palette="forest"></button>
    `;
    window.localStorage.setItem('palette', 'ocean');
    const Palette = await loadPalette();

    Palette.init();

    const [oceanBtn, forestBtn] = document.querySelectorAll('.palette-btn');
    expect(oceanBtn.classList.contains('active')).toBe(true);
    expect(forestBtn.classList.contains('active')).toBe(false);
  });
});

describe('Palette.init — palette button clicks', () => {
  function setup() {
    document.body.innerHTML = `
      <button class="palette-btn" data-palette="ocean"></button>
      <button class="palette-btn" data-palette="forest"></button>
    `;
  }

  it('clicking the active palette button clears it', async () => {
    setup();
    window.localStorage.setItem('palette', 'ocean');
    const Palette = await loadPalette();

    Palette.init();
    fireDomContentLoaded();

    const [oceanBtn] = document.querySelectorAll('.palette-btn');
    oceanBtn.click();

    expect(window.localStorage.getItem('palette')).toBeNull();
    expect(document.documentElement.classList.contains('ocean')).toBe(false);
    expect(oceanBtn.classList.contains('active')).toBe(false);
  });

  it('clicking a different palette button switches to it', async () => {
    setup();
    window.localStorage.setItem('palette', 'ocean');
    const Palette = await loadPalette();

    Palette.init();
    fireDomContentLoaded();

    const [oceanBtn, forestBtn] = document.querySelectorAll('.palette-btn');
    forestBtn.click();

    expect(window.localStorage.getItem('palette')).toBe('forest');
    expect(document.documentElement.classList.contains('forest')).toBe(true);
    expect(document.documentElement.classList.contains('ocean')).toBe(false);
    expect(forestBtn.classList.contains('active')).toBe(true);
    expect(oceanBtn.classList.contains('active')).toBe(false);
  });
});

describe('Palette.init — dark/light scheme toggle', () => {
  function setup() {
    document.body.innerHTML = `<button id="theme-toggle"></button>`;
  }

  it('defaults to light when nothing is stored', async () => {
    setup();
    const Palette = await loadPalette();

    Palette.init({ toggleId: 'theme-toggle' });
    fireDomContentLoaded();

    const toggle = document.getElementById('theme-toggle');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(toggle.classList.contains('light')).toBe(true);
    expect(toggle.classList.contains('dark')).toBe(false);
  });

  it('clicking the toggle switches to dark and persists it', async () => {
    setup();
    const Palette = await loadPalette();

    Palette.init({ toggleId: 'theme-toggle' });
    fireDomContentLoaded();

    const toggle = document.getElementById('theme-toggle');
    toggle.click();

    expect(window.localStorage.getItem('scheme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(toggle.classList.contains('dark')).toBe(true);
    expect(toggle.classList.contains('light')).toBe(false);
  });

  it('clicking the toggle twice returns to light and persists it', async () => {
    setup();
    const Palette = await loadPalette();

    Palette.init({ toggleId: 'theme-toggle' });
    fireDomContentLoaded();

    const toggle = document.getElementById('theme-toggle');
    toggle.click();
    toggle.click();

    expect(window.localStorage.getItem('scheme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(toggle.classList.contains('light')).toBe(true);
  });

  it('respects a previously stored scheme on init', async () => {
    setup();
    window.localStorage.setItem('scheme', 'dark');
    const Palette = await loadPalette();

    Palette.init({ toggleId: 'theme-toggle' });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

describe('Palette.init — trigger/popup', () => {
  function setup() {
    document.body.innerHTML = `
      <button id="palette-trigger"></button>
      <div id="palette-popup"></div>
    `;
  }

  it('clicking the trigger opens the popup', async () => {
    setup();
    const Palette = await loadPalette();

    Palette.init({ triggerId: 'palette-trigger', popupId: 'palette-popup' });
    fireDomContentLoaded();

    document.getElementById('palette-trigger').click();

    expect(document.getElementById('palette-popup').classList.contains('open')).toBe(true);
  });

  it('clicking outside the popup closes it', async () => {
    setup();
    const Palette = await loadPalette();

    Palette.init({ triggerId: 'palette-trigger', popupId: 'palette-popup' });
    fireDomContentLoaded();

    const trigger = document.getElementById('palette-trigger');
    const popup = document.getElementById('palette-popup');
    trigger.click();
    expect(popup.classList.contains('open')).toBe(true);

    document.body.click();

    expect(popup.classList.contains('open')).toBe(false);
  });
});
