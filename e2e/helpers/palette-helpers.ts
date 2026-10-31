// MASTER COPY - mirror, do not edit per-repo. Master lives in jmpa-io/jcleal.me/e2e; sync with `make e2e-sync` (see README).
// Shared Playwright helpers for the Primary/Secondary colour picker + day/night scheme. Site specifics come from ../site.ts.
import { expect, type Page } from '@playwright/test';
import { site } from '../site';

export type Scheme = 'light' | 'dark';
export type Failure = { text: string; ratio: number; fg: string; bg: string; tag: string };

// ---- WCAG maths (usable from Node, e.g. for asserting on values read from the page) ----
export const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lin = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
export const luminance = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const contrast = (a: number[], b: number[]) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// Colour pairs used for sweeps and screenshots. The default pair is per-site (site.defaults); sunset when a site sets none.
export const DEFAULT_PAIR: [string, string] = site.defaults ?? ['#c04828', '#2f7fae'];
export const SWEEP: [string, string][] = [
  DEFAULT_PAIR,
  ['#008080', '#ff69b4'],
  ['#fffde0', '#ffffff'],
  ['#ffffff', '#ffffff'],
  ['#000000', '#000000'],
  ['#808080', '#808080'],
  ['#ff0000', '#0000ff'],
];
export const NAMED: Record<string, [string, string]> = { 'teal-pink': SWEEP[1], 'near-white': SWEEP[2] };

// ---- page helpers ----
export const clearStorage = (page: Page) => page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
export const emulateScheme = (page: Page, scheme: Scheme) => page.emulateMedia({ colorScheme: scheme });
export const isDark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains('dark'));
export const storedColours = (page: Page) => page.evaluate(() => localStorage.getItem('palette-custom'));
export const storedScheme = (page: Page) => page.evaluate(() => localStorage.getItem('scheme'));

export async function openPopup(page: Page) {
  if (site.openPicker) return site.openPicker(page);
  if (await page.locator(site.sel.popup).evaluate((e) => e.classList.contains('open'))) return;
  await page.locator(site.sel.trigger).click();
  await expect(page.locator(site.sel.popup)).toHaveClass(/open/);
}

// Sets both colours exactly as a user would (input events), opening the picker first if needed.
export async function setColours(page: Page, primary: string, secondary: string) {
  await openPopup(page);
  for (const [sel, v] of [[site.sel.primary, primary], [site.sel.secondary, secondary]] as const) {
    await page.locator(sel).evaluate((el: HTMLInputElement, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, v);
  }
}

export const resetColours = async (page: Page) => { await openPopup(page); await page.locator(site.sel.reset).click(); };

// Clicks the sun/moon toggle and waits for the scheme to flip.
export async function toggleScheme(page: Page) {
  const before = await isDark(page);
  await page.locator(site.sel.toggle).click();
  await expect.poll(() => isDark(page)).toBe(!before);
}

// Flips the scheme through the UI only when it differs (no-op if already there).
export async function ensureScheme(page: Page, scheme: Scheme) {
  if ((await isDark(page)) !== (scheme === 'dark')) await toggleScheme(page);
}

// Seeds localStorage then reloads so the head script applies it before first paint.
export async function seedColours(page: Page, primary: string, secondary: string) {
  await page.evaluate(([p, s]) => localStorage.setItem('palette-custom', JSON.stringify({ primary: p, secondary: s })), [primary, secondary]);
  await page.reload();
}

// Records a documentElement probe at readyState 'interactive' (before DOMContentLoaded handlers run) in window.__early.
export async function recordEarly(page: Page, probe: 'colour' | 'dark') {
  await page.addInitScript((probe) => {
    document.addEventListener('readystatechange', () => {
      if (document.readyState !== 'interactive') return;
      const r = document.documentElement;
      (window as any).__early = probe === 'dark' ? r.classList.contains('dark') : r.style.getPropertyValue('--pal-primary');
    });
  }, probe);
}

// Removes CSS transitions/animations so computed colours are settled when read.
// Uses a constructed stylesheet (CSSOM), which a strict style-src CSP does not block, unlike an inline <style>.
export async function settleStyles(page: Page) {
  await page.addInitScript(() => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('*,*::before,*::after{transition:none!important;animation:none!important}');
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  });
}

// Walks every visible text-bearing element under `root`, resolves fg/effective bg to sRGB, returns those below `min`.
export async function contrastFailures(page: Page, min = 4.5, root = 'body'): Promise<Failure[]> {
  return page.evaluate(
    ({ min, root }) => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
      const rgba = (css: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2], d[3] / 255];
      };
      const lin = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      const lum = (c: number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
      const bgOf = (el: Element | null): number[] => {
        for (let e = el; e; e = e.parentElement) {
          const c = rgba(getComputedStyle(e).backgroundColor);
          if (c[3] > 0.95) return c;
        }
        return rgba(getComputedStyle(document.documentElement).colorScheme === 'dark' ? '#000' : '#fff');
      };
      const out: any[] = [];
      const seen = new Set<Element>();
      const walker = document.createTreeWalker(document.querySelector(root)!, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || seen.has(el) || !n.textContent!.trim()) continue;
        seen.add(el);
        const st = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (st.visibility === 'hidden' || st.display === 'none' || +st.opacity === 0 || r.width === 0 || r.height === 0) continue;
        if (el.closest('script,style,svg,[hidden],.sr-only')) continue;
        const fg = rgba(st.color);
        const bg = bgOf(el);
        const [a, b] = [lum(fg), lum(bg)];
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        if (ratio < min) out.push({ text: n.textContent!.trim().slice(0, 40), ratio: +ratio.toFixed(2), fg: st.color, bg: `rgb(${bg.slice(0, 3)})`, tag: el.tagName + '.' + el.className });
      }
      (window as any).__auditCount = seen.size;
      return out;
    },
    { min, root },
  );
}
