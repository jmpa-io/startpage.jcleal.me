// The start page's data: one versioned JSON document in localStorage ("startpage.v1"). No backend, no sync.
// Pure functions only (no DOM) so they are unit tested; js/app.js renders and wires the UI.
(function (root) {
  var KEY = 'startpage.v1';
  var VERSION = 1;
  var NOTE_COLOURS = ['yellow', 'pink', 'green', 'blue'];
  var MAX = { groups: 50, links: 200, notes: 100, text: 2000, name: 80 };

  var n = 0;
  function uid(prefix) {
    n += 1;
    return prefix + Date.now().toString(36) + n.toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function defaultDoc() {
    function l(name, url) { return { id: uid('l'), name: name, url: url }; }
    return {
      version: VERSION,
      window: null,
      groups: [
        {
          id: uid('g'),
          name: 'work',
          links: [
            l('mail', 'https://outlook.office.com'),
            l('jira board', 'https://arlive.atlassian.net/secure/RapidBoard.jspa?projectKey=OBS&rapidView=1612'),
            l('confluence', 'https://myobconfluence.atlassian.net/wiki/spaces/AL/pages/935789405/I+am+new+to+Kepler'),
            l('github', 'https://github.com/myob-ops'),
            l('buildkite', 'https://buildkite.com/myob'),
            l('slack', 'https://myob.slack.com'),
            l('adfs', 'https://myob.com/adfs'),
            l('aws', 'https://myob.com/aws'),
            l('1password', 'https://my.1password.com/signin?l=en'),
            l('citrix', 'https://myobportal.cloud.com'),
            l('bridge', 'https://myob.bridgeapp.com'),
            l('concur', 'https://www.concursolutions.com/UI/SSO/p0001504zvoa'),
            l('orbit world travel', 'https://myob.orbitworldtravel.com/')
          ]
        },
        {
          id: uid('g'),
          name: 'personal',
          links: [
            l('github (jmpa)', 'https://github.com/jmpa-oss'),
            l('github', 'https://github.com/jcleal'),
            l('gitlab', 'https://gitlab.com/'),
            l('slack (jmpa)', 'https://jmpa-oss.slack.com'),
            l('messenger', 'https://messenger.com'),
            l('spotify', 'https://open.spotify.com'),
            l('google drive', 'https://drive.google.com/drive/my-drive'),
            l('pocketsmith', 'https://my.pocketsmith.com/dashboard')
          ]
        }
      ],
      notes: []
    };
  }

  function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
  function num(v) { return typeof v === 'number' && isFinite(v) ? Math.round(v) : 0; }

  // Only web links and mail: javascript:/data: URLs from an imported file must never become an href.
  function safeUrl(u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
    try {
      var p = new URL(u);
      return /^(https?:|mailto:)$/.test(p.protocol) ? u : '';
    } catch (e) {
      return '';
    }
  }

  // Returns a clean doc from untrusted input, or null when it is not a start page document.
  function sanitize(raw) {
    if (!raw || typeof raw !== 'object' || raw.version !== VERSION || !Array.isArray(raw.groups)) return null;
    var seen = {};
    function id(v, p) {
      v = typeof v === 'string' && /^[\w-]{1,40}$/.test(v) && !seen[v] ? v : uid(p);
      seen[v] = true;
      return v;
    }
    var doc = { version: VERSION, window: null, groups: [], notes: [] };
    if (raw.window && typeof raw.window === 'object') doc.window = { x: num(raw.window.x), y: num(raw.window.y) };
    raw.groups.slice(0, MAX.groups).forEach(function (g) {
      if (!g || typeof g !== 'object') return;
      var out = { id: id(g.id, 'g'), name: str(g.name, MAX.name) || 'group', links: [] };
      (Array.isArray(g.links) ? g.links : []).slice(0, MAX.links).forEach(function (l) {
        if (!l || typeof l !== 'object') return;
        var url = safeUrl(l.url);
        if (url) out.links.push({ id: id(l.id, 'l'), name: str(l.name, MAX.name) || url, url: url });
      });
      doc.groups.push(out);
    });
    (Array.isArray(raw.notes) ? raw.notes : []).slice(0, MAX.notes).forEach(function (t) {
      if (!t || typeof t !== 'object') return;
      doc.notes.push({
        id: id(t.id, 'n'),
        x: Math.max(0, num(t.x)),
        y: Math.max(0, num(t.y)),
        text: str(t.text, MAX.text),
        colour: NOTE_COLOURS.indexOf(t.colour) >= 0 ? t.colour : NOTE_COLOURS[0]
      });
    });
    return doc;
  }

  function load(storage) {
    try {
      var raw = storage.getItem(KEY);
      if (raw) {
        var doc = sanitize(JSON.parse(raw));
        if (doc) return doc;
      }
    } catch (e) { /* fall through to the defaults */ }
    return defaultDoc();
  }

  function save(storage, doc) {
    try {
      storage.setItem(KEY, JSON.stringify(doc));
      return true;
    } catch (e) {
      return false;
    }
  }

  function exportJSON(doc) { return JSON.stringify(doc, null, 2) + '\n'; }

  function importJSON(text) {
    var raw;
    try { raw = JSON.parse(text); } catch (e) { return { ok: false, error: 'not valid JSON' }; }
    var doc = sanitize(raw);
    if (!doc) return { ok: false, error: 'not a start page file (expected version ' + VERSION + ')' };
    return { ok: true, doc: doc };
  }

  function find(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return -1;
  }
  function move(list, id, dir) {
    var i = find(list, id);
    var j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return false;
    var t = list[i]; list[i] = list[j]; list[j] = t;
    return true;
  }
  function group(doc, gid) { var i = find(doc.groups, gid); return i < 0 ? null : doc.groups[i]; }

  var ops = {
    addGroup: function (doc, name) {
      if (doc.groups.length >= MAX.groups) return null;
      var g = { id: uid('g'), name: str(name, MAX.name).trim() || 'group', links: [] };
      doc.groups.push(g);
      return g;
    },
    renameGroup: function (doc, gid, name) {
      var g = group(doc, gid);
      name = str(name, MAX.name).trim();
      if (!g || !name) return false;
      g.name = name;
      return true;
    },
    deleteGroup: function (doc, gid) {
      var i = find(doc.groups, gid);
      if (i < 0) return false;
      doc.groups.splice(i, 1);
      return true;
    },
    moveGroup: function (doc, gid, dir) { return move(doc.groups, gid, dir); },
    addLink: function (doc, gid, name, url) {
      var g = group(doc, gid);
      var u = safeUrl(url);
      if (!g || !u || g.links.length >= MAX.links) return null;
      var l = { id: uid('l'), name: str(name, MAX.name).trim() || u, url: u };
      g.links.push(l);
      return l;
    },
    updateLink: function (doc, gid, lid, name, url) {
      var g = group(doc, gid);
      var u = safeUrl(url);
      var i = g ? find(g.links, lid) : -1;
      if (i < 0 || !u) return false;
      g.links[i].name = str(name, MAX.name).trim() || u;
      g.links[i].url = u;
      return true;
    },
    deleteLink: function (doc, gid, lid) {
      var g = group(doc, gid);
      var i = g ? find(g.links, lid) : -1;
      if (i < 0) return false;
      g.links.splice(i, 1);
      return true;
    },
    moveLink: function (doc, gid, lid, dir) {
      var g = group(doc, gid);
      return g ? move(g.links, lid, dir) : false;
    },
    addNote: function (doc, x, y) {
      if (doc.notes.length >= MAX.notes) return null;
      var t = { id: uid('n'), x: Math.max(0, num(x)), y: Math.max(0, num(y)), text: '', colour: NOTE_COLOURS[doc.notes.length % NOTE_COLOURS.length] };
      doc.notes.push(t);
      return t;
    },
    updateNote: function (doc, nid, patch) {
      var i = find(doc.notes, nid);
      if (i < 0) return false;
      var t = doc.notes[i];
      if ('text' in patch) t.text = str(patch.text, MAX.text);
      if ('x' in patch) t.x = Math.max(0, num(patch.x));
      if ('y' in patch) t.y = Math.max(0, num(patch.y));
      if (patch.colour && NOTE_COLOURS.indexOf(patch.colour) >= 0) t.colour = patch.colour;
      return true;
    },
    deleteNote: function (doc, nid) {
      var i = find(doc.notes, nid);
      if (i < 0) return false;
      doc.notes.splice(i, 1);
      return true;
    },
    setWindow: function (doc, x, y) { doc.window = { x: num(x), y: num(y) }; }
  };

  var api = {
    KEY: KEY, VERSION: VERSION, NOTE_COLOURS: NOTE_COLOURS,
    defaultDoc: defaultDoc, sanitize: sanitize, safeUrl: safeUrl, load: load, save: save,
    exportJSON: exportJSON, importJSON: importJSON, ops: ops
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StartStore = api;
})(typeof window !== 'undefined' ? window : this);
