// Start page UI: renders the StartStore document as a movable terminal window plus post-it notes.
// Everything is built with createElement/textContent: stored text is never parsed as HTML.
(function () {
  var S = window.StartStore;
  var doc = S.load(localStorage);
  var editing = false; // edit mode shows the per-item icon buttons
  var form = null; // the one open form: {type: link|group|newlink|newgroup, gid, lid}
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var GH_PATH = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z';
  var MIN_W = 320, MIN_H = 200, DEF_W = 880, DEF_H = 600, NOTE_DEF = { w: 210, h: 170 };

  var $ = function (id) { return document.getElementById(id); };
  var win = $('sp-window');
  var bar = $('sp-bar');
  var tree = $('sp-tree');
  var panel = $('sp-panel');
  var notesEl = $('sp-notes');
  var status = $('sp-status');
  var chip = $('sp-chip');
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
  // A real button: text label, optional icon, optional accessible name/tooltip.
  function btn(label, cls, aria, onClick, icon) {
    var b = el('button', cls);
    b.type = 'button';
    if (icon) b.appendChild(window.SPIcon(icon));
    if (label) b.appendChild(el('span', null, label));
    if (aria) { b.setAttribute('aria-label', aria); b.title = aria; }
    b.addEventListener('click', onClick);
    return b;
  }
  function iconBtn(icon, cls, aria, onClick) { return btn('', 'sp-ib ' + cls, aria, onClick, icon); }

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

  // static buttons carry data-ico; the icon goes before their label
  function hydrate() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-ico]'), function (b) {
      b.insertBefore(window.SPIcon(b.dataset.ico, b.classList.contains('sp-wbtn') ? 14 : 16), b.firstChild);
    });
  }

  // ---- forms ----
  function field(name, label, value) {
    var l = el('label', 'sp-field');
    l.appendChild(el('span', null, label));
    var i = el('input');
    i.type = 'text';
    i.name = name;
    i.value = value || '';
    i.autocomplete = 'off';
    i.spellcheck = false;
    l.appendChild(i);
    return l;
  }
  function formEnd(f, submitLabel) {
    var row = el('span', 'sp-form-btns');
    var ok = el('button', 'sp-btn sp-primary');
    ok.type = 'submit';
    ok.appendChild(window.SPIcon('check'));
    ok.appendChild(el('span', null, submitLabel));
    row.appendChild(ok);
    row.appendChild(btn('Cancel', 'sp-btn', 'Cancel', function () { form = null; render(); }, 'close'));
    f.appendChild(row);
  }
  function val(f, name) { return f.querySelector('[name=' + name + ']').value; }

  function linkForm(g, l) {
    var f = el('form', 'sp-form');
    f.appendChild(field('name', 'Name', l ? l.name : ''));
    f.appendChild(field('url', 'URL', l ? l.url : ''));
    formEnd(f, 'Save');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var done = S.ops.updateLink(doc, g.id, l.id, val(f, 'name'), val(f, 'url'));
      if (!done) { say('that url is not a valid web or mail link'); f.querySelector('[name=url]').focus(); return; }
      form = null;
      say('');
      changed();
    });
    return f;
  }

  function newLinkForm() {
    var f = el('form', 'sp-form');
    var gl = el('label', 'sp-field');
    gl.appendChild(el('span', null, 'Group'));
    var sel = el('select');
    sel.name = 'group';
    doc.groups.forEach(function (g) {
      var o = el('option', null, g.name);
      o.value = g.id;
      sel.appendChild(o);
    });
    if (form.gid) sel.value = form.gid;
    gl.appendChild(sel);
    f.appendChild(gl);
    f.appendChild(field('name', 'Name', ''));
    f.appendChild(field('url', 'URL', 'https://'));
    formEnd(f, 'Add link');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!S.ops.addLink(doc, sel.value, val(f, 'name'), val(f, 'url'))) {
        say('that url is not a valid web or mail link');
        f.querySelector('[name=url]').focus();
        return;
      }
      form = null;
      say('');
      changed();
    });
    return f;
  }

  function groupForm(g) {
    var f = el('form', 'sp-form');
    f.appendChild(field('name', g ? 'Group name' : 'New group name', g ? g.name : ''));
    formEnd(f, g ? 'Save' : 'Add group');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (g) S.ops.renameGroup(doc, g.id, val(f, 'name'));
      else S.ops.addGroup(doc, val(f, 'name'));
      form = null;
      changed();
    });
    return f;
  }

  // ---- tree ----
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
      c.appendChild(iconBtn('up', 'sp-up', 'Move ' + l.name + ' up', function () { S.ops.moveLink(doc, g.id, l.id, -1); changed(); }));
      c.appendChild(iconBtn('down', 'sp-down', 'Move ' + l.name + ' down', function () { S.ops.moveLink(doc, g.id, l.id, 1); changed(); }));
      c.appendChild(iconBtn('pencil', 'sp-edit-link', 'Edit ' + l.name, function () { form = { type: 'link', gid: g.id, lid: l.id }; render(); focusForm(); }));
      c.appendChild(iconBtn('trash', 'sp-del-link', 'Delete ' + l.name, function () { S.ops.deleteLink(doc, g.id, l.id); changed(); }));
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
      var head = el('div', 'sp-ghead');
      head.appendChild(el('h1', null, g.name));
      if (editing) {
        var c = el('span', 'sp-ctl');
        c.appendChild(iconBtn('plus', 'sp-group-add', 'Add a link to ' + g.name, function () { form = { type: 'newlink', gid: g.id }; render(); focusForm(); }));
        c.appendChild(iconBtn('up', 'sp-up', 'Move group ' + g.name + ' up', function () { S.ops.moveGroup(doc, g.id, -1); changed(); }));
        c.appendChild(iconBtn('down', 'sp-down', 'Move group ' + g.name + ' down', function () { S.ops.moveGroup(doc, g.id, 1); changed(); }));
        c.appendChild(iconBtn('pencil', 'sp-rename', 'Rename group ' + g.name, function () { form = { type: 'group', gid: g.id }; render(); focusForm(); }));
        c.appendChild(iconBtn('trash', 'sp-del-group', 'Delete group ' + g.name, function () { S.ops.deleteGroup(doc, g.id); changed(); }));
        head.appendChild(c);
      }
      li.appendChild(head);
    }
    var ul = el('ul');
    g.links.forEach(function (l) { ul.appendChild(linkItem(g, l)); });
    li.appendChild(ul);
    return li;
  }

  function render() {
    tree.textContent = '';
    tree.appendChild(el('h1', null, '.'));
    var ul = el('ul');
    doc.groups.forEach(function (g) { ul.appendChild(groupItem(g)); });
    tree.appendChild(ul);
    panel.textContent = '';
    if (form && form.type === 'newlink') panel.appendChild(newLinkForm());
    if (form && form.type === 'newgroup') panel.appendChild(groupForm(null));
    refreshFacts();
  }

  // neofetch-style summary next to the logo; rebuilt whenever links, notes, colours or day/night change
  var since = Date.now();
  function uptime() {
    var m = Math.floor((Date.now() - since) / 60000);
    return m >= 1440 ? Math.floor(m / 1440) + ' days' : m >= 60 ? Math.floor(m / 60) + ' hours, ' + (m % 60) + ' mins' : m + ' mins';
  }
  function fact(k, v, swatches) {
    var dt = el('dt', null, k);
    var dd = el('dd');
    (swatches || []).forEach(function (c) {
      var s = el('i', 'sw');
      s.style.background = c;
      dd.appendChild(s);
    });
    dd.appendChild(document.createTextNode(v));
    return [dt, dd];
  }
  function refreshFacts() {
    var facts = $('sp-facts');
    if (!facts) return;
    var p = window.Palette.get();
    var links = doc.groups.reduce(function (n, g) { return n + g.links.length; }, 0);
    var title = el('div', 'fact-title');
    title.appendChild(el('span', 'user', 'jcleal'));
    title.appendChild(document.createTextNode('@'));
    title.appendChild(el('span', 'host', 'archlinux'));
    facts.textContent = '';
    facts.appendChild(title);
    facts.appendChild(el('div', 'fact-rule', '-----------------'));
    var dl = el('dl');
    [
      fact('OS', 'Arch Linux x86_64'),
      fact('Uptime', uptime()),
      fact('Links', String(links)),
      fact('Groups', String(doc.groups.length)),
      fact('Notes', String(doc.notes.length)),
      fact('Palette', p.primary + ' ' + p.secondary, [p.primary, p.secondary]),
      fact('Scheme', document.documentElement.classList.contains('dark') ? 'night' : 'day')
    ].forEach(function (r) { r.forEach(function (n) { dl.appendChild(n); }); });
    facts.appendChild(dl);
    var blocks = el('div', 'fact-blocks');
    blocks.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 8; i++) blocks.appendChild(el('i', 'blk blk' + i));
    facts.appendChild(blocks);
  }

  var clock = $('sp-clock');
  function tick() {
    var d = new Date();
    clock.textContent = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' +
      d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  tick();
  setInterval(tick, 15000);

  function focusForm() {
    var i = win.querySelector('.sp-form input');
    if (i) i.focus();
  }
  function changed() { persist(); render(); }

  function setEditing(on) {
    editing = on;
    $('sp-edit').setAttribute('aria-pressed', String(on));
    $('sp-edit').classList.toggle('on', on);
  }

  // ---- window frame ----
  function frame() { return doc.window || {}; }
  // Where the window sits: the stored frame, or the default, always fully inside the viewport.
  function geometry() {
    var f = frame();
    var vw = window.innerWidth, vh = window.innerHeight;
    var w = Math.min(Math.max(f.w || Math.min(DEF_W, vw - 48), MIN_W), vw);
    var h = Math.min(Math.max(f.h || Math.min(DEF_H, vh - 48), MIN_H), vh);
    return {
      w: w,
      h: h,
      x: Math.min(Math.max(0, f.x != null ? f.x : 24), Math.max(0, vw - w)),
      y: Math.min(Math.max(0, f.y != null ? f.y : 24), Math.max(0, vh - h))
    };
  }
  function clampWin(x, y) {
    var maxX = Math.max(0, window.innerWidth - 120);
    var maxY = Math.max(0, window.innerHeight - 40);
    return { x: Math.min(maxX, Math.max(0, x)), y: Math.min(maxY, Math.max(0, y)) };
  }
  function setIcon(b, name) {
    var old = b.querySelector('svg');
    if (old) old.remove();
    b.insertBefore(window.SPIcon(name, 14), b.firstChild);
  }
  function placeWin() {
    var f = frame();
    var isMax = !!f.max && !narrow.matches;
    win.classList.toggle('sp-max', isMax);
    win.classList.toggle('sp-shade', !!f.min && !narrow.matches);
    $('sp-max').setAttribute('aria-label', isMax ? 'Restore window size' : 'Maximise window');
    $('sp-max').title = isMax ? 'Restore' : 'Maximise';
    setIcon($('sp-max'), isMax ? 'restore' : 'max');
    $('sp-min').setAttribute('aria-label', f.min ? 'Expand window' : 'Collapse window to its title bar');
    $('sp-min').setAttribute('aria-pressed', String(!!f.min));
    ['left', 'top', 'width', 'height'].forEach(function (k) { win.style[k] = ''; });
    if (narrow.matches || isMax) return;
    var g = geometry();
    win.style.left = g.x + 'px';
    win.style.top = g.y + 'px';
    win.style.width = g.w + 'px';
    if (!f.min) win.style.height = g.h + 'px';
  }
  function patchWin(p) { S.ops.setWindow(doc, p); persist(); placeWin(); }
  function setFrame(r) { S.ops.setWindow(doc, { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) }); placeWin(); }

  function drag(handle, target, onMove, onEnd, ignore, enabled) {
    var d = null;
    handle.addEventListener('pointerdown', function (e) {
      if (narrow.matches || e.button > 0 || (enabled && !enabled()) || (ignore && e.target.closest(ignore))) return;
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
    var g = geometry();
    setFrame({ x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - g.w)), y: Math.min(Math.max(0, y), Math.max(0, window.innerHeight - g.h)), w: g.w, h: g.h });
  }, persist, 'button', function () { return !frame().max; });

  // New frame when the `dir` edge(s) of the box `s` move by (dx, dy); stays within the viewport and above the minimum size.
  function resized(s, dir, dx, dy) {
    var r = s.l + s.w, b = s.t + s.h, l = s.l, t = s.t, w = s.w, h = s.h;
    if (dir.indexOf('e') >= 0) w = Math.max(MIN_W, Math.min(s.w + dx, window.innerWidth - s.l));
    if (dir.indexOf('w') >= 0) { l = Math.min(Math.max(0, s.l + dx), r - MIN_W); w = r - l; }
    if (dir.indexOf('s') >= 0) h = Math.max(MIN_H, Math.min(s.h + dy, window.innerHeight - s.t));
    if (dir.indexOf('n') >= 0) { t = Math.min(Math.max(0, s.t + dy), b - MIN_H); h = b - t; }
    return { x: l, y: t, w: w, h: h };
  }
  function startBox() {
    var r = win.getBoundingClientRect();
    return { l: r.left, t: r.top, w: r.width, h: r.height };
  }

  Array.prototype.forEach.call(win.querySelectorAll('[data-grip]'), function (g) {
    var s = null;
    var dir = g.dataset.grip;
    g.addEventListener('pointerdown', function (e) {
      if (narrow.matches || e.button > 0 || frame().max || frame().min) return;
      s = { x: e.clientX, y: e.clientY, box: startBox() };
      g.setPointerCapture(e.pointerId);
      win.classList.add('dragging');
      e.preventDefault();
    });
    g.addEventListener('pointermove', function (e) {
      if (s) setFrame(resized(s.box, dir, e.clientX - s.x, e.clientY - s.y));
    });
    function end() {
      if (!s) return;
      s = null;
      win.classList.remove('dragging');
      persist();
    }
    g.addEventListener('pointerup', end);
    g.addEventListener('pointercancel', end);
    // keyboard: arrow keys move the focused edge/corner (Shift = bigger steps)
    g.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 64 : 16;
      var d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!d || narrow.matches || frame().max || frame().min) return;
      e.preventDefault();
      setFrame(resized(startBox(), dir, d[0], d[1]));
      persist();
    });
  });

  $('sp-max').addEventListener('click', function () {
    var g = geometry();
    patchWin({ max: !frame().max, min: false, x: g.x, y: g.y, w: g.w, h: g.h });
  });
  $('sp-min').addEventListener('click', function () {
    var g = geometry();
    patchWin({ min: !frame().min, x: g.x, y: g.y, w: g.w, h: g.h });
  });
  bar.addEventListener('dblclick', function (e) {
    if (!e.target.closest('button') && !narrow.matches) $('sp-max').click();
  });
  $('sp-close').addEventListener('click', function () {
    win.hidden = true;
    chip.hidden = false;
    chip.focus();
  });
  chip.addEventListener('click', function () {
    win.hidden = false;
    chip.hidden = true;
    placeWin();
    $('sp-edit').focus();
  });
  $('sp-reset-layout').addEventListener('click', function () {
    S.ops.resetWindow(doc);
    win.hidden = false;
    chip.hidden = true;
    persist();
    placeWin();
    say('window layout reset');
  });

  // ---- notes ----
  var SLOT_NAMES = ['Primary', 'Secondary', 'Yellow', 'Green', 'Pink', 'Blend'];
  var topZ = 10;

  // Tints come from the picker (see note-colours.js) and are recomputed whenever the colours or day/night change.
  function applyNoteColours() {
    var p = window.Palette.get();
    var tints = window.NoteColours.tints(p.primary, p.secondary, document.documentElement.classList.contains('dark'));
    var st = document.documentElement.style;
    tints.forEach(function (t, i) {
      st.setProperty('--note-' + i + '-bg', t.bg);
      st.setProperty('--note-' + i + '-bar', t.bar);
      st.setProperty('--note-' + i + '-ink', t.ink);
    });
  }

  function tilt(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
    return (((h % 41) - 20) / 10).toFixed(1) + 'deg'; // -2.0deg .. 2.0deg
  }

  function noteEl(t, index) {
    var n = el('div', 'sp-note sp-slot-' + t.slot);
    n.dataset.note = t.id;
    n.dataset.slot = String(t.slot);
    n.setAttribute('role', 'group');
    n.setAttribute('aria-label', 'note');
    n.style.left = t.x + 'px';
    n.style.top = t.y + 'px';
    n.style.width = (t.w || NOTE_DEF.w) + 'px';
    n.style.height = (t.h || NOTE_DEF.h) + 'px';
    n.style.zIndex = String(10 + index);
    n.style.setProperty('--tilt', tilt(t.id));
    var hd = el('div', 'sp-note-bar');
    var cs = el('span', 'sp-colours');
    SLOT_NAMES.forEach(function (name, i) {
      var b = btn('', 'sp-colour sp-colour-' + i, 'Note colour: ' + name, function () {
        S.ops.updateNote(doc, t.id, { slot: i });
        persist();
        n.className = 'sp-note sp-slot-' + i + (n.classList.contains('dragging') ? ' dragging' : '');
        n.dataset.slot = String(i);
        Array.prototype.forEach.call(cs.children, function (c, j) { c.setAttribute('aria-pressed', String(j === i)); });
      });
      b.dataset.slot = String(i);
      b.setAttribute('aria-pressed', String(i === t.slot));
      cs.appendChild(b);
    });
    hd.appendChild(cs);
    hd.appendChild(iconBtn('trash', 'sp-note-del', 'Delete note', function () {
      S.ops.deleteNote(doc, t.id);
      persist();
      renderNotes();
    }));
    var ta = el('textarea', 'sp-note-text');
    ta.value = t.text;
    ta.setAttribute('aria-label', 'Note text');
    ta.addEventListener('input', function () { S.ops.updateNote(doc, t.id, { text: ta.value }); persist(); });
    var grip = el('div', 'sp-note-grip');
    grip.tabIndex = 0;
    grip.setAttribute('role', 'separator');
    grip.setAttribute('aria-label', 'Resize note (arrow keys)');
    n.appendChild(hd);
    n.appendChild(ta);
    n.appendChild(grip);

    function raise() {
      if (S.ops.raiseNote(doc, t.id)) persist();
      topZ += 1;
      n.style.zIndex = String(topZ);
    }
    n.addEventListener('pointerdown', raise);
    n.addEventListener('focusin', function () { if (n.style.zIndex !== String(topZ)) raise(); });
    drag(hd, n, function (x, y) {
      var p = clampWin(x, y);
      S.ops.updateNote(doc, t.id, { x: p.x, y: p.y });
      n.style.left = p.x + 'px';
      n.style.top = p.y + 'px';
    }, persist, 'button');

    function size(w, h) {
      w = Math.max(S.NOTE_MIN.w, Math.min(800, Math.round(w)));
      h = Math.max(S.NOTE_MIN.h, Math.min(800, Math.round(h)));
      S.ops.updateNote(doc, t.id, { w: w, h: h });
      n.style.width = w + 'px';
      n.style.height = h + 'px';
    }
    var s = null;
    grip.addEventListener('pointerdown', function (e) {
      if (narrow.matches || e.button > 0) return;
      s = { x: e.clientX, y: e.clientY, w: n.offsetWidth, h: n.offsetHeight };
      grip.setPointerCapture(e.pointerId);
      n.classList.add('dragging');
      e.preventDefault();
    });
    grip.addEventListener('pointermove', function (e) { if (s) size(s.w + e.clientX - s.x, s.h + e.clientY - s.y); });
    function end() {
      if (!s) return;
      s = null;
      n.classList.remove('dragging');
      persist();
    }
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 64 : 16;
      var d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!d || narrow.matches) return;
      e.preventDefault();
      size(n.offsetWidth + d[0], n.offsetHeight + d[1]);
      persist();
    });
    return n;
  }
  function renderNotes() {
    notesEl.textContent = '';
    topZ = 10 + doc.notes.length;
    doc.notes.forEach(function (t, i) { notesEl.appendChild(noteEl(t, i)); });
    refreshFacts();
  }

  // ---- toolbar ----
  $('sp-edit').addEventListener('click', function () {
    setEditing(!editing);
    form = null;
    render();
  });
  $('sp-add-link').addEventListener('click', function () {
    if (!doc.groups.length) { say('add a group first'); return; }
    setEditing(true);
    form = { type: 'newlink', gid: doc.groups[0].id };
    render();
    focusForm();
  });
  $('sp-add-group').addEventListener('click', function () {
    setEditing(true);
    form = { type: 'newgroup' };
    render();
    focusForm();
  });
  $('sp-add-note').addEventListener('click', function () {
    var r = win.getBoundingClientRect();
    var k = doc.notes.length % 6;
    var t = narrow.matches
      ? S.ops.addNote(doc, 0, 0)
      : S.ops.addNote(doc, Math.max(0, Math.min(window.innerWidth - NOTE_DEF.w - 10, r.right + 24 + (k % 2) * 40)), Math.max(0, r.top + 24 + k * 56));
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
  hydrate();
  window.Palette.onChange(function () { applyNoteColours(); refreshFacts(); });
  applyNoteColours();
  render();
  renderNotes();
  placeWin();
  document.documentElement.classList.add('sp-ready');
})();
