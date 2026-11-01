// Tiny stroke-icon set (24px grid, currentColor). SPIcon(name) returns a decorative <svg>.
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var P = {
    pencil: 'M4 20h4L19 9l-4-4L4 16v4z M13.5 6.5l4 4',
    plus: 'M12 5v14M5 12h14',
    group: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z M12 11v5M9.5 13.5h5',
    note: 'M5 4h14v11l-5 5H5z M14 20v-5h5',
    download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
    upload: 'M12 16V5M7 9l5-5 5 5M5 20h14',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
    up: 'M6 15l6-6 6 6',
    down: 'M6 9l6 6 6-6',
    reset: 'M4 12a8 8 0 1 0 3-6.2M4 4v5h5',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
    palette: 'M12 3a9 9 0 0 0 0 18c1.5 0 2-1 1.5-2s0-2 1.5-2h2a4 4 0 0 0 4-4c0-5-4.5-10-9-10z M7.5 11h.01 M10 7.5h.01 M14.5 7.5h.01',
    min: 'M5 17h14',
    max: 'M5 5h14v14H5z',
    restore: 'M8 8V4h12v12h-4 M4 8h12v12H4z',
    close: 'M6 6l12 12M18 6L6 18',
    check: 'M5 12l5 5 9-10',
    arch: 'M12 3L4 21l4-2 4-6 4 6 4 2z'
  };
  window.SPIcon = function (name, size) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', 'sp-ico');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', String(size || 16));
    s.setAttribute('height', String(size || 16));
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', P[name] || '');
    s.appendChild(p);
    return s;
  };
})();
