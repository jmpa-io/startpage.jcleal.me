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

  // Pre-picker preset names, migrated once to their primary/secondary pair.
  var LEGACY = {
    ocean:   { primary: '#007baf', secondary: '#cd4805' },
    forest:  { primary: '#007500', secondary: '#b243ba' },
    sunset:  DEFAULT,
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

  var state = { custom: null, dark: false, listeners: [], customKey: 'palette-custom', schemeKey: 'scheme', toggle: null, onScheme: null, inputs: null, note: null };

  function current() { return state.custom || DEFAULT; }

  function applyVars() {
    var style = document.documentElement.style;
    var vars = buildVars(current(), state.dark);
    Object.keys(vars).forEach(function (k) { style.setProperty(k, vars[k]); });
    if (state.note) state.note.textContent = state.custom ? adjustedNote(state.custom, state.dark) : '';
    state.listeners.forEach(function (fn) { fn(Palette.get()); });
  }

  function syncInputs() {
    if (!state.inputs) return;
    state.inputs.primary.value = current().primary;
    state.inputs.secondary.value = current().secondary;
  }

  // Shared day/night: the `scheme` key ('light'|'dark') is an explicit choice; absent = follow the OS.
  function storedScheme() {
    try {
      var v = localStorage.getItem(state.schemeKey);
      return v === 'dark' || v === 'light' ? v : null;
    } catch (e) { return null; }
  }
  function osScheme() {
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

  var Palette = {
    DEFAULT: DEFAULT,
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
      syncInputs();
      return true;
    },
    reset: function () {
      state.custom = null;
      localStorage.removeItem(state.customKey);
      applyVars();
      syncInputs();
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

        if (trigger && popup) {
          var setOpen = function (open) {
            popup.classList.toggle('open', open);
            trigger.setAttribute('aria-expanded', String(open));
          };
          trigger.setAttribute('aria-expanded', 'false');
          trigger.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(!popup.classList.contains('open'));
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

        if (customIds) {
          var primary = document.getElementById(customIds.primary);
          var secondary = document.getElementById(customIds.secondary);
          var reset = customIds.reset && document.getElementById(customIds.reset);
          state.note = customIds.note ? document.getElementById(customIds.note) : null;
          if (primary && secondary) {
            state.inputs = { primary: primary, secondary: secondary };
            syncInputs();
            applyVars();
            var onInput = function () { Palette.set({ primary: primary.value, secondary: secondary.value }); };
            primary.addEventListener('input', onInput);
            secondary.addEventListener('input', onInput);
            if (reset) {
              reset.addEventListener('click', function (e) {
                e.preventDefault();
                Palette.reset();
              });
            }
          }
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
