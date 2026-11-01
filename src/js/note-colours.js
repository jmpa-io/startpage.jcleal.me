// Post-it colours derived from the shared colour picker. tints(primary, secondary, dark) returns one
// {bg, bar, ink} hex triple per slot (the order notes store in startpage.v1). Pure: no DOM.
//   0 primary tint, 1 secondary tint, 2 warm yellow, 3 green, 4 pink, 5 primary/secondary blend.
// The warm slots start from a fixed hue and are pulled 25% toward the picker so they sit in the palette.
(function (root) {
  function lin(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function gam(v) { return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }

  function hexToOklch(hex) {
    var c = [1, 3, 5].map(function (i) { return lin(parseInt(hex.slice(i, i + 2), 16) / 255); });
    var l = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]);
    var m = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]);
    var s = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]);
    var L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    var a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    var b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return { l: L, c: Math.sqrt(a * a + b * b), h: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 };
  }

  function rgb(L, C, H) {
    var a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
    var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    var m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    var s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ];
  }
  function inGamut(v) { return v.every(function (x) { return x >= -0.0005 && x <= 1.0005; }); }

  // Reduces chroma until the colour fits sRGB, so lightness (and so contrast) is kept.
  function oklchToHex(L, C, H) {
    var v = rgb(L, C, H);
    for (var i = 0; i < 30 && !inGamut(v); i++) { C *= 0.9; v = rgb(L, C, H); }
    return '#' + v.map(function (x) {
      var n = Math.round(255 * gam(Math.min(1, Math.max(0, x))));
      return (n < 16 ? '0' : '') + n.toString(16);
    }).join('');
  }

  function diff(a, b) { return ((b - a + 540) % 360) - 180; } // shortest signed arc a -> b
  function pull(base, toward, k) { return (base + k * diff(base, toward) + 360) % 360; }

  function luminance(hex) {
    var c = [1, 3, 5].map(function (i) { return lin(parseInt(hex.slice(i, i + 2), 16) / 255); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    var x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  function tints(primary, secondary, dark) {
    var P = hexToOklch(primary), S = hexToOklch(secondary);
    var mix = pull(P.h, S.h, 0.5);
    // chroma: follows the pick (capped) so a grey pick gives a grey note; the extra slots use a fixed gentle chroma
    var cp = Math.min(0.09, Math.max(0.02, P.c * 0.5));
    var cs = Math.min(0.09, Math.max(0.02, S.c * 0.5));
    var cw = dark ? 0.08 : 0.09;
    var slots = [
      [P.h, cp], [S.h, cs], [pull(95, P.h, 0.25), cw], [pull(145, S.h, 0.25), cw], [pull(350, P.h, 0.25), cw], [mix, (cp + cs) / 2]
    ];
    var bg = dark ? 0.42 : 0.93, bar = dark ? 0.35 : 0.87, ink = dark ? 0.98 : 0.22;
    return slots.map(function (s) {
      return {
        bg: oklchToHex(bg, s[1], s[0]),
        bar: oklchToHex(bar, s[1], s[0]),
        ink: oklchToHex(ink, Math.min(s[1], 0.02), s[0])
      };
    });
  }

  var api = { tints: tints, contrast: contrast, hexToOklch: hexToOklch, oklchToHex: oklchToHex, SLOTS: 6 };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NoteColours = api;
})(typeof window !== 'undefined' ? window : this);
