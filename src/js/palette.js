// jmpa-io shared palette + day/night core — master copy. Mirrored into
// jmpa.io, startpage.jcleal.me. Edit here first.
(function () {
  var PALETTES = ['ocean', 'forest', 'sunset', 'violet', 'yellow', 'grey', 'purple', 'crimson', 'teal'];

  function applyPalette(key, btnSelector) {
    PALETTES.forEach(function (p) { document.documentElement.classList.remove(p); });
    if (key && PALETTES.indexOf(key) !== -1) document.documentElement.classList.add(key);
    document.querySelectorAll(btnSelector).forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.palette === key);
    });
  }

  function applyScheme(scheme, toggleEl, onScheme) {
    document.documentElement.classList.toggle('dark', scheme === 'dark');
    if (toggleEl) {
      toggleEl.classList.toggle('dark', scheme === 'dark');
      toggleEl.classList.toggle('light', scheme !== 'dark');
    }
    if (onScheme) onScheme(scheme, toggleEl);
  }

  window.Palette = {
    PALETTES: PALETTES,
    init: function (opts) {
      opts = opts || {};
      var paletteKey  = opts.paletteKey  || 'palette';
      var schemeKey   = opts.schemeKey   || 'scheme';
      var btnSelector = opts.btnSelector || '.palette-btn';
      var triggerId   = opts.triggerId;
      var popupId     = opts.popupId;
      var toggleId    = opts.toggleId;
      var onScheme    = opts.onScheme;

      // apply immediately to avoid a flash of the wrong theme/palette
      applyPalette(localStorage.getItem(paletteKey), btnSelector);
      var scheme = localStorage.getItem(schemeKey) ||
        (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      applyScheme(scheme, toggleId ? document.getElementById(toggleId) : null, onScheme);

      document.addEventListener('DOMContentLoaded', function () {
        var trigger = triggerId && document.getElementById(triggerId);
        var popup   = popupId && document.getElementById(popupId);
        var toggle  = toggleId && document.getElementById(toggleId);

        if (trigger && popup) {
          trigger.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            popup.classList.toggle('open');
          });
          document.addEventListener('click', function (e) {
            if (!popup.contains(e.target) && e.target !== trigger) {
              popup.classList.remove('open');
            }
          });
        }

        document.querySelectorAll(btnSelector).forEach(function (btn) {
          var p = btn.dataset.palette;
          btn.classList.toggle('active', p === (localStorage.getItem(paletteKey) || ''));
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var current = localStorage.getItem(paletteKey);
            if (current === p) {
              localStorage.removeItem(paletteKey);
              applyPalette(null, btnSelector);
            } else {
              localStorage.setItem(paletteKey, p);
              applyPalette(p, btnSelector);
            }
            if (popup) popup.classList.remove('open');
          });
        });

        if (toggle) {
          applyScheme(localStorage.getItem(schemeKey) || scheme, toggle, onScheme);
          toggle.addEventListener('click', function () {
            var next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
            localStorage.setItem(schemeKey, next);
            applyScheme(next, toggle, onScheme);
          });
        }
      });
    }
  };
})();
