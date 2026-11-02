// Colours + day/night, applied from <head> before first paint (external so the CSP needs no inline-script exception).
Palette.init({
  defaults: { primary: '#fc59a6', secondary: '#a3a3a3' }, // from the iTerm "Dotfiles" profile: pink + grey accents
  triggerId: 'palette-trigger',
  popupId: 'palette-popup',
  customIds: { primary: 'custom-primary', secondary: 'custom-secondary', reset: 'custom-reset', note: 'custom-note' },
  toggleId: 'scheme-toggle',
  onScheme: function (scheme, toggle) {
    if (!toggle) return;
    toggle.textContent = '';
    toggle.appendChild(SPIcon(scheme === 'dark' ? 'moon' : 'sun'));
    var l = document.createElement('span');
    l.textContent = scheme === 'dark' ? 'Night' : 'Day';
    toggle.appendChild(l);
  }
});
