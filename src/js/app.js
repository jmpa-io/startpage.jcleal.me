// Start page UI: renders the StartStore document as a draggable terminal window plus post-it notes.
// Everything is built with createElement/textContent: stored text is never parsed as HTML.
(function () {
  var S = window.StartStore;
  var doc = S.load(localStorage);
  var editing = false; // edit mode toggles the per-item controls
  var form = null; // the one open inline form: {type, gid, lid}
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var GH_PATH = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z';

  var $ = function (id) { return document.getElementById(id); };
  var win = $('sp-window');
  var bar = $('sp-bar');
  var tree = $('sp-tree');
  var notesEl = $('sp-notes');
  var status = $('sp-status');
  var narrow = window.matchMedia('(max-width: 720px)');

  function persist() {
    if (!S.save(localStorage, doc)) say('could not save (storage full or blocked)');
  }
  function say(msg) { status.textContent = msg; }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function btn(label, cls, aria, onClick) {
    var b = el('button', cls, label);
    b.type = 'button';
    if (aria) b.setAttribute('aria-label', aria);
    b.addEventListener('click', onClick);
    return b;
  }
  function isGithub(url) {
    try { return /^(www\.)?github\.com$/.test(new URL(url).hostname); } catch (e) { return false; }
  }
  function mark() {
    var s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('class', 'gh-mark');
    s.setAttribute('data-icon', 'github');
    s.setAttribute('width', '16');
    s.setAttribute('height', '16');
    s.setAttribute('viewBox', '0 0 16 16');
    s.setAttribute('fill', 'currentColor');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    var p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', GH_PATH);
    s.appendChild(p);
    return s;
  }

  // ---- tree ----
  function field(name, label, value) {
    var i = el('input');
    i.type = 'text';
    i.name = name;
    i.value = value || '';
    i.setAttribute('aria-label', label);
    i.placeholder = label;
    i.autocomplete = 'off';
    i.spellcheck = false;
    return i;
  }

  function linkForm(g, l) {
    var f = el('form', 'sp-form');
    var n = field('name', 'name', l ? l.name : '');
    var u = field('url', 'url', l ? l.url : '');
    f.appendChild(n);
    f.appendChild(u);
    var ok = el('button', 'sp-b', 'save');
    ok.type = 'submit';
    f.appendChild(ok);
    f.appendChild(btn('cancel', 'sp-b', 'Cancel', function () { form = null; render(); }));
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var done = l ? S.ops.updateLink(doc, g.id, l.id, n.value, u.value) : S.ops.addLink(doc, g.id, n.value, u.value);
      if (!done) { say('that url is not a valid web or mail link'); u.focus(); return; }
      form = null;
      say('');
      changed();
    });
    return f;
  }

  function groupForm(g) {
    var f = el('form', 'sp-form');
    var n = field('name', 'group name', g ? g.name : '');
    f.appendChild(n);
    var ok = el('button', 'sp-b', 'save');
    ok.type = 'submit';
    f.appendChild(ok);
    f.appendChild(btn('cancel', 'sp-b', 'Cancel', function () { form = null; render(); }));
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (g) S.ops.renameGroup(doc, g.id, n.value);
      else S.ops.addGroup(doc, n.value);
      form = null;
      changed();
    });
    return f;
  }

  function linkItem(g, l) {
    var li = el('li', 'sp-link');
    if (form && form.type === 'link' && form.lid === l.id) {
      li.appendChild(linkForm(g, l));
      return li;
    }
    var a = el('a');
    a.href = l.url;
    if (isGithub(l.url)) {
      a.className = 'gh-link';
      a.setAttribute('aria-label', l.name);
      a.appendChild(mark());
      a.appendChild(document.createTextNode(l.name));
    } else {
      a.textContent = l.name;
    }
    li.appendChild(a);
    if (editing) {
      var c = el('span', 'sp-ctl');
      c.appendChild(btn('↑', 'sp-b sp-up', 'Move ' + l.name + ' up', function () { S.ops.moveLink(doc, g.id, l.id, -1); changed(); }));
      c.appendChild(btn('↓', 'sp-b sp-down', 'Move ' + l.name + ' down', function () { S.ops.moveLink(doc, g.id, l.id, 1); changed(); }));
      c.appendChild(btn('edit', 'sp-b sp-edit-link', 'Edit ' + l.name, function () { form = { type: 'link', gid: g.id, lid: l.id }; render(); focusForm(); }));
      c.appendChild(btn('×', 'sp-b sp-del-link', 'Delete ' + l.name, function () { S.ops.deleteLink(doc, g.id, l.id); changed(); }));
      li.appendChild(c);
    }
    return li;
  }

  function groupItem(g) {
    var li = el('li', 'sp-group');
    li.dataset.group = g.id;
    if (form && form.type === 'group' && form.gid === g.id) {
      li.appendChild(groupForm(g));
    } else {
      li.appendChild(el('h1', null, g.name));
      if (editing) {
        var c = el('span', 'sp-ctl');
        c.appendChild(btn('↑', 'sp-b sp-up', 'Move group ' + g.name + ' up', function () { S.ops.moveGroup(doc, g.id, -1); changed(); }));
        c.appendChild(btn('↓', 'sp-b sp-down', 'Move group ' + g.name + ' down', function () { S.ops.moveGroup(doc, g.id, 1); changed(); }));
        c.appendChild(btn('rename', 'sp-b sp-rename', 'Rename group ' + g.name, function () { form = { type: 'group', gid: g.id }; render(); focusForm(); }));
        c.appendChild(btn('×', 'sp-b sp-del-group', 'Delete group ' + g.name, function () { S.ops.deleteGroup(doc, g.id); changed(); }));
        li.appendChild(c);
      }
    }
    var ul = el('ul');
    g.links.forEach(function (l) { ul.appendChild(linkItem(g, l)); });
    if (editing) {
      var add = el('li', 'sp-add');
      if (form && form.type === 'newlink' && form.gid === g.id) add.appendChild(linkForm(g, null));
      else add.appendChild(btn('+ link', 'sp-b sp-add-link', 'Add a link to ' + g.name, function () { form = { type: 'newlink', gid: g.id }; render(); focusForm(); }));
      ul.appendChild(add);
    }
    li.appendChild(ul);
    return li;
  }

  function render() {
    tree.textContent = '';
    tree.appendChild(el('h1', null, '.'));
    var ul = el('ul');
    doc.groups.forEach(function (g) { ul.appendChild(groupItem(g)); });
    if (editing) {
      var add = el('li', 'sp-add');
      if (form && form.type === 'newgroup') add.appendChild(groupForm(null));
      else add.appendChild(btn('+ group', 'sp-b sp-add-group', 'Add a group', function () { form = { type: 'newgroup' }; render(); focusForm(); }));
      ul.appendChild(add);
    }
    tree.appendChild(ul);
  }

  function focusForm() {
    var i = tree.querySelector('.sp-form input');
    if (i) i.focus();
  }
  function changed() { persist(); render(); }

  // ---- window position ----
  function clampWin(x, y) {
    var maxX = Math.max(0, window.innerWidth - 120);
    var maxY = Math.max(0, window.innerHeight - 30);
    return { x: Math.min(maxX, Math.max(0, x)), y: Math.min(maxY, Math.max(0, y)) };
  }
  function placeWin() {
    if (narrow.matches) {
      win.style.left = '';
      win.style.top = '';
      win.style.maxHeight = '';
      return;
    }
    var p = clampWin(doc.window ? doc.window.x : 24, doc.window ? doc.window.y : 24);
    win.style.left = p.x + 'px';
    win.style.top = p.y + 'px';
    win.style.maxHeight = Math.max(160, window.innerHeight - p.y - 12) + 'px';
  }

  function drag(handle, target, onMove, onEnd, ignore) {
    var d = null;
    handle.addEventListener('pointerdown', function (e) {
      if (narrow.matches || e.button > 0 || (ignore && e.target.closest(ignore))) return;
      var r = target.getBoundingClientRect();
      d = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      handle.setPointerCapture(e.pointerId);
      target.classList.add('dragging');
    });
    handle.addEventListener('pointermove', function (e) {
      if (d) onMove(e.clientX - d.dx, e.clientY - d.dy);
    });
    function end() {
      if (!d) return;
      d = null;
      target.classList.remove('dragging');
      onEnd();
    }
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  drag(bar, win, function (x, y) {
    var p = clampWin(x, y);
    S.ops.setWindow(doc, p.x, p.y);
    placeWin();
  }, persist, 'button');

  // ---- notes ----
  function noteEl(t) {
    var n = el('div', 'sp-note sp-note-' + t.colour);
    n.dataset.note = t.id;
    n.setAttribute('role', 'group');
    n.setAttribute('aria-label', 'note');
    n.style.left = t.x + 'px';
    n.style.top = t.y + 'px';
    var hd = el('div', 'sp-note-bar');
    var cs = el('span', 'sp-colours');
    S.NOTE_COLOURS.forEach(function (c) {
      var b = btn('', 'sp-colour sp-colour-' + c, 'Colour ' + c, function () {
        S.ops.updateNote(doc, t.id, { colour: c });
        persist();
        renderNotes();
      });
      b.dataset.colour = c;
      if (c === t.colour) b.setAttribute('aria-pressed', 'true');
      cs.appendChild(b);
    });
    hd.appendChild(cs);
    hd.appendChild(btn('×', 'sp-b sp-note-del', 'Delete note', function () {
      S.ops.deleteNote(doc, t.id);
      persist();
      renderNotes();
    }));
    var ta = el('textarea', 'sp-note-text');
    ta.value = t.text;
    ta.setAttribute('aria-label', 'Note text');
    ta.rows = 4;
    ta.addEventListener('input', function () { S.ops.updateNote(doc, t.id, { text: ta.value }); persist(); });
    n.appendChild(hd);
    n.appendChild(ta);
    drag(hd, n, function (x, y) {
      var p = clampWin(x, y);
      S.ops.updateNote(doc, t.id, { x: p.x, y: p.y });
      n.style.left = p.x + 'px';
      n.style.top = p.y + 'px';
    }, persist, 'button');
    return n;
  }
  function renderNotes() {
    notesEl.textContent = '';
    doc.notes.forEach(function (t) { notesEl.appendChild(noteEl(t)); });
  }

  // ---- toolbar ----
  $('sp-edit').addEventListener('click', function () {
    editing = !editing;
    form = null;
    $('sp-edit').setAttribute('aria-pressed', String(editing));
    $('sp-edit').textContent = editing ? '[done]' : '[edit]';
    render();
  });
  $('sp-add-note').addEventListener('click', function () {
    var r = win.getBoundingClientRect();
    var k = doc.notes.length % 6;
    var t = narrow.matches
      ? S.ops.addNote(doc, 0, 0)
      : S.ops.addNote(doc, Math.max(0, Math.min(window.innerWidth - 220, r.right + 24 + k * 16)), r.top + 8 + k * 24);
    if (!t) { say('note limit reached'); return; }
    persist();
    renderNotes();
    var ta = notesEl.querySelector('[data-note="' + t.id + '"] textarea');
    if (ta) ta.focus();
  });
  $('sp-export').addEventListener('click', function () {
    var blob = new Blob([S.exportJSON(doc)], { type: 'application/json' });
    var a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'startpage.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    say('exported startpage.json');
  });
  var file = $('sp-import');
  $('sp-import-btn').addEventListener('click', function () { file.click(); });
  file.addEventListener('change', function () {
    var f = file.files && file.files[0];
    if (!f) return;
    f.text().then(function (text) {
      var r = S.importJSON(text);
      if (!r.ok) { say('import failed: ' + r.error + ' (nothing changed)'); return; }
      doc = r.doc;
      form = null;
      persist();
      render();
      renderNotes();
      placeWin();
      say('imported ' + doc.groups.length + ' groups, ' + doc.notes.length + ' notes');
    });
    file.value = '';
  });

  narrow.addEventListener('change', placeWin);
  window.addEventListener('resize', placeWin);
  render();
  renderNotes();
  placeWin();
  document.documentElement.classList.add('sp-ready');
})();
