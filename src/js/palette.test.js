import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// palette.js is a plain IIFE that attaches window.Palette and registers document listeners,
// so each test gets a fresh JSDOM and a fresh module evaluation.
let dom;

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
});

afterEach(() => {
  dom?.window?.close();
});

async function loadPalette() {
  vi.resetModules();
  await import('./palette.js');
  return window.Palette;
}

const root = () => document.documentElement;
const stored = () => JSON.parse(localStorage.getItem('palette-custom'));

// --- minimal evaluator for the relative-colour strings palette.js emits (oklch(from X ...)) ---
function hexToRgb(h) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function rgbToOklch([r, g, b]) {
  const [R, G, B] = [r, g, b].map(lin);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(a, bb), (Math.atan2(bb, a) * 180) / Math.PI];
}
function oklchToRgb([L, C, H]) {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  // gamut clip by reducing chroma
  if (rgb.some((v) => v < -1e-4 || v > 1 + 1e-4) && C > 0) return oklchToRgb([L, C * 0.97, H]);
  return rgb.map((v) => Math.min(1, Math.max(0, gam(Math.min(1, Math.max(0, v))))));
}
function evalColour(str) {
  str = str.trim();
  if (str[0] === '#') return str.length === 4 ? hexToRgb('#' + [...str.slice(1)].map((c) => c + c).join('')) : hexToRgb(str);
  if (str.startsWith('oklch(from ')) {
    const inner = str.slice(11, -1);
    let src;
    let rest;
    if (inner[0] === '#') {
      src = inner.slice(0, 7);
      rest = inner.slice(8);
    } else {
      let depth = 0;
      let i = 0;
      for (; i < inner.length; i++) {
        if (inner[i] === '(') depth++;
        if (inner[i] === ')' && --depth === 0) break;
      }
      src = inner.slice(0, i + 1);
      rest = inner.slice(i + 2);
    }
    const [L, C, H] = rgbToOklch(evalColour(src));
    let nl;
    let m;
    if ((m = rest.match(/^clamp\(([\d.]+), l, ([\d.]+)\) c h$/))) nl = Math.min(+m[2], Math.max(+m[1], L));
    else if ((m = rest.match(/^calc\(l ([+-]) ([\d.]+)\) c h$/))) nl = L + (m[1] === '+' ? 1 : -1) * +m[2];
    else if ((m = rest.match(/^([\d.]+) min\(c, ([\d.]+)\) h$/))) return oklchToRgb([+m[1], Math.min(C, +m[2]), H]);
    else throw new Error('unsupported: ' + str);
    return oklchToRgb([nl, C, H]);
  }
  if (str.startsWith('oklch(')) {
    const [l, c, h] = str.slice(6, -1).split(/\s+/).map(Number);
    return oklchToRgb([l, c, h]);
  }
  throw new Error('unsupported: ' + str);
}
function luminance(rgb) {
  const [r, g, b] = rgb.map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [x, y] = [luminance(evalColour(a)), luminance(evalColour(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const SWEEP = ['#ffffff', '#000000', '#808080', '#fffde0', '#ff0000', '#0000ff', '#00ff00', '#ffff00', '#c04828', '#2f7fae'];

describe('contrast sweep (WCAG AA) in both schemes', () => {
  for (const dark of [false, true]) {
    for (const p of SWEEP) {
      it(`${dark ? 'dark' : 'light'} primary ${p} with a range of secondaries`, async () => {
        const Palette = await loadPalette();
        for (const s of SWEEP) {
          const v = Palette.vars({ primary: p, secondary: s }, dark);
          const ctx = `${p}/${s}`;
          for (const bg of ['--pal-bg', '--pal-surface', '--pal-surface-2']) {
            expect(contrast(v['--pal-text'], v[bg]), `text on ${bg} ${ctx}`).toBeGreaterThanOrEqual(4.5);
            expect(contrast(v['--pal-heading'], v[bg]), `heading on ${bg} ${ctx}`).toBeGreaterThanOrEqual(4.5);
            expect(contrast(v['--pal-muted'], v[bg]), `muted on ${bg} ${ctx}`).toBeGreaterThanOrEqual(4.5);
            expect(contrast(v['--pal-link'], v[bg]), `link on ${bg} ${ctx}`).toBeGreaterThanOrEqual(4.5);
            expect(contrast(v['--pal-accent2'], v[bg]), `accent2 on ${bg} ${ctx}`).toBeGreaterThanOrEqual(4.5);
            expect(contrast(v['--pal-border-strong'], v[bg]), `border on ${bg} ${ctx}`).toBeGreaterThanOrEqual(3);
          }
          expect(contrast(v['--pal-btn-text'], v['--pal-btn']), `button ${ctx}`).toBeGreaterThanOrEqual(4.5);
          expect(contrast(v['--pal-sel-text'], v['--pal-sel-bg']), `selection ${ctx}`).toBeGreaterThanOrEqual(4.5);
          expect(contrast(v['--pal-code-text'], v['--pal-code-bg']), `code ${ctx}`).toBeGreaterThanOrEqual(4.5);
          expect(contrast('#ffffff', v['--pal-title-a']), `title a ${ctx}`).toBeGreaterThanOrEqual(4.5);
          expect(contrast('#ffffff', v['--pal-title-b']), `title b ${ctx}`).toBeGreaterThanOrEqual(3);
        }
      });
    }
  }
});

describe('Palette.init defaults and application', () => {
  it('works with no options and applies the sunset default', async () => {
    const Palette = await loadPalette();
    Palette.init();
    expect(Palette.get()).toEqual({ primary: '#c04828', secondary: '#2f7fae', custom: false });
    expect(root().style.getPropertyValue('--pal-primary')).toBe('#c04828');
    expect(root().style.getPropertyValue('--pal-link')).toContain('oklch(from');
  });

  it('applies stored custom colours on init without waiting for DOMContentLoaded', async () => {
    localStorage.setItem('palette-custom', JSON.stringify({ primary: '#008080', secondary: '#FF69B4' }));
    const Palette = await loadPalette();
    Palette.init();
    expect(Palette.get()).toEqual({ primary: '#008080', secondary: '#ff69b4', custom: true });
    expect(root().style.getPropertyValue('--pal-primary')).toBe('#008080');
    expect(root().style.getPropertyValue('--pal-secondary')).toBe('#ff69b4');
  });

  it('rebuilds variables when the scheme is dark', async () => {
    localStorage.setItem('scheme', 'dark');
    const Palette = await loadPalette();
    Palette.init();
    expect(root().classList.contains('dark')).toBe(true);
    expect(root().style.getPropertyValue('--pal-bg')).toContain('0.16');
  });
});

describe('persistence, reset', () => {
  it('set() persists and applies; reset() clears storage and inline vars return to default', async () => {
    const Palette = await loadPalette();
    Palette.init();
    Palette.set({ primary: '#112233', secondary: '#ddeeff' });
    expect(stored()).toEqual({ primary: '#112233', secondary: '#ddeeff' });
    expect(root().style.getPropertyValue('--pal-primary')).toBe('#112233');
    Palette.reset();
    expect(localStorage.getItem('palette-custom')).toBeNull();
    expect(Palette.get().custom).toBe(false);
    expect(root().style.getPropertyValue('--pal-primary')).toBe('#c04828');
  });

  it('notifies onChange listeners', async () => {
    const Palette = await loadPalette();
    Palette.init();
    const fn = vi.fn();
    Palette.onChange(fn);
    Palette.set({ primary: '#112233', secondary: '#ddeeff' });
    expect(fn.mock.calls.at(-1)[0].primary).toBe('#112233');
  });

  it('set() ignores invalid colours', async () => {
    const Palette = await loadPalette();
    Palette.init();
    Palette.set({ primary: 'red;}', secondary: '#ddeeff' });
    expect(localStorage.getItem('palette-custom')).toBeNull();
    expect(Palette.get().custom).toBe(false);
  });
});

describe('migration from the legacy preset key', () => {
  it('maps a preset name to its pair, then deletes the old key', async () => {
    localStorage.setItem('palette', 'teal');
    const Palette = await loadPalette();
    Palette.init();
    expect(stored()).toEqual({ primary: '#007c6e', secondary: '#cf386b' });
    expect(localStorage.getItem('palette')).toBeNull();
    expect(Palette.get().primary).toBe('#007c6e');
  });

  it('does not overwrite existing custom colours, but still removes the old key', async () => {
    localStorage.setItem('palette', 'teal');
    localStorage.setItem('palette-custom', JSON.stringify({ primary: '#111111', secondary: '#eeeeee' }));
    const Palette = await loadPalette();
    Palette.init();
    expect(stored()).toEqual({ primary: '#111111', secondary: '#eeeeee' });
    expect(localStorage.getItem('palette')).toBeNull();
  });

  it('removes an unknown legacy value without creating custom colours', async () => {
    localStorage.setItem('palette', '"><script>');
    const Palette = await loadPalette();
    Palette.init();
    expect(localStorage.getItem('palette')).toBeNull();
    expect(localStorage.getItem('palette-custom')).toBeNull();
    expect(Palette.get().custom).toBe(false);
  });
});

describe('invalid storage is ignored safely', () => {
  for (const bad of ['{"primary":"red;}"}', '{"primary":"#fff","secondary":"#000"}', 'not json', '[]', 'null', '{"primary":"#12345g","secondary":"#123456"}']) {
    it(`ignores ${bad}`, async () => {
      localStorage.setItem('palette-custom', bad);
      const Palette = await loadPalette();
      Palette.init();
      expect(Palette.get()).toEqual({ primary: '#c04828', secondary: '#2f7fae', custom: false });
      expect(root().getAttribute('style') || '').not.toContain('red;}');
    });
  }
});

describe('day/night scheme', () => {
  function mockOs(initial) {
    let dark = initial === 'dark';
    const listeners = [];
    window.matchMedia = () => ({
      get matches() { return dark; },
      addEventListener: (_t, fn) => listeners.push(fn),
    });
    return (next) => { dark = next === 'dark'; listeners.forEach((fn) => fn()); };
  }

  it('defaults to the OS scheme when nothing is stored', async () => {
    mockOs('dark');
    const Palette = await loadPalette();
    Palette.init();
    expect(root().classList.contains('dark')).toBe(true);
    expect(root().getAttribute('data-scheme')).toBe('dark');
  });

  it('live-updates on OS change only while there is no explicit choice', async () => {
    const setOs = mockOs('light');
    const Palette = await loadPalette();
    Palette.init();
    expect(root().classList.contains('dark')).toBe(false);
    setOs('dark');
    expect(root().classList.contains('dark')).toBe(true);
    Palette.setScheme('light');
    setOs('dark');
    expect(root().classList.contains('dark')).toBe(false);
    Palette.followOs();
    expect(root().classList.contains('dark')).toBe(true);
  });

  it('toggleScheme persists under `scheme`, re-derives vars, and survives a reload', async () => {
    mockOs('light');
    let Palette = await loadPalette();
    Palette.init();
    const light = root().style.getPropertyValue('--pal-bg');
    Palette.toggleScheme();
    expect(localStorage.getItem('scheme')).toBe('dark');
    expect(root().style.getPropertyValue('--pal-bg')).not.toBe(light);
    Palette = await loadPalette();
    root().classList.remove('dark');
    Palette.init();
    expect(root().classList.contains('dark')).toBe(true);
  });

  it('ignores an invalid stored scheme and notifies onScheme', async () => {
    mockOs('light');
    localStorage.setItem('scheme', 'blue');
    const Palette = await loadPalette();
    const seen = [];
    Palette.init({ onScheme: (s) => seen.push(s) });
    expect(seen[0]).toBe('light');
    expect(Palette.setScheme('nope')).toBe(false);
  });
});

describe('popup wiring', () => {
  function markup() {
    document.body.innerHTML = `
      <button id="t" aria-expanded="false"></button>
      <div id="p" hidden>
        <input id="a" type="color" value="#c04828"><input id="b" type="color" value="#2f7fae">
        <button id="r">Reset</button><span id="n"></span>
      </div>
      <p id="out">outside</p>`;
  }
  async function boot() {
    markup();
    const Palette = await loadPalette();
    Palette.init({ triggerId: 't', popupId: 'p', customIds: { primary: 'a', secondary: 'b', reset: 'r', note: 'n' } });
    document.dispatchEvent(new window.Event('DOMContentLoaded'));
    return Palette;
  }

  it('colour inputs update the palette immediately; reset restores defaults', async () => {
    const Palette = await boot();
    const a = document.getElementById('a');
    a.value = '#008080';
    a.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(stored().primary).toBe('#008080');
    expect(Palette.get().custom).toBe(true);
    document.getElementById('r').click();
    expect(localStorage.getItem('palette-custom')).toBeNull();
    expect(a.value).toBe('#c04828');
  });

  it('trigger toggles aria-expanded; outside click and Escape close; inputs do not', async () => {
    await boot();
    const t = document.getElementById('t');
    const p = document.getElementById('p');
    t.click();
    expect(t.getAttribute('aria-expanded')).toBe('true');
    expect(p.classList.contains('open')).toBe(true);
    document.getElementById('a').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(t.getAttribute('aria-expanded')).toBe('true');
    document.getElementById('out').click();
    expect(t.getAttribute('aria-expanded')).toBe('false');
    t.click();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(t.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows the readability note only when a colour had to be adjusted', async () => {
    await boot();
    const a = document.getElementById('a');
    a.value = '#fffde0';
    a.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(document.getElementById('n').textContent).toMatch(/adjusted for readability/);
    a.value = '#8a3a1a';
    document.getElementById('b').value = '#2a6590';
    a.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(document.getElementById('n').textContent).toBe('');
  });

  it('Palette.note() exposes the same text for UIs without a note element', async () => {
    const P = await loadPalette();
    P.init({});
    expect(P.note()).toBe('');
    P.set({ primary: '#fffde0', secondary: '#2a6590' });
    expect(P.note()).toMatch(/Primary adjusted for readability/);
    P.reset();
    expect(P.note()).toBe('');
  });
});
