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

  it('notes: add, update (clamped, colour validated), delete', () => {
    const d = S.defaultDoc();
    const t = S.ops.addNote(d, -5, 7);
    expect(t).toMatchObject({ x: 0, y: 7 });
    S.ops.updateNote(d, t.id, { text: 'hi', colour: 'pink', x: 50 });
    S.ops.updateNote(d, t.id, { colour: 'bogus' });
    expect(d.notes[0]).toMatchObject({ text: 'hi', colour: 'pink', x: 50 });
    expect(S.ops.deleteNote(d, t.id)).toBe(true);
    expect(d.notes).toHaveLength(0);
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
    expect(r.doc.notes[0]).toMatchObject({ x: 0, y: 3, text: '', colour: 'yellow' });
  });

  it('safeUrl', () => {
    expect(S.safeUrl('')).toBe('');
    expect(S.safeUrl('github.com/jmpa-io')).toBe('https://github.com/jmpa-io');
    expect(S.safeUrl('ftp://x.y')).toBe('');
  });
});
