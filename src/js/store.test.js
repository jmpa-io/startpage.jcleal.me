import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const S = createRequire(import.meta.url)('./store.js');
const mem = () => {
  const m = {};
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m };
};

describe('defaults', () => {
  it('has the original 21 links in work + personal', () => {
    const d = S.defaultDoc();
    expect(d.groups.map((g) => g.name)).toEqual(['work', 'personal']);
    expect(d.groups.reduce((n, g) => n + g.links.length, 0)).toBe(21);
    expect(d.version).toBe(1);
  });
});

describe('load/save', () => {
  it('round-trips and falls back to defaults on junk', () => {
    const st = mem();
    const d = S.defaultDoc();
    S.ops.addNote(d, 10, 20);
    expect(S.save(st, d)).toBe(true);
    expect(S.load(st)).toEqual(d);
    st.setItem(S.KEY, '{nope');
    expect(S.load(st).groups).toHaveLength(2);
    st.setItem(S.KEY, JSON.stringify({ version: 99, groups: [] }));
    expect(S.load(st).groups).toHaveLength(2);
  });
});

describe('ops', () => {
  it('adds, edits, reorders and deletes links and groups', () => {
    const d = S.defaultDoc();
    const g = S.ops.addGroup(d, 'misc');
    const a = S.ops.addLink(d, g.id, 'a', 'example.com');
    const b = S.ops.addLink(d, g.id, 'b', 'https://b.example');
    expect(a.url).toBe('https://example.com');
    expect(S.ops.moveLink(d, g.id, b.id, -1)).toBe(true);
    expect(g.links.map((l) => l.name)).toEqual(['b', 'a']);
    expect(S.ops.moveLink(d, g.id, b.id, -1)).toBe(false);
    expect(S.ops.updateLink(d, g.id, a.id, 'A', 'https://a.example')).toBe(true);
    expect(g.links[1]).toMatchObject({ name: 'A', url: 'https://a.example' });
    expect(S.ops.deleteLink(d, g.id, b.id)).toBe(true);
    expect(S.ops.moveGroup(d, g.id, -1)).toBe(true);
    expect(d.groups[1].id).toBe(g.id);
    expect(S.ops.renameGroup(d, g.id, '  ')).toBe(false);
    expect(S.ops.deleteGroup(d, g.id)).toBe(true);
  });

  it('notes: add, update (clamped, slot validated), resize, raise, delete', () => {
    const d = S.defaultDoc();
    const t = S.ops.addNote(d, -5, 7);
    const u = S.ops.addNote(d, 1, 1);
    expect(t).toMatchObject({ x: 0, y: 7, slot: 0 });
    expect(u.slot).toBe(1);
    S.ops.updateNote(d, t.id, { text: 'hi', slot: 4, x: 50 });
    S.ops.updateNote(d, t.id, { slot: 99 });
    S.ops.updateNote(d, t.id, { slot: 'pink' });
    S.ops.updateNote(d, t.id, { w: 300, h: 220 });
    S.ops.updateNote(d, t.id, { w: 5, h: 5 });
    expect(d.notes[0]).toMatchObject({ text: 'hi', slot: 4, x: 50, w: 300, h: 220 });
    expect(S.ops.raiseNote(d, t.id)).toBe(true);
    expect(d.notes.map((n) => n.id)).toEqual([u.id, t.id]);
    expect(S.ops.deleteNote(d, t.id)).toBe(true);
    expect(d.notes).toHaveLength(1);
  });
});

describe('note colour migration', () => {
  const load = (notes) => S.importJSON(JSON.stringify({ version: 1, groups: [], notes })).doc.notes;

  it('maps old colour names and hexes onto palette slots, keeps valid slots', () => {
    const n = load([
      { colour: 'yellow' }, { colour: 'green' }, { colour: 'pink' }, { colour: 'blue' },
      { colour: '#ffe066' }, { colour: '#7bd88f' }, { colour: '#ff9ec7' }, { colour: '#6aa9ff' },
      { colour: '#abc' }, { colour: 'red' }, { colour: '#zzzzzz' }, {}, { slot: 5, colour: 'pink' }, { slot: 6 }, { slot: 1.5 },
    ]).map((t) => t.slot);
    expect(n).toEqual([2, 3, 4, 0, 2, 3, 4, 0, 0, 2, 2, 2, 5, 2, 2]);
  });

  it('migrates a stored v1 doc with colours on load and rewrites it with slots', () => {
    const st = mem();
    st.setItem(S.KEY, JSON.stringify({ version: 1, window: null, groups: [], notes: [{ id: 'n1', x: 4, y: 5, text: 'old', colour: 'pink' }] }));
    const d = S.load(st);
    expect(d.notes[0]).toEqual({ id: 'n1', x: 4, y: 5, text: 'old', slot: 4 });
    S.save(st, d);
    expect(JSON.parse(st.m[S.KEY]).notes[0]).not.toHaveProperty('colour');
  });
});

describe('window frame', () => {
  it('keeps size and flags, merges patches, and drops junk', () => {
    const d = S.defaultDoc();
    S.ops.setWindow(d, { x: 10, y: 20, w: 500, h: 400 });
    S.ops.setWindow(d, { max: true });
    expect(d.window).toEqual({ x: 10, y: 20, w: 500, h: 400, max: true });
    S.ops.setWindow(d, { max: false, w: 5, h: 5 });
    expect(d.window).toEqual({ x: 10, y: 20 });
    S.ops.resetWindow(d);
    expect(d.window).toBeNull();
  });
});

describe('import/export', () => {
  it('round-trips an export', () => {
    const d = S.defaultDoc();
    S.ops.addNote(d, 1, 2);
    S.ops.setWindow(d, 30, 40);
    const r = S.importJSON(S.exportJSON(d));
    expect(r.ok).toBe(true);
    expect(r.doc).toEqual(d);
  });

  it('rejects bad files without a doc', () => {
    expect(S.importJSON('nope').ok).toBe(false);
    expect(S.importJSON('{"version":2,"groups":[]}').ok).toBe(false);
    expect(S.importJSON('[]').ok).toBe(false);
  });

  it('drops javascript: and data: urls and fixes up odd fields', () => {
    const r = S.importJSON(JSON.stringify({
      version: 1,
      groups: [{ id: 'x', name: 5, links: [
        { name: 'bad', url: 'javascript:alert(1)' },
        { name: 'bad2', url: 'data:text/html,hi' },
        { name: 'ok', url: 'https://ok.example' },
        { name: 'mail', url: 'mailto:a@b.co' },
      ] }],
      notes: [{ x: 'a', y: 3, text: 9, colour: 'red' }],
    }));
    expect(r.ok).toBe(true);
    expect(r.doc.groups[0].name).toBe('group');
    expect(r.doc.groups[0].links.map((l) => l.name)).toEqual(['ok', 'mail']);
    expect(r.doc.notes[0]).toMatchObject({ x: 0, y: 3, text: '', slot: 2 });
  });

  it('safeUrl', () => {
    expect(S.safeUrl('')).toBe('');
    expect(S.safeUrl('github.com/jmpa-io')).toBe('https://github.com/jmpa-io');
    expect(S.safeUrl('ftp://x.y')).toBe('');
  });
});
