// Site-specific settings for the shared e2e master (playwright.config.ts + helpers/palette-helpers.ts).
import type { Page, PlaywrightTestConfig } from '@playwright/test';

// The shared settleStyles helper injects an inline <style> to freeze transitions, which the page's CSP (rightly) refuses;
// the CSP itself is asserted in manage.spec.ts with bypassCSP switched back off.
const bypassCSP = true;

export const site: {
  name: string;
  port: number;
  siteDir: string;
  defaults?: [string, string]; // [primary, secondary] default pair when it differs from sunset.
  snapshotTemplate?: string;
  projects: NonNullable<PlaywrightTestConfig['projects']>;
  sel: { trigger: string; popup: string; primary: string; secondary: string; reset: string; note: string; toggle: string };
  openPicker?: (page: Page) => Promise<void>;
} = {
  name: 'startpage.jcleal.me',
  port: Number(process.env.E2E_PORT || 4175), // override when another checkout's server already holds 4175 (the config reuses it).
  siteDir: '../src',
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 }, bypassCSP } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, bypassCSP } },
  ],
  sel: {
    trigger: '#palette-trigger',
    popup: '#palette-popup',
    primary: '#custom-primary',
    secondary: '#custom-secondary',
    reset: '#custom-reset',
    note: '#custom-note',
    toggle: '#scheme-toggle',
  },
};
