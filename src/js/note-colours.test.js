import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const N = createRequire(import.meta.url)('./note-colours.js');

const PAIRS = [
  ['#c04828', '#2f7fae'], ['#008080', '#ff69b4'], ['#fffde0', '#ffffff'], ['#ffffff', '#ffffff'],
  ['#000000', '#000000'], ['#808080', '#808080'], ['#ff0000', '#0000ff'], ['#00ff00', '#ffff00'],
];

describe('note tints', () => {
  it('gives 6 slots with AA ink on the paper and on the title strip, light and dark', () => {
    for (const [p, s] of PAIRS) {
      for (const dark of [false, true]) {
        const t = N.tints(p, s, dark);
        expect(t).toHaveLength(N.SLOTS);
        t.forEach((x, i) => {
          expect(N.contrast(x.ink, x.bg), `${p}/${s} dark=${dark} slot ${i} paper`).toBeGreaterThanOrEqual(4.5);
          expect(N.contrast(x.ink, x.bar), `${p}/${s} dark=${dark} slot ${i} bar`).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  });

  it('follows the picker and the scheme', () => {
    const a = N.tints('#c04828', '#2f7fae', false);
    const b = N.tints('#118833', '#aa22cc', false);
    for (let i = 0; i < 6; i++) expect(b[i].bg, `slot ${i}`).not.toBe(a[i].bg);
    expect(N.tints('#c04828', '#2f7fae', true)[0].bg).not.toBe(a[0].bg);
    expect(new Set(a.map((x) => x.bg)).size).toBe(6);
  });
});
