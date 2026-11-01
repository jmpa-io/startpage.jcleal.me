// jmpa-io shared colour system (primary + secondary) and day/night core.
// MASTER COPY: jcleal.me/static/js/palette.js. It is mirrored byte-for-byte into
// art.jmpa.io, jmpa.io, portfolio.jcleal.me and startpage.jcleal.me. Edit here first, then re-copy.
//
// Two colours drive the whole look. From them we derive (via CSS oklch relative
// colours, set as inline custom properties on <html>) every role a site needs:
// --pal-bg/-surface/-surface-2/-border/-border-strong/-text/-muted/-heading/
// -link/-link-hover/-accent2/-btn/-btn-text/-focus/-sel-bg/-sel-text/-code-bg/
// -code-text and, for the Win98 sites, --pal-title-a/-title-b/-face/-face-hi/
// -face-shadow/-desk. Text/link/UI lightness is clamped per scheme so WCAG AA
// (4.5:1 text, 3:1 UI) holds for any pick; each site maps these to its own names.
(function () {
  var HEX = /^#[0-9a-f]{6}$/i;
  var DEFAULT = { primary: '#c04828', secondary: '#2f7fae' }; // "sunset"
  var DEFAULT_SCHEME = null; // 'dark' | 'light' pins the scheme used until the user chooses; null follows the OS.

  // Pre-picker preset names, migrated once to their primary/secondary pair.
  var LEGACY = {
    ocean:   { primary: '#007baf', secondary: '#cd4805' },
    forest:  { primary: '#007500', secondary: '#b243ba' },
    sunset:  { primary: '#c04828', secondary: '#2f7fae' },
    violet:  { primary: '#4315c9', secondary: '#9c8600' },
    yellow:  { primary: '#ad6a00', secondary: '#0559d2' },
    grey:    { primary: '#2e657e', secondary: '#976346' },
    purple:  { primary: '#aa0086', secondary: '#008c4f' },
    crimson: { primary: '#b80040', secondary: '#008a84' },
    teal:    { primary: '#007c6e', secondary: '#cf386b' }
  };

  // oklch lightness ranges that keep links/buttons readable on the derived backgrounds.
  var L_LINK = { light: [0.38, 0.49], dark: [0.72, 0.86] };
  var L_BAR = [0.28, 0.48]; // Win98 title bars: white text stays >= 4.5:1.

  function clampL(hex, r) {
    return 'oklch(from ' + hex + ' clamp(' + r[0] + ', l, ' + r[1] + ') c h)';
  }
  function tone(hex, l, maxC) {
    return 'oklch(from ' + hex + ' ' + l + ' min(c, ' + maxC + ') h)';
  }

  function buildVars(c, dark) {
    var P = c.primary, S = c.secondary, v = {};
    var link = clampL(P, dark ? L_LINK.dark : L_LINK.light);
    var bar = clampL(P, L_BAR);
    v['--pal-primary'] = P;
    v['--pal-secondary'] = S;
    v['--pal-link'] = link;
    v['--pal-link-hover'] = 'oklch(from ' + link + ' calc(l ' + (dark ? '+ 0.06' : '- 0.08') + ') c h)';
    v['--pal-accent2'] = clampL(S, dark ? L_LINK.dark : L_LINK.light);
    v['--pal-btn'] = link;
    v['--pal-btn-text'] = dark ? 'oklch(0.16 0 0)' : '#fff';
    v['--pal-focus'] = link;
    if (dark) {
      v['--pal-bg'] = tone(S, 0.16, 0.02);
      v['--pal-surface'] = tone(S, 0.2, 0.025);
      v['--pal-surface-2'] = tone(S, 0.25, 0.03);
      v['--pal-border'] = tone(S, 0.32, 0.04);
      v['--pal-border-strong'] = tone(S, 0.58, 0.08);
      v['--pal-text'] = tone(P, 0.9, 0.03);
      v['--pal-heading'] = tone(P, 0.95, 0.06);
      v['--pal-muted'] = tone(P, 0.74, 0.05);
      v['--pal-sel-bg'] = tone(P, 0.4, 0.1);
      v['--pal-sel-text'] = '#fff';
      v['--pal-code-bg'] = tone(S, 0.25, 0.03);
      v['--pal-code-text'] = tone(P, 0.84, 0.1);
    } else {
      v['--pal-bg'] = tone(S, 0.985, 0.012);
      v['--pal-surface'] = tone(S, 0.965, 0.02);
      v['--pal-surface-2'] = tone(S, 0.94, 0.03);
      v['--pal-border'] = tone(S, 0.88, 0.04);
      v['--pal-border-strong'] = tone(S, 0.58, 0.08);
      v['--pal-text'] = tone(P, 0.26, 0.04);
      v['--pal-heading'] = tone(P, 0.3, 0.14);
      v['--pal-muted'] = tone(P, 0.46, 0.05);
      v['--pal-sel-bg'] = tone(P, 0.88, 0.08);
      v['--pal-sel-text'] = tone(P, 0.22, 0.04);
      v['--pal-code-bg'] = tone(S, 0.94, 0.03);
      v['--pal-code-text'] = tone(P, 0.36, 0.1);
    }
    // dark code blocks + Win98 chrome (jmpa.io / portfolio): bar from primary, tinted grey faces, secondary desktop.
    v['--pal-pre-bg'] = tone(S, 0.22, 0.03);
    v['--pal-title-a'] = bar;
    v['--pal-title-b'] = 'oklch(from ' + bar + ' calc(l + 0.14) c h)';
    v['--pal-face'] = tone(S, 0.81, 0.015);
    v['--pal-face-hi'] = tone(S, 0.97, 0.01);
    v['--pal-face-shadow'] = tone(S, 0.55, 0.02);
    v['--pal-face-dark'] = tone(S, 0.3, 0.02);
    v['--pal-desk'] = tone(S, 0.55, 0.14);
    return v;
  }

  // sRGB hex -> oklch lightness (Ottosson), used only to tell the user when a colour was adjusted.
  function hexLightness(hex) {
    var c = [1, 3, 5].map(function (i) {
      var x = parseInt(hex.slice(i, i + 2), 16) / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    var l = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]);
    var m = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]);
    var s = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]);
    return 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  }

  function adjustedNote(c, dark) {
    var r = dark ? L_LINK.dark : L_LINK.light;
    var out = [];
    [['Primary', c.primary], ['Secondary', c.secondary]].forEach(function (x) {
      var l = hexLightness(x[1]);
      if (l < r[0] || l > r[1]) out.push(x[0]);
    });
    return out.length ? out.join(' and ') + ' adjusted for readability.' : '';
  }

  var VAR_NAMES = Object.keys(buildVars(DEFAULT, false));

  function isValid(c) {
    return !!c && typeof c === 'object' && HEX.test(c.primary) && HEX.test(c.secondary);
  }

  function readCustom(key) {
    try {
      var c = JSON.parse(localStorage.getItem(key));
      if (isValid(c)) return { primary: c.primary.toLowerCase(), secondary: c.secondary.toLowerCase() };
    } catch (e) { /* ignore corrupt storage */ }
    return null;
  }

  // Maps an old `palette` preset key to the new storage format, once, then deletes it.
  function migrate(paletteKey, customKey) {
    var old;
    try { old = localStorage.getItem(paletteKey); } catch (e) { return; }
    if (old === null) return;
    if (!readCustom(customKey) && Object.prototype.hasOwnProperty.call(LEGACY, old)) {
      localStorage.setItem(customKey, JSON.stringify(LEGACY[old]));
    }
    localStorage.removeItem(paletteKey);
  }

  var state = { custom: null, dark: false, listeners: [], customKey: 'palette-custom', schemeKey: 'scheme', toggle: null, onScheme: null, panels: [] };

  function current() { return state.custom || DEFAULT; }

  function applyVars() {
    var style = document.documentElement.style;
    var vars = buildVars(current(), state.dark);
    Object.keys(vars).forEach(function (k) { style.setProperty(k, vars[k]); });
    state.panels.forEach(function (p) { p.update(); });
    state.listeners.forEach(function (fn) { fn(Palette.get()); });
  }


  // Shared day/night: the `scheme` key ('light'|'dark') is an explicit choice; absent = follow the OS.
  function storedScheme() {
    try {
      var v = localStorage.getItem(state.schemeKey);
      return v === 'dark' || v === 'light' ? v : null;
    } catch (e) { return null; }
  }
  function osScheme() {
    if (DEFAULT_SCHEME) return DEFAULT_SCHEME;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyScheme(scheme) {
    state.dark = scheme === 'dark';
    var root = document.documentElement;
    root.classList.toggle('dark', state.dark);
    root.setAttribute('data-scheme', scheme);
    root.style.colorScheme = scheme;
    if (state.toggle) {
      state.toggle.classList.toggle('dark', state.dark);
      state.toggle.classList.toggle('light', !state.dark);
      state.toggle.setAttribute('aria-pressed', String(state.dark));
    }
    if (state.onScheme) state.onScheme(scheme, state.toggle);
    applyVars();
  }

  // ---- Shared colour-theme panel (the one modal UI every site uses) ----
  // Layout/behaviour live here; a site only themes it through --pm-* custom properties on the host element
  // (all optional, falling back to the --pal-* roles). The stylesheet is a constructed one (CSSOM), so a
  // strict style-src CSP is fine. Rules are single-class specificity and the sheet is adopted last, so the --pm-*
  // variables are the supported way to theme it (site CSS targeting inner elements needs a stronger selector).
  var PM_CSS = [
    '.pm{box-sizing:border-box;width:100%;display:flex;flex-direction:column;gap:14px;padding:14px;text-align:left;white-space:normal;',
    'font-family:var(--pm-font,inherit);font-size:var(--pm-fs,14px);line-height:1.4;color:var(--pm-fg,var(--pal-text,CanvasText));',
    'background:var(--pm-bg,var(--pal-surface,Canvas));border:var(--pm-bw,1px) solid var(--pm-border,var(--pal-border-strong,GrayText));',
    'border-radius:var(--pm-radius,8px);box-shadow:var(--pm-shadow,0 8px 24px rgba(0,0,0,.25));max-height:calc(100vh - 80px);overflow-y:auto}',
    '.pm *{box-sizing:border-box}',
    '.pm-head{display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.pm-title{margin:0;font-size:1.05em;font-weight:700;color:var(--pm-heading,var(--pal-heading,inherit))}',
    '.pm-label{margin:0 0 6px;font-size:.85em;font-weight:700;text-transform:var(--pm-label-case,none);letter-spacing:.02em;color:var(--pm-muted,var(--pal-muted,inherit))}',
    '.pm-btn{font:inherit;color:inherit;cursor:pointer;padding:6px 12px;background:var(--pm-ctl-bg,var(--pal-surface-2,ButtonFace));',
    'border:var(--pm-ctl-bw,2px) solid var(--pm-ctl-border,var(--pal-border-strong,GrayText));border-radius:var(--pm-ctl-radius,var(--pm-radius,8px));text-transform:inherit}',
    '.pm-btn:hover{border-color:var(--pm-accent,var(--pal-link,Highlight))}',
    '.pm-btn[aria-pressed=true]{border-color:var(--pm-accent,var(--pal-link,Highlight));font-weight:700}',
    '.pm-btn[aria-pressed=true]::before{content:"\\2713\\00a0"}',
    '.pm-follow{margin-top:8px}',
    '.pm-close{padding:2px 9px;line-height:1.2;font-size:1.1em}',
    '.pm-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '.pm-card{display:flex;flex-direction:column;gap:6px;min-width:0;padding:6px;font:inherit;color:inherit;text-align:left;cursor:pointer;',
    'background:transparent;border:var(--pm-ctl-bw,2px) solid var(--pm-ctl-border,var(--pal-border-strong,GrayText));border-radius:var(--pm-ctl-radius,var(--pm-radius,8px))}',
    '.pm-card:hover{border-color:var(--pm-accent,var(--pal-link,Highlight))}',
    '.pm-card[aria-pressed=true]{border-color:var(--pm-accent,var(--pal-link,Highlight));box-shadow:0 0 0 1px var(--pm-accent,var(--pal-link,Highlight))}',
    '.pm-card-name{font-weight:700;padding:0 2px}',
    '.pm-card[aria-pressed=true] .pm-card-name::after{content:"\\00a0\\2713"}',
    '.pm-mini{display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:8px;min-height:68px;font-size:11px;line-height:1.3;pointer-events:none;',
    'background:var(--pal-bg);border:1px solid var(--pal-border);border-radius:calc(var(--pm-radius,8px) / 2)}',
    '.pm-mini-h{font-size:13px;font-weight:700;color:var(--pal-heading)}',
    '.pm-mini-t{color:var(--pal-text)}',
    '.pm-mini-a,.pm-pv-a{color:var(--pal-link);text-decoration:underline}',
    '.pm-mini-b,.pm-pv-b{display:inline-block;padding:2px 8px;font-weight:700;background:var(--pal-accent2);color:var(--pal-btn-text);border-radius:calc(var(--pm-radius,8px) / 2)}',
    '.pm-row{display:grid;grid-template-columns:64px 1fr;grid-template-rows:auto auto;column-gap:12px;align-items:center}',
    '.pm-row input[type=color]{grid-row:1 / 3;width:64px;height:44px;padding:0;cursor:pointer;background:none;',
    'border:var(--pm-ctl-bw,2px) solid var(--pm-ctl-border,var(--pal-border-strong,GrayText));border-radius:var(--pm-ctl-radius,var(--pm-radius,8px))}',
    '.pm-row input[type=color]::-webkit-color-swatch-wrapper{padding:0}',
    '.pm-row input[type=color]::-webkit-color-swatch{border:0;border-radius:calc(var(--pm-ctl-radius,var(--pm-radius,8px)) / 2)}',
    '.pm-row input[type=color]::-moz-color-swatch{border:0}',
    '.pm-row label{align-self:end;font-weight:700;cursor:pointer}',
    '.pm-hex{align-self:start;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-transform:uppercase;color:var(--pm-muted,var(--pal-muted,inherit))}',
    '.pm-preview{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:10px 12px;background:var(--pal-bg);color:var(--pal-text);',
    'border:1px solid var(--pal-border);border-radius:calc(var(--pm-radius,8px) / 2)}',
    '.pm-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}',
    '.pm-note{flex:1 1 100%;margin:0;font-size:.9em;color:var(--pm-muted,var(--pal-muted,inherit))}',
    '.pm-note:empty{display:none}',
    '.pm :focus-visible{outline:2px solid var(--pm-accent,var(--pal-focus,Highlight));outline-offset:2px}'
  ].join('');

  function pmStyles() {
    if (pmStyles.done) return;
    pmStyles.done = true;
    try {
      var sheet = new CSSStyleSheet();
      sheet.replaceSync(PM_CSS);
      document.adoptedStyleSheets = document.adoptedStyleSheets.concat([sheet]);
    } catch (e) {
      var el = document.createElement('style');
      el.textContent = PM_CSS;
      document.head.appendChild(el);
    }
  }

  function h(tag, cls, text, attrs) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  var PM_MINI_VARS = ['--pal-bg', '--pal-border', '--pal-heading', '--pal-text', '--pal-link', '--pal-accent2', '--pal-btn-text'];
  var pmUid = 0;

  // Builds the panel into `host` (replacing its content) and keeps it in sync with Palette. ids: { primary, secondary, reset, note } (all optional).
  // opts.onClose adds a Close button. A pinned default scheme (defaultScheme) has no "follow system" option, and Reset also returns to it.
  function mountPanel(host, ids, opts) {
    ids = ids || {};
    opts = opts || {};
    pmStyles();
    var uid = ++pmUid;
    var pid = ids.primary || 'pm-primary-' + uid;
    var sid = ids.secondary || 'pm-secondary-' + uid;
    host.textContent = '';
    var root = h('div', 'pm');
    var head = h('div', 'pm-head');
    head.appendChild(h('h2', 'pm-title', 'Colour theme', { id: 'pm-title-' + uid }));
    if (opts.onClose) {
      var close = h('button', 'pm-btn pm-close', '\u00d7', { type: 'button', 'aria-label': 'Close colour theme' });
      close.addEventListener('click', opts.onClose);
      head.appendChild(close);
    }
    root.appendChild(head);

    var scheme = h('div', 'pm-scheme', '', { role: 'group', 'aria-labelledby': 'pm-scheme-' + uid });
    scheme.appendChild(h('p', 'pm-label', 'Day or night', { id: 'pm-scheme-' + uid }));
    var cards = h('div', 'pm-cards');
    var minis = {};
    var cardEls = {};
    [['light', 'Day', 'Switch to day'], ['dark', 'Night', 'Switch to night']].forEach(function (d) {
      var card = h('button', 'pm-card', '', { type: 'button', 'data-scheme': d[0], 'aria-label': d[1], 'aria-pressed': 'false', title: d[2] });
      var mini = h('span', 'pm-mini', '', { 'aria-hidden': 'true' });
      mini.appendChild(h('span', 'pm-mini-h', 'Heading'));
      var t = h('span', 'pm-mini-t', 'Text and a ');
      t.appendChild(h('span', 'pm-mini-a', 'link'));
      mini.appendChild(t);
      mini.appendChild(h('span', 'pm-mini-b', 'Button'));
      card.appendChild(mini);
      card.appendChild(h('span', 'pm-card-name', d[1], { 'aria-hidden': 'true' }));
      card.addEventListener('click', function () { Palette.setScheme(d[0]); });
      cards.appendChild(card);
      minis[d[0]] = mini;
      cardEls[d[0]] = card;
    });
    scheme.appendChild(cards);
    var follow = null;
    if (!DEFAULT_SCHEME) {
      follow = h('button', 'pm-btn pm-follow', 'Follow system', { type: 'button', 'aria-pressed': 'false' });
      follow.addEventListener('click', function () { Palette.followOs(); });
      scheme.appendChild(follow);
    }
    root.appendChild(scheme);

    var inputs = {};
    var hexes = {};
    [['primary', 'Primary', pid], ['secondary', 'Secondary', sid]].forEach(function (d) {
      var row = h('div', 'pm-row');
      var input = h('input', '', '', { type: 'color', id: d[2], value: current()[d[0]] });
      row.appendChild(input);
      row.appendChild(h('label', '', d[1], { for: d[2] }));
      var hex = h('span', 'pm-hex', current()[d[0]], { id: d[2] + '-hex' });
      input.setAttribute('aria-describedby', hex.id);
      row.appendChild(hex);
      input.addEventListener('input', function () { Palette.set({ primary: inputs.primary.value, secondary: inputs.secondary.value }); });
      inputs[d[0]] = input;
      hexes[d[0]] = hex;
      root.appendChild(row);
    });

    var preview = h('div', 'pm-preview', '', { 'aria-hidden': 'true' });
    preview.appendChild(h('span', 'pm-pv-t', 'Preview: text with a '));
    preview.lastChild.appendChild(h('span', 'pm-pv-a', 'link'));
    preview.appendChild(h('span', 'pm-pv-b', 'Button'));
    root.appendChild(preview);

    var actions = h('div', 'pm-actions');
    var reset = h('button', 'pm-btn pm-reset', 'Reset', { type: 'button' });
    if (ids.reset) reset.id = ids.reset;
    reset.addEventListener('click', function (e) {
      e.preventDefault();
      Palette.reset();
      if (DEFAULT_SCHEME) Palette.followOs();
    });
    actions.appendChild(reset);
    var note = h('p', 'pm-note', '', { role: 'status' });
    if (ids.note) note.id = ids.note;
    actions.appendChild(note);
    root.appendChild(actions);
    host.appendChild(root);

    var panel = {
      root: root,
      update: function () {
        var c = current();
        ['primary', 'secondary'].forEach(function (k) {
          inputs[k].value = c[k];
          hexes[k].textContent = c[k];
        });
        ['light', 'dark'].forEach(function (s) {
          var vars = buildVars(c, s === 'dark');
          PM_MINI_VARS.forEach(function (k) { minis[s].style.setProperty(k, vars[k]); });
          cardEls[s].setAttribute('aria-pressed', String(state.dark === (s === 'dark')));
        });
        if (follow) follow.setAttribute('aria-pressed', String(!storedScheme()));
        note.textContent = state.custom ? adjustedNote(state.custom, state.dark) : '';
      },
      focus: function () {
        var active = cardEls[state.dark ? 'dark' : 'light'];
        active.focus({ preventScroll: true });
      }
    };
    state.panels.push(panel);
    panel.update();
    return panel;
  }

  var Palette = {
    DEFAULT: DEFAULT,
    mountPanel: mountPanel,
    LEGACY: LEGACY,
    VAR_NAMES: VAR_NAMES,
    vars: buildVars,
    get: function () {
      return { primary: current().primary, secondary: current().secondary, custom: !!state.custom };
    },
    // Validates, persists and applies a pair. Returns false (and changes nothing) for invalid input.
    set: function (c) {
      if (!isValid(c)) return false;
      state.custom = { primary: c.primary.toLowerCase(), secondary: c.secondary.toLowerCase() };
      localStorage.setItem(state.customKey, JSON.stringify(state.custom));
      applyVars();
      return true;
    },
    reset: function () {
      state.custom = null;
      localStorage.removeItem(state.customKey);
      applyVars();
    },
    onChange: function (fn) { state.listeners.push(fn); },
    // "Primary adjusted for readability." text for UIs that don't use the init() note element (e.g. React).
    note: function () { return state.custom ? adjustedNote(state.custom, state.dark) : ''; },
    scheme: function () { return storedScheme() || osScheme(); },
    setScheme: function (s) {
      if (s !== 'dark' && s !== 'light') return false;
      try { localStorage.setItem(state.schemeKey, s); } catch (e) { /* storage unavailable */ }
      applyScheme(s);
      return true;
    },
    toggleScheme: function () { return Palette.setScheme(state.dark ? 'light' : 'dark'); },
    // Forget the explicit choice and follow the OS again.
    followOs: function () {
      try { localStorage.removeItem(state.schemeKey); } catch (e) { /* ignore */ }
      applyScheme(osScheme());
    },
    init: function (opts) {
      opts = opts || {};
      // Per-page default pair (Reset, "nothing stored", input initial values); the shared master keeps sunset otherwise.
      if (isValid(opts.defaults)) {
        DEFAULT = { primary: opts.defaults.primary.toLowerCase(), secondary: opts.defaults.secondary.toLowerCase() };
        Palette.DEFAULT = DEFAULT;
      }
      if (opts.defaultScheme === 'dark' || opts.defaultScheme === 'light') DEFAULT_SCHEME = opts.defaultScheme;
      var schemeKey = opts.schemeKey || 'scheme';
      var toggleId = opts.toggleId;
      var customIds = opts.customIds; // { primary, secondary, reset, note } (all optional ids)
      state.customKey = opts.customKey || 'palette-custom';
      state.schemeKey = schemeKey;
      state.onScheme = opts.onScheme;

      // Applied immediately (this runs in <head>) so there is no flash of the wrong colours.
      migrate(opts.paletteKey || 'palette', state.customKey);
      state.custom = readCustom(state.customKey);
      applyScheme(Palette.scheme());

      // Follow the OS live until the user makes an explicit choice.
      if (window.matchMedia) {
        var mq = window.matchMedia('(prefers-color-scheme: dark)');
        var onOs = function () { if (!storedScheme()) applyScheme(osScheme()); };
        if (mq.addEventListener) mq.addEventListener('change', onOs);
        else if (mq.addListener) mq.addListener(onOs);
      }
      document.addEventListener('DOMContentLoaded', function () {
        var trigger = opts.triggerId && document.getElementById(opts.triggerId);
        var popup = opts.popupId && document.getElementById(opts.popupId);
        var toggle = toggleId && document.getElementById(toggleId);

        var setOpen = function () {};
        var panel = null;
        if (trigger && popup) {
          popup.setAttribute('role', 'dialog');
          popup.setAttribute('aria-label', 'Colour theme');
          popup.setAttribute('tabindex', '-1');
          trigger.setAttribute('aria-haspopup', 'dialog');
          trigger.setAttribute('aria-expanded', 'false');
          setOpen = function (open) {
            popup.classList.toggle('open', open);
            trigger.setAttribute('aria-expanded', String(open));
          };
        }
        if (popup && customIds) {
          panel = mountPanel(popup, customIds, {
            onClose: function () { setOpen(false); if (trigger) trigger.focus(); }
          });
          applyVars();
        }
        if (trigger && popup) {
          trigger.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var open = !popup.classList.contains('open');
            setOpen(open);
            if (open && panel) panel.focus();
          });
          // Anchors acting as buttons don't react to Space natively.
          trigger.addEventListener('keydown', function (e) {
            if (e.key === ' ' && trigger.tagName === 'A') { e.preventDefault(); trigger.click(); }
          });
          if (opts.outsideClose !== false) {
            document.addEventListener('click', function (e) {
              if (!popup.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) setOpen(false);
            });
          }
          document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && popup.classList.contains('open')) {
              setOpen(false);
              trigger.focus();
            }
          });
        }

        if (toggle) {
          state.toggle = toggle;
          applyScheme(Palette.scheme());
          toggle.addEventListener('click', function (e) {
            e.preventDefault();
            Palette.toggleScheme();
          });
        }
      });
    }
  };

  window.Palette = Palette;
})();
